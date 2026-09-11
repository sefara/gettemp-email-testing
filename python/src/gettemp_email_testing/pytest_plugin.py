from __future__ import annotations

import pytest

from .client import GetTempClient


@pytest.fixture(scope="session")
def gettemp_client() -> GetTempClient:
    """Authenticated receive-only gettemp.email client for the test session."""
    return GetTempClient()


@pytest.fixture
def gettemp_inbox(gettemp_client: GetTempClient):
    """Five-minute temporary inbox with unconditional teardown cleanup."""
    inbox = gettemp_client.create_inbox(ttl_minutes=5)
    try:
        yield inbox
    finally:
        gettemp_client.delete_inbox(inbox)
