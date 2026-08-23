#!/usr/bin/env python3
"""
Generate a lightweight PDF from a FitPo50 article HTML file.

Output contains:
- source URL at the top,
- article title,
- article body only (no menu/footer/reading-room),
- compressed inline images,
- clickable links with internal relative URLs normalized to absolute URLs.
"""

from __future__ import annotations

import argparse
import sys
import tempfile
from pathlib import Path
from urllib.parse import urljoin


def _try_optional_path(path: str) -> None:
    """Allow using user-level temp dependencies without global install."""
    p = Path(path)
    if p.exists():
        sys.path.insert(0, str(p))


_try_optional_path("/tmp/pdfdeps")

from bs4 import BeautifulSoup, Tag  # type: ignore
from fpdf import FPDF  # type: ignore
from fpdf.fonts import FontFace  # type: ignore
from fpdf.html import TextStyle  # type: ignore
from PIL import Image  # type: ignore


BASE_URL = "https://fitpo50.pl/"

TEXT_TAGS = {"p", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "blockquote"}
CONTAINER_TAGS = {"section", "div", "article"}
HTML_TAG_STYLES = {
    "code": FontFace(family="Arial"),
    "pre": TextStyle(font_family="Arial"),
}
HERO_IMAGE_WIDTH_RATIO = 0.92
HERO_IMAGE_MAX_HEIGHT = 78
INLINE_IMAGE_WIDTH_RATIO = 0.78
INLINE_IMAGE_MAX_HEIGHT = 68


def normalize_href(href: str, source_url: str) -> str:
    href = (href or "").strip()
    if not href:
        return ""
    if href.startswith(("http://", "https://", "mailto:", "tel:")):
        return href
    if href.startswith("#"):
        return f"{source_url}{href}"
    return urljoin(source_url, href)


def sanitize_fragment(tag: Tag, source_url: str) -> str:
    soup = BeautifulSoup(str(tag), "html.parser")
    root = next((n for n in soup.contents if isinstance(n, Tag)), None)
    if root is None:
        return ""

    for el in root.find_all(True):
        if el.name == "a":
            href = normalize_href(el.get("href", ""), source_url)
            el.attrs = {"href": href} if href else {}
        elif el.name == "br":
            el.attrs = {}
        elif el.name == "img":
            # Images are handled separately.
            el.decompose()
        else:
            el.attrs = {}
    return str(root)


def resolve_image_path(img_src: str, html_path: Path) -> Path | None:
    src = (img_src or "").strip()
    if not src:
        return None
    if src.startswith(("http://", "https://")):
        return None
    return (html_path.parent / src).resolve()


def compress_image_to_jpg(src_path: Path, tmp_dir: Path, max_width: int = 1200, quality: int = 55) -> Path:
    with Image.open(src_path) as img:
        img = img.convert("RGB")
        if img.width > max_width:
            new_height = int(img.height * (max_width / img.width))
            img = img.resize((max_width, new_height), Image.Resampling.LANCZOS)

        out_path = tmp_dir / f"{src_path.stem}.pdf.jpg"
        img.save(out_path, format="JPEG", quality=quality, optimize=True, progressive=True)
    return out_path


def add_image(
    pdf: FPDF,
    image_path: Path,
    *,
    width_ratio: float = INLINE_IMAGE_WIDTH_RATIO,
    max_height: float = INLINE_IMAGE_MAX_HEIGHT,
    caption: str = "",
) -> None:
    with Image.open(image_path) as img:
        w_px, h_px = img.size
    display_w = pdf.epw * width_ratio
    display_h = display_w * (h_px / w_px)
    if display_h > max_height:
        display_h = max_height
        display_w = display_h * (w_px / h_px)

    caption_h = 8 if caption else 0
    if pdf.get_y() + display_h + caption_h > pdf.h - pdf.b_margin:
        pdf.add_page()
    x = pdf.l_margin + max((pdf.epw - display_w) / 2, 0)
    pdf.image(str(image_path), x=x, w=display_w, h=display_h)
    pdf.ln(2)
    if caption:
        pdf.set_font("Arial", "I", 8)
        pdf.set_text_color(90, 90, 90)
        pdf.multi_cell(0, 4, caption, align="C")
        pdf.set_font("Arial", size=11)
        pdf.set_text_color(0, 0, 0)
    pdf.ln(2)


def render_node(pdf: FPDF, node: Tag, source_url: str, html_path: Path, tmp_dir: Path) -> None:
    # Przyciski i kanały udostępniania są użyteczne w HTML, ale w statycznym PDF
    # tworzą długi, nieaktywny blok i wypychają źródła na kolejną stronę.
    if "share-article-section" in (node.get("class") or []):
        return

    if node.name == "figure":
        img = node.find("img")
        if not img:
            return
        path = resolve_image_path(img.get("src", ""), html_path)
        if not path or not path.exists():
            return
        try:
            compressed = compress_image_to_jpg(path, tmp_dir=tmp_dir)
            caption_node = node.find("figcaption")
            caption = caption_node.get_text(" ", strip=True) if caption_node else ""
            add_image(pdf, compressed, caption=caption)
        except Exception:
            return
        return

    if node.name == "table":
        fragment_soup = BeautifulSoup(str(node), "html.parser")
        table = fragment_soup.find("table")
        if table is None:
            return
        caption = table.find("caption")
        caption_text = caption.get_text(" ", strip=True) if caption else ""
        if caption:
            caption.decompose()
        table.attrs = {"border": "1", "width": "100%"}
        for element in table.find_all(True):
            if element.name == "a":
                href = normalize_href(element.get("href", ""), source_url)
                element.attrs = {"href": href} if href else {}
            elif element.name in {"td", "th"}:
                columns = max(len(element.parent.find_all(["td", "th"], recursive=False)), 1)
                first_row = table.find("tr")
                element.attrs = {"width": f"{int(100 / columns)}%"} if element.parent is first_row else {}
            elif element.name not in {"thead", "tbody", "tr", "caption"}:
                element.attrs = {}
        try:
            previous_size = pdf.font_size_pt
            if caption_text:
                pdf.set_font("Arial", "B", 9)
                pdf.multi_cell(0, 5, caption_text)
            pdf.set_font("Arial", size=8)
            pdf.write_html(str(table), tag_styles=HTML_TAG_STYLES)
            pdf.set_font("Arial", size=previous_size)
        except Exception:
            if caption_text:
                pdf.set_font("Arial", "B", 9)
                pdf.multi_cell(0, 5, caption_text)
            pdf.set_font("Arial", size=8)
            for row in node.find_all("tr"):
                cells = [cell.get_text(" ", strip=True) for cell in row.find_all(["th", "td"], recursive=False)]
                if cells:
                    pdf.multi_cell(0, 4, " | ".join(cells))
        pdf.set_font("Arial", size=11)
        pdf.ln(3)
        return

    if node.name in TEXT_TAGS:
        fragment = sanitize_fragment(node, source_url=source_url)
        if not fragment:
            return
        try:
            pdf.write_html(fragment, tag_styles=HTML_TAG_STYLES)
        except Exception:
            text = node.get_text(" ", strip=True)
            if text:
                if pdf.page == 0:
                    pdf.add_page()
                pdf.set_font("Arial", size=11)
                pdf.set_text_color(0, 0, 0)
                pdf.multi_cell(0, 6, text)
        pdf.ln(2)
        return

    if node.name in CONTAINER_TAGS:
        for child in node.children:
            if isinstance(child, Tag):
                render_node(pdf, child, source_url=source_url, html_path=html_path, tmp_dir=tmp_dir)
        return

    text = node.get_text(" ", strip=True)
    if text:
        if pdf.page == 0:
            pdf.add_page()
        pdf.set_font("Arial", size=11)
        pdf.set_text_color(0, 0, 0)
        pdf.multi_cell(0, 6, text)
        pdf.ln(2)


def generate_pdf(input_html: Path, output_pdf: Path, source_url: str) -> None:
    html = input_html.read_text(encoding="utf-8")
    soup = BeautifulSoup(html, "html.parser")

    article = soup.select_one("article.article-content")
    if article is None:
        raise RuntimeError("Nie znaleziono selektora: article.article-content")

    title_node = soup.select_one("h1.article-header__title")
    title = title_node.get_text(" ", strip=True) if title_node else input_html.stem

    hero_image_node = soup.select_one("section.article-intro-grid .article-hero img")

    pdf = FPDF(format="A4")
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    # Unicode-capable fonts for Polish text.
    pdf.add_font("Arial", "", "/System/Library/Fonts/Supplemental/Arial.ttf")
    pdf.add_font("Arial", "B", "/System/Library/Fonts/Supplemental/Arial Bold.ttf")
    pdf.add_font("Arial", "I", "/System/Library/Fonts/Supplemental/Arial Italic.ttf")
    pdf.add_font("Arial", "BI", "/System/Library/Fonts/Supplemental/Arial Bold Italic.ttf")
    pdf.set_lang("pl-PL")
    pdf.set_author("FitPo50")
    pdf.set_creator("FitPo50 PDF Generator")
    pdf.set_subject(f"Artykul FitPo50: {title}")

    pdf.set_font("Arial", size=9)
    pdf.set_text_color(90, 90, 90)
    pdf.write(5, "Źródło: ")
    pdf.set_text_color(0, 82, 163)
    pdf.write(5, source_url, link=source_url)
    pdf.ln(8)

    pdf.set_text_color(0, 0, 0)
    pdf.set_font("Arial", "B", 16)
    pdf.multi_cell(0, 8, title)
    pdf.ln(2)

    with tempfile.TemporaryDirectory(prefix="fitpo50_pdf_") as tmp:
        tmp_dir = Path(tmp)

        if hero_image_node:
            hero_path = resolve_image_path(hero_image_node.get("src", ""), input_html)
            if hero_path and hero_path.exists():
                try:
                    hero_compressed = compress_image_to_jpg(hero_path, tmp_dir=tmp_dir)
                    add_image(
                        pdf,
                        hero_compressed,
                        width_ratio=HERO_IMAGE_WIDTH_RATIO,
                        max_height=HERO_IMAGE_MAX_HEIGHT,
                    )
                except Exception:
                    pass

        pdf.set_font("Arial", size=11)
        for child in article.children:
            if isinstance(child, Tag):
                render_node(pdf, child, source_url=source_url, html_path=input_html, tmp_dir=tmp_dir)

    # Keep PDF metadata stable and SEO-friendly (avoid generic "Kluczowe wnioski" titles).
    pdf.set_title(title)

    output_pdf.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(output_pdf))


def build_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate lightweight article PDF from FitPo50 HTML.")
    parser.add_argument("--input", required=True, help="Input HTML path, e.g. dieta-keto-...html")
    parser.add_argument("--output", required=False, help="Output PDF path (default: assets/pdf/<slug>.pdf)")
    parser.add_argument(
        "--source-url",
        required=False,
        help="Public source URL shown at top (default: https://fitpo50.pl/<input_file_name>)",
    )
    return parser.parse_args()


def main() -> int:
    args = build_args()
    input_html = Path(args.input).resolve()
    if not input_html.exists():
        print(f"Brak pliku wejściowego: {input_html}", file=sys.stderr)
        return 1

    default_source = urljoin(BASE_URL, input_html.name)
    source_url = args.source_url or default_source

    if args.output:
        output_pdf = Path(args.output).resolve()
    else:
        output_pdf = (Path.cwd() / "assets" / "pdf" / f"{input_html.stem}.pdf").resolve()

    generate_pdf(input_html=input_html, output_pdf=output_pdf, source_url=source_url)
    print(f"Wygenerowano PDF: {output_pdf}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
