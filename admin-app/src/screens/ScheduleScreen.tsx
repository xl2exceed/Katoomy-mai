import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { supabase } from "@/lib/supabase";

interface Booking {
  id: string;
  start_ts: string;
  end_ts: string;
  status: string;
  payment_status: string;
  total_price_cents: number;
  deposit_amount_cents: number | null;
  services: { name: string; price_cents: number };
  customers: { name: string; phone: string | null };
}

interface Business {
  id: string;
  name: string;
}

interface Props {
  onCharge: (booking: Booking, business: Business, serviceCents: number) => void;
  onLogout: () => void;
}

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function getServiceCents(booking: Booking): number {
  if (booking.payment_status === "deposit_paid") {
    return booking.services.price_cents - (booking.deposit_amount_cents ?? 0);
  }
  return booking.total_price_cents;
}

export default function ScheduleScreen({ onCharge, onLogout }: Props) {
  const [business, setBusiness] = useState<Business | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: biz } = await supabase
      .from("businesses")
      .select("id, name")
      .eq("owner_user_id", user.id)
      .single();

    if (!biz) return;
    setBusiness(biz);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const { data } = await supabase
      .from("bookings")
      .select("*, services(name, price_cents), customers(name, phone)")
      .eq("business_id", biz.id)
      .gte("start_ts", todayStart.toISOString())
      .lte("start_ts", todayEnd.toISOString())
      .in("payment_status", ["unpaid", "deposit_paid"])
      .in("status", ["confirmed", "completed"])
      .order("start_ts", { ascending: true });

    setBookings((data as Booking[]) || []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    onLogout();
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{business?.name || "Today"}</Text>
        <TouchableOpacity onPress={handleLogout}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionLabel}>Awaiting Payment</Text>

      {bookings.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No payments due today</Text>
        </View>
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />
          }
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const serviceCents = getServiceCents(item);
            const isDeposit = item.payment_status === "deposit_paid";
            return (
              <View style={styles.card}>
                <View style={styles.cardRow}>
                  <View style={styles.cardInfo}>
                    <Text style={styles.customerName}>
                      {item.customers?.name || "Customer"}
                    </Text>
                    <Text style={styles.serviceName}>{item.services.name}</Text>
                    <Text style={styles.time}>{formatTime(item.start_ts)}</Text>
                    {isDeposit && (
                      <Text style={styles.depositLabel}>Remaining balance</Text>
                    )}
                  </View>
                  <View style={styles.cardRight}>
                    <Text style={styles.amount}>
                      ${(serviceCents / 100).toFixed(2)}
                    </Text>
                    <TouchableOpacity
                      style={styles.chargeButton}
                      onPress={() => business && onCharge(item, business, serviceCents)}
                    >
                      <Text style={styles.chargeButtonText}>Charge</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#111827" },
  logoutText: { fontSize: 14, color: "#6b7280" },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardInfo: { flex: 1 },
  customerName: { fontSize: 16, fontWeight: "700", color: "#111827" },
  serviceName: { fontSize: 14, color: "#4b5563", marginTop: 2 },
  time: { fontSize: 13, color: "#9ca3af", marginTop: 2 },
  depositLabel: { fontSize: 12, color: "#f97316", marginTop: 4, fontWeight: "600" },
  cardRight: { alignItems: "flex-end" },
  amount: { fontSize: 18, fontWeight: "700", color: "#111827", marginBottom: 8 },
  chargeButton: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  chargeButtonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  emptyState: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 80 },
  emptyText: { fontSize: 16, color: "#9ca3af" },
});
