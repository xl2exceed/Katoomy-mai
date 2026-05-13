"use client";

import { useEffect } from "react";

export default function ReferralCapture({
  businessSlug,
  referralCode,
  netRef,
  netRefVia,
  bizRef,
}: {
  businessSlug: string;
  referralCode: string | null;
  netRef: string | null;
  netRefVia?: string | null;
  bizRef?: string | null;
}) {
  useEffect(() => {
    localStorage.setItem("katoomy:lastBusiness", businessSlug);
  }, [businessSlug]);

  // Capture customer referral ONCE (don’t overwrite)
  useEffect(() => {
    if (!referralCode) return;
    const existing = localStorage.getItem("katoomy:pendingReferral");
    if (existing) return;
    localStorage.setItem(
      "katoomy:pendingReferral",
      JSON.stringify({ businessSlug, referralCode, ts: Date.now() }),
    );
  }, [referralCode, businessSlug]);

  // Capture network offer ref — overwrite if a newer one arrives
  useEffect(() => {
    if (!netRef) return;
    localStorage.setItem(
      "katoomy:netRef",
      JSON.stringify({ offerId: netRef, via: netRefVia ?? null, businessSlug, ts: Date.now() }),
    );
  }, [netRef, netRefVia, businessSlug]);

  // Capture B2B direct referral — overwrite if a newer one arrives
  useEffect(() => {
    if (!bizRef) return;
    localStorage.setItem(
      "katoomy:bizRef",
      JSON.stringify({ referralId: bizRef, businessSlug, ts: Date.now() }),
    );
  }, [bizRef, businessSlug]);

  return null;
}
