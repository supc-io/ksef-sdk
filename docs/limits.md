# Limity i quoty

> **Status:** ścieżki używane przez ten zasób nie występują ani w specyfikacji API KSeF 1.x, ani 2.0. Zasób zostanie przeprojektowany w ramach migracji na API 2.0 (śledzone w [issue #1](https://github.com/supc-io/ksef-sdk/issues/1)). Poniższy opis dokumentuje obecne zachowanie kodu.


Sprawdzanie limitów API KSeF. Wymaga aktywnej sesji.

## Limity kontekstu (sesji)

```typescript
const limits = await client.limits.context();

for (const limit of limits.limitList) {
  console.log(`${limit.limitType}: ${limit.currentValue}/${limit.limitValue}`);
  if (limit.resetTimestamp) {
    console.log(`  Reset: ${limit.resetTimestamp}`);
  }
}
```

## Limity podmiotu

```typescript
const limits = await client.limits.subject({
  subjectNip: '1234563218',
});

for (const limit of limits.limitList) {
  console.log(`${limit.limitType}: ${limit.currentValue}/${limit.limitValue}`);
}
```

## Rate limit

```typescript
const limits = await client.limits.rate();

for (const limit of limits.limitList) {
  console.log(`${limit.limitType}: ${limit.currentValue}/${limit.limitValue}`);
}
```

## Typy

```typescript
interface ContextLimitResult {
  limitList: LimitEntry[];
}

interface SubjectLimitParams {
  subjectNip: string;
  requestOptions?: RequestOptions;
}

interface SubjectLimitResult {
  limitList: LimitEntry[];
}

interface RateLimitResult {
  limitList: LimitEntry[];
}

interface LimitEntry {
  limitType: string;
  limitValue: number;
  currentValue: number;
  resetTimestamp?: string;
}
```
