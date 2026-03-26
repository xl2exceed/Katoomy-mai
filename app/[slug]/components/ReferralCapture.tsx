"use client";

import { useEffect } from "react";

export default function ReferralCapture({
  businessSlug,
  referralCode,
}: {
  businessSlug: string;
  referralCode: string | null;
}) {
  // Store last business so installed app feels business-specific

  useEffect(() => {
    console.log("ReferralCapture mounted", businessSlug, referralCode);
  }, [businessSlug, referralCode]);

  useEffect(() => {
    localStorage.setItem("katoomy:lastBusiness", businessSlug);
  }, [businessSlug]);

  // Capture referral ONCE (don’t overwrite)
  useEffect(() => {
    if (!referralCode) return;

    const existing = localStorage.getItem("katoomy:pendingReferral");
    if (existing) return;

    localStorage.setItem(
      "katoomy:pendingReferral",
      JSON.stringify({ businessSlug, referralCode, ts: Date.now() }),
    );
  }, [referralCode, businessSlug]);

  return null;
}
