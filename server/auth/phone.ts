/** Indian mobile numbers only (10 digits starting 6–9), normalised to E.164 (+91…). */
export function normalizeIndianMobile(input: string): string | null {
  const digits = input.replace(/[\s\-().]/g, '');
  const match = /^(?:\+?91|0)?([6-9]\d{9})$/.exec(digits);
  return match ? `+91${match[1]}` : null;
}

/** "+919876543210" -> "+91 98•••••210" */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '—';
  const local = phone.replace(/^\+91/, '');
  if (local.length !== 10) return '•••';
  return `+91 ${local.slice(0, 2)}•••••${local.slice(7)}`;
}
