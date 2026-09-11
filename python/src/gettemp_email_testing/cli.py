from __future__ import annotations

import argparse
import json
import sys

from .client import GetTempClient, GetTempError


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="gettemp-email-doctor",
        description="Run a redacted gettemp.email Developer API connectivity check.",
    )
    parser.add_argument(
        "--status-only",
        action="store_true",
        help="Authenticate and read quota status without creating an empty inbox.",
    )
    args = parser.parse_args(argv)
    try:
        result = GetTempClient().doctor(status_only=args.status_only)
        print(json.dumps(result.as_dict(), separators=(",", ":")))
        return 0
    except GetTempError as error:
        print(
            json.dumps(
                {
                    "ok": False,
                    "category": error.category,
                    "message": str(error),
                    "status": error.status,
                },
                separators=(",", ":"),
            ),
            file=sys.stderr,
        )
        return 1
