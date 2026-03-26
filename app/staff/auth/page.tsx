"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createStaffClient as createClient } from "@/lib/supabase/staff-client";
import type { Session } from "@supabase/supabase-js";

export default function StaffAuthPage() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    // New flow: server pre-exchanged QR token — exchange for session tokens without
    // the browser ever visiting supabase.co (prevents other portal session contamination).
    const qrToken = new URLSearchParams(window.location.search).get("qr");
    if (qrToken) {
      fetch("/api/staff/qr-exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qr: qrToken }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.error || !data.access_token) {
            router.replace("/staff/login?error=link_expired");
            return;
          }
          supabase.auth
            .setSession({ access_token: data.access_token, refresh_token: data.refresh_token })
            .then((result: { data: { session: Session | null }; error: Error | null }) => {
              if (result.error || !result.data.session) {
                router.replace("/staff/login?error=link_expired");
              } else {
                router.replace("/staff/dashboard");
              }
            });
        })
        .catch(() => router.replace("/staff/login?error=link_expired"));
      return;
    }

    // Legacy flow: magic link hash (fallback if server-side exchange failed)
    const hash = window.location.hash;
    if (!hash) {
      supabase.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
        if (data.session) {
          router.replace("/staff/dashboard");
        } else {
          router.replace("/staff/login?error=link_expired");
        }
      });
      return;
    }

    const params = new URLSearchParams(hash.substring(1));
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");

    if (!accessToken || !refreshToken) {
      router.replace("/staff/login?error=link_expired");
      return;
    }

    supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then((result: { data: { session: Session | null }; error: Error | null }) => {
        if (result.error || !result.data.session) {
          router.replace("/staff/login?error=link_expired");
        } else {
          router.replace("/staff/dashboard");
        }
      });
  }, [router]);

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-3">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      <p className="text-sm text-gray-500">Signing you in...</p>
    </div>
  );
}
