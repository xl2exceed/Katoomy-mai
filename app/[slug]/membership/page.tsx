"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatPhone, digitsOnlyPhone } from "@/lib/utils/formatPhone";
import Link from "next/link";

const PHONE_STORAGE_KEY = "katoomy:customerPhone";

interface Plan {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  discount_percent: number;
  is_active: boolean;
}

interface Subscription {
  id: string;
  stripe_subscription_id: string;
  status: string;
  current_period_end: string;
  membership_plans: {
    name: string;
    price_cents: number;
    discount_percent: number;
  };
}

export default function MembershipPage() {
  const params = useParams();
  const slug = params.slug as string;
  const supabase = createClient();

  const [businessId, setBusinessId] = useState("");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [customerId, setCustomerId] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);

  // Phone auth
  const [showPhonePrompt, setShowPhonePrompt] = useState(false);
  const [phoneInput, setPhoneInput] = useState("");
  const [phoneError, setPhoneError] = useState<"not_found" | null>(null);
  const [phoneLooking, setPhoneLooking] = useState(false);

  useEffect(() => {
    initPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const initPage = async () => {
    const { data: biz } = await supabase
      .from("businesses")
      .select("id")
      .eq("slug", slug)
      .single();

    if (!biz) { setLoading(false); return; }
    setBusinessId(biz.id);

    const { data: planData } = await supabase
      .from("membership_plans")
      .select("id, name, description, price_cents, discount_percent, is_active")
      .eq("business_id", biz.id)
      .eq("is_active", true)
      .single();

    setPlan(planData || null);

    const savedPhone = localStorage.getItem(PHONE_STORAGE_KEY);
    if (!savedPhone) {
      setLoading(false);
      setShowPhonePrompt(true);
      return;
    }

    await loadCustomer(biz.id, savedPhone);
    setLoading(false);
  };

  const loadCustomer = async (bizId: string, phone: string) => {
    const { data: customer } = await supabase
      .from("customers")
      .select("id, email")
      .eq("business_id", bizId)
      .eq("phone", phone)
      .single();

    if (!customer) return;
    setCustomerId(customer.id);
    setCustomerEmail(customer.email || "");

    const { data: sub } = await supabase
      .from("member_subscriptions")
      .select("id, stripe_subscription_id, status, current_period_end, membership_plans(name, price_cents, discount_percent)")
      .eq("customer_id", customer.id)
      .eq("business_id", bizId)
      .eq("status", "active")
      .maybeSingle();

    setSubscription((sub as unknown as Subscription) || null);
  };

  const handlePhoneSubmit = async () => {
    const digits = digitsOnlyPhone(phoneInput);
    if (digits.length < 10) return;

    setPhoneLooking(true);
    setPhoneError(null);

    const { data: customer } = await supabase
      .from("customers")
      .select("id, email")
      .eq("business_id", businessId)
      .eq("phone", digits)
      .single();

    if (!customer) {
      setPhoneError("not_found");
      setPhoneLooking(false);
      return;
    }

    localStorage.setItem(PHONE_STORAGE_KEY, digits);
    setCustomerId(customer.id);
    setCustomerEmail(customer.email || "");
    setShowPhonePrompt(false);
    setPhoneLooking(false);

    // Load subscription
    const { data: sub } = await supabase
      .from("member_subscriptions")
      .select("id, stripe_subscription_id, status, current_period_end, membership_plans(name, price_cents, discount_percent)")
      .eq("customer_id", customer.id)
      .eq("business_id", businessId)
      .eq("status", "active")
      .maybeSingle();

    setSubscription((sub as unknown as Subscription) || null);
  };

  const handleJoin = async () => {
    if (!plan || !customerId || !businessId) return;
    setJoining(true);

    const res = await fetch("/api/memberships/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        planId: plan.id,
        businessId,
        customerId,
        slug,
        customerEmail: customerEmail || undefined,
      }),
    });

    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      alert(data.error || "Something went wrong. Please try again.");
      setJoining(false);
    }
  };

  const handleCancel = async () => {
    if (!subscription || !customerId) return;
    setCancelling(true);

    const res = await fetch("/api/memberships/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subscriptionId: subscription.stripe_subscription_id,
        customerId,
      }),
    });

    const data = await res.json();
    setCancelling(false);
    setCancelConfirm(false);

    if (data.success) {
      setSubscription(null);
    } else {
      alert(data.error || "Failed to cancel. Please try again.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-sm mx-auto">
        <Link href={`/${slug}/dashboard`} className="text-blue-600 font-medium mb-4 block">
          ← Back
        </Link>

        <h1 className="text-2xl font-bold text-gray-900 mb-6">Elite Membership</h1>

        {/* Phone Prompt */}
        {showPhonePrompt && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Enter your phone number</h2>
            <p className="text-sm text-gray-600 mb-4">We&apos;ll look up your account</p>
            <input
              type="tel"
              value={formatPhone(phoneInput)}
              onChange={(e) => setPhoneInput(digitsOnlyPhone(e.target.value))}
              onKeyDown={(e) => e.key === "Enter" && handlePhoneSubmit()}
              placeholder="(555) 123-4567"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-lg mb-3 focus:outline-none focus:border-blue-500"
              inputMode="tel"
              autoFocus
            />
            {phoneError === "not_found" && (
              <p className="text-red-600 text-sm mb-3">Phone number not found. Book an appointment first.</p>
            )}
            <button
              onClick={handlePhoneSubmit}
              disabled={phoneLooking || digitsOnlyPhone(phoneInput).length < 10}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold disabled:opacity-50"
            >
              {phoneLooking ? "Looking up..." : "Continue"}
            </button>
          </div>
        )}

        {/* Active Member View */}
        {!showPhonePrompt && subscription && (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 text-white text-center">
              <div className="text-4xl mb-2">⭐</div>
              <h2 className="text-2xl font-bold">Active Member</h2>
              <p className="text-blue-100 mt-1">{subscription.membership_plans.name}</p>
              <div className="mt-4 bg-white/10 rounded-xl p-3">
                <p className="text-3xl font-bold">{subscription.membership_plans.discount_percent}% OFF</p>
                <p className="text-sm text-blue-100 mt-1">on all services</p>
              </div>
              <p className="text-sm text-blue-200 mt-4">
                Renews {new Date(subscription.current_period_end).toLocaleDateString("en-US", {
                  month: "long", day: "numeric", year: "numeric",
                })}
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-4 text-center">
              <p className="text-sm text-gray-600 mb-3">
                Your member discount is automatically applied every time you book.
              </p>
              <Link
                href={`/${slug}/book`}
                className="block w-full py-3 bg-blue-600 text-white rounded-xl font-semibold"
              >
                Book an Appointment
              </Link>
            </div>

            {!cancelConfirm ? (
              <button
                onClick={() => setCancelConfirm(true)}
                className="w-full py-3 text-gray-500 text-sm underline"
              >
                Cancel Membership
              </button>
            ) : (
              <div className="bg-white rounded-2xl border-2 border-red-200 p-5">
                <p className="font-semibold text-gray-900 mb-1">Cancel your membership?</p>
                <p className="text-sm text-gray-600 mb-4">
                  Your membership will end immediately and you&apos;ll lose your member discount.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setCancelConfirm(false)}
                    disabled={cancelling}
                    className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-xl font-semibold text-sm"
                  >
                    Keep It
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={cancelling}
                    className="flex-1 py-2 bg-red-600 text-white rounded-xl font-semibold text-sm disabled:opacity-50"
                  >
                    {cancelling ? "Cancelling..." : "Yes, Cancel"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Non-member — show plan */}
        {!showPhonePrompt && !subscription && plan && (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 text-white">
              <div className="text-4xl mb-3 text-center">⭐</div>
              <h2 className="text-2xl font-bold text-center">{plan.name}</h2>
              {plan.description && (
                <p className="text-blue-100 text-sm text-center mt-2">{plan.description}</p>
              )}

              <div className="mt-5 bg-white/10 rounded-xl p-4 text-center">
                <p className="text-4xl font-bold">${(plan.price_cents / 100).toFixed(2)}</p>
                <p className="text-blue-200 text-sm">per month</p>
              </div>

              <div className="mt-4 bg-white/10 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold">{plan.discount_percent}% OFF</p>
                <p className="text-sm text-blue-100">every service, every visit</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-4">
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-center gap-2"><span className="text-green-500 font-bold">✓</span> {plan.discount_percent}% off all services</li>
                <li className="flex items-center gap-2"><span className="text-green-500 font-bold">✓</span> Cancel anytime</li>
                <li className="flex items-center gap-2"><span className="text-green-500 font-bold">✓</span> Billed monthly via Stripe</li>
              </ul>
            </div>

            {customerId ? (
              <button
                onClick={handleJoin}
                disabled={joining}
                className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold text-lg shadow-lg disabled:opacity-50 active:scale-95 transition"
              >
                {joining ? "Redirecting to payment..." : `Join for $${(plan.price_cents / 100).toFixed(2)}/mo`}
              </button>
            ) : null}
          </div>
        )}

        {/* No plan configured */}
        {!showPhonePrompt && !plan && (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
            <p className="text-gray-500">Membership coming soon!</p>
          </div>
        )}
      </div>
    </div>
  );
}
