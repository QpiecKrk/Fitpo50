export type LabRangeStatus = 'below' | 'within' | 'above';
export type EquationSex = 'female' | 'male';

export interface LabRange {
  lower: number | null;
  upper: number | null;
}

export function validateLabRange(range: LabRange): string | null {
  if (range.lower === null && range.upper === null) {
    return 'Przepisz co najmniej jedną granicę zakresu z wyniku laboratoryjnego.';
  }

  if (range.lower !== null && (!Number.isFinite(range.lower) || range.lower < 0)) {
    return 'Dolna granica musi być liczbą równą lub większą od zera.';
  }

  if (range.upper !== null && (!Number.isFinite(range.upper) || range.upper < 0)) {
    return 'Górna granica musi być liczbą równą lub większą od zera.';
  }

  if (range.lower !== null && range.upper !== null && range.lower >= range.upper) {
    return 'Górna granica musi być większa od dolnej.';
  }

  return null;
}

export function compareWithLabRange(value: number, range: LabRange): LabRangeStatus {
  if (range.lower !== null && value < range.lower) return 'below';
  if (range.upper !== null && value > range.upper) return 'above';
  return 'within';
}

export function creatinineToMgDl(value: number, unit: 'umolL' | 'mgdL'): number {
  return unit === 'umolL' ? value / 88.4 : value;
}

export function calculateEgfr2021(creatinineMgDl: number, age: number, sex: EquationSex): number {
  if (!Number.isFinite(creatinineMgDl) || creatinineMgDl <= 0 || !Number.isFinite(age) || age < 18) {
    return Number.NaN;
  }

  const kappa = sex === 'female' ? 0.7 : 0.9;
  const alpha = sex === 'female' ? -0.241 : -0.302;
  const sexFactor = sex === 'female' ? 1.012 : 1;
  const ratio = creatinineMgDl / kappa;

  return 142
    * Math.pow(Math.min(ratio, 1), alpha)
    * Math.pow(Math.max(ratio, 1), -1.2)
    * Math.pow(0.9938, age)
    * sexFactor;
}
