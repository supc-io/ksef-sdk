# Faktury

Wysyłka wymaga otwartej sesji interaktywnej (`client.sessions.open()`); pobieranie i wyszukiwanie wymaga tylko uwierzytelnienia i uprawnienia `InvoiceRead`.

## Wysyłanie faktury

```typescript
const sent = await client.invoices.send({
  xml: '<Faktura xmlns="http://crd.gov.pl/wzor/2025/06/25/13775/">...</Faktura>',
});

console.log(sent.referenceNumber);          // numer referencyjny faktury w sesji
console.log(sent.sessionReferenceNumber);
console.log(sent.invoiceHash);              // SHA-256 (base64) jawnego XML
```

`send()`:
1. Opcjonalnie waliduje XML schematem XSD (jeśli włączono `validateXml()`).
2. Szyfruje XML kluczem sesji (AES-256-CBC, PKCS#7).
3. Wysyła `POST /sessions/online/{ref}/invoices` ze skrótami SHA-256 i rozmiarami wersji jawnej oraz zaszyfrowanej. KSeF odpowiada `202` z numerem referencyjnym; przetwarzanie jest asynchroniczne.

Opcje:

```typescript
await client.invoices.send({
  xml,
  offlineMode: true,                       // deklaracja trybu offline
  hashOfCorrectedInvoice: 'skrót-base64',  // wymagany przy korekcie technicznej
  requestOptions: { timeout: 60_000 },
});
```

## Status faktury

```typescript
const status = await client.invoices.status({ invoiceReferenceNumber: sent.referenceNumber });

console.log(status.status.code, status.status.description, status.status.details);
console.log(status.ksefNumber);             // po nadaniu (kod 200)
console.log(status.acquisitionDate);        // data nadania numeru KSeF
console.log(status.permanentStorageDate);   // uzupełniana asynchronicznie
console.log(status.upoDownloadUrl);         // link do UPO bez tokena, ważny do upoDownloadUrlExpirationDate
```

| Kod  | Znaczenie                                                   |
| ---- | ----------------------------------------------------------- |
| 100  | Faktura przyjęta do dalszego przetwarzania                  |
| 150  | Trwa przetwarzanie                                          |
| 200  | Numer KSeF nadany                                           |
| 4xx  | Faktura odrzucona — przyczyna w `status.description` i `status.details` |

Status faktury z innej sesji: `client.invoices.status({ invoiceReferenceNumber, sessionReferenceNumber })`.

Przykład oczekiwania na numer KSeF:

```typescript
async function waitForKsefNumber(invoiceReferenceNumber: string, attempts = 30) {
  for (let i = 0; i < attempts; i++) {
    const status = await client.invoices.status({ invoiceReferenceNumber });
    if (status.status.code === 200) return status.ksefNumber!;
    if (status.status.code >= 400) {
      throw new Error(`Faktura odrzucona: ${status.status.description} ${status.status.details?.join('; ') ?? ''}`);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error('Przekroczono czas oczekiwania na numer KSeF');
}
```

## Pobieranie XML faktury

```typescript
const xml = await client.invoices.download({
  ksefNumber: '1234563218-20260903-ABCDEF012345-01',
});
```

## Wyszukiwanie metadanych

`POST /invoices/query/metadata`. Zakres dat maksymalnie 100 dni; przy `isTruncated === true` (10 000 rekordów) zawęź `dateRange` od daty ostatniego wyniku i wyzeruj `pageOffset`.

```typescript
const result = await client.invoices.query({
  filters: {
    subjectType: 'Subject1',                       // Subject1 (sprzedawca) | Subject2 (nabywca) | Subject3 | SubjectAuthorized
    dateRange: { dateType: 'Issue', from: '2026-08-01T00:00:00Z', to: '2026-08-31T23:59:59Z' },
    invoiceNumber: 'FV/2026/08/001',               // opcjonalne filtry: ksefNumber, sellerNip, buyerIdentifier, amount, currencyCodes, ...
  },
  pageSize: 50,                                    // 10..250
  pageOffset: 0,
  sortOrder: 'Asc',
});

console.log(result.hasMore, result.isTruncated);
for (const invoice of result.invoices) {
  console.log(invoice.ksefNumber, invoice.invoiceNumber, invoice.grossAmount, invoice.currency);
}
```

Do pobierania przyrostowego używaj `dateType: 'PermanentStorage'` i `sortOrder: 'Asc'`; `permanentStorageHwmDate` wyznacza granicę spójnych danych.

## Typy

```typescript
interface InvoiceSendParams {
  xml: string;
  offlineMode?: boolean;
  hashOfCorrectedInvoice?: string;
  requestOptions?: RequestOptions;
}

interface InvoiceSendResult {
  referenceNumber: string;
  sessionReferenceNumber: string;
  invoiceHash: string;
}

interface SessionInvoiceStatus {
  ordinalNumber: number;
  invoiceNumber?: string | null;
  ksefNumber?: string | null;
  referenceNumber: string;
  invoiceHash: string;
  acquisitionDate?: string | null;
  invoicingDate: string;
  permanentStorageDate?: string | null;
  upoDownloadUrl?: string | null;
  upoDownloadUrlExpirationDate?: string | null;
  invoicingMode?: 'Online' | 'Offline' | null;
  status: { code: number; description: string; details?: string[] | null; extensions?: Record<string, string | null> | null };
}
```
