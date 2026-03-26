// file: app/[slug]/layout.tsx
import type { ReactNode } from "react";
import SwRegistrar from "@/components/SwRegistrar";

export default function SlugLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SwRegistrar />
      {children}
    </>
  );
}
