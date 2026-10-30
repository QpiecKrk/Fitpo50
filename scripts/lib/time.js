'use strict';

const WARSAW_TIME_ZONE = 'Europe/Warsaw';
const ISO_DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 24 * 60 * 60 * 1000;

function warsawIso(input = new Date()) {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) throw new Error(`Nieprawidłowa data raportu: ${input}`);
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: WARSAW_TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false, timeZoneName: 'longOffset',
  }).formatToParts(date).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  const offset = String(parts.timeZoneName || 'GMT+01:00').replace(/^GMT/, '');
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${offset}`;
}

function warsawDay(input = new Date()) {
  return warsawIso(input).slice(0, 10);
}

function calendarDay(input = new Date()) {
  if (typeof input === 'string') {
    const value = input.trim();
    const match = value.match(ISO_DAY_RE);
    if (match) {
      const [, year, month, day] = match;
      const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12));
      if (
        date.getUTCFullYear() !== Number(year)
        || date.getUTCMonth() !== Number(month) - 1
        || date.getUTCDate() !== Number(day)
      ) throw new Error(`Nieprawidłowy dzień kalendarzowy: ${input}`);
      return value;
    }
  }
  return warsawDay(input);
}

function dayNumber(input) {
  const [year, month, day] = calendarDay(input).split('-').map(Number);
  return Date.UTC(year, month - 1, day) / DAY_MS;
}

function shiftWarsawDay(input, days) {
  if (!Number.isInteger(days)) throw new Error(`Przesunięcie dnia musi być liczbą całkowitą: ${days}`);
  const [year, month, day] = calendarDay(input).split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days, 12));
  return shifted.toISOString().slice(0, 10);
}

function warsawDayDifference(start, end) {
  return dayNumber(end) - dayNumber(start);
}

function warsawCompletedRange(days, now = new Date(), periodsBack = 0) {
  if (!Number.isInteger(days) || days < 1) throw new Error(`Zakres dni musi być dodatnią liczbą całkowitą: ${days}`);
  if (!Number.isInteger(periodsBack) || periodsBack < 0) throw new Error(`Numer wcześniejszego zakresu jest nieprawidłowy: ${periodsBack}`);
  const today = calendarDay(now);
  const end = shiftWarsawDay(today, -1 - periodsBack * days);
  return { start: shiftWarsawDay(end, 1 - days), end };
}

module.exports = {
  WARSAW_TIME_ZONE,
  shiftWarsawDay,
  warsawCompletedRange,
  warsawDay,
  warsawDayDifference,
  warsawIso,
};
