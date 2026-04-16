"use client";
import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

const PHONE_STORAGE_KEY = "katoomy:customerPhone";

export default function ResetSessionPage() {
  const params = useParams();
  const slug = params.slug as string;
  const router = useRouter();

  useEffect(() => {
    localStorage.removeItem(PHONE_STORAGE_KEY);
    router.replace(`/${slug}/dashboard`);
  }, [slug, router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600 mx-auto mb-3" />
        <p className="text-gray-500 text-sm">Clearing session...</p>
      </div>
    </div>
  );
}
