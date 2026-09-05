# Autoryzacja i sesje

> **Status:** ten zasób wywołuje endpointy wygaszonego API KSeF 1.x i wymaga migracji na API 2.0 (śledzone w [issue #1](https://github.com/supc-io/ksef-sdk/issues/1)). Poniższy opis dokumentuje obecne zachowanie kodu.

## Flow autoryzacji certyfikatem

Biblioteka używa certyfikatu kwalifikowanego (PKCS#12) do autoryzacji. Flow wygląda następująco:

```
1. getChallenge()             →  Pobierz challenge z KSeF
2. Parsuj certyfikat PKCS#12  →  Wyodrębnij klucz prywatny i certyfikat (raz na klienta)
3. Zbuduj XML InitSigned      →  Challenge + token + NIP
4. Podpisz XML (XAdES-BES)    →  RSA-SHA256, Exclusive C14N
5. initSigned()               →  Wyślij podpisany XML do KSeF
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

Jeśli KSeF zgłosi błąd inicjalizacji, zwróci status bez tokena sesyjnego albo polling przekroczy limit prób, `init()` rzuca `SessionError`. Sesja nigdy nie jest aktywowana z pustym tokenem.

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

Biblioteka obsługuje certyfikaty PKCS#12 (.p12 / .pfx). Certyfikat jest parsowany przez systemowe `openssl` CLI przy pierwszym `init()` i cache'owany w instancji klienta.

```typescript
// Z base64 (np. ze zmiennej środowiskowej)
.certificate(process.env.KSEF_CERT_BASE64!, process.env.KSEF_CERT_PASS!)

// Z pliku
.certificatePath('/path/to/cert.p12', 'password')
```

Hasło może być puste. Nieczytelny plik, brak `openssl`, złe hasło lub nieobsługiwany format kończą się `ConfigurationError`; komunikat błędu nigdy nie zawiera hasła.

### Dlaczego openssl CLI?

Parsowanie PKCS#12 w czystym JavaScript wymaga dużych bibliotek kryptograficznych. Użycie systemowego `openssl`:
- Nie dodaje zależności do paczki
- Działa z każdym typem certyfikatu kwalifikowanego
- Jest standardem na serwerach Linux/macOS

Hasło trafia do `openssl` przez zmienną środowiskową procesu potomnego (`-passin env:...`), więc nie jest widoczne w `ps` ani w komunikatach błędów. Pliki wyeksportowane starszymi algorytmami (RC2-40, 3DES) są na OpenSSL 3 automatycznie otwierane z flagą `-legacy`.

### Wymagania

```bash
# Sprawdź czy openssl jest dostępny
openssl version
```

## Podpis XAdES-BES

Request `InitSigned` jest podpisywany cyfrowo w formacie XAdES-BES (podpis otaczający, dołączany jako ostatnie dziecko elementu głównego):

- Algorytm podpisu: RSA-SHA256 (obsługiwane są klucze RSA)
- Kanonizacja: Exclusive C14N
- Referencja do dokumentu: `URI=""`, transformacje Enveloped Signature + Exclusive C14N, digest SHA-256
- Referencja do `xades:SignedProperties` z atrybutem `Type="http://uri.etsi.org/01903#SignedProperties"`
- `xades:SignedProperties` zawiera `SigningTime` oraz `SigningCertificate` z digestem SHA-256 certyfikatu i `IssuerSerial`
- `ds:KeyInfo` zawiera certyfikat podpisujący (`X509Certificate`)
- `ds:Signature` ma atrybut `Id`, do którego odwołuje się `xades:QualifyingProperties Target`

Poprawność podpisu (oba digesty i wartość podpisu) jest sprawdzana w testach jednostkowych biblioteką `xml-crypto`.

## Token sesyjny

Po pomyślnej inicjalizacji sesji, token jest automatycznie dołączany do wszystkich requestów w nagłówku `SessionToken`. Nie musisz go zarządzać ręcznie — `SessionManager` robi to wewnętrznie.

```typescript
// Token jest automatycznie dodawany
await client.invoices.send({ xml }); // ← zawiera nagłówek SessionToken
```

Gdy KSeF odpowie `401` na uwierzytelniony request, biblioteka czyści lokalną sesję (`client.isSessionActive === false`) i rzuca `AuthenticationError`. Kolejna operacja wymagająca sesji rzuci `SessionError`, dopóki nie wywołasz `init()` ponownie.
