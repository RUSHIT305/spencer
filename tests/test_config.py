from pathlib import Path

import pytest

from spencer.config import ConfigError, Settings


def test_cli_values_override_toml_and_environment(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    config = tmp_path / "settings.toml"
    config.write_text(
        "[agent]\nmodel = 'file-model'\nmax_steps = 4\ncommand_timeout = 12\nauto_approve = true\n",
        encoding="utf-8",
    )
    monkeypatch.setenv("SPENCER_MODEL", "env-model")
    monkeypatch.setenv("SPENCER_API_KEY", "test-key")

    settings = Settings.from_values(tmp_path, config_file=config, model="cli-model", max_steps=7)

    assert settings.model == "cli-model"
    assert settings.max_steps == 7
    assert settings.command_timeout == 12
    assert settings.auto_approve is True
    assert settings.api_key == "test-key"
    assert settings.config_file == config


def test_invalid_limits_are_rejected(tmp_path: Path) -> None:
    with pytest.raises(ConfigError, match="max_steps"):
        Settings.from_values(tmp_path, max_steps=0)
    with pytest.raises(ConfigError, match="command_timeout"):
        Settings.from_values(tmp_path, command_timeout=901)
