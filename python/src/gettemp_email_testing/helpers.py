from __future__ import annotations

from collections.abc import Iterable, Mapping
from urllib.parse import urlsplit, urlunsplit

from .client import GetTempError

_LOCAL_HOSTS = {"127.0.0.1", "localhost", "::1"}


def _host(value: object) -> str:
    return str(value or "").strip().lower().rstrip(".")


def exact_host_url(
    href: str,
    *,
    expected_hostname: str,
    expected_path: str | Iterable[str] | None = None,
) -> str:
    expected = _host(expected_hostname)
    if not expected:
        raise GetTempError("invalid_input", "expected_hostname is required.")
    try:
        parsed = urlsplit(href)
        actual = _host(parsed.hostname)
        _ = parsed.port
    except (TypeError, ValueError) as error:
        raise GetTempError(
            "invalid_verification_url", "The candidate is not a valid URL."
        ) from error

    local_http = parsed.scheme == "http" and actual in _LOCAL_HOSTS
    if parsed.scheme != "https" and not local_http:
        raise GetTempError(
            "unsafe_verification_url",
            "Verification links must use HTTPS, except localhost development URLs.",
        )
    if actual != expected:
        raise GetTempError(
            "unexpected_hostname", "Verification link hostname did not match."
        )
    if parsed.username or parsed.password:
        raise GetTempError(
            "unsafe_verification_url", "Verification links cannot contain credentials."
        )

    if expected_path:
        paths = (
            [expected_path] if isinstance(expected_path, str) else list(expected_path)
        )
        if not any(
            parsed.path == path or parsed.path.startswith(f"{path}/") for path in paths
        ):
            raise GetTempError(
                "unexpected_path", "Verification link path did not match."
            )
    return urlunsplit(parsed)


def verification_url(
    message: Mapping[str, object],
    *,
    expected_hostname: str,
    expected_path: str | Iterable[str] | None = None,
) -> str:
    accepted: list[str] = []
    candidates = message.get("safe_links", [])
    for candidate in candidates if isinstance(candidates, list) else []:
        if (
            not isinstance(candidate, Mapping)
            or candidate.get("classification") != "verification-likely"
        ):
            continue
        try:
            accepted.append(
                exact_host_url(
                    str(candidate.get("href", "")),
                    expected_hostname=expected_hostname,
                    expected_path=expected_path,
                )
            )
        except GetTempError as error:
            if error.category not in {
                "unexpected_hostname",
                "unexpected_path",
                "unsafe_verification_url",
                "invalid_verification_url",
            }:
                raise
    unique = list(dict.fromkeys(accepted))
    if not unique:
        raise GetTempError(
            "verification_link_not_found", "No safe verification link matched."
        )
    if len(unique) > 1:
        raise GetTempError(
            "ambiguous_verification_link",
            "More than one verification link matched; select one explicitly.",
        )
    return unique[0]


def otp(message: Mapping[str, object], *, expected_length: int | None = None) -> str:
    candidates = message.get("otp_candidates", [])
    values: list[str] = []
    for candidate in candidates if isinstance(candidates, list) else []:
        if not isinstance(candidate, Mapping):
            continue
        value = str(candidate.get("value", "")).strip()
        if value and (expected_length is None or len(value) == expected_length):
            values.append(value)
    unique = list(dict.fromkeys(values))
    if not unique:
        raise GetTempError("otp_not_found", "No OTP candidate matched.")
    if len(unique) > 1:
        raise GetTempError("ambiguous_otp", "More than one OTP candidate matched.")
    return unique[0]
