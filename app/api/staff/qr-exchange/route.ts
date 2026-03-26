import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

// POST /api/staff/qr-exchange
// Exchanges a short-lived QR token (stored server-side) for Supabase session tokens.
// The client then calls createStaffClient().setSession() -- no Supabase redirect needed.
export async function POST(req: NextRequest) {
  const { qr } = await req.json();
  if (!qr || typeof qr !== 'string') {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('staff_qr_tokens')
    .select('id, access_token, refresh_token, expires_at, used')
    .eq('id', qr)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Token not found' }, { status: 404 });
  }
  if (data.used) {
    return NextResponse.json({ error: 'Token already used' }, { status: 400 });
  }
  if (new Date(data.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Token expired' }, { status: 400 });
  }

  // Mark as used
  await supabaseAdmin.from('staff_qr_tokens').update({ used: true }).eq('id', qr);

  // Clean up expired tokens opportunistically
  await supabaseAdmin
    .from('staff_qr_tokens')
    .delete()
    .lt('expires_at', new Date().toISOString());

  return NextResponse.json({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  });
}
