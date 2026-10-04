import type { Metadata } from "next";
import { LegalPage } from "../legal";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="4 October 2026">
      <h2>The service</h2>
      <p>Raahi is a marketplace that connects passengers with independent drivers. Passengers propose a fare, drivers may accept or counter-offer, and a ride is formed when the passenger accepts an offer. Raahi is not a transport company and does not employ drivers.</p>
      <h2>Fares and payment</h2>
      <p>The fare is the amount agreed in the app and is paid in cash to the driver at the end of the trip. Raahi takes no commission from fares. Fare ranges are computed from distance, vehicle fuel economy and the official petrol price to protect both sides.</p>
      <h2>Drivers</h2>
      <p>Drivers must hold a valid driving license, route permit, vehicle registration and CNIC, keep documents current, and pay the monthly platform subscription (PKR 1,000) to receive ride requests. Raahi may suspend accounts for safety, fraud or repeated cancellations.</p>
      <h2>Passengers</h2>
      <p>Passengers agree to be at the pickup point on time, treat drivers respectfully and pay the agreed fare. Repeated no-shows may lead to suspension.</p>
      <h2>Cancellations</h2>
      <p>Either party may cancel before the trip starts, selecting a reason. Cancellations are recorded and visible to our team.</p>
      <h2>Liability</h2>
      <p>Raahi provides the matching service &ldquo;as is&rdquo;. Transport is provided by the driver under Pakistani law. To the extent permitted by law, Raahi is not liable for indirect losses arising from a ride.</p>
      <h2>Changes</h2>
      <p>We may update these terms; continued use after an update means acceptance. Contact: support@raahi.pk.</p>
    </LegalPage>
  );
}
