"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

interface AiInsight {
  id: string;
  category: string;
  priority: string;
  title: string;
  description: string;
  metric_label: string | null;
  metric_value: string | null;
  action_label: string | null;
  action_url: string | null;
  created_at: string;
}

interface InsightsResponse {
  insights: AiInsight[];
  cached: boolean;
  generated_at: string | null;
}

const PRIORITY_STYLES: Record<string, string> = {
  high: "bg-red-100 text-red-700 border-red-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  low: "bg-blue-100 text-blue-700 border-blue-200",
};

const CATEGORY_ICONS: Record<string, string> = {
  revenue: "💰",
  bookings: "📅",
  customers: "👥",
  marketing: "📣",
  operations: "⚙️",
  general: "💡",
};

export default function InsightsPage() {
  const [data, setData] = useState<InsightsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (forceRefresh = false) => {
    try {
      const url = forceRefresh
        ? "/api/growth/insights?force=true"
        : "/api/growth/insights";
      const res = await fetch(url);
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  };

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  };

  if (loading) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-2xl">🧠</span>
          <h1 className="text-2xl font-bold text-gray-900">AI Business Insights</h1>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
        <p className="text-center text-sm text-gray-400 mt-6">
          Analyzing your business data… this may take up to 15 seconds on first load.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-2xl">🧠</span>
          <h1 className="text-2xl font-bold text-gray-900">AI Business Insights</h1>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-700 font-semibold mb-2">Could not load insights</p>
          <p className="text-red-600 text-sm mb-4">{error}</p>
          <button
            onClick={() => { setError(null); setLoading(true); load().finally(() => setLoading(false)); }}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const insights = data?.insights ?? [];
  const high = insights.filter((i) => i.priority === "high");
  const medium = insights.filter((i) => i.priority === "medium");
  const low = insights.filter((i) => i.priority === "low");

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-2xl">🧠</span>
            <h1 className="text-2xl font-bold text-gray-900">AI Business Insights</h1>
          </div>
          <p className="text-sm text-gray-500">
            {data?.cached
              ? `Showing cached analysis${data.generated_at ? ` from ${new Date(data.generated_at).toLocaleString()}` : ""}`
              : "Fresh analysis based on your latest data"}
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition"
        >
          {refreshing ? "Analyzing…" : "🔄 Refresh Insights"}
        </button>
      </div>

      {insights.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-10 text-center">
          <p className="text-4xl mb-3">📊</p>
          <p className="text-gray-700 font-semibold mb-1">No insights yet</p>
          <p className="text-gray-500 text-sm mb-4">
            Click "Refresh Insights" to run your first AI analysis.
          </p>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {refreshing ? "Analyzing…" : "Run Analysis Now"}
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {/* High Priority */}
          {high.length > 0 && (
            <section>
              <h2 className="text-sm font-bold text-red-600 uppercase tracking-wide mb-3">
                🔴 High Priority — Act Now
              </h2>
              <div className="space-y-3">
                {high.map((insight) => (
                  <InsightCard key={insight.id} insight={insight} />
                ))}
              </div>
            </section>
          )}

          {/* Medium Priority */}
          {medium.length > 0 && (
            <section>
              <h2 className="text-sm font-bold text-amber-600 uppercase tracking-wide mb-3">
                🟡 Opportunities
              </h2>
              <div className="space-y-3">
                {medium.map((insight) => (
                  <InsightCard key={insight.id} insight={insight} />
                ))}
              </div>
            </section>
          )}

          {/* Low Priority */}
          {low.length > 0 && (
            <section>
              <h2 className="text-sm font-bold text-blue-600 uppercase tracking-wide mb-3">
                🔵 Good to Know
              </h2>
              <div className="space-y-3">
                {low.map((insight) => (
                  <InsightCard key={insight.id} insight={insight} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <div className="mt-8 text-center">
        <Link href="/admin/growth" className="text-sm text-gray-400 hover:text-gray-600">
          ← Back to AI Growth Hub
        </Link>
      </div>
    </div>
  );
}

function InsightCard({ insight }: { insight: AiInsight }) {
  const icon = CATEGORY_ICONS[insight.category] ?? "💡";
  const priorityStyle = PRIORITY_STYLES[insight.priority] ?? PRIORITY_STYLES.low;
  const metricValue =
    insight.metric_value !== null && insight.metric_value !== undefined
      ? typeof insight.metric_value === "object"
        ? JSON.stringify(insight.metric_value)
        : String(insight.metric_value)
      : null;

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 flex gap-4 hover:shadow-md transition">
      <div className="text-2xl mt-0.5 shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-1">
          <h3 className="text-sm font-bold text-gray-900">{insight.title}</h3>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${priorityStyle}`}>
            {insight.priority}
          </span>
        </div>
        <p className="text-sm text-gray-600 leading-relaxed">{insight.description}</p>
        {insight.metric_label && metricValue && (
          <div className="mt-3 inline-flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">
            <span className="text-xs text-gray-500">{insight.metric_label}:</span>
            <span className="text-sm font-bold text-gray-900">{metricValue}</span>
          </div>
        )}
        {insight.action_label && insight.action_url && (
          <div className="mt-3">
            <Link
              href={insight.action_url}
              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 underline underline-offset-2"
            >
              {insight.action_label} →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
