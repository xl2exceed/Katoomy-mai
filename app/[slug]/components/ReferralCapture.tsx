"use client";

import { useEffect } from "react";

export default function ReferralCapture({
  businessSlug,
  referralCode,
  netRef,
}: {
  businessSlug: string;
  referralCode: string | null;
  netRef: string | null;
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
      JSON.stringify({ offerId: netRef, businessSlug, ts: Date.now() }),
    );
  }, [netRef, businessSlug]);

  return null;
}
