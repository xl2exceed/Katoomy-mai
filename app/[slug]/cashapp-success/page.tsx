"use client";
import { useSearchParams } from "next/navigation";

export default function CashAppSuccessPage() {
  const searchParams = useSearchParams();
  const totalCents = parseInt(searchParams.get("totalCents") ?? "0", 10);
  const businessName = searchParams.get("businessName") ?? "the business";

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 max-w-sm w-full text-center">
        {/* Success Icon */}
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-5">
          <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Confirmed!</h1>
        <p className="text-gray-600 text-sm mb-1">
          Your Cash App payment of{" "}
          <span className="font-bold text-gray-900">${(totalCents / 100).toFixed(2)}</span>{" "}
          has been received.
        </p>
        <p className="text-gray-500 text-sm mb-8">
          Thank you for visiting {businessName}. See you next time!
        </p>

        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-sm text-green-800 font-medium">
            💚 Your appointment is complete. Have a great day!
          </p>
        </div>
      </div>
    </div>
  );
}
