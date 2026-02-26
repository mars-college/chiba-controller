import type { Cable3Db } from "@chiba-cable3/db";
import { ingestEdenCollection } from "./runtime.js";

export type EdenSyncDbName = "PROD" | "STAGE";

export const DEFAULT_EDEN_SYNC_INTERVAL_SEC = 3600;
export const DEFAULT_EDEN_SYNC_POLL_MS = 30_000;

export type EdenSyncFeedConfig = {
  collectionId: string;
  dbName?: EdenSyncDbName;
  playlistId?: string;
  playlist?: boolean;
  apiKey?: string;
  enabled?: boolean;
  intervalSec?: number;
};

export type EdenSyncFeedState = {
  id: string;
  collectionId: string;
  dbName: EdenSyncDbName;
  playlistId?: string;
  playlist: boolean;
  apiKey?: string;
  enabled: boolean;
  intervalSec: number;
  running: boolean;
  runCount: number;
  lastRunAt: number | null;
  nextRunAt: number;
  lastStatus: "never" | "succeeded" | "failed";
  lastResultStatus: number | null;
  lastError: string | null;
};

export type EdenSyncFeedStore = {
  listFeeds: () => Promise<EdenSyncFeedConfig[]>;
  upsertFeed: (feed: EdenSyncFeedConfig) => Promise<void>;
};

type EdenSyncIngestFn = (args: {
  db: Cable3Db;
  input: string;
  dbName?: EdenSyncDbName;
  playlistId?: string;
  playlist?: boolean;
  apiKey?: string;
}) => Promise<{
  status: number;
  payload: Record<string, unknown>;
}>;

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toIntervalSec(value: number | undefined): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_EDEN_SYNC_INTERVAL_SEC;
  const normalized = Math.floor(parsed);
  return normalized > 0 ? normalized : DEFAULT_EDEN_SYNC_INTERVAL_SEC;
}

function buildFeedId(args: { collectionId: string; dbName: EdenSyncDbName }): string {
  return `${args.dbName}:${args.collectionId.toLowerCase()}`;
}

export class EdenSyncScheduler {
  private readonly db: Cable3Db;
  private readonly ingestFn: EdenSyncIngestFn;
  private readonly store: EdenSyncFeedStore | null;
  private readonly now: () => number;
  private readonly pollMs: number;
  private readonly feeds = new Map<string, EdenSyncFeedState>();
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(args: {
    db: Cable3Db;
    feeds?: EdenSyncFeedConfig[];
    pollMs?: number;
    ingestFn?: EdenSyncIngestFn;
    store?: EdenSyncFeedStore;
    now?: () => number;
  }) {
    this.db = args.db;
    this.ingestFn = args.ingestFn ?? ingestEdenCollection;
    this.store = args.store ?? null;
    this.now = args.now ?? (() => Date.now());
    this.pollMs = args.pollMs ?? DEFAULT_EDEN_SYNC_POLL_MS;
    for (const feed of args.feeds ?? []) this.upsertFeed(feed);
  }

  async hydrate(): Promise<number> {
    if (!this.store) return 0;
    const feeds = await this.store.listFeeds();
    for (const feed of feeds) this.upsertFeed(feed);
    return feeds.length;
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.tick();
    }, this.pollMs);
    void this.tick();
  }

  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  upsertFeed(config: EdenSyncFeedConfig): EdenSyncFeedState {
    const collectionId = readString(config.collectionId);
    if (!collectionId) {
      throw new Error("eden_sync_collection_id_required");
    }
    const dbName = config.dbName ?? "PROD";
    const id = buildFeedId({ collectionId, dbName });
    const now = this.now();
    const current = this.feeds.get(id);
    if (!current) {
      const created: EdenSyncFeedState = {
        id,
        collectionId,
        dbName,
        ...(config.playlistId ? { playlistId: config.playlistId.trim() } : {}),
        playlist: config.playlist !== false,
        ...(config.apiKey ? { apiKey: config.apiKey.trim() } : {}),
        enabled: config.enabled !== false,
        intervalSec: toIntervalSec(config.intervalSec),
        running: false,
        runCount: 0,
        lastRunAt: null,
        nextRunAt: now,
        lastStatus: "never",
        lastResultStatus: null,
        lastError: null,
      };
      this.feeds.set(id, created);
      return { ...created };
    }
    current.dbName = dbName;
    if (typeof config.playlist === "boolean") current.playlist = config.playlist;
    if (typeof config.enabled === "boolean") current.enabled = config.enabled;
    if (typeof config.intervalSec === "number") current.intervalSec = toIntervalSec(config.intervalSec);
    if (typeof config.apiKey === "string") {
      const apiKey = config.apiKey.trim();
      if (apiKey) current.apiKey = apiKey;
      else delete current.apiKey;
    }
    if (typeof config.playlistId === "string") {
      const playlistId = config.playlistId.trim();
      if (playlistId) current.playlistId = playlistId;
      else delete current.playlistId;
    }
    return { ...current };
  }

  async registerFeed(config: EdenSyncFeedConfig): Promise<EdenSyncFeedState> {
    const state = this.upsertFeed(config);
    if (this.store) {
      await this.store.upsertFeed({
        collectionId: state.collectionId,
        dbName: state.dbName,
        ...(state.playlistId ? { playlistId: state.playlistId } : {}),
        playlist: state.playlist,
        ...(state.apiKey ? { apiKey: state.apiKey } : {}),
        enabled: state.enabled,
        intervalSec: state.intervalSec,
      });
    }
    return state;
  }

  listFeeds(): EdenSyncFeedState[] {
    return Array.from(this.feeds.values())
      .map((feed) => ({ ...feed }))
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  async tick(): Promise<void> {
    const now = this.now();
    for (const feed of this.feeds.values()) {
      if (!feed.enabled || feed.running) continue;
      if (feed.nextRunAt > now) continue;
      await this.runFeed(feed);
    }
  }

  private async runFeed(feed: EdenSyncFeedState): Promise<void> {
    feed.running = true;
    const startedAt = this.now();
    feed.lastError = null;
    try {
      const result = await this.ingestFn({
        db: this.db,
        input: feed.collectionId,
        ...(feed.dbName ? { dbName: feed.dbName } : {}),
        ...(feed.playlistId ? { playlistId: feed.playlistId } : {}),
        ...(typeof feed.playlist === "boolean" ? { playlist: feed.playlist } : {}),
        ...(feed.apiKey ? { apiKey: feed.apiKey } : {}),
      });
      const payload = result.payload as { ok?: unknown; error?: unknown };
      const isSuccess =
        result.status >= 200 &&
        result.status < 300 &&
        !(typeof payload?.ok === "boolean" && payload.ok === false);
      feed.lastStatus = isSuccess ? "succeeded" : "failed";
      feed.lastResultStatus = result.status;
      if (!isSuccess) {
        const err = readString(payload?.error) || `status_${result.status}`;
        feed.lastError = err;
      }
    } catch (error) {
      feed.lastStatus = "failed";
      feed.lastResultStatus = null;
      feed.lastError = error instanceof Error ? error.message : String(error);
    } finally {
      feed.running = false;
      feed.runCount += 1;
      feed.lastRunAt = startedAt;
      feed.nextRunAt = startedAt + feed.intervalSec * 1000;
    }
  }
}
