import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import type { ResourceImportPayload } from "@chiba-cable3/contracts";
import type { EdenSyncFeedConfig } from "../src/ingest/eden-sync.ts";
import { EdenSyncScheduler } from "../src/ingest/eden-sync.ts";
import { ingestEdenCollection } from "../src/ingest/runtime.ts";

test("eden sync scheduler is idempotent and picks up new collection items", async () => {
  const originalFetch = globalThis.fetch;
  const originalShareRoot = process.env.SHARE_ROOT;
  process.env.SHARE_ROOT = path.join(os.tmpdir(), `c3-eden-sync-${Date.now()}`);

  const creationIds: string[] = ["cr-1", "cr-2"];
  const mediaById = new Map<string, ResourceImportPayload["media"][number]>();
  const playlistById = new Map<string, ResourceImportPayload["playlists"][number]>();

  const persistResources = async (args: {
    payload: ResourceImportPayload;
  }): Promise<{
    media: number;
    playlists: number;
    blocks: number;
    channels: number;
    profiles: number;
  }> => {
    for (const media of args.payload.media) mediaById.set(media.id, media);
    for (const playlist of args.payload.playlists) {
      playlistById.set(playlist.id, {
        ...playlist,
        items: [...playlist.items].sort((a, b) => a.index - b.index),
      });
    }
    return {
      media: args.payload.media.length,
      playlists: args.payload.playlists.length,
      blocks: args.payload.blocks.length,
      channels: args.payload.channels.length,
      profiles: args.payload.profiles.length,
    };
  };

  globalThis.fetch = async (input) => {
    const url = new URL(typeof input === "string" ? input : input.url);
    if (url.hostname === "api.eden.art" && url.pathname === "/v2/collections/col-abc") {
      return Response.json({ name: "Test Collection" });
    }
    if (
      url.hostname === "api.eden.art" &&
      url.pathname === "/v2/collections/col-abc/creations"
    ) {
      return Response.json({
        docs: creationIds.map((id) => ({ _id: id })),
        hasNextPage: false,
      });
    }
    if (url.hostname === "api.eden.art" && url.pathname.startsWith("/v2/creations/")) {
      const creationId = url.pathname.split("/").pop() || "";
      return Response.json({
        creation: {
          _id: creationId,
          url: `https://cdn.example/${creationId}.jpg`,
          title: `Creation ${creationId}`,
          user: { username: "eden-user" },
        },
      });
    }
    if (url.hostname === "cdn.example") {
      return new Response(Buffer.from(`bytes-${url.pathname}`), {
        status: 200,
        headers: { "content-type": "image/jpeg" },
      });
    }
    return new Response("not_found", { status: 404 });
  };

  let nowMs = Date.now();
  const scheduler = new EdenSyncScheduler({
    db: {} as never,
    now: () => nowMs,
    ingestFn: (args) =>
      ingestEdenCollection({
        ...args,
        persistResources: ({ payload }) => persistResources({ payload }),
      }),
  });
  scheduler.upsertFeed({
    collectionId: "col-abc",
    dbName: "PROD",
    playlist: true,
    intervalSec: 3600,
    apiKey: "test-key",
  });

  try {
    await scheduler.tick();
    assert.equal(mediaById.size, 2);
    const playlistFirst = playlistById.get("pl-eden-col-abc");
    assert.ok(playlistFirst);
    assert.equal(playlistFirst.items.length, 2);

    creationIds.push("cr-3");
    nowMs += 30 * 60 * 1000;
    await scheduler.tick();
    assert.equal(mediaById.size, 2);

    nowMs += 31 * 60 * 1000;
    await scheduler.tick();
    assert.equal(mediaById.size, 3);
    const playlistSecond = playlistById.get("pl-eden-col-abc");
    assert.ok(playlistSecond);
    assert.equal(playlistSecond.items.length, 3);

    const feed = scheduler.listFeeds()[0];
    assert.ok(feed);
    assert.equal(feed.runCount, 2);
    assert.equal(feed.lastStatus, "succeeded");
  } finally {
    globalThis.fetch = originalFetch;
    if (typeof originalShareRoot === "string") process.env.SHARE_ROOT = originalShareRoot;
    else delete process.env.SHARE_ROOT;
  }
});

test("eden sync scheduler restores feeds from persistent store", async () => {
  const persisted = new Map<string, EdenSyncFeedConfig>();
  const store = {
    listFeeds: async () =>
      Array.from(persisted.values()).map((feed) => ({
        ...feed,
      })),
    upsertFeed: async (feed: EdenSyncFeedConfig) => {
      const dbName = feed.dbName ?? "PROD";
      const key = `${dbName}:${feed.collectionId.toLowerCase()}`;
      persisted.set(key, {
        ...feed,
        dbName,
      });
    },
  };

  const schedulerA = new EdenSyncScheduler({
    db: {} as never,
    store,
    ingestFn: async () => ({ status: 200, payload: { ok: true } }),
  });
  await schedulerA.registerFeed({
    collectionId: "col-persist",
    dbName: "PROD",
    playlist: true,
    intervalSec: 3600,
  });
  assert.equal(persisted.size, 1);

  const schedulerB = new EdenSyncScheduler({
    db: {} as never,
    store,
    ingestFn: async () => ({ status: 200, payload: { ok: true } }),
  });
  const restoredCount = await schedulerB.hydrate();
  assert.equal(restoredCount, 1);
  const restored = schedulerB.listFeeds();
  assert.equal(restored.length, 1);
  assert.equal(restored[0]?.id, "PROD:col-persist");
  assert.equal(restored[0]?.collectionId, "col-persist");
});
