# Deploy

Do `public_html` wrzucaj tylko wyeksportowaną wersję strony, nie całe repo.

Eksport czystej wersji:

```bash
./scripts/export_site.sh
```

Wynik trafia do katalogu `_site/`.

Na serwer wysyłaj zawartość `_site/`, a nie katalog główny projektu.

`export_site.sh` automatycznie:
- sprawdza zależności npm,
- doinstaluje je, jeśli brakuje (`npm install`),
- buduje TypeScript (`npm run build`),
- dopiero potem generuje czysty katalog `_site/`.

Awaryjnie (tylko świadomie, gdy chcesz pominąć kompilację TS):

```bash
SKIP_TS_BUILD=1 ./scripts/export_site.sh
```

## Hostinger: szybka naprawa błędu "Changes not staged for commit"

Jeśli deploy na Hostinger zatrzyma się, bo repo na serwerze jest "brudne"
(najczęściej lokalne zmiany w `data/news-live.json`, `assets/data/news-fallback.json`
oraz plikach `assets/news/news_20*`), uruchom w katalogu repo:

```bash
npm run hostinger:clean-repo
```

Co robi ta komenda:
- tworzy backup lokalnych plików NEWS do `/tmp/fitpo50-deploy-backup-YYYYmmdd-HHMMSS`,
- pobiera `origin/main`,
- wykonuje `git reset --hard origin/main`,
- wykonuje `git clean -fd`,
- pokazuje końcowy `git status --short` (powinno być pusto).
