"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

interface Customer {
  id: string;
  full_name: string | null;
  phone: string;
  email: string | null;
}

interface SendResult {
  phone: string;
  name: string | null;
  success: boolean;
  error?: string;
}

interface NotificationSettings {
  channels: string[];
}

interface MessageRecord {
  id: string;
  to_number: string;
  body: string;
  status: string;
  error_code: number | null;
  delivered_at: string | null;
  created_at: string;
}

interface BlockedNumber {
  normalized_phone: string;
  failure_count: number;
  last_failure_at: string | null;
  last_error_code: number | null;
  customerName?: string | null;
}

type MessageType = "all" | "upcoming" | "at_risk" | "vip" | "members" | "new_customers" | "no_bookings" | "test";

const AUDIENCE_OPTIONS: { value: MessageType; label: string; description: string }[] = [
  { value: "all",           label: "All Customers",         description: "Every customer with a phone number" },
  { value: "upcoming",      label: "Upcoming Appointments", description: "Appointments in the next 5 days" },
  { value: "at_risk",       label: "At-Risk Customers",     description: "No visit in 30+ days and no upcoming appointment" },
  { value: "vip",           label: "VIP Customers",         description: "Top 20% by total spend, active in the last 2 months" },
  { value: "members",       label: "Members",               description: "Customers with an active membership" },
  { value: "new_customers", label: "New Customers",         description: "First booking within the last 14 days" },
  { value: "no_bookings",   label: "No Current Bookings",   description: "No active upcoming appointment on the books" },
  { value: "test",          label: "Test",                  description: "3 test numbers for messaging tests" },
];

const TEST_CUSTOMERS: Customer[] = [
  { id: "test-1", full_name: "Test 1", phone: "+16786093826", email: null },
  { id: "test-2", full_name: "Test 2", phone: "+14049601553", email: null },
  { id: "test-3", full_name: "Test 3", phone: "+14046425637", email: null },
];

const STATUS_STYLES: Record<string, string> = {
  delivered:   "bg-green-100 text-green-800",
  sent:        "bg-blue-100 text-blue-800",
  queued:      "bg-gray-100 text-gray-700",
  accepted:    "bg-gray-100 text-gray-700",
  sending:     "bg-gray-100 text-gray-700",
  undelivered: "bg-orange-100 text-orange-800",
  failed:      "bg-red-100 text-red-800",
};

function darkenHex(hex: string, amount = 40): string {
  const clean = hex.replace("#", "");
  const num = parseInt(clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean, 16);
  const r = Math.max(0, (num >> 16) - amount);
  const g = Math.max(0, ((num >> 8) & 0xff) - amount);
  const b = Math.max(0, (num & 0xff) - amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

export default function MobileMessagesPage() {
  const [activeTab, setActiveTab] = useState<"send" | "stats">("send");

  // Send tab state
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [messageType, setMessageType] = useState<MessageType>("all");
  const [loading, setLoading] = useState(true);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [brandColor, setBrandColor] = useState("#3B82F6");
  const [sendProgress, setSendProgress] = useState<{ current: number; total: number } | null>(null);
  const [sendResults, setSendResults] = useState<SendResult[]>([]);
  const [settings, setSettings] = useState<NotificationSettings>({ channels: ["email", "sms"] });
  const [resolvedAudience, setResolvedAudience] = useState<Customer[]>([]);
  const [audienceLoading, setAudienceLoading] = useState(false);

  // Stats tab state
  const [statsLoading, setStatsLoading] = useState(false);
  const [recentMessages, setRecentMessages] = useState<MessageRecord[]>([]);
  const [blockedNumbers, setBlockedNumbers] = useState<BlockedNumber[]>([]);
  const [statsSummary, setStatsSummary] = useState({ delivered: 0, sent: 0, failed: 0, undelivered: 0, total: 0 });
  const [unblocking, setUnblocking] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    const result = await supabase.auth.getUser();
    const user = result.data.user;
    if (!user) return;

    const bizResult = await supabase
      .from("businesses")
      .select("id, primary_color")
      .eq("owner_user_id", user.id)
      .single();

    if (bizResult.data) {
      setBusinessId(bizResult.data.id);
      if (bizResult.data.primary_color) setBrandColor(bizResult.data.primary_color);
      const { data: notifData } = await supabase
        .from("notification_settings")
        .select("*")
        .eq("business_id", bizResult.data.id)
        .single();
      if (notifData) setSettings(notifData as NotificationSettings);
    }
    setLoading(false);
  };

  const resolveAudience = useCallback(async (type: MessageType, bizId: string): Promise<Customer[]> => {
    const now = new Date();

    if (type === "test") return TEST_CUSTOMERS;

    if (type === "all") {
      const { data } = await supabase
        .from("customers")
        .select("id, full_name, phone, email")
        .eq("business_id", bizId)
        .not("phone", "is", null);
      return (data as Customer[]) || [];
    }

    if (type === "upcoming") {
      const fiveDays = new Date();
      fiveDays.setDate(fiveDays.getDate() + 5);
      const { data: bookings } = await supabase
        .from("bookings")
        .select("customer_id, customers(id, full_name, phone, email)")
        .eq("business_id", bizId)
        .gte("start_ts", now.toISOString())
        .lte("start_ts", fiveDays.toISOString())
        .in("status", ["confirmed", "requested"]);
      const map = new Map<string, Customer>();
      (bookings || []).forEach((b: { customer_id: string; customers: Customer | Customer[] }) => {
        const c = Array.isArray(b.customers) ? b.customers[0] : b.customers;
        if (c?.phone) map.set(b.customer_id, c);
      });
      return Array.from(map.values());
    }

    if (type === "at_risk") {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { data: futureBookings } = await supabase
        .from("bookings")
        .select("customer_id")
        .eq("business_id", bizId)
        .gt("start_ts", now.toISOString())
        .in("status", ["confirmed", "requested"]);
      const hasUpcoming = new Set((futureBookings || []).map((b: { customer_id: string }) => b.customer_id));
      const { data: recentBookings } = await supabase
        .from("bookings")
        .select("customer_id")
        .eq("business_id", bizId)
        .gte("start_ts", thirtyDaysAgo.toISOString())
        .lte("start_ts", now.toISOString());
      const hasRecent = new Set((recentBookings || []).map((b: { customer_id: string }) => b.customer_id));
      const { data: all } = await supabase
        .from("customers")
        .select("id, full_name, phone, email")
        .eq("business_id", bizId)
        .not("phone", "is", null);
      return ((all as Customer[]) || []).filter(c => !hasUpcoming.has(c.id) && !hasRecent.has(c.id));
    }

    if (type === "vip") {
      const twoMonthsAgo = new Date();
      twoMonthsAgo.setDate(twoMonthsAgo.getDate() - 60);
      const { data: bookings } = await supabase
        .from("bookings")
        .select("customer_id, total_price_cents, start_ts, customers(id, full_name, phone, email)")
        .eq("business_id", bizId)
        .eq("status", "completed");
      const spendMap = new Map<string, { customer: Customer; totalSpend: number; lastBooking: Date }>();
      (bookings || []).forEach((b: { customer_id: string; total_price_cents: number; start_ts: string; customers: Customer | Customer[] }) => {
        const c = Array.isArray(b.customers) ? b.customers[0] : b.customers;
        if (!c?.phone) return;
        const date = new Date(b.start_ts);
        const ex = spendMap.get(b.customer_id);
        if (!ex) {
          spendMap.set(b.customer_id, { customer: c, totalSpend: b.total_price_cents || 0, lastBooking: date });
        } else {
          ex.totalSpend += b.total_price_cents || 0;
          if (date > ex.lastBooking) ex.lastBooking = date;
        }
      });
      const active = Array.from(spendMap.values()).filter(v => v.lastBooking >= twoMonthsAgo);
      active.sort((a, b) => b.totalSpend - a.totalSpend);
      return active.slice(0, Math.max(1, Math.ceil(active.length * 0.2))).map(v => v.customer);
    }

    if (type === "members") {
      const { data: subs } = await supabase
        .from("member_subscriptions")
        .select("customer_id, customers(id, full_name, phone, email)")
        .eq("business_id", bizId)
        .eq("status", "active");
      const map = new Map<string, Customer>();
      (subs || []).forEach((s: { customer_id: string; customers: Customer | Customer[] }) => {
        const c = Array.isArray(s.customers) ? s.customers[0] : s.customers;
        if (c?.phone) map.set(s.customer_id, c);
      });
      return Array.from(map.values());
    }

    if (type === "new_customers") {
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
      const { data: bookings } = await supabase
        .from("bookings")
        .select("customer_id, start_ts, customers(id, full_name, phone, email)")
        .eq("business_id", bizId)
        .order("start_ts", { ascending: true });
      const firstMap = new Map<string, { customer: Customer; firstBooking: Date }>();
      (bookings || []).forEach((b: { customer_id: string; start_ts: string; customers: Customer | Customer[] }) => {
        const c = Array.isArray(b.customers) ? b.customers[0] : b.customers;
        if (!c?.phone || firstMap.has(b.customer_id)) return;
        firstMap.set(b.customer_id, { customer: c, firstBooking: new Date(b.start_ts) });
      });
      return Array.from(firstMap.values())
        .filter(v => v.firstBooking >= fourteenDaysAgo)
        .map(v => v.customer);
    }

    if (type === "no_bookings") {
      const { data: futureBookings } = await supabase
        .from("bookings")
        .select("customer_id")
        .eq("business_id", bizId)
        .gt("start_ts", now.toISOString())
        .in("status", ["confirmed", "requested"]);
      const hasUpcoming = new Set((futureBookings || []).map((b: { customer_id: string }) => b.customer_id));
      const { data: all } = await supabase
        .from("customers")
        .select("id, full_name, phone, email")
        .eq("business_id", bizId)
        .not("phone", "is", null);
      return ((all as Customer[]) || []).filter(c => !hasUpcoming.has(c.id));
    }

    return [];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!businessId) return;
    setAudienceLoading(true);
    resolveAudience(messageType, businessId).then(customers => {
      setResolvedAudience(customers);
      setAudienceLoading(false);
    });
  }, [messageType, businessId, resolveAudience]);

  // Load stats when switching to stats tab
  const loadStats = useCallback(async () => {
    if (!businessId) return;
    setStatsLoading(true);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [{ data: messages }, { data: blocked }] = await Promise.all([
      supabase
        .from("sms_messages")
        .select("id, to_number, body, status, error_code, delivered_at, created_at")
        .eq("business_id", businessId)
        .eq("direction", "outbound")
        .gte("created_at", sevenDaysAgo.toISOString())
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("phone_health")
        .select("normalized_phone, failure_count, last_failure_at, last_error_code")
        .eq("send_blocked", true)
        .order("last_failure_at", { ascending: false }),
    ]);

    const msgs = (messages as MessageRecord[]) || [];
    setRecentMessages(msgs);

    const summary = { delivered: 0, sent: 0, failed: 0, undelivered: 0, total: msgs.length };
    msgs.forEach(m => {
      if (m.status === "delivered") summary.delivered++;
      else if (m.status === "sent") summary.sent++;
      else if (m.status === "failed") summary.failed++;
      else if (m.status === "undelivered") summary.undelivered++;
    });
    setStatsSummary(summary);

    const blockedList = (blocked as BlockedNumber[]) || [];
    if (blockedList.length > 0) {
      const phones = blockedList.map(b => b.normalized_phone);
      const { data: customers } = await supabase
        .from("customers")
        .select("phone, full_name")
        .eq("business_id", businessId)
        .in("phone", phones);
      const nameMap = new Map(
        (customers || []).map((c: { phone: string; full_name: string | null }) => [c.phone, c.full_name])
      );
      setBlockedNumbers(blockedList.map(b => ({ ...b, customerName: (nameMap.get(b.normalized_phone) as string | null) ?? null })));
    } else {
      setBlockedNumbers([]);
    }

    setStatsLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  useEffect(() => {
    if (activeTab === "stats" && businessId) loadStats();
  }, [activeTab, businessId, loadStats]);

  const handleUnblock = async (phone: string) => {
    setUnblocking(phone);
    await fetch("/api/admin/unblock-phone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ normalized_phone: phone }),
    });
    setUnblocking(null);
    loadStats();
  };

  const handleSend = async () => {
    if (!message.trim()) { alert("Please enter a message"); return; }
    if (!businessId) { alert("Business ID not found"); return; }
    if (!settings.channels.includes("sms")) {
      alert("SMS channel is not enabled. Please enable it in settings first.");
      return;
    }
    if (resolvedAudience.length === 0) { alert("No customers found for this audience"); return; }

    setSending(true);
    setSendProgress(null);
    setSendResults([]);
    const results: SendResult[] = [];
    setSendProgress({ current: 0, total: resolvedAudience.length });

    for (let i = 0; i < resolvedAudience.length; i++) {
      const customer = resolvedAudience[i];
      try {
        const response = await fetch("/api/sms/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to: customer.phone, body: message, business_id: businessId, customer_id: customer.id }),
        });
        const data = await response.json();
        results.push({
          phone: customer.phone,
          name: customer.full_name,
          success: response.ok && !data.skipped,
          error: data.skipped ? `Skipped: ${data.reason}` : (response.ok ? undefined : (data.error || "Unknown error")),
        });
      } catch (error) {
        results.push({
          phone: customer.phone,
          name: customer.full_name,
          success: false,
          error: error instanceof Error ? error.message : "Network error",
        });
      }
      setSendProgress({ current: i + 1, total: resolvedAudience.length });
      setSendResults([...results]);
    }

    const successCount = results.filter(r => r.success).length;
    const skippedCount = results.filter(r => !r.success && r.error?.startsWith("Skipped")).length;
    const failCount = results.filter(r => !r.success && !r.error?.startsWith("Skipped")).length;
    let summary = `Messages sent!\n\nDelivered to carrier: ${successCount}`;
    if (skippedCount > 0) summary += `\nSkipped (blocked numbers): ${skippedCount}`;
    if (failCount > 0) summary += `\nFailed: ${failCount}`;
    alert(summary);
    if (successCount > 0) setMessage("");
    setSending(false);
    setSendProgress(null);
  };

  const templates = [
    "Special offer: 20% off your next service! Book now.",
    "We have a last-minute opening tomorrow. Interested?",
    "Thank you for your business! We appreciate you.",
  ];

  const selectedOption = AUDIENCE_OPTIONS.find(o => o.value === messageType)!;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="text-white p-6 sticky top-0 z-10" style={{ background: `linear-gradient(to right, ${brandColor}, ${darkenHex(brandColor)})` }}>
        <Link href="/admin/mobile/menu" className="inline-flex items-center text-white mb-4">
          <span className="text-2xl mr-2">←</span>
          <span className="font-medium">Back to Menu</span>
        </Link>
        <h1 className="text-2xl font-bold">Messages</h1>
        <p className="text-white/70 mt-1">Send SMS to customers</p>
      </div>

      {/* Tab Switcher */}
      <div className="flex border-b border-gray-200 bg-white sticky top-[116px] z-10">
        <button
          onClick={() => setActiveTab("send")}
          className={`flex-1 py-3 text-sm font-semibold transition ${
            activeTab === "send"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-500"
          }`}
        >
          Send Message
        </button>
        <button
          onClick={() => setActiveTab("stats")}
          className={`flex-1 py-3 text-sm font-semibold transition ${
            activeTab === "stats"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-500"
          }`}
        >
          Delivery Stats
        </button>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : activeTab === "send" ? (
          <>
            {!settings.channels.includes("sms") && (
              <div className="bg-yellow-50 border-2 border-yellow-300 rounded-2xl p-4 mb-4">
                <p className="text-sm font-semibold text-yellow-800">⚠️ SMS is disabled</p>
                <p className="text-xs text-yellow-700 mt-1">Enable SMS in notification settings to send messages.</p>
              </div>
            )}

            {/* Audience Selector */}
            <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
              <label className="block text-sm font-bold text-gray-900 mb-2">Send To</label>
              <select
                value={messageType}
                onChange={e => setMessageType(e.target.value as MessageType)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl bg-white text-gray-900 font-semibold focus:outline-none focus:border-blue-500 text-base"
              >
                {AUDIENCE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <div className="mt-2 flex items-center justify-between">
                <p className="text-xs text-gray-500">{selectedOption.description}</p>
                <span className="text-xs font-bold text-blue-600 ml-3 whitespace-nowrap">
                  {audienceLoading ? "..." : `${resolvedAudience.length} recipient${resolvedAudience.length !== 1 ? "s" : ""}`}
                </span>
              </div>
            </div>

            {/* Message Input */}
            <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
              <label className="block text-sm font-bold text-gray-900 mb-3">Message</label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Type your message..."
                rows={5}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 text-base text-gray-900"
              />
              <p className="text-sm text-gray-500 mt-2">{message.length} characters</p>
            </div>

            {/* Send Progress */}
            {sendProgress && (
              <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-blue-900">Sending...</span>
                  <span className="text-sm text-blue-700">{sendProgress.current} / {sendProgress.total}</span>
                </div>
                <div className="w-full bg-blue-200 rounded-full h-3">
                  <div
                    className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${(sendProgress.current / sendProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Send Results */}
            {sendResults.length > 0 && !sendProgress && (
              <div className="bg-white rounded-2xl p-5 shadow-sm mb-4 max-h-80 overflow-y-auto">
                <h3 className="text-sm font-bold text-gray-900 mb-3">Results</h3>
                <div className="space-y-2">
                  {sendResults.map((result, index) => (
                    <div key={index} className={`p-3 rounded-xl ${result.success ? "bg-green-50 border-2 border-green-200" : result.error?.startsWith("Skipped") ? "bg-yellow-50 border-2 border-yellow-200" : "bg-red-50 border-2 border-red-200"}`}>
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">{result.success ? "✓" : result.error?.startsWith("Skipped") ? "⊘" : "✗"}</span>
                        <span className={`text-sm font-bold ${result.success ? "text-green-900" : result.error?.startsWith("Skipped") ? "text-yellow-900" : "text-red-900"}`}>{result.name || "Unknown"}</span>
                      </div>
                      <p className={`text-xs mt-1 ${result.success ? "text-green-700" : result.error?.startsWith("Skipped") ? "text-yellow-700" : "text-red-700"}`}>{result.phone}</p>
                      {!result.success && result.error && <p className="text-xs mt-1 opacity-75">{result.error}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Templates */}
            <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
              <label className="block text-sm font-bold text-gray-900 mb-3">Quick Templates</label>
              <div className="space-y-2">
                {templates.map((template, index) => (
                  <button key={index} onClick={() => setMessage(template)} className="w-full text-left p-3 bg-gray-50 rounded-xl text-sm active:bg-gray-100 text-gray-900">
                    {template}
                  </button>
                ))}
              </div>
            </div>

            {/* Send Button */}
            <button
              onClick={handleSend}
              disabled={sending || !message.trim() || audienceLoading || resolvedAudience.length === 0}
              className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold text-lg disabled:opacity-50 active:scale-95 transition shadow-lg"
            >
              {sending ? "Sending..." : `Send to ${resolvedAudience.length} Recipient${resolvedAudience.length !== 1 ? "s" : ""}`}
            </button>
          </>
        ) : (
          /* ── STATS TAB ── */
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs text-gray-500">Last 7 days</p>
              <button
                onClick={loadStats}
                disabled={statsLoading}
                className="text-xs text-blue-600 font-semibold disabled:opacity-50"
              >
                {statsLoading ? "Loading..." : "Refresh"}
              </button>
            </div>

            {statsLoading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-white rounded-2xl p-4 shadow-sm text-center">
                    <p className="text-3xl font-bold text-green-600">{statsSummary.delivered}</p>
                    <p className="text-xs text-gray-500 mt-1">Delivered</p>
                  </div>
                  <div className="bg-white rounded-2xl p-4 shadow-sm text-center">
                    <p className="text-3xl font-bold text-blue-600">{statsSummary.sent}</p>
                    <p className="text-xs text-gray-500 mt-1">In Transit</p>
                  </div>
                  <div className="bg-white rounded-2xl p-4 shadow-sm text-center">
                    <p className="text-3xl font-bold text-orange-500">{statsSummary.undelivered}</p>
                    <p className="text-xs text-gray-500 mt-1">Undelivered</p>
                  </div>
                  <div className="bg-white rounded-2xl p-4 shadow-sm text-center">
                    <p className="text-3xl font-bold text-red-600">{statsSummary.failed}</p>
                    <p className="text-xs text-gray-500 mt-1">Failed</p>
                  </div>
                </div>

                {/* Delivery rate */}
                {statsSummary.total > 0 && (
                  <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
                    <div className="flex justify-between items-center mb-2">
                      <p className="text-sm font-bold text-gray-900">Delivery Rate</p>
                      <p className="text-sm font-bold text-green-600">
                        {Math.round((statsSummary.delivered / statsSummary.total) * 100)}%
                      </p>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full"
                        style={{ width: `${(statsSummary.delivered / statsSummary.total) * 100}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{statsSummary.total} messages sent</p>
                  </div>
                )}

                {/* Blocked Numbers */}
                {blockedNumbers.length > 0 && (
                  <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
                    <h3 className="text-sm font-bold text-red-700 mb-3">
                      Blocked Numbers ({blockedNumbers.length})
                    </h3>
                    <p className="text-xs text-gray-500 mb-3">These numbers will be skipped on future sends due to repeated delivery failures.</p>
                    <div className="space-y-3">
                      {blockedNumbers.map(b => (
                        <div key={b.normalized_phone} className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">
                              {b.customerName || b.normalized_phone}
                            </p>
                            {b.customerName && <p className="text-xs text-gray-500">{b.normalized_phone}</p>}
                            <p className="text-xs text-red-600 mt-0.5">
                              {b.failure_count} failure{b.failure_count !== 1 ? "s" : ""}
                              {b.last_failure_at && ` · ${new Date(b.last_failure_at).toLocaleDateString()}`}
                            </p>
                          </div>
                          <button
                            onClick={() => handleUnblock(b.normalized_phone)}
                            disabled={unblocking === b.normalized_phone}
                            className="flex-shrink-0 px-3 py-1.5 text-xs font-semibold bg-gray-100 text-gray-700 rounded-lg disabled:opacity-50 active:bg-gray-200"
                          >
                            {unblocking === b.normalized_phone ? "..." : "Unblock"}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent Messages */}
                <div className="bg-white rounded-2xl p-5 shadow-sm">
                  <h3 className="text-sm font-bold text-gray-900 mb-3">
                    Recent Messages {recentMessages.length > 0 && `(${recentMessages.length})`}
                  </h3>
                  {recentMessages.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">No messages sent in the last 7 days</p>
                  ) : (
                    <div className="space-y-3">
                      {recentMessages.map(msg => (
                        <div key={msg.id} className="border-b border-gray-100 last:border-0 pb-3 last:pb-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-gray-700">{msg.to_number}</p>
                              <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{msg.body}</p>
                            </div>
                            <span className={`flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLES[msg.status] || "bg-gray-100 text-gray-600"}`}>
                              {msg.status}
                            </span>
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <p className="text-xs text-gray-400">
                              {new Date(msg.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                            </p>
                            {msg.error_code && (
                              <p className="text-xs text-red-500">Error {msg.error_code}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
