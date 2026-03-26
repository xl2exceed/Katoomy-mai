// file: components/UpgradePrompt.tsx
// Reusable component to prompt users to upgrade for premium features

import Link from 'next/link';

type UpgradePromptProps = {
  featureName: string;
  description: string;
  benefits?: string[];
  isMobile?: boolean;
};

export function UpgradePrompt({ 
  featureName, 
  description, 
  benefits = [],
  isMobile = false 
}: UpgradePromptProps) {
  if (isMobile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-500 to-indigo-600 p-4 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md">
          <div className="text-center">
            <div className="text-6xl mb-4">🔒</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {featureName}
            </h2>
            <p className="text-gray-600 mb-6">
              {description}
            </p>

            {benefits.length > 0 && (
              <div className="bg-blue-50 rounded-lg p-4 mb-6 text-left">
                <p className="font-semibold text-gray-900 mb-2">Premium includes:</p>
                <ul className="space-y-2">
                  {benefits.map((benefit, index) => (
                    <li key={index} className="text-sm text-gray-700 flex items-start">
                      <span className="text-green-500 mr-2">✓</span>
                      {benefit}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Link
              href="/admin/mobile/upgrade"
              className="block w-full py-3 bg-blue-600 text-white rounded-lg font-bold mb-3"
            >
              Upgrade to Premium
            </Link>
            <Link
              href="/admin/mobile/menu"
              className="block w-full py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold"
            >
              Back to Menu
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Desktop version
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-2xl w-full">
        <div className="text-center">
          <div className="text-7xl mb-6">🔒</div>
          <h2 className="text-3xl font-bold text-gray-900 mb-3">
            {featureName}
          </h2>
          <p className="text-lg text-gray-600 mb-8">
            {description}
          </p>

          {benefits.length > 0 && (
            <div className="bg-blue-50 rounded-lg p-6 mb-8 text-left">
              <p className="font-semibold text-gray-900 mb-4 text-lg">Unlock with Premium:</p>
              <div className="grid md:grid-cols-2 gap-3">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-start">
                    <span className="text-green-500 mr-2 text-xl">✓</span>
                    <span className="text-gray-700">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-4 justify-center">
            <Link
              href="/admin/upgrade"
              className="px-8 py-3 bg-blue-600 text-white rounded-lg font-bold text-lg hover:bg-blue-700 transition"
            >
              Upgrade to Premium
            </Link>
            <Link
              href="/admin/bookings"
              className="px-8 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
