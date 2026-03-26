import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useStripeTerminal } from "@stripe/stripe-terminal-react-native";

const API_URL = process.env.EXPO_PUBLIC_API_URL!;

const TIP_PRESETS = [
  { label: "15%", pct: 0.15 },
  { label: "20%", pct: 0.2 },
  { label: "25%", pct: 0.25 },
];

interface Booking {
  id: string;
  services: { name: string; price_cents: number };
  customers: { name: string };
}

interface Business {
  id: string;
  name: string;
}

type ChargeStep = "tip" | "tapping" | "done";

interface Props {
  booking: Booking;
  business: Business;
  serviceCents: number;
  onComplete: () => void;
  onCancel: () => void;
}

export default function ChargeScreen({
  booking,
  business,
  serviceCents,
  onComplete,
  onCancel,
}: Props) {
  const [tipCents, setTipCents] = useState(0);
  const [customDollars, setCustomDollars] = useState("");
  const [step, setStep] = useState<ChargeStep>("tip");
  const [statusText, setStatusText] = useState("Waiting for card...");
  const paymentIntentIdRef = useRef<string | null>(null);

  const {
    collectPaymentMethod,
    confirmPaymentIntent,
    cancelCollectPaymentMethod,
  } = useStripeTerminal();

  const totalCents = serviceCents + tipCents;

  const isPresetSelected = (pct: number) =>
    tipCents === Math.round(serviceCents * pct) && customDollars === "";

  const handlePreset = (pct: number) => {
    setCustomDollars("");
    setTipCents(Math.round(serviceCents * pct));
  };

  const handleNoTip = () => {
    setCustomDollars("");
    setTipCents(0);
  };

  const handleCustomChange = (val: string) => {
    setCustomDollars(val);
    const parsed = parseFloat(val);
    setTipCents(!isNaN(parsed) && parsed > 0 ? Math.round(parsed * 100) : 0);
  };

  const handleCharge = async () => {
    setStep("tapping");
    setStatusText("Creating payment...");

    try {
      // 1. Create PaymentIntent on server
      const piRes = await fetch(`${API_URL}/api/terminal/payment-intent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: booking.id,
          businessId: business.id,
          serviceCents,
          tipCents,
        }),
      });

      const piData = await piRes.json();
      if (!piRes.ok || !piData.clientSecret) {
        throw new Error(piData.error || "Failed to create payment");
      }

      paymentIntentIdRef.current = piData.paymentIntentId;
      setStatusText("Hold card near phone to pay...");

      // 2. Collect payment method (Tap to Pay)
      const { error: collectError } = await collectPaymentMethod({
        paymentIntentClientSecret: piData.clientSecret,
      });

      if (collectError) {
        throw new Error(collectError.message);
      }

      setStatusText("Processing payment...");

      // 3. Confirm the payment intent
      const { error: confirmError } = await confirmPaymentIntent({
        paymentIntentClientSecret: piData.clientSecret,
      });

      if (confirmError) {
        throw new Error(confirmError.message);
      }

      setStatusText("Confirming with server...");

      // 4. Mark booking paid on server
      const confirmRes = await fetch(`${API_URL}/api/terminal/confirm-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentIntentId: piData.paymentIntentId,
          bookingId: booking.id,
          businessId: business.id,
        }),
      });

      const confirmData = await confirmRes.json();
      if (!confirmRes.ok || !confirmData.success) {
        throw new Error(confirmData.error || "Failed to confirm payment");
      }

      setStep("done");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Payment failed";
      setStep("tip");
      Alert.alert("Payment Failed", message);
    }
  };

  const handleCancel = async () => {
    if (step === "tapping") {
      await cancelCollectPaymentMethod();
    }
    onCancel();
  };

  if (step === "done") {
    return (
      <View style={styles.container}>
        <View style={styles.doneCard}>
          <Text style={styles.doneIcon}>✅</Text>
          <Text style={styles.doneTitle}>Payment Complete!</Text>
          <Text style={styles.doneAmount}>
            ${(totalCents / 100).toFixed(2)} charged
          </Text>
          {tipCents > 0 && (
            <Text style={styles.doneTip}>
              Includes ${(tipCents / 100).toFixed(2)} tip
            </Text>
          )}
          <TouchableOpacity style={styles.doneButton} onPress={onComplete}>
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (step === "tapping") {
    return (
      <View style={styles.container}>
        <View style={styles.tappingCard}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.tappingText}>{statusText}</Text>
          <Text style={styles.tappingAmount}>
            ${(totalCents / 100).toFixed(2)}
          </Text>
          <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Charge Customer</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.card}>
        <Text style={styles.customerName}>
          {booking.customers?.name || "Customer"}
        </Text>
        <Text style={styles.serviceName}>{booking.services.name}</Text>
        <Text style={styles.serviceAmount}>
          Service: ${(serviceCents / 100).toFixed(2)}
        </Text>
      </View>

      <Text style={styles.sectionLabel}>Add a Tip?</Text>

      {/* No tip */}
      <TouchableOpacity
        style={[
          styles.noTipButton,
          tipCents === 0 && customDollars === "" && styles.noTipSelected,
        ]}
        onPress={handleNoTip}
      >
        <Text
          style={[
            styles.noTipText,
            tipCents === 0 && customDollars === "" && styles.noTipTextSelected,
          ]}
        >
          No tip
        </Text>
      </TouchableOpacity>

      {/* Preset buttons */}
      <View style={styles.presets}>
        {TIP_PRESETS.map(({ label, pct }) => {
          const cents = Math.round(serviceCents * pct);
          return (
            <TouchableOpacity
              key={label}
              style={[
                styles.presetButton,
                isPresetSelected(pct) && styles.presetSelected,
              ]}
              onPress={() => handlePreset(pct)}
            >
              <Text
                style={[
                  styles.presetLabel,
                  isPresetSelected(pct) && styles.presetLabelSelected,
                ]}
              >
                {label}
              </Text>
              <Text
                style={[
                  styles.presetAmount,
                  isPresetSelected(pct) && styles.presetLabelSelected,
                ]}
              >
                ${(cents / 100).toFixed(2)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Custom amount */}
      <View style={styles.customRow}>
        <Text style={styles.dollarSign}>$</Text>
        <TextInput
          style={styles.customInput}
          placeholder="Custom tip"
          placeholderTextColor="#9ca3af"
          value={customDollars}
          onChangeText={handleCustomChange}
          keyboardType="decimal-pad"
        />
      </View>

      {/* Summary */}
      <View style={styles.summary}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Service</Text>
          <Text style={styles.summaryValue}>${(serviceCents / 100).toFixed(2)}</Text>
        </View>
        {tipCents > 0 && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Tip</Text>
            <Text style={styles.summaryValue}>${(tipCents / 100).toFixed(2)}</Text>
          </View>
        )}
        <View style={[styles.summaryRow, styles.totalRow]}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>${(totalCents / 100).toFixed(2)}</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.chargeButton} onPress={handleCharge}>
        <Text style={styles.chargeButtonText}>
          Charge ${(totalCents / 100).toFixed(2)}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  scroll: { padding: 20, paddingBottom: 48 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    paddingTop: 8,
  },
  backText: { fontSize: 16, color: "#2563eb", width: 60 },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  customerName: { fontSize: 18, fontWeight: "700", color: "#111827" },
  serviceName: { fontSize: 15, color: "#4b5563", marginTop: 4 },
  serviceAmount: { fontSize: 14, color: "#6b7280", marginTop: 4 },
  sectionLabel: { fontSize: 14, fontWeight: "600", color: "#374151", marginBottom: 12 },
  noTipButton: {
    borderWidth: 2,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 12,
  },
  noTipSelected: { backgroundColor: "#111827", borderColor: "#111827" },
  noTipText: { fontSize: 15, fontWeight: "600", color: "#374151" },
  noTipTextSelected: { color: "#fff" },
  presets: { flexDirection: "row", gap: 10, marginBottom: 16 },
  presetButton: {
    flex: 1,
    borderWidth: 2,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  presetSelected: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  presetLabel: { fontSize: 16, fontWeight: "700", color: "#374151" },
  presetAmount: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  presetLabelSelected: { color: "#fff" },
  customRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 20,
  },
  dollarSign: { fontSize: 16, color: "#6b7280", marginRight: 4 },
  customInput: { flex: 1, fontSize: 16, color: "#111827", paddingVertical: 14 },
  summary: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  summaryLabel: { fontSize: 14, color: "#6b7280" },
  summaryValue: { fontSize: 14, color: "#374151" },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 10,
    marginTop: 4,
    marginBottom: 0,
  },
  totalLabel: { fontSize: 16, fontWeight: "700", color: "#111827" },
  totalValue: { fontSize: 16, fontWeight: "700", color: "#111827" },
  chargeButton: {
    backgroundColor: "#2563eb",
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: "center",
  },
  chargeButtonText: { color: "#fff", fontSize: 18, fontWeight: "700" },
  // Tapping state
  tappingCard: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  tappingText: { fontSize: 18, fontWeight: "600", color: "#111827", marginTop: 24, textAlign: "center" },
  tappingAmount: { fontSize: 36, fontWeight: "700", color: "#2563eb", marginTop: 12 },
  cancelButton: { marginTop: 40, paddingVertical: 14, paddingHorizontal: 32 },
  cancelText: { fontSize: 16, color: "#6b7280" },
  // Done state
  doneCard: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  doneIcon: { fontSize: 64, marginBottom: 16 },
  doneTitle: { fontSize: 26, fontWeight: "700", color: "#111827", marginBottom: 8 },
  doneAmount: { fontSize: 20, fontWeight: "600", color: "#2563eb", marginBottom: 4 },
  doneTip: { fontSize: 14, color: "#6b7280", marginBottom: 32 },
  doneButton: {
    backgroundColor: "#2563eb",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 48,
  },
  doneButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
