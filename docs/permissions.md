# Zarządzanie uprawnieniami

> **Status:** ten zasób wywołuje endpointy wygaszonego API KSeF 1.x i wymaga migracji na API 2.0 (śledzone w [issue #1](https://github.com/supc-io/ksef-sdk/issues/1)). Poniższy opis dokumentuje obecne zachowanie kodu.


Zarządzanie uprawnieniami (credentials) w kontekście podmiotu KSeF. Wymaga aktywnej sesji.

## Nadawanie uprawnień

```typescript
const result = await client.permissions.grant({
  contextNip: '1234563218',
  credentialsIdentifier: {
    type: 'onip',           // onip | pesel | fingerprint
    identifier: '5260250274',
  },
  credentialsRoleList: [
    { roleType: 'invoice_read' },
    { roleType: 'invoice_write', startTimestamp: '2025-01-01T00:00:00' },
  ],
});

console.log(result.elementReferenceNumber);
console.log(result.processingCode);
```

## Odbieranie uprawnień

```typescript
const result = await client.permissions.revoke({
  contextNip: '1234563218',
  credentialsIdentifier: {
    type: 'onip',
    identifier: '5260250274',
  },
  credentialsRoleList: [
    { roleType: 'invoice_read' },
  ],
});
```

## Listowanie uprawnień

```typescript
const result = await client.permissions.query({
  contextNip: '1234563218',
  pageSize: 25,   // Opcjonalne, domyślnie 10
  pageOffset: 0,  // Opcjonalne, domyślnie 0
});

console.log(result.numberOfElements);

for (const credential of result.credentialsList) {
  console.log(credential.credentialsIdentifier);
  for (const role of credential.credentialsRoleList) {
    console.log(`  ${role.roleType}`);
  }
}
```

## Dostępne role

| Rola                            | Opis                                    |
| ------------------------------- | --------------------------------------- |
| `invoice_read`                  | Odczyt faktur                           |
| `invoice_write`                 | Wystawianie faktur                      |
| `payment_confirmation_write`    | Potwierdzenia płatności                 |
| `credentials_read`              | Odczyt uprawnień                        |
| `credentials_manage`            | Zarządzanie uprawnieniami               |
| `enforcement_operations`        | Operacje egzekucyjne                    |
| `self_invoicing`                | Samofakturowanie                        |
| `tax_representative`            | Przedstawiciel podatkowy                |
| `court_bailiff`                 | Komornik sądowy                         |
| `subject_read_all`              | Odczyt wszystkich faktur podmiotu       |
| `subject_read_delivered`        | Odczyt faktur dostarczonych             |

## Typy identyfikatorów

| Typ           | Opis                           |
| ------------- | ------------------------------ |
| `onip`        | NIP podmiotu                   |
| `pesel`       | PESEL osoby fizycznej          |
| `fingerprint` | Odcisk certyfikatu             |

## Typy

```typescript
interface PermissionGrantParams {
  contextNip: string;
  credentialsIdentifier: {
    type: 'onip' | 'pesel' | 'fingerprint';
    identifier: string;
  };
  credentialsRoleList: CredentialRole[];
  requestOptions?: RequestOptions;
}

type CredentialRole = {
  roleType: 'invoice_read' | 'invoice_write' | 'payment_confirmation_write'
    | 'credentials_read' | 'credentials_manage' | 'enforcement_operations'
    | 'self_invoicing' | 'tax_representative' | 'court_bailiff'
    | 'subject_read_all' | 'subject_read_delivered';
  roleDescription?: string;
  startTimestamp?: string;
  endTimestamp?: string;
};

interface PermissionGrantResult {
  referenceNumber: string;
  processingCode: number;
  processingDescription: string;
  timestamp: string;
  elementReferenceNumber: string;
}

interface PermissionQueryParams {
  contextNip: string;
  pageSize?: number;
  pageOffset?: number;
  requestOptions?: RequestOptions;
}

interface PermissionQueryResult {
  referenceNumber: string;
  numberOfElements: number;
  pageSize: number;
  pageOffset: number;
  credentialsList: PermissionCredential[];
}
```
