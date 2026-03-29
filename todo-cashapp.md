# Katoomy Cash App Payment Feature — TODO

## Database
- [ ] Create `cashapp_settings` table (business_id, cashtag, phone, qr_code_url, absorb_fee)
- [ ] Create `alternative_payment_ledger` table (business_id, appointment_id, amount, fee, status, month_key)
- [ ] Create `monthly_billing_charges` table (business_id, month_key, total_fees, stripe_charge_id, status)

## Business Settings
- [ ] Cash App settings page in business/staff portal (upload QR code, enter phone/cashtag, fee toggle)
- [ ] QR code image upload to Supabase storage
- [ ] Fee absorption toggle (default: pass to customer)

## Customer Payment Flow
- [ ] Payment method selection screen (after tip, before Stripe) — Cash App vs Credit Card
- [ ] Cash App payment page (show amount, fee, total, QR code, phone number)
- [ ] If credit card selected → continue existing Stripe flow unchanged
- [ ] Auto-detect Cash App payment via Cash App webhook (if possible)

## Staff Portal
- [ ] "Mark as Paid" button for non-credit-card payments
- [ ] Ledger entry created on "Mark as Paid" click
- [ ] Staff can see pending vs paid status per appointment

## Admin Ledger & Billing
- [ ] Admin view of all alternative payment ledger entries per business
- [ ] End-of-month cron job that aggregates $1 fees per completed non-CC appointment
- [ ] Auto-charge business via Stripe Connect at month end
- [ ] Monthly billing history dashboard for admin
- [ ] Monthly billing summary email to business owner via Resend

## Cron Jobs
- [ ] Add monthly billing cron to vercel.json
- [ ] Cron endpoint: /api/cron/monthly-billing

## Branch & PR
- [ ] Push to feature/cashapp-payments branch
- [ ] Open pull request
