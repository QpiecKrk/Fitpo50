export type StrengthEquipment = 'barbell' | 'dumbbells' | 'machine' | 'other';
export type SetEffort = 'near-limit' | 'not-near';

export interface RelativeStrengthResult {
  estimatedOneRepMaxKg: number;
  relativeStrength: number;
  bodyweightPercent: number;
  workingLoadPercent: number;
}

export interface EstimateQuality {
  label: string;
  explanation: string;
}

export function calculateEstimatedOneRepMax(loadKg: number, repetitions: number): number {
  if (!Number.isFinite(loadKg) || loadKg <= 0) {
    throw new RangeError('Load must be greater than zero.');
  }
  if (!Number.isInteger(repetitions) || repetitions < 2 || repetitions > 10) {
    throw new RangeError('Repetitions must be an integer from 2 to 10.');
  }
  return loadKg * (1 + (repetitions / 30));
}

export function calculateRelativeStrength(bodyWeightKg: number, loadKg: number, repetitions: number): RelativeStrengthResult {
  if (!Number.isFinite(bodyWeightKg) || bodyWeightKg <= 0) {
    throw new RangeError('Body weight must be greater than zero.');
  }
  const estimatedOneRepMaxKg = calculateEstimatedOneRepMax(loadKg, repetitions);
  return {
    estimatedOneRepMaxKg,
    relativeStrength: estimatedOneRepMaxKg / bodyWeightKg,
    bodyweightPercent: (estimatedOneRepMaxKg / bodyWeightKg) * 100,
    workingLoadPercent: (loadKg / estimatedOneRepMaxKg) * 100
  };
}

export function describeEstimateQuality(effort: SetEffort, equipment: StrengthEquipment): EstimateQuality {
  if (equipment === 'machine') {
    return {
      label: effort === 'near-limit' ? 'Dobry do śledzenia tej maszyny' : 'Bardzo orientacyjny',
      explanation: effort === 'near-limit'
        ? 'Stosy i przełożenia różnią się między maszynami. Porównuj wynik tylko na tym samym urządzeniu i przy tym samym ustawieniu.'
        : 'Seria nie była blisko końca, a wartości na maszynach nie są porównywalne między urządzeniami. Traktuj wynik wyłącznie jako punkt startowy.'
    };
  }
  if (effort === 'not-near') {
    return {
      label: 'Bardzo orientacyjny',
      explanation: 'Jeśli zostały co najmniej trzy możliwe powtórzenia albo nie wiesz, wynik może zaniżać aktualną siłę.'
    };
  }
  return {
    label: 'Użyteczny do własnego trendu',
    explanation: 'Krótka seria wykonana blisko końca daje praktyczny punkt odniesienia. To nadal szacunek, a nie zmierzone maksimum.'
  };
}

export function strengthChangePercent(current: number, previous: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous <= 0) return 0;
  return ((current - previous) / previous) * 100;
}
