// app/privacy-policy/page.tsx
// Katoomy Privacy Policy — public page, no auth required

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-10">Effective Date: April 11, 2026 &nbsp;·&nbsp; Last Updated: April 11, 2026</p>

        <section className="prose prose-gray max-w-none space-y-8 text-gray-700 text-sm leading-relaxed">

          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">Introduction</h2>
            <p>Katoomy ("Katoomy," "we," "us," or "our") is a business management platform developed and operated by Venditco LLC, a software company incorporated in the State of Georgia. Katoomy is designed to help local service providers manage appointments, communicate with customers, and automate key business workflows.</p>
            <p className="mt-3">This Privacy Policy explains how Katoomy collects, uses, discloses, and protects information when you visit our website at katoomy.com, create an account, or use the Katoomy platform as a business owner, team member, or end customer. Please read this policy carefully. If you do not agree with its terms, please discontinue use of our platform.</p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">1. Who This Policy Applies To</h2>
            <p>Katoomy serves two distinct groups of users, and this policy applies to both:</p>
            <p className="mt-3"><strong>Business Users</strong> are the local service providers (such as salons, repair shops, cleaning services, and similar businesses) who create Katoomy accounts to manage their operations. Business Users are responsible for how they collect and use their own customers' data within the platform.</p>
            <p className="mt-3"><strong>End Customers</strong> are the individuals who interact with a Katoomy-powered business — for example, by booking an appointment, receiving an SMS reminder, or communicating with a business through Katoomy's messaging tools.</p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">2. Information We Collect</h2>
            <h3 className="font-semibold text-gray-800 mt-4 mb-1">2.1 Information You Provide Directly</h3>
            <p>When you create a Katoomy account or use our platform, we may collect personal information including your name, email address, phone number, business name, business address, and any other details you provide during registration or while using the platform.</p>
            <h3 className="font-semibold text-gray-800 mt-4 mb-1">2.2 Information Collected About End Customers</h3>
            <p>When a business uses Katoomy to manage its customer relationships, the platform collects information about that business's customers, including names, phone numbers, email addresses, appointment history, and communication records. This data is entered by the business or provided directly by the end customer when booking an appointment or opting in to communications. Katoomy processes this data on behalf of the business.</p>
            <h3 className="font-semibold text-gray-800 mt-4 mb-1">2.3 Information Collected Automatically</h3>
            <p>When you visit katoomy.com or use the Katoomy platform, we may automatically collect technical information such as your IP address, browser type, device type, operating system, pages visited, and the date and time of your activity. This information is collected through standard technologies including cookies and analytics tools.</p>
            <h3 className="font-semibold text-gray-800 mt-4 mb-1">2.4 Payment Information</h3>
            <p>Katoomy integrates with Stripe to enable businesses to accept payments from their customers. Katoomy does not directly collect, store, or process payment card information. All payment transactions are handled by Stripe, a PCI-compliant third-party payment processor, under Stripe's own Privacy Policy and Terms of Service.</p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">3. How We Use Your Information</h2>
            <p>We use the information we collect to provide, operate, maintain, and improve the Katoomy platform; create and manage user accounts; enable businesses to manage bookings and communicate with customers via SMS and other channels; send transactional communications such as booking confirmations and appointment reminders; analyze platform usage; respond to support requests; comply with legal obligations; and protect the security of our platform and users.</p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">4. SMS Communications</h2>
            <p>Katoomy's core functionality includes sending SMS messages on behalf of businesses to their customers. By providing a phone number and consenting to receive SMS messages through a Katoomy-powered booking form, end customers agree to receive text messages from the business they are engaging with, facilitated through the Katoomy platform.</p>
            <p className="mt-3">These messages may include appointment booking confirmations, appointment reminders, post-service follow-up messages, automated re-engagement messages, and marketing or promotional offers from the business.</p>
            <p className="mt-3">Message and data rates may apply. Message frequency varies by business and customer activity. End customers may opt out at any time by replying <strong>STOP</strong> to any message. For help, reply <strong>HELP</strong> or contact us at info@venditco.com.</p>
            <p className="mt-3">Katoomy does not sell, rent, or share end customer phone numbers with third parties for their own marketing purposes. For complete details on SMS practices, please review our <a href="/sms-terms" className="text-blue-600 underline">SMS Terms &amp; Conditions</a>.</p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">5. Sharing of Information</h2>
            <p>Katoomy does not sell personal information. We may share information in the following limited circumstances:</p>
            <p className="mt-3"><strong>With Businesses Using Katoomy.</strong> End customer data collected through the platform is shared with the business that the end customer is engaging with, as that is the core function of the platform.</p>
            <p className="mt-3"><strong>Service Providers.</strong> We may share information with trusted third-party vendors who assist us in operating the Katoomy platform. These vendors are contractually required to protect your information and use it only as directed by us.</p>
            <p className="mt-3"><strong>Business Transfers.</strong> If Venditco LLC or the Katoomy platform is involved in a merger, acquisition, or sale of assets, your information may be transferred as part of that transaction.</p>
            <p className="mt-3"><strong>Legal Requirements.</strong> We may disclose information if required by law, court order, or governmental authority.</p>
            <p className="mt-3"><strong>With Your Consent.</strong> We may share your information for any other purpose with your explicit consent.</p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">6. Data Retention</h2>
            <p>We retain personal information for as long as necessary to provide our services and fulfill the purposes described in this policy, unless a longer retention period is required or permitted by law. When information is no longer needed, we take reasonable steps to securely delete or anonymize it.</p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">7. Security</h2>
            <p>We implement commercially reasonable technical and organizational security measures to protect your personal information from unauthorized access, disclosure, alteration, or destruction. However, no method of transmission over the internet is completely secure, and we cannot guarantee absolute security.</p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">8. Third-Party Links and Integrations</h2>
            <p>The Katoomy platform may contain links to or integrations with third-party services, including Stripe for payment processing. We are not responsible for the privacy practices of those third parties and encourage you to review their privacy policies independently.</p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">9. Children's Privacy</h2>
            <p>Katoomy is not directed to individuals under the age of 13. We do not knowingly collect personal information from children under 13. If we become aware that we have inadvertently collected such information, we will take prompt steps to delete it.</p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">10. Your Rights and Choices</h2>
            <p>Depending on your location, you may have certain rights regarding your personal information, including the right to access, correct, or request deletion of the data we hold about you. To exercise any of these rights, please contact us at info@venditco.com.</p>
            <p className="mt-3">End customers who wish to opt out of SMS communications may do so at any time by replying STOP to any message.</p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">11. Changes to This Policy</h2>
            <p>We may update this Privacy Policy from time to time. We will notify you of material changes by updating the "Last Updated" date at the top of this page. Your continued use of Katoomy after any changes constitutes your acceptance of the updated policy.</p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">12. Contact Us</h2>
            <p>If you have any questions, concerns, or requests regarding this Privacy Policy, please contact us at:</p>
            <p className="mt-3">
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