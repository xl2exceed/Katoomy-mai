"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatPhone } from "@/lib/utils/formatPhone";
import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";

type Staff = {
  id: string;
  business_id: string;
  full_name: string;
  role: string | null;
  phone: string | null;
  email: string | null;
  photo_url: string | null;
  is_active: boolean;
  user_id: string | null;
  visible_for_booking: boolean;
  accepting_new_clients: boolean;
  working_hours: WorkingHours;
  created_at: string;
  updated_at: string;
};

type StaffStats = {
  todayBookings: number;
  upcomingBookings: number;
  customersServiced: number;
  serviceRevenueCents: number;
  tipsCents: number;
  totalRevenueCents: number;
};

type DaySchedule = {
  enabled: boolean;
  start: string;
  end: string;
};

type WorkingHours = {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
};

const DEFAULT_WORKING_HOURS: WorkingHours = {
  monday: { enabled: true, start: "09:00", end: "17:00" },
  tuesday: { enabled: true, start: "09:00", end: "17:00" },
  wednesday: { enabled: true, start: "09:00", end: "17:00" },
  thursday: { enabled: true, start: "09:00", end: "17:00" },
  friday: { enabled: true, start: "09:00", end: "17:00" },
  saturday: { enabled: true, start: "09:00", end: "17:00" },
  sunday: { enabled: false, start: "09:00", end: "17:00" },
};

const DAYS_OF_WEEK: Array<keyof WorkingHours> = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

function formatCents(cents: number) {
  return "$" + (cents / 100).toFixed(2);
}

export default function StaffManagementPage() {
  const supabase = createClient();
  const router = useRouter();

  const [staff, setStaff] = useState<Staff[]>([]);
  const [filteredStaff, setFilteredStaff] = useState<Staff[]>([]);
  const [statsMap, setStatsMap] = useState<Record<string, StaffStats>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [businessId, setBusinessId] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);

  const [formData, setFormData] = useState({
    full_name: "",
    role: "",
    phone: "",
    email: "",
    photo_url: "",
    is_active: true,
    visible_for_booking: true,
    accepting_new_clients: true,
    working_hours: DEFAULT_WORKING_HOURS,
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [saving, setSaving] = useState(false);
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [qrStaff, setQrStaff] = useState<Staff | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [staffToDelete, setStaffToDelete] = useState<Staff | null>(null);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    loadBusinessAndStaff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredStaff(staff);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredStaff(
        staff.filter(
          (s) =>
            s.full_name.toLowerCase().includes(query) ||
            s.role?.toLowerCase().includes(query) ||
            s.phone?.includes(query),
        ),
      );
    }
  }, [searchQuery, staff]);

  async function loadBusinessAndStaff() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = "/login";
        return;
      }

      const { data: business } = await supabase
        .from("businesses")
        .select("id")
        .eq("owner_user_id", user.id)
        .maybeSingle();

      if (!business) {
        setMessage({ type: "error", text: "Business not found" });
        setLoading(false);
        return;
      }

      setBusinessId(business.id);
      await loadStaff(business.id);
    } catch (error) {
      console.error("Error loading business:", error);
      setMessage({ type: "error", text: "Failed to load business information" });
      setLoading(false);
    }
  }

  async function loadStaff(bizId: string) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const { data, error } = await supabase
        .from("staff")
        .select("*")
        .eq("business_id", bizId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const list = data || [];
      setStaff(list);
      setFilteredStaff(list);

      const results = await Promise.allSettled(
        list.map((s: Staff) =>
          fetch(`/api/staff/${s.id}/stats`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          }).then((r) => r.json()),
        ),
      );
      const map: Record<string, StaffStats> = {};
      results.forEach((r, i) => {
        if (r.status === "fulfilled" && !r.value.error) {
          map[list[i].id] = r.value;
        }
      });
      setStatsMap(map);
    } catch (error) {
      console.error("Error loading staff:", error);
      setMessage({ type: "error", text: "Failed to load staff members" });
    } finally {
      setLoading(false);
    }
  }

  async function handleSendInvite(s: Staff) {
    setInvitingId(s.id);
    try {
      const res = await fetch("/api/staff/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId: s.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send invite");
      if (data.warning) {
        setMessage({ type: "error", text: `Email delivery failed. Use QR Login instead, or share this link: ${data.fallbackUrl}` });
      } else {
        setMessage({ type: "success", text: `Invite sent to ${s.email}` });
      }
      if (businessId) await loadStaff(businessId);
    } catch (e: unknown) {
      setMessage({ type: "error", text: (e as Error).message });
    } finally {
      setInvitingId(null);
    }
  }

  async function handleGetQR(s: Staff) {
    setQrLoading(true);
    setQrStaff(s);
    setQrUrl(null);
    try {
      const res = await fetch(`/api/staff/${s.id}/generate-qr`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate QR");
      setQrUrl(data.url);
      if (businessId) await loadStaff(businessId);
    } catch (e: unknown) {
      setMessage({ type: "error", text: (e as Error).message });
      setQrStaff(null);
    } finally {
      setQrLoading(false);
    }
  }

  function openAddModal() {
    setModalMode("add");
    setEditingStaff(null);
    setFormData({
      full_name: "",
      role: "",
      phone: "",
      email: "",
      photo_url: "",
      is_active: true,
      visible_for_booking: true,
      accepting_new_clients: true,
      working_hours: DEFAULT_WORKING_HOURS,
    });
    setPhotoFile(null);
    setPhotoPreview(null);
    setModalOpen(true);
  }

  function openEditModal(staffMember: Staff) {
    setModalMode("edit");
    setEditingStaff(staffMember);
    setFormData({
      full_name: staffMember.full_name,
      role: staffMember.role || "",
      phone: staffMember.phone || "",
      email: staffMember.email || "",
      photo_url: staffMember.photo_url || "",
      is_active: staffMember.is_active,
      visible_for_booking: staffMember.visible_for_booking ?? true,
      accepting_new_clients: staffMember.accepting_new_clients ?? true,
      working_hours: staffMember.working_hours || DEFAULT_WORKING_HOURS,
    });
    setPhotoFile(null);
    setPhotoPreview(staffMember.photo_url || null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingStaff(null);
    setPhotoFile(null);
    setPhotoPreview(null);
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  async function uploadPhoto(): Promise<string | null> {
    if (!photoFile || !businessId) return null;
    setUploadingPhoto(true);
    try {
      const fileExt = photoFile.name.split(".").pop();
      const fileName = `${businessId}/staff/${Date.now()}.${fileExt}`;
      const { error } = await supabase.storage
        .from("business-assets")
        .upload(fileName, photoFile, { cacheControl: "3600", upsert: false });
      if (error) throw error;
      const { data: publicData } = supabase.storage
        .from("business-assets")
        .getPublicUrl(fileName);
      return publicData.publicUrl;
    } catch (error) {
      console.error("Error uploading photo:", error);
      setMessage({ type: "error", text: "Failed to upload photo" });
      return null;
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleSave() {
    if (!businessId) return;
    if (!formData.full_name.trim()) {
      setMessage({ type: "error", text: "Full name is required" });
      return;
    }
    setSaving(true);
    try {
      let photoUrl = formData.photo_url;
      if (photoFile) {
        const uploadedUrl = await uploadPhoto();
        if (uploadedUrl) photoUrl = uploadedUrl;
      }
      const formattedPhone = formData.phone ? formatPhone(formData.phone) : null;
      const staffData = {
        business_id: businessId,
        full_name: formData.full_name.trim(),
        role: formData.role.trim() || null,
        phone: formattedPhone,
        email: formData.email.trim() || null,
        photo_url: photoUrl || null,
        is_active: formData.is_active,
        visible_for_booking: formData.visible_for_booking,
        accepting_new_clients: formData.accepting_new_clients,
        working_hours: formData.working_hours,
        updated_at: new Date().toISOString(),
      };
      if (modalMode === "add") {
        const { data: newStaff, error } = await supabase.from("staff").insert([staffData]).select("id").single();
        if (error) throw error;

        // Send portal invite email if email was provided
        if (formData.email.trim() && newStaff) {
          const inviteRes = await fetch("/api/staff/invite", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ staffId: newStaff.id }),
          });
          const inviteJson = await inviteRes.json();
          if (inviteRes.ok) {
            if (inviteJson.emailError) {
              setMessage({ type: "error", text: `Staff member added, but invite email failed: ${inviteJson.emailError}. Use QR Login to give them access.` });
            } else {
              setMessage({ type: "success", text: "Staff member added — invite email sent!" });
            }
          } else {
            setMessage({ type: "error", text: `Staff member added. Invite email failed: ${inviteJson.error}. Use QR Login to give them access.` });
          }
        } else {
          setMessage({ type: "success", text: "Staff member added successfully" });
        }
      } else {
        const { error } = await supabase
          .from("staff")
          .update(staffData)
          .eq("id", editingStaff!.id);
        if (error) throw error;
        setMessage({ type: "success", text: "Staff member updated successfully" });
      }
      await loadStaff(businessId);
      closeModal();
    } catch (error) {
      console.error("Error saving staff:", error);
      setMessage({ type: "error", text: "Failed to save staff member" });
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(staffMember: Staff) {
    try {
      const { error } = await supabase
        .from("staff")
        .update({
          is_active: !staffMember.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq("id", staffMember.id);
      if (error) throw error;
      setMessage({
        type: "success",
        text: `Staff member ${!staffMember.is_active ? "activated" : "deactivated"} successfully`,
      });
      if (businessId) await loadStaff(businessId);
    } catch (error) {
      console.error("Error toggling staff status:", error);
      setMessage({ type: "error", text: "Failed to update staff status" });
    }
  }

  function openDeleteConfirm(staffMember: Staff) {
    setStaffToDelete(staffMember);
    setDeleteConfirmOpen(true);
  }

  async function handleDelete() {
    if (!staffToDelete) return;
    try {
      const { error } = await supabase
        .from("staff")
        .delete()
        .eq("id", staffToDelete.id);
      if (error) throw error;
      setMessage({ type: "success", text: "Staff member deleted successfully" });
      setDeleteConfirmOpen(false);
      setStaffToDelete(null);
      if (businessId) await loadStaff(businessId);
    } catch (error) {
      console.error("Error deleting staff:", error);
      setMessage({ type: "error", text: "Failed to delete staff member" });
    }
  }

  function updateWorkingHours(
    day: keyof WorkingHours,
    field: keyof DaySchedule,
    value: string | boolean,
  ) {
    setFormData((prev) => ({
      ...prev,
      working_hours: {
        ...prev.working_hours,
        [day]: { ...prev.working_hours[day], [field]: value },
      },
    }));
  }

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading staff...</p>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Staff Management</h1>
              <p className="mt-1 text-sm text-gray-500">Manage your team members and their schedules</p>
            </div>
            <button onClick={openAddModal} className="ml-6 px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700 transition">
              + Add Staff
            </button>
          </div>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div className={"p-4 rounded-lg " + (message.type === "success" ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200")}>
            {message.text}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search by name, role, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {filteredStaff.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm text-center py-12">
            <div className="text-gray-400 text-5xl mb-4">&#128101;</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {searchQuery ? "No staff found" : "No staff members yet"}
            </h3>
            <p className="text-gray-500 mb-6">
              {searchQuery ? "Try a different search term" : "Add your first team member to get started"}
            </p>
            {!searchQuery && (
              <button onClick={openAddModal} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition">
                Add Staff Member
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredStaff.map((s) => {
              const stats = statsMap[s.id];
              return (
                <div key={s.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">

                  {/* Card Header */}
                  <div className="p-5 flex items-center gap-4">
                    {s.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.photo_url} alt={s.full_name} className="w-14 h-14 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-blue-600 font-bold text-xl">{s.full_name.charAt(0).toUpperCase()}</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900 truncate">{s.full_name}</h3>
                        <span className={"inline-flex px-2 py-0.5 rounded-full text-xs font-semibold " + (s.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500")}>
                          {s.is_active ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 truncate">{s.role || "Staff Member"}</p>
                      {s.email && <p className="text-xs text-gray-400 truncate">{s.email}</p>}
                    </div>
                  </div>

                  {/* Stats */}
                  {stats ? (
                    <div className="grid grid-cols-4 border-t border-gray-100">
                      {[
                        { label: "Today", value: String(stats.todayBookings) },
                        { label: "Upcoming", value: String(stats.upcomingBookings) },
                        { label: "Revenue", value: formatCents(stats.serviceRevenueCents) },
                        { label: "Tips", value: formatCents(stats.tipsCents) },
                      ].map((stat) => (
                        <div key={stat.label} className="py-3 text-center border-r border-gray-100 last:border-r-0">
                          <p className="text-sm font-semibold text-gray-900">{stat.value}</p>
                          <p className="text-xs text-gray-400">{stat.label}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="border-t border-gray-100 py-3 text-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400 mx-auto" />
                    </div>
                  )}

                  {/* Portal Status */}
                  <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-xs text-gray-500">Staff Portal</span>
                    {s.email ? (
                      <div className="flex items-center gap-2">
                        {s.user_id && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                            Active
                          </span>
                        )}
                        <button
                          onClick={() => handleGetQR(s)}
                          disabled={qrLoading && qrStaff?.id === s.id}
                          className="text-xs font-medium text-blue-600 hover:text-blue-800 disabled:opacity-50"
                        >
                          {qrLoading && qrStaff?.id === s.id ? "Generating..." : "QR Login"}
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">Add email first</span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="px-5 py-3 border-t border-gray-100 flex items-center gap-2 flex-wrap">
                    <button onClick={() => router.push("/admin/staff/" + s.id)} className="flex-1 px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-center">
                      View Dashboard
                    </button>
                    <button onClick={() => openEditModal(s)} className="px-3 py-1.5 text-xs font-semibold bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition">
                      Edit
                    </button>
                    <button onClick={() => handleToggleActive(s)} className={"px-3 py-1.5 text-xs font-semibold rounded-lg transition " + (s.is_active ? "bg-orange-50 text-orange-600 hover:bg-orange-100" : "bg-green-50 text-green-600 hover:bg-green-100")}>
                      {s.is_active ? "Disable" : "Enable"}
                    </button>
                    <button onClick={() => openDeleteConfirm(s)} className="px-3 py-1.5 text-xs font-semibold bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition">
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {filteredStaff.length > 0 && (
          <div className="mt-4 text-sm text-gray-500">
            Showing {filteredStaff.length} of {staff.length} staff member
            {staff.length !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full my-8">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">
                {modalMode === "add" ? "Add Staff Member" : "Edit Staff Member"}
              </h2>
            </div>

            <div className="px-6 py-4 max-h-[70vh] overflow-y-auto space-y-4">
              {/* Photo */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Photo</label>
                <div className="flex items-center gap-4">
                  {photoPreview ? (
                    <Image src={photoPreview} alt="Preview" width={80} height={80} className="rounded-full object-cover" />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center">
                      <span className="text-gray-400 text-2xl">&#128247;</span>
                    </div>
                  )}
                  <div>
                    <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" id="photo-upload" />
                    <label htmlFor="photo-upload" className="cursor-pointer px-4 py-2 bg-white border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition inline-block">
                      Choose Photo
                    </label>
                    <p className="text-xs text-gray-500 mt-1">JPG, PNG or GIF (max 5MB)</p>
                  </div>
                </div>
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Full Name <span className="text-red-500">*</span></label>
                <input type="text" value={formData.full_name} onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="John Doe" />
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Role / Position</label>
                <input type="text" value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Senior Barber, Stylist, etc." />
              </div>

              {/* Phone & Email */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Phone</label>
                  <input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="(555) 123-4567" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Email <span className="text-xs text-gray-400 font-normal">(for portal invite)</span></label>
                  <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="john@example.com" />
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-3">
                {(
                  [
                    { key: "is_active" as const, label: "Active (can receive bookings)" },
                    { key: "visible_for_booking" as const, label: "Visible for booking selection" },
                    { key: "accepting_new_clients" as const, label: "Accepting new clients" },
                  ]
                ).map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-3 cursor-pointer">
                    <div
                      onClick={() => setFormData({ ...formData, [key]: !formData[key] })}
                      className="w-11 h-6 rounded-full cursor-pointer transition flex-shrink-0"
                      style={{ backgroundColor: formData[key] ? "#10B981" : "#D1D5DB" }}
                    >
                      <div className="w-5 h-5 bg-white rounded-full shadow-md" style={{ position: "relative", top: "2px", left: formData[key] ? "22px" : "2px", transition: "left 0.2s" }} />
                    </div>
                    <span className="text-sm font-medium text-gray-700">{label}</span>
                  </label>
                ))}
              </div>

              {/* Working Hours */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Working Hours</h3>
                <div className="space-y-3">
                  {DAYS_OF_WEEK.map((day) => (
                    <div key={day} className="flex items-center gap-4">
                      <label className="flex items-center min-w-[120px]">
                        <input type="checkbox" checked={formData.working_hours[day].enabled} onChange={(e) => updateWorkingHours(day, "enabled", e.target.checked)} className="mr-2 w-4 h-4 text-blue-600 rounded" />
                        <span className="text-sm font-medium text-gray-700 capitalize">{day}</span>
                      </label>
                      {formData.working_hours[day].enabled ? (
                        <div className="flex items-center gap-2 flex-1">
                          <input type="time" value={formData.working_hours[day].start} onChange={(e) => updateWorkingHours(day, "start", e.target.value)} className="px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          <span className="text-gray-500">to</span>
                          <input type="time" value={formData.working_hours[day].end} onChange={(e) => updateWorkingHours(day, "end", e.target.value)} className="px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400 flex-1">Day off</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
              <button onClick={closeModal} disabled={saving || uploadingPhoto} className="px-4 py-2 bg-white border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition disabled:opacity-50">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving || uploadingPhoto} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed">
                {saving ? "Saving..." : uploadingPhoto ? "Uploading..." : "Save Staff Member"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Login Modal */}
      {qrStaff && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 text-center">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Staff Portal QR Login</h3>
            <p className="text-sm text-gray-500 mb-4">
              Have <strong>{qrStaff.full_name}</strong> scan this with their phone to log in instantly.
            </p>
            {qrUrl ? (
              <>
                <div className="flex justify-center mb-4">
                  <div className="p-3 bg-white border-2 border-gray-200 rounded-xl inline-block">
                    <QRCodeSVG value={qrUrl} size={200} />
                  </div>
                </div>
                <p className="text-xs text-gray-400 mb-4">Expires in 30 minutes. Have staff scan it right away, then generate a new one anytime.</p>
                <div className="text-left mb-4">
                  <p className="text-xs font-semibold text-gray-600 mb-1">Login Link</p>
                  <div className="p-2 bg-gray-50 rounded-lg break-all text-xs text-gray-700 mb-2 border border-gray-200">
                    {qrUrl}
                  </div>
                  <button
                    onClick={() => { navigator.clipboard.writeText(qrUrl!); alert("Link copied!"); }}
                    className="w-full py-2 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition text-sm"
                  >
                    📋 Copy Link
                  </button>
                </div>
              </>
            ) : (
              <div className="flex justify-center py-10">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
              </div>
            )}
            <button
              onClick={() => { setQrStaff(null); setQrUrl(null); }}
              className="w-full py-2 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition"
            >
              Back to App
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteConfirmOpen && staffToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Staff Member?</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete <strong>{staffToDelete.full_name}</strong>? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => { setDeleteConfirmOpen(false); setStaffToDelete(null); }} className="px-4 py-2 bg-white border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition">
                Cancel
              </button>
              <button onClick={handleDelete} className="px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition">
                Delete Staff Member
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
