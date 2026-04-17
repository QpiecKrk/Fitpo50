# Admin Changelog

## 2026-04-17

### Uproszczenie flow zapisu i publikacji
- `Zapisz` w formularzach:
  - `admin/entry-form.php`
  - `admin/news-form.php`
  zapisuje zawsze do `draft`.
- Publikacja zostaje tylko z list:
  - `admin/dashboard.php` (wpisy)
  - `admin/news-dashboard.php` (newsy)
- Usunieto zbedne elementy akcji:
  - przycisk `Roboczy` pod `Zapisz` (entry form),
  - zbedny `Anuluj` w dolnej sekcji `news-form`.

### Batchowanie list w panelu
- `admin/dashboard.php`: ladowanie rekordow `10 + 10`.
- `admin/news-dashboard.php`: ladowanie rekordow `10 + 10`.
- Dodane proste kontrolki "Pokaz kolejne" i status liczby widocznych rekordow.

### Powiazane zmiany frontendowe
- Strona glowna (`index.html`) sekcja NEWS: `5 + 5` z:
  - auto-ladowaniem przez `IntersectionObserver`,
  - fallbackiem "Pokaz kolejne 5".
- Globalny "instant click" (prefetch linkow wewnetrznych) przez:
  - `src/app.ts`
  - `dist/app.js`
