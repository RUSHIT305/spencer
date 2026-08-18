from pathlib import Path

from spencer import cli


def test_doctor_reports_provider_and_backends(tmp_path: Path, monkeypatch, capsys) -> None:
    monkeypatch.setenv("SPENCER_API_KEY", "test-key")
    monkeypatch.setenv("SPENCER_API_URL", "https://provider.example/chat")
    monkeypatch.setenv("SPENCER_API_PROTOCOL", "generic-json")

    result = cli.main(["--doctor", "--cwd", str(tmp_path)])

    output = capsys.readouterr().out
    assert result == 0
    assert '"protocol": "generic-json"' in output
    assert '"api_url": "https://provider.example/chat"' in output
    assert '"available_backends"' in output
    assert "test-key" not in output


def test_init_creates_user_template(tmp_path: Path, monkeypatch, capsys) -> None:
    monkeypatch.setattr(cli, "config_dir", lambda: tmp_path / "config")

    result = cli.main(["--init", "--cwd", str(tmp_path)])

    assert result == 0
    assert (tmp_path / "config" / "config.toml").is_file()
    assert "generic-json" in (tmp_path / "config" / "config.toml").read_text()
    assert "Created" in capsys.readouterr().out


def test_invalid_headers_are_reported_as_cli_error(tmp_path: Path, capsys) -> None:
    result = cli.main(["--doctor", "--cwd", str(tmp_path), "--headers", "not-json"])

    assert result == 2
    assert "Expecting value" in capsys.readouterr().err
