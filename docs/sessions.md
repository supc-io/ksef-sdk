# Sesje

Sesja KSeF jest wymagana do większości operacji (wysyłanie faktur, query, eksporty itp.). Biblioteka zarządza tokenem sesyjnym automatycznie.

## Otwieranie sesji

```typescript
const session = await client.sessions.init();

console.log(session.referenceNumber); // Numer referencyjny sesji
console.log(session.sessionToken);    // Token do autoryzacji requestów
console.log(client.isSessionActive);  // true
```

Metoda `init()` automatycznie:
1. Pobiera challenge z KSeF
2. Buduje i podpisuje XML InitSigned
3. Wysyła request inicjalizacji
4. Polluje status aż sesja się aktywuje
5. Zapisuje token w wewnętrznym `SessionManager`

## Sprawdzanie statusu

```typescript
const status = await client.sessions.status({
  referenceNumber: 'numer-referencyjny',
});

console.log(status.processingCode);
console.log(status.processingDescription);
console.log(status.timestamp);
```

## Zamykanie sesji

```typescript
const result = await client.sessions.terminate();

console.log(result.referenceNumber);
console.log(result.timestamp);
console.log(client.isSessionActive); // false
```

## Ważne

- Jedna instancja `KsefClient` = jedna sesja
- Po `terminate()` trzeba ponownie wywołać `init()` aby wykonywać operacje wymagające sesji
- Sesja ma ograniczony czas życia po stronie KSeF — zamykaj ją po zakończeniu operacji

## Typy

```typescript
interface SessionInitResult {
  referenceNumber: string;
  sessionToken: string;
}

interface SessionStatusResponse {
  processingCode: number;
  processingDescription: string;
  referenceNumber: string;
  timestamp: string;
}

interface SessionTerminateResponse {
  referenceNumber: string;
  timestamp: string;
}
```
