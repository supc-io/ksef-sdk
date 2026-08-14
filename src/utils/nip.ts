const NIP_WEIGHTS = [6, 5, 7, 2, 3, 4, 5, 6, 7];

export function validateNip(nip: string): boolean {
  const cleaned = nip.replace(/[\s-]/g, '');

  if (!/^\d{10}$/.test(cleaned)) {
    return false;
  }

  const digits = cleaned.split('').map(Number);
  const checksum = NIP_WEIGHTS.reduce((sum, weight, i) => sum + weight * digits[i], 0);

  return checksum % 11 === digits[9];
}

export function normalizeNip(nip: string): string {
  return nip.replace(/[\s-]/g, '');
}
