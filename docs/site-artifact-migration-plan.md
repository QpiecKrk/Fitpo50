# Plan Migracji `_site` Do Artifact-Only

Obecnie `_site/` jest częścią workflow deployu i bywa commitowany. Nie należy wyłączać go z Gita jednym ruchem bez zmiany sposobu publikacji.

## Cel

`_site/` ma być katalogiem generowanym przez `scripts/export_site.sh`, a nie źródłem prawdy.

## Etap 1 — Bezpieczeństwo

- Prywatne pliki admina nie mogą trafiać do `_site`.
- `admin/config.php`, `config*.php`, `init-db.php`, `init-hash.php` są wykluczone z eksportu.
- Deploy musi działać bez init-skryptów i bez configu w repo.

## Etap 2 — Kontrola driftu

- Przed commitem/pushem sprawdzać różnice source ↔ `_site` tylko dla plików publicznych.
- Wygenerowane duże artefakty, np. `llms-full.txt`, powinny być generowane przy eksporcie i ignorowane w Git.

## Etap 3 — Zmiana deployu

- GitHub Actions albo lokalny deploy buduje `_site` z source.
- `_site` jest uploadowany jako artifact/deploy output.
- Repo przestaje śledzić `_site/` po potwierdzeniu, że hosting/deploy nie wymaga commitu `_site`.

## Blokery Decyzyjne

- Jak Hostinger pobiera pliki: z `main` razem z `_site`, czy z outputu skryptu?
- Czy deploy może uruchomić `scripts/export_site.sh` po stronie CI/lokalnie przed wysyłką?
- Czy historia `_site` jest potrzebna do rollbacku?

## Rekomendacja

Na teraz utrzymać `_site` jako deploy mirror, ale bez sekretów i bez dużych generowanych plików. Migrację artifact-only zrobić jako osobny task po potwierdzeniu ścieżki deployu.
