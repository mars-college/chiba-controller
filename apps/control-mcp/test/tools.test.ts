import assert from "node:assert/strict";
import { test } from "node:test";
import { TOOLS, handleToolCall } from "../src/tools.ts";

test("exposes required control tools", () => {
  const names = TOOLS.map((row) => row.name);
  assert.equal(names.includes("create_upload_request"), true);
  assert.equal(names.includes("get_upload_status"), true);
  assert.equal(names.includes("send_media_to_nodes"), true);
  assert.equal(names.includes("search_media_library"), true);
  assert.equal(names.includes("query_nodes"), true);
  assert.equal(names.includes("list_lights"), true);
  assert.equal(names.includes("control_lights"), true);
  assert.equal(names.includes("list_light_presets"), true);
  assert.equal(names.includes("apply_light_preset"), true);
  assert.equal(names.includes("mpbcp_snapshot"), true);
  assert.equal(names.includes("node_state"), true);
  assert.equal(names.includes("apply_mpbcp_to_nodes"), true);
  assert.equal(names.includes("ingest_youtube"), true);
  assert.equal(names.includes("ingest_eden_collection"), true);
  assert.equal(names.includes("ingest_upload_paths"), true);
});

test("returns typed tool error for unknown tools", async () => {
  const result = await handleToolCall({
    name: "does_not_exist",
    input: {},
  });
  assert.equal(result.isError, true);
  assert.equal(result.content[0]?.text.includes("unknown_tool"), true);
});

test("rejects light control requests without a setting payload", async () => {
  const result = await handleToolCall({
    name: "control_lights",
    input: { lightIds: ["porch"] },
  });
  assert.equal(result.isError, true);
  assert.equal(
    result.content[0]?.text.includes("at_least_one_setting_required"),
    true
  );
});

test("rejects preset apply requests without a selector", async () => {
  const result = await handleToolCall({
    name: "apply_light_preset",
    input: {},
  });
  assert.equal(result.isError, true);
  assert.equal(
    result.content[0]?.text.includes("presetId_or_presetName_required"),
    true
  );
});
