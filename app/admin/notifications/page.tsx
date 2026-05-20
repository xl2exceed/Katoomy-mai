"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

export default function MessagesPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [businessId, setBusinessId] = useState("");

  // SMS Templates
  const [smsTemplates, setSmsTemplates] = useState({
    reminder:        "Hi {{customer_name}}! Reminder: your {{service_name}} appointment is tomorrow at {{appt_time}}. Reply STOP to opt out.",
    cancel_customer: "Hi {{customer_name}}! Your {{appt_time}} appointment has been cancelled. Contact {{business_name}} to reschedule.",
    cancel_staff:    "Hi {{customer_name}}! Your {{service_name}} appointment on {{appt_time}} has been cancelled. Contact {{business_name}} to reschedule.",
    payment_dispute: "Hi {{customer_name}}! {{business_name}} did not receive your payment of ${{amount}}. Please send payment or visit {{pay_link}} to pay online.",
    winback:         "Hey {{customer_name}}! We miss you at {{business_name}}. Come back and book: {{booking_link}}",
    referral:        "Hi {{customer_name}}! Thanks for visiting {{business_name}}. Refer a friend and you both get a discount: {{referral_link}}",
  });
  const [smsTemplateSaving, setSmsTemplateSaving] = useState(false);
  const [smsTemplateMsg, setSmsTemplateMsg] = useState("");

  // Smart Campaigns
  const [smartCampaigns, setSmartCampaigns] = useState({
    appt_reminder_enabled: true,
    winback_30_enabled: true,
    winback_60_enabled: true,
    winback_90_enabled: true,
    referral_post_visit_enabled: true,
    reengage_enabled: true,
  });
  const [smartCampaignTemplates, setSmartCampaignTemplates] = useState({
    appt_reminder_template: "Hey {{customer_name}}! Just a reminder that you have an appointment at {{business_name}} tomorrow at {{appt_time}}. See you soon!",
    winback_30_template: "Hey {{customer_name}}! It's been a little while since we've seen you at {{business_name}}. We miss you! Tap here to book your next appointment whenever you're ready: {{booking_link}}",
    winback_60_template: "Hey {{customer_name}}, we haven't seen you in a while and we want to make it worth your while to come back. Use code COMEBACK for 10% off your next visit at {{business_name}}. Book here: {{booking_link}} — offer expires in 7 days!",
    winback_90_template: "Hey {{customer_name}}, we'd love to have you back at {{business_name}}! It's been 3 months and we're offering you a special returning customer deal — mention this text when you book and we'll take care of you. Book here: {{booking_link}}",
    referral_post_visit_template: "Hey {{customer_name}}, hope you're loving your results from {{business_name}}! If you know someone who'd love our services, send them your referral link and you'll both get rewarded: {{referral_link}}",
    reengage_template: "Hey {{customer_name}}! It's about that time — you're usually in to see us around now. Ready to book your next appointment at {{business_name}}? It only takes a minute: {{booking_link}}",
  });
  const [smartCampaignSaving, setSmartCampaignSaving] = useState(false);
  const [smartCampaignMsg, setSmartCampaignMsg] = useState("");
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: business } = await supabase
      .from("businesses")
      .select("id")
      .eq("owner_user_id", user.id)
      .single();

    if (business) {
      setBusinessId(business.id);

      const { data: tmplData } = await supabase
        .from("sms_templates")
        .select("reminder, cancel_customer, cancel_staff, payment_dispute, winback, referral")
        .eq("business_id", business.id)
        .maybeSingle();
      if (tmplData) setSmsTemplates((prev) => ({ ...prev, ...tmplData }));

      const { data: scData } = await supabase
        .from("ai_marketing_settings")
        .select("appt_reminder_enabled, winback_30_enabled, winback_60_enabled, winback_90_enabled, referral_post_visit_enabled, reengage_enabled, appt_reminder_template, winback_30_template, winback_60_template, winback_90_template, referral_post_visit_template, reengage_template")
        .eq("business_id", business.id)
        .maybeSingle();
      if (scData) {
        setSmartCampaigns({
          appt_reminder_enabled: scData.appt_reminder_enabled ?? true,
          winback_30_enabled: scData.winback_30_enabled ?? true,
          winback_60_enabled: scData.winback_60_enabled ?? true,
          winback_90_enabled: scData.winback_90_enabled ?? true,
          referral_post_visit_enabled: scData.referral_post_visit_enabled ?? true,
          reengage_enabled: scData.reengage_enabled ?? true,
        });
        setSmartCampaignTemplates((prev) => ({
          ...prev,
          ...(scData.appt_reminder_template ? { appt_reminder_template: scData.appt_reminder_template } : {}),
          ...(scData.winback_30_template ? { winback_30_template: scData.winback_30_template } : {}),
          ...(scData.winback_60_template ? { winback_60_template: scData.winback_60_template } : {}),
          ...(scData.winback_90_template ? { winback_90_template: scData.winback_90_template } : {}),
          ...(scData.referral_post_visit_template ? { referral_post_visit_template: scData.referral_post_visit_template } : {}),
          ...(scData.reengage_template ? { reengage_template: scData.reengage_template } : {}),
        }));
      }
    }

    setLoading(false);
  };

  const handleSaveSmsTemplates = async () => {
    setSmsTemplateSaving(true);
    setSmsTemplateMsg("");
    const res = await fetch("/api/admin/sms-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(smsTemplates),
    });
    setSmsTemplateSaving(false);
    if (res.ok) {
      setSmsTemplateMsg("✅ SMS templates saved!");
      setTimeout(() => setSmsTemplateMsg(""), 3000);
    } else {
      setSmsTemplateMsg("❌ Failed to save templates.");
    }
  };

  const handleSaveSmartCampaigns = async () => {
    setSmartCampaignSaving(true);
    setSmartCampaignMsg("");
    const { error } = await supabase
      .from("ai_marketing_settings")
      .upsert(
        { business_id: businessId, ...smartCampaigns, ...smartCampaignTemplates },
        { onConflict: "business_id" }
      );
    setSmartCampaignSaving(false);
    if (error) {
      setSmartCampaignMsg("❌ Failed to save campaign settings.");
    } else {
      setSmartCampaignMsg("✅ Campaign settings saved!");
      setTimeout(() => setSmartCampaignMsg(""), 3000);
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
    <div className="min-h-screen bg-gray-50">
      <main className="p-8 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Messages</h1>
          <p className="text-gray-600 mt-1">Automated campaigns and message templates</p>
        </div>

        {/* Delivery Status */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Delivery Status</h2>
            <p className="text-sm text-gray-500 mt-0.5">Check delivery reports and message history</p>
          </div>
          <Link
            href="/admin/delivery-status"
            className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition whitespace-nowrap"
          >
            Check Delivery Status →
          </Link>
        </div>

        {/* Automated Smart Campaigns */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-2xl">🤖</span>
            <h2 className="text-xl font-bold text-gray-900">Automated Smart Campaigns</h2>
          </div>
          <p className="text-sm text-gray-600 mb-5">
            Automated text messages sent to your customers at the right time — all on autopilot.
            All campaigns are <strong>on by default</strong>. Toggle any off to disable it.
          </p>

          <div className="space-y-3">
            {([
              {
                key: "appt_reminder_enabled" as const,
                templateKey: "appt_reminder_template" as const,
                label: "Appointment Reminder",
                desc: "Sent 24 hours before each appointment to reduce no-shows.",
                icon: "⏰",
                vars: "{{customer_name}}, {{business_name}}, {{appt_time}}",
              },
              {
                key: "winback_30_enabled" as const,
                templateKey: "winback_30_template" as const,
                label: "Win-Back — 30 Days (Friendly Check-In)",
                desc: "Sent when a customer hasn't booked in 30 days. A friendly nudge to come back.",
                icon: "👋",
                vars: "{{customer_name}}, {{business_name}}, {{booking_link}}",
              },
              {
                key: "winback_60_enabled" as const,
                templateKey: "winback_60_template" as const,
                label: "Win-Back — 60 Days (Discount Offer)",
                desc: "Sent at 60 days inactive. Offers a discount code to bring them back.",
                icon: "🎁",
                vars: "{{customer_name}}, {{business_name}}, {{booking_link}}",
              },
              {
                key: "winback_90_enabled" as const,
                templateKey: "winback_90_template" as const,
                label: "Win-Back — 90 Days (Last Chance)",
                desc: "Sent at 90 days inactive. A final personalized offer to re-engage the customer.",
                icon: "🚨",
                vars: "{{customer_name}}, {{business_name}}, {{booking_link}}",
              },
              {
                key: "referral_post_visit_enabled" as const,
                templateKey: "referral_post_visit_template" as const,
                label: "Referral Nudge (After Visit)",
                desc: "Sent 3 days after a completed appointment, asking happy customers to refer friends.",
                icon: "🙌",
                vars: "{{customer_name}}, {{business_name}}, {{referral_link}}",
              },
              {
                key: "reengage_enabled" as const,
                templateKey: "reengage_template" as const,
                label: "Re-Engagement Nudge",
                desc: "Sent when a customer is overdue based on their personal visit pattern.",
                icon: "📅",
                vars: "{{customer_name}}, {{business_name}}, {{booking_link}}",
              },
            ] as { key: keyof typeof smartCampaigns; templateKey: keyof typeof smartCampaignTemplates; label: string; desc: string; icon: string; vars: string }[]).map(({ key, templateKey, label, desc, icon, vars }) => (
              <div key={key} className={`rounded-xl border-2 transition ${
                smartCampaigns[key] ? "border-green-200 bg-green-50" : "border-gray-200 bg-gray-50"
              }`}>
                <div className="flex items-start justify-between p-4">
                  <div className="flex items-start gap-3 flex-1 mr-4">
                    <span className="text-xl mt-0.5">{icon}</span>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs font-medium ${smartCampaigns[key] ? "text-green-700" : "text-gray-500"}`}>
                      {smartCampaigns[key] ? "On" : "Off"}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSmartCampaigns({ ...smartCampaigns, [key]: !smartCampaigns[key] })}
                      style={{
                        width: "44px", height: "24px",
                        backgroundColor: smartCampaigns[key] ? "#16a34a" : "#d1d5db",
                        borderRadius: "12px", position: "relative",
                        transition: "background-color 0.2s", border: "none",
                        cursor: "pointer", flexShrink: 0,
                      }}
                    >
                      <span style={{
                        position: "absolute", top: "2px",
                        left: smartCampaigns[key] ? "22px" : "2px",
                        width: "20px", height: "20px",
                        backgroundColor: "white", borderRadius: "10px",
                        transition: "left 0.2s", boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                      }} />
                    </button>
                  </div>
                </div>

                <div className="px-4 pb-2">
                  <button
                    type="button"
                    onClick={() => setExpandedCards((prev) => ({ ...prev, [key]: !prev[key] }))}
                    className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 transition"
                  >
                    {expandedCards[key] ? "▲ Hide message" : "▼ Edit message"}
                  </button>
                </div>

                {expandedCards[key] && (
                  <div className="px-4 pb-4">
                    <div className="border-t border-gray-200 pt-3">
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Message Text</label>
                      <textarea
                        rows={3}
                        value={smartCampaignTemplates[templateKey]}
                        onChange={(e) => setSmartCampaignTemplates({ ...smartCampaignTemplates, [templateKey]: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono resize-y"
                      />
                      <p className="text-xs text-gray-400 mt-1">Available variables: <span className="font-mono">{vars}</span></p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between mt-5">
            <p className={`text-sm font-medium ${smartCampaignMsg.startsWith("✅") ? "text-green-600" : "text-red-600"}`}>
              {smartCampaignMsg}
            </p>
            <button
              onClick={handleSaveSmartCampaigns}
              disabled={smartCampaignSaving}
              className="px-6 py-2.5 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-50 text-sm"
            >
              {smartCampaignSaving ? "Saving…" : "Save Campaign Settings"}
            </button>
          </div>
        </div>

        {/* SMS Message Templates */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-1">SMS Message Templates</h2>
          <p className="text-sm text-gray-600 mb-1">
            Customize the text messages sent to your customers. Use <code className="bg-gray-100 px-1 rounded text-xs">{"{{variable}}"}</code> placeholders — they are replaced automatically.
          </p>
          <div className="space-y-5 mt-5">
            {([
              {
                key: "reminder",
                label: "Appointment Reminder",
                hint: "Sent the day before an appointment.",
                vars: "{{customer_name}}, {{service_name}}, {{appt_time}}",
              },
              {
                key: "cancel_customer",
                label: "Cancellation (customer cancels)",
                hint: "Sent to the customer when they cancel their own booking.",
                vars: "{{customer_name}}, {{appt_time}}, {{business_name}}",
              },
              {
                key: "cancel_staff",
                label: "Cancellation (staff/admin cancels)",
                hint: "Sent to the customer when a staff member cancels their booking.",
                vars: "{{customer_name}}, {{service_name}}, {{appt_time}}, {{business_name}}",
              },
              {
                key: "payment_dispute",
                label: "Payment Dispute",
                hint: "Sent when the business marks a claimed payment as not received.",
                vars: "{{customer_name}}, {{business_name}}, {{amount}}, {{pay_link}}",
              },
              {
                key: "winback",
                label: "Win-Back (inactive customers)",
                hint: "Also editable via Smart Campaigns above. This template is used as a fallback.",
                vars: "{{customer_name}}, {{business_name}}, {{booking_link}}",
              },
              {
                key: "referral",
                label: "Referral Reminder",
                hint: "Also editable via Smart Campaigns above. This template is used as a fallback.",
                vars: "{{customer_name}}, {{business_name}}, {{referral_link}}",
              },
            ] as { key: keyof typeof smsTemplates; label: string; hint: string; vars: string }[]).map(({ key, label, hint, vars }) => (
              <div key={key}>
                <label className="block text-sm font-semibold text-gray-800 mb-0.5">{label}</label>
                <p className="text-xs text-gray-500 mb-1">{hint}</p>
                <textarea
                  rows={3}
                  value={smsTemplates[key]}
                  onChange={(e) => setSmsTemplates({ ...smsTemplates, [key]: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono resize-y"
                />
                <p className="text-xs text-gray-400 mt-0.5">Variables: <span className="font-mono">{vars}</span></p>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-5">
            <p className={`text-sm font-medium ${smsTemplateMsg.startsWith("✅") ? "text-green-600" : "text-red-600"}`}>
              {smsTemplateMsg}
            </p>
            <button
              onClick={handleSaveSmsTemplates}
              disabled={smsTemplateSaving}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50 text-sm"
            >
              {smsTemplateSaving ? "Saving…" : "Save SMS Templates"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
