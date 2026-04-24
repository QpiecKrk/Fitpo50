#!/usr/bin/env python3
"""
Generate/update article PDFs and inject per-article hero download buttons.

Usage:
  python3 scripts/sync_article_pdfs_and_buttons.py
  python3 scripts/sync_article_pdfs_and_buttons.py --slug dieta-keto-cholesterol-ldl-hdl-badania-naukowe
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from urllib.parse import urljoin

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent

if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from generate_article_pdf import BASE_URL, generate_pdf  # noqa: E402

MARKER_START = "<!-- PDF_DOWNLOAD_BUTTON_START -->"
MARKER_END = "<!-- PDF_DOWNLOAD_BUTTON_END -->"


def is_article_page(path: Path) -> bool:
    if path.name == "article-template-bento.html":
        return False
    html = path.read_text(encoding="utf-8", errors="ignore")
    return '<main class="article-page"' in html and 'article-content' in html


def collect_article_files(slugs: list[str] | None) -> list[Path]:
    if slugs:
        files: list[Path] = []
        for slug in slugs:
            html_path = (REPO_ROOT / f"{slug}.html").resolve()
            if not html_path.exists():
                raise FileNotFoundError(f"Nie znaleziono pliku: {html_path}")
            if not is_article_page(html_path):
                raise RuntimeError(f"Plik nie wyglada jak strona artykulu: {html_path}")
            files.append(html_path)
        return sorted(files)

    files = [p.resolve() for p in REPO_ROOT.glob("*.html") if is_article_page(p)]
    return sorted(files)


def build_button_block(slug: str, size_kb: int) -> str:
    return (
        f"      {MARKER_START}\n"
        f'      <a class="pdf-hero-download" href="./assets/pdf/{slug}.pdf" download aria-label="Pobierz artykul w PDF ({size_kb} KB)">\n'
        f'        <span class="pdf-hero-download__eyebrow">Chcesz przeczytać na spokojnie? Pobierz PDF</span>\n'
        f'        <span class="pdf-hero-download__title">Pobierz artykul (PDF)</span>\n'
        f'        <span class="pdf-hero-download__meta">Rozmiar pliku: {size_kb} KB</span>\n'
        f'        <span class="pdf-hero-download__badge" aria-hidden="true">PDF</span>\n'
        f"      </a>\n"
        f"      {MARKER_END}\n"
    )


def find_blogposting_node(obj: object) -> dict | None:
    if isinstance(obj, dict):
        node_type = obj.get("@type")
        if node_type == "BlogPosting" or (isinstance(node_type, list) and "BlogPosting" in node_type):
            return obj
        for value in obj.values():
            found = find_blogposting_node(value)
            if found is not None:
                return found
        return None

    if isinstance(obj, list):
        for item in obj:
            found = find_blogposting_node(item)
            if found is not None:
                return found
    return None


def upsert_blogposting_pdf_schema(html_path: Path, slug: str) -> bool:
    html = html_path.read_text(encoding="utf-8")
    title_match = re.search(r'<h1 class="article-header__title">(.+?)</h1>', html, flags=re.DOTALL)
    title_text = re.sub(r"<[^>]+>", "", title_match.group(1)).strip() if title_match else slug
    pdf_url = urljoin(BASE_URL, f"assets/pdf/{slug}.pdf")
    media_object = {
        "@type": "MediaObject",
        "@id": f"{pdf_url}#media",
        "name": f"{title_text} (PDF)",
        "contentUrl": pdf_url,
        "encodingFormat": "application/pdf",
        "inLanguage": "pl-PL",
    }

    pattern = re.compile(
        r'(<script[^>]*type="application/ld\+json"[^>]*>\s*)(.*?)(\s*</script>)',
        flags=re.DOTALL | re.IGNORECASE,
    )
    replacement_done = False

    def _replace(match: re.Match[str]) -> str:
        nonlocal replacement_done
        if replacement_done:
            return match.group(0)

        content = match.group(2).strip()
        try:
            data = json.loads(content)
        except Exception:
            return match.group(0)

        blogposting = find_blogposting_node(data)
        if blogposting is None:
            return match.group(0)

        existing_encoding = blogposting.get("encoding")
        if existing_encoding is None:
            blogposting["encoding"] = media_object
        elif isinstance(existing_encoding, dict):
            if existing_encoding.get("@type") == "MediaObject" and "application/pdf" in str(
                existing_encoding.get("encodingFormat", "")
            ):
                existing_encoding.update(media_object)
            else:
                blogposting["encoding"] = [existing_encoding, media_object]
        elif isinstance(existing_encoding, list):
            replaced = False
            for entry in existing_encoding:
                if (
                    isinstance(entry, dict)
                    and entry.get("@type") == "MediaObject"
                    and (
                        "application/pdf" in str(entry.get("encodingFormat", ""))
                        or str(entry.get("contentUrl", "")).lower().endswith(".pdf")
                    )
                ):
                    entry.update(media_object)
                    replaced = True
                    break
            if not replaced:
                existing_encoding.append(media_object)
        else:
            blogposting["encoding"] = media_object

        replacement_done = True
        serialized = json.dumps(data, ensure_ascii=False, indent=2)
        return f"{match.group(1)}{serialized}{match.group(3)}"

    updated_html = pattern.sub(_replace, html)
    if replacement_done and updated_html != html:
        html_path.write_text(updated_html, encoding="utf-8")
        return True
    return False


def upsert_button(html_path: Path, slug: str, size_kb: int) -> bool:
    html = html_path.read_text(encoding="utf-8")
    block = build_button_block(slug=slug, size_kb=size_kb)

    # Always keep a single marker block and place it directly above article content.
    marker_pattern = re.compile(
        r"[ \t]*<!-- PDF_DOWNLOAD_BUTTON_START -->.*?<!-- PDF_DOWNLOAD_BUTTON_END -->\n?",
        flags=re.DOTALL,
    )
    html_without_marker = marker_pattern.sub("", html)

    article_match = re.search(r"^[ \t]*<article class=\"article-content\">", html_without_marker, flags=re.MULTILINE)
    if not article_match:
        raise RuntimeError(f"Nie znaleziono <article class=\"article-content\"> w: {html_path.name}")

    insert_at = article_match.start()
    updated = html_without_marker[:insert_at] + block + "\n" + html_without_marker[insert_at:]

    if updated != html:
        html_path.write_text(updated, encoding="utf-8")
        return True
    return False


def run(slugs: list[str] | None) -> int:
    article_files = collect_article_files(slugs=slugs)
    if not article_files:
        print("Brak artykulow do przetworzenia.")
        return 0

    updated_html_count = 0

    for html_path in article_files:
        slug = html_path.stem
        output_pdf = (REPO_ROOT / "assets" / "pdf" / f"{slug}.pdf").resolve()
        source_url = urljoin(BASE_URL, html_path.name)

        generate_pdf(input_html=html_path, output_pdf=output_pdf, source_url=source_url)

        size_bytes = output_pdf.stat().st_size
        size_kb = (size_bytes + 1023) // 1024

        changed_button = upsert_button(html_path=html_path, slug=slug, size_kb=size_kb)
        changed_schema = upsert_blogposting_pdf_schema(html_path=html_path, slug=slug)
        if changed_button or changed_schema:
            updated_html_count += 1

        print(f"[OK] {html_path.name} -> {output_pdf.name} ({size_kb} KB)")

    print(f"\nPrzetworzono artykulow: {len(article_files)}")
    print(f"Zaktualizowane pliki HTML: {updated_html_count}")
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate article PDFs and sync hero download buttons.")
    parser.add_argument(
        "--slug",
        action="append",
        dest="slugs",
        help="Article slug without .html. Repeatable, e.g. --slug a --slug b",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    raise SystemExit(run(slugs=args.slugs))
