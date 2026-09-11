# Security policy

## Supported versions

Security fixes are provided for the latest published release. This repository is an early release;
pin a reviewed Git tag rather than an unversioned branch.

## Report a vulnerability

Do not open a public issue for a suspected vulnerability, credential exposure, mailbox access issue
or abuse vector. Report it through the private security contact listed at
[gettemp.email/security](https://gettemp.email/security/). Include the affected version, a minimal
reproduction and impact. Do not include live API keys, inbox capabilities or message contents.

## Secret handling

- Store `GETTEMP_API_KEY` in an environment or CI secret store.
- Never put a key or inbox capability in source, logs, screenshots, issue reports or command-line
  arguments.
- Rotate a key immediately if it is exposed.
- Treat every inbox `accessToken` as a one-inbox capability and delete the inbox after the test.

The package intentionally has no telemetry and redacts operational diagnostics.
