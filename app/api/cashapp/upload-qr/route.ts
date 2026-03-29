// POST /api/cashapp/upload-qr
// Accepts a multipart form upload of the Cash App QR code image.
// Stores it in Supabase Storage and returns the public URL.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: business } = await supabaseAdmin
    .from("businesses")
    .select("id")
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get("qr_code") as File | null;

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  // Validate file type
  const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: "Only PNG, JPG, and WebP images are allowed" }, { status: 400 });
  }

  // Max 5MB
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "File must be under 5MB" }, { status: 400 });
  }

  const ext = file.name.split(".").pop() ?? "png";
  const fileName = `cashapp-qr/${business.id}-${Date.now()}.${ext}`;
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Upload to Supabase Storage (bucket: 'business-assets')
  const { error: uploadError } = await supabaseAdmin.storage
    .from("business-assets")
    .upload(fileName, buffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    // If bucket doesn't exist, try 'public' bucket as fallback
    const { error: fallbackError } = await supabaseAdmin.storage
      .from("public")
      .upload(fileName, buffer, { contentType: file.type, upsert: true });

    if (fallbackError) {
      console.error("[upload-qr] Storage error:", fallbackError.message);
      return NextResponse.json({ error: "Failed to upload image. Please check your Supabase storage buckets." }, { status: 500 });
    }

    const { data: urlData } = supabaseAdmin.storage.from("public").getPublicUrl(fileName);
    return NextResponse.json({ success: true, url: urlData.publicUrl });
  }

  const { data: urlData } = supabaseAdmin.storage.from("business-assets").getPublicUrl(fileName);
  return NextResponse.json({ success: true, url: urlData.publicUrl });
}
