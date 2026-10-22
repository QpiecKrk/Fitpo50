'use strict';

const { stripAnchorTags } = require('./article-normalization');

const PROTECTED_ROOTS = new Set(['sources', 'evidence_claims', 'answer_blocks', 'faq_research']);
const STAGE_ROOTS = Object.freeze({
  ARCHITECTURE: new Set(['internal_link_plan', 'incoming_link_suggestions', 'intent_audit', 'topic_center_assessment']),
  EVIDENCE: new Set(['evidence_verification']),
  MEDIA: new Set(['media_manifest', 'hero_image', 'hero_image_base', 'hero_alt', 'hero_width', 'hero_height']),
});

function collectModifiedKeys(before, after, path = '', result = []) {
  if (JSON.stringify(before) === JSON.stringify(after)) return result;
  const beforeObject = before && typeof before === 'object';
  const afterObject = after && typeof after === 'object';
  if (beforeObject && afterObject && Array.isArray(before) === Array.isArray(after)) {
    const keys = Array.isArray(before)
      ? Array.from({ length: Math.max(before.length, after.length) }, (_, index) => index)
      : [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
    keys.forEach((key) => collectModifiedKeys(before[key], after[key], `${path}/${String(key).replace(/~/g, '~0').replace(/\//g, '~1')}`, result));
    return result;
  }
  result.push(path || '/');
  return result;
}

function getAtPointer(value, pointer) {
  if (pointer === '/') return value;
  return pointer.split('/').slice(1).reduce((current, token) => current?.[token.replace(/~1/g, '/').replace(/~0/g, '~')], value);
}

function isLinkOnlyParagraphChange(pointer, before, after) {
  if (!/^\/sections\/\d+\/paragraphs_html\/\d+$/.test(pointer)) return false;
  const oldValue = getAtPointer(before, pointer);
  const newValue = getAtPointer(after, pointer);
  return typeof oldValue === 'string' && typeof newValue === 'string' && stripAnchorTags(oldValue) === stripAnchorTags(newValue);
}

function pathRoot(pointer) {
  return String(pointer || '').split('/')[1] || '';
}

function isLocalMediaPath(pointer) {
  return /^\/sections\/\d+\/(?:image|images)(?:\/|$)/.test(pointer) || /^\/image_prompts(?:_v4)?\/\d+\/visual_review(?:\/|$)/.test(pointer);
}

function validateScope(before, after, options = {}) {
  const stage = String(options.stage || 'UNKNOWN');
  const modifiedKeys = collectModifiedKeys(before, after);
  const unauthorized = modifiedKeys.filter((pointer) => {
    const root = pathRoot(pointer);
    if (PROTECTED_ROOTS.has(root)) return true;
    if (isLinkOnlyParagraphChange(pointer, before, after)) return stage !== 'ARCHITECTURE';
    if (STAGE_ROOTS[stage]?.has(root)) return false;
    if (isLocalMediaPath(pointer)) return stage !== 'MEDIA';
    return true;
  });
  return { ok: unauthorized.length === 0, stage, modified_keys: modifiedKeys, unauthorized_keys: unauthorized };
}

module.exports = { collectModifiedKeys, isLinkOnlyParagraphChange, validateScope };
