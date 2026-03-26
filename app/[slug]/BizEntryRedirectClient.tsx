"use client";

import { useEffect } from "react";

export default function BizEntryRedirectClient({
  slug,
  referralCode,
}: {
  slug: string;
  referralCode: string | null;
}) {
  useEffect(() => {
    // Save last business (makes installed app feel business-specific)
    localStorage.setItem("katoomy:lastBusiness", slug);

    // Save referral ONCE (don’t overwrite)
    if (referralCode) {
      const existing = localStorage.getItem("katoomy:pendingReferral");
      if (!existing) {
        localStorage.setItem(
          "katoomy:pendingReferral",
          JSON.stringify({ businessSlug: slug, referralCode, ts: Date.now() }),
        );
      }
    }

    // Send them into the customer portal (dashboard)
    const target = referralCode
      ? `/${encodeURIComponent(slug)}/dashboard?ref=${encodeURIComponent(
          referralCode,
        )}`
      : `/${encodeURIComponent(slug)}/dashboard`;

    window.location.replace(target);
  }, [slug, referralCode]);

  return null;
}
