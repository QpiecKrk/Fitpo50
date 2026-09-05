# Publikacja centrów tematycznych

Centrum zachowuje istniejący układ `.hub-shell > main` i `h1#hub-title`.
`scripts/lib/publication-page-kind.js` wybiera kontrakt na podstawie struktury HTML.
Sam `BlogPosting` ani nazwa pliku nie wystarczają do rozpoznania artykułu.

## Źródło i regeneracja

Zatwierdzony pakiet SEO zapisuje finalny HTML centrum również w
`templates/topic-centers/`. Generator `build-preview-hubs.js` korzysta z tego
źródła przed historycznym szablonem. Opcja `--files plik.html,inny.html` ogranicza
regenerację do wskazanych centrów. Przy kolejnej aktualizacji trzeba zmienić
kanoniczne źródło, publiczny HTML, PDF i `_site` w jednej transakcji.

## Kontrakt

`validate-topic-center.py` wymaga pojedynczych, zgodnych `BlogPosting`,
`CollectionPage`, `ItemList` i FAQ, pełnych dat ISO, opisu 145–160 znaków,
istniejących linków kontekstowych, minimum czterech wykorzystanych źródeł,
udokumentowanego researchu pytań oraz przycisku własnego PDF.
Lista `ItemList` odpowiada kartom poradników; linki w akapicie wprowadzającym
nie są osobnymi pozycjami tej listy.

Walidator wymaga Python 3 i `beautifulsoup4==4.14.3`. Zależność jest instalowana
w workflow Article Publish Guard. Zmienione centra przechodzą ten sam wrapper
CI co zmienione artykuły, z kontraktem właściwym dla ich układu.

Centra są odkrywane ze strony głównej. Predeploy sprawdza ich wpis w sitemap
i `llms.txt`, PDF oraz zgodność źródła z `_site`. Indeks wyszukiwania i pełny
indeks AI odczytują treść centrum z `main`.

## Staging i kontrola wizualna

`popraw-seo:apply` bez `--promote-stage` przygotowuje izolowany staging i kończy
się statusem `AWAITING_VISUAL_REVIEW`. Oryginalny HTML pozostaje bez zmian.
Po obejrzeniu desktop 1440 px, mobile 390 px i **każdej strony PDF** agent
uruchamia tę samą komendę z `--promote-stage <katalog-stagingu>`.
Nie jest to ponowna prośba użytkownika o zgodę: wcześniejsze zatwierdzenie ID
obejmuje cały proces. Promocja sprawdza hashe stagingu i stan bazowy źródeł;
błąd walidacji przywraca cały pakiet.

PDF powstaje przez `generate-topic-center-pdf.js`. Druk usuwa nawigację,
dekoracje i zdublowaną szybką odpowiedź, zachowując treść, aktywne linki,
źródła oraz disclaimer. Bramka porównuje tekst z HTML, osadzone fonty,
marginesy i format A4. Tolerancja wymiarów A4 wynosi poniżej 0,5 punktu
ze względu na zaokrąglenie współrzędnych PDF przez różne generatory.

Testy regresji: `node --test tests/topic-center-pipeline.test.js tests/popraw-seo-automation.test.js`.
Po lokalnej walidacji nadal obowiązują commit/push i niezależne potwierdzenie
produkcji. Lista GSC może powstać dopiero po `LIVE_DEPLOYED_AND_VALIDATED`.
