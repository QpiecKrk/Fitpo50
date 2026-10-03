'use strict';

const VERIFIED_ENTITY_SAME_AS = Object.freeze([
  Object.freeze({
    name: 'Cholesterol',
    sameAs: 'https://www.wikidata.org/wiki/Q43656',
    expected_label: 'cholesterol',
    verified_at: '2026-10-03',
    verification_source: 'Wikidata wbgetentities API',
  }),
]);

function normalize(value) {
  return String(value || '').trim();
}

function findVerifiedEntity(name, sameAs) {
  const expectedName = normalize(name);
  const expectedUrl = normalize(sameAs);
  return VERIFIED_ENTITY_SAME_AS.find((entry) => entry.name === expectedName && entry.sameAs === expectedUrl) || null;
}

function validateEntitySameAs(name, sameAs) {
  const normalizedName = normalize(name);
  const normalizedUrl = normalize(sameAs);
  if (!normalizedUrl) return { ok: true, entry: null, error: '' };
  if (!normalizedName) {
    return { ok: false, entry: null, error: 'Encja z sameAs musi mieć jednoznaczną nazwę.' };
  }
  const entry = findVerifiedEntity(normalizedName, normalizedUrl);
  if (!entry) {
    return {
      ok: false,
      entry: null,
      error: `Niezarejestrowana albo niezgodna para encji: "${normalizedName}" → ${normalizedUrl}.`,
    };
  }
  return { ok: true, entry, error: '' };
}

function validateAboutEntities(about) {
  const errors = [];
  const entities = Array.isArray(about) ? about : about ? [about] : [];
  for (const entity of entities) {
    if (!entity || typeof entity !== 'object') continue;
    const result = validateEntitySameAs(entity.name, entity.sameAs);
    if (!result.ok) errors.push(result.error);
  }
  return errors;
}

module.exports = {
  VERIFIED_ENTITY_SAME_AS,
  findVerifiedEntity,
  validateAboutEntities,
  validateEntitySameAs,
};
