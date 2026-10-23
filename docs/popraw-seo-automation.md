# Popraw SEO — automatyzacja po zatwierdzeniu

## Interfejs użytkownika

Użytkownik podaje tylko `popraw-seo`, a po raporcie zatwierdza konkretne ID. Nie musi znać ani uruchamiać komend technicznych. Akceptacja ID pozwala agentowi przygotować i zwalidować paczkę lokalnie, po czym agent raportuje wynik; nie jest zgodą na commit, push, deploy ani IndexNow.

1. pełny przegląd każdego artykułu według wymagań nowej publikacji, naprawa wykrytych problemów oraz przygotowanie konkretnych tekstów i `data/reports/popraw-seo-patches.json`,
2. kontrola SHA-256 wszystkich plików oraz dry-run,
3. atomowe `popraw-seo:apply`,
4. `dateModified`, PDF, `_site`, sitemap i pełne walidatory,
5. raport lokalnego wyniku i oczekiwanie na osobne „tak” użytkownika w czacie,
6. po tym „tak”: commit, `git push` i monitorowanie automatycznego workflow produkcyjnego,
7. IndexNow wyłącznie po osobnym „tak” użytkownika; lista 1–3 URL-i do GSC dopiero po `LIVE_DEPLOYED_AND_VALIDATED`.

Jeśli dowolny etap nie może się zakończyć, agent nie pomija go i nie ogłasza sukcesu. Zwraca `BLOCKED` z nazwą etapu, przyczyną, cofniętymi zmianami i konkretnym działaniem naprawczym.

Każdy zmieniany artykuł przechodzi **pełną walidację jak nowy artykuł**, zgodnie z [kanonicznym standardem](../ARTICLE_STANDARD.md#pełna-walidacja-po-popraw-seo). Dotyczy to wszystkich wymagań, całej strony i wszystkich jej artefaktów, także przy drobnej zmianie SEO. Samo uruchomienie `popraw-seo:apply` i uzyskanie PASS lokalnych walidatorów nie zastępuje kontroli dowodów, logiki, architektury ani rzeczywistej kontroli wizualnej. Agent dokumentuje komplet wyników dla każdego URL-a; bez pełnego PASS nie promuje stagingu ani nie publikuje.

## Kontrakt zatwierdzonego patcha

Manifest ma status `AWAITING_USER_APPROVAL`, `version: 1`, `source_hashes` i `items`. Każda operacja jest `replace_exact` i zawiera:

- dokładne `before` oraz zatwierdzone `after`,
- `reason`,
- co najmniej jedną podstawę `basis`: `GSC_QUERY`, `SOURCE`, `ARTICLE_FACT`, `SAFETY_RULE` albo `INTERNAL_LINK_MAP`,
- zmiana widocznego tekstu lub danych strukturalnych wymaga `SOURCE` z HTTP(S) URL w `url` albo `value`; to konserwatywna kontrola dowodów, również dla zmian bez liczb,
- FAQ patcha zawiera `answer_blocks` i `faq_research` według wspólnego kontraktu Pisarza (wyłącznie GSC/PAA/autocomplete); pytania z HTML i JSON-LD muszą mieć udokumentowane pochodzenie,
- nowe linki wymagają istniejącego celu oraz krawędzi w `data/crosslink-suggestions/<source-slug>.json` lub `data/reports/link-topology-report.json`; dotyczy to też absolutnych URL-i FitPo50,
- `operation.file` nie może modyfikować celu należącego do innego ID manifestu; podmiana całego dokumentu HTML jest zabroniona,
- opcjonalny `file`, gdy zmiana dotyczy strony źródłowej linkującej do targetu.

Automat blokuje placeholdery, dawny generyczny akapit `safe-links`, nieistniejące cele linków, niezgodny hash, fragment występujący zero lub więcej niż jeden raz oraz ID spoza manifestu.

Przed promocją stagingu każdy artykuł wymaga jednego raportu `data/reports/article-preview/<slug>.json` w kontrakcie `version=3`. Generator zapisuje `TECHNICAL_PASS` i `VISUAL_REVIEW_PENDING`; po rzeczywistym obejrzeniu desktopu, mobile, każdego obrazu i każdej strony PDF ten sam raport może otrzymać `VISUAL_REVIEW_VERIFIED` oraz `PREVIEW_READY`. Aktywna ścieżka nie uruchamia równolegle dawnego `article-media-review`; JS i Python korzystają z jednego schema oraz wspólnych fixture wyłącznie dla zgodności i zamrożonego legacy.

## Stany

- `AWAITING_USER_APPROVAL` — raport lub patch czeka na akceptację.
- `APPLIED_VALIDATED_AWAITING_GIT_PUSH` — lokalny komplet przeszedł render i walidatory.
- `COMMITTED_LOCALLY_AWAITING_LIVE_DEPLOYMENT` — manifest wersji oczekiwanej na produkcji.
- `LIVE_DEPLOYMENT_INCOMPLETE` — produkcja nie odpowiada zatwierdzonej wersji; lista GSC pozostaje pusta.
- `LIVE_DEPLOYED_AND_VALIDATED` — potwierdzono HTTP 200, canonical, `dateModified`, zatwierdzoną treść, sitemap i PDF.

Końcowe artefakty to `data/reports/gsc-live-submit-queue.json` i `.txt`. Workflow GitHub publikuje je także jako artefakt `popraw-seo-gsc-live` i w swoim podsumowaniu.
# Staging i wznowienie

Zatwierdzony apply przygotowuje zarządzany staging i zwraca `AWAITING_VISUAL_REVIEW`. Po kontroli wszystkich podglądów agent stosuje review przez istniejący `article-preview-gate`, po czym wznawia tę samą operację z `--promote-stage <katalog-stagingu>`. `article-preview-report-check --require-render-files` ponownie sprawdza hashe przed promocją. Pełny kontrakt centrów opisuje [topic-center-pipeline.md](topic-center-pipeline.md).
