#!/usr/bin/env python3
"""Compare published content with its machine-readable representation (read only)."""
import json
import re
import sys
from pathlib import Path
from urllib.parse import urlsplit
from bs4 import BeautifulSoup
from PIL import Image


CONTRACT = json.loads((Path(__file__).resolve().parent / 'contracts' / 'article-visual-review-v3.json').read_text())


def normalized(value):
    return ' '.join(BeautifulSoup(str(value or ''), 'html.parser').get_text(' ', strip=True).split())


def nodes(value):
    if isinstance(value, list):
        for item in value:
            yield from nodes(item)
    elif isinstance(value, dict):
        yield value
        yield from nodes(value.get('@graph', []))


def has_type(node, kind):
    value = node.get('@type', [])
    return kind in (value if isinstance(value, list) else [value])


def positive_dimension(value):
    try:
        parsed = int(str(value).strip())
    except (TypeError, ValueError):
        return 0
    return parsed if parsed > 0 else 0


def validate_picture(picture, label, root, errors, hero=False):
    img = picture.select_one('img')
    if img is None:
        errors.append(f'{label}: brak fallbacku IMG.')
        return ''
    if not picture.select_one('source[type="image/avif"]'):
        errors.append(f'{label}: brak wariantu AVIF.')
    if not picture.select_one('source[type="image/webp"]'):
        errors.append(f'{label}: brak wariantu WebP.')
    src = img.get('src', '').strip()
    if not re.search(r'\.jpe?g$', urlsplit(src).path, re.I):
        errors.append(f'{label}: fallback IMG musi być plikiem JPG.')
    if len(normalized(img.get('alt'))) < 20:
        errors.append(f'{label}: alt jest pusty, generyczny albo zbyt krótki.')
    width = positive_dimension(img.get('width'))
    height = positive_dimension(img.get('height'))
    if not width or not height:
        errors.append(f'{label}: brak lub niepoprawne deklarowane wymiary width/height.')
    layout = CONTRACT['image_layout']['hero' if hero else 'section']
    if width and height and (width / height < layout['min_aspect_ratio'] or width / height > layout['max_aspect_ratio']):
        errors.append(f'{label}: proporcja {width}x{height} jest poza zakresem {layout["min_aspect_ratio"]}–{layout["max_aspect_ratio"]}.')
    elif width and height and (width < layout['min_width'] or height < layout['min_height']):
        errors.append(f'{label}: obraz {width}x{height} jest mniejszy niż wymagane minimum.')
    figure = picture.find_parent('figure')
    if not hero and (figure is None or len(normalized(figure.find('figcaption'))) < 30):
        errors.append(f'{label}: wymagany jest konkretny figcaption o długości co najmniej 30 znaków.')
    if root and src:
        for candidate in [img, *picture.select('source')]:
            media_ref = (candidate.get('src') or candidate.get('srcset') or '').split()[0]
            if not media_ref or urlsplit(media_ref).scheme:
                continue
            media_file = Path(root) / urlsplit(media_ref).path.removeprefix('./')
            if not media_file.is_file():
                errors.append(f'{label}: brak lokalnego wariantu {media_ref}.')
                continue
            try:
                with Image.open(media_file) as image:
                    actual = image.size
                if width and height and actual != (width, height):
                    errors.append(f'{label}: deklarowane {width}x{height}, plik {media_ref} ma {actual[0]}x{actual[1]}.')
            except Exception as exc:
                errors.append(f'{label}: nie można odczytać {media_ref}: {exc}.')
    return urlsplit(src).path


def validate_sections_and_media(soup, article, root, errors):
    ignored_classes = {'quick-answer', 'key-takeaways', 'faq-section', 'faq-list', 'share-article-section', 'reading-room'}
    ignored_titles = {
        'kluczowe wnioski', 'najczęściej zadawane pytania', 'najczęściej zadawane pytania?',
        'zrodla', 'źródła', 'źródła naukowe', 'szybka odpowiedź', 'szybka odpowiedz',
        'szybkie odpowiedzi (q&a)?', 'szybkie odpowiedzi (aeo)?',
        'cytaty do zapamiętania?', 'cytaty do zapamiętania (geo)?',
        'w skrócie (ai)?', 'w skrócie (aio)?', 'czytaj też?'
    }
    def ignored(heading):
        if heading.get('id') == 'zrodla' or normalized(heading.get_text()).lower() in ignored_titles:
            return True
        return any(set(parent.get('class') or []) & ignored_classes for parent in heading.parents if getattr(parent, 'attrs', None) is not None)
    headings = [heading for heading in article.find_all('h2') if not ignored(heading)]
    if not headings:
        errors.append('Artykuł nie ma żadnej głównej sekcji H2.')
    sections = {id(heading): [] for heading in headings}
    current = None
    for node in article.descendants:
        if getattr(node, 'name', None) == 'h2' and node in headings:
            current = node
        elif current is not None and getattr(node, 'name', None) == 'picture':
            if not any(parent.name == 'picture' for parent in node.parents if parent is not article):
                sections[id(current)].append(node)
    sources = []
    for heading in headings:
        pictures = sections[id(heading)]
        title = normalized(heading.get_text())
        if not pictures:
            errors.append(f'Sekcja „{title}” wymaga co najmniej jednego odrębnego obrazu; znaleziono 0.')
            continue
        for index, picture in enumerate(pictures, start=1):
            label = f'Sekcja „{title}”' if index == 1 else f'Sekcja „{title}”, obraz {index}'
            sources.append(validate_picture(picture, label, root, errors))
    if len([source for source in sources if source]) != len(set(source for source in sources if source)):
        errors.append('Obrazy sekcji muszą być odrębne; wykryto powtórzony fallback JPG.')
    hero_pictures = soup.select('section.article-intro-grid .article-hero picture')
    if len(hero_pictures) != 1:
        errors.append(f'Hero wymaga dokładnie jednego elementu PICTURE; znaleziono {len(hero_pictures)}.')
    else:
        validate_picture(hero_pictures[0], 'Hero', root, errors, hero=True)


def validate(raw, root=None, filename=None):
    soup = BeautifulSoup(raw, 'html.parser')
    errors = []
    article = soup.select_one('article.article-content')
    if article is None:
        return {'errors': ['Brak article.article-content.']}
    validate_sections_and_media(soup, article, root, errors)
    schema = []
    for script in soup.select('script[type="application/ld+json"]'):
        try:
            schema.extend(nodes(json.loads(script.string or script.get_text())))
        except (ValueError, TypeError):
            errors.append('Niepoprawny JSON-LD.')
    postings = [n for n in schema if has_type(n, 'BlogPosting')]
    faqs = [n for n in schema if has_type(n, 'FAQPage')]
    if len(faqs) > 1:
        errors.append('JSON-LD zawiera więcej niż jeden FAQPage; pozostaw jeden zgodny z widocznym FAQ.')
    visible_faq = []
    for item in article.select('.faq-item'):
        question = item.select_one('h3, summary')
        if question is None:
            errors.append('FAQ bez pytania h3/summary.')
            continue
        question_text = normalized(question.get_text(' ', strip=True))
        copy = BeautifulSoup(str(item), 'html.parser')
        copy.select_one('h3, summary').decompose()
        visible_faq.append((question_text, normalized(copy.get_text(' ', strip=True))))
    schema_faq = []
    for faq in faqs:
        for question in faq.get('mainEntity', []):
            answer = question.get('acceptedAnswer', {})
            schema_faq.append((normalized(question.get('name')), normalized(answer.get('text'))))
    if visible_faq != schema_faq:
        errors.append('FAQ schema nie odpowiada pytaniom i odpowiedziom widocznym w HTML (1:1).')
    source_heading = next((h for h in article.find_all(['h2','h3']) if h.get('id') == 'zrodla' or normalized(h.get_text()).lower() in ['źródła','źródła naukowe']), None)
    source_urls = []
    if source_heading:
        listing = source_heading.find_next(['ol', 'ul'])
        if listing and article in listing.parents:
            source_urls = [a.get('href','').strip() for a in listing.select('a[href]')]
    for posting in postings:
        citations = posting.get('citation', [])
        if not isinstance(citations, list):
            citations = [citations]
        urls = [str(c.get('url', c.get('@id','')) if isinstance(c, dict) else c).strip() for c in citations]
        if sorted(urls) != sorted(source_urls) or len(set(urls)) != len(urls):
            errors.append('BlogPosting.citation nie odpowiada bibliografii HTML 1:1 lub zawiera duplikaty.')
    for url in source_urls:
        parsed = urlsplit(url)
        if parsed.hostname in ['pubmed.ncbi.nlm.nih.gov', 'pmc.ncbi.nlm.nih.gov'] and (parsed.path in ['', '/'] or '/search' in parsed.path):
            errors.append('Bibliografia zawiera wyniki wyszukiwania zamiast konkretnej publikacji: '+url)
    targets = set()
    excluded = ['.faq-section', '.faq-item', '.share-article-section', '.reading-room']
    for link in article.select('p a[href]'):
        if any(link.find_parent(class_=c[1:]) for c in excluded):
            continue
        href = link.get('href','')
        parsed = urlsplit(href)
        if parsed.scheme or parsed.netloc:
            if parsed.hostname == 'fitpo50.pl':
                errors.append('Link wewnętrzny musi być względny: '+href)
            continue
        target = parsed.path.removeprefix('./')
        if not re.fullmatch(r'[a-z0-9-]+\.html', target) or target == filename:
            continue
        if root:
            file = Path(root)/target
            if not file.is_file():
                errors.append('Cel linku nie istnieje: '+target)
                continue
            if not re.search(r'"@type"\s*:\s*(?:\[\s*)?"BlogPosting"', file.read_text()):
                continue
        targets.add(target)
    if len(targets) < 4:
        errors.append(f'Za mało unikalnych kontekstowych linków do artykułów: {len(targets)} (minimum 4).')
    return {'errors': errors, 'contextual_targets': sorted(targets), 'visible_sources':source_urls}


if __name__ == '__main__':
    if sys.argv[1:] == ['--stdin']:
        result = validate(sys.stdin.read())
    else:
        file = Path(sys.argv[1]).resolve()
        result = validate(file.read_text(),file.parent,file.name)
    print(json.dumps(result,ensure_ascii=False))
