// file: app/admin/notifications-log/page.tsx
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

interface NotificationEntry {
  id: string;
  created_at: string;
  title: string;
  body: string;
  url: string | null;
  read: boolean;
  target_type: string;
}

export default function AdminNotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    loadNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadNotifications = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: business } = await supabase
      .from("businesses")
      .select("id")
      .eq("owner_user_id", user.id)
      .single();

    if (!business) return;

    const { data } = await supabase
      .from("notification_log")
      .select("*")
      .eq("business_id", business.id)
      .order("created_at", { ascending: false })
      .limit(50);

    setNotifications(data || []);

    // Mark all as read
    await supabase
      .from("notification_log")
      .update({ read: true })
      .eq("business_id", business.id)
      .eq("read", false);

    setLoading(false);
  };

  const formatTime = (ts: string) => {
    const date = new Date(ts);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const getIcon = (title: string) => {
    if (title.includes("Cancelled")) return "❌";
    if (title.includes("Confirmed")) return "✅";
    if (title.includes("Booking")) return "📅";
    if (title.includes("Reminder")) return "⏰";
    return "🔔";
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Notifications</h1>
            <p className="text-gray-600 mt-1">Recent alerts and updates</p>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
              <div className="text-6xl mb-4">🔔</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                No notifications yet
              </h3>
              <p className="text-gray-600">
                You&apos;ll see booking alerts and updates here
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={`bg-white rounded-xl shadow-sm border p-5 ${
                    !n.read ? "border-blue-200 bg-blue-50" : "border-gray-100"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className="text-2xl">{getIcon(n.title)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-gray-900">{n.title}</p>
                        <p className="text-xs text-gray-400 whitespace-nowrap">
                          {formatTime(n.created_at)}
                        </p>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{n.body}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
