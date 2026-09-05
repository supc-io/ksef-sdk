# Eksport masowy

> **Status:** ten zasób wywołuje endpointy wygaszonego API KSeF 1.x i wymaga migracji na API 2.0 (śledzone w [issue #1](https://github.com/supc-io/ksef-sdk/issues/1)). Poniższy opis dokumentuje obecne zachowanie kodu.

Eksport masowy pozwala pobrać wiele faktur z danego zakresu dat jako paczki. Operacja jest asynchroniczna.

## Flow

```
1. exports.init()      →  Zlecenie eksportu (zakres dat)
2. exports.status()    →  Polling statusu (aż processingCode wskaże gotowość)
3. exports.download()  →  Pobranie poszczególnych części (bajty)
```

## Użycie

```typescript
import { writeFileSync } from 'node:fs';

// 1. Zlecenie eksportu
const exportJob = await client.exports.init({
  dateFrom: '2025-01-01',
  dateTo: '2025-06-30',
  subjectType: 'subject1', // Opcjonalne, domyślnie 'subject1'
});
console.log(exportJob.referenceNumber);

// 2. Czekaj na zakończenie (z limitem prób i obsługą błędu)
const MAX_ATTEMPTS = 60;
let status;
for (let attempt = 0; ; attempt++) {
  status = await client.exports.status({ referenceNumber: exportJob.referenceNumber });

  if (status.processingCode >= 400) {
    throw new Error(`Eksport nieudany: ${status.processingDescription} (${status.processingCode})`);
  }
  if (status.partList) break;
  if (attempt >= MAX_ATTEMPTS) {
    throw new Error('Eksport nie zakończył się w oczekiwanym czasie');
  }
  await new Promise((r) => setTimeout(r, 5000));
}

// 3. Pobierz części
for (const part of status.partList) {
  const content = await client.exports.download({
    referenceNumber: exportJob.referenceNumber,
    partReferenceNumber: part.partReferenceNumber,
  });
  writeFileSync(part.partName, content); // content to Buffer z zawartością pliku
  console.log(`Pobrano: ${part.partName}`);
}
```

`download()` zwraca `Buffer`, bo części eksportu są plikami binarnymi (zaszyfrowane archiwa ZIP). Dekodowanie do tekstu zniszczyłoby zawartość.

## Subject types

| Wartość    | Opis                           |
| ---------- | ------------------------------ |
| `subject1` | Faktury wystawione             |
| `subject2` | Faktury otrzymane              |

## Typy

```typescript
interface ExportInitParams {
  dateFrom: string;
  dateTo: string;
  subjectType?: 'subject1' | 'subject2';
  requestOptions?: RequestOptions;
}

interface ExportInitResult {
  referenceNumber: string;
  timestamp: string;
}

interface ExportStatusParams {
  referenceNumber: string;
  requestOptions?: RequestOptions;
}

interface ExportStatusResult {
  processingCode: number;
  processingDescription: string;
  referenceNumber: string;
  partList?: ExportPart[];
}

interface ExportPart {
  partReferenceNumber: string;
  partName: string;
  partExpirationTimestamp?: string;
}

interface ExportDownloadParams {
  referenceNumber: string;
  partReferenceNumber: string;
  requestOptions?: RequestOptions;
}
```
