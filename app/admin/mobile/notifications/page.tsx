// file: app/admin/mobile/notifications/page.tsx
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

interface NotificationEntry {
  id: string;
  created_at: string;
  title: string;
  body: string;
  url: string | null;
  read: boolean;
}

export default function MobileNotificationsPage() {
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

    if (!business) {
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("notification_log")
      .select("*")
      .eq("business_id", business.id)
      .eq("target_type", "business")
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
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-6 text-white">
        <Link
          href="/admin/mobile/menu"
          className="text-blue-100 text-sm mb-3 block"
        >
          ← Back to Menu
        </Link>
        <h1 className="text-2xl font-bold">Notifications</h1>
        <p className="text-blue-100 text-sm mt-1">
          Recent alerts and booking updates
        </p>
      </div>

      <div className="p-4 max-w-2xl mx-auto">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : notifications.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center shadow-sm border border-gray-200 mt-4">
            <div className="text-5xl mb-4">🔔</div>
            <p className="font-bold text-gray-900">No notifications yet</p>
            <p className="text-gray-600 mt-2 text-sm">
              Booking alerts will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-3 mt-4">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`bg-white rounded-xl shadow-sm p-4 border-l-4 ${
                  !n.read ? "border-blue-500" : "border-gray-200"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="text-2xl">{getIcon(n.title)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-gray-900 text-sm">
                        {n.title}
                      </p>
                      <p className="text-xs text-gray-400 whitespace-nowrap">
                        {formatTime(n.created_at)}
                      </p>
                    </div>
                    <p className="text-sm text-gray-600 mt-0.5">{n.body}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
