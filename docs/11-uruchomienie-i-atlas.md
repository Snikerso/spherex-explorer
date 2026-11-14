# Local setup and MongoDB Atlas

## Requirements and available workflow

The current source includes React/Vite, NestJS, shared contracts, anonymous sessions, revisioned state, real IRSA observations, Python imaging, notes and HTTP/SSE copilot history. It is beyond the original scaffold stage. Consult the [integration report](12-integracja-live.md) for feature limitations and the [deployment notes](../deploy/README.md) for the public hosting baseline.

Use Node 22.12+ from the 22 series or Node 24, pnpm 11.25.0, Python 3.11–3.13 and uv. `.nvmrc`, package manifests and lockfiles define the project toolchain. MongoDB must support transactions as a replica set. Atlas is the primary managed option; Docker is only needed for the optional local database.

## Configure Atlas

1. Create a cluster and an application database user with `readWrite` scoped to `spherex`.
2. Permit the backend's source address through Atlas Network Access.
3. Copy the Drivers URI, supply user/password and `/spherex`, and percent-encode special credential characters.
4. Store it only in backend environment configuration as `MONGODB_URI`. React never connects directly to Atlas.

Illustrative values only:

```dotenv
MONGODB_URI=mongodb+srv://APP_USER:ENCODED_PASSWORD@YOUR_CLUSTER.mongodb.net/spherex?retryWrites=true&w=majority
```

Do not add local `directConnection=true` or `replicaSet=rs0` to Atlas URLs. Preserve the provider's connection parameters. Never commit/share a URI containing credentials. Atlas manages replication; see [current plan limitations](https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/) rather than relying on a fixed historical allowance. Store metadata/state in MongoDB and image assets outside it; the API limits its connection pool.

## First startup

From the repository root:

```bash
pnpm install --frozen-lockfile
uv sync --project workers/imaging --locked
cp .env.example .env # first setup only
```

Set `MONGODB_URI` and `APP_ORIGIN=http://127.0.0.1:5173`. For chat, also set server-only `OPENAI_API_KEY`, `OPENAI_MODEL`, and optional `OPENAI_REASONING_EFFORT`. Manual search/imaging and offline tests need no OpenAI key.

```bash
pnpm db:init
pnpm dev
```

- [Frontend](http://127.0.0.1:5173)
- [API/database readiness](http://127.0.0.1:3000/api/v1/health/ready)
- [Process liveness](http://127.0.0.1:3000/api/v1/health/live)

Initialization creates required indexes and is repeatable; it is not a database wipe. Vite proxies `/api` to the backend, keeping browser requests same-origin. `APP_ORIGIN` must exactly match the opened frontend origin: `localhost` and `127.0.0.1` are different origins. If `API_PORT` changes, update the Vite proxy target as well.

For the existing maintainer environment:

```bash
doppler run --project sphere_x --config dev -- pnpm db:init
doppler run --project sphere_x --config dev -- pnpm dev
```

## REST state example

The cookie stays in a temporary local file. Use the same origin configured above:

```bash
curl -c /tmp/spherex-cookies.txt -X POST \
  -H 'Origin: http://127.0.0.1:5173' \
  http://127.0.0.1:3000/api/v1/sessions

curl -b /tmp/spherex-cookies.txt \
  http://127.0.0.1:3000/api/v1/view

curl -b /tmp/spherex-cookies.txt -X PATCH \
  -H 'Origin: http://127.0.0.1:5173' -H 'Content-Type: application/json' \
  -d '{"expectedRevision":0,"patch":{"fps":1}}' \
  http://127.0.0.1:3000/api/v1/view

rm /tmp/spherex-cookies.txt
```

A new session starts at revision zero. Subsequent writes use the revision returned by the API; a stale revision produces `409 VIEW_CONFLICT`. Identity comes from the cookie, not a session ID in the request body.

## Optional local MongoDB

With Docker running:

```bash
pnpm db:up
```

Use the local URI:

```dotenv
MONGODB_URI=mongodb://127.0.0.1:27017/spherex?replicaSet=rs0&directConnection=true
```

Then initialize indexes and run the application. Compose binds MongoDB to loopback. `pnpm db:down` stops it while retaining the volume. Do not run local replica-set bootstrap against Atlas.

## Verification and troubleshooting

```bash
pnpm check
pnpm test:integration
pnpm test:imaging
pnpm demo:scenario
```

Integration tests use their own temporary MongoDB replica set, not your Atlas cluster. They do not prove access to that cluster; `health/ready` checks the configured connection. The synthetic demo is not archive/model evidence.

When changing contracts during development, rebuild `pnpm --filter @spherex/contracts build` if the development command has not rebuilt them. Archive preparation may take minutes and should show progress/cancellation. Run only one API process with the local queue. Optional durable image storage and migration are documented in the [README](../README.md#cache-and-persistence).
