/** Phone helpers. Identity always comes from Clerk's verified phone (E.164). */

/** Indian mobile numbers (10 digits starting 6–9) normalised to E.164 (+91…). */
export function normalizeIndianMobile(input: string): string | null {
  const digits = input.replace(/[\s\-().]/g, '');
  const match = /^(?:\+?91|0)?([6-9]\d{9})$/.exec(digits);
  return match ? `+91${match[1]}` : null;
}

/**
 * Normalises an admin-entered phone for invitations. Accepts Indian mobiles, and any full
 * E.164 number (needed for Clerk development test numbers such as +1 555 555 0100).
 */
export function normalizePhoneE164(input: string): string | null {
  const indian = normalizeIndianMobile(input);
  if (indian) return indian;
  const compact = input.replace(/[\s\-().]/g, '');
  return /^\+[1-9]\d{7,14}$/.test(compact) ? compact : null;
}

/** "+919876543210" -> "+91 98•••••210"; other E.164 numbers keep country code and last 3 digits. */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '—';
  if (/^\+91\d{10}$/.test(phone)) {
    const local = phone.slice(3);
    return `+91 ${local.slice(0, 2)}•••••${local.slice(7)}`;
  }
  return phone.length > 6 ? `${phone.slice(0, 3)} •••••${phone.slice(-3)}` : '•••';
}
