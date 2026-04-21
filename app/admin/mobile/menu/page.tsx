// file: app/admin/mobile/menu/page.tsx

"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useStaffFeature } from "@/lib/hooks/useStaffFeature";
import AdminPushPermissionPrompt from "@/components/AdminPushPermissionPrompt";

function darkenHex(hex: string, amount = 40): string {
  const clean = hex.replace("#", "");
  const num = parseInt(clean.length === 3
    ? clean.split("").map((c) => c + c).join("")
    : clean, 16);
  const r = Math.max(0, (num >> 16) - amount);
  const g = Math.max(0, ((num >> 8) & 0xff) - amount);
  const b = Math.max(0, (num & 0xff) - amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

export default function MobileMenuPage() {
  const [businessName, setBusinessName] = useState("");
  const [businessId, setBusinessId] = useState("");
  const [niche, setNiche] = useState("barber");
  const [brandColor, setBrandColor] = useState("#3B82F6");
  const [businessLogo, setBusinessLogo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();
  const { hasAccess: hasStaffAccess } = useStaffFeature();

  useEffect(() => {
    loadBusiness();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadBusiness = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/admin/mobile/login");
      return;
    }

    const { data: business } = await supabase
      .from("businesses")
      .select("name, id, features, primary_color, logo_url")
      .eq("owner_user_id", user.id)
      .single();

    if (business) {
      setBusinessName(business.name);
      setBusinessId(business.id);
      const biz = business as typeof business & { features?: Record<string, string>; primary_color?: string; logo_url?: string | null };
      const features = biz.features || {};
      setNiche(features.niche || "barber");
      if (biz.primary_color) setBrandColor(biz.primary_color);
      if (biz.logo_url) setBusinessLogo(biz.logo_url);
    }

    setLoading(false);
  };

  const menuItems = [
    {
      title: "Today's Schedule",
      icon: "📅",
      href: "/admin/mobile/schedule",
      description: "View today's appointments",
    },
    {
      title: "Revenue",
      icon: "📊",
      href: "/admin/mobile/revenue",
      description: "Business revenue & staff breakdown",
    },
    {
      title: "Analytics",
      icon: "📈",
      href: "/admin/mobile/analytics",
      description: "Trends, top services & customers",
    },
    {
      title: "Appointments",
      icon: "✅",
      href: "/admin/mobile/appointments",
      description: "Accept or decline bookings",
    },
    // HIDDEN ON MOBILE — uncomment to restore
    // {
    //   title: "Campaigns",
    //   icon: "📣",
    //   href: "/admin/campaigns",
    //   description: "SMS campaigns & win-backs",
    // },
    {
      title: "Messages",
      icon: "💬",
      href: "/admin/mobile/messages",
      description: "Send and view messages",
    },
    {
      title: "Customers",
      icon: "👥",
      href: "/admin/mobile/customers-list",
      description: "View customer contacts",
    },
    // Conditionally include Staff only if they have access
    ...(hasStaffAccess
      ? [
          {
            title: "Staff",
            icon: "👔",
            href: "/admin/mobile/staff",
            description: "Manage your team",
          },
        ]
      : []),
    // HIDDEN ON MOBILE — uncomment to restore
    // {
    //   title: "Membership",
    //   icon: "💎",
    //   href: "/admin/mobile/membership",
    //   description: "Elite membership & members",
    // },
    // HIDDEN ON MOBILE — uncomment to restore
    // {
    //   title: "Referrals",
    //   icon: "🎁",
    //   href: "/admin/mobile/referrals",
    //   description: "Track customer referrals",
    // },
    {
      title: "Take Payment",
      icon: "💳",
      href: "/admin/mobile/take-payment",
      description: "Cash or QR card payment",
    },
    {
      title: "QR Code",
      icon: "📱",
      href: "/admin/mobile/qr-code",
      description: "Share your booking link",
    },
    // HIDDEN ON MOBILE — uncomment to restore
    // {
    //   title: "Desktop View",
    //   icon: "💻",
    //   href: "/admin",
    //   description: "Full dashboard",
    // },
    {
      title: "Notifications",
      icon: "🔔",
      href: "/admin/mobile/notifications",
      description: "Recent alerts and updates",
    },
    {
      title: "Services",
      icon: niche === "carwash" ? "🚗" : "✂️",
      href: "/admin/mobile/services",
      description: "View service prices",
    },
    // HIDDEN ON MOBILE — uncomment to restore
    // {
    //   title: "Settings",
    //   icon: "⚙️",
    //   href: "/admin/mobile/settings",
    //   description: "Loyalty & referral settings",
    // },
  ];

  const bgStyle = { background: `linear-gradient(135deg, ${brandColor} 0%, ${darkenHex(brandColor)} 100%)` };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={bgStyle}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4" style={bgStyle}>
      {/* Header */}
      <div className="text-center text-white mb-8 pt-8">
        <h1 className="text-3xl font-bold mb-2">{businessName}</h1>
        <p className="text-white/70">Business Manager</p>
      </div>

      {/* Menu Grid */}
      <div className="max-w-2xl mx-auto grid grid-cols-2 gap-4 pb-8">
        {menuItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="bg-white rounded-2xl p-6 shadow-lg active:scale-95 transition-transform"
          >
            <div className="text-center">
              <div className="text-5xl mb-3">{item.icon}</div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">
                {item.title}
              </h3>
              <p className="text-sm text-gray-600">{item.description}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Logout */}
      <div className="max-w-2xl mx-auto">
        <button
          onClick={async () => {
            await supabase.auth.signOut();
            router.push("/admin/mobile/login");
          }}
          className="w-full bg-white/20 backdrop-blur text-white py-4 rounded-xl font-semibold"
        >
          Sign Out
        </button>
      </div>
      {/* Push notification permission prompt */}
      {businessId && <AdminPushPermissionPrompt businessId={businessId} />}
    </div>
  );
}
