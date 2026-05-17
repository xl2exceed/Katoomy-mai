import { createHmac } from "crypto";

export interface HubTokenPayload {
  phone: string;
  customerId: string;
}

function secret(): string {
  const s = process.env.HUB_TOKEN_SECRET;
  if (!s) throw new Error("HUB_TOKEN_SECRET is not set");
  return s;
}

// Signs a 7-day token embedding the customer's phone and id.
// The token is embedded in SMS referral links so the /hub/add landing page
// can identify the customer without requiring them to enter their phone.
export function signHubToken(payload: HubTokenPayload): string {
  const exp = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const data = JSON.stringify({ ...payload, exp });
  const sig = createHmac("sha256", secret()).update(data).digest("hex");
  return Buffer.from(JSON.stringify({ data, sig })).toString("base64url");
}

export function verifyHubToken(token: string): HubTokenPayload | null {
  try {
    const { data, sig } = JSON.parse(Buffer.from(token, "base64url").toString());
    const expected = createHmac("sha256", secret()).update(data).digest("hex");
    if (sig !== expected) return null;
    const parsed = JSON.parse(data) as HubTokenPayload & { exp: number };
    if (parsed.exp < Date.now()) return null;
    return { phone: parsed.phone, customerId: parsed.customerId };
  } catch {
    return null;
  }
}
