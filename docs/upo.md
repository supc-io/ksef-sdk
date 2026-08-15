# UPO (Urzędowe Poświadczenie Odbioru)

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
