import { inngest } from "@/lib/inngest";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const autoMarkIncomplete = inngest.createFunction(
  { id: "auto-mark-incomplete", name: "Auto Mark Incomplete Bookings", retries: 3, triggers: [{ cron: "0 * * * *" }] },
  async ({ step }) => {
    const count = await step.run("mark-incomplete-bookings", async () => {
      const { data: updated, error } = await supabaseAdmin
        .from("bookings")
        .update({ status: "incomplete" })
        .lt("end_ts", new Date().toISOString())
        .in("status", ["requested", "confirmed"])
        .select("id");
      if (error) throw new Error(error.message);
      return updated?.length ?? 0;
    });

    return { success: true, count };
  },
);
