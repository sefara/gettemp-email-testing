from __future__ import annotations

import json
import unittest
from typing import Any

from gettemp_email_testing import GetTempClient, GetTempError

INBOX = {
    "inboxId": "11111111-1111-4111-8111-111111111111",
    "address": "sample@gettempemail.online",
    "accessToken": "capability-token",
    "expiresAt": "2026-09-11T12:00:00Z",
}


class FakeTransport:
    def __init__(self, responses: list[tuple[int, dict[str, str], Any]]) -> None:
        self.responses = responses
        self.calls: list[tuple[str, str, dict[str, str], bytes | None, float]] = []

    def __call__(self, method, url, headers, body, timeout):
        self.calls.append((method, url, dict(headers), body, timeout))
        status, response_headers, payload = self.responses.pop(0)
        raw = payload if isinstance(payload, bytes) else json.dumps(payload).encode()
        return status, response_headers, raw


class ClientTests(unittest.TestCase):
    def test_account_key_and_inbox_capability_are_separate(self):
        transport = FakeTransport([(200, {}, [])])
        client = GetTempClient(api_key="gte_live_fixture", transport=transport)
        client.list_messages(INBOX)
        _, url, headers, _, _ = transport.calls[0]
        self.assertEqual(headers["Authorization"], "Bearer gte_live_fixture")
        self.assertEqual(headers["X-Inbox-Access-Token"], "capability-token")
        self.assertNotIn("gte_live_fixture", url)
        self.assertNotIn("capability-token", url)

    def test_errors_are_redacted(self):
        transport = FakeTransport(
            [(429, {"Retry-After": "12"}, {"error": "quota_reached", "secret": "no"})]
        )
        client = GetTempClient(api_key="gte_live_fixture", transport=transport)
        with self.assertRaises(GetTempError) as raised:
            client.status()
        self.assertEqual(raised.exception.category, "quota_reached")
        self.assertEqual(raised.exception.status, 429)
        self.assertEqual(raised.exception.retry_after_seconds, 12)
        self.assertNotIn("secret", str(raised.exception))

    def test_untrusted_error_category_is_not_exposed(self):
        client = GetTempClient(
            api_key="gte_live_fixture",
            transport=FakeTransport([(500, {}, {"error": "secret value from body"})]),
        )
        with self.assertRaises(GetTempError) as raised:
            client.status()
        self.assertEqual(raised.exception.category, "request_failed")
        self.assertNotIn("secret value", str(raised.exception))

    def test_context_manager_cleans_up_after_failure(self):
        transport = FakeTransport([(201, {}, INBOX), (204, {}, b"")])
        client = GetTempClient(api_key="gte_live_fixture", transport=transport)
        with (
            self.assertRaisesRegex(RuntimeError, "assertion failed"),
            client.temporary_inbox(),
        ):
            raise RuntimeError("assertion failed")
        self.assertEqual([call[0] for call in transport.calls], ["POST", "DELETE"])

    def test_doctor_is_redacted_and_runs_status_create_delete(self):
        transport = FakeTransport(
            [
                (200, {}, {"plan": "developer", "quota": {"remainingDay": 10}}),
                (201, {}, INBOX),
                (204, {}, b""),
            ]
        )
        client = GetTempClient(
            api_key="gte_live_secret_that_must_not_leak", transport=transport
        )
        result = client.doctor().as_dict()
        self.assertEqual(
            result, {"ok": True, "status": "create_delete_passed", "plan": "developer"}
        )
        encoded = json.dumps(result)
        self.assertNotIn("secret", encoded)
        self.assertNotIn("sample@", encoded)

    def test_wrong_response_shape_fails_closed(self):
        client = GetTempClient(
            api_key="gte_live_fixture",
            transport=FakeTransport([(200, {}, {"messages": []})]),
        )
        with self.assertRaises(GetTempError) as raised:
            client.list_messages(INBOX)
        self.assertEqual(raised.exception.category, "invalid_response")

    def test_origin_validation(self):
        for origin in (
            "http://remote.example",
            "https://user:pass@example.test",
            "https://example.test/path",
        ):
            with self.subTest(origin=origin), self.assertRaises(GetTempError):
                GetTempClient(api_key="x", api_origin=origin)


if __name__ == "__main__":
    unittest.main()
