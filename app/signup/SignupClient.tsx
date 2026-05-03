// app/signup/SignupClient.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { formatPhone, digitsOnlyPhone } from "@/lib/utils/formatPhone";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

type PlanType = "free" | "premium" | "pro";

// ── Card setup inner form (must live inside <Elements>) ───────────────────────
function CardSetupForm({
  email,
  showBypass,
  onBypass,
}: {
  email: string;
  showBypass: boolean;
  onBypass: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);
    setError(null);

    const { error: confirmError } = await stripe.confirmSetup({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/signup/verify-email?email=${encodeURIComponent(email)}`,
      },
      redirect: "if_required",
    });

    if (confirmError) {
      setError(confirmError.message || "Card setup failed. Please try again.");
      setLoading(false);
      return;
    }

    router.push(`/signup/verify-email?email=${encodeURIComponent(email)}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="p-1">
        <PaymentElement options={{ layout: "tabs" }} />
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || !elements || loading}
        className="w-full py-4 bg-[#8B5CF6] text-white rounded-lg font-bold text-lg hover:bg-[#7C3AED] transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Saving Card..." : "Activate Account"}
      </button>

      {/* Secret bypass — only visible after 7 taps on the Katoomy logo */}
      {showBypass && (
        <button
          type="button"
          onClick={onBypass}
          className="w-full text-center text-xs text-gray-300 hover:text-gray-400 py-1 transition"
        >
          skip card verification
        </button>
      )}
    </form>
  );
}

// ── Main signup component ─────────────────────────────────────────────────────
export default function SignupClient({
  initialPlan,
}: {
  initialPlan: PlanType;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState<"info" | "card">("info");
  const [selectedPlan, setSelectedPlan] = useState<PlanType>(initialPlan);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  // Secret bypass: tap "Katoomy" logo 7 times to reveal skip button
  const [logoTaps, setLogoTaps] = useState(0);
  const [showBypass, setShowBypass] = useState(false);

  const [niche, setNiche] = useState("barber");

  const [formData, setFormData] = useState({
    businessName: "",
    ownerName: "",
    email: "",
    password: "",
    phone: "",
  });

  const plans = {
    free: {
      name: "Free",
      price: { monthly: 0, annual: 0 },
      priceId: { monthly: null as string | null, annual: null as string | null },
    },
    premium: {
      name: "Premium",
      price: { monthly: 29, annual: 290 },
      priceId: {
        monthly: process.env.NEXT_PUBLIC_STRIPE_PREMIUM_MONTHLY_PRICE_ID!,
        annual: process.env.NEXT_PUBLIC_STRIPE_PREMIUM_ANNUAL_PRICE_ID!,
      },
    },
    pro: {
      name: "Pro",
      price: { monthly: 79, annual: 790 },
      priceId: {
        monthly: process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID!,
        annual: process.env.NEXT_PUBLIC_STRIPE_PRO_ANNUAL_PRICE_ID!,
      },
    },
  };

  function handleLogoTap() {
    const next = logoTaps + 1;
    setLogoTaps(next);
    if (next >= 7) setShowBypass(true);
  }

  function handleBypass() {
    router.push(`/signup/verify-email?email=${encodeURIComponent(formData.email)}`);
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!formData.businessName || !formData.ownerName || !formData.email || !formData.password) {
        throw new Error("Please fill in all required fields");
      }
      if (formData.password.length < 6) {
        throw new Error("Password must be at least 6 characters");
      }

      // Step 1a: Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: { data: { full_name: formData.ownerName } },
      });
      if (authError) {
        const msg = authError.message?.toLowerCase() ?? "";
        if (msg.includes("already registered") || msg.includes("already in use") || msg.includes("email address is already")) {
          throw new Error("Email address is already in use. Sign up with a different email address.");
        }
        throw authError;
      }
      if (!authData.user) throw new Error("Failed to create account");
      // Supabase silently returns a fake user with no identities for duplicate emails
      if ((authData.user.identities?.length ?? 0) === 0) {
        throw new Error("Email address is already in use. Sign up with a different email address.");
      }

      // Step 1b: Create business record
      const bizRes = await fetch("/api/auth/create-business", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: authData.user.id,
          businessName: formData.businessName,
          ownerName: formData.ownerName,
          email: formData.email,
          phone: formData.phone || null,
          niche,
        }),
      });
      const business = await bizRes.json();
      if (!bizRes.ok) throw new Error(business.error || "Failed to create business");

      // Paid plans → Stripe subscription checkout (handles card collection)
      if (selectedPlan !== "free") {
        const priceId = plans[selectedPlan].priceId[billingCycle];
        if (!priceId) throw new Error("Invalid plan selected");
        const response = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ priceId, businessId: business.businessId, email: formData.email }),
        });
        const { url, error: checkoutError } = await response.json();
        if (checkoutError) throw new Error(checkoutError);
        if (url) window.location.href = url;
        return;
      }

      // Free plan → create setup intent for card-on-file
      const siRes = await fetch("/api/auth/create-setup-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: business.businessId,
          email: formData.email,
          ownerName: formData.ownerName,
        }),
      });
      const { clientSecret: cs, error: siError } = await siRes.json();
      if (siError) throw new Error(siError);

      setClientSecret(cs);
      setStep("card");
      setLoading(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred during signup");
      setLoading(false);
    }
  }

  // ── Step 2: Card collection ─────────────────────────────────────────────────
  if (step === "card" && clientSecret) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-purple-100 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-8">
            {/* Secret bypass trigger: tap this 7 times */}
            <span
              onClick={handleLogoTap}
              className="text-3xl font-bold text-[#8B5CF6] cursor-default select-none"
            >
              Katoomy
            </span>
            <h2 className="mt-4 text-2xl font-bold text-gray-900">Add Your Payment Method</h2>
            <p className="mt-2 text-sm text-gray-600">
              Required to activate your account. No charge today.
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8">
            {/* $0 auth notice */}
            <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-xl mb-6">
              <span className="text-green-500 text-lg mt-0.5">✓</span>
              <div>
                <p className="text-sm font-semibold text-green-800">$0.00 authorization — no charge today</p>
                <p className="text-xs text-green-700 mt-0.5">
                  Your card is saved for automatic weekly transaction fee billing only.
                  A $1 platform fee is added to each completed customer transaction.
                </p>
              </div>
            </div>

            <Elements
              stripe={stripePromise}
              options={{
                clientSecret,
                appearance: {
                  theme: "stripe",
                  variables: { colorPrimary: "#8B5CF6" },
                },
              }}
            >
              <CardSetupForm
                email={formData.email}
                showBypass={showBypass}
                onBypass={handleBypass}
              />
            </Elements>
          </div>
        </div>
      </div>
    );
  }

  // ── Step 1: Business info form ──────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-purple-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <Link href="/" className="text-3xl font-bold text-[#8B5CF6]">
            Katoomy
          </Link>
          <h2 className="mt-6 text-3xl font-bold text-gray-900">Create Your Account</h2>
          <p className="mt-2 text-gray-600">
            {selectedPlan === "free"
              ? "Free to start — payment method required to activate"
              : "Start your 14-day free trial"}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="grid md:grid-cols-2">
            {/* Left: Plan Selection */}
            <div className="p-8 bg-gray-50 border-r border-gray-200">
              <h3 className="text-xl font-bold text-gray-900 mb-6">Choose Your Plan</h3>

              <div className="flex items-center justify-center bg-white rounded-lg p-1 border-2 border-gray-200 mb-6">
                <button
                  type="button"
                  onClick={() => setBillingCycle("monthly")}
                  className={`px-4 py-2 rounded-md font-semibold text-sm transition ${
                    billingCycle === "monthly" ? "bg-[#8B5CF6] text-white" : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setBillingCycle("annual")}
                  className={`px-4 py-2 rounded-md font-semibold text-sm transition ${
                    billingCycle === "annual" ? "bg-[#8B5CF6] text-white" : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Annual <span className="text-green-600 text-xs ml-1">(Save 17%)</span>
                </button>
              </div>

              <div className="space-y-3">
                {(["free", "premium", "pro"] as PlanType[]).map((plan) => (
                  <button
                    key={plan}
                    type="button"
                    onClick={() => setSelectedPlan(plan)}
                    className={`w-full text-left p-4 rounded-lg border-2 transition ${
                      selectedPlan === plan
                        ? "border-[#8B5CF6] bg-purple-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-gray-900">
                          {plan.charAt(0).toUpperCase() + plan.slice(1)}
                        </div>
                        <div className="text-sm text-gray-600">
                          {plan === "free" && "Perfect for getting started"}
                          {plan === "premium" && "For growing businesses"}
                          {plan === "pro" && "For established businesses"}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-gray-900">
                          {plan === "free" ? "$0" : `$${plans[plan].price[billingCycle]}`}
                        </div>
                        {plan !== "free" && (
                          <div className="text-xs text-gray-500">
                            /{billingCycle === "monthly" ? "mo" : "yr"}
                          </div>
                        )}
                      </div>
                    </div>
                    {plan !== "free" && (
                      <div className="mt-2 text-xs text-[#8B5CF6] font-semibold">⭐ 14-day free trial</div>
                    )}
                  </button>
                ))}
              </div>

              <div className="mt-6 p-4 bg-white rounded-lg border border-gray-200">
                <div className="text-sm font-semibold text-gray-900 mb-2">
                  {selectedPlan === "free" && "Free Plan Includes:"}
                  {selectedPlan === "premium" && "Premium Includes:"}
                  {selectedPlan === "pro" && "Pro Includes:"}
                </div>
                <ul className="space-y-1 text-sm text-gray-600">
                  <li>✓ Unlimited bookings</li>
                  <li>✓ Customer management</li>
                  <li>✓ QR code booking</li>
                  {(selectedPlan === "premium" || selectedPlan === "pro") && (
                    <>
                      <li>✓ Staff management</li>
                      <li>✓ Automated messaging</li>
                      <li>✓ Advanced analytics</li>
                    </>
                  )}
                  {selectedPlan === "pro" && (
                    <>
                      <li>✓ Multiple locations</li>
                      <li>✓ API access</li>
                      <li>✓ White-label branding</li>
                    </>
                  )}
                </ul>
              </div>

              {selectedPlan === "free" && (
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-xs text-amber-800">
                    <span className="font-semibold">How billing works:</span> A $1 platform fee is
                    automatically added to each customer transaction. Your card on file is charged
                    weekly for completed transactions only.
                  </p>
                </div>
              )}
            </div>

            {/* Right: Signup Form */}
            <div className="p-8">
              <h3 className="text-xl font-bold text-gray-900 mb-6">Your Details</h3>

              <form onSubmit={handleSignup} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Business Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.businessName}
                    onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B5CF6] text-gray-900"
                    placeholder="Your Salon Name"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Your Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.ownerName}
                    onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B5CF6] text-gray-900"
                    placeholder="John Doe"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B5CF6] text-gray-900"
                    placeholder="you@example.com"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B5CF6] text-gray-900"
                    placeholder="Minimum 6 characters"
                    required
                    minLength={6}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Phone (Optional)
                  </label>
                  <input
                    type="tel"
                    value={formatPhone(formData.phone)}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: digitsOnlyPhone(e.target.value) })
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B5CF6] text-gray-900"
                    placeholder="(555) 123-4567"
                    inputMode="numeric"
                    autoComplete="tel"
                  />
                </div>

                {/* Business Type */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Business Type <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: "barber", label: "Barber Shop", icon: "✂️", active: true },
                      { value: "salon", label: "Salon", icon: "💇", active: true },
                      { value: "carwash", label: "Car Wash", icon: "🚗", active: true },
                      { value: "nail_salon", label: "Nail Salon", icon: "💅", active: false },
                      { value: "personal_trainer", label: "Personal Trainer", icon: "💪", active: false },
                      { value: "massage_therapist", label: "Massage", icon: "🧘", active: false },
                      { value: "lawn_care", label: "Lawn Care", icon: "🌿", active: false },
                      { value: "tattoo_artist", label: "Tattoo", icon: "🎨", active: false },
                      { value: "esthetician", label: "Esthetician", icon: "✨", active: false },
                    ].map(({ value, label, icon, active }) => (
                      <button
                        key={value}
                        type="button"
                        disabled={!active}
                        onClick={() => active && setNiche(value)}
                        className={`relative p-2.5 rounded-lg border-2 text-center transition ${
                          niche === value
                            ? "border-[#8B5CF6] bg-purple-50"
                            : active
                            ? "border-gray-200 hover:border-gray-300"
                            : "border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed"
                        }`}
                      >
                        <div className="text-xl mb-0.5">{icon}</div>
                        <div className="text-xs font-semibold text-gray-800 leading-tight">{label}</div>
                        {!active && (
                          <span className="absolute top-1 right-1 text-[9px] font-bold text-gray-400 leading-none">Soon</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {error && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-[#8B5CF6] text-white rounded-lg font-bold text-lg hover:bg-[#7C3AED] transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Creating Account..." : "Continue"}
                </button>

                <p className="text-xs text-gray-500 text-center">
                  By signing up, you agree to our{" "}
                  <Link href="/terms" className="text-[#8B5CF6] hover:underline">Terms of Service</Link>{" "}
                  and{" "}
                  <Link href="/privacy" className="text-[#8B5CF6] hover:underline">Privacy Policy</Link>
                </p>

                <p className="text-sm text-gray-600 text-center">
                  Already have an account?{" "}
                  <Link href="/admin/login" className="text-[#8B5CF6] font-semibold hover:underline">
                    Sign In
                  </Link>
                </p>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
