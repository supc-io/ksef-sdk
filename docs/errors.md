# Obsługa błędów

## Hierarchia błędów

```
Error (native)
└── KsefError (bazowy, opcjonalne `cause`)
    ├── KsefApiError (błędy HTTP od KSeF)
    │   ├── ValidationError         (400, 422)
    │   ├── AuthenticationError     (401)
    │   ├── PermissionDeniedError   (403)
    │   ├── NotFoundError           (404)
    │   ├── RateLimitError          (429)
    │   └── ServerError             (5xx)
    ├── XsdValidationError (lokalna walidacja XSD)
    ├── ConnectionError (timeout, sieć, przerwanie, wyczerpane ponowienia)
    ├── ConfigurationError (konfiguracja buildera, certyfikat, openssl, xmllint, schemat XSD)
    └── SessionError (brak aktywnej sesji, nieudana inicjalizacja sesji)
```

## Użycie

```typescript
import {
  KsefError,
  KsefApiError,
  AuthenticationError,
  PermissionDeniedError,
  NotFoundError,
  ValidationError,
  RateLimitError,
  ServerError,
  ConnectionError,
  ConfigurationError,
  SessionError,
  XsdValidationError,
} from '@supcio/ksef-sdk';
```

### Łapanie konkretnych błędów

```typescript
try {
  await client.invoices.send({ xml: invoiceXml });
} catch (error) {
  if (error instanceof ValidationError) {
    // 400 / 422 — np. niepoprawny XML faktury
    console.log('Kod błędu KSeF:', error.code);
    console.log('Wiadomość:', error.message);
  } else if (error instanceof RateLimitError) {
    // 429 — przekroczony limit requestów
    console.log('Retry-After:', error.headers['retry-after']);
  } else if (error instanceof AuthenticationError) {
    // 401 — sesja wygasła lub nieprawidłowa; lokalna sesja została wyczyszczona
  } else if (error instanceof PermissionDeniedError) {
    // 403 — brak uprawnień
  } else if (error instanceof NotFoundError) {
    // 404 — zasób nie istnieje
  } else if (error instanceof ServerError) {
    // 5xx — błąd po stronie KSeF
  } else if (error instanceof SessionError) {
    // Brak uwierzytelnienia lub otwartej sesji — wywołaj client.auth.authenticate() / client.sessions.open()
  } else if (error instanceof ConnectionError) {
    // Timeout, błąd sieciowy lub przerwanie
    console.log('Przyczyna:', error.cause);
  }
}
```

### Łapanie wszystkich błędów API

```typescript
try {
  await client.invoices.send({ xml: invoiceXml });
} catch (error) {
  if (error instanceof KsefApiError) {
    // Dowolny błąd HTTP od KSeF
    console.log('Status HTTP:', error.status);
    console.log('Kod KSeF:', error.code);
    console.log('Request ID:', error.requestId);
    console.log('Headers:', error.headers);
  }
}
```

## KsefApiError — właściwości

| Właściwość  | Typ                          | Opis                                         |
| ----------- | ---------------------------- | -------------------------------------------- |
| `status`    | `number`                     | Kod HTTP (400, 401, 403, 404, 422, 429, 5xx) |
| `code`      | `string \| null`             | `exceptionCode` z `ExceptionResponse` lub `reasonCode` z problem details (403) |
| `requestId` | `string \| null`             | `exception.referenceNumber` lub `traceId`    |
| `details`   | `string[]`                   | Dodatkowe linie szczegółów (`details` wyjątku, `status.details` przy 429) |
| `headers`   | `Record<string, string>`     | Nagłówki odpowiedzi HTTP                     |
| `message`   | `string`                     | Opis błędu                                   |

## ValidationError

KSeF zgłasza błędy walidacji faktury i requestu jako HTTP **400** z listą `exception.exceptionDetailList`; niektóre endpointy używają też 422. Oba kody mapują się na `ValidationError`, więc jeden blok `instanceof ValidationError` obsługuje wszystkie przypadki.

## PermissionDeniedError

HTTP 403 w formacie problem details. `code` zawiera `reasonCode`: `missing-permissions`, `ip-not-allowed`, `insufficient-resource-access`, `auth-method-not-allowed`, `security-service-blocked`, `context-type-not-allowed`.

## AuthenticationError

HTTP 401. Przy uwierzytelnionym requeście SDK najpierw próbuje odświeżyć access token i ponowić request; `AuthenticationError` trafia do kodu wywołującego dopiero, gdy to się nie uda. Lokalne tokeny i sesja są wtedy wyczyszczone.

## ConnectionError

Rzucany gdy:
- Request przekroczy timeout (domyślnie 30s) — `Request timed out after Nms`
- Wywołujący przerwie request przez `AbortSignal` — `Request aborted by caller`
- Serwer jest nieosiągalny (ECONNREFUSED), błąd DNS, inne problemy sieciowe — `Network error: ... (KOD)`
- Wyczerpane ponowienia (retry) — `Request failed after N attempts: ...`

```typescript
if (error instanceof ConnectionError) {
  console.log(error.message);
  console.log(error.cause); // Oryginalny błąd (opcjonalny)
}
```

## XsdValidationError

Rzucany gdy walidacja XSD jest włączona i XML faktury nie jest zgodny ze schematem (albo nie jest poprawnym XML-em):

```typescript
if (error instanceof XsdValidationError) {
  console.log(error.message);
  // "Invoice XML does not conform to XSD schema: 2 error(s) found"

  for (const detail of error.details) {
    console.log(`Linia ${detail.line}: ${detail.message}`);
  }
}
```

Właściwości:
- `details: XsdValidationDetail[]` — lista błędów z numerami linii i opisami

Szczegóły: [validation.md](validation.md)

## ConfigurationError

Rzucany gdy problem leży po stronie konfiguracji lub środowiska, a nie KSeF:
- `KsefClientBuilder.build()`: brak trybu, certyfikatu lub NIP-u, błędna suma kontrolna NIP-u, ujemny `maxRetries`, niedodatni `timeout`, włączona walidacja bez `xsdSchemaPath`
- `certificatePath()`: plik certyfikatu nie daje się odczytać
- Parsowanie PKCS#12: brak `openssl` w PATH, złe hasło, nieobsługiwany format
- Walidacja XSD: brak `xmllint` w PATH, schemat XSD nie daje się wczytać
- Podpis XAdES: klucz inny niż RSA, dokument bez elementu głównego

```typescript
try {
  const client = new KsefClientBuilder().build();
} catch (error) {
  if (error instanceof ConfigurationError) {
    console.log(error.message); // np. "Mode is required"
  }
}
```

## SessionError

Rzucany gdy:
- Operacja wymagająca uwierzytelnienia jest wywołana przed `auth.authenticate()` / `auth.useTokens()` albo po wyczyszczeniu tokenów
- Operacja wymagająca sesji (np. `invoices.send()`) jest wywołana bez otwartej sesji
- `auth.authenticate()` zakończyło się statusem innym niż sukces (415, 425, 450, 460, 470) albo polling przekroczył limit prób

## Formaty błędów KSeF API 2.0

Błędy 400 (`ExceptionResponse`):

```json
{
  "exception": {
    "exceptionDetailList": [
      { "exceptionCode": 21301, "exceptionDescription": "Opis błędu", "details": ["Szczegóły"] }
    ],
    "referenceNumber": "a1b2c3d4-...",
    "serviceCode": "...",
    "timestamp": "2026-09-03T12:00:00"
  }
}
```

Błędy 401/403/410 (`application/problem+json`):

```json
{ "title": "Forbidden", "status": 403, "detail": "Brak uprawnień", "reasonCode": "missing-permissions", "traceId": "..." }
```

Błędy 429:

```json
{ "status": { "code": 429, "description": "Too Many Requests", "details": ["Przekroczono limit 20 żądań na minutę."] } }
```

Biblioteka rozpoznaje wszystkie trzy formaty i wypełnia `message`, `code`, `requestId` i `details` na `KsefApiError`. Odpowiedź 2xx z pustym body zwraca `undefined`, a 2xx z body niebędącym JSON-em (np. strona HTML z proxy) kończy się `KsefError` z opisem endpointu.

## Retry a błędy

Automatycznie ponawiane:
- `RateLimitError` (429) i HTTP 503 — dla każdej metody, z `Retry-After` jeśli dostępny (przycięty do 30 s)
- Pozostałe `ServerError` (5xx), timeouty i błędy sieciowe — tylko dla `GET` i `DELETE`

**Nie** ponawiane:
- `AuthenticationError` (401), `PermissionDeniedError` (403), `NotFoundError` (404), `ValidationError` (400/422)
- `POST`/`PUT` po timeoucie lub 500 — request mógł już zostać przetworzony przez KSeF
- Cokolwiek po przerwaniu przez `AbortSignal`
