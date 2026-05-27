-- Help cache patch 3 — customer portal Q&A pairs
-- Run in Supabase SQL Editor after patch1 and patch2
-- Also fixes customer-help route (column names + .maybeSingle) before this runs

CREATE UNIQUE INDEX IF NOT EXISTS ai_help_cache_normalized_question_unique ON ai_help_cache (normalized_question);

INSERT INTO ai_help_cache (question, normalized_question, answer)
VALUES

  -- ── CUSTOMER PORTAL ─────────────────────────────────────────────────────────

  ('How do I book an appointment?',
   'customer:how do i book an appointment',
   'Tap the "Book Appointment" button on the home screen. Browse the available services and tap the one you want. Pick a date and time, then enter your name and phone number. Choose how you want to pay. If a deposit is required you will pay it by card now. Tap to confirm — you will get a text confirmation.'),

  ('How do I make a booking?',
   'customer:how do i make a booking',
   'Tap the "Book Appointment" button on the home screen. Browse the available services and tap the one you want. Pick a date and time, then enter your name and phone number. Choose how you want to pay. If a deposit is required you will pay it by card now. Tap to confirm — you will get a text confirmation.'),

  ('How do I cancel my appointment?',
   'customer:how do i cancel my appointment',
   'Tap "My Page" on the home screen and enter your phone number. Find the booking you want to cancel and tap the Cancel button. A popup will ask you to confirm — tap "Yes, Cancel". You will get a text letting you know it was cancelled.'),

  ('How do I cancel a booking?',
   'customer:how do i cancel a booking',
   'Tap "My Page" on the home screen and enter your phone number. Find the booking you want to cancel and tap the Cancel button. A popup will ask you to confirm — tap "Yes, Cancel". You will get a text letting you know it was cancelled.'),

  ('How do I reschedule my appointment?',
   'customer:how do i reschedule my appointment',
   'Tap "My Page" on the home screen and enter your phone number. Find the booking you want to reschedule and tap the Reschedule button. In the popup tap "Continue" — you will be taken to the booking page to pick a new date and time. Confirm the new time and you will get a text confirmation.'),

  ('How do I reschedule a booking?',
   'customer:how do i reschedule a booking',
   'Tap "My Page" on the home screen and enter your phone number. Find the booking you want to reschedule and tap the Reschedule button. In the popup tap "Continue" — you will be taken to the booking page to pick a new date and time. Confirm the new time and you will get a text confirmation.'),

  ('How do I check my loyalty points?',
   'customer:how do i check my loyalty points',
   'Tap "My Page" on the home screen and enter your phone number. Your loyalty points balance is shown on your dashboard. You earn points automatically each time you complete an appointment.'),

  ('How do I see my points?',
   'customer:how do i see my points',
   'Tap "My Page" on the home screen and enter your phone number. Your loyalty points balance is shown on your dashboard. You earn points automatically each time you complete an appointment.'),

  ('How do I refer a friend?',
   'customer:how do i refer a friend',
   'Tap "My Page" and enter your phone number. Scroll down to the "Refer & Earn" section. Tap "Copy Referral Link" to copy your personal link, or share your QR code. When a friend books and completes their first appointment through your link, you earn bonus loyalty points.'),

  ('How do I share my referral link?',
   'customer:how do i share my referral link',
   'Tap "My Page" and enter your phone number. Scroll down to the "Refer & Earn" section. Tap "Copy Referral Link" to copy your personal link. You can paste it in a text, social media post, or anywhere you like.'),

  ('How do I pay my balance?',
   'customer:how do i pay my balance',
   'If you have an outstanding balance, a "Pay Now" button will appear on your dashboard under the Payment Due section. Tap it and follow the steps to pay by card.'),

  ('How do I pay my outstanding balance?',
   'customer:how do i pay my outstanding balance',
   'If you have an outstanding balance, a "Pay Now" button will appear on your dashboard under the Payment Due section. Tap it and follow the steps to pay by card.'),

  ('How do I join the membership?',
   'customer:how do i join the membership',
   'Tap "My Page" and enter your phone number. Tap "Join" next to the Elite Membership section on your dashboard. Follow the steps to sign up — payment is handled securely by card. Once you are a member your discount is applied automatically every time you book.'),

  ('How do I use Quick Book?',
   'customer:how do i use quick book',
   'If you have booked before, tap the "Quick Book" button on your dashboard. It lets you rebook your last service faster with fewer steps.'),

  ('Why is it asking for my phone number?',
   'customer:why is it asking for my phone number',
   'The app uses your phone number to look up your account — your appointments, loyalty points, and referrals are all linked to it. Enter the same phone number you used when you first booked to see everything.'),

  ('I cannot find my appointments',
   'customer:i cannot find my appointments',
   'Make sure you are entering the exact same phone number you used when you first booked. If you still cannot find your account, contact the business directly and they can look you up.'),

  ('I can''t find my account',
   'customer:i cant find my account',
   'Make sure you are entering the exact same phone number you used when you first booked. If you still cannot find your account, contact the business directly and they can look you up.'),

  ('How do I view my appointments?',
   'customer:how do i view my appointments',
   'Tap "My Page" on the home screen and enter your phone number. Your upcoming and past appointments will be listed on your dashboard.'),

  ('What payment methods are accepted?',
   'customer:what payment methods are accepted',
   'Depending on what the business has set up, you may be able to pay by credit or debit card, Cash App, Zelle, or in person at your appointment. If a deposit was required when you booked, you pay the remaining balance at your appointment.'),

  ('How do I pay with Cash App?',
   'customer:how do i pay with cash app',
   'When you reach the payment step during booking, select Cash App if it is available. You will be shown a QR code or payment link. Send the payment in Cash App, then tap "I''ve Sent the Payment" to confirm.'),

  ('How do I pay with Zelle?',
   'customer:how do i pay with zelle',
   'When you reach the payment step during booking, select Zelle if it is available. You will be shown the business''s Zelle phone number or email. Send the payment in Zelle, then confirm with the business at your appointment.'),

  ('Will I get a reminder?',
   'customer:will i get a reminder',
   'Yes. You will automatically get a reminder text 24 hours before your appointment. You will also receive a confirmation text right after you book, and a cancellation text if an appointment is cancelled.'),

  ('Do I get a reminder text?',
   'customer:do i get a reminder text',
   'Yes. You will automatically get a reminder text 24 hours before your appointment. You will also receive a confirmation text right after you book, and a cancellation text if an appointment is cancelled.'),

  ('How do I add extras to my booking?',
   'customer:how do i add extras to my booking',
   'After selecting your main service, you will see an add-ons screen if any extras are available. Tap the ones you want to add, then continue with your booking.'),

  ('How do I add add-ons?',
   'customer:how do i add addons',
   'After selecting your main service, you will see an add-ons screen if any extras are available. Tap the ones you want to add, then continue with your booking.'),

  ('How do I tip?',
   'customer:how do i tip',
   'After your appointment is completed, you may receive a text with a tip link. Tap the link, choose a tip amount, and pay by card. Tipping is always optional.'),

  ('How do I leave a tip?',
   'customer:how do i leave a tip',
   'After your appointment is completed, you may receive a text with a tip link. Tap the link, choose a tip amount, and pay by card. Tipping is always optional.')

ON CONFLICT (normalized_question) DO UPDATE SET
  answer = EXCLUDED.answer,
  question = EXCLUDED.question;

-- 27 entries total (customer portal)
