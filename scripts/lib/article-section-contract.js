'use strict';

const SECTION_ROLES = new Set(['main', 'utility']);

function normalizeSectionRole(value) {
  return String(value || 'main').trim().toLowerCase() === 'utility' ? 'utility' : 'main';
}

function validateSectionSchema(sections) {
  const errors = [];
  (Array.isArray(sections) ? sections : []).forEach((section, index) => {
    const role = String(section?.section_role || 'main').trim().toLowerCase();
    if (!SECTION_ROLES.has(role)) errors.push(`sections[${index}].section_role musi mieć wartość main albo utility.`);
    if (!String(section?.title || section?.heading || '').trim()) errors.push(`sections[${index}].title jest wymagane.`);
    if (!Array.isArray(section?.paragraphs_html) || section.paragraphs_html.length === 0) errors.push(`sections[${index}].paragraphs_html musi być niepustą listą.`);
  });
  return { ok: errors.length === 0, errors };
}

function requiresMainSectionContracts(section) {
  return normalizeSectionRole(section?.section_role ?? section?.sectionRole) === 'main';
}

module.exports = { SECTION_ROLES, normalizeSectionRole, requiresMainSectionContracts, validateSectionSchema };
