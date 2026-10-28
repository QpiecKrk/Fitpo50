# Panel Redakcyjny FitPo50 — Instrukcja Deploymentu

> **Środowisko produkcyjne:** Hostinger Premium  
> **Subdomena:** `https://admin.fitpo50.pl`  
> **Katalog na serwerze:** `/home/u542460614/domains/fitpo50.pl/public_html/admin`

---

## ⚠️ Przed deploymentem — Lista bezpieczeństwa

- [ ] `admin/config.php` jest w `.gitignore` — **nigdy nie idzie do repo**  
- [ ] `admin/bootstrap.php` jest wgrany — pokazuje czytelny błąd, gdy brakuje `config.php` lub tabel
- [ ] Prywatna kopia `config.php` istnieje poza `public_html`, np. w katalogu domowym konta
- [ ] `admin/uploads/*` jest w `.gitignore`  
- [ ] `init-hash.php` i `init-db.php` nie istnieją w repo ani na serwerze; konfigurację wykonujesz wyłącznie z CLI według `docs/admin-cli-setup.md`
- [ ] `FITPO50_AUTO_GIT_SYNC` jest nieustawione lub ma wartość `0`; Git push i `pull --rebase` z serwera są domyślnie wyłączone
- [ ] Basic Auth (Directory Privacy) jest aktywne na Hostingerze dla `admin.fitpo50.pl`

---

## Kroki deploymentu (w tej kolejności)

### 1. Wgraj folder `admin/` na serwer

Przez FTP lub menedżer plików Hostingera skopiuj zawartość lokalnego `admin/` do:  
```
/home/u542460614/domains/fitpo50.pl/public_html/admin/
```

**Nie wgrywaj** prawdziwego `admin/config.php` z lokalnego komputera — utwórz go ręcznie na serwerze z `admin/config.example.php` (krok 2).

---

### 2. Utwórz `config.php` ręcznie na serwerze

```
/home/u542460614/domains/fitpo50.pl/public_html/admin/config.php
```

Skopiuj zawartość z `admin/config.example.php`.  
Uzupełnij dane z panelu Hostinger → Bazy danych → MySQL:

```php
define('DB_HOST', 'localhost');
define('DB_NAME', 'u542460614_NAZWA');   // ← z Hostingera
define('DB_USER', 'u542460614_USER');    // ← z Hostingera
define('DB_PASS', 'TWOJE_HASLO_DB');     // ← z Hostingera
define('PASSWORD_HASH', '');             // ← uzupełnisz w kroku 4
```

Zrób prywatną kopię poza katalogiem strony:

```bash
cp /home/u542460614/domains/fitpo50.pl/public_html/admin/config.php /home/u542460614/admin-config.fitpo50.php
chmod 600 /home/u542460614/admin-config.fitpo50.php
```

---

### 3. Wygeneruj hash i utwórz tabele przez CLI

Połącz się przez SSH i wykonaj procedurę z [`docs/admin-cli-setup.md`](../docs/admin-cli-setup.md). Nie kopiuj do katalogu publicznego żadnych jednorazowych skryptów PHP.

---

### 4. Sprawdź uprawnienia katalogów

```bash
chmod 755 /home/u542460614/domains/fitpo50.pl/public_html/admin/
chmod 755 /home/u542460614/domains/fitpo50.pl/public_html/admin/uploads/
chmod 600 /home/u542460614/domains/fitpo50.pl/public_html/admin/config.php
```

---

### 5. Sprawdź konfigurację z SSH

```bash
cd /home/u542460614/domains/fitpo50.pl/public_html/admin
php -l config.php
php -r 'require "bootstrap.php"; echo "CONFIG OK\n";'
php -r 'require "auth.php"; requireAdminTables(["failed_logins"]); echo "DB TABLES OK\n";'
```

Jeśli brakuje `config.php`, danych bazy albo tabel, panel pokaże teraz konkretny komunikat zamiast białej strony.

---

### 6. Testuj panel

Przejdź na `https://admin.fitpo50.pl` → Basic Auth → strona logowania PHP.

**Checklist testowy:**
- [ ] Logowanie Twoim hasłem działa
- [ ] 5 złych haseł → blokada na 15 min
- [ ] Dodanie newsa roboczego
- [ ] Publikacja, edycja i usunięcie newsa działają w panelu NEWS
- [ ] `https://admin.fitpo50.pl/robots.txt` → `Disallow: /`
- [ ] `init-hash.php` i `init-db.php` nie istnieją na serwerze

---

## Struktura plików (admin/)

```
admin/
├── index.php              ← przekierowanie login/news-dashboard
├── login.php              ← strona logowania (warstwa 2)
├── logout.php             ← wylogowanie
├── news-dashboard.php     ← lista newsów
├── news-form.php          ← formularz dodawania/edycji newsów
├── bootstrap.php          ← bezpieczne ładowanie configu i komunikaty awarii
├── config.php             ← ⚠️ NIE W REPO — tworzysz ręcznie na serwerze
├── auth.php               ← middleware: sesja, PDO, CSRF, rate limit
├── actions/
│   ├── news-save.php      ← zapis newsa
│   ├── news-delete.php    ← usunięcie newsa
│   └── news-status.php    ← publikacja lub cofnięcie publikacji newsa
├── partials/
│   └── flash.php          ← komunikaty flash (sukces/błąd)
├── assets/
│   └── panel.css          ← style panelu
├── uploads/               ← media (NIE W REPO)
│   └── .htaccess          ← blokada PHP w uploads
├── robots.txt             ← Disallow: /
└── .htaccess              ← nagłówki bezpieczeństwa, noindex
```

---

---

## Bezpieczeństwo — podsumowanie

| Zabezpieczenie | Metoda |
|---|---|
| Warstwa 1 | Basic Auth (Directory Privacy Hostinger) |
| Warstwa 2 | Logowanie PHP + bcrypt hash (cost=12) |
| Sesja | httpOnly cookie, SameSite=Strict, timeout 2h |
| Brute-force | Rate limiting: blokada po 5 próbach / 15 min |
| CSRF | Token w każdym formularzu POST |
| Upload | Tylko obrazy, max 10 MB, blokada PHP w uploads/ |
| Crawlery | robots.txt `Disallow: /` + meta noindex + X-Robots-Tag |
| Ukrycie | Panel poza publiczną nawigacją strony |
