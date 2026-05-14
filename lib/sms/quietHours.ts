// TCPA quiet hours enforcement — no SMS before 8am or after 9pm in the recipient's local timezone.
// Falls back to America/New_York (strictest US zone) when timezone is unknown.

const FALLBACK_TZ = "America/New_York";
const SEND_START_HOUR = 8;   // 8:00 AM
const SEND_END_HOUR   = 21;  // 9:00 PM

function localHour(timezone: string): number {
  try {
    return parseInt(
      new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", hour12: false }).format(new Date()),
      10,
    );
  } catch {
    return parseInt(
      new Intl.DateTimeFormat("en-US", { timeZone: FALLBACK_TZ, hour: "numeric", hour12: false }).format(new Date()),
      10,
    );
  }
}

/** Returns true if it is currently quiet hours for the customer — do NOT send SMS. */
export function isQuietHours(timezone: string | null | undefined): boolean {
  const tz = timezone?.trim() || FALLBACK_TZ;
  const h = localHour(tz);
  return h < SEND_START_HOUR || h >= SEND_END_HOUR;
}

/**
 * Returns a Date representing the next 8:00 AM in the given timezone.
 * Used to reschedule time-sensitive notifications that land during quiet hours.
 */
export function nextSendWindow(timezone: string | null | undefined): Date {
  const tz = timezone?.trim() || FALLBACK_TZ;

  // Advance hour-by-hour until we hit 8am in the target timezone (max 48h)
  const candidate = new Date();
  candidate.setMinutes(0, 0, 0);

  for (let i = 0; i < 48; i++) {
    candidate.setTime(candidate.getTime() + 3600000);
    try {
      const h = parseInt(
        new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hour12: false }).format(candidate),
        10,
      );
      if (h === SEND_START_HOUR) return candidate;
    } catch {
      // Invalid tz — fall back
      return new Date(Date.now() + 8 * 3600000);
    }
  }

  return new Date(Date.now() + 8 * 3600000);
}
