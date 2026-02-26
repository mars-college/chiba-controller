import { and, asc, eq } from "drizzle-orm";
import type { Cable3Db } from "./db.js";
import { schema } from "./db.js";

export type EdenSyncDbName = "PROD" | "STAGE";

export type EdenSyncFeedRecord = {
  collectionId: string;
  dbName: EdenSyncDbName;
  playlistId?: string;
  playlist: boolean;
  apiKey?: string;
  enabled: boolean;
  intervalSec: number;
  createdAt: number;
  updatedAt: number;
};

type EdenSyncFeedInput = {
  collectionId: string;
  dbName?: EdenSyncDbName;
  playlistId?: string;
  playlist?: boolean;
  apiKey?: string;
  enabled?: boolean;
  intervalSec?: number;
};

const DEFAULT_INTERVAL_SEC = 3600;

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeDbName(value: EdenSyncFeedInput["dbName"]): EdenSyncDbName {
  return value === "STAGE" ? "STAGE" : "PROD";
}

function normalizeIntervalSec(value: number | undefined): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_INTERVAL_SEC;
  const normalized = Math.floor(parsed);
  return normalized > 0 ? normalized : DEFAULT_INTERVAL_SEC;
}

function toFeedRecord(row: typeof schema.edenSyncFeeds.$inferSelect): EdenSyncFeedRecord {
  return {
    collectionId: row.collectionId,
    dbName: normalizeDbName(row.dbName as EdenSyncDbName),
    ...(row.playlistId ? { playlistId: row.playlistId } : {}),
    playlist: row.playlist,
    ...(row.apiKey ? { apiKey: row.apiKey } : {}),
    enabled: row.enabled,
    intervalSec: row.intervalSec,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listEdenSyncFeeds(args: {
  db: Cable3Db;
}): Promise<EdenSyncFeedRecord[]> {
  const rows = await args.db
    .select()
    .from(schema.edenSyncFeeds)
    .orderBy(asc(schema.edenSyncFeeds.dbName), asc(schema.edenSyncFeeds.collectionId));
  return rows.map(toFeedRecord);
}

export async function upsertEdenSyncFeed(args: {
  db: Cable3Db;
  feed: EdenSyncFeedInput;
}): Promise<EdenSyncFeedRecord> {
  const collectionId = readString(args.feed.collectionId);
  if (!collectionId) throw new Error("eden_sync_collection_id_required");
  const dbName = normalizeDbName(args.feed.dbName);
  const playlistId = readString(args.feed.playlistId);
  const apiKey = readString(args.feed.apiKey);
  const now = Date.now();

  await args.db
    .insert(schema.edenSyncFeeds)
    .values({
      collectionId,
      dbName,
      playlistId: playlistId || null,
      playlist: args.feed.playlist !== false,
      apiKey: apiKey || null,
      enabled: args.feed.enabled !== false,
      intervalSec: normalizeIntervalSec(args.feed.intervalSec),
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [schema.edenSyncFeeds.collectionId, schema.edenSyncFeeds.dbName],
      set: {
        playlistId: playlistId || null,
        playlist: args.feed.playlist !== false,
        apiKey: apiKey || null,
        enabled: args.feed.enabled !== false,
        intervalSec: normalizeIntervalSec(args.feed.intervalSec),
        updatedAt: now,
      },
    });

  const rows = await args.db
    .select()
    .from(schema.edenSyncFeeds)
    .where(
      and(
        eq(schema.edenSyncFeeds.collectionId, collectionId),
        eq(schema.edenSyncFeeds.dbName, dbName)
      )
    );
  const row = rows[0];
  if (!row) throw new Error("eden_sync_feed_upsert_failed");
  return toFeedRecord(row);
}
