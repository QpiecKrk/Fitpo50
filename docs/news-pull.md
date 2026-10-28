# Pobieranie NEWS z panelu

`npm run news:pull` pobiera NEWS z dwóch ograniczonych kont Hostinger. Skrypt używa wyłącznie operacji odczytu przez FTPS, sprawdza listę dozwolonych ścieżek, JSON, komplet obrazów i ich hashe. Nie łączy się z panelem administracyjnym i nie włącza `FITPO50_AUTO_GIT_SYNC`.

## Jednorazowa konfiguracja

1. Utwórz lokalny plik `~/.config/fitpo50/news-pull.env`.
2. Wpisz w nim dwie zmienne: `FITPO50_NEWS_DATA_PASSWORD` i `FITPO50_NEWS_ASSETS_PASSWORD`. Hasła przepisz z 1Password; nie wpisuj ich do repo ani rozmowy.
3. Ustaw uprawnienia poleceniem `chmod 600 ~/.config/fitpo50/news-pull.env`.
4. Najpierw sprawdź różnice: `npm run news:pull -- --dry-run`.
5. Po akceptacji pobierz: `npm run news:pull`. Skrypt sam uruchomi `npm run assets:mirror:sync`.

## Bezpieczeństwo i cofnięcie

- Certyfikat Hostinger ma nazwę `*.hstgr.io`, dlatego skrypt wymaga TLS i dodatkowo przypina publiczny klucz certyfikatu. Zmiana certyfikatu zatrzyma pobieranie z kodem 30; pin wolno zmienić dopiero po niezależnym potwierdzeniu nowego certyfikatu.
- Dozwolone są tylko: `data/news-live.json`, kopie `data/news-backups/news-live-*.json`, `assets/data/news-fallback.json` oraz bezpiecznie nazwane `assets/news/news_*.{jpg,webp,avif}`. Każdy opublikowany news musi mieć komplet trzech wariantów; nieopublikowane szkice nie trafiają do publicznego fallbacku.
- Przed każdą zwykłą lokalną podmianą kompletny zestaw odczytany z serwera trafia do `~/fitpo50-backups/news-<data>/`. Kopia ma manifest SHA-256, jest weryfikowana przed promocją, a katalog i pliki mają uprawnienia odpowiednio 700 i 600. Awaria tej kopii zatrzymuje operację z kodem 30 i niczego nie podmienia.
- Serwerowe `news-backups/news-live-*.json` są częścią kopii poza repo, ale nowe pliki z tego katalogu nie są promowane do `data/news-backups/` ani `_site/data/news-backups/`. Istniejących lokalnych plików historycznych skrypt nie usuwa.
- Osobna kopia `/tmp/fitpo50-news-pull-backup-<data>` zawiera poprzednie wersje tylko tych lokalnych plików, które mają zostać podmienione. W razie błędu podczas promocji skrypt automatycznie przywraca z niej poprzedni stan.
- `--dry-run` nie tworzy żadnej trwałej kopii ani nie zmienia repo. `--backup-only` nadal tworzy wyłącznie kompletną, zweryfikowaną kopię poza repo i nie uruchamia promocji ani mirroru.
- Kod 20 oznacza błąd danych na serwerze. Kod 30 oznacza problem sieci, logowania lub środowiska. Żaden z tych błędów nie powoduje częściowej podmiany lokalnych danych.
- `data/news-live.json` jest magazynem panelu i może zawierać szkice. Dostęp HTTP do `/data/` blokuje `.htaccess`; publiczny `assets/data/news-fallback.json` zawiera wyłącznie newsy opublikowane.
- Próba B, wdrożona w commicie `63065e09`, potwierdziła, że Hostinger usuwa z serwera plik skasowany z Gita. Dlatego `data/news-live.json`, `data/news-backups/*` i ich śledzone mirrory pozostają w repo do czasu Paczki 3, czyli przeniesienia danych panelu poza katalog deployu. Nie wolno ich teraz wyjmować z indeksu Git.
- Do czasu Paczki 3 szkiców nie wolno ręcznie dodawać do commita. Jeśli serwerowy live zawiera wpis nieopublikowany, `news:pull` aktualizuje lokalnie wyłącznie oba publiczne fallbacki i miniatury `news_20*`; pełny live pozostaje w kompletnej kopii z SHA-256 w `~/fitpo50-backups/news-<data>/`. Kończy się kodem 0 i wyraźnie informuje, że szkice nie trafiły do repo.
- `deployment:prepare` odczytuje przez FTPS oba pliki źródłowe panelu. `data/news-live.json` i `_site/data/news-live.json` porównuje wyłącznie z serwerowym `data/news-live.json`, a obie kopie fallbacku wyłącznie z serwerowym `assets/data/news-fallback.json`. Każda różnica daje `NEWS_OUT_OF_SYNC`; bramka nie ma flagi obejścia.
- Jeżeli którykolwiek śledzony plik live zawiera wpis ze statusem innym niż `published`, `deployment:prepare` kończy się kodem 20 i `NEWS_DRAFTS_IN_TRACKED_FILE`. Nie ma obejścia: opublikuj albo usuń szkice w panelu, potem uruchom `news:pull`.
- Nowe miniatury `news_20*`, których nie ma w checkout CI, są sprawdzane na serwerze: przez FTPS w `deployment:prepare` oraz przez publiczny HTTP w nightly i `deployment:finalize`. Brak któregokolwiek wariantu AVIF/WebP/JPG blokuje proces.

## Wdrożenie

Pobranie nie jest zgodą na commit, push ani wdrożenie. Przed każdym wdrożeniem trzeba najpierw pobrać NEWS i sprawdzić różnice. Bramka blokuje wdrożenie starszych plików, ale nie rozwiązuje docelowego problemu architektonicznego: dopiero Paczka 3 przeniesie dane panelu poza katalog wdrażany przez Git.
