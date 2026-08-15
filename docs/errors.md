# Obsługa błędów

## Hierarchia błędów

```
Error (native)
└── KsefError (bazowy)
    ├── KsefApiError (błędy HTTP od KSeF)
    │   ├── AuthenticationError     (401)
    │   ├── PermissionDeniedError   (403)
    │   ├── NotFoundError           (404)
    │   ├── ValidationError         (422)
    │   ├── RateLimitError          (429)
    │   └── ServerError             (5xx)
    ├── XsdValidationError (lokalna walidacja XSD)
    ├── ConnectionError (timeout, sieć)
    └── ConfigurationError (błąd konfiguracji buildera)
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
  XsdValidationError,
} from '@supcio/ksef-sdk';
```

### Łapanie konkretnych błędów

```typescript
try {
  await client.invoices.send({ xml: invoiceXml });
} catch (error) {
  if (error instanceof ValidationError) {
    // 422 — np. niepoprawny XML faktury
    console.log('Kod błędu KSeF:', error.code);
    console.log('Wiadomość:', error.message);
  } else if (error instanceof RateLimitError) {
    // 429 — przekroczony limit requestów
    console.log('Retry-After:', error.headers['retry-after']);
  } else if (error instanceof AuthenticationError) {
    // 401 — sesja wygasła lub nieprawidłowa
  } else if (error instanceof PermissionDeniedError) {
    // 403 — brak uprawnień
  } else if (error instanceof NotFoundError) {
    // 404 — zasób nie istnieje
  } else if (error instanceof ServerError) {
    // 5xx — błąd po stronie KSeF
  } else if (error instanceof ConnectionError) {
    // Timeout lub błąd sieciowy
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

| Właściwość  | Typ                          | Opis                                       |
| ----------- | ---------------------------- | ------------------------------------------ |
| `status`    | `number`                     | Kod HTTP (401, 403, 404, 422, 429, 5xx)    |
| `code`      | `string \| null`             | Kod wyjątku KSeF (z `exceptionCode`)       |
| `requestId` | `string \| null`             | Numer referencyjny z odpowiedzi            |
| `headers`   | `Record<string, string>`     | Nagłówki odpowiedzi HTTP                   |
| `message`   | `string`                     | Opis błędu                                 |

## ConnectionError

Rzucany gdy:
- Request przekroczy timeout (domyślnie 30s)
- Serwer jest nieosiągalny (ECONNREFUSED)
- Błąd DNS
- Inne problemy sieciowe
- Wyczerpane ponowienia (retry)

```typescript
if (error instanceof ConnectionError) {
  console.log(error.message);
  console.log(error.cause); // Oryginalny błąd (opcjonalny)
}
```

## XsdValidationError

Rzucany gdy walidacja XSD jest włączona i XML faktury nie jest zgodny ze schematem:

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

Rzucany przez `KsefClientBuilder.build()` gdy:
- Nie ustawiono trybu (`mode`)
- Nie podano certyfikatu
- Nie podano identyfikatora (NIP)
- NIP jest nieprawidłowy (błędna suma kontrolna)

```typescript
try {
  const client = new KsefClientBuilder().build();
} catch (error) {
  if (error instanceof ConfigurationError) {
    console.log(error.message); // np. "Mode is required"
  }
}
```

## Format wyjątków KSeF

KSeF zwraca błędy w formacie:

```json
{
  "exception": {
    "exceptionDetailList": [
      {
        "exceptionCode": 12345,
        "exceptionDescription": "Opis błędu"
      }
    ]
  }
}
```

Biblioteka automatycznie parsuje ten format i ustawia `code` oraz `message` na `KsefApiError`.

## Retry a błędy

Automatycznie ponawiane:
- `RateLimitError` (429) — z `Retry-After` jeśli dostępny
- `ServerError` (5xx) — exponential backoff

**Nie** ponawiane:
- `AuthenticationError` (401)
- `PermissionDeniedError` (403)
- `NotFoundError` (404)
- `ValidationError` (422)
