# pytest email-verification example

This example uses the Python package and its automatically loaded pytest fixtures. It creates one
five-minute receive-only inbox, gives the address to an application you are authorized to test,
waits for one verification message, validates the exact HTTPS destination and deletes the inbox in
fixture teardown.

## Install

```bash
python -m venv .venv
# PowerShell: .\.venv\Scripts\Activate.ps1
# bash: source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install "gettemp-email-testing[pytest] @ git+https://github.com/sefara/gettemp-email-testing.git@v0.2.0#subdirectory=python" pytest-playwright
python -m playwright install chromium
```

Keep the API key outside source:

```powershell
$env:GETTEMP_API_KEY='paste-the-one-time-value-here'
$env:TARGET_APP_URL='https://staging.your-app.example'
python -m pytest -q test_email_verification.py
```

Change only the target URL, application selectors, expected subject and exact verification path.
Never put an API key, inbox capability, temporary address, OTP or verification URL in a committed
file, screenshot, trace or public test report.

This source release is installed from the Git tag until the project announces a PyPI release. The
name `gettemp-email-testing` is not represented as published on PyPI by this repository.
