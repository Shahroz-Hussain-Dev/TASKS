import type { Metadata } from "next";
import { LegalPage } from "../legal";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="4 October 2026">
      <h2>What we collect</h2>
      <ul>
        <li><strong>Account</strong>: full name, mobile number, optional email, a password hash.</li>
        <li><strong>Drivers</strong>: CNIC number and images, driving license, route permit, vehicle registration, vehicle and selfie photos, payment receipt screenshots. These are needed to verify identity and eligibility to drive.</li>
        <li><strong>Location</strong>: precise location while you use the app; for drivers who are online, continuously, and during an active ride also in the background so passengers can follow the trip.</li>
        <li><strong>Ride data</strong>: pickup and drop-off, offers and bids, fares, ratings, messages exchanged in the ride chat and with support.</li>
        <li><strong>Device</strong>: app version, IP address and user agent for security logging.</li>
      </ul>
      <h2>How we use it</h2>
      <p>To match passengers with drivers, compute fair fares, show live trips, verify drivers, prevent fraud and abuse, provide support and comply with Pakistani law. We do not sell personal data and we do not use it for advertising.</p>
      <h2>Automated verification</h2>
      <p>Driver documents are analysed by Google Gemini to check the document type, legibility and key fields. A human administrator makes the final approval decision. Images are transmitted to Google for this purpose only and are not used to train models under the API terms.</p>
      <h2>Sharing</h2>
      <p>Passengers see a driver&apos;s first name, photo, rating, vehicle and plate. Drivers see a passenger&apos;s first name, rating and pickup/drop-off. Infrastructure providers (Vercel, Supabase, Google) process data on our behalf. Map and routing requests go to OpenFreeMap, OSRM, Photon and OpenStreetMap services without your identity.</p>
      <h2>Retention & deletion</h2>
      <p>Ride history is kept for 5 years for dispute and legal purposes. You can delete your account from Profile → Delete account; personal data is anonymised immediately and documents are removed within 30 days.</p>
      <h2>Security</h2>
      <p>Passwords are hashed with bcrypt, all traffic is encrypted with TLS, documents are only visible to you and administrators, and access is logged.</p>
      <h2>Contact</h2>
      <p>support@raahi.pk</p>
    </LegalPage>
  );
}
