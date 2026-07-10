# Fitpo50 — Project Memory

> Auto-synced | 8178 observations

## 🏛️ CORE ARCHITECTURE

> **CRITICAL:** The following rules represent strict architectural boundaries defined by the user. NEVER violate them in your generated code or explanations.

# Intellectual Property & Architecture Rules
Write your strict architectural boundaries here. 
BrainSync will automatically enforce these rules across all agents (Cursor, Windsurf, Cline) 
and inject them into the memory context.

Example:
- NEVER use TailwindCSS. Only use vanilla CSS.
- NEVER write class components. Only use functional React components.

## 🛡️ GLOBAL SAFETY RULES

- **NEVER** run `git clean -fd` or `git reset --hard` without checking `git log` and verifying commits exist.
- **NEVER** delete untracked files or folders blindly. Always backup or stash before bulk edits.

## 🧭 ACTIVE CONTEXT

> Always read `.cursor/active-context.md` for exact instructions on the specific file you are currently editing. It updates dynamically.

## 🔴 STOP — READ THESE FIRST

- **Don't mix CommonJS (require) and ESM (import) in same project** — Don't mix CommonJS (require) and ESM (import) in same project
- **Don't use "any" type in TypeScript — define proper types/interfaces** — Don't use "any" type in TypeScript — define proper types/interfaces
- **Handle Promise rejections — always .catch() or try/catch with await** — Handle Promise rejections — always .catch() or try/catch with await
- **Use === not == — strict equality prevents type coercion bugs** — Use === not == — strict equality prevents type coercion bugs
- **Agent: follow existing project patterns — don't introduce a different style** — Agent: follow existing project patterns — don't introduce a different style
- **FitPo50 content: zero generic text** — Przy poprawianiu stron, artykułów, SEO, FAQ, quick answers, leadów, title/meta i linkowania nie wolno dodawać generycznych dopisków. Każdy dodany tekst musi wynikać z danych GSC/PAA/autocomplete, treści artykułu, realnego źródła, konkretnej liczby/progu albo jasnego warunku bezpieczeństwa.
- **FitPo50 content: logic gate** — JSON od Claude/modelu zewnętrznego jest tylko draftem. Przed importem agent musi sprawdzić logikę akapit po akapicie: każde "ta obietnica", "ta reklama", "taki przekaz", "haczyk jest prosty" musi w tym samym fragmencie jasno nazwać obietnicę/twierdzenie; każda metafora musi być domknięta mechanizmem; każdy wniosek musi wynikać z poprzedniego zdania, źródła, liczby albo warunku. Skróty myślowe i niejasne odniesienia są błędem blokującym.

## 📐 Conventions

- Git Commit: Sync _site dla artykulu RTG — confirmed 3x
- Git Commit: Dodanie artykulu o kriokomorach i komorach hiperbarycznych d — confirmed 3x
- Version your API from day 1 (/api/v1/)
- Use consistent response format across all endpoints
- Implement soft delete for important data — don't hard delete without confirmation
- Handle timezone correctly — store UTC, display in user's timezone
- Make layouts responsive from the start — mobile-first approach
- Disable submit button during form submission — prevent double-submit

## ✅ FitPo50 Quality Gate v2.0 (Article Pages)
- SEO description contract: `meta description`, `og:description`, `twitter:description` i `BlogPosting.description` muszą być identyczne 1:1.
- Długość każdego opisu SEO: 145-160 znaków; opis musi kończyć się pełnym znakiem końca zdania (`.`, `!`, `?`).
- H2 pytające muszą kończyć się `?`.
- Pierwszy akapit pod każdym H2: 30-70 słów.
- Każdy artykuł: min. 4 linki wewnętrzne i tylko ścieżki względne (`href="*.html"`).
- Standard mediów: `<picture>` z AVIF/WebP + fallback `<img alt ... loading="lazy">`.
- Zakaz `</source>` i `<?xml ... ?>` w HTML.
- `BlogPosting.citation` musi być zgodne z listą źródeł w HTML (docelowo min. 4 realne URL-e, bez halucynacji).

## 🧩 Auto-rules dla importu JSON (obowiązkowe)
- Nowe artykuły importowane z „gołego JSON” muszą być automatycznie wzmacniane przez importer (bez ręcznego dopisywania pól przez autora JSON).
- Importer ma zawsze wymusić spójność opisu SEO 1:1 (`meta description` = `og:description` = `twitter:description` = `BlogPosting.description`).
- Jeśli w treści sekcji pojawi się `<table>` bez `<caption>`, importer ma automatycznie dodać `<caption>`.
- `BlogPosting.about` ma być budowane automatycznie; jeśli JSON nie ma encji, importer ma użyć fallbacku encji Wikidata na podstawie treści artykułu.
- Brak pól GEO/AIO w JSON (np. encje) nie może zatrzymać importu, jeśli importer potrafi je bezpiecznie wyprowadzić automatycznie.

## 🔎 `popraw-seo` — obowiązkowy workflow akceptacji

- `popraw-seo` uruchamia raporty GSC/SEO/AEO/GEO/AIO i kończy na `AWAITING_USER_APPROVAL`.
- Raport musi zawierać paczkę `BOOST` dla stron blisko wzrostu oraz `NAPRAWA` dla stron słabych albo bez widoczności.
- Agent nie edytuje HTML po samym raporcie. Użytkownik zatwierdza konkretne ID, np. `popraw BOOST 1` albo `popraw BOOST 1 NAPRAWA 2`.
- Jeśli użytkownik poda same numery i istnieje ryzyko pomylenia koszyków, agent musi dopytać o ID przed edycją.
- Przed edycją agent przygotowuje konkretny tekst dla danego URL-a; zakazane są placeholdery i generyczne bloki SEO.

## ⚡ Available Tools (ON-DEMAND only)
- `sys_core_02(title, content, category)` — Save a note + auto-detect conflicts
- `sys_core_03(items[])` — Save multiple notes in 1 call
- `sys_core_01(text)` — Search memory for architecture, past fixes, decisions
- `sys_core_05(text)` — Full-text search for details
- `sys_core_16()` — Check compiler errors after edits

> ℹ️ DO NOT call sys_core_14() or sys_core_08() at startup — context above IS your context.

---
*Auto-synced | 2026-05-10*
