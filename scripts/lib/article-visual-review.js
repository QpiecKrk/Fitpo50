'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const CONTRACT_PATH = path.join(__dirname, '..', 'contracts', 'article-visual-review-v3.json');
const CONTRACT = JSON.parse(fs.readFileSync(CONTRACT_PATH, 'utf8'));

function sha256Text(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
}

function stableHash(value) {
  return sha256Text(JSON.stringify(stableValue(value)));
}

function isIsoTimestamp(value) {
  const parsed = Date.parse(String(value || ''));
  return /^\d{4}-\d{2}-\d{2}T/.test(String(value || '')) && Number.isFinite(parsed);
}

function reviewArtifactHash(item) {
  return String(item?.artifact_sha256 || item?.screenshot_sha256 || item?.sha256 || '');
}

function reviewEnvelope(report) {
  return {
    version: report?.version,
    slug: report?.slug,
    reviewed_by: report?.visual_review?.reviewed_by,
    reviewed_at: report?.visual_review?.reviewed_at,
    review_method: report?.visual_review?.review_method,
    views: report?.visual_review?.views,
    images: report?.visual_review?.images,
    pdf_pages: report?.visual_review?.pdf_pages,
  };
}

function technicalEvidenceIsClean(report) {
  const technicalErrors = report?.technical_review?.errors;
  const reportErrors = report?.errors;
  const artifacts = report?.artifacts || {};
  return Boolean(report?.technical_review?.status === CONTRACT.technical_status
    && Array.isArray(technicalErrors) && technicalErrors.length === 0
    && Array.isArray(reportErrors) && reportErrors.length === 0
    && artifacts.html_source?.sha256
    && artifacts.html_source.sha256 === artifacts.html_site?.sha256
    && artifacts.pdf_source?.sha256
    && artifacts.pdf_source.sha256 === artifacts.pdf_site?.sha256);
}

function withImageReviewProvenance(image, review) {
  const enriched = { ...image };
  for (const field of CONTRACT.image_review_provenance_fields || []) {
    if (!enriched[field]) enriched[field] = String(review?.[field] || '');
  }
  return enriched;
}

function imageInventoryHash(image) {
  return stableHash({
    placement: image?.placement || '',
    role: image?.role || '',
    heading: image?.heading || '',
    context: image?.context || '',
    alt: image?.alt || '',
    caption: image?.caption || '',
    variants: Object.fromEntries(CONTRACT.required_variants.map((extension) => [extension, {
      file: image?.variants?.[extension]?.file || '',
      sha256: image?.variants?.[extension]?.sha256 || '',
    }])),
  });
}

function reusableImageReviews(previousReport) {
  if (!previousReport || previousReport.version !== CONTRACT.version || previousReport.status !== CONTRACT.ready_status) return new Map();
  const previousReview = reviewEnvelope(previousReport);
  if (!technicalEvidenceIsClean(previousReport) || !validateVisualReview(previousReport, previousReview).ok) return new Map();
  const reuseKey = CONTRACT.image_review_reuse_key;
  return new Map((previousReview.images || []).map((image) => [image[reuseKey], {
    ...withImageReviewProvenance(image, previousReview),
    reused_from_report_generated_at: previousReport.generated_at,
  }]));
}

function createReviewTemplate(report, previousReport = null) {
  const reusable = reusableImageReviews(previousReport);
  return {
    version: CONTRACT.version,
    slug: report.slug,
    reviewed_by: '',
    reviewed_at: '',
    review_method: '',
    views: {
      desktop: {
        status: 'PENDING',
        artifact_sha256: report.views?.desktop?.screenshot_sha256 || '',
        note: '',
      },
      mobile: {
        status: 'PENDING',
        artifact_sha256: report.views?.mobile?.screenshot_sha256 || '',
        note: '',
      },
    },
    images: (report.images || []).map((image) => {
      const inventorySha256 = image.inventory_sha256 || imageInventoryHash(image);
      const previous = reusable.get(inventorySha256);
      return previous ? { ...previous, placement: image.placement, inventory_sha256: inventorySha256 } : {
        placement: image.placement,
        inventory_sha256: inventorySha256,
        status: 'PENDING',
        matches_topic: false,
        no_misleading_text_or_logo: false,
        anatomy_and_equipment_plausible: false,
        embedded_text: { kind: 'NONE' },
        note: '',
      };
    }),
    pdf_pages: (report.pdf?.page_reviews || []).map((page) => ({
      page: page.page,
      status: 'PENDING',
      artifact_sha256: page.sha256 || '',
      note: '',
    })),
  };
}

function validateNote(value, label, errors) {
  if (String(value || '').trim().length < CONTRACT.note_min_length) {
    errors.push(`${label}: notatka z rzeczywistego przeglądu ma mniej niż ${CONTRACT.note_min_length} znaków.`);
  }
}

function validateImageReview(expected, review, label, errors) {
  if (!review || typeof review !== 'object') {
    errors.push(`${label}: brak review.`);
    return;
  }
  if (review.status !== 'VERIFIED') errors.push(`${label}: status musi mieć wartość VERIFIED.`);
  if (review.inventory_sha256 !== expected.inventory_sha256) errors.push(`${label}: inventory zmieniło się po przeglądzie.`);
  if (review.matches_topic !== true) errors.push(`${label}: matches_topic musi być jawnie potwierdzone.`);
  if (review.no_misleading_text_or_logo !== true) errors.push(`${label}: no_misleading_text_or_logo musi być jawnie potwierdzone.`);
  if (review.anatomy_and_equipment_plausible !== true) errors.push(`${label}: anatomy_and_equipment_plausible musi być jawnie potwierdzone.`);
  const embedded = review.embedded_text && typeof review.embedded_text === 'object' ? review.embedded_text : {};
  if (!CONTRACT.embedded_text_kinds.includes(embedded.kind)) {
    errors.push(`${label}: embedded_text.kind musi mieć wartość ${CONTRACT.embedded_text_kinds.join(', ')}.`);
  }
  if (embedded.kind === 'INCIDENTAL_ENVIRONMENT') {
    if (String(embedded.transcription || '').trim().length < 3) errors.push(`${label}: czytelny napis środowiskowy wymaga krótkiej transkrypcji.`);
    if (embedded.claims_or_numbers_present !== false) errors.push(`${label}: napis środowiskowy nie może zawierać twierdzeń, liczb ani instrukcji wymagających dowodu.`);
  }
  if (embedded.kind === 'CONTENT') {
    if (String(embedded.transcription || '').trim().length < 3) errors.push(`${label}: tekst treściowy wymaga transkrypcji.`);
    if (![true, false].includes(embedded.claims_or_numbers_present)) errors.push(`${label}: trzeba jawnie ocenić claims_or_numbers_present.`);
    if (embedded.matches_article_claims !== true) errors.push(`${label}: tekst obrazu musi być zgodny z artykułem.`);
    if (embedded.claims_or_numbers_present === true) {
      const evidence = Array.isArray(embedded.evidence_urls) ? embedded.evidence_urls : [];
      if (!evidence.length || evidence.some((url) => !/^https?:\/\//.test(String(url)))) {
        errors.push(`${label}: liczba albo claim wymaga co najmniej jednego URL-u dowodu.`);
      }
    }
  }
  validateNote(review.note, label, errors);
}

function validateVisualReview(report, review) {
  const errors = [];
  if (!review || typeof review !== 'object') return { ok: false, errors: ['Brak danych rzeczywistego przeglądu wizualnego.'] };
  if (review.version !== CONTRACT.version) errors.push(`Visual review musi mieć version=${CONTRACT.version}.`);
  if (review.slug !== report.slug) errors.push('Slug visual review nie zgadza się z raportem technicznym.');
  if (String(review.reviewed_by || '').trim().length < 3) errors.push('Visual review wymaga reviewed_by.');
  if (String(review.review_method || '').trim().length < 3) errors.push('Visual review wymaga review_method.');
  if (!isIsoTimestamp(review.reviewed_at)) errors.push('Visual review wymaga pełnego reviewed_at w ISO 8601.');
  const generated = Date.parse(String(report.generated_at || ''));
  const reviewed = Date.parse(String(review.reviewed_at || ''));
  if (Number.isFinite(generated) && Number.isFinite(reviewed) && reviewed < generated) errors.push('reviewed_at nie może być wcześniejsze niż generated_at.');

  for (const name of ['desktop', 'mobile']) {
    const expected = report.views?.[name];
    const actual = review.views?.[name];
    if (!actual || actual.status !== 'VERIFIED') errors.push(`${name}: brak jawnego statusu VERIFIED.`);
    if (reviewArtifactHash(actual) !== String(expected?.screenshot_sha256 || '')) errors.push(`${name}: przegląd dotyczy innego renderu.`);
    validateNote(actual?.note, name, errors);
  }

  const expectedImages = new Map((report.images || []).map((image) => [image.placement, image]));
  const actualImages = Array.isArray(review.images) ? review.images : [];
  const actualPlacements = actualImages.map((image) => image?.placement);
  if (new Set(actualPlacements).size !== actualPlacements.length) errors.push('Visual review zawiera powtórzony placement obrazu.');
  if (actualImages.length !== expectedImages.size) errors.push(`Visual review obejmuje ${actualImages.length}/${expectedImages.size} obrazów.`);
  for (const [placement, expected] of expectedImages) {
    validateImageReview(expected, actualImages.find((image) => image?.placement === placement), `Obraz ${placement}`, errors);
  }
  for (const placement of actualPlacements) if (!expectedImages.has(placement)) errors.push(`Visual review zawiera nieznany obraz ${placement || 'UNKNOWN'}.`);

  const expectedPages = new Map((report.pdf?.page_reviews || []).map((page) => [page.page, page]));
  const actualPages = Array.isArray(review.pdf_pages) ? review.pdf_pages : [];
  if (actualPages.length !== expectedPages.size) errors.push(`Visual review obejmuje ${actualPages.length}/${expectedPages.size} stron PDF.`);
  if (new Set(actualPages.map((page) => page?.page)).size !== actualPages.length) errors.push('Visual review zawiera powtórzoną stronę PDF.');
  for (const [pageNumber, expected] of expectedPages) {
    const actual = actualPages.find((page) => page?.page === pageNumber);
    const label = `PDF strona ${pageNumber}`;
    if (!actual || actual.status !== 'VERIFIED') errors.push(`${label}: brak jawnego statusu VERIFIED.`);
    if (reviewArtifactHash(actual) !== String(expected?.sha256 || '')) errors.push(`${label}: przegląd dotyczy innego renderu.`);
    validateNote(actual?.note, label, errors);
  }
  return { ok: errors.length === 0, errors };
}

function applyVisualReview(report, review) {
  const validation = validateVisualReview(report, review);
  const reviewedAt = String(review?.reviewed_at || '');
  const generatedAt = String(report.generated_at || '');
  const waitMs = Math.max(0, Date.parse(reviewedAt) - Date.parse(generatedAt)) || 0;
  return {
    ...report,
    status: validation.ok && technicalEvidenceIsClean(report)
      ? CONTRACT.ready_status
      : CONTRACT.pending_status,
    reviewed_at: validation.ok ? reviewedAt : null,
    visual_review: {
      status: validation.ok ? CONTRACT.verified_status : CONTRACT.pending_status,
      reviewed_by: String(review?.reviewed_by || ''),
      reviewed_at: validation.ok ? reviewedAt : null,
      review_method: String(review?.review_method || ''),
      views: review?.views || {},
      images: (review?.images || []).map((image) => withImageReviewProvenance(image, review)),
      pdf_pages: review?.pdf_pages || [],
      errors: validation.errors,
    },
    timing: {
      ...(report.timing || {}),
      review_wait_ms: waitMs,
    },
  };
}

module.exports = {
  CONTRACT,
  CONTRACT_PATH,
  applyVisualReview,
  createReviewTemplate,
  imageInventoryHash,
  reviewEnvelope,
  stableHash,
  technicalEvidenceIsClean,
  validateVisualReview,
};
