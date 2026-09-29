export type BloodPressurePeriod = 'morning' | 'evening';

export interface BloodPressureReading {
  day: number;
  period: BloodPressurePeriod;
  sequence: number;
  systolic: number;
  diastolic: number;
  pulse: number | null;
}

export interface BloodPressureSummary {
  pressure: string;
  morning: string;
  evening: string;
  pulse: number | null;
  count: number;
}

export function validateReading(systolic: number | null, diastolic: number | null, pulse: number | null): string | null {
  if (systolic === null && diastolic === null && pulse === null) return null;
  if (systolic === null || diastolic === null) return 'Wpisz obie wartości ciśnienia.';
  if (systolic < 50 || systolic > 280 || diastolic < 30 || diastolic > 180) return 'Sprawdź wpisane wartości.';
  if (systolic <= diastolic) return 'Ciśnienie skurczowe powinno być wyższe od rozkurczowego.';
  if (pulse !== null && (pulse < 25 || pulse > 250)) return 'Sprawdź wpisany puls.';
  return null;
}

export function roundedAverage(values: number[]): number | null {
  if (!values.length) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function pressureAverage(readings: BloodPressureReading[]): string {
  const systolic = roundedAverage(readings.map((reading) => reading.systolic));
  const diastolic = roundedAverage(readings.map((reading) => reading.diastolic));
  return systolic === null || diastolic === null ? '-/-' : `${systolic}/${diastolic}`;
}

export function summarizeReadings(readings: BloodPressureReading[]): BloodPressureSummary {
  const assessment = readings.filter((reading) => reading.day >= 2);
  const morning = assessment.filter((reading) => reading.period === 'morning');
  const evening = assessment.filter((reading) => reading.period === 'evening');
  const pulseValues: number[] = [];
  assessment.forEach((reading) => {
    if (reading.pulse !== null) pulseValues.push(reading.pulse);
  });
  return {
    pressure: pressureAverage(assessment),
    morning: pressureAverage(morning),
    evening: pressureAverage(evening),
    pulse: roundedAverage(pulseValues),
    count: assessment.length
  };
}

export function hasSevereReading(readings: BloodPressureReading[]): boolean {
  return readings.some((reading) => reading.systolic > 180 || reading.diastolic > 120);
}
