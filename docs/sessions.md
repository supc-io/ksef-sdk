# Sesje

> **Status:** ten zasób wywołuje endpointy wygaszonego API KSeF 1.x i wymaga migracji na API 2.0 (śledzone w [issue #1](https://github.com/supc-io/ksef-sdk/issues/1)). Poniższy opis dokumentuje obecne zachowanie kodu.

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
4. Polluje status aż sesja się aktywuje (co 2 s, maksymalnie 30 prób)
5. Zapisuje token w wewnętrznym `SessionManager`

Błędy:
- `SessionError` — KSeF odrzucił inicjalizację (`processingCode >= 400`), status `200` nie zawierał tokena albo polling przekroczył limit prób
- `ConfigurationError` — problem z certyfikatem lub `openssl`
- `ConnectionError` — timeout, błąd sieci lub przerwanie przez `requestOptions.signal` (polling również reaguje na sygnał)

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

Lokalna sesja jest czyszczona po udanym `terminate()` oraz gdy KSeF odpowie `401` (token już nieważny). Przy innych błędach (np. `5xx`) token pozostaje, żeby można było ponowić `terminate()`.

## Ważne

- Jedna instancja `KsefClient` = jedna sesja
- Po `terminate()` trzeba ponownie wywołać `init()` aby wykonywać operacje wymagające sesji
- Sesja ma ograniczony czas życia po stronie KSeF — zamykaj ją po zakończeniu operacji
- Operacja wymagająca sesji bez aktywnej sesji rzuca `SessionError` zanim wyśle jakikolwiek request

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
