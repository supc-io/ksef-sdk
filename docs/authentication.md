# Uwierzytelnienie

KSeF API 2.0 wydaje tokeny JWT. SDK obsługuje uwierzytelnienie podpisem XAdES certyfikatu z pliku PKCS#12; tokeny KSeF (`POST /auth/ksef-token`) są w planach ([issue #1](https://github.com/supc-io/ksef-sdk/issues/1)).

## Przepływ

```
1. POST /auth/challenge              →  challenge (36 znaków) + timestamp
2. Zbuduj XML AuthTokenRequest       →  Challenge + ContextIdentifier/Nip + SubjectIdentifierType
3. Podpisz XML (XAdES-BES)           →  RSA-SHA256, Exclusive C14N, SignedProperties
4. POST /auth/xades-signature        →  202: referenceNumber + authenticationToken
5. GET /auth/{referenceNumber}       →  polling statusu (Bearer authenticationToken)
6. POST /auth/token/redeem           →  accessToken + refreshToken
```

Wszystko to robi jedna metoda:

```typescript
const result = await client.auth.authenticate();
console.log(result.referenceNumber);            // numer operacji uwierzytelnienia
console.log(result.accessToken.validUntil);     // ISO 8601
console.log(client.isAuthenticated);            // true
```

Statusy operacji (`status.code`): `100` w toku, `200` sukces, `415` brak uprawnień w kontekście, `425` unieważnione, `450` błędny token/challenge, `460` błąd certyfikatu, `470` naruszenie polityki IP. Każdy status inny niż `100`/`200` kończy się `SessionError` z opisem i szczegółami z KSeF. Polling odpytuje co sekundę, maksymalnie 60 razy, i respektuje `requestOptions.signal`.

Opcje:

```typescript
await client.auth.authenticate({
  subjectIdentifierType: 'certificateSubject',  // lub 'certificateFingerprint'
  verifyCertificateChain: true,                 // wymuszenie weryfikacji łańcucha (OCSP/CRL) na TEST
  requestOptions: { timeout: 20_000 },
});
```

## Tokeny

- `accessToken` jest dołączany do każdego requestu jako `Authorization: Bearer`.
- Gdy access token wygasa (z 30-sekundowym zapasem) albo KSeF odpowie `401`, SDK odświeża go przez `POST /auth/token/refresh` i ponawia request jeden raz. Równoległe requesty dzielą jedno odświeżenie.
- Jeśli odświeżenie się nie powiedzie, lokalne tokeny i sesja są czyszczone, a wywołanie kończy się `AuthenticationError`.

```typescript
// Zapis i odtworzenie tokenów (np. między procesami)
const tokens = client.auth.tokens;         // { accessToken, refreshToken } | null
client.auth.useTokens(tokens);

// Ręczne odświeżenie
await client.auth.refreshAccessToken();

// Unieważnienie sesji uwierzytelnienia po stronie KSeF (DELETE /auth/sessions/current)
await client.auth.revoke();
```

## Niskopoziomowy dostęp (zewnętrzny podpis)

Jeśli podpis składa HSM, chmurowy podpis kwalifikowany lub inny proces:

```typescript
const challenge = await client.auth.challenge();
const xml = client.auth.buildAuthTokenRequest(challenge.challenge);

// podpisz `xml` XAdES-BES poza SDK (albo client.auth.signAuthTokenRequest(xml) certyfikatem z konfiguracji)
const signedXml = await mySigner.sign(xml);

const init = await client.auth.submitXadesSignature({ signedXml });
let status;
do {
  status = await client.auth.status({
    referenceNumber: init.referenceNumber,
    authenticationToken: init.authenticationToken.token,
  });
} while (status.status.code === 100);

await client.auth.redeem({ authenticationToken: init.authenticationToken.token });
```

`buildAuthTokenRequest` jest też eksportowane jako funkcja (`import { buildAuthTokenRequest }`), a dokument jest zgodny ze [schematem auth v2.0](https://github.com/CIRFMF/ksef-api/blob/main/auth/schemy/schemat_auth_v2-0.xsd).

## Certyfikat

Biblioteka obsługuje certyfikaty PKCS#12 (.p12 / .pfx). Certyfikat jest parsowany przez systemowe `openssl` CLI przy pierwszym `authenticate()` i cache'owany w instancji klienta.

```typescript
// Z base64 (np. ze zmiennej środowiskowej)
.certificate(process.env.KSEF_CERT_BASE64!, process.env.KSEF_CERT_PASS!)

// Z pliku
.certificatePath('/path/to/cert.p12', 'password')
```

Hasło może być puste. Nieczytelny plik, brak `openssl`, złe hasło lub nieobsługiwany format kończą się `ConfigurationError`; komunikat błędu nigdy nie zawiera hasła. Hasło trafia do `openssl` przez zmienną środowiskową procesu potomnego (`-passin env:...`). Pliki wyeksportowane starszymi algorytmami (RC2-40, 3DES) są na OpenSSL 3 automatycznie otwierane z flagą `-legacy`.

KSeF identyfikuje podmiot na podstawie pól certyfikatu (`SubjectIdentifierType = certificateSubject`): NIP w `2.5.4.97` (organizationIdentifier, `VATPL-<NIP>`) lub `serialNumber` (`TINPL-<NIP>` / `PNOPL-<PESEL>`). Na TEST akceptowane są certyfikaty samodzielnie wygenerowane; opis: [testowe certyfikaty i podpisy XAdES](https://github.com/CIRFMF/ksef-api/blob/main/auth/testowe-certyfikaty-i-podpisy-xades.md).

## Podpis XAdES-BES

Dokument `AuthTokenRequest` jest podpisywany w formacie XAdES-BES (podpis otaczający, dołączany jako ostatnie dziecko elementu głównego):

- Algorytm podpisu: RSA-SHA256 (obsługiwane są klucze RSA)
- Kanonizacja: Exclusive C14N
- Referencja do dokumentu: `URI=""`, transformacje Enveloped Signature + Exclusive C14N, digest SHA-256
- Referencja do `xades:SignedProperties` z atrybutem `Type="http://uri.etsi.org/01903#SignedProperties"`
- `xades:SignedProperties` zawiera `SigningTime` oraz `SigningCertificate` z digestem SHA-256 certyfikatu i `IssuerSerial`
- `ds:KeyInfo` zawiera certyfikat podpisujący (`X509Certificate`)

Poprawność podpisu jest sprawdzana w testach biblioteką `xml-crypto`, a struktura schematami XMLDSig i XAdES 1.3.2.
