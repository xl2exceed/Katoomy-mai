// POST /api/staff/[id]/generate-qr
// Creates a staff auth user (if needed, email_confirm: true) and returns a one-time magic link URL.
// The admin shows this as a QR code for the staff member to scan — no email required.
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: staffId } = await params;

  const { data: staff } = await supabaseAdmin
    .from('staff')
    .select('id, business_id, email, user_id')
    .eq('id', staffId)
    .single();

  if (!staff) return NextResponse.json({ error: 'Staff not found' }, { status: 404 });

  // Only the business owner can generate QR codes
  const { data: biz } = await supabaseAdmin
    .from('businesses')
    .select('id')
    .eq('owner_user_id', user.id)
    .eq('id', staff.business_id)
    .single();

  if (!biz) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!staff.email) return NextResponse.json({ error: 'Staff member has no email address' }, { status: 400 });

  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  const origin = host ? `${proto}://${host}` : (process.env.NEXT_PUBLIC_APP_URL || 'https://katoomy-mai.vercel.app');
  const redirectTo = `${origin}/staff/auth`;

  // Ensure an auth user exists for this staff member
  if (!staff.user_id) {
    let authUserId: string;

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: staff.email,
      email_confirm: true,
      password: crypto.randomUUID(),
    });

    if (createError) {
      // User already exists in auth.users but staff.user_id was never saved — look them up
      if (createError.message.toLowerCase().includes('already') || createError.message.toLowerCase().includes('registered')) {
        const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
        const existing = listData?.users?.find((u) => u.email === staff.email);
        if (!existing) return NextResponse.json({ error: createError.message }, { status: 500 });
        authUserId = existing.id;
      } else {
        return NextResponse.json({ error: createError.message }, { status: 500 });
      }
    } else {
      authUserId = newUser.user.id;
    }

    await supabaseAdmin.from('staff').update({ user_id: authUserId }).eq('id', staffId);
  }

  // Generate a one-time magic link (expires in ~24h)
  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email: staff.email,
    options: { redirectTo },
  });

  if (linkError) return NextResponse.json({ error: linkError.message }, { status: 500 });

  // Server-side exchange: fetch the magic link to extract session tokens without the browser
  // ever visiting supabase.co — prevents contaminating other portal sessions on the same device.
  let magicLinkConsumed = false;
  try {
    const magicLinkRes = await fetch(linkData.properties.action_link, {
      redirect: 'manual',
      headers: { 'User-Agent': 'Katoomy-Server/1.0' },
    });

    const location = magicLinkRes.headers.get('location') ?? '';
    const hashIdx = location.indexOf('#');
    if (hashIdx !== -1) {
      const fragment = new URLSearchParams(location.substring(hashIdx + 1));
      const accessToken = fragment.get('access_token');
      const refreshToken = fragment.get('refresh_token');
      if (accessToken && refreshToken) {
        magicLinkConsumed = true; // fetching it consumed the one-time token
        const tokenId = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 min
        await supabaseAdmin.from('staff_qr_tokens').insert({
          id: tokenId,
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_at: expiresAt,
        });
        return NextResponse.json({ url: `${origin}/staff/auth?qr=${tokenId}` });
      }
    }
  } catch {
    // Fall through — generate a fresh magic link if we consumed the original one
  }

  // If the server-side exchange consumed the magic link but failed to store it,
  // generate a fresh one so the QR code still works.
  if (magicLinkConsumed) {
    const { data: freshLink } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: staff.email,
      options: { redirectTo },
    });
    if (freshLink?.properties?.action_link) {
      return NextResponse.json({ url: freshLink.properties.action_link });
    }
  }

  // Fallback: return the original Supabase magic link directly
  return NextResponse.json({ url: linkData.properties.action_link });
}
