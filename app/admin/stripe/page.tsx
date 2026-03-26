// file: app/admin/stripe/page.tsx

"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

interface StripeAccount {
  stripe_account_id: string;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  status: string;
}

interface DepositSettings {
  enabled: boolean;
  type: "flat" | "percent";
  amount_cents: number | null;
  percent: number | null;
}

const DEFAULT_DEPOSIT_SETTINGS: DepositSettings = {
  enabled: false,
  type: "flat",
  amount_cents: null,
  percent: null,
};

export default function StripePage() {
  const [stripeAccount, setStripeAccount] = useState<StripeAccount | null>(
    null,
  );
  const [depositSettings, setDepositSettings] = useState<DepositSettings>(
    DEFAULT_DEPOSIT_SETTINGS,
  );
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [savingDeposit, setSavingDeposit] = useState(false);
  const [businessId, setBusinessId] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    // Check if returning from Stripe
    const urlParams = new URLSearchParams(window.location.search);

    // Your /connect/return route now redirects back with ?sync=ok
    if (urlParams.get("sync") === "ok" || urlParams.get("stripe_connected")) {
      // Stripe just connected, reload after a short delay
      setTimeout(() => {
        loadPaymentSettings();
      }, 2000);
    } else {
      loadPaymentSettings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadPaymentSettings = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Use maybeSingle() so the page doesn't break if there is no business yet
      const { data: business } = await supabase
        .from("businesses")
        .select("id")
        .eq("owner_user_id", user.id)
        .maybeSingle();

      if (business) {
        setBusinessId(business.id);

        // Load Stripe account (maybeSingle avoids 406 if the row doesn't exist yet)
        const { data: stripe } = await supabase
          .from("stripe_connect_accounts")
          .select("*")
          .eq("business_id", business.id)
          .maybeSingle();

        if (stripe) {
          setStripeAccount(stripe as StripeAccount);
        } else {
          setStripeAccount(null);
        }

        // Load deposit settings (maybeSingle avoids 406 if the row doesn't exist yet)
        const { data: deposits } = await supabase
          .from("deposit_settings")
          .select("*")
          .eq("business_id", business.id)
          .maybeSingle();

        if (deposits) {
          setDepositSettings(deposits as DepositSettings);
        } else {
          // No row yet -> keep safe defaults
          setDepositSettings(DEFAULT_DEPOSIT_SETTINGS);
        }
      } else {
        // No business found for this user yet
        setBusinessId(null);
        setStripeAccount(null);
        setDepositSettings(DEFAULT_DEPOSIT_SETTINGS);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConnectStripe = async () => {
    if (!businessId) return;

    setConnecting(true);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/stripe-connect-start`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            business_id: businessId,
            refresh_url: `${window.location.origin}/connect/refresh?businessId=${businessId}`,
            return_url: `${window.location.origin}/connect/return?businessId=${businessId}`,
          }),
        },
      );

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error("Stripe connect start response missing url:", data);
        alert("Stripe setup failed (missing URL). Please try again.");
      }
    } catch (error) {
      console.error("Error connecting Stripe:", error);
      alert("Failed to connect Stripe. Please try again.");
    } finally {
      setConnecting(false);
    }
  };

  const handleSaveDepositSettings = async () => {
    if (!businessId) return;
    setSavingDeposit(true);

    try {
      const { error } = await supabase.from("deposit_settings").upsert(
        {
          business_id: businessId,
          enabled: depositSettings.enabled,
          type: depositSettings.type,
          amount_cents:
            depositSettings.type === "flat"
              ? depositSettings.amount_cents
              : null,
          percent:
            depositSettings.type === "percent" ? depositSettings.percent : null,
        },
        { onConflict: "business_id" },
      );

      if (error) {
        console.error("Error saving deposit settings:", error);
        alert("Failed to save deposit settings.");
        return;
      }

      alert("Deposit settings saved!");
      await loadPaymentSettings();
    } catch (e) {
      console.error("Error saving deposit settings:", e);
      alert("Failed to save deposit settings.");
    } finally {
      setSavingDeposit(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-4xl">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Payments</h1>
            <p className="text-gray-600 mt-1">
              Manage your payment settings and deposits
            </p>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-4 text-gray-600">Loading payment settings...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Stripe Connection Card */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900">
                        Stripe Connection
                      </h2>
                      <p className="text-gray-600 mt-1">
                        Connect your Stripe account to accept payments
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {stripeAccount ? (
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-3 h-3 rounded-full ${
                              stripeAccount.status === "active"
                                ? "bg-green-500"
                                : stripeAccount.status === "restricted"
                                  ? "bg-yellow-500"
                                  : "bg-red-500"
                            }`}
                          ></div>
                          <span className="text-sm font-medium text-gray-700 capitalize">
                            {stripeAccount.status}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-gray-400"></div>
                          <span className="text-sm font-medium text-gray-700">
                            Not Connected
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-6">
                    {stripeAccount ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="bg-gray-50 rounded-lg p-4">
                            <p className="text-sm text-gray-600">
                              Charges Enabled
                            </p>
                            <p
                              className={`text-lg font-semibold ${
                                stripeAccount.charges_enabled
                                  ? "text-green-600"
                                  : "text-red-600"
                              }`}
                            >
                              {stripeAccount.charges_enabled ? "Yes" : "No"}
                            </p>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-4">
                            <p className="text-sm text-gray-600">
                              Payouts Enabled
                            </p>
                            <p
                              className={`text-lg font-semibold ${
                                stripeAccount.payouts_enabled
                                  ? "text-green-600"
                                  : "text-red-600"
                              }`}
                            >
                              {stripeAccount.payouts_enabled ? "Yes" : "No"}
                            </p>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-4">
                            <p className="text-sm text-gray-600">
                              Details Submitted
                            </p>
                            <p
                              className={`text-lg font-semibold ${
                                stripeAccount.details_submitted
                                  ? "text-green-600"
                                  : "text-yellow-600"
                              }`}
                            >
                              {stripeAccount.details_submitted
                                ? "Yes"
                                : "Pending"}
                            </p>
                          </div>
                        </div>

                        {stripeAccount.status !== "active" && (
                          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                            <p className="text-sm text-yellow-800">
                              Your Stripe account needs additional setup to
                              become fully active.
                            </p>
                            <button
                              onClick={handleConnectStripe}
                              disabled={connecting}
                              className="mt-3 bg-yellow-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {connecting
                                ? "Connecting..."
                                : "Complete Stripe Setup"}
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <div className="mb-4">
                          <svg
                            className="mx-auto h-12 w-12 text-gray-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                          Connect Stripe to Accept Payments
                        </h3>
                        <p className="text-gray-600 mb-6 max-w-md mx-auto">
                          Accept payments in your app by connecting with Stripe
                        </p>
                        <button
                          onClick={handleConnectStripe}
                          disabled={connecting}
                          className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {connecting ? "Connecting..." : "Connect Stripe"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Deposit Settings Card */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900">
                        Deposit Settings
                      </h2>
                      <p className="text-gray-600 mt-1">
                        Require deposits for appointments
                      </p>
                    </div>
                    <div className="flex items-center">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={depositSettings.enabled}
                          onChange={(e) =>
                            setDepositSettings((prev) => ({
                              ...prev,
                              enabled: e.target.checked,
                            }))
                          }
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                  </div>

                  {depositSettings.enabled && (
                    <div className="mt-6 space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Deposit Type
                        </label>
                        <div className="flex gap-4">
                          <label className="flex items-center">
                            <input
                              type="radio"
                              name="depositType"
                              value="flat"
                              checked={depositSettings.type === "flat"}
                              onChange={() =>
                                setDepositSettings((prev) => ({
                                  ...prev,
                                  type: "flat",
                                }))
                              }
                              className="mr-2"
                            />
                            Flat Amount
                          </label>
                          <label className="flex items-center">
                            <input
                              type="radio"
                              name="depositType"
                              value="percent"
                              checked={depositSettings.type === "percent"}
                              onChange={() =>
                                setDepositSettings((prev) => ({
                                  ...prev,
                                  type: "percent",
                                }))
                              }
                              className="mr-2"
                            />
                            Percentage
                          </label>
                        </div>
                      </div>

                      {depositSettings.type === "flat" ? (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Deposit Amount ($)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={
                              depositSettings.amount_cents
                                ? depositSettings.amount_cents / 100
                                : ""
                            }
                            onChange={(e) =>
                              setDepositSettings((prev) => ({
                                ...prev,
                                amount_cents: e.target.value
                                  ? Math.round(parseFloat(e.target.value) * 100)
                                  : null,
                              }))
                            }
                            className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="0.00"
                          />
                        </div>
                      ) : (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Deposit Percentage (%)
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="1"
                            value={depositSettings.percent ?? ""}
                            onChange={(e) =>
                              setDepositSettings((prev) => ({
                                ...prev,
                                percent: e.target.value
                                  ? parseInt(e.target.value, 10)
                                  : null,
                              }))
                            }
                            className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="0"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {!depositSettings.enabled && (
                    <div className="mt-4 text-gray-500 text-sm">
                      Deposits are currently disabled. Enable above to require
                      customers to pay a deposit when booking.
                    </div>
                  )}

                  <div className="mt-6 pt-4 border-t border-gray-200">
                    <button
                      onClick={handleSaveDepositSettings}
                      disabled={savingDeposit}
                      className="bg-green-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {savingDeposit ? "Saving..." : "Save Deposit Settings"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
