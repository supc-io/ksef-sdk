# @supcio/ksef-sdk

TypeScript SDK do komunikacji z polskim Krajowym Systemem e-Faktur (KSeF 2.0).

Biblioteka zapewnia pełne API do autoryzacji certyfikatem kwalifikowanym, wysyłania i pobierania faktur, operacji batch, eksportów, zarządzania uprawnieniami i certyfikatami.

## Wymagania

- **Node.js** >= 18
- **OpenSSL** CLI dostępny w PATH (do parsowania certyfikatów PKCS#12)
- **xmllint** CLI (opcjonalnie, do walidacji XSD) — część pakietu libxml2

## Instalacja

```bash
npm install @supcio/ksef-sdk
```

```bash
pnpm add @supcio/ksef-sdk
```

```bash
yarn add @supcio/ksef-sdk
```

## Szybki start

```typescript
import { KsefClientBuilder, Mode } from '@supcio/ksef-sdk';
import { readFileSync } from 'fs';

// 1. Zbuduj klienta
const client = new KsefClientBuilder()
  .mode(Mode.Test)
  .certificate(readFileSync('cert.p12').toString('base64'), 'haslo-certyfikatu')
  .identifier('1234567890') // NIP
  .build();

// 2. Otwórz sesję
await client.sessions.init();

// 3. Wyślij fakturę
const result = await client.invoices.send({
  xml: '<XML faktury zgodny ze schematem FA(2)>',
});
console.log('Numer referencyjny:', result.elementReferenceNumber);

// 4. Sprawdź status faktury
const status = await client.invoices.status({
  invoiceElementReferenceNumber: result.elementReferenceNumber,
});
console.log('Numer KSeF:', status.invoiceStatus?.ksefReferenceNumber);

// 5. Pobierz UPO
const upo = await client.upo.get({
  referenceNumber: result.referenceNumber,
});

// 6. Zamknij sesję
await client.sessions.terminate();
```

## Środowiska

| Mode              | URL                                 | Opis                          |
| ----------------- | ----------------------------------- | ----------------------------- |
| `Mode.Production` | `https://ksef.mf.gov.pl/api`       | Produkcja                     |
| `Mode.Demo`       | `https://ksef-demo.mf.gov.pl/api`  | Środowisko demo               |
| `Mode.Test`       | `https://ksef-test.mf.gov.pl/api`  | Środowisko testowe            |

## Konfiguracja klienta

```typescript
const client = new KsefClientBuilder()
  .mode(Mode.Test)                              // Wymagane — środowisko
  .certificate(base64String, 'password')        // Wymagane — certyfikat PKCS#12 jako base64
  // lub: .certificatePath('./cert.p12', 'password')  // Alternatywnie — ścieżka do pliku
  .identifier('1234567890')                     // Wymagane — NIP
  .timeout(60_000)                              // Opcjonalne — timeout requestu w ms (domyślnie 30000)
  .maxRetries(3)                                // Opcjonalne — liczba ponowień (domyślnie 2)
  .logger(console)                              // Opcjonalne — custom logger
  .httpClient(customHttpClient)                 // Opcjonalne — własna implementacja HTTP
  .build();
```

### Certyfikat

Biblioteka akceptuje certyfikat kwalifikowany w formacie PKCS#12 (.p12/.pfx) na dwa sposoby:

```typescript
// Jako base64 string (np. z bazy danych lub zmiennej środowiskowej)
.certificate(certBase64, password)

// Jako ścieżka do pliku
.certificatePath('./cert.p12', password)
```

> **Uwaga:** Parsowanie certyfikatu wymaga komendy `openssl` dostępnej w systemowym PATH.

### Custom logger

Każdy obiekt implementujący interfejs `Logger` (kompatybilny z `console`):

```typescript
interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}
```

## API

Klient udostępnia zasoby (resources) odpowiadające domenom API KSeF:

| Resource             | Opis                                        | Dokumentacja                              |
| -------------------- | ------------------------------------------- | ----------------------------------------- |
| `client.sessions`    | Zarządzanie sesjami (init, status, terminate) | [docs/sessions.md](docs/sessions.md)     |
| `client.invoices`    | Wysyłanie, query, status, pobieranie faktur | [docs/invoices.md](docs/invoices.md)      |
| `client.batch`       | Wysyłanie faktur w trybie batch             | [docs/batch.md](docs/batch.md)            |
| `client.upo`         | Pobieranie UPO (Urzędowe Poświadczenie Odbioru) | [docs/upo.md](docs/upo.md)          |
| `client.exports`     | Eksport masowy faktur                       | [docs/exports.md](docs/exports.md)        |
| `client.certificates`| Zarządzanie certyfikatami                   | [docs/certificates.md](docs/certificates.md) |
| `client.permissions` | Zarządzanie uprawnieniami                   | [docs/permissions.md](docs/permissions.md)|
| `client.limits`      | Limity i quoty                              | [docs/limits.md](docs/limits.md)          |

Dodatkowe:
- [docs/authentication.md](docs/authentication.md) — autoryzacja i flow sesyjny
- [docs/validation.md](docs/validation.md) — walidacja XSD faktur
- [docs/errors.md](docs/errors.md) — obsługa błędów

## Obsługa błędów

Biblioteka udostępnia typowaną hierarchię błędów:

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

try {
  await client.invoices.send({ xml: invoiceXml });
} catch (error) {
  if (error instanceof RateLimitError) {
    // HTTP 429 — za dużo requestów
    console.log('Retry after:', error.headers['retry-after']);
  } else if (error instanceof ValidationError) {
    // HTTP 422 — błąd walidacji (np. niepoprawny XML)
    console.log('Kod błędu KSeF:', error.code);
  } else if (error instanceof AuthenticationError) {
    // HTTP 401 — problem z sesją/autoryzacją
  } else if (error instanceof XsdValidationError) {
    // Lokalna walidacja XSD (jeśli włączona)
    console.log('Błędy:', error.details);
  } else if (error instanceof ConnectionError) {
    // Timeout lub błąd sieciowy
  } else if (error instanceof KsefApiError) {
    // Inny błąd HTTP od KSeF
    console.log('Status:', error.status);
    console.log('Request ID:', error.requestId);
  }
}
```

Szczegóły: [docs/errors.md](docs/errors.md)

## Walidacja XSD

Opcjonalna walidacja XML faktur przed wysłaniem — łapie błędy lokalnie zanim trafią do KSeF:

```typescript
const client = new KsefClientBuilder()
  .mode(Mode.Test)
  .certificate(cert, password)
  .identifier(nip)
  .validateXml()                        // Włącz walidację
  .xsdSchemaPath('/path/to/FA2.xsd')   // Ścieżka do schematu
  .build();

// Walidacja odbywa się automatycznie przed send()
try {
  await client.invoices.send({ xml: invoiceXml });
} catch (error) {
  if (error instanceof XsdValidationError) {
    for (const detail of error.details) {
      console.log(`Linia ${detail.line}: ${detail.message}`);
    }
  }
}
```

Wymaga `xmllint` (libxml2) w PATH. Szczegóły: [docs/validation.md](docs/validation.md)

## Automatyczny retry

Biblioteka automatycznie ponawia requesty w przypadku:

- **HTTP 429** (Rate Limit) — z uwzględnieniem nagłówka `Retry-After`
- **HTTP 5xx** (Server Error) — błędy po stronie KSeF

Retry używa exponential backoff z jitterem:
- Bazowe opóźnienie: 500ms × 2^attempt
- Maksymalne opóźnienie: 30s
- Jitter: ±10%

Requesty z błędem 4xx (poza 429) **nie są** ponawiane.

## Custom HTTP client

Można podać własną implementację HTTP (np. do testów lub proxy):

```typescript
import { HttpClient, HttpRequestConfig, HttpResponse } from '@supcio/ksef-sdk';

class MyHttpClient implements HttpClient {
  async request(config: HttpRequestConfig): Promise<HttpResponse> {
    // własna implementacja
    return { status: 200, headers: {}, body: '...' };
  }
}

const client = new KsefClientBuilder()
  .mode(Mode.Test)
  .certificate(cert, password)
  .identifier(nip)
  .httpClient(new MyHttpClient())
  .build();
```

## Dual ESM/CJS

Paczka obsługuje zarówno ESM jak i CommonJS:

```typescript
// ESM
import { KsefClientBuilder, Mode } from '@supcio/ksef-sdk';

// CJS
const { KsefClientBuilder, Mode } = require('@supcio/ksef-sdk');
```

## Rozwój (contributing)

```bash
# Instalacja zależności
pnpm install

# Build
pnpm run build

# Testy jednostkowe
pnpm test

# Testy integracyjne (wymagają certyfikatu testowego)
KSEF_TEST_CERT_PATH=./cert.p12 \
KSEF_TEST_CERT_PASS=password \
KSEF_TEST_NIP=1234567890 \
pnpm run test:integration

# Typecheck
pnpm run typecheck

# Lint
pnpm run lint

# Format
pnpm run format
```

## Licencja

MIT