export function maskEmail(email: string): string {
  const [u, d] = String(email).split('@');
  if (!d) return '••••';
  const head = u.slice(0, Math.min(2, u.length));
  return `${head}${'•'.repeat(Math.max(2, u.length - 2))}@${d}`;
}

export function maskPhone(phone: string): string {
  const s = String(phone).replace(/\D/g, '');
  if (s.length < 4) return '••••';
  return '•'.repeat(s.length - 4) + s.slice(-4);
}
