// POST /api/network/send-referral
// Sends a direct customer referral from one partner business to another via SMS.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: business } = await supabaseAdmin
    .from("businesses")
    .select("id, name, slug")
    .eq("owner_user_id", user.id)
    .single();
  if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  const { customerId, partnerBusinessId, message } = await req.json();
  if (!customerId || !partnerBusinessId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Verify the target is an active partner
  const { data: partnership } = await supabaseAdmin
    .from("network_partners")
    .select("id")
    .eq("status", "active")
    .or(
      `and(business_a_id.eq.${business.id},business_b_id.eq.${partnerBusinessId}),` +
      `and(business_a_id.eq.${partnerBusinessId},business_b_id.eq.${business.id})`
    )
    .maybeSingle();

  if (!partnership) {
    return NextResponse.json({ error: "Not an active partner" }, { status: 403 });
  }

  // Get customer details from this business's customer list
  const { data: customer } = await supabaseAdmin
    .from("customers")
    .select("id, full_name, phone")
    .eq("id", customerId)
    .eq("business_id", business.id)
    .single();
  if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  // Get partner business details
  const { data: partnerBiz } = await supabaseAdmin
    .from("businesses")
    .select("id, name, slug")
    .eq("id", partnerBusinessId)
    .single();
  if (!partnerBiz) return NextResponse.json({ error: "Partner business not found" }, { status: 404 });

  // Create the referral record
  const { data: referral, error: refError } = await supabaseAdmin
    .from("network_direct_referrals")
    .insert({
      sending_business_id: business.id,
      receiving_business_id: partnerBusinessId,
      customer_phone: customer.phone,
      customer_name: customer.full_name,
      message: message || null,
      status: "sent",
      sent_by_user_id: user.id,
    })
    .select("id")
    .single();

  if (refError || !referral) {
    console.error("Failed to create referral:", refError);
    return NextResponse.json({ error: "Failed to create referral" }, { status: 500 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://katoomy.com";

  // Include the receiving business's active offer in the link so the customer
  // sees the discount banner and Business A gets referral credit.
  const now = new Date().toISOString();
  const { data: partnerOffers } = await supabaseAdmin
    .from("network_offers")
    .select("id, budget_cents, total_cost_cents")
    .eq("business_id", partnerBusinessId)
    .eq("active", true)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order("created_at", { ascending: false })
    .limit(5);

  const availableOffer = (partnerOffers ?? []).find(
    (o) => !o.budget_cents || o.total_cost_cents < o.budget_cents
  );

  let referralUrl = `${appUrl}/${partnerBiz.slug}?biz_ref=${referral.id}`;
  if (availableOffer) {
    referralUrl += `&net_ref=${availableOffer.id}&via=${business.id}`;
  }

  const customMsg = message?.trim()
    ? `${message.trim()} Book here: ${referralUrl}`
    : `${business.name} thought you'd love ${partnerBiz.name}! Book your first appointment here: ${referralUrl}`;

  const smsBody = `Hey ${customer.full_name?.split(" ")[0] || "there"}! ${customMsg}`;

  // Send SMS via the internal SMS route
  try {
    const digits = customer.phone.replace(/\D/g, "");
    const normalizedPhone = digits.startsWith("1") ? `+${digits}` : `+1${digits}`;

    const smsRes = await fetch(`${appUrl}/api/sms/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: normalizedPhone,
        body: smsBody,
        business_id: business.id,
        customer_id: customer.id,
      }),
    });

    if (!smsRes.ok) {
      const smsData = await smsRes.json().catch(() => ({}));
      console.error("SMS send failed:", smsData);
    }
  } catch (smsErr) {
    console.error("SMS send error (non-fatal):", smsErr);
  }

  return NextResponse.json({ referralId: referral.id });
}
