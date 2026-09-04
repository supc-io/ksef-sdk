# UPO (Urzędowe Poświadczenie Odbioru)

KSeF API 2.0 wystawia UPO dla pojedynczej faktury oraz zbiorcze UPO sesji (po jej zamknięciu). Wszystkie metody zwracają XML jako `string`.

## UPO faktury

```typescript
// Po numerze referencyjnym faktury w sesji
const upo = await client.upo.forInvoice({ invoiceReferenceNumber: sent.referenceNumber });

// Po numerze KSeF
const upo2 = await client.upo.forKsefNumber({ ksefNumber: '1234563218-20260903-ABCDEF012345-01' });
```

Domyślnie używana jest bieżąca sesja; dla innej sesji podaj `referenceNumber`.

## UPO sesji

Po `client.sessions.close()` odpytuj status sesji, aż `status.code === 200` i pojawi się `upo.pages`:

```typescript
const status = await client.sessions.status({ referenceNumber: sessionRef });
for (const page of status.upo?.pages ?? []) {
  const xml = await client.upo.forSession({
    referenceNumber: sessionRef,
    upoReferenceNumber: page.referenceNumber,
  });
}
```

## Pobranie z linku

Statusy faktur i sesji zawierają wstępnie podpisane linki (`upoDownloadUrl`, `downloadUrl`). Są publiczne (bez tokena), nie obciążają limitów API i wygasają (`upoDownloadUrlExpirationDate` / `downloadUrlExpirationDate`). Odpowiedź niesie nagłówek `x-ms-meta-hash` ze skrótem SHA-256 dokumentu.

```typescript
const status = await client.invoices.status({ invoiceReferenceNumber });
if (status.upoDownloadUrl) {
  const xml = await client.upo.download({ url: status.upoDownloadUrl });
}
```

## Typy

```typescript
interface SessionUpoParams {
  referenceNumber?: string;
  upoReferenceNumber: string;
  requestOptions?: RequestOptions;
}

interface InvoiceUpoParams {
  referenceNumber?: string;
  invoiceReferenceNumber: string;
  requestOptions?: RequestOptions;
}

interface KsefNumberUpoParams {
  referenceNumber?: string;
  ksefNumber: string;
  requestOptions?: RequestOptions;
}

interface UpoDownloadParams {
  url: string;
  requestOptions?: RequestOptions;
}
```
