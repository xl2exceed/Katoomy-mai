"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";

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
  active: boolean;
  used_count: number;
  total_cost_cents: number;
  budget_cents: number | null;
}

interface Partner {
  id: string;
  status: "pending" | "active" | "rejected" | "removed";
  initiated_by: string;
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

function cents(n: number) {
  return `$${(n / 100).toFixed(2)}`;
}

function formatOffer(o: NetworkOffer) {
  return o.offer_type === "dollar_off"
    ? `$${(o.amount / 100).toFixed(0)} Off`
    : `${o.amount}% Off`;
}

export default function MobileNetworkPage() {
  const router = useRouter();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [businessSlug, setBusinessSlug] = useState("");
  const [brandColor, setBrandColor] = useState("#7C3AED");
  const [phase, setPhase] = useState<"loading" | "join" | "onboarding" | "portal">("loading");
  const [onboardStep, setOnboardStep] = useState(1);
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  const [settings, setSettings] = useState<NetworkSettings>({
    enabled: true,
    auto_approve_partners: true,
    allow_katoomy_suggestions: true,
    max_monthly_spend_cents: 10000,
    referral_reward_cents: 500,
    onboarding_complete: false,
  });
  const [offerForm, setOfferForm] = useState({
    title: "Get $5 off your first visit",
    offer_type: "dollar_off" as "dollar_off" | "percent_off",
    amount: 500,
    budget_cents: "10000",
  });
  const [offers, setOffers] = useState<NetworkOffer[]>([]);
  const [showOfferForm, setShowOfferForm] = useState(false);

  const [partners, setPartners] = useState<Partner[]>([]);
  const [partnerSearch, setPartnerSearch] = useState("");
  const [searchResults, setSearchResults] = useState<BizSearch[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);

  const [saving, setSaving] = useState(false);
  const [onboardError, setOnboardError] = useState<string | null>(null);

  // Refer modal
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

  // Broadcast
  const [broadcastPreview, setBroadcastPreview] = useState<{ partnerCount: number; customerCount: number } | null>(null);
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastSending, setBroadcastSending] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<{ sent: number; failed: number; skipped: number } | null>(null);
  const [broadcastHistory, setBroadcastHistory] = useState<{ id: string; message: string; total_sent: number; total_failed: number; total_skipped: number; created_at: string }[]>([]);

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/admin/mobile/login"); return; }
      const { data: biz } = await supabase
        .from("businesses")
        .select("id, slug, primary_color")
        .eq("owner_user_id", user.id)
        .maybeSingle();
      if (biz) {
        setBusinessId(biz.id as string);
        setBusinessSlug(biz.slug as string);
        if (biz.primary_color) setBrandColor(biz.primary_color as string);
      }
    }
    init();
  }, [router]);

  const loadAll = useCallback(async (bId: string) => {
    const [settingsRes, offersRes, partnersRes, overviewRes, activityRes] = await Promise.all([
      fetch(`/api/network/settings?businessId=${bId}`).then(r => r.json()),
      fetch(`/api/network/offers?businessId=${bId}`).then(r => r.json()),
      fetch(`/api/network/partners?businessId=${bId}`).then(r => r.json()),
      fetch(`/api/network/overview?businessId=${bId}`).then(r => r.json()),
      fetch(`/api/network/activity?businessId=${bId}`).then(r => r.json()),
    ]);
    if (settingsRes.settings) {
      setSettings(prev => ({ ...prev, ...settingsRes.settings }));
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

  useEffect(() => {
    if (activeTab !== "broadcast" || !businessId) return;
    if (!broadcastPreview) {
      fetch("/api/network/broadcast").then(r => r.json()).then(d => { if (!d.error) setBroadcastPreview(d); });
    }
    if (broadcastHistory.length === 0) {
      fetch("/api/network/broadcast?history=1").then(r => r.json()).then(d => { if (d.broadcasts) setBroadcastHistory(d.broadcasts); });
    }
  }, [activeTab, businessId, broadcastPreview, broadcastHistory.length]);

  async function saveSettings(patch: Partial<NetworkSettings>) {
    setSaving(true);
    const res = await fetch("/api/network/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (data.settings) setSettings(prev => ({ ...prev, ...data.settings }));
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
        budget_cents: offerForm.budget_cents ? parseInt(offerForm.budget_cents) : null,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok || !data.offer) return { error: data.error || "Failed to create offer." };
    setOffers(prev => [data.offer, ...prev]);
    setShowOfferForm(false);
    return data;
  }

  async function toggleOffer(id: string, active: boolean) {
    const res = await fetch(`/api/network/offers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    const data = await res.json();
    if (data.offer) setOffers(prev => prev.map(o => o.id === id ? data.offer : o));
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
      setPartners(prev =>
        prev.map(p => p.id === id ? { ...p, status: data.partner.status } : p)
            .filter(p => p.status !== "removed")
      );
    }
  }

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
    if (mode === "qr" && data.referralUrl) { setReferQrUrl(data.referralUrl); return; }
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
    setBroadcastPreview(null);
    setBroadcastHistory([]);
  }

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

  const pendingPartners = partners.filter(p => p.status === "pending" && p.initiated_by !== businessId);

  const headerStyle = { background: `linear-gradient(135deg, ${brandColor} 0%, ${brandColor}cc 100%)` };

  if (phase === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={headerStyle}>
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white" />
      </div>
    );
  }

  // ── JOIN ─────────────────────────────────────────────────────────────────────
  if (phase === "join") {
    return (
      <div className="min-h-screen flex flex-col" style={headerStyle}>
        <div className="px-5 pt-12 pb-4 flex items-center gap-3">
          <button onClick={() => router.push("/admin/mobile/menu")} className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white text-lg">←</button>
          <h1 className="text-xl font-bold text-white">Business Network</h1>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm text-center">
            <div className="text-5xl mb-4">🤝</div>
            <h2 className="text-2xl font-black text-gray-900 mb-2">Katoomy Network</h2>
            <p className="text-gray-500 text-sm mb-6">Partner with local businesses. Send customers. Get customers back. Track every referral.</p>
            <div className="grid grid-cols-3 gap-3 mb-7">
              {[["📤", "Send customers"], ["📥", "Get customers"], ["💰", "Earn credits"]].map(([icon, label]) => (
                <div key={label as string} className="bg-purple-50 rounded-xl p-3">
                  <div className="text-2xl mb-1">{icon}</div>
                  <p className="text-xs text-gray-600 font-medium">{label}</p>
                </div>
              ))}
            </div>
            <button onClick={startJoin} className="w-full py-4 bg-purple-600 text-white font-bold rounded-2xl text-base active:scale-95 transition">
              Join the Network
            </button>
            <p className="text-xs text-gray-400 mt-3">Free to join. Setup takes 2 minutes.</p>
          </div>
        </div>
      </div>
    );
  }

  // ── ONBOARDING ───────────────────────────────────────────────────────────────
  if (phase === "onboarding") {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="px-5 pt-12 pb-4 flex items-center gap-3" style={headerStyle}>
          <button onClick={() => router.push("/admin/mobile/menu")} className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white text-lg">←</button>
          <h1 className="text-xl font-bold text-white">Network Setup</h1>
        </div>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 py-5 px-6">
          {[1, 2, 3, 4, 5].map(s => (
            <div key={s} className={`h-2 rounded-full flex-1 transition-all ${
              s < onboardStep ? "bg-green-500" : s === onboardStep ? "bg-purple-600" : "bg-gray-200"
            }`} />
          ))}
        </div>

        <div className="flex-1 px-5 pb-8">
          <div className="bg-white rounded-2xl shadow-sm p-6">
            {onboardStep === 1 && (
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Enable Network</h2>
                <p className="text-gray-500 text-sm mb-6">Your business will be visible to other Katoomy businesses for partnerships.</p>
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex items-center justify-between mb-6">
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">Local Business Network</p>
                    <p className="text-xs text-gray-500">Connect with complementary businesses</p>
                  </div>
                  <div className="w-11 h-6 bg-purple-600 rounded-full flex items-center justify-end px-1"><div className="w-4 h-4 bg-white rounded-full" /></div>
                </div>
                <button onClick={() => setOnboardStep(2)} className="w-full py-4 bg-purple-600 text-white font-bold rounded-xl active:scale-95 transition">Continue →</button>
              </div>
            )}

            {onboardStep === 2 && (
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Create Your First Offer</h2>
                <p className="text-gray-500 text-sm mb-5">This is what partner customers see when they book with you.</p>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    {(["dollar_off", "percent_off"] as const).map(t => (
                      <button key={t} type="button"
                        onClick={() => setOfferForm(f => ({ ...f, offer_type: t, amount: t === "dollar_off" ? 500 : 10 }))}
                        className={`py-3 rounded-xl border-2 text-sm font-bold transition ${offerForm.offer_type === t ? "border-purple-600 bg-purple-50 text-purple-700" : "border-gray-200 text-gray-500"}`}>
                        {t === "dollar_off" ? "$ Dollar Off" : "% Percent Off"}
                      </button>
                    ))}
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">
                      {offerForm.offer_type === "dollar_off" ? "Discount amount ($)" : "Discount (%)"}
                    </label>
                    <input type="number" min={1}
                      value={offerForm.offer_type === "dollar_off" ? offerForm.amount / 100 : offerForm.amount}
                      onChange={e => {
                        const v = parseFloat(e.target.value) || 0;
                        setOfferForm(f => ({ ...f, amount: f.offer_type === "dollar_off" ? Math.round(v * 100) : v }));
                      }}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-purple-500 outline-none text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Offer title</label>
                    <input type="text" value={offerForm.title}
                      onChange={e => setOfferForm(f => ({ ...f, title: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-purple-500 outline-none text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Monthly budget cap ($, optional)</label>
                    <input type="number" min={0}
                      value={offerForm.budget_cents ? parseInt(offerForm.budget_cents) / 100 : ""}
                      onChange={e => setOfferForm(f => ({ ...f, budget_cents: e.target.value ? String(Math.round(parseFloat(e.target.value) * 100)) : "" }))}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-purple-500 outline-none text-gray-900"
                      placeholder="100"
                    />
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button onClick={() => setOnboardStep(1)} className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-600 font-medium active:scale-95 transition">← Back</button>
                  <button onClick={() => setOnboardStep(3)} disabled={!offerForm.title}
                    className="flex-1 py-3 bg-purple-600 text-white font-bold rounded-xl active:scale-95 transition disabled:opacity-40">
                    Continue →
                  </button>
                </div>
              </div>
            )}

            {onboardStep === 3 && (
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Referral Reward</h2>
                <p className="text-gray-500 text-sm mb-5">Credits owed to a partner each time they send you a customer who books.</p>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Credits per referred customer ($)</label>
                    <input type="number" min={0}
                      value={settings.referral_reward_cents / 100}
                      onChange={e => setSettings(s => ({ ...s, referral_reward_cents: Math.round((parseFloat(e.target.value) || 0) * 100) }))}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-purple-500 outline-none text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Monthly spend cap ($)</label>
                    <input type="number" min={0}
                      value={settings.max_monthly_spend_cents / 100}
                      onChange={e => setSettings(s => ({ ...s, max_monthly_spend_cents: Math.round((parseFloat(e.target.value) || 0) * 100) }))}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-purple-500 outline-none text-gray-900"
                    />
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button onClick={() => setOnboardStep(2)} className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-600 font-medium active:scale-95 transition">← Back</button>
                  <button onClick={() => setOnboardStep(4)} className="flex-1 py-3 bg-purple-600 text-white font-bold rounded-xl active:scale-95 transition">Continue →</button>
                </div>
              </div>
            )}

            {onboardStep === 4 && (
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Partner Preferences</h2>
                <p className="text-gray-500 text-sm mb-5">Control how other businesses can partner with you.</p>
                <div className="space-y-3">
                  {[
                    { key: "auto_approve_partners" as const, label: "Auto-approve partners", desc: "Automatically accept partner invites" },
                    { key: "allow_katoomy_suggestions" as const, label: "Allow Katoomy suggestions", desc: "Let Katoomy suggest compatible partners" },
                  ].map(({ key, label, desc }) => (
                    <div key={key} className="flex items-center justify-between p-4 border border-gray-200 rounded-xl">
                      <div className="flex-1 mr-3">
                        <p className="font-medium text-gray-900 text-sm">{label}</p>
                        <p className="text-xs text-gray-500">{desc}</p>
                      </div>
                      <button type="button" onClick={() => setSettings(s => ({ ...s, [key]: !s[key] }))}
                        className={`w-11 h-6 rounded-full flex items-center px-1 transition flex-shrink-0 ${settings[key] ? "bg-purple-600 justify-end" : "bg-gray-300 justify-start"}`}>
                        <div className="w-4 h-4 bg-white rounded-full" />
                      </button>
                    </div>
                  ))}
                </div>
                {onboardError && <p className="mt-3 text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{onboardError}</p>}
                <div className="flex gap-3 mt-6">
                  <button onClick={() => setOnboardStep(3)} className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-600 font-medium active:scale-95 transition">← Back</button>
                  <button
                    disabled={saving}
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
                      if (result?.error) { setOnboardError(result.error); return; }
                      setOnboardStep(5);
                    }}
                    className="flex-1 py-3 bg-purple-600 text-white font-bold rounded-xl active:scale-95 transition disabled:opacity-40">
                    {saving ? "Saving..." : "Continue →"}
                  </button>
                </div>
              </div>
            )}

            {onboardStep === 5 && (
              <div className="text-center">
                <div className="text-5xl mb-4">🎉</div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">You&apos;re in the Network!</h2>
                <p className="text-gray-500 text-sm mb-6">Your offer is live. Invite local businesses to partner with you, or wait for them to find you.</p>
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-left mb-6 space-y-1.5">
                  {["Partner businesses can find and invite you", "Invite partners from the Partners tab", "Customers who book via a partner link get your offer", "You earn credits for every customer you send"].map(line => (
                    <p key={line} className="text-sm text-purple-700">✓ {line}</p>
                  ))}
                </div>
                <button onClick={finishOnboarding} className="w-full py-4 bg-purple-600 text-white font-bold rounded-2xl active:scale-95 transition">
                  Go to Network Dashboard →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── MAIN PORTAL ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="px-5 pt-12 pb-4 flex items-center justify-between" style={headerStyle}>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/admin/mobile/menu")} className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white text-lg">←</button>
          <div>
            <h1 className="text-xl font-bold text-white leading-tight">Business Network</h1>
            {pendingPartners.length > 0 && (
              <p className="text-white/80 text-xs">{pendingPartners.length} pending invite{pendingPartners.length > 1 ? "s" : ""}</p>
            )}
          </div>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-bold ${settings.enabled ? "bg-green-400/30 text-white" : "bg-white/20 text-white/70"}`}>
          {settings.enabled ? "● Active" : "○ Paused"}
        </div>
      </div>

      {/* Scrollable tab bar */}
      <div className="flex overflow-x-auto scrollbar-hide bg-white border-b border-gray-200 px-2">
        {(["overview", "offers", "partners", "broadcast", "settings"] as Tab[]).map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`flex-shrink-0 px-4 py-3 text-sm font-medium capitalize border-b-2 transition ${
              activeTab === t ? "border-purple-600 text-purple-700" : "border-transparent text-gray-500"
            }`}>
            {t}
            {t === "partners" && pendingPartners.length > 0 && (
              <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-1.5 py-px">{pendingPartners.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-4 py-5 pb-10 space-y-4">

        {/* ── OVERVIEW ──────────────────────────────────────────────────────── */}
        {activeTab === "overview" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Sent", value: overview?.customers_sent ?? 0, icon: "📤", color: "text-blue-600" },
                { label: "Received", value: overview?.direct_received ?? 0, icon: "📥", color: "text-green-600" },
                { label: "Offer Links", value: overview?.offer_link_received ?? 0, icon: "🔗", color: "text-purple-600" },
                { label: "Credits Earned", value: cents(overview?.referral_earnings_cents ?? 0), icon: "💰", color: "text-purple-600" },
                { label: "Total Credits", value: cents(overview?.total_credits_cents ?? 0), icon: "🏦", color: "text-indigo-600" },
                { label: "Completed", value: overview?.completed_received ?? 0, icon: "✅", color: "text-teal-600" },
              ].map(({ label, value, icon, color }) => (
                <div key={label} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                  <div className="text-2xl mb-2">{icon}</div>
                  <p className={`text-xl font-black ${color}`}>{value}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="font-bold text-gray-900">Referral Activity</p>
              </div>
              {activity.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">No activity yet</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {activity.map(item => (
                    <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${
                        item.direction === "sent" ? "bg-blue-100 text-blue-600" : "bg-green-100 text-green-600"
                      }`}>
                        {item.direction === "sent" ? "📤" : "📥"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {item.customer_name ?? item.customer_phone ?? "Unknown"}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {item.direction === "sent" ? `→ ${item.partner_name}` : `← ${item.partner_name}`}
                        </p>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          ["completed", "credited", "booked"].includes(item.status)
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        }`}>
                          {item.status}
                        </span>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(item.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ── OFFERS ────────────────────────────────────────────────────────── */}
        {activeTab === "offers" && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">{offers.length} offer{offers.length !== 1 ? "s" : ""}</p>
              <button onClick={() => setShowOfferForm(v => !v)}
                className="bg-purple-600 text-white text-sm font-bold px-4 py-2 rounded-xl active:scale-95 transition">
                {showOfferForm ? "Cancel" : "+ New Offer"}
              </button>
            </div>

            {showOfferForm && (
              <div className="bg-white rounded-2xl border border-purple-200 p-5 shadow-sm space-y-4">
                <p className="font-bold text-gray-900">New Offer</p>
                <div className="grid grid-cols-2 gap-2">
                  {(["dollar_off", "percent_off"] as const).map(t => (
                    <button key={t} type="button"
                      onClick={() => setOfferForm(f => ({ ...f, offer_type: t, amount: t === "dollar_off" ? 500 : 10 }))}
                      className={`py-2.5 rounded-xl border-2 text-sm font-medium transition ${offerForm.offer_type === t ? "border-purple-600 bg-purple-50 text-purple-700" : "border-gray-200 text-gray-500"}`}>
                      {t === "dollar_off" ? "$ Off" : "% Off"}
                    </button>
                  ))}
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">
                    {offerForm.offer_type === "dollar_off" ? "Amount ($)" : "Percent (%)"}
                  </label>
                  <input type="number" min={1}
                    value={offerForm.offer_type === "dollar_off" ? offerForm.amount / 100 : offerForm.amount}
                    onChange={e => {
                      const v = parseFloat(e.target.value) || 0;
                      setOfferForm(f => ({ ...f, amount: f.offer_type === "dollar_off" ? Math.round(v * 100) : v }));
                    }}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-purple-500 text-gray-900"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Title</label>
                  <input type="text" value={offerForm.title}
                    onChange={e => setOfferForm(f => ({ ...f, title: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-purple-500 text-gray-900"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Monthly budget ($, optional)</label>
                  <input type="number" min={0}
                    value={offerForm.budget_cents ? parseInt(offerForm.budget_cents) / 100 : ""}
                    onChange={e => setOfferForm(f => ({ ...f, budget_cents: e.target.value ? String(Math.round(parseFloat(e.target.value) * 100)) : "" }))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-purple-500 text-gray-900"
                    placeholder="100"
                  />
                </div>
                <button onClick={createOffer} disabled={saving || !offerForm.title}
                  className="w-full py-3 bg-purple-600 text-white font-bold rounded-xl active:scale-95 transition disabled:opacity-40">
                  {saving ? "Creating..." : "Create Offer"}
                </button>
              </div>
            )}

            {offers.length === 0 && !showOfferForm && (
              <div className="bg-white rounded-2xl p-8 text-center border border-gray-100">
                <p className="text-4xl mb-3">🎁</p>
                <p className="text-gray-500 text-sm">No offers yet. Create one so partners can send customers your way.</p>
              </div>
            )}

            {offers.map(offer => (
              <div key={offer.id} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 mr-3">
                    <p className="font-bold text-gray-900">{offer.title}</p>
                    <p className="text-sm text-purple-600 font-medium">{formatOffer(offer)}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium flex-shrink-0 ${offer.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {offer.active ? "Active" : "Paused"}
                  </span>
                </div>
                <div className="flex gap-4 text-sm text-gray-500 mb-4">
                  <span>{offer.used_count}x used</span>
                  <span>{cents(offer.total_cost_cents)} total</span>
                  <span>{offer.budget_cents ? cents(offer.budget_cents) + " cap" : "No cap"}</span>
                </div>
                <button onClick={() => toggleOffer(offer.id, !offer.active)}
                  className="w-full py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 font-medium active:scale-95 transition">
                  {offer.active ? "⏸ Pause" : "▶ Resume"}
                </button>
              </div>
            ))}
          </>
        )}

        {/* ── PARTNERS ──────────────────────────────────────────────────────── */}
        {activeTab === "partners" && (
          <>
            {/* Invite search */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <p className="text-sm font-bold text-gray-700 mb-3">Invite a Business</p>
              <div className="relative">
                <input type="text" value={partnerSearch}
                  onChange={e => setPartnerSearch(e.target.value)}
                  placeholder="Search by business name..."
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm pr-9 outline-none focus:ring-2 focus:ring-purple-500 text-gray-900"
                />
                {searchLoading && <div className="absolute right-3 top-3.5 w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />}
              </div>
              {searchResults.length > 0 && (
                <div className="mt-2 border border-gray-200 rounded-xl overflow-hidden">
                  {searchResults.map(b => (
                    <div key={b.id} className="flex items-center justify-between p-3 border-b border-gray-100 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{b.name}</p>
                        <p className="text-xs text-gray-400">katoomy.com/{b.slug}</p>
                      </div>
                      <button onClick={() => sendInvite(b.id)}
                        className="bg-purple-600 text-white text-xs px-3 py-1.5 rounded-lg font-bold active:scale-95 transition">
                        Invite
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pending invites */}
            {pendingPartners.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Pending Invites</p>
                {pendingPartners.map(p => (
                  <div key={p.id} className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 flex items-center justify-between mb-2">
                    <div>
                      <p className="font-bold text-gray-900 text-sm">{(p.partner as { name: string } | null)?.name ?? "Unknown"}</p>
                      <p className="text-xs text-yellow-700">Wants to partner with you</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => partnerAction(p.id, "accept")}
                        className="bg-green-600 text-white text-xs px-3 py-2 rounded-lg font-bold active:scale-95 transition">Accept</button>
                      <button onClick={() => partnerAction(p.id, "reject")}
                        className="border border-gray-300 text-gray-600 text-xs px-3 py-2 rounded-lg font-medium active:scale-95 transition">Reject</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Active partners */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                {partners.filter(p => p.status === "active").length} Active Partner{partners.filter(p => p.status === "active").length !== 1 ? "s" : ""}
              </p>
              {partners.filter(p => p.status !== "pending" || p.initiated_by === businessId).map(p => {
                const biz = p.partner as { name: string; slug: string } | null;
                return (
                  <div key={p.id} className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center justify-between mb-2 shadow-sm">
                    <div className="flex-1 min-w-0 mr-3">
                      <p className="font-bold text-gray-900 text-sm truncate">{biz?.name ?? "Unknown"}</p>
                      {biz?.slug && <p className="text-xs text-gray-400 truncate">katoomy.com/{biz.slug}</p>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                        p.status === "active" ? "bg-green-100 text-green-700" :
                        p.status === "pending" ? "bg-yellow-100 text-yellow-700" :
                        "bg-gray-100 text-gray-500"
                      }`}>
                        {p.status === "active" ? "✔ Active" : p.status === "pending" ? "⏳ Pending" : p.status}
                      </span>
                      {p.status === "active" && p.partner && (
                        <button
                          onClick={() => {
                            setReferModalPartner({ id: p.partner!.id, name: p.partner!.name, slug: p.partner!.slug });
                            setSelectedReferCustomer(null);
                            setReferCustomerSearch("");
                            setReferMessage("");
                            setReferSent(false);
                            setReferQrUrl(null);
                          }}
                          className="bg-purple-600 text-white text-xs px-2.5 py-1.5 rounded-lg font-bold active:scale-95 transition">
                          Refer
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              {partners.length === 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
                  <p className="text-3xl mb-3">🤝</p>
                  <p className="text-gray-500 text-sm">No partners yet. Search above to invite a local business.</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── BROADCAST ─────────────────────────────────────────────────────── */}
        {activeTab === "broadcast" && (
          <>
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <p className="font-bold text-gray-900 mb-1">Network Reach</p>
              <p className="text-xs text-gray-400 mb-3">Customers who opted in to marketing SMS across your active partners.</p>
              {!broadcastPreview ? (
                <div className="flex justify-center py-4"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600" /></div>
              ) : (
                <div className="flex gap-3">
                  <div className="bg-purple-50 rounded-xl p-3 text-center flex-1">
                    <p className="text-2xl font-black text-purple-700">{broadcastPreview.customerCount}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Customers</p>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-3 text-center flex-1">
                    <p className="text-2xl font-black text-blue-700">{broadcastPreview.partnerCount}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Partners</p>
                  </div>
                </div>
              )}
            </div>

            {broadcastResult ? (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
                <p className="font-bold text-green-800 mb-2">Broadcast sent!</p>
                <div className="flex gap-4 text-sm">
                  <span className="text-green-700">{broadcastResult.sent} sent</span>
                  {broadcastResult.failed > 0 && <span className="text-red-600">{broadcastResult.failed} failed</span>}
                  {broadcastResult.skipped > 0 && <span className="text-gray-500">{broadcastResult.skipped} skipped</span>}
                </div>
                <button onClick={() => setBroadcastResult(null)} className="text-xs text-green-600 underline mt-2">Compose another</button>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                <p className="font-bold text-gray-900 mb-1">Compose Message</p>
                <p className="text-xs text-gray-400 mb-3">Your name and booking link are added automatically.</p>
                <textarea
                  value={broadcastMessage}
                  onChange={e => setBroadcastMessage(e.target.value)}
                  rows={4}
                  maxLength={140}
                  placeholder={`e.g. "Spring special — 20% off all services this week!"`}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none outline-none focus:ring-2 focus:ring-purple-500 text-gray-900"
                />
                <p className={`text-xs text-right mt-1 mb-3 ${broadcastMessage.length >= 120 ? "text-orange-500" : "text-gray-400"}`}>
                  {broadcastMessage.length}/140
                </p>
                {broadcastMessage.trim() && (
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 mb-3">
                    <p className="text-xs text-gray-400 mb-1">Preview</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                      {broadcastMessage.trim()}{"\n\n"}{"— "}{businessSlug || "Your Business"} | Book: katoomy.com/{businessSlug}{"\n"}Reply STOP to opt out
                    </p>
                  </div>
                )}
                <button
                  onClick={sendBroadcast}
                  disabled={!broadcastMessage.trim() || broadcastSending || (broadcastPreview?.customerCount ?? 0) === 0}
                  className="w-full py-3 bg-purple-600 text-white font-bold rounded-xl active:scale-95 transition disabled:opacity-40">
                  {broadcastSending ? "Sending..." : `Send to ${broadcastPreview?.customerCount ?? 0} Customer${(broadcastPreview?.customerCount ?? 0) !== 1 ? "s" : ""}`}
                </button>
              </div>
            )}

            {broadcastHistory.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="font-bold text-gray-900">History</p>
                </div>
                <div className="divide-y divide-gray-100">
                  {broadcastHistory.map(b => (
                    <div key={b.id} className="px-4 py-3">
                      <div className="flex justify-between items-start mb-1">
                        <p className="text-sm text-gray-700 flex-1 mr-3 line-clamp-1">{b.message.split("\n")[0]}</p>
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
          </>
        )}

        {/* ── SETTINGS ──────────────────────────────────────────────────────── */}
        {activeTab === "settings" && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-5">
            {[
              { key: "enabled" as const, label: "Network enabled", desc: "Pause to temporarily stop accepting network customers" },
              { key: "auto_approve_partners" as const, label: "Auto-approve partners", desc: "Automatically accept incoming partner invites" },
              { key: "allow_katoomy_suggestions" as const, label: "Allow Katoomy suggestions", desc: "Let Katoomy suggest compatible partner businesses" },
            ].map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between pb-5 border-b border-gray-100 last:border-0 last:pb-0">
                <div className="flex-1 mr-4">
                  <p className="font-semibold text-gray-900 text-sm">{label}</p>
                  <p className="text-xs text-gray-500">{desc}</p>
                </div>
                <button type="button" onClick={() => setSettings(s => ({ ...s, [key]: !s[key] }))}
                  className={`w-11 h-6 rounded-full flex items-center px-1 transition flex-shrink-0 ${settings[key] ? "bg-purple-600 justify-end" : "bg-gray-300 justify-start"}`}>
                  <div className="w-4 h-4 bg-white rounded-full" />
                </button>
              </div>
            ))}

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Max monthly spend ($)</label>
                <input type="number" min={0} value={settings.max_monthly_spend_cents / 100}
                  onChange={e => setSettings(s => ({ ...s, max_monthly_spend_cents: Math.round((parseFloat(e.target.value) || 0) * 100) }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-purple-500 text-gray-900"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Referral credit per customer ($)</label>
                <input type="number" min={0} value={settings.referral_reward_cents / 100}
                  onChange={e => setSettings(s => ({ ...s, referral_reward_cents: Math.round((parseFloat(e.target.value) || 0) * 100) }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-purple-500 text-gray-900"
                />
              </div>
            </div>

            <button onClick={() => saveSettings({
              enabled: settings.enabled,
              auto_approve_partners: settings.auto_approve_partners,
              allow_katoomy_suggestions: settings.allow_katoomy_suggestions,
              max_monthly_spend_cents: settings.max_monthly_spend_cents,
              referral_reward_cents: settings.referral_reward_cents,
            })} disabled={saving}
              className="w-full py-4 bg-purple-600 text-white font-bold rounded-xl active:scale-95 transition disabled:opacity-40">
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        )}
      </div>

      {/* ── REFER CUSTOMER MODAL ──────────────────────────────────────────────── */}
      {referModalPartner && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50">
          <div className="bg-white rounded-t-3xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
              <div>
                <p className="font-bold text-gray-900">Refer a Customer</p>
                <p className="text-xs text-gray-500">→ <span className="font-medium">{referModalPartner.name}</span></p>
              </div>
              <button onClick={() => { setReferModalPartner(null); setReferQrUrl(null); setReferSent(false); setSelectedReferCustomer(null); setReferCustomerSearch(""); setReferMessage(""); }}
                className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 text-xl leading-none active:bg-gray-200">×</button>
            </div>

            {referSent ? (
              <div className="py-12 text-center">
                <p className="text-5xl mb-3">✅</p>
                <p className="font-bold text-gray-900 text-lg">Referral sent!</p>
                <p className="text-sm text-gray-500 mt-1 px-6">
                  {referSentMode === "sms-qr"
                    ? "Your customer received a QR code via SMS."
                    : "Your customer received an SMS with the booking link."}
                </p>
              </div>
            ) : (
              <div className="p-5 space-y-4 overflow-y-auto flex-1">
                {!selectedReferCustomer ? (
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Search your customers</label>
                    <div className="relative">
                      <input type="text" value={referCustomerSearch}
                        onChange={e => setReferCustomerSearch(e.target.value)}
                        placeholder="Name or phone..."
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm pr-9 outline-none focus:ring-2 focus:ring-purple-500 text-gray-900"
                      />
                      {referCustomerSearchLoading && <div className="absolute right-3 top-3.5 w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />}
                    </div>
                    {referCustomerResults.length > 0 && (
                      <div className="mt-2 border border-gray-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                        {referCustomerResults.map(c => (
                          <button key={c.id}
                            onClick={() => { setSelectedReferCustomer(c); setReferCustomerSearch(""); setReferCustomerResults([]); }}
                            className="w-full flex items-center justify-between p-3 hover:bg-purple-50 active:bg-purple-50 border-b border-gray-100 last:border-0 text-left">
                            <div>
                              <p className="text-sm font-medium text-gray-900">{c.full_name}</p>
                              <p className="text-xs text-gray-400">{c.phone}</p>
                            </div>
                            <span className="text-xs text-purple-600 font-medium">Select</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between bg-purple-50 rounded-xl px-4 py-3">
                    <div>
                      <p className="text-sm font-bold text-gray-900">{selectedReferCustomer.full_name}</p>
                      <p className="text-xs text-gray-500">{selectedReferCustomer.phone}</p>
                    </div>
                    <button onClick={() => setSelectedReferCustomer(null)} className="text-xs text-gray-400 hover:text-gray-600">Change</button>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">
                    Personal message <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <textarea value={referMessage} onChange={e => setReferMessage(e.target.value)}
                    placeholder={`e.g. "I think you'd love ${referModalPartner.name}!"`}
                    rows={2}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none outline-none focus:ring-2 focus:ring-purple-500 text-gray-900"
                  />
                </div>

                {referQrUrl ? (
                  <div className="flex flex-col items-center gap-4 py-2">
                    <p className="text-sm font-semibold text-gray-700 text-center">
                      Screenshot and send to {selectedReferCustomer?.full_name?.split(" ")[0] ?? "the customer"}
                    </p>
                    <div className="bg-white p-4 rounded-2xl border-2 border-purple-200 shadow-sm">
                      <QRCodeSVG value={referQrUrl} size={180} includeMargin />
                    </div>
                    <button onClick={() => setReferQrUrl(null)} className="text-sm text-purple-600 underline">← Back</button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <button onClick={() => sendReferral("sms")} disabled={!selectedReferCustomer || referSending}
                      className="w-full py-4 bg-purple-600 text-white font-bold rounded-xl active:scale-95 transition disabled:opacity-40">
                      {referSending ? "Sending..." : "Send Link via SMS"}
                    </button>
                    <button onClick={() => sendReferral("sms-qr")} disabled={!selectedReferCustomer || referSending}
                      className="w-full py-4 bg-indigo-600 text-white font-bold rounded-xl active:scale-95 transition disabled:opacity-40">
                      {referSending ? "Sending..." : "Send QR Code via SMS"}
                    </button>
                    <button onClick={() => sendReferral("qr")} disabled={!selectedReferCustomer || referSending}
                      className="w-full py-4 bg-gray-800 text-white font-bold rounded-xl active:scale-95 transition disabled:opacity-40">
                      {referSending ? "Generating..." : "Show QR Code On Screen"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
