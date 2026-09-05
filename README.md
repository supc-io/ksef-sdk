# @supcio/ksef-sdk

TypeScript SDK do komunikacji z polskim Krajowym Systemem e-Faktur przez **KSeF API 2.0** (`https://api.ksef.mf.gov.pl/v2`).

Biblioteka obsługuje uwierzytelnienie certyfikatem kwalifikowanym (XAdES), tokeny dostępowe JWT, sesje interaktywne z szyfrowaniem faktur, wysyłkę i status faktur, pobieranie faktur po numerze KSeF, wyszukiwanie metadanych oraz UPO.

> **Zakres migracji na API 2.0.** Zaimplementowane: uwierzytelnienie, sesja interaktywna, faktury, UPO, certyfikaty klucza publicznego MF. W przygotowaniu (śledzone w [issue #1](https://github.com/supc-io/ksef-sdk/issues/1)): sesja wsadowa, eksporty paczek faktur, uprawnienia, certyfikaty KSeF, limity, tokeny KSeF. Biblioteka nie była jeszcze uruchamiana przeciwko żywemu środowisku `api-test`; test integracyjny jest gotowy (patrz niżej) i czeka na certyfikat testowy.

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
  .identifier('1234563218') // NIP kontekstu (przykładowy numer z poprawną sumą kontrolną)
  .build();

// 2. Uwierzytelnij się (challenge → XAdES → status → accessToken + refreshToken)
await client.auth.authenticate();

// 3. Otwórz sesję interaktywną (domyślnie schemat FA (3))
const session = await client.sessions.open();

// 4. Wyślij fakturę (szyfrowaną kluczem sesji)
const sent = await client.invoices.send({ xml: readFileSync('faktura.xml', 'utf-8') });

// 5. Poczekaj na numer KSeF
let status = await client.invoices.status({ invoiceReferenceNumber: sent.referenceNumber });
while (status.status.code === 100 || status.status.code === 150) {
  await new Promise((r) => setTimeout(r, 2000));
  status = await client.invoices.status({ invoiceReferenceNumber: sent.referenceNumber });
}
if (status.status.code !== 200) {
  throw new Error(`Faktura odrzucona: ${status.status.description}`);
}
console.log('Numer KSeF:', status.ksefNumber);

// 6. Pobierz UPO faktury
const upoXml = await client.upo.forInvoice({ invoiceReferenceNumber: sent.referenceNumber });

// 7. Zamknij sesję (KSeF wygeneruje zbiorcze UPO sesji)
await client.sessions.close();
```

## Środowiska

| Mode              | URL                                  | Schematy faktur                       |
| ----------------- | ------------------------------------ | ------------------------------------- |
| `Mode.Production` | `https://api.ksef.mf.gov.pl/v2`      | FA (3), PEF (3), PEF_KOR (3)          |
| `Mode.Demo`       | `https://api-demo.ksef.mf.gov.pl/v2` | FA (3), PEF (3), PEF_KOR (3)          |
| `Mode.Test`       | `https://api-test.ksef.mf.gov.pl/v2` | FA (2), FA (3), PEF (3), PEF_KOR (3)  |

Źródło: [Środowiska KSeF API 2.0](https://github.com/CIRFMF/ksef-api/blob/main/srodowiska.md). Domyślny schemat w SDK to FA (3); FA (2) działa wyłącznie na TEST.

## Konfiguracja klienta

```typescript
import { FormCodes } from '@supcio/ksef-sdk';

const client = new KsefClientBuilder()
  .mode(Mode.Test)                              // Wymagane — środowisko
  .certificate(base64String, 'password')        // Wymagane — certyfikat PKCS#12 jako base64
  // lub: .certificatePath('./cert.p12', 'password')  // Alternatywnie — ścieżka do pliku
  .identifier('1234563218')                     // Wymagane — NIP kontekstu
  .formCode(FormCodes.FA3)                      // Opcjonalne — schemat faktur w sesji (domyślnie FA (3))
  .verifyCertificateChain()                     // Opcjonalne — weryfikacja łańcucha certyfikatu na TEST
  .timeout(60_000)                              // Opcjonalne — timeout requestu w ms (domyślnie 30000)
  .maxRetries(3)                                // Opcjonalne — liczba ponowień (domyślnie 2)
  .logger(console)                              // Opcjonalne — custom logger
  .httpClient(customHttpClient)                 // Opcjonalne — własna implementacja HTTP
  .build();
```

`build()` waliduje konfigurację i rzuca `ConfigurationError` przy brakującym trybie, certyfikacie lub NIP-ie, nieprawidłowej sumie kontrolnej NIP-u, niepełnym `formCode`, ujemnym `maxRetries` albo niedodatnim `timeout`.

### Certyfikat

Biblioteka akceptuje certyfikat w formacie PKCS#12 (.p12/.pfx) na dwa sposoby:

```typescript
// Jako base64 string (np. z bazy danych lub zmiennej środowiskowej)
.certificate(certBase64, password)

// Jako ścieżka do pliku
.certificatePath('./cert.p12', password)
```

Hasło może być pustym stringiem. Certyfikat jest parsowany raz na instancję klienta, przy pierwszym uwierzytelnieniu. Na produkcji wymagany jest podpis kwalifikowany, pieczęć kwalifikowana lub certyfikat KSeF; na TEST można użyć samodzielnie wygenerowanego certyfikatu z NIP-em w polu `2.5.4.97` (organizationIdentifier, wartość `VATPL-<NIP>`) — patrz [testowe certyfikaty i podpisy XAdES](https://github.com/CIRFMF/ksef-api/blob/main/auth/testowe-certyfikaty-i-podpisy-xades.md).

> **Uwaga:** Parsowanie certyfikatu wymaga komendy `openssl` w PATH. Hasło jest przekazywane do `openssl` przez zmienną środowiskową procesu potomnego, nie przez argumenty wiersza poleceń. Pliki wyeksportowane starszymi algorytmami (RC2/3DES) są automatycznie otwierane z flagą `-legacy` na OpenSSL 3.

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

| Resource          | Opis                                                               | Dokumentacja                                   |
| ----------------- | ------------------------------------------------------------------ | ---------------------------------------------- |
| `client.auth`     | Uwierzytelnienie XAdES, tokeny dostępowe, odświeżanie, unieważnienie | [docs/authentication.md](docs/authentication.md) |
| `client.sessions` | Sesja interaktywna: otwarcie, status, lista faktur, zamknięcie     | [docs/sessions.md](docs/sessions.md)           |
| `client.invoices` | Wysyłka, status, pobranie po numerze KSeF, metadane                | [docs/invoices.md](docs/invoices.md)           |
| `client.upo`      | UPO sesji, faktury (po numerze referencyjnym lub KSeF), z linku    | [docs/upo.md](docs/upo.md)                     |
| `client.security` | Certyfikaty klucza publicznego MF (używane wewnętrznie)            | —                                              |

Dodatkowe:
- [docs/validation.md](docs/validation.md) — walidacja XSD faktur
- [docs/errors.md](docs/errors.md) — obsługa błędów

## Uwierzytelnienie i tokeny

`client.auth.authenticate()` wykonuje cały przepływ: `POST /auth/challenge` → budowa `AuthTokenRequest` → podpis XAdES-BES → `POST /auth/xades-signature` → polling `GET /auth/{ref}` → `POST /auth/token/redeem`. Otrzymany `accessToken` jest dołączany do każdego requestu jako `Authorization: Bearer`, a po wygaśnięciu (lub po odpowiedzi 401) automatycznie odświeżany `refreshTokenem`.

```typescript
const { accessToken, refreshToken } = await client.auth.authenticate();

// Zapisz tokeny, żeby nie uwierzytelniać się w każdym procesie
persist(client.auth.tokens);

// ... w innym procesie:
client.auth.useTokens(loadPersisted());

// Unieważnij sesję uwierzytelnienia (refresh token przestaje działać)
await client.auth.revoke();
```

Szczegóły, w tym podpisywanie zewnętrznym HSM: [docs/authentication.md](docs/authentication.md)

## Sesje i szyfrowanie faktur

`sessions.open()` generuje klucz AES-256 i IV, szyfruje klucz kluczem publicznym Ministerstwa Finansów (RSA-OAEP SHA-256, certyfikat z `GET /security/public-key-certificates`) i otwiera sesję. Każda faktura wysłana przez `invoices.send()` jest szyfrowana AES-256-CBC tym kluczem; do KSeF trafiają skróty SHA-256 i rozmiary wersji jawnej oraz zaszyfrowanej. Klucz nigdy nie opuszcza procesu w formie jawnej.

Szczegóły i kody statusów: [docs/sessions.md](docs/sessions.md), [docs/invoices.md](docs/invoices.md)

## Obsługa błędów

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
    // HTTP 429 — za dużo requestów (retry automatyczny; tu już po wyczerpaniu ponowień)
    console.log(error.details); // np. ['Przekroczono limit 20 żądań na minutę...']
  } else if (error instanceof ValidationError) {
    // HTTP 400 — błąd walidacji (np. niepoprawny XML faktury, zły skrót)
    console.log('Kod błędu KSeF:', error.code, error.details);
  } else if (error instanceof PermissionDeniedError) {
    // HTTP 403 — error.code to reasonCode, np. 'missing-permissions'
  } else if (error instanceof AuthenticationError) {
    // HTTP 401 także po próbie odświeżenia tokena; lokalne tokeny i sesja wyczyszczone
  } else if (error instanceof SessionError) {
    // Brak uwierzytelnienia / otwartej sesji lub odrzucone uwierzytelnienie
  } else if (error instanceof XsdValidationError) {
    // Lokalna walidacja XSD (jeśli włączona)
    console.log('Błędy:', error.details);
  } else if (error instanceof ConnectionError) {
    // Timeout, błąd sieciowy lub przerwanie przez AbortSignal
  } else if (error instanceof ConfigurationError) {
    // Błąd konfiguracji lub środowiska (certyfikat, openssl, xmllint, schemat XSD)
  } else if (error instanceof KsefApiError) {
    // Inny błąd HTTP od KSeF
    console.log('Status:', error.status, 'Request ID:', error.requestId);
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
  .xsdSchemaPath('/path/to/FA3.xsd')   // Ścieżka do schematu
  .build();
```

Wymaga `xmllint` (libxml2) w PATH. Brak `xmllint` lub niedostępny plik XSD kończy się `ConfigurationError`, a nie cichym pominięciem walidacji. Schematy FA(2), FA(3) i PEF: [CIRFMF/ksef-api](https://github.com/CIRFMF/ksef-api/tree/main/faktury/schemy). Szczegóły: [docs/validation.md](docs/validation.md)

## Automatyczny retry

Biblioteka ponawia requesty z exponential backoff (bazowe opóźnienie 500 ms × 2^próba, jitter ±10%, maksymalnie 30 s):

- **HTTP 429** (Rate Limit) i **HTTP 503** — dla każdej metody, z uwzględnieniem nagłówka `Retry-After` (sekundy lub data HTTP, przycięte do 30 s)
- **Pozostałe HTTP 5xx**, timeouty i błędy sieciowe — tylko dla żądań idempotentnych (`GET`, `DELETE`)

Żądania `POST` (np. wysyłka faktury) **nie są** ponawiane po timeoucie ani po 500, bo KSeF mógł je już przetworzyć. Requesty z błędem 4xx (poza 429) nie są ponawiane. Przerwanie przez `AbortSignal` natychmiast kończy ponawianie.

## Anulowanie i timeouty per request

Każda metoda przyjmuje `requestOptions` z własnym `timeout` i `signal`:

```typescript
const controller = new AbortController();
setTimeout(() => controller.abort(), 5_000);

await client.invoices.status({
  invoiceReferenceNumber: ref,
  requestOptions: { timeout: 10_000, signal: controller.signal },
});
```

Przerwanie kończy się `ConnectionError` z komunikatem `Request aborted by caller`. Polling w `auth.authenticate()` również respektuje sygnał.

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

`rawBody` jest opcjonalne; bez niego pobrania binarne będą oparte na tekstowym `body`.

## Narzędzia kryptograficzne

Eksportowane pomocniczo, np. do własnych przepływów (sesja wsadowa, podpis poza SDK):

```typescript
import {
  signXades,               // XAdES-BES enveloped (RSA-SHA256, exc-c14n)
  buildAuthTokenRequest,   // XML AuthTokenRequest (schemat auth v2.0)
  generateSymmetricKey,    // klucz AES-256 + IV
  encryptAes256Cbc,        // AES-256-CBC, PKCS#7
  encryptRsaOaepSha256,    // RSA-OAEP SHA-256 kluczem publicznym MF
  sha256Base64,
} from '@supcio/ksef-sdk';
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

Zasady współpracy, konwencje gałęzi i lista kontrolna PR: [CONTRIBUTING.md](CONTRIBUTING.md).

```bash
# Instalacja zależności (pnpm 10, wersja przypięta w package.json)
pnpm install

# Lint + Prettier + typecheck + testy jednostkowe
pnpm run check

# Build
pnpm run build

# Test integracyjny na api-test (wymaga certyfikatu testowego, opcjonalnie faktury FA(3))
KSEF_TEST_CERT_PATH=./cert.p12 \
KSEF_TEST_CERT_PASS=password \
KSEF_TEST_NIP=1234563218 \
KSEF_TEST_INVOICE=./faktura.xml \
pnpm run test:integration
```

## Licencja

MIT
