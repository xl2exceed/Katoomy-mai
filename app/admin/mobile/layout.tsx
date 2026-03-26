import type { ReactNode } from "react";
import type { Metadata } from "next";
import AdminSwRegistrar from "@/components/AdminSwRegistrar";
import AdminPwaInstallPrompt from "@/components/AdminPwaInstallPrompt";

export const metadata: Metadata = {
  manifest: "/admin-manifest.webmanifest",
  themeColor: "#111827",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Katoomy Business",
  },
};

export default function AdminMobileLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      <AdminSwRegistrar />
      <AdminPwaInstallPrompt />
      {children}
    </>
  );
}
