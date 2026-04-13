import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getSmsTemplate, fillSmsTemplate } from '@/lib/smsTemplates';

const VALID_STATUSES = ['requested', 'confirmed', 'completed', 'cancelled', 'no_show', 'incomplete', 'custom'];

// POST /api/staff/update-booking
// Staff portals cannot rely on cookie-based RLS, so updates go through supabaseAdmin.
// Caller must supply a valid Bearer token that belongs to the staff member.
export async function POST(req: NextRequest) {
  // Verify caller identity via JWT
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { bookingId, staffId, status, payment_status } = await req.json();

  if (!bookingId || !staffId) {
    return NextResponse.json({ error: 'Missing bookingId or staffId' }, { status: 400 });
  }
  if (status && !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  // Confirm the JWT user is actually this staff member
  const { data: staffRow } = await supabaseAdmin
    .from('staff')
    .select('id')
    .eq('id', staffId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!staffRow) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Confirm this booking is assigned to the staff member
  const { data: booking } = await supabaseAdmin
    .from('bookings')
    .select('id, staff_id, business_id, customer_id, total_price_cents, customers(full_name, phone), services(name)')
    .eq('id', bookingId)
    .eq('staff_id', staffId)
    .maybeSingle();

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found or not assigned to you' }, { status: 404 });
  }

  const updates: Record<string, string> = {};
  if (status) updates.status = status;
  if (payment_status) updates.payment_status = payment_status;

  const { data: updatedBooking, error } = await supabaseAdmin
    .from('bookings')
    .update(updates)
    .eq('id', bookingId)
    .select('start_ts, services(name)')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Send cancellation SMS to customer when staff cancels
  if (status === 'cancelled') {
    try {
      const [{ data: customer }, { data: biz }] = await Promise.all([
        supabaseAdmin.from('customers').select('phone, full_name').eq('id', booking.customer_id).single(),
        supabaseAdmin.from('businesses').select('name').eq('id', booking.business_id).single(),
      ]);
      if (customer?.phone) {
        const apptTime = updatedBooking?.start_ts
          ? new Date(updatedBooking.start_ts).toLocaleString('en-US', {
              weekday: 'short', month: 'short', day: 'numeric',
              hour: 'numeric', minute: '2-digit',
            })
          : 'your upcoming appointment';
        const servicesArr = updatedBooking?.services as unknown as { name: string }[] | null;
        const serviceName = Array.isArray(servicesArr) ? servicesArr[0]?.name : undefined;
        const bizName = biz?.name || 'us';
        const tmpl = await getSmsTemplate(booking.business_id, 'cancel_staff');
        const smsBody = fillSmsTemplate(tmpl, {
          customer_name: customer.full_name || 'there',
          service_name: serviceName || 'appointment',
          appt_time: apptTime,
          business_name: bizName,
        });
        const appUrl = process.env.NEXT_PUBLIC_APP_URL;
        if (appUrl) {
          await fetch(`${appUrl}/api/sms/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to: customer.phone, body: smsBody, business_id: booking.business_id, customer_id: booking.customer_id }),
          });
        }
      }
    } catch (smsErr) {
      console.error('Cancellation SMS error (non-fatal):', smsErr);
    }
  }

  // Note: alternative_payment_ledger is written by the DB trigger
  // (trg_auto_record_alternative_payment) when payment_status changes to 'paid'.
  // No explicit insert needed here.

  // Award loyalty points when staff marks a booking as paid
  if (payment_status === 'paid') {
    const { data: loyalty, error: loyaltyErr } = await supabaseAdmin
      .from('loyalty_settings')
      .select('enabled, earn_on_completion, points_per_event, referral_enabled, referrer_reward_points')
      .eq('business_id', booking.business_id)
      .single();

    console.log('[loyalty/update-booking] bookingId:', bookingId, 'customerId:', booking.customer_id, 'businessId:', booking.business_id);
    console.log('[loyalty/update-booking] settings:', loyalty, 'error:', loyaltyErr);

    if (loyalty?.enabled && loyalty.earn_on_completion) {
      const { data: existingPts } = await supabaseAdmin
        .from('loyalty_ledger').select('id')
        .eq('related_booking_id', bookingId).eq('event_type', 'completion').maybeSingle();
      if (!existingPts) {
        const { error: insertErr } = await supabaseAdmin.from('loyalty_ledger').insert({
          business_id: booking.business_id, customer_id: booking.customer_id,
          event_type: 'completion', points_delta: loyalty.points_per_event,
          related_booking_id: bookingId,
        });
        console.log('[loyalty/update-booking] completion insert error:', insertErr);
      }
    }

    if (loyalty?.referral_enabled !== false) {
      const { data: referral } = await supabaseAdmin
        .from('referrals').select('id, referrer_customer_id')
        .eq('business_id', booking.business_id).eq('referred_customer_id', booking.customer_id)
        .eq('status', 'pending').maybeSingle();
      if (referral) {
        const referrerPoints = loyalty?.referrer_reward_points ?? 15;
        const { data: existingRef } = await supabaseAdmin
          .from('loyalty_ledger').select('id')
          .eq('related_booking_id', bookingId).eq('event_type', 'referral')
          .eq('customer_id', referral.referrer_customer_id).maybeSingle();
        if (!existingRef) {
          const { error: refInsertErr } = await supabaseAdmin.from('loyalty_ledger').insert({
            business_id: booking.business_id, customer_id: referral.referrer_customer_id,
            points_delta: referrerPoints, event_type: 'referral', related_booking_id: bookingId,
          });
          console.log('[loyalty/update-booking] referral insert error:', refInsertErr);
        }
        await supabaseAdmin.from('referrals').update({
          status: 'completed', reward_points_awarded: referrerPoints,
          first_completed_booking_id: bookingId, completed_at: new Date().toISOString(),
        }).eq('id', referral.id);
      }
    }
  }

  return NextResponse.json({ success: true });
}
