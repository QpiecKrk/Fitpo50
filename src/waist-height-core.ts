export type WaistHeightLevel = 'below-range' | 'healthy' | 'increased' | 'high';

export interface WaistHeightResult {
  ratio: number;
  halfHeightCm: number;
  differenceFromHalfCm: number;
  level: WaistHeightLevel;
}

export function classifyWaistHeightRatio(ratio: number): WaistHeightLevel {
  if (ratio < 0.4) return 'below-range';
  if (ratio < 0.5) return 'healthy';
  if (ratio < 0.6) return 'increased';
  return 'high';
}

export function calculateWaistHeight(heightCm: number, waistCm: number): WaistHeightResult {
  const ratio = Math.round((waistCm / heightCm) * 100) / 100;
  const halfHeightCm = heightCm / 2;

  return {
    ratio,
    halfHeightCm,
    differenceFromHalfCm: waistCm - halfHeightCm,
    level: classifyWaistHeightRatio(ratio)
  };
}

export function calculateBmi(heightCm: number, weightKg: number): number {
  const heightM = heightCm / 100;
  return weightKg / (heightM * heightM);
}
