import hashlib
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

from PIL import Image


SCRIPT = Path(__file__).resolve().parents[1] / 'scripts' / 'article-media-review.py'
SPEC = importlib.util.spec_from_file_location('article_media_review', SCRIPT)
REVIEW = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(REVIEW)


class ArticleMediaReviewTest(unittest.TestCase):
    def package(self, root):
        slug = 'proba-artykulu'
        assets = root / 'assets'
        assets.mkdir()
        for stem, color in [('hero', 'blue'), ('section', 'green')]:
            image = Image.new('RGB', (1200, 675), color)
            image.save(assets / f'{stem}.jpg')
            image.save(assets / f'{stem}.webp', 'WEBP')
            image.save(assets / f'{stem}.avif', 'AVIF')
        html = root / f'{slug}.html'
        html.write_text('''<section class="article-intro-grid"><figure class="article-hero"><picture>
          <source type="image/avif" srcset="./assets/hero.avif"><source type="image/webp" srcset="./assets/hero.webp">
          <img src="./assets/hero.jpg" alt="Konkretny obraz otwierający próbny artykuł" width="1200" height="675"></picture></figure></section>
          <article class="article-content"><h2>Co pokazuje badanie?</h2><p>Treść.</p><figure><picture>
          <source type="image/avif" srcset="./assets/section.avif"><source type="image/webp" srcset="./assets/section.webp">
          <img src="./assets/section.jpg" alt="Konkretny obraz badania w sekcji artykułu" width="1200" height="675"></picture>
          <figcaption>Obraz przedstawia konkretny przebieg badania omawianego w tej sekcji.</figcaption></figure>
          <h2 id="zrodla">Źródła</h2></article>''')
        entries = REVIEW.expected_entries(root, html)
        for entry in entries:
            entry['visual_review'] = {
                'status': 'VERIFIED', 'matches_topic': True, 'no_misleading_text_or_logo': True,
                'anatomy_and_equipment_plausible': True,
                'embedded_text': {'kind': 'NONE'},
                'note': 'Obejrzano cały kadr; przedstawia dokładnie temat przypisanej sekcji i nie zawiera artefaktów.',
            }
        manifest = root / 'review.json'
        manifest.write_text(json.dumps({
            'version': 2, 'status': 'VERIFIED', 'slug': slug,
            'reviewed_at': '2026-09-27T07:00:00+02:00', 'reviewed_by': 'Tester lokalny',
            'reviewed_html_sha256': hashlib.sha256(html.read_bytes()).hexdigest(), 'entries': entries,
        }))
        return slug, html, manifest

    def test_verified_hash_bound_review_passes(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            slug, _, manifest = self.package(root)
            self.assertEqual(REVIEW.validate(root, slug, manifest), [])

    def test_html_change_and_misleading_text_confirmation_block(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            slug, html, manifest = self.package(root)
            payload = json.loads(manifest.read_text())
            payload['entries'][0]['visual_review']['no_misleading_text_or_logo'] = False
            manifest.write_text(json.dumps(payload))
            html.write_text(html.read_text() + '<p>Zmiana po przeglądzie.</p>')
            errors = REVIEW.validate(root, slug, manifest)
            self.assertTrue(any('HTML zmienił się' in error for error in errors))
            self.assertTrue(any('no_misleading_text_or_logo' in error for error in errors))

    def test_missing_required_variant_blocks_even_when_manifest_matches(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            slug, _, manifest = self.package(root)
            (root / 'assets' / 'section.jpg').unlink()
            payload = json.loads(manifest.read_text())
            payload['entries'] = REVIEW.expected_entries(root, root / f'{slug}.html')
            for entry in payload['entries']:
                entry['visual_review'] = {
                    'status': 'VERIFIED', 'matches_topic': True, 'no_misleading_text_or_logo': True,
                    'anatomy_and_equipment_plausible': True,
                    'embedded_text': {'kind': 'NONE'},
                    'note': 'Obejrzano cały kadr; przedstawia dokładnie temat przypisanej sekcji i nie zawiera artefaktów.',
                }
            manifest.write_text(json.dumps(payload))
            errors = REVIEW.validate(root, slug, manifest)
            self.assertTrue(any('brak wymaganego pliku wariantu jpg' in error for error in errors))

    def test_content_text_with_claims_requires_transcription_and_evidence(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            slug, _, manifest = self.package(root)
            payload = json.loads(manifest.read_text())
            payload['entries'][1]['visual_review']['embedded_text'] = {
                'kind': 'CONTENT', 'claims_or_numbers_present': True, 'matches_article_claims': True,
            }
            manifest.write_text(json.dumps(payload))
            errors = REVIEW.validate(root, slug, manifest)
            self.assertTrue(any('transkrypcji' in error for error in errors))
            self.assertTrue(any('URL dowodu' in error for error in errors))

    def test_watermark_only_does_not_require_evidence(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            slug, _, manifest = self.package(root)
            payload = json.loads(manifest.read_text())
            payload['entries'][1]['visual_review']['embedded_text'] = {'kind': 'WATERMARK_ONLY'}
            manifest.write_text(json.dumps(payload))
            self.assertEqual(REVIEW.validate(root, slug, manifest), [])

    def test_changed_image_hash_invalidates_review(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            slug, _, manifest = self.package(root)
            Image.new('RGB', (1200, 675), 'red').save(root / 'assets' / 'section.jpg')
            errors = REVIEW.validate(root, slug, manifest)
            self.assertTrue(any('hash/wymiary nie zgadzają się' in error for error in errors))

    def test_wrong_anatomy_or_equipment_blocks_review(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            slug, _, manifest = self.package(root)
            payload = json.loads(manifest.read_text())
            payload['entries'][0]['visual_review']['anatomy_and_equipment_plausible'] = False
            manifest.write_text(json.dumps(payload))
            errors = REVIEW.validate(root, slug, manifest)
            self.assertTrue(any('anatomy_and_equipment_plausible' in error for error in errors))


if __name__ == '__main__':
    unittest.main()
