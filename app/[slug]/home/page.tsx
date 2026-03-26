// file: app/[slug]/home/page.tsx

import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import Image from "next/image";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function CustomerHomePage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: business } = await supabase
    .from("businesses")
    .select("id, name, app_name, logo_url, primary_color, welcome_message")
    .eq("slug", slug)
    .single();

  if (!business) {
    return <div>Business not found</div>;
  }

  return (
    <div
      className="min-h-screen"
      style={{
        background: `linear-gradient(to bottom, ${business.primary_color}, ${business.primary_color}dd)`,
      }}
    >
      <div className="container mx-auto px-4 py-12 max-w-md">
        {/* Logo & Business Name */}
        <div className="text-center mb-8">
          {business.logo_url ? (
            <div className="w-32 h-32 mx-auto mb-4 rounded-2xl overflow-hidden bg-white shadow-lg relative">
              <Image
                src={business.logo_url}
                alt={business.app_name}
                fill
                className="object-cover"
              />
            </div>
          ) : (
            <div className="w-32 h-32 mx-auto mb-4 rounded-2xl bg-white/20 flex items-center justify-center text-6xl">
              🏢
            </div>
          )}
          <h1 className="text-4xl font-bold text-white mb-2">
            {business.app_name}
          </h1>
        </div>

        {/* Welcome Message */}
        {business.welcome_message && (
          <div className="bg-white/10 backdrop-blur rounded-2xl p-6 mb-6 text-white text-center">
            <p className="text-lg">{business.welcome_message}</p>
          </div>
        )}

        {/* Main Action Buttons */}
        <div className="space-y-4">
          <Link
            href={`/${slug}/services`}
            className="block w-full py-5 bg-white rounded-2xl font-bold text-xl text-center shadow-lg active:scale-95 transition"
            style={{ color: business.primary_color }}
          >
            📅 Book Appointment
          </Link>

          <Link
            href={`/${slug}/dashboard`}
            className="block w-full py-5 bg-white/20 backdrop-blur text-white rounded-2xl font-bold text-xl text-center border-2 border-white/30 active:scale-95 transition"
          >
            My Appointments
          </Link>
        </div>

        {/* Info Cards */}
        <div className="mt-8 space-y-3">
          <div className="bg-white/10 backdrop-blur rounded-xl p-4 text-white">
            <div className="flex items-center">
              <span className="text-2xl mr-3">⚡</span>
              <div>
                <p className="font-bold">Fast Booking</p>
                <p className="text-sm text-white/80">
                  Book in under 60 seconds
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur rounded-xl p-4 text-white">
            <div className="flex items-center">
              <span className="text-2xl mr-3">🔔</span>
              <div>
                <p className="font-bold">Smart Reminders</p>
                <p className="text-sm text-white/80">
                  Never miss your appointment
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur rounded-xl p-4 text-white">
            <div className="flex items-center">
              <span className="text-2xl mr-3">⭐</span>
              <div>
                <p className="font-bold">Earn Rewards</p>
                <p className="text-sm text-white/80">
                  Get points with every visit
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
