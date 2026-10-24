'use strict';

const GSC_FRESHNESS_MAX_AGE_HOURS = 72;
const GSC_FRESHNESS_MAX_AGE_MS = GSC_FRESHNESS_MAX_AGE_HOURS * 60 * 60 * 1000;

function gscAgeHours(timestamp, now = new Date()) {
  const value = timestamp instanceof Date ? timestamp : new Date(timestamp);
  return (now.getTime() - value.getTime()) / 3600000;
}

function isFreshGscTimestamp(timestamp, now = new Date()) {
  const ageHours = gscAgeHours(timestamp, now);
  return Number.isFinite(ageHours) && ageHours >= 0 && ageHours < GSC_FRESHNESS_MAX_AGE_HOURS;
}

module.exports = {
  GSC_FRESHNESS_MAX_AGE_HOURS,
  GSC_FRESHNESS_MAX_AGE_MS,
  gscAgeHours,
  isFreshGscTimestamp,
};
