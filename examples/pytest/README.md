# pytest email-verification example

This example uses the Python package and its automatically loaded pytest fixtures. It creates one
five-minute receive-only inbox, gives the address to an application you are authorized to test,
waits for one verification message, validates the exact HTTPS destination and attempts inbox deletion in
fixture teardown.

## Install

```bash
python -m venv .venv
# PowerShell: .\.venv\Scripts\Activate.ps1
# bash: source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install "gettemp-email-testing[pytest] @ git+https://github.com/sefara/gettemp-email-testing.git@v0.2.1#subdirectory=python" pytest-playwright
python -m playwright install chromium
```

Keep the API key outside source:

```powershell
$env:GETTEMP_API_KEY='paste-the-one-time-value-here'
$env:TARGET_APP_URL='https://staging.your-app.example'
python -m pytest -q test_email_verification.py --tracing=off --screenshot=off --video=off
```

Change only the target URL, application selectors, expected subject and exact verification path.
Never put an API key, inbox capability, temporary address, OTP or verification URL in a committed
file, screenshot, trace or public test report.

**Free accounts can try this.** Basic REST and MCP share one small quota; see your account for
current limits. The example explicitly polls every 10 seconds for at most 45 seconds (at most five
list requests). Including create, one read and cleanup, that is at most eight REST requests per
run, excluding diagnostics and any other account activity. Run sequentially without retry plugins.
Stop on quota/rate errors, inspect `Retry-After` and leave capacity between runs. Cleanup is an
attempt and may fail; the five-minute TTL is the fallback. The library's compatible default
interval remains one second, so preserve the explicit `interval_seconds=10` in this example.

The pinned Git tag supplies the Python source package independently of registry publishing.
