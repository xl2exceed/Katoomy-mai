"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

export default function UpgradeSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams?.get("session_id");
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    // Only run the redirect in useEffect, not during render
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // Redirect after countdown finishes
          router.push("/admin");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Cleanup
    return () => clearInterval(timer);
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-orange-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        {/* Success Icon */}
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg
            className="w-10 h-10 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>

        {/* Success Message */}
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          🎉 Welcome to Premium!
        </h1>
        
        <p className="text-lg text-gray-600 mb-6">
          Your upgrade was successful! You now have access to all premium features.
        </p>

        {/* Features Unlocked */}
        <div className="bg-purple-50 rounded-lg p-4 mb-6 text-left">
          <h3 className="font-semibold text-purple-900 mb-3">Features Unlocked:</h3>
          <ul className="space-y-2 text-sm text-purple-800">
            <li className="flex items-center">
              <svg className="w-4 h-4 mr-2 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Staff Management
            </li>
            <li className="flex items-center">
              <svg className="w-4 h-4 mr-2 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Automated SMS Reminders
            </li>
            <li className="flex items-center">
              <svg className="w-4 h-4 mr-2 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Advanced Analytics
            </li>
            <li className="flex items-center">
              <svg className="w-4 h-4 mr-2 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Priority Support
            </li>
          </ul>
        </div>

        {/* Session ID */}
        {sessionId && (
          <p className="text-xs text-gray-400 mb-6">
            Session ID: {sessionId}
          </p>
        )}

        {/* Redirect Info */}
        <p className="text-sm text-gray-500 mb-4">
          Redirecting to dashboard in {countdown} seconds...
        </p>

        {/* Manual Link */}
        <Link
          href="/admin"
          className="inline-block px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-purple-800 transition"
        >
          Go to Dashboard Now
        </Link>

        {/* Receipt Link */}
        <p className="text-sm text-gray-500 mt-6">
          A receipt has been sent to your email
        </p>
      </div>
    </div>
  );
}
