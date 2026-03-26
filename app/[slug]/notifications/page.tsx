// file: app/[slug]/notifications/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
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

interface Business {
  id: string;
  name: string;
  primary_color: string;
}

const PHONE_STORAGE_KEY = "katoomy:customerPhone";

export default function CustomerNotificationsPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [notifications, setNotifications] = useState<NotificationEntry[]>([]);
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [noPhone, setNoPhone] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    loadNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadNotifications = async () => {
    const { data: businessData } = await supabase
      .from("businesses")
      .select("id, name, primary_color")
      .eq("slug", slug)
      .single();

    if (!businessData) {
      setLoading(false);
      return;
    }
    setBusiness(businessData);

    const savedPhone = localStorage.getItem(PHONE_STORAGE_KEY);
    if (!savedPhone) {
      setNoPhone(true);
      setLoading(false);
      return;
    }

    const { data: customer } = await supabase
      .from("customers")
      .select("id")
      .eq("business_id", businessData.id)
      .eq("phone", savedPhone)
      .single();

    if (!customer) {
      setNoPhone(true);
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("notification_log")
      .select("*")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false })
      .limit(50);

    setNotifications(data || []);

    // Mark all as read
    await supabase
      .from("notification_log")
      .update({ read: true })
      .eq("customer_id", customer.id)
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
    if (title.includes("Reminder")) return "⏰";
    if (title.includes("Booking")) return "📅";
    return "🔔";
  };

  const primaryColor = business?.primary_color || "#3B82F6";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div
        className="p-6 text-white"
        style={{
          background: business
            ? `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}DD 100%)`
            : "transparent",
        }}
      >
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Notifications</h1>
            <p className="text-sm opacity-90">{business?.name}</p>
          </div>
          <Link
            href={`/${slug}/dashboard`}
            className="px-4 py-2 bg-white rounded-lg text-sm font-semibold text-gray-900"
          >
            Dashboard
          </Link>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-6">
        {loading ? (
          <div className="text-center py-12">
            <div
              className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto"
              style={{ borderColor: primaryColor }}
            />
          </div>
        ) : noPhone ? (
          <div className="bg-white rounded-xl p-8 text-center shadow-sm border border-gray-200">
            <div className="text-5xl mb-4">🔔</div>
            <p className="font-bold text-gray-900">
              Sign in to see notifications
            </p>
            <Link
              href={`/${slug}/dashboard`}
              className="inline-block mt-4 px-6 py-3 rounded-lg text-white font-semibold"
              style={{ backgroundColor: primaryColor }}
            >
              Go to Dashboard
            </Link>
          </div>
        ) : notifications.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center shadow-sm border border-gray-200">
            <div className="text-5xl mb-4">🔔</div>
            <p className="font-bold text-gray-900">No notifications yet</p>
            <p className="text-gray-600 mt-2 text-sm">
              Appointment confirmations and reminders will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`bg-white rounded-xl shadow-sm border p-5 ${
                  !n.read ? "border-l-4" : "border-gray-100"
                }`}
                style={!n.read ? { borderLeftColor: primaryColor } : {}}
              >
                <div className="flex items-start gap-3">
                  <div className="text-2xl">{getIcon(n.title)}</div>
                  <div className="flex-1">
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
    </div>
  );
}
