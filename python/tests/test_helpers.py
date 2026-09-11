from __future__ import annotations

import unittest

from gettemp_email_testing import GetTempError, exact_host_url, otp, verification_url


class HelperTests(unittest.TestCase):
    def test_exact_https_host_and_path(self):
        self.assertEqual(
            exact_host_url(
                "https://accounts.example.test/verify?id=1",
                expected_hostname="accounts.example.test",
                expected_path="/verify",
            ),
            "https://accounts.example.test/verify?id=1",
        )

    def test_lookalikes_subdomains_credentials_and_http_are_rejected(self):
        for href in (
            "https://accounts.example.test.evil.test/verify",
            "https://sub.accounts.example.test/verify",
            "https://user:pass@accounts.example.test/verify",
            "http://accounts.example.test/verify",
        ):
            with self.subTest(href=href), self.assertRaises(GetTempError):
                exact_host_url(href, expected_hostname="accounts.example.test")

    def test_local_http_requires_exact_local_host(self):
        self.assertEqual(
            exact_host_url(
                "http://127.0.0.1:3000/verify", expected_hostname="127.0.0.1"
            ),
            "http://127.0.0.1:3000/verify",
        )
        with self.assertRaises(GetTempError):
            exact_host_url(
                "http://127.0.0.1:3000/verify", expected_hostname="localhost"
            )

    def test_verification_url_filters_to_classified_exact_host(self):
        message = {
            "safe_links": [
                {
                    "classification": "verification-likely",
                    "href": "https://evil.test/a",
                },
                {
                    "classification": "verification-likely",
                    "href": "https://accounts.example.test/verify",
                },
            ]
        }
        self.assertEqual(
            verification_url(message, expected_hostname="accounts.example.test"),
            "https://accounts.example.test/verify",
        )

    def test_links_and_otps_fail_closed_on_ambiguity(self):
        with self.assertRaises(GetTempError) as link_error:
            verification_url(
                {
                    "safe_links": [
                        {
                            "classification": "verification-likely",
                            "href": "https://example.test/a",
                        },
                        {
                            "classification": "verification-likely",
                            "href": "https://example.test/b",
                        },
                    ]
                },
                expected_hostname="example.test",
            )
        self.assertEqual(link_error.exception.category, "ambiguous_verification_link")
        with self.assertRaises(GetTempError) as otp_error:
            otp({"otp_candidates": [{"value": "123456"}, {"value": "654321"}]})
        self.assertEqual(otp_error.exception.category, "ambiguous_otp")

    def test_otp_exact_length(self):
        self.assertEqual(
            otp(
                {"otp_candidates": [{"value": "1234"}, {"value": "123456"}]},
                expected_length=6,
            ),
            "123456",
        )


if __name__ == "__main__":
    unittest.main()
