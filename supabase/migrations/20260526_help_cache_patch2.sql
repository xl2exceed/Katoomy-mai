-- Help cache patch 2 — additional verified answers from code review
-- Run in Supabase SQL Editor after patch1

CREATE UNIQUE INDEX IF NOT EXISTS ai_help_cache_normalized_question_unique ON ai_help_cache (normalized_question);

INSERT INTO ai_help_cache (question, normalized_question, answer)
VALUES

  -- ── ADMIN DESKTOP ──────────────────────────────────────────────────────────

  ('How do I mark a no-show?',
   'admin-desktop:how do i mark a noshow',
   'Go to My Schedule in the sidebar. Find the booking and use the status dropdown on the card. Select "No Show".'),

  ('How do I set up Cash App payments?',
   'admin-desktop:how do i set up cash app payments',
   'Go to Payment Settings in the sidebar. Toggle on "Cash App Payments". Enter your $Cashtag (without the $ sign). Click "Save Payment Settings". Customers will now see Cash App as a payment option at checkout.'),

  ('How do I set up Cash App?',
   'admin-desktop:how do i set up cash app',
   'Go to Payment Settings in the sidebar. Toggle on "Cash App Payments". Enter your $Cashtag (without the $ sign). Click "Save Payment Settings". Customers will now see Cash App as a payment option at checkout.'),

  ('How do I set up Zelle?',
   'admin-desktop:how do i set up zelle',
   'Go to Payment Settings in the sidebar. Toggle on "Zelle Payments". Enter your Zelle Phone Number and/or Zelle Email. Click "Save Payment Settings". Customers will see your Zelle details at checkout.'),

  ('How do I set up Zelle payments?',
   'admin-desktop:how do i set up zelle payments',
   'Go to Payment Settings in the sidebar. Toggle on "Zelle Payments". Enter your Zelle Phone Number and/or Zelle Email. Click "Save Payment Settings". Customers will see your Zelle details at checkout.'),

  ('How do I find my booking link?',
   'admin-desktop:how do i find my booking link',
   'Go to Branding in the sidebar. Your booking link is shown under Business Information as your Custom URL Slug. Your full link is katoomy.com/your-slug. Share it with customers so they can book online.'),

  ('How do I share my booking link?',
   'admin-desktop:how do i share my booking link',
   'Go to Branding in the sidebar. Find your Custom URL Slug under Business Information — your full booking link is katoomy.com/your-slug. Copy and share this link with customers via text, social media, or anywhere you promote your business.'),

  ('How do I turn off appointment reminders?',
   'admin-desktop:how do i turn off appointment reminders',
   'Go to Settings in the sidebar. Scroll down to the Notification Settings section. Uncheck "Appointment reminders". Click "Save Changes". Customers will no longer receive reminder texts before their appointment.'),

  ('How do I turn off automated texts?',
   'admin-desktop:how do i turn off automated texts',
   'Go to Settings in the sidebar. To turn off specific notification types (confirmations, reminders, cancellations, loyalty updates), uncheck them in the Notification Settings section and click "Save Changes". To manage automated campaign texts (win-back, referral nudge), scroll to Automated Smart Campaigns and toggle them off there.'),

  ('How do I turn off notifications?',
   'admin-desktop:how do i turn off notifications',
   'Go to Settings in the sidebar. In the Notification Settings section, uncheck whichever types you want to turn off: Booking confirmations, Appointment reminders, Cancellation notices, or Loyalty updates. Click "Save Changes".'),

  ('How do I edit a customer?',
   'admin-desktop:how do i edit a customer',
   'Go to Customers in the sidebar. Find the customer and click "Edit" on their row. A modal opens where you can update their Full Name, Phone Number, and Email. Click "Save Changes".'),

  ('How do I update a customer''s information?',
   'admin-desktop:how do i update a customers information',
   'Go to Customers in the sidebar. Find the customer and click "Edit" on their row. Update their Full Name, Phone Number, or Email in the modal that appears. Click "Save Changes".'),

  ('How do I delete a customer?',
   'admin-desktop:how do i delete a customer',
   'Customer deletion is not available in Katoomy. You can edit a customer''s name, phone, or email by clicking "Edit" on their row in the Customers page, but records cannot be permanently deleted.'),

  ('How do I add a staff member?',
   'admin-desktop:how do i add a staff member',
   'Go to Staff in the sidebar. Click the "+ Add Staff" button. Fill in their Full Name, Role, Phone, and Email. If you enter an email, an invite will be sent automatically so they can log in to the staff portal. Click "Add Staff Member" to save.'),

  ('How do I invite a staff member?',
   'admin-desktop:how do i invite a staff member',
   'Go to Staff in the sidebar. Click "+ Add Staff". Fill in the staff member''s name and email address. An invite email is sent automatically when you click "Add Staff Member". They can also log in via QR code if the email invite fails.'),

  ('How do I set the deposit amount?',
   'admin-desktop:how do i set the deposit amount',
   'Deposits are a two-step setup. First, go to Settings in the sidebar and toggle Deposits on. Then go to Payment Setup in the sidebar to set the deposit amount and type (flat fee or percentage). Click Save in each section.'),

  ('How do I reschedule an appointment?',
   'admin-desktop:how do i reschedule an appointment',
   'Katoomy does not have a reschedule button. To move an appointment, cancel it using the status dropdown on My Schedule, then ask the customer to rebook at the new time through your booking link.'),

  ('How do I block time on my calendar?',
   'admin-desktop:how do i block time on my calendar',
   'Katoomy does not support blocking specific time slots within a day. To prevent bookings during certain hours, go to Availability in the sidebar and adjust your Start Time or End Time. To block an entire day, toggle that day off under Open Days. Click Save.'),

  ('How do I add blocked time?',
   'admin-desktop:how do i add blocked time',
   'Katoomy does not support blocking specific time slots within a day. To prevent bookings during certain hours, go to Availability in the sidebar and adjust your Start Time or End Time. To block a full day, toggle that day off under Open Days. Click Save.'),

  -- ── ADMIN MOBILE ────────────────────────────────────────────────────────────

  ('How do I mark a no-show?',
   'admin-mobile:how do i mark a noshow',
   'Tap "Today''s Schedule" on the menu. Find the booking and use the status dropdown on the card. Select "No Show".'),

  ('What is the difference between Today''s Schedule and Appointments?',
   'admin-mobile:what is the difference between todays schedule and appointments',
   '"Today''s Schedule" shows all of your appointments for the day with a status filter and Day/Week view toggle. "Appointments" shows only pending booking requests that are waiting for your approval — each one has an Accept and Decline button. Use Appointments to approve or reject new requests, and Today''s Schedule to manage your full calendar.'),

  ('How do I reschedule an appointment?',
   'admin-mobile:how do i reschedule an appointment',
   'Katoomy does not have a reschedule option. To move an appointment, cancel it from Today''s Schedule and ask the customer to rebook at the new time.'),

  -- ── STAFF ───────────────────────────────────────────────────────────────────

  ('How do I mark a no-show?',
   'staff:how do i mark a noshow',
   'Open Schedule from the dashboard. Find the booking and use the status dropdown on the card to select "No Show".'),

  ('How do I contact a customer?',
   'staff:how do i contact a customer',
   'Tap the Customers tile from the dashboard to find the customer and see their phone number. You can call or text them directly from your phone.'),

  ('How do I reschedule an appointment?',
   'staff:how do i reschedule an appointment',
   'Katoomy does not have a reschedule option. Ask your business owner to cancel the appointment and have the customer rebook at the new time.')

ON CONFLICT (normalized_question) DO UPDATE SET
  answer = EXCLUDED.answer,
  question = EXCLUDED.question;

-- 24 entries total
