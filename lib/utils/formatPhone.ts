// file: lib/utils/formatPhone.ts

// Formats phone number for DISPLAY
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const cleaned = phone.replace(/\D/g, "");

  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }

  if (cleaned.length === 11 && cleaned[0] === "1") {
    return `(${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }

  return phone;
}

// Strips formatting for STORAGE (digits only)
export function digitsOnlyPhone(input: string): string {
  return input.replace(/\D/g, "").slice(0, 11);
}
