// app/sms-terms/page.tsx
// Katoomy SMS Terms & Conditions — public page, no auth required

import Link from "next/link";

export default function SmsTermsPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link href="/" className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 mb-8">
          ← Back
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">SMS Terms &amp; Conditions</h1>
        <p className="text-sm text-gray-500 mb-10">Effective Date: April 11, 2026 &nbsp;·&nbsp; Last Updated: April 11, 2026</p>

        <section className="space-y-8 text-gray-700 text-sm leading-relaxed">

          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">Overview</h2>
            <p>Katoomy is a business management platform developed by Venditco LLC ("Venditco," "we," "us," or "our"), a software company incorporated in the State of Georgia. Katoomy enables local service businesses to manage appointments and communicate with their customers through SMS messaging.</p>
            <p className="mt-3">These SMS Terms &amp; Conditions ("SMS Terms") govern your consent to receive text messages sent through the Katoomy platform — whether from Katoomy directly or from a business that uses Katoomy to communicate with its customers. By opting in to receive SMS messages, you agree to these SMS Terms in addition to our <a href="/privacy-policy" className="text-blue-600 underline">Privacy Policy</a>.</p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">1. Program Description</h2>
            <p>Businesses using the Katoomy platform may send SMS text messages to their customers for the following purposes:</p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full border border-gray-200 rounded-lg text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-900 border-b border-gray-200">Message Type</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-900 border-b border-gray-200">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {[
                    ["Booking Confirmations", "Confirmation of appointments or service bookings made through Katoomy"],
                    ["Appointment Reminders", "Automated reminders sent prior to scheduled appointments to reduce no-shows"],
                    ["Customer Service", "Responses to customer inquiries, support messages, and service-related updates"],
                    ["Automated Follow-Ups", "Post-appointment follow-up messages, review requests, and re-engagement messages"],
                    ["Marketing & Promotions", "Special offers, promotions, discounts, and announcements from businesses using Katoomy"],
                  ].map(([type, desc]) => (
                    <tr key={type}>
                      <td className="px-4 py-3 font-medium text-gray-800 align-top">{type}</td>
                      <td className="px-4 py-3 text-gray-600">{desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3">Message frequency varies depending on the business's settings and your level of activity with that business.</p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">2. Who Sends the Messages</h2>
            <p>SMS messages sent through Katoomy are sent on behalf of the individual business you are engaging with. Katoomy provides the technology platform that enables those businesses to send messages. When you opt in through a Katoomy-powered form, you are consenting to receive messages from that specific business via the Katoomy platform.</p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">3. How to Opt In</h2>
            <p>You may opt in to receive SMS messages through Katoomy in one of the following ways:</p>
            <ul className="mt-3 list-disc pl-5 space-y-2">
              <li>By providing your mobile phone number and checking an opt-in checkbox on a Katoomy-powered booking form.</li>
            </ul>
            <div className="mt-4 bg-gray-50 border border-gray-200 rounded-xl px-5 py-4">
              <p className="text-gray-700"><strong>By opting in, you expressly consent to receive recurring automated text messages, including marketing messages, at the mobile number you provide. Consent is not a condition of purchasing any goods or services.</strong></p>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">4. How to Opt Out</h2>
            <p>You may opt out of SMS messages at any time using either of the following methods:</p>
            <ul className="mt-3 list-disc pl-5 space-y-2">
              <li>Reply <strong>STOP</strong> to any SMS message you receive. You will receive a single confirmation message and no further messages will be sent.</li>
              <li>Contact us directly at <a href="mailto:info@venditco.com" className="text-blue-600 underline">info@venditco.com</a> to request removal.</li>
            </ul>
            <p className="mt-3">If you later wish to re-subscribe, text <strong>START</strong> to the same number or re-enroll through a Katoomy opt-in form.</p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">5. Help</h2>
            <p>If you need assistance at any time, reply <strong>HELP</strong> to any SMS message or contact us:</p>
            <p className="mt-2">Email: <a href="mailto:info@venditco.com" className="text-blue-600 underline">info@venditco.com</a> &nbsp;·&nbsp; Website: <a href="https://katoomy.com" className="text-blue-600 underline">katoomy.com</a></p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">6. Message and Data Rates</h2>
            <p>Standard message and data rates may apply to all SMS messages sent and received through the Katoomy platform. These charges are billed by your mobile carrier and are your responsibility. Katoomy and Venditco LLC are not responsible for any charges imposed by your carrier. Message frequency varies based on appointment activity.</p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">7. Supported Carriers</h2>
            <p>SMS messaging through Katoomy is available on most major U.S. carriers, including AT&amp;T, Verizon, T-Mobile, and Sprint. Carrier support and availability may vary. Katoomy is not liable for messages that are delayed, undelivered, or blocked by your carrier.</p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">8. Privacy and Data Use</h2>
            <p>Phone numbers and consent records collected through Katoomy's opt-in process are used solely to send the types of messages described in these SMS Terms. We do not sell, rent, or share your phone number with third parties for their own independent marketing purposes.</p>
            <p className="mt-3">All SMS data collected through Katoomy is handled in accordance with our <a href="/privacy-policy" className="text-blue-600 underline">Privacy Policy</a>.</p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">9. No Guarantee of Delivery</h2>
            <p>SMS message delivery is subject to effective transmission from your network operator. Katoomy does not guarantee the delivery of any SMS message and is not liable for messages that are delayed or undelivered due to carrier issues, network conditions, or device limitations.</p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">10. Business User Responsibilities</h2>
            <p>If you are a business using Katoomy to send SMS messages to your customers, you are responsible for ensuring that all recipients have provided proper consent, that your messaging practices comply with applicable laws including the TCPA and carrier guidelines, and that your messages include required opt-out language.</p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">11. Changes to These SMS Terms</h2>
            <p>We may update these SMS Terms from time to time. Material changes will be communicated by updating the "Last Updated" date above. Continued participation in SMS programs through Katoomy after any changes constitutes your acceptance of the revised terms.</p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">12. Contact Information</h2>
            <p>
              <strong>Katoomy / Venditco LLC</strong><br />
              State of Georgia<br />
              Email: <a href="mailto:info@venditco.com" className="text-blue-600 underline">info@venditco.com</a><br />
              Website: <a href="https://katoomy.com" className="text-blue-600 underline">katoomy.com</a>
            </p>
          </div>

        </section>
      </div>
    </div>
  );
}