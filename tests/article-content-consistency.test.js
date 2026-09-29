const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { validateArticleContract } = require('../scripts/article-contract-check');
const check = (html) => {
  const run = spawnSync('python3', [path.join(__dirname, '../scripts/article-content-consistency.py'), '--stdin'], { input: html, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  return JSON.parse(run.stdout).errors;
};
function fixture({ faq = 'Odpowiedź widoczna.', citation = 'https://example.org/source', links = true } = {}) {
 const bodyLinks = links ? [1,2,3,4].map(n => `<p><a href="article-${n}.html">Temat ${n}</a></p>`).join('') : '';
 const sections = [1,2,3,4,5,6].map(n => `<h2>Sekcja ${n}</h2><p>Konkretny opis sekcji.</p><figure><picture><source type="image/avif" srcset="./assets/section-${n}.avif"><source type="image/webp" srcset="./assets/section-${n}.webp"><img src="./assets/section-${n}.jpg" alt="Konkretny opis ilustracji numer ${n}" width="1200" height="675"></picture><figcaption>Konkretny podpis ilustracji numer ${n} związanej z sekcją.</figcaption></figure>`).join('');
 return `<script type="application/ld+json">${JSON.stringify({'@graph':[{'@type':'BlogPosting',citation:[citation]},{'@type':'FAQPage',mainEntity:[{'@type':'Question',name:'Pytanie?',acceptedAnswer:{'@type':'Answer',text:faq}}]}]})}</script><nav>${[1,2,3,4].map(n=>`<a href="menu-${n}.html">Menu</a>`).join('')}</nav><section class="article-intro-grid"><div class="article-hero"><picture><source type="image/avif" srcset="./assets/hero.avif"><source type="image/webp" srcset="./assets/hero.webp"><img src="./assets/hero.jpg" alt="Konkretny obraz główny artykułu" width="1200" height="675"></picture></div></section><article class="article-content">${bodyLinks}${sections}<section class="faq-section"><article class="faq-item"><h3>Pytanie?</h3><p>Odpowiedź widoczna.</p></article></section><h2 id="zrodla">Źródła</h2><ol><li><a href="https://example.org/source">Źródło</a></li></ol></article>`;
}
test('matching visible FAQ and citations pass, including @graph', () => assert.deepEqual(check(fixture()), []));
test('stale FAQ answer blocks even when the question is identical', () => assert.ok(check(fixture({faq:'Inna dawka leku.'})).some(e=>e.includes('FAQ'))));
test('citation must equal the visible bibliography', () => assert.ok(check(fixture({citation:'https://example.org/other'})).some(e=>e.includes('citation'))));
test('navigation cannot satisfy contextual linking', () => assert.ok(check(fixture({links:false})).some(e=>e.includes('kontekst'))));
test('search result URL is not a bibliographic source', () => assert.ok(check(fixture().replaceAll('https://example.org/source','https://pubmed.ncbi.nlm.nih.gov/?term=fascia')).some(e=>e.includes('wyszukiwania'))));
test('malformed JSON-LD fails closed', () => assert.ok(check(fixture()+'<script type="application/ld+json">{bad}</script>').some(e=>e.includes('JSON-LD'))));
test('duplicate FAQPage is reported explicitly even with identical answers', () => {
 const duplicate = '<script type="application/ld+json">{"@type":"FAQPage","mainEntity":[]}</script>';
 assert.ok(check(fixture()+duplicate).some(e=>e.includes('więcej niż jeden FAQPage')));
});
test('article section count follows the topic instead of an arbitrary minimum', () => {
 const html = fixture().replace(/<h2>Sekcja 6<\/h2>[\s\S]*?<\/figure>/, '');
 assert.deepEqual(check(html), []);
});
test('article without any substantive H2 section is blocked', () => {
 const html = fixture().replace(/<h2>Sekcja \d<\/h2>[\s\S]*?<\/figure>/g, '');
 assert.ok(check(html).some(e=>e.includes('żadnej głównej sekcji')));
});
test('each substantive section requires its own complete picture and caption', () => {
 const html = fixture().replace('<source type="image/avif" srcset="./assets/section-3.avif">', '');
 const errors = check(html).join('\n');
  assert.match(errors, /Sekcja 3.*AVIF/);
});
test('legacy Q&A and reading helper headings are not treated as substantive sections', () => {
 const helpers = '<h2>Szybkie odpowiedzi (Q&A)?</h2><div class="qa-grid"><h2>Cytaty do zapamiętania?</h2><h2>W skrócie (AI)?</h2><h2>Czytaj też?</h2></div>';
 const html = fixture().replace('<section class="faq-section">', `${helpers}<section class="faq-section">`);
 assert.deepEqual(check(html), []);
});
test('publication contract blocks tables without the responsive wrapper', () => {
 const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-table-contract-'));
 const file = path.join(dir, 'article.html');
 fs.writeFileSync(file, `${fixture()}<table><caption>Plan</caption></table>`);
 const errors = validateArticleContract(file).errors.join('\n');
 assert.match(errors, /Tabele bez kontenera \.article-table-wrap: 1\/1/);
});
