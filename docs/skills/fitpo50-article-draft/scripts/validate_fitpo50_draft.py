#!/usr/bin/env python3
"""Waliduje surowy DRAFT Claude; nie zastępuje lokalnego Quality Gate FitPo50."""

from __future__ import annotations

import json
import re
import sys
from datetime import date
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse

CATEGORIES = {"zdrowie", "jedzenie", "ruch", "ciekawe", "mity"}
SEARCH_INTENTS = {
    "how-to", "czy-warto", "objawy", "normy", "bezpieczenstwo", "definicja",
    "porownanie", "informacyjna", "plan", "koszt", "dawkowanie",
}
LOCAL_FIELDS = {"internal_link_plan", "incoming_link_suggestions", "intent_audit", "topic_center_assessment", "topic_center_approval", "media_manifest", "evidence_verification"}
ARTICLE_CONTRACT = json.loads((Path(__file__).resolve().parent.parent / "references" / "article-contract.json").read_text(encoding="utf-8"))
MIN_MEDICAL_SOURCES = int(ARTICLE_CONTRACT["medical_source_minimum"])
FAQ_SOURCE_REQUIREMENTS = ARTICLE_CONTRACT["faq_source_requirements"]
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
NOTE_FIELDS = ("uncertain_claims", "missing_evidence", "faq_gaps", "medical_risks", "assumptions", "local_pipeline_tasks")
QUESTION_STARTERS = ("czy ", "jak ", "dlaczego ", "ile ", "kiedy ", "co ", "który ", "która ", "jakie ")
PLACEHOLDER = re.compile(r"\b(todo|tbd|placeholder|do uzupełnienia|do doprecyzowania|wariant\s+\d+)\b|\{\{", re.I)
KEBAB = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*")
DATE = re.compile(r"\d{4}-\d{2}-\d{2}")
INCOMPLETE_TITLE = re.compile(r"(?:[:;,–-]|\b(?:a|ale|albo|bo|czy|dla|do|i|na|o|od|po|przy|w|z|ze))\s*$", re.I)
BLOCK_IN_PARAGRAPH = re.compile(r"<(?:div|table|figure|aside|ul|ol|blockquote|pre)\b", re.I)
QUICK_CONDITION = re.compile(r"\b(?:jeśli|jezeli|gdy|kiedy|u osób po 50|przy wyniku)\b", re.I)
QUICK_NUMBER = re.compile(r"\b\d+(?:[.,]\d+)?(?:\s*[–-]\s*\d+(?:[.,]\d+)?)?\b")
BANNED_SEO_TITLES = ("kompletny przewodnik", "praktyczny przewodnik", "wszystko co musisz wiedzieć")
BANNED_META = (
    "ten artykuł porządkuje najważniejsze fakty",
    "po 50-tce warto patrzeć na zdrowie szerzej",
    "po 50-tce najlepsze efekty daje prosty plan",
)


def words(value: Any) -> int:
    return len(re.findall(r"[\wĄĆĘŁŃÓŚŹŻąćęłńóśźż]+", re.sub(r"<[^>]+>", " ", str(value or "")), re.UNICODE))


def sentences(value: Any) -> int:
    clean = " ".join(re.sub(r"<[^>]+>", " ", str(value or "")).split())
    if not clean:
        return 0
    marker = "¤"
    protected = re.sub(r"(?<=\d)[.,](?=\d)", marker, clean)

    def protect_abbreviation(match: re.Match[str]) -> str:
        token = match.group(0)
        suffix = protected[match.end():]
        if not re.sub(r"^[\"'»”)]*", "", suffix).strip():
            return token[:-1].replace(".", marker) + "."
        return token.replace(".", marker)

    protected = re.sub(r"\b(?:m\.in|p\.n\.e)\.", protect_abbreviation, protected, flags=re.I)
    protected = re.sub(
        r"\b(?:np|dr|prof|mgr|lek|inż|ok|tzw|tj|tzn|itp|itd|ul|al|św|vs|nr|godz|min|sek|r)\.",
        protect_abbreviation,
        protected,
        flags=re.I,
    )
    return len(re.findall(r"[.!?]+(?=(?:[\"'»”)]|\s|$))", protected))


def normalized(value: Any) -> str:
    return " ".join(re.sub(r"<[^>]+>", " ", str(value or "")).split()).casefold()


def plain_text(value: Any) -> str:
    return " ".join(re.sub(r"<[^>]+>", " ", str(value or "")).split())


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


def is_search_results_url(value: Any) -> bool:
    if not isinstance(value, str):
        return False
    parsed = urlparse(value)
    host = (parsed.hostname or "").casefold()
    path = parsed.path.rstrip("/").casefold()
    query = parsed.query.casefold()
    if host.startswith("www."):
        host = host[4:]
    if host.startswith("google.") and path == "/search":
        return True
    if host == "pubmed.ncbi.nlm.nih.gov" and not re.fullmatch(r"/\d+", path):
        return bool(query or not path)
    if host in {"ncbi.nlm.nih.gov", "www.ncbi.nlm.nih.gov"} and "/pmc" in path and ("term=" in query or path.endswith("/pmc")):
        return True
    return False


def validate_semantic_html(value: str, label: str, errors: list[str]) -> None:
    for paragraph in re.findall(r"<p\b[^>]*>([\s\S]*?)</p>", value, re.I):
        if BLOCK_IN_PARAGRAPH.search(paragraph):
            errors.append(f"{label} zawiera blok semantyczny wewnątrz <p>; tabela/div/figura musi być osobnym blokiem.")
            break
    for table in re.findall(r"<table\b[\s\S]*?</table>", value, re.I):
        table_lower = table.casefold()
        if "article-table" not in table_lower:
            errors.append(f"{label}: tabela wymaga klasy article-table.")
        for required_tag in ("<caption", "<thead", "<tbody"):
            if required_tag not in table_lower:
                errors.append(f"{label}: tabela wymaga znacznika {required_tag}>.")
        if not re.search(r"<th\b[^>]*scope=[\"']col[\"']", table, re.I):
            errors.append(f'{label}: tabela wymaga nagłówka th scope="col".')
        if not re.search(r"<th\b[^>]*scope=[\"']row[\"']", table, re.I):
            errors.append(f'{label}: tabela wymaga nagłówka th scope="row".')
        table_start = value.casefold().find(table_lower)
        wrapper_start = value.casefold().rfind("article-table-wrap", 0, table_start)
        if wrapper_start < 0:
            errors.append(f"{label}: tabela wymaga wrappera .article-table-wrap.")


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


def validate(data: dict[str, Any], allow_verified_review: bool = False) -> tuple[list[str], list[str]]:
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

    title = plain_text(data.get("title", ""))
    if title and not 55 <= len(title) <= 65:
        errors.append(f"title ma {len(title)} znaków; wymagane 55–65, maksimum to 65.")
    if title and INCOMPLETE_TITLE.search(title):
        errors.append("title wygląda na urwany albo niedomknięty gramatycznie; przepisz go świadomie, nie skracaj automatycznie.")
    seo_title = plain_text(data.get("seo_title", ""))
    if seo_title and not 35 <= len(seo_title) <= 55:
        errors.append(f"seo_title ma {len(seo_title)} znaków; wymagane 35–55 bez dopisku marki.")
    if seo_title and INCOMPLETE_TITLE.search(seo_title):
        errors.append("seo_title wygląda na urwany albo niedomknięty gramatycznie.")
    if any(phrase in seo_title.casefold() for phrase in BANNED_SEO_TITLES):
        errors.append("seo_title zawiera generyczny, mało-klikalny szablon.")
    listing_title = str(data.get("listing_title", ""))
    if listing_title and not 45 <= len(listing_title) <= 80:
        errors.append(f"listing_title ma {len(listing_title)} znaków; bezpieczny zakres to 45–80.")
    elif listing_title and not 55 <= len(listing_title) <= 70:
        warnings.append(f"listing_title ma {len(listing_title)} znaków; zalecany cel to 55–70, ale zakres jest poprawny.")
    if data.get("og_title") != data.get("seo_title") or data.get("twitter_title") != data.get("seo_title"):
        errors.append("og_title i twitter_title muszą być identyczne z seo_title.")
    descriptions = [str(data.get(field, "")) for field in ("meta_description", "og_description", "twitter_description", "schema_blogposting_description")]
    if len(set(descriptions)) != 1:
        errors.append("Cztery opisy SEO muszą być identyczne 1:1.")
    if descriptions[0] and not 145 <= len(descriptions[0]) <= 160:
        errors.append(f"Opis SEO ma {len(descriptions[0])} znaków; wymagane 145–160.")
    if descriptions[0] and descriptions[0][-1] not in ".!?":
        errors.append("Opis SEO musi kończyć się pełnym znakiem zdania.")
    if descriptions[0] and any(phrase in descriptions[0].casefold() for phrase in BANNED_META):
        errors.append("Opis SEO zawiera generyczny, mało-klikalny szablon.")
    quick = str(data.get("quick_answer", ""))
    if quick and not 1 <= sentences(quick) <= 3:
        errors.append(f"quick_answer ma {sentences(quick)} zdań; wymagane 1–3.")
    quick_words = words(quick)
    if quick and quick_words > 70:
        errors.append(f"quick_answer ma {quick_words} słów; maksymalny limit to 70.")
    if quick and not (QUICK_NUMBER.search(quick) or QUICK_CONDITION.search(quick)):
        errors.append("quick_answer musi zawierać konkretną liczbę albo warunek (np. jeśli, gdy, kiedy, u osób po 50).")
    if not re.fullmatch(r"\d+ min czytania", str(data.get("reading_time", ""))):
        errors.append('reading_time musi mieć format "X min czytania".')
    raw_intent = str(data.get("search_intent", "")).strip().casefold().replace(" ", "-")
    if raw_intent not in SEARCH_INTENTS:
        errors.append(f"search_intent musi być jednym z: {', '.join(sorted(SEARCH_INTENTS))}.")
    primary_keyword = plain_text(data.get("primary_keyword", ""))
    if not 2 <= words(primary_keyword) <= 8:
        errors.append("primary_keyword musi być konkretną frazą długości 2–8 słów.")
    intent_surface = normalized(" ".join(str(data.get(field, "")) for field in ("title", "seo_title", "lead", "quick_answer")))
    if primary_keyword and normalized(primary_keyword) not in intent_surface:
        errors.append("primary_keyword musi występować naturalnie w title, seo_title, lead albo quick_answer.")
    if not string_list(data.get("supporting_keywords"), 3, 8):
        errors.append("supporting_keywords musi zawierać 3–8 niepustych fraz.")
    elif len({normalized(item) for item in data["supporting_keywords"]}) != len(data["supporting_keywords"]):
        errors.append("supporting_keywords musi zawierać unikalne frazy.")
    if not string_list(data.get("key_takeaways"), 4, 4):
        errors.append("key_takeaways musi zawierać dokładnie 4 niepuste wnioski.")
    notes = data.get("editorial_notes")
    if not isinstance(notes, dict):
        errors.append("editorial_notes musi być obiektem.")
    else:
        for field in NOTE_FIELDS:
            if not string_list(notes.get(field), 0):
                errors.append(f"editorial_notes.{field} musi być listą tekstów (może być pustą).")
        tasks = " ".join(notes.get("local_pipeline_tasks", [])).casefold() if isinstance(notes.get("local_pipeline_tasks"), list) else ""
        if "faq" not in tasks:
            errors.append("editorial_notes.local_pipeline_tasks musi zlecać lokalnemu agentowi ponowną weryfikację FAQ.")
        if "link" not in tasks:
            errors.append("editorial_notes.local_pipeline_tasks musi zlecać lokalnemu agentowi linkowanie wewnętrzne.")
        if isinstance(notes.get("faq_gaps"), list) and notes["faq_gaps"]:
            warnings.append("editorial_notes.faq_gaps zawiera nierozstrzygnięte pytania; nie dodawaj ich do FAQ bez udokumentowanego sygnału intencji.")

    sections = data.get("sections") if isinstance(data.get("sections"), list) else []
    if not sections:
        errors.append("Brak sections[].")
    for index, section in enumerate(sections):
        if not isinstance(section, dict):
            errors.append(f"sections[{index}] nie jest obiektem.")
            continue
        title_text, paragraphs = section.get("title"), section.get("paragraphs_html")
        section_role = str(section.get("section_role", "main")).strip().casefold()
        if section_role not in {"main", "utility"}:
            errors.append(f"sections[{index}].section_role musi mieć wartość main albo utility.")
        if not isinstance(title_text, str) or not title_text.strip():
            errors.append(f"sections[{index}] nie ma title.")
        elif title_text.casefold().startswith(QUESTION_STARTERS) and not title_text.endswith("?"):
            errors.append(f"sections[{index}].title jest pytaniem bez znaku ?.")
        if not string_list(paragraphs, 1):
            errors.append(f"sections[{index}].paragraphs_html musi być niepustą listą tekstów.")
        else:
            first_words = words(paragraphs[0])
            first_text = plain_text(paragraphs[0])
            generic_intro = any(phrase in first_text.casefold() for phrase in (
                "warto rozłożyć na praktyczne kroki",
                "w tej części warto spokojnie uporządkować fakty",
                "ten artykuł porządkuje najważniejsze fakty",
                "warto patrzeć szerzej",
                "kluczowe jest indywidualne podejście",
                "to zależy od wielu czynników",
            ))
            if first_words < 8:
                errors.append(f"Pierwszy akapit sections[{index}] nie domyka odpowiedzi answer-first.")
            if generic_intro:
                errors.append(f"Pierwszy akapit sections[{index}] jest generyczny.")
            if first_text and first_text[-1] not in ".!?":
                errors.append(f"Pierwszy akapit sections[{index}] jest urwany albo nie kończy pełnej myśli.")
            for paragraph_index, paragraph in enumerate(paragraphs):
                validate_semantic_html(paragraph, f"sections[{index}].paragraphs_html[{paragraph_index}]", errors)
        if "image" in section or "images" in section:
            errors.append(f"sections[{index}] nie może zawierać lokalnych image/images; użyj image_prompts_v4.")
    content_data = {key: value for key, value in data.items() if key != "editorial_notes"}
    joined = "\n".join(walk_strings(content_data))
    if re.search(r'href=["\'][^"\']*\.html', joined, re.I):
        errors.append("Claude nie może dodawać linków wewnętrznych *.html.")
    if PLACEHOLDER.search(joined):
        errors.append("Wykryto placeholder, sztuczny wariant lub wpis do uzupełnienia w treści JSON.")

    sources = data.get("sources") if isinstance(data.get("sources"), list) else []
    countable_sources = [source for source in sources if isinstance(source, dict) and source.get("evidence_scope") != "device_instructions_only"]
    if len(countable_sources) < MIN_MEDICAL_SOURCES:
        errors.append(f"Źródeł medycznych jest {len(countable_sources)}; wymagane są co najmniej {MIN_MEDICAL_SOURCES} rzeczywiste i wykorzystane źródła.")
    source_urls: set[str] = set()
    source_ids: set[str] = set()
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
            if url in source_urls:
                errors.append(f"sources[{index}].url powtarza wcześniejsze źródło.")
            source_urls.add(url)
            if is_search_results_url(url):
                errors.append(f"sources[{index}].url prowadzi do strony wyników wyszukiwania zamiast konkretnej publikacji lub dokumentu.")
        source_id = str(source.get("id", "")).strip()
        if source_id:
            if source_id in source_ids:
                errors.append(f"sources[{index}].id musi być unikalne.")
            source_ids.add(source_id)
        if source.get("evidence_level") not in EVIDENCE_LEVELS:
            errors.append(f"sources[{index}].evidence_level ma niedozwoloną wartość.")
        for field in ("fallback_url", "evidence_scope", "publication_date", "checked_via", "recheck_after"):
            if field not in source:
                errors.append(f"sources[{index}].{field} jest obowiązkowe (null jest dozwolony).")
        fallback_url = source.get("fallback_url")
        if fallback_url is not None and not is_https(fallback_url):
            errors.append(f"sources[{index}].fallback_url musi być publicznym HTTPS URL-em albo null.")
        for field in ("evidence_scope", "checked_via"):
            if source.get(field) is not None and (not isinstance(source[field], str) or not source[field].strip()):
                errors.append(f"sources[{index}].{field} musi być niepustym tekstem albo null.")
        publication_date = source.get("publication_date")
        if publication_date is not None and not is_date(publication_date):
            errors.append(f"sources[{index}].publication_date musi mieć format YYYY-MM-DD albo null.")
        elif publication_date is not None and date.fromisoformat(publication_date) > date.today():
            errors.append(f"sources[{index}].publication_date nie może być datą z przyszłości.")
        recheck_after = source.get("recheck_after")
        if recheck_after is not None and not is_date(recheck_after):
            errors.append(f"sources[{index}].recheck_after musi mieć format YYYY-MM-DD albo null.")
        checked_at = source.get("checked_at")
        if not is_date(checked_at):
            errors.append(f"sources[{index}].checked_at musi być prawidłową datą YYYY-MM-DD.")
        else:
            age = (date.today() - date.fromisoformat(checked_at)).days
            if age < 0:
                errors.append(f"sources[{index}].checked_at nie może być datą z przyszłości.")
            elif age > 180:
                errors.append(f"sources[{index}].checked_at ma {age} dni; wymagane ponowne sprawdzenie URL-a.")
        status = source.get("url_status")
        if status not in {"reachable", "requires_local_verification"}:
            errors.append(f"sources[{index}].url_status ma niedozwoloną wartość.")
        if status == "reachable":
            http_status = source.get("http_status")
            if not isinstance(http_status, int) or isinstance(http_status, bool):
                errors.append(f"sources[{index}] reachable wymaga liczbowego http_status.")
            elif not 200 <= http_status < 300:
                errors.append(f"sources[{index}] reachable wymaga końcowego HTTP 2xx po przekierowaniach; otrzymano {http_status}.")
        if status == "requires_local_verification" and "http_status" in source:
            errors.append(f"sources[{index}] nieweryfikowane nie może deklarować http_status.")
        elif status == "requires_local_verification":
            warnings.append(f"sources[{index}] wymaga lokalnej weryfikacji URL; wybierz dostępny kanoniczny URL, jeśli to możliwe.")
        year = source.get("publication_year")
        if year is not None and (not isinstance(year, int) or not 1900 <= year <= date.today().year):
            errors.append(f"sources[{index}].publication_year jest nieprawidłowy.")
        if source.get("evidence_level") in {"systematic_review", "meta_analysis", "randomized_trial", "cohort", "primary_research"} and not isinstance(year, int):
            errors.append(f"sources[{index}] publikacja naukowa wymaga publication_year.")
        if "doi_or_pmid" in source and not isinstance(source["doi_or_pmid"], str):
            errors.append(f"sources[{index}].doi_or_pmid musi być tekstem.")

    for section_index, section in enumerate(sections):
        if not isinstance(section, dict) or "evidence_source_ids" not in section:
            continue
        ids = section.get("evidence_source_ids")
        if not string_list(ids, 1):
            errors.append(f"sections[{section_index}].evidence_source_ids musi być niepustą listą identyfikatorów źródeł.")
            continue
        for source_id in ids:
            if source_id not in source_ids:
                errors.append(f"sections[{section_index}].evidence_source_ids odwołuje się do nieistniejącego źródła: {source_id}")

    claims = data.get("evidence_claims") if isinstance(data.get("evidence_claims"), list) else []
    if not claims:
        errors.append("Brak evidence_claims.")
    used_urls: set[str] = set()
    for index, claim in enumerate(claims):
        if not isinstance(claim, dict):
            errors.append(f"evidence_claims[{index}] nie jest obiektem.")
            continue
        statement, location, urls = claim.get("claim"), claim.get("location"), claim.get("source_urls")
        if not isinstance(statement, str) or words(statement) < 5:
            errors.append(f"evidence_claims[{index}].claim musi zawierać co najmniej 5 słów i nazywać konkretne twierdzenie.")
        located = locate(data, location) if isinstance(location, str) else None
        if not isinstance(location, str) or located is None:
            errors.append(f"evidence_claims[{index}].location nie wskazuje istniejącego pola.")
        elif not isinstance(located, str):
            errors.append(f"evidence_claims[{index}].location musi wskazywać dokładny fragment tekstowy, nie całą listę lub obiekt.")
        elif isinstance(statement, str) and normalized(statement) not in normalized(located):
            errors.append(f"evidence_claims[{index}].claim nie występuje dokładnie we wskazanym location.")
        if claim.get("claim_type") not in CLAIM_TYPES:
            errors.append(f"evidence_claims[{index}].claim_type ma niedozwoloną wartość.")
        if not string_list(urls, 1):
            errors.append(f"evidence_claims[{index}].source_urls musi być niepustą listą URL-i.")
        else:
            if len(set(urls)) != len(urls):
                errors.append(f"evidence_claims[{index}].source_urls zawiera duplikaty.")
            for url in urls:
                if not is_https(url):
                    errors.append(f"evidence_claims[{index}].source_urls zawiera nieprawidłowy URL.")
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
    if len(faq) != len(research):
        errors.append("answer_blocks i faq_research muszą odpowiadać sobie 1:1.")
    research_by_question: dict[str, dict[str, Any]] = {}
    for index, item in enumerate(research):
        if not isinstance(item, dict):
            errors.append(f"faq_research[{index}] nie jest obiektem.")
            continue
        question = plain_text(item.get("question", ""))
        key = normalized(question).rstrip(" ?!.")
        if not question or key in research_by_question:
            errors.append(f"faq_research[{index}].question jest puste albo zduplikowane.")
        else:
            research_by_question[key] = item
        source_type = str(item.get("source_type", "")).strip().casefold()
        if source_type not in {"autocomplete", "paa", "gsc", "manual_research"}:
            errors.append(f"faq_research[{index}].source_type ma niedozwoloną wartość.")
        if not isinstance(item.get("source_label"), str) or len(item["source_label"].strip()) < 8:
            errors.append(f"faq_research[{index}].source_label musi konkretnie nazywać źródło intencji.")
        source_url = item.get("source_url")
        if not is_https(source_url):
            errors.append(f"faq_research[{index}].source_url musi być publicznym adresem HTTPS.")
        if not is_date(item.get("checked_at")):
            errors.append(f"faq_research[{index}].checked_at musi być datą YYYY-MM-DD.")
        status = item.get("url_status")
        if status not in {"reachable", "requires_local_verification"}:
            errors.append(f"faq_research[{index}].url_status ma niedozwoloną wartość.")
        if status == "reachable" and not isinstance(item.get("http_status"), int):
            errors.append(f"faq_research[{index}] reachable wymaga liczbowego http_status.")
        elif status == "reachable" and not 200 <= item["http_status"] < 300:
            errors.append(f"faq_research[{index}] reachable wymaga końcowego HTTP 2xx.")
        if not isinstance(item.get("research_note"), str) or len(item["research_note"].strip()) < 20:
            errors.append(f"faq_research[{index}].research_note musi opisywać faktyczną kontrolę intencji.")
        for local_field in ("intent_verified", "intent_checked_at", "verified_suggestion"):
            if local_field in item:
                errors.append(f"faq_research[{index}] nie może zawierać lokalnego pola {local_field}; nada je pipeline dodaj artykuł.")
        if source_type == "autocomplete" and is_https(source_url):
            parsed = urlparse(source_url)
            query = parse_qs(parsed.query).get("q", [""])[0]
            if parsed.hostname != "suggestqueries.google.com" or parsed.path != "/complete/search":
                errors.append(f"faq_research[{index}] autocomplete wymaga endpointu Google Suggest.")
            if normalized(query).rstrip(" ?!.") != key:
                errors.append(f"faq_research[{index}] parametr q musi odpowiadać pytaniu FAQ 1:1.")
        query = str(item.get("query", "")).strip()
        if source_type == "gsc":
            requirement = FAQ_SOURCE_REQUIREMENTS["gsc"]
            try:
                impressions = float(item.get("impressions", 0) or 0)
            except (TypeError, ValueError):
                impressions = 0
            if (requirement["query_required"] and not query) or impressions < requirement["impressions_min"]:
                errors.append(
                    f"faq_research[{index}]: GSC wymaga query oraz impressions >= {requirement['impressions_min']}."
                )
        if source_type == "paa":
            requirement = FAQ_SOURCE_REQUIREMENTS["paa"]
            note = str(item.get("research_note", "")).strip()
            if (requirement["query_required"] and not query) or len(note) < requirement["research_note_min_chars"]:
                errors.append(
                    f"faq_research[{index}]: PAA wymaga query i research_note (min. {requirement['research_note_min_chars']} znaków)."
                )
    faq_seen: set[str] = set()
    for index, item in enumerate(faq):
        if not isinstance(item, dict):
            errors.append(f"answer_blocks[{index}] nie jest obiektem.")
            continue
        question = plain_text(item.get("question", ""))
        answer = plain_text(item.get("answer_html", item.get("answer", "")))
        key = normalized(question).rstrip(" ?!.")
        if not question or key in faq_seen:
            errors.append(f"answer_blocks[{index}].question jest puste albo zduplikowane.")
        faq_seen.add(key)
        if not answer:
            errors.append(f"answer_blocks[{index}] nie ma odpowiedzi.")
        if key not in research_by_question:
            errors.append(f"answer_blocks[{index}] nie ma dopasowania 1:1 w faq_research.")

    prompts = data.get("image_prompts_v4") if isinstance(data.get("image_prompts_v4"), list) else []
    required = {"hero", *(f"sekcja-{index + 1}" for index, section in enumerate(sections) if isinstance(section, dict) and str(section.get("section_role", "main")).strip().casefold() != "utility")}
    placements: list[str] = []
    filenames: list[str] = []
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
            if not re.search(r"-v[1-9]\d*$", filename):
                errors.append(f"image_prompts_v4[{index}].filename_base musi kończyć się wersją -vN, np. -v1.")
        source_file = prompt.get("source_file")
        allowed_source = isinstance(source_file, str) and re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*\.jpg", source_file)
        if not allowed_source or not isinstance(filename, str) or source_file != f"{filename}.jpg":
            errors.append(f"image_prompts_v4[{index}].source_file musi być dokładnie filename_base + .jpg.")
        ratio = prompt.get("aspect_ratio")
        match = re.fullmatch(r"(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)", str(ratio or ""))
        ratio_value = float(match.group(1)) / float(match.group(2)) if match and float(match.group(2)) else 0
        if not match or not 1.2 <= ratio_value <= 2.1:
            errors.append("image_prompts_v4[{index}].aspect_ratio musi być poprawną proporcją poziomą 1.2–2.1.".format(index=index))
        review = prompt.get("visual_review")
        allowed_review_statuses = {"PENDING_LOCAL_REVIEW", "VERIFIED"} if allow_verified_review else {"PENDING_LOCAL_REVIEW"}
        if not isinstance(review, dict) or review.get("status") not in allowed_review_statuses:
            expected = "PENDING_LOCAL_REVIEW albo VERIFIED z lokalnego etapu review" if allow_verified_review else "PENDING_LOCAL_REVIEW; Pisarz nie wykonuje lokalnej kontroli obrazu"
            errors.append(f"image_prompts_v4[{index}].visual_review.status musi być {expected}.")
        if "overlay_text_pl" in prompt and not isinstance(prompt.get("overlay_text_pl"), str):
            errors.append(f"image_prompts_v4[{index}].overlay_text_pl musi być tekstem, także gdy jest pusty.")
        for field in ("season_and_time", "mood"):
            if not isinstance(prompt.get(field), str) or len(prompt[field].strip()) < 4:
                errors.append(f"image_prompts_v4[{index}].{field} musi być konkretnym tekstem.")
        evidence_urls = prompt.get("evidence_source_urls")
        if not isinstance(evidence_urls, list) or any(not is_https(url) for url in evidence_urls):
            errors.append(f"image_prompts_v4[{index}].evidence_source_urls musi być listą prawidłowych HTTPS URL-i (może być pustą).")
        elif any(url not in source_urls for url in evidence_urls):
            errors.append(f"image_prompts_v4[{index}].evidence_source_urls zawiera URL spoza sources[].")
        elif re.search(r"\b(?:dlatego|zatem|w rezultacie|ryzyko|zawał|depresj|insulin)\b|\d", str(prompt.get("caption_pl") or ""), re.I) and not evidence_urls:
            errors.append(f"image_prompts_v4[{index}].caption_pl zawiera wniosek, liczbę lub tezę medyczną, ale evidence_source_urls jest puste.")
        exact_data = prompt.get("requires_exact_data_render")
        if not isinstance(exact_data, bool):
            errors.append(f"image_prompts_v4[{index}].requires_exact_data_render musi być wartością true albo false.")
        elif exact_data and (not str(prompt.get("overlay_text_pl", "")).strip() or not evidence_urls):
            errors.append(f"image_prompts_v4[{index}] z requires_exact_data_render=true wymaga overlay_text_pl i evidence_source_urls.")
        overlay_claims = prompt.get("overlay_claims")
        if exact_data and (not isinstance(overlay_claims, list) or not overlay_claims):
            errors.append(f"image_prompts_v4[{index}] z requires_exact_data_render=true wymaga niepustego overlay_claims.")
        elif isinstance(overlay_claims, list):
            overlay_text = normalized(prompt.get("overlay_text_pl"))
            for claim_index, claim in enumerate(overlay_claims):
                if not isinstance(claim, dict):
                    errors.append(f"image_prompts_v4[{index}].overlay_claims[{claim_index}] musi być obiektem.")
                    continue
                claim_text = claim.get("claim")
                source_url = claim.get("source_url")
                if not isinstance(claim_text, str) or words(claim_text) < 2 or normalized(claim_text) not in overlay_text:
                    errors.append(f"image_prompts_v4[{index}].overlay_claims[{claim_index}].claim musi występować w overlay_text_pl.")
                if not is_https(source_url) or source_url not in source_urls:
                    errors.append(f"image_prompts_v4[{index}].overlay_claims[{claim_index}].source_url musi występować w sources[].")
    allowed = set(required)
    for section_index in range(len(sections)):
        allowed.update(placement for placement in placements if re.fullmatch(fr"sekcja-{section_index + 1}-obraz-[2-9]\d*", placement))
    missing, extra = sorted(required - set(placements)), sorted(set(placements) - allowed)
    if missing:
        errors.append(f"Brak promptów obrazów dla: {', '.join(missing)}.")
    if extra:
        errors.append(f"Nadmiarowe section_ref w obrazach: {', '.join(extra)}.")
    if len(placements) != len(set(placements)):
        errors.append("image_prompts_v4 zawiera powtórzony section_ref.")
    if len(filenames) != len(set(filenames)):
        errors.append("filename_base obrazów muszą być unikalne.")

    if data.get("category") == "mity":
        if not isinstance(data.get("myth_claim"), str) or not data["myth_claim"].strip():
            errors.append("Kategoria mity wymaga myth_claim.")
        if not all(token in joined.casefold() for token in ("<table", "<caption", "<thead", "<tbody")):
            errors.append("Artykuł mity wymaga semantycznej tabeli MIT–FAKT/DOWODY.")
    article_words = sum(words(value) for section in sections if isinstance(section, dict) for value in section.get("paragraphs_html", []) if isinstance(value, str))
    if article_words < 800:
        warnings.append(f"Treść główna ma około {article_words} słów; sprawdź, czy temat rzeczywiście został wyczerpany.")
    return errors, warnings


def main() -> int:
    args = sys.argv[1:]
    allow_verified_review = "--allow-verified-review" in args
    args = [arg for arg in args if arg != "--allow-verified-review"]
    if len(args) != 1:
        print("Użycie: python3 validate_fitpo50_draft.py [--allow-verified-review] <plik.fitpo50.json>", file=sys.stderr)
        return 2
    try:
        data = json.loads(Path(args[0]).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"[FAIL] Nie można odczytać JSON: {exc}", file=sys.stderr)
        return 2
    if not isinstance(data, dict):
        print("[FAIL] Korzeń JSON musi być obiektem.", file=sys.stderr)
        return 2
    errors, warnings = validate(data, allow_verified_review=allow_verified_review)
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
