'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const FORM = path.join(ROOT, 'admin', 'news-form.php');
const PANEL_CSS = path.join(ROOT, 'admin', 'assets', 'panel.css');
const PUBLIC_HTML = path.join(ROOT, 'index.html');
const NEWS_HELPER = path.join(ROOT, 'admin', 'helpers', 'news.php');

const COLOR_CONTRACT = Object.freeze([
  { className: 'news-text-tone--1', label: 'Zielony', foreground: '#14532D', background: '#D1FAE5' },
  { className: 'news-text-tone--2', label: 'Niebieski', foreground: '#1E3A8A', background: '#DBEAFE' },
  { className: 'news-text-tone--3', label: 'Czerwony', foreground: '#7F1D1D', background: '#FEE2E2' },
  { className: 'news-text-tone--4', label: 'Żółty', foreground: '#713F12', background: '#FEF3C7' },
]);

function luminance(hex) {
  const channels = hex.slice(1).match(/../g).map((value) => Number.parseInt(value, 16) / 255);
  const linear = channels.map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return (0.2126 * linear[0]) + (0.7152 * linear[1]) + (0.0722 * linear[2]);
}

function contrastRatio(foreground, background) {
  const values = [luminance(foreground), luminance(background)].sort((left, right) => right - left);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

function phpString(value) {
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function sanitizeWithProjectHelper(input) {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-news-color-'));
  const admin = path.join(temporary, 'admin');
  const helpers = path.join(admin, 'helpers');
  fs.mkdirSync(helpers, { recursive: true });
  fs.copyFileSync(NEWS_HELPER, path.join(helpers, 'news.php'));
  fs.writeFileSync(path.join(admin, 'bootstrap.php'), '<?php');
  fs.writeFileSync(path.join(helpers, 'internal-links.php'), '<?php');
  fs.writeFileSync(path.join(helpers, 'news-db-read.php'), '<?php');
  const result = spawnSync('php', ['-d', 'display_errors=0', '-r', `
    require ${phpString(path.join(helpers, 'news.php'))};
    echo sanitizeNewsHtml(${phpString(input)});
  `], { cwd: ROOT, encoding: 'utf8' });
  fs.rmSync(temporary, { recursive: true, force: true });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout;
}

test('pasek zachowuje zaznaczenie przed dotykiem i przywraca je przed fokusem', () => {
  const form = fs.readFileSync(FORM, 'utf8');
  assert.match(form, /PointerEvent[\s\S]{0,160}pointerdown[\s\S]{0,160}mousedown/);
  assert.match(form, /addEventListener\(eventName[\s\S]{0,220}event\.preventDefault\(\)[\s\S]{0,120}rememberSelection\(\)/);

  const wrapStart = form.indexOf('function wrapSelection');
  const wrapEnd = form.indexOf('function ensureEditorNotEmpty', wrapStart);
  const wrap = form.slice(wrapStart, wrapEnd);
  assert.ok(wrapStart >= 0 && wrapEnd > wrapStart, 'Brak funkcji wrapSelection');
  assert.ok(wrap.indexOf('restoreSelection()') >= 0, 'Brak przywrócenia zaznaczenia');
  assert.ok(
    wrap.indexOf('restoreSelection()') < wrap.indexOf('editor.focus'),
    'Fokus nie może kasować zapamiętanego zakresu przed jego przywróceniem',
  );

  const rememberStart = form.indexOf('function rememberSelection');
  const rememberEnd = form.indexOf('function restoreSelection', rememberStart);
  const remember = form.slice(rememberStart, rememberEnd);
  assert.match(remember, /range\.collapsed[\s\S]{0,80}return/, 'Zwinięty zakres po scrollu nie może zastąpić zaznaczenia');
  assert.doesNotMatch(form, /(?:scroll|touchmove)[\s\S]{0,160}savedSelection\s*=\s*null/);
});

test('mobilny pasek mieści formatowanie i osobny rząd czterech kolorów bez przewijania', () => {
  const css = fs.readFileSync(PANEL_CSS, 'utf8');
  const mobileStart = css.indexOf('.news-editor-mobile-bar {', css.indexOf('@media'));
  const mobileEnd = css.indexOf('.news-editor-toolbar--links', mobileStart);
  const mobileCss = css.slice(mobileStart, mobileEnd);
  assert.ok(mobileStart >= 0 && mobileEnd > mobileStart, 'Brak mobilnego paska narzędzi');
  assert.match(mobileCss, /flex-wrap:\s*wrap/);
  assert.doesNotMatch(mobileCss, /overflow-x:\s*(?:auto|scroll)/);
  assert.match(mobileCss, /\.news-editor-action:not\(\.news-color-chip\)[\s\S]{0,180}calc\(\(100%\s*-\s*0\.9rem\)\s*\/\s*3\)/);
  assert.match(mobileCss, /\.news-color-chip[\s\S]{0,220}calc\(\(100%\s*-\s*1\.35rem\)\s*\/\s*4\)/);
  assert.match(mobileCss, /\.news-color-chip[\s\S]{0,220}min-width:\s*44px/);
});

test('przyciski mają nazwy kolorów, rozmiar dotykowy i widoczny stan aktywny', () => {
  const form = fs.readFileSync(FORM, 'utf8');
  const css = fs.readFileSync(PANEL_CSS, 'utf8');
  for (const color of COLOR_CONTRACT) {
    assert.match(form, new RegExp(`data-active-check=["']class:${color.className}["'][^>]*aria-label=["']${color.label}["']`));
    assert.match(form, new RegExp(`>${color.label}<`));
  }
  assert.match(css, /\.news-editor-action[\s\S]{0,180}min-width:\s*44px[\s\S]{0,100}min-height:\s*44px/);
  assert.match(css, /\.news-color-chip\.is-active[\s\S]{0,180}(outline|box-shadow)/);
  assert.doesNotMatch(css, /\.news-editor-mobile-bar \.news-color-chip\s*\{[^}]*width:\s*2\.05rem/s);
});

test('kolory edytora i strony publicznej mają wspólny kontrakt oraz kontrast WCAG AA', () => {
  const panelCss = fs.readFileSync(PANEL_CSS, 'utf8');
  const publicHtml = fs.readFileSync(PUBLIC_HTML, 'utf8');
  for (const color of COLOR_CONTRACT) {
    assert.ok(contrastRatio(color.foreground, color.background) >= 4.5, `${color.label}: kontrast poniżej 4.5:1`);
    const expected = new RegExp(`\\.${color.className}[^}]*color:\\s*${color.foreground}[^}]*background(?:-color)?:\\s*${color.background}`, 'is');
    assert.match(panelCss, expected, `Panel nie realizuje kontraktu: ${color.label}`);
    assert.match(publicHtml, expected, `Strona publiczna nie realizuje kontraktu: ${color.label}`);
  }
});

test('sanitizer zachowuje wyłącznie jawne klasy NEWS i usuwa style', () => {
  const allowed = COLOR_CONTRACT.map(({ className }) => className).concat([
    'news-text-strong-black', 'p1', 'p2', 's1', 'Apple-converted-space',
  ]);
  const html = `<p class="p1 obca-klasa"><span class="${allowed.join(' ')} obca-klasa" style="color:red">Tekst</span></p>`;
  const clean = sanitizeWithProjectHelper(html);
  for (const className of allowed) assert.match(clean, new RegExp(`(?:^|[ "'])${className}(?:[ "']|$)`));
  assert.doesNotMatch(clean, /obca-klasa|style=/i);
});

test('źródła i lustra pozostają identyczne', () => {
  for (const relative of ['admin/news-form.php', 'admin/assets/panel.css', 'admin/helpers/news.php', 'index.html']) {
    assert.deepEqual(
      fs.readFileSync(path.join(ROOT, relative)),
      fs.readFileSync(path.join(ROOT, '_site', relative)),
      `${relative}: lustro _site różni się od źródła`,
    );
  }
});
