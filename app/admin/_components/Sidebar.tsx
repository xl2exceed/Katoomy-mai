"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type SidebarProps = {
  businessId: string | null;
  plan: string; // "free" | "pro" | "premium" etc
  status: string | null; // "active", "trialing", etc
};

export default function Sidebar({ businessId, plan, status }: SidebarProps) {
  const supabase = createClient();
  const router = useRouter();
  const pathname = usePathname();
  const [showMobileQR, setShowMobileQR] = useState(false);

  const navLink = (href: string, icon: string, label: string) => {
    const isActive = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
    return (
      <Link
        href={href}
        className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg transition ${
          isActive
            ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-sm"
            : "text-gray-700 hover:bg-gray-50"
        }`}
      >
        <span className="mr-3">{icon}</span>
        {label}
      </Link>
    );
  };

  const mobileUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/admin/mobile/menu`
      : "https://katoomy-new.vercel.app/admin/mobile/menu";

  // Staff access rule (adjust as needed)
  const hasStaffAccess = plan !== "free";

  const openBillingPortal = async () => {
    try {
      if (!businessId) {
        alert("Missing business ID. Please refresh and try again.");
        return;
      }

      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to open portal");

      window.location.href = json.url;
    } catch (e) {
      console.error(e);
      alert("Could not open billing portal. Please try again.");
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/admin/login"); // or "/" if that's your landing/login
    router.refresh();
  };

  return (
    <>
      <aside className="w-64 bg-white border-r border-gray-200 min-h-screen">
      {/* Brand / Header */}
      <div className="p-6">
        <Image
          src="/brand/katoomy-logo.png"
          alt="Katoomy Logo"
          width={32}
          height={32}
          className="w-8 h-8"
        />
        <h2 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-purple-900 bg-clip-text text-transparent">
          Katoomy
        </h2>
        <p className="text-sm text-gray-500 mt-1">Business Dashboard</p>

        {/* Plan Badge */}
        <div className="mt-4 rounded-lg border bg-gray-50 px-3 py-2">
          <div className="text-xs text-gray-500">Current Plan</div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold capitalize">{plan}</span>
            {status && (
              <span className="text-xs text-gray-400">({status})</span>
            )}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="px-3 space-y-1">
        {/* ── Schedule & Services ── */}
        {navLink("/admin", "🏠", "Overview")}
        {navLink("/admin/bookings", "📅", "My Schedule")}
        {navLink("/admin/services", "✂️", "Services")}
        {navLink("/admin/availability", "🕒", "Availability")}
        {hasStaffAccess && navLink("/admin/staff", "👔", "Staff")}
        {navLink("/admin/customers", "👥", "Customers")}

        {/* ── Payments ── */}
        <p className="px-3 pt-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">Payments</p>
        {navLink("/admin/stripe", "💰", "Payment Setup")}
        {navLink("/admin/cashapp", "💵", "Cash App Settings")}
        {navLink("/admin/take-payment", "💳", "Take Payment")}
        {navLink("/admin/payments", "📋", "Payment Ledger")}
        {navLink("/admin/revenue", "📊", "Revenue")}

        {/* ── Marketing & Growth ── */}
        <p className="px-3 pt-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">Marketing</p>
        {navLink("/admin/analytics", "📈", "Analytics")}
        {navLink("/admin/campaigns", "📣", "Campaigns")}
        {navLink("/admin/loyalty", "⭐", "Rewards")}
        {navLink("/admin/referrals", "🎁", "Referrals")}
        {navLink("/admin/membership", "💎", "Membership")}
        {navLink("/admin/growth", "🚀", "AI Growth Hub")}

        {/* ── Settings ── */}
        <p className="px-3 pt-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">Settings</p>
        {navLink("/admin/notifications", "💬", "Messages")}
        {navLink("/admin/notifications-log", "🔔", "Notifications")}
        {navLink("/admin/branding", "🎨", "Branding")}
        {navLink("/admin/settings", "⚙️", "Settings")}

        {/* Mobile View */}
        <div className="flex items-center gap-1">
          <Link
            href="/admin/mobile/menu"
            className={`flex-1 flex items-center px-3 py-2 text-sm font-medium rounded-lg transition ${
              pathname.startsWith("/admin/mobile")
                ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-sm"
                : "text-gray-700 hover:bg-gray-50"
            }`}
          >
            <span className="mr-3">📱</span>
            Mobile View
          </Link>
          <button
            type="button"
            onClick={() => setShowMobileQR(true)}
            title="Open on phone"
            className="px-2 py-2 text-base rounded-lg text-gray-500 hover:bg-gray-100"
          >
            📱
          </button>
        </div>

        {/* Upgrade CTA (hide only on Pro) */}
        {plan !== "pro" && (
          <div className="pt-3">
            <Link
              href="/admin/upgrade"
              className="flex items-center justify-center px-3 py-2.5 text-sm font-semibold rounded-lg bg-gradient-to-r from-purple-600 to-purple-700 text-white hover:from-purple-700 hover:to-purple-800 transition shadow-md"
            >
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
              Upgrade
            </Link>
          </div>
        )}

        {/* Manage Subscription (beneath Upgrade) */}
        {plan !== "free" && (
          <div className="pt-2">
            <button
              type="button"
              onClick={openBillingPortal}
              className="w-full flex items-center justify-center px-3 py-2.5 text-sm font-semibold rounded-lg bg-gray-900 text-white hover:bg-black transition shadow-sm cursor-pointer"
            >
              Manage Subscription
            </button>
          </div>
        )}

        {/* Logout (VERY LAST BUTTON in sidebar) */}
        <div className="pt-2 pb-6">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center px-3 py-2.5 text-sm font-semibold rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition cursor-pointer"
          >
            Log out
          </button>
        </div>
      </nav>
    </aside>


      {/* Mobile QR Modal */}
      {showMobileQR && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowMobileQR(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl p-6 max-w-xs w-full text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-gray-900 mb-1">
              Open on Your Phone
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Scan to open the Katoomy mobile admin
            </p>
            <div className="flex justify-center mb-4">
              <Image
                src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(mobileUrl)}`}
                alt="Mobile admin QR code"
                width={220}
                height={220}
                className="rounded-lg border border-gray-200"
                unoptimized
              />
            </div>
            <div className="text-left mb-4">
              <p className="text-xs font-semibold text-gray-600 mb-1">Mobile Link</p>
              <div className="p-2 bg-gray-50 rounded-lg break-all text-xs text-gray-700 mb-2 border border-gray-200">
                {mobileUrl}
              </div>
              <button
                onClick={() => { navigator.clipboard.writeText(mobileUrl); alert("Link copied!"); }}
                className="w-full py-2 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition text-sm"
              >
                📋 Copy Link
              </button>
            </div>
            <button
              onClick={() => setShowMobileQR(false)}
              className="w-full py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}