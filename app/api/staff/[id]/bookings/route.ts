// GET /api/staff/[id]/bookings?period=today|week|month|upcoming|past
// For date-bounded periods, caller should pass &start=<ISO>&end=<ISO> computed in
// the browser's local timezone so the server doesn't use UTC midnight.
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
async function checkAccess(userId: string, staffId: string) {
  const { data: staff } = await supabaseAdmin.from('staff').select('id, business_id, user_id').eq('id', staffId).single();
  if (!staff) return null;
  if (staff.user_id === userId) return staff;
  const { data: biz } = await supabaseAdmin.from('businesses').select('id').eq('owner_user_id', userId).eq('id', staff.business_id).single();
  return biz ? staff : null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: staffId } = await params;
  const staff = await checkAccess(user.id, staffId);
  if (!staff) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const period = searchParams.get('period') ?? 'upcoming';

  const now = new Date();

  // Base query — filters first, transforms (order/limit) applied at the end
  let query = supabaseAdmin
    .from('bookings')
    .select('id, customer_id, business_id, start_ts, end_ts, status, payment_status, total_price_cents, deposit_amount_cents, customer_notes, customers(full_name, phone), services(name, duration_minutes)')
    .eq('staff_id', staffId);

  if (period === 'today') {
    // Use client-supplied local-timezone boundaries to avoid UTC midnight mismatch
    const startParam = searchParams.get('start');
    const endParam = searchParams.get('end');
    const start = startParam ? new Date(startParam) : (() => { const d = new Date(now); d.setHours(0, 0, 0, 0); return d; })();
    const end   = endParam   ? new Date(endParam)   : (() => { const d = new Date(now); d.setHours(23, 59, 59, 999); return d; })();
    query = query.gte('start_ts', start.toISOString()).lte('start_ts', end.toISOString());
  } else if (period === 'week') {
    const startParam = searchParams.get('start');
    const start = startParam ? new Date(startParam) : (() => { const d = new Date(now); d.setHours(0, 0, 0, 0); return d; })();
    const end = new Date(start); end.setDate(end.getDate() + 7);
    query = query.gte('start_ts', start.toISOString()).lt('start_ts', end.toISOString());
  } else if (period === 'month') {
    const startParam = searchParams.get('start');
    const start = startParam ? new Date(startParam) : new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    query = query.gte('start_ts', start.toISOString()).lt('start_ts', end.toISOString());
  } else if (period === 'upcoming') {
    query = query
      .gt('start_ts', now.toISOString())
      .in('status', ['confirmed', 'requested']);
  } else if (period === 'past') {
    query = query.lt('start_ts', now.toISOString());
  }

  // Apply transforms last
  const ascending = period === 'upcoming' || period === 'today' || period === 'week' || period === 'month';
  const { data, error } = await query
    .order('start_ts', { ascending })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ bookings: data || [] });
}
