"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import PwaLaunchRedirect from "@/components/PwaLaunchRedirect";

export default function LandingPage() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">(
    "monthly",
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const features = [
    {
      icon: "📅",
      title: "Smart Booking System",
      description:
        "Let customers book appointments 24/7 with your custom QR code. No more phone tag or double bookings.",
    },
    {
      icon: "👥",
      title: "Customer Management",
      description:
        "Keep all your customer information organized in one place. Track appointments, preferences, and history.",
    },
    {
      icon: "🎁",
      title: "Loyalty & Referrals",
      description:
        "Reward loyal customers and grow through referrals. Built-in points system that runs itself.",
    },
    {
      icon: "📱",
      title: "Mobile-First Design",
      description:
        "Manage your business on the go. Fully optimized for mobile devices with a beautiful interface.",
    },
    {
      icon: "💬",
      title: "Automated Messaging",
      description:
        "Send appointment reminders and follow-ups automatically. Keep your customers engaged.",
    },
    {
      icon: "📊",
      title: "Business Analytics",
      description:
        "Track your revenue, popular services, and customer trends. Make data-driven decisions.",
    },
  ];

  const pricingPlans = [
    {
      name: "Free",
      price: { monthly: 0, annual: 0 },
      description: "Perfect for getting started",
      features: [
        "Unlimited bookings",
        "Customer management",
        "QR code booking link",
        "Basic loyalty program",
        "Referral tracking",
        "Mobile app access",
      ],
      notIncluded: [
        "Staff management",
        "Automated messaging",
        "Advanced analytics",
        "Priority support",
      ],
      cta: "Get Started Free",
      ctaLink: "/signup",
      popular: false,
    },
    {
      name: "Premium",
      price: { monthly: 29, annual: 290 },
      description: "For growing businesses",
      features: [
        "Everything in Free, plus:",
        "✨ Staff management",
        "✨ Individual staff schedules",
        "✨ Automated SMS reminders",
        "✨ Email campaigns",
        "✨ Advanced analytics",
        "✨ Custom branding",
        "✨ Priority support",
      ],
      notIncluded: [],
      cta: "Start 14-Day Free Trial",
      ctaLink: "/signup?plan=premium",
      popular: true,
    },
    {
      name: "Pro",
      price: { monthly: 79, annual: 790 },
      description: "For established businesses",
      features: [
        "Everything in Premium, plus:",
        "⚡ Multiple locations",
        "⚡ Advanced inventory",
        "⚡ API access",
        "⚡ White-label branding",
        "⚡ Dedicated account manager",
        "⚡ Custom integrations",
      ],
      notIncluded: [],
      cta: "Contact Sales",
      ctaLink: "/contact",
      popular: false,
    },
  ];

  const testimonials = [
    {
      name: "Sarah Johnson",
      business: "Salon Bliss",
      image: "💇‍♀️",
      quote:
        "Katoomy transformed how we manage appointments. Our no-show rate dropped by 60% with automated reminders!",
    },
    {
      name: "Mike Rodriguez",
      business: "The Fade Factory",
      image: "💈",
      quote:
        "The QR code system is genius. Customers love how easy it is to book, and I love not answering the phone all day.",
    },
    {
      name: "Emily Chen",
      business: "Glow Spa",
      image: "✨",
      quote:
        "Staff management features are a game-changer. I can see everyone's schedule and availability in one place.",
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      <PwaLaunchRedirect redirectToDashboard={false} />
      {/* Background blobs (match login page vibe) */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-gradient-to-br from-violet-200/70 via-purple-200/60 to-orange-200/60 blur-3xl" />
        <div className="absolute -bottom-40 -left-24 h-[520px] w-[520px] rounded-full bg-gradient-to-tr from-purple-200/60 via-violet-200/50 to-orange-200/40 blur-3xl" />
        <div className="absolute right-[-180px] top-1/3 h-[420px] w-[420px] rounded-full bg-gradient-to-br from-violet-200/50 to-purple-200/40 blur-3xl" />
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 z-50 w-full border-b border-gray-200/60 bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-gray-200 bg-white p-2 shadow-sm">
                <Image
                  src="/brand/katoomy-rocket.png"
                  alt="Katoomy rocket"
                  width={34}
                  height={34}
                  priority
                />
              </div>
              <div className="leading-tight">
                <div className="text-lg font-semibold tracking-tight text-gray-900">
                  Katoomy
                </div>
                <div className="text-xs text-gray-500">Grow Your Business</div>
              </div>
            </div>

            <div className="hidden items-center space-x-8 md:flex">
              <a href="#features" className="text-gray-600 transition hover:text-gray-900">Features</a>
              <a href="#pricing" className="text-gray-600 transition hover:text-gray-900">Pricing</a>
              <a href="#testimonials" className="text-gray-600 transition hover:text-gray-900">Testimonials</a>
              <Link href="/admin/login" className="text-gray-600 transition hover:text-gray-900">Sign In</Link>
              <Link href="/signup" className="rounded-xl bg-gradient-to-r from-violet-700 via-purple-700 to-orange-500 px-6 py-2 font-semibold text-white shadow-lg shadow-violet-200/60 transition hover:brightness-105">
                Get Started Free
              </Link>
            </div>

            {/* Mobile hamburger */}
            <button
              className="flex items-center justify-center md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 cursor-pointer"
              onClick={() => setMobileMenuOpen((o) => !o)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200/60 bg-white/95 px-4 py-4 flex flex-col gap-4">
            <a href="#features" onClick={() => setMobileMenuOpen(false)} className="text-gray-700 font-medium">Features</a>
            <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="text-gray-700 font-medium">Pricing</a>
            <a href="#testimonials" onClick={() => setMobileMenuOpen(false)} className="text-gray-700 font-medium">Testimonials</a>
            <Link href="/admin/login" onClick={() => setMobileMenuOpen(false)} className="text-gray-700 font-medium">Sign In</Link>
            <Link href="/signup" className="rounded-xl bg-gradient-to-r from-violet-700 via-purple-700 to-orange-500 px-6 py-3 font-semibold text-white text-center shadow-lg shadow-violet-200/60">
              Get Started Free
            </Link>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="relative px-4 pb-20 pt-32 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white/70 px-4 py-2 text-sm text-gray-700 shadow-sm backdrop-blur">
            <span className="font-semibold text-violet-700">Katoomy</span>
            <span className="text-gray-400">•</span>
            <span>Bookings, retention, and new customers — in one place</span>
          </div>

          <h1 className="mt-6 text-5xl font-bold tracking-tight text-gray-900 md:text-6xl">
            The booking system{" "}
            <span className="bg-gradient-to-r from-violet-700 via-purple-700 to-orange-500 bg-clip-text text-transparent">
              service businesses
            </span>{" "}
            love
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-xl text-gray-600">
            Stop juggling phone calls and spreadsheets. Katoomy gives you a
            professional booking system that works 24/7 — so you can focus on
            what you do best.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/signup"
              className="rounded-2xl bg-gradient-to-r from-violet-700 via-purple-700 to-orange-500 px-8 py-4 text-lg font-bold text-white shadow-xl shadow-violet-200/60 transition hover:brightness-105"
            >
              Start Free Trial
            </Link>
            <Link
              href="#pricing"
              className="rounded-2xl border-2 border-violet-300 bg-white/70 px-8 py-4 text-lg font-bold text-violet-700 shadow-sm backdrop-blur transition hover:bg-white"
            >
              View Pricing
            </Link>
          </div>

          <p className="mt-4 text-sm text-gray-500">
            No credit card required • 14-day free trial • Cancel anytime
          </p>

          {/* Hero demo card */}
          <div className="relative mt-16">
            <div className="mx-auto max-w-4xl rounded-3xl border border-gray-200 bg-white/80 p-8 shadow-2xl backdrop-blur">
              <div className="aspect-video rounded-2xl border border-gray-200 bg-gradient-to-br from-violet-100/70 via-purple-100/60 to-orange-100/60 p-6">
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <div className="mb-4 text-6xl">📱</div>
                  <p className="font-semibold text-gray-700">
                    Product Demo Coming Soon
                  </p>
                  <p className="mt-2 text-sm text-gray-500">
                    See Katoomy in action
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 3 value chips (mirrors login left panel vibe) */}
          <div className="mx-auto mt-10 grid max-w-4xl grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-gray-200 bg-white/70 p-4 text-left shadow-sm backdrop-blur">
              <div className="text-sm font-semibold text-gray-900">
                Automations
              </div>
              <div className="mt-1 text-sm text-gray-600">
                Reminders & follow-ups
              </div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white/70 p-4 text-left shadow-sm backdrop-blur">
              <div className="text-sm font-semibold text-gray-900">
                Retention
              </div>
              <div className="mt-1 text-sm text-gray-600">
                Loyalty & rewards
              </div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white/70 p-4 text-left shadow-sm backdrop-blur">
              <div className="text-sm font-semibold text-gray-900">Growth</div>
              <div className="mt-1 text-sm text-gray-600">
                Referrals that convert
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 text-center">
            <h2 className="text-4xl font-bold text-gray-900">
              Everything You Need to Run Your Business
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-xl text-gray-600">
              Katoomy handles the boring stuff so you can focus on your
              customers
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => (
              <div
                key={index}
                className="rounded-3xl border border-gray-200 bg-white/70 p-6 shadow-sm backdrop-blur transition hover:border-violet-200 hover:shadow-md"
              >
                <div className="mb-4 text-5xl">{feature.icon}</div>
                <h3 className="mb-2 text-xl font-bold text-gray-900">
                  {feature.title}
                </h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="relative py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl bg-gradient-to-r from-violet-700 via-purple-700 to-orange-500 p-[1px] shadow-xl shadow-violet-200/60">
            <div className="rounded-3xl bg-white/10 px-6 py-10 text-center text-white backdrop-blur">
              <div className="grid gap-8 md:grid-cols-3">
                <div>
                  <div className="mb-2 text-4xl font-bold">10,000+</div>
                  <div className="text-white/80">Appointments Booked</div>
                </div>
                <div>
                  <div className="mb-2 text-4xl font-bold">500+</div>
                  <div className="text-white/80">Happy Businesses</div>
                </div>
                <div>
                  <div className="mb-2 text-4xl font-bold">4.9/5</div>
                  <div className="text-white/80">Customer Rating</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="relative px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 text-center">
            <h2 className="text-4xl font-bold text-gray-900">
              Simple, Transparent Pricing
            </h2>
            <p className="mb-8 mt-4 text-xl text-gray-600">
              Start free, upgrade when you&apos;re ready
            </p>

            {/* Billing Toggle */}
            <div className="inline-flex items-center rounded-2xl border border-gray-200 bg-white/70 p-1 shadow-sm backdrop-blur">
              <button
                onClick={() => setBillingCycle("monthly")}
                className={`rounded-xl px-6 py-2 font-semibold transition ${
                  billingCycle === "monthly"
                    ? "bg-gradient-to-r from-violet-700 via-purple-700 to-orange-500 text-white shadow"
                    : "text-gray-700 hover:text-gray-900"
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingCycle("annual")}
                className={`rounded-xl px-6 py-2 font-semibold transition ${
                  billingCycle === "annual"
                    ? "bg-gradient-to-r from-violet-700 via-purple-700 to-orange-500 text-white shadow"
                    : "text-gray-700 hover:text-gray-900"
                }`}
              >
                Annual{" "}
                <span className="ml-1 text-sm text-emerald-200/90">
                  (Save 17%)
                </span>
              </button>
            </div>
          </div>

          <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-3">
            {pricingPlans.map((plan, index) => (
              <div
                key={index}
                className={`rounded-3xl border bg-white/70 p-8 shadow-lg backdrop-blur ${
                  plan.popular
                    ? "border-violet-300 shadow-2xl shadow-violet-200/60 md:scale-105"
                    : "border-gray-200"
                }`}
              >
                {plan.popular && (
                  <div className="mb-4 inline-block rounded-full bg-gradient-to-r from-violet-700 via-purple-700 to-orange-500 px-4 py-1 text-sm font-bold text-white">
                    MOST POPULAR
                  </div>
                )}

                <h3 className="mb-2 text-2xl font-bold text-gray-900">
                  {plan.name}
                </h3>
                <p className="mb-6 text-gray-600">{plan.description}</p>

                <div className="mb-6">
                  <span className="text-5xl font-bold text-gray-900">
                    ${plan.price[billingCycle]}
                  </span>
                  {plan.price.monthly > 0 && (
                    <span className="text-gray-600">
                      /{billingCycle === "monthly" ? "mo" : "yr"}
                    </span>
                  )}
                </div>

                <Link
                  href={plan.ctaLink}
                  className={`mb-6 block w-full rounded-2xl py-3 text-center font-bold transition ${
                    plan.popular
                      ? "bg-gradient-to-r from-violet-700 via-purple-700 to-orange-500 text-white shadow-lg shadow-violet-200/60 hover:brightness-105"
                      : "bg-white text-gray-900 ring-1 ring-gray-200 hover:bg-gray-50"
                  }`}
                >
                  {plan.cta}
                </Link>

                <ul className="space-y-3">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start">
                      <span className="mr-2 text-emerald-500">✓</span>
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                  {plan.notIncluded.map((feature, idx) => (
                    <li key={idx} className="flex items-start text-gray-400">
                      <span className="mr-2">✕</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <p className="mt-12 text-center text-gray-600">
            All plans include unlimited bookings and customers. No hidden fees.
          </p>
        </div>
      </section>

      {/* Testimonials */}
      <section
        id="testimonials"
        className="relative px-4 py-20 sm:px-6 lg:px-8"
      >
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 text-center">
            <h2 className="text-4xl font-bold text-gray-900">
              Loved by Business Owners
            </h2>
            <p className="mt-4 text-xl text-gray-600">
              See what our customers have to say
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {testimonials.map((testimonial, index) => (
              <div
                key={index}
                className="rounded-3xl border border-gray-200 bg-white/70 p-6 shadow-sm backdrop-blur"
              >
                <div className="mb-4 flex items-center">
                  <div className="mr-3 text-4xl">{testimonial.image}</div>
                  <div>
                    <div className="font-bold text-gray-900">
                      {testimonial.name}
                    </div>
                    <div className="text-sm text-gray-600">
                      {testimonial.business}
                    </div>
                  </div>
                </div>
                <p className="italic text-gray-700">
                  &quot;{testimonial.quote}&quot;
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <div className="rounded-3xl bg-gradient-to-r from-violet-700 via-purple-700 to-orange-500 p-[1px] shadow-2xl shadow-violet-200/60">
            <div className="rounded-3xl bg-white/10 px-8 py-14 text-white backdrop-blur">
              <h2 className="text-4xl font-bold">
                Ready to Grow Your Business?
              </h2>
              <p className="mt-4 text-xl text-white/80">
                Join hundreds of service businesses using Katoomy to manage
                their bookings and increase revenue.
              </p>
              <Link
                href="/signup"
                className="mt-8 inline-block rounded-2xl bg-white px-8 py-4 text-lg font-bold text-violet-700 shadow-xl transition hover:bg-gray-100"
              >
                Start Your Free Trial Today
              </Link>
              <p className="mt-4 text-sm text-white/80">
                No credit card required • Set up in 5 minutes
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative bg-gray-900 px-4 py-12 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 md:grid-cols-4">
            <div>
              <div className="text-2xl font-bold">Katoomy</div>
              <p className="mt-3 text-gray-400">
                The modern booking system for service businesses.
              </p>
            </div>

            <div>
              <h3 className="mb-4 font-bold">Product</h3>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <a href="#features" className="transition hover:text-white">
                    Features
                  </a>
                </li>
                <li>
                  <a href="#pricing" className="transition hover:text-white">
                    Pricing
                  </a>
                </li>
                <li>
                  <Link href="/signup" className="transition hover:text-white">
                    Sign Up
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="mb-4 font-bold">Company</h3>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <Link href="/about" className="transition hover:text-white">
                    About
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className="transition hover:text-white">
                    Contact
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="transition hover:text-white">
                    Privacy
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="transition hover:text-white">
                    Terms
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="mb-4 font-bold">Support</h3>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <Link href="/help" className="transition hover:text-white">
                    Help Center
                  </Link>
                </li>
                <li>
                  <Link href="/docs" className="transition hover:text-white">
                    Documentation
                  </Link>
                </li>
                <li>
                  <a
                    href="mailto:support@katoomy.com"
                    className="transition hover:text-white"
                  >
                    support@katoomy.com
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-12 border-t border-gray-800 pt-8 text-center text-gray-400">
            <p>&copy; 2026 Katoomy. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
