import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Katoomy Admin",
  robots: "noindex, nofollow",
};

export default function KatoomyAdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
