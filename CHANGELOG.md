# Changelog

## Unreleased

- Prepare patch 0.2.1 (not published): await Playwright response bodies, handle empty 204/205/304
  responses and dispose buffered API responses. Preserve existing exports and method signatures.
- Bound requests and polling, respect aborts, redact malformed JSON errors and reject credentials
  embedded in verification URLs. Keep a fallback for Node 20 versions without AbortSignal.any.
- Fix the executable and generated Playwright examples to assert server-backed account identity,
  expected origin/path and post-navigation origin with private browser artifacts disabled.
- Add real APIRequestContext regressions and `npm run test:browser` for synthetic browser checks.
  Pin the test tooling to patched Playwright 1.55.1 and exclude Python bytecode from npm archives.
- Add identity assertions to Python examples. No live REST/mail observation is claimed by this patch.

- Add a top-level, copy-ready pytest + Playwright example for easier Python discovery.
- Add a secretless PyPI Trusted Publishing workflow gated by a final GitHub release and the protected
  `pypi` environment.
- Declare the Python registry state explicitly without claiming an unpublished PyPI release.

## 0.2.0 — 2026-09-11

- Add versioned JSON contracts shared by JavaScript and Python integrations.
- Add a dependency-free Python client, pytest fixtures and verification example.
- Add fail-closed exact-host/OTP helpers and a redacted Python doctor command.
- Promote pytest from the long-term roadmap to the first cross-language P1 adapter.

## 0.1.0 — 2026-09-11

- Add the zero-dependency authenticated Developer API client.
- Add Playwright request adapter and safe verification-link/OTP helpers.
- Add dry-run-first project initializer, redacted doctor and generic MCP template.
- Add security, contribution, brand and roadmap documentation.
