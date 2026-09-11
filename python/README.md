# gettemp.email for pytest

Python client and pytest fixtures for receive-only email verification tests. This package is part of
the [gettemp-email-testing](https://github.com/sefara/gettemp-email-testing) repository.

Install the tagged source release:

```bash
pip install "gettemp-email-testing[pytest] @ git+https://github.com/sefara/gettemp-email-testing.git@v0.2.0#subdirectory=python"
```

Put the real API key in a local or CI secret named `GETTEMP_API_KEY`, never in source. The installed
pytest plugin exposes `gettemp_client` and `gettemp_inbox` fixtures:

```python
from gettemp_email_testing import verification_url


def test_email_verification(page, gettemp_client, gettemp_inbox):
    page.goto("https://your-app.example/register")
    page.get_by_label("Email").fill(gettemp_inbox["address"])
    page.get_by_role("button", name="Sign up").click()

    summary = gettemp_client.wait_for_message(
        gettemp_inbox, subject_includes="Verify", timeout_seconds=45
    )
    message = gettemp_client.read_message(gettemp_inbox, summary["id"])
    page.goto(
        verification_url(
            message,
            expected_hostname="your-app.example",
            expected_path="/verify",
        )
    )
```

`gettemp_inbox` creates a five-minute inbox and always deletes it in fixture teardown. The package
has no runtime dependencies or telemetry. It cannot send, reply to or forward mail.

Run the redacted connectivity check with `gettemp-email-doctor`. It reads status, creates one empty
five-minute inbox and deletes it without reading or sending a message. Add `--status-only` to avoid
creating the empty inbox.
