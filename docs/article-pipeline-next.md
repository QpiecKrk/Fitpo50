# Następne prace nad pipeline'em artykułów

## Paczka 1 — wiarygodność i pełny audyt wejścia

- Wiarygodny wynik `PASS`: poprawna obsługa sygnałów procesów oraz awarii walidatora Pythona.
- Weryfikacja SHA-256 obrazów na produkcji.
- Tożsamość paczki obejmująca wszystkie pliki wejściowe.
- `package:audit`: jeden raport zawierający wszystkie wykrywalne błędy JSON-u i obrazów. Każdy błąd ma wskazywać właściciela poprawki: Pisarz, Ilustrator albo Codex. Dla błędów obrazów raport ma zawierać gotowy prompt naprawczy dla Ilustratora.

## Paczka 2 — historia i retencja

- Trwała historia poprawek SEO.
- Bezpieczny kosz i retencja liczone od chwili przeniesienia do kosza.
- Ochrona aktywnych danych GSC przed sprzątaniem.

## Paczka 3 — architektura wdrożenia

- Atomowe wdrożenie całego publicznego wydania.
- Rozdzielenie trwałych danych panelu od kodu wdrażanego z Git.
- Prace rozpocząć dopiero po osobnym planie i po zmianie haseł.
