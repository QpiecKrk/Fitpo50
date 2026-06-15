# Security Rotation Checklist

Ten dokument nie zawiera sekretów. Służy tylko jako checklista po usunięciu `admin/config.php` i `_site/admin/config.php` z repo.

## Kiedy wykonać

Wykonaj natychmiast, jeśli realne dane dostępowe były kiedykolwiek śledzone w Git albo wysłane do zdalnego repozytorium.

## Kroki

1. Zmień hasło użytkownika bazy danych w panelu Hostingera.
2. Zaktualizuj `DB_PASS` w produkcyjnym `admin/config.php` na serwerze.
3. Wygeneruj nowy hash hasła admina poza repozytorium.
4. Zaktualizuj `PASSWORD_HASH` w produkcyjnym `admin/config.php` na serwerze.
5. Upewnij się, że `APP_ENV` w produkcji ma wartość `prod` albo nie pozwala na tryb `dev`.
6. Sprawdź logowanie do panelu admina.
7. Sprawdź, że publiczny export `_site/admin/` nie zawiera `config*.php` ani `init-*.php`.

## Weryfikacja lokalna

```bash
git ls-files admin/config.php _site/admin/config.php _site/admin/init-db.php _site/admin/init-hash.php
find _site/admin -maxdepth 1 -type f \( -name 'config*.php' -o -name 'init-*.php' \) -print
```

Obie komendy nie powinny zwrócić prywatnych plików.
