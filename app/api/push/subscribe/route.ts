import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { subscription, userType, customerId, businessId, staffId } = body;

    if (
      !subscription?.endpoint ||
      !subscription?.keys?.p256dh ||
      !subscription?.keys?.auth
    ) {
      return NextResponse.json(
        { error: "Invalid subscription" },
        { status: 400 },
      );
    }

    if (!userType || !["customer", "business", "staff"].includes(userType)) {
      return NextResponse.json({ error: "Invalid userType" }, { status: 400 });
    }

    // Use admin client -- caller may have no Supabase auth session
    // (customer portal uses phone-only auth; staff uses localStorage not cookies)
    const supabase = supabaseAdmin;

    if (userType === "staff" || userType === "business") {
      // Require a valid Bearer token and confirm identity matches the claimed ID
      const authHeader = req.headers.get("authorization");
      const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
      if (!token) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (userType === "staff" && staffId) {
        const { data: staffRow } = await supabase.from("staff").select("id").eq("id", staffId).eq("user_id", user.id).maybeSingle();
        if (!staffRow) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (userType === "business" && businessId) {
        const { data: bizRow } = await supabase.from("businesses").select("id").eq("id", businessId).eq("owner_user_id", user.id).maybeSingle();
        if (!bizRow) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else if (userType === "customer") {
      // No Supabase auth for customers -- verify the customerId actually exists
      if (!customerId) {
        return NextResponse.json({ error: "Missing customerId" }, { status: 400 });
      }
      const { data: customerRow } = await supabase.from("customers").select("id").eq("id", customerId).maybeSingle();
      if (!customerRow) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Upsert so re-subscribing updates the keys without duplicating
    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        user_type: userType,
        customer_id: customerId || null,
        business_id: businessId || null,
        staff_id: staffId || null,
      },
      { onConflict: "endpoint" },
    );

    if (error) {
      console.error("Error saving push subscription:", error);
      return NextResponse.json(
        { error: "Failed to save subscription" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Push subscribe error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
