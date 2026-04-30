// file: app/admin/page.tsx

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function AdminDashboard() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  const { data: business } = await supabase
    .from("businesses")
    .select("*, onboarding_state(*)")
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (!business) {
    // No business found - redirect to branding (business should have been created during signup)
    redirect("/admin/branding");
  }

  // At this point business is guaranteed to be non-null
  // Check if onboarding is complete
  const onboardingState = business!.onboarding_state?.[0];
  if (!onboardingState || onboardingState.status !== "completed") {
    redirect("/admin/branding");
  }

  // If we get here, onboarding is complete - show dashboard

  // Get today's bookings
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const { data: todayBookings } = await supabase
    .from("bookings")
    .select("*, customers(full_name, phone), services(name)")
    .eq("business_id", business.id)
    .gte("start_ts", today.toISOString())
    .lt("start_ts", tomorrow.toISOString())
    .order("start_ts", { ascending: true });

  // Get stats
  const { count: totalCustomers } = await supabase
    .from("customers")
    .select("*", { count: "exact", head: true })
    .eq("business_id", business.id);

  const { data: completedBookings } = await supabase
    .from("bookings")
    .select("total_price_cents")
    .eq("business_id", business.id)
    .eq("status", "completed");

  const totalRevenue =
    completedBookings?.reduce((sum, b) => sum + b.total_price_cents, 0) || 0;

  const { count: appInstalls } = await supabase
    .from("pwa_installs")
    .select("*", { count: "exact", head: true })
    .eq("business_id", business.id);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200">
        <div className="p-6">
          <h2 className="text-xl font-bold text-gray-900">{business.name}</h2>
          <p className="text-sm text-gray-500 mt-1">Business Dashboard</p>
        </div>

        <nav className="px-3 space-y-1">
          <Link
            href="/admin"
            className="flex items-center px-3 py-2 text-sm font-medium rounded-lg bg-blue-50 text-blue-700"
          >
            <span className="mr-3">🏠</span>
            Overview
          </Link>
          <Link
            href="/admin/bookings"
            className="flex items-center px-3 py-2 text-sm font-medium rounded-lg text-gray-700 hover:bg-gray-50"
          >
            <span className="mr-3">📅</span>
            My Schedule
          </Link>
          <Link
            href="/admin/services"
            className="flex items-center px-3 py-2 text-sm font-medium rounded-lg text-gray-700 hover:bg-gray-50"
          >
            <span className="mr-3">✂️</span>
            Services
          </Link>
          <Link
            href="/admin/availability"
            className="flex items-center px-3 py-2 text-sm font-medium rounded-lg text-gray-700 hover:bg-gray-50"
          >
            <span className="mr-3">🕒</span>
            Availability
          </Link>
          <Link
            href="/admin/stripe"
            className="flex items-center px-3 py-2 text-sm font-medium rounded-lg text-gray-700 hover:bg-gray-50"
          >
            <span className="mr-3">💰</span>
            Payments
          </Link>
          <Link
            href="/admin/loyalty"
            className="flex items-center px-3 py-2 text-sm font-medium rounded-lg text-gray-700 hover:bg-gray-50"
          >
            <span className="mr-3">⭐</span>
            Rewards
          </Link>
          <Link
            href="/admin/notifications"
            className="flex items-center px-3 py-2 text-sm font-medium rounded-lg text-gray-700 hover:bg-gray-50"
          >
            <span className="mr-3">💬</span>
            Messages
          </Link>
          <Link
            href="/admin/customers"
            className="flex items-center px-3 py-2 text-sm font-medium rounded-lg text-gray-700 hover:bg-gray-50"
          >
            <span className="mr-3">👥</span>
            Customers
          </Link>
          <Link
            href="/admin/branding"
            className="flex items-center px-3 py-2 text-sm font-medium rounded-lg text-gray-700 hover:bg-gray-50"
          >
            <span className="mr-3">🎨</span>
            Branding
          </Link>
          <div className="pt-4 mt-4 border-t border-gray-200">
            <Link
              href="/admin/mobile/menu"
              className="flex items-center px-3 py-2 text-sm font-medium rounded-lg text-gray-700 hover:bg-gray-50"
            >
              <span className="mr-3">📱</span>
              Mobile View
            </Link>
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              Good {new Date().getHours() < 12 ? "Morning" : "Afternoon"}!
            </h1>
            <p className="text-gray-600 mt-1">
              Here&apos;s what&apos;s happening with your business today
            </p>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 font-medium">
                    Today&apos;s Appointments
                  </p>
                  <p className="text-4xl font-bold text-gray-900 mt-2">
                    {todayBookings?.length || 0}
                  </p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">📅</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 font-medium">
                    Total Customers
                  </p>
                  <p className="text-4xl font-bold text-gray-900 mt-2">
                    {totalCustomers || 0}
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">👥</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 font-medium">
                    Total Revenue
                  </p>
                  <p className="text-4xl font-bold text-gray-900 mt-2">
                    ${(totalRevenue / 100).toFixed(0)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">💰</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 font-medium">
                    App Installs
                  </p>
                  <p className="text-4xl font-bold text-gray-900 mt-2">
                    {appInstalls || 0}
                  </p>
                </div>
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">📲</span>
                </div>
              </div>
            </div>
          </div>

          {/* Today's Schedule */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Today&apos;s Schedule
            </h2>
            {todayBookings && todayBookings.length > 0 ? (
              <div className="space-y-3">
                {todayBookings.map((booking) => (
                  <div
                    key={booking.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-16 text-center">
                        <p className="text-sm font-semibold text-gray-900">
                          {new Date(booking.start_ts).toLocaleTimeString(
                            "en-US",
                            {
                              hour: "numeric",
                              minute: "2-digit",
                            }
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {booking.services.name}
                        </p>
                        <p className="text-sm text-gray-600">
                          {booking.customers.full_name ||
                            booking.customers.phone}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        booking.status === "confirmed"
                          ? "bg-green-100 text-green-700"
                          : booking.status === "completed"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {booking.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">
                No appointments scheduled for today
              </p>
            )}
          </div>

          {/* Customer App QR */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-lg p-6 text-white">
            <h2 className="text-xl font-bold mb-2">Your Customer App</h2>
            <p className="text-blue-100 mb-4">
              Share this link with customers to let them book appointments:
            </p>
            <div className="bg-white/10 backdrop-blur rounded-lg p-4 font-mono text-sm break-all">
              {business.slug}
            </div>
            <p className="text-sm text-blue-100 mt-4">
              💡 Tip: Generate a QR code for this link to make it easy for
              customers to access!
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
