// POST /api/admin/import-customers
// Body: { customers: Array<{ phone: string; fullName: string; email: string | null }> }
// Returns: { imported, duplicates, skipped: [{ name, phone, email, reason }] }
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

interface IncomingCustomer {
  phone: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string | null;
}

interface SkippedRow {
  name: string;
  phone: string;
  email: string;
  reason: string;
}

function normalizePhone(raw: string): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length === 10) return digits;
  if (digits.length === 11 && digits[0] === "1") return digits.slice(1);
  return null;
}

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

  const { customers: incoming }: { customers: IncomingCustomer[] } = await req.json();
  if (!Array.isArray(incoming) || incoming.length === 0) {
    return NextResponse.json({ error: "No customers provided" }, { status: 400 });
  }

  const skipped: SkippedRow[] = [];
  const valid: { phone: string; firstName: string; lastName: string; fullName: string; email: string | null }[] = [];

  // Normalize and validate phones
  for (const c of incoming) {
    const phone = normalizePhone(c.phone ?? "");
    const firstName = (c.firstName ?? "").trim();
    const lastName = (c.lastName ?? "").trim();
    const fullName = (c.fullName ?? "").trim() || [firstName, lastName].filter(Boolean).join(" ") || null;
    if (!phone) {
      skipped.push({ name: fullName ?? c.fullName ?? "", phone: c.phone ?? "", email: c.email ?? "", reason: "Invalid or missing phone number" });
      continue;
    }
    valid.push({ phone, firstName, lastName, fullName: fullName ?? "", email: c.email?.trim() || null });
  }

  if (valid.length === 0) {
    return NextResponse.json({ imported: 0, duplicates: 0, skipped });
  }

  // Batch check for existing customers by phone
  const phones = valid.map(c => c.phone);
  const { data: existing } = await supabaseAdmin
    .from("customers")
    .select("phone")
    .eq("business_id", business.id)
    .in("phone", phones);

  const existingPhones = new Set((existing ?? []).map(e => e.phone));

  const toInsert: { business_id: string; phone: string; first_name: string | null; last_name: string | null; full_name: string | null; email: string | null }[] = [];

  for (const c of valid) {
    if (existingPhones.has(c.phone)) {
      skipped.push({ name: c.fullName ?? "", phone: c.phone, email: c.email ?? "", reason: "Already exists in Katoomy" });
    } else {
      toInsert.push({
        business_id: business.id,
        phone: c.phone,
        first_name: c.firstName || null,
        last_name: c.lastName || null,
        full_name: c.fullName || null,
        email: c.email || null,
      });
    }
  }

  const duplicates = valid.length - toInsert.length;
  let imported = 0;

  if (toInsert.length > 0) {
    // Insert in batches of 200 to avoid payload limits
    const BATCH = 200;
    for (let i = 0; i < toInsert.length; i += BATCH) {
      const batch = toInsert.slice(i, i + BATCH);
      const { error } = await supabaseAdmin.from("customers").insert(batch);
      if (!error) imported += batch.length;
    }
  }

  return NextResponse.json({ imported, duplicates, skipped });
}
