#!/usr/bin/env node
/**
 * scripts/generate-ai-knowledge.mjs
 *
 * Auto-scan script for the Katoomy AI Help Assistant.
 * Runs before every build (via "prebuild" in package.json).
 *
 * What it does:
 *   1. Walks the app/ directory to find all page.tsx files
 *   2. Extracts the route path, page function name, and any UI text clues
 *      (headings, button labels, interface names, comments)
 *   3. Maps each route to a human-readable feature description
 *   4. Writes the final system prompt to lib/ai-help-knowledge.ts
 *
 * The result is that lib/ai-help-knowledge.ts is always in sync with
 * whatever pages exist in the app — no manual editing required.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const APP_DIR = path.join(ROOT, "app");
const OUTPUT_FILE = path.join(ROOT, "lib", "ai-help-knowledge.ts");

// ─── Route → Feature Metadata Map ────────────────────────────────────────────
// This map provides human-readable descriptions for known routes.
// When a new page is added that isn't in this map, the script will still
// include it using auto-detected information from the file contents.
const ROUTE_METADATA = {
  "/admin": {
    title: "Dashboard & Overview",
    description:
      "The main dashboard shows today's bookings, total customers, recent revenue, and quick stats at a glance. It is the first page after login.",
    tips: ["Navigate using the left sidebar on desktop or the mobile menu on phones."],
  },
  "/admin/bookings": {
    title: "Schedule & Bookings",
    description:
      "View and manage all appointments. Filter by date or staff member. Click any booking to see details, update its status (confirmed, completed, no-show, cancelled), or collect payment.",
    tips: [
      "Use the date picker to jump to any day.",
      "Booking statuses can be updated directly from this page.",
    ],
  },
  "/admin/services": {
    title: "Services",
    description:
      "Manage the list of services your business offers. Add, edit, or remove services including name, price, duration, and description. Car wash businesses can also set vehicle surcharges and add-ons here.",
    tips: [
      "Set a duration so the calendar blocks the correct amount of time.",
      "Car wash mode adds vehicle type pricing options.",
    ],
  },
  "/admin/availability": {
    title: "Availability & Hours",
    description:
      "Set your business hours — which days you are open, your start and end times, and the buffer time between appointments to avoid back-to-back bookings.",
    tips: ["Buffer time prevents double-booking and gives you transition time between clients."],
  },
  "/admin/staff": {
    title: "Staff Management (Premium)",
    description:
      "Add and manage team members. Each staff member gets their own login, schedule, and service assignments. Track individual performance and revenue. This is a Premium plan feature.",
    tips: [
      "Staff members log in at /staff/login with their own credentials.",
      "Upgrade to Premium to unlock this feature.",
    ],
  },
  "/admin/staff/[id]": {
    title: "Individual Staff Dashboard",
    description:
      "View a specific staff member's bookings, revenue, customer list, and performance stats.",
    tips: [],
  },
  "/admin/customers": {
    title: "Customer Directory",
    description:
      "Browse and search all customers. View each customer's contact info, booking history, total spend, loyalty points, and referral activity. You can also manually add or edit customer records.",
    tips: ["Use the search bar to quickly find a customer by name or phone number."],
  },
  "/admin/stripe": {
    title: "Payment Setup (Stripe)",
    description:
      "Connect your Stripe account to accept credit and debit card payments online. Set up deposit requirements — either a flat fee or a percentage of the service price — that customers must pay when booking.",
    tips: [
      "Deposits reduce no-shows by requiring upfront payment.",
      "Stripe payouts go directly to your connected bank account.",
    ],
  },
  "/admin/payment-settings": {
    title: "Payment Settings (CashApp & Zelle)",
    description:
      "Enable CashApp and Zelle as payment options. Enter your CashTag or Zelle phone/email so customers can pay you directly. Choose whether the platform fee is passed to the customer or absorbed by the business.",
    tips: ["CashApp fee mode defaults to the customer paying the fee."],
  },
  "/admin/take-payment": {
    title: "Take Payment",
    description:
      "Manually charge a customer for a service or a custom amount. Look up a customer by phone number, select their service or enter a custom price, and generate a payment QR code or link.",
    tips: ["Use this for walk-in customers or when you need to collect payment in person."],
  },
  "/admin/payments": {
    title: "Payment Ledger",
    description:
      "View a full log of all payment transactions including service payments, tips, and membership charges. Filter by date range.",
    tips: [],
  },
  "/admin/revenue": {
    title: "Revenue",
    description:
      "See your income broken down by service revenue, tips, and membership fees. Filter by today, this week, this month, or all time. Includes a staff breakdown showing each team member's contribution.",
    tips: ["Switch between time periods using the filter buttons at the top."],
  },
  "/admin/analytics": {
    title: "Analytics",
    description:
      "Deep business insights including booking trends, peak hours, top services by revenue, new vs. returning customers, at-risk customers, average ticket size, and rebooking rate.",
    tips: [
      "At-risk customers are those who haven't visited in 30+ days.",
      "Use the period selector to compare different time ranges.",
    ],
  },
  "/admin/campaigns": {
    title: "SMS Campaigns",
    description:
      "Send bulk SMS messages to targeted customer groups. Choose from audiences like all customers, at-risk customers, members, new customers, or top spenders. Use pre-built templates for win-backs, promotions, or write a custom message.",
    tips: [
      "Preview the audience size before sending.",
      "Messages are limited to 160 characters for standard SMS.",
    ],
  },
  "/admin/loyalty": {
    title: "Loyalty & Rewards",
    description:
      "Set up a points-based loyalty program. Configure how many points customers earn per booking and how they can redeem points for discounts. Enable or disable the program at any time.",
    tips: [
      "Customers can see their points balance in their customer dashboard.",
      "Points are awarded automatically when a booking is completed.",
    ],
  },
  "/admin/referrals": {
    title: "Referral Tracking",
    description:
      "View all customer referrals — who referred whom, the referral status, and how many reward points were awarded. Filter by status (pending, completed).",
    tips: ["Configure referral reward points in Settings."],
  },
  "/admin/membership": {
    title: "Memberships",
    description:
      "Create recurring subscription plans for customers (e.g., monthly VIP package). Set the plan name, price, billing interval, and discount percentage. Customers are billed automatically via Stripe.",
    tips: [
      "Memberships require Stripe to be connected.",
      "Active members appear in the Members audience for campaigns.",
    ],
  },
  "/admin/growth": {
    title: "AI Growth Hub",
    description:
      "A suite of AI-powered growth tools including business performance insights, automated win-back campaigns for inactive customers, and a social media post generator.",
    tips: [],
  },
  "/admin/growth/insights": {
    title: "AI Business Insights",
    description:
      "AI-generated analysis of your business performance with prioritized action items across revenue, bookings, customers, and marketing.",
    tips: ["Insights are cached and refreshed on a configurable schedule."],
  },
  "/admin/growth/winback": {
    title: "Win-Back Campaigns",
    description:
      "Automatically identify customers who haven't visited recently and send them a personalized win-back SMS to bring them back.",
    tips: [],
  },
  "/admin/growth/referral": {
    title: "Growth Referral Campaigns",
    description:
      "Send referral invitation messages to existing customers encouraging them to refer friends.",
    tips: [],
  },
  "/admin/growth/social": {
    title: "Social Media Post Generator",
    description:
      "Generate ready-to-post social media content for Instagram, Facebook, Twitter, TikTok, and LinkedIn. Posts can be approved, scheduled, or published.",
    tips: [],
  },
  "/admin/growth/settings": {
    title: "AI Growth Settings",
    description:
      "Configure how often AI insights are refreshed and which growth features are enabled.",
    tips: [],
  },
  "/admin/notifications": {
    title: "Messages & SMS Notifications",
    description:
      "Send individual or broadcast messages to customers. View the history of all automated notifications sent (booking confirmations, appointment reminders, cancellations, loyalty updates).",
    tips: [
      "Configure which notification types are sent in Settings.",
      "Audience targeting options include all customers, upcoming appointments, at-risk, VIP, members, new customers, and no-bookings.",
    ],
  },
  "/admin/notifications-log": {
    title: "Notifications Log",
    description:
      "A full audit log of every push notification and SMS sent to customers, including delivery status.",
    tips: [],
  },
  "/admin/delivery-status": {
    title: "SMS Delivery Status",
    description:
      "Monitor the delivery status of outgoing SMS messages. See delivered, sent, failed, and undelivered counts. View blocked numbers that have had repeated delivery failures.",
    tips: [],
  },
  "/admin/branding": {
    title: "Branding",
    description:
      "Customize your business's appearance in the app. Upload a logo, set your primary brand color, write a welcome message, and configure your booking page URL (slug). Also set business contact details, address, and owner information.",
    tips: [
      "The slug is the unique URL customers use to book: yourdomain.com/your-slug",
      "The primary color appears on your customer-facing booking page.",
    ],
  },
  "/admin/settings": {
    title: "Settings",
    description:
      "Configure loyalty program settings (points per appointment, referral rewards), notification preferences (which automated messages are sent), and default booking behavior.",
    tips: [],
  },
  "/admin/carwash": {
    title: "Car Wash Settings",
    description:
      "Car wash and mobile detailer specific settings. Configure service mode (mobile, in-shop, or hybrid), maximum concurrent jobs, service radius, travel fees, bay labels, and vehicle type surcharges.",
    tips: ["Only visible for businesses in the car wash niche."],
  },
  "/admin/upgrade": {
    title: "Upgrade Plan",
    description:
      "View and compare subscription plans (Free, Premium at $29/month, Pro at $79/month). Upgrade to unlock features like staff management, SMS campaigns, advanced analytics, and more.",
    tips: [
      "Annual billing saves approximately 17% compared to monthly.",
      "Premium unlocks staff management and SMS campaigns.",
      "Pro unlocks all features.",
    ],
  },
  "/admin/mobile/menu": {
    title: "Mobile App (Admin)",
    description:
      "A mobile-optimized view of the admin portal for managing your business on the go. Access today's schedule, revenue, analytics, appointments, messages, customers, staff, notifications, and services from your phone.",
    tips: [
      "Scan the QR code from the desktop sidebar to open the mobile view on your phone.",
      "The mobile view is a Progressive Web App (PWA) — install it to your home screen for the best experience.",
    ],
  },
  "/admin/mobile/schedule": {
    title: "Mobile Schedule",
    description: "View today's appointments in a mobile-friendly format.",
    tips: [],
  },
  "/admin/mobile/revenue": {
    title: "Mobile Revenue",
    description: "View business revenue and staff breakdown from your phone.",
    tips: [],
  },
  "/admin/mobile/analytics": {
    title: "Mobile Analytics",
    description: "View booking trends, top services, and customer insights from your phone.",
    tips: [],
  },
  "/admin/mobile/appointments": {
    title: "Mobile Appointments",
    description: "Accept or decline incoming booking requests from your phone.",
    tips: [],
  },
  "/admin/mobile/messages": {
    title: "Mobile Messages",
    description: "Send and view customer messages from your phone.",
    tips: [],
  },
  "/admin/mobile/customers-list": {
    title: "Mobile Customer List",
    description: "Browse your customer directory from your phone.",
    tips: [],
  },
  "/admin/mobile/staff": {
    title: "Mobile Staff Management",
    description: "View and manage staff members from your phone.",
    tips: [],
  },
  "/admin/mobile/services": {
    title: "Mobile Services",
    description: "View your service list and prices from your phone.",
    tips: [],
  },
  "/admin/mobile/membership": {
    title: "Mobile Memberships",
    description: "View membership plans and active members from your phone.",
    tips: [],
  },
  "/admin/mobile/referrals": {
    title: "Mobile Referrals",
    description: "View referral activity from your phone.",
    tips: [],
  },
  "/admin/mobile/notifications": {
    title: "Mobile Notifications",
    description: "View recent alerts and updates from your phone.",
    tips: [],
  },
  "/admin/mobile/take-payment": {
    title: "Mobile Take Payment",
    description: "Charge a customer for a service or custom amount from your phone.",
    tips: [],
  },
  "/admin/mobile/qr-code": {
    title: "Mobile QR Code",
    description: "Display your business booking QR code from your phone for customers to scan.",
    tips: [],
  },
  "/staff/dashboard": {
    title: "Staff Dashboard",
    description:
      "The staff member's home screen after login. Shows their upcoming appointments and quick access to all staff tools.",
    tips: [],
  },
  "/staff/schedule": {
    title: "Staff Schedule",
    description:
      "Staff members can view their own upcoming appointments, filter by date, and update booking statuses.",
    tips: [],
  },
  "/staff/services": {
    title: "Staff Services",
    description: "Staff members can view the list of services offered by the business.",
    tips: [],
  },
  "/staff/customers": {
    title: "Staff Customer List",
    description:
      "Staff members can browse and search the customer directory and edit basic customer information.",
    tips: [],
  },
  "/staff/payment": {
    title: "Staff Take Payment",
    description:
      "Staff members can look up a customer by phone number and generate a payment QR code or charge them for a service.",
    tips: [],
  },
  "/staff/revenue": {
    title: "Staff Revenue",
    description:
      "Staff members can view their own personal revenue breakdown — service income and tips — filtered by today, week, month, or all time.",
    tips: [],
  },
  "/staff/qr-code": {
    title: "Staff QR Code",
    description:
      "Staff members can display the business booking QR code for customers to scan and book.",
    tips: [],
  },
  "/staff/notifications": {
    title: "Staff Notifications",
    description:
      "Staff members can view recent booking activity — new requests, confirmations, cancellations — assigned to them.",
    tips: [],
  },
  "/": {
    title: "Landing Page",
    description:
      "The Katoomy home page. New business owners can sign up here. Existing users can log in to the admin portal.",
    tips: ["Business owners log in at /admin/login.", "Staff members log in at /staff/login."],
  },
  "/signup": {
    title: "Business Sign Up",
    description:
      "New business owners create their Katoomy account here. After signing up, they are guided through the onboarding setup.",
    tips: [],
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Recursively find all page.tsx files under a directory.
 */
function findPageFiles(dir, results = []) {
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip node_modules, .git, and non-app directories
      if (!["node_modules", ".git", ".next", "out"].includes(entry.name)) {
        findPageFiles(fullPath, results);
      }
    } else if (entry.name === "page.tsx" || entry.name === "page.ts") {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Convert a filesystem path to a route path.
 * e.g. /home/ubuntu/Katoomy-mai/app/admin/services/page.tsx → /admin/services
 */
function pathToRoute(filePath) {
  const relative = path.relative(APP_DIR, filePath);
  const parts = relative.split(path.sep);
  // Remove "page.tsx" from end
  parts.pop();
  const route = "/" + parts.join("/");
  return route === "/" ? "/" : route;
}

/**
 * Extract useful text clues from a page file's source code.
 * Looks for: h1/h2 text, button labels, interface names, and // file: comments.
 */
function extractCluesFromSource(source) {
  const clues = [];

  // Extract // file: comment
  const fileComment = source.match(/\/\/ file: (.+)/);
  if (fileComment) clues.push(`File: ${fileComment[1].trim()}`);

  // Extract export default function name
  const funcName = source.match(/export default (?:async )?function (\w+)/);
  if (funcName) clues.push(`Component: ${funcName[1]}`);

  // Extract interface names (these reveal data structures / features)
  const interfaces = [...source.matchAll(/interface (\w+)\s*\{/g)].map((m) => m[1]);
  if (interfaces.length > 0) {
    clues.push(`Data types: ${interfaces.slice(0, 8).join(", ")}`);
  }

  // Extract string literals that look like UI labels (capitalized, 2-6 words)
  const labels = [...source.matchAll(/"([A-Z][a-zA-Z\s]{3,40})"/g)]
    .map((m) => m[1].trim())
    .filter((l) => !l.includes("\\") && l.split(" ").length <= 6)
    .slice(0, 10);
  if (labels.length > 0) {
    clues.push(`UI labels: ${labels.join(", ")}`);
  }

  return clues;
}

/**
 * Build the feature entry for a single route.
 */
function buildFeatureEntry(route, source, index) {
  const meta = ROUTE_METADATA[route];

  // Skip login, auth, redirect, and utility pages from the knowledge base
  const skipPatterns = [
    "/login", "/auth", "/callback", "/reset-password", "/verify-email",
    "/success", "/refresh", "/return", "/reset-session", "/pay-qr",
    "/pay-success", "/payment-success", "/cashapp-success", "/tip-success",
    "/membership-success", "/confirmation", "/booking-opt-in-demo",
    "/privacy-policy", "/sms-terms", "/hub", "/onboarding",
  ];
  if (skipPatterns.some((p) => route.includes(p))) return null;

  // Skip customer-facing [slug] routes (those are for end customers, not admins)
  if (route.startsWith("/[slug]")) return null;

  if (meta) {
    let entry = `${index}. ${meta.title.toUpperCase()} (${route})\n`;
    entry += `   ${meta.description}\n`;
    if (meta.tips && meta.tips.length > 0) {
      for (const tip of meta.tips) {
        entry += `   - ${tip}\n`;
      }
    }
    return entry;
  }

  // Auto-generate entry for unknown routes using source clues
  const clues = extractCluesFromSource(source);
  const routeLabel = route
    .split("/")
    .filter(Boolean)
    .map((s) => s.replace(/-/g, " ").replace(/\[|\]/g, ""))
    .join(" > ");

  let entry = `${index}. ${routeLabel.toUpperCase()} (${route})\n`;
  entry += `   This page is accessible at ${route}.\n`;
  if (clues.length > 0) {
    entry += `   Details: ${clues.join(" | ")}\n`;
  }
  return entry;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  console.log("🔍 Scanning app pages to generate AI help knowledge base...");

  const pageFiles = findPageFiles(APP_DIR);
  console.log(`   Found ${pageFiles.length} page files.`);

  const features = [];
  let index = 1;

  // Process admin pages first, then staff, then others
  const sorted = pageFiles.sort((a, b) => {
    const aIsAdmin = a.includes("/admin/");
    const bIsAdmin = b.includes("/admin/");
    const aIsStaff = a.includes("/staff/");
    const bIsStaff = b.includes("/staff/");
    if (aIsAdmin && !bIsAdmin) return -1;
    if (!aIsAdmin && bIsAdmin) return 1;
    if (aIsStaff && !bIsStaff) return -1;
    if (!aIsStaff && bIsStaff) return 1;
    return a.localeCompare(b);
  });

  for (const filePath of sorted) {
    const route = pathToRoute(filePath);
    const source = fs.readFileSync(filePath, "utf-8");
    const entry = buildFeatureEntry(route, source, index);
    if (entry) {
      features.push(entry);
      index++;
    }
  }

  console.log(`   Generated ${features.length} feature entries.`);

  // ── Build the final system prompt ──────────────────────────────────────────
  const timestamp = new Date().toISOString();
  const featureList = features.join("\n");

  const systemPrompt = `You are the Katoomy AI Help Assistant. Your job is to help users (business owners and staff) understand how to use the Katoomy app.
You must provide clear, concise, and accurate step-by-step instructions based ONLY on the features listed below.

IMPORTANT RULES:
- Only answer questions about how to use Katoomy. Do not answer unrelated questions.
- If a feature requires a Premium or Pro plan upgrade, always mention that.
- Keep answers concise — under 3 paragraphs. Use bullet points for step-by-step instructions.
- Always include the navigation path (e.g., "Go to Admin > Services") in your answer.
- You are talking to the business owner or a staff member, not the end customer.
- Do not invent features that are not listed below.

COMPLETE FEATURE KNOWLEDGE BASE (auto-generated on ${timestamp}):

${featureList}

SUBSCRIPTION PLANS:
- Free: Unlimited bookings, customer management, QR code booking, basic loyalty, referral tracking, mobile app access.
- Premium ($29/month or $290/year): Everything in Free plus staff management, individual staff schedules, automated SMS reminders, email campaigns, advanced analytics, custom branding, priority support.
- Pro ($79/month or $790/year): Everything in Premium plus all advanced features.

GENERAL NAVIGATION:
- Desktop: Use the left sidebar to navigate between all sections.
- Mobile: Use the mobile menu at /admin/mobile/menu or scan the QR code from the desktop sidebar.
- Staff portal: Staff members log in separately at /staff/login and have access to their own schedule, customers, payments, and revenue.`;

  // ── Write the output TypeScript file ──────────────────────────────────────
  const outputContent = `// AUTO-GENERATED FILE — DO NOT EDIT MANUALLY
// Generated by scripts/generate-ai-knowledge.mjs on ${timestamp}
// Re-runs automatically before every build via the "prebuild" npm script.
// To add knowledge for a new feature, update ROUTE_METADATA in the script.

export const AI_HELP_SYSTEM_PROMPT = ${JSON.stringify(systemPrompt)};
`;

  fs.writeFileSync(OUTPUT_FILE, outputContent, "utf-8");
  console.log(`✅ Knowledge base written to lib/ai-help-knowledge.ts`);
  console.log(`   ${features.length} features documented.`);
}

main();
