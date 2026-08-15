# Zarządzanie certyfikatami

Operacje na certyfikatach w ramach KSeF. Wymaga aktywnej sesji.

> **Uwaga:** To nie jest ten sam certyfikat co certyfikat do autoryzacji. Te operacje dotyczą zarządzania certyfikatami zarejestrowanymi w KSeF.

## Rejestracja certyfikatu

```typescript
const result = await client.certificates.enroll();
console.log(result.referenceNumber);
console.log(result.timestamp);
```

## Pobranie statusu certyfikatu

```typescript
const cert = await client.certificates.retrieve({
  referenceNumber: 'numer-referencyjny',
});

console.log(cert.certificateStatus);
console.log(cert.certificatePEM);      // PEM jeśli gotowy
console.log(cert.timestamp);
```

## Unieważnienie certyfikatu

```typescript
const result = await client.certificates.revoke({
  referenceNumber: 'numer-referencyjny',
});

console.log(result.referenceNumber);
console.log(result.timestamp);
```

## Typy

```typescript
interface CertificateEnrollResult {
  referenceNumber: string;
  timestamp: string;
}

interface CertificateRetrieveParams {
  referenceNumber: string;
  requestOptions?: RequestOptions;
}

interface CertificateRetrieveResult {
  referenceNumber: string;
  certificateStatus: string;
  certificatePEM?: string;
  timestamp: string;
}

interface CertificateRevokeParams {
  referenceNumber: string;
  requestOptions?: RequestOptions;
}

interface CertificateRevokeResult {
  referenceNumber: string;
  timestamp: string;
}
```
