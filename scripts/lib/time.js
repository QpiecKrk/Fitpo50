'use strict';

const WARSAW_TIME_ZONE = 'Europe/Warsaw';

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

module.exports = { WARSAW_TIME_ZONE, warsawDay, warsawIso };
