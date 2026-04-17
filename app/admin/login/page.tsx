// file: app/admin/login/page.tsx
"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [forgotMode, setForgotMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleForgotPassword = async () => {
    if (!email) { setError("Enter your email address first."); return; }
    setLoading(true); setError("");
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/admin/reset-password`,
    });
    setLoading(false);
    if (err) { setError(err.message); return; }
    setResetSent(true);
  };

  const router = useRouter();
  const supabase = createClient();

  const title = useMemo(
    () => (isSignUp ? "Create your account" : "Sign in"),
    [isSignUp],
  );

  const subtitle = useMemo(
    () =>
      isSignUp
        ? "Start growing with Katoomy in minutes."
        : "Welcome back — let’s grow your business.",
    [isSignUp],
  );

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert("Check your email to confirm your account!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        window.location.href = "/admin";
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-gradient-to-br from-violet-200/70 via-purple-200/60 to-orange-200/60 blur-3xl" />
        <div className="absolute -bottom-40 -left-24 h-[520px] w-[520px] rounded-full bg-gradient-to-tr from-purple-200/60 via-violet-200/50 to-orange-200/40 blur-3xl" />
        <div className="absolute right-[-180px] top-1/3 h-[420px] w-[420px] rounded-full bg-gradient-to-br from-violet-200/50 to-purple-200/40 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-6xl items-center justify-center px-4 py-10">
        <div className="grid w-full overflow-hidden rounded-3xl border border-gray-200 bg-white/80 shadow-xl backdrop-blur md:grid-cols-2">
          {/* Left brand panel */}
          <div className="relative hidden md:block">
            <div className="absolute inset-0 bg-gradient-to-br from-[#2f1a68] via-[#5a2fc2] to-[#ff8a2a] opacity-95" />
            <div className="absolute inset-0 opacity-25">
              <svg
                className="h-full w-full"
                viewBox="0 0 800 800"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M0 620C130 520 250 520 380 600C520 690 650 690 800 560V800H0V620Z"
                  fill="white"
                />
                <path
                  d="M0 460C150 360 280 360 420 450C560 540 680 540 800 420V800H0V460Z"
                  fill="white"
                  opacity="0.6"
                />
              </svg>
            </div>

            <div className="relative flex h-full flex-col justify-between p-10 text-white">
              <div>
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-white/15 p-2">
                    <Image
                      src="/brand/katoomy-logo.png"
                      alt="Katoomy logo"
                      width={54}
                      height={54}
                      priority
                    />
                  </div>
                  <div>
                    <div className="text-2xl font-semibold tracking-tight">
                      Katoomy
                    </div>
                    <div className="text-sm text-white/80">
                      Grow Your Business
                    </div>
                  </div>
                </div>

                <div className="mt-10 space-y-4">
                  <h1 className="text-3xl font-semibold leading-tight">
                    Bookings, retention, and new customers — in one place.
                  </h1>
                  <p className="max-w-sm text-white/85">
                    Katoomy helps service businesses increase revenue with
                    smarter scheduling, automated reminders, loyalty, and
                    referrals.
                  </p>
                </div>
              </div>

              <div className="mt-10 grid grid-cols-3 gap-3 text-xs text-white/80">
                <div className="rounded-2xl bg-white/10 p-3">
                  <div className="text-white">Automations</div>
                  <div className="mt-1 text-white/70">
                    Reminders & follow-ups
                  </div>
                </div>
                <div className="rounded-2xl bg-white/10 p-3">
                  <div className="text-white">Retention</div>
                  <div className="mt-1 text-white/70">Loyalty & rewards</div>
                </div>
                <div className="rounded-2xl bg-white/10 p-3">
                  <div className="text-white">Growth</div>
                  <div className="mt-1 text-white/70">
                    Referrals that convert
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right form panel */}
          <div className="p-7 sm:p-10">
            {/* Mobile header */}
            <div className="mb-8 flex items-center gap-3 md:hidden">
              <div className="rounded-2xl border border-gray-200 bg-white p-2 shadow-sm">
                <Image
                  src="/brand/katoomy-logo.png"
                  alt="Katoomy logo"
                  width={44}
                  height={44}
                  priority
                />
              </div>
              <div>
                <div className="text-xl font-semibold tracking-tight text-gray-900">
                  Katoomy
                </div>
                <div className="text-sm text-gray-500">Grow Your Business</div>
              </div>
            </div>

            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-gray-900">{title}</h2>
              <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
            </div>

            {error && (
              <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {resetSent ? (
              <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-5 text-center">
                <div className="text-2xl mb-2">📧</div>
                <p className="text-sm font-semibold text-green-800">Password reset email sent!</p>
                <p className="text-sm text-green-700 mt-1">Check your inbox and follow the link to reset your password.</p>
                <button
                  type="button"
                  onClick={() => { setResetSent(false); setForgotMode(false); setError(""); }}
                  className="mt-4 text-sm font-medium text-violet-700 hover:text-violet-800 cursor-pointer"
                >
                  Back to sign in
                </button>
              </div>
            ) : forgotMode ? (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">Enter your email and we&apos;ll send you a link to reset your password.</p>
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium text-gray-700">Email</label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-gray-900 shadow-sm outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-200/60"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={loading}
                  className="w-full rounded-2xl bg-gradient-to-r from-violet-700 via-purple-700 to-orange-500 px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:brightness-105 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                >
                  {loading ? "Sending..." : "Send reset link"}
                </button>
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => { setForgotMode(false); setError(""); }}
                    className="text-sm font-medium text-violet-700 hover:text-violet-800 cursor-pointer"
                  >
                    Back to sign in
                  </button>
                </div>
              </div>
            ) : (
            <form className="space-y-4" onSubmit={handleAuth}>
              <div className="space-y-2">
                <label
                  htmlFor="email"
                  className="text-sm font-medium text-gray-700"
                >
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-gray-900 shadow-sm outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-200/60"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="password"
                  className="text-sm font-medium text-gray-700"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete={isSignUp ? "new-password" : "current-password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 pr-12 text-gray-900 shadow-sm outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-200/60"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 cursor-pointer"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {!isSignUp && (
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-300"
                    />
                    Remember me
                  </label>
                  <button
                    type="button"
                    onClick={() => { setForgotMode(true); setError(""); }}
                    className="text-sm font-medium text-violet-700 hover:text-violet-800 cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-violet-700 via-purple-700 to-orange-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-200/60 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="relative z-10">
                  {loading ? "Please wait..." : isSignUp ? "Create account" : "Sign in"}
                </span>
                <span className="absolute inset-0 opacity-0 transition group-hover:opacity-100">
                  <span className="absolute -left-10 top-0 h-full w-40 rotate-12 bg-white/20 blur-md" />
                </span>
              </button>

              <div className="pt-2 text-center text-sm text-gray-600">
                <button
                  type="button"
                  onClick={() => {
                    if (isSignUp) setIsSignUp(false);
                    else router.push("/signup");
                  }}
                  className="font-medium text-violet-700 hover:text-violet-800 cursor-pointer"
                >
                  {isSignUp ? "Already have an account? Sign in" : "Need an account? Create one"}
                </button>
              </div>
            </form>
            )}

            <div className="mt-8 text-center text-xs text-gray-500">
              By continuing, you agree to Katoomy’s terms and privacy policy.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
