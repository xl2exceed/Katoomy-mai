import { Resend } from "resend";

let _client: Resend | null = null;

export function getResend(): Resend {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not set");
  }
  if (!_client) {
    _client = new Resend(process.env.RESEND_API_KEY);
  }
  return _client;
}

export const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "receipts@katoomy.com";
export const FROM = `Katoomy <${FROM_EMAIL}>`;
