# Walidacja XSD

Biblioteka umożliwia walidację XML faktury przed wysłaniem do KSeF. Walidacja sprawdza zgodność z oficjalnym schematem XSD (np. FA(2)) i daje czytelne błędy lokalne — bez konieczności wysyłania do API.

## Wymagania

- **xmllint** CLI (część pakietu libxml2) dostępny w PATH
- Plik XSD schematu faktury (schematy FA(2) i FA(3) są publikowane przez Ministerstwo Finansów)

```bash
# macOS (preinstalowany lub via Homebrew)
brew install libxml2

# Ubuntu / Debian
sudo apt-get install libxml2-utils

# RHEL / Fedora
sudo dnf install libxml2
```

## Włączanie walidacji

```typescript
const client = new KsefClientBuilder()
  .mode(Mode.Test)
  .certificate(cert, password)
  .identifier(nip)
  .validateXml()                        // Włącz walidację
  .xsdSchemaPath('/path/to/FA2.xsd')   // Ścieżka do schematu XSD
  .build();
```

Walidacja odbywa się automatycznie przed każdym `client.invoices.send()`.

## Obsługa błędów

```typescript
import { XsdValidationError, ConfigurationError } from '@supcio/ksef-sdk';

try {
  await client.invoices.send({ xml: invoiceXml });
} catch (error) {
  if (error instanceof XsdValidationError) {
    console.log(error.message);
    // "Invoice XML does not conform to XSD schema: 2 error(s) found"

    for (const detail of error.details) {
      console.log(`  Linia ${detail.line}: ${detail.message}`);
      // "Linia 5: element Kwota: Schemas validity error : ..."
    }
  } else if (error instanceof ConfigurationError) {
    // brak xmllint w PATH albo schemat XSD nie daje się wczytać
  }
}
```

| Sytuacja                                        | Błąd                 |
| ----------------------------------------------- | -------------------- |
| XML niezgodny ze schematem lub niepoprawny XML  | `XsdValidationError` |
| `xmllint` nie jest zainstalowany                | `ConfigurationError` |
| Plik XSD nie istnieje lub nie kompiluje się     | `ConfigurationError` |

Brak `xmllint` **nigdy** nie jest traktowany jako pomyślna walidacja.

## Standalone (bez klienta)

Walidator można użyć niezależnie od klienta:

```typescript
import { validateXmlAgainstXsd, XsdValidationError } from '@supcio/ksef-sdk';

try {
  validateXmlAgainstXsd(xmlString, '/path/to/FA2.xsd');
  console.log('XML jest poprawny');
} catch (error) {
  if (error instanceof XsdValidationError) {
    console.log('Błędy walidacji:', error.details);
  }
}
```

## Skąd wziąć schemat XSD?

Oficjalne schematy KSeF (FA(2), FA(3), PEF) są publikowane przez Ministerstwo Finansów w repozytorium [CIRFMF/ksef-api](https://github.com/CIRFMF/ksef-api/tree/main/faktury/schemy) oraz na stronach środowisk KSeF. Na środowiskach DEMO i produkcyjnym API 2.0 obowiązuje schemat FA(3).

## Typy

```typescript
interface XsdValidationDetail {
  line: number;
  message: string;
}

class XsdValidationError extends KsefError {
  readonly details: XsdValidationDetail[];
}
```

## Uwagi

- Walidacja jest **opcjonalna** — domyślnie wyłączona
- Wymaga `xmllint` w PATH (analogicznie jak `openssl` do parsowania certyfikatów)
- Walidacja odbywa się **synchronicznie** przed wysłaniem requestu HTTP, w katalogu tymczasowym usuwanym po każdym wywołaniu
- Błędy walidacji zawierają numery linii i opisy z xmllint
