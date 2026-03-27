"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

interface Settings {
  id: string;
  winback_enabled: boolean;
  winback_mode: string;
  winback_inactive_days: number;
  winback_template: string;
  winback_cooldown_days: number;
  referral_enabled: boolean;
  referral_mode: string;
  referral_delay_days: number;
  referral_template: string;
  referral_cooldown_days: number;
  social_enabled: boolean;
  social_mode: string;
  social_post_frequency_days: number;
  insights_enabled: boolean;
  insights_refresh_hours: number;
}

const DEFAULT_WINBACK_TEMPLATE =
  "Hey {{customer_name}}! We miss you at {{business_name}}. It's been a while — come back and book your next appointment: {{booking_link}}";
const DEFAULT_REFERRAL_TEMPLATE =
  "Hi {{customer_name}}! Thanks for visiting {{business_name}}. Know someone who'd love our services? Share this link and you both get a discount: {{referral_link}}";

export default function GrowthSettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/growth/settings")
      .then((r) => r.json())
      .then(setSettings)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const update = (key: keyof Settings, value: unknown) => {
    setSettings((prev) => prev ? { ...prev, [key]: value } : prev);
  };

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch("/api/growth/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error(await res.text());
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-2xl">⚙️</span>
          <h1 className="text-2xl font-bold text-gray-900">Automation Settings</h1>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-40 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <p className="text-red-600">{error ?? "Could not load settings."}</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-2xl">⚙️</span>
            <h1 className="text-2xl font-bold text-gray-900">Automation Settings</h1>
          </div>
          <p className="text-sm text-gray-500">
            Configure how each AI Growth Hub feature behaves. Smart defaults are pre-set —
            you only need to adjust what matters to you.
          </p>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="px-5 py-2.5 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 disabled:opacity-40 transition"
        >
          {saving ? "Saving…" : saved ? "✅ Saved!" : "Save Settings"}
        </button>
      </div>

      {error && (
        <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      <div className="space-y-6">
        {/* ── Win-Back ── */}
        <SettingsSection
          icon="💌"
          title="Win-Back Campaigns"
          description="Sends a text to customers who haven't booked in a while."
        >
          <ToggleRow
            label="Enable Win-Back"
            value={settings.winback_enabled}
            onChange={(v) => update("winback_enabled", v)}
          />
          {settings.winback_enabled && (
            <>
              <ModeRow
                label="Mode"
                value={settings.winback_mode}
                onChange={(v) => update("winback_mode", v)}
                autoLabel="Send automatically every day"
                manualLabel="Show list for manual review"
              />
              <NumberRow
                label="Inactive threshold"
                value={settings.winback_inactive_days}
                onChange={(v) => update("winback_inactive_days", v)}
                unit="days"
                min={7}
                max={365}
                hint="Customers inactive longer than this will be targeted"
              />
              <NumberRow
                label="Cooldown between texts"
                value={settings.winback_cooldown_days}
                onChange={(v) => update("winback_cooldown_days", v)}
                unit="days"
                min={7}
                max={180}
                hint="Minimum gap before re-sending to the same customer"
              />
              <TemplateRow
                label="Message template"
                value={settings.winback_template ?? DEFAULT_WINBACK_TEMPLATE}
                onChange={(v) => update("winback_template", v)}
                variables={["{{customer_name}}", "{{business_name}}", "{{booking_link}}"]}
              />
            </>
          )}
        </SettingsSection>

        {/* ── Referral Reminders ── */}
        <SettingsSection
          icon="🎁"
          title="Referral Reminders"
          description="Asks recent customers to refer a friend after their visit."
        >
          <ToggleRow
            label="Enable Referral Reminders"
            value={settings.referral_enabled}
            onChange={(v) => update("referral_enabled", v)}
          />
          {settings.referral_enabled && (
            <>
              <ModeRow
                label="Mode"
                value={settings.referral_mode}
                onChange={(v) => update("referral_mode", v)}
                autoLabel="Send automatically every day"
                manualLabel="Show list for manual review"
              />
              <NumberRow
                label="Send after visit"
                value={settings.referral_delay_days}
                onChange={(v) => update("referral_delay_days", v)}
                unit="days"
                min={1}
                max={30}
                hint="How many days after a visit to send the referral ask"
              />
              <NumberRow
                label="Cooldown between asks"
                value={settings.referral_cooldown_days}
                onChange={(v) => update("referral_cooldown_days", v)}
                unit="days"
                min={30}
                max={365}
                hint="Minimum gap before asking the same customer again"
              />
              <TemplateRow
                label="Message template"
                value={settings.referral_template ?? DEFAULT_REFERRAL_TEMPLATE}
                onChange={(v) => update("referral_template", v)}
                variables={["{{customer_name}}", "{{business_name}}", "{{referral_link}}"]}
              />
            </>
          )}
        </SettingsSection>

        {/* ── Social Media ── */}
        <SettingsSection
          icon="📱"
          title="Social Media Posts"
          description="AI generates social posts based on your business analytics."
        >
          <ToggleRow
            label="Enable Social Media Generation"
            value={settings.social_enabled}
            onChange={(v) => update("social_enabled", v)}
          />
          {settings.social_enabled && (
            <>
              <ModeRow
                label="Mode"
                value={settings.social_mode}
                onChange={(v) => update("social_mode", v)}
                autoLabel="Auto-generate and queue for approval"
                manualLabel="Only generate when I click the button"
              />
              <NumberRow
                label="Auto-generate frequency"
                value={settings.social_post_frequency_days}
                onChange={(v) => update("social_post_frequency_days", v)}
                unit="days"
                min={1}
                max={30}
                hint="How often to auto-generate new posts"
              />
            </>
          )}
        </SettingsSection>

        {/* ── AI Insights ── */}
        <SettingsSection
          icon="🧠"
          title="AI Business Insights"
          description="How often the AI re-analyzes your business data."
        >
          <ToggleRow
            label="Enable AI Insights"
            value={settings.insights_enabled}
            onChange={(v) => update("insights_enabled", v)}
          />
          {settings.insights_enabled && (
            <NumberRow
              label="Refresh interval"
              value={settings.insights_refresh_hours}
              onChange={(v) => update("insights_refresh_hours", v)}
              unit="hours"
              min={1}
              max={168}
              hint="How many hours before the AI re-analyzes your data (24 = daily)"
            />
          )}
        </SettingsSection>
      </div>

      {/* Save Button (bottom) */}
      <div className="mt-8 flex items-center justify-between flex-wrap gap-3">
        <Link href="/admin/growth" className="text-sm text-gray-400 hover:text-gray-600">
          ← Back to AI Growth Hub
        </Link>
        <button
          onClick={save}
          disabled={saving}
          className="px-6 py-2.5 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 disabled:opacity-40 transition"
        >
          {saving ? "Saving…" : saved ? "✅ Saved!" : "Save Settings"}
        </button>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────

function SettingsSection({
  icon, title, description, children,
}: {
  icon: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
      <div className="flex items-center gap-3 mb-1">
        <span className="text-xl">{icon}</span>
        <h2 className="text-base font-bold text-gray-900">{title}</h2>
      </div>
      <p className="text-xs text-gray-500 mb-5">{description}</p>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <button
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${value ? "bg-purple-600" : "bg-gray-200"}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${value ? "translate-x-6" : "translate-x-1"}`} />
      </button>
    </div>
  );
}

function ModeRow({
  label, value, onChange, autoLabel, manualLabel,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoLabel: string;
  manualLabel: string;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-gray-700 mb-2">{label}</p>
      <div className="flex gap-3">
        {[
          { val: "automatic", text: autoLabel },
          { val: "manual", text: manualLabel },
        ].map((opt) => (
          <button
            key={opt.val}
            onClick={() => onChange(opt.val)}
            className={`flex-1 text-xs font-semibold px-3 py-2 rounded-lg border transition ${
              value === opt.val
                ? "bg-purple-600 text-white border-purple-600"
                : "bg-white text-gray-600 border-gray-200 hover:border-purple-300"
            }`}
          >
            {opt.val === "automatic" ? "🤖 " : "👤 "}
            {opt.text}
          </button>
        ))}
      </div>
    </div>
  );
}

function NumberRow({
  label, value, onChange, unit, min, max, hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  unit: string;
  min: number;
  max: number;
  hint?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className="text-sm font-bold text-purple-700">{value} {unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-purple-600"
      />
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

function TemplateRow({
  label, value, onChange, variables,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  variables: string[];
}) {
  return (
    <div>
      <p className="text-sm font-medium text-gray-700 mb-1">{label}</p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-purple-300"
      />
      <p className="text-xs text-gray-400 mt-1">
        Available variables:{" "}
        {variables.map((v) => (
          <code key={v} className="bg-gray-100 px-1 rounded text-xs mr-1">{v}</code>
        ))}
      </p>
    </div>
  );
}
