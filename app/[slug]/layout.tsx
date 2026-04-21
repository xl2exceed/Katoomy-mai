// file: app/[slug]/layout.tsx
import type { ReactNode } from "react";
import SwRegistrar from "@/components/SwRegistrar";
import CustomerHelpWidget from "@/components/CustomerHelpWidget";

export default function SlugLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SwRegistrar />
      {children}
      <CustomerHelpWidget />
    </>
  );
}
