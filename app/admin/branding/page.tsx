// file: app/admin/branding/page.tsx

"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatPhone, digitsOnlyPhone } from "@/lib/utils/formatPhone";

import Image from "next/image";

interface Business {
  id: string;
  name: string;
  app_name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string;
  welcome_message: string | null;
  push_sender_name: string | null;
}

export default function BrandingPage() {
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const [businessName, setBusinessName] = useState("");
  const [appName, setAppName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#3B82F6");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [pushSenderName, setPushSenderName] = useState("");
  const [customSlug, setCustomSlug] = useState("");
  const [slugError, setSlugError] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [address, setAddress] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");

  const supabase = createClient();

  useEffect(() => {
    loadBranding();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadBranding = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("businesses")
      .select("*")
      .eq("owner_user_id", user.id)
      .single();

    if (data) {
      setOwnerName(data.owner_name || "");
      setOwnerPhone(data.owner_phone || "");
      setOwnerEmail(data.owner_email || "");
      setAddress(data.address || "");
      setBusinessPhone(data.phone || "");
      setBusiness(data as Business);
      setBusinessName(data.name);
      setAppName(data.app_name);
      setPrimaryColor(data.primary_color);
      setWelcomeMessage(data.welcome_message || "");
      setPushSenderName(data.push_sender_name || "");
      setCustomSlug(data.slug);
    }

    setLoading(false);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !business) return;

    setUploadingLogo(true);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${business.id}-${new Date().getTime()}.${fileExt}`;
      const filePath = `logos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("business-assets")
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        alert(`Upload failed: ${uploadError.message}`);
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("business-assets").getPublicUrl(filePath);

      console.log("Logo publicUrl:", publicUrl);

      const { error: dbError } = await supabase
        .from("businesses")
        .update({ logo_url: publicUrl })
        .eq("id", business.id);

      if (dbError) {
        alert(`Saved to storage but failed to update business record: ${dbError.message}`);
        return;
      }

      setBusiness({ ...business, logo_url: publicUrl });
      alert(`Logo uploaded successfully!\n\nURL: ${publicUrl}`);
    } catch (error) {
      console.error("Error uploading logo:", error);
      alert(`Unexpected error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSave = async () => {
    if (!business) return;

    setSaving(true);

    const { error } = await supabase
      .from("businesses")
      .update({
        name: businessName,
        app_name: appName,
        slug: customSlug,
        primary_color: primaryColor,
        welcome_message: welcomeMessage,
        push_sender_name: pushSenderName,
        owner_name: ownerName,
        owner_phone: ownerPhone,
        owner_email: ownerEmail,
        address: address || null,
        phone: businessPhone || null,
      })
      .eq("id", business.id);

    if (error) {
      alert("Error saving: " + error.message);
    } else {
      // Mark onboarding as complete
      await supabase
        .from("onboarding_state")
        .update({ status: "completed" })
        .eq("business_id", business.id);

      alert("Branding updated successfully!");
      loadBranding();
    }

    setSaving(false);
  };

  const colorPresets = [
    { name: "Blue", value: "#3B82F6" },
    { name: "Purple", value: "#8B5CF6" },
    { name: "Pink", value: "#EC4899" },
    { name: "Red", value: "#EF4444" },
    { name: "Orange", value: "#F97316" },
    { name: "Green", value: "#10B981" },
    { name: "Teal", value: "#14B8A6" },
    { name: "Indigo", value: "#6366F1" },
  ];

  return (
    <div className="flex h-screen bg-gray-50">
      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-6xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Branding</h1>
            <p className="text-gray-600 mt-1">
              Customize how your app looks to customers
            </p>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                {/* Owner Information */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-6">
                    Owner Information
                  </h2>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Full Name
                      </label>
                      <input
                        type="text"
                        value={ownerName}
                        onChange={(e) => setOwnerName(e.target.value)}
                        placeholder="e.g., Dave Johnson"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <p className="text-sm text-gray-500 mt-1">
                        Your full name as the business owner
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        value={formatPhone(ownerPhone)}
                        onChange={(e) =>
                          setOwnerPhone(digitsOnlyPhone(e.target.value))
                        }
                        placeholder="e.g., (555) 123-1234"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        inputMode="numeric"
                        autoComplete="tel"
                      />

                      <p className="text-sm text-gray-500 mt-1">
                        Contact number for customer support
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={ownerEmail}
                        onChange={(e) => setOwnerEmail(e.target.value)}
                        placeholder="e.g., dave@davescarwash.com"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <p className="text-sm text-gray-500 mt-1">
                        Email for booking notifications and customer inquiries
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-6">
                    Business Information
                  </h2>

                  <div className="space-y-4">
                    {/* Business Name */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Business Name
                      </label>
                      <input
                        type="text"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        placeholder="e.g., John's Barbershop"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <p className="text-sm text-gray-500 mt-1">
                        This is your official business name
                      </p>
                    </div>

                    {/* Business Address */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Business Address
                      </label>
                      <input
                        type="text"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="e.g., 123 Main St, Springfield, IL 62701"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <p className="text-sm text-gray-500 mt-1">
                        Your business location
                      </p>
                    </div>

                    {/* Business Phone */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Business Phone Number
                      </label>
                      <input
                        type="tel"
                        value={formatPhone(businessPhone)}
                        onChange={(e) => setBusinessPhone(digitsOnlyPhone(e.target.value))}
                        placeholder="e.g., (555) 123-1234"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        inputMode="numeric"
                        autoComplete="tel"
                      />
                      <p className="text-sm text-gray-500 mt-1">
                        Displayed to customers on your booking page
                      </p>
                    </div>

                    {/* App Name */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        App Name
                      </label>
                      <input
                        type="text"
                        value={appName}
                        onChange={(e) => setAppName(e.target.value)}
                        placeholder="e.g., John's Barber"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <p className="text-sm text-gray-500 mt-1">
                        Shown on the customer&apos;s home screen
                      </p>
                    </div>

                    {/* Custom URL Slug */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Custom URL Slug
                      </label>
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="text-gray-500 text-sm">
                          {typeof window !== "undefined"
                            ? window.location.origin
                            : ""}
                          /
                        </span>
                        <input
                          type="text"
                          value={customSlug}
                          onChange={(e) => {
                            const cleaned = e.target.value
                              .toLowerCase()
                              .replace(/[^a-z0-9-]/g, "")
                              .replace(/--+/g, "-");
                            setCustomSlug(cleaned);
                            setSlugError("");
                          }}
                          placeholder="daves-car-wash"
                          className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                        />
                      </div>
                      {slugError && (
                        <p className="text-sm text-red-600 mb-2">{slugError}</p>
                      )}
                      <p className="text-sm text-gray-500">
                        Customers will use this URL to book appointments. Use
                        only lowercase letters, numbers, and hyphens.
                      </p>
                    </div>

                    {/* Customer App URL + QR */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Customer App URL
                      </label>

                      {(() => {
                        const origin =
                          typeof window !== "undefined"
                            ? window.location.origin
                            : "";
                        const slug = customSlug || business?.slug || "";
                        const customerUrl =
                          origin && slug ? `${origin}/${slug}` : "";

                        // Uses a hosted QR generator (no npm deps). Encodes your customerUrl.
                        const qrUrl = customerUrl
                          ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
                              customerUrl,
                            )}`
                          : "";

                        return (
                          <div className="space-y-4">
                            {/* Link row */}
                            <div className="flex items-center space-x-2">
                              <input
                                type="text"
                                value={customerUrl}
                                readOnly
                                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                              />
                              <button
                                onClick={() => {
                                  if (!customerUrl) return;
                                  navigator.clipboard.writeText(customerUrl);
                                  alert("Link copied!");
                                }}
                                className="px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
                              >
                                Copy
                              </button>
                            </div>

                            <p className="text-sm text-gray-500">
                              Share this link with customers
                            </p>

                            {/* QR code */}
                            {customerUrl && (
                              <div className="flex items-start gap-6">
                                <div className="bg-white border border-gray-200 rounded-xl p-4">
                                  <Image
                                    src={qrUrl}
                                    alt="Customer QR code"
                                    width={220}
                                    height={220}
                                    unoptimized
                                    className="block"
                                  />
                                  <p className="text-xs text-gray-500 mt-2 text-center">
                                    Scan to open the customer link
                                  </p>
                                </div>

                                <div className="flex-1 space-y-2">
                                  <p className="text-sm text-gray-700">
                                    Customers can scan this QR code to open your
                                    booking link. From there, they can add your
                                    app to their home screen.
                                  </p>

                                  <a
                                    href={qrUrl}
                                    download={`qr-${slug}.png`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-block px-4 py-3 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition"
                                  >
                                    Download QR
                                  </a>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-6">Logo</h2>

                  <div className="flex items-center space-x-6">
                    <div className="w-24 h-24 rounded-lg border-2 border-gray-200 flex items-center justify-center overflow-hidden bg-gray-50 relative">
                      {business?.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={business.logo_url}
                          alt="Business logo"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-4xl text-gray-400">🏢</span>
                      )}
                    </div>

                    <div className="flex-1">
                      <label className="block">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          className="hidden"
                          disabled={uploadingLogo}
                        />
                        <span className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 cursor-pointer inline-block transition">
                          {uploadingLogo ? "Uploading..." : "Upload Logo"}
                        </span>
                      </label>
                      <p className="text-sm text-gray-500 mt-2">
                        Recommended: Square image, at least 512x512px
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-6">
                    Brand Color
                  </h2>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        Choose a preset
                      </label>
                      <div className="grid grid-cols-4 gap-3">
                        {colorPresets.map((preset) => (
                          <button
                            key={preset.value}
                            onClick={() => setPrimaryColor(preset.value)}
                            className={`p-4 rounded-lg border-2 transition ${
                              primaryColor === preset.value
                                ? "border-gray-900 ring-2 ring-gray-900"
                                : "border-gray-200 hover:border-gray-300"
                            }`}
                          >
                            <div
                              className="w-full h-8 rounded mb-2"
                              style={{ backgroundColor: preset.value }}
                            ></div>
                            <p className="text-xs font-medium text-gray-700">
                              {preset.name}
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Or use a custom color
                      </label>
                      <div className="flex items-center space-x-4">
                        <input
                          type="color"
                          value={primaryColor}
                          onChange={(e) => setPrimaryColor(e.target.value)}
                          className="w-16 h-16 rounded-lg border-2 border-gray-300 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={primaryColor}
                          onChange={(e) => setPrimaryColor(e.target.value)}
                          className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-6">
                    Messages
                  </h2>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Welcome Message
                      </label>
                      <textarea
                        value={welcomeMessage}
                        onChange={(e) => setWelcomeMessage(e.target.value)}
                        placeholder="Welcome! Book your next appointment with us."
                        rows={3}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Notification Sender Name
                      </label>
                      <input
                        type="text"
                        value={pushSenderName}
                        onChange={(e) => setPushSenderName(e.target.value)}
                        placeholder="e.g., John's Barbershop"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full px-6 py-4 bg-blue-600 text-white rounded-lg font-semibold text-lg hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  {saving ? "Saving..." : "Save Branding"}
                </button>
              </div>

              <div className="lg:col-span-1">
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 sticky top-8">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">
                    Preview
                  </h2>

                  <div className="relative">
                    <div className="w-full aspect-[9/19] bg-gray-900 rounded-3xl p-3 shadow-2xl">
                      <div className="w-full h-full bg-white rounded-2xl overflow-hidden">
                        <div className="h-8 bg-gray-100"></div>

                        <div className="p-6">
                          <div className="flex flex-col items-center mb-6">
                            <div className="w-20 h-20 rounded-2xl border-2 border-gray-200 flex items-center justify-center overflow-hidden mb-3 bg-gray-50 relative">
                              {business?.logo_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={business.logo_url}
                                  alt="Logo"
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="text-3xl">🏢</span>
                              )}
                            </div>
                            <h3 className="text-lg font-bold text-gray-900">
                              {appName || "Your App Name"}
                            </h3>
                          </div>

                          <div className="bg-gray-50 rounded-lg p-4 mb-4">
                            <p className="text-sm text-gray-700 text-center">
                              {welcomeMessage || "Welcome message appears here"}
                            </p>
                          </div>

                          <button
                            className="w-full py-3 rounded-lg font-semibold text-white transition"
                            style={{ backgroundColor: primaryColor }}
                          >
                            Book Appointment
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
