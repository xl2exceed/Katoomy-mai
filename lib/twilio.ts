import twilio from "twilio";

type TwilioMode = "TEST" | "LIVE";

function required(name: string, value?: string) {
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

export function getTwilio() {
  const mode = (process.env.TWILIO_MODE ?? "TEST") as TwilioMode;

  if (mode === "TEST") {
    const sid = required(
      "TWILIO_TEST_ACCOUNT_SID",
      process.env.TWILIO_TEST_ACCOUNT_SID,
    );
    const token = required(
      "TWILIO_TEST_AUTH_TOKEN",
      process.env.TWILIO_TEST_AUTH_TOKEN,
    );
    return { client: twilio(sid, token), mode };
  }

  const sid = required("TWILIO_ACCOUNT_SID", process.env.TWILIO_ACCOUNT_SID);
  const token = required("TWILIO_AUTH_TOKEN", process.env.TWILIO_AUTH_TOKEN);
  return { client: twilio(sid, token), mode };
}

export function getFromNumber(mode: TwilioMode) {
  if (mode === "TEST") return "+15005550006";
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!from) throw new Error("Missing env var: TWILIO_FROM_NUMBER");
  return from;
}

export function getMessagingServiceSid(mode: TwilioMode): string | undefined {
  if (mode === "TEST") return undefined;
  return process.env.TWILIO_MESSAGING_SERVICE_SID || undefined;
}

/** Returns either { messagingServiceSid } or { from } — whichever is configured. */
export function getRouting(mode: TwilioMode): { messagingServiceSid: string } | { from: string } {
  const sid = getMessagingServiceSid(mode);
  if (sid) return { messagingServiceSid: sid };
  return { from: getFromNumber(mode) };
}
