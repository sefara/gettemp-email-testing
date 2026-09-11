# Public data contracts

These JSON Schema Draft 2020-12 documents describe the stable fields consumed or returned by the
JavaScript and Python clients. Additional server fields may be present. Clients must ignore unknown
fields and must never include raw response bodies in errors or diagnostic output.

Contract compatibility rules:

- optional fields may be added in a minor release;
- required fields, field types or security semantics change only in a major release;
- `address`, `inboxId`, `accessToken`, message content, OTPs and verification URLs are sensitive and
  prohibited from doctor/telemetry output;
- date-time values use RFC 3339 strings;
- API errors expose only a stable category and HTTP status to connector callers.
