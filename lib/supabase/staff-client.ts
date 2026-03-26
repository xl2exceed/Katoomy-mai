// Separate Supabase browser client for the staff portal.
// Uses a distinct storageKey so the staff session lives in a different
// localStorage slot than the admin/customer session — allowing all three
// portals to be logged in simultaneously on the same device.

import { createBrowserClient } from "@supabase/ssr";

let client: ReturnType<typeof createBrowserClient> | undefined;

export function createStaffClient() {
  if (client) return client;

  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        storageKey: "katoomy-staff-auth",
      },
    },
  );

  return client;
}

/** Reset singleton after signOut to clear stale auth state. */
export function clearStaffClient() {
  client = undefined;
}
