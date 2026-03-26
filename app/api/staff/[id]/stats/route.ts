// GET /api/staff/[id]/stats
// Returns overview dashboard numbers for a staff member.
// Auth: caller must be the business owner or the staff member themselves.
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
async function checkAccess(userId: string, staffId: string) {
  const { data: staff } = await supabaseAdmin
    .from('staff')
    .select('id, business_id, user_id')
    .eq('id', staffId)
    .single();

  if (!staff) return null;
  if (staff.user_id === userId) return staff;

  const { data: biz } = await supabaseAdmin
    .from('businesses')
    .select('id')
    .eq('owner_user_id', userId)
    .eq('id', staff.business_id)
    .single();

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

  const now = new Date();
  const { searchParams } = new URL(req.url);

  // Use client-supplied local-timezone today boundaries if provided
  const todayStartParam = searchParams.get('todayStart');
  const todayEndParam   = searchParams.get('todayEnd');
  const todayStart = todayStartParam ? new Date(todayStartParam) : (() => { const d = new Date(now); d.setHours(0, 0, 0, 0); return d; })();
  const todayEnd   = todayEndParam   ? new Date(todayEndParam)   : (() => { const d = new Date(now); d.setHours(23, 59, 59, 999); return d; })();

  const [todayRes, upcomingRes, completedRes] = await Promise.all([
    supabaseAdmin.from('bookings').select('id', { count: 'exact', head: true })
      .eq('staff_id', staffId)
      .gte('start_ts', todayStart.toISOString())
      .lte('start_ts', todayEnd.toISOString())
      .not('status', 'in', '("cancelled","no_show")'),

    // Always count all business upcoming (not just staff-assigned) so unassigned
    // bookings and single-staff businesses see the correct number.
    supabaseAdmin.from('bookings').select('id', { count: 'exact', head: true })
      .eq('business_id', staff.business_id)
      .gt('start_ts', now.toISOString())
      .in('status', ['confirmed', 'requested']),

    supabaseAdmin.from('bookings').select('id, customer_id, total_price_cents')
      .eq('staff_id', staffId)
      .eq('status', 'completed'),
  ]);

  const completed = completedRes.data || [];
  const uniqueCustomers = new Set(completed.map((b) => b.customer_id));
  const serviceRevenueCents = completed.reduce((sum, b) => sum + (b.total_price_cents || 0), 0);

  // Tips: join through bookings since tips.staff_id may be null for older records
  const bookingIds = completed.map((b) => b.id);
  let tipsCents = 0;
  if (bookingIds.length > 0) {
    const { data: tipsData } = await supabaseAdmin
      .from('tips')
      .select('amount_cents')
      .in('booking_id', bookingIds)
      .eq('status', 'paid');
    tipsCents = (tipsData || []).reduce((sum, t) => sum + t.amount_cents, 0);
  }

  return NextResponse.json({
    todayBookings: todayRes.count ?? 0,
    upcomingBookings: upcomingRes.count ?? 0,
    customersServiced: uniqueCustomers.size,
    serviceRevenueCents,
    tipsCents,
    totalRevenueCents: serviceRevenueCents + tipsCents,
  });
}
