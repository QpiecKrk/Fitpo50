# AGENTS.md — FitPo50

To jest wejściowy kontrakt dla agentów pracujących w repozytorium. Nie zapisuj tu automatycznych obserwacji, przykładów commitów ani historii zmian.

## Kolejność instrukcji projektu

1. Przeczytaj `.cursor/active-context.md`.
2. Przeczytaj `PROJECT_MEMORY.md`.
3. Dla artykułów przeczytaj `ARTICLE_STANDARD.md` i `MEMORY_PORADY.md`.
4. Dla NEWS przeczytaj `MEMORY_NEWSY.md`.
5. Dla Moich Sukcesów przeczytaj `MEMORY_MOJE_SUKCESY.md`.
6. Aktualne komendy sprawdzaj w `docs/command-registry.md`.

## Granice architektury

- Stosuj istniejący styl projektu; nie wprowadzaj drugiego frameworka lub odmiennego systemu modułów.
- Nie mieszaj CommonJS i ESM w tym samym obszarze projektu.
- W TypeScript nie używaj `any`; stosuj jawne typy i interfejsy.
- Obsługuj odrzucenia Promise przez `try/catch` albo `.catch()`.
- Używaj ścisłych porównań `===` i `!==`.
- `Porady`, `NEWS` i `Moje Sukcesy` są odrębnymi modułami.
- `_site` jest publicznym eksportem i musi być zgodny ze źródłem.
- Nie publikuj prywatnych konfiguracji, sekretów ani danych użytkowników.

## Bezpieczeństwo Git i plików

- Nigdy nie uruchamiaj `git clean -fd` ani `git reset --hard`.
- Nie usuwaj untracked ani produkcyjnych assetów bez sprawdzonej listy i zgody użytkownika.
- Nie cofaj zmian użytkownika, jeśli nie należą do bieżącego zadania.
- Nie wykonuj commit/push bez jawnego polecenia.
- Polecenie `git push` uruchamia pełny workflow opisany w `SESSION_START_MAX.md`.

## Treść FitPo50

- Zero generycznych tekstów i placeholderów.
- JSON zewnętrzny jest draftem; kontrola logiki, dowodów i obrazów jest obowiązkowa.
- Niejasne odniesienia, niedomknięte metafory i wnioski bez przesłanek blokują publikację.
- FAQ pochodzi wyłącznie z realnego GSC/PAA/autocomplete/udokumentowanego researchu.
- Minimum 4 źródła oznacza źródła rzeczywiste, zweryfikowane i użyte w claimach.
- Każda liczba, próg, ryzyko, cena, mechanizm i teza medyczna wymaga konkretnego dowodu.

## Quality Gate artykułu

- Opis SEO ma 145–160 znaków, kończy się pełnym zdaniem i jest identyczny w meta, Open Graph, Twitter i `BlogPosting.description`.
- Pytające H2 kończą się `?`; pierwszy akapit pod H2 ma 30–70 słów.
- Minimum 4 naturalne linki wewnętrzne prowadzą do istniejących stron i używają ścieżek względnych.
- Obrazy korzystają z `<picture>` z AVIF/WebP/JPG, konkretnym `alt`, wymiarami i kontrolą wizualną.
- Tabele są semantycznym HTML z `caption`, `thead`, `tbody` i `scope`.
- `BlogPosting.citation` jest zgodne 1:1 z wykorzystaną listą źródeł.
- Publikacja wymaga stagingu desktop/mobile, PDF, obejrzenia wszystkich stron PDF, synchronizacji `_site` oraz pełnych walidatorów.

## Zasada naprawy podwójnej

- Problem wykryty przy `dodaj artykuł`, `Obal mit`, aktualizacji lub walidacji napraw najpierw w bieżącym artykule i jego wszystkich artefaktach.
- Następnie usuń przyczynę w odpowiednim elemencie systemu: importerze, fixerze, walidatorze, szablonie, mediach, PDF lub dokumentacji.
- Jeśli problem można wykryć maszynowo, dodaj test regresji albo celowo błędny fixture. Test ma najpierw odtwarzać błąd, a po naprawie potwierdzać jego blokadę lub prawidłową obsługę.
- Nie rozwiązuj problemu przez osłabienie bramki, zmianę błędu na warning ani wyjątek ograniczony do jednego slugu.
- Jednostkowego przypadku, którego nie można bezpiecznie automatyzować, nie uogólniaj na ślepo; dodaj konkretną kontrolę do `ARTICLE_STANDARD.md`.

## `popraw-seo`

- Nadrzędny cel: więcej widocznych artykułów i kliknięć.
- Raport obejmuje wszystkie indeksowalne `BlogPosting`; żaden URL nie może zostać pominięty.
- Każdy URL otrzymuje `BOOST`, `ROKUJE`, `NAPRAWA` albo `MONITORING` i konkretne działanie.
- Warstwa stron/property GSC jest nadrzędna wobec anonimizowanych query.
- Raport kończy się `AWAITING_USER_APPROVAL`. Bez akceptacji konkretnych ID nie edytuj HTML.
- Po zatwierdzeniu ID agent prowadzi cały proces bez dalszych komend użytkownika: konkretny manifest patchy, dry-run, atomowy apply i rollback, PDF/_site/sitemap, walidacja, commit/push, kontrola produkcji oraz końcowa lista GSC. Jeżeli etap nie przejdzie, zgłasza bloker zamiast go pomijać.
- Sam `git push` nie potwierdza produkcji. URL-e do GSC wolno podać dopiero po `LIVE_DEPLOYED_AND_VALIDATED`.
- Zatwierdzona pozycja przechodzi pełny Quality Gate, nie tylko korektę title/meta.

## `napraw paczkę N`

- Użyj stałego rejestru `data/reports/article-repair-batches.json`.
- Nie przeliczaj składu paczek.
- Wykonaj pełną naprawę treści, linków, wyglądu, mediów, PDF, dat, sitemap i `_site`.
