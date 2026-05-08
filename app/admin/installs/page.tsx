"use client";

import { useEffect, useState } from "react";

interface InstallStats {
  total: number;
  byDevice: Record<string, number>;
  byReferrer: { slug: string; count: number }[];
  recent: { id: string; installed_at: string; device_type: string; referrer_slug: string | null }[];
}

interface CustomerDeviceStats {
  total: number;
  appInstalled: number;
  byDevice: Record<string, number>;
}

const DEVICE_ICONS: Record<string, string> = {
  ios: "📱",
  ipad: "🖥️",
  android: "🤖",
  desktop: "💻",
  unknown: "❓",
};

const DEVICE_LABELS: Record<string, string> = {
  ios: "iPhone",
  ipad: "iPad",
  android: "Android",
  desktop: "Desktop",
  unknown: "Unknown",
};

export default function InstallsPage() {
  const [hubStats, setHubStats] = useState<InstallStats | null>(null);
  const [customerStats, setCustomerStats] = useState<CustomerDeviceStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/installs")
      .then(r => r.json())
      .then(data => {
        setHubStats(data.hub);
        setCustomerStats(data.customers);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-8 max-w-4xl mx-auto bg-white min-h-screen">
        <div className="flex items-center gap-3 mb-8">
          <span className="text-2xl">📲</span>
          <h1 className="text-2xl font-bold text-gray-900">App Installs</h1>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="h-28 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto bg-white min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-2xl">📲</span>
          <h1 className="text-2xl font-bold text-gray-900">App Installs</h1>
        </div>
        <p className="text-sm text-gray-500">
          Hub PWA installs and customer device breakdown across your businesses.
        </p>
      </div>

      {/* ── Hub Installs ── */}
      <section className="mb-8">
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-4">Business Hub Installs</h2>

        {/* Total */}
        <div className="bg-violet-50 border border-violet-200 rounded-2xl p-5 mb-4 flex items-center gap-4">
          <div className="text-4xl">🚀</div>
          <div>
            <p className="text-3xl font-black text-violet-700">{hubStats?.total ?? 0}</p>
            <p className="text-sm text-gray-500">Total hub installs</p>
          </div>
        </div>

        {/* By device */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {["ios", "ipad", "android", "desktop"].map(type => (
            <div key={type} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm text-center">
              <p className="text-2xl mb-1">{DEVICE_ICONS[type]}</p>
              <p className="text-xl font-bold text-gray-900">{hubStats?.byDevice[type] ?? 0}</p>
              <p className="text-xs text-gray-500">{DEVICE_LABELS[type]}</p>
            </div>
          ))}
        </div>

        {/* By referrer */}
        {(hubStats?.byReferrer?.length ?? 0) > 0 && (
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden mb-4">
            <div className="px-5 py-3 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-700">Installs by Business</p>
            </div>
            {hubStats!.byReferrer.map(r => (
              <div key={r.slug} className="flex items-center justify-between px-5 py-3 border-b border-gray-50 last:border-0">
                <span className="text-sm text-gray-700 font-medium">/{r.slug}</span>
                <span className="text-sm font-bold text-violet-700">{r.count}</span>
              </div>
            ))}
          </div>
        )}

        {/* Recent installs */}
        {(hubStats?.recent?.length ?? 0) > 0 && (
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-700">Recent Installs</p>
            </div>
            {hubStats!.recent.map(install => (
              <div key={install.id} className="flex items-center justify-between px-5 py-3 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-3">
                  <span className="text-lg">{DEVICE_ICONS[install.device_type] ?? "❓"}</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{DEVICE_LABELS[install.device_type] ?? install.device_type}</p>
                    {install.referrer_slug && (
                      <p className="text-xs text-gray-400">via /{install.referrer_slug}</p>
                    )}
                  </div>
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(install.installed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        )}

        {hubStats?.total === 0 && (
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-8 text-center">
            <p className="text-3xl mb-2">📭</p>
            <p className="text-gray-600 font-semibold text-sm">No hub installs recorded yet</p>
            <p className="text-gray-400 text-xs mt-1">Installs are tracked when customers add the hub to their home screen.</p>
          </div>
        )}
      </section>

      {/* ── Customer App Usage ── */}
      <section>
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-4">Customer App Usage</h2>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm text-center">
            <p className="text-3xl font-black text-gray-900">{customerStats?.total ?? 0}</p>
            <p className="text-xs text-gray-500 mt-1">Customers tracked</p>
          </div>
          <div className="bg-white border border-green-100 rounded-xl p-4 shadow-sm text-center">
            <p className="text-3xl font-black text-green-600">{customerStats?.appInstalled ?? 0}</p>
            <p className="text-xs text-gray-500 mt-1">Using the app</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {["ios", "ipad", "android", "desktop"].map(type => (
            <div key={type} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm text-center">
              <p className="text-2xl mb-1">{DEVICE_ICONS[type]}</p>
              <p className="text-xl font-bold text-gray-900">{customerStats?.byDevice[type] ?? 0}</p>
              <p className="text-xs text-gray-500">{DEVICE_LABELS[type]}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
