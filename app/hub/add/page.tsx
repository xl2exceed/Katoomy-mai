// /hub/add — iOS referral landing page.
// SMS referral links point here as: /hub/add?c=XXXXXXXX
// The short code is looked up in hub_add_codes, the business is added to the
// customer's server-side hub, then they're told to open Katoomy from home screen.

import { supabaseAdmin } from "@/lib/supabase/admin";
import { lookupHubCode } from "@/lib/hubCode";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function param(v: string | string[] | undefined): string | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] : v;
}

export default async function HubAddPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const code = param(sp.c);

  // ── Missing code ───────────────────────────────────────────────────────────
  if (!code) {
    return (
      <Message
        icon="🔗"
        heading="Invalid link"
        body="This referral link is missing required information. Ask the sender to resend it."
      />
    );
  }

  // ── Look up code ───────────────────────────────────────────────────────────
  const payload = await lookupHubCode(code);

  if (!payload) {
    return (
      <Message
        icon="⏱️"
        heading="Link expired"
        body="This link is more than 7 days old. Open Katoomy from your home screen, tap the + button, and scan the QR code to add the business to your hub."
      />
    );
  }

  // ── Fetch business details for display ────────────────────────────────────
  const { data: biz } = await supabaseAdmin
    .from("businesses")
    .select("name, app_name, logo_url, primary_color")
    .eq("slug", payload.businessSlug)
    .maybeSingle();

  const businessName = biz?.app_name || biz?.name || payload.businessSlug;
  const primaryColor = biz?.primary_color || "#422354";

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
          business_slug: payload.businessSlug,
          biz_ref_id: payload.bizRefId ?? null,
          net_ref_offer_id: payload.netRefOfferId ?? null,
          net_ref_via: payload.netRefVia ?? null,
        },
        { onConflict: "hub_account_id,business_slug" }
      );
  }

  // ── Success ────────────────────────────────────────────────────────────────
  const hasDiscount = !!(payload.bizRefId || payload.netRefOfferId);

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
