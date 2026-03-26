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
      // reload after a short delay
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
          amount_cents: depositSettings.amount_cents,
          percent: depositSettings.percent,
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

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse text-gray-600">
          Loading Stripe settings…
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Stripe</h1>

      {/* Payment Processing */}
      <div className="bg-white rounded-xl shadow p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Payment Processing</h2>
            <div className="mt-2 text-sm text-gray-600">Account Status</div>
            <div className="mt-1 font-semibold">
              {stripeAccount ? (
                <>
                  {stripeAccount.status === "active" ? (
                    <span className="text-green-600">Active</span>
                  ) : stripeAccount.status === "restricted" ? (
                    <span className="text-yellow-600">Restricted</span>
                  ) : (
                    <span className="text-orange-600">Pending Setup</span>
                  )}
                </>
              ) : (
                <span className="text-orange-600">Not connected</span>
              )}
            </div>
          </div>

          <div className="text-right">
            <div className="text-sm text-gray-600">Account ID</div>
            <div className="font-mono text-sm">
              {stripeAccount?.stripe_account_id ?? "—"}
            </div>
          </div>
        </div>

        {stripeAccount ? (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-lg border">
              <div className="text-xs text-gray-500">Charges</div>
              <div className="font-semibold">
                {stripeAccount.charges_enabled ? "Enabled" : "Disabled"}
              </div>
            </div>
            <div className="p-3 rounded-lg border">
              <div className="text-xs text-gray-500">Payouts</div>
              <div className="font-semibold">
                {stripeAccount.payouts_enabled ? "Enabled" : "Disabled"}
              </div>
            </div>
            <div className="p-3 rounded-lg border">
              <div className="text-xs text-gray-500">Details</div>
              <div className="font-semibold">
                {stripeAccount.details_submitted ? "Complete" : "Incomplete"}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="text-6xl mb-4">💳</div>
            <div className="text-gray-700 font-semibold mb-2">
              Connect Stripe to accept payments
            </div>
            <div className="text-gray-500 text-sm mb-6">
              Your customers will pay you directly through your Stripe account.
            </div>
          </div>
        )}

        <div className="mt-6">
          {/* Show setup button unless fully active */}
          {(!stripeAccount || stripeAccount.status !== "active") && (
            <button
              onClick={handleConnectStripe}
              disabled={connecting}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {connecting ? "Connecting..." : "Complete Stripe Setup"}
            </button>
          )}
        </div>
      </div>

      {/* Deposit Settings */}
      <div className="bg-white rounded-xl shadow p-6 space-y-4">
        <h2 className="text-lg font-semibold">Deposit Settings</h2>

        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold">Enable deposits</div>
            <div className="text-sm text-gray-500">
              Require a deposit when customers book.
            </div>
          </div>

          <input
            type="checkbox"
            checked={depositSettings.enabled}
            onChange={(e) =>
              setDepositSettings((prev) => ({
                ...prev,
                enabled: e.target.checked,
              }))
            }
            className="h-5 w-5"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-gray-600">Type</label>
            <select
              value={depositSettings.type}
              onChange={(e) =>
                setDepositSettings((prev) => ({
                  ...prev,
                  type: e.target.value as "flat" | "percent",
                }))
              }
              className="mt-1 w-full border rounded-lg p-2"
            >
              <option value="flat">Flat</option>
              <option value="percent">Percent</option>
            </select>
          </div>

          {depositSettings.type === "flat" ? (
            <div>
              <label className="text-sm text-gray-600">Amount (cents)</label>
              <input
                type="number"
                value={depositSettings.amount_cents ?? ""}
                onChange={(e) =>
                  setDepositSettings((prev) => ({
                    ...prev,
                    amount_cents: e.target.value
                      ? Number(e.target.value)
                      : null,
                    percent: null,
                  }))
                }
                className="mt-1 w-full border rounded-lg p-2"
                placeholder="e.g. 1500"
              />
            </div>
          ) : (
            <div>
              <label className="text-sm text-gray-600">Percent</label>
              <input
                type="number"
                value={depositSettings.percent ?? ""}
                onChange={(e) =>
                  setDepositSettings((prev) => ({
                    ...prev,
                    percent: e.target.value ? Number(e.target.value) : null,
                    amount_cents: null,
                  }))
                }
                className="mt-1 w-full border rounded-lg p-2"
                placeholder="e.g. 25"
              />
            </div>
          )}
        </div>

        <button
          onClick={handleSaveDepositSettings}
          disabled={savingDeposit}
          className="px-5 py-2 bg-gray-900 text-white rounded-lg font-semibold hover:bg-black disabled:opacity-50 transition"
        >
          {savingDeposit ? "Saving..." : "Save Deposit Settings"}
        </button>
      </div>
    </div>
  );
}
