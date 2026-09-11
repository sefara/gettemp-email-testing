from gettemp_email_testing import verification_url


def test_email_verification(page, gettemp_client, gettemp_inbox):
    """Replace the target only with an application you are authorized to test."""
    page.goto("https://your-app.example/register")
    page.get_by_label("Email").fill(gettemp_inbox["address"])
    page.get_by_role("button", name="Sign up").click()

    summary = gettemp_client.wait_for_message(
        gettemp_inbox, subject_includes="Verify", timeout_seconds=45
    )
    message = gettemp_client.read_message(gettemp_inbox, summary["id"])
    href = verification_url(
        message,
        expected_hostname="your-app.example",
        expected_path="/verify",
    )
    page.goto(href)
