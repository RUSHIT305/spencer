# Spencer backend plugins

Spencer has four built-in backends, but provider support is extensible. A backend plugin implements two methods: `build_payload(model, messages, tools)` and `normalize_response(data)`. The first creates the provider’s JSON request body. The second converts the provider’s JSON response into Spencer’s normalized `ProviderResponse` shape.

## Plugin package

Create a normal Python package and expose a factory through the `spencer.backends` entry-point group:

```toml
[project.entry-points."spencer.backends"]
my-provider = "my_spencer_backend:create_backend"
```

The factory receives Spencer’s `Settings` object and returns a backend instance:

```python
from spencer.backends import GenericJSONBackend


def create_backend(settings):
    return GenericJSONBackend(settings)
```

For a different request or response contract, implement a custom class instead of subclassing `GenericJSONBackend`. Keep authentication, retries, and HTTP transport in Spencer; the plugin should focus on protocol translation.

## Use a plugin

After installing the plugin into the same environment as Spencer, select it by name:

```bash
python -m pip install my-spencer-backend
spencer --protocol my-provider --api-url https://provider.example/generate --model coding-model "Fix the failing test"
```

Confirm discovery with:

```bash
spencer --doctor
```

The `available_backends` field lists built-in and installed plugin backends. A plugin should include transport-level tests for request serialization, response normalization, tool calls, and provider error handling.
