"use client";

import { useStaffFeature } from "@/lib/hooks/useStaffFeature";
import { UpgradePrompt } from "@/components/UpgradePrompt";

import StaffManagementContent from "./StaffManagementContent";

export default function StaffManagementPage() {
  const { hasAccess, loading } = useStaffFeature();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <UpgradePrompt
        featureName="Staff Management"
        description="Upgrade to Premium to unlock team management features and take your business to the next level."
        benefits={[
          "Add unlimited staff members",
          "Individual staff schedules",
          "Staff-specific bookings",
          "Performance tracking",
          "Staff photo profiles",
          "Custom working hours per team member",
        ]}
        isMobile={false}
      />
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}

      {/* Main Content */}
      <StaffManagementContent />
    </div>
  );
}
