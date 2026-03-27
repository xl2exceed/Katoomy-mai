"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

interface Settings {
  winback_enabled: boolean;
  winback_mode: string;
  referral_enabled: boolean;
  referral_mode: string;
  social_enabled: boolean;
  social_mode: string;
}

interface QuickStat {
  label: string;
  value: string | number;
  sub?: string;
  color: string;
}

export default function GrowthHubPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/growth/settings")
      .then((r) => r.json())
      .then((d) => setSettings(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const features = [
    {
      href: "/admin/growth/insights",
      icon: "🧠",
      title: "AI Business Insights",
      description:
        "AI analyzes your booking patterns, revenue trends, and customer behavior to surface actionable recommendations — no manual input needed.",
      badge: "Auto-refreshes daily",
      badgeColor: "bg-blue-100 text-blue-700",
      cta: "View Insights →",
      ctaColor: "bg-indigo-600 hover:bg-indigo-700",
    },
    {
      href: "/admin/growth/winback",
      icon: "💌",
      title: "Win-Back Campaigns",
      description:
        "Automatically detects customers who haven't booked in a while and sends them a personalized text to bring them back.",
      badge: settings
        ? settings.winback_enabled
          ? settings.winback_mode === "automatic"
            ? "🟢 Running automatically"
            : "🟡 Manual mode"
          : "⚫ Disabled"
        : "Loading…",
      badgeColor: "bg-green-100 text-green-700",
      cta: "Manage Win-Back →",
      ctaColor: "bg-purple-600 hover:bg-purple-700",
    },
    {
      href: "/admin/growth/referral",
      icon: "🎁",
      title: "Referral Reminders",
      description:
        "Sends a friendly text to recent customers asking them to refer a friend, timed perfectly after their visit.",
      badge: settings
        ? settings.referral_enabled
          ? settings.referral_mode === "automatic"
            ? "🟢 Running automatically"
            : "🟡 Manual mode"
          : "⚫ Disabled"
        : "Loading…",
      badgeColor: "bg-purple-100 text-purple-700",
      cta: "Manage Referrals →",
      ctaColor: "bg-purple-600 hover:bg-purple-700",
    },
    {
      href: "/admin/growth/social",
      icon: "📱",
      title: "Social Media Posts",
      description:
        "AI reads your analytics and generates ready-to-post social media content for Instagram, Facebook, TikTok and more.",
      badge: settings
        ? settings.social_enabled
          ? settings.social_mode === "automatic"
            ? "🟢 Auto-generating"
            : "🟡 Approval required"
          : "⚫ Disabled"
        : "Loading…",
      badgeColor: "bg-pink-100 text-pink-700",
      cta: "Manage Social →",
      ctaColor: "bg-pink-600 hover:bg-pink-700",
    },
    {
      href: "/admin/growth/settings",
      icon: "⚙️",
      title: "Automation Settings",
      description:
        "Control which features run automatically vs. manually. Adjust timing, message templates, and thresholds for every campaign.",
      badge: "Customize defaults",
      badgeColor: "bg-gray-100 text-gray-600",
      cta: "Open Settings →",
      ctaColor: "bg-gray-700 hover:bg-gray-800",
    },
  ];

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">🚀</span>
          <h1 className="text-2xl font-bold text-gray-900">AI Growth Hub</h1>
        </div>
        <p className="text-gray-500 text-sm max-w-2xl">
          Your AI-powered business growth engine. It monitors your analytics 24/7,
          identifies opportunities, and automatically reaches out to customers — so you
          can focus on running your business.
        </p>
      </div>

      {/* Status Banner */}
      {!loading && settings && (
        <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-100 flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-sm font-semibold text-purple-800">
              {[
                settings.winback_enabled && settings.winback_mode === "automatic" && "Win-Back",
                settings.referral_enabled && settings.referral_mode === "automatic" && "Referrals",
                settings.social_enabled && settings.social_mode === "automatic" && "Social Posts",
              ]
                .filter(Boolean)
                .join(", ") || "No features"}{" "}
              running automatically
            </p>
            <p className="text-xs text-purple-600 mt-0.5">
              Campaigns run daily at 9 AM via your cron job
            </p>
          </div>
          <Link
            href="/admin/growth/settings"
            className="text-xs font-semibold text-purple-700 underline underline-offset-2"
          >
            Adjust settings
          </Link>
        </div>
      )}

      {/* Feature Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {features.map((f) => (
          <div
            key={f.href}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col gap-4 hover:shadow-md transition"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{f.icon}</span>
                <h2 className="text-base font-bold text-gray-900">{f.title}</h2>
              </div>
              <span className={`text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap ${f.badgeColor}`}>
                {f.badge}
              </span>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed">{f.description}</p>
            <Link
              href={f.href}
              className={`mt-auto inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white rounded-lg transition ${f.ctaColor}`}
            >
              {f.cta}
            </Link>
          </div>
        ))}
      </div>

      {/* Cron Setup Reminder */}
      <div className="mt-8 p-4 bg-amber-50 border border-amber-200 rounded-xl">
        <p className="text-sm font-semibold text-amber-800 mb-1">⏰ Cron Job Setup Required</p>
        <p className="text-xs text-amber-700">
          For automatic campaigns to run daily, add this URL to your cronjobs.org schedule (daily at 9 AM):
        </p>
        <code className="block mt-2 text-xs bg-white border border-amber-200 rounded px-3 py-2 text-gray-700 break-all">
          GET {typeof window !== "undefined" ? window.location.origin : "https://your-domain.com"}/api/cron/growth-hub
        </code>
        <p className="text-xs text-amber-600 mt-1">
          Set the Authorization header to: <code className="font-mono">Bearer YOUR_CRON_SECRET</code>
        </p>
      </div>
    </div>
  );
}
