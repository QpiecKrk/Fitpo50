#!/usr/bin/env python3
"""Strict content and metadata contract for the existing topic-center layout."""
import json
import re
import sys
from pathlib import Path
from urllib.parse import urlsplit
from bs4 import BeautifulSoup


def validate(file):
    soup = BeautifulSoup(file.read_text(), 'html.parser')
    root = file.parent.parent if file.parent.name == '_site' else file.parent
    errors = []

    def check(condition, message):
        if not condition:
            errors.append(message)

    def text(selector):
        node = soup.select_one(selector)
        return node.get_text(' ', strip=True) if node else ''

    for selector in ['.hub-shell', 'header.hub-topbar', 'main', 'h1#hub-title', '.hub-answer', '.hub-decision-grid', '#najwazniejsze-artykuly', '.hub-faq', '.hub-sources', '.site-footer-bento']:
        check(len(soup.select(selector)) == 1, f'{selector}: wymagany dokładnie jeden element')
    check(len(soup.select('h1')) == 1, 'Wymagany jeden H1')
    check(not soup.select('[style], style'), 'Niedozwolone inline CSS')
    check(20 <= len(text('title')) <= 65, 'Title: wymagane 20–65 znaków z marką')
    descriptions = []
    for key, value in [('name', 'description'), ('property', 'og:description'), ('name', 'twitter:description')]:
        nodes = soup.find_all('meta', attrs={key: value})
        check(len(nodes) == 1, f'{value}: wymagane jedno pole')
        descriptions.append(nodes[0].get('content', '') if nodes else '')
    description = descriptions[0]
    check(145 <= len(description) <= 160 and description.endswith(('.', '!', '?')), 'Opis SEO: 145–160 znaków i pełne zdanie')
    url = 'https://fitpo50.pl/' + file.name
    canonical = soup.select_one('link[rel="canonical"]')
    check(canonical is not None and canonical.get('href') == url, 'Canonical musi wskazywać własny publiczny URL')
    robots = soup.select_one('meta[name="robots"]')
    check(robots is not None and 'noindex' not in robots.get('content', ''), 'Brak indeksowalności')
    nodes = []

    def walk(obj):
        if isinstance(obj, dict):
            if '@type' in obj:
                nodes.append(obj)
            for value in obj.values():
                walk(value)
        elif isinstance(obj, list):
            for value in obj:
                walk(value)

    for script in soup.select('script[type="application/ld+json"]'):
        try:
            walk(json.loads(script.string or ''))
        except ValueError:
            errors.append('Niepoprawny JSON-LD')
    postings = [n for n in nodes if n.get('@type') == 'BlogPosting']
    check(len(postings) == 1, 'Wymagany jeden kompletny BlogPosting, bez duplikatów dat')
    check(len([n for n in nodes if n.get('@type') == 'CollectionPage']) == 1, 'Wymagany CollectionPage')
    check(any(n.get('@type') == 'BreadcrumbList' for n in nodes), 'Brak BreadcrumbList')
    for posting in postings:
        descriptions.append(posting.get('description', ''))
        check(posting.get('headline') == text('h1'), 'BlogPosting.headline musi odpowiadać H1')
        check(posting.get('author', {}).get('@type') == 'Person' and posting.get('author', {}).get('name'), 'Brak autora Person')
        for field, meta in [('datePublished', 'article:published_time'), ('dateModified', 'article:modified_time')]:
            value = posting.get(field, '')
            node = soup.find('meta', property=meta)
            check(bool(re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})', value)), f'{field}: brak pełnego ISO')
            check(node is not None and node.get('content') == value, f'{field}: niespójność meta/schema')
        check('#szybka-odpowiedz' in posting.get('speakable', {}).get('cssSelector', []), 'Speakable nie wskazuje szybkiej odpowiedzi')
        citations = posting.get('citation', [])
        sources = [a.get('href') for a in soup.select('.hub-source-links a')]
        check(len(set(sources)) >= 4 and all(u.startswith('https://') for u in sources), 'Minimum cztery zewnętrzne źródła')
        check(citations == sources, 'Citation musi odpowiadać bibliografii 1:1')
        used = {a.get('href') for a in soup.select('main a[data-evidence]')}
        check(set(sources) == used, 'Każde źródło musi być wykorzystane przy konkretnej tezie')
    check(all(d == description for d in descriptions), 'Niespójne opisy SEO')
    main = soup.select_one('main')
    if main:
        for heading in main.select('h2'):
            title = heading.get_text(' ', strip=True)
            check(not re.match(r'^(Czy|Jak|Dlaczego|Ile|Kiedy|Od czego|Co |Na czym|Który)', title) or title.endswith('?'), f'Pytający H2 bez ?: {title}')
            paragraph = heading.find_next_sibling('p')
            words = len(paragraph.get_text(' ', strip=True).split()) if paragraph else 0
            check(30 <= words <= 70, f'H2 {title}: pierwszy akapit {words} słów, wymagane 30–70')
        links = set()
        for a in main.select('a[href]'):
            href = a['href']
            if urlsplit(href).scheme:
                check(not href.startswith('https://fitpo50.pl/') or a.has_attr('data-evidence'), f'Bezwzględny link wewnętrzny: {href}')
                continue
            relative = urlsplit(href).path
            if relative.endswith('.html'):
                check((root / relative).is_file(), f'Uszkodzony link: {href}')
                if a.find_parent('p'):
                    links.add(relative)
        check(len(links) >= 4, 'Minimum cztery linki kontekstowe w akapitach')
    itemlists = [n for n in nodes if n.get('@type') == 'ItemList']
    visible = [urlsplit(a['href']).path for a in soup.select('#najwazniejsze-artykuly a.hub-featured[href], #najwazniejsze-artykuly a.hub-article-link[href]')]
    check(len(itemlists) == 1, 'Wymagany jeden ItemList')
    if itemlists:
        entries = itemlists[0].get('itemListElement', [])
        check([urlsplit(n.get('url', '')).path.lstrip('/') for n in entries] == visible, 'ItemList nie odpowiada widocznej liście artykułów')
        check([n.get('position') for n in entries] == list(range(1, len(entries) + 1)), 'Błędna numeracja ItemList')
    faqs = [n for n in nodes if n.get('@type') == 'FAQPage']
    visible_faq = [(a.h3.get_text(' ', strip=True), a.p.get_text(' ', strip=True)) for a in soup.select('.hub-faq-list article') if a.h3 and a.p]
    check(len(faqs) == 1 and [(n.get('name'), n.get('acceptedAnswer', {}).get('text')) for n in (faqs[0].get('mainEntity', []) if faqs else [])] == visible_faq, 'FAQ HTML i schema muszą być identyczne')
    evidence_node = soup.select_one('#hub-evidence')
    try:
        evidence = json.loads(evidence_node.string if evidence_node else '{}')
        research = evidence.get('faq_research', [])
        check([r.get('question') for r in research] == [q for q, a in visible_faq], 'Brak udokumentowanego researchu dla każdego FAQ')
        check(all(r.get('source_type') in ['manual_research', 'gsc', 'paa', 'autocomplete'] and r.get('research_note') and r.get('source_url') and r.get('checked_at') for r in research), 'Niekompletny research FAQ')
        claims = evidence.get('evidence_claims', [])
        check(len(claims) >= len(visible_faq), 'Brak mapowania tez FAQ do dowodów')
        registered = {source.get('url') for source in evidence.get('sources', [])}
        check(registered == set(sources), 'Rejestr źródeł nie odpowiada bibliografii')
        for claim in claims:
            target = soup.select_one(claim.get('location', '')) if claim.get('location') else None
            check(target is not None and bool(claim.get('claim')) and claim['claim'] in target.get_text(' ', strip=True), 'Teza nie występuje we wskazanym miejscu')
            cited = {a.get('href') for a in target.select('a[data-evidence]')} if target else set()
            check(bool(claim.get('source_urls')) and set(claim['source_urls']).issubset(registered & cited), 'Teza bez odpowiadającego jej odsyłacza do źródła')
        for research_item in research:
            check(research_item.get('source_url') in registered, 'Research FAQ nie wskazuje wykorzystanego źródła')
    except (ValueError, TypeError):
        errors.append('Niepoprawny rejestr dowodów centrum')
    check(bool(soup.select_one('main .medical-disclaimer')), 'Brak disclaimera w treści/PDF')
    pdf_link = soup.select_one('.hub-actions a[download]')
    check(pdf_link is not None and pdf_link.get('href', '').endswith('/' + file.stem + '.pdf'), 'Brak przycisku własnego PDF')
    return errors


if __name__ == '__main__':
    failed = False
    for name in sys.argv[1:]:
        errors = validate(Path(name).resolve())
        print(('FAIL' if errors else 'PASS') + ' topic-center: ' + name)
        for error in errors:
            print(' - ' + error)
        failed = failed or bool(errors)
    sys.exit(1 if failed else 0)
