// file: app/api/carwash/price/route.ts
// POST /api/carwash/price
// Calculates the total price for a car wash booking including:
//   - Base service price (flat or vehicle-based)
//   - Add-on prices
//   - Travel fee (if mobile/hybrid and address provided)
//
// Body: { businessId, serviceId, vehicleType, vehicleCondition, addonIds, customerAddress? }
// Returns: { basePriceCents, addonTotalCents, travelFeeCents, totalCents, breakdown }

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

type VehicleType = "sedan" | "suv" | "truck" | "van" | "other";
type VehicleCondition = "light" | "heavy";

interface VehiclePricing {
  [vehicleType: string]: {
    light?: number;
    heavy?: number;
  };
}

export async function POST(req: NextRequest) {
  try {
    const {
      businessId,
      serviceId,
      vehicleType,
      vehicleCondition,
      addonIds = [],
      customerAddress,
    }: {
      businessId: string;
      serviceId: string;
      vehicleType?: VehicleType;
      vehicleCondition?: VehicleCondition;
      addonIds?: string[];
      customerAddress?: string;
    } = await req.json();

    if (!businessId || !serviceId) {
      return NextResponse.json({ error: "businessId and serviceId are required" }, { status: 400 });
    }

    // Fetch service
    const { data: service } = await supabaseAdmin
      .from("services")
      .select("id, name, price_cents, duration_minutes, pricing_type, vehicle_pricing")
      .eq("id", serviceId)
      .eq("business_id", businessId)
      .single();

    if (!service) return NextResponse.json({ error: "Service not found" }, { status: 404 });

    // Calculate base price
    let basePriceCents = service.price_cents;
    let vehiclePriceNote = "";

    if (service.pricing_type === "vehicle_based" && service.vehicle_pricing) {
      const vp = service.vehicle_pricing as VehiclePricing;
      const vType = vehicleType ?? "sedan";
      const vCond = vehicleCondition ?? "light";
      const typeData = vp[vType];
      if (typeData) {
        const condPrice = typeData[vCond];
        if (typeof condPrice === "number") {
          basePriceCents = condPrice;
          vehiclePriceNote = `${vType} / ${vCond}`;
        } else {
          // Fallback to light if heavy not set
          basePriceCents = typeData["light"] ?? service.price_cents;
          vehiclePriceNote = `${vType} / light (fallback)`;
        }
      }
      // If vehicle type not in pricing, fall back to flat price
    }

    // Calculate add-on total
    let addonTotalCents = 0;
    let addonTotalDuration = 0;
    const addonBreakdown: { id: string; name: string; price_cents: number; duration_minutes: number }[] = [];

    if (addonIds.length > 0) {
      const { data: addons } = await supabaseAdmin
        .from("service_addons")
        .select("id, name, price_cents, duration_minutes")
        .in("id", addonIds)
        .eq("business_id", businessId)
        .eq("active", true);

      if (addons) {
        for (const addon of addons) {
          addonTotalCents += addon.price_cents;
          addonTotalDuration += addon.duration_minutes;
          addonBreakdown.push(addon);
        }
      }
    }

    // Calculate travel fee
    let travelFeeCents = 0;
    let travelFeeNote = "";

    if (customerAddress) {
      const { data: cwSettings } = await supabaseAdmin
        .from("carwash_settings")
        .select("travel_fee_enabled, travel_fee_type, travel_fee_flat_cents, travel_fee_per_mile_cents, service_mode")
        .eq("business_id", businessId)
        .maybeSingle();

      if (cwSettings?.travel_fee_enabled) {
        if (cwSettings.travel_fee_type === "flat") {
          travelFeeCents = cwSettings.travel_fee_flat_cents ?? 0;
          travelFeeNote = "Flat travel fee";
        } else if (cwSettings.travel_fee_type === "per_mile") {
          // Distance-based: would require Google Maps API
          // For now, return flat fee as placeholder until Maps integration in Phase 2
          travelFeeCents = cwSettings.travel_fee_flat_cents ?? 0;
          travelFeeNote = "Travel fee (distance calculation coming soon)";
        }
      }
    }

    const totalCents = basePriceCents + addonTotalCents + travelFeeCents;
    const totalDurationMinutes = service.duration_minutes + addonTotalDuration;

    return NextResponse.json({
      basePriceCents,
      addonTotalCents,
      travelFeeCents,
      totalCents,
      totalDurationMinutes,
      breakdown: {
        service: {
          id: service.id,
          name: service.name,
          priceCents: basePriceCents,
          durationMinutes: service.duration_minutes,
          vehicleNote: vehiclePriceNote || null,
        },
        addons: addonBreakdown,
        travelFee: travelFeeCents > 0 ? { cents: travelFeeCents, note: travelFeeNote } : null,
      },
    });
  } catch (err) {
    console.error("Price calculation error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
