# Sesja interaktywna

Faktury wysyła się w ramach sesji. SDK obsługuje sesję interaktywną (`/sessions/online`); sesja wsadowa jest w planach ([issue #1](https://github.com/supc-io/ksef-sdk/issues/1)). Wymaga wcześniejszego `client.auth.authenticate()`.

## Otwieranie sesji

```typescript
const session = await client.sessions.open();
console.log(session.referenceNumber); // 36 znaków
console.log(session.validUntil);      // KSeF zamknie sesję automatycznie po tym terminie
console.log(session.formCode);        // { systemCode: 'FA (3)', schemaVersion: '1-0E', value: 'FA' }
console.log(client.isSessionActive);  // true
```

`open()`:
1. Pobiera certyfikat klucza publicznego MF (`GET /security/public-key-certificates`, cache 1 h) z przeznaczeniem `SymmetricKeyEncryption`.
2. Generuje klucz AES-256 (32 bajty) i IV (16 bajtów).
3. Szyfruje klucz RSA-OAEP SHA-256 i wysyła `POST /sessions/online` z `formCode` i `encryption` (w tym `publicKeyId`).
4. Zapamiętuje sesję z kluczem, żeby `invoices.send()` mogło szyfrować faktury.

Schemat można nadpisać per sesja: `client.sessions.open({ formCode: FormCodes.FA2 })` (FA (2) tylko na TEST).

Klient pamięta jedną otwartą sesję (`client.currentSession`). Metody przyjmujące `referenceNumber` używają jej domyślnie; można podać numer innej sesji, ale faktury da się wysyłać wyłącznie do bieżącej (tylko jej klucz jest znany).

## Status sesji

```typescript
const status = await client.sessions.status();
console.log(status.status.code, status.status.description);
console.log(status.invoiceCount, status.successfulInvoiceCount, status.failedInvoiceCount);
```

| Kod | Znaczenie                                         |
| --- | ------------------------------------------------- |
| 100 | Sesja interaktywna otwarta                        |
| 170 | Sesja interaktywna zamknięta (trwa generowanie UPO) |
| 200 | Sesja przetworzona pomyślnie, UPO dostępne        |
| 415 | Błąd odszyfrowania dostarczonego klucza           |
| 440 | Sesja anulowana (nie przesłano faktur)            |
| 445 | Błąd weryfikacji, brak poprawnych faktur          |

## Faktury w sesji

```typescript
// Lista faktur ze statusami (stronicowanie tokenem kontynuacji)
let page = await client.sessions.invoices({ pageSize: 100 });
for (const invoice of page.invoices) {
  console.log(invoice.referenceNumber, invoice.status.code, invoice.ksefNumber);
}
while (page.continuationToken) {
  page = await client.sessions.invoices({ pageSize: 100, continuationToken: page.continuationToken });
}

// Status pojedynczej faktury
const invoice = await client.sessions.invoiceStatus({ invoiceReferenceNumber: 'numer-referencyjny' });
```

## Zamykanie sesji

```typescript
await client.sessions.close();
console.log(client.isSessionActive); // false
```

Po zamknięciu KSeF asynchronicznie generuje zbiorcze UPO sesji. Odpytuj `status({ referenceNumber })`, aż `status.code === 200` i pojawi się `upo.pages`:

```typescript
const ref = session.referenceNumber;
let status = await client.sessions.status({ referenceNumber: ref });
while (status.status.code === 170) {
  await new Promise((r) => setTimeout(r, 2000));
  status = await client.sessions.status({ referenceNumber: ref });
}
for (const page of status.upo?.pages ?? []) {
  const xml = await client.upo.forSession({ referenceNumber: ref, upoReferenceNumber: page.referenceNumber });
  // albo bez tokena: await client.upo.download({ url: page.downloadUrl })
}
```

## Ważne

- `close({ referenceNumber })` z numerem innym niż bieżąca sesja nie zmienia stanu klienta.
- Odpowiedź `401`, której nie da się naprawić odświeżeniem tokena, czyści tokeny i sesję; kolejne wywołania rzucą `SessionError`.
- Metody przyjmują `requestOptions` (`timeout`, `signal`).

## Typy

```typescript
interface OpenSessionResult {
  referenceNumber: string;
  validUntil: string;
  formCode: FormCode;
}

interface SessionStatusResponse {
  status: { code: number; description: string; details?: string[] | null };
  dateCreated: string;
  dateUpdated: string;
  validUntil?: string | null;
  upo?: { pages: { referenceNumber: string; downloadUrl: string; downloadUrlExpirationDate: string }[] } | null;
  invoiceCount?: number | null;
  successfulInvoiceCount?: number | null;
  failedInvoiceCount?: number | null;
}

interface SessionInvoicesResponse {
  continuationToken?: string | null;
  invoices: SessionInvoiceStatus[];
}
```
