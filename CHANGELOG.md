# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - Unreleased

### Added

- Initial release
- Certificate-based authentication (KSeF 2.0)
- Session management (init, terminate, status)
- Invoice operations (send, query, status, download)
- Batch operations (init, send, finish, status)
- UPO retrieval
- Bulk export (init, status, download)
- Certificate management (enroll, retrieve, revoke)
- Permission management (grant, revoke, query)
- Limits querying (context, subject, rate)
- XAdES-BES digital signature
- RSA-OAEP token encryption
- PKCS#12 certificate parsing
- Automatic retry with exponential backoff
- Typed error hierarchy
- Dual ESM/CJS build
