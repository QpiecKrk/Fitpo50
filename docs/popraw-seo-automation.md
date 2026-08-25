# Popraw SEO — automatyzacja po zatwierdzeniu

## Interfejs użytkownika

Użytkownik podaje tylko `popraw-seo`, a po raporcie zatwierdza konkretne ID. Nie musi znać ani uruchamiać komend technicznych. Akceptacja ID uruchamia obowiązek agenta doprowadzenia paczki do końca:

1. przygotowanie konkretnych tekstów i `data/reports/popraw-seo-patches.json`,
2. kontrola SHA-256 wszystkich plików oraz dry-run,
3. atomowe `popraw-seo:apply`,
4. `dateModified`, PDF, `_site`, sitemap i pełne walidatory,
5. commit oraz `git push`, jeśli użytkownik nie wyłączył publikacji,
6. monitorowanie automatycznego workflow produkcyjnego,
7. lista 1–3 URL-i do GSC dopiero po `LIVE_DEPLOYED_AND_VALIDATED`.

Jeśli dowolny etap nie może się zakończyć, agent nie pomija go i nie ogłasza sukcesu. Zwraca `BLOCKED` z nazwą etapu, przyczyną, cofniętymi zmianami i konkretnym działaniem naprawczym.

## Kontrakt zatwierdzonego patcha

Manifest ma status `AWAITING_USER_APPROVAL`, `version: 1`, `source_hashes` i `items`. Każda operacja jest `replace_exact` i zawiera:

- dokładne `before` oraz zatwierdzone `after`,
- `reason`,
- co najmniej jedną podstawę `basis`: `GSC_QUERY`, `SOURCE`, `ARTICLE_FACT`, `SAFETY_RULE` albo `INTERNAL_LINK_MAP`,
- opcjonalny `file`, gdy zmiana dotyczy strony źródłowej linkującej do targetu.

Automat blokuje placeholdery, dawny generyczny akapit `safe-links`, nieistniejące cele linków, niezgodny hash, fragment występujący zero lub więcej niż jeden raz oraz ID spoza manifestu.

## Stany

- `AWAITING_USER_APPROVAL` — raport lub patch czeka na akceptację.
- `APPLIED_VALIDATED_AWAITING_GIT_PUSH` — lokalny komplet przeszedł render i walidatory.
- `COMMITTED_LOCALLY_AWAITING_LIVE_DEPLOYMENT` — manifest wersji oczekiwanej na produkcji.
- `LIVE_DEPLOYMENT_INCOMPLETE` — produkcja nie odpowiada zatwierdzonej wersji; lista GSC pozostaje pusta.
- `LIVE_DEPLOYED_AND_VALIDATED` — potwierdzono HTTP 200, canonical, `dateModified`, zatwierdzoną treść, sitemap i PDF.

Końcowe artefakty to `data/reports/gsc-live-submit-queue.json` i `.txt`. Workflow GitHub publikuje je także jako artefakt `popraw-seo-gsc-live` i w swoim podsumowaniu.
