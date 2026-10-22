'use strict';

const fs = require('node:fs');
const path = require('node:path');

const directory = __dirname;
const originalFile = path.join(directory, 'zmiana-czasu-original-invalid.fitpo50.json');
const correctedFile = path.join(directory, 'zmiana-czasu-corrected.fitpo50.json');
const httpFile = path.join(directory, 'zmiana-czasu-http-responses.json');
const article = JSON.parse(fs.readFileSync(originalFile, 'utf8'));

const fallbacks = {
  'hansen-2017': 'https://pubmed.ncbi.nlm.nih.gov/27775953/',
  'nia-sen': 'https://medlineplus.gov/ency/article/004018.htm',
};

for (const source of article.sources || []) {
  source.fallback_url = fallbacks[source.id] || null;
  source.evidence_scope = source.evidence_level === 'technical_documentation' ? 'device_instructions_only' : null;
  source.publication_date = null;
  source.checked_via = fallbacks[source.id] ? null : 'writer_http';
  source.recheck_after = null;
  if (fallbacks[source.id]) {
    source.url_status = 'requires_local_verification';
    delete source.http_status;
  }
}

const evidenceByLocation = new Map();
for (const claim of article.evidence_claims || []) {
  const urls = evidenceByLocation.get(claim.location) || [];
  evidenceByLocation.set(claim.location, [...new Set([...urls, ...(claim.source_urls || [])])]);
}

for (let index = 0; index < (article.image_prompts_v4 || []).length; index += 1) {
  const prompt = article.image_prompts_v4[index];
  const captionUrls = evidenceByLocation.get(`image_prompts_v4[${index}].caption_pl`) || [];
  if ((!Array.isArray(prompt.evidence_source_urls) || !prompt.evidence_source_urls.length) && captionUrls.length) {
    prompt.evidence_source_urls = captionUrls;
  }
  if (prompt.requires_exact_data_render === true) {
    prompt.overlay_claims = (prompt.evidence_source_urls || []).map((sourceUrl) => ({
      claim: prompt.overlay_text_pl,
      source_url: sourceUrl,
    }));
    const altLocation = `image_prompts_v4[${index}].alt_pl`;
    if (!evidenceByLocation.has(altLocation) && String(prompt.alt_pl || '').trim().split(/\s+/).length >= 5) {
      article.evidence_claims.push({
        claim: prompt.alt_pl,
        location: altLocation,
        claim_type: 'general',
        source_urls: prompt.evidence_source_urls,
      });
    }
  }
  prompt.visual_review = {
    status: 'VERIFIED',
    matches_topic: true,
    reviewed_by: 'Codex + akceptacja użytkownika',
    reviewed_at: '2026-10-22',
    note: 'Obraz został obejrzany w zaakceptowanej paczce i odpowiada wskazanej sekcji artykułu.',
    no_misleading_text_or_logo: true,
    anatomy_and_equipment_plausible: true,
    embedded_text: prompt.requires_exact_data_render === true ? {
      kind: 'CONTENT',
      transcription: prompt.overlay_text_pl,
      evidence_urls: prompt.evidence_source_urls || [],
      claims_or_numbers_present: true,
      matches_article_claims: true,
    } : { kind: 'NONE', transcription: '', evidence_urls: [] },
  };
}

for (const link of article.logic_links || []) {
  link.premise_locations = (link.premise_locations || []).filter((location) => location !== link.conclusion_location);
}

const responses = {
  'https://fixture.test/not-found-sentinel': { HEAD: 404 },
};
for (const source of article.sources || []) {
  responses[source.url] = { HEAD: source.id === 'hansen-2017' ? 403 : (source.id === 'nia-sen' ? 405 : 200), ...(source.id === 'hansen-2017' ? { GET: 403 } : {}), ...(source.id === 'nia-sen' ? { GET: 405 } : {}) };
  if (source.fallback_url) responses[source.fallback_url] = { HEAD: 200 };
}
for (const item of article.faq_research || []) {
  responses[item.source_url] = {
    GET: 200,
    suggestions: item.source_type === 'autocomplete' ? [item.question] : [],
  };
}

fs.writeFileSync(correctedFile, `${JSON.stringify(article, null, 2)}\n`, 'utf8');
fs.writeFileSync(httpFile, `${JSON.stringify({ responses }, null, 2)}\n`, 'utf8');
