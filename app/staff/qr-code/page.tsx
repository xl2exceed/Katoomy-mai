"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createStaffClient as createClient } from "@/lib/supabase/staff-client";
import Link from "next/link";
import Image from "next/image";

export default function StaffQRCodePage() {
  const router = useRouter();
  const [businessSlug, setBusinessSlug] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/staff/login"); return; }

      const { data: staffRecord } = await supabase
        .from("staff")
        .select("business_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!staffRecord) { router.push("/staff/login"); return; }

      const { data: business } = await supabase
        .from("businesses")
        .select("slug, name")
        .eq("id", staffRecord.business_id)
        .single();

      if (business) {
        setBusinessSlug(business.slug);
        setBusinessName(business.name);
      }
      setLoading(false);
    })();
  }, [router]);

  const bookingUrl =
    typeof window !== "undefined" && businessSlug
      ? `${window.location.origin}/${businessSlug}`
      : "";

  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(bookingUrl)}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(bookingUrl);
    alert("Link copied!");
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Book with ${businessName}`,
          text: `Book your appointment with ${businessName}`,
          url: bookingUrl,
        });
      } catch {
        // cancelled
      }
    } else {
      handleCopyLink();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white p-6">
        <Link href="/staff/dashboard" className="inline-flex items-center text-white mb-4">
          <span className="text-2xl mr-2">←</span>
          <span className="font-medium">Back to Menu</span>
        </Link>
        <h1 className="text-2xl font-bold">QR Code</h1>
        <p className="text-emerald-100 mt-1">Share the booking link with customers</p>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
          </div>
        ) : (
          <div>
            <div className="bg-white rounded-2xl p-6 shadow-sm mb-4 text-center">
              <h2 className="text-lg font-bold text-gray-900 mb-1">{businessName}</h2>
              <p className="text-sm text-gray-500 mb-4">Scan to book an appointment</p>
              <div className="bg-white p-4 inline-block rounded-xl border-4 border-gray-200">
                <Image
                  src={qrCodeUrl}
                  alt="QR Code"
                  width={256}
                  height={256}
                  unoptimized
                />
              </div>
              <p className="text-sm text-gray-600 mt-4">
                Show this to customers so they can book online
              </p>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
              <label className="block text-sm font-bold text-gray-900 mb-2">Booking Link</label>
              <div className="p-3 bg-gray-50 rounded-xl break-all text-sm text-gray-700 mb-3">
                {bookingUrl}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleCopyLink}
                  className="py-3 bg-gray-100 text-gray-900 rounded-xl font-bold active:scale-95 transition"
                >
                  📋 Copy
                </button>
                <button
                  onClick={handleShare}
                  className="py-3 bg-emerald-600 text-white rounded-xl font-bold active:scale-95 transition"
                >
                  📤 Share
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
