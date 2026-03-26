import React, { useEffect, useState, useCallback } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StripeTerminalProvider } from "@stripe/stripe-terminal-react-native";
import { supabase } from "@/lib/supabase";
import LoginScreen from "@/screens/LoginScreen";
import ScheduleScreen from "@/screens/ScheduleScreen";
import ChargeScreen from "@/screens/ChargeScreen";

const API_URL = process.env.EXPO_PUBLIC_API_URL!;

type Screen = "login" | "schedule" | "charge";

interface Booking {
  id: string;
  services: { name: string; price_cents: number };
  customers: { name: string; phone: string | null };
  [key: string]: unknown;
}

interface Business {
  id: string;
  name: string;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("login");
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [chargeContext, setChargeContext] = useState<{
    booking: Booking;
    business: Business;
    serviceCents: number;
  } | null>(null);

  // Check for existing session on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        loadBusiness();
      }
    });
  }, []);

  const loadBusiness = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setScreen("login"); return; }

    const { data: biz } = await supabase
      .from("businesses")
      .select("id")
      .eq("owner_user_id", user.id)
      .single();

    if (biz) {
      setBusinessId(biz.id);
      // Ensure Terminal location exists for this business
      fetch(`${API_URL}/api/terminal/location/ensure`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: biz.id }),
      }).catch(console.error);
      setScreen("schedule");
    } else {
      setScreen("login");
    }
  };

  // Stripe Terminal connection token provider
  const fetchConnectionToken = useCallback(async () => {
    if (!businessId) throw new Error("No business loaded");
    const res = await fetch(`${API_URL}/api/terminal/connection-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId }),
    });
    const data = await res.json();
    if (!data.secret) throw new Error("Failed to get connection token");
    return data.secret;
  }, [businessId]);

  const handleCharge = (booking: Booking, business: Business, serviceCents: number) => {
    setChargeContext({ booking, business, serviceCents });
    setScreen("charge");
  };

  const handleChargeComplete = () => {
    setChargeContext(null);
    setScreen("schedule");
  };

  const handleLogout = () => {
    setBusinessId(null);
    setChargeContext(null);
    setScreen("login");
  };

  return (
    <SafeAreaProvider>
      <StripeTerminalProvider
        logLevel="verbose"
        tokenProvider={fetchConnectionToken}
      >
        {screen === "login" && (
          <LoginScreen onLogin={loadBusiness} />
        )}
        {screen === "schedule" && (
          <ScheduleScreen
            onCharge={handleCharge as never}
            onLogout={handleLogout}
          />
        )}
        {screen === "charge" && chargeContext && (
          <ChargeScreen
            booking={chargeContext.booking}
            business={chargeContext.business}
            serviceCents={chargeContext.serviceCents}
            onComplete={handleChargeComplete}
            onCancel={() => setScreen("schedule")}
          />
        )}
      </StripeTerminalProvider>
    </SafeAreaProvider>
  );
}
