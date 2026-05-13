"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

interface PartnerOffer {
  id: string;
  title: string;
  offer_type: "dollar_off" | "percent_off";
  amount: number;
  business_name: string;
  business_slug: string;
  via_business_id: string;
}

export default function TipSuccessPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const slug = params.slug as string;
  const sessionId = searchParams.get("session_id");

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [tipDollars, setTipDollars] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [partnerOffers, setPartnerOffers] = useState<PartnerOffer[]>([]);

  useEffect(() => {
    if (!sessionId) {
      router.push(`/${slug}/dashboard`);
      return;
    }
    confirmTip();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const confirmTip = async () => {
    try {
      const res = await fetch("/api/stripe/confirm-tip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, slug }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setErrorMessage(data.error || "Something went wrong");
        setStatus("error");
        return;
      }

      setTipDollars((data.amountCents / 100).toFixed(2));
      setStatus("success");
      fetch(`/api/network/partner-offers?slug=${slug}`)
        .then((r) => r.json())
        .then((d) => { if (d.offers?.length) setPartnerOffers(d.offers); })
        .catch(() => {});
    } catch (err) {
      console.error("Tip confirmation error:", err);
      setErrorMessage("Failed to confirm your tip. Your payment was still processed.");
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-sm w-full space-y-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10 text-center">
        {status === "loading" && (
          <>
            <div className="animate-spin rounded-full h-14 w-14 border-b-2 border-blue-600 mx-auto mb-4" />
            <p className="text-gray-700 font-medium">Confirming your tip...</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="text-6xl mb-4">💝</div>
            <h2 className="text-2xl font-bold text-gray-900">Thank You!</h2>
            {tipDollars && (
              <p className="text-3xl font-bold text-blue-600 mt-2">${tipDollars}</p>
            )}
            <p className="text-gray-600 mt-3 mb-8">
              Your tip means the world to us. See you next time!
            </p>
            <Link
              href={`/${slug}/dashboard`}
              className="block w-full bg-blue-600 text-white py-4 rounded-xl font-semibold"
            >
              Back to Home
            </Link>
          </>
        )}

        {status === "error" && (
          <>
            <div className="text-6xl mb-4">❌</div>
            <h2 className="text-xl font-bold text-gray-900">Something went wrong</h2>
            <p className="text-gray-600 mt-2 text-sm">{errorMessage}</p>
            <Link
              href={`/${slug}/dashboard`}
              className="block mt-6 w-full bg-blue-600 text-white py-3 rounded-xl font-semibold"
            >
              Go Home
            </Link>
          </>
        )}
      </div>

      {/* Partner Offers */}
      {status === "success" && partnerOffers.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-3">🤝 Unlock offers at trusted local businesses</p>
          <div className="space-y-2">
            {partnerOffers.map((offer) => (
              <Link
                key={offer.id}
                href={`/${offer.business_slug}?net_ref=${offer.id}&via=${offer.via_business_id}`}
                className="flex items-center justify-between bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:border-purple-300 hover:shadow-md transition"
              >
                <div>
                  <p className="font-semibold text-gray-900">{offer.business_name}</p>
                  <p className="text-sm text-purple-600 font-medium">
                    {offer.offer_type === "dollar_off" ? `$${(offer.amount / 100).toFixed(0)} off your visit` : `${offer.amount}% off your visit`}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{offer.title}</p>
                </div>
                <span className="text-purple-600 font-medium text-sm ml-3 flex-shrink-0">Claim →</span>
              </Link>
            ))}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
