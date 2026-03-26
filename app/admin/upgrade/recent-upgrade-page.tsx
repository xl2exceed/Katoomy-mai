"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function UpgradePage() {
  const router = useRouter();
  const supabase = createClient();

  const [selectedPlan, setSelectedPlan] = useState<"premium" | "pro">(
    "premium",
  );
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">(
    "monthly",
  );
  const [loading, setLoading] = useState(false);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [currentPlan, setCurrentPlan] = useState<string>("free");
  const [error, setError] = useState<string | null>(null);

  const plans = {
    free: {
      name: "Free",
      price: { monthly: 0, annual: 0 },
      description: "Perfect for getting started",
      features: [
        "Unlimited bookings",
        "Customer management",
        "QR code booking link",
        "Basic loyalty program",
        "Referral tracking",
        "Mobile app access",
      ],
    },
    premium: {
      name: "Premium",
      price: { monthly: 29, annual: 290 },
      description: "For growing businesses",
      priceId: {
        monthly: "price_1SvgSt2ZLPWWwYJoW6kOuHYc",
        annual: "price_1SyPO62ZLPWWwYJodrDkNnW2",
      },
      features: [
        "Everything in Free, plus:",
        "✨ Staff management",
        "✨ Individual staff schedules",
        "✨ Automated SMS reminders",
        "✨ Email campaigns",
        "✨ Advanced analytics",
        "✨ Custom branding",
        "✨ Priority support",
      ],
    },
    pro: {
      name: "Pro",
      price: { monthly: 79, annual: 790 },
      description: "For established businesses",
      priceId: {
        monthly: "price_1SvgTS2ZLPWWwYJo9xKnC3j4",
        annual: "price_1SyPNC2ZLPWWwYJoRbCE94iK",
      },
      features: [
        "Everything in Premium, plus:",
        "⚡ Multiple locations",
        "⚡ Advanced inventory",
        "⚡ API access",
        "⚡ White-label branding",
        "⚡ Dedicated account manager",
        "⚡ Custom integrations",
      ],
    },
  };

  useEffect(() => {
    loadUserData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadUserData() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/admin/login");
      return;
    }

    setEmail(user.email);

    const { data: business } = await supabase
      .from("businesses")
      .select("id, subscription_plan")
      .eq("owner_user_id", user.id)
      .maybeSingle();

    if (business) {
      setBusinessId(business.id);
      setCurrentPlan(business.subscription_plan || "free");
    }
  }

  async function handleUpgrade() {
    console.log("handleUpgrade fired", {
      selectedPlan,
      billingCycle,
      currentPlan,
      businessId,
      email,
    });

    if (!businessId || !email) {
      setError(
        "Unable to process upgrade. Please try logging out and back in.",
      );
      return;
    }

    // Only block if already on the top tier
    if (currentPlan === "pro") {
      setError("You're already on the Pro plan (highest tier).");
      return;
    }

    // If on premium, only allow upgrading to pro
    if (currentPlan === "premium" && selectedPlan !== "pro") {
      setError("You're already on Premium. You can only upgrade to Pro.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const priceId = plans[selectedPlan].priceId[billingCycle];

      if (!priceId) {
        throw new Error("Invalid plan selected");
      }

      console.log("🚀 Starting upgrade:", { priceId, businessId, email });

      // ✅ Existing subscriber = change subscription in place
      const isExistingSubscriber =
        currentPlan === "premium" || currentPlan === "pro";

      if (isExistingSubscriber) {
        const response = await fetch("/api/subscriptions/change", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            businessId,
            newPriceId: priceId,
          }),
        });

        const data = await response.json();
        console.log("📦 Subscription change response:", data);

        if (!response.ok) {
          throw new Error(data?.error || "Failed to change subscription");
        }
        if (data?.error) throw new Error(data.error);

        // ✅ THE FIX: API now returns `newPlan` confirmed from Stripe.
        // Update local state immediately so the UI reflects the new plan
        // without waiting for the webhook to fire asynchronously.
        if (data.newPlan) {
          setCurrentPlan(data.newPlan);
        }

        // Show success and redirect to dashboard so the user sees their new plan
        alert(`🎉 You're now on the ${data.newPlan ?? selectedPlan} plan!`);
        router.push("/admin");
        return;
      }

      // ✅ Free → Paid = create new checkout session
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priceId,
          businessId,
          email,
        }),
      });

      const data = await response.json();
      console.log("📦 Checkout response:", data);

      if (!response.ok) {
        throw new Error(data?.error || "Failed to start checkout");
      }
      if (data?.error) throw new Error(data.error);

      if (data?.url) {
        console.log("✅ Redirecting to Stripe:", data.url);
        window.location.href = data.url;
        return;
      }

      throw new Error("Stripe checkout did not return a URL");
    } catch (err: unknown) {
      console.error("❌ Upgrade error:", err);
      setError(
        err instanceof Error ? err.message : "Failed to start checkout process",
      );
    } finally {
      setLoading(false); // ✅ ALWAYS stops the spinner
    }
  }

  const isPlanCurrent = (plan: string) => currentPlan === plan;

  const canSelectPlan = (plan: string) => {
    if (plan === "free") return false;

    // Top tier can't upgrade further
    if (currentPlan === "pro") return false;

    // Premium can upgrade to Pro only
    if (currentPlan === "premium") return plan === "pro";

    // Free can choose Premium or Pro
    return currentPlan === "free";
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <Link
            href="/admin"
            className="inline-flex items-center text-purple-600 hover:text-purple-700 font-medium mb-4"
          >
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Dashboard
          </Link>

          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Choose Your{" "}
            <span className="bg-gradient-to-r from-purple-600 to-purple-900 bg-clip-text text-transparent">
              Perfect Plan
            </span>
          </h1>
          <p className="text-xl text-gray-600 mb-2">
            Upgrade to unlock powerful features for your business
          </p>

          {currentPlan && (
            <div className="inline-flex items-center px-4 py-2 bg-purple-100 text-purple-800 rounded-full font-semibold text-sm">
              Current Plan:{" "}
              {currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)}
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-8 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg max-w-2xl mx-auto">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-red-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Billing Toggle */}
        <div className="flex justify-center mb-12">
          <div className="inline-flex items-center bg-white rounded-lg p-1 shadow-md">
            <button
              onClick={() => setBillingCycle("monthly")}
              className={`px-6 py-2 rounded-lg font-medium transition ${
                billingCycle === "monthly"
                  ? "bg-purple-600 text-white"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle("annual")}
              className={`px-6 py-2 rounded-lg font-medium transition relative ${
                billingCycle === "annual"
                  ? "bg-purple-600 text-white"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Annual
              <span className="absolute -top-2 -right-2 px-2 py-0.5 bg-orange-500 text-white text-xs rounded-full font-bold">
                Save 17%
              </span>
            </button>
          </div>
        </div>

        {/* Plans Grid */}
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {/* Free Plan */}
          <div className="relative rounded-2xl p-8 bg-white border-2 border-gray-200 shadow-lg opacity-75">
            <div className="mb-6">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Free</h3>
              <p className="text-sm text-gray-600">{plans.free.description}</p>
            </div>

            <div className="mb-6">
              <span className="text-5xl font-bold text-gray-900">$0</span>
              <span className="text-gray-600">/forever</span>
            </div>

            <ul className="space-y-3">
              {plans.free.features.map((feature, i) => (
                <li key={i} className="flex items-start">
                  <svg
                    className="w-5 h-5 mr-2 text-gray-400 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-sm text-gray-700">{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Premium Plan */}
          <div
            onClick={() =>
              canSelectPlan("premium") && setSelectedPlan("premium")
            }
            className={`relative rounded-2xl p-8 transition ${
              isPlanCurrent("premium")
                ? "bg-white border-4 border-purple-600 shadow-lg cursor-default"
                : selectedPlan === "premium" && canSelectPlan("premium")
                  ? "bg-gradient-to-br from-purple-600 to-purple-800 text-white shadow-2xl scale-105 border-4 border-orange-400 cursor-pointer"
                  : canSelectPlan("premium")
                    ? "bg-white border-2 border-gray-200 shadow-lg hover:border-purple-300 cursor-pointer"
                    : "bg-white border-2 border-gray-200 shadow-lg opacity-75 cursor-not-allowed"
            }`}
          >
            {isPlanCurrent("premium") && (
              <div className="absolute -top-5 left-1/2 -translate-x-1/2 px-4 py-1 bg-purple-600 text-white text-sm font-bold rounded-full shadow-lg">
                CURRENT PLAN
              </div>
            )}
            {selectedPlan === "premium" && canSelectPlan("premium") && (
              <div className="absolute -top-5 left-1/2 -translate-x-1/2 px-4 py-1 bg-orange-500 text-white text-sm font-bold rounded-full shadow-lg">
                SELECTED ✓
              </div>
            )}

            <div className="mb-6">
              <h3
                className={`text-2xl font-bold mb-2 ${selectedPlan === "premium" && canSelectPlan("premium") ? "text-white" : "text-gray-900"}`}
              >
                Premium
              </h3>
              <p
                className={`text-sm ${selectedPlan === "premium" && canSelectPlan("premium") ? "text-purple-100" : "text-gray-600"}`}
              >
                {plans.premium.description}
              </p>
            </div>

            <div className="mb-6">
              <span
                className={`text-5xl font-bold ${selectedPlan === "premium" && canSelectPlan("premium") ? "text-white" : "text-gray-900"}`}
              >
                ${plans.premium.price[billingCycle]}
              </span>
              <span
                className={
                  selectedPlan === "premium" && canSelectPlan("premium")
                    ? "text-purple-100"
                    : "text-gray-600"
                }
              >
                /{billingCycle === "monthly" ? "mo" : "yr"}
              </span>
              {billingCycle === "annual" && (
                <p
                  className={`text-sm mt-1 ${selectedPlan === "premium" && canSelectPlan("premium") ? "text-purple-100" : "text-gray-500"}`}
                >
                  ${(plans.premium.price.annual / 12).toFixed(2)}/month
                </p>
              )}
            </div>

            <ul className="space-y-3">
              {plans.premium.features.map((feature, i) => (
                <li key={i} className="flex items-start">
                  <svg
                    className={`w-5 h-5 mr-2 flex-shrink-0 ${
                      selectedPlan === "premium" && canSelectPlan("premium")
                        ? "text-orange-400"
                        : "text-purple-600"
                    }`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span
                    className={`text-sm ${selectedPlan === "premium" && canSelectPlan("premium") ? "text-white" : "text-gray-700"}`}
                  >
                    {feature}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Pro Plan */}
          <div
            onClick={() => canSelectPlan("pro") && setSelectedPlan("pro")}
            className={`relative rounded-2xl p-8 transition ${
              isPlanCurrent("pro")
                ? "bg-white border-4 border-purple-600 shadow-lg cursor-default"
                : selectedPlan === "pro" && canSelectPlan("pro")
                  ? "bg-gradient-to-br from-purple-600 to-purple-800 text-white shadow-2xl scale-105 border-4 border-orange-400 cursor-pointer"
                  : canSelectPlan("pro")
                    ? "bg-white border-2 border-gray-200 shadow-lg hover:border-purple-300 cursor-pointer"
                    : "bg-white border-2 border-gray-200 shadow-lg opacity-75 cursor-not-allowed"
            }`}
          >
            {isPlanCurrent("pro") && (
              <div className="absolute -top-5 left-1/2 -translate-x-1/2 px-4 py-1 bg-purple-600 text-white text-sm font-bold rounded-full shadow-lg">
                CURRENT PLAN
              </div>
            )}
            {selectedPlan === "pro" && canSelectPlan("pro") && (
              <div className="absolute -top-5 left-1/2 -translate-x-1/2 px-4 py-1 bg-orange-500 text-white text-sm font-bold rounded-full shadow-lg">
                SELECTED ✓
              </div>
            )}

            <div className="mb-6">
              <h3
                className={`text-2xl font-bold mb-2 ${selectedPlan === "pro" && canSelectPlan("pro") ? "text-white" : "text-gray-900"}`}
              >
                Pro
              </h3>
              <p
                className={`text-sm ${selectedPlan === "pro" && canSelectPlan("pro") ? "text-purple-100" : "text-gray-600"}`}
              >
                {plans.pro.description}
              </p>
            </div>

            <div className="mb-6">
              <span
                className={`text-5xl font-bold ${selectedPlan === "pro" && canSelectPlan("pro") ? "text-white" : "text-gray-900"}`}
              >
                ${plans.pro.price[billingCycle]}
              </span>
              <span
                className={
                  selectedPlan === "pro" && canSelectPlan("pro")
                    ? "text-purple-100"
                    : "text-gray-600"
                }
              >
                /{billingCycle === "monthly" ? "mo" : "yr"}
              </span>
              {billingCycle === "annual" && (
                <p
                  className={`text-sm mt-1 ${selectedPlan === "pro" && canSelectPlan("pro") ? "text-purple-100" : "text-gray-500"}`}
                >
                  ${(plans.pro.price.annual / 12).toFixed(2)}/month
                </p>
              )}
            </div>

            <ul className="space-y-3">
              {plans.pro.features.map((feature, i) => (
                <li key={i} className="flex items-start">
                  <svg
                    className={`w-5 h-5 mr-2 flex-shrink-0 ${
                      selectedPlan === "pro" && canSelectPlan("pro")
                        ? "text-orange-400"
                        : "text-purple-600"
                    }`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span
                    className={`text-sm ${selectedPlan === "pro" && canSelectPlan("pro") ? "text-white" : "text-gray-700"}`}
                  >
                    {feature}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Upgrade Button */}
        {((currentPlan === "free" &&
          (selectedPlan === "premium" || selectedPlan === "pro")) ||
          (currentPlan === "premium" && selectedPlan === "pro")) && (
          <div className="max-w-md mx-auto">
            <button
              onClick={handleUpgrade}
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white rounded-2xl font-bold text-lg shadow-lg transition transform hover:scale-105 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                    />
                  </svg>
                  Processing...
                </span>
              ) : (
                `Upgrade to ${plans[selectedPlan].name}`
              )}
            </button>

            <p className="text-center text-sm text-gray-500 mt-4">
              Secure payment • Cancel anytime • No long-term contract
            </p>
          </div>
        )}

        {/* FAQ Section */}
        <div className="mt-16 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-8">
            Frequently Asked Questions
          </h2>
          <div className="space-y-6 bg-white rounded-xl p-8 shadow-sm">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">
                Can I cancel anytime?
              </h3>
              <p className="text-gray-600">
                Yes! You can cancel your subscription at any time. You&apos;ll
                continue to have access to premium features until the end of
                your billing period.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">
                When will I be charged?
              </h3>
              <p className="text-gray-600">
                Your payment method will be charged immediately upon upgrade.
                You can start using all premium features right away.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">
                Do you offer refunds?
              </h3>
              <p className="text-gray-600">
                We offer a 14-day money-back guarantee for all paid plans.
                Contact support for a full refund within 14 days of your
                purchase.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">
                Can I switch between monthly and annual billing?
              </h3>
              <p className="text-gray-600">
                Yes! You can switch billing cycles at any time. The change will
                take effect at the start of your next billing period.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
