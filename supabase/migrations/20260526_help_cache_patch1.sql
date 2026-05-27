-- Help cache patch 1 — verified answers for 5 questions not in initial seed
-- Run in Supabase SQL Editor after 20260526_help_cache_seed.sql

-- Ensure unique constraint exists (safe to run even if already exists)
CREATE UNIQUE INDEX IF NOT EXISTS ai_help_cache_normalized_question_unique ON ai_help_cache (normalized_question);

INSERT INTO ai_help_cache (question, normalized_question, answer)
VALUES

  -- ── ADMIN DESKTOP ──────────────────────────────────────────────────────────

  ('How do I cancel a booking?',
   'admin-desktop:how do i cancel a booking',
   'Go to My Schedule in the sidebar. Find the booking and use the status dropdown on the card. Select "Cancelled".'),

  ('How do I filter appointments by staff member?',
   'admin-desktop:how do i filter appointments by staff member',
   'My Schedule does not have a filter by staff member. Each appointment card shows the assigned staff member below the customer name as "With: [Staff Name]". To view one staff member''s bookings you would need to scroll through the schedule manually.'),

  ('How do I charge a walk-in customer?',
   'admin-desktop:how do i charge a walkin customer',
   'Go to Take Payment in the sidebar. Enter the customer''s phone number if you have it. If not, scroll down to the Custom Payment section — enter the Service or Description, Amount, and optionally the Customer Name. Choose Cash, Cash App, Zelle, or "Generate QR (Credit Card)".'),

  ('How do I see a staff member''s revenue and performance?',
   'admin-desktop:how do i see a staff members revenue and performance',
   'Go to Revenue in the sidebar. Select a period — Today, This Week, This Month, or All Time. Scroll down to the "By Staff Member" section to see each staff member''s booking count, service revenue, tips, and total.'),

  ('How do I see if a text message was delivered?',
   'admin-desktop:how do i see if a text message was delivered',
   'For SMS campaigns, go to Campaigns in the sidebar and click the "SMS History" tab — it shows how many messages were sent for each campaign. Individual appointment reminder delivery status is not currently tracked in the dashboard.'),

  -- ── ADMIN MOBILE ────────────────────────────────────────────────────────────

  ('How do I cancel a booking?',
   'admin-mobile:how do i cancel a booking',
   'Tap "Today''s Schedule" on the menu. Find the booking and use the status dropdown to select Cancelled.'),

  ('How do I charge a walk-in customer?',
   'admin-mobile:how do i charge a walkin customer',
   'Tap "Take Payment" on the menu. Enter the customer''s phone number if you have it. If not, scroll down to the Custom Payment section — enter the Service or Description, Amount, and optionally the Customer Name. Choose Cash, Cash App, Zelle, or Generate QR (Credit Card).'),

  -- ── STAFF ───────────────────────────────────────────────────────────────────

  ('How do I cancel a booking?',
   'staff:how do i cancel a booking',
   'Open Schedule from the dashboard. Find the booking and use the status dropdown on the card to select Cancelled.'),

  ('How do I charge a walk-in customer?',
   'staff:how do i charge a walkin customer',
   'Tap Take Payment from the dashboard. Enter the customer''s phone number if you have it. If not, scroll down to the Custom Payment section — enter the Service or Description, Amount, and optionally the Customer Name. Tap Cash, Cash App, Zelle, or Generate QR (Credit Card).')

ON CONFLICT (normalized_question) DO UPDATE SET
  answer = EXCLUDED.answer,
  question = EXCLUDED.question;

-- 9 entries total (5 admin-desktop + 2 admin-mobile + 2 staff)
