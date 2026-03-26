import type { ReactNode } from "react";
import type { Metadata } from "next";
import StaffSwRegistrar from "@/components/StaffSwRegistrar";
import StaffPwaInstallPrompt from "@/components/StaffPwaInstallPrompt";

export const metadata: Metadata = {
  manifest: "/staff-manifest.webmanifest",
  themeColor: "#2563eb",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Katoomy Staff",
  },
};

export default function StaffLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <StaffSwRegistrar />
      <StaffPwaInstallPrompt />
      {children}
    </>
  );
}
