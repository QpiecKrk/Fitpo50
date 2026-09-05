// Shared by the PDF generator and its independent HTML/text comparison gate.
const OMIT_FROM_PDF = '.hub-actions, .hub-breadcrumb, .hub-kicker, .hub-metrics, .hub-focus-card__icon, .hub-featured__arrow, .hub-article-link__cta, script, style, button';

async function prepareCenterPrint(page) {
  await page.evaluate((omit) => {
    const main = document.querySelector('.hub-shell > main');
    if (!main) throw new Error('Brak treści centrum do PDF.');
    const promise = main.querySelector('.hub-promise');
    const answer = main.querySelector('.hub-answer p');
    if (promise && answer && promise.textContent.trim() === answer.textContent.trim()) promise.remove();
    main.querySelectorAll(omit).forEach((node) => node.remove());
    document.querySelectorAll('body > *, .hub-shell > *').forEach((node) => {
      if (node !== main && !node.contains(main)) node.remove();
    });
    main.querySelectorAll('a[href]').forEach((a) => {
      a.href = new URL(a.getAttribute('href'), `https://fitpo50.pl/${location.pathname.split('/').pop()}`).href;
    });
  }, OMIT_FROM_PDF);
  await page.addStyleTag({ content: `
    @page { size: A4; margin: 18mm; }
    html, body { background: white !important; color: #18252a !important; }
    .hub-shell { width: auto !important; max-width: none !important; padding: 0 !important; margin: 0 !important; }
    main, main * { box-shadow: none !important; text-shadow: none !important; }
    main { font-family: Arial, sans-serif; font-size: 11pt; }
    .hub-hero, .hub-content-grid, .hub-decision-grid, .hub-path { display: block !important; }
    .hub-hero, .hub-section, .hub-side-card { padding: 0 !important; margin: 0 0 16pt !important; border: 0 !important; background: white !important; }
    .hub-hero__panel { display: none !important; }
    h1 { font-size: 24pt !important; line-height: 1.18 !important; margin: 0 0 12pt !important; }
    h2 { font-size: 16pt !important; line-height: 1.3 !important; margin: 14pt 0 6pt !important; break-after: avoid; }
    h3 { font-size: 12pt !important; break-after: avoid; }
    p, li, a, span, small, strong { font-size: 11pt !important; line-height: 1.45 !important; letter-spacing: normal !important; }
    p { margin: 0 0 8pt !important; orphans: 3; widows: 3; }
    .hub-hero__lead { font-size: 12pt !important; }
    .hub-decision-grid a, .hub-faq-list article, .hub-path__step, .hub-article-link, .hub-featured { display: block !important; break-inside: avoid; padding: 6pt !important; margin: 0 0 5pt !important; }
    .hub-decision-grid a span, .hub-article-link small { display: block; }
    .hub-faq-list, .hub-source-links { display: block !important; }
    .hub-source-links a { display: block; font-size: 9pt !important; margin-bottom: 5pt; }
    .hub-sources { break-inside: avoid; }
    .medical-disclaimer { font-size: 9pt !important; }
    a { color: #154c77 !important; text-decoration: underline; }
    html, body, .hub-shell, main, main * { box-shadow: none !important; border-radius: 0 !important; }
    .hub-shell, main, main div, main section, main article, main a { min-height: 0 !important; height: auto !important; overflow: visible !important; border: 0 !important; background: transparent !important; }
    main *::before, main *::after { display: none !important; }
    main * { font-family: Arial, sans-serif !important; color: #18252a !important; font-weight: 400 !important; }
    main h1, main h2, main h3, main strong { font-weight: 700 !important; }
    main .hub-section__head { margin: 0 0 8pt !important; }
    main .hub-path__step, main .hub-decision-grid a, main .hub-featured { padding: 0 !important; margin: 0 0 9pt !important; }
    main .hub-path__step span { display: inline !important; margin-right: 8pt !important; }
    main a { color: #154c77 !important; }
  ` });
}

module.exports = { OMIT_FROM_PDF, prepareCenterPrint };
