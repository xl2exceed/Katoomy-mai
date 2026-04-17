"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    // Confirm there is an active recovery session before showing the form
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setSessionReady(true);
      } else {
        setError("This reset link is invalid or has expired. Please request a new one.");
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setLoading(true); setError("");
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (err) { setError(err.message); return; }
    router.push("/admin");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-purple-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        <div className="text-3xl font-bold text-[#8B5CF6] mb-2 text-center">Katoomy</div>
        <h1 className="text-xl font-bold text-gray-900 mb-1 text-center">Set a new password</h1>
        <p className="text-sm text-gray-500 text-center mb-6">Choose a strong password for your account.</p>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {!sessionReady && !error && (
          <div className="text-center py-4 text-gray-500 text-sm">Verifying reset link…</div>
        )}

        <form onSubmit={handleReset} className="space-y-4" style={{ display: sessionReady ? undefined : "none" }}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 6 characters"
              required
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-200/60"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat your password"
              required
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-200/60"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-violet-700 via-purple-700 to-orange-500 py-3 text-sm font-semibold text-white shadow-lg transition hover:brightness-105 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? "Saving..." : "Set new password"}
          </button>
        </form>
      </div>
    </div>
  );
}
