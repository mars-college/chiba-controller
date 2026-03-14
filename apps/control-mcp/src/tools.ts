import fs from "node:fs/promises";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

export type McpTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

type LaunchInput = {
  mode?: "guide" | "gallery";
  lock?: boolean;
  qr?: boolean;
  nosplash?: boolean;
  hudMode?: "always" | "start" | "never";
  hudShowSec?: number;
  theme?: string;
  displayRotate?: 0 | 90 | 180 | 270;
};

type NodeStateInput = {
  screenId: string;
  namespace?: string;
};

type ApplyInput = {
  targetKind: "media" | "playlist" | "block" | "channel" | "profile";
  targetId: string;
  nodeIds: string[];
  namespace?: string;
  registryId?: string;
  controllerId?: string;
  launch?: LaunchInput;
};

type SendMediaToNodesInput = {
  mediaId: string;
  nodeIds: string[];
  namespace?: string;
  registryId?: string;
  controllerId?: string;
  launch?: LaunchInput;
};

type IngestYoutubeInput = {
  url: string;
  mediaId?: string;
  title?: string;
  artist?: string;
  cache?: boolean;
  wait?: boolean;
  timeoutMs?: number;
};

type IngestEdenInput = {
  input: string;
  db?: "PROD" | "STAGE";
  playlistId?: string;
  apiKey?: string;
  wait?: boolean;
  timeoutMs?: number;
};

type UploadRequestInput = {
  paths: string[];
  artist?: string;
  description?: string;
  playlist?: boolean;
  playlistTitle?: string;
  fileTitles?: string[];
  fileArtists?: string[];
  fileDescriptions?: string[];
  wait?: boolean;
  timeoutMs?: number;
};

type UploadStatusInput = {
  jobId: string;
};

type SearchMediaInput = {
  query?: string;
  sourceType?: "path" | "url";
  cache?: boolean;
  limit?: number;
};

type QueryNodesInput = {
  query?: string;
  nodeIds?: string[];
  status?: "online" | "degraded" | "offline" | "progressing";
  namespace?: string;
  registryId?: string;
  live?: boolean;
  includeRuntime?: boolean;
  limit?: number;
  timeoutMs?: number;
};

type ListLightsInput = {
  query?: string;
  reachable?: boolean;
  power?: boolean;
  limit?: number;
};

type ControlLightsInput = {
  lightIds?: string[];
  lightNames?: string[];
  query?: string;
  power?: boolean;
  hue?: number;
  saturation?: number;
  brightness?: number;
  kelvin?: number;
};

type JsonRecord = Record<string, unknown>;

const TARGET_KINDS = ["media", "playlist", "block", "channel", "profile"] as const;
const LAUNCH_MODES = ["guide", "gallery"] as const;
const HUD_MODES = ["always", "start", "never"] as const;
const DISPLAY_ROTATES = [0, 90, 180, 270] as const;
const NODE_STATUSES = ["online", "degraded", "offline", "progressing"] as const;

function controlApiBase(): string {
  return process.env.CHIBA3_CONTROL_API_URL?.trim() || "http://127.0.0.1:8795";
}

async function fetchJson(args: {
  path: string;
  method?: string;
  body?: unknown;
}): Promise<unknown> {
  const url = new URL(args.path, controlApiBase());
  const init: RequestInit = {
    method: args.method ?? "GET",
    ...(args.body ? { headers: { "content-type": "application/json" } } : {}),
    ...(args.body ? { body: JSON.stringify(args.body) } : {}),
  };
  const res = await fetch(url, init);
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`http_${res.status}:${JSON.stringify(data)}`);
  }
  return data;
}

async function fetchEnvelope(args: {
  path: string;
  method?: string;
  body?: unknown;
}): Promise<unknown> {
  const data = (await fetchJson(args)) as JsonRecord | null;
  if (data && typeof data === "object" && "data" in data) {
    return data.data;
  }
  return data;
}

function ensureObject(input: unknown, context: string): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error(`invalid_args:${context}:expected_object`);
  }
  return input as Record<string, unknown>;
}

function readRequiredString(
  obj: Record<string, unknown>,
  key: string,
  context: string
): string {
  const value = obj[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`invalid_args:${context}:${key}`);
  }
  return value.trim();
}

function readOptionalString(
  obj: Record<string, unknown>,
  key: string,
  context: string
): string | undefined {
  if (!(key in obj) || obj[key] == null) return undefined;
  const value = obj[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`invalid_args:${context}:${key}`);
  }
  return value.trim();
}

function readOptionalBoolean(
  obj: Record<string, unknown>,
  key: string,
  context: string
): boolean | undefined {
  if (!(key in obj) || obj[key] == null) return undefined;
  const value = obj[key];
  if (typeof value !== "boolean") {
    throw new Error(`invalid_args:${context}:${key}`);
  }
  return value;
}

function readOptionalPositiveInt(
  obj: Record<string, unknown>,
  key: string,
  context: string,
  max = Number.MAX_SAFE_INTEGER
): number | undefined {
  if (!(key in obj) || obj[key] == null) return undefined;
  const value = obj[key];
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0 || value > max) {
    throw new Error(`invalid_args:${context}:${key}`);
  }
  return value;
}

function readOptionalNumberInRange(
  obj: Record<string, unknown>,
  key: string,
  context: string,
  min: number,
  max: number
): number | undefined {
  if (!(key in obj) || obj[key] == null) return undefined;
  const value = obj[key];
  if (typeof value !== "number" || Number.isNaN(value) || value < min || value > max) {
    throw new Error(`invalid_args:${context}:${key}`);
  }
  return value;
}

function readEnum<T extends string>(
  obj: Record<string, unknown>,
  key: string,
  values: readonly T[],
  context: string
): T {
  const raw = readRequiredString(obj, key, context);
  if (!values.includes(raw as T)) {
    throw new Error(`invalid_args:${context}:${key}`);
  }
  return raw as T;
}

function readOptionalEnum<T extends string>(
  obj: Record<string, unknown>,
  key: string,
  values: readonly T[],
  context: string
): T | undefined {
  const value = readOptionalString(obj, key, context);
  if (value == null) return undefined;
  if (!values.includes(value as T)) {
    throw new Error(`invalid_args:${context}:${key}`);
  }
  return value as T;
}

function readStringArray(
  obj: Record<string, unknown>,
  key: string,
  context: string
): string[] {
  const value = obj[key];
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`invalid_args:${context}:${key}`);
  }
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || item.trim().length === 0) {
      throw new Error(`invalid_args:${context}:${key}`);
    }
    out.push(item.trim());
  }
  return out;
}

function readOptionalStringArray(
  obj: Record<string, unknown>,
  key: string,
  context: string
): string[] | undefined {
  if (!(key in obj) || obj[key] == null) return undefined;
  const value = obj[key];
  if (!Array.isArray(value)) {
    throw new Error(`invalid_args:${context}:${key}`);
  }
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") {
      throw new Error(`invalid_args:${context}:${key}`);
    }
    out.push(item);
  }
  return out;
}

function parseLaunch(
  obj: Record<string, unknown>,
  context: string
): LaunchInput | undefined {
  const launchRaw = obj.launch;
  if (launchRaw == null) return undefined;
  const launchObj = ensureObject(launchRaw, `${context}.launch`);
  const mode = readOptionalEnum(launchObj, "mode", LAUNCH_MODES, `${context}.launch`);
  const lock = readOptionalBoolean(launchObj, "lock", `${context}.launch`);
  const qr = readOptionalBoolean(launchObj, "qr", `${context}.launch`);
  const nosplash = readOptionalBoolean(launchObj, "nosplash", `${context}.launch`);
  const hudMode = readOptionalEnum(launchObj, "hudMode", HUD_MODES, `${context}.launch`);
  const hudShowSec = readOptionalPositiveInt(
    launchObj,
    "hudShowSec",
    `${context}.launch`
  );
  const theme = readOptionalString(launchObj, "theme", `${context}.launch`);
  const displayRotateRaw = launchObj.displayRotate;
  let displayRotate: 0 | 90 | 180 | 270 | undefined;
  if (displayRotateRaw != null) {
    if (
      typeof displayRotateRaw !== "number" ||
      !DISPLAY_ROTATES.includes(displayRotateRaw as 0 | 90 | 180 | 270)
    ) {
      throw new Error(`invalid_args:${context}:launch.displayRotate`);
    }
    displayRotate = displayRotateRaw as 0 | 90 | 180 | 270;
  }
  const launch: LaunchInput = {};
  if (mode !== undefined) launch.mode = mode;
  if (lock !== undefined) launch.lock = lock;
  if (qr !== undefined) launch.qr = qr;
  if (nosplash !== undefined) launch.nosplash = nosplash;
  if (hudMode !== undefined) launch.hudMode = hudMode;
  if (hudShowSec !== undefined) launch.hudShowSec = hudShowSec;
  if (theme !== undefined) launch.theme = theme;
  if (displayRotate !== undefined) launch.displayRotate = displayRotate;
  return Object.keys(launch).length > 0 ? launch : {};
}

function parseNodeStateInput(input: unknown): NodeStateInput {
  const obj = ensureObject(input, "node_state");
  const out: NodeStateInput = {
    screenId: readRequiredString(obj, "screenId", "node_state"),
  };
  const namespace = readOptionalString(obj, "namespace", "node_state");
  if (namespace !== undefined) out.namespace = namespace;
  return out;
}

function parseApplyInput(input: unknown): ApplyInput {
  const obj = ensureObject(input, "apply_mpbcp_to_nodes");
  const out: ApplyInput = {
    targetKind: readEnum(obj, "targetKind", TARGET_KINDS, "apply_mpbcp_to_nodes"),
    targetId: readRequiredString(obj, "targetId", "apply_mpbcp_to_nodes"),
    nodeIds: readStringArray(obj, "nodeIds", "apply_mpbcp_to_nodes"),
  };
  const namespace = readOptionalString(obj, "namespace", "apply_mpbcp_to_nodes");
  const registryId = readOptionalString(obj, "registryId", "apply_mpbcp_to_nodes");
  const controllerId = readOptionalString(obj, "controllerId", "apply_mpbcp_to_nodes");
  const launch = parseLaunch(obj, "apply_mpbcp_to_nodes");
  if (namespace !== undefined) out.namespace = namespace;
  if (registryId !== undefined) out.registryId = registryId;
  if (controllerId !== undefined) out.controllerId = controllerId;
  if (launch !== undefined) out.launch = launch;
  return out;
}

function parseSendMediaToNodesInput(input: unknown): SendMediaToNodesInput {
  const obj = ensureObject(input, "send_media_to_nodes");
  const out: SendMediaToNodesInput = {
    mediaId: readRequiredString(obj, "mediaId", "send_media_to_nodes"),
    nodeIds: readStringArray(obj, "nodeIds", "send_media_to_nodes"),
  };
  const namespace = readOptionalString(obj, "namespace", "send_media_to_nodes");
  const registryId = readOptionalString(obj, "registryId", "send_media_to_nodes");
  const controllerId = readOptionalString(obj, "controllerId", "send_media_to_nodes");
  const launch = parseLaunch(obj, "send_media_to_nodes");
  if (namespace !== undefined) out.namespace = namespace;
  if (registryId !== undefined) out.registryId = registryId;
  if (controllerId !== undefined) out.controllerId = controllerId;
  if (launch !== undefined) out.launch = launch;
  return out;
}

function parseIngestYoutubeInput(input: unknown): IngestYoutubeInput {
  const obj = ensureObject(input, "ingest_youtube");
  const url = readRequiredString(obj, "url", "ingest_youtube");
  try {
    const parsed = new URL(url);
    if (!/^https?:$/.test(parsed.protocol)) throw new Error("invalid");
  } catch {
    throw new Error("invalid_args:ingest_youtube:url");
  }
  const timeoutMs = readOptionalPositiveInt(obj, "timeoutMs", "ingest_youtube", 600_000);
  const mediaId = readOptionalString(obj, "mediaId", "ingest_youtube");
  const title = readOptionalString(obj, "title", "ingest_youtube");
  const artist = readOptionalString(obj, "artist", "ingest_youtube");
  const cache = readOptionalBoolean(obj, "cache", "ingest_youtube");
  const wait = readOptionalBoolean(obj, "wait", "ingest_youtube");
  const out: IngestYoutubeInput = { url };
  if (mediaId !== undefined) out.mediaId = mediaId;
  if (title !== undefined) out.title = title;
  if (artist !== undefined) out.artist = artist;
  if (cache !== undefined) out.cache = cache;
  if (wait !== undefined) out.wait = wait;
  if (timeoutMs !== undefined) out.timeoutMs = timeoutMs;
  return out;
}

function parseIngestEdenInput(input: unknown): IngestEdenInput {
  const obj = ensureObject(input, "ingest_eden_collection");
  const timeoutMs = readOptionalPositiveInt(
    obj,
    "timeoutMs",
    "ingest_eden_collection",
    600_000
  );
  const db = readOptionalEnum(obj, "db", ["PROD", "STAGE"], "ingest_eden_collection");
  const playlistId = readOptionalString(obj, "playlistId", "ingest_eden_collection");
  const apiKey = readOptionalString(obj, "apiKey", "ingest_eden_collection");
  const wait = readOptionalBoolean(obj, "wait", "ingest_eden_collection");
  const out: IngestEdenInput = {
    input: readRequiredString(obj, "input", "ingest_eden_collection"),
  };
  if (db !== undefined) out.db = db;
  if (playlistId !== undefined) out.playlistId = playlistId;
  if (apiKey !== undefined) out.apiKey = apiKey;
  if (wait !== undefined) out.wait = wait;
  if (timeoutMs !== undefined) out.timeoutMs = timeoutMs;
  return out;
}

function parseUploadRequestInput(
  input: unknown,
  context: "create_upload_request" | "ingest_upload_paths"
): UploadRequestInput {
  const obj = ensureObject(input, context);
  const timeoutMs = readOptionalPositiveInt(obj, "timeoutMs", context, 600_000);
  const wait = readOptionalBoolean(obj, "wait", context);
  const artist = readOptionalString(obj, "artist", context);
  const description = readOptionalString(obj, "description", context);
  const playlist = readOptionalBoolean(obj, "playlist", context);
  const playlistTitle = readOptionalString(obj, "playlistTitle", context);
  const fileTitles = readOptionalStringArray(obj, "fileTitles", context);
  const fileArtists = readOptionalStringArray(obj, "fileArtists", context);
  const fileDescriptions = readOptionalStringArray(obj, "fileDescriptions", context);

  const out: UploadRequestInput = {
    paths: readStringArray(obj, "paths", context),
  };
  if (artist !== undefined) out.artist = artist;
  if (description !== undefined) out.description = description;
  if (playlist !== undefined) out.playlist = playlist;
  if (playlistTitle !== undefined) out.playlistTitle = playlistTitle;
  if (fileTitles !== undefined) out.fileTitles = fileTitles;
  if (fileArtists !== undefined) out.fileArtists = fileArtists;
  if (fileDescriptions !== undefined) out.fileDescriptions = fileDescriptions;
  if (wait !== undefined) out.wait = wait;
  if (timeoutMs !== undefined) out.timeoutMs = timeoutMs;
  return out;
}

function parseUploadStatusInput(input: unknown): UploadStatusInput {
  const obj = ensureObject(input, "get_upload_status");
  return {
    jobId: readRequiredString(obj, "jobId", "get_upload_status"),
  };
}

function parseSearchMediaInput(input: unknown): SearchMediaInput {
  const obj = ensureObject(input, "search_media_library");
  const query = readOptionalString(obj, "query", "search_media_library");
  const sourceType = readOptionalEnum(
    obj,
    "sourceType",
    ["path", "url"],
    "search_media_library"
  );
  const cache = readOptionalBoolean(obj, "cache", "search_media_library");
  const limit = readOptionalPositiveInt(obj, "limit", "search_media_library", 200);
  const out: SearchMediaInput = {};
  if (query !== undefined) out.query = query;
  if (sourceType !== undefined) out.sourceType = sourceType;
  if (cache !== undefined) out.cache = cache;
  if (limit !== undefined) out.limit = limit;
  return out;
}

function parseQueryNodesInput(input: unknown): QueryNodesInput {
  const obj = ensureObject(input, "query_nodes");
  const query = readOptionalString(obj, "query", "query_nodes");
  const nodeIds = readOptionalStringArray(obj, "nodeIds", "query_nodes");
  const status = readOptionalEnum(obj, "status", NODE_STATUSES, "query_nodes");
  const namespace = readOptionalString(obj, "namespace", "query_nodes");
  const registryId = readOptionalString(obj, "registryId", "query_nodes");
  const live = readOptionalBoolean(obj, "live", "query_nodes");
  const includeRuntime = readOptionalBoolean(obj, "includeRuntime", "query_nodes");
  const limit = readOptionalPositiveInt(obj, "limit", "query_nodes", 200);
  const timeoutMs = readOptionalPositiveInt(obj, "timeoutMs", "query_nodes", 10_000);
  const out: QueryNodesInput = {};
  if (query !== undefined) out.query = query;
  if (nodeIds !== undefined) out.nodeIds = nodeIds;
  if (status !== undefined) out.status = status;
  if (namespace !== undefined) out.namespace = namespace;
  if (registryId !== undefined) out.registryId = registryId;
  if (live !== undefined) out.live = live;
  if (includeRuntime !== undefined) out.includeRuntime = includeRuntime;
  if (limit !== undefined) out.limit = limit;
  if (timeoutMs !== undefined) out.timeoutMs = timeoutMs;
  return out;
}

function parseListLightsInput(input: unknown): ListLightsInput {
  const obj = ensureObject(input, "list_lights");
  const query = readOptionalString(obj, "query", "list_lights");
  const reachable = readOptionalBoolean(obj, "reachable", "list_lights");
  const power = readOptionalBoolean(obj, "power", "list_lights");
  const limit = readOptionalPositiveInt(obj, "limit", "list_lights", 200);
  const out: ListLightsInput = {};
  if (query !== undefined) out.query = query;
  if (reachable !== undefined) out.reachable = reachable;
  if (power !== undefined) out.power = power;
  if (limit !== undefined) out.limit = limit;
  return out;
}

function parseControlLightsInput(input: unknown): ControlLightsInput {
  const obj = ensureObject(input, "control_lights");
  const lightIds = readOptionalStringArray(obj, "lightIds", "control_lights");
  const lightNames = readOptionalStringArray(obj, "lightNames", "control_lights");
  const query = readOptionalString(obj, "query", "control_lights");
  const power = readOptionalBoolean(obj, "power", "control_lights");
  const hue = readOptionalNumberInRange(obj, "hue", "control_lights", 0, 360);
  const saturation = readOptionalNumberInRange(
    obj,
    "saturation",
    "control_lights",
    0,
    100
  );
  const brightness = readOptionalNumberInRange(
    obj,
    "brightness",
    "control_lights",
    0,
    100
  );
  const kelvin = readOptionalNumberInRange(obj, "kelvin", "control_lights", 2000, 9000);
  if (
    power === undefined &&
    hue === undefined &&
    saturation === undefined &&
    brightness === undefined &&
    kelvin === undefined
  ) {
    throw new Error("invalid_args:control_lights:at_least_one_setting_required");
  }
  const out: ControlLightsInput = {};
  if (lightIds !== undefined) out.lightIds = lightIds;
  if (lightNames !== undefined) out.lightNames = lightNames;
  if (query !== undefined) out.query = query;
  if (power !== undefined) out.power = power;
  if (hue !== undefined) out.hue = hue;
  if (saturation !== undefined) out.saturation = saturation;
  if (brightness !== undefined) out.brightness = brightness;
  if (kelvin !== undefined) out.kelvin = kelvin;
  return out;
}

export const TOOLS: McpTool[] = [
  {
    name: "create_upload_request",
    description: "Create an upload ingest job from local file paths and optional metadata.",
    inputSchema: {
      type: "object",
      properties: {
        paths: { type: "array", items: { type: "string" } },
        artist: { type: "string" },
        description: { type: "string" },
        playlist: { type: "boolean" },
        playlistTitle: { type: "string" },
        fileTitles: { type: "array", items: { type: "string" } },
        fileArtists: { type: "array", items: { type: "string" } },
        fileDescriptions: { type: "array", items: { type: "string" } },
        wait: { type: "boolean" },
        timeoutMs: { type: "number" },
      },
      required: ["paths"],
    },
  },
  {
    name: "get_upload_status",
    description: "Poll the status of an upload ingest job by job id.",
    inputSchema: {
      type: "object",
      properties: {
        jobId: { type: "string" },
      },
      required: ["jobId"],
    },
  },
  {
    name: "send_media_to_nodes",
    description: "Send a media item to one or more nodes.",
    inputSchema: {
      type: "object",
      properties: {
        mediaId: { type: "string" },
        nodeIds: { type: "array", items: { type: "string" } },
        namespace: { type: "string" },
        registryId: { type: "string" },
        controllerId: { type: "string" },
        launch: { type: "object" },
      },
      required: ["mediaId", "nodeIds"],
    },
  },
  {
    name: "search_media_library",
    description: "Search the media library by id, title, artist, description, or source URL/path.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        sourceType: { type: "string", enum: ["path", "url"] },
        cache: { type: "boolean" },
        limit: { type: "number" },
      },
    },
  },
  {
    name: "query_nodes",
    description: "Query node status across the fleet, with optional live probes and runtime details.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        nodeIds: { type: "array", items: { type: "string" } },
        status: { type: "string", enum: ["online", "degraded", "offline", "progressing"] },
        namespace: { type: "string" },
        registryId: { type: "string" },
        live: { type: "boolean" },
        includeRuntime: { type: "boolean" },
        limit: { type: "number" },
        timeoutMs: { type: "number" },
      },
    },
  },
  {
    name: "list_lights",
    description: "List known lights and their current reachability and state.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        reachable: { type: "boolean" },
        power: { type: "boolean" },
        limit: { type: "number" },
      },
    },
  },
  {
    name: "control_lights",
    description: "Control all lights or a selected subset by id, name, or search query.",
    inputSchema: {
      type: "object",
      properties: {
        lightIds: { type: "array", items: { type: "string" } },
        lightNames: { type: "array", items: { type: "string" } },
        query: { type: "string" },
        power: { type: "boolean" },
        hue: { type: "number" },
        saturation: { type: "number" },
        brightness: { type: "number" },
        kelvin: { type: "number" },
      },
    },
  },
  {
    name: "mpbcp_snapshot",
    description: "Query the current MPBCP resource snapshot (media/playlists/blocks/channels/profiles).",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "node_state",
    description: "Query desired/runtime node state for a screen/node id.",
    inputSchema: {
      type: "object",
      properties: {
        screenId: { type: "string" },
        namespace: { type: "string" },
      },
      required: ["screenId"],
    },
  },
  {
    name: "apply_mpbcp_to_nodes",
    description: "Apply a media/playlist/block/channel/profile target to one or more nodes.",
    inputSchema: {
      type: "object",
      properties: {
        targetKind: { type: "string", enum: TARGET_KINDS },
        targetId: { type: "string" },
        nodeIds: { type: "array", items: { type: "string" } },
        namespace: { type: "string" },
        registryId: { type: "string" },
        controllerId: { type: "string" },
        launch: { type: "object" },
      },
      required: ["targetKind", "targetId", "nodeIds"],
    },
  },
  {
    name: "ingest_youtube",
    description: "Ingest YouTube media via control-api ingestion jobs.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string" },
        mediaId: { type: "string" },
        title: { type: "string" },
        artist: { type: "string" },
        cache: { type: "boolean" },
        wait: { type: "boolean" },
        timeoutMs: { type: "number" },
      },
      required: ["url"],
    },
  },
  {
    name: "ingest_eden_collection",
    description: "Ingest an Eden collection into media + playlist via control-api ingestion jobs.",
    inputSchema: {
      type: "object",
      properties: {
        input: { type: "string" },
        db: { type: "string", enum: ["PROD", "STAGE"] },
        playlistId: { type: "string" },
        apiKey: { type: "string" },
        wait: { type: "boolean" },
        timeoutMs: { type: "number" },
      },
      required: ["input"],
    },
  },
  {
    name: "ingest_upload_paths",
    description: "Legacy alias for upload ingest by local file path through control-api upload jobs.",
    inputSchema: {
      type: "object",
      properties: {
        paths: { type: "array", items: { type: "string" } },
        artist: { type: "string" },
        description: { type: "string" },
        playlist: { type: "boolean" },
        playlistTitle: { type: "string" },
        fileTitles: { type: "array", items: { type: "string" } },
        fileArtists: { type: "array", items: { type: "string" } },
        fileDescriptions: { type: "array", items: { type: "string" } },
        wait: { type: "boolean" },
        timeoutMs: { type: "number" },
      },
      required: ["paths"],
    },
  },
];

function asText(data: unknown): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

function asError(error: string): ToolResult {
  return {
    isError: true,
    content: [{ type: "text", text: error }],
  };
}

async function waitForJob(args: {
  jobId: string;
  timeoutMs: number;
}): Promise<unknown> {
  const started = Date.now();
  while (Date.now() - started < args.timeoutMs) {
    const jobRes = (await fetchJson({
      path: `/api/v1/ingest/jobs/${encodeURIComponent(args.jobId)}`,
    })) as JsonRecord;
    const job =
      jobRes && typeof jobRes === "object" && jobRes.job && typeof jobRes.job === "object"
        ? (jobRes.job as JsonRecord)
        : null;
    if (!job) return jobRes;
    const status = String(job.status ?? "");
    if (status === "succeeded" || status === "failed") return jobRes;
    await sleep(1000);
  }
  throw new Error(`job_timeout:${args.jobId}`);
}

function appendStringArray(form: FormData, key: string, values: string[]): void {
  form.append(key, JSON.stringify(values));
}

async function toUploadForm(input: UploadRequestInput): Promise<FormData> {
  const form = new FormData();
  const nonArchivePaths: string[] = [];

  for (const raw of input.paths) {
    const filePath = path.resolve(raw);
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) throw new Error(`path_not_file:${filePath}`);
    const bytes = await fs.readFile(filePath);
    const base = path.basename(filePath);
    if (base.toLowerCase().endsWith(".zip")) {
      form.append("archive", new File([bytes], base, { type: "application/zip" }));
      continue;
    }
    nonArchivePaths.push(filePath);
    form.append("files", new File([bytes], base));
  }

  for (const [key, values] of [
    ["fileTitles", input.fileTitles],
    ["fileArtists", input.fileArtists],
    ["fileDescriptions", input.fileDescriptions],
  ] as const) {
    if (!values) continue;
    if (values.length > nonArchivePaths.length) {
      throw new Error(`invalid_args:create_upload_request:${key}_too_long`);
    }
    appendStringArray(form, key, values);
  }

  if (input.artist) form.append("artist", input.artist);
  if (input.description) form.append("description", input.description);
  if (input.playlist !== undefined) form.append("playlist", input.playlist ? "true" : "false");
  if (input.playlistTitle) form.append("playlistTitle", input.playlistTitle);

  return form;
}

async function startUploadJob(input: UploadRequestInput): Promise<JsonRecord> {
  const form = await toUploadForm(input);
  const startRes = await fetch(new URL("/api/v1/ingest/jobs/upload", controlApiBase()), {
    method: "POST",
    body: form,
  });
  const startJson = (await startRes.json().catch(() => null)) as JsonRecord | null;
  if (!startRes.ok) {
    throw new Error(`http_${startRes.status}:${JSON.stringify(startJson ?? {})}`);
  }
  return startJson ?? {};
}

async function runQueuedJob(args: {
  start: JsonRecord;
  wait: boolean;
  timeoutMs: number;
}): Promise<unknown> {
  if (!args.wait) return args.start;
  const jobId = String((args.start.job as JsonRecord | undefined)?.id ?? "");
  if (!jobId) return args.start;
  return waitForJob({ jobId, timeoutMs: args.timeoutMs });
}

async function fetchSnapshot(): Promise<JsonRecord> {
  const payload = (await fetchJson({ path: "/api/v1/resources/snapshot" })) as JsonRecord;
  if (payload && typeof payload === "object" && payload.snapshot && typeof payload.snapshot === "object") {
    return payload.snapshot as JsonRecord;
  }
  return payload;
}

function toSearchableText(row: JsonRecord): string[] {
  return [
    typeof row.id === "string" ? row.id : "",
    typeof row.title === "string" ? row.title : "",
    typeof row.artist === "string" ? row.artist : "",
    typeof row.description === "string" ? row.description : "",
    typeof row.sourceValue === "string" ? row.sourceValue : "",
  ];
}

function mediaMatchScore(row: JsonRecord, query: string): number {
  if (!query) return 1;
  const q = query.toLowerCase();
  const id = typeof row.id === "string" ? row.id.toLowerCase() : "";
  const title = typeof row.title === "string" ? row.title.toLowerCase() : "";
  const artist = typeof row.artist === "string" ? row.artist.toLowerCase() : "";
  const description =
    typeof row.description === "string" ? row.description.toLowerCase() : "";
  const source = typeof row.sourceValue === "string" ? row.sourceValue.toLowerCase() : "";
  if (id === q) return 120;
  if (title === q) return 110;
  if (artist === q) return 100;
  if (id.startsWith(q)) return 90;
  if (title.startsWith(q)) return 80;
  if (artist.startsWith(q)) return 70;
  if (id.includes(q)) return 60;
  if (title.includes(q)) return 50;
  if (artist.includes(q)) return 40;
  if (description.includes(q)) return 25;
  if (source.includes(q)) return 20;
  return 0;
}

async function searchMediaLibrary(input: SearchMediaInput): Promise<unknown> {
  const snapshot = await fetchSnapshot();
  const mediaRows = Array.isArray(snapshot.media) ? (snapshot.media as JsonRecord[]) : [];
  const query = input.query?.trim().toLowerCase() ?? "";
  const filtered = mediaRows
    .filter((row) => {
      if (input.sourceType && row.sourceType !== input.sourceType) return false;
      if (typeof input.cache === "boolean" && row.cache !== input.cache) return false;
      if (!query) return true;
      return toSearchableText(row).some((value) => value.toLowerCase().includes(query));
    })
    .map((row) => ({
      row,
      score: mediaMatchScore(row, query),
    }))
    .filter((row) => row.score > 0 || !query)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const aTitle = String(a.row.title ?? a.row.id ?? "").toLowerCase();
      const bTitle = String(b.row.title ?? b.row.id ?? "").toLowerCase();
      return aTitle.localeCompare(bTitle);
    });

  const limit = input.limit ?? 25;
  return {
    ok: true,
    query: input.query ?? "",
    filters: {
      ...(input.sourceType ? { sourceType: input.sourceType } : {}),
      ...(typeof input.cache === "boolean" ? { cache: input.cache } : {}),
    },
    totalMedia: mediaRows.length,
    matched: filtered.length,
    returned: Math.min(filtered.length, limit),
    results: filtered.slice(0, limit).map(({ row, score }) => ({
      id: row.id,
      title: row.title,
      artist: row.artist,
      description: row.description,
      sourceType: row.sourceType,
      sourceValue: row.sourceValue,
      cache: row.cache,
      thumbnailUrl: row.thumbnailUrl,
      streamUrl:
        typeof row.id === "string"
          ? new URL(
              `/api/v1/resources/media/${encodeURIComponent(row.id)}/stream`,
              controlApiBase()
            ).toString()
          : undefined,
      score,
    })),
  };
}

function withOptionalQuery(
  basePath: string,
  entries: Array<[string, string | number | boolean | undefined]>
): string {
  const params = new URLSearchParams();
  for (const [key, value] of entries) {
    if (value === undefined) continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

function matchesNodeQuery(row: JsonRecord, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return [
    String(row.id ?? row.nodeId ?? ""),
    String(row.host ?? ""),
    String(row.ip ?? ""),
    String(row.nodeName ?? ""),
  ].some((value) => value.toLowerCase().includes(q));
}

function nodeStatusOf(row: JsonRecord): string {
  const connectivity =
    row.connectivity && typeof row.connectivity === "object"
      ? (row.connectivity as JsonRecord)
      : null;
  const status =
    connectivity && typeof connectivity.status === "string"
      ? connectivity.status
      : typeof row.status === "string"
        ? row.status
        : "unknown";
  return status;
}

async function addRuntimeDetails(args: {
  nodes: JsonRecord[];
  namespace?: string;
  registryId?: string;
  timeoutMs?: number;
}): Promise<JsonRecord[]> {
  if (args.nodes.length === 0) return [];
  const runtimeLimit = Math.min(args.nodes.length, 10);
  const selected = args.nodes.slice(0, runtimeLimit);
  const results = await Promise.all(
    selected.map(async (row) => {
      const nodeId = String(row.nodeId ?? row.id ?? "").trim();
      if (!nodeId) return { ...row, runtime: { ok: false, error: "node_id_missing" } };
      try {
        const runtime = await fetchJson({
          path: withOptionalQuery(
            `/api/ops/nodes/${encodeURIComponent(nodeId)}/runtime-status`,
            [
              ["namespace", args.namespace],
              ["registryId", args.registryId],
              ["timeoutMs", args.timeoutMs],
            ]
          ),
        });
        return { ...row, runtime };
      } catch (error) {
        return {
          ...row,
          runtime: {
            ok: false,
            error: error instanceof Error ? error.message : String(error),
          },
        };
      }
    })
  );
  if (args.nodes.length > runtimeLimit) {
    return results.concat(
      args.nodes.slice(runtimeLimit).map((row) => ({
        ...row,
        runtime: {
          ok: false,
          error: `runtime_skipped:limit_${runtimeLimit}`,
        },
      }))
    );
  }
  return results;
}

function summarizeNodeStatuses(rows: JsonRecord[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const status = nodeStatusOf(row);
    counts[status] = (counts[status] ?? 0) + 1;
  }
  return counts;
}

async function queryNodes(input: QueryNodesInput): Promise<unknown> {
  const live = input.live !== false;
  const pathBase = live ? "/api/ops/fleet" : "/api/ops/nodes";
  const payload = (await fetchJson({
    path: withOptionalQuery(pathBase, [
      ["namespace", input.namespace],
      ["registryId", input.registryId],
      ["timeoutMs", input.timeoutMs],
    ]),
  })) as JsonRecord;

  const rawNodes = Array.isArray(payload.pis)
    ? (payload.pis as JsonRecord[])
    : Array.isArray(payload.nodes)
      ? (payload.nodes as JsonRecord[])
      : [];
  const requestedIds = input.nodeIds ? new Set(input.nodeIds) : null;
  const query = input.query?.trim().toLowerCase() ?? "";
  const filtered = rawNodes.filter((row) => {
    const nodeId = String(row.id ?? row.nodeId ?? "");
    if (requestedIds && !requestedIds.has(nodeId)) return false;
    if (input.status && nodeStatusOf(row) !== input.status) return false;
    if (!matchesNodeQuery(row, query)) return false;
    return true;
  });
  const limit = input.limit ?? 50;
  const limited = filtered.slice(0, limit);
  let withRuntime = limited;
  if (input.includeRuntime) {
    const runtimeArgs: {
      nodes: JsonRecord[];
      namespace?: string;
      registryId?: string;
      timeoutMs?: number;
    } = {
      nodes: limited.map((row) => {
        if ("nodeId" in row) return row;
        return { ...row, nodeId: row.id };
      }),
    };
    if (input.namespace !== undefined) runtimeArgs.namespace = input.namespace;
    if (input.registryId !== undefined) runtimeArgs.registryId = input.registryId;
    if (input.timeoutMs !== undefined) runtimeArgs.timeoutMs = input.timeoutMs;
    withRuntime = await addRuntimeDetails(runtimeArgs);
  }

  return {
    ok: true,
    mode: live ? "live" : "inventory",
    namespace:
      typeof payload.namespace === "string" ? payload.namespace : input.namespace ?? undefined,
    registryId:
      typeof payload.registryId === "string" ? payload.registryId : input.registryId ?? undefined,
    totalNodes: rawNodes.length,
    matched: filtered.length,
    returned: withRuntime.length,
    statusCounts: summarizeNodeStatuses(filtered),
    nodes: withRuntime,
  };
}

async function fetchLightsData(): Promise<JsonRecord[]> {
  const data = await fetchEnvelope({ path: "/api/lights" });
  return Array.isArray(data) ? (data as JsonRecord[]) : [];
}

function matchesLightQuery(row: JsonRecord, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return [
    String(row.id ?? ""),
    String(row.name ?? ""),
    String(row.ipAddress ?? ""),
    String(row.deviceId ?? ""),
  ].some((value) => value.toLowerCase().includes(q));
}

async function listLights(input: ListLightsInput): Promise<unknown> {
  const lights = await fetchLightsData();
  const query = input.query?.trim().toLowerCase() ?? "";
  const filtered = lights.filter((row) => {
    if (!matchesLightQuery(row, query)) return false;
    if (typeof input.reachable === "boolean" && row.reachable !== input.reachable) return false;
    const state =
      row.state && typeof row.state === "object" ? (row.state as JsonRecord) : null;
    if (typeof input.power === "boolean" && state?.power !== input.power) return false;
    return true;
  });
  const limit = input.limit ?? 50;
  return {
    ok: true,
    totalLights: lights.length,
    matched: filtered.length,
    returned: Math.min(filtered.length, limit),
    lights: filtered.slice(0, limit),
  };
}

function resolveTargetLights(
  lights: JsonRecord[],
  input: ControlLightsInput
): { matches: JsonRecord[]; unmatchedNames: string[] } {
  const byId = new Map(lights.map((row) => [String(row.id ?? ""), row]));
  const matches = new Map<string, JsonRecord>();
  const unmatchedNames: string[] = [];

  for (const id of input.lightIds ?? []) {
    const match = byId.get(id);
    if (match) matches.set(id, match);
  }

  for (const rawName of input.lightNames ?? []) {
    const normalized = rawName.toLowerCase();
    const exact = lights.find(
      (row) => String(row.name ?? "").trim().toLowerCase() === normalized
    );
    if (exact) {
      matches.set(String(exact.id ?? ""), exact);
      continue;
    }
    unmatchedNames.push(rawName);
  }

  if (input.query) {
    for (const row of lights) {
      if (matchesLightQuery(row, input.query.toLowerCase())) {
        matches.set(String(row.id ?? ""), row);
      }
    }
  }

  return {
    matches: Array.from(matches.values()),
    unmatchedNames,
  };
}

function toLightControlBody(input: ControlLightsInput): JsonRecord {
  const body: JsonRecord = {};
  if (input.power !== undefined) body.power = input.power;
  if (input.hue !== undefined) body.hue = input.hue;
  if (input.saturation !== undefined) body.saturation = input.saturation;
  if (input.brightness !== undefined) body.brightness = input.brightness;
  if (input.kelvin !== undefined) body.kelvin = input.kelvin;
  return body;
}

async function controlLights(input: ControlLightsInput): Promise<unknown> {
  const lights = await fetchLightsData();
  const body = toLightControlBody(input);
  const hasSelector =
    (input.lightIds?.length ?? 0) > 0 ||
    (input.lightNames?.length ?? 0) > 0 ||
    Boolean(input.query?.trim());

  if (!hasSelector) {
    const result = await fetchEnvelope({
      path: "/api/lights/all/control",
      method: "POST",
      body,
    });
    return {
      ok: true,
      scope: "all",
      targetCount: lights.length,
      result,
    };
  }

  const resolved = resolveTargetLights(lights, input);
  if (resolved.matches.length === 0) {
    throw new Error("light_not_found");
  }

  const results = await Promise.all(
    resolved.matches.map(async (row) => {
      const lightId = String(row.id ?? "").trim();
      try {
        const result = await fetchEnvelope({
          path: `/api/lights/${encodeURIComponent(lightId)}/control`,
          method: "POST",
          body,
        });
        return {
          lightId,
          name: row.name,
          ok: true,
          result,
        };
      } catch (error) {
        return {
          lightId,
          name: row.name,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    })
  );

  return {
    ok: results.every((row) => row.ok),
    scope: "selected",
    targetCount: resolved.matches.length,
    unmatchedNames: resolved.unmatchedNames,
    results,
  };
}

async function applyTarget(input: ApplyInput): Promise<unknown> {
  return fetchJson({
    path: "/api/ops/apply-target",
    method: "POST",
    body: {
      target: input.targetKind,
      id: input.targetId,
      piIds: input.nodeIds,
      ...(input.namespace ? { namespace: input.namespace } : {}),
      ...(input.registryId ? { registryId: input.registryId } : {}),
      ...(input.controllerId ? { controllerId: input.controllerId } : {}),
      ...(input.launch ?? {}),
    },
  });
}

export async function handleToolCall(args: {
  name: string;
  input: unknown;
}): Promise<ToolResult> {
  try {
    if (args.name === "create_upload_request") {
      const parsed = parseUploadRequestInput(args.input ?? {}, "create_upload_request");
      const start = await startUploadJob(parsed);
      const done = await runQueuedJob({
        start,
        wait: parsed.wait === true,
        timeoutMs: parsed.timeoutMs ?? 300_000,
      });
      return asText(done);
    }

    if (args.name === "get_upload_status") {
      const parsed = parseUploadStatusInput(args.input ?? {});
      const data = await fetchJson({
        path: `/api/v1/ingest/jobs/${encodeURIComponent(parsed.jobId)}`,
      });
      return asText(data);
    }

    if (args.name === "send_media_to_nodes") {
      const parsed = parseSendMediaToNodesInput(args.input ?? {});
      const data = await applyTarget({
        targetKind: "media",
        targetId: parsed.mediaId,
        nodeIds: parsed.nodeIds,
        ...(parsed.namespace ? { namespace: parsed.namespace } : {}),
        ...(parsed.registryId ? { registryId: parsed.registryId } : {}),
        ...(parsed.controllerId ? { controllerId: parsed.controllerId } : {}),
        ...(parsed.launch ? { launch: parsed.launch } : {}),
      });
      return asText(data);
    }

    if (args.name === "search_media_library") {
      const parsed = parseSearchMediaInput(args.input ?? {});
      const data = await searchMediaLibrary(parsed);
      return asText(data);
    }

    if (args.name === "query_nodes") {
      const parsed = parseQueryNodesInput(args.input ?? {});
      const data = await queryNodes(parsed);
      return asText(data);
    }

    if (args.name === "list_lights") {
      const parsed = parseListLightsInput(args.input ?? {});
      const data = await listLights(parsed);
      return asText(data);
    }

    if (args.name === "control_lights") {
      const parsed = parseControlLightsInput(args.input ?? {});
      const data = await controlLights(parsed);
      return asText(data);
    }

    if (args.name === "mpbcp_snapshot") {
      const data = await fetchJson({ path: "/api/v1/resources/snapshot" });
      return asText(data);
    }

    if (args.name === "node_state") {
      const parsed = parseNodeStateInput(args.input ?? {});
      const data = await fetchJson({
        path: withOptionalQuery(
          `/api/v1/screen-assignment/${encodeURIComponent(parsed.screenId)}`,
          [["namespace", parsed.namespace]]
        ),
      });
      return asText(data);
    }

    if (args.name === "apply_mpbcp_to_nodes") {
      const parsed = parseApplyInput(args.input ?? {});
      const data = await applyTarget(parsed);
      return asText(data);
    }

    if (args.name === "ingest_youtube") {
      const parsed = parseIngestYoutubeInput(args.input ?? {});
      const queueStart = (await fetchJson({
        path: "/api/v1/ingest/jobs/youtube",
        method: "POST",
        body: {
          url: parsed.url,
          ...(parsed.mediaId ? { mediaId: parsed.mediaId } : {}),
          ...(parsed.title ? { title: parsed.title } : {}),
          ...(parsed.artist ? { artist: parsed.artist } : {}),
          ...(typeof parsed.cache === "boolean" ? { cache: parsed.cache } : {}),
        },
      })) as JsonRecord;
      const done = await runQueuedJob({
        start: queueStart,
        wait: parsed.wait !== false,
        timeoutMs: parsed.timeoutMs ?? 300_000,
      });
      return asText(done);
    }

    if (args.name === "ingest_eden_collection") {
      const parsed = parseIngestEdenInput(args.input ?? {});
      const queueStart = (await fetchJson({
        path: "/api/v1/ingest/jobs/eden-collection",
        method: "POST",
        body: {
          input: parsed.input,
          ...(parsed.db ? { db: parsed.db } : {}),
          ...(parsed.playlistId ? { playlistId: parsed.playlistId } : {}),
          ...(parsed.apiKey ? { apiKey: parsed.apiKey } : {}),
        },
      })) as JsonRecord;
      const done = await runQueuedJob({
        start: queueStart,
        wait: parsed.wait !== false,
        timeoutMs: parsed.timeoutMs ?? 300_000,
      });
      return asText(done);
    }

    if (args.name === "ingest_upload_paths") {
      const parsed = parseUploadRequestInput(args.input ?? {}, "ingest_upload_paths");
      const start = await startUploadJob(parsed);
      const done = await runQueuedJob({
        start,
        wait: parsed.wait !== false,
        timeoutMs: parsed.timeoutMs ?? 300_000,
      });
      return asText(done);
    }

    return asError(`unknown_tool:${args.name}`);
  } catch (error) {
    return asError(error instanceof Error ? error.message : String(error));
  }
}
