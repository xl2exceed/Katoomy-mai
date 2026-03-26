"use client";

import { useEffect, useState, useCallback } from "react";

interface Campaign {
  id: string;
  name: string;
  message_template: string;
  audience_type: string;
  audience_config: Record<string, number>;
  status: string;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  simulated: boolean;
  sent_at: string | null;
  created_at: string;
}

const AUDIENCE_OPTIONS = [
  { key: "all", label: "All Customers", description: "Everyone with a phone number" },
  { key: "at_risk", label: "At-Risk Customers", description: "Haven't visited recently" },
  { key: "members", label: "Members Only", description: "Active Elite Members" },
  { key: "new", label: "New Customers", description: "Recently joined" },
  { key: "top_spenders", label: "Top Spenders", description: "Highest-value customers" },
];

const TEMPLATES = [
  { label: "Win-Back", text: "Hey {name}! We miss you at {business}. Come back and book your next appointment: {booking_link}" },
  { label: "Promotion", text: "Hey {name}! {business} is running a special this week. Book now: {booking_link}" },
  { label: "Member Perk", text: "Hi {name}! As an Elite Member at {business}, you have exclusive benefits waiting. Book here: {booking_link}" },
  { label: "Custom", text: "" },
];

const MAX_SMS_LENGTH = 160;

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  // Builder state
  const [name, setName] = useState("");
  const [audienceType, setAudienceType] = useState("at_risk");
  const [audienceConfig, setAudienceConfig] = useState<Record<string, number>>({ days_inactive: 30 });
  const [messageTemplate, setMessageTemplate] = useState(TEMPLATES[0].text);
  const [selectedTemplate, setSelectedTemplate] = useState(0);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewNames, setPreviewNames] = useState<{ name: string; phone: string }[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ simulated: boolean; sentCount: number; failedCount: number } | null>(null);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"builder" | "history">("builder");

  const loadCampaigns = useCallback(async () => {
    const res = await fetch("/api/admin/campaigns");
    if (res.ok) {
      const data = await res.json();
      setCampaigns(data.campaigns || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadCampaigns(); }, [loadCampaigns]);

  const loadPreview = useCallback(async () => {
    setPreviewLoading(true);
    const config = encodeURIComponent(JSON.stringify(audienceConfig));
    const res = await fetch(`/api/admin/campaigns/preview?audienceType=${audienceType}&config=${config}`);
    if (res.ok) {
      const data = await res.json();
      setPreviewCount(data.count);
      setPreviewNames(data.preview || []);
    }
    setPreviewLoading(false);
  }, [audienceType, audienceConfig]);

  useEffect(() => { loadPreview(); }, [loadPreview]);

  function handleAudienceChange(key: string) {
    setAudienceType(key);
    if (key === "at_risk") setAudienceConfig({ days_inactive: 30 });
    else if (key === "new") setAudienceConfig({ days_new: 30 });
    else if (key === "top_spenders") setAudienceConfig({ top_n: 20 });
    else setAudienceConfig({});
  }

  function handleTemplateSelect(i: number) {
    setSelectedTemplate(i);
    if (TEMPLATES[i].text) setMessageTemplate(TEMPLATES[i].text);
  }

  async function handleSend() {
    setError("");
    if (!name.trim()) { setError("Give this campaign a name."); return; }
    if (!messageTemplate.trim()) { setError("Write a message."); return; }
    if ((previewCount ?? 0) === 0) { setError("No customers match this audience."); return; }

    setSending(true);

    // Create campaign first
    const createRes = await fetch("/api/admin/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, messageTemplate, audienceType, audienceConfig }),
    });
    if (!createRes.ok) { setError("Failed to create campaign."); setSending(false); return; }
    const { campaign } = await createRes.json();

    // Send it
    const sendRes = await fetch("/api/admin/campaigns/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId: campaign.id }),
    });
    const result = await sendRes.json();
    if (!sendRes.ok) { setError(result.error || "Send failed."); setSending(false); return; }

    setSendResult(result);
    setSending(false);
    loadCampaigns();
  }

  function resetBuilder() {
    setName(""); setMessageTemplate(TEMPLATES[0].text); setSelectedTemplate(0);
    setAudienceType("at_risk"); setAudienceConfig({ days_inactive: 30 });
    setSendResult(null); setError("");
  }

  const charsLeft = MAX_SMS_LENGTH - messageTemplate.length;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">SMS Campaigns</h1>
        <div className="flex gap-2">
          {(["builder", "history"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition ${
                activeTab === tab ? "bg-purple-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}>
              {tab === "builder" ? "New Campaign" : `History (${campaigns.length})`}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "builder" ? (
        sendResult ? (
          // Success state
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center space-y-4">
            <div className="text-5xl">{sendResult.simulated ? "🧪" : "✅"}</div>
            <h2 className="text-2xl font-bold text-gray-900">
              {sendResult.simulated ? "Campaign Simulated" : "Campaign Sent!"}
            </h2>
            {sendResult.simulated && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 text-left">
                <strong>Test Mode Active</strong> — Messages were logged but not delivered to real phones.
                Switch <code className="bg-amber-100 px-1 rounded">TWILIO_MODE=LIVE</code> in your environment variables to send real SMS.
              </div>
            )}
            <div className="flex justify-center gap-8 text-sm">
              <div><p className="text-gray-500">Recipients</p><p className="text-2xl font-bold text-gray-900">{sendResult.sentCount + sendResult.failedCount}</p></div>
              <div><p className="text-gray-500">{sendResult.simulated ? "Simulated" : "Sent"}</p><p className="text-2xl font-bold text-green-600">{sendResult.sentCount}</p></div>
              {sendResult.failedCount > 0 && (
                <div><p className="text-gray-500">Failed</p><p className="text-2xl font-bold text-red-600">{sendResult.failedCount}</p></div>
              )}
            </div>
            <div className="flex gap-3 justify-center pt-2">
              <button onClick={resetBuilder} className="px-6 py-2 bg-purple-600 text-white rounded-xl font-semibold cursor-pointer">New Campaign</button>
              <button onClick={() => setActiveTab("history")} className="px-6 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl font-semibold cursor-pointer">View History</button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Builder form */}
            <div className="lg:col-span-3 space-y-5">

              {/* Campaign Name */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Campaign Name</label>
                <input
                  value={name} onChange={e => setName(e.target.value)}
                  placeholder="e.g. Wednesday Win-Back"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Audience */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <label className="block text-sm font-semibold text-gray-700 mb-3">Audience</label>
                <div className="space-y-2">
                  {AUDIENCE_OPTIONS.map(opt => (
                    <label key={opt.key} className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition ${
                      audienceType === opt.key ? "border-purple-500 bg-purple-50" : "border-gray-200 hover:border-gray-300"
                    }`}>
                      <input type="radio" name="audience" value={opt.key} checked={audienceType === opt.key}
                        onChange={() => handleAudienceChange(opt.key)} className="mt-0.5 accent-purple-600" />
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{opt.label}</p>
                        <p className="text-xs text-gray-500">{opt.description}</p>
                      </div>
                    </label>
                  ))}
                </div>

                {/* Audience config */}
                {audienceType === "at_risk" && (
                  <div className="mt-3 flex items-center gap-3">
                    <label className="text-sm text-gray-600">Inactive for at least</label>
                    <input type="number" min={7} max={365} value={audienceConfig.days_inactive ?? 30}
                      onChange={e => setAudienceConfig({ days_inactive: Number(e.target.value) })}
                      className="w-20 px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-center" />
                    <span className="text-sm text-gray-600">days</span>
                  </div>
                )}
                {audienceType === "new" && (
                  <div className="mt-3 flex items-center gap-3">
                    <label className="text-sm text-gray-600">Joined in the last</label>
                    <input type="number" min={1} max={365} value={audienceConfig.days_new ?? 30}
                      onChange={e => setAudienceConfig({ days_new: Number(e.target.value) })}
                      className="w-20 px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-center" />
                    <span className="text-sm text-gray-600">days</span>
                  </div>
                )}
                {audienceType === "top_spenders" && (
                  <div className="mt-3 flex items-center gap-3">
                    <label className="text-sm text-gray-600">Top</label>
                    <input type="number" min={5} max={200} value={audienceConfig.top_n ?? 20}
                      onChange={e => setAudienceConfig({ top_n: Number(e.target.value) })}
                      className="w-20 px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-center" />
                    <span className="text-sm text-gray-600">customers by spend</span>
                  </div>
                )}
              </div>

              {/* Message */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold text-gray-700">Message</label>
                  <span className={`text-xs font-medium ${charsLeft < 0 ? "text-red-500" : charsLeft < 20 ? "text-amber-500" : "text-gray-400"}`}>
                    {charsLeft} chars left
                  </span>
                </div>

                {/* Quick templates */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {TEMPLATES.map((t, i) => (
                    <button key={t.label} onClick={() => handleTemplateSelect(i)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer border transition ${
                        selectedTemplate === i ? "bg-purple-600 text-white border-purple-600" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                      }`}>
                      {t.label}
                    </button>
                  ))}
                </div>

                <textarea
                  value={messageTemplate}
                  onChange={e => { setMessageTemplate(e.target.value); setSelectedTemplate(TEMPLATES.length - 1); }}
                  rows={4}
                  placeholder="Write your message... Use {name}, {business}, {booking_link}"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Variables: <code className="bg-gray-100 px-1 rounded">{"{name}"}</code> <code className="bg-gray-100 px-1 rounded">{"{business}"}</code> <code className="bg-gray-100 px-1 rounded">{"{booking_link}"}</code>
                </p>
              </div>

              {error && <p className="text-red-600 text-sm font-medium">{error}</p>}

              <button
                onClick={handleSend}
                disabled={sending || (previewCount ?? 0) === 0}
                className="w-full py-4 bg-purple-600 text-white rounded-xl font-bold text-lg cursor-pointer disabled:opacity-50 hover:bg-purple-700 transition"
              >
                {sending ? "Sending..." : `Send to ${previewCount ?? "..."} Customers`}
              </button>
            </div>

            {/* Preview panel */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white rounded-xl border border-gray-200 p-5 sticky top-6">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Audience Preview</h3>
                {previewLoading ? (
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600" />
                    Loading...
                  </div>
                ) : (
                  <>
                    <p className="text-3xl font-bold text-gray-900 mb-1">{previewCount ?? 0}</p>
                    <p className="text-sm text-gray-500 mb-4">customers will receive this</p>
                    {previewNames.length > 0 && (
                      <div className="space-y-2">
                        {previewNames.map((p, i) => (
                          <div key={i} className="flex items-center justify-between text-sm">
                            <span className="font-medium text-gray-800">{p.name}</span>
                            <span className="text-gray-400">{p.phone}</span>
                          </div>
                        ))}
                        {(previewCount ?? 0) > 5 && (
                          <p className="text-xs text-gray-400">+ {(previewCount ?? 0) - 5} more</p>
                        )}
                      </div>
                    )}
                  </>
                )}

                {/* Message preview */}
                {messageTemplate && (
                  <div className="mt-5 pt-4 border-t border-gray-100">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Message Preview</p>
                    <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-gray-800 leading-relaxed">
                      {messageTemplate
                        .replace("{name}", previewNames[0]?.name || "Alex")
                        .replace("{business}", "Your Business")
                        .replace("{booking_link}", "katoomy.com/yourbusiness")}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      ) : (
        // History tab
        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
            </div>
          ) : campaigns.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <p className="text-gray-400 text-lg">No campaigns yet</p>
              <button onClick={() => setActiveTab("builder")} className="mt-4 px-6 py-2 bg-purple-600 text-white rounded-xl font-semibold cursor-pointer">
                Create Your First Campaign
              </button>
            </div>
          ) : (
            campaigns.map(c => (
              <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-gray-900">{c.name}</h3>
                      {c.simulated && (
                        <span className="text-xs bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-full">Test Mode</span>
                      )}
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        c.status === "sent" ? "bg-green-100 text-green-700" :
                        c.status === "sending" ? "bg-blue-100 text-blue-700" :
                        "bg-gray-100 text-gray-600"
                      }`}>{c.status}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {AUDIENCE_OPTIONS.find(a => a.key === c.audience_type)?.label} &middot;{" "}
                      {c.sent_at
                        ? new Date(c.sent_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })
                        : new Date(c.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </p>
                  </div>
                  <div className="flex gap-4 text-center shrink-0">
                    <div>
                      <p className="text-xs text-gray-500">Recipients</p>
                      <p className="font-bold text-gray-900">{c.total_recipients}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">{c.simulated ? "Simulated" : "Sent"}</p>
                      <p className="font-bold text-green-600">{c.sent_count}</p>
                    </div>
                    {c.failed_count > 0 && (
                      <div>
                        <p className="text-xs text-gray-500">Failed</p>
                        <p className="font-bold text-red-600">{c.failed_count}</p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-700 leading-relaxed">
                  {c.message_template}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
