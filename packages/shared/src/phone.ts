/**
 * Pakistani mobile number normalisation.
 * Accepts: 03001234567, 3001234567, +923001234567, 923001234567, 0092 300 1234567
 * Returns E.164 (+923001234567) or null when the input is not a valid PK mobile.
 */
export function normalizePkPhone(raw: string): string | null {
  if (!raw) return null;
  let digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  if (digits.startsWith("0092")) digits = digits.slice(4);
  else if (digits.startsWith("92")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = digits.slice(1);
  // Pakistani mobiles: 3XX XXXXXXX (10 digits after country code)
  if (!/^3\d{9}$/.test(digits)) return null;
  return `+92${digits}`;
}

export function formatPkPhone(e164: string): string {
  const m = /^\+92(3\d{2})(\d{7})$/.exec(e164);
  if (!m) return e164;
  return `0${m[1]} ${m[2]}`;
}

/** Pakistani CNIC: 13 digits, optionally formatted 12345-1234567-1. */
export function normalizeCnic(raw: string): string | null {
  const digits = (raw || "").replace(/\D/g, "");
  if (digits.length !== 13) return null;
  return digits;
}

export function formatCnic(digits: string): string {
  if (!/^\d{13}$/.test(digits)) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
}

/** Pakistani number plates vary by province; we accept letters/digits/space/dash, 3-12 chars. */
export function normalizePlate(raw: string): string | null {
  const s = (raw || "").toUpperCase().replace(/[^A-Z0-9 -]/g, "").replace(/\s+/g, " ").trim();
  if (s.length < 3 || s.length > 12) return null;
  return s;
}
