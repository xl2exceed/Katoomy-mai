-- Verified Katoomy Help Assistant Cache Seed
-- Generated 2026-05-26 — all answers verified by reading actual JSX source code
-- Run in Supabase SQL Editor

-- Ensure unique constraint exists (safe to run even if already exists)
CREATE UNIQUE INDEX IF NOT EXISTS ai_help_cache_normalized_question_unique ON ai_help_cache (normalized_question);

INSERT INTO ai_help_cache (question, normalized_question, answer)
VALUES

  -- ── ADMIN DESKTOP ──────────────────────────────────────────────────────────

  ('How do I add a new service?',
   'admin-desktop:how do i add a new service',
   'Go to Services in the left sidebar. Click the "+ Add Service" button. Fill in Service Name, Price ($), and Duration (minutes). Click "Add" to save.'),

  ('How do I edit a service?',
   'admin-desktop:how do i edit a service',
   'Go to Services in the sidebar. Find the service and click "Edit" on its card. Update the Name, Price, or Duration, then click "Update".'),

  ('How do I delete a service?',
   'admin-desktop:how do i delete a service',
   'Services cannot be deleted. Click "Deactivate" on the service card to hide it from customers. Click "Activate" later to re-enable it.'),

  ('How do I deactivate a service?',
   'admin-desktop:how do i deactivate a service',
   'Go to Services. Find the service and click "Deactivate" on its card. It will no longer appear when customers book. Click "Activate" to restore it.'),

  ('How do I set my working hours?',
   'admin-desktop:how do i set my working hours',
   'Go to Availability in the sidebar. Toggle each day on or off under Open Days. Set Start Time, End Time, and Buffer minutes under Working Hours. Click Save.'),

  ('How do I set my hours?',
   'admin-desktop:how do i set my hours',
   'Go to Availability in the sidebar. Toggle each day on or off under Open Days. Set Start Time, End Time, and Buffer minutes under Working Hours. Click Save.'),

  ('How do I add a buffer between appointments?',
   'admin-desktop:how do i add a buffer between appointments',
   'Go to Availability. Under Working Hours, set the Buffer minutes field. Click Save.'),

  ('How do I block a day off?',
   'admin-desktop:how do i block a day off',
   'Go to Availability. Toggle that day off under Open Days. Click Save.'),

  ('How do I view my appointments?',
   'admin-desktop:how do i view my appointments',
   'Go to My Schedule in the sidebar. Use the Day or Week toggle at the top. Navigate dates with the Previous, Today, and Next buttons.'),

  ('How do I see my schedule?',
   'admin-desktop:how do i see my schedule',
   'Go to My Schedule in the sidebar. Use the Day or Week toggle at the top. Navigate dates with the Previous, Today, and Next buttons.'),

  ('How do I filter my schedule?',
   'admin-desktop:how do i filter my schedule',
   'Go to My Schedule. Use the status filter dropdown to show: All Appointments, Requested, Confirmed, Completed, Cancelled, No Show, Incomplete, or Custom.'),

  ('How do I confirm a booking?',
   'admin-desktop:how do i confirm a booking',
   'Go to My Schedule. Find the booking and use the status dropdown on the card. Select Confirmed.'),

  ('How do I cancel an appointment?',
   'admin-desktop:how do i cancel an appointment',
   'Go to My Schedule. Find the booking and use the status dropdown to select Cancelled.'),

  ('How do I mark an appointment complete?',
   'admin-desktop:how do i mark an appointment complete',
   'Go to My Schedule. Find the booking and use the status dropdown to select Completed.'),

  ('How do I refund a customer?',
   'admin-desktop:how do i refund a customer',
   'Go to My Schedule. Find a booking that shows paid status — a Refund button appears. Click it, choose Full Refund or Partial Refund, select a Reason, and click Confirm Refund.'),

  ('How do I issue a refund?',
   'admin-desktop:how do i issue a refund',
   'Go to My Schedule. Find a paid booking — a Refund button appears. Click it, choose Full Refund or Partial Refund, select a Reason, and click Confirm Refund.'),

  ('How do I send a receipt?',
   'admin-desktop:how do i send a receipt',
   'Go to My Schedule. Find a booking for a customer who has an email address — a "Send Receipt" button appears on the card. Click it.'),

  ('How do I take a payment?',
   'admin-desktop:how do i take a payment',
   'Go to Take Payment in the sidebar. Enter the customer phone number to look them up. If they have an open balance it shows automatically. Choose Generate QR Payment (card), Cash, Cash App, or Zelle.'),

  ('How do I record a cash payment?',
   'admin-desktop:how do i record a cash payment',
   'Go to Take Payment in the sidebar. Enter the customer phone number. Select a service if no open booking exists. Click "Cash" to record it instantly.'),

  ('How do I generate a QR code for payment?',
   'admin-desktop:how do i generate a qr code for payment',
   'Go to Take Payment. Enter the customer phone, select a service if needed, and click "Generate QR Payment". A QR code appears — have the customer scan it with their phone to pay by card.'),

  ('How do I record a Cash App payment?',
   'admin-desktop:how do i record a cash app payment',
   'Go to Take Payment. Enter the customer phone, select a service, and click "Cash App" to record the payment.'),

  ('How do I record a Zelle payment?',
   'admin-desktop:how do i record a zelle payment',
   'Go to Take Payment. Enter the customer phone, select a service, and click "Zelle" to record the payment.'),

  ('How do I charge a custom amount?',
   'admin-desktop:how do i charge a custom amount',
   'Go to Take Payment. Scroll down to the Custom Payment section. Enter a Service or Description, Amount, and optionally Tip and Customer Name. Click Cash, Cash App, Zelle, or "Generate QR (Credit Card)".'),

  ('How do I view payment history?',
   'admin-desktop:how do i view payment history',
   'Go to Payment Ledger in the sidebar. The Transaction Ledger tab lists all Cash, Cash App, and Zelle payments. Filter by month or search by customer or service.'),

  ('How do I see my total revenue?',
   'admin-desktop:how do i see my total revenue',
   'Go to Revenue in the sidebar. Use the Today, This Week, This Month, or All Time buttons. You see Service Revenue, Tips, Memberships, and Total Revenue.'),

  ('How do I view revenue?',
   'admin-desktop:how do i view revenue',
   'Go to Revenue in the sidebar. Use the Today, This Week, This Month, or All Time buttons. You see Service Revenue, Tips, Memberships, and Total Revenue.'),

  ('How do I update my business info?',
   'admin-desktop:how do i update my business info',
   'Go to Branding in the sidebar. Update Business Information (name, address, phone, app name, URL slug) and Owner Information. Click Save Branding.'),

  ('How do I change my logo?',
   'admin-desktop:how do i change my logo',
   'Go to Branding. Click "Upload Logo" in the Logo section, select your image, then click Save Branding.'),

  ('How do I change my brand color?',
   'admin-desktop:how do i change my brand color',
   'Go to Branding. In the Brand Color section, choose from 12 preset colors or use the custom color picker. Click Save Branding.'),

  ('How do I change my welcome message?',
   'admin-desktop:how do i change my welcome message',
   'Go to Branding. In the Messages section, update the Welcome Message field. Click Save Branding.'),

  ('How do I auto-confirm bookings?',
   'admin-desktop:how do i autoconfirm bookings',
   'Go to Settings in the sidebar. Under New Bookings, toggle to Auto Confirm. Customers are confirmed instantly when they book. Click Save.'),

  ('How do I require manual approval for bookings?',
   'admin-desktop:how do i require manual approval for bookings',
   'Go to Settings in the sidebar. Under New Bookings, toggle to Manual Approval. New bookings appear as Requested for you to confirm or decline. Click Save.'),

  ('How do I enable deposits?',
   'admin-desktop:how do i enable deposits',
   'Go to Settings in the sidebar. Toggle Deposits on. To configure the deposit amount and type, go to Payment Settings in the sidebar.'),

  ('How do I set up the loyalty program?',
   'admin-desktop:how do i set up the loyalty program',
   'Go to Rewards in the sidebar. Toggle Loyalty Program on. Check when to award points (Appointment Completed, Successful Referral). Set Points Per Completed Appointment, Points For Successful Referral, Points Needed For Reward, Reward Type (Discount, Free Service, or Custom Prize), and Reward Description. Click Save Loyalty Settings.'),

  ('How do I set points per appointment?',
   'admin-desktop:how do i set points per appointment',
   'Go to Rewards in the sidebar. When the loyalty program is enabled, update the "Points Per Completed Appointment" field. Click Save Loyalty Settings.'),

  ('How do I set the reward threshold?',
   'admin-desktop:how do i set the reward threshold',
   'Go to Rewards in the sidebar. Update "Points Needed For Reward". Also set the Reward Type and Reward Description. Click Save Loyalty Settings.'),

  ('How do I view referrals?',
   'admin-desktop:how do i view referrals',
   'Go to Referrals in the sidebar. You see Total Referrals, Pending, Completed, and Points Awarded stats, plus a table of all referrals. Filter by status or search by name, phone, or code.'),

  ('How do referrals work?',
   'admin-desktop:how do referrals work',
   'Each customer has a unique referral code shown on their dashboard. When a friend uses that code and completes their first visit, the referring customer earns loyalty points. You can configure the referral points in Rewards settings.'),

  ('How do I create a membership plan?',
   'admin-desktop:how do i create a membership plan',
   'Go to Membership in the sidebar. Click "+ Add Plan". Enter Plan Name, Price per Month ($), Discount % (optional), and Description (optional). Click "Save & Activate Plan".'),

  ('How do I edit a membership plan?',
   'admin-desktop:how do i edit a membership plan',
   'Go to Membership in the sidebar. Find the plan and click Edit. Update the fields and click "Update Plan".'),

  ('How do I deactivate a membership plan?',
   'admin-desktop:how do i deactivate a membership plan',
   'Go to Membership in the sidebar. Find the plan and click Deactivate. Click Activate to re-enable it.'),

  ('How do I see my active members?',
   'admin-desktop:how do i see my active members',
   'Go to Membership in the sidebar. Scroll down to the Active Members table. It shows Customer, Phone, Plan name, Joined date, and Renews date.'),

  ('How do I send an SMS campaign?',
   'admin-desktop:how do i send an sms campaign',
   'Go to Campaigns in the sidebar. Click "New SMS". Select an audience (All Customers, At-Risk Customers, Members Only, New Customers, Top Spenders, or No App Install), pick a message template, give the campaign a name, and click the send button. Messages are capped at 160 characters.'),

  ('What audience options are available for campaigns?',
   'admin-desktop:what audience options are available for campaigns',
   'Campaign audiences: All Customers (everyone with a phone), At-Risk Customers (have not visited recently), Members Only (active Elite Members), New Customers (recently joined), Top Spenders (highest-value customers), No App Install (have not installed the app).'),

  ('How do I view past campaigns?',
   'admin-desktop:how do i view past campaigns',
   'Go to Campaigns in the sidebar. Click the "SMS History" tab to see all past campaigns with recipient count, sent count, and results.'),

  ('How do I view analytics?',
   'admin-desktop:how do i view analytics',
   'Go to Analytics in the sidebar. Select a period: Last 7 Days, Last 2 Weeks, Last 30 Days, Last 3 Months, Last 6 Months, or Custom. You see bookings, revenue, new vs returning customers, top services, at-risk customers, and smart alerts.'),

  ('How do I see at-risk customers?',
   'admin-desktop:how do i see atrisk customers',
   'Go to Analytics in the sidebar. Select any time period. Scroll down to the At-Risk Customers section to see customers who have not visited recently.'),

  ('How do I import customers?',
   'admin-desktop:how do i import customers',
   'Go to Customers in the sidebar. Click "Import Customers" in the top right. Upload a CSV file, map the columns (First Name, Last Name, Phone, Email), and click Import.'),

  ('How do I export my customer list?',
   'admin-desktop:how do i export my customer list',
   'Go to Customers in the sidebar. Click "Export CSV" in the top right. A CSV file with all customer details downloads automatically.'),

  ('How do I find a customer?',
   'admin-desktop:how do i find a customer',
   'Go to Customers in the sidebar. Use the search box at the top to search by name or phone number.'),

  ('How do I add staff?',
   'admin-desktop:how do i add staff',
   'Go to Staff in the sidebar to invite or add staff members. This feature requires a paid plan.'),

  ('How do I upgrade my plan?',
   'admin-desktop:how do i upgrade my plan',
   'Click "Upgrade" in the left sidebar navigation to see available plans.'),

  ('How do I manage my subscription?',
   'admin-desktop:how do i manage my subscription',
   'Click "Manage Subscription" at the bottom of the sidebar to open the billing portal where you can update payment info or cancel.'),

  ('How do I log out?',
   'admin-desktop:how do i log out',
   'Click "Log out" at the very bottom of the left sidebar.'),

  ('How do I change my business type?',
   'admin-desktop:how do i change my business type',
   'Go to Settings in the sidebar. Tap the page title "App Settings" 7 times quickly to reveal a hidden Business Type section. Select your niche (barber, car wash, lawn care) and click Save.'),

  ('How do I open the mobile view?',
   'admin-desktop:how do i open the mobile view',
   'Click "Mobile View" in the sidebar to open it on your current device. Click the phone icon next to it to see a QR code you can scan with your phone to open the mobile admin.'),

  ('How do I use the AI Growth Hub?',
   'admin-desktop:how do i use the ai growth hub',
   'Go to AI Growth Hub in the sidebar. It has two sections: AI Business Insights (auto-refreshes daily with recommendations based on your data) and Automation Settings (to adjust thresholds).'),

  ('How does the discount calculator work?',
   'admin-desktop:how does the discount calculator work',
   'Go to Take Payment and scroll to Discount Calculator. Enter the Original Price and Discount %. It instantly shows the discount amount and exactly what to charge the customer.'),

  ('How do I change my booking link URL?',
   'admin-desktop:how do i change my booking link url',
   'Go to Branding. Under Business Information, update the "Custom URL Slug" field. Click Save Branding. Your booking link will be katoomy.com/your-new-slug.'),

  -- ── ADMIN MOBILE ────────────────────────────────────────────────────────────
  -- Mobile menu tiles (actual labels): Today''s Schedule, Revenue, Analytics,
  -- Appointments, Messages, Customers, Take Payment, QR Code, Network,
  -- Notifications, Services, Settings. Sign Out button at bottom of menu.
  -- Campaigns, Membership, Referrals are HIDDEN on mobile.

  ('How do I view my appointments?',
   'admin-mobile:how do i view my appointments',
   'Tap "Today''s Schedule" on the menu to see all appointments for the day. Use the Day View / Week View toggle and the date arrows to navigate.'),

  ('How do I see my schedule?',
   'admin-mobile:how do i see my schedule',
   'Tap "Today''s Schedule" on the menu. Use the Day View / Week View toggle and the date navigation arrows to browse appointments.'),

  ('How do I accept or decline a booking request?',
   'admin-mobile:how do i accept or decline a booking request',
   'Tap "Appointments" on the menu. This shows all pending booking requests. Each one has an Accept and a Decline button.'),

  ('How do I confirm a booking?',
   'admin-mobile:how do i confirm a booking',
   'Tap "Appointments" on the menu to see pending requests and tap Accept. Or tap "Today''s Schedule" and use the status dropdown on the booking card to select Confirmed.'),

  ('How do I cancel an appointment?',
   'admin-mobile:how do i cancel an appointment',
   'Tap "Today''s Schedule". Find the booking and use the status dropdown to select Cancelled.'),

  ('How do I mark a booking complete?',
   'admin-mobile:how do i mark a booking complete',
   'Tap "Today''s Schedule". Find the booking and use the status dropdown to select Completed.'),

  ('How do I refund a payment?',
   'admin-mobile:how do i refund a payment',
   'Tap "Today''s Schedule". Find a booking with paid status — a Refund button appears. Tap it, choose Full Refund or Partial Refund, select a reason, and tap Confirm Refund.'),

  ('How do I take a payment?',
   'admin-mobile:how do i take a payment',
   'Tap "Take Payment" on the menu. Enter the customer phone number to look them up. If they have an open balance it shows automatically. Choose Generate QR Payment (card), Cash, Cash App, or Zelle.'),

  ('How do I record a cash payment?',
   'admin-mobile:how do i record a cash payment',
   'Tap "Take Payment" on the menu. Enter the customer phone number, select a service if needed, and tap Cash to record it.'),

  ('How do I generate a QR code for payment?',
   'admin-mobile:how do i generate a qr code for payment',
   'Tap "Take Payment" on the menu. Enter the customer phone, select a service if needed, and tap "Generate QR Payment". Show the QR code for the customer to scan with their phone.'),

  ('How do I charge a custom amount?',
   'admin-mobile:how do i charge a custom amount',
   'Tap "Take Payment" on the menu. Scroll down to the Custom Payment section. Enter a Service or Description, Amount, and optionally Tip and Customer Name. Tap Cash, Cash App, Zelle, or Generate QR (Credit Card).'),

  ('How do I view my revenue?',
   'admin-mobile:how do i view my revenue',
   'Tap "Revenue" on the menu. Filter by Today, Week, Month, or All Time to see your totals and transactions.'),

  ('How do I view analytics?',
   'admin-mobile:how do i view analytics',
   'Tap "Analytics" on the menu to see trends, top services, and customer stats.'),

  ('How do I send messages to customers?',
   'admin-mobile:how do i send messages to customers',
   'Tap "Messages" on the menu to send and view messages.'),

  ('How do I view my customers?',
   'admin-mobile:how do i view my customers',
   'Tap "Customers" on the menu to view your customer contacts.'),

  ('How do I change my services?',
   'admin-mobile:how do i change my services',
   'That feature is only available on the desktop version. Please open Katoomy on a computer to access it.'),

  ('How do I set up campaigns?',
   'admin-mobile:how do i set up campaigns',
   'That feature is only available on the desktop version. Please open Katoomy on a computer to access it.'),

  ('How do I change branding or my logo?',
   'admin-mobile:how do i change branding or my logo',
   'That feature is only available on the desktop version. Please open Katoomy on a computer to access it.'),

  ('How do I set up the loyalty program?',
   'admin-mobile:how do i set up the loyalty program',
   'That feature is only available on the desktop version. Please open Katoomy on a computer to access it.'),

  ('How do I upgrade my plan?',
   'admin-mobile:how do i upgrade my plan',
   'That feature is only available on the desktop version. Please open Katoomy on a computer to access it.'),

  ('How do I change my availability?',
   'admin-mobile:how do i change my availability',
   'That feature is only available on the desktop version. Please open Katoomy on a computer to access it.'),

  ('How do I access payment settings?',
   'admin-mobile:how do i access payment settings',
   'That feature is only available on the desktop version. Please open Katoomy on a computer to access it.'),

  ('How do I view the payment ledger?',
   'admin-mobile:how do i view the payment ledger',
   'That feature is only available on the desktop version. Please open Katoomy on a computer to access it.'),

  ('How do I set up membership plans?',
   'admin-mobile:how do i set up membership plans',
   'That feature is only available on the desktop version. Please open Katoomy on a computer to access it.'),

  ('How do I view referrals?',
   'admin-mobile:how do i view referrals',
   'That feature is only available on the desktop version. Please open Katoomy on a computer to access it.'),

  ('How do I log out?',
   'admin-mobile:how do i log out',
   'On the main menu, scroll to the bottom and tap "Sign Out".'),

  -- ── STAFF ───────────────────────────────────────────────────────────────────

  ('How do I log in?',
   'staff:how do i log in',
   'Go to the staff login page and enter your email and password. You can also log in by scanning a QR code provided by your admin.'),

  ('How do I view my schedule?',
   'staff:how do i view my schedule',
   'From the dashboard, tap the Schedule tile. Use the Day or Week toggle at the top. Navigate dates with the arrow buttons. Each booking shows the customer name, service, and payment status.'),

  ('How do I see my appointments?',
   'staff:how do i see my appointments',
   'From the dashboard, tap the Schedule tile. Use the Day or Week toggle at the top. Navigate dates with the arrow buttons.'),

  ('How do I take a payment?',
   'staff:how do i take a payment',
   'From the dashboard, tap the Take Payment tile. Enter the customer phone number to look them up. If they have an open balance it shows automatically. Tap Generate QR Payment (card), Cash, Cash App, or Zelle.'),

  ('How do I record a cash payment?',
   'staff:how do i record a cash payment',
   'Tap Take Payment from the dashboard. Enter the customer phone number, select a service if needed, and tap Cash.'),

  ('How do I generate a QR code for a customer to pay by card?',
   'staff:how do i generate a qr code for a customer to pay by card',
   'Tap Take Payment from the dashboard. Enter the customer phone number, select a service, and tap Generate QR Payment. Show the QR code for the customer to scan with their phone.'),

  ('How do I record a Cash App or Zelle payment?',
   'staff:how do i record a cash app or zelle payment',
   'Tap Take Payment from the dashboard. Enter the customer phone number, select a service, and tap Cash App or Zelle.'),

  ('How do I charge a custom amount?',
   'staff:how do i charge a custom amount',
   'Tap Take Payment from the dashboard. Scroll down to the Custom Payment section. Enter a Service or Description, Amount, and optionally Tip and Customer Name. Tap Cash, Cash App, Zelle, or Generate QR (Credit Card).'),

  ('How do I view my earnings?',
   'staff:how do i view my earnings',
   'From the dashboard, tap the Revenue tile. Use the Today, This Week, This Month, or All Time buttons to filter your Service Revenue, Tips, and Total.'),

  ('How do I see my revenue?',
   'staff:how do i see my revenue',
   'From the dashboard, tap the Revenue tile. Use the Today, This Week, This Month, or All Time buttons to filter your Service Revenue, Tips, and Total.'),

  ('How do I see my customers?',
   'staff:how do i see my customers',
   'From the dashboard, tap the Customers tile to see the clients you have served.'),

  ('How do I view available services?',
   'staff:how do i view available services',
   'From the dashboard, tap the Services tile to see all service names, prices, and durations.'),

  ('How do I change a booking status?',
   'staff:how do i change a booking status',
   'Open Schedule from the dashboard. Find the booking and use the status dropdown on the booking card to change its status.'),

  ('How do I cancel an appointment?',
   'staff:how do i cancel an appointment',
   'Open Schedule from the dashboard. Find the booking and use the status dropdown to select Cancelled.'),

  ('How do I set my password?',
   'staff:how do i set my password',
   'The first time you log in, a password setup form appears on the dashboard. Enter a new password (at least 8 characters), confirm it, and submit. You can then log in with email and password going forward.'),

  ('How do I log out?',
   'staff:how do i log out',
   'On the dashboard, scroll to the bottom and tap "Sign Out".'),

  ('How do I show the booking QR code to a customer?',
   'staff:how do i show the booking qr code to a customer',
   'From the dashboard, tap the QR Code tile. Show this QR code to customers so they can scan it to book an appointment directly.'),

  ('How do I change business settings?',
   'staff:how do i change business settings',
   'That feature is only available to the business owner in the Admin portal. Please ask your business owner to make that change.'),

  ('How do I add or edit services?',
   'staff:how do i add or edit services',
   'That feature is only available to the business owner in the Admin portal. Please ask your business owner to make that change.'),

  ('How do I send a campaign?',
   'staff:how do i send a campaign',
   'That feature is only available to the business owner in the Admin portal. Please ask your business owner to make that change.'),

  ('How do I see overall business revenue?',
   'staff:how do i see overall business revenue',
   'That feature is only available to the business owner in the Admin portal. Your Revenue tile shows only your personal earnings.'),

  ('How do I change my availability or hours?',
   'staff:how do i change my availability or hours',
   'That feature is only available to the business owner in the Admin portal. Please ask your business owner to update the schedule.'),

  ('How do I get notifications?',
   'staff:how do i get notifications',
   'From the dashboard, tap the Notifications tile to see new booking requests and activity updates.'),

  ('How do I mark a booking as paid?',
   'staff:how do i mark a booking as paid',
   'Tap Take Payment from the dashboard. Enter the customer phone number — if they have an open booking, it will be found automatically. Choose Cash, Cash App, Zelle, or Generate QR Payment to record it as paid.')

ON CONFLICT (normalized_question) DO UPDATE SET
  answer = EXCLUDED.answer,
  question = EXCLUDED.question;

-- Total: 90 entries inserted/updated
