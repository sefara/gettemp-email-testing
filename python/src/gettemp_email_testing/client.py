from __future__ import annotations

import json
import os
import re
import time
from collections.abc import Callable, Iterator, Mapping
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlsplit
from urllib.request import Request, urlopen

DEFAULT_API_ORIGIN = "https://api.gettemp.email"
Transport = Callable[
    [str, str, Mapping[str, str], bytes | None, float],
    tuple[int, Mapping[str, str], bytes],
]


class GetTempError(Exception):
    def __init__(
        self,
        category: str,
        message: str,
        *,
        status: int | None = None,
        retry_after_seconds: float | None = None,
    ) -> None:
        super().__init__(message)
        self.category = category
        self.status = status
        self.retry_after_seconds = retry_after_seconds


def _origin(value: str) -> str:
    try:
        parsed = urlsplit(value)
        _ = parsed.port
    except ValueError as error:
        raise GetTempError(
            "invalid_input", "api_origin must be a valid origin."
        ) from error
    local = parsed.hostname in {"localhost", "127.0.0.1", "::1"}
    if parsed.scheme != "https" and not (parsed.scheme == "http" and local):
        raise GetTempError("invalid_input", "api_origin must use HTTPS.")
    if (
        parsed.username
        or parsed.password
        or parsed.query
        or parsed.fragment
        or parsed.path not in {"", "/"}
    ):
        raise GetTempError("invalid_input", "api_origin must contain only an origin.")
    if not parsed.hostname:
        raise GetTempError("invalid_input", "api_origin must contain a hostname.")
    return f"{parsed.scheme}://{parsed.netloc}"


def _default_transport(
    method: str,
    url: str,
    headers: Mapping[str, str],
    body: bytes | None,
    timeout: float,
) -> tuple[int, Mapping[str, str], bytes]:
    request = Request(url, data=body, headers=dict(headers), method=method)
    try:
        with urlopen(request, timeout=timeout) as response:
            return response.status, dict(response.headers.items()), response.read()
    except HTTPError as error:
        return error.code, dict(error.headers.items()), error.read()
    except (URLError, TimeoutError, OSError) as error:
        raise GetTempError(
            "network_error", "The gettemp.email request could not be completed."
        ) from error


@dataclass(frozen=True)
class DoctorResult:
    ok: bool
    status: str
    plan: str

    def as_dict(self) -> dict[str, object]:
        return {"ok": self.ok, "status": self.status, "plan": self.plan}


class GetTempClient:
    def __init__(
        self,
        api_key: str | None = None,
        *,
        api_origin: str = DEFAULT_API_ORIGIN,
        timeout_seconds: float = 15,
        transport: Transport | None = None,
    ) -> None:
        self._api_key = api_key or os.environ.get("GETTEMP_API_KEY", "")
        if not self._api_key:
            raise GetTempError(
                "authentication_required", "Set GETTEMP_API_KEY or pass api_key."
            )
        self.api_origin = _origin(api_origin)
        self.timeout_seconds = timeout_seconds
        self._transport = transport or _default_transport

    def _request(
        self,
        path: str,
        *,
        method: str = "GET",
        body: Mapping[str, object] | None = None,
        inbox: Mapping[str, object] | None = None,
        expected: tuple[int, ...] = (200,),
    ) -> Any:
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Accept": "application/json",
        }
        if inbox is not None:
            token = str(inbox.get("accessToken", ""))
            if not token:
                raise GetTempError(
                    "inbox_capability_required", "Inbox access token is required."
                )
            headers["X-Inbox-Access-Token"] = token
        encoded = json.dumps(body).encode("utf-8") if body is not None else None
        if encoded is not None:
            headers["Content-Type"] = "application/json"
        status, response_headers, raw = self._transport(
            method, f"{self.api_origin}{path}", headers, encoded, self.timeout_seconds
        )
        if status in expected:
            if status == 204 or not raw:
                return None
            try:
                return json.loads(raw)
            except (TypeError, ValueError) as error:
                raise GetTempError(
                    "invalid_response",
                    "gettemp.email returned invalid JSON.",
                    status=status,
                ) from error

        category = "request_failed"
        try:
            candidate = json.loads(raw)
            server_category = (
                candidate.get("error") if isinstance(candidate, dict) else None
            )
            if isinstance(server_category, str) and re.fullmatch(
                r"[a-z][a-z0-9_]{1,63}", server_category
            ):
                category = server_category
        except (TypeError, ValueError):
            pass
        retry_raw = next(
            (
                value
                for name, value in response_headers.items()
                if name.lower() == "retry-after"
            ),
            None,
        )
        try:
            retry_after = float(retry_raw) if retry_raw is not None else None
        except ValueError:
            retry_after = None
        raise GetTempError(
            category,
            f"gettemp.email returned HTTP {status}.",
            status=status,
            retry_after_seconds=retry_after,
        )

    @staticmethod
    def _inbox_id(inbox: Mapping[str, object]) -> str:
        value = str(inbox.get("inboxId", ""))
        if not value:
            raise GetTempError("invalid_input", "Inbox ID is required.")
        return quote(value, safe="")

    def status(self) -> Mapping[str, object]:
        return self._request("/v1/developer/status")

    def create_inbox(self, *, ttl_minutes: int = 60) -> Mapping[str, object]:
        if (
            isinstance(ttl_minutes, bool)
            or not isinstance(ttl_minutes, int)
            or not 5 <= ttl_minutes <= 1440
        ):
            raise GetTempError(
                "invalid_input", "ttl_minutes must be an integer from 5 to 1440."
            )
        return self._request(
            "/v1/developer/inboxes",
            method="POST",
            body={"ttlMinutes": ttl_minutes},
            expected=(201,),
        )

    def list_messages(self, inbox: Mapping[str, object]) -> list[Mapping[str, object]]:
        result = self._request(
            f"/v1/developer/inboxes/{self._inbox_id(inbox)}/messages", inbox=inbox
        )
        if not isinstance(result, list):
            raise GetTempError("invalid_response", "Message listing was not an array.")
        return result

    def read_message(
        self, inbox: Mapping[str, object], message_id: str
    ) -> Mapping[str, object]:
        if not message_id:
            raise GetTempError("invalid_input", "message_id is required.")
        result = self._request(
            f"/v1/developer/inboxes/{self._inbox_id(inbox)}/messages/{quote(message_id, safe='')}",
            inbox=inbox,
        )
        if not isinstance(result, dict):
            raise GetTempError(
                "invalid_response", "Message response was not an object."
            )
        return result

    def wait_for_message(
        self,
        inbox: Mapping[str, object],
        *,
        subject_includes: str = "",
        sender_includes: str = "",
        timeout_seconds: float = 45,
        interval_seconds: float = 1,
    ) -> Mapping[str, object]:
        deadline = time.monotonic() + timeout_seconds
        while time.monotonic() < deadline:
            for message in self.list_messages(inbox):
                if subject_includes and subject_includes not in str(
                    message.get("subject", "")
                ):
                    continue
                if sender_includes and sender_includes not in str(
                    message.get("sender_label", "")
                ):
                    continue
                return message
            time.sleep(min(interval_seconds, max(0, deadline - time.monotonic())))
        raise GetTempError(
            "message_timeout", "No matching message arrived before the deadline."
        )

    def delete_inbox(self, inbox: Mapping[str, object]) -> bool:
        try:
            self._request(
                f"/v1/developer/inboxes/{self._inbox_id(inbox)}",
                method="DELETE",
                inbox=inbox,
                expected=(204,),
            )
            return True
        except GetTempError as error:
            if error.status == 404:
                return False
            raise

    @contextmanager
    def temporary_inbox(
        self, *, ttl_minutes: int = 5
    ) -> Iterator[Mapping[str, object]]:
        inbox = self.create_inbox(ttl_minutes=ttl_minutes)
        try:
            yield inbox
        finally:
            self.delete_inbox(inbox)

    def doctor(self, *, status_only: bool = False) -> DoctorResult:
        status = self.status()
        plan = str(status.get("plan", ""))
        if status_only:
            return DoctorResult(ok=True, status="authenticated", plan=plan)
        with self.temporary_inbox(ttl_minutes=5):
            pass
        return DoctorResult(ok=True, status="create_delete_passed", plan=plan)
