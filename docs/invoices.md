# Faktury

Operacje na fakturach wymagają aktywnej sesji.

## Wysyłanie faktury

```typescript
const result = await client.invoices.send({
  xml: '<XML faktury zgodny ze schematem FA(2)>',
});

console.log(result.elementReferenceNumber); // Referencja do faktury
console.log(result.referenceNumber);        // Referencja do requestu
console.log(result.processingCode);
console.log(result.processingDescription);
console.log(result.timestamp);
```

## Sprawdzanie statusu faktury

```typescript
const status = await client.invoices.status({
  invoiceElementReferenceNumber: 'element-reference-number',
});

console.log(status.processingCode);
console.log(status.processingDescription);

if (status.invoiceStatus) {
  console.log(status.invoiceStatus.invoiceNumber);        // Numer faktury
  console.log(status.invoiceStatus.ksefReferenceNumber);   // Numer KSeF
  console.log(status.invoiceStatus.acquisitionTimestamp);   // Czas przyjęcia
}
```

## Wyszukiwanie faktur

```typescript
const result = await client.invoices.query({
  subjectType: 'subject1',           // Wymagane: subject1 | subject2 | subject3
  type: 'incremental',              // Opcjonalne: incremental | range
  invoicingDateFrom: '2025-01-01',  // Opcjonalne: data od
  invoicingDateTo: '2025-12-31',    // Opcjonalne: data do
  pageSize: 25,                     // Opcjonalne: domyślnie 10
  pageOffset: 0,                    // Opcjonalne: domyślnie 0
});

console.log(result.numberOfElements);
console.log(result.invoiceHeaderList); // Lista nagłówków faktur

for (const invoice of result.invoiceHeaderList) {
  console.log(invoice.ksefReferenceNumber);
  console.log(invoice.invoicingDate);
  console.log(invoice.net, invoice.vat, invoice.gross);
  console.log(invoice.subjectBy);  // Wystawca
  console.log(invoice.subjectTo);  // Odbiorca
}
```

### Wyszukiwanie po numerach KSeF

```typescript
const result = await client.invoices.query({
  subjectType: 'subject1',
  ksefReferenceNumberList: [
    '1234567890-20250101-ABC123-45',
    '1234567890-20250102-DEF456-78',
  ],
});
```

## Pobieranie XML faktury

```typescript
const xml = await client.invoices.download({
  ksefReferenceNumber: '1234567890-20250101-ABC123-45',
});

// xml to string z pełnym XML-em faktury
```

## Subject types

| Wartość    | Opis                           |
| ---------- | ------------------------------ |
| `subject1` | Faktury wystawione przez Ciebie |
| `subject2` | Faktury otrzymane              |
| `subject3` | Faktury jako inna strona       |

## Typy

```typescript
interface InvoiceSendParams {
  xml: string;
  requestOptions?: RequestOptions;
}

interface InvoiceSendResult {
  elementReferenceNumber: string;
  referenceNumber: string;
  processingCode: number;
  processingDescription: string;
  timestamp: string;
}

interface InvoiceStatusParams {
  invoiceElementReferenceNumber: string;
  requestOptions?: RequestOptions;
}

interface InvoiceStatusResult {
  processingCode: number;
  processingDescription: string;
  elementReferenceNumber: string;
  invoiceStatus?: {
    invoiceNumber: string;
    ksefReferenceNumber: string;
    acquisitionTimestamp: string;
  };
}

interface InvoiceQueryParams {
  subjectType: 'subject1' | 'subject2' | 'subject3';
  type?: 'incremental' | 'range';
  invoicingDateFrom?: string;
  invoicingDateTo?: string;
  ksefReferenceNumberList?: string[];
  pageSize?: number;
  pageOffset?: number;
  requestOptions?: RequestOptions;
}

interface InvoiceQueryResult {
  referenceNumber: string;
  processingCode: number;
  processingDescription: string;
  numberOfElements: number;
  pageSize: number;
  pageOffset: number;
  invoiceHeaderList: InvoiceHeader[];
}

interface InvoiceHeader {
  invoiceReferenceNumber: string;
  ksefReferenceNumber: string;
  invoiceHash?: {
    hashSHA: { algorithm: string; encoding: string; value: string };
    fileSize: number;
  };
  invoicingDate: string;
  acquisitionTimestamp: string;
  net?: string;
  vat?: string;
  gross?: string;
  subjectBy: InvoiceSubject;
  subjectTo?: InvoiceSubject;
}
```
