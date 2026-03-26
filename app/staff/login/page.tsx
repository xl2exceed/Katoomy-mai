"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createStaffClient as createClient } from "@/lib/supabase/staff-client";
import Image from "next/image";

function StaffLoginContent() {
  const [mode, setMode] = useState<"password" | "link">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [linkSent, setLinkSent] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const isLinkExpired = searchParams.get("error") === "link_expired";

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Login failed");

      const { data: staffRecord } = await supabase
        .from("staff")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!staffRecord) {
        await supabase.auth.signOut();
        throw new Error("No staff account found for this email. Contact your manager.");
      }

      router.push("/staff/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleSendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const origin = window.location.origin;
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${origin}/staff/auth` },
      });
      if (otpError) throw otpError;
      setLinkSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-3 mb-2">
          <Image src="/brand/katoomy-logo.png" alt="Katoomy" width={40} height={40} />
          <span className="text-2xl font-bold text-gray-900">Katoomy</span>
        </div>
        <p className="text-gray-500 text-sm">Staff Portal</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-lg p-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-1">Staff Sign In</h2>
        <p className="text-sm text-gray-500 mb-6">Sign in to view your schedule and dashboard</p>

        {isLinkExpired && (
          <div className="mb-5 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-700">
            Your login link expired. Use &ldquo;Email Login Link&rdquo; below to get a new one sent to your email.
          </div>
        )}

        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Mode toggle */}
        <div className="flex rounded-xl border border-gray-200 mb-6 overflow-hidden">
          <button
            type="button"
            onClick={() => { setMode("password"); setError(""); setLinkSent(false); }}
            className={`flex-1 py-2.5 text-sm font-semibold transition ${mode === "password" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
          >
            Password
          </button>
          <button
            type="button"
            onClick={() => { setMode("link"); setError(""); setLinkSent(false); }}
            className={`flex-1 py-2.5 text-sm font-semibold transition ${mode === "link" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
          >
            Email Login Link
          </button>
        </div>

        {mode === "password" ? (
          <form onSubmit={handlePasswordLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 pr-16 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>

            <p className="text-center text-xs text-gray-400">
              No password yet?{" "}
              <button type="button" onClick={() => { setMode("link"); setError(""); }} className="text-blue-600 hover:underline font-medium">
                Send me a login link
              </button>
            </p>
          </form>
        ) : linkSent ? (
          <div className="text-center py-4">
            <div className="text-4xl mb-3">📧</div>
            <p className="font-semibold text-gray-900 mb-1">Check your email</p>
            <p className="text-sm text-gray-500">
              We sent a login link to <strong>{email}</strong>. Click the link in the email to sign in — no password needed.
            </p>
            <button
              type="button"
              onClick={() => setLinkSent(false)}
              className="mt-4 text-sm text-blue-600 hover:underline"
            >
              Resend link
            </button>
          </div>
        ) : (
          <form onSubmit={handleSendLink} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition disabled:opacity-60"
            >
              {loading ? "Sending..." : "Send Login Link"}
            </button>

            <p className="text-xs text-gray-400 text-center">
              We&apos;ll email you a one-click link to sign in. No password needed.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

export default function StaffLoginPage() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <Suspense fallback={<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />}>
        <StaffLoginContent />
      </Suspense>
    </div>
  );
}
