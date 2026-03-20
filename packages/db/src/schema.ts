import {
  pgTable,
  text,
  bigint,
  integer,
  jsonb,
  primaryKey,
  boolean,
  doublePrecision,
} from "drizzle-orm/pg-core";
import type {
  LaunchOptions,
  MediaResource,
  NodeRuntimeReportV1,
  ProfileResource,
} from "@chiba-cable3/contracts";

export const registries = pgTable("registries", {
  id: text("id").primaryKey(),
  sourcePath: text("source_path").notNull(),
  importedAt: bigint("imported_at", { mode: "number" }).notNull(),
});

export const registryNodes = pgTable(
  "registry_nodes",
  {
    registryId: text("registry_id")
      .notNull()
      .references(() => registries.id, { onDelete: "cascade" }),
    nodeId: text("node_id").notNull(),
    host: text("host"),
    ip: text("ip"),
    nodeName: text("node_name"),
    orientation: text("orientation"),
    displayRotate: integer("display_rotate"),
    guidePort: integer("guide_port"),
    nodePort: integer("node_port"),
    serverPort: integer("server_port"),
    apiKey: text("api_key"),
    importedAt: bigint("imported_at", { mode: "number" }).notNull(),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
    updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.registryId, table.nodeId] }),
  })
);

export const nodeConnectivity = pgTable(
  "node_connectivity",
  {
    registryId: text("registry_id").notNull(),
    nodeId: text("node_id").notNull(),
    namespace: text("namespace").notNull(),
    dnsOk: boolean("dns_ok").notNull(),
    pingOk: boolean("ping_ok").notNull(),
    sshOk: boolean("ssh_ok").notNull(),
    nodeApiOk: boolean("node_api_ok").notNull(),
    cableApiOk: boolean("cable_api_ok").notNull(),
    connectivityScore: integer("connectivity_score").notNull(),
    connectivityTotal: integer("connectivity_total").notNull(),
    status: text("status").notNull(),
    latencyMs: integer("latency_ms"),
    errorSummary: text("error_summary"),
    checkedAt: bigint("checked_at", { mode: "number" }).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.registryId, table.nodeId, table.namespace] }),
  })
);

export const edenSyncFeeds = pgTable(
  "eden_sync_feeds",
  {
    collectionId: text("collection_id").notNull(),
    dbName: text("db_name").notNull(),
    playlistId: text("playlist_id"),
    playlist: boolean("playlist").notNull(),
    apiKey: text("api_key"),
    enabled: boolean("enabled").notNull(),
    intervalSec: integer("interval_sec").notNull(),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
    updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.collectionId, table.dbName] }),
  })
);

export const desiredScreenState = pgTable(
  "desired_screen_state",
  {
    screenId: text("screen_id").notNull(),
    namespace: text("namespace").notNull(),
    revision: bigint("revision", { mode: "number" }).notNull(),
    controllerId: text("controller_id").notNull(),
    operationId: text("operation_id").notNull(),
    targetKind: text("target_kind").notNull(),
    targetId: text("target_id").notNull(),
    launchJson: jsonb("launch_json").$type<LaunchOptions>().notNull(),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.screenId, table.namespace] }),
  })
);

export const applyOperations = pgTable("apply_operations", {
  id: text("id").primaryKey(),
  namespace: text("namespace").notNull(),
  controllerId: text("controller_id").notNull(),
  requestJson: jsonb("request_json").notNull(),
  resultJson: jsonb("result_json"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});

export const nodeRuntimeReports = pgTable(
  "node_runtime_reports",
  {
    nodeId: text("node_id").notNull(),
    namespace: text("namespace").notNull(),
    desiredRevision: bigint("desired_revision", { mode: "number" }),
    activeRevision: bigint("active_revision", { mode: "number" }),
    phase: text("phase").notNull(),
    reportJson: jsonb("report_json").$type<NodeRuntimeReportV1>().notNull(),
    updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.nodeId, table.namespace] }),
  })
);

export const mediaResources = pgTable("media_resources", {
  id: text("id").primaryKey(),
  title: text("title"),
  artist: text("artist"),
  description: text("description"),
  sourceType: text("source_type").notNull(),
  sourceValue: text("source_value").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  thumbnailObjectKey: text("thumbnail_object_key"),
  webConfigJson: jsonb("web_config_json").$type<MediaResource["web"] | null>(),
  cache: boolean("cache").notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});

export const playlistResources = pgTable("playlist_resources", {
  id: text("id").primaryKey(),
  title: text("title"),
  artist: text("artist"),
  description: text("description"),
  infoTitleSource: text("info_title_source").$type<"media" | "playlist" | null>(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});

export const playlistItems = pgTable(
  "playlist_items",
  {
    playlistId: text("playlist_id")
      .notNull()
      .references(() => playlistResources.id, { onDelete: "cascade" }),
    itemIndex: integer("item_index").notNull(),
    mediaId: text("media_id"),
    childPlaylistId: text("child_playlist_id"),
    durationSec: doublePrecision("duration_sec"),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
    updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.playlistId, table.itemIndex] }),
  })
);

export const blockResources = pgTable("block_resources", {
  id: text("id").primaryKey(),
  title: text("title"),
  mode: text("mode"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});

export const blockItems = pgTable(
  "block_items",
  {
    blockId: text("block_id")
      .notNull()
      .references(() => blockResources.id, { onDelete: "cascade" }),
    itemIndex: integer("item_index").notNull(),
    mediaId: text("media_id"),
    playlistId: text("playlist_id"),
    durationSec: doublePrecision("duration_sec"),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
    updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.blockId, table.itemIndex] }),
  })
);

export const channelResources = pgTable("channel_resources", {
  id: text("id").primaryKey(),
  numberText: text("number_text"),
  name: text("name"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});

export const channelBlocks = pgTable(
  "channel_blocks",
  {
    channelId: text("channel_id")
      .notNull()
      .references(() => channelResources.id, { onDelete: "cascade" }),
    blockIndex: integer("block_index").notNull(),
    blockId: text("block_id").notNull(),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
    updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.channelId, table.blockIndex] }),
  })
);

type ProfileDefaults = NonNullable<ProfileResource["defaults"]> & {
  defaultTarget?: ProfileResource["defaultTarget"];
};

export const profileResources = pgTable("profile_resources", {
  id: text("id").primaryKey(),
  title: text("title"),
  defaultsJson: jsonb("defaults_json").$type<ProfileDefaults>().notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});

export const profileNodeAssignments = pgTable(
  "profile_node_assignments",
  {
    profileId: text("profile_id")
      .notNull()
      .references(() => profileResources.id, { onDelete: "cascade" }),
    nodeId: text("node_id").notNull(),
    targetKind: text("target_kind").notNull(),
    targetId: text("target_id").notNull(),
    launchJson: jsonb("launch_json").$type<LaunchOptions>().notNull(),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
    updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.profileId, table.nodeId] }),
  })
);

export const lights = pgTable("lights", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  ipAddress: text("ip_address").notNull(),
  port: integer("port").notNull(),
  deviceId: text("device_id").unique(),
  sku: text("sku"),
  deviceType: text("device_type"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});

export const lightState = pgTable("light_state", {
  lightId: text("light_id")
    .primaryKey()
    .references(() => lights.id, { onDelete: "cascade" }),
  power: boolean("power").notNull(),
  hue: integer("hue").notNull(),
  saturation: integer("saturation").notNull(),
  brightness: integer("brightness").notNull(),
  kelvin: integer("kelvin"),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});

export const lightPresets = pgTable("light_presets", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  isPredefined: boolean("is_predefined").notNull(),
  settings: jsonb("settings").$type<unknown[]>().notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});

export const lightSchedules = pgTable("light_schedules", {
  lightId: text("light_id")
    .primaryKey()
    .references(() => lights.id, { onDelete: "cascade" }),
  enabled: boolean("enabled").notNull(),
  breakpoints: jsonb("breakpoints").$type<unknown[]>().notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});

export const plugs = pgTable("plugs", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  ipAddress: text("ip_address").notNull(),
  host: text("host").notNull(),
  deviceId: text("device_id").unique(),
  model: text("model"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});

export const plugState = pgTable("plug_state", {
  plugId: text("plug_id")
    .primaryKey()
    .references(() => plugs.id, { onDelete: "cascade" }),
  power: boolean("power").notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});

export const plugSchedules = pgTable("plug_schedules", {
  plugId: text("plug_id")
    .primaryKey()
    .references(() => plugs.id, { onDelete: "cascade" }),
  enabled: boolean("enabled").notNull(),
  breakpoints: jsonb("breakpoints").$type<unknown[]>().notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});
