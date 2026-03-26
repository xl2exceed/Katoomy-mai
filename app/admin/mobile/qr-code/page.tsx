"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import Image from "next/image";

export default function MobileQRCodePage() {
  const [businessSlug, setBusinessSlug] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    loadBusiness();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadBusiness = async () => {
    const result = await supabase.auth.getUser();
    const user = result.data.user;
    if (!user) return;

    const bizResult = await supabase
      .from("businesses")
      .select("slug, name")
      .eq("owner_user_id", user.id)
      .single();

    if (bizResult.data) {
      setBusinessSlug(bizResult.data.slug);
      setBusinessName(bizResult.data.name);
    }
    setLoading(false);
  };

  const bookingUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/${businessSlug}`
      : "";

  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(
    bookingUrl
  )}`;

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
        console.log("Share cancelled");
      }
    } else {
      handleCopyLink();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6">
        <Link
          href="/admin/mobile/menu"
          className="inline-flex items-center text-white mb-4"
        >
          <span className="text-2xl mr-2">←</span>
          <span className="font-medium">Back to Menu</span>
        </Link>
        <h1 className="text-2xl font-bold">QR Code</h1>
        <p className="text-blue-100 mt-1">Share your booking link</p>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div>
            <div className="bg-white rounded-2xl p-6 shadow-sm mb-4 text-center">
              <h2 className="text-lg font-bold text-gray-900 mb-4">
                Scan to Book
              </h2>
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
                Customers scan this code to book appointments
              </p>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
              <label className="block text-sm font-bold text-gray-900 mb-2">
                Booking Link
              </label>
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
                  className="py-3 bg-blue-600 text-white rounded-xl font-bold active:scale-95 transition"
                >
                  📤 Share
                </button>
              </div>
            </div>

            <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl p-6 text-white">
              <h3 className="font-bold text-lg mb-2">💡 Tips</h3>
              <ul className="space-y-2 text-sm">
                <li>• Print this QR code for your shop window</li>
                <li>• Share the link on social media</li>
                <li>• Add it to your business cards</li>
                <li>• Include it in email signatures</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
