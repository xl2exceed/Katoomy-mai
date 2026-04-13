import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

// POST /api/admin/mark-booking-paid
// Marks a booking as paid (cash), logs to alternative_payment_ledger, awards loyalty points.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { bookingId } = await req.json();
  if (!bookingId) return NextResponse.json({ error: 'Missing bookingId' }, { status: 400 });

  // Verify caller owns this business
  const { data: business } = await supabaseAdmin
    .from('businesses')
    .select('id')
    .eq('owner_user_id', user.id)
    .single();
  if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 });

  // Fetch booking with customer + service details
  const { data: booking } = await supabaseAdmin
    .from('bookings')
    .select('id, business_id, customer_id, total_price_cents, payment_status, customers(full_name, phone), services(name)')
    .eq('id', bookingId)
    .eq('business_id', business.id)
    .maybeSingle();

  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  if (['paid', 'cash_paid', 'refunded'].includes(booking.payment_status)) {
    return NextResponse.json({ error: 'Booking is already paid' }, { status: 400 });
  }

  // Mark booking as paid
  await supabaseAdmin.from('bookings').update({ payment_status: 'paid' }).eq('id', bookingId);

  // Note: alternative_payment_ledger is written by the DB trigger
  // (trg_auto_record_alternative_payment) when payment_status changes to 'paid'.
  // No explicit insert needed here.

  const now = new Date();

  // Award loyalty points
  const { data: loyalty } = await supabaseAdmin
    .from('loyalty_settings')
    .select('enabled, earn_on_completion, points_per_event, referral_enabled, referrer_reward_points')
    .eq('business_id', booking.business_id)
    .single();

  if (loyalty?.enabled && loyalty.earn_on_completion) {
    const { data: existing } = await supabaseAdmin
      .from('loyalty_ledger').select('id')
      .eq('related_booking_id', bookingId).eq('event_type', 'completion').maybeSingle();
    if (!existing) {
      await supabaseAdmin.from('loyalty_ledger').insert({
        business_id: booking.business_id,
        customer_id: booking.customer_id,
        event_type: 'completion',
        points_delta: loyalty.points_per_event,
        related_booking_id: bookingId,
      });
    }
  }

  if (loyalty?.referral_enabled !== false) {
    const { data: referral } = await supabaseAdmin
      .from('referrals').select('id, referrer_customer_id')
      .eq('business_id', booking.business_id)
      .eq('referred_customer_id', booking.customer_id)
      .eq('status', 'pending').maybeSingle();
    if (referral) {
      const referrerPoints = loyalty?.referrer_reward_points ?? 15;
      const { data: existingRef } = await supabaseAdmin
        .from('loyalty_ledger').select('id')
        .eq('related_booking_id', bookingId).eq('event_type', 'referral')
        .eq('customer_id', referral.referrer_customer_id).maybeSingle();
      if (!existingRef) {
        await supabaseAdmin.from('loyalty_ledger').insert({
          business_id: booking.business_id,
          customer_id: referral.referrer_customer_id,
          points_delta: referrerPoints,
          event_type: 'referral',
          related_booking_id: bookingId,
        });
      }
      await supabaseAdmin.from('referrals').update({
        status: 'completed',
        reward_points_awarded: referrerPoints,
        first_completed_booking_id: bookingId,
        completed_at: now.toISOString(),
      }).eq('id', referral.id);
    }
  }

  return NextResponse.json({ success: true });
}
