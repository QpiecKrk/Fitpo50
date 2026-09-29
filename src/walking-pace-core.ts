export type DistanceUnit = 'km' | 'm';
export type TalkTest = 'not-checked' | 'easy' | 'moderate' | 'vigorous';

export interface WalkingPaceResult {
  distanceKm: number;
  durationSeconds: number;
  paceSecondsPerKm: number;
  speedKmh: number;
  oneKmSeconds: number;
  threeKmSeconds: number;
  fiveKmSeconds: number;
}

export interface TalkTestDescription {
  label: string;
  explanation: string;
}

function twoDigits(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

export function convertDistanceToKm(value: number, unit: DistanceUnit): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError('Distance must be greater than zero.');
  }
  return unit === 'm' ? value / 1000 : value;
}

export function durationToSeconds(hours: number, minutes: number, seconds: number): number {
  const values = [hours, minutes, seconds];
  if (values.some((value) => !Number.isInteger(value) || value < 0)) {
    throw new RangeError('Duration parts must be non-negative integers.');
  }
  if (minutes > 59 || seconds > 59) {
    throw new RangeError('Minutes and seconds must be between 0 and 59.');
  }
  return (hours * 3600) + (minutes * 60) + seconds;
}

export function calculateWalkingPace(distanceKm: number, durationSeconds: number): WalkingPaceResult {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) {
    throw new RangeError('Distance must be greater than zero.');
  }
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new RangeError('Duration must be greater than zero.');
  }

  const paceSecondsPerKm = durationSeconds / distanceKm;
  const speedKmh = distanceKm / (durationSeconds / 3600);

  return {
    distanceKm,
    durationSeconds,
    paceSecondsPerKm,
    speedKmh,
    oneKmSeconds: paceSecondsPerKm,
    threeKmSeconds: paceSecondsPerKm * 3,
    fiveKmSeconds: paceSecondsPerKm * 5
  };
}

export function formatPace(secondsPerKm: number): string {
  if (!Number.isFinite(secondsPerKm) || secondsPerKm < 0) return '—';
  const rounded = Math.round(secondsPerKm);
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  return `${minutes}:${twoDigits(seconds)}`;
}

export function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '—';
  const rounded = Math.round(totalSeconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const seconds = rounded % 60;
  if (hours > 0) {
    return `${hours}:${twoDigits(minutes)}:${twoDigits(seconds)}`;
  }
  return `${minutes}:${twoDigits(seconds)}`;
}

export function describeTalkTest(value: TalkTest): TalkTestDescription {
  const descriptions: Record<TalkTest, TalkTestDescription> = {
    'not-checked': {
      label: 'Intensywność nieoceniona',
      explanation: 'Sama prędkość nie mówi, jak mocno pracował Twój organizm. Przy następnym marszu sprawdź, czy możesz mówić lub śpiewać.'
    },
    easy: {
      label: 'Lekka intensywność względna',
      explanation: 'Swobodna rozmowa i możliwość śpiewania zwykle oznaczają lekki wysiłek względem Twojej aktualnej kondycji.'
    },
    moderate: {
      label: 'Umiarkowana intensywność względna',
      explanation: 'Możesz mówić, ale nie śpiewać. CDC opisuje tak prosty test umiarkowanej intensywności.'
    },
    vigorous: {
      label: 'Wysoka intensywność względna',
      explanation: 'Tylko kilka słów bez przerwy na oddech wskazuje na wysoki wysiłek. Zwolnij, jeśli taka intensywność nie była zamierzona.'
    }
  };
  return descriptions[value];
}

export function paceChangeSeconds(current: number, previous: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return 0;
  return current - previous;
}
