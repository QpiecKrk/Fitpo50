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

## Stan końcowy

- Minimum źródeł i próg ostrzeżenia linków pochodzą z jednego pliku `references/article-contract.json`, czytanego przez JS i Python oraz zawartego w ZIP-ie skilla.
- Poprawiona fixture osiąga `AWAITING_REVIEW` bez ręcznych zmian; pełny staging utworzył desktop, mobile i strony PDF.
- `--dry-run` zwraca kod 10 dla `AWAITING_REVIEW`; kod 0 jest zarezerwowany dla `PASS/READY`.
- Pochodne pola `section.image` nie wymagają zdublowanych dowodów, ale brak `overlay_claims[].source_url` w `sources` nadal blokuje.
- Skill i ZIP są zaktualizowane; walidator skilla zwraca `Skill is valid!`.
- Historia została rozdzielona na commit kodowy i osobny commit artefaktów artykułu. Przed nałożeniem późniejszych poprawek `git diff --exit-code backup/guardrails-c8868856 HEAD` zwrócił 0.

## Znane wyniki testów

- Walidator skilla: PASS.
- Testy celowane: PASS 58/58.
- `npm run test:article-json-workflow`: PASS 27/27.
- `npm run test:pipeline-blockers` poza sandboxem: PASS 165/165.
- Pełny dry-run poprawionej fixture: `AWAITING_REVIEW`, kod 10, 0 błędów i 5 ostrzeżeń.

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
