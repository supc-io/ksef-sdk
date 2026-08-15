# Eksport masowy

Eksport masowy pozwala pobrać wiele faktur z danego zakresu dat jako paczki. Operacja jest asynchroniczna.

## Flow

```
1. exports.init()      →  Zlecenie eksportu (zakres dat)
2. exports.status()    →  Polling statusu (aż processingCode wskaże gotowość)
3. exports.download()  →  Pobranie poszczególnych części
```

## Użycie

```typescript
// 1. Zlecenie eksportu
const exportJob = await client.exports.init({
  dateFrom: '2025-01-01',
  dateTo: '2025-06-30',
  subjectType: 'subject1', // Opcjonalne, domyślnie 'subject1'
});
console.log(exportJob.referenceNumber);

// 2. Czekaj na zakończenie
let status;
do {
  status = await client.exports.status({
    referenceNumber: exportJob.referenceNumber,
  });
  // Odczekaj przed kolejnym zapytaniem
  if (!status.partList) {
    await new Promise((r) => setTimeout(r, 5000));
  }
} while (!status.partList);

// 3. Pobierz części
for (const part of status.partList) {
  const content = await client.exports.download({
    referenceNumber: exportJob.referenceNumber,
    partReferenceNumber: part.partReferenceNumber,
  });
  console.log(`Pobrano: ${part.partName}`);
  // content to string z zawartością pliku
}
```

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
