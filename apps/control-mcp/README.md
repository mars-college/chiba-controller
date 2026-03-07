# cable3 control-mcp

MCP stdio server that exposes `cable3` control-api operations to agents.

Tools:
- `create_upload_request`
- `get_upload_status`
- `send_media_to_nodes`
- `search_media_library`
- `query_nodes`
- `list_lights`
- `control_lights`
- `mpbcp_snapshot`
- `node_state`
- `apply_mpbcp_to_nodes`
- `ingest_youtube`
- `ingest_eden_collection`
- `ingest_upload_paths`

Primary agent workflows:
- Create an upload ingest job from one or more local file paths, then poll its status by `jobId`
- Search the media library from the current resource snapshot
- Send a media item directly to one or more nodes
- Query fleet/node status using live probes or cached inventory connectivity
- Inspect and control smart lights

Environment:
- `CHIBA3_CONTROL_API_URL` (default: `http://127.0.0.1:8795`)

Run:

```bash
pnpm -C apps/control-mcp dev
```

With compose profile:

```bash
docker compose --profile mcp up --build control-mcp
```

The server speaks JSON-RPC over stdio with `Content-Length` framing and supports:

- `initialize`
- `tools/list`
- `tools/call`
