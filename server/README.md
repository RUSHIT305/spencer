# Spencer managed Gemini gateway

This service is the company-operated backend for the standalone Spencer client. End users do not run it, configure it, or provide credentials.

## Required deployment secret

Set `GEMINI_API_KEY` in the deployment platform’s secret manager. Never commit the value, add it to `.env` files, print it in logs, or expose it through the standalone client.

Optional deployment settings:

```text
PORT=8787
GEMINI_MODEL=gemini-2.5-flash
RATE_LIMIT_PER_MINUTE=30
```

Start the gateway with Node.js 18 or newer:

```bash
GEMINI_API_KEY="<deployment-secret>" node server/gemini-gateway.js
```

The production deployment should expose:

```text
GET  /health
POST /v1/generate
```

The standalone client expects the public gateway at `https://api.spencer.dev/v1/generate`. The domain must resolve to this service and serve HTTPS before a public Spencer release is considered functional. If the company changes the gateway domain, update `MANAGED_ENDPOINT` in `lib/config.js`, build a new standalone release, and verify the complete CI matrix before publishing.

## Production controls

The gateway includes an in-process per-client rate limit and request-size limit. Place it behind HTTPS, an infrastructure-level rate limiter, structured error monitoring, and an operational health check for production.
 Store the Gemini key as a restricted deployment secret. Rotate the key immediately if it is ever exposed. The gateway should not persist repository contents or prompts unless an explicit retention policy is approved.

The gateway’s deterministic tests run without a live Gemini credential. Live smoke tests should run only in a protected deployment environment with a restricted test key and should never be added to pull-request CI.
