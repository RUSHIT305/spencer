from pathlib import Path

from spencer.backends import GenericJSONBackend, ProviderChoice, ProviderMessage, ProviderResponse
from spencer.config import Settings
from spencer.provider import HTTPProvider, register_backend


def test_ollama_backend_normalizes_local_model_response(tmp_path: Path) -> None:
    settings = Settings.from_values(
        tmp_path,
        protocol="ollama-chat",
        model="qwen2.5-coder",
        api_url="http://localhost:11434/api/chat",
    )
    provider = HTTPProvider(
        settings,
        transport=lambda _request, _timeout: {
            "message": {
                "content": "local response",
                "tool_calls": [],
            }
        },
        retries=0,
    )

    response = provider.complete(model=settings.model, messages=[], tools=[])

    assert response.choices[0].message.content == "local response"


def test_custom_backend_can_be_registered_and_used(tmp_path: Path) -> None:
    class CustomBackend(GenericJSONBackend):
        def normalize_response(self, _data):
            return ProviderResponse([ProviderChoice(ProviderMessage("custom", []))])

    register_backend("test-custom", CustomBackend)
    settings = Settings.from_values(
        tmp_path,
        protocol="test-custom",
        model="custom-model",
        api_url="https://provider.example/custom",
    )
    provider = HTTPProvider(settings, transport=lambda _request, _timeout: {}, retries=0)

    response = provider.complete(model=settings.model, messages=[], tools=[])

    assert response.choices[0].message.content == "custom"
