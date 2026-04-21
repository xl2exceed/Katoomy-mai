"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createStaffClient as createClient, clearStaffClient as clearClient } from "@/lib/supabase/staff-client";
import Link from "next/link";
import Image from "next/image";
import StaffPushPermissionPrompt from "@/components/StaffPushPermissionPrompt";

interface StaffRecord {
  id: string;
  full_name: string;
  role: string | null;
  photo_url: string | null;
  business_id: string;
}

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

export default function StaffDashboardPage() {
  const router = useRouter();
  const [staff, setStaff] = useState<StaffRecord | null>(null);
  const [niche, setNiche] = useState("barber");
  const [brandColor, setBrandColor] = useState("#10b981");
  const [businessLogo, setBusinessLogo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/staff/login"); return; }

      // Show form only if password has never been set (stored in user metadata)
      const alreadySet = !!user.user_metadata?.password_set;
      setShowPasswordForm(!alreadySet);

      const { data: staffRecord } = await supabase
        .from("staff")
        .select("id, full_name, role, photo_url, business_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!staffRecord) { router.push("/staff/login"); return; }
      setStaff(staffRecord);

      // Fetch business niche, brand color, and logo
      const { data: bizData } = await supabase
        .from("businesses")
        .select("features, primary_color, logo_url")
        .eq("id", staffRecord.business_id)
        .single();
      if (bizData) {
        const biz = bizData as typeof bizData & { features?: Record<string, string>; primary_color?: string; logo_url?: string | null };
        const features = biz.features || {};
        setNiche(features.niche || "barber");
        if (biz.primary_color) setBrandColor(biz.primary_color);
        if (biz.logo_url) setBusinessLogo(biz.logo_url);
      }

      setLoading(false);
    })();
  }, [router]);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    clearClient();
    router.push("/staff/login");
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: "error", text: "Passwords do not match." });
      return;
    }
    if (newPassword.length < 8) {
      setPasswordMessage({ type: "error", text: "Must be at least 8 characters." });
      return;
    }
    setPasswordSaving(true);
    setPasswordMessage(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword, data: { password_set: true } });
    if (error) {
      setPasswordMessage({ type: "error", text: error.message });
    } else {
      setPasswordMessage({ type: "success", text: "Password saved!" });
      setShowPasswordForm(false);
      setNewPassword("");
      setConfirmPassword("");
    }
    setPasswordSaving(false);
  };

  const bgStyle = {
    background: `linear-gradient(135deg, ${brandColor} 0%, ${darkenHex(brandColor)} 100%)`,
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={bgStyle}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white" />
      </div>
    );
  }

  if (!staff) return null;

  return (
    <div className="min-h-screen p-4" style={bgStyle}>
      {/* Header */}
      <div className="text-center text-white mb-8 pt-8">
        {staff.photo_url ? (
          <Image
            src={staff.photo_url}
            alt={staff.full_name}
            width={80}
            height={80}
            className="rounded-full object-cover mx-auto mb-3 border-4 border-white/30"
          />
        ) : businessLogo ? (
          <div className="w-20 h-20 rounded-2xl bg-white mx-auto mb-3 shadow-lg overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={businessLogo}
              alt="Business logo"
              className="w-full h-full object-contain"
            />
          </div>
        ) : (
          <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-3 border-4 border-white/30">
            <span className="text-3xl font-bold text-white">{staff.full_name.charAt(0).toUpperCase()}</span>
          </div>
        )}
        <h1 className="text-2xl font-bold">{staff.full_name}</h1>
        {staff.role && <p className="text-white/70 text-sm mt-1">{staff.role}</p>}
      </div>

      {/* Tile Grid */}
      <div className="max-w-2xl mx-auto grid grid-cols-2 gap-4 pb-4">
        {[
          { title: "Schedule", icon: "📅", href: "/staff/schedule", description: "Your appointments" },
          { title: "Notifications", icon: "🔔", href: "/staff/notifications", description: "New requests & activity" },
          { title: "Customers", icon: "👥", href: "/staff/customers", description: "Clients you've served" },
          { title: "Revenue", icon: "💰", href: "/staff/revenue", description: "Your earnings" },
          { title: "Take Payment", icon: "💳", href: "/staff/payment", description: "Walk-in QR payment" },
          { title: "QR Code", icon: "📲", href: "/staff/qr-code", description: "Show booking QR code" },
          { title: "Services", icon: niche === "carwash" ? "🚗" : "✂️", href: "/staff/services", description: "View service prices" },
        ].map((tile) => (
          <Link
            key={tile.href}
            href={tile.href}
            className="bg-white rounded-2xl p-6 shadow-lg active:scale-95 transition-transform"
          >
            <div className="text-center">
              <div className="text-5xl mb-3">{tile.icon}</div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">{tile.title}</h3>
              <p className="text-sm text-gray-600">{tile.description}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Password section */}
      <div className="max-w-2xl mx-auto mt-4 mb-4">
        <div className="bg-white/10 backdrop-blur rounded-2xl p-4">
          {showPasswordForm ? (
            <>
              <p className="text-white font-semibold mb-3">Set a password for email login</p>
              <form onSubmit={handleSetPassword} className="space-y-3">
                <input
                  type="password"
                  placeholder="New password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <input
                  type="password"
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                {passwordMessage && (
                  <p className={`text-sm ${passwordMessage.type === "success" ? "text-green-200" : "text-red-200"}`}>
                    {passwordMessage.text}
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPasswordForm(false)}
                    className="flex-1 py-2 bg-white/20 text-white rounded-lg text-sm font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={passwordSaving}
                    className="flex-1 py-2 bg-white text-emerald-700 rounded-lg text-sm font-semibold disabled:opacity-60"
                  >
                    {passwordSaving ? "Saving..." : "Save Password"}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <button
              onClick={() => setShowPasswordForm(true)}
              className="w-full text-center text-white/80 text-sm font-medium"
            >
              🔑 Change Password
            </button>
          )}
        </div>
      </div>

      {/* Sign Out */}
      <div className="max-w-2xl mx-auto">
        <button
          onClick={handleSignOut}
          className="w-full bg-white/20 backdrop-blur text-white py-4 rounded-xl font-semibold"
        >
          Sign Out
        </button>
      </div>

      {staff && <StaffPushPermissionPrompt staffId={staff.id} />}
    </div>
  );
}
