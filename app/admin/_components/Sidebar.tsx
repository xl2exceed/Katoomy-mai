"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type SidebarDots = {
  services: boolean;
  availability: boolean;
  branding: boolean;
  paymentSetup: boolean;
  paymentSettings: boolean;
  staff: boolean;
  campaigns: boolean;
  rewards: boolean;
  membership: boolean;
  network: boolean;
};

type SidebarProps = {
  businessId: string | null;
  plan: string;
  status: string | null;
  niche?: string;
  onboardingCompleted: boolean;
  dots: SidebarDots;
};

const OPERATIONS_PATHS = [
  "/admin/bookings", "/admin/services", "/admin/availability",
  "/admin/branding", "/admin/staff", "/admin/mobile", "/admin/take-payment",
  "/admin/carwash", "/admin/lawncare", "/admin/recurring",
];
const GROWTH_PATHS = [
  "/admin/network", "/admin/campaigns", "/admin/membership", "/admin/referrals",
];
const TOOLS_PATHS = [
  "/admin/notifications-log", "/admin/revenue", "/admin/analytics",
  "/admin/growth", "/admin/payments",
];
const SETTINGS_PATHS = [
  "/admin/settings", "/admin/loyalty", "/admin/stripe", "/admin/payment-settings",
];

const EXACT_ROUTES = ["/admin", "/admin/notifications", "/admin/notifications-log"];

export default function Sidebar({
  businessId,
  plan,
  status,
  niche = "barber",
  onboardingCompleted,
  dots,
}: SidebarProps) {
  const isCarwash = niche === "carwash";
  const isLawnCare = niche === "lawn_care";
  const supabase = createClient();
  const router = useRouter();
  const pathname = usePathname();

  const [showMobileQR, setShowMobileQR] = useState(false);
  const [skippedPayments, setSkippedPayments] = useState({ paymentSetup: false, paymentSettings: false });
  const [operationsOpen, setOperationsOpen] = useState(false);
  const [growthOpen, setGrowthOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Single floating tooltip state
  const [activeTooltip, setActiveTooltip] = useState<{ text: string; y: number } | null>(null);

  useEffect(() => {
    if (!businessId) return;
    try {
      const stored = localStorage.getItem(`onboarding-skipped-${businessId}`);
      if (stored) setSkippedPayments(JSON.parse(stored));
    } catch {}
  }, [businessId]);

  useEffect(() => {
    const inOps = pathname === "/admin" || OPERATIONS_PATHS.some((p) => pathname.startsWith(p));
    const inGrowth = GROWTH_PATHS.some((p) => pathname.startsWith(p));
    const inTools = TOOLS_PATHS.some((p) => pathname.startsWith(p));
    const inSettings =
      pathname === "/admin/notifications" || SETTINGS_PATHS.some((p) => pathname.startsWith(p));

    if (inOps) setOperationsOpen(true);
    if (inGrowth) setGrowthOpen(true);
    if (inTools) setToolsOpen(true);
    if (inSettings) setSettingsOpen(true);

    try {
      if (!inOps && localStorage.getItem("section-ops") === "true") setOperationsOpen(true);
      if (!inGrowth && localStorage.getItem("section-growth") === "true") setGrowthOpen(true);
      if (!inTools && localStorage.getItem("section-tools") === "true") setToolsOpen(true);
      if (!inSettings && localStorage.getItem("section-settings") === "true") setSettingsOpen(true);
    } catch {}
  }, [pathname]);

  const makeToggle = (
    key: string,
    setter: React.Dispatch<React.SetStateAction<boolean>>,
  ) => () => {
    setter((prev) => {
      const next = !prev;
      try { localStorage.setItem(key, String(next)); } catch {}
      return next;
    });
  };

  const dot = (active: boolean | "yellow") => (
    <span
      className={`ml-auto w-2 h-2 rounded-full flex-shrink-0 ${
        active === true ? "bg-green-500" : active === "yellow" ? "bg-yellow-400" : "bg-gray-300"
      }`}
    />
  );

  const showTip = (text: string, e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setActiveTooltip({ text, y: rect.top + rect.height / 2 });
  };
  const hideTip = () => setActiveTooltip(null);

  const navLink = (
    href: string,
    icon: string,
    label: string,
    showDot?: boolean | "yellow",
    tooltip?: string,
  ) => {
    const isActive = EXACT_ROUTES.includes(href)
      ? pathname === href
      : pathname.startsWith(href);
    return (
      <Link
        href={href}
        onMouseEnter={tooltip ? (e) => showTip(tooltip, e) : undefined}
        onMouseLeave={tooltip ? hideTip : undefined}
        className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg transition ${
          isActive
            ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-sm"
            : "text-gray-700 hover:bg-gray-50"
        }`}
      >
        <span className="mr-3">{icon}</span>
        {label}
        {showDot !== undefined && dot(showDot)}
      </Link>
    );
  };

  const sectionHeader = (label: string, isOpen: boolean, onToggle: () => void) => (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center px-3 pt-4 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-600 transition"
    >
      <span className="flex-1 text-left">{label}</span>
      <span className="text-[10px]">{isOpen ? "▲" : "▼"}</span>
    </button>
  );

  const mobileUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/admin/mobile/menu`
      : `${process.env.NEXT_PUBLIC_APP_URL || "https://katoomy.com"}/admin/mobile/menu`;

  const openBillingPortal = async () => {
    try {
      if (!businessId) { alert("Missing business ID. Please refresh and try again."); return; }
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
    try { localStorage.removeItem("onboarding-skipped"); } catch {}
    await supabase.auth.signOut();
    router.push("/admin/login");
    router.refresh();
  };

  // ── Onboarding mode ───────────────────────────────────────────────────────
  if (!onboardingCompleted) {
    return (
      <aside className="w-64 bg-white border-r border-gray-200 h-full overflow-y-auto flex-shrink-0">
        <div className="p-6">
          <Image src="/brand/katoomy-logo.png" alt="Katoomy Logo" width={32} height={32} className="w-8 h-8" />
          <h2 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-purple-900 bg-clip-text text-transparent">
            Katoomy
          </h2>
          <p className="text-sm text-gray-500 mt-1">Business Setup</p>
        </div>
        <nav className="px-3 space-y-1">
          <Link
            href="/admin/getting-started"
            className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg transition ${
              pathname === "/admin/getting-started"
                ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-sm"
                : "text-gray-700 hover:bg-gray-50"
            }`}
          >
            <span className="mr-3">🏁</span>
            Getting Started
          </Link>
          <p className="px-3 pt-4 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Setup Steps
          </p>
          {navLink("/admin/branding", "🎨", "Branding", dots.branding)}
          {navLink("/admin/availability", "🕒", "Availability", dots.availability)}
          {isCarwash
            ? navLink("/admin/services", "🚗", "Services", dots.services)
            : isLawnCare
            ? navLink("/admin/services", "🌿", "Services", dots.services)
            : navLink("/admin/services", "✂️", "Services", dots.services)}
          {isCarwash && navLink("/admin/carwash", "⚙️", "Car Wash Settings")}
          {isLawnCare && navLink("/admin/lawncare", "🌿", "Lawn Care Settings")}
          {navLink("/admin/stripe", "💰", "Payment Setup", dots.paymentSetup ? true : skippedPayments.paymentSetup ? "yellow" : false)}
          {navLink("/admin/payment-settings", "💵", "Payment Settings", dots.paymentSettings ? true : skippedPayments.paymentSettings ? "yellow" : false)}
        </nav>
        <div className="px-3 pt-4 pb-6">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center px-3 py-2.5 text-sm font-semibold rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition cursor-pointer"
          >
            Log out
          </button>
        </div>
      </aside>
    );
  }

  // ── Full sidebar ──────────────────────────────────────────────────────────
  return (
    <>
      <aside className="w-64 bg-white border-r border-gray-200 h-full overflow-y-auto flex-shrink-0">
        <div className="p-6">
          <Image src="/brand/katoomy-logo.png" alt="Katoomy Logo" width={32} height={32} className="w-8 h-8" />
          <h2 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-purple-900 bg-clip-text text-transparent">
            Katoomy
          </h2>
          <p className="text-sm text-gray-500 mt-1">Business Dashboard</p>
          <div className="mt-4 rounded-lg border bg-gray-50 px-3 py-2">
            <div className="text-xs text-gray-500">Current Plan</div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold capitalize">{plan}</span>
              {status && <span className="text-xs text-gray-400">({status})</span>}
            </div>
          </div>
        </div>

        <nav className="px-3 space-y-1 pb-6">

          {/* ── OPERATIONS ── */}
          {sectionHeader("Operations", operationsOpen, makeToggle("section-ops", setOperationsOpen))}
          {operationsOpen && (
            <div className="space-y-1">
              {navLink("/admin", "🏠", "Overview", undefined,
                "Your main dashboard — see today's bookings, recent activity, and a quick snapshot of your business.")}
              {navLink("/admin/bookings", "📅", "My Schedule", undefined,
                "View and manage all your upcoming bookings. Approve, reschedule, or cancel appointments in one place.")}
              {isCarwash
                ? navLink("/admin/services", "🚗", "Services", dots.services,
                    "Add and manage the services you offer. Set the name, price, and duration for each one.")
                : isLawnCare
                ? navLink("/admin/services", "🌿", "Services", dots.services,
                    "Add and manage the services you offer. Set the name, price, and duration for each one.")
                : navLink("/admin/services", "✂️", "Services", dots.services,
                    "Add and manage the services you offer. Set the name, price, and duration for each one.")}
              {navLink("/admin/availability", "🕒", "Availability", dots.availability,
                "Set the days and hours you're open for bookings. Customers can only book during the times you define here.")}
              {navLink("/admin/branding", "🎨", "Branding", dots.branding,
                "Customize your business profile — upload your logo, update your name and address, and style your booking page.")}
              {navLink("/admin/staff", "👔", "Staff", dots.staff,
                "Add and manage your staff members. Each staff member gets their own secure login and personal schedule.")}

              {/* Mobile with QR shortcut */}
              <div
                onMouseEnter={(e) => showTip("A mobile-friendly view of your admin panel. Tap the 📲 button to get a QR code you can scan to open it on your phone.", e)}
                onMouseLeave={hideTip}
                className="flex items-center gap-1"
              >
                <Link
                  href="/admin/mobile/menu"
                  className={`flex-1 flex items-center px-3 py-2 text-sm font-medium rounded-lg transition ${
                    pathname.startsWith("/admin/mobile")
                      ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-sm"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <span className="mr-3">📱</span>
                  Mobile
                </Link>
                <button
                  type="button"
                  onClick={() => setShowMobileQR(true)}
                  title="Open on phone"
                  className="px-2 py-2 text-base rounded-lg text-gray-500 hover:bg-gray-100"
                >
                  📲
                </button>
              </div>

              {navLink("/admin/take-payment", "💳", "Take Payments", undefined,
                "Manually charge a customer or record a payment on the spot, without needing a booking.")}
              {isCarwash && navLink("/admin/carwash", "⚙️", "Car Wash Settings", undefined,
                "Configure the vehicle types you service, your package tiers, and optional add-ons customers can choose.")}
              {isLawnCare && navLink("/admin/lawncare", "🌿", "Lawn Care Settings", undefined,
                "Set your service area, travel fees, and pricing adjustments based on property size.")}
              {isLawnCare && navLink("/admin/recurring", "🔄", "Recurring Schedules", undefined,
                "Create repeating appointments for customers who book on a regular weekly or monthly schedule.")}
            </div>
          )}

          {/* ── GROWTH ── */}
          {sectionHeader("Growth", growthOpen, makeToggle("section-growth", setGrowthOpen))}
          {growthOpen && (
            <div className="space-y-1">
              {navLink("/admin/network", "⭐", "My Network", dots.network,
                "Connect with other local businesses, send and receive referrals, and grow your customer base together.")}
              {navLink("/admin/campaigns", "📣", "Campaigns", dots.campaigns,
                "Send targeted SMS messages to your customers based on visit history, last seen date, or loyalty tier.")}
              {navLink("/admin/membership", "💎", "Memberships", dots.membership,
                "Create subscription plans that give customers ongoing access to your services or exclusive discounts.")}
              {navLink("/admin/referrals", "🎁", "Referrals", true,
                "Share a unique referral link that gives new customers a discount on their first booking.")}
            </div>
          )}

          {/* ── TOOLS ── */}
          {sectionHeader("Tools", toolsOpen, makeToggle("section-tools", setToolsOpen))}
          {toolsOpen && (
            <div className="space-y-1">
              {navLink("/admin/notifications-log", "🔔", "Notifications", undefined,
                "View a full log of all notifications sent — booking confirmations, reminders, and campaign messages.")}
              {navLink("/admin/revenue", "📊", "Revenue Tracker", undefined,
                "Track your total revenue over any time period, broken down by service and payment method.")}
              {navLink("/admin/analytics", "📈", "Analytics", undefined,
                "Detailed business insights — rebooking rate, customer lifetime value, missed revenue, and smart alerts.")}
              {navLink("/admin/growth", "🚀", "AI Growth Hub", undefined,
                "AI-powered tools to automatically win back lost customers and identify opportunities to grow faster.")}
              {navLink("/admin/payments", "📋", "Payment Ledger", undefined,
                "A complete history of every payment received — card, cash, Cash App, and Zelle all in one place.")}
            </div>
          )}

          {/* ── SETTINGS ── */}
          {sectionHeader("Settings", settingsOpen, makeToggle("section-settings", setSettingsOpen))}
          {settingsOpen && (
            <div className="space-y-1">
              {navLink("/admin/settings", "⚙️", "Settings", undefined,
                "Manage your account details, business preferences, and system-wide notification options.")}
              {navLink("/admin/loyalty", "⭐", "Rewards", dots.rewards,
                "Set up a loyalty points program — customers earn points per visit and can redeem them for discounts.")}
              {navLink("/admin/stripe", "💰", "Payment Setup",
                dots.paymentSetup ? true : skippedPayments.paymentSetup ? "yellow" : false,
                "Connect your Stripe account so customers can pay by card online when they book.")}
              {navLink("/admin/payment-settings", "💵", "Payment Settings",
                dots.paymentSettings ? true : skippedPayments.paymentSettings ? "yellow" : false,
                "Set up Cash App and Zelle so customers can pay you directly from the booking confirmation page.")}
              {navLink("/admin/notifications", "💬", "Automated Message", undefined,
                "Configure automatic SMS messages sent to customers before or after their appointment.")}

              {plan !== "free" && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={openBillingPortal}
                    className="w-full flex items-center justify-center px-3 py-2.5 text-sm font-semibold rounded-lg bg-gray-900 text-white hover:bg-black transition shadow-sm cursor-pointer"
                  >
                    Manage Subscription
                  </button>
                </div>
              )}
            </div>
          )}

          {plan !== "pro" && (
            <div className="pt-3">
              <Link
                href="/admin/upgrade"
                className="flex items-center justify-center px-3 py-2.5 text-sm font-semibold rounded-lg bg-gradient-to-r from-purple-600 to-purple-700 text-white hover:from-purple-700 hover:to-purple-800 transition shadow-md"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Upgrade
              </Link>
            </div>
          )}

          <div className="pt-2">
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

      {/* Floating tooltip — rendered outside the aside to avoid overflow clipping */}
      {activeTooltip && (
        <div
          className="fixed z-[500] pointer-events-none"
          style={{ left: 272, top: activeTooltip.y, transform: "translateY(-50%)" }}
        >
          <div className="relative bg-gray-900 text-white text-xs leading-relaxed rounded-lg px-3 py-2 w-60 shadow-xl">
            <div className="absolute right-full top-1/2 -translate-y-1/2 border-[5px] border-transparent border-r-gray-900" />
            {activeTooltip.text}
          </div>
        </div>
      )}

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
            <h3 className="text-lg font-bold text-gray-900 mb-1">Open on Your Phone</h3>
            <p className="text-sm text-gray-500 mb-4">Scan to open the Katoomy mobile admin</p>
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
