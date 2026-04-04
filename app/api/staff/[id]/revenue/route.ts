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

async function getBusinessTimezone(businessId: string): Promise<string> {
  const { data } = await supabaseAdmin.from('businesses').select('timezone').eq('id', businessId).single();
  return (data as { timezone?: string } | null)?.timezone || 'America/New_York';
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
      'and(status.eq.custom,payment_status.eq.custom_paid),' +
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

  let customPaymentsQuery = supabaseAdmin
    .from('alternative_payment_ledger')
    .select('id, appointment_ts, service_amount_cents, tip_cents, service_name, customer_name, booking_id')
    .eq('marked_paid_by', staffId);
  if (startDate) customPaymentsQuery = customPaymentsQuery.gte('appointment_ts', startDate.toISOString());

  const [tipsResult, ledgerTipsResult, { data: customPayments }] = await Promise.all([
    bookingIds.length > 0
      ? supabaseAdmin.from('tips').select('booking_id, amount_cents').in('booking_id', bookingIds).eq('status', 'paid')
      : Promise.resolve({ data: [] as { booking_id: string; amount_cents: number }[] }),
    bookingIds.length > 0
      ? supabaseAdmin.from('alternative_payment_ledger').select('booking_id, tip_cents').in('booking_id', bookingIds).gt('tip_cents', 0)
      : Promise.resolve({ data: [] as { booking_id: string | null; tip_cents: number }[] }),
    customPaymentsQuery.limit(500),
  ]);

  for (const t of (tipsResult.data || [])) {
    tipsMap.set(t.booking_id, (tipsMap.get(t.booking_id) || 0) + t.amount_cents);
  }
  for (const t of (ledgerTipsResult.data || [])) {
    if (t.booking_id) {
      tipsMap.set(t.booking_id, (tipsMap.get(t.booking_id) || 0) + t.tip_cents);
    }
  }

  // Build a map of booking_id -> ledger entry for custom-paid bookings so we use the actual charged amount
  const customLedgerByBookingId = new Map<string, { service_amount_cents: number; tip_cents: number }>();
  for (const p of (customPayments || [])) {
    if (p.booking_id) customLedgerByBookingId.set(p.booking_id, p);
  }

  const bookingTransactions = (bookings || []).map((b) => {
    const isForfeited = (b.status === 'cancelled' || b.status === 'no_show') && b.payment_status === 'deposit_paid';
    const isCustomPaid = b.status === 'custom' && b.payment_status === 'custom_paid';
    const ledgerEntry = isCustomPaid ? customLedgerByBookingId.get(b.id) : undefined;
    const serviceAmountCents = isForfeited
      ? (b.deposit_amount_cents || 0)
      : isCustomPaid
        ? (ledgerEntry?.service_amount_cents ?? b.total_price_cents ?? 0)
        : (b.total_price_cents || 0);
    const tipAmountCents = isForfeited ? 0 : isCustomPaid ? (ledgerEntry?.tip_cents ?? 0) : (tipsMap.get(b.id) || 0);
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

  // Only include ledger entries NOT linked to a booking (standalone custom payments)
  // Booking-linked entries are already counted via bookingTransactions
  const customTransactions = (customPayments || []).filter((p) => !p.booking_id).map((p) => ({
    id: p.id,
    date: p.appointment_ts,
    customerName: p.customer_name ?? '—',
    serviceName: p.service_name ?? 'Custom Payment',
    serviceAmountCents: p.service_amount_cents,
    tipAmountCents: p.tip_cents ?? 0,
    totalCents: p.service_amount_cents + (p.tip_cents ?? 0),
  }));

  const transactions = [...bookingTransactions, ...customTransactions];

  const serviceRevenueCents = transactions.reduce((s, t) => s + t.serviceAmountCents, 0);
  const tipsCents = transactions.reduce((s, t) => s + t.tipAmountCents, 0);
  const timezone = await getBusinessTimezone(staff.business_id);

  return NextResponse.json({
    serviceRevenueCents,
    tipsCents,
    totalRevenueCents: serviceRevenueCents + tipsCents,
    transactions,
    timezone,
  });
}
