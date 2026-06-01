// file: app/[slug]/offers/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

interface NetworkOffer {
  id: string;
  sending_business_name: string;
  sending_business_slug: string;
  offer_text: string;
  template_label: string;
  offer_discount_cents: number;
  auto_discount_cents: number;
  total_discount_cents: number;
  created_at: string;
  expires_at: string;
  days_remaining: number;
}

interface HubOffer {
  id: string;
  offer_id: string;
  via_business_id: string | null;
  business_name: string;
  business_slug: string;
  offer_title: string;
  offer_type: "dollar_off" | "percent_off";
  offer_amount: number;
  claimed_at: string;
  expires_at: string;
  days_remaining: number;
}

interface Business {
  id: string;
  name: string;
  primary_color: string;
}

const PHONE_STORAGE_KEY = "katoomy:customerPhone";

export default function CustomerOffersPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [offers, setOffers]       = useState<NetworkOffer[]>([]);
  const [hubOffers, setHubOffers] = useState<HubOffer[]>([]);
  const [business, setBusiness]   = useState<Business | null>(null);
  const [loading, setLoading]     = useState(true);
  const [noPhone, setNoPhone]     = useState(false);
  const supabase = createClient();

  useEffect(() => {
    loadOffers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadOffers = async () => {
    const { data: businessData } = await supabase
      .from("businesses")
      .select("id, name, primary_color")
      .eq("slug", slug)
      .single();

    if (!businessData) { setLoading(false); return; }
    setBusiness(businessData);

    const savedPhone = localStorage.getItem(PHONE_STORAGE_KEY);
    if (!savedPhone) {
      setNoPhone(true);
      setLoading(false);
      return;
    }

    // Look up the customer the same way the dashboard does — direct supabase query
    // avoids server-side phone format issues with the slug+phone API branch
    const { data: customerData } = await supabase
      .from("customers")
      .select("id")
      .eq("business_id", businessData.id)
      .eq("phone", savedPhone)
      .maybeSingle();

    if (!customerData) {
      setNoPhone(true);
      setLoading(false);
      return;
    }

    const res = await fetch(
      `/api/customer/broadcast-offers?customerId=${customerData.id}`
    );
    if (res.ok) {
      const json = await res.json();
      setOffers(json.offers ?? []);
      setHubOffers(json.hubOffers ?? []);
    }
    setLoading(false);
  };

  const primaryColor = business?.primary_color || "#3B82F6";

  const bonusOffers    = offers.filter((o) => o.auto_discount_cents > 0);
  const standardOffers = offers.filter((o) => o.auto_discount_cents === 0);

  const HubOfferCard = ({ offer }: { offer: HubOffer }) => {
    const { badge, text } = urgencyBadge(offer.days_remaining);
    const discountLabel = offer.offer_type === "dollar_off"
      ? `$${offer.offer_amount} off`
      : `${offer.offer_amount}% off`;

    return (
      <div className="bg-white rounded-xl shadow-sm border border-violet-200 p-5">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900">{offer.business_name}</p>
            <p className="text-xs text-violet-500 font-semibold mb-1">Partner Deal</p>
            <p className="text-sm text-gray-600">{offer.offer_title}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-2xl font-extrabold text-violet-600">{discountLabel}</p>
          </div>
        </div>
        <div className="flex items-center justify-between mt-3">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${badge}`}>
            {text}
          </span>
          <button
            onClick={() => {
              localStorage.setItem("katoomy:netRef", JSON.stringify({
                offerId:      offer.offer_id,
                via:          offer.via_business_id ?? null,
                businessSlug: offer.business_slug,
                ts:           Date.now(),
              }));
              window.location.href = `/${offer.business_slug}`;
            }}
            className="text-sm font-semibold text-violet-600 hover:text-violet-700 transition"
          >
            Book now →
          </button>
        </div>
      </div>
    );
  };

  const urgencyBadge = (daysLeft: number) => {
    if (daysLeft <= 2) return { badge: "bg-red-100 text-red-700", text: daysLeft === 0 ? "Expires today!" : `${daysLeft} day${daysLeft !== 1 ? "s" : ""} left!` };
    if (daysLeft <= 5) return { badge: "bg-yellow-100 text-yellow-700", text: `${daysLeft} days left` };
    return { badge: "bg-green-100 text-green-700", text: `${daysLeft} days left` };
  };

  const OfferCard = ({ offer }: { offer: NetworkOffer }) => {
    const { badge, text } = urgencyBadge(offer.days_remaining);
    const isBonus = offer.auto_discount_cents > 0;
    return (
      <div className={`bg-white rounded-xl shadow-sm border p-5 ${isBonus ? "border-orange-300" : "border-gray-200"}`}>
        {/* Bonus tag */}
        {isBonus && (
          <div className="flex items-center gap-1.5 mb-3">
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-orange-100 text-orange-700 uppercase tracking-wide">
              ⚡ Bonus Deal — Extra Savings Inside
            </span>
          </div>
        )}

        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900">{offer.sending_business_name}</p>
            <p className="text-xs text-gray-400 mb-1">{offer.template_label}</p>
            <p className="text-sm text-gray-600">{offer.offer_text}</p>
          </div>
          {offer.total_discount_cents > 0 && (
            <div className="text-right flex-shrink-0">
              <p className="text-2xl font-extrabold text-green-600">
                ${(offer.total_discount_cents / 100).toFixed(0)} off
              </p>
            </div>
          )}
        </div>

        {/* Bonus breakdown */}
        {isBonus && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2.5 mb-3">
            <p className="text-xs font-semibold text-orange-800 mb-1">How your savings break down:</p>
            <div className="flex items-center justify-between text-xs text-orange-700">
              <span>Advertised deal</span>
              <span className="font-bold">${(offer.offer_discount_cents / 100).toFixed(0)} off</span>
            </div>
            <div className="flex items-center justify-between text-xs text-orange-700 mt-0.5">
              <span>Network bonus (received extra messages this month)</span>
              <span className="font-bold">+${(offer.auto_discount_cents / 100).toFixed(0)} off</span>
            </div>
            <div className="border-t border-orange-300 mt-1.5 pt-1.5 flex items-center justify-between text-xs font-extrabold text-orange-900">
              <span>Your total discount</span>
              <span>${(offer.total_discount_cents / 100).toFixed(0)} off</span>
            </div>
            <p className="text-xs text-orange-600 mt-1.5 italic">
              This bonus expires when the offer does — use it before it&apos;s gone!
            </p>
          </div>
        )}

        <div className="flex items-center justify-between mt-1">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${badge}`}>
            {text}
          </span>
          <button
            onClick={() => {
              localStorage.setItem("katoomy:broadcastOffer", JSON.stringify({
                logEntryId:          offer.id,
                offerDiscountCents:  offer.offer_discount_cents,
                autoDiscountCents:   offer.auto_discount_cents,
                sendingBusinessSlug: offer.sending_business_slug,
                ts:                  Date.now(),
              }));
              window.location.href = `/${offer.sending_business_slug}`;
            }}
            className="text-sm font-semibold text-purple-600 hover:text-purple-700 transition"
          >
            Book now →
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div
        className="p-6 text-white"
        style={{
          background: business
            ? `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}DD 100%)`
            : "transparent",
        }}
      >
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Network Offers</h1>
            <p className="text-sm opacity-90">{business?.name}</p>
          </div>
          <Link
            href={`/${slug}/dashboard`}
            className="px-4 py-2 bg-white rounded-lg text-sm font-semibold text-gray-900"
          >
            Dashboard
          </Link>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-6">
        {loading ? (
          <div className="text-center py-12">
            <div
              className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto"
              style={{ borderColor: primaryColor }}
            />
          </div>
        ) : noPhone ? (
          <div className="bg-white rounded-xl p-8 text-center shadow-sm border border-gray-200">
            <div className="text-5xl mb-4">🎁</div>
            <p className="font-bold text-gray-900">Sign in to see your offers</p>
            <Link
              href={`/${slug}/dashboard`}
              className="inline-block mt-4 px-6 py-3 rounded-lg text-white font-semibold"
              style={{ backgroundColor: primaryColor }}
            >
              Go to Dashboard
            </Link>
          </div>
        ) : offers.length === 0 && hubOffers.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center shadow-sm border border-gray-200">
            <div className="text-5xl mb-4">🎁</div>
            <p className="font-bold text-gray-900">No active offers right now</p>
            <p className="text-gray-600 mt-2 text-sm">
              When local businesses send you exclusive deals, they&apos;ll appear here for 15 days.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Bonus offers section (over 4-text limit) */}
            {bonusOffers.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-base font-extrabold text-orange-700">⚡ Bonus Deals</span>
                  <span className="bg-orange-100 text-orange-700 text-xs font-bold px-2 py-0.5 rounded-full">
                    Extra savings added
                  </span>
                </div>
                <p className="text-xs text-gray-500 mb-3 -mt-1">
                  You received more than 4 network messages this month, so these businesses added bonus discounts to make it worth your while.
                </p>
                <div className="space-y-3">
                  {bonusOffers.map((offer) => <OfferCard key={offer.id} offer={offer} />)}
                </div>
              </section>
            )}

            {/* Standard offers section */}
            {standardOffers.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-base font-extrabold text-gray-800">Standard Offers</span>
                </div>
                <div className="space-y-3">
                  {standardOffers.map((offer) => <OfferCard key={offer.id} offer={offer} />)}
                </div>
              </section>
            )}

            {/* Hub / partner offers section */}
            {hubOffers.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-base font-extrabold text-violet-700">🤝 Partner Deals</span>
                </div>
                <p className="text-xs text-gray-500 mb-3 -mt-1">
                  Exclusive offers from businesses in your local network.
                </p>
                <div className="space-y-3">
                  {hubOffers.map((offer) => <HubOfferCard key={offer.id} offer={offer} />)}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
