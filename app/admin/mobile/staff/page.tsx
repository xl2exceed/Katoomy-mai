'use client';

import { useStaffFeature } from '@/lib/hooks/useStaffFeature';
import { UpgradePrompt } from '@/components/UpgradePrompt';
import MobileStaffManagementContent from './MobileStaffManagementContent';

export default function MobileStaffManagementPage() {
  const { hasAccess, loading } = useStaffFeature();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
          <p className="mt-4 text-white">Loading...</p>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <UpgradePrompt
        featureName="Staff Management"
        description="Upgrade to Premium to unlock team management and grow your business."
        benefits={[
          'Add unlimited staff members',
          'Individual schedules',
          'Staff-specific bookings',
          'Performance tracking',
        ]}
        isMobile={true}
      />
    );
  }

  return <MobileStaffManagementContent />;
}
