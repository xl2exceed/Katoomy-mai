"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const supabase = createClient();

  const [resending, setResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<"idle" | "sent" | "error">("idle");
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handleResend = async () => {
    if (!email || countdown > 0) return;
    setResending(true);
    setResendStatus("idle");

    const { error } = await supabase.auth.resend({ type: "signup", email });
    if (error) {
      setResendStatus("error");
    } else {
      setResendStatus("sent");
      setCountdown(60);
    }
    setResending(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-purple-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className="text-3xl font-bold text-[#8B5CF6] mb-6">Katoomy</div>

        <div className="text-6xl mb-4">📧</div>

        <h1 className="text-2xl font-bold text-gray-900 mb-3">
          Check your email
        </h1>

        <p className="text-gray-600 mb-2">
          Your account has been created! We sent a verification link to:
        </p>
        {email && (
          <p className="font-semibold text-gray-900 mb-4">{email}</p>
        )}
        <p className="text-gray-600 mb-6">
          Click the link in that email to verify your account, then sign in
          using the password you created.
        </p>

        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-6 text-left">
          <p className="text-sm text-purple-800 font-semibold mb-1">After verifying:</p>
          <p className="text-sm text-purple-700">
            Return to the sign-in page and log in with your email and the
            password you chose during signup.
          </p>
        </div>

        {/* Resend */}
        <div className="mb-6">
          {resendStatus === "sent" && (
            <p className="text-green-600 text-sm font-medium mb-2">
              Email resent! Check your inbox (and spam folder).
            </p>
          )}
          {resendStatus === "error" && (
            <p className="text-red-600 text-sm mb-2">
              Could not resend. Please try again in a moment.
            </p>
          )}
          <button
            onClick={handleResend}
            disabled={resending || countdown > 0 || !email}
            className="text-[#8B5CF6] text-sm font-semibold hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {countdown > 0
              ? `Resend email (${countdown}s)`
              : resending
              ? "Sending..."
              : "Resend verification email"}
          </button>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-6 text-left">
          <p className="text-sm text-gray-700 font-semibold mb-1">Didn&apos;t get it?</p>
          <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
            <li>Check your spam or junk folder</li>
            <li>Make sure you used the right email address</li>
            <li>Allow a minute or two for it to arrive</li>
          </ul>
        </div>

        <Link
          href="/admin/login"
          className="block w-full py-3 bg-[#8B5CF6] text-white rounded-xl font-bold hover:bg-[#7C3AED] transition"
        >
          Go to Sign In
        </Link>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  );
}
