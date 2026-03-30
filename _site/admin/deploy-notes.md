# Deploy Notes - Moje Sukcesy (Wzmocnienie)

Aby zapewnić optymalną wydajność zapytań kalendarza, wykonaj następujące polecenie w bazie danych:

```sql
-- Sprawdź czy indeks już istnieje
SHOW INDEX FROM entries WHERE Key_name = 'idx_entries_status_date';

-- Jeśli powyższe zapytanie nie zwróciło wyników, wykonaj:
CREATE INDEX idx_entries_status_date ON entries(status, entry_date);
```
