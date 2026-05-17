// /hub/add — iOS referral landing page.
// SMS referral links point here. The page validates the signed token,
// adds the business to the customer's server-side hub, then tells them
// to open Katoomy from their home screen.
//
// Token expired / missing: shows a graceful fallback message instead of
// requiring a full OTP flow.

import { supabaseAdmin } from "@/lib/supabase/admin";
import { verifyHubToken } from "@/lib/hubToken";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function param(v: string | string[] | undefined): string | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] : v;
}

export default async function HubAddPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const businessSlug = param(sp.business);
  const token = param(sp.t);
  const bizRefId = param(sp.biz_ref);
  const netRefOfferId = param(sp.net_ref);
  const netRefVia = param(sp.via);

  // ── Missing business slug ──────────────────────────────────────────────────
  if (!businessSlug) {
    return <Message icon="❌" heading="Invalid link" body="This referral link is missing the business. Ask the sender to resend it." />;
  }

  // ── Fetch business details for display ────────────────────────────────────
  const { data: biz } = await supabaseAdmin
    .from("businesses")
    .select("name, app_name, logo_url, primary_color")
    .eq("slug", businessSlug)
    .maybeSingle();

  const businessName = biz?.app_name || biz?.name || businessSlug;
  const primaryColor = biz?.primary_color || "#422354";

  // ── Missing or expired token ───────────────────────────────────────────────
  if (!token) {
    return (
      <Message
        icon="🔗"
        heading="Link expired"
        body={`Open Katoomy from your home screen, tap the + button, and scan the QR code for ${businessName} to add it to your hub.`}
        primaryColor={primaryColor}
      />
    );
  }

  const payload = verifyHubToken(token);
  if (!payload) {
    return (
      <Message
        icon="⏱️"
        heading="Link expired"
        body={`This link is more than 7 days old. Open Katoomy from your home screen, tap the + button, and scan the QR code for ${businessName} to add it to your hub.`}
        primaryColor={primaryColor}
      />
    );
  }

  // ── Add business to hub server-side ───────────────────────────────────────
  const { data: account } = await supabaseAdmin
    .from("hub_accounts")
    .upsert({ phone: payload.phone }, { onConflict: "phone" })
    .select("id")
    .single();

  if (account) {
    await supabaseAdmin
      .from("hub_businesses")
      .upsert(
        {
          hub_account_id: account.id,
          business_slug: businessSlug,
          biz_ref_id: bizRefId ?? null,
          net_ref_offer_id: netRefOfferId ?? null,
          net_ref_via: netRefVia ?? null,
        },
        { onConflict: "hub_account_id,business_slug" }
      );
  }

  // ── Success ────────────────────────────────────────────────────────────────
  const hasDiscount = !!(bizRefId || netRefOfferId);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 py-16"
      style={{ backgroundColor: primaryColor }}
    >
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-8 flex flex-col items-center text-center gap-5">
        {biz?.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={biz.logo_url}
            alt={businessName}
            className="w-20 h-20 rounded-2xl object-cover shadow-md"
          />
        ) : (
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl shadow-md"
            style={{ backgroundColor: primaryColor }}
          >
            🏢
          </div>
        )}

        <div className="text-5xl">✅</div>

        <div>
          <h1 className="text-2xl font-black text-gray-900 mb-2">
            {businessName} added!
          </h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            {hasDiscount
              ? `${businessName} has been added to your Katoomy hub with your referral discount. Open Katoomy from your home screen to book your first appointment.`
              : `${businessName} has been added to your Katoomy hub. Open Katoomy from your home screen to see it.`}
          </p>
        </div>

        <div className="w-full bg-gray-50 rounded-2xl p-4 flex items-center gap-3">
          <div className="text-2xl flex-shrink-0">📱</div>
          <p className="text-gray-700 text-sm font-semibold text-left">
            Tap the Katoomy icon on your home screen to open the app
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Shared message component ─────────────────────────────────────────────────
function Message({
  icon,
  heading,
  body,
  primaryColor = "#422354",
}: {
  icon: string;
  heading: string;
  body: string;
  primaryColor?: string;
}) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 py-16"
      style={{ backgroundColor: primaryColor }}
    >
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-8 flex flex-col items-center text-center gap-4">
        <div className="text-5xl">{icon}</div>
        <h1 className="text-xl font-black text-gray-900">{heading}</h1>
        <p className="text-gray-500 text-sm leading-relaxed">{body}</p>
      </div>
    </div>
  );
}
