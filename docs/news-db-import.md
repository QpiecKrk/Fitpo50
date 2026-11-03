# Jednorazowy import NEWS do shadow store MySQL

Importer `scripts/news-db-import.php` jest narzędziem CLI do jednorazowego,
kontrolowanego przeniesienia aktualnej koperty `data/news-live.json` do pustych
tabel `news` i `news_journal`. Nie jest trasą HTTP i nie jest używany przez
panel. Skrypt nie tworzy tabel i nie aktualizuje istniejących rekordów.

## Warunki bezpieczeństwa

- Uruchamiaj przez SSH z katalogu
  `/home/u542460614/domains/fitpo50.pl/public_html`.
- Na czas sekwencji dry-run → apply → verify nikt nie edytuje NEWS w panelu.
- Prywatny `admin/config.php` musi definiować stałe `NEWS_DB_*`; nie podawaj ich
  w argumentach ani nie wypisuj ich w terminalu.
- Domyślny tryb to `--dry-run`. Zapis wymaga trzech wartości zwróconych przez
  bezpośrednio poprzedzający dry-run.
- `--apply` odmawia działania, jeśli którakolwiek tabela nie jest pusta.
- Kody: `0` sukces, `20` błąd danych lub warunku bezpieczeństwa, `30` błąd
  środowiska. Wynik zawiera tylko identyfikatory, liczniki i skróty.

## 1. Dry-run

```sh
cd /home/u542460614/domains/fitpo50.pl/public_html
php scripts/news-db-import.php --dry-run
```

Zapisz dokładnie wartości `COUNT`, `SOURCE_FILE_SHA256` i `SNAPSHOT_SHA256`.
Dry-run waliduje plik i odczytuje liczniki tabel; nie wykonuje DML.

## 2. Import w jednej transakcji

Podstaw wyłącznie wartości zwrócone przez krok 1:

```sh
php scripts/news-db-import.php --apply \
  --expect-count=<COUNT> \
  --expect-source-sha256=<SOURCE_FILE_SHA256> \
  --expect-snapshot-sha256=<SNAPSHOT_SHA256>
```

Sukces kończy się `IMPORT_OK: APPLY`, licznikami oraz `CHANGE_ID`. Importer
ponownie sprawdza skrót pliku przed zatwierdzeniem transakcji. Błąd powoduje
rollback całej transakcji.

## 3. Porównanie plik ↔ baza

Użyj tych samych trzech wartości:

```sh
php scripts/news-db-import.php --verify \
  --expect-count=<COUNT> \
  --expect-source-sha256=<SOURCE_FILE_SHA256> \
  --expect-snapshot-sha256=<SNAPSHOT_SHA256> \
  --change-id=<CHANGE_ID>
```

Oczekiwany wynik to `IMPORT_OK: VERIFY` oraz dokładnie `COUNT` technicznych
linii `MATCH id=… sha256=…`. Weryfikacja wymaga również dokładnie jednego
wpisu `import` w `news_journal`, zgodnego `CHANGE_ID` i zgodnego skrótu
snapshotu przeliczonego z tabeli `news`. Polecenie nie wypisuje tytułów, HTML
ani źródeł.

## 4. Kontrolowany rollback do 0/0

Rollback jest dozwolony tylko wtedy, gdy baza nadal zawiera dokładnie
`COUNT` newsów, jeden wpis dziennika typu `import`, zgodny `CHANGE_ID` i zgodny
snapshot. Każda późniejsza zmiana blokuje kasowanie.

```sh
php scripts/news-db-import.php --rollback \
  --expect-count=<COUNT> \
  --expect-snapshot-sha256=<SNAPSHOT_SHA256> \
  --change-id=<CHANGE_ID>
```

Oczekiwany wynik: `IMPORT_OK: ROLLBACK`, `NEWS_ROWS: 0` i
`JOURNAL_ROWS: 0`. Jeśli warunki nie są identyczne, nie próbuj ręcznego
kasowania — zatrzymaj się i ustal nowy plan.

## Po próbie

Panel i strona nadal czytają pliki JSON; ten import nie przełącza żadnego
odczytu ani zapisu. Zachowaj techniczny log komend bez danych konfiguracyjnych.
