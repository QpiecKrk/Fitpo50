export interface PhenoAgeValues {
  age: number;
  albumin: number;
  creatinine: number;
  glucose: number;
  crp: number;
  lymphocyte: number;
  mcv: number;
  rdw: number;
  alp: number;
  wbc: number;
}

export interface PhenoAgeUnits {
  albuminUnit: 'gL' | 'gdL';
  creatinineUnit: 'umolL' | 'mgdL';
  glucoseUnit: 'mmolL' | 'mgdL';
  crpUnit: 'mgL' | 'mgdL';
}

export function canonicalizePhenoAgeValues(
  values: PhenoAgeValues,
  units: PhenoAgeUnits
): PhenoAgeValues {
  return {
    ...values,
    albumin: units.albuminUnit === 'gdL' ? values.albumin * 10 : values.albumin,
    creatinine: units.creatinineUnit === 'mgdL' ? values.creatinine * 88.4 : values.creatinine,
    glucose: units.glucoseUnit === 'mgdL' ? values.glucose / 18 : values.glucose,
    crp: units.crpUnit === 'mgL' ? values.crp / 10 : values.crp
  };
}

export function calculatePhenoAge(values: PhenoAgeValues): number {
  const inputs: number[] = [
    values.age,
    values.albumin,
    values.creatinine,
    values.glucose,
    values.crp,
    values.lymphocyte,
    values.mcv,
    values.rdw,
    values.alp,
    values.wbc
  ];
  if (inputs.some((value) => !Number.isFinite(value)) || values.crp <= 0) {
    return Number.NaN;
  }

  const linearPredictor = -19.90667
    - 0.03359355 * values.albumin
    + 0.009506491 * values.creatinine
    + 0.1953192 * values.glucose
    + 0.09536762 * Math.log(values.crp)
    - 0.01199984 * values.lymphocyte
    + 0.02676401 * values.mcv
    + 0.3306156 * values.rdw
    + 0.001868778 * values.alp
    + 0.05542406 * values.wbc
    + 0.08035356 * values.age;

  const tenYearMortality = 1 - Math.exp((-1.51714 * Math.exp(linearPredictor)) / 0.007692696);
  return Math.log(-0.0055305 * Math.log(1 - tenYearMortality)) / 0.090165 + 141.50225;
}

export function describeAgeDifference(difference: number): 'poniżej wieku metrykalnego' | 'powyżej wieku metrykalnego' | 'zbliżony do wieku metrykalnego' {
  if (difference < -0.05) return 'poniżej wieku metrykalnego';
  if (difference > 0.05) return 'powyżej wieku metrykalnego';
  return 'zbliżony do wieku metrykalnego';
}
