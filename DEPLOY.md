# Deploy

Do `public_html` wrzucaj tylko wyeksportowaną wersję strony, nie całe repo.

Eksport czystej wersji:

```bash
./scripts/export_site.sh
```

Wynik trafia do katalogu `_site/`.

Na serwer wysyłaj zawartość `_site/`, a nie katalog główny projektu.
