# UPO (Urzędowe Poświadczenie Odbioru)

> **Status:** ten zasób wywołuje endpointy wygaszonego API KSeF 1.x i wymaga migracji na API 2.0 (śledzone w [issue #1](https://github.com/supc-io/ksef-sdk/issues/1)). Poniższy opis dokumentuje obecne zachowanie kodu.


UPO to oficjalne potwierdzenie przyjęcia faktury przez KSeF. Pobierasz je po wysłaniu faktury, używając numeru referencyjnego.

## Użycie

```typescript
const upo = await client.upo.get({
  referenceNumber: 'numer-referencyjny',
});

console.log(upo.upo);                    // Treść UPO
console.log(upo.referenceNumber);
console.log(upo.processingCode);
console.log(upo.processingDescription);
```

## Typowy flow

```typescript
// 1. Wyślij fakturę
const result = await client.invoices.send({ xml: invoiceXml });

// 2. Pobierz UPO
const upo = await client.upo.get({
  referenceNumber: result.referenceNumber,
});
```

## Typy

```typescript
interface UpoParams {
  referenceNumber: string;
  requestOptions?: RequestOptions;
}

interface UpoResult {
  upo: string;
  referenceNumber: string;
  processingCode: number;
  processingDescription: string;
}
```
