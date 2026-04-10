"use client";
import Link from "next/link";

export default function GrowthHubPage() {
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
      href: "/admin/growth/settings",
      icon: "⚙️",
      title: "Automation Settings",
      description:
        "Control AI settings and adjust thresholds for your growth automation.",
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
    </div>
  );
}
