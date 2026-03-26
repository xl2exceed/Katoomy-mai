"use client";

import Image from "next/image";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AdminMobileLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      window.location.href = "/admin/mobile/menu";
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Background blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-gradient-to-br from-violet-200/70 via-purple-200/60 to-orange-200/60 blur-3xl" />
        <div className="absolute -bottom-40 -left-24 h-[520px] w-[520px] rounded-full bg-gradient-to-tr from-purple-200/60 via-violet-200/50 to-orange-200/40 blur-3xl" />
      </div>

      {/* Content */}
      <div className="relative flex-1 flex flex-col justify-center px-6 py-10 max-w-sm mx-auto w-full">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-10">
          <div className="rounded-2xl border border-gray-200 bg-white p-2 shadow-sm">
            <Image
              src="/brand/katoomy-logo.png"
              alt="Katoomy"
              width={44}
              height={44}
              priority
            />
          </div>
          <div>
            <div className="text-xl font-semibold tracking-tight text-gray-900">
              Katoomy
            </div>
            <div className="text-sm text-gray-500">Business Portal</div>
          </div>
        </div>

        {/* Heading */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">Welcome back</h1>
          <p className="mt-1 text-sm text-gray-500">
            Sign in to manage your business
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Form */}
        <form className="space-y-4" onSubmit={handleLogin}>
          <div className="space-y-2">
            <label
              htmlFor="email"
              className="text-sm font-medium text-gray-700"
            >
              Email
            </label>
            <input
              id="email"
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
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 pr-16 text-gray-900 shadow-sm outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-200/60"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-violet-700 via-purple-700 to-orange-500 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-200/60 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60 mt-2"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="mt-8 text-center text-xs text-gray-400">
          By continuing, you agree to Katoomy&apos;s terms and privacy policy.
        </p>
      </div>
    </div>
  );
}
