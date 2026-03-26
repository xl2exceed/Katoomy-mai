// POST /api/auth/create-business
// Creates a business record for a newly signed-up user.
// Uses supabaseAdmin to bypass RLS (new users have unconfirmed sessions).
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  const { userId, businessName, ownerName, email, phone } = await req.json();

  if (!userId || !businessName || !ownerName || !email) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Verify the user actually exists in auth
  const { data: { user }, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (userError || !user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let slug = businessName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug) slug = `business-${Date.now()}`;

  // Ensure slug is unique
  const { data: existing } = await supabaseAdmin
    .from("businesses")
    .select("slug")
    .eq("slug", slug)
    .maybeSingle();

  if (existing) slug = `${slug}-${Date.now()}`;

  const { data: business, error } = await supabaseAdmin
    .from("businesses")
    .insert({
      owner_user_id: userId,
      name: businessName,
      app_name: businessName,
      slug,
      phone: phone || null,
      owner_name: ownerName,
      owner_phone: phone || null,
      owner_email: email,
      subscription_plan: "free",
    })
    .select("id, slug")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ businessId: business.id, slug: business.slug });
}
