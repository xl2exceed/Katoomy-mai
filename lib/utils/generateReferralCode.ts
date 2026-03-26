// file: lib/utils/generateReferralCode.ts

export function generateReferralCode(
  name: string | null,
  phone: string,
): string {
  // Get base from name or phone
  let base = "";

  if (name && name.trim().length > 0) {
    // Use first name, remove spaces and special chars, take first 4-6 letters
    const firstName = name.trim().split(" ")[0];
    base = firstName
      .replace(/[^a-zA-Z]/g, "")
      .toUpperCase()
      .substring(0, Math.min(6, firstName.length));
  } else {
    // Fallback to last 4 digits of phone
    base = "CUST" + phone.slice(-4);
  }

  // Add random 3-digit number
  const randomNum = Math.floor(100 + Math.random() * 900);

  return `${base}${randomNum}`;
}

export async function ensureUniqueReferralCode(
  supabase: ReturnType<typeof import("@/lib/supabase/client").createClient>,
  businessId: string,
  name: string | null,
  phone: string,
): Promise<string> {
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    const code = generateReferralCode(name, phone);

    // IMPORTANT:
    // We use maybeSingle() here because "no rows found" is NORMAL
    // when testing a brand-new referral code.
    const { data, error } = await supabase
      .from("customers")
      .select("id")
      .eq("business_id", businessId)
      .eq("referral_code", code)
      .maybeSingle();

    // If there's a real error (not just "no rows"), log it and retry
    if (error) {
      console.warn("Referral code uniqueness check error:", error);
      attempts++;
      continue;
    }

    // If no customer exists with this code, it's unique
    if (!data) {
      return code;
    }

    attempts++;
  }

  // Fallback: extremely unlikely, but guarantees a code
  return `REF${Date.now().toString().slice(-6)}`;
}
