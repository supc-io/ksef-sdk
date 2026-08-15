# Autoryzacja i sesje

## Flow autoryzacji KSeF 2.0

KSeF 2.0 używa certyfikatów kwalifikowanych do autoryzacji. Flow wygląda następująco:

```
1. getChallenge()          →  Pobierz challenge z KSeF
2. Parsuj certyfikat PKCS#12  →  Wyodrębnij klucz prywatny i certyfikat
3. Zbuduj XML InitSigned      →  Challenge + token + NIP
4. Podpisz XML (XAdES-BES)    →  RSA-SHA256
5. initSigned()            →  Wyślij podpisany XML do KSeF
6. Polling statusu sesji      →  Czekaj na aktywację
7. Sesja aktywna              →  Token sesyjny do dalszych requestów
```

## Użycie

W praktyce cały flow jest ukryty za jedną metodą:

```typescript
// Otwórz sesję (cały flow automatycznie)
const session = await client.sessions.init();
console.log(session.referenceNumber);
console.log(session.sessionToken);

// Sprawdź czy sesja aktywna
console.log(client.isSessionActive); // true

// ... operacje na fakturach ...

// Zamknij sesję
await client.sessions.terminate();
```

## Niskopoziomowy dostęp

Jeśli potrzebujesz kontrolować poszczególne kroki:

```typescript
// 1. Pobierz challenge
const challenge = await client.auth.getChallenge();
console.log(challenge.challenge);    // string
console.log(challenge.timestamp);    // ISO 8601

// 2. Wyślij podpisany request init
const initResult = await client.auth.initSigned();
console.log(initResult.referenceNumber);

// 3. Sprawdzaj status ręcznie
const status = await client.sessions.status({
  referenceNumber: initResult.referenceNumber,
});
```

## Certyfikat

Biblioteka obsługuje certyfikaty PKCS#12 (.p12 / .pfx). Certyfikat jest parsowany przez systemowe `openssl` CLI.

```typescript
// Z base64 (np. ze zmiennej środowiskowej)
.certificate(process.env.KSEF_CERT_BASE64!, process.env.KSEF_CERT_PASS!)

// Z pliku
.certificatePath('/path/to/cert.p12', 'password')
```

### Dlaczego openssl CLI?

Parsowanie PKCS#12 w czystym JavaScript wymaga dużych bibliotek kryptograficznych. Użycie systemowego `openssl`:
- Nie dodaje zależności do paczki
- Działa z każdym typem certyfikatu kwalifikowanego
- Jest standardem na serwerach Linux/macOS

### Wymagania

```bash
# Sprawdź czy openssl jest dostępny
openssl version
```

## Podpis XAdES-BES

Request `InitSigned` jest podpisywany cyfrowo w formacie XAdES-BES:
- Algorytm podpisu: RSA-SHA256
- Kanonizacja: Exclusive C14N
- Transformacje: Enveloped Signature + C14N
- Zawiera element `QualifyingProperties` z `SigningTime` i `SigningCertificate`

## Szyfrowanie tokena

Token sesyjny jest szyfrowany kluczem publicznym KSeF:
- Algorytm: RSA-OAEP
- Hash: SHA-256
- Wynik: base64

## Token sesyjny

Po pomyślnej inicjalizacji sesji, token jest automatycznie dołączany do wszystkich requestów w nagłówku. Nie musisz go zarządzać ręcznie — `SessionManager` robi to wewnętrznie.

```typescript
// Token jest automatycznie dodawany
await client.invoices.send({ xml }); // ← zawiera nagłówek SessionToken
```
