"use client";

import Link from "next/link";

export default function SuccessClient({
  sessionId,
}: {
  sessionId: string | null;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-purple-100 flex items-center justify-center px-4">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className="text-3xl font-bold text-[#8B5CF6] mb-2">Katoomy</div>

        <h1 className="text-2xl font-bold text-gray-900">You’re all set 🎉</h1>

        <p className="mt-3 text-gray-600">
          Your signup is complete. If you purchased a plan, it may take a moment
          to reflect while we confirm it.
        </p>

        <div className="mt-8 flex flex-col gap-3">
          <Link
            href="/admin/bookings"
            className="w-full py-3 bg-[#8B5CF6] text-white rounded-lg font-bold hover:bg-[#7C3AED] transition"
          >
            Go to Dashboard
          </Link>

          <Link
            href="/admin/login"
            className="w-full py-3 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition"
          >
            Sign In
          </Link>
        </div>

        {sessionId && (
          <p className="mt-6 text-xs text-gray-400 break-all">
            Session: {sessionId}
          </p>
        )}
      </div>
    </div>
  );
}
