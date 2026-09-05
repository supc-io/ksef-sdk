# Operacje batch

> **Status:** ten zasób wywołuje endpointy wygaszonego API KSeF 1.x i wymaga migracji na API 2.0 (śledzone w [issue #1](https://github.com/supc-io/ksef-sdk/issues/1)). Poniższy opis dokumentuje obecne zachowanie kodu.


Tryb batch pozwala wysyłać wiele faktur w jednym pakiecie. Wymaga aktywnej sesji.

## Flow

```
1. batch.init()    →  Inicjalizacja pakietu
2. batch.send()    →  Upload kolejnych części (wielokrotnie)
3. batch.finish()  →  Zamknięcie pakietu
4. batch.status()  →  Sprawdzenie statusu przetwarzania
```

## Użycie

```typescript
// 1. Inicjalizacja pakietu
const batch = await client.batch.init();
console.log(batch.referenceNumber);

// 2. Upload części
await client.batch.send({
  referenceNumber: batch.referenceNumber,
  partNumber: 1,
  fileContent: Buffer.from(xmlPackage), // lub base64 string
});

// 3. Zamknięcie pakietu
await client.batch.finish({
  referenceNumber: batch.referenceNumber,
});

// 4. Sprawdzenie statusu
const status = await client.batch.status({
  referenceNumber: batch.referenceNumber,
});

console.log(status.processingCode);
console.log(status.processingDescription);

if (status.packageSignature) {
  for (const part of status.packageSignature.packagePartSignatureList) {
    console.log(`Część ${part.ordinalNumber}: ${part.partFileName}`);
    for (const entry of part.headerEntryList) {
      console.log(`  Faktura: ${entry.invoiceNumber} → KSeF: ${entry.ksefReferenceNumber}`);
    }
  }
}
```

## Typy

```typescript
interface BatchInitResult {
  referenceNumber: string;
  packageSignature: {
    packagePartSignatureList: PackagePartSignature[];
  };
  timestamp: string;
}

interface PackagePartSignature {
  ordinalNumber: number;
  partFileName: string;
  partReferenceNumber: string;
  headerEntryList: BatchHeaderEntry[];
}

interface BatchHeaderEntry {
  invoiceReferenceNumber: string;
  ksefReferenceNumber: string;
  invoiceNumber: string;
  invoicingDate: string;
}

interface BatchSendParams {
  referenceNumber: string;
  partNumber: number;
  fileContent: Buffer | string;
  requestOptions?: RequestOptions;
}

interface BatchSendResult {
  referenceNumber: string;
  timestamp: string;
}

interface BatchFinishParams {
  referenceNumber: string;
  requestOptions?: RequestOptions;
}

interface BatchFinishResult {
  referenceNumber: string;
  timestamp: string;
}

interface BatchStatusParams {
  referenceNumber: string;
  requestOptions?: RequestOptions;
}

interface BatchStatusResult {
  processingCode: number;
  processingDescription: string;
  referenceNumber: string;
  packageSignature?: BatchInitResult['packageSignature'];
  timestamp: string;
}
```
