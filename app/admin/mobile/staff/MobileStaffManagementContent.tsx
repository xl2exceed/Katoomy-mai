'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatPhone } from '@/lib/utils/formatPhone';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';

type Staff = {
  id: string;
  business_id: string;
  full_name: string;
  role: string | null;
  phone: string | null;
  email: string | null;
  photo_url: string | null;
  is_active: boolean;
  working_hours: WorkingHours;
  created_at: string;
  updated_at: string;
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
  monday: { enabled: true, start: '09:00', end: '17:00' },
  tuesday: { enabled: true, start: '09:00', end: '17:00' },
  wednesday: { enabled: true, start: '09:00', end: '17:00' },
  thursday: { enabled: true, start: '09:00', end: '17:00' },
  friday: { enabled: true, start: '09:00', end: '17:00' },
  saturday: { enabled: true, start: '09:00', end: '17:00' },
  sunday: { enabled: false, start: '09:00', end: '17:00' },
};

// Define day order to maintain consistent display
const DAYS_OF_WEEK: Array<keyof WorkingHours> = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

export default function MobileStaffPage() {
  const supabase = createClient();
  const router = useRouter();
  
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [businessId, setBusinessId] = useState<string | null>(null);
  
  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  
  // Form states
  const [formData, setFormData] = useState({
    full_name: '',
    role: '',
    phone: '',
    email: '',
    photo_url: '',
    is_active: true,
    working_hours: DEFAULT_WORKING_HOURS,
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  
  // UI states
  const [saving, setSaving] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [staffToDelete, setStaffToDelete] = useState<Staff | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadBusinessAndStaff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadBusinessAndStaff() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/admin/login');
        return;
      }

      // Get business for current user
      const { data: business } = await supabase
        .from('businesses')
        .select('id')
        .eq('owner_user_id', user.id)
        .maybeSingle();

      if (!business) {
        setMessage({ type: 'error', text: 'Business not found' });
        setLoading(false);
        return;
      }

      setBusinessId(business.id);

      // Load staff
      await loadStaff(business.id);
    } catch (error) {
      console.error('Error loading business:', error);
      setMessage({ type: 'error', text: 'Failed to load business information' });
      setLoading(false);
    }
  }

  async function loadStaff(bizId: string) {
    try {
      const { data, error } = await supabase
        .from('staff')
        .select('*')
        .eq('business_id', bizId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setStaff(data || []);
    } catch (error) {
      console.error('Error loading staff:', error);
      setMessage({ type: 'error', text: 'Failed to load staff members' });
    } finally {
      setLoading(false);
    }
  }

  function openAddModal() {
    setModalMode('add');
    setEditingStaff(null);
    setFormData({
      full_name: '',
      role: '',
      phone: '',
      email: '',
      photo_url: '',
      is_active: true,
      working_hours: DEFAULT_WORKING_HOURS,
    });
    setPhotoFile(null);
    setPhotoPreview(null);
    setModalOpen(true);
  }

  function openEditModal(staffMember: Staff) {
    setModalMode('edit');
    setEditingStaff(staffMember);
    setFormData({
      full_name: staffMember.full_name,
      role: staffMember.role || '',
      phone: staffMember.phone || '',
      email: staffMember.email || '',
      photo_url: staffMember.photo_url || '',
      is_active: staffMember.is_active,
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
      // Generate unique filename
      const fileExt = photoFile.name.split('.').pop();
      const fileName = `${businessId}/staff/${Date.now()}.${fileExt}`;

      // Upload to Supabase storage
      const { error } = await supabase.storage
        .from('business-assets')
        .upload(fileName, photoFile, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) throw error;

      // Get public URL
      const { data: publicData } = supabase.storage
        .from('business-assets')
        .getPublicUrl(fileName);

      return publicData.publicUrl;
    } catch (error) {
      console.error('Error uploading photo:', error);
      setMessage({ type: 'error', text: 'Failed to upload photo' });
      return null;
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleSave() {
    if (!businessId) return;

    // Validation
    if (!formData.full_name.trim()) {
      setMessage({ type: 'error', text: 'Full name is required' });
      return;
    }

    setSaving(true);
    try {
      // Upload photo if new file selected
      let photoUrl = formData.photo_url;
      if (photoFile) {
        const uploadedUrl = await uploadPhoto();
        if (uploadedUrl) {
          photoUrl = uploadedUrl;
        }
      }

      // Format phone number
      const formattedPhone = formData.phone ? formatPhone(formData.phone) : null;

      const staffData = {
        business_id: businessId,
        full_name: formData.full_name.trim(),
        role: formData.role.trim() || null,
        phone: formattedPhone,
        email: formData.email.trim() || null,
        photo_url: photoUrl || null,
        is_active: formData.is_active,
        working_hours: formData.working_hours,
        updated_at: new Date().toISOString(),
      };

      if (modalMode === 'add') {
        // Create new staff
        const { error } = await supabase
          .from('staff')
          .insert([staffData]);

        if (error) throw error;
        setMessage({ type: 'success', text: 'Staff member added successfully' });
      } else {
        // Update existing staff
        const { error } = await supabase
          .from('staff')
          .update(staffData)
          .eq('id', editingStaff!.id);

        if (error) throw error;
        setMessage({ type: 'success', text: 'Staff member updated successfully' });
      }

      // Reload staff list
      await loadStaff(businessId);
      closeModal();
    } catch (error) {
      console.error('Error saving staff:', error);
      setMessage({ type: 'error', text: 'Failed to save staff member' });
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(staffMember: Staff) {
    try {
      const { error } = await supabase
        .from('staff')
        .update({ 
          is_active: !staffMember.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', staffMember.id);

      if (error) throw error;

      setMessage({ 
        type: 'success', 
        text: `Staff member ${!staffMember.is_active ? 'activated' : 'deactivated'} successfully` 
      });
      
      if (businessId) await loadStaff(businessId);
    } catch (error) {
      console.error('Error toggling staff status:', error);
      setMessage({ type: 'error', text: 'Failed to update staff status' });
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
        .from('staff')
        .delete()
        .eq('id', staffToDelete.id);

      if (error) throw error;

      setMessage({ type: 'success', text: 'Staff member deleted successfully' });
      setDeleteConfirmOpen(false);
      setStaffToDelete(null);
      
      if (businessId) await loadStaff(businessId);
    } catch (error) {
      console.error('Error deleting staff:', error);
      setMessage({ type: 'error', text: 'Failed to delete staff member' });
    }
  }

  function updateWorkingHours(day: keyof WorkingHours, field: keyof DaySchedule, value: string | boolean) {
    setFormData(prev => ({
      ...prev,
      working_hours: {
        ...prev.working_hours,
        [day]: {
          ...prev.working_hours[day],
          [field]: value,
        },
      },
    }));
  }

  // Auto-hide message after 3 seconds
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
          <p className="mt-4 text-white">Loading staff...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-indigo-600 pb-24">
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-sm border-b border-white/20">
        <div className="px-4 py-6">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.push("/admin/mobile/menu")}
              className="text-white text-2xl"
            >
              ←
            </button>
            <h1 className="text-2xl font-bold text-white">Staff Management</h1>
            <div className="w-8"></div>
          </div>
        </div>
      </div>

      {/* Success/Error Message */}
      {message && (
        <div className="px-4 mt-4">
          <div
            className={`p-4 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-500 text-white'
                : 'bg-red-500 text-white'
            }`}
          >
            {message.text}
          </div>
        </div>
      )}

      {/* Staff List */}
      <div className="px-4 mt-6">
        {staff.length === 0 ? (
          <div className="bg-white/10 backdrop-blur rounded-2xl p-8 text-center">
            <div className="text-6xl mb-4">👔</div>
            <h3 className="text-xl font-bold text-white mb-2">No Staff Yet</h3>
            <p className="text-white/80 mb-6">
              Add your first team member to get started
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {staff.map((staffMember) => (
              <div
                key={staffMember.id}
                className="bg-white rounded-2xl shadow-lg p-4"
              >
                <div className="flex items-start gap-3">
                  {/* Photo */}
                  {staffMember.photo_url ? (
                    <Image
                      src={staffMember.photo_url}
                      alt={staffMember.full_name}
                      width={60}
                      height={60}
                      className="rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-15 h-15 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-blue-600 font-bold text-xl">
                        {staffMember.full_name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-gray-900 text-lg truncate">
                          {staffMember.full_name}
                        </h3>
                        {staffMember.role && (
                          <p className="text-sm text-gray-600">{staffMember.role}</p>
                        )}
                      </div>
                      <span
                        className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold ${
                          staffMember.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {staffMember.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    {/* Contact */}
                    <div className="mt-2 text-sm text-gray-600">
                      {staffMember.phone && (
                        <div>📞 {staffMember.phone}</div>
                      )}
                      {staffMember.email && (
                        <div className="truncate">✉️ {staffMember.email}</div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="mt-3 flex gap-2">
                      <Link
                        href={`/admin/mobile/staff/${staffMember.id}`}
                        className="flex-1 px-3 py-2 bg-indigo-50 text-indigo-600 rounded-lg text-sm font-semibold text-center"
                      >
                        Dashboard
                      </Link>
                      <button
                        onClick={() => openEditModal(staffMember)}
                        className="flex-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-semibold"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleToggleActive(staffMember)}
                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold ${
                          staffMember.is_active
                            ? 'bg-gray-50 text-gray-700'
                            : 'bg-green-50 text-green-600'
                        }`}
                      >
                        {staffMember.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => openDeleteConfirm(staffMember)}
                        className="px-3 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-semibold"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Fixed Bottom Add Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
        <button
          onClick={openAddModal}
          className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold text-lg shadow-lg"
        >
          + Add Staff Member
        </button>
      </div>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-200 rounded-t-3xl">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">
                  {modalMode === 'add' ? 'Add Staff Member' : 'Edit Staff Member'}
                </h2>
                <button
                  onClick={closeModal}
                  className="text-gray-400 text-2xl"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-4">
              {/* Photo Upload */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Photo
                </label>
                <div className="flex items-center gap-4">
                  {photoPreview ? (
                    <Image
                      src={photoPreview}
                      alt="Preview"
                      width={64}
                      height={64}
                      className="rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center">
                      <span className="text-gray-400 text-2xl">📷</span>
                    </div>
                  )}
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoChange}
                      className="hidden"
                      id="photo-upload"
                    />
                    <label
                      htmlFor="photo-upload"
                      className="cursor-pointer px-4 py-2 bg-white border-2 border-gray-300 text-gray-700 rounded-lg font-semibold inline-block"
                    >
                      Choose Photo
                    </label>
                  </div>
                </div>
              </div>

              {/* Full Name */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="John Doe"
                />
              </div>

              {/* Role */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Role / Position
                </label>
                <input
                  type="text"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Barber, Stylist, etc."
                />
              </div>

              {/* Phone */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Phone
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="(555) 123-4567"
                />
              </div>

              {/* Email */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="john@example.com"
                />
              </div>

              {/* Active Status Toggle */}
              <div className="mb-6">
                <label className="flex items-center gap-3 cursor-pointer">
                  <div
                    onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                    className="w-12 h-7 rounded-full cursor-pointer transition"
                    style={{ backgroundColor: formData.is_active ? '#10B981' : '#D1D5DB' }}
                  >
                    <div
                      className="w-6 h-6 bg-white rounded-full shadow-md transform transition"
                      style={{ 
                        position: 'relative',
                        top: '2px',
                        left: formData.is_active ? '24px' : '2px',
                        transition: 'left 0.2s'
                      }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-700">
                    Active (can receive bookings)
                  </span>
                </label>
              </div>

              {/* Working Hours */}
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Working Hours</h3>
                <div className="space-y-3">
                  {DAYS_OF_WEEK.map((day) => (
                    <div key={day}>
                      <label className="flex items-center mb-2">
                        <input
                          type="checkbox"
                          checked={formData.working_hours[day].enabled}
                          onChange={(e) => updateWorkingHours(day, 'enabled', e.target.checked)}
                          className="mr-2 w-5 h-5 text-blue-600 rounded"
                        />
                        <span className="text-sm font-medium text-gray-700 capitalize flex-1">
                          {day}
                        </span>
                      </label>
                      {formData.working_hours[day].enabled && (
                        <div className="flex items-center gap-2 ml-7">
                          <input
                            type="time"
                            value={formData.working_hours[day].start}
                            onChange={(e) => updateWorkingHours(day, 'start', e.target.value)}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <span className="text-gray-500">to</span>
                          <input
                            type="time"
                            value={formData.working_hours[day].end}
                            onChange={(e) => updateWorkingHours(day, 'end', e.target.value)}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      )}
                      {!formData.working_hours[day].enabled && (
                        <div className="text-sm text-gray-400 ml-7">Day off</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-white px-6 py-4 border-t border-gray-200 flex gap-3">
              <button
                onClick={closeModal}
                disabled={saving || uploadingPhoto}
                className="flex-1 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-lg font-semibold disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || uploadingPhoto}
                className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-semibold disabled:opacity-50"
              >
                {saving ? 'Saving...' : uploadingPhoto ? 'Uploading...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmOpen && staffToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Staff Member?</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete <strong>{staffToDelete.full_name}</strong>? 
              This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setDeleteConfirmOpen(false);
                  setStaffToDelete(null);
                }}
                className="flex-1 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-lg font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-3 bg-red-600 text-white rounded-lg font-semibold"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
