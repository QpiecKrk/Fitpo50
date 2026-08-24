# Monitoring po publikacji

## Cel

System łączy każdą realną publikację z późniejszym pomiarem widoczności i kliknięć. Historia jest tworzona dopiero po przejściu stagingu i podglądu, a następnie wchodzi do repo w tej samej transakcji co HTML, media, PDF, listingi, sitemap i `_site`.

## Artefakty publikacji

- `data/reports/published-articles-log.json` — historia URL-a i lista `publication_events`; każde `CREATE`/`UPDATE` zachowuje transakcję, własny baseline i terminy 7/14/28.
- `data/reports/gsc-after-publication-queue.json` — target, sitemap oraz faktycznie linkujące strony źródłowe do ponownego przeskanowania.
- `data/reports/gsc-after-publication-queue.txt` — czytelna kolejka do ręcznego użycia w GSC.
- `data/reports/article-publications/<slug>.json` — manifest wszystkich atomowo opublikowanych plików i ich hashy.

Jeżeli historia, baseline, trzy checkpointy lub kolejka są niekompletne, `validatePublicationSet` blokuje publikację, a transakcja przywraca poprzedni stan.

## Baseline i checkpointy

Baseline strony pochodzi z `web-28-current-pages.csv` albo kanonicznego `pages.csv`. Zapisywane są kliknięcia, wyświetlenia, CTR, pozycja, zakres danych, czas generacji i stan kontraktu GSC.

Brak świeżych danych ma status `GSC_INPUT_UNAVAILABLE`. Brak URL-a w pełnej warstwie stron ma status `NO_GSC_ROW_AT_PUBLICATION`. Te stany nie są ukrywane i nie są przedstawiane jako udany pomiar z wartością zero.

Checkpointy po 7, 14 i 28 dniach są utrwalane przy pierwszym przebiegu GSC wykonanym po terminie. Raport zachowuje też pierwszy wykryty wzrost wyświetleń, pierwszy wzrost kliknięć oraz sygnał „zindeksowana bez wyświetleń”. Dla baseline równego 0 pierwszy wzrost jest pierwszym widocznym sygnałem; dla aktualizowanego URL-a oznacza przekroczenie wartości baseline w kroczącym oknie, a nie surowe zdarzenie dzienne.

## Komendy

```bash
npm run gsc:post-publication
npm run test:pipeline-blockers
npm run reports:prune:dry
```

`npm run gsc:auto` uruchamia monitoring automatycznie. Wynik trafia do `~/Downloads/gsc-auto-input/post-publication-monitor.json` i `.md`, więc analityczna komenda `GSC` pozostaje read-only wobec repozytorium.

## Interpretacja

Metryki stron są kroczącym oknem 28 dni. Delta względem baseline pokazuje kierunek po publikacji, lecz nie dowodzi, że cała zmiana wynika wyłącznie z jednej edycji. Ocenę należy łączyć z datą wdrożenia, indeksacją, checkpointami oraz zmianami wykonanymi na stronach źródłowych.

## Końcowa macierz blokad

Fixture w `tests/fixtures/pipeline-invalid/` sprawdzają osiem błędów obowiązkowo zatrzymujących pipeline:

1. fałszywe lub niedziałające źródło,
2. generyczny quick answer,
3. sztuczne FAQ,
4. link do nieistniejącej strony,
5. brak obrazów lub wariantów,
6. tabela bez semantycznego HTML,
7. pusty lub uszkodzony PDF,
8. kolizja slugu przy domyślnym `force=false`.

Stare raporty nie są usuwane automatycznie. `npm run reports:prune:dry` najpierw pokazuje bezpiecznych, nieśledzonych kandydatów; usunięcie wymaga osobnej świadomej decyzji.
