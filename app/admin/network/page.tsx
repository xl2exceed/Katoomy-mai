"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { QRCodeSVG } from "qrcode.react";

// ── Types ──────────────────────────────────────────────────────────────────
interface NetworkSettings {
  enabled: boolean;
  auto_approve_partners: boolean;
  allow_katoomy_suggestions: boolean;
  max_monthly_spend_cents: number;
  referral_reward_cents: number;
  onboarding_complete: boolean;
}

interface NetworkOffer {
  id: string;
  title: string;
  offer_type: "dollar_off" | "percent_off";
  amount: number;
  min_spend_cents: number | null;
  expires_at: string | null;
  active: boolean;
  used_count: number;
  total_cost_cents: number;
  budget_cents: number | null;
  created_at: string;
}

interface Partner {
  id: string;
  status: "pending" | "active" | "rejected" | "removed";
  initiated_by: string;
  created_at: string;
  my_side: "a" | "b";
  partner: { id: string; name: string; slug: string } | null;
}

interface OverviewStats {
  customers_sent: number;
  customers_received: number;
  offer_link_received: number;
  direct_received: number;
  referral_earnings_cents: number;
  total_credits_cents: number;
  completed_received: number;
}

interface ActivityItem {
  id: string;
  direction: "sent" | "received";
  type: "direct" | "offer";
  customer_name: string | null;
  customer_phone: string | null;
  partner_name: string;
  status: string;
  created_at: string;
}

interface BizSearch {
  id: string;
  name: string;
  slug: string;
}

type Tab = "overview" | "offers" | "partners" | "broadcast" | "settings";

// ── Helpers ────────────────────────────────────────────────────────────────
function formatOffer(o: NetworkOffer) {
  return o.offer_type === "dollar_off"
    ? `$${(o.amount / 100).toFixed(0)} Off`
    : `${o.amount}% Off`;
}

function cents(n: number) {
  return `$${(n / 100).toFixed(2)}`;
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function NetworkPage() {
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [businessSlug, setBusinessSlug] = useState<string>("");
  const [phase, setPhase] = useState<"loading" | "join" | "onboarding" | "portal">("loading");
  const [onboardStep, setOnboardStep] = useState(1);
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  // Settings
  const [settings, setSettings] = useState<NetworkSettings>({
    enabled: true,
    auto_approve_partners: true,
    allow_katoomy_suggestions: true,
    max_monthly_spend_cents: 10000,
    referral_reward_cents: 500,
    onboarding_complete: false,
  });

  // Offers
  const [offers, setOffers] = useState<NetworkOffer[]>([]);
  const [showOfferForm, setShowOfferForm] = useState(false);
  const [editOffer, setEditOffer] = useState<NetworkOffer | null>(null);
  const [offerForm, setOfferForm] = useState({
    title: "Get $5 off your first visit",
    offer_type: "dollar_off" as "dollar_off" | "percent_off",
    amount: 500,
    min_spend_cents: "",
    budget_cents: "10000",
    expires_at: "",
  });

  // Partners
  const [partners, setPartners] = useState<Partner[]>([]);
  const [partnerSearch, setPartnerSearch] = useState("");
  const [searchResults, setSearchResults] = useState<BizSearch[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Refer Customer modal
  const [referModalPartner, setReferModalPartner] = useState<{ id: string; name: string; slug: string } | null>(null);
  const [referCustomerSearch, setReferCustomerSearch] = useState("");
  const [referCustomerResults, setReferCustomerResults] = useState<{ id: string; full_name: string; phone: string }[]>([]);
  const [referCustomerSearchLoading, setReferCustomerSearchLoading] = useState(false);
  const [selectedReferCustomer, setSelectedReferCustomer] = useState<{ id: string; full_name: string; phone: string } | null>(null);
  const [referMessage, setReferMessage] = useState("");
  const [referSending, setReferSending] = useState(false);
  const [referSent, setReferSent] = useState(false);
  const [referSentMode, setReferSentMode] = useState<"sms" | "sms-qr">("sms");
  const [referQrUrl, setReferQrUrl] = useState<string | null>(null);

  // Overview
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);

  const [saving, setSaving] = useState(false);
  const [onboardError, setOnboardError] = useState<string | null>(null);

  // Broadcast
  const [broadcastPreview, setBroadcastPreview] = useState<{ partnerCount: number; customerCount: number; partners: { id: string; name: string }[] } | null>(null);
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastSending, setBroadcastSending] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<{ sent: number; failed: number; skipped: number; total: number } | null>(null);
  const [broadcastHistory, setBroadcastHistory] = useState<{ id: string; message: string; total_sent: number; total_failed: number; total_skipped: number; created_at: string }[]>([]);
  const [broadcastHistoryLoaded, setBroadcastHistoryLoaded] = useState(false);

  // ── Load businessId ──────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (!user) return;
      const { data: biz } = await supabase
        .from("businesses").select("id, slug").eq("owner_user_id", user.id).maybeSingle();
      if (biz?.id) {
        setBusinessId(biz.id as string);
        setBusinessSlug(biz.slug as string);
      }
    }
    init();
  }, []);

  // ── Load data once businessId is known ──────────────────────────────────
  const loadAll = useCallback(async (bId: string) => {
    const [settingsRes, offersRes, partnersRes, overviewRes, activityRes] = await Promise.all([
      fetch(`/api/network/settings?businessId=${bId}`).then((r) => r.json()),
      fetch(`/api/network/offers?businessId=${bId}`).then((r) => r.json()),
      fetch(`/api/network/partners?businessId=${bId}`).then((r) => r.json()),
      fetch(`/api/network/overview?businessId=${bId}`).then((r) => r.json()),
      fetch(`/api/network/activity?businessId=${bId}`).then((r) => r.json()),
    ]);

    if (settingsRes.settings) {
      setSettings((prev) => ({ ...prev, ...settingsRes.settings }));
      setPhase(
        settingsRes.settings.onboarding_complete ? "portal" :
        settingsRes.settings.enabled ? "onboarding" : "join"
      );
    } else {
      setPhase("join");
    }

    if (offersRes.offers) setOffers(offersRes.offers);
    if (partnersRes.partners) setPartners(partnersRes.partners);
    if (!overviewRes.error) setOverview(overviewRes);
    if (activityRes.activity) setActivity(activityRes.activity);
  }, []);

  useEffect(() => {
    if (businessId) loadAll(businessId);
  }, [businessId, loadAll]);

  // ── Partner search debounce ──────────────────────────────────────────────
  useEffect(() => {
    if (partnerSearch.length < 2) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      setSearchLoading(true);
      const res = await fetch(`/api/network/search?q=${encodeURIComponent(partnerSearch)}&excludeBusinessId=${businessId}`);
      const data = await res.json();
      setSearchResults(data.businesses ?? []);
      setSearchLoading(false);
    }, 400);
    return () => clearTimeout(t);
  }, [partnerSearch, businessId]);

  // ── Actions ───────────────────────────────────────────────────────────────
  async function saveSettings(patch: Partial<NetworkSettings>) {
    setSaving(true);
    const res = await fetch("/api/network/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (data.settings) setSettings((prev) => ({ ...prev, ...data.settings }));
    setSaving(false);
    return data;
  }

  async function createOffer() {
    setSaving(true);
    const res = await fetch("/api/network/offers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: offerForm.title,
        offer_type: offerForm.offer_type,
        amount: offerForm.amount,
        min_spend_cents: offerForm.min_spend_cents ? parseInt(offerForm.min_spend_cents) * 100 : null,
        budget_cents: offerForm.budget_cents ? parseInt(offerForm.budget_cents) : null,
        expires_at: offerForm.expires_at || null,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok || !data.offer) {
      return { error: data.error || "Failed to save offer. Please try again." };
    }
    setOffers((prev) => [data.offer, ...prev]);
    setShowOfferForm(false);
    return data;
  }

  async function updateOffer(id: string, patch: Partial<NetworkOffer>) {
    const res = await fetch(`/api/network/offers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (data.offer) setOffers((prev) => prev.map((o) => o.id === id ? data.offer : o));
    setEditOffer(null);
  }

  async function deleteOffer(id: string) {
    if (!confirm("Delete this offer?")) return;
    const res = await fetch(`/api/network/offers/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) { alert(data.error || "Failed to delete offer. Try pausing it instead."); return; }
    setOffers((prev) => prev.filter((o) => o.id !== id));
  }

  async function sendInvite(targetBusinessId: string) {
    const res = await fetch("/api/network/partners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetBusinessId }),
    });
    const data = await res.json();
    if (data.error) { alert(data.error); return; }
    setPartnerSearch("");
    setSearchResults([]);
    if (businessId) loadAll(businessId);
  }

  async function partnerAction(id: string, action: "accept" | "reject" | "remove") {
    const res = await fetch(`/api/network/partners/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json();
    if (data.partner) {
      setPartners((prev) => prev.map((p) =>
        p.id === id ? { ...p, status: data.partner.status } : p
      ).filter((p) => p.status !== "removed"));
    }
  }

  // ── Load broadcast preview + history when tab is active ─────────────────
  useEffect(() => {
    if (activeTab !== "broadcast" || !businessId) return;
    if (!broadcastPreview) {
      fetch("/api/network/broadcast").then((r) => r.json()).then((d) => {
        if (!d.error) setBroadcastPreview(d);
      });
    }
    if (!broadcastHistoryLoaded) {
      fetch("/api/network/broadcast?history=1").then((r) => r.json()).then((d) => {
        if (d.broadcasts) { setBroadcastHistory(d.broadcasts); setBroadcastHistoryLoaded(true); }
      });
    }
  }, [activeTab, businessId, broadcastPreview, broadcastHistoryLoaded]);

  // ── Refer Customer modal customer search ─────────────────────────────────
  useEffect(() => {
    if (referCustomerSearch.length < 2) { setReferCustomerResults([]); return; }
    const t = setTimeout(async () => {
      setReferCustomerSearchLoading(true);
      const res = await fetch(`/api/admin/customers/search?q=${encodeURIComponent(referCustomerSearch)}`);
      const data = await res.json();
      setReferCustomerResults(data.customers ?? []);
      setReferCustomerSearchLoading(false);
    }, 400);
    return () => clearTimeout(t);
  }, [referCustomerSearch]);

  async function sendReferral(mode: "sms" | "qr" | "sms-qr" = "sms") {
    if (!referModalPartner || !selectedReferCustomer) return;
    setReferSending(true);
    const res = await fetch("/api/network/send-referral", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: selectedReferCustomer.id,
        partnerBusinessId: referModalPartner.id,
        message: referMessage.trim() || undefined,
        mode,
      }),
    });
    const data = await res.json();
    setReferSending(false);
    if (data.error) { alert(data.error); return; }
    if (mode === "qr" && data.referralUrl) {
      setReferQrUrl(data.referralUrl);
      return;
    }
    setReferSentMode(mode === "sms-qr" ? "sms-qr" : "sms");
    setReferSent(true);
    setTimeout(() => {
      setReferModalPartner(null);
      setReferSent(false);
      setReferSentMode("sms");
      setReferQrUrl(null);
      setSelectedReferCustomer(null);
      setReferCustomerSearch("");
      setReferMessage("");
    }, 2000);
  }

  async function sendBroadcast() {
    if (!broadcastMessage.trim()) return;
    setBroadcastSending(true);
    const res = await fetch("/api/network/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: broadcastMessage.trim() }),
    });
    const data = await res.json();
    setBroadcastSending(false);
    if (data.error) { alert(data.error); return; }
    setBroadcastResult(data);
    setBroadcastMessage("");
    // Refresh history and preview after send
    setBroadcastHistoryLoaded(false);
    setBroadcastPreview(null);
  }

  // ── Onboarding steps ──────────────────────────────────────────────────────
  async function startJoin() {
    await saveSettings({ enabled: true });
    setPhase("onboarding");
    setOnboardStep(1);
  }

  async function finishOnboarding() {
    await saveSettings({ onboarding_complete: true });
    setPhase("portal");
    setActiveTab("overview");
  }

  // ── Render helpers ────────────────────────────────────────────────────────
  const pendingPartners = partners.filter(
    (p) => p.status === "pending" && p.initiated_by !== businessId
  );

  const referralLink = (offerId: string) =>
    typeof window !== "undefined"
      ? `${window.location.origin}/${businessSlug}?net_ref=${offerId}`
      : `/${businessSlug}?net_ref=${offerId}`;

  if (phase === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600" />
      </div>
    );
  }

  // ── JOIN SCREEN ────────────────────────────────────────────────────────────
  if (phase === "join") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
            <span className="text-4xl">🤝</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-3">Katoomy Network</h1>
          <p className="text-gray-600 mb-2 text-lg">Partner with local businesses.</p>
          <p className="text-gray-500 mb-8 text-sm">Send customers to partners. Get customers back. Track every referral — automatically.</p>
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[["📤", "Send customers to partners"], ["📥", "Receive new customers"], ["💰", "Earn Katoomy credits"]].map(([icon, label]) => (
              <div key={label as string} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="text-2xl mb-2">{icon}</div>
                <p className="text-xs text-gray-600 font-medium">{label}</p>
              </div>
            ))}
          </div>
          <button
            onClick={startJoin}
            className="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold rounded-xl text-lg shadow-lg hover:from-purple-700 hover:to-indigo-700 transition"
          >
            Join the Network
          </button>
          <p className="text-xs text-gray-400 mt-4">Free to join. Setup takes under 2 minutes.</p>
        </div>
      </div>
    );
  }

  // ── ONBOARDING ─────────────────────────────────────────────────────────────
  if (phase === "onboarding") {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="max-w-lg w-full">
          {/* Progress */}
          <div className="flex items-center gap-2 mb-8">
            {[1, 2, 3, 4, 5].map((s) => (
              <div key={s} className="flex items-center gap-2 flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                  s < onboardStep ? "bg-green-500 text-white" :
                  s === onboardStep ? "bg-purple-600 text-white" :
                  "bg-gray-200 text-gray-400"
                }`}>
                  {s < onboardStep ? "✓" : s}
                </div>
                {s < 5 && <div className={`h-1 flex-1 rounded ${s < onboardStep ? "bg-green-400" : "bg-gray-200"}`} />}
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-8">
            {/* Step 1 — Enable */}
            {onboardStep === 1 && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Enable Network</h2>
                <p className="text-gray-500 mb-6">Your business is now visible to other Katoomy businesses for partnerships.</p>
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex items-center justify-between mb-6">
                  <div>
                    <p className="font-semibold text-gray-900">Local Business Network</p>
                    <p className="text-sm text-gray-500">Connect with complementary businesses</p>
                  </div>
                  <div className="w-12 h-6 bg-purple-600 rounded-full flex items-center justify-end px-1">
                    <div className="w-4 h-4 bg-white rounded-full" />
                  </div>
                </div>
                <button onClick={() => setOnboardStep(2)} className="w-full py-3 bg-purple-600 text-white font-semibold rounded-xl hover:bg-purple-700 transition">
                  Continue →
                </button>
              </div>
            )}

            {/* Step 2 — Create Offer */}
            {onboardStep === 2 && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Create Your First Offer</h2>
                <p className="text-gray-500 mb-6">This is what partner customers will see when they book with you.</p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Offer type</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(["dollar_off", "percent_off"] as const).map((t) => (
                        <button key={t} type="button"
                          onClick={() => setOfferForm((f) => ({ ...f, offer_type: t, amount: t === "dollar_off" ? 500 : 10 }))}
                          className={`py-2 rounded-lg border text-sm font-medium transition ${offerForm.offer_type === t ? "border-purple-600 bg-purple-50 text-purple-700" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}
                        >
                          {t === "dollar_off" ? "$ Off" : "% Off"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {offerForm.offer_type === "dollar_off" ? "Discount amount ($)" : "Discount percentage (%)"}
                    </label>
                    <input type="number" min={1}
                      value={offerForm.offer_type === "dollar_off" ? offerForm.amount / 100 : offerForm.amount}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value) || 0;
                        setOfferForm((f) => ({ ...f, amount: f.offer_type === "dollar_off" ? Math.round(v * 100) : v }));
                      }}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Offer title</label>
                    <input type="text" value={offerForm.title}
                      onChange={(e) => setOfferForm((f) => ({ ...f, title: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 outline-none"
                      placeholder="e.g. Get $5 off your first visit"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Monthly budget cap (optional)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-gray-400">$</span>
                      <input type="number" min={0}
                        value={offerForm.budget_cents ? parseInt(offerForm.budget_cents) / 100 : ""}
                        onChange={(e) => setOfferForm((f) => ({ ...f, budget_cents: e.target.value ? String(Math.round(parseFloat(e.target.value) * 100)) : "" }))}
                        className="w-full border border-gray-200 rounded-lg pl-7 pr-3 py-2 focus:ring-2 focus:ring-purple-500 outline-none"
                        placeholder="100"
                      />
                    </div>
                  </div>
                  {/* Preview */}
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                    <p className="text-xs text-gray-400 mb-1">Customer will see</p>
                    <p className="font-bold text-gray-900">{offerForm.title || "Your offer title"}</p>
                    <p className="text-sm text-purple-600 font-medium mt-1">
                      {offerForm.offer_type === "dollar_off"
                        ? `$${(offerForm.amount / 100).toFixed(0)} discount applied at checkout`
                        : `${offerForm.amount}% discount applied at checkout`}
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button onClick={() => setOnboardStep(1)} className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-600 font-medium hover:bg-gray-50 transition">← Back</button>
                  <button onClick={() => setOnboardStep(3)} disabled={!offerForm.title}
                    className="flex-1 py-3 bg-purple-600 text-white font-semibold rounded-xl hover:bg-purple-700 transition disabled:opacity-40">
                    Continue →
                  </button>
                </div>
              </div>
            )}

            {/* Step 3 — Referral Reward */}
            {onboardStep === 3 && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Set Referral Reward</h2>
                <p className="text-gray-500 mb-6">Set how many Katoomy credits you owe a partner each time they send you a customer who books.</p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Credits owed per referred customer ($)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-gray-400">$</span>
                      <input type="number" min={0}
                        value={settings.referral_reward_cents / 100}
                        onChange={(e) => setSettings((s) => ({ ...s, referral_reward_cents: Math.round((parseFloat(e.target.value) || 0) * 100) }))}
                        className="w-full border border-gray-200 rounded-lg pl-7 pr-3 py-2 focus:ring-2 focus:ring-purple-500 outline-none"
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Applied as credit to your Katoomy billing</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Monthly spend cap ($)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-gray-400">$</span>
                      <input type="number" min={0}
                        value={settings.max_monthly_spend_cents / 100}
                        onChange={(e) => setSettings((s) => ({ ...s, max_monthly_spend_cents: Math.round((parseFloat(e.target.value) || 0) * 100) }))}
                        className="w-full border border-gray-200 rounded-lg pl-7 pr-3 py-2 focus:ring-2 focus:ring-purple-500 outline-none"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button onClick={() => setOnboardStep(2)} className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-600 font-medium hover:bg-gray-50 transition">← Back</button>
                  <button onClick={() => setOnboardStep(4)} className="flex-1 py-3 bg-purple-600 text-white font-semibold rounded-xl hover:bg-purple-700 transition">Continue →</button>
                </div>
              </div>
            )}

            {/* Step 4 — Partner Preferences */}
            {onboardStep === 4 && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Partner Preferences</h2>
                <p className="text-gray-500 mb-6">Control how other businesses can partner with you.</p>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border border-gray-200 rounded-xl">
                    <div>
                      <p className="font-medium text-gray-900">Auto-approve partners</p>
                      <p className="text-sm text-gray-500">Automatically accept partner invites</p>
                    </div>
                    <button type="button" onClick={() => setSettings((s) => ({ ...s, auto_approve_partners: !s.auto_approve_partners }))}
                      className={`w-12 h-6 rounded-full transition flex items-center px-1 ${settings.auto_approve_partners ? "bg-purple-600 justify-end" : "bg-gray-300 justify-start"}`}>
                      <div className="w-4 h-4 bg-white rounded-full" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-4 border border-gray-200 rounded-xl">
                    <div>
                      <p className="font-medium text-gray-900">Allow Katoomy suggestions</p>
                      <p className="text-sm text-gray-500">Let Katoomy suggest compatible partners</p>
                    </div>
                    <button type="button" onClick={() => setSettings((s) => ({ ...s, allow_katoomy_suggestions: !s.allow_katoomy_suggestions }))}
                      className={`w-12 h-6 rounded-full transition flex items-center px-1 ${settings.allow_katoomy_suggestions ? "bg-purple-600 justify-end" : "bg-gray-300 justify-start"}`}>
                      <div className="w-4 h-4 bg-white rounded-full" />
                    </button>
                  </div>
                </div>
                {onboardError && (
                  <p className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{onboardError}</p>
                )}
                <div className="flex gap-3 mt-6">
                  <button onClick={() => setOnboardStep(3)} className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-600 font-medium hover:bg-gray-50 transition">← Back</button>
                  <button
                    onClick={async () => {
                      setOnboardError(null);
                      await saveSettings({
                        enabled: true,
                        auto_approve_partners: settings.auto_approve_partners,
                        allow_katoomy_suggestions: settings.allow_katoomy_suggestions,
                        max_monthly_spend_cents: settings.max_monthly_spend_cents,
                        referral_reward_cents: settings.referral_reward_cents,
                      });
                      const result = await createOffer();
                      if (result?.error) {
                        setOnboardError(result.error);
                        return;
                      }
                      setOnboardStep(5);
                    }}
                    disabled={saving}
                    className="flex-1 py-3 bg-purple-600 text-white font-semibold rounded-xl hover:bg-purple-700 transition disabled:opacity-40"
                  >
                    {saving ? "Saving..." : "Continue →"}
                  </button>
                </div>
              </div>
            )}

            {/* Step 5 — Done */}
            {onboardStep === 5 && (
              <div className="text-center">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="text-4xl">🎉</span>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-3">You&apos;re in the Network!</h2>
                <p className="text-gray-500 mb-6">Your offer is live. Now invite local businesses to partner with you, or wait for them to find you.</p>
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-left mb-6 space-y-2">
                  <p className="text-sm font-semibold text-purple-800">What happens next</p>
                  <p className="text-sm text-purple-700">✓ Partner businesses can find and invite you</p>
                  <p className="text-sm text-purple-700">✓ You can invite partners from the Partners tab</p>
                  <p className="text-sm text-purple-700">✓ Customers who book via a partner link get your offer</p>
                  <p className="text-sm text-purple-700">✓ You earn credits for every customer you send</p>
                </div>
                <button onClick={finishOnboarding} className="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold rounded-xl text-lg hover:from-purple-700 hover:to-indigo-700 transition">
                  Go to Network Dashboard →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── MAIN PORTAL ────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Business Network</h1>
          <p className="text-sm text-gray-500">Send and receive customers with local partners</p>
        </div>
        <div className="flex items-center gap-2">
          {pendingPartners.length > 0 && (
            <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-1 rounded-full">
              {pendingPartners.length} invite{pendingPartners.length > 1 ? "s" : ""}
            </span>
          )}
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${settings.enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
            {settings.enabled ? "● Active" : "○ Paused"}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6">
        {(["overview", "offers", "partners", "broadcast", "settings"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`flex-1 py-2 text-sm font-medium rounded-lg capitalize transition ${
              activeTab === t ? "bg-white shadow-sm text-purple-700" : "text-gray-500 hover:text-gray-700"
            }`}>
            {t}
            {t === "partners" && pendingPartners.length > 0 && (
              <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-1.5">{pendingPartners.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ───────────────────────────────────────────────────── */}
      {activeTab === "overview" && (
        <div className="space-y-4">
          {/* Stats grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { label: "Customers Sent", value: overview?.customers_sent ?? 0, icon: "📤", color: "text-blue-600", bg: "bg-blue-50" },
              { label: "Customers Received", value: overview?.direct_received ?? 0, icon: "📥", color: "text-green-600", bg: "bg-green-50" },
              { label: "Offer Links", value: overview?.offer_link_received ?? 0, icon: "🔗", color: "text-purple-600", bg: "bg-purple-50" },
              { label: "Credits Earned", value: cents(overview?.referral_earnings_cents ?? 0), icon: "💰", color: "text-purple-600", bg: "bg-purple-50" },
              { label: "Total Credits", value: cents(overview?.total_credits_cents ?? 0), icon: "🏦", color: "text-indigo-600", bg: "bg-indigo-50" },
              { label: "Completed Bookings", value: overview?.completed_received ?? 0, icon: "✅", color: "text-teal-600", bg: "bg-teal-50" },
            ].map(({ label, value, icon, color, bg }) => (
              <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <div className={`w-10 h-10 ${bg} rounded-lg flex items-center justify-center mb-3`}>
                  <span className="text-xl">{icon}</span>
                </div>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
                <p className="text-xs text-gray-500 mt-1">{label}</p>
              </div>
            ))}
          </div>

          {/* Referral activity */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <p className="font-semibold text-gray-900">Referral Activity</p>
              <p className="text-xs text-gray-400 mt-0.5">Customers sent to and received from partners</p>
            </div>
            {activity.length === 0 ? (
              <div className="px-5 py-8 text-center text-gray-400 text-sm">No referral activity yet</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {activity.map((item) => (
                  <div key={item.id} className="flex items-center justify-between px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${
                        item.direction === "sent" ? "bg-blue-100 text-blue-600" : "bg-green-100 text-green-600"
                      }`}>
                        {item.direction === "sent" ? "📤" : "📥"}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {item.customer_name ?? item.customer_phone ?? "Unknown customer"}
                        </p>
                        <p className="text-xs text-gray-500">
                          {item.direction === "sent" ? `Sent to ${item.partner_name}` : `Received from ${item.partner_name}`}
                          {" · "}{item.type === "direct" ? "SMS referral" : "Offer link"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        item.status === "completed" || item.status === "credited" || item.status === "booked"
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}>
                        {item.status}
                      </span>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(item.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick tips */}
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-5">
            <p className="font-semibold text-purple-900 mb-3">💡 Get more from the network</p>
            <ul className="space-y-2 text-sm text-purple-800">
              <li>→ <button onClick={() => setActiveTab("partners")} className="underline">Invite a local business</button> to start exchanging customers</li>
              <li>→ <button onClick={() => setActiveTab("offers")} className="underline">Adjust your offer</button> to attract more partner customers</li>
              <li>→ Share your offer link with partners so they can add it to their confirmation pages</li>
            </ul>
          </div>
        </div>
      )}

      {/* ── OFFERS TAB ─────────────────────────────────────────────────────── */}
      {activeTab === "offers" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-500">{offers.length} offer{offers.length !== 1 ? "s" : ""}</p>
            <button onClick={() => { setEditOffer(null); setOfferForm({ title: "Get $5 off your first visit", offer_type: "dollar_off", amount: 500, min_spend_cents: "", budget_cents: "10000", expires_at: "" }); setShowOfferForm(true); }}
              className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 transition">
              + New Offer
            </button>
          </div>

          {offers.length === 0 && !showOfferForm && (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <p className="text-4xl mb-3">🎁</p>
              <p className="text-gray-500">No offers yet. Create one so partners can send customers your way.</p>
            </div>
          )}

          {offers.map((offer) => (
            <div key={offer.id} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              {editOffer?.id === offer.id ? (
                <div className="space-y-3">
                  <input type="text" value={editOffer.title} onChange={(e) => setEditOffer({ ...editOffer, title: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 outline-none" />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500">Amount</label>
                      <input type="number" value={offer.offer_type === "dollar_off" ? editOffer.amount / 100 : editOffer.amount}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value) || 0;
                          setEditOffer({ ...editOffer, amount: offer.offer_type === "dollar_off" ? Math.round(v * 100) : v });
                        }}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 outline-none" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Budget ($)</label>
                      <input type="number" value={editOffer.budget_cents ? editOffer.budget_cents / 100 : ""}
                        onChange={(e) => setEditOffer({ ...editOffer, budget_cents: e.target.value ? Math.round(parseFloat(e.target.value) * 100) : null })}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 outline-none" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => updateOffer(offer.id, { title: editOffer.title, amount: editOffer.amount, budget_cents: editOffer.budget_cents })}
                      className="flex-1 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition">Save</button>
                    <button onClick={() => setEditOffer(null)} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition">Cancel</button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-bold text-gray-900">{offer.title}</p>
                      <p className="text-sm text-purple-600 font-medium">{formatOffer(offer)}</p>
                    </div>
                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${offer.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {offer.active ? "Active" : "Paused"}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-sm text-gray-600 mb-4">
                    <div><p className="text-xs text-gray-400">Used</p><p className="font-medium">{offer.used_count}x</p></div>
                    <div><p className="text-xs text-gray-400">Total cost</p><p className="font-medium">{cents(offer.total_cost_cents)}</p></div>
                    <div><p className="text-xs text-gray-400">Budget</p><p className="font-medium">{offer.budget_cents ? cents(offer.budget_cents) : "No cap"}</p></div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => updateOffer(offer.id, { active: !offer.active })}
                      className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition">
                      {offer.active ? "⏸ Pause" : "▶ Resume"}
                    </button>
                    <button onClick={() => setEditOffer(offer)}
                      className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition">
                      ✏️ Edit
                    </button>
                    <button onClick={() => deleteOffer(offer.id)}
                      className="py-2 px-3 border border-red-200 rounded-lg text-sm text-red-600 hover:bg-red-50 transition">
                      🗑
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* New offer form */}
          {showOfferForm && (
            <div className="bg-white rounded-xl border border-purple-200 p-5 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-4">New Offer</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["dollar_off", "percent_off"] as const).map((t) => (
                      <button key={t} type="button"
                        onClick={() => setOfferForm((f) => ({ ...f, offer_type: t, amount: t === "dollar_off" ? 500 : 10 }))}
                        className={`py-2 rounded-lg border text-sm font-medium ${offerForm.offer_type === t ? "border-purple-600 bg-purple-50 text-purple-700" : "border-gray-200 text-gray-600"}`}>
                        {t === "dollar_off" ? "$ Off" : "% Off"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700">{offerForm.offer_type === "dollar_off" ? "Amount ($)" : "Percent (%)"}</label>
                    <input type="number" min={1}
                      value={offerForm.offer_type === "dollar_off" ? offerForm.amount / 100 : offerForm.amount}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value) || 0;
                        setOfferForm((f) => ({ ...f, amount: f.offer_type === "dollar_off" ? Math.round(v * 100) : v }));
                      }}
                      className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 outline-none" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Budget ($)</label>
                    <input type="number" min={0}
                      value={offerForm.budget_cents ? parseInt(offerForm.budget_cents) / 100 : ""}
                      onChange={(e) => setOfferForm((f) => ({ ...f, budget_cents: e.target.value ? String(Math.round(parseFloat(e.target.value) * 100)) : "" }))}
                      className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 outline-none" />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Title</label>
                  <input type="text" value={offerForm.title}
                    onChange={(e) => setOfferForm((f) => ({ ...f, title: e.target.value }))}
                    className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 outline-none" />
                </div>
                <div className="flex gap-2">
                  <button onClick={createOffer} disabled={saving || !offerForm.title}
                    className="flex-1 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition disabled:opacity-40">
                    {saving ? "Creating..." : "Create Offer"}
                  </button>
                  <button onClick={() => setShowOfferForm(false)} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition">Cancel</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── PARTNERS TAB ───────────────────────────────────────────────────── */}
      {activeTab === "partners" && (
        <div className="space-y-4">
          {/* Invite search */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <p className="text-sm font-semibold text-gray-700 mb-3">Invite a Business</p>
            <div className="relative">
              <input type="text" value={partnerSearch}
                onChange={(e) => setPartnerSearch(e.target.value)}
                placeholder="Search by business name..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm pr-8 focus:ring-2 focus:ring-purple-500 outline-none"
              />
              {searchLoading && <div className="absolute right-3 top-2.5 w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />}
            </div>
            {searchResults.length > 0 && (
              <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden">
                {searchResults.map((b) => (
                  <div key={b.id} className="flex items-center justify-between p-3 hover:bg-gray-50 border-b border-gray-100 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{b.name}</p>
                      <p className="text-xs text-gray-400">katoomy.com/{b.slug}</p>
                    </div>
                    <button onClick={() => sendInvite(b.id)}
                      className="bg-purple-600 text-white text-xs px-3 py-1.5 rounded-lg font-medium hover:bg-purple-700 transition">
                      Invite
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pending invites needing action */}
          {pendingPartners.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Pending Invites</p>
              {pendingPartners.map((p) => (
                <div key={p.id} className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-center justify-between mb-2">
                  <div>
                    <p className="font-medium text-gray-900">{(p.partner as { name: string } | null)?.name ?? "Unknown"}</p>
                    <p className="text-xs text-yellow-700">Wants to partner with you</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => partnerAction(p.id, "accept")}
                      className="bg-green-600 text-white text-xs px-3 py-1.5 rounded-lg font-medium hover:bg-green-700 transition">Accept</button>
                    <button onClick={() => partnerAction(p.id, "reject")}
                      className="border border-gray-200 text-gray-600 text-xs px-3 py-1.5 rounded-lg font-medium hover:bg-gray-50 transition">Reject</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Partner list */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">
              {partners.filter((p) => p.status === "active").length} Active Partner{partners.filter((p) => p.status === "active").length !== 1 ? "s" : ""}
            </p>
            {partners.filter((p) => p.status !== "pending" || p.initiated_by === businessId).map((p) => {
              const biz = p.partner as { name: string; slug: string } | null;
              return (
                <div key={p.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between mb-2 shadow-sm">
                  <div>
                    <p className="font-medium text-gray-900">{biz?.name ?? "Unknown"}</p>
                    {biz?.slug && <p className="text-xs text-gray-400">katoomy.com/{biz.slug}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                      p.status === "active" ? "bg-green-100 text-green-700" :
                      p.status === "pending" ? "bg-yellow-100 text-yellow-700" :
                      "bg-gray-100 text-gray-500"
                    }`}>
                      {p.status === "active" ? "✔ Active" :
                       p.status === "pending" ? "⏳ Pending" : p.status}
                    </span>
                    {p.status === "active" && p.partner && (
                      <button
                        onClick={() => {
                          setReferModalPartner({ id: p.partner!.id, name: p.partner!.name, slug: p.partner!.slug });
                          setSelectedReferCustomer(null);
                          setReferCustomerSearch("");
                          setReferMessage("");
                          setReferSent(false);
                        }}
                        className="text-xs bg-purple-600 text-white px-2.5 py-1 rounded-lg font-medium hover:bg-purple-700 transition">
                        Refer Customer
                      </button>
                    )}
                    {p.status === "active" && (
                      <button onClick={() => partnerAction(p.id, "remove")}
                        className="text-xs text-red-500 hover:text-red-700">Remove</button>
                    )}
                  </div>
                </div>
              );
            })}
            {partners.length === 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                <p className="text-4xl mb-3">🤝</p>
                <p className="text-gray-500">No partners yet. Search for local businesses above to get started.</p>
              </div>
            )}
          </div>

          {/* Offer link helper */}
          {offers.length > 0 && partners.filter((p) => p.status === "active").length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-blue-900 mb-1">Share your offer link with partners</p>
              <p className="text-xs text-blue-700 mb-2">Partners add this link to their confirmation page. Customers who click it get your offer automatically.</p>
              {offers.filter((o) => o.active).slice(0, 1).map((o) => (
                <div key={o.id} className="bg-white rounded-lg p-2 text-xs text-gray-600 font-mono break-all">
                  {referralLink(o.id)}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── BROADCAST TAB ─────────────────────────────────────────────────── */}
      {activeTab === "broadcast" && (
        <div className="space-y-4">
          {/* Reach preview */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <p className="font-semibold text-gray-900 mb-1">Network Reach</p>
            <p className="text-xs text-gray-400 mb-3">Customers who opted in to marketing SMS across your active partners.</p>
            {!broadcastPreview ? (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600" />
              </div>
            ) : broadcastPreview.partnerCount === 0 ? (
              <div className="text-center py-4">
                <p className="text-sm text-gray-500">You have no active partners yet.</p>
                <button onClick={() => setActiveTab("partners")} className="text-sm text-purple-600 underline mt-1">Add partners</button>
              </div>
            ) : (
              <div className="flex gap-3">
                <div className="bg-purple-50 rounded-xl px-4 py-3 text-center flex-1">
                  <p className="text-2xl font-bold text-purple-700">{broadcastPreview.customerCount}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Eligible customers</p>
                </div>
                <div className="bg-blue-50 rounded-xl px-4 py-3 text-center flex-1">
                  <p className="text-2xl font-bold text-blue-700">{broadcastPreview.partnerCount}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Partner businesses</p>
                </div>
              </div>
            )}
          </div>

          {/* Result */}
          {broadcastResult && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <p className="font-semibold text-green-800 mb-2">Broadcast sent!</p>
              <div className="flex gap-4 text-sm">
                <span className="text-green-700">{broadcastResult.sent} sent</span>
                {broadcastResult.failed > 0 && <span className="text-red-600">{broadcastResult.failed} failed</span>}
                {broadcastResult.skipped > 0 && <span className="text-gray-500">{broadcastResult.skipped} skipped (quiet hours)</span>}
              </div>
              <button
                onClick={() => setBroadcastResult(null)}
                className="text-xs text-green-600 underline mt-2">
                Compose another
              </button>
            </div>
          )}

          {/* Composer */}
          {!broadcastResult && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <p className="font-semibold text-gray-900 mb-1">Compose Message</p>
              <p className="text-xs text-gray-400 mb-4">Your business name and booking link are added automatically. Customer phone numbers are never shared with you.</p>
              <textarea
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                rows={4}
                maxLength={140}
                placeholder={`e.g. "We're running a spring special — 20% off all services this week only!"`}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-purple-500 outline-none"
              />
              <div className="flex justify-between items-center mt-1 mb-4">
                <span className={`text-xs ${broadcastMessage.length >= 120 ? "text-orange-500" : "text-gray-400"}`}>
                  {broadcastMessage.length}/140 characters
                </span>
              </div>
              {broadcastMessage.trim() && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4">
                  <p className="text-xs text-gray-400 mb-1">Message preview</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {broadcastMessage.trim()}{"\n\n"}{"— "}{businessSlug || "Your Business"} | Book: katoomy.com/{businessSlug}{"\n"}Reply STOP to opt out
                  </p>
                </div>
              )}
              <button
                onClick={sendBroadcast}
                disabled={!broadcastMessage.trim() || broadcastSending || (broadcastPreview?.customerCount ?? 0) === 0}
                className="w-full py-3 bg-purple-600 text-white font-semibold rounded-xl hover:bg-purple-700 transition disabled:opacity-40">
                {broadcastSending
                  ? "Sending..."
                  : `Send to ${broadcastPreview?.customerCount ?? 0} Customer${(broadcastPreview?.customerCount ?? 0) !== 1 ? "s" : ""}`}
              </button>
              <p className="text-xs text-gray-400 mt-2 text-center">
                Customers in quiet hours (8pm–8am local time) will be skipped.
              </p>
            </div>
          )}

          {/* History */}
          {broadcastHistory.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <p className="font-semibold text-gray-900">Broadcast History</p>
              </div>
              <div className="divide-y divide-gray-100">
                {broadcastHistory.map((b) => (
                  <div key={b.id} className="px-5 py-4">
                    <div className="flex justify-between items-start mb-1.5">
                      <p className="text-sm text-gray-700 line-clamp-2 flex-1 mr-4">{b.message.split("\n")[0]}</p>
                      <p className="text-xs text-gray-400 flex-shrink-0">
                        {new Date(b.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </p>
                    </div>
                    <div className="flex gap-3 text-xs">
                      <span className="text-green-600">{b.total_sent} sent</span>
                      {b.total_failed > 0 && <span className="text-red-500">{b.total_failed} failed</span>}
                      {b.total_skipped > 0 && <span className="text-gray-400">{b.total_skipped} skipped</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── SETTINGS TAB ───────────────────────────────────────────────────── */}
      {activeTab === "settings" && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-gray-100">
            <div>
              <p className="font-semibold text-gray-900">Network enabled</p>
              <p className="text-sm text-gray-500">Pause to temporarily stop accepting network customers</p>
            </div>
            <button type="button" onClick={async () => {
              const updated = { ...settings, enabled: !settings.enabled };
              setSettings(updated);
              await saveSettings({ enabled: updated.enabled });
            }}
              className={`w-12 h-6 rounded-full transition flex items-center px-1 ${settings.enabled ? "bg-purple-600 justify-end" : "bg-gray-300 justify-start"}`}>
              <div className="w-4 h-4 bg-white rounded-full" />
            </button>
          </div>

          <div className="flex items-center justify-between pb-4 border-b border-gray-100">
            <div>
              <p className="font-semibold text-gray-900">Auto-approve partners</p>
              <p className="text-sm text-gray-500">Automatically accept incoming partner invites</p>
            </div>
            <button type="button" onClick={() => setSettings((s) => ({ ...s, auto_approve_partners: !s.auto_approve_partners }))}
              className={`w-12 h-6 rounded-full transition flex items-center px-1 ${settings.auto_approve_partners ? "bg-purple-600 justify-end" : "bg-gray-300 justify-start"}`}>
              <div className="w-4 h-4 bg-white rounded-full" />
            </button>
          </div>

          <div className="flex items-center justify-between pb-4 border-b border-gray-100">
            <div>
              <p className="font-semibold text-gray-900">Allow Katoomy suggestions</p>
              <p className="text-sm text-gray-500">Let Katoomy suggest compatible partner businesses</p>
            </div>
            <button type="button" onClick={() => setSettings((s) => ({ ...s, allow_katoomy_suggestions: !s.allow_katoomy_suggestions }))}
              className={`w-12 h-6 rounded-full transition flex items-center px-1 ${settings.allow_katoomy_suggestions ? "bg-purple-600 justify-end" : "bg-gray-300 justify-start"}`}>
              <div className="w-4 h-4 bg-white rounded-full" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max monthly spend ($)</label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-gray-400">$</span>
                <input type="number" min={0} value={settings.max_monthly_spend_cents / 100}
                  onChange={(e) => setSettings((s) => ({ ...s, max_monthly_spend_cents: Math.round((parseFloat(e.target.value) || 0) * 100) }))}
                  className="w-full border border-gray-200 rounded-lg pl-7 pr-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 outline-none" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Referral credit per customer ($)</label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-gray-400">$</span>
                <input type="number" min={0} value={settings.referral_reward_cents / 100}
                  onChange={(e) => setSettings((s) => ({ ...s, referral_reward_cents: Math.round((parseFloat(e.target.value) || 0) * 100) }))}
                  className="w-full border border-gray-200 rounded-lg pl-7 pr-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 outline-none" />
              </div>
            </div>
          </div>

          <button onClick={() => saveSettings({
            auto_approve_partners: settings.auto_approve_partners,
            allow_katoomy_suggestions: settings.allow_katoomy_suggestions,
            max_monthly_spend_cents: settings.max_monthly_spend_cents,
            referral_reward_cents: settings.referral_reward_cents,
          })} disabled={saving}
            className="w-full py-3 bg-purple-600 text-white font-semibold rounded-xl hover:bg-purple-700 transition disabled:opacity-40">
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      )}

      {/* ── REFER CUSTOMER MODAL ──────────────────────────────────────────── */}
      {referModalPartner && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <p className="font-semibold text-gray-900">Refer a Customer</p>
                <p className="text-xs text-gray-500">Send a customer to <span className="font-medium">{referModalPartner.name}</span></p>
              </div>
              <button onClick={() => { setReferModalPartner(null); setReferQrUrl(null); setReferSent(false); setReferSentMode("sms"); setSelectedReferCustomer(null); setReferCustomerSearch(""); setReferMessage(""); }} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>

            {referSent ? (
              <div className="py-10 text-center">
                <p className="text-4xl mb-3">✅</p>
                <p className="font-semibold text-gray-900">Referral sent!</p>
                <p className="text-sm text-gray-500 mt-1">
                  {referSentMode === "sms-qr"
                    ? "Your customer received a QR code image via SMS. They can save it and scan it from the Katoomy app."
                    : "Your customer received an SMS with the booking link."}
                </p>
              </div>
            ) : (
              <div className="p-5 space-y-4">
                {/* Customer search */}
                {!selectedReferCustomer ? (
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Search your customers</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={referCustomerSearch}
                        onChange={(e) => setReferCustomerSearch(e.target.value)}
                        placeholder="Type a name or phone..."
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm pr-8 focus:ring-2 focus:ring-purple-500 outline-none"
                        autoFocus
                      />
                      {referCustomerSearchLoading && (
                        <div className="absolute right-3 top-2.5 w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                      )}
                    </div>
                    {referCustomerResults.length > 0 && (
                      <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                        {referCustomerResults.map((c) => (
                          <button key={c.id}
                            onClick={() => { setSelectedReferCustomer(c); setReferCustomerSearch(""); setReferCustomerResults([]); }}
                            className="w-full flex items-center justify-between p-3 hover:bg-purple-50 border-b border-gray-100 last:border-0 text-left transition">
                            <div>
                              <p className="text-sm font-medium text-gray-900">{c.full_name}</p>
                              <p className="text-xs text-gray-400">{c.phone}</p>
                            </div>
                            <span className="text-xs text-purple-600 font-medium">Select</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {referCustomerSearch.length >= 2 && !referCustomerSearchLoading && referCustomerResults.length === 0 && (
                      <p className="text-xs text-gray-400 mt-2 text-center">No customers found</p>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between bg-purple-50 rounded-lg px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{selectedReferCustomer.full_name}</p>
                      <p className="text-xs text-gray-500">{selectedReferCustomer.phone}</p>
                    </div>
                    <button onClick={() => setSelectedReferCustomer(null)} className="text-xs text-gray-400 hover:text-gray-600">Change</button>
                  </div>
                )}

                {/* Optional message */}
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Personal message <span className="text-gray-400 font-normal">(optional)</span></label>
                  <textarea
                    value={referMessage}
                    onChange={(e) => setReferMessage(e.target.value)}
                    placeholder={`e.g. "Hey, check out ${referModalPartner.name} — I think you'd love it!"`}
                    rows={2}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>

                {referQrUrl ? (
                  <div className="flex flex-col items-center gap-4 py-2">
                    <p className="text-sm font-semibold text-gray-700 text-center">
                      Screenshot this QR code and send it to {selectedReferCustomer?.full_name?.split(" ")[0] ?? "the customer"}
                    </p>
                    <div className="bg-white p-4 rounded-2xl border-2 border-purple-200 shadow-sm">
                      <QRCodeSVG value={referQrUrl} size={200} includeMargin />
                    </div>
                    <p className="text-xs text-gray-400 text-center">
                      When they scan this from inside the Katoomy app, they&apos;ll be taken directly to {referModalPartner.name} with the discount applied.
                    </p>
                    <button
                      onClick={() => setReferQrUrl(null)}
                      className="text-sm text-purple-600 underline">
                      ← Back
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-gray-400 bg-gray-50 rounded-lg p-3">
                      Send a booking link via SMS, or deliver a QR code image the customer can scan from the Katoomy app.
                    </p>
                    <button
                      onClick={() => sendReferral("sms")}
                      disabled={!selectedReferCustomer || referSending}
                      className="w-full py-3 bg-purple-600 text-white font-semibold rounded-xl hover:bg-purple-700 transition disabled:opacity-40">
                      {referSending ? "Sending..." : "Send Link via SMS"}
                    </button>
                    <button
                      onClick={() => sendReferral("sms-qr")}
                      disabled={!selectedReferCustomer || referSending}
                      className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition disabled:opacity-40">
                      {referSending ? "Sending..." : "Send QR Code via SMS"}
                    </button>
                    <button
                      onClick={() => sendReferral("qr")}
                      disabled={!selectedReferCustomer || referSending}
                      className="w-full py-3 bg-gray-800 text-white font-semibold rounded-xl hover:bg-gray-900 transition disabled:opacity-40">
                      {referSending ? "Generating..." : "Show QR Code On Screen"}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
