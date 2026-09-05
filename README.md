# @supcio/ksef-sdk

TypeScript SDK do komunikacji z polskim Krajowym Systemem e-Faktur (KSeF).

Biblioteka zapewnia API do autoryzacji certyfikatem kwalifikowanym, wysyłania i pobierania faktur, operacji batch, eksportów, zarządzania uprawnieniami i certyfikatami.

> **Stan projektu (wrzesień 2026).** Warstwa sieciowa biblioteki implementuje endpointy API KSeF 1.x (`/online/Session/...`, nagłówek `SessionToken`), które Ministerstwo Finansów wyłączyło 1 lutego 2026 r. Do czasu migracji na KSeF API 2.0, śledzonej w [issue #1](https://github.com/supc-io/ksef-sdk/issues/1), wywołania sieciowe nie połączą się z żadnym środowiskiem KSeF. Komponenty lokalne są gotowe do użycia: walidacja XSD, podpis XAdES-BES, parsowanie PKCS#12, hierarchia błędów, klient HTTP z retry.

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
  .identifier('1234563218') // NIP (przykładowy numer z poprawną sumą kontrolną)
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

| Mode              | URL                                | Opis                |
| ----------------- | ---------------------------------- | ------------------- |
| `Mode.Production` | `https://ksef.mf.gov.pl/api`       | Produkcja           |
| `Mode.Demo`       | `https://ksef-demo.mf.gov.pl/api`  | Środowisko demo     |
| `Mode.Test`       | `https://ksef-test.mf.gov.pl/api`  | Środowisko testowe  |

Powyższe adresy należą do API 1.x. Adresy API 2.0 (`https://api.ksef.mf.gov.pl/v2`, `https://api-demo.ksef.mf.gov.pl/v2`, `https://api-test.ksef.mf.gov.pl/v2`) zostaną wprowadzone w ramach [issue #1](https://github.com/supc-io/ksef-sdk/issues/1).

## Konfiguracja klienta

```typescript
const client = new KsefClientBuilder()
  .mode(Mode.Test)                              // Wymagane — środowisko
  .certificate(base64String, 'password')        // Wymagane — certyfikat PKCS#12 jako base64
  // lub: .certificatePath('./cert.p12', 'password')  // Alternatywnie — ścieżka do pliku
  .identifier('1234563218')                     // Wymagane — NIP
  .timeout(60_000)                              // Opcjonalne — timeout requestu w ms (domyślnie 30000)
  .maxRetries(3)                                // Opcjonalne — liczba ponowień (domyślnie 2)
  .logger(console)                              // Opcjonalne — custom logger
  .httpClient(customHttpClient)                 // Opcjonalne — własna implementacja HTTP
  .build();
```

`build()` waliduje konfigurację i rzuca `ConfigurationError` przy brakującym trybie, certyfikacie lub NIP-ie, nieprawidłowej sumie kontrolnej NIP-u, ujemnym `maxRetries` albo niedodatnim `timeout`.

### Certyfikat

Biblioteka akceptuje certyfikat kwalifikowany w formacie PKCS#12 (.p12/.pfx) na dwa sposoby:

```typescript
// Jako base64 string (np. z bazy danych lub zmiennej środowiskowej)
.certificate(certBase64, password)

// Jako ścieżka do pliku
.certificatePath('./cert.p12', password)
```

Hasło może być pustym stringiem, jeśli plik PKCS#12 został wyeksportowany bez hasła. Certyfikat jest parsowany raz na instancję klienta, przy pierwszym otwarciu sesji.

> **Uwaga:** Parsowanie certyfikatu wymaga komendy `openssl` dostępnej w systemowym PATH. Hasło jest przekazywane do `openssl` przez zmienną środowiskową procesu potomnego, nie przez argumenty wiersza poleceń. Pliki wyeksportowane starszymi algorytmami (RC2/3DES) są automatycznie otwierane z flagą `-legacy` na OpenSSL 3.

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

| Resource             | Opis                                            | Dokumentacja                                  |
| -------------------- | ----------------------------------------------- | --------------------------------------------- |
| `client.sessions`    | Zarządzanie sesjami (init, status, terminate)   | [docs/sessions.md](docs/sessions.md)          |
| `client.invoices`    | Wysyłanie, query, status, pobieranie faktur     | [docs/invoices.md](docs/invoices.md)          |
| `client.batch`       | Wysyłanie faktur w trybie batch                 | [docs/batch.md](docs/batch.md)                |
| `client.upo`         | Pobieranie UPO (Urzędowe Poświadczenie Odbioru) | [docs/upo.md](docs/upo.md)                    |
| `client.exports`     | Eksport masowy faktur                           | [docs/exports.md](docs/exports.md)            |
| `client.certificates`| Zarządzanie certyfikatami                       | [docs/certificates.md](docs/certificates.md)  |
| `client.permissions` | Zarządzanie uprawnieniami                       | [docs/permissions.md](docs/permissions.md)    |
| `client.limits`      | Limity i quoty                                  | [docs/limits.md](docs/limits.md)              |

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
  SessionError,
  XsdValidationError,
} from '@supcio/ksef-sdk';

try {
  await client.invoices.send({ xml: invoiceXml });
} catch (error) {
  if (error instanceof RateLimitError) {
    // HTTP 429 — za dużo requestów
    console.log('Retry after:', error.headers['retry-after']);
  } else if (error instanceof ValidationError) {
    // HTTP 400 / 422 — błąd walidacji (np. niepoprawny XML faktury)
    console.log('Kod błędu KSeF:', error.code);
  } else if (error instanceof AuthenticationError) {
    // HTTP 401 — sesja wygasła lub jest nieprawidłowa (lokalna sesja została wyczyszczona)
  } else if (error instanceof SessionError) {
    // Brak aktywnej sesji lub nieudana inicjalizacja sesji
  } else if (error instanceof XsdValidationError) {
    // Lokalna walidacja XSD (jeśli włączona)
    console.log('Błędy:', error.details);
  } else if (error instanceof ConnectionError) {
    // Timeout, błąd sieciowy lub przerwanie przez AbortSignal
  } else if (error instanceof ConfigurationError) {
    // Błąd konfiguracji lub środowiska (certyfikat, openssl, xmllint, schemat XSD)
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

Wymaga `xmllint` (libxml2) w PATH. Brak `xmllint` lub niedostępny plik XSD kończy się `ConfigurationError`, a nie cichym pominięciem walidacji. Szczegóły: [docs/validation.md](docs/validation.md)

## Automatyczny retry

Biblioteka ponawia requesty z exponential backoff (bazowe opóźnienie 500 ms × 2^próba, jitter ±10%, maksymalnie 30 s):

- **HTTP 429** (Rate Limit) i **HTTP 503** — dla każdej metody, z uwzględnieniem nagłówka `Retry-After` (sekundy lub data HTTP, przycięte do 30 s)
- **Pozostałe HTTP 5xx**, timeouty i błędy sieciowe — tylko dla żądań idempotentnych (`GET`, `DELETE`)

Żądania `POST`/`PUT` (np. wysyłka faktury) **nie są** ponawiane po timeoucie ani po 500, bo KSeF mógł je już przetworzyć. Requesty z błędem 4xx (poza 429) nie są ponawiane. Przerwanie przez `AbortSignal` natychmiast kończy ponawianie.

## Anulowanie i timeouty per request

Każda metoda przyjmuje `requestOptions` z własnym `timeout` i `signal`:

```typescript
const controller = new AbortController();
setTimeout(() => controller.abort(), 5_000);

await client.invoices.status({
  invoiceElementReferenceNumber: ref,
  requestOptions: { timeout: 10_000, signal: controller.signal },
});
```

Przerwanie kończy się `ConnectionError` z komunikatem `Request aborted by caller`.

## Custom HTTP client

Można podać własną implementację HTTP (np. do testów lub proxy):

```typescript
import { HttpClient, HttpRequestConfig, HttpResponse } from '@supcio/ksef-sdk';

class MyHttpClient implements HttpClient {
  async request(config: HttpRequestConfig): Promise<HttpResponse> {
    // własna implementacja
    const bytes = Buffer.from('...');
    return { status: 200, headers: {}, body: bytes.toString('utf-8'), rawBody: bytes };
  }
}

const client = new KsefClientBuilder()
  .mode(Mode.Test)
  .certificate(cert, password)
  .identifier(nip)
  .httpClient(new MyHttpClient())
  .build();
```

`rawBody` jest opcjonalne, ale bez niego pobrania binarne (`client.exports.download()`) będą oparte na tekstowym `body`.

## Dual ESM/CJS

Paczka obsługuje zarówno ESM jak i CommonJS:

```typescript
// ESM
import { KsefClientBuilder, Mode } from '@supcio/ksef-sdk';

// CJS
const { KsefClientBuilder, Mode } = require('@supcio/ksef-sdk');
```

## Rozwój (contributing)

Zasady współpracy, konwencje gałęzi i lista kontrolna PR: [CONTRIBUTING.md](CONTRIBUTING.md).

```bash
# Instalacja zależności (pnpm 10, wersja przypięta w package.json)
pnpm install

# Lint + Prettier + typecheck + testy jednostkowe
pnpm run check

# Build
pnpm run build

# Testy integracyjne (wymagają certyfikatu testowego)
KSEF_TEST_CERT_PATH=./cert.p12 \
KSEF_TEST_CERT_PASS=password \
KSEF_TEST_NIP=1234563218 \
pnpm run test:integration
```

## Licencja

MIT
