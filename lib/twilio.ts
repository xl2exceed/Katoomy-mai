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
  // Magic From number for successful SMS in test mode
  // Twilio automated testing docs show +15005550006 for success.
  // https://www.twilio.com/docs/messaging/tutorials/automate-testing
  if (mode === "TEST") return "+15005550006";

  const from = process.env.TWILIO_FROM_NUMBER;
  if (!from) throw new Error("Missing env var: TWILIO_FROM_NUMBER");
  return from;
}
