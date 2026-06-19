#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { renderTopicCentersSection, renderTopicCentersStyles } = require('./lib/topic-centers');

const ROOT = path.resolve(__dirname, '..');
const TARGETS = ['index.html', path.join('_site', 'index.html')];

function replaceBetween(raw, start, end, replacement) {
  const startIndex = raw.indexOf(start);
  const endIndex = raw.indexOf(end);
  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) return null;
  return `${raw.slice(0, startIndex)}${replacement}${raw.slice(endIndex + end.length)}`;
}

function ensureStyles(raw) {
  const styles = renderTopicCentersStyles();
  const existing = replaceBetween(raw, '/* topic-centers:start */', '/* topic-centers:end */', styles);
  if (existing) return existing;
  const styleEnd = raw.lastIndexOf('</style>');
  if (styleEnd === -1) {
    throw new Error('Nie znaleziono </style> dla sekcji topic-centers.');
  }
  return `${raw.slice(0, styleEnd)}\n\n    ${styles}\n${raw.slice(styleEnd)}`;
}

function ensureSection(raw) {
  const section = renderTopicCentersSection();
  const existing = replaceBetween(raw, '<!-- topic-centers-section:start -->', '<!-- topic-centers-section:end -->', section);
  if (existing) return existing;

  const bottomRow = raw.indexOf('    <section class="bottom-row"');
  if (bottomRow !== -1) {
    return `${raw.slice(0, bottomRow)}${section}\n\n${raw.slice(bottomRow)}`;
  }

  const mainEnd = raw.indexOf('    </main>');
  if (mainEnd === -1) {
    throw new Error('Nie znaleziono miejsca wstawienia sekcji topic-centers.');
  }
  return `${raw.slice(0, mainEnd + '    </main>'.length)}\n\n${section}\n${raw.slice(mainEnd + '    </main>'.length)}`;
}

function syncFile(relativePath) {
  const filePath = path.join(ROOT, relativePath);
  if (!fs.existsSync(filePath)) return false;
  const raw = fs.readFileSync(filePath, 'utf8');
  const next = ensureSection(ensureStyles(raw));
  fs.writeFileSync(filePath, next, 'utf8');
  return true;
}

for (const target of TARGETS) {
  const updated = syncFile(target);
  console.log(`${updated ? 'updated' : 'skipped'} ${target}`);
}
