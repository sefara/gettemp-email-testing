# gettemp.email testing connector

Open-source helpers for testing email verification, one-time passwords, magic links and other
receive-only email flows with [gettemp.email](https://gettemp.email/).

The connector creates a short-lived inbox through the authenticated Developer API, waits for the
expected message, exposes only sanitized message fields, validates verification links against an
exact hostname and deletes the inbox from test teardown. It cannot send, reply to or forward email.

> **Early release:** the JavaScript/Playwright and Python/pytest source packages are available from
> this repository. The npm and PyPI names are reserved in the manifest but are not claimed as
> published until their registry releases are announced here.

## Requirements

- Node.js 20 or newer;
- a gettemp.email account and API key from [Account](https://gettemp.email/account/);
- an active plan that permits the Developer API;
- an application you own or are authorized to test.

## Install from GitHub

```bash
npm install --save-dev github:sefara/gettemp-email-testing#v0.2.0
```

Keep the key in your local or CI secret store:

```bash
GETTEMP_API_KEY=gte_live_REPLACE_WITH_YOUR_KEY
```

Never commit the real value. The account API key and the capability returned for one inbox are
different secrets.

## Safe project setup

Inspect the proposed changes first:

```bash
npx gettemp-email-testing init
```

Apply only missing files:

```bash
npx gettemp-email-testing init --write
```

The command detects Playwright, prints an explicit file plan, never overwrites an existing file and
generates a skipped example. Cypress, Vitest/Jest and Selenium adapters are roadmap items; the CLI
fails clearly instead of pretending they are supported.

## Connectivity check

```bash
npx gettemp-email-testing doctor
```

`doctor` authenticates, reads quota status, creates one empty five-minute inbox and deletes it. Its
output contains only `ok`, a stable status and the plan name. It never sends mail, reads a message or
prints a key, address, inbox ID or capability. Use `--status-only` when even an empty test inbox is
undesired.

## Playwright example

```js
import { expect, test } from '@playwright/test';
import { createPlaywrightInbox } from '@gettemp-email/testing/playwright';

test('verifies an email address', async ({ page, request }) => {
  const mail = createPlaywrightInbox(request);

  await mail.use(async (inbox, client) => {
    await page.goto('https://your-app.example/register');
    await page.getByLabel('Email').fill(inbox.address);
    await page.getByRole('button', { name: /sign up/i }).click();

    const summary = await client.waitForMessage(inbox, { subjectIncludes: 'Verify' });
    const message = await client.readMessage(inbox, summary.id);
    const href = mail.verificationUrl(message, {
      expectedHostname: 'your-app.example',
      expectedPath: '/verify',
    });

    await page.goto(href);
    await expect(page).toHaveURL(/verified/);
    // Assert identity returned by server verification, not an echoed form value.
    await expect(page.getByTestId('verified-email')).toHaveText(inbox.address);
  }, { ttlMinutes: 5 });
});
```

The `finally`-based lifecycle in `mail.use` deletes the inbox after success, timeout or assertion
failure. For OTP flows, use `mail.otp(message, { expectedLength: 6 })`; it fails when zero or multiple
candidates match.

## Direct client

```js
import { GetTempClient } from '@gettemp-email/testing';

const client = new GetTempClient();
await client.withInbox(async (inbox) => {
  // Give inbox.address to the application under test.
  const summary = await client.waitForMessage(inbox, { timeoutMs: 45_000 });
  const message = await client.readMessage(inbox, summary.id);
  // Assert only the fields your test requires.
}, { ttlMinutes: 5 });
```

## pytest example

Install the Python package directly from the same tagged repository release:

```bash
pip install "gettemp-email-testing[pytest] @ git+https://github.com/sefara/gettemp-email-testing.git@v0.2.0#subdirectory=python"
```

The installed plugin exposes `gettemp_client` and `gettemp_inbox`. The inbox fixture has a five-minute
TTL and unconditional teardown cleanup:

```python
from gettemp_email_testing import verification_url
from playwright.sync_api import expect


def test_email_verification(page, gettemp_client, gettemp_inbox):
    page.goto("https://your-app.example/register")
    page.get_by_label("Email").fill(gettemp_inbox["address"])
    page.get_by_role("button", name="Sign up").click()

    summary = gettemp_client.wait_for_message(
        gettemp_inbox, subject_includes="Verify", timeout_seconds=45
    )
    message = gettemp_client.read_message(gettemp_inbox, summary["id"])
    page.goto(
        verification_url(message, expected_hostname="your-app.example")
    )
    # Adapt to identity returned by server-side verification.
    expect(page.get_by_test_id("verified-email")).to_have_text(gettemp_inbox["address"])
```

The Python package has no runtime dependencies or telemetry. Run its redacted production diagnostic
with `gettemp-email-doctor`. A complete copy-ready project lives in
[`examples/pytest`](examples/pytest/); it includes the browser assertion and skips safely until an
authorized `TARGET_APP_URL` is supplied.

## MCP for coding agents

Print the generic, secret-free Streamable HTTP template:

```bash
npx gettemp-email-testing mcp-config
```

Endpoint: `https://api.gettemp.email/mcp`. Store `GETTEMP_API_KEY` in the MCP client's protected
environment or secret settings and adapt the printed environment placeholder to that client's
documented syntax. Client-specific config writers are not enabled until their schemas are tested.

The server offers six receive-only tools: `create_inbox`, `list_messages`, `wait_for_message`,
`read_message`, `delete_inbox` and `service_status`. Account creation, email verification, acceptance
of terms and payment remain visible human actions.

## Security boundaries

- An email address alone never authorizes inbox access.
- Keys and inbox capabilities are never placed in URLs or diagnostic output.
- Error messages never include upstream response bodies.
- Verification links require HTTPS and an exact expected hostname. Local HTTP is limited to exact
  `localhost`, `127.0.0.1` or `::1` development hosts.
- OTP and link helpers fail closed on ambiguity.
- Polling has a hard deadline, and test examples use deterministic cleanup.
- No telemetry is collected by this package.
- Do not use this connector for mass account creation, free-trial abuse, spam, ban evasion or systems
  you are not authorized to test.

See [SECURITY.md](SECURITY.md) for vulnerability reporting and [ROADMAP.md](docs/ROADMAP.md) for
planned adapters. Shared versioned response contracts are in [schemas](schemas/). Product
documentation and policies remain canonical at
[gettemp.email](https://gettemp.email/).

## Ownership and license

Copyright and product IP are held by **KOOL4 Solutions s. r. o.** The source code is licensed under
the [MIT License](LICENSE). The license does not grant rights to the gettemp.email name or logos; see
[TRADEMARKS.md](TRADEMARKS.md).
