// file: app/[slug]/page.tsx

import ReferralCapture from "./components/ReferralCapture";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import InstallGate from "@/components/InstallGate";
import HubBackButton from "@/components/HubBackButton";

export default async function CustomerLandingPage({
  params,
  searchParams,
}: {
  params: { slug: string } | Promise<{ slug: string }>;
  searchParams?: { ref?: string } | Promise<{ ref?: string }>;
}) {
  const { slug } = await Promise.resolve(params);

  const sp = await Promise.resolve(searchParams ?? {});
  const referralCode = sp.ref ?? null;

  const supabase = await createClient();

  const { data: business } = await supabase
    .from("businesses")
    .select("id, name, app_name, logo_url, primary_color, welcome_message, address")
    .eq("slug", slug)
    .single();

  if (!business) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Business Not Found
          </h1>
          <p className="text-gray-600">This booking link is invalid</p>
        </div>
      </div>
    );
  }

  return (
    // ✅ slug is passed so InstallGate can save katoomy:lastBusiness
    // even before children render
    <InstallGate business={business} slug={slug}>
      <HubBackButton />
      {/* Capture lastBusiness + pending referral (runs when gate is skipped/installed) */}
      <ReferralCapture businessSlug={slug} referralCode={referralCode} />

      <div className="min-h-screen bg-gray-50">
        {/* Header with Brand Color */}
        <div
          className="pb-24 pt-8"
          style={{
            background: `linear-gradient(to bottom, ${business.primary_color}, ${business.primary_color}ee)`,
          }}
        >
          <div className="container mx-auto px-4 max-w-md text-center">
            {business.logo_url ? (
              <div className="w-28 h-28 mx-auto mb-4 rounded-2xl overflow-hidden bg-white shadow-xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={business.logo_url}
                  alt={business.app_name}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-28 h-28 mx-auto mb-4 rounded-2xl bg-white/90 flex items-center justify-center text-5xl shadow-xl">
                🏢
              </div>
            )}

            <h1 className="text-4xl font-bold text-white drop-shadow-lg">
              {business.app_name}
            </h1>
            {business.address && (
              <p className="text-white text-base mt-2 truncate">
                📍 {business.address}
              </p>
            )}
          </div>
        </div>

        {/* Content Section */}
        <div className="container mx-auto px-4 max-w-md -mt-20">
          {/* Welcome Message */}
          {business.welcome_message && (
            <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 border border-gray-100">
              <p className="text-gray-700 text-center text-lg">
                {business.welcome_message}
              </p>
            </div>
          )}

          {/* Main Action Buttons */}
          <div className="space-y-4 mb-8">
            <Link
              href={`/${slug}/services`}
              className="block w-full py-5 bg-white rounded-2xl font-bold text-xl text-center shadow-lg hover:shadow-xl active:scale-95 transition border-2"
              style={{
                borderColor: business.primary_color,
                color: business.primary_color,
              }}
            >
              📅 Book Appointment
            </Link>

            <Link
              href={`/${slug}/dashboard`}
              className="block w-full py-5 rounded-2xl font-bold text-xl text-center shadow-lg hover:shadow-xl active:scale-95 transition text-white"
              style={{ backgroundColor: business.primary_color || "#3B82F6" }}
            >
              <div>My Page</div>
              <div className="text-xs text-white/80 mt-1 font-normal">
                Appointments · Rewards · Referrals
              </div>
            </Link>
          </div>

          {/* Feature Cards */}
          <div className="space-y-3 pb-8">
            <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
              <div className="flex items-center">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mr-4"
                  style={{ backgroundColor: `${business.primary_color}20` }}
                >
                  ⚡
                </div>
                <div>
                  <p className="font-bold text-gray-900">Fast Booking</p>
                  <p className="text-sm text-gray-600">
                    Book in under 60 seconds
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
              <div className="flex items-center">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mr-4"
                  style={{ backgroundColor: `${business.primary_color}20` }}
                >
                  🔔
                </div>
                <div>
                  <p className="font-bold text-gray-900">Smart Reminders</p>
                  <p className="text-sm text-gray-600">
                    Never miss your appointment
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
              <div className="flex items-center">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mr-4"
                  style={{ backgroundColor: `${business.primary_color}20` }}
                >
                  ⭐
                </div>
                <div>
                  <p className="font-bold text-gray-900">Earn Rewards</p>
                  <p className="text-sm text-gray-600">
                    Get points with every visit
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </InstallGate>
  );
}
