import { Inngest, eventType, staticSchema } from "inngest";

export const bookingCreatedEvent = eventType("katoomy/booking.created", {
  schema: staticSchema<{
    customerId: string;
    businessId: string;
    businessSlug: string;
    businessName: string;
    customerName: string;
    customerEmail: string | null;
    customerPhone: string;
    hasSmsTransactional: boolean;
  }>(),
});

export const inngest = new Inngest({ id: "katoomy" });
