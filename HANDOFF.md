# HANDOFF — article pipeline guardrails

Branch: `chore/article-pipeline-dry-run-guardrails`

## Zrobione

- Dodano agregujący `article:add --dry-run` z klasyfikacją `FIXABLE_LOCAL` / `REQUIRES_WRITER` i kodami 20/30.
- Dodano kontrolę zakresu zmian, licznik prób per slug + hash draftu, wspólną normalizację URL i kontrakt sekcji.
- Usunięto sztuczne minima FAQ i linków; mniej niż 2 linki jest ostrzeżeniem.
- Dodano obsługę 403/405 jako `blocked_by_publisher`, ponowienie GET z nagłówkiem przeglądarki i użycie wyłącznie `fallback_url` Pisarza.
- Rozszerzono kontrakt źródeł o `fallback_url`, `evidence_scope`, `publication_date`, `checked_via`, `recheck_after` oraz obrazów o `overlay_claims`.
- Dodano mocki HTTP 200/403/405/404 i odpowiedź autocomplete z polskimi znakami ISO-8859-2.
- Dodano dwie fixture artykułu o zmianie czasu: wierny oryginał z błędami i wersję poprawioną oraz generator fixture.
- Dodano test, że sam rok publikacji nie tworzy daty 1 stycznia, oraz walidację przyszłej `publication_date`.
- Utworzono `.venv`, zainstalowano PyYAML 6.0.3, dodano `.venv/` do `.gitignore` i `requirements-dev.txt` (samo `.venv` nie jest śledzone).
- Dodano artykuł, obrazy i artefakty publikacyjne z dzisiejszego importu oraz wymagane nowe skrypty wdrożeniowe/fonty.

## W trakcie

- Minimum 4 źródeł jest używane przez wspólną stałą JS `POLICY.WORDS.CITATION_MIN_URLS` w gate, preflight i fixerze; walidator Python ma jeszcze własną nazwaną stałą `MIN_MEDICAL_SOURCES` i wymaga decyzji, czy wspólny kontrakt ma być plikiem JSON czy generowanym zasobem skilla.
- Workbench został zmieniony tak, aby fixer działał kontrolnie (`--check`) i nie naruszał chronionych pól Pisarza; etap ten przechodzi na poprawionej fixture.
- Dokumentacja skilla opisuje część nowych zasad, ale przykład schematu źródła wymaga dopisania pięciu nowych pól i `overlay_claims`; ZIP wymaga ponownego zbudowania.

## Zostało

1. Uruchomić testy celowane po ostatnich zmianach i naprawić regresje.
2. Doprowadzić poprawioną fixture przez pełny dry-run do `AWAITING_REVIEW` (desktop, mobile, PDF) bez ręcznej zmiany.
3. Dokończyć wspólne źródło prawdy dla minimum źródeł, bez duplikatu JS/Python.
4. Uzupełnić skill i `draft-contract.md`, odbudować ZIP.
5. Uruchomić walidator skilla przez `.venv/bin/python` i zapisać wynik.
6. Uruchomić `npm run test:article-json-workflow` oraz `npm run test:pipeline-blockers`; testy Playwright mogą wymagać uruchomienia poza sandboxem.
7. Sprawdzić `git status`, brak `.venv`, `__pycache__` i `.pyc`, a następnie zrobić końcowy lokalny commit.
8. Przygotować raport końcowy z tabelą „dzisiejszy problem → reguła/test”.

## Znane wyniki testów

- `npm run test:article-json-workflow`: wcześniej PASS 27/27, przed ostatnimi zmianami kontraktu źródeł.
- Celowane nowe testy: wcześniej PASS 90/90, przed ostatnimi zmianami.
- `npm run test:pipeline-blockers`: wcześniej 160/165; 1 test oczekiwał starego błędu minimum linków (test został już zmieniony na warning), 4 testy Playwright nie uruchomiły Chromium z powodu ograniczeń sandboxa.
- Pełny dry-run poprawionej fixture: nadal BLOCKED; ostatnio wykryto, że zapisujący fixer naruszał chronione pola. Workbench został następnie przełączony na `--check`, ale nie zweryfikowano wyniku.
- Walidator skilla po instalacji PyYAML: PASS (`Skill is valid!`).
- Testy celowane po WIP: PASS 55/55 (`article-dry-run`, `article-evidence`, `import-article-render`, `fitpo50-article-draft-skill`).
- Poprawiona fixture przechodzi odbiór, kontrakt, fixer, normalizację, architekturę, źródła i preflight; ostatnia poprawka uzupełniła wymagane pole oceny tekstu na grafikach, ale pełny dry-run wymaga ponownego uruchomienia.

## Zacznij od

```bash
node tests/fixtures/article-packages/build-zmiana-czasu-fixtures.js
node scripts/article-add.js --dry-run --json --file tests/fixtures/article-packages/zmiana-czasu-corrected.fitpo50.json --assets-dir assets --http-fixture tests/fixtures/article-packages/zmiana-czasu-http-responses.json
```

Następnie uruchom:

```bash
.venv/bin/python /Users/grzegorzkupiec/.codex/skills/.system/skill-creator/scripts/quick_validate.py docs/skills/fitpo50-article-draft
npm run test:article-json-workflow
npm run test:pipeline-blockers
```

Nie wykonywać pushu, PR ani merge'a bez wyraźnego `tak` użytkownika.
