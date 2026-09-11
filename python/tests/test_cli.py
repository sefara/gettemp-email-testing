from __future__ import annotations

import json

from gettemp_email_testing.cli import main


def test_cli_reports_missing_key_without_echoing_environment(monkeypatch, capsys):
    monkeypatch.delenv("GETTEMP_API_KEY", raising=False)
    monkeypatch.setenv("UNRELATED_PRIVATE_VALUE", "must-not-appear")
    assert main(["--status-only"]) == 1
    output = json.loads(capsys.readouterr().err)
    assert output["category"] == "authentication_required"
    assert "must-not-appear" not in json.dumps(output)
