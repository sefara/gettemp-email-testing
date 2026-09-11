from __future__ import annotations

import os
from urllib.parse import urlparse

import pytest
from gettemp_email_testing import verification_url
from playwright.sync_api import Page, expect


TARGET_APP_URL = os.environ.get("TARGET_APP_URL")


@pytest.mark.skipif(not TARGET_APP_URL, reason="set TARGET_APP_URL to an authorized test app")
def test_new_user_can_verify_email(
    page: Page, gettemp_client, gettemp_inbox
) -> None:
    """Run only against an application you own or are explicitly authorized to test."""
    target = urlparse(TARGET_APP_URL)
    if target.scheme != "https" or not target.hostname:
        pytest.fail("TARGET_APP_URL must be an absolute HTTPS URL")

    page.goto(f"{TARGET_APP_URL.rstrip('/')}/register")
    page.get_by_label("Email address").fill(gettemp_inbox["address"])
    page.get_by_role("button", name="Create account").click()
    expect(page.get_by_text("Check your inbox")).to_be_visible()

    summary = gettemp_client.wait_for_message(
        gettemp_inbox,
        subject_includes="Verify",
        timeout_seconds=45,
    )
    message = gettemp_client.read_message(gettemp_inbox, summary["id"])
    href = verification_url(
        message,
        expected_hostname=target.hostname,
        expected_path="/verify",
    )

    page.goto(href)
    expect(page.get_by_role("heading", name="Account verified")).to_be_visible()
