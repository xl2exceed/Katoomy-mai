
// file: supabase/functions/stripe-connect-start/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import Stripe from "https://esm.sh/stripe@14.10.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { business_id, refresh_url, return_url } = await req.json();

    // Check if account already exists
    const { data: existingAccount } = await supabaseClient
      .from("stripe_connect_accounts")
      .select("*")
      .eq("business_id", business_id)
      .single();

    let accountId = existingAccount?.stripe_account_id;

    // Create account if it doesn't exist
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "standard",
      });
      accountId = account.id;

      await supabaseClient.from("stripe_connect_accounts").insert({
        business_id,
        stripe_account_id: accountId,
        status: "pending",
      });
    }

    // Create account link
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refresh_url || `${Deno.env.get("APP_URL")}/admin/stripe`,
      return_url: return_url || `${Deno.env.get("APP_URL")}/admin/stripe`,
      type: "account_onboarding",
    });

    return new Response(
      JSON.stringify({
        url: accountLink.url,
        account_id: accountId,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});