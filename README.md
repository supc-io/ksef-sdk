# @supcio/ksef-sdk

Biblioteka Node.js/TypeScript do komunikacji z polskim Krajowym Systemem e-Faktur (KSeF).

## Status

W fazie planowania.

## Funkcjonalnosci (planowane)

- Autoryzacja certyfikatem kwalifikowanym (KSeF 2.0)
- Wysylanie faktur (online i batch)
- Pobieranie faktur
- Pobieranie UPO
- Walidacja XML vs XSD (schemat FA(2))
- Automatyczny retry z exponential backoff

## Technologia

- TypeScript (strict mode)
- Node.js >= 18
- Dual publish ESM + CJS

## Instalacja

```bash
npm install @supcio/ksef-sdk
```

## Licencja

MIT
