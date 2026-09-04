# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - Unreleased

> Targets **KSeF API 2.0** (`https://api{-test,-demo,}.ksef.mf.gov.pl/v2`).
> Implemented so far: authentication, interactive sessions, invoices, UPO.
> Batch sessions, exports, permissions, KSeF certificates, limits and KSeF
> tokens are tracked in [#1](https://github.com/supc-io/ksef-sdk/issues/1).
> The earlier code targeted the 1.x API switched off on 2026-02-01.

### Added

- Initial release
- KSeF API 2.0 authentication with a PKCS#12 certificate: `POST /auth/challenge`,
  `AuthTokenRequest` (schema auth v2.0), XAdES-BES, `POST /auth/xades-signature`,
  status polling, `POST /auth/token/redeem`; automatic access-token refresh
  (`POST /auth/token/refresh`, shared between concurrent requests, retried once
  after a 401), `auth.revoke()`, `auth.tokens` / `auth.useTokens()` for
  persisting tokens between processes, low-level steps for external signers
- Interactive sessions: `sessions.open()` (AES-256 key + IV generated locally,
  key encrypted with the MF public key via RSA-OAEP SHA-256, `formCode`
  defaulting to FA (3)), `status()`, `invoices()` (continuation token),
  `invoiceStatus()`, `close()`
- Invoices: `send()` (AES-256-CBC encrypted payload with plain/encrypted SHA-256
  hashes and sizes, `offlineMode`, `hashOfCorrectedInvoice`), `status()`,
  `download()` by KSeF number, `query()` (`POST /invoices/query/metadata`)
- UPO: per session page, per invoice reference number, per KSeF number, and
  from pre-signed download links
- `security.publicKeyCertificates()` with a one-hour cache
- `FormCodes` constants (FA (2), FA (3), PEF (3), PEF_KOR (3), FA_RR (1)),
  `KsefClientBuilder.formCode()` and `.verifyCertificateChain()`
- `KsefApiError.details`; parsing of KSeF 2.0 `ExceptionResponse`, RFC 7807
  problem details (401/403/410, `reasonCode` exposed as `code`) and
  `TooManyRequestsResponse`
- Exported crypto helpers: `generateSymmetricKey`, `encryptAes256Cbc`,
  `decryptAes256Cbc`, `encryptRsaOaepSha256`, `sha256Base64`, `signXades`,
  `buildAuthTokenRequest`
- XAdES-BES enveloped signature (RSA-SHA256, Exclusive C14N, signed
  `SignedProperties` with `SigningTime` and `SigningCertificate`)
- Automatic retry with exponential backoff
- Typed error hierarchy, including `SessionError` for session lifecycle problems
- Optional XSD validation of invoices via xmllint
- Per-request `timeout` and `AbortSignal` support (`requestOptions`)
- `HttpResponse.rawBody` with the undecoded response bytes
- Dual ESM/CJS build
- GitHub Actions CI (lint, format, typecheck, tests, build on Node 18/20/22)
- `CONTRIBUTING.md`

### Changed

- Retry policy: `POST`/`PUT` requests are no longer replayed after a timeout,
  network error or 5xx response (a timed-out invoice submission could have been
  registered twice). 429 and 503 are retried for every method; other 5xx,
  timeouts and network errors only for `GET`/`DELETE`.
- `Retry-After` is honoured for both delay-seconds and HTTP-date values and is
  capped at the maximum backoff delay (30 s) instead of blocking for an hour.
- Backoff jitter is ±10% as documented (previously +0..10%).
- HTTP 400 responses map to `ValidationError` (KSeF reports invoice validation
  failures as 400 with `exception.exceptionDetailList`); 422 still maps there too.
- `client.exports.download()` returns a `Buffer` instead of a UTF-8 decoded
  string, so encrypted export archives are no longer corrupted.
- `KsefError` accepts an `ErrorOptions` `cause`.
- A `401` response to an authenticated request clears the local session, so
  `client.isSessionActive` reflects reality and `terminate()` on an expired
  session does not leave a stale token behind.
- Session state errors (`No active session`, failed or timed-out `init()`)
  are `SessionError` instances instead of bare `Error`s; certificate, openssl,
  xmllint and XSD problems are `ConfigurationError` instances.
- The PKCS#12 password is passed to openssl through the child process
  environment instead of the command line, so it no longer appears in `ps`
  output or in thrown error messages.
- Legacy PKCS#12 bundles (RC2/3DES) are opened with `-legacy` on OpenSSL 3.
- The certificate is parsed once per client instead of on every `init()`.
- `pnpm` 10 is pinned via `packageManager`; `tsc --noEmit` now type-checks the
  test suite as well.
- `package.json` metadata points at `supc-io/ksef-sdk`.

### Fixed

- `signXades()` produced a plain XMLDSig with an unsigned, structurally invalid
  XAdES decoration (no `SignedProperties` reference, empty certificate digest,
  dangling `Target`, injected `Id="_0"` on the document root). It now emits a
  verifiable XAdES-BES signature.
- `sessions.init()` activated an "empty" session when the status response had
  no token (`isActive === true` while every request failed); it now throws
  `SessionError`.
- Missing `xmllint` (ENOENT) made XSD validation pass silently; it now throws
  `ConfigurationError`. An unloadable XSD file is reported the same way.
- Temporary directories created for PKCS#12 parsing and XSD validation were
  never removed (`unlinkSync` on a directory); they are now removed with
  `rmSync`.
- A caller's `AbortSignal` was reported as a timeout and the aborted request
  was retried; an already-aborted signal was ignored. Aborts now fail fast
  with `Request aborted by caller` and stop retries.
- Abort listeners were never removed from the caller's signal.
- Binary responses were decoded as UTF-8 with replacement characters.
- Empty 2xx bodies crashed `JSON.parse`; non-JSON bodies surfaced as
  `SyntaxError`. Both are handled (`undefined` / descriptive `KsefError`).
- An empty PKCS#12 password was rejected by the builder.
- Unreadable certificate files in `certificatePath()` threw raw `ENOENT`
  errors instead of `ConfigurationError`.
- Twelve public types (`ExportPart`, `PackagePartSignature`,
  `BatchHeaderEntry`, `PermissionCredential`, all `*Params` for batch,
  certificates and limits, `AuthorisationChallengeRequest`,
  `InitSignedRequest`) were not exported from the package entry point.
- README and docs used the NIP `1234567890`, whose checksum is invalid, so the
  Quick Start failed in `build()`; examples now use `1234563218`.
- The export polling example in `docs/exports.md` looped forever on failure.
- `pnpm lint` failed on a clean checkout (unused imports, type-only import).

### Removed

- KSeF 1.x resources that have no 2.0 implementation yet: `client.batch`,
  `client.exports`, `client.certificates`, `client.permissions`,
  `client.limits`, together with their types and docs (see #1).
- 1.x session API: `sessions.init()` / `terminate()` / `SessionToken` header,
  `SessionManager.requireToken()`, `AuthorisationChallengeResponse`,
  `InitSignedResponse`; `encryptToken()`.
- `SessionStatus` type (never produced by any method).
- `fromPem()` helper and the unused `requestXml()` pipeline.
- Documentation claims that the session token is RSA-OAEP encrypted and that
  the SDK targets "KSeF 2.0"; see the note above.
