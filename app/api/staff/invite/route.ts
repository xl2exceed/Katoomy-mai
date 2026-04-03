// POST /api/staff/invite
// Creates a staff row and sends a Supabase email invite so the staff member can set their password.
// Also used to resend an invite: pass { staffId } instead of full staff data.
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: business } = await supabaseAdmin
    .from('businesses')
    .select('id')
    .eq('owner_user_id', user.id)
    .single();

  if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 403 });

  const body = await req.json();
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  const origin = host ? `${proto}://${host}` : (process.env.NEXT_PUBLIC_APP_URL || 'https://katoomy.com');
  const redirectTo = `${origin}/staff/auth`;

  // ── Resend invite for existing staff ─────────────────────────────────────
  if (body.staffId) {
    const { data: staff } = await supabaseAdmin
      .from('staff')
      .select('email, user_id')
      .eq('id', body.staffId)
      .eq('business_id', business.id)
      .single();

    if (!staff?.email) return NextResponse.json({ error: 'Staff member not found or has no email' }, { status: 404 });

    // Try invite email first; fall back to magic link if user already exists/confirmed
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(staff.email, { redirectTo });
    if (inviteError) {
      console.error('[staff/invite] inviteUserByEmail failed:', inviteError.message, '— falling back to magic link');
      // Ensure auth user exists
      if (!staff.user_id) {
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: staff.email,
          email_confirm: true,
          password: crypto.randomUUID(),
        });
        if (!createError && newUser?.user?.id) {
          await supabaseAdmin.from('staff').update({ user_id: newUser.user.id }).eq('id', body.staffId);
        }
      }
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email: staff.email,
        options: { redirectTo },
      });
      if (linkError) {
        console.error('[staff/invite] generateLink also failed:', linkError.message);
        return NextResponse.json({ error: `Email failed: ${inviteError.message}` }, { status: 500 });
      }
      // Return the link so the admin can share it manually if needed
      return NextResponse.json({ success: true, fallbackUrl: linkData.properties.action_link, warning: 'Email delivery failed — use the link to log in manually.' });
    }

    await supabaseAdmin.from('staff').update({ user_id: inviteData.user.id }).eq('id', body.staffId);
    return NextResponse.json({ success: true });
  }

  // ── Create new staff + send invite ────────────────────────────────────────
  const {
    full_name, email, role, phone, display_name,
    visible_for_booking, accepting_new_clients, is_active, working_hours,
  } = body;

  if (!full_name) return NextResponse.json({ error: 'Full name is required' }, { status: 400 });

  const { data: newStaff, error: insertError } = await supabaseAdmin
    .from('staff')
    .insert({
      business_id: business.id,
      full_name,
      display_name: display_name || null,
      role: role || null,
      phone: phone || null,
      email: email || null,
      is_active: is_active ?? true,
      visible_for_booking: visible_for_booking ?? true,
      accepting_new_clients: accepting_new_clients ?? true,
      working_hours: working_hours || undefined,
    })
    .select()
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  // Send invite only if email provided
  if (email) {
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, { redirectTo });
    if (inviteError) {
      console.error('[staff/invite] inviteUserByEmail failed for new staff:', inviteError.message);
      // Don't delete the staff row — just note the email failure
      return NextResponse.json({ staffId: newStaff.id, emailError: inviteError.message }, { status: 200 });
    }
    await supabaseAdmin.from('staff').update({ user_id: inviteData.user.id }).eq('id', newStaff.id);
  }

  return NextResponse.json({ staffId: newStaff.id });
}
