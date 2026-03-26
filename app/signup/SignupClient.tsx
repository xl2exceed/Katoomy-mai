// app/signup/SignupClient.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { formatPhone, digitsOnlyPhone } from "@/lib/utils/formatPhone";

type PlanType = "free" | "premium" | "pro";

export default function SignupClient({
  initialPlan,
}: {
  initialPlan: PlanType;
}) {
  const router = useRouter();

  const [selectedPlan, setSelectedPlan] = useState<PlanType>(initialPlan);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">(
    "monthly",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    businessName: "",
    ownerName: "",
    email: "",
    password: "",
    phone: "",
  });

  const supabase = createClient();

  const plans = {
    free: {
      name: "Free",
      price: { monthly: 0, annual: 0 },
      priceId: {
        monthly: null as string | null,
        annual: null as string | null,
      },
    },
    premium: {
      name: "Premium",
      price: { monthly: 29, annual: 290 },
      priceId: {
        monthly: "price_1SvgSt2ZLPWWwYJoW6kOuHYc",
        annual: "price_1SyPO62ZLPWWwYJodrDkNnW2",
      },
    },
    pro: {
      name: "Pro",
      price: { monthly: 79, annual: 790 },
      priceId: {
        monthly: "price_1SvgTS2ZLPWWwYJo9xKnC3j4",
        annual: "price_1SyPNC2ZLPWWwYJoRbCE94iK",
      },
    },
  };

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (
        !formData.businessName ||
        !formData.ownerName ||
        !formData.email ||
        !formData.password
      ) {
        throw new Error("Please fill in all required fields");
      }

      if (formData.password.length < 6) {
        throw new Error("Password must be at least 6 characters");
      }

      // Create user account
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.ownerName,
          },
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Failed to create account");

      // Create business via server-side API (bypasses RLS for new unconfirmed users)
      const bizRes = await fetch("/api/auth/create-business", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: authData.user.id,
          businessName: formData.businessName,
          ownerName: formData.ownerName,
          email: formData.email,
          phone: formData.phone || null,
        }),
      });
      const business = await bizRes.json();
      if (!bizRes.ok) throw new Error(business.error || "Failed to create business");

      // After signup, always go to the verify-email page first
      if (selectedPlan === "free") {
        router.push(`/signup/verify-email?email=${encodeURIComponent(formData.email)}`);
        return;
      }

      // Paid plan -> Stripe checkout
      const priceId = plans[selectedPlan].priceId[billingCycle];
      if (!priceId) throw new Error("Invalid plan selected");

      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priceId,
          businessId: business.id,
          email: formData.email,
        }),
      });

      const { url, error: checkoutError } = await response.json();

      if (checkoutError) throw new Error(checkoutError);
      if (url) window.location.href = url;
    } catch (err: unknown) {
      console.error("Signup error:", err);
      setError(
        err instanceof Error ? err.message : "An error occurred during signup",
      );
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-purple-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="text-3xl font-bold text-[#8B5CF6]">
            Katoomy
          </Link>
          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            Start Your Free Trial
          </h2>
          <p className="mt-2 text-gray-600">
            No credit card required for free plan
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="grid md:grid-cols-2">
            {/* Left: Plan Selection */}
            <div className="p-8 bg-gray-50 border-r border-gray-200">
              <h3 className="text-xl font-bold text-gray-900 mb-6">
                Choose Your Plan
              </h3>

              {/* Billing Toggle */}
              <div className="flex items-center justify-center bg-white rounded-lg p-1 border-2 border-gray-200 mb-6">
                <button
                  type="button"
                  onClick={() => setBillingCycle("monthly")}
                  className={`px-4 py-2 rounded-md font-semibold text-sm transition ${
                    billingCycle === "monthly"
                      ? "bg-[#8B5CF6] text-white"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setBillingCycle("annual")}
                  className={`px-4 py-2 rounded-md font-semibold text-sm transition ${
                    billingCycle === "annual"
                      ? "bg-[#8B5CF6] text-white"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Annual{" "}
                  <span className="text-green-600 text-xs ml-1">
                    (Save 17%)
                  </span>
                </button>
              </div>

              {/* Plan Options */}
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setSelectedPlan("free")}
                  className={`w-full text-left p-4 rounded-lg border-2 transition ${
                    selectedPlan === "free"
                      ? "border-[#8B5CF6] bg-purple-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-gray-900">Free</div>
                      <div className="text-sm text-gray-600">
                        Perfect for getting started
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">$0</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedPlan("premium")}
                  className={`w-full text-left p-4 rounded-lg border-2 transition ${
                    selectedPlan === "premium"
                      ? "border-[#8B5CF6] bg-purple-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-gray-900">Premium</div>
                      <div className="text-sm text-gray-600">
                        For growing businesses
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-gray-900">
                        ${plans.premium.price[billingCycle]}
                      </div>
                      <div className="text-xs text-gray-500">
                        /{billingCycle === "monthly" ? "mo" : "yr"}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-[#8B5CF6] font-semibold">
                    ⭐ 14-day free trial
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedPlan("pro")}
                  className={`w-full text-left p-4 rounded-lg border-2 transition ${
                    selectedPlan === "pro"
                      ? "border-[#8B5CF6] bg-purple-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-gray-900">Pro</div>
                      <div className="text-sm text-gray-600">
                        For established businesses
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-gray-900">
                        ${plans.pro.price[billingCycle]}
                      </div>
                      <div className="text-xs text-gray-500">
                        /{billingCycle === "monthly" ? "mo" : "yr"}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-[#8B5CF6] font-semibold">
                    ⭐ 14-day free trial
                  </div>
                </button>
              </div>

              {/* Plan Features */}
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
            </div>

            {/* Right: Signup Form */}
            <div className="p-8">
              <h3 className="text-xl font-bold text-gray-900 mb-6">
                Create Your Account
              </h3>

              <form onSubmit={handleSignup} className="space-y-4">
                {/* Business Name */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Business Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.businessName}
                    onChange={(e) =>
                      setFormData({ ...formData, businessName: e.target.value })
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B5CF6] text-gray-900"
                    placeholder="Your Salon Name"
                    required
                  />
                </div>

                {/* Owner Name */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Your Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.ownerName}
                    onChange={(e) =>
                      setFormData({ ...formData, ownerName: e.target.value })
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B5CF6] text-gray-900"
                    placeholder="John Doe"
                    required
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B5CF6] text-gray-900"
                    placeholder="you@example.com"
                    required
                  />
                </div>

                {/* Password */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B5CF6] text-gray-900"
                    placeholder="Minimum 6 characters"
                    required
                    minLength={6}
                  />
                </div>

                {/* Phone (Optional) */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Phone (Optional)
                  </label>
                  <input
                    type="tel"
                    value={formatPhone(formData.phone)}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        phone: digitsOnlyPhone(e.target.value),
                      })
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B5CF6] text-gray-900"
                    placeholder="(555) 123-4567"
                    inputMode="numeric"
                    autoComplete="tel"
                  />
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
                  {loading
                    ? "Creating Account..."
                    : selectedPlan === "free"
                      ? "Get Started Free"
                      : "Continue to Payment"}
                </button>

                <p className="text-xs text-gray-500 text-center">
                  By signing up, you agree to our{" "}
                  <Link
                    href="/terms"
                    className="text-[#8B5CF6] hover:underline"
                  >
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link
                    href="/privacy"
                    className="text-[#8B5CF6] hover:underline"
                  >
                    Privacy Policy
                  </Link>
                </p>

                <p className="text-sm text-gray-600 text-center">
                  Already have an account?{" "}
                  <Link
                    href="/admin/login"
                    className="text-[#8B5CF6] font-semibold hover:underline"
                  >
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
