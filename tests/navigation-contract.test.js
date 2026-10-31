const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { isDeepStrictEqual } = require('node:util');

const ROOT = path.resolve(__dirname, '..');
const SITE_ROOT = path.join(ROOT, '_site');
const { RETIRED_MODULE_PATHS } = require('../scripts/security-exposure-check.js');
const PHENO_TOOL_NAV_EXCEPTION = 'kalkulator-phenoage-wiek-fenotypowy.html';
const NO_MOBILE_MENU_EXCEPTIONS = new Set([
  'index.html',
  'o-mnie.html',
  'polityka-prywatnosci.html',
]);

const NON_PUBLIC_HTML = new Set([
  'article-template-bento.html',
  'google4a31b58b207723ed.html',
]);

const MOBILE_WIEDZA_EXCEPTIONS = new Set([
  'ciekawe.html',
  'jedzenie.html',
  'mity.html',
  'porady.html',
  'rusz-sie.html',
  'search.html',
  'zdrowie.html',
]);

const NO_STANDARD_MENU_EXCEPTIONS = new Set([
  'dzienniczek-cisnienia-7-dni.html',
  'interpretator-wynikow-badan.html',
  'kalkulator-bialka-po-50.html',
  'kalkulator-obwodu-pasa-do-wzrostu.html',
  'kalkulator-phenoage-wiek-fenotypowy.html',
  'kalkulator-sily-wzglednej.html',
  'kalkulator-tempa-marszu.html',
  'lipidogram-apob-ldl-non-hdl.html',
  'narzedzia.html',
]);

const TOPIC_CENTER_MENU_EXCEPTIONS = new Set([
  'centrum-bialka-po-50.html',
  'centrum-cholesterolu-po-50.html',
  'centrum-metabolizmu-po-50.html',
  'centrum-nadcisnienia-po-50.html',
  'centrum-snu-po-50.html',
  'centrum-treningu-silowego-po-50.html',
]);

const FOOTER_EXCEPTION_FILES = Object.freeze({
  centers: new Set([
    'centrum-bialka-po-50.html',
    'centrum-cholesterolu-po-50.html',
    'centrum-metabolizmu-po-50.html',
    'centrum-nadcisnienia-po-50.html',
    'centrum-snu-po-50.html',
    'centrum-treningu-silowego-po-50.html',
  ]),
  legacyEntity: new Set([
    'jak-czytac-etykiety-sklad-produktow-e-numery-inci.html',
    'lektyny-szczawiany-fityniany-czy-sa-grozne-po-50.html',
    'peptydy-co-to-jest-rodzaje-bezpieczenstwo-po-50.html',
    'trening-silowy-eliksir-mlodosci-po-50.html',
  ]),
  mity: new Set(['mity.html']),
  simplePolicy: new Set(['dzienniczek-cisnienia-7-dni.html', 'narzedzia.html']),
  toolBack: new Set([
    'interpretator-wynikow-badan.html',
    'kalkulator-bialka-po-50.html',
    'kalkulator-obwodu-pasa-do-wzrostu.html',
    'kalkulator-phenoage-wiek-fenotypowy.html',
    'kalkulator-sily-wzglednej.html',
    'kalkulator-tempa-marszu.html',
    'lipidogram-apob-ldl-non-hdl.html',
  ]),
});

const DESKTOP_ITEMS = Object.freeze([
  ['index.html', 'Home'],
  ['porady.html', 'Porady'],
  ['mity.html', 'Mity'],
  ['rusz-sie.html', 'Ruch'],
  ['jedzenie.html', 'Jedzenie'],
  ['zdrowie.html', 'Zdrowie'],
  ['ciekawe.html', 'Ciekawe'],
  ['o-mnie.html', 'O mnie'],
]);

const MOBILE_ITEMS = Object.freeze([
  ['index.html', 'Dom'],
  ['porady.html', 'Porady'],
  ['index.html#baza-wiedzy', 'Baza wiedzy'],
  ['https://www.instagram.com/fitpo50', 'Instagram'],
]);

const TOPIC_CENTER_ITEMS = Object.freeze([
  ['index.html', 'Home'],
  ['index.html#centra-tematyczne', 'Centra'],
  ['porady.html', 'Porady'],
  ['rusz-sie.html', 'Ruch'],
  ['jedzenie.html', 'Jedzenie'],
  ['zdrowie.html', 'Zdrowie'],
  ['ciekawe.html', 'Ciekawe'],
]);

const FOOTER_VARIANTS = Object.freeze({
  standard: [
    ['index.html', 'Home'], ['porady.html', 'Porady'], ['rusz-sie.html', 'Ruch'],
    ['jedzenie.html', 'Jedzenie'], ['zdrowie.html', 'Zdrowie'], ['ciekawe.html', 'Ciekawe'],
    ['o-mnie.html', 'O mnie'], ['polityka-prywatnosci.html', 'Polityka Prywatności i Cookies'],
  ],
  centers: [
    ['index.html', 'Home'], ['index.html#centra-tematyczne', 'Centra'], ['porady.html', 'Porady'],
    ['rusz-sie.html', 'Ruch'], ['jedzenie.html', 'Jedzenie'], ['zdrowie.html', 'Zdrowie'],
    ['ciekawe.html', 'Ciekawe'], ['o-mnie.html', 'O mnie'],
    ['polityka-prywatnosci.html', 'Polityka Prywatności i Cookies'],
  ],
  legacyEntity: [
    ['index.html', 'Home'], ['porady.html', 'Porady'], ['rusz-sie.html', 'Ruch'],
    ['jedzenie.html', 'Jedzenie'], ['zdrowie.html', 'Zdrowie'], ['ciekawe.html', 'Ciekawe'],
    ['o-mnie.html', 'O mnie'], ['polityka-prywatnosci.html', 'Polityka Prywatno&#347;ci i Cookies'],
  ],
  mity: [
    ['index.html', 'Home'], ['porady.html', 'Porady'], ['rusz-sie.html', 'Ruch'],
    ['jedzenie.html', 'Jedzenie'], ['zdrowie.html', 'Zdrowie'], ['ciekawe.html', 'Ciekawe'],
    ['mity.html', 'Mity'], ['o-mnie.html', 'O mnie'],
    ['polityka-prywatnosci.html', 'Polityka Prywatności i Cookies'],
  ],
  simplePolicy: [['polityka-prywatnosci.html', 'Polityka Prywatności i Cookies']],
  toolBack: [['narzedzia.html', 'Wróć do katalogu narzędzi']],
});

function attribute(tag, name) {
  const escaped = String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = String(tag).match(new RegExp(`\\b${escaped}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i'));
  return match ? String(match[1] ?? match[2] ?? '').trim() : '';
}

function classTokens(tag) {
  return new Set(attribute(tag, 'class').split(/\s+/).filter(Boolean));
}

function elementByClass(html, tagName, className) {
  const blocks = String(html).match(new RegExp(`<${tagName}\\b[^>]*>[\\s\\S]*?<\\/${tagName}>`, 'gi')) || [];
  return blocks.find((block) => classTokens(block.slice(0, block.indexOf('>') + 1)).has(className)) || '';
}

function plainText(html) {
  return String(html)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function anchors(block) {
  const result = [];
  for (const match of String(block).matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/gi)) {
    const tag = String(match[0]).match(/^<a\b[^>]*>/i)?.[0] || '';
    result.push({ href: attribute(tag, 'href'), label: plainText(match[0]) });
  }
  return result;
}

function publicHtmlFiles(root) {
  return fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.html') && !NON_PUBLIC_HTML.has(entry.name))
    .map((entry) => entry.name)
    .sort();
}

function navigationOf(html) {
  const desktopBlock = elementByClass(html, 'nav', 'menu');
  const mobileBlock = elementByClass(html, 'nav', 'bottom-nav');
  const footerBlock = elementByClass(html, 'footer', 'site-footer-bento');
  const toolHeaderBlock = elementByClass(html, 'header', 'tools-topbar');
  const topicCenterBlock = elementByClass(html, 'nav', 'hub-nav');
  const phenoHeaderBlock = elementByClass(html, 'header', 'pheno-topbar');
  return {
    desktopBlock,
    mobileBlock,
    footerBlock,
    toolHeaderBlock,
    topicCenterBlock,
    phenoHeaderBlock,
    desktop: anchors(desktopBlock),
    mobile: anchors(mobileBlock),
    footer: anchors(footerBlock),
    toolHeader: anchors(toolHeaderBlock),
    topicCenter: anchors(topicCenterBlock),
    phenoHeader: anchors(phenoHeaderBlock),
  };
}

function normalizeHref(file, href) {
  const value = String(href || '').trim();
  if (!value) return '';
  if (/^(mailto:|tel:|javascript:|data:)/i.test(value)) return value;
  if (/^https?:/i.test(value)) {
    const url = new URL(value);
    if (url.hostname !== 'fitpo50.pl' && url.hostname !== 'www.fitpo50.pl') return value;
    return `${url.pathname.replace(/^\/+/, '') || 'index.html'}${url.hash}`;
  }
  if (value === '#') return file;
  const hashIndex = value.indexOf('#');
  const rawPath = hashIndex >= 0 ? value.slice(0, hashIndex) : value;
  const hash = hashIndex >= 0 ? value.slice(hashIndex) : '';
  const cleanPath = rawPath.split('?')[0].replace(/^\.\//, '').replace(/^\/+/, '');
  return `${cleanPath || file}${hash}`;
}

function normalizedItems(file, items) {
  return items.map(({ href, label }) => [normalizeHref(file, href), label]);
}

function signature(items) {
  return items.map(([href, label]) => `${href}::${label}`).join('|');
}

function expectedDesktop(file) {
  return file === 'polityka-prywatnosci.html'
    ? DESKTOP_ITEMS.filter(([, label]) => label !== 'Mity')
    : DESKTOP_ITEMS;
}

function expectedMobile(file) {
  return MOBILE_ITEMS.map(([href, label]) => [
    href,
    label === 'Baza wiedzy' && MOBILE_WIEDZA_EXCEPTIONS.has(file) ? 'Wiedza' : label,
  ]);
}

function expectedFooterVariant(file) {
  for (const [variant, files] of Object.entries(FOOTER_EXCEPTION_FILES)) {
    if (files.has(file)) return variant;
  }
  return 'standard';
}

function retiredPath(href) {
  let value = String(href || '').trim();
  if (/^https?:/i.test(value)) {
    const url = new URL(value);
    if (!['fitpo50.pl', 'www.fitpo50.pl', 'admin.fitpo50.pl'].includes(url.hostname)) return '';
    value = url.pathname;
  }
  const pathname = `/${value.split(/[?#]/)[0].replace(/^\.\//, '').replace(/^\/+/, '')}`;
  if (pathname === '/dziennik.html' || /^\/moje-sukcesy(?:[^/]*)/i.test(pathname)) return pathname;
  return RETIRED_MODULE_PATHS.includes(pathname) ? pathname : '';
}

function localTarget(file, href) {
  const value = String(href || '').trim();
  if (!value || value === '#' || /^(mailto:|tel:|javascript:|data:)/i.test(value)) return '';
  if (/^https?:/i.test(value)) {
    const url = new URL(value);
    if (url.hostname !== 'fitpo50.pl' && url.hostname !== 'www.fitpo50.pl') return '';
    return url.pathname.replace(/^\/+/, '') || 'index.html';
  }
  const clean = value.split(/[?#]/)[0].replace(/^\.\//, '').replace(/^\/+/, '');
  return clean || file;
}

function pageIssues(root, file, html) {
  const nav = navigationOf(html);
  const issues = [];
  const alternate = NO_STANDARD_MENU_EXCEPTIONS.has(file);
  const topicCenter = TOPIC_CENTER_MENU_EXCEPTIONS.has(file);

  if (topicCenter) {
    if (nav.desktopBlock || nav.mobileBlock) issues.push(`${file}: usuń wyjątek hub — strona ma już standardowe menu`);
    if (!nav.topicCenterBlock) issues.push(`${file}: brak nawigacji hub-nav`);
    if (!isDeepStrictEqual(normalizedItems(file, nav.topicCenter), TOPIC_CENTER_ITEMS)) {
      issues.push(`${file}: hub-nav odbiega od kontraktu`);
    }
  } else if (!alternate) {
    if (!nav.desktopBlock) issues.push(`${file}: brak menu desktop`);
    const actualDesktop = normalizedItems(file, nav.desktop);
    const policyNowStandard = file === 'polityka-prywatnosci.html'
      && signature(actualDesktop) === signature(DESKTOP_ITEMS);
    if (policyNowStandard) {
      issues.push(`${file}: usuń wyjątek braku Mity — menu desktop jest już standardowe`);
    } else if (!isDeepStrictEqual(actualDesktop, expectedDesktop(file))) {
      issues.push(`${file}: menu desktop odbiega od kontraktu`);
    }
    if (NO_MOBILE_MENU_EXCEPTIONS.has(file)) {
      if (nav.mobileBlock) issues.push(`${file}: usuń wyjątek braku .bottom-nav — menu mobile już istnieje`);
    } else {
      if (!nav.mobileBlock) issues.push(`${file}: brak menu mobile`);
      const actualMobile = normalizedItems(file, nav.mobile);
      const wiedzaNowStandard = MOBILE_WIEDZA_EXCEPTIONS.has(file)
        && signature(actualMobile) === signature(MOBILE_ITEMS);
      if (wiedzaNowStandard) {
        issues.push(`${file}: usuń wyjątek Wiedza — etykieta jest już standardowa`);
      } else if (!isDeepStrictEqual(actualMobile, expectedMobile(file))) {
        issues.push(`${file}: menu mobile odbiega od kontraktu`);
      }
    }
  } else {
    if (nav.desktopBlock || nav.mobileBlock) issues.push(`${file}: usuń wyjątek tool — strona ma już standardowe menu`);
    if (file === PHENO_TOOL_NAV_EXCEPTION) {
      if (nav.toolHeaderBlock) issues.push(`${file}: usuń wyjątek pheno-topbar — tools-topbar już istnieje`);
      if (!nav.phenoHeaderBlock) issues.push(`${file}: brak alternatywnej nawigacji pheno-topbar`);
    } else if (!nav.toolHeaderBlock) {
      issues.push(`${file}: brak alternatywnej nawigacji tools-topbar`);
    }
  }

  if (!nav.footerBlock) issues.push(`${file}: brak stopki`);
  const footerVariant = expectedFooterVariant(file);
  const actualFooterSignature = signature(normalizedItems(file, nav.footer));
  if (footerVariant !== 'standard' && actualFooterSignature === signature(FOOTER_VARIANTS.standard)) {
    issues.push(`${file}: usuń wyjątek stopki ${footerVariant} — stopka jest już standardowa`);
  }
  if (actualFooterSignature !== signature(FOOTER_VARIANTS[footerVariant])) {
    issues.push(`${file}: stopka odbiega od dozwolonego wariantu ${footerVariant}`);
  }

  for (const item of [...nav.desktop, ...nav.mobile, ...nav.footer, ...nav.toolHeader, ...nav.topicCenter, ...nav.phenoHeader]) {
    const retired = retiredPath(item.href);
    if (retired) issues.push(`${file}: link do wycofanego adresu ${retired}`);
    const target = localTarget(file, item.href);
    if (target && !fs.existsSync(path.join(root, target))) issues.push(`${file}: martwy link ${item.href}`);
  }
  return issues;
}

test('fixture wykrywa martwy link, wycofany adres i nowe odstępstwo menu', () => {
  const fixture = `
    <nav class="menu"><a href="index.html">Home</a><a href="brak.html">Porady</a></nav>
    <nav class="bottom-nav"><a href="/dziennik.html">Wiedza</a></nav>
    <footer class="site-footer-bento"><a href="index.html">Home</a></footer>`;
  const nav = navigationOf(fixture);
  const issues = [];
  if (!nav.desktop.some((item) => item.label === 'Mity')) issues.push('brak pozycji Mity');
  for (const item of [...nav.desktop, ...nav.mobile, ...nav.footer]) {
    if (item.href === 'brak.html') issues.push('martwy link: brak.html');
    if (retiredPath(item.href)) issues.push(`wycofany adres: ${retiredPath(item.href)}`);
  }
  assert.deepEqual(issues.sort(), [
    'brak pozycji Mity',
    'martwy link: brak.html',
    'wycofany adres: /dziennik.html',
  ]);
});

test('fixture nowej strony nieznanego typu jest odrzucany', () => {
  const fixture = '<html><body><main>Nowa strona bez znanego kontraktu nawigacji</main></body></html>';
  const issues = pageIssues(ROOT, 'nowa-nieznana-strona.html', fixture);
  assert.equal(issues.some((issue) => /brak menu desktop|menu desktop odbiega/.test(issue)), true);
  assert.equal(issues.some((issue) => /brak stopki|stopka odbiega/.test(issue)), true);
});

test('każda publiczna strona ma zgodną, niepogorszoną nawigację w źródle i _site', () => {
  assert.equal(fs.existsSync(SITE_ROOT), true, 'Brak katalogu _site — kontrakt nawigacji nie może przejść.');
  const sourceFiles = publicHtmlFiles(ROOT);
  const siteFiles = publicHtmlFiles(SITE_ROOT);
  assert.deepEqual(siteFiles, sourceFiles, 'Lista publicznych HTML w źródle i _site jest różna.');

  const errors = [];
  const namedExceptions = [
    ...MOBILE_WIEDZA_EXCEPTIONS,
    ...NO_STANDARD_MENU_EXCEPTIONS,
    ...TOPIC_CENTER_MENU_EXCEPTIONS,
    ...NO_MOBILE_MENU_EXCEPTIONS,
    'polityka-prywatnosci.html',
    ...Object.values(FOOTER_EXCEPTION_FILES).flatMap((files) => [...files]),
  ];
  for (const file of new Set(namedExceptions)) {
    if (!sourceFiles.includes(file)) errors.push(`${file}: usuń wyjątek — plik już nie istnieje`);
  }
  for (const file of sourceFiles) {
    const sourceHtml = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const siteHtml = fs.readFileSync(path.join(SITE_ROOT, file), 'utf8');
    const sourceNav = navigationOf(sourceHtml);
    const siteNav = navigationOf(siteHtml);
    errors.push(...pageIssues(ROOT, file, sourceHtml));
    errors.push(...pageIssues(SITE_ROOT, file, siteHtml).map((error) => `_site/${error}`));
    const sourceNavigation = {
        desktop: normalizedItems(file, sourceNav.desktop),
        mobile: normalizedItems(file, sourceNav.mobile),
        footer: normalizedItems(file, sourceNav.footer),
        toolHeader: normalizedItems(file, sourceNav.toolHeader),
        topicCenter: normalizedItems(file, sourceNav.topicCenter),
        phenoHeader: normalizedItems(file, sourceNav.phenoHeader),
      };
    const siteNavigation = {
        desktop: normalizedItems(file, siteNav.desktop),
        mobile: normalizedItems(file, siteNav.mobile),
        footer: normalizedItems(file, siteNav.footer),
        toolHeader: normalizedItems(file, siteNav.toolHeader),
        topicCenter: normalizedItems(file, siteNav.topicCenter),
        phenoHeader: normalizedItems(file, siteNav.phenoHeader),
      };
    if (!isDeepStrictEqual(sourceNavigation, siteNavigation)) {
      errors.push(`${file}: nawigacja źródła i _site jest różna`);
    }
  }
  assert.deepEqual(errors, []);
});
