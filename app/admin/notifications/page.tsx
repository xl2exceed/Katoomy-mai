// file: app/admin/notifications/page.tsx

"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import Pagination from "@/components/Pagination";

interface NotificationSettings {
  booking_confirmations: boolean;
  appointment_reminders: boolean;
  cancellation_notices: boolean;
  promotions: boolean;
  loyalty_updates: boolean;
  channels: string[];
}

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

interface NotificationRule {
  id: string;
  business_id: string;
  kind: "appointment_reminder" | "winback";
  enabled: boolean;
  offset_minutes: number | null;
  inactive_days: number | null;
  template: string;
}

export default function NotificationsPage() {
  const [settings, setSettings] = useState<NotificationSettings>({
    booking_confirmations: true,
    appointment_reminders: true,
    cancellation_notices: true,
    promotions: false,
    loyalty_updates: true,
    channels: ["email", "sms"],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);

  const [businessId, setBusinessId] = useState<string | null>(null);
  const [sendProgress, setSendProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [sendResults, setSendResults] = useState<SendResult[]>([]);
  const [resultsPage, setResultsPage] = useState(1);
  const [resultsPerPage, setResultsPerPage] = useState(20);
  const [audiencePage, setAudiencePage] = useState(1);
  const [audiencePerPage, setAudiencePerPage] = useState(20);

  // Manual message state
  const [messageType, setMessageType] = useState<MessageType>("all");
  const [messageText, setMessageText] = useState("");
  const [resolvedAudience, setResolvedAudience] = useState<Customer[]>([]);
  const [audienceLoading, setAudienceLoading] = useState(false);

  // Automated message state
  const [automatedMessages, setAutomatedMessages] = useState({
    reminder_enabled: false,
    reminder_hours_before: 24,
    reminder_message: "Reminder: You have an appointment tomorrow at {time}",
    winback_enabled: false,
    winback_days_inactive: 30,
    winback_message: "We miss you! Book your next appointment and get 10% off",
  });

  const supabase = createClient();

  useEffect(() => {
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSettings = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: business } = await supabase
      .from("businesses")
      .select("id")
      .eq("owner_user_id", user.id)
      .single();

    if (business) {
      setBusinessId(business.id);

      // Load notification settings
      const { data: notifData } = await supabase
        .from("notification_settings")
        .select("*")
        .eq("business_id", business.id)
        .single();

      if (notifData) {
        setSettings(notifData as NotificationSettings);
      }

      // Load automated message settings from notification_rules
      const { data: rules } = await supabase
        .from("notification_rules")
        .select("*")
        .eq("business_id", business.id)
        .order("created_at", { ascending: false }); // Get most recent first

      if (rules && rules.length > 0) {
        // Find reminder rule (most recent)
        const reminderRule = rules.find(
          (r: NotificationRule) => r.kind === "appointment_reminder",
        );
        if (reminderRule) {
          setAutomatedMessages((prev) => ({
            ...prev,
            reminder_enabled: reminderRule.enabled,
            reminder_hours_before: Math.floor(
              reminderRule.offset_minutes! / 60,
            ),
            reminder_message: reminderRule.template,
          }));
        }

        // Find winback rule (most recent)
        const winbackRule = rules.find(
          (r: NotificationRule) => r.kind === "winback",
        );
        if (winbackRule) {
          setAutomatedMessages((prev) => ({
            ...prev,
            winback_enabled: winbackRule.enabled,
            winback_days_inactive: winbackRule.inactive_days,
            winback_message: winbackRule.template,
          }));
        }
      }
    }

    setLoading(false);
  };

  const resolveAudience = useCallback(async (type: MessageType, bizId: string): Promise<Customer[]> => {
    const now = new Date();

    if (type === "test") return TEST_CUSTOMERS;

    if (type === "all") {
      const { data } = await supabase.from("customers").select("id, full_name, phone, email").eq("business_id", bizId).not("phone", "is", null);
      return (data as Customer[]) || [];
    }

    if (type === "upcoming") {
      const fiveDays = new Date(); fiveDays.setDate(fiveDays.getDate() + 5);
      const { data: bookings } = await supabase.from("bookings").select("customer_id, customers(id, full_name, phone, email)").eq("business_id", bizId).gte("start_ts", now.toISOString()).lte("start_ts", fiveDays.toISOString()).in("status", ["confirmed", "requested"]);
      const map = new Map<string, Customer>();
      (bookings || []).forEach((b: { customer_id: string; customers: Customer | Customer[] }) => { const c = Array.isArray(b.customers) ? b.customers[0] : b.customers; if (c?.phone) map.set(b.customer_id, c); });
      return Array.from(map.values());
    }

    if (type === "at_risk") {
      const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { data: futureBookings } = await supabase.from("bookings").select("customer_id").eq("business_id", bizId).gt("start_ts", now.toISOString()).in("status", ["confirmed", "requested"]);
      const hasUpcoming = new Set((futureBookings || []).map((b: { customer_id: string }) => b.customer_id));
      const { data: recentBookings } = await supabase.from("bookings").select("customer_id").eq("business_id", bizId).gte("start_ts", thirtyDaysAgo.toISOString()).lte("start_ts", now.toISOString());
      const hasRecent = new Set((recentBookings || []).map((b: { customer_id: string }) => b.customer_id));
      const { data: all } = await supabase.from("customers").select("id, full_name, phone, email").eq("business_id", bizId).not("phone", "is", null);
      return ((all as Customer[]) || []).filter(c => !hasUpcoming.has(c.id) && !hasRecent.has(c.id));
    }

    if (type === "vip") {
      const twoMonthsAgo = new Date(); twoMonthsAgo.setDate(twoMonthsAgo.getDate() - 60);
      const { data: bookings } = await supabase.from("bookings").select("customer_id, total_price_cents, start_ts, customers(id, full_name, phone, email)").eq("business_id", bizId).eq("status", "completed");
      const spendMap = new Map<string, { customer: Customer; totalSpend: number; lastBooking: Date }>();
      (bookings || []).forEach((b: { customer_id: string; total_price_cents: number; start_ts: string; customers: Customer | Customer[] }) => {
        const c = Array.isArray(b.customers) ? b.customers[0] : b.customers;
        if (!c?.phone) return;
        const date = new Date(b.start_ts);
        const ex = spendMap.get(b.customer_id);
        if (!ex) { spendMap.set(b.customer_id, { customer: c, totalSpend: b.total_price_cents || 0, lastBooking: date }); }
        else { ex.totalSpend += b.total_price_cents || 0; if (date > ex.lastBooking) ex.lastBooking = date; }
      });
      const active = Array.from(spendMap.values()).filter(v => v.lastBooking >= twoMonthsAgo);
      active.sort((a, b) => b.totalSpend - a.totalSpend);
      return active.slice(0, Math.max(1, Math.ceil(active.length * 0.2))).map(v => v.customer);
    }

    if (type === "members") {
      const { data: subs } = await supabase.from("member_subscriptions").select("customer_id, customers(id, full_name, phone, email)").eq("business_id", bizId).eq("status", "active");
      const map = new Map<string, Customer>();
      (subs || []).forEach((s: { customer_id: string; customers: Customer | Customer[] }) => { const c = Array.isArray(s.customers) ? s.customers[0] : s.customers; if (c?.phone) map.set(s.customer_id, c); });
      return Array.from(map.values());
    }

    if (type === "new_customers") {
      const fourteenDaysAgo = new Date(); fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
      const { data: bookings } = await supabase.from("bookings").select("customer_id, start_ts, customers(id, full_name, phone, email)").eq("business_id", bizId).order("start_ts", { ascending: true });
      const firstMap = new Map<string, { customer: Customer; firstBooking: Date }>();
      (bookings || []).forEach((b: { customer_id: string; start_ts: string; customers: Customer | Customer[] }) => { const c = Array.isArray(b.customers) ? b.customers[0] : b.customers; if (!c?.phone || firstMap.has(b.customer_id)) return; firstMap.set(b.customer_id, { customer: c, firstBooking: new Date(b.start_ts) }); });
      return Array.from(firstMap.values()).filter(v => v.firstBooking >= fourteenDaysAgo).map(v => v.customer);
    }

    if (type === "no_bookings") {
      const { data: futureBookings } = await supabase.from("bookings").select("customer_id").eq("business_id", bizId).gt("start_ts", now.toISOString()).in("status", ["confirmed", "requested"]);
      const hasUpcoming = new Set((futureBookings || []).map((b: { customer_id: string }) => b.customer_id));
      const { data: all } = await supabase.from("customers").select("id, full_name, phone, email").eq("business_id", bizId).not("phone", "is", null);
      return ((all as Customer[]) || []).filter(c => !hasUpcoming.has(c.id));
    }

    return [];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!businessId) return;
    setAudienceLoading(true);
    setAudiencePage(1);
    resolveAudience(messageType, businessId).then((customers: typeof resolvedAudience) => {
      setResolvedAudience(customers);
      setAudienceLoading(false);
    });
  }, [messageType, businessId, resolveAudience]);

  const handleSaveSettings = async () => {
    if (!businessId) return;

    setSaving(true);

    try {
      // Save notification settings
      await supabase.from("notification_settings").upsert({
        business_id: businessId,
        ...settings,
      });

      // Handle appointment reminder rule
      // First, delete ALL existing reminder rules to prevent duplicates
      await supabase
        .from("notification_rules")
        .delete()
        .eq("business_id", businessId)
        .eq("kind", "appointment_reminder");

      if (automatedMessages.reminder_enabled) {
        // Create new reminder rule
        await supabase.from("notification_rules").insert({
          business_id: businessId,
          channel: "sms" as const,
          kind: "appointment_reminder" as const,
          offset_minutes: automatedMessages.reminder_hours_before * 60,
          template: automatedMessages.reminder_message,
          enabled: true,
          applies_to: "all" as const,
        });
      }

      // Handle win-back rule
      // First, delete ALL existing winback rules to prevent duplicates
      await supabase
        .from("notification_rules")
        .delete()
        .eq("business_id", businessId)
        .eq("kind", "winback");

      if (automatedMessages.winback_enabled) {
        // Create new winback rule
        await supabase.from("notification_rules").insert({
          business_id: businessId,
          channel: "sms" as const,
          kind: "winback" as const,
          inactive_days: automatedMessages.winback_days_inactive,
          template: automatedMessages.winback_message,
          enabled: true,
          applies_to: "all" as const,
        });
      }

      alert("All settings saved successfully!");
    } catch (error) {
      console.error("Error saving settings:", error);
      alert("Failed to save settings. Please try again.");
    }

    setSaving(false);
  };

  const handleProcessWinbacks = async () => {
    if (!businessId) return;

    const confirmed = confirm(
      "This will send win-back messages to all inactive customers based on your settings. Continue?",
    );

    if (!confirmed) return;

    try {
      const response = await fetch("/api/notifications/process-winbacks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ business_id: businessId }),
      });

      const data = await response.json();

      if (response.ok) {
        alert(
          `Win-back messages scheduled!\n\n${data.scheduled_count} messages will be sent in the next 5 minutes.`,
        );
      } else {
        alert(`Error: ${data.error || "Failed to process win-backs"}`);
      }
    } catch (error) {
      console.error("Error processing win-backs:", error);
      alert("Failed to process win-back messages. Please try again.");
    }
  };

  const handleSendMessage = async () => {
    if (!messageText.trim()) { alert("Please enter a message"); return; }
    if (!businessId) { alert("Business ID not found"); return; }
    if (!settings.channels.includes("sms")) { alert("SMS channel is not enabled. Please enable it in settings first."); return; }
    if (resolvedAudience.length === 0) { alert("No customers found for this audience"); return; }

    setSendingMessage(true);
    setSendProgress(null);
    setSendResults([]);
    setResultsPage(1);
    const results: SendResult[] = [];
    setSendProgress({ current: 0, total: resolvedAudience.length });

    for (let i = 0; i < resolvedAudience.length; i++) {
      const customer = resolvedAudience[i];
      try {
        const response = await fetch("/api/sms/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to: customer.phone, body: messageText, business_id: businessId }),
        });
        const data = await response.json();
        results.push({ phone: customer.phone, name: customer.full_name, success: response.ok, error: response.ok ? undefined : (data.error || "Unknown error") });
      } catch (error) {
        results.push({ phone: customer.phone, name: customer.full_name, success: false, error: error instanceof Error ? error.message : "Network error" });
      }
      setSendProgress({ current: i + 1, total: resolvedAudience.length });
      setSendResults([...results]);
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    alert(`Messages sent!\n\nSuccess: ${successCount}\nFailed: ${failCount}`);
    if (successCount > 0) setMessageText("");
    setSendingMessage(false);
    setSendProgress(null);
  };

  const handleToggleChannel = (channel: string) => {
    const newChannels = settings.channels.includes(channel)
      ? settings.channels.filter((c) => c !== channel)
      : [...settings.channels, channel];

    setSettings({ ...settings, channels: newChannels });
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-6xl">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Messages</h1>
            <p className="text-gray-600 mt-1">
              Send messages and manage notification settings
            </p>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column - Messaging */}
              <div className="lg:col-span-2 space-y-6">
                {/* Manual Message */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-gray-900">Send Message</h2>
                    <Link
                      href="/admin/delivery-status"
                      className="text-sm font-semibold text-blue-600 hover:text-blue-800 border border-blue-200 rounded-lg px-3 py-1.5 hover:bg-blue-50 transition"
                    >
                      Check Delivery Status →
                    </Link>
                  </div>

                  <div className="space-y-4">
                    {/* Recipient Selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Send To
                      </label>
                      <select
                        value={messageType}
                        onChange={e => setMessageType(e.target.value as MessageType)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                      >
                        {AUDIENCE_OPTIONS.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                      <div className="mt-1 flex items-center justify-between">
                        <p className="text-xs text-gray-500">{AUDIENCE_OPTIONS.find(o => o.value === messageType)?.description}</p>
                        <span className="text-xs font-semibold text-blue-600 ml-3 whitespace-nowrap">
                          {audienceLoading ? "..." : `${resolvedAudience.length} recipient${resolvedAudience.length !== 1 ? "s" : ""}`}
                        </span>
                      </div>
                      {!audienceLoading && resolvedAudience.length > 0 && (
                        <div className="mt-3 border border-gray-200 rounded-lg overflow-hidden">
                          <div className="divide-y divide-gray-100">
                            {resolvedAudience.slice((audiencePage - 1) * audiencePerPage, audiencePage * audiencePerPage).map((c) => (
                              <div key={c.id} className="flex items-center justify-between px-3 py-2 text-sm">
                                <span className="font-medium text-gray-900">{c.full_name || "Guest"}</span>
                                <span className="text-gray-500 text-xs">{c.phone}</span>
                              </div>
                            ))}
                          </div>
                          <Pagination
                            total={resolvedAudience.length} perPage={audiencePerPage} page={audiencePage}
                            onPageChange={setAudiencePage} onPerPageChange={(n) => { setAudiencePerPage(n); setAudiencePage(1); }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Message Text */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Message
                      </label>
                      <textarea
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        placeholder="Type your message here..."
                        rows={4}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-gray-900"
                      />
                      <p className="text-sm text-gray-500 mt-1">
                        {messageText.length} characters
                      </p>
                    </div>

                    {/* Send Progress */}
                    {sendProgress && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-blue-900">
                            Sending messages...
                          </span>
                          <span className="text-sm text-blue-700">
                            {sendProgress.current} / {sendProgress.total}
                          </span>
                        </div>
                        <div className="w-full bg-blue-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{
                              width: `${
                                (sendProgress.current / sendProgress.total) *
                                100
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Send Results */}
                    {sendResults.length > 0 && !sendProgress && (
                      <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <div className="p-4 pb-2">
                          <h3 className="text-sm font-semibold text-gray-900 mb-3">
                            Send Results
                          </h3>
                          <div className="space-y-2">
                            {sendResults.slice((resultsPage - 1) * resultsPerPage, resultsPage * resultsPerPage).map((result, index) => (
                              <div
                                key={index}
                                className={`flex items-center justify-between p-2 rounded ${
                                  result.success
                                    ? "bg-green-50 text-green-900"
                                    : "bg-red-50 text-red-900"
                                }`}
                              >
                                <div className="flex items-center space-x-2">
                                  <span>{result.success ? "✓" : "✗"}</span>
                                  <span className="text-sm font-medium">
                                    {result.name || "Unknown"}
                                  </span>
                                  <span className="text-xs text-gray-600">
                                    {result.phone}
                                  </span>
                                </div>
                                {!result.success && result.error && (
                                  <span className="text-xs">{result.error}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                        <Pagination
                          total={sendResults.length} perPage={resultsPerPage} page={resultsPage}
                          onPageChange={setResultsPage} onPerPageChange={(n) => { setResultsPerPage(n); setResultsPage(1); }}
                        />
                      </div>
                    )}

                    {/* Send Button */}
                    <button
                      onClick={handleSendMessage}
                      disabled={sendingMessage || !messageText.trim() || audienceLoading || resolvedAudience.length === 0}
                      className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      {sendingMessage ? "Sending..." : `Send to ${resolvedAudience.length} Recipient${resolvedAudience.length !== 1 ? "s" : ""}`}
                    </button>

                    {!settings.channels.includes("sms") && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                        <p className="text-sm text-yellow-800">
                          ⚠️ SMS channel is disabled. Enable it in settings to
                          send messages.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Automated Messages */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">
                    Automated Messages
                  </h2>

                  <div className="space-y-6">
                    {/* Appointment Reminders */}
                    <div className="border-b border-gray-200 pb-6">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-sm font-semibold text-gray-900">
                            Appointment Reminders
                          </h3>
                          <p className="text-xs text-gray-500 mt-1">
                            Send automatic reminders before appointments
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={automatedMessages.reminder_enabled}
                            onChange={(e) =>
                              setAutomatedMessages({
                                ...automatedMessages,
                                reminder_enabled: e.target.checked,
                              })
                            }
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>

                      {automatedMessages.reminder_enabled && (
                        <div className="space-y-3 pl-4 border-l-2 border-blue-200">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Send reminder (hours before)
                            </label>
                            <input
                              type="number"
                              min="1"
                              max="168"
                              value={automatedMessages.reminder_hours_before}
                              onChange={(e) =>
                                setAutomatedMessages({
                                  ...automatedMessages,
                                  reminder_hours_before: parseInt(
                                    e.target.value,
                                  ),
                                })
                              }
                              className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Message template
                            </label>
                            <textarea
                              value={automatedMessages.reminder_message}
                              onChange={(e) =>
                                setAutomatedMessages({
                                  ...automatedMessages,
                                  reminder_message: e.target.value,
                                })
                              }
                              rows={2}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm text-gray-900"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              Use {`{{customer_name}}`},{" "}
                              {`{{appointment_date}}`}, {`{{appointment_time}}`}
                            </p>
                          </div>
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                            <p className="text-xs text-blue-900 font-semibold">
                              ℹ️ How it works
                            </p>
                            <p className="text-xs text-blue-800 mt-1">
                              Reminders are automatically scheduled when
                              appointments are created. They will be sent{" "}
                              {automatedMessages.reminder_hours_before} hours
                              before each appointment.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Win-back Messages */}
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-sm font-semibold text-gray-900">
                            Win-back Messages
                          </h3>
                          <p className="text-xs text-gray-500 mt-1">
                            Re-engage inactive customers
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={automatedMessages.winback_enabled}
                            onChange={(e) =>
                              setAutomatedMessages({
                                ...automatedMessages,
                                winback_enabled: e.target.checked,
                              })
                            }
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>

                      {automatedMessages.winback_enabled && (
                        <div className="space-y-3 pl-4 border-l-2 border-purple-200">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Days of inactivity
                            </label>
                            <input
                              type="number"
                              min="1"
                              max="365"
                              value={automatedMessages.winback_days_inactive}
                              onChange={(e) =>
                                setAutomatedMessages({
                                  ...automatedMessages,
                                  winback_days_inactive: parseInt(
                                    e.target.value,
                                  ),
                                })
                              }
                              className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Message template
                            </label>
                            <textarea
                              value={automatedMessages.winback_message}
                              onChange={(e) =>
                                setAutomatedMessages({
                                  ...automatedMessages,
                                  winback_message: e.target.value,
                                })
                              }
                              rows={2}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm text-gray-900"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              Use {`{{customer_name}}`} for personalization
                            </p>
                          </div>
                          <button
                            onClick={handleProcessWinbacks}
                            className="w-full px-4 py-2 bg-purple-600 text-white text-sm rounded-lg font-semibold hover:bg-purple-700 transition"
                          >
                            Send Win-backs Now
                          </button>
                          <p className="text-xs text-gray-500">
                            This will send to all customers who haven&apos;t
                            booked in {automatedMessages.winback_days_inactive}{" "}
                            days
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column - Settings */}
              <div className="space-y-6">
                {/* Notification Types */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">
                    Notification Settings
                  </h2>

                  <div className="space-y-6">
                    {/* Types */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        Send Notifications For
                      </label>
                      <div className="space-y-2">
                        <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer">
                          <span className="text-sm text-gray-900">
                            Booking confirmations
                          </span>
                          <input
                            type="checkbox"
                            checked={settings.booking_confirmations}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                booking_confirmations: e.target.checked,
                              })
                            }
                            className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                          />
                        </label>
                        <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer">
                          <span className="text-sm text-gray-900">
                            Appointment reminders
                          </span>
                          <input
                            type="checkbox"
                            checked={settings.appointment_reminders}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                appointment_reminders: e.target.checked,
                              })
                            }
                            className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                          />
                        </label>
                        <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer">
                          <span className="text-sm text-gray-900">
                            Cancellation notices
                          </span>
                          <input
                            type="checkbox"
                            checked={settings.cancellation_notices}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                cancellation_notices: e.target.checked,
                              })
                            }
                            className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                          />
                        </label>
                        <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer">
                          <span className="text-sm text-gray-900">
                            Loyalty updates
                          </span>
                          <input
                            type="checkbox"
                            checked={settings.loyalty_updates}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                loyalty_updates: e.target.checked,
                              })
                            }
                            className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                          />
                        </label>
                      </div>
                    </div>

                    {/* Channels */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        Send Via
                      </label>
                      <div className="space-y-2">
                        <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer">
                          <span className="text-sm text-gray-900">SMS</span>
                          <input
                            type="checkbox"
                            checked={settings.channels.includes("sms")}
                            onChange={() => handleToggleChannel("sms")}
                            className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                          />
                        </label>
                        <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer">
                          <span className="text-sm text-gray-900">Email</span>
                          <input
                            type="checkbox"
                            checked={settings.channels.includes("email")}
                            onChange={() => handleToggleChannel("email")}
                            className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                          />
                        </label>
                        <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer">
                          <span className="text-sm text-gray-900">
                            Push Notifications
                          </span>
                          <input
                            type="checkbox"
                            checked={settings.channels.includes("push")}
                            onChange={() => handleToggleChannel("push")}
                            className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                          />
                        </label>
                      </div>
                    </div>

                    <button
                      onClick={handleSaveSettings}
                      disabled={saving}
                      className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
                    >
                      {saving ? "Saving..." : "Save Settings"}
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
