#!/usr/bin/env python3
"""Waliduje surowy DRAFT Claude; nie zastępuje lokalnego Quality Gate FitPo50."""

from __future__ import annotations

import json
import math
import re
import sys
from collections import Counter
from datetime import date
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

CATEGORIES = {"zdrowie", "jedzenie", "ruch", "ciekawe", "mity"}
LOCAL_FIELDS = {"internal_link_plan", "incoming_link_suggestions", "intent_audit", "topic_center_assessment", "topic_center_approval", "media_manifest"}
REQUIRED_TEXT = (
    "title", "seo_title", "og_title", "twitter_title", "slug", "category",
    "meta_description", "og_description", "twitter_description", "schema_blogposting_description",
    "listing_title", "listing_desc", "lead", "quick_answer", "reading_time",
    "hero_motto_html", "search_intent", "primary_keyword",
)
EVIDENCE_LEVELS = {
    "guideline", "systematic_review", "meta_analysis", "randomized_trial", "cohort",
    "primary_research", "regulatory", "official_statistics", "official_guidance",
    "expert_consensus", "official_document", "price_list", "technical_documentation",
    "primary_source", "secondary_analysis",
}
CLAIM_TYPES = {"medical", "safety", "statistic", "price", "mechanism", "general"}
FAQ_TYPES = {"autocomplete", "paa", "manual_research"}
NOTE_FIELDS = ("uncertain_claims", "missing_evidence", "faq_gaps", "medical_risks", "assumptions", "local_pipeline_tasks")
QUESTION_STARTERS = ("czy ", "jak ", "dlaczego ", "ile ", "kiedy ", "co ", "który ", "która ", "jakie ")
PLACEHOLDER = re.compile(r"\b(todo|tbd|placeholder|do uzupełnienia|do doprecyzowania|wariant\s+\d+)\b|\{\{", re.I)
KEBAB = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*")
DATE = re.compile(r"\d{4}-\d{2}-\d{2}")


def words(value: Any) -> int:
    return len(re.findall(r"[\wĄĆĘŁŃÓŚŹŻąćęłńóśźż]+", re.sub(r"<[^>]+>", " ", str(value or "")), re.UNICODE))


def sentences(value: Any) -> int:
    return len(re.findall(r"[.!?](?:[\"'»”)]|\s|$)", re.sub(r"\b\d+[.,]\d+\b", "LICZBA", str(value or ""))))


def normalized(value: Any) -> str:
    return " ".join(re.sub(r"<[^>]+>", " ", str(value or "")).split()).casefold()


def is_https(value: Any) -> bool:
    if not isinstance(value, str):
        return False
    parsed = urlparse(value)
    return parsed.scheme == "https" and bool(parsed.netloc) and parsed.hostname not in {"localhost", "example.com"}


def is_date(value: Any) -> bool:
    if not isinstance(value, str) or not DATE.fullmatch(value):
        return False
    try:
        date.fromisoformat(value)
        return True
    except ValueError:
        return False


def string_list(value: Any, minimum: int = 0, maximum: int | None = None) -> bool:
    return isinstance(value, list) and len(value) >= minimum and (maximum is None or len(value) <= maximum) and all(isinstance(item, str) and item.strip() for item in value)


def walk_strings(value: Any) -> list[str]:
    if isinstance(value, str):
        return [value]
    if isinstance(value, list):
        return [item for child in value for item in walk_strings(child)]
    if isinstance(value, dict):
        return [item for child in value.values() for item in walk_strings(child)]
    return []


def locate(data: dict[str, Any], location: str) -> Any:
    current: Any = data
    parts = location.split(".")
    for part in parts:
        match = re.fullmatch(r"([A-Za-z_][A-Za-z0-9_]*)(?:\[(\d+)\])?", part)
        if not match:
            return None
        name, index_text = match.groups()
        if not isinstance(current, dict) or name not in current:
            return None
        current = current[name]
        if index_text:
            if not isinstance(current, list) or int(index_text) >= len(current):
                return None
            current = current[int(index_text)]
    return current


def validate(data: dict[str, Any]) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    for field in REQUIRED_TEXT:
        if not isinstance(data.get(field), str) or not data[field].strip():
            errors.append(f"Brak tekstowego pola {field}.")
    if data.get("status") != "DRAFT":
        errors.append('status musi mieć wartość "DRAFT".')
    if data.get("category") not in CATEGORIES:
        errors.append(f"Nieobsługiwana category: {data.get('category')!r}.")
    if not KEBAB.fullmatch(str(data.get("slug", ""))):
        errors.append("slug musi być kebab-case bez polskich znaków.")
    for field in LOCAL_FIELDS & data.keys():
        errors.append(f"{field} jest polem lokalnego pipeline i nie może powstać w Claude.")

    for field in ("title", "seo_title"):
        value = str(data.get(field, ""))
        if value and not 55 <= len(value) <= 65:
            errors.append(f"{field} ma {len(value)} znaków; wymagane 55–65.")
    if data.get("og_title") != data.get("seo_title") or data.get("twitter_title") != data.get("seo_title"):
        errors.append("og_title i twitter_title muszą być identyczne z seo_title.")
    descriptions = [str(data.get(field, "")) for field in ("meta_description", "og_description", "twitter_description", "schema_blogposting_description")]
    if len(set(descriptions)) != 1:
        errors.append("Cztery opisy SEO muszą być identyczne 1:1.")
    if descriptions[0] and not 145 <= len(descriptions[0]) <= 160:
        errors.append(f"Opis SEO ma {len(descriptions[0])} znaków; wymagane 145–160.")
    if descriptions[0] and descriptions[0][-1] not in ".!?":
        errors.append("Opis SEO musi kończyć się pełnym znakiem zdania.")
    quick = str(data.get("quick_answer", ""))
    if quick and not 45 <= words(quick) <= 70:
        errors.append(f"quick_answer ma {words(quick)} słów; wymagane 45–70.")
    if quick and not 1 <= sentences(quick) <= 3:
        errors.append(f"quick_answer ma {sentences(quick)} zdań; wymagane 1–3.")
    if not re.fullmatch(r"\d+ min czytania", str(data.get("reading_time", ""))):
        errors.append('reading_time musi mieć format "X min czytania".')
    if not string_list(data.get("supporting_keywords"), 3, 8):
        errors.append("supporting_keywords musi zawierać 3–8 niepustych fraz.")
    if not string_list(data.get("key_takeaways"), 3, 5):
        errors.append("key_takeaways musi zawierać 3–5 niepustych wniosków.")
    notes = data.get("editorial_notes")
    if not isinstance(notes, dict):
        errors.append("editorial_notes musi być obiektem.")
    else:
        for field in NOTE_FIELDS:
            if not string_list(notes.get(field), 0):
                errors.append(f"editorial_notes.{field} musi być listą tekstów (może być pustą).")

    sections = data.get("sections") if isinstance(data.get("sections"), list) else []
    if not sections:
        errors.append("Brak sections[].")
    elif len(sections) < 6:
        warnings.append(f"Tylko {len(sections)} sekcji; DRAFT_REVIEW_REQUIRED przed lokalnym gate.")
    for index, section in enumerate(sections):
        if not isinstance(section, dict):
            errors.append(f"sections[{index}] nie jest obiektem.")
            continue
        title_text, paragraphs = section.get("title"), section.get("paragraphs_html")
        if not isinstance(title_text, str) or not title_text.strip():
            errors.append(f"sections[{index}] nie ma title.")
        elif title_text.casefold().startswith(QUESTION_STARTERS) and not title_text.endswith("?"):
            errors.append(f"sections[{index}].title jest pytaniem bez znaku ?.")
        if not string_list(paragraphs, 1):
            errors.append(f"sections[{index}].paragraphs_html musi być niepustą listą tekstów.")
        elif not 30 <= words(paragraphs[0]) <= 70:
            errors.append(f"Pierwszy akapit sections[{index}] ma {words(paragraphs[0])} słów; wymagane 30–70.")
        if "image" in section:
            errors.append(f"sections[{index}].image jest polem lokalnym; użyj image_prompts_v4.")
    content_data = {key: value for key, value in data.items() if key != "editorial_notes"}
    joined = "\n".join(walk_strings(content_data))
    if re.search(r'href=["\'][^"\']*\.html', joined, re.I):
        errors.append("Claude nie może dodawać linków wewnętrznych *.html.")
    if PLACEHOLDER.search(joined):
        errors.append("Wykryto placeholder, sztuczny wariant lub wpis do uzupełnienia w treści JSON.")

    sources = data.get("sources") if isinstance(data.get("sources"), list) else []
    if not 5 <= len(sources) <= 8:
        warnings.append(f"Źródeł jest {len(sources)}; DRAFT_REVIEW_REQUIRED, jeśli brak nie jest uzasadniony.")
    source_urls: set[str] = set()
    for index, source in enumerate(sources):
        if not isinstance(source, dict):
            errors.append(f"sources[{index}] nie jest obiektem.")
            continue
        label, url = source.get("label"), source.get("url")
        if not isinstance(label, str) or len(label.strip()) < 12:
            errors.append(f"sources[{index}].label musi zawierać pełny tytuł/nazwę.")
        if not is_https(url):
            errors.append(f"sources[{index}].url nie jest prawidłowym publicznym HTTPS URL-em.")
        else:
            source_urls.add(url)
        if source.get("evidence_level") not in EVIDENCE_LEVELS:
            errors.append(f"sources[{index}].evidence_level ma niedozwoloną wartość.")
        if not is_date(source.get("checked_at")):
            errors.append(f"sources[{index}].checked_at musi być prawidłową datą YYYY-MM-DD.")
        status = source.get("url_status")
        if status not in {"reachable", "requires_local_verification"}:
            errors.append(f"sources[{index}].url_status ma niedozwoloną wartość.")
        if status == "reachable" and not isinstance(source.get("http_status"), int):
            errors.append(f"sources[{index}] reachable wymaga liczbowego http_status.")
        if status == "requires_local_verification" and "http_status" in source:
            errors.append(f"sources[{index}] nieweryfikowane nie może deklarować http_status.")
        year = source.get("publication_year")
        if year is not None and (not isinstance(year, int) or not 1900 <= year <= date.today().year):
            errors.append(f"sources[{index}].publication_year jest nieprawidłowy.")
        if source.get("evidence_level") in {"systematic_review", "meta_analysis", "randomized_trial", "cohort", "primary_research"} and not isinstance(year, int):
            errors.append(f"sources[{index}] publikacja naukowa wymaga publication_year.")
        if "doi_or_pmid" in source and not isinstance(source["doi_or_pmid"], str):
            errors.append(f"sources[{index}].doi_or_pmid musi być tekstem.")

    claims = data.get("evidence_claims") if isinstance(data.get("evidence_claims"), list) else []
    if not claims:
        errors.append("Brak evidence_claims.")
    used_urls: set[str] = set()
    for index, claim in enumerate(claims):
        if not isinstance(claim, dict):
            errors.append(f"evidence_claims[{index}] nie jest obiektem.")
            continue
        statement, location, urls = claim.get("claim"), claim.get("location"), claim.get("source_urls")
        if not isinstance(statement, str) or len(statement.strip()) < 8:
            errors.append(f"evidence_claims[{index}].claim jest zbyt krótkie lub puste.")
        if not isinstance(location, str) or locate(data, location) is None:
            errors.append(f"evidence_claims[{index}].location nie wskazuje istniejącego pola.")
        elif isinstance(statement, str) and normalized(statement) not in normalized(locate(data, location)):
            errors.append(f"evidence_claims[{index}].claim nie występuje dokładnie we wskazanym location.")
        if claim.get("claim_type") not in CLAIM_TYPES:
            errors.append(f"evidence_claims[{index}].claim_type ma niedozwoloną wartość.")
        if not string_list(urls, 1):
            errors.append(f"evidence_claims[{index}].source_urls musi być niepustą listą URL-i.")
        else:
            used_urls.update(urls)
    for url in sorted(source_urls - used_urls):
        errors.append(f"Dekoracyjne źródło bez evidence_claims: {url}")
    for url in sorted(used_urls - source_urls):
        errors.append(f"evidence_claims odwołuje się do URL-a spoza sources: {url}")

    logic_links = data.get("logic_links")
    if not isinstance(logic_links, list):
        errors.append("logic_links musi być listą (może być pustą).")
    else:
        for index, link in enumerate(logic_links):
            if not isinstance(link, dict):
                errors.append(f"logic_links[{index}] nie jest obiektem.")
                continue
            conclusion, premises = link.get("conclusion_location"), link.get("premise_locations")
            if not isinstance(conclusion, str) or locate(data, conclusion) is None:
                errors.append(f"logic_links[{index}].conclusion_location jest nieprawidłowe.")
            if not string_list(premises, 1) or any(locate(data, item) is None for item in premises):
                errors.append(f"logic_links[{index}].premise_locations musi wskazywać istniejące pola.")
            if not isinstance(link.get("reasoning"), str) or len(link["reasoning"].strip()) < 12:
                errors.append(f"logic_links[{index}].reasoning jest zbyt krótkie.")

    faq = data.get("answer_blocks") if isinstance(data.get("answer_blocks"), list) else []
    research = data.get("faq_research") if isinstance(data.get("faq_research"), list) else []
    faq_questions: list[str] = []
    for index, item in enumerate(faq):
        if not isinstance(item, dict) or not isinstance(item.get("question"), str) or not isinstance(item.get("answer_html"), str):
            errors.append(f"answer_blocks[{index}] wymaga tekstowych question i answer_html.")
            continue
        if not item["question"].strip().endswith("?") or words(item["answer_html"]) < 15:
            errors.append(f"answer_blocks[{index}] wymaga pytania z ? i konkretnej odpowiedzi.")
        faq_questions.append(item["question"].strip())
    research_questions: list[str] = []
    for index, item in enumerate(research):
        if not isinstance(item, dict):
            errors.append(f"faq_research[{index}] nie jest obiektem.")
            continue
        question, source_type = item.get("question"), item.get("source_type")
        if not isinstance(question, str) or not question.strip():
            errors.append(f"faq_research[{index}].question jest puste.")
        else:
            research_questions.append(question.strip())
        if source_type not in FAQ_TYPES:
            errors.append(f"faq_research[{index}].source_type ma niedozwoloną wartość.")
        for field in ("source_label", "query", "research_note"):
            if not isinstance(item.get(field), str) or len(item[field].strip()) < 5:
                errors.append(f"faq_research[{index}].{field} wymaga konkretnego opisu.")
        source_url = item.get("source_url")
        if not is_https(source_url):
            errors.append(f"faq_research[{index}].source_url musi być publicznym HTTPS URL-em.")
        host = urlparse(source_url).hostname if isinstance(source_url, str) else ""
        if source_type == "autocomplete" and host not in {"suggestqueries.google.com", "www.google.com", "google.com"}:
            errors.append(f"faq_research[{index}] autocomplete wymaga prawdziwego endpointu Google.")
        if source_type in {"paa", "manual_research"} and len(str(item.get("research_note", ""))) < 20:
            errors.append(f"faq_research[{index}] {source_type} wymaga sprawdzalnej notatki obserwacji.")
        if not is_date(item.get("checked_at")):
            errors.append(f"faq_research[{index}].checked_at musi być datą YYYY-MM-DD.")
        status = item.get("url_status")
        if status not in {"reachable", "requires_local_verification"}:
            errors.append(f"faq_research[{index}].url_status ma niedozwoloną wartość.")
        if status == "reachable" and not isinstance(item.get("http_status"), int):
            errors.append(f"faq_research[{index}] reachable wymaga liczbowego http_status.")
        if status == "requires_local_verification" and "http_status" in item:
            errors.append(f"faq_research[{index}] nieweryfikowane nie może deklarować http_status.")
    if len(faq_questions) < 4:
        warnings.append(f"FAQ ma {len(faq_questions)} pytań; DRAFT_REVIEW_REQUIRED i potrzebny dodatkowy research.")
    if Counter(faq_questions) != Counter(research_questions):
        errors.append("answer_blocks i faq_research nie odpowiadają sobie 1:1.")
    if len(faq_questions) != len(set(question.casefold() for question in faq_questions)):
        errors.append("FAQ zawiera duplikaty pytań.")

    prompts = data.get("image_prompts_v4") if isinstance(data.get("image_prompts_v4"), list) else []
    expected = {"hero", *(f"sekcja-{index + 1}" for index in range(len(sections)))}
    placements: list[str] = []
    filenames: list[str] = []
    techniques: list[str] = []
    compositions: list[str] = []
    for index, prompt in enumerate(prompts):
        if not isinstance(prompt, dict):
            errors.append(f"image_prompts_v4[{index}] nie jest obiektem.")
            continue
        placement = prompt.get("section_ref")
        if not isinstance(placement, str):
            errors.append(f"image_prompts_v4[{index}].section_ref musi być tekstem.")
            placement = ""
        placements.append(placement)
        limits = {"topic": 12, "technique": 4, "composition": 8, "purpose": 4, "prompt_en": 60, "alt_pl": 25, "caption_pl": 30, "negative_prompt": 20}
        for field, minimum in limits.items():
            if not isinstance(prompt.get(field), str) or len(prompt[field].strip()) < minimum:
                errors.append(f"image_prompts_v4[{index}].{field} wymaga co najmniej {minimum} znaków.")
        filename = prompt.get("filename_base")
        if not isinstance(filename, str) or not KEBAB.fullmatch(filename):
            errors.append(f"image_prompts_v4[{index}].filename_base musi być unikalnym kebab-case.")
        else:
            filenames.append(filename)
        ratio = prompt.get("aspect_ratio")
        match = re.fullmatch(r"(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)", str(ratio or ""))
        if not match or float(match.group(2)) == 0 or not 1.2 <= float(match.group(1)) / float(match.group(2)) <= 2.1:
            errors.append(f"image_prompts_v4[{index}].aspect_ratio musi być poprawną proporcją poziomą 1.2–2.1.")
        review = prompt.get("visual_review")
        if not isinstance(review, dict) or review.get("status") != "PENDING_LOCAL_REVIEW":
            errors.append(f"image_prompts_v4[{index}].visual_review.status musi być PENDING_LOCAL_REVIEW.")
        negative = str(prompt.get("negative_prompt", "")).casefold()
        if placement == "hero" and not all(term in negative for term in ("no text", "no lettering", "no numbers", "no logo", "no watermark", "no ui")):
            errors.append("Hero negative_prompt musi zakazywać tekstu, liter, liczb, logo, watermarku i UI.")
        techniques.append(str(prompt.get("technique", "")).strip().casefold())
        compositions.append(str(prompt.get("composition", "")).strip().casefold())
    missing, extra = sorted(expected - set(placements)), sorted(set(placements) - expected)
    if missing:
        errors.append(f"Brak promptów obrazów dla: {', '.join(missing)}.")
    if extra:
        errors.append(f"Nadmiarowe section_ref w obrazach: {', '.join(extra)}.")
    if len(placements) != len(set(placements)):
        errors.append("image_prompts_v4 zawiera powtórzony section_ref.")
    if len(filenames) != len(set(filenames)):
        errors.append("filename_base obrazów muszą być unikalne.")
    required_diversity = min(3, len(prompts))
    if len(set(techniques)) < required_diversity or len(set(compositions)) < required_diversity:
        errors.append("Pakiet obrazów wymaga minimum 3 technik i 3 kompozycji.")
    max_repeat = max(1, math.floor(len(prompts) / 2))
    if techniques and max(Counter(techniques).values()) > max_repeat:
        errors.append("Jedna technika dominuje w więcej niż połowie obrazów.")
    if compositions and max(Counter(compositions).values()) > max_repeat:
        errors.append("Jedna kompozycja dominuje w więcej niż połowie obrazów.")

    if data.get("category") == "mity":
        if not isinstance(data.get("myth_claim"), str) or not data["myth_claim"].strip():
            errors.append("Kategoria mity wymaga myth_claim.")
        if not all(token in joined.casefold() for token in ("<table", "<caption", "<thead", "<tbody")):
            errors.append("Artykuł mity wymaga semantycznej tabeli MIT–FAKT/DOWODY.")
    article_words = sum(words(value) for section in sections if isinstance(section, dict) for value in section.get("paragraphs_html", []) if isinstance(value, str))
    if article_words < 1500:
        warnings.append(f"Treść główna ma około {article_words} słów; sprawdź kompletność bez sztucznego rozciągania.")
    elif article_words > 3500:
        warnings.append(f"Treść główna ma około {article_words} słów; sprawdź powtórzenia.")
    return errors, warnings


def main() -> int:
    if len(sys.argv) != 2:
        print("Użycie: python3 validate_fitpo50_draft.py <plik.fitpo50.json>", file=sys.stderr)
        return 2
    try:
        data = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"[FAIL] Nie można odczytać JSON: {exc}", file=sys.stderr)
        return 2
    if not isinstance(data, dict):
        print("[FAIL] Korzeń JSON musi być obiektem.", file=sys.stderr)
        return 2
    errors, warnings = validate(data)
    for message in warnings:
        print(f"[WARN] {message}")
    for message in errors:
        print(f"[FAIL] {message}")
    if errors:
        print(f"[FAIL] errors={len(errors)} warnings={len(warnings)}")
        return 1
    status = "DRAFT_REVIEW_REQUIRED" if warnings else "DRAFT_VALID"
    print(f"[{status}] errors=0 warnings={len(warnings)}; to nie jest CONTENT_READY")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
