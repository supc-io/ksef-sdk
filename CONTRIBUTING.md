# Współtworzenie @supcio/ksef-sdk

Dziękujemy za zainteresowanie projektem. Poniżej zasady, które pomagają utrzymać bibliotekę w dobrym stanie.

## Wymagania

- Node.js >= 18
- pnpm 10 (wersja przypięta w polu `packageManager` w `package.json`; `corepack enable` pobierze właściwą)
- `openssl` w PATH (część testów generuje tymczasowe certyfikaty)

## Start

```bash
pnpm install
pnpm run check   # lint + prettier + typecheck + testy jednostkowe
pnpm run build
```

Pojedyncze kroki:

```bash
pnpm run lint
pnpm run format          # zapisuje poprawki Prettiera
pnpm run format:check
pnpm run typecheck       # obejmuje src/ i test/
pnpm test
pnpm run test:watch
```

Testy integracyjne wymagają certyfikatu testowego i nie są uruchamiane w CI:

```bash
KSEF_TEST_CERT_PATH=./cert.p12 KSEF_TEST_CERT_PASS=haslo KSEF_TEST_NIP=1234563218 pnpm run test:integration
```

## Gałęzie i commity

- Pracuj na gałęzi od `main`: `fix/...`, `feat/...`, `docs/...`, `chore/...`.
- Commity w stylu [Conventional Commits](https://www.conventionalcommits.org/): `fix: ...`, `feat: ...`, `docs: ...`, `chore: ...`, `test: ...`.
- Jeden PR = jeden temat. Formatowanie i refaktory bez zmian zachowania trzymaj w osobnych commitach.

## Pull request

Przed otwarciem PR:

1. `pnpm run check` przechodzi lokalnie.
2. Nowe zachowanie ma testy jednostkowe (mockuj tylko warstwę HTTP lub `child_process`, nie system plików).
3. Zmiany widoczne dla użytkowników są opisane w `CHANGELOG.md` w sekcji nieopublikowanej wersji.
4. Dokumentacja w `README.md` i `docs/` jest zgodna z kodem.

W opisie PR napisz co i dlaczego zostało zmienione oraz jak to sprawdzić. Jeśli PR dotyczy zgłoszenia, podlinkuj issue.

## Zgłaszanie błędów

Użyj [GitHub Issues](https://github.com/supc-io/ksef-sdk/issues). Podaj wersję biblioteki, wersję Node.js, środowisko KSeF oraz minimalny fragment kodu. Nigdy nie dołączaj certyfikatów, haseł ani tokenów sesyjnych.

## Bezpieczeństwo

Podatności zgłaszaj prywatnie na adres kontaktowy właściciela repozytorium zamiast w publicznym issue.
