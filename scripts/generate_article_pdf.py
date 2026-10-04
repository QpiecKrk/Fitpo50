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
import json
import math
import os
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin


def _try_optional_path(path: str) -> None:
    """Allow using user-level temp dependencies without global install."""
    p = Path(path)
    if p.exists():
        sys.path.insert(0, str(p))


_try_optional_path("/tmp/pdfdeps")

from bs4 import BeautifulSoup, Tag, NavigableString  # type: ignore
from html import escape
from fpdf import FPDF  # type: ignore
from fpdf.enums import MethodReturnValue  # type: ignore
from fpdf.fonts import FontFace  # type: ignore
from fpdf.html import TextStyle  # type: ignore
from PIL import Image  # type: ignore


BASE_URL = "https://fitpo50.pl/"

TEXT_TAGS = {"p", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "blockquote"}
CONTAINER_TAGS = {"section", "div", "article", "aside"}
HTML_TAG_STYLES = {
    "code": FontFace(family="Arial"),
    "pre": TextStyle(font_family="Arial"),
}
HERO_IMAGE_WIDTH_RATIO = 0.92
HERO_IMAGE_MAX_HEIGHT = 78
INLINE_IMAGE_WIDTH_RATIO = 0.78
INLINE_IMAGE_MAX_HEIGHT = 68


def write_temp_workspace_owner(directory: Path, input_html: Path) -> None:
    """Mark the PDF workspace so interrupted runs can be cleaned safely later."""
    created_at = datetime.now(timezone.utc).isoformat()
    current_root = Path.cwd().resolve()
    parent_manifest_path = current_root / ".fitpo50-workspace.json"
    project_root = str(current_root)
    if parent_manifest_path.exists():
        try:
            parent_manifest = json.loads(parent_manifest_path.read_text(encoding="utf-8"))
            if parent_manifest.get("project_root"):
                project_root = str(Path(parent_manifest["project_root"]).resolve())
        except (OSError, ValueError, TypeError):
            pass
    manifest = {
        "version": 1,
        "workspace_type": "article-pdf-render",
        "pid": os.getpid(),
        "created_at": created_at,
        "updated_at": created_at,
        "project_root": project_root,
        "slug": input_html.stem,
        "status": "ACTIVE",
    }
    lock = {
        "version": 1,
        "pid": os.getpid(),
        "created_at": created_at,
        "project_root": project_root,
        "workspace_type": "article-pdf-render",
    }
    (directory / ".fitpo50-workspace.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (directory / ".fitpo50-workspace.lock").write_text(json.dumps(lock, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


class FitPo50PDF(FPDF):
    def footer(self) -> None:
        self.set_y(-10)
        self.set_font("Arial", size=8)
        self.set_text_color(105, 105, 105)
        self.cell(0, 5, f"FitPo50 | strona {self.page_no()}/{{nb}}", align="C")


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
    if pdf.y + display_h + caption_h > pdf.h - pdf.b_margin:
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
    # fpdf2 may leave the horizontal cursor at the right edge after a centered
    # caption. Reset it explicitly so the next heading cannot start outside
    # the printable area when the inline image is narrower than the page.
    pdf.set_x(pdf.l_margin)
    pdf.ln(2)


def render_node(pdf: FPDF, node: Tag, source_url: str, html_path: Path, tmp_dir: Path) -> None:
    # Przyciski i kanały udostępniania są użyteczne w HTML, ale w statycznym PDF
    # tworzą długi, nieaktywny blok i wypychają źródła na kolejną stronę.
    if "share-article-section" in (node.get("class") or []):
        return

    if node.name in {"figure", "picture", "img"}:
        img = node if node.name == "img" else node.find("img")
        if not img:
            return
        path = resolve_image_path(img.get("src", ""), html_path)
        if not path or not path.exists():
            raise RuntimeError(f"Brak ilustracji wymaganej przez HTML: {img.get('src', '')}")
        try:
            compressed = compress_image_to_jpg(path, tmp_dir=tmp_dir)
            caption_node = node.find("figcaption")
            caption = caption_node.get_text(" ", strip=True) if caption_node else ""
            add_image(pdf, compressed, caption=caption)
        except Exception as exc:
            raise RuntimeError(f"Nie można osadzić ilustracji {path.name}: {exc}") from exc
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
        has_spanning_cells = any(
            cell.get("colspan") or cell.get("rowspan")
            for cell in table.find_all(["td", "th"])
        )
        table.attrs = {"border": "1", "width": "100%"}
        # fpdf2's HTML table parser can leave an open cell when a TD contains
        # nested inline markup (for example <strong>), and then reports the
        # next TD as an illegal nested cell. PDFs need the complete cell text,
        # so normalize every cell to plain text before handing the table over.
        for cell in table.find_all(["td", "th"]):
            cell_text = cell.get_text(" ", strip=True)
            cell.clear()
            cell.append(cell_text)
        for element in table.find_all(True):
            if element.name == "a":
                href = normalize_href(element.get("href", ""), source_url)
                element.attrs = {"href": href} if href else {}
            elif element.name in {"td", "th"}:
                columns = max(len(element.parent.find_all(["td", "th"], recursive=False)), 1)
                first_row = table.find("tr")
                # fpdf2 justifies table-cell text by default. In narrow,
                # multi-column tables this can stretch a short phrase across
                # the full cell and make neighbouring columns look as if they
                # overlap. Keep prose left-aligned in every row while retaining
                # the explicit widths required by the first row.
                cell_attrs = {"align": "left"}
                for span_attr in ("colspan", "rowspan"):
                    if element.get(span_attr):
                        cell_attrs[span_attr] = element.get(span_attr)
                element.attrs = cell_attrs
                if element.parent is first_row:
                    element.attrs["width"] = f"{int(100 / columns)}%"
            elif element.name not in {"thead", "tbody", "tr", "caption"}:
                element.attrs = {}
        try:
            previous_size = pdf.font_size_pt
            if caption_text:
                pdf.set_font("Arial", "B", 9)
                pdf.multi_cell(0, 5, caption_text)
            pdf.set_font("Arial", size=8)
            rows = [
                [cell.get_text(" ", strip=True) for cell in row.find_all(["td", "th"], recursive=False)]
                for row in table.find_all("tr")
            ]
            column_counts = {len(row) for row in rows if row}
            if rows and column_counts == {len(rows[0])} and not has_spanning_cells:
                # The native table API permits an explicit text alignment.
                # write_html() defaults to justified cell text, which creates
                # distracting gaps in narrow columns and can visually merge
                # neighbouring cells.
                html_rows = table.find_all("tr")
                with pdf.table(
                    width=pdf.epw,
                    text_align="LEFT",
                    line_height=4,
                    padding=1,
                ) as pdf_table:
                    for html_row in html_rows:
                        pdf_row = pdf_table.row()
                        for cell in html_row.find_all(["td", "th"], recursive=False):
                            pdf_row.cell(
                                text=cell.get_text(" ", strip=True),
                                align="L",
                                style=FontFace(emphasis="B") if cell.name == "th" else None,
                            )
            else:
                # Preserve uncommon colspan/rowspan layouts via the HTML
                # renderer instead of flattening their structure.
                pdf.write_html(str(table), tag_styles=HTML_TAG_STYLES)
            pdf.set_font("Arial", size=previous_size)
        except Exception as exc:
            raise RuntimeError(f"Nie można poprawnie wyrenderować tabeli do PDF: {exc}") from exc
        pdf.set_font("Arial", size=11)
        pdf.ln(3)
        return

    if node.name == "div" and "article-quote" in (node.get("class") or []):
        # An editorial quote may contain an inline link. Treat the complete
        # container as one block; walking its children separately turns the
        # text before/inside/after the link into three paragraphs and can
        # leave punctuation alone on a new line in the PDF.
        quote_soup = BeautifulSoup("<blockquote></blockquote>", "html.parser")
        quote = quote_soup.find("blockquote")
        for child in list(node.contents):
            quote.append(BeautifulSoup(str(child), "html.parser"))
        render_node(pdf, quote, source_url=source_url, html_path=html_path, tmp_dir=tmp_dir)
        return

    if node.name == "p" and node.find(["table", "figure", "picture", "div", "section"]) is not None:
        # Legacy/imported HTML can contain a block element wrapped in <p>.
        # Passing that whole fragment to write_html() bypasses the dedicated
        # table/image renderers and, for tables, restores fpdf2's justified
        # cell text. Unwrap the invalid paragraph and route each child through
        # the normal block renderer.
        for child in node.children:
            if isinstance(child, Tag):
                render_node(pdf, child, source_url=source_url, html_path=html_path, tmp_dir=tmp_dir)
            elif isinstance(child, NavigableString) and str(child).strip():
                paragraph = BeautifulSoup(f"<p>{escape(str(child).strip())}</p>", "html.parser").find("p")
                if paragraph is not None:
                    render_node(pdf, paragraph, source_url=source_url, html_path=html_path, tmp_dir=tmp_dir)
        return

    if node.name in TEXT_TAGS:
        # FPDF can otherwise start a heading in the last lines of a page and
        # continue it after the automatic break, clipping the first words.
        # Reserve enough room for the complete heading and the opening lines
        # of the paragraph that follows it.
        if node.name in {"h2", "h3", "h4", "h5", "h6"}:
            remaining_height = pdf.h - pdf.b_margin - pdf.y
            inside_faq = node.find_parent(class_=lambda value: value and any(
                item in {"faq-list", "faq-section"} for item in (value if isinstance(value, list) else str(value).split())
            )) is not None
            next_tag = node.find_next_sibling()
            followed_by_image = next_tag is not None and next_tag.name in {"figure", "picture", "img"}
            if node.get("id") == "zrodla":
                required_height = 85
            elif inside_faq:
                required_height = 75
            elif followed_by_image:
                required_height = 90
            else:
                # A fixed 30 mm reserve still allowed a two-line H2 to sit
                # alone at the bottom of a page. Measure the actual heading
                # and keep at least the first three lines of the opening
                # paragraph with it. This preserves long sections without
                # forcing the whole paragraph onto the next page.
                original_family = pdf.font_family or "Arial"
                original_style = pdf.font_style
                original_size = pdf.font_size_pt or 11
                heading_sizes = {"h2": 16, "h3": 14, "h4": 12, "h5": 11, "h6": 10}
                pdf.set_font("Arial", "B", heading_sizes[node.name])
                heading_height = pdf.multi_cell(
                    0,
                    8,
                    node.get_text(" ", strip=True),
                    dry_run=True,
                    output=MethodReturnValue.HEIGHT,
                )
                opening_height = 16.5
                if next_tag is not None and next_tag.name == "p":
                    pdf.set_font("Arial", size=11)
                    opening_text = next_tag.get_text(" ", strip=True)
                    paragraph_height = pdf.multi_cell(
                        0,
                        5.5,
                        opening_text,
                        dry_run=True,
                        output=MethodReturnValue.HEIGHT,
                    )
                    page_body_height = pdf.h - pdf.t_margin - pdf.b_margin
                    # The paragraph renderer below moves short paragraphs as
                    # a whole. Reserve that same full height here, otherwise
                    # the heading may remain behind on the previous page.
                    if len(opening_text) <= 600 and paragraph_height + 3 <= page_body_height:
                        opening_height = paragraph_height + 3
                    else:
                        opening_height = min(paragraph_height, 16.5)
                pdf.set_font(original_family, original_style, original_size)
                required_height = heading_height + opening_height + 7
            if remaining_height < required_height:
                pdf.add_page()
        if node.name == "blockquote":
            # A short editorial quote is a single visual unit. FPDF may fit
            # its first line at the bottom and move only the final words to
            # the next page, which passes text checks but produces a broken
            # document. Estimate conservatively and move the whole quote.
            quote_text = node.get_text(" ", strip=True)
            estimated_lines = max(1, math.ceil(len(quote_text) / 80))
            required_height = 8 + estimated_lines * 7
            remaining_height = pdf.h - pdf.b_margin - pdf.y
            if remaining_height < required_height:
                pdf.add_page()
        fragment = sanitize_fragment(node, source_url=source_url)
        if not fragment:
            return
        try:
            # Move an ordinary short paragraph before rendering when it does
            # not fit in the remaining area. Otherwise FPDF can leave a
            # single final line (or even two words) at the top of the next
            # page. Longer passages may still split normally.
            paragraph_text = node.get_text(" ", strip=True)
            if node.name == "p" and len(paragraph_text) <= 600:
                estimated_height = pdf.multi_cell(
                    0,
                    5.5,
                    paragraph_text,
                    dry_run=True,
                    output=MethodReturnValue.HEIGHT,
                )
                remaining_height = pdf.h - pdf.b_margin - pdf.y
                page_body_height = pdf.h - pdf.t_margin - pdf.b_margin
                if estimated_height + 3 > remaining_height and estimated_height + 3 <= page_body_height:
                    pdf.add_page()
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
            elif isinstance(child, NavigableString) and str(child).strip():
                pdf.write_html(f"<p>{escape(str(child).strip())}</p>", tag_styles=HTML_TAG_STYLES)
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

    pdf = FitPo50PDF(format="A4")
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    # Unicode-capable fonts for Polish text.
    pdf.add_font("Arial", "", "/System/Library/Fonts/Supplemental/Arial.ttf")
    pdf.add_font("Arial", "B", "/System/Library/Fonts/Supplemental/Arial Bold.ttf")
    pdf.add_font("Arial", "I", "/System/Library/Fonts/Supplemental/Arial Italic.ttf")
    pdf.add_font("Arial", "BI", "/System/Library/Fonts/Supplemental/Arial Bold Italic.ttf")
    pdf.alias_nb_pages()
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
        write_temp_workspace_owner(tmp_dir, input_html)

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
                except Exception as exc:
                    raise RuntimeError(f"Nie można osadzić obrazu hero {hero_path.name}: {exc}") from exc

        pdf.set_font("Arial", size=11)
        quick_answer = soup.select_one('#quick-answer')
        if quick_answer is not None and article not in quick_answer.parents:
            render_node(pdf, quick_answer, source_url, input_html, tmp_dir)
        children = []
        for child in article.children:
            if isinstance(child, Tag):
                children.append(child)
            elif isinstance(child, NavigableString) and child.strip():
                paragraph = soup.new_tag('p')
                paragraph.string = str(child)
                children.append(paragraph)
        index = 0
        while index < len(children):
            child = children[index]
            is_sources = child.name in {"h2", "h3"} and (
                child.get("id") == "zrodla" or child.get_text(" ", strip=True).lower() in {"źródła", "źródła naukowe"}
            )
            if is_sources:
                block = [child]
                index += 1
                while index < len(children):
                    candidate = children[index]
                    if candidate.name in {"ol", "ul"} or "medical-disclaimer" in (candidate.get("class") or []):
                        block.append(candidate)
                        index += 1
                    else:
                        break
                # The heading renderer reserves 85 mm for the beginning of
                # the bibliography. This avoids an orphaned heading without
                # forcing a mostly empty page when the block still fits.
                for item in block:
                    render_node(pdf, item, source_url, input_html, tmp_dir)
            else:
                render_node(pdf, child, source_url, input_html, tmp_dir)
                index += 1

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
