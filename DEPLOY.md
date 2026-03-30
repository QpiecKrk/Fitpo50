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
