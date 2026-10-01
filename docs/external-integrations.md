# Integracje zewnętrzne FitPo50

## Wspólny kontrakt statusów

Każda operacja GSC i IndexNow kończy się jednym statusem: `OK_VERIFIED`, `MISSING_CONFIG`, `AUTH_FAILED`, `REQUEST_FAILED`, `DATA_INVALID` albo `SKIPPED_EXPLICITLY`. Tylko `OK_VERIFIED` potwierdza wykonanie operacji.

Raport diagnostyczny GSC ma `report_kind: DIAGNOSTIC`, kończy proces błędem i nie może utworzyć CSV ani manifestu. Prawdziwy raport ma `report_kind: DATASET`, status `OK_VERIFIED`, jawny `auth_mode` i przechodzi `gsc-data-contract`.

Dowód IndexNow zawiera czas próby, operację, endpoint, kod HTTP, liczbę URL-i, SHA-256 uporządkowanej listy URL-i i wynik walidacji odpowiedzi. Nie zawiera klucza ani pełnej odpowiedzi serwera.

## Konfiguracja GSC

Lokalnym kanonicznym plikiem GSC jest `~/.fitpo50-gsc.env`. `.env.local` pozostaje plikiem ogólnym projektu; `scripts/with-local-env.sh` ładuje go najpierw, a konfigurację GSC z katalogu domowego jako ostatnią. GitHub Actions korzysta wyłącznie z GitHub Secrets.

Wymagane jest `GSC_SITE_URL=sc-domain:fitpo50.pl` oraz jeden kompletny tryb:

- service account: `GSC_SERVICE_ACCOUNT_JSON_B64` lub `GSC_SERVICE_ACCOUNT_JSON`; adres `client_email` z tego samego dokumentu musi mieć co najmniej odczyt właściwości `sc-domain:fitpo50.pl`;
- OAuth: `GSC_OAUTH_CLIENT_ID`, `GSC_OAUTH_CLIENT_SECRET` i `GSC_OAUTH_REFRESH_TOKEN` muszą pochodzić z jednego klienta OAuth.

Nie usuwaj działającego OAuth podczas uruchamiania service account. Raport zapisuje użyty tryb, a błędy rozróżniają wadliwy klucz, brak dostępu service account, nieprawidłowego klienta OAuth i nieważny refresh token.

`node scripts/external-config-check.js` pokazuje wyłącznie obecność nazw zmiennych. Nigdy nie drukuje wartości sekretów.
