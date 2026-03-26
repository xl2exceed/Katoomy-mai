# Katoomy Admin App

Expo React Native app for merchants to accept payments via Stripe Terminal Tap to Pay (no hardware required).

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Create `.env` file** (copy from `.env.example`)
   ```bash
   cp .env.example .env
   ```
   Fill in your Supabase URL, anon key, and the Vercel app URL.

3. **Build for iOS** (requires Mac + Xcode)
   ```bash
   npx expo run:ios
   ```

4. **Build for Android**
   ```bash
   npx expo run:android
   ```

## Prerequisites

### iOS
- Apple Developer Account ($99/year) — developer.apple.com
- Apply for "Tap to Pay on iPhone" entitlement in the Apple Developer portal
- iPhone XS or later, iOS 16+
- Tap to Pay does NOT work in the iOS Simulator — requires a physical device

### Android
- NFC-capable Android device, Android 10+
- No special entitlement needed
- Can sideload APK for testing (no Play Store required)

### Stripe
- Enable Terminal in Stripe Dashboard → Settings → Terminal
- Each connected account (business) will have a Terminal location created automatically on first login

## Architecture

The app calls your existing Next.js API routes:

| Endpoint | Purpose |
|----------|---------|
| `POST /api/terminal/connection-token` | Gets Terminal session token |
| `POST /api/terminal/location/ensure` | Creates Terminal location for business |
| `POST /api/terminal/payment-intent` | Creates PaymentIntent for the charge |
| `POST /api/terminal/confirm-payment` | Marks booking paid after successful tap |

## Screens

- **Login** — Supabase email/password (same credentials as web admin)
- **Schedule** — Today's appointments awaiting payment
- **Charge** — Tip selection + Tap to Pay collection

## Payment Flow

1. Merchant taps "Charge" on a booking
2. Selects tip amount (or no tip)
3. Taps "Charge $X.XX" → PaymentIntent created on server
4. Terminal SDK prompts customer to tap card/Apple Pay
5. Payment confirmed → booking marked paid in Supabase
6. Success screen shown
