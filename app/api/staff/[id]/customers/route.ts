// GET /api/staff/[id]/customers
// Returns distinct customers who have had completed bookings with this staff member.
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

  // Get all bookings for this staff member (any status)
  const { data: bookings, error } = await supabaseAdmin
    .from('bookings')
    .select('id, customer_id, start_ts, total_price_cents, services(name), customers(full_name, phone, email)')
    .eq('staff_id', staffId)
    .order('start_ts', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Aggregate per customer
  const customerMap = new Map<string, {
    id: string; full_name: string; phone: string; email: string | null;
    visits: number; lastVisit: string; lastService: string;
    totalRevenueCents: number; totalTipsCents: number;
  }>();

  for (const b of bookings || []) {
    const raw = b.customers as { full_name: string; phone: string; email: string | null } | { full_name: string; phone: string; email: string | null }[] | null;
    const c = Array.isArray(raw) ? raw[0] ?? null : raw;
    if (!c) continue;
    const existing = customerMap.get(b.customer_id);
    if (!existing) {
      customerMap.set(b.customer_id, {
        id: b.customer_id,
        full_name: c.full_name,
        phone: c.phone,
        email: c.email,
        visits: 1,
        lastVisit: b.start_ts,
        lastService: (Array.isArray(b.services) ? (b.services as { name: string }[])[0]?.name : (b.services as { name: string } | null)?.name) ?? '',
        totalRevenueCents: b.total_price_cents || 0,
        totalTipsCents: 0,
      });
    } else {
      existing.visits += 1;
      existing.totalRevenueCents += b.total_price_cents || 0;
    }
  }

  // Get tips per booking, aggregate to customers
  const bookingIds = (bookings || []).map((b) => b.id);
  if (bookingIds.length > 0) {
    const { data: tips } = await supabaseAdmin
      .from('tips')
      .select('booking_id, amount_cents')
      .in('booking_id', bookingIds)
      .eq('status', 'paid');

    const bookingToCustomer = new Map((bookings || []).map((b) => [b.id, b.customer_id]));
    for (const tip of tips || []) {
      const cid = bookingToCustomer.get(tip.booking_id);
      if (cid && customerMap.has(cid)) {
        customerMap.get(cid)!.totalTipsCents += tip.amount_cents;
      }
    }
  }

  const customers = Array.from(customerMap.values()).map((c) => ({
    ...c,
    totalAttributedCents: c.totalRevenueCents + c.totalTipsCents,
  }));

  return NextResponse.json({ customers });
}
