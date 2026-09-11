# Roadmap

## P0 — reliable Playwright reference

- [x] Zero-dependency JavaScript client for the authenticated Developer API.
- [x] Deterministic create/wait/read/delete lifecycle.
- [x] Exact-host verification-link and unambiguous OTP helpers.
- [x] Playwright request adapter and skipped starter test.
- [x] Dry-run-first, idempotent project initialization.
- [x] Redacted status/create/delete doctor.
- [x] Generic secret-free MCP configuration template.
- [ ] Controlled end-to-end test with a project-owned sender.
- [ ] npm publication and signed/checksummed release artifact.
- [ ] Automatic CI after GitHub Actions capacity returns.

## P1 — common JavaScript test runners

- Cypress adapter with task/command teardown.
- Vitest and Jest service-test fixtures.
- npm, pnpm, Yarn and Bun detection.
- Tested client-specific MCP configuration writers.
- Compatibility matrix for the current and previous supported engine versions.

## P2 — broader ecosystem

- pytest fixture after JavaScript error semantics stabilize.
- Generated Java and .NET thin clients for Selenium workflows.
- Short-lived browser/device authorization so the CLI never asks users to copy a long-lived key.
- Published compatibility, deprecation and integration-health policies.

Every adapter must preserve the same authentication separation, finite polling, exact-host link
validation, redacted errors and deterministic cleanup as the core.
