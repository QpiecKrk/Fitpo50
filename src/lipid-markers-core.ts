export function parseLocalizedNumber(value: string): number {
  const normalized = value.trim().replace(/\s+/g, '').replace(',', '.');
  return normalized === '' ? Number.NaN : Number(normalized);
}

export function validateLipidValues(total: number, hdl: number, unit: 'mgdl' | 'mmoll'): string | null {
  if (!Number.isFinite(total) || !Number.isFinite(hdl)) return 'Wpisz oba wyniki w postaci liczb.';
  if (total <= 0 || hdl <= 0) return 'Oba wyniki muszą być większe od zera.';
  const maximum = unit === 'mgdl' ? 1000 : 30;
  if (total > maximum || hdl > maximum) return 'Sprawdź wartość i wybraną jednostkę.';
  if (hdl > total) return 'HDL-C nie może być wyższe od cholesterolu całkowitego. Sprawdź przepisane wartości.';
  return null;
}

export function calculateNonHdl(total: number, hdl: number): number {
  return Math.round((total - hdl) * 10) / 10;
}
