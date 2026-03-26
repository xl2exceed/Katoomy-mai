"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import StaffDashboardContent from "./StaffDashboardContent";

interface StaffMember {
  id: string;
  full_name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  photo_url: string | null;
  is_active: boolean;
  business_id: string;
}

export default function AdminStaffDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const staffId = params.id as string;
  const backHref = searchParams.get("from") === "mobile" ? "/admin/mobile/staff" : "/admin/staff";

  const [staff, setStaff] = useState<StaffMember | null>(null);
  const [authToken, setAuthToken] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/admin/login"); return; }

      const { data: { session } } = await supabase.auth.getSession();
      setAuthToken(session?.access_token || "");

      const { data } = await supabase
        .from("staff")
        .select("id, full_name, role, email, phone, photo_url, is_active, business_id")
        .eq("id", staffId)
        .single();

      if (data) setStaff(data);
      setLoading(false);
    })();
  }, [staffId, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!staff) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Staff member not found.</p>
          <Link href={backHref} className="text-blue-600 hover:underline">Back to Staff</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex items-center gap-4">
            <Link href={backHref} className="text-gray-400 hover:text-gray-600 text-sm font-medium">
              ← Staff
            </Link>
            <div className="flex items-center gap-3 flex-1">
              {staff.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={staff.photo_url} alt={staff.full_name} className="w-12 h-12 rounded-full object-cover" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <span className="text-blue-600 font-bold text-lg">{staff.full_name.charAt(0).toUpperCase()}</span>
                </div>
              )}
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{staff.full_name}</h1>
                <p className="text-sm text-gray-500">
                  {staff.role || "Staff Member"}
                  {!staff.is_active && <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Inactive</span>}
                </p>
              </div>
            </div>
            <Link
              href={backHref}
              className="text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-200 px-4 py-2 rounded-lg"
            >
              Edit Staff
            </Link>
          </div>
        </div>
      </div>

      {/* Dashboard Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <StaffDashboardContent staffId={staffId} staffName={staff.full_name} businessId={staff.business_id} isAdmin={true} token={authToken} />
      </div>
    </div>
  );
}
