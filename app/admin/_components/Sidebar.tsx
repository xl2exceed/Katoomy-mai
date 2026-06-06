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

const GROWTH_HUB_PATHS = [
  "/admin/revenue", "/admin/analytics", "/admin/membership", "/admin/growth",
  "/admin/notifications", "/admin/notifications-log", "/admin/settings",
  "/admin/payment-settings", "/admin/take-payment", "/admin/installs",
];

// Routes where exact match is required (to avoid /admin prefix matching everything)
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
  const [growthHubOpen, setGrowthHubOpen] = useState(false);
  const [skippedPayments, setSkippedPayments] = useState({ paymentSetup: false, paymentSettings: false });

  // Load skipped payment state from localStorage (set during onboarding), scoped by business
  useEffect(() => {
    if (!businessId) return;
    try {
      const stored = localStorage.getItem(`onboarding-skipped-${businessId}`);
      if (stored) setSkippedPayments(JSON.parse(stored));
    } catch {}
  }, [businessId]);

  // Auto-open Growth Hub if current page is inside it; persist toggle state
  useEffect(() => {
    const insideHub = GROWTH_HUB_PATHS.some((p) => pathname.startsWith(p));
    if (insideHub) {
      setGrowthHubOpen(true);
      return;
    }
    try {
      const stored = localStorage.getItem("growthHubOpen");
      if (stored === "true") setGrowthHubOpen(true);
    } catch {}
  }, [pathname]);

  const toggleGrowthHub = () => {
    setGrowthHubOpen((prev) => {
      const next = !prev;
      try { localStorage.setItem("growthHubOpen", String(next)); } catch {}
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

  const navLink = (
    href: string,
    icon: string,
    label: string,
    showDot?: boolean | "yellow",
  ) => {
    const isActive = EXACT_ROUTES.includes(href)
      ? pathname === href
      : pathname.startsWith(href);
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
        {showDot !== undefined && dot(showDot)}
      </Link>
    );
  };

  const section = (label: string) => (
    <p className="px-3 pt-4 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
      {label}
    </p>
  );

  const mobileUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/admin/mobile/menu`
      : `${process.env.NEXT_PUBLIC_APP_URL || "https://katoomy.com"}/admin/mobile/menu`;

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
    try { localStorage.removeItem("onboarding-skipped"); } catch {}
    await supabase.auth.signOut();
    router.push("/admin/login");
    router.refresh();
  };

  // ── Onboarding mode: restricted to setup steps only ───────────────────────
  if (!onboardingCompleted) {
    return (
      <>
        <aside className="w-64 bg-white border-r border-gray-200 h-full overflow-y-auto flex-shrink-0">
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

            {section("Setup Steps")}
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
      </>
    );
  }

  // ── Full sidebar ──────────────────────────────────────────────────────────
  return (
    <>
      <aside className="w-64 bg-white border-r border-gray-200 h-full overflow-y-auto flex-shrink-0">
        {/* Header */}
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

        <nav className="px-3 space-y-1">
          {/* ── GROWTH ── */}
          {section("Growth")}
          {navLink("/admin/network", "⭐", "My Network", dots.network)}
          {navLink("/admin", "🏠", "Overview")}
          {navLink("/admin/bookings", "📅", "My Schedule")}
          {navLink("/admin/customers", "👥", "Customers")}

          {/* ── MARKETING ── */}
          {section("Marketing")}
          {navLink("/admin/campaigns", "📣", "Campaigns", dots.campaigns)}
          {navLink("/admin/loyalty", "⭐", "Rewards", dots.rewards)}
          {navLink("/admin/referrals", "🎁", "Referrals", true)}

          {/* ── OPERATIONS ── */}
          {section("Operations")}
          {isCarwash
            ? navLink("/admin/services", "🚗", "Services", dots.services)
            : isLawnCare
            ? navLink("/admin/services", "🌿", "Services", dots.services)
            : navLink("/admin/services", "✂️", "Services", dots.services)}
          {navLink("/admin/availability", "🕒", "Availability", dots.availability)}
          {hasStaffAccess && navLink("/admin/staff", "👔", "Staff", dots.staff)}
          {navLink("/admin/branding", "🎨", "Branding", dots.branding)}

          {/* Mobile View with QR shortcut */}
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
              📲
            </button>
          </div>

          {navLink("/admin/stripe", "💰", "Payment Setup", dots.paymentSetup ? true : skippedPayments.paymentSetup ? "yellow" : false)}
          {navLink("/admin/payments", "📋", "Payment Ledger")}
          {isCarwash && navLink("/admin/carwash", "⚙️", "Car Wash Settings")}
          {isLawnCare && navLink("/admin/lawncare", "🌿", "Lawn Care Settings")}
          {isLawnCare && navLink("/admin/recurring", "🔄", "Recurring Schedules")}

          {/* ── GROWTH HUB (collapsible) ── */}
          <button
            type="button"
            onClick={toggleGrowthHub}
            className="w-full flex items-center px-3 pt-4 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-600 transition"
          >
            <span className="flex-1 text-left">Growth Hub</span>
            <span className="text-[10px]">{growthHubOpen ? "▲" : "▼"}</span>
          </button>

          {growthHubOpen && (
            <div className="space-y-1">
              {navLink("/admin/revenue", "📊", "Revenue")}
              {navLink("/admin/analytics", "📈", "Analytics")}
              {navLink("/admin/membership", "💎", "Membership", dots.membership)}
              {navLink("/admin/growth", "🚀", "AI Growth Hub")}
              {navLink("/admin/notifications", "💬", "Messages")}
              {navLink("/admin/notifications-log", "🔔", "Notifications")}
              {navLink("/admin/settings", "⚙️", "Settings")}
              {navLink("/admin/payment-settings", "💵", "Payment Settings", dots.paymentSettings ? true : skippedPayments.paymentSettings ? "yellow" : false)}
              {navLink("/admin/take-payment", "💳", "Take Payment")}
              {navLink("/admin/installs", "📲", "App Installs")}
              {plan !== "free" && (
                <div className="pt-1 pb-1">
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

          {/* Upgrade CTA */}
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
              <p className="text-xs font-semibold text-gray-600 mb-1">
                Mobile Link
              </p>
              <div className="p-2 bg-gray-50 rounded-lg break-all text-xs text-gray-700 mb-2 border border-gray-200">
                {mobileUrl}
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(mobileUrl);
                  alert("Link copied!");
                }}
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
