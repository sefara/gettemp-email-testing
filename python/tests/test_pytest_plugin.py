from __future__ import annotations

from gettemp_email_testing.pytest_plugin import gettemp_inbox


class FakeClient:
    def __init__(self):
        self.deleted = []

    def create_inbox(self, *, ttl_minutes):
        assert ttl_minutes == 5
        return {"inboxId": "fixture", "accessToken": "fixture-capability"}

    def delete_inbox(self, inbox):
        self.deleted.append(inbox)


def test_fixture_generator_always_cleans_up():
    client = FakeClient()
    fixture = gettemp_inbox.__wrapped__(client)
    inbox = next(fixture)
    assert inbox["inboxId"] == "fixture"
    try:
        next(fixture)
    except StopIteration:
        pass
    assert client.deleted == [inbox]
