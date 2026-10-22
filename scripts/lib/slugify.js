'use strict';

function foldPolish(value) {
  return String(value || '')
    .replace(/[łŁ]/g, (character) => (character === 'Ł' ? 'L' : 'l'))
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function slugify(value) {
  return foldPolish(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

module.exports = { foldPolish, slugify };
