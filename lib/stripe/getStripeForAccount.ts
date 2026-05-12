import Stripe from "stripe";

const primaryStripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const secondaryStripe = process.env.STRIPE_SECRET_KEY_SOLE_PROP
  ? new Stripe(process.env.STRIPE_SECRET_KEY_SOLE_PROP)
  : null;

// Per-process cache: connected account ID → correct Stripe instance.
// Avoids an extra accounts.retrieve() call on every request after the first.
const cache = new Map<string, Stripe>();

/**
 * Returns the Stripe instance whose platform key owns `connectedAccountId`.
 * Tries the primary key first; falls back to the secondary (sole-prop) key
 * when the primary key lacks access to the account.
 */
export async function getStripeForAccount(connectedAccountId: string): Promise<Stripe> {
  const cached = cache.get(connectedAccountId);
  if (cached) return cached;

  if (!secondaryStripe) {
    cache.set(connectedAccountId, primaryStripe);
    return primaryStripe;
  }

  try {
    await primaryStripe.accounts.retrieve(connectedAccountId);
    cache.set(connectedAccountId, primaryStripe);
    return primaryStripe;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (
      msg.includes("does not have access to account") ||
      msg.includes("Application access may have been revoked") ||
      msg.includes("or that account does not exist")
    ) {
      cache.set(connectedAccountId, secondaryStripe);
      return secondaryStripe;
    }
    // Any other error — return primary and let the caller fail naturally
    cache.set(connectedAccountId, primaryStripe);
    return primaryStripe;
  }
}
