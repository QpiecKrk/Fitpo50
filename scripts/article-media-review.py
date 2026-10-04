#!/usr/bin/env python3
"""Block publication until every article image has a hash-bound visual review."""

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

from bs4 import BeautifulSoup
from PIL import Image


CONTRACT = json.loads((Path(__file__).resolve().parent / 'contracts' / 'article-visual-review-v3.json').read_text())


SKIPPED_H2 = {
    'szybka odpowiedź',
    'szybkie odpowiedzi (q&a)?',
    'kluczowe wnioski',
    'najczęściej zadawane pytania',
    'źródła',
    'udostępnij artykuł',
    'czytaj też?',
    'w skrócie (ai)?',
    'cytaty do zapamiętania?',
}
REQUIRED_VARIANTS = tuple(CONTRACT['required_variants'])
ALLOWED_EMBEDDED_TEXT = tuple(CONTRACT['embedded_text_kinds'])


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def normalize(value):
    return re.sub(r'\s+', ' ', str(value or '')).strip().lower()


def relative_asset_path(value):
    return str(value or '').split()[0].removeprefix('./')


def inspect_picture(root, picture, placement, caption=''):
    img = picture.find('img')
    variants = {'jpg': relative_asset_path(img.get('src'))}
    for source in picture.find_all('source'):
        mime = str(source.get('type') or '')
        extension = mime.rsplit('/', 1)[-1]
        if extension in REQUIRED_VARIANTS:
            variants[extension] = relative_asset_path(source.get('srcset'))
    files = {}
    for extension in REQUIRED_VARIANTS:
        relative = variants.get(extension, '')
        path = root / relative
        if not relative or not path.is_file():
            files[extension] = {'file': relative, 'missing': True}
            continue
        with Image.open(path) as opened:
            width, height = opened.size
        files[extension] = {
            'file': relative,
            'sha256': sha256(path),
            'width': width,
            'height': height,
        }
    return {
        'placement': placement,
        'alt': str(img.get('alt') or '').strip(),
        'caption': caption.strip(),
        'width': int(img.get('width') or 0),
        'height': int(img.get('height') or 0),
        'variants': files,
    }


def expected_entries(root, html_path):
    soup = BeautifulSoup(html_path.read_text(), 'html.parser')
    entries = []
    hero = soup.select_one('section.article-intro-grid .article-hero picture')
    if hero:
        entries.append(inspect_picture(root, hero, 'hero'))
    article = soup.select_one('article.article-content')
    for h2 in article.select('h2') if article else []:
        title = h2.get_text(' ', strip=True)
        if normalize(title) in SKIPPED_H2 or h2.get('id') == 'zrodla':
            continue
        pictures = []
        node = h2.find_next_sibling()
        while node and node.name != 'h2':
            if node.name == 'figure' and node.find('picture'):
                pictures.append(node)
            node = node.find_next_sibling()
        for index, figure in enumerate(pictures, start=1):
            caption = figure.find('figcaption')
            placement = f'section:{title}' if index == 1 else f'section:{title}:image:{index}'
            entries.append(inspect_picture(root, figure.find('picture'), placement, caption.get_text(' ', strip=True) if caption else ''))
    return entries


def validate(root, slug, manifest_path=None):
    errors = []
    html_path = root / f'{slug}.html'
    manifest_path = manifest_path or root / 'data' / 'reports' / 'article-media-review' / f'{slug}.json'
    if not html_path.is_file():
        return [f'Brak HTML: {html_path}.']
    if not manifest_path.is_file():
        return [f'Brak obowiązkowego manifestu kontroli wizualnej: {manifest_path}.']
    try:
        manifest = json.loads(manifest_path.read_text())
    except (ValueError, OSError) as error:
        return [f'Nie można odczytać manifestu kontroli wizualnej: {error}.']
    version = manifest.get('version')
    if version not in (1, 2):
        errors.append('Manifest kontroli wizualnej wymaga version=2 albo zamrożonego manifestu legacy version=1.')
    if version == 1:
        legacy_path = root / 'data' / 'reports' / 'article-media-review-legacy-v1.json'
        try:
            legacy = json.loads(legacy_path.read_text())
        except (ValueError, OSError):
            legacy = {}
        expected_manifest_hash = legacy.get(slug) if isinstance(legacy, dict) else None
        if expected_manifest_hash != sha256(manifest_path):
            errors.append('Nowy lub zmieniony przegląd obrazu wymaga version=2; version=1 jest dozwolone tylko dla zamrożonych manifestów legacy.')
    if manifest.get('slug') != slug:
        errors.append('Slug manifestu kontroli wizualnej nie zgadza się z artykułem.')
    if manifest.get('status') != 'VERIFIED':
        errors.append('Manifest kontroli wizualnej wymaga status=VERIFIED.')
    if manifest.get('reviewed_html_sha256') != sha256(html_path):
        errors.append('HTML zmienił się po kontroli wizualnej; wymagany jest ponowny przegląd.')
    if len(str(manifest.get('reviewed_by') or '').strip()) < 3 or not re.match(r'^\d{4}-\d{2}-\d{2}T', str(manifest.get('reviewed_at') or '')):
        errors.append('Manifest wymaga reviewed_by i pełnego reviewed_at.')

    expected = expected_entries(root, html_path)
    actual = manifest.get('entries') if isinstance(manifest.get('entries'), list) else []
    expected_by_placement = {entry['placement']: entry for entry in expected}
    actual_by_placement = {entry.get('placement'): entry for entry in actual if isinstance(entry, dict)}
    if set(expected_by_placement) != set(actual_by_placement):
        errors.append('Manifest musi obejmować hero oraz każdy obraz obecny w sekcjach merytorycznych.')
    for placement, expected_entry in expected_by_placement.items():
        entry = actual_by_placement.get(placement, {})
        for field in ('alt', 'caption', 'width', 'height'):
            if entry.get(field) != expected_entry.get(field):
                errors.append(f'{placement}: {field} nie zgadza się z aktualnym HTML.')
        for extension in REQUIRED_VARIANTS:
            expected_variant = expected_entry.get('variants', {}).get(extension, {})
            if expected_variant.get('missing') is True:
                errors.append(f'{placement}: brak wymaganego pliku wariantu {extension}.')
            if entry.get('variants', {}).get(extension) != expected_variant:
                errors.append(f'{placement}: wariant {extension} lub jego hash/wymiary nie zgadzają się z plikiem.')
        review = entry.get('visual_review') if isinstance(entry.get('visual_review'), dict) else {}
        if review.get('status') != 'VERIFIED' or review.get('matches_topic') is not True:
            errors.append(f'{placement}: brak potwierdzenia zgodności obrazu z sekcją.')
        for flag in ('no_misleading_text_or_logo', 'anatomy_and_equipment_plausible'):
            if review.get(flag) is not True:
                errors.append(f'{placement}: visual_review.{flag} musi być jawnie potwierdzone.')
        if version == 2:
            embedded = review.get('embedded_text') if isinstance(review.get('embedded_text'), dict) else {}
            kind = embedded.get('kind')
            if kind not in ALLOWED_EMBEDDED_TEXT:
                errors.append(f'{placement}: visual_review.embedded_text.kind musi mieć wartość NONE, WATERMARK_ONLY, INCIDENTAL_ENVIRONMENT albo CONTENT.')
            if kind == 'INCIDENTAL_ENVIRONMENT':
                if len(str(embedded.get('transcription') or '').strip()) < 3:
                    errors.append(f'{placement}: czytelny napis środowiskowy wymaga krótkiej transkrypcji.')
                if embedded.get('claims_or_numbers_present') is not False:
                    errors.append(f'{placement}: napis środowiskowy nie może zawierać twierdzeń, liczb ani instrukcji wymagających dowodu.')
            if kind == 'CONTENT':
                if len(str(embedded.get('transcription') or '').strip()) < 3:
                    errors.append(f'{placement}: obraz z tekstem treściowym wymaga transkrypcji widocznego tekstu.')
                if embedded.get('claims_or_numbers_present') not in (True, False):
                    errors.append(f'{placement}: obraz z tekstem treściowym wymaga jawnej oceny claims_or_numbers_present.')
                if embedded.get('matches_article_claims') is not True:
                    errors.append(f'{placement}: tekst na obrazie musi być jawnie zgodny z treścią artykułu.')
                if embedded.get('claims_or_numbers_present') is True:
                    evidence = embedded.get('evidence_urls')
                    if not isinstance(evidence, list) or not evidence or any(not re.match(r'^https?://', str(url)) for url in evidence):
                        errors.append(f'{placement}: tekst z twierdzeniem lub liczbą wymaga co najmniej jednego URL dowodu.')
        if len(str(review.get('note') or '').strip()) < CONTRACT['note_min_length']:
            errors.append(f'{placement}: notatka z rzeczywistego przeglądu obrazu jest zbyt krótka.')
    return errors


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--slug', required=True)
    parser.add_argument('--manifest')
    args = parser.parse_args()
    root = Path.cwd()
    errors = validate(root, args.slug, Path(args.manifest).resolve() if args.manifest else None)
    if errors:
        for error in errors:
            print(f'[FAIL] {error}', file=sys.stderr)
        raise SystemExit(2)
    print(f'[MEDIA_REVIEW_VERIFIED] {args.slug}')


if __name__ == '__main__':
    main()
