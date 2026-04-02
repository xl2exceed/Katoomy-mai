// GET /api/staff/[id]/revenue?period=today|week|month|all
// Returns revenue summary + transaction list for a staff member.
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
  const period = searchParams.get('period') ?? 'week';

  const now = new Date();
  let startDate: Date | null = null;
  if (period === 'today') {
    startDate = new Date(now); startDate.setHours(0, 0, 0, 0);
  } else if (period === 'week') {
    startDate = new Date(now); startDate.setDate(now.getDate() - 7);
  } else if (period === 'month') {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  let query = supabaseAdmin
    .from('bookings')
    .select('id, start_ts, total_price_cents, deposit_amount_cents, payment_status, status, customers(full_name), services(name)')
    .eq('staff_id', staffId)
    .or(
      'and(status.eq.completed,payment_status.in.(paid,cash_paid)),' +
      'and(status.in.(cancelled,no_show),payment_status.eq.deposit_paid)'
    )
    .order('start_ts', { ascending: false });

  if (startDate) {
    query = query.gte('start_ts', startDate.toISOString());
  }

  const { data: bookings, error } = await query.limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const bookingIds = (bookings || []).map((b) => b.id);
  let tipsMap = new Map<string, number>();

  if (bookingIds.length > 0) {
    const [{ data: tips }, { data: ledgerTips }] = await Promise.all([
      supabaseAdmin
        .from('tips')
        .select('booking_id, amount_cents')
        .in('booking_id', bookingIds)
        .eq('status', 'paid'),
      supabaseAdmin
        .from('alternative_payment_ledger')
        .select('booking_id, tip_cents')
        .in('booking_id', bookingIds)
        .gt('tip_cents', 0),
    ]);
    for (const t of tips || []) {
      tipsMap.set(t.booking_id, (tipsMap.get(t.booking_id) || 0) + t.amount_cents);
    }
    for (const t of ledgerTips || []) {
      if (t.booking_id) {
        tipsMap.set(t.booking_id, (tipsMap.get(t.booking_id) || 0) + t.tip_cents);
      }
    }
  }

  const transactions = (bookings || []).map((b) => {
    const isForfeited = (b.status === 'cancelled' || b.status === 'no_show') && b.payment_status === 'deposit_paid';
    const serviceAmountCents = isForfeited ? (b.deposit_amount_cents || 0) : (b.total_price_cents || 0);
    const tipAmountCents = isForfeited ? 0 : (tipsMap.get(b.id) || 0);
    return {
      id: b.id,
      date: b.start_ts,
      customerName: (Array.isArray(b.customers) ? (b.customers as { full_name: string }[])[0]?.full_name : (b.customers as { full_name: string } | null)?.full_name) ?? 'Unknown',
      serviceName: (Array.isArray(b.services) ? (b.services as { name: string }[])[0]?.name : (b.services as { name: string } | null)?.name) ?? '',
      serviceAmountCents,
      tipAmountCents,
      totalCents: serviceAmountCents + tipAmountCents,
    };
  });

  const serviceRevenueCents = transactions.reduce((s, t) => s + t.serviceAmountCents, 0);
  const tipsCents = transactions.reduce((s, t) => s + t.tipAmountCents, 0);

  return NextResponse.json({
    serviceRevenueCents,
    tipsCents,
    totalRevenueCents: serviceRevenueCents + tipsCents,
    transactions,
  });
}
