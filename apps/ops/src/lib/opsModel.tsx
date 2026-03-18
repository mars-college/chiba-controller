import { Badge } from "@mantine/core";
import type { Media, ResourcePayload } from "./controlApi";
import { mediaStreamUrl } from "./controlApi";
import type { FleetPi, FleetPiHealth, OpsApplyResponse } from "../types";

export type OptionBool = "inherit" | "on" | "off";
export type OptionMode = "inherit" | "guide" | "gallery";
export type OptionHud = "inherit" | "always" | "start" | "never";
export type OptionRotate = "inherit" | "0" | "90" | "180" | "270";

export type CatalogOption = { value: string; label: string };
export type QuickSendTarget = {
  kind: "media" | "playlist";
  id: string;
  label: string;
};

export type DraftMedia = {
  id: string;
  title: string;
  artist: string;
  description: string;
  sourceType: "path" | "url";
  sourceValue: string;
  thumbnailUrl?: string;
  thumbnailObjectKey?: string;
  web?: Media["web"];
  cache: boolean;
};

export type DraftPlaylist = {
  id: string;
  title: string;
  artist: string;
  description: string;
  mediaIds: string[];
};

export type TargetKind = "media" | "playlist" | "block" | "channel";

export type DraftBlockItem = {
  kind: "media" | "playlist";
  id: string;
};

export type DraftBlock = {
  id: string;
  title: string;
  mode: "loop" | "once" | "clocked";
  items: DraftBlockItem[];
};

export type DraftChannel = {
  id: string;
  title: string;
  blockIds: string[];
};

export type DraftLaunchOptions = {
  mode?: "guide" | "gallery";
  lock?: boolean;
  qr?: boolean;
  nosplash?: boolean;
  remoteInput?: boolean;
  remoteApp?: boolean;
  remoteMic?: boolean;
  remoteGuide?: boolean;
  hudMode?: "always" | "start" | "never";
  hudSec?: number;
  theme?: string;
  displayRotate?: 0 | 90 | 180 | 270;
  infoTitle?: string;
  infoArtist?: string;
  infoDescription?: string;
};

export type DraftProfileNodeAssignment = {
  nodeId: string;
  targetKind: TargetKind;
  targetId: string;
  launch: DraftLaunchOptions;
};

export type DraftProfile = {
  id: string;
  title: string;
  defaultTargetKind: TargetKind;
  defaultTargetId: string;
  defaultLaunch: DraftLaunchOptions;
  nodeAssignments: DraftProfileNodeAssignment[];
};

export type DraftStore = {
  media: DraftMedia[];
  playlists: DraftPlaylist[];
  blocks: DraftBlock[];
  channels: DraftChannel[];
  profiles: DraftProfile[];
};

export type UploadPreviewItem = {
  file: File;
  kind: "image" | "video" | "audio" | "zip" | "file";
  url: string | null;
};

export type IngestSource = "youtube" | "eden" | "upload" | "web";

export type NodeDraft = {
  registryId: string;
  nodeId: string;
  host: string;
  ip: string;
  nodeName: string;
  orientation: string;
  displayRotate: "" | "0" | "90" | "180" | "270";
  guidePort: number | undefined;
  nodePort: number | undefined;
  serverPort: number | undefined;
  apiKey: string;
};

export const EMPTY_DRAFTS: DraftStore = {
  media: [],
  playlists: [],
  blocks: [],
  channels: [],
  profiles: [],
};

export const EMPTY_PLAYLIST_DRAFT: DraftPlaylist = {
  id: "",
  title: "",
  artist: "",
  description: "",
  mediaIds: [],
};

export const EMPTY_BLOCK_DRAFT: DraftBlock = {
  id: "",
  title: "",
  mode: "loop",
  items: [],
};

export const EMPTY_CHANNEL_DRAFT: DraftChannel = {
  id: "",
  title: "",
  blockIds: [],
};

export const EMPTY_PROFILE_DRAFT: DraftProfile = {
  id: "",
  title: "",
  defaultTargetKind: "channel",
  defaultTargetId: "",
  defaultLaunch: {},
  nodeAssignments: [],
};

export const TABLE_PAGE_SIZE = {
  fleet: 25,
  media: 20,
  playlists: 20,
  blocks: 20,
  channels: 20,
  profiles: 20,
} as const;

export function paginateRows<T>(rows: T[], page: number, pageSize: number): T[] {
  const safePage = Number.isFinite(page) && page > 0 ? page : 1;
  const start = (safePage - 1) * pageSize;
  return rows.slice(start, start + pageSize);
}

export function tableRangeLabel(
  totalRows: number,
  page: number,
  pageSize: number
): string {
  if (totalRows === 0) return "0 of 0";
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(totalRows, start + pageSize - 1);
  return `${start}-${end} of ${totalRows}`;
}

export function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeBlockItem(value: unknown): DraftBlockItem | null {
  if (!value || typeof value !== "object") return null;
  const row = value as {
    kind?: unknown;
    id?: unknown;
    mediaId?: unknown;
    playlistId?: unknown;
    targetKind?: unknown;
    targetId?: unknown;
  };
  const kindFromKind =
    row.kind === "media"
      ? "media"
      : row.kind === "playlist"
        ? "playlist"
        : null;
  const idFromKind = readString(row.id);
  if (kindFromKind && idFromKind) return { kind: kindFromKind, id: idFromKind };

  const mediaId = readString(row.mediaId);
  if (mediaId) return { kind: "media", id: mediaId };

  const playlistId = readString(row.playlistId);
  if (playlistId) return { kind: "playlist", id: playlistId };

  const targetKind =
    row.targetKind === "media"
      ? "media"
      : row.targetKind === "playlist"
        ? "playlist"
        : null;
  const targetId = readString(row.targetId);
  if (targetKind && targetId) return { kind: targetKind, id: targetId };

  return null;
}

export function normalizeBlockItems(value: unknown): DraftBlockItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => normalizeBlockItem(item))
    .filter((item): item is DraftBlockItem => Boolean(item));
}

export function blockItemsFromUnknownBlock(value: unknown): DraftBlockItem[] {
  if (!value || typeof value !== "object") return [];
  const row = value as { items?: unknown; playlistIds?: unknown; mediaIds?: unknown };
  const normalizedItems = normalizeBlockItems(row.items);
  if (normalizedItems.length > 0) return normalizedItems;
  const legacyPlaylistItems = Array.isArray(row.playlistIds)
    ? row.playlistIds
        .map((item) => readString(item))
        .filter(Boolean)
        .map((id) => ({ kind: "playlist" as const, id }))
    : [];
  const legacyMediaItems = Array.isArray(row.mediaIds)
    ? row.mediaIds
        .map((item) => readString(item))
        .filter(Boolean)
        .map((id) => ({ kind: "media" as const, id }))
    : [];
  return [...legacyPlaylistItems, ...legacyMediaItems];
}

function randomIdSuffix(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function slugifyIdPart(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "item";
}

export function generateAutoResourceId(
  kind: "playlist" | "block" | "channel" | "profile",
  title: string,
  existingIds: Iterable<string>
): string {
  const prefix =
    kind === "playlist"
      ? "pl"
      : kind === "block"
        ? "bl"
        : kind === "channel"
          ? "ch"
          : "pr";
  const taken = new Set(Array.from(existingIds).map((value) => value.trim()).filter(Boolean));
  const base = `${prefix}-${slugifyIdPart(title)}`;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = `${base}-${randomIdSuffix()}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export function toOptionBool(value: OptionBool): boolean | undefined {
  if (value === "inherit") return undefined;
  return value === "on";
}

export function statusBadge(ok: boolean, labelOk: string, labelFail: string) {
  return ok ? (
    <Badge color="teal" variant="light">
      {labelOk}
    </Badge>
  ) : (
    <Badge color="red" variant="light">
      {labelFail}
    </Badge>
  );
}

export type ParsedKioskTarget = {
  kind: "media" | "playlist" | "block" | "channel" | "profile" | "guide" | "unknown";
  id: string;
  label: string;
};

export function parseKioskTarget(rawUrl: string | null | undefined): ParsedKioskTarget {
  if (!rawUrl) return { kind: "unknown", id: "", label: "—" };
  try {
    const url = new URL(rawUrl);
    const targetKind =
      url.searchParams.get("targetKind") ||
      url.searchParams.get("target_kind") ||
      "";
    const targetId =
      url.searchParams.get("targetId") ||
      url.searchParams.get("target_id") ||
      "";
    const channel = url.searchParams.get("channel") || "";
    if (targetKind && targetId) {
      const kind = (
        ["media", "playlist", "block", "channel", "profile"].includes(targetKind)
          ? targetKind
          : "unknown"
      ) as ParsedKioskTarget["kind"];
      return { kind, id: targetId, label: `${targetKind}:${targetId}` };
    }
    if (channel) return { kind: "channel", id: channel, label: `channel:${channel}` };
    return { kind: "guide", id: "", label: "guide/default" };
  } catch {
    return { kind: "unknown", id: "", label: "invalid-url" };
  }
}

export function parseTargetFromKioskUrl(rawUrl: string | null | undefined): string {
  return parseKioskTarget(rawUrl).label;
}

export function isLikelyVideoSource(value: string): boolean {
  const raw = value.trim();
  if (!raw) return false;
  try {
    const pathname = new URL(raw).pathname || "";
    return /\.(mp4|mov|webm|m4v|ogg|ogv|mkv|avi|mpeg|mpg)$/i.test(pathname);
  } catch {
    return /\.(mp4|mov|webm|m4v|ogg|ogv|mkv|avi|mpeg|mpg)$/i.test(raw);
  }
}

export function isLikelyImageSource(value: string): boolean {
  const raw = value.trim();
  if (!raw) return false;
  try {
    const pathname = new URL(raw).pathname || "";
    return /\.(jpg|jpeg|png|gif|webp|bmp|avif|tif|tiff)$/i.test(pathname);
  } catch {
    return /\.(jpg|jpeg|png|gif|webp|bmp|avif|tif|tiff)$/i.test(raw);
  }
}

export function isVideoMedia(media: Media): boolean {
  return isLikelyVideoSource(media.sourceValue);
}

function fallbackPreviewDataUrl(media: Media): string {
  const title = (media.title || media.id).trim() || "Web Content";
  const subtitle = (media.artist || "preview unavailable").trim();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0b1f49"/><stop offset="100%" stop-color="#123268"/></linearGradient></defs><rect width="1280" height="720" rx="28" fill="url(#bg)"/><rect x="44" y="44" width="1192" height="632" rx="22" fill="#061126" stroke="#2d61aa" stroke-opacity=".6"/><text x="84" y="338" fill="#dce9ff" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="66" font-weight="700">${title}</text><text x="84" y="402" fill="#8eb2e7" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="34">${subtitle}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function mediaPreviewSource(media: Media): string | null {
  if (isVideoMedia(media)) {
    if (media.sourceType === "url") return media.sourceValue;
    return mediaStreamUrl(media.id);
  }
  if (media.thumbnailUrl?.trim()) return media.thumbnailUrl;
  if (isLikelyImageSource(media.sourceValue)) {
    if (media.sourceType === "url") return media.sourceValue;
    return mediaStreamUrl(media.id);
  }
  if (media.sourceType === "url") return fallbackPreviewDataUrl(media);
  return null;
}

export function playlistMediaIdsFromSnapshot(
  playlist: ResourcePayload["playlists"][number] | undefined | null
): string[] {
  if (!playlist) return [];
  return playlist.items
    .map((item) => (item.mediaId || "").trim())
    .filter((id) => id.length > 0);
}

export function inferUploadPreviewKind(file: File): UploadPreviewItem["kind"] {
  const mime = (file.type || "").toLowerCase();
  const name = file.name.toLowerCase();
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (
    name.endsWith(".zip") ||
    mime === "application/zip" ||
    mime === "application/x-zip-compressed"
  )
    return "zip";
  return "file";
}

export function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let idx = 0;
  while (size >= 1024 && idx < units.length - 1) {
    size /= 1024;
    idx += 1;
  }
  const precision = size >= 10 || idx === 0 ? 0 : 1;
  return `${size.toFixed(precision)} ${units[idx]}`;
}

export function formatDurationSec(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0)
    return "—";
  const total = Math.floor(value);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function updateOpsUrl(
  patch: { view?: string | null; playlistId?: string | null },
  mode: "push" | "replace" = "push"
): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (patch.view) url.searchParams.set("view", patch.view);
  else url.searchParams.delete("view");
  if (patch.playlistId) url.searchParams.set("playlistId", patch.playlistId);
  else url.searchParams.delete("playlistId");
  const next = `${url.pathname}${url.search}${url.hash}`;
  if (mode === "replace") window.history.replaceState(null, "", next);
  else window.history.pushState(null, "", next);
}

export function readOpsViewFromUrl(): {
  view: string | null;
  playlistId: string | null;
} {
  if (typeof window === "undefined") return { view: null, playlistId: null };
  const params = new URLSearchParams(window.location.search);
  const view = params.get("view");
  const playlistId = params.get("playlistId");
  return { view, playlistId: playlistId?.trim() || null };
}

export function toPendingFleetHealth(pi: FleetPi): FleetPiHealth {
  return {
    registryId: pi.registryId,
    id: pi.id,
    host: pi.host,
    ip: pi.ip,
    nodeName: pi.nodeName,
    resolvedIp: pi.ip ?? pi.host ?? null,
    dnsOk: Boolean(pi.host || pi.ip),
    ping: { ok: false, ms: null },
    tcp: {
      ssh22: { ok: false, ms: null },
      node8080: { ok: false, ms: null },
      cable8787: { ok: false, ms: null },
    },
    http: {
      nodeStatus: { ok: false, ms: null, status: null },
      cableVersion: { ok: false, ms: null, status: null },
    },
    chibaNode: {
      version: null,
      ipReported: pi.ip ?? null,
      kioskUrl: null,
      displayMode: null,
      displayOutput: null,
      displayBackend: null,
      runtime: null,
    },
    cableServer: null,
    needsUpdate: null,
    lastCheckedAt: Date.now(),
    connectivity: {
      score: 0,
      total: 5,
      status: "progressing",
      lastCheckedAt: Date.now(),
    },
    errorSummary: "pending_probe",
  };
}

export function summarizeApplyResult(result: OpsApplyResponse): string {
  const total = result.results.length;
  const ok = result.results.filter((r) => r.ok).length;
  if (ok === total) return `Applied to ${ok}/${total}`;
  const firstError =
    result.results.find((r) => !r.ok)?.error || "unknown_error";
  return `Applied to ${ok}/${total}. Failures: ${
    total - ok
  }. First error: ${firstError}`;
}

export function emptyNodeDraft(registryId = "local"): NodeDraft {
  return {
    registryId,
    nodeId: "",
    host: "",
    ip: "",
    nodeName: "",
    orientation: "",
    displayRotate: "",
    guidePort: undefined,
    nodePort: undefined,
    serverPort: undefined,
    apiKey: "",
  };
}

export function nodeDraftFromRecord(record: {
  registryId?: string;
  id?: string;
  nodeId?: string;
  host?: string;
  ip?: string;
  nodeName?: string;
  orientation?: string;
  displayRotate?: 0 | 90 | 180 | 270;
  guidePort?: number;
  nodePort?: number;
  serverPort?: number;
  apiKey?: string;
}): NodeDraft {
  return {
    registryId: record.registryId || "local",
    nodeId: record.nodeId || record.id || "",
    host: record.host || "",
    ip: record.ip || "",
    nodeName: record.nodeName || "",
    orientation: record.orientation || "",
    displayRotate:
      typeof record.displayRotate === "number"
        ? (String(record.displayRotate) as "0" | "90" | "180" | "270")
        : "",
    guidePort:
      typeof record.guidePort === "number" ? record.guidePort : undefined,
    nodePort: typeof record.nodePort === "number" ? record.nodePort : undefined,
    serverPort:
      typeof record.serverPort === "number" ? record.serverPort : undefined,
    apiKey: record.apiKey || "",
  };
}

export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function playlistDraftToResource(
  playlist: DraftPlaylist
): ResourcePayload["playlists"][number] {
  const mediaIds = playlist.mediaIds
    .map((mediaId) => mediaId.trim())
    .filter((mediaId) => mediaId.length > 0);
  return {
    id: playlist.id.trim(),
    title: playlist.title.trim() || undefined,
    artist: playlist.artist.trim() || undefined,
    description: playlist.description.trim() || undefined,
    items: mediaIds.map((mediaId, index) => ({
      index,
      mediaId,
    })),
  };
}

export function blockDraftToResource(
  block: DraftBlock
): ResourcePayload["blocks"][number] {
  const items = block.items
    .map((item) => ({ ...item, id: item.id.trim() }))
    .filter((item) => item.id.length > 0);
  return {
    id: block.id.trim(),
    title: block.title.trim() || undefined,
    mode: block.mode,
    items: items.map((item, index) => ({
      index,
      ...(item.kind === "media" ? { mediaId: item.id } : { playlistId: item.id }),
    })),
  };
}

export function channelDraftToResource(
  channel: DraftChannel
): ResourcePayload["channels"][number] {
  return {
    id: channel.id.trim(),
    name: channel.title.trim() || undefined,
    blockIds: channel.blockIds
      .map((blockId) => blockId.trim())
      .filter((blockId) => blockId.length > 0),
  };
}

export function launchDraftToResource(
  launch: DraftLaunchOptions | null | undefined
): ResourcePayload["profiles"][number]["defaults"] {
  const next: ResourcePayload["profiles"][number]["defaults"] = {};
  if (launch?.mode === "guide" || launch?.mode === "gallery") {
    next.mode = launch.mode;
  }
  if (typeof launch?.lock === "boolean") next.lock = launch.lock;
  if (typeof launch?.qr === "boolean") next.qr = launch.qr;
  if (typeof launch?.nosplash === "boolean") next.nosplash = launch.nosplash;
  if (typeof launch?.remoteInput === "boolean") {
    next.remoteInput = launch.remoteInput;
  }
  if (typeof launch?.remoteApp === "boolean") next.remoteApp = launch.remoteApp;
  if (typeof launch?.remoteMic === "boolean") next.remoteMic = launch.remoteMic;
  if (typeof launch?.remoteGuide === "boolean") {
    next.remoteGuide = launch.remoteGuide;
  }
  if (
    launch?.hudMode === "always" ||
    launch?.hudMode === "start" ||
    launch?.hudMode === "never"
  ) {
    next.hudMode = launch.hudMode;
  }
  if (
    typeof launch?.hudSec === "number" &&
    Number.isFinite(launch.hudSec) &&
    launch.hudSec > 0
  ) {
    next.hudSec = launch.hudSec;
  }
  if (typeof launch?.theme === "string" && launch.theme.trim()) {
    next.theme = launch.theme.trim();
  }
  if (
    launch?.displayRotate === 0 ||
    launch?.displayRotate === 90 ||
    launch?.displayRotate === 180 ||
    launch?.displayRotate === 270
  ) {
    next.displayRotate = launch.displayRotate;
  }
  if (typeof launch?.infoTitle === "string" && launch.infoTitle.trim()) {
    next.infoTitle = launch.infoTitle.trim();
  }
  if (typeof launch?.infoArtist === "string" && launch.infoArtist.trim()) {
    next.infoArtist = launch.infoArtist.trim();
  }
  if (
    typeof launch?.infoDescription === "string" &&
    launch.infoDescription.trim()
  ) {
    next.infoDescription = launch.infoDescription.trim();
  }
  return next;
}

export function launchResourceToDraft(
  launch: ResourcePayload["profiles"][number]["defaults"] | null | undefined
): DraftLaunchOptions {
  if (!launch || typeof launch !== "object") return {};
  const source = launch as Record<string, unknown>;
  const next: DraftLaunchOptions = {};
  if (source.mode === "guide" || source.mode === "gallery") {
    next.mode = source.mode;
  }
  if (typeof source.lock === "boolean") next.lock = source.lock;
  if (typeof source.qr === "boolean") next.qr = source.qr;
  if (typeof source.nosplash === "boolean") next.nosplash = source.nosplash;
  if (typeof source.remoteInput === "boolean") next.remoteInput = source.remoteInput;
  if (typeof source.remoteApp === "boolean") next.remoteApp = source.remoteApp;
  if (typeof source.remoteMic === "boolean") next.remoteMic = source.remoteMic;
  if (typeof source.remoteGuide === "boolean") {
    next.remoteGuide = source.remoteGuide;
  }
  if (
    source.hudMode === "always" ||
    source.hudMode === "start" ||
    source.hudMode === "never"
  ) {
    next.hudMode = source.hudMode;
  }
  if (
    typeof source.hudSec === "number" &&
    Number.isFinite(source.hudSec) &&
    source.hudSec > 0
  ) {
    next.hudSec = source.hudSec;
  }
  const theme = readString(source.theme);
  if (theme) next.theme = theme;
  if (
    source.displayRotate === 0 ||
    source.displayRotate === 90 ||
    source.displayRotate === 180 ||
    source.displayRotate === 270
  ) {
    next.displayRotate = source.displayRotate;
  }
  const infoTitle = readString(source.infoTitle);
  if (infoTitle) next.infoTitle = infoTitle;
  const infoArtist = readString(source.infoArtist);
  if (infoArtist) next.infoArtist = infoArtist;
  const infoDescription = readString(source.infoDescription);
  if (infoDescription) next.infoDescription = infoDescription;
  return next;
}

export function profileDraftToResource(
  profile: DraftProfile
): ResourcePayload["profiles"][number] {
  return {
    id: profile.id.trim(),
    title: profile.title.trim() || undefined,
    defaults: launchDraftToResource(profile.defaultLaunch),
    defaultTarget:
      profile.defaultTargetKind && profile.defaultTargetId.trim()
        ? {
            kind: profile.defaultTargetKind,
            id: profile.defaultTargetId.trim(),
          }
        : undefined,
    nodes: profile.nodeAssignments
      .map((node) => ({
        nodeId: node.nodeId.trim(),
        target: {
          kind: node.targetKind,
          id: node.targetId.trim(),
        },
        launch: launchDraftToResource(node.launch),
      }))
      .filter((row) => row.nodeId.length > 0 && row.target.id.length > 0),
  };
}

export function toResourcePayload(store: DraftStore): ResourcePayload {
  return {
    media: store.media.map((m) => ({
      id: m.id.trim(),
      title: m.title.trim() || undefined,
      artist: m.artist.trim() || undefined,
      description: m.description.trim() || undefined,
      sourceType: m.sourceType,
      sourceValue: m.sourceValue.trim(),
      thumbnailUrl: m.thumbnailUrl,
      thumbnailObjectKey: m.thumbnailObjectKey,
      web: m.web,
      cache: m.cache,
    })),
    playlists: store.playlists.map((playlist) => playlistDraftToResource(playlist)),
    blocks: store.blocks.map((block) => blockDraftToResource(block)),
    channels: store.channels.map((channel) => channelDraftToResource(channel)),
    profiles: store.profiles.map((profile) => profileDraftToResource(profile)),
  };
}

export function fromResourcePayload(payload: ResourcePayload): DraftStore {
  return {
    media: payload.media.map((m) => ({
      id: m.id,
      title: m.title || "",
      artist: m.artist || "",
      description: m.description || "",
      sourceType: m.sourceType,
      sourceValue: m.sourceValue,
      thumbnailUrl: m.thumbnailUrl,
      thumbnailObjectKey: m.thumbnailObjectKey,
      web: m.web,
      cache: m.cache,
    })),
    playlists: payload.playlists.map((p) => ({
      id: p.id,
      title: p.title || "",
      artist: p.artist || "",
      description: p.description || "",
      mediaIds: p.items
        .map((item) => item.mediaId || "")
        .filter((id) => id.length > 0),
    })),
    blocks: payload.blocks.map((b) => ({
      id: b.id,
      title: b.title || "",
      mode:
        b.mode === "once" || b.mode === "clocked" || b.mode === "loop"
          ? b.mode
          : "loop",
      items: blockItemsFromUnknownBlock(b as unknown),
    })),
    channels: payload.channels.map((c) => ({
      id: c.id,
      title: c.name || "",
      blockIds: c.blockIds,
    })),
    profiles: payload.profiles.map((p) => ({
      id: p.id,
      title: p.title || "",
      defaultTargetKind:
        p.defaultTarget?.kind === "media" ||
        p.defaultTarget?.kind === "playlist" ||
        p.defaultTarget?.kind === "block" ||
        p.defaultTarget?.kind === "channel"
          ? p.defaultTarget.kind
          : "channel",
      defaultTargetId: p.defaultTarget?.id || "",
      defaultLaunch: launchResourceToDraft(p.defaults),
      nodeAssignments: p.nodes
        .map((node) => ({
          nodeId: node.nodeId,
          targetKind:
            node.target.kind === "media" ||
            node.target.kind === "playlist" ||
            node.target.kind === "block" ||
            node.target.kind === "channel"
              ? node.target.kind
              : "channel",
          targetId: node.target.id,
          launch: launchResourceToDraft(node.launch),
        }))
        .filter((node) => node.nodeId.trim().length > 0 && node.targetId.trim().length > 0),
    })),
  };
}
