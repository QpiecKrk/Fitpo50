# Inicjalizacja panelu admina z CLI

Panel nie udostępnia publicznych skryptów inicjalizacyjnych. Hash hasła i tabele bazy przygotowuj wyłącznie z terminala przez SSH, poza żądaniem HTTP.

## 1. Wygeneruj hash hasła

Uruchom w katalogu repozytorium. Hasło nie trafia do historii powłoki:

```bash
read -r -s -p "Hasło administratora: " FITPO50_ADMIN_PASSWORD; printf '\n'
export FITPO50_ADMIN_PASSWORD
php -r '$password = getenv("FITPO50_ADMIN_PASSWORD"); if (!is_string($password) || $password === "") { fwrite(STDERR, "Brak hasła\n"); exit(1); } fwrite(STDOUT, password_hash($password, PASSWORD_BCRYPT, ["cost" => 12]) . PHP_EOL);'
unset FITPO50_ADMIN_PASSWORD
```

Wklej otrzymany hash jako `PASSWORD_HASH` do prywatnego `admin/config.php`. Nie zapisuj hasła ani pliku konfiguracyjnego w repozytorium.

## 2. Utwórz tabele

Użyj danych bazy z prywatnego `admin/config.php`. Opcja `--password` bez wartości powoduje bezpieczne pytanie o hasło zamiast zapisywania go w historii:

```bash
mysql --host=DB_HOST --user=DB_USER --password --database=DB_NAME < docs/admin-schema.sql
```

## 3. Zweryfikuj konfigurację

```bash
php -l admin/config.php
php -r 'require "admin/bootstrap.php"; echo "CONFIG OK\n";'
php -r 'require "admin/auth.php"; requireAdminTables(["entries","media","failed_logins"]); echo "DB TABLES OK\n";'
```

Pliki `admin/init-db.php` i `admin/init-hash.php` nie mogą istnieć ani w repozytorium, ani na serwerze.
