// Synthetic "document" photos for the driver onboarding flow.
// Rendered with sharp (borrowed from apps/server) from inline SVG so they look
// like plausible phone photos of cards / a face / a car rather than blank squares.
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const require = createRequire("/home/user/TASKS/apps/server/package.json");
const sharp = require("sharp");

const FONT = "DejaVu Sans, FreeSans, Arial, sans-serif";
const W = 1024;
const H = 640;

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function photoFrame(inner, bg = "#2b2f36") {
  // A dark table-top background with a slight vignette so it reads as a photo of a card.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <radialGradient id="vig" cx="50%" cy="45%" r="75%"><stop offset="60%" stop-color="${bg}"/><stop offset="100%" stop-color="#15181d"/></radialGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="14" stdDeviation="14" flood-color="#000" flood-opacity="0.45"/></filter>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#vig)"/>
  ${inner}
</svg>`;
}

function textLines(x, y, lines, size = 22, fill = "#1f2937", gap = 34) {
  return lines.map((l, i) => `<text x="${x}" y="${y + i * gap}" font-family="${FONT}" font-size="${size}" fill="${fill}">${esc(l)}</text>`).join("");
}

function card({ title, subtitle, accent, fields, photo = true, stripe = "#0f766e", bg = "#e9f3ee", number }) {
  const cx = 92;
  const cy = 90;
  const cw = 840;
  const ch = 470;
  return photoFrame(`
    <g filter="url(#shadow)" transform="rotate(-1.4 ${W / 2} ${H / 2})">
      <rect x="${cx}" y="${cy}" width="${cw}" height="${ch}" rx="26" fill="${bg}" stroke="#c9d6cf" stroke-width="2"/>
      <rect x="${cx}" y="${cy}" width="${cw}" height="74" rx="26" fill="${stripe}"/>
      <rect x="${cx}" y="${cy + 40}" width="${cw}" height="34" fill="${stripe}"/>
      <text x="${cx + 28}" y="${cy + 48}" font-family="${FONT}" font-size="30" font-weight="bold" fill="#ffffff" letter-spacing="2">${esc(title)}</text>
      ${subtitle ? `<text x="${cx + cw - 28}" y="${cy + 48}" text-anchor="end" font-family="${FONT}" font-size="18" fill="#e2f3ee">${esc(subtitle)}</text>` : ""}
      ${photo ? `<rect x="${cx + 30}" y="${cy + 100}" width="190" height="230" rx="12" fill="#cbd5e1"/><circle cx="${cx + 125}" cy="${cy + 185}" r="46" fill="#b0855f"/><path d="M${cx + 55} ${cy + 330} q70 -95 140 0 z" fill="#b0855f"/><rect x="${cx + 30}" y="${cy + 100}" width="190" height="230" rx="12" fill="none" stroke="#94a3b8" stroke-width="2"/>` : ""}
      ${textLines(photo ? cx + 250 : cx + 30, cy + 130, fields, 22, "#1f2937", 40)}
      ${number ? `<text x="${cx + 30}" y="${cy + ch - 40}" font-family="DejaVu Sans Mono, monospace" font-size="34" font-weight="bold" fill="#111827" letter-spacing="3">${esc(number)}</text>` : ""}
      <rect x="${cx + cw - 230}" y="${cy + ch - 95}" width="190" height="60" rx="8" fill="#ffffff" stroke="#9ca3af"/>
      ${Array.from({ length: 24 }, (_, i) => `<rect x="${cx + cw - 222 + i * 7.6}" y="${cy + ch - 88}" width="${i % 3 === 0 ? 3 : 1.5}" height="46" fill="#111827"/>`).join("")}
      <text x="${cx + cw - 28}" y="${cy + ch - 18}" text-anchor="end" font-family="${FONT}" font-size="13" fill="#6b7280">${esc(accent)}</text>
    </g>`);
}

const DOCS = (ctx) => ({
  selfie: () =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="768" height="1024">
      <defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9e4ec"/><stop offset="1" stop-color="#b6c4cf"/></linearGradient></defs>
      <rect width="768" height="1024" fill="url(#bg)"/>
      <ellipse cx="384" cy="930" rx="300" ry="190" fill="#1f2a44"/>
      <rect x="310" y="560" width="148" height="140" rx="40" fill="#b0855f"/>
      <ellipse cx="384" cy="440" rx="170" ry="210" fill="#c6966c"/>
      <path d="M214 400 q170 -230 340 0 q-20 -150 -170 -160 q-150 10 -170 160z" fill="#2b1d14"/>
      <ellipse cx="320" cy="430" rx="22" ry="14" fill="#f8fafc"/><ellipse cx="448" cy="430" rx="22" ry="14" fill="#f8fafc"/>
      <circle cx="322" cy="431" r="10" fill="#3b2f2f"/><circle cx="450" cy="431" r="10" fill="#3b2f2f"/>
      <path d="M364 470 q20 40 40 0" stroke="#8c5a3c" stroke-width="6" fill="none" stroke-linecap="round"/>
      <path d="M330 540 q54 44 108 0" stroke="#7a3b2e" stroke-width="8" fill="none" stroke-linecap="round"/>
      <path d="M250 400 q-30 70 10 110" stroke="#2b1d14" stroke-width="22" fill="none" stroke-linecap="round"/>
      <path d="M518 400 q30 70 -10 110" stroke="#2b1d14" stroke-width="22" fill="none" stroke-linecap="round"/>
    </svg>`,
  cnic_front: () =>
    card({
      title: "NATIONAL IDENTITY CARD",
      subtitle: "ISLAMIC REPUBLIC OF PAKISTAN",
      stripe: "#166534",
      bg: "#eef6ee",
      fields: [`Name: ${ctx.fullName}`, "Father Name: Muhammad Akram", "Gender: M    Country of Stay: Pakistan", `Date of Birth: 1990-04-12`, "Date of Issue: 2022-02-01", "Date of Expiry: 2032-02-01"],
      number: ctx.cnicFormatted,
      accent: "NADRA · Specimen generated for testing",
    }),
  cnic_back: () =>
    card({
      title: "NATIONAL IDENTITY CARD",
      subtitle: "BACK",
      stripe: "#166534",
      bg: "#eef6ee",
      photo: false,
      fields: ["Present Address:", "House 12, Street 4, Johar Town, Lahore", "Permanent Address:", "Village Kot Abdul Malik, Sheikhupura", "", `Identity Number: ${ctx.cnicFormatted}`],
      accent: "Holder's signature · NADRA · Specimen",
    }),
  driving_license: () =>
    card({
      title: "DRIVING LICENCE",
      subtitle: "PUNJAB · DLIMS",
      stripe: "#1d4ed8",
      bg: "#eef2fb",
      fields: [`Name: ${ctx.fullName}`, `CNIC: ${ctx.cnicFormatted}`, `Licence No: ${ctx.licenseNumber}`, "Category: LTV · MCycle", "Issue: 2023-05-10    Valid Till: 2028-05-09", "Issuing Authority: DLA Lahore"],
      accent: "Punjab Police · Specimen generated for testing",
    }),
  route_permit: () =>
    card({
      title: "ROUTE PERMIT",
      subtitle: "REGIONAL TRANSPORT AUTHORITY LAHORE",
      stripe: "#92400e",
      bg: "#fdf6e9",
      photo: false,
      fields: [`Permit No: RTA-LHR-${ctx.stamp}`, `Vehicle Registration: ${ctx.plate}`, `Owner: ${ctx.fullName}`, "Route: Lahore District (all routes)", "Validity: 2026-01-01 to 2026-12-31", "Fitness Certificate: Valid"],
      accent: "Secretary RTA · Specimen generated for testing",
    }),
  vehicle_registration: () =>
    card({
      title: "CERTIFICATE OF REGISTRATION",
      subtitle: "EXCISE & TAXATION PUNJAB",
      stripe: "#7c2d12",
      bg: "#fbf1ea",
      photo: false,
      fields: [`Registration No: ${ctx.plate}`, "Make / Model: Suzuki Cultus", `Year: ${ctx.year}    Colour: ${ctx.color}`, "Engine No: K10B-7781234    Chassis: PK1ZC72S00123456", `Owner: ${ctx.fullName}`, `CNIC: ${ctx.cnicFormatted}`],
      accent: "MRA Lahore · Specimen generated for testing",
    }),
  vehicle_photo: () =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
      <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9fc5e8"/><stop offset="1" stop-color="#dbe9f4"/></linearGradient></defs>
      <rect width="${W}" height="${H}" fill="url(#sky)"/>
      <rect y="400" width="${W}" height="240" fill="#5b5f66"/>
      <rect y="400" width="${W}" height="14" fill="#9aa0a6"/>
      ${Array.from({ length: 8 }, (_, i) => `<rect x="${i * 140 + 20}" y="560" width="80" height="10" fill="#f1f5f9"/>`).join("")}
      <g transform="translate(160 150)">
        <path d="M60 230 q0 -40 40 -40 h80 l70 -110 h260 l70 110 h80 q40 0 40 40 v70 h-640z" fill="#${ctx.color === "Silver" ? "c0c6cc" : "f1f5f9"}" stroke="#334155" stroke-width="4"/>
        <path d="M190 190 l60 -95 h110 v95z" fill="#1e293b" opacity="0.85"/>
        <path d="M370 95 h100 l60 95 h-160z" fill="#1e293b" opacity="0.85"/>
        <circle cx="170" cy="300" r="52" fill="#111827"/><circle cx="170" cy="300" r="26" fill="#9ca3af"/>
        <circle cx="560" cy="300" r="52" fill="#111827"/><circle cx="560" cy="300" r="26" fill="#9ca3af"/>
        <rect x="700" y="210" width="36" height="30" rx="6" fill="#fde68a"/>
        <rect x="620" y="235" width="110" height="26" rx="4" fill="#e5e7eb"/>
        <rect x="280" y="236" width="150" height="40" rx="5" fill="#ffffff" stroke="#111827" stroke-width="3"/>
        <text x="355" y="266" text-anchor="middle" font-family="DejaVu Sans Mono, monospace" font-size="26" font-weight="bold" fill="#111827">${esc(ctx.plate)}</text>
      </g>
      <text x="24" y="${H - 20}" font-family="${FONT}" font-size="14" fill="#334155">Suzuki Cultus · ${esc(ctx.plate)} · specimen photo</text>
    </svg>`,
  receipt: () =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1280">
      <rect width="720" height="1280" fill="#0f172a"/>
      <rect x="0" y="0" width="720" height="90" fill="#b91c1c"/>
      <text x="36" y="58" font-family="${FONT}" font-size="30" font-weight="bold" fill="#ffffff">JazzCash</text>
      <text x="684" y="58" text-anchor="end" font-family="${FONT}" font-size="20" fill="#fee2e2">Transaction Receipt</text>
      <rect x="40" y="130" width="640" height="980" rx="28" fill="#ffffff"/>
      <circle cx="360" cy="250" r="54" fill="#16a34a"/>
      <path d="M330 250 l22 22 l40 -48" stroke="#ffffff" stroke-width="12" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <text x="360" y="350" text-anchor="middle" font-family="${FONT}" font-size="30" font-weight="bold" fill="#111827">Payment Successful</text>
      <text x="360" y="420" text-anchor="middle" font-family="${FONT}" font-size="56" font-weight="bold" fill="#111827">Rs 1,000.00</text>
      ${textLines(90, 520, ["To:              Raahi Technologies", "Account:         0300-0000000", `From:            ${ctx.fullName}`, `Mobile:          ${ctx.phonePretty}`, `Transaction ID:  ${ctx.txRef}`, `Date:            ${ctx.date}`, "Fee:             Rs 0.00", "Purpose:         Raahi monthly subscription"], 22, "#1f2937", 52)}
      <line x1="90" y1="960" x2="630" y2="960" stroke="#e5e7eb" stroke-width="2" stroke-dasharray="8 8"/>
      <text x="360" y="1010" text-anchor="middle" font-family="${FONT}" font-size="18" fill="#6b7280">Keep this receipt for your records · specimen</text>
      <text x="360" y="1210" text-anchor="middle" font-family="${FONT}" font-size="16" fill="#94a3b8">Generated for end-to-end testing</text>
    </svg>`,
});

/** Render every fixture image for this run into `dir`; returns { [name]: absolutePath }. */
export async function renderFixtures(dir, ctx) {
  await mkdir(dir, { recursive: true });
  const out = {};
  for (const [name, make] of Object.entries(DOCS(ctx))) {
    const file = path.join(dir, `${name}.png`);
    await sharp(Buffer.from(make())).png({ compressionLevel: 6 }).toFile(file);
    out[name] = file;
  }
  // The receipt is a phone screenshot: also provide it as JPEG to mimic a gallery pick.
  const jpg = path.join(dir, "receipt.jpg");
  await sharp(out.receipt).jpeg({ quality: 88 }).toFile(jpg);
  out.receiptJpg = jpg;
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const files = await renderFixtures(path.resolve("fixtures"), {
    fullName: "Bilal Ahmed Khan",
    cnicFormatted: "35202-1234567-1",
    licenseNumber: "LHR-2024-556677",
    plate: "LEB 4521",
    year: "2019",
    color: "Silver",
    stamp: "778812",
    phonePretty: "+92 300 1234567",
    txRef: "TX778812345",
    date: new Date().toISOString().slice(0, 10),
  });
  console.log(files);
  await writeFile(path.resolve("fixtures/.gitignore"), "*\n");
}
