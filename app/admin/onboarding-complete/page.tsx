"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

const ACTIVE_FEATURES = [
  { icon: "⭐", label: "Rewards Program" },
  { icon: "🎁", label: "Referral Program" },
  { icon: "📣", label: "Smart Campaigns" },
  { icon: "🤝", label: "Business Network Access" },
];

export default function OnboardingCompletePage() {
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleFinish = async () => {
    if (!checked || loading) return;
    setLoading(true);
    try {
      await fetch("/api/admin/complete-onboarding", { method: "POST" });
      router.push("/admin");
      router.refresh();
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full">
        {/* Logo + heading */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Image
              src="/brand/katoomy-logo.png"
              alt="Katoomy"
              width={52}
              height={52}
              className="w-13 h-13"
            />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">
            Congratulations!
          </h1>
          <p className="text-lg text-purple-600 font-medium mt-1">
            Your Katoomy setup is complete.
          </p>
        </div>

        {/* Statement */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 mb-5 space-y-4">
          <p className="text-gray-700 leading-relaxed">
            Your business is now ready to accept appointments and begin
            benefiting from the Katoomy Business Network.
          </p>
          <p className="text-gray-700 leading-relaxed">
            To help you get results quickly, several growth features are already
            active, including Rewards, Referrals, and Smart Campaigns. These
            features are enabled by default because they are designed to help
            businesses increase customer retention, referrals, and revenue. You
            can change or disable any of these features at any time.
          </p>
          <p className="text-gray-700 leading-relaxed">
            As you continue exploring Katoomy, you'll notice additional tools
            and features throughout the platform. Each feature includes a status
            indicator that shows whether it is currently active or still needs
            configuration. You can hover over any status indicator to learn what
            that feature does and how it can help your business grow.
          </p>
          <p className="text-gray-700 leading-relaxed">
            Remember, Katoomy is more than a booking platform. The Katoomy
            Business Network is designed to help local businesses work together
            to expand their customer reach and create growth opportunities that
            traditional marketplace platforms cannot provide.
          </p>
        </div>

        {/* What's already active */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-5">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
            What&apos;s Already Active
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {ACTIVE_FEATURES.map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-3 p-3 bg-green-50 rounded-xl border border-green-100"
              >
                <span className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0" />
                <span className="text-sm font-medium text-gray-800">
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Checkbox acknowledgement */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer flex-shrink-0"
            />
            <span className="text-sm text-gray-700 leading-relaxed">
              I understand that additional features and tools are available
              throughout Katoomy and can be configured at any time.
            </span>
          </label>
        </div>

        {/* CTA */}
        <button
          type="button"
          onClick={handleFinish}
          disabled={!checked || loading}
          className={`w-full py-4 rounded-xl text-base font-semibold transition shadow-md ${
            checked && !loading
              ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700 cursor-pointer"
              : "bg-gray-100 text-gray-400 cursor-not-allowed"
          }`}
        >
          {loading ? "Setting up your dashboard…" : "Go to Dashboard →"}
        </button>
      </div>
    </div>
  );
}
