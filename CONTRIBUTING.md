# Contributing

Contributions are welcome for supported, receive-only testing workflows.

1. Open an issue describing the use case and security boundary.
2. Keep core authentication, polling, exact-host validation and cleanup shared; adapters must not
   reimplement them.
3. Add tests for success, timeout, secret redaction and cleanup failure paths.
4. Run `npm run check` before proposing a change.
5. Do not add telemetry, outbound-email capability, automatic account registration, terms
   acceptance, payment automation or examples that test systems without authorization.

By contributing, you agree that your contribution is licensed under this repository's MIT License.
Never submit production credentials or real message contents.
