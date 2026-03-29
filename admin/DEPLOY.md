# Panel Redakcyjny FitPo50 — Instrukcja Deploymentu

> **Środowisko produkcyjne:** Hostinger Premium  
> **Subdomena:** `https://admin.fitpo50.pl`  
> **Katalog na serwerze:** `/home/u542460614/domains/fitpo50.pl/public_html/admin`

---

## ⚠️ Przed deploymentem — Lista bezpieczeństwa

- [ ] `admin/config.php` jest w `.gitignore` — **nigdy nie idzie do repo**  
- [ ] `admin/uploads/*` jest w `.gitignore`  
- [ ] `init-hash.php` i `init-db.php` **nie są linkowane nigdzie** w kodzie — tylko wywołujesz je raz ręcznie przez URL, po czym kasują się same  
- [ ] Basic Auth (Directory Privacy) jest aktywne na Hostingerze dla `admin.fitpo50.pl`

---

## Kroki deploymentu (w tej kolejności)

### 1. Wgraj folder `admin/` na serwer

Przez FTP lub menedżer plików Hostingera skopiuj zawartość lokalnego `admin/` do:  
```
/home/u542460614/domains/fitpo50.pl/public_html/admin/
```

**Nie wgrywaj** `admin/config.php` z repo — utwórz go ręcznie (krok 2).

---

### 2. Utwórz `config.php` ręcznie na serwerze

```
/home/u542460614/domains/fitpo50.pl/public_html/admin/config.php
```

Skopiuj zawartość z `admin/config.php` (wersja z repo ma placeholdery).  
Uzupełnij dane z panelu Hostinger → Bazy danych → MySQL:

```php
define('DB_HOST', 'localhost');
define('DB_NAME', 'u542460614_NAZWA');   // ← z Hostingera
define('DB_USER', 'u542460614_USER');    // ← z Hostingera
define('DB_PASS', 'TWOJE_HASLO_DB');     // ← z Hostingera
define('PASSWORD_HASH', '');             // ← uzupełnisz w kroku 4
```

---

### 3. Zainicjalizuj bazę danych

Otwórz w przeglądarce (będziesz zapytany o Basic Auth):

```
https://admin.fitpo50.pl/init-db.php?token=setup2026fitpo50
```

- Skrypt tworzy tabele `entries`, `media`, `failed_logins`
- **Kasuje się automatycznie** po wykonaniu
- Jeśli nie usunął się sam → usuń `init-db.php` ręcznie przez FTP

---

### 4. Wygeneruj hash hasła

> ⚠️ `init-hash.php` **nie jest podlinkowany nigdzie** — wywołujesz go tylko raz, tu.

```
https://admin.fitpo50.pl/init-hash.php?token=setup2026fitpo50
```

- Skrypt wyświetli hash bcrypt dla hasła `272Archawili`
- **Skopiuj hash** do `config.php` → `PASSWORD_HASH`
- **Kasuje się automatycznie** po wykonaniu
- Jeśli nie usunął się sam → usuń `init-hash.php` ręcznie przez FTP

---

### 5. Wklej hash do config.php

Otwórz `config.php` na serwerze (przez menedżer plików lub SSH) i uzupełnij:

```php
define('PASSWORD_HASH', '$2y$12$...TWÓJ_HASH...');
```

---

### 6. Sprawdź uprawnienia katalogów

```bash
chmod 755 /home/u542460614/domains/fitpo50.pl/public_html/admin/
chmod 755 /home/u542460614/domains/fitpo50.pl/public_html/admin/uploads/
chmod 600 /home/u542460614/domains/fitpo50.pl/public_html/admin/config.php
```

---

### 7. Testuj panel

Przejdź na `https://admin.fitpo50.pl` → Basic Auth → strona logowania PHP.

**Checklist testowy:**
- [ ] Logowanie hasłem `272Archawili` działa
- [ ] 5 złych haseł → blokada na 15 min
- [ ] Dodanie wpisu (roboczy) — brak fistaszka w kalendarzu
- [ ] Zmiana na "Opublikowany" → plik HTML wygenerowany + fistaszek w kalendarzu
- [ ] Edycja wpisu → HTML zaktualizowany
- [ ] Usunięcie wpisu → HTML usunięty + fistaszek znikł
- [ ] `https://admin.fitpo50.pl/robots.txt` → `Disallow: /`
- [ ] `init-hash.php` i `init-db.php` nie istnieją na serwerze

---

## Struktura plików (admin/)

```
admin/
├── index.php              ← przekierowanie login/dashboard
├── login.php              ← strona logowania (warstwa 2)
├── logout.php             ← wylogowanie
├── dashboard.php          ← lista wpisów
├── entry-form.php         ← formularz dodawania/edycji
├── config.php             ← ⚠️ NIE W REPO — tworzysz ręcznie na serwerze
├── auth.php               ← middleware: sesja, PDO, CSRF, rate limit
├── init-db.php            ← jednorazowy init DB — kasuje się sam
├── init-hash.php          ← jednorazowy generator hasha — kasuje się sam
├── actions/
│   ├── save.php           ← zapis wpisu + generowanie HTML + kalendarz
│   ├── delete.php         ← usunięcie + cleanup
│   ├── publish.php        ← publikacja z dashboardu
│   └── unpublish.php      ← cofnięcie publikacji
├── templates/
│   ├── article.php        ← szablon artykułu (zgodny z Porady)
│   └── day-list.php       ← lista wpisów z jednego dnia
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

## Integracja z moje-sukcesy.html

PHP automatycznie aktualizuje tablicę `userEntries` w pliku `moje-sukcesy.html` na serwerze.

- **Publikacja wpisu** → dodaje `{ date: "YYYY-MM-DD", url: "https://..." }` do tablicy
- **Usunięcie wpisu** → usuwa odpowiedni wpis z tablicy
- **Wiele wpisów jednego dnia** → URL prowadzi do strony listy `wpisy-YYYY-MM-DD.html`

PHP musi mieć uprawnienie zapisu do `moje-sukcesy.html` na serwerze.

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
