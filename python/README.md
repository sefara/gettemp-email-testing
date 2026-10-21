# gettemp.email for pytest

Python client and pytest fixtures for receive-only email verification tests. This package is part of
the [gettemp-email-testing](https://github.com/sefara/gettemp-email-testing) repository.

Install the tagged source release:

```bash
pip install "gettemp-email-testing[pytest] @ git+https://github.com/sefara/gettemp-email-testing.git@v0.2.1#subdirectory=python" pytest-playwright
python -m playwright install chromium
```

Put the real API key in a local or CI secret named `GETTEMP_API_KEY`, never in source. The installed
pytest plugin exposes `gettemp_client` and `gettemp_inbox` fixtures:

A Free account supports these basic REST calls and MCP with one shared small quota; no paid
subscription is needed to try this example. Check current limits and remaining capacity in
[Account](https://gettemp.email/account/). Run one test at a time, without retries. The browser
`page` fixture requires `pytest-playwright`; adapt the URL and selectors to an application you own.

```python
from gettemp_email_testing import verification_url
from playwright.sync_api import expect


def test_email_verification(page, gettemp_client, gettemp_inbox):
    page.goto("https://your-app.example/register")
    page.get_by_label("Email").fill(gettemp_inbox["address"])
    page.get_by_role("button", name="Sign up").click()

    summary = gettemp_client.wait_for_message(
        gettemp_inbox, subject_includes="Verify", timeout_seconds=45, interval_seconds=10
    )
    message = gettemp_client.read_message(gettemp_inbox, summary["id"])
    page.goto(
        verification_url(
            message,
            expected_hostname="your-app.example",
            expected_path="/verify",
        )
    )
    # Assert identity returned by server verification, not the original form value.
    expect(page.get_by_test_id("verified-email")).to_have_text(gettemp_inbox["address"])
```

`gettemp_inbox` creates a five-minute inbox and attempts deletion in fixture teardown. The package
has no runtime dependencies or telemetry. It cannot send, reply to or forward mail.

Run the redacted connectivity check with `gettemp-email-doctor`. It reads status, creates one empty
five-minute inbox and deletes it without reading or sending a message. Add `--status-only` to avoid
creating the empty inbox.

With the explicit 10-second interval and 45-second polling window, one run makes at most five list
requests and at most eight REST requests including create, read and delete. The compatible client
default is still one second; do not omit the explicit interval on Free. Diagnostics and other
REST/MCP sessions consume additional shared calls. Stop on HTTP 429 instead of retrying in a loop.
Cleanup can fail on network/quota errors; expiry remains the fallback. Disable traces, screenshots
and videos and keep mail content out of test logs. See the
[complete example](https://github.com/sefara/gettemp-email-testing/tree/v0.2.1/examples/pytest).
