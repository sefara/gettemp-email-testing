# 0.2.1 — Free onboarding and connector corrections

Basic REST API and MCP can be tried with a Free gettemp.email account. Both interfaces consume
one shared account quota. This patch keeps public exports and the existing client default intervals.
The documented examples explicitly poll every 10 seconds within a 45-second window, with at most
five list calls and eight total REST requests including create, read and cleanup. Diagnostics,
parallel tests and other MCP/REST use consume additional calls.

Changes:

- Correct Playwright response buffering, empty responses and disposal; preserve error status.
- Bound polling and requests, respect cancellation and reject ambiguous/foreign verification links.
- Reject API redirects before account or inbox credentials can be forwarded.
- Assert the server-verified account identity in examples; disable private browser artifacts.
- Validate Python polling bounds and remaining request timeout; reject results arriving too late.
- Pin JavaScript and Python installation instructions to this release and explain Free limits,
  sequential execution, cleanup failures and expiry fallback.

Verification on 2026-10-22: 33 JavaScript tests, 18 Python tests, 12 synthetic browser scenarios
for packaged/generated examples, JavaScript archive installation/import/CLI/init, and Python wheel
build and installed-wheel tests. The browser run used Chrome with the Playwright 1.55.1 adapter.
The initial browser attempt lacked that version's bundled Chromium; the explicit installed Chrome
run passed. The archive smoke harness was corrected to keep lifecycle logs out of JSON parsing.

These checks use synthetic data/local HTTP fixtures. They verify connector behavior and packaging;
they do not establish current production email delivery, unique users, ad impressions or revenue.
No live credentials or email contents are included. Source installation remains available even if
the separate registry publishing workflow is pending or fails.

Copyright and product IP: KOOL4 Solutions s. r. o. Source license: MIT.
