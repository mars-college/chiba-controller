# chiba-controller

`chiba-controller` is the new monorepo root for the Chiba control plane, Ops UI, Guide UI, and node runtime.

This repo is set up for two environments:

- laptop development (`docker-compose.yml`)
- always-on production (`docker-compose.prod.yml`) on `10.10.13.9`

## Monorepo Layout

- `apps/control-api` - control-plane API + Ops endpoints
- `apps/ops` - operations UI
- `apps/guide` - guide UI
- `apps/control-mcp` - MCP server
- `packages/db` - schema, migrations, import tools
- `packages/contracts` - shared schemas/types
- `packages/node-runtime` - node runtime process
- `config/registry.prod.toml` - production node inventory/bootstrap source

## Development (Laptop)

1. Install deps:

```bash
pnpm install
```

2. Start dev stack:

```bash
docker compose up --build
```

3. Open:

- Ops: `http://127.0.0.1:8792/`
- Control API: `http://127.0.0.1:8795`
- Guide: `http://127.0.0.1:5173`
- MinIO API: `http://127.0.0.1:9100`
- MinIO console: `http://127.0.0.1:9101`

Local uploaded media is stored under `.local/share-root/` so host-run dev servers and
the local Docker stack reuse the same asset files across restarts.

## Production (10.10.13.9)

1. Prepare env file:

```bash
cp .env.prod.example .env.prod
```

Defaults are already set for host `10.10.13.9`, with hostname routing on port `80`:

- Ops: `http://chiba.mars.college/`
- Guide: `http://cable.mars.college/`

2. Start the production stack:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

The prod compose stack includes one-shot init jobs:

- DB migrations (`db-migrate`)
- registry import (`db-import-registries`)

That import includes `config/registry.prod.toml` with `registryId=prod`.

3. Check status:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod ps
```

Optional wrapper script:

```bash
bash ./scripts/prod/start-stack.sh start
bash ./scripts/prod/start-stack.sh status
bash ./scripts/prod/start-stack.sh logs
```

## Bootstrap Nodes From Ops UI

Ops now exposes node bootstrap in the Node Workspace control panel.

1. Open Ops: `http://chiba.mars.college/`
2. Go to `Fleet` -> select a node -> `Control App/Web`
3. In `Bootstrap Node Runtime`, set:

- `Lookup Control API URL`: `http://chiba.mars.college:8795`
- `Node Control API URL`: `http://chiba.mars.college:8795`
- `Guide Base URL`: `http://cable.mars.college`
- `Namespace`: `prod`
- `Registry ID`: `prod`

4. Keep `Endpoints only` enabled for retargeting without redeploy, then click `Bootstrap Node`.

The panel shows command, stdout, stderr, and exit code.

## Bootstrap Nodes From CLI

```bash
bash ./scripts/pis/bootstrap-node-runtime.sh <node-id> \
  --control-api-url http://chiba.mars.college:8795 \
  --node-control-api-url http://chiba.mars.college:8795 \
  --guide-base-url http://cable.mars.college \
  --namespace prod \
  --registry-id prod \
  --endpoints-only
```

## Persistent Data

Production data is persisted in Docker volumes:

- `chiba_controller_prod_postgres_data`
- `chiba_controller_prod_minio_data`
- `chiba_controller_prod_share_root`

This keeps control state, media assets, and shared runtime storage across restarts.
