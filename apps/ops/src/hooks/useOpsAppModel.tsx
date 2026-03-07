import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { notifications } from "@mantine/notifications";
import { useMediaQuery } from "@mantine/hooks";
import {
  Badge,
  Card,
  Group,
  Image,
  Paper,
  SimpleGrid,
  Stack,
  Text,
} from "@mantine/core";
import {
  applyTarget,
  bootstrapOpsNodeStream,
  clearOpsNodeCache,
  createOpsNode,
  deleteOpsNodeCacheFile,
  deleteOpsNode,
  downloadOpsNodesExport,
  fetchDesiredScreenAssignments,
  fetchOpsNodeCache,
  fetchOpsNodeRuntimeStatus,
  fetchOpsNodes,
  fetchProfiles,
  openFleetStream,
  openGuide,
  sendOpsNodeInput,
  setOpsNodeDisplayMode,
  updateOpsNode,
} from "../lib/api";
import {
  fetchResourceSnapshot,
  type Media,
  type MediaIngestJob,
  importResources,
  fetchIngestJobs,
  fetchIngestJob,
  startEdenIngestJob,
  startUploadIngestJob,
  startYouTubeIngestJob,
  deleteBlock,
  deleteChannel,
  deleteMedia,
  deletePlaylist,
  deleteProfile,
  type ResourcePayload,
} from "../lib/controlApi";
import type {
  FleetPi,
  FleetPiHealth,
  OpsNodeRecord,
  OpsNodeBootstrapResponse,
  OpsNodeDisplayModeResponse,
  OpsApplyResult,
  OpsApplyResponse,
  OpsApplyTarget,
  OpsProfile,
} from "../types";
import type { OpsNodeCacheInspectResponse } from "@chiba-cable3/contracts";
import type { OpsNodeRuntimeStatusResponse } from "@chiba-cable3/contracts";
import type { NodeRuntimeInputAction } from "@chiba-cable3/contracts";
import type { ResourcePickerItem } from "../components/ResourcePickerModal";
import {
  useOpsUiStore,
  type BuilderMode,
} from "../store/uiStore";
import {
  EMPTY_BLOCK_DRAFT,
  EMPTY_CHANNEL_DRAFT,
  EMPTY_DRAFTS,
  EMPTY_PLAYLIST_DRAFT,
  EMPTY_PROFILE_DRAFT,
  TABLE_PAGE_SIZE,
  emptyNodeDraft,
  formatBytes,
  formatDurationSec,
  fromResourcePayload,
  blockItemsFromUnknownBlock,
  inferUploadPreviewKind,
  isLikelyVideoSource,
  isVideoMedia,
  mediaPreviewSource,
  nodeDraftFromRecord,
  paginateRows,
  parseTargetFromKioskUrl,
  playlistMediaIdsFromSnapshot,
  readOpsViewFromUrl,
  readString,
  statusBadge,
  summarizeApplyResult,
  tableRangeLabel,
  toOptionBool,
  toPendingFleetHealth,
  toResourcePayload,
  triggerDownload,
  updateOpsUrl,
  type CatalogOption,
  type DraftBlock,
  type DraftChannel,
  type DraftPlaylist,
  type DraftProfile,
  type DraftStore,
  type IngestSource,
  type NodeDraft,
  type OptionBool,
  type OptionHud,
  type OptionMode,
  type OptionRotate,
  type QuickSendTarget,
  type TargetKind,
  type UploadPreviewItem,
} from "../lib/opsModel";
import {
  buildWebLaunchConfigFromEntries,
  type WebLaunchArgEntry,
} from "../lib/webLaunchArgs";

const BOOTSTRAP_LOG_MAX_CHARS = 120_000;
const UPLOAD_TITLE_MAX_LENGTH = 256;

function defaultUploadTitle(filename: string): string {
  const trimmed = filename.trim();
  if (!trimmed) return "Untitled";
  const dot = trimmed.lastIndexOf(".");
  const base = dot > 0 ? trimmed.slice(0, dot) : trimmed;
  const normalized = base.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  const candidate = normalized || base || trimmed;
  return candidate.slice(0, UPLOAD_TITLE_MAX_LENGTH);
}

function appendLogChunk(current: string, chunk: string): string {
  if (!chunk) return current;
  if (current.length >= BOOTSTRAP_LOG_MAX_CHARS) return current;
  const next = current + chunk;
  if (next.length <= BOOTSTRAP_LOG_MAX_CHARS) return next;
  return next.slice(0, BOOTSTRAP_LOG_MAX_CHARS);
}

function buildServerOrderMap(rows: Array<{ id: string }>): Map<string, number> {
  const order = new Map<string, number>();
  rows.forEach((row, index) => {
    order.set(row.id, index);
  });
  return order;
}

function sortByServerOrder<T extends { id: string }>(
  rows: T[],
  order: Map<string, number>
): T[] {
  return [...rows].sort((a, b) => {
    const left = order.get(a.id);
    const right = order.get(b.id);
    if (typeof left === "number" && typeof right === "number") return left - right;
    if (typeof left === "number") return -1;
    if (typeof right === "number") return 1;
    return a.id.localeCompare(b.id);
  });
}

export function useOpsAppModel() {
  const isMobile = useMediaQuery("(max-width: 48em)");
  const controlOpen = useOpsUiStore((s) => s.controlOpen);
  const setControlOpen = useOpsUiStore((s) => s.setControlOpen);
  const toggleControlOpen = useOpsUiStore((s) => s.toggleControlOpen);
  const mainTab = useOpsUiStore((s) => s.mainTab);
  const setMainTab = useOpsUiStore((s) => s.setMainTab);
  const builderTab = useOpsUiStore((s) => s.builderTab);
  const setBuilderTab = useOpsUiStore((s) => s.setBuilderTab);
  const fleetView = useOpsUiStore((s) => s.fleetView);
  const setFleetView = useOpsUiStore((s) => s.setFleetView);
  const mediaLibrarySection = useOpsUiStore((s) => s.mediaLibrarySection);
  const setMediaLibrarySection = useOpsUiStore((s) => s.setMediaLibrarySection);
  const mediaPickerOpen = useOpsUiStore((s) => s.mediaPickerOpen);
  const setMediaPickerOpen = useOpsUiStore((s) => s.setMediaPickerOpen);
  const targetPickerOpen = useOpsUiStore((s) => s.targetPickerOpen);
  const setTargetPickerOpen = useOpsUiStore((s) => s.setTargetPickerOpen);
  const quickSendOpen = useOpsUiStore((s) => s.quickSendOpen);
  const setQuickSendOpen = useOpsUiStore((s) => s.setQuickSendOpen);
  const nodeEditorOpen = useOpsUiStore((s) => s.nodeEditorOpen);
  const setNodeEditorOpen = useOpsUiStore((s) => s.setNodeEditorOpen);
  const assignTargetOpen = useOpsUiStore((s) => s.assignTargetOpen);
  const setAssignTargetOpen = useOpsUiStore((s) => s.setAssignTargetOpen);
  const [profiles, setProfiles] = useState<OpsProfile[]>([]);
  const [fleetMap, setFleetMap] = useState<Record<string, FleetPiHealth>>({});
  const [opsNodeMap, setOpsNodeMap] = useState<Record<string, OpsNodeRecord>>(
    {}
  );
  const [activeRegistryId, setActiveRegistryId] = useState("local");
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [nodeDraft, setNodeDraft] = useState<NodeDraft>(() => emptyNodeDraft());
  const [nodeSaving, setNodeSaving] = useState(false);
  const [loadingFleet, setLoadingFleet] = useState(false);
  const [search, setSearch] = useState("");
  const [lastTick, setLastTick] = useState<number | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [applyResult, setApplyResult] = useState<OpsApplyResponse | null>(null);
  const [draftStore, setDraftStore] = useState<DraftStore>(EMPTY_DRAFTS);
  const [serverSnapshot, setServerSnapshot] = useState<ResourcePayload | null>(
    null
  );
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);
  const [builderBusy, setBuilderBusy] = useState(false);
  const [quickSendTarget, setQuickSendTarget] =
    useState<QuickSendTarget | null>(null);
  const [quickSendNodeIds, setQuickSendNodeIds] = useState<string[]>([]);
  const [quickSendQuery, setQuickSendQuery] = useState("");
  const [quickSendBusy, setQuickSendBusy] = useState(false);
  const [playlistDragIndex, setPlaylistDragIndex] = useState<number | null>(
    null
  );
  const [playlistDropIndex, setPlaylistDropIndex] = useState<number | null>(
    null
  );
  const [fleetPage, setFleetPage] = useState(1);
  const [mediaLibraryPage, setMediaLibraryPage] = useState(1);
  const [playlistTablePage, setPlaylistTablePage] = useState(1);
  const [blockTablePage, setBlockTablePage] = useState(1);
  const [channelTablePage, setChannelTablePage] = useState(1);
  const [profileTablePage, setProfileTablePage] = useState(1);
  const [mediaDeleteBusy, setMediaDeleteBusy] = useState(false);
  const [mediaSaveBusy, setMediaSaveBusy] = useState(false);
  const [serverMediaQuery, setServerMediaQuery] = useState("");
  const [serverMediaSourceFilter, setServerMediaSourceFilter] = useState<
    "all" | "path" | "url"
  >("all");
  const [selectedServerMediaId, setSelectedServerMediaId] = useState<
    string | null
  >(null);
  const [mediaDetailId, setMediaDetailId] = useState<string | null>(null);
  const [mediaFeedLimit, setMediaFeedLimit] = useState(24);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(
    null
  );
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(
    null
  );
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(
    null
  );
  const [nodeWorkspaceFocusId, setNodeWorkspaceFocusId] = useState("");
  const [nodeStash, setNodeStash] =
    useState<OpsNodeCacheInspectResponse | null>(null);
  const [nodeStashBusy, setNodeStashBusy] = useState(false);
  const [nodeStashClearing, setNodeStashClearing] = useState(false);
  const [nodeStashError, setNodeStashError] = useState<string | null>(null);
  const [nodeStashFilterQuery, setNodeStashFilterQuery] = useState("");
  const [nodeStashSort, setNodeStashSort] = useState<
    "name" | "size_desc" | "size_asc" | "updated_desc" | "updated_asc"
  >("updated_desc");
  const [nodeRuntimeStatus, setNodeRuntimeStatus] =
    useState<OpsNodeRuntimeStatusResponse | null>(null);
  const [nodeRuntimeBusy, setNodeRuntimeBusy] = useState(false);
  const [nodeRuntimeError, setNodeRuntimeError] = useState<string | null>(null);
  const [nodeInputBusy, setNodeInputBusy] = useState(false);
  const [nodeInputError, setNodeInputError] = useState<string | null>(null);
  const [nodeInputLastAction, setNodeInputLastAction] = useState<string | null>(
    null
  );
  const [nodeBootstrapBusy, setNodeBootstrapBusy] = useState(false);
  const [nodeBootstrapError, setNodeBootstrapError] = useState<string | null>(null);
  const [nodeBootstrapResult, setNodeBootstrapResult] =
    useState<OpsNodeBootstrapResponse | null>(null);
  const [nodeBootstrapStdout, setNodeBootstrapStdout] = useState("");
  const [nodeBootstrapStderr, setNodeBootstrapStderr] = useState("");
  const [nodeDisplayModeBusy, setNodeDisplayModeBusy] = useState(false);
  const [nodeDisplayModeError, setNodeDisplayModeError] = useState<string | null>(null);
  const [nodeDisplayModeResult, setNodeDisplayModeResult] =
    useState<OpsNodeDisplayModeResponse | null>(null);
  const [ingestBusy, setIngestBusy] = useState(false);
  const [ingestSource, setIngestSource] = useState<IngestSource>("youtube");
  const [ingestStep, setIngestStep] = useState<1 | 2 | 3>(1);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubeTitle, setYoutubeTitle] = useState("");
  const [youtubeArtist, setYoutubeArtist] = useState("");
  const [youtubeDescription, setYoutubeDescription] = useState("");
  const [webUrl, setWebUrl] = useState("");
  const [webTitle, setWebTitle] = useState("");
  const [webArtist, setWebArtist] = useState("");
  const [webDescription, setWebDescription] = useState("");
  const [webCache, setWebCache] = useState(true);
  const [webLaunchProfile, setWebLaunchProfile] = useState<
    "none" | "home_assistant_login"
  >("none");
  const [webLaunchArgsEntries, setWebLaunchArgsEntries] = useState<
    WebLaunchArgEntry[]
  >([]);
  const [edenInput, setEdenInput] = useState("");
  const [edenCreatePlaylist, setEdenCreatePlaylist] = useState(false);
  const [edenArtist, setEdenArtist] = useState("");
  const [edenDescription, setEdenDescription] = useState("");
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadTitleOverrides, setUploadTitleOverrides] = useState<string[]>([]);
  const [uploadArtistOverrides, setUploadArtistOverrides] = useState<string[]>([]);
  const [uploadDescriptionOverrides, setUploadDescriptionOverrides] = useState<
    string[]
  >([]);
  const [uploadArtist, setUploadArtist] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadCreatePlaylist, setUploadCreatePlaylist] = useState(false);
  const [uploadPlaylistTitle, setUploadPlaylistTitle] = useState("");
  const [uploadDropError, setUploadDropError] = useState<string | null>(null);
  const [ingestJobs, setIngestJobs] = useState<MediaIngestJob[]>([]);
  const ingestPollersRef = useRef<Record<string, number>>({});
  const ingestJobStatusRef = useRef<Record<string, MediaIngestJob["status"]>>(
    {}
  );
  const ingestWatchWarnedRef = useRef(false);

  const [applyKind, setApplyKind] = useState<OpsApplyTarget>("profile");
  const [applyId, setApplyId] = useState("");
  const [optMode, setOptMode] = useState<OptionMode>("inherit");
  const [optLock, setOptLock] = useState<OptionBool>("inherit");
  const [optQr, setOptQr] = useState<OptionBool>("inherit");
  const [optPlaylist, setOptPlaylist] = useState<OptionBool>("inherit");
  const [optNosplash, setOptNosplash] = useState<OptionBool>("inherit");
  const [optRemoteInput, setOptRemoteInput] = useState<OptionBool>("inherit");
  const [optRemoteApp, setOptRemoteApp] = useState<OptionBool>("inherit");
  const [optRemoteMic, setOptRemoteMic] = useState<OptionBool>("inherit");
  const [optRemoteGuide, setOptRemoteGuide] = useState<OptionBool>("inherit");
  const [optHud, setOptHud] = useState<OptionHud>("inherit");
  const [optHudSec, setOptHudSec] = useState<number | "">("");
  const [optTheme, setOptTheme] = useState("");
  const [optRotate, setOptRotate] = useState<OptionRotate>("inherit");

  const [playlistDraft, setPlaylistDraft] =
    useState<DraftPlaylist>(EMPTY_PLAYLIST_DRAFT);
  const [blockDraft, setBlockDraft] = useState<DraftBlock>(EMPTY_BLOCK_DRAFT);
  const [channelDraft, setChannelDraft] =
    useState<DraftChannel>(EMPTY_CHANNEL_DRAFT);
  const [profileDraft, setProfileDraft] =
    useState<DraftProfile>(EMPTY_PROFILE_DRAFT);

  const resetIngestComposer = useCallback(() => {
    setIngestBusy(false);
    setIngestSource("youtube");
    setIngestStep(1);
    setYoutubeUrl("");
    setYoutubeTitle("");
    setYoutubeArtist("");
    setYoutubeDescription("");
    setWebUrl("");
    setWebTitle("");
    setWebArtist("");
    setWebDescription("");
    setWebCache(true);
    setWebLaunchProfile("none");
    setWebLaunchArgsEntries([]);
    setEdenInput("");
    setEdenCreatePlaylist(false);
    setEdenArtist("");
    setEdenDescription("");
    setUploadFiles([]);
    setUploadTitleOverrides([]);
    setUploadArtistOverrides([]);
    setUploadDescriptionOverrides([]);
    setUploadArtist("");
    setUploadDescription("");
    setUploadCreatePlaylist(false);
    setUploadPlaylistTitle("");
    setUploadDropError(null);
  }, []);

  const resetMediaBrowserState = useCallback(() => {
    setServerMediaQuery("");
    setServerMediaSourceFilter("all");
    setSelectedServerMediaId(null);
    setMediaDetailId(null);
    setMediaLibraryPage(1);
    setMediaFeedLimit(24);
  }, []);

  const resetPlaylistBrowserState = useCallback(() => {
    setServerMediaQuery("");
    setSelectedPlaylistId(null);
    setPlaylistTablePage(1);
  }, []);

  const resetBlockBrowserState = useCallback(() => {
    setServerMediaQuery("");
    setSelectedBlockId(null);
    setBlockTablePage(1);
  }, []);

  const resetChannelBrowserState = useCallback(() => {
    setServerMediaQuery("");
    setSelectedChannelId(null);
    setChannelTablePage(1);
  }, []);

  const resetProfileBrowserState = useCallback(() => {
    setServerMediaQuery("");
    setSelectedProfileId(null);
    setProfileTablePage(1);
  }, []);

  const resetFleetWorkspaceState = useCallback(() => {
    setFleetView("table");
    setNodeEditorOpen(false);
    setAssignTargetOpen(false);
    setActiveNodeId(null);
    setNodeStash(null);
    setNodeStashBusy(false);
    setNodeStashClearing(false);
    setNodeStashError(null);
    setNodeStashFilterQuery("");
    setNodeStashSort("updated_desc");
    setNodeRuntimeStatus(null);
    setNodeRuntimeBusy(false);
    setNodeRuntimeError(null);
    setNodeInputBusy(false);
    setNodeInputError(null);
    setNodeInputLastAction(null);
    setNodeBootstrapBusy(false);
    setNodeBootstrapError(null);
    setNodeBootstrapResult(null);
    setNodeBootstrapStdout("");
    setNodeBootstrapStderr("");
    setNodeDisplayModeBusy(false);
    setNodeDisplayModeError(null);
    setNodeDisplayModeResult(null);
  }, [setAssignTargetOpen, setNodeEditorOpen, setFleetView]);

  const refreshCatalogAndProfiles = useCallback(async () => {
    try {
      const profilesRes = await fetchProfiles();
      setProfiles(profilesRes.profiles ?? []);
    } catch (error) {
      notifications.show({
        color: "red",
        title: "Catalog refresh failed",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }, []);

  const refreshServerSnapshot = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = Boolean(options?.silent);
      if (!silent) setLoadingSnapshot(true);
      try {
        const result = await fetchResourceSnapshot();
        setDraftStore(fromResourcePayload(result.snapshot));
        setServerSnapshot(result.snapshot);
      } catch (error) {
        notifications.show({
          color: "orange",
          title: "Server snapshot refresh warning",
          message: error instanceof Error ? error.message : String(error),
        });
      } finally {
        if (!silent) setLoadingSnapshot(false);
      }
    },
    []
  );

  const refreshNodesInventory = useCallback(async () => {
    try {
      const payload = await fetchOpsNodes();
      setActiveRegistryId(payload.registryId || "local");
      setOpsNodeMap(
        Object.fromEntries(payload.nodes.map((node) => [node.nodeId, node]))
      );
    } catch (error) {
      notifications.show({
        color: "orange",
        title: "Node inventory refresh warning",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }, []);

  const refreshFleet = useCallback(() => {
    setLoadingFleet(true);
    const stream = openFleetStream({
      onMeta: (meta) => {
        // Seed rows from registry immediately so the full list is visible
        // before health probes finish, and prune stale rows from prior registries.
        setFleetMap((prev) => {
          const next: Record<string, FleetPiHealth> = {};
          for (const pi of meta.pis) {
            const existing = prev[pi.id];
            if (existing) {
              next[pi.id] = {
                ...existing,
                registryId: pi.registryId,
                host: pi.host,
                ip: pi.ip,
                nodeName: pi.nodeName,
                resolvedIp: pi.ip ?? pi.host ?? existing.resolvedIp,
              };
            } else {
              next[pi.id] = toPendingFleetHealth(pi);
            }
          }
          return next;
        });
      },
      onPi: (pi) => {
        setFleetMap((prev) => ({ ...prev, [pi.id]: pi }));
      },
      onDone: () => {
        setLoadingFleet(false);
        setLastTick(Date.now());
      },
      onError: (msg) => {
        setLoadingFleet(false);
        notifications.show({
          color: "orange",
          title: "Fleet stream warning",
          message: msg,
        });
      },
    });
    return () => stream.close();
  }, []);

  useEffect(() => {
    refreshCatalogAndProfiles();
    refreshNodesInventory();
    refreshServerSnapshot();
  }, [refreshCatalogAndProfiles, refreshNodesInventory, refreshServerSnapshot]);

  useEffect(() => {
    const close = refreshFleet();
    return close;
  }, [refreshFleet]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = window.setInterval(() => refreshFleet(), 8000);
    return () => window.clearInterval(id);
  }, [autoRefresh, refreshFleet]);

  useEffect(() => {
    if (isMobile) setControlOpen(false);
  }, [isMobile]);

  const fleetRows = useMemo(() => {
    return Object.values(fleetMap)
      .map((row) => {
        const node = opsNodeMap[row.id];
        if (!node) return row;
        return {
          ...row,
          registryId: node.registryId,
          host: node.host || row.host,
          ip: node.ip || row.ip,
          nodeName: node.nodeName || row.nodeName,
        };
      })
      .sort((a, b) => a.id.localeCompare(b.id));
  }, [fleetMap, opsNodeMap]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return fleetRows;
    return fleetRows.filter((row) => {
      const haystack = [row.id, row.nodeName, row.host, row.ip]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [fleetRows, search]);

  useEffect(() => {
    setSelectedNodeIds((prev) => prev.filter((id) => fleetMap[id]));
  }, [fleetMap]);

  useEffect(() => {
    if (selectedNodeIds.length === 0) {
      setNodeWorkspaceFocusId("");
      return;
    }
    if (
      !nodeWorkspaceFocusId ||
      !selectedNodeIds.includes(nodeWorkspaceFocusId)
    ) {
      setNodeWorkspaceFocusId(selectedNodeIds[0] || "");
    }
  }, [nodeWorkspaceFocusId, selectedNodeIds]);

  const selectedNode = useMemo(
    () => (activeNodeId ? fleetMap[activeNodeId] ?? null : null),
    [activeNodeId, fleetMap]
  );

  const metrics = useMemo(() => {
    const total = fleetRows.length;
    const online = fleetRows.filter(
      (r) => r.connectivity?.status === "online"
    ).length;
    const degraded = fleetRows.filter(
      (r) =>
        r.connectivity?.status === "degraded" ||
        r.connectivity?.status === "offline"
    ).length;
    const updating = fleetRows.filter((r) => r.needsUpdate === true).length;
    return { total, online, degraded, updating };
  }, [fleetRows]);

  const profileOptions = useMemo<CatalogOption[]>(() => {
    const byId = new Map<string, CatalogOption>();
    for (const row of serverSnapshot?.profiles ?? []) {
      const label = (row.title || "").trim() || row.id;
      byId.set(row.id, {
        value: row.id,
        label,
      });
    }
    for (const row of draftStore.profiles) {
      const label = row.title.trim() || row.id;
      byId.set(row.id, {
        value: row.id,
        label,
      });
    }
    for (const row of profiles) {
      byId.set(row.id, {
        value: row.id,
        label: row.id,
      });
    }
    return Array.from(byId.values()).sort((a, b) =>
      a.value.localeCompare(b.value)
    );
  }, [draftStore.profiles, profiles, serverSnapshot?.profiles]);

  const channelOptions = useMemo<CatalogOption[]>(() => {
    const byId = new Map<string, CatalogOption>();
    for (const row of serverSnapshot?.channels ?? []) {
      const label = [row.number || "", row.name || ""].filter(Boolean).join(" • ") || row.id;
      byId.set(row.id, {
        value: row.id,
        label,
      });
    }
    for (const row of draftStore.channels) {
      const label = row.title.trim() || row.id;
      byId.set(row.id, {
        value: row.id,
        label,
      });
    }
    return Array.from(byId.values()).sort((a, b) =>
      a.value.localeCompare(b.value)
    );
  }, [draftStore.channels, serverSnapshot?.channels]);

  const blockOptions = useMemo<CatalogOption[]>(() => {
    const byId = new Map<string, CatalogOption>();
    for (const row of serverSnapshot?.blocks ?? []) {
      const label = (row.title || "").trim() || row.id;
      byId.set(row.id, {
        value: row.id,
        label,
      });
    }
    for (const row of draftStore.blocks) {
      const label = row.title.trim() || row.id;
      byId.set(row.id, {
        value: row.id,
        label,
      });
    }
    return Array.from(byId.values()).sort((a, b) =>
      a.value.localeCompare(b.value)
    );
  }, [draftStore.blocks, serverSnapshot?.blocks]);

  const playlistOptions = useMemo<CatalogOption[]>(() => {
    const byId = new Map<string, CatalogOption>();
    for (const row of serverSnapshot?.playlists ?? []) {
      const label = [row.title || "", row.artist || ""].filter(Boolean).join(" • ") || row.id;
      byId.set(row.id, {
        value: row.id,
        label,
      });
    }
    for (const row of draftStore.playlists) {
      const label = [row.title.trim(), row.artist.trim()]
        .filter(Boolean)
        .join(" • ") || row.id;
      byId.set(row.id, {
        value: row.id,
        label,
      });
    }
    return Array.from(byId.values()).sort((a, b) =>
      a.value.localeCompare(b.value)
    );
  }, [draftStore.playlists, serverSnapshot?.playlists]);

  const mediaOptions = useMemo<CatalogOption[]>(() => {
    const byId = new Map<string, CatalogOption>();
    for (const row of serverSnapshot?.media ?? []) {
      const label = [row.title || "", row.artist || ""].filter(Boolean).join(" • ") || row.id;
      byId.set(row.id, {
        value: row.id,
        label,
      });
    }
    for (const row of draftStore.media) {
      const label = [row.title.trim(), row.artist.trim()]
        .filter(Boolean)
        .join(" • ") || row.id;
      byId.set(row.id, {
        value: row.id,
        label,
      });
    }
    return Array.from(byId.values()).sort((a, b) =>
      a.value.localeCompare(b.value)
    );
  }, [draftStore.media, serverSnapshot?.media]);

  const currentApplyOptions = useMemo<CatalogOption[]>(() => {
    if (applyKind === "profile") return profileOptions;
    if (applyKind === "channel") return channelOptions;
    if (applyKind === "block") return blockOptions;
    if (applyKind === "playlist") return playlistOptions;
    return mediaOptions;
  }, [
    applyKind,
    blockOptions,
    channelOptions,
    mediaOptions,
    playlistOptions,
    profileOptions,
  ]);

  const selectedNodeRows = useMemo(
    () =>
      selectedNodeIds
        .map((id) => fleetMap[id])
        .filter((row): row is FleetPiHealth => Boolean(row)),
    [fleetMap, selectedNodeIds]
  );

  const nodeWorkspaceFocus = useMemo(
    () =>
      nodeWorkspaceFocusId ? fleetMap[nodeWorkspaceFocusId] ?? null : null,
    [fleetMap, nodeWorkspaceFocusId]
  );

  const workspaceSingleNodeId = useMemo(() => {
    if (fleetView !== "workspace") return "";
    if (selectedNodeIds.length !== 1) return "";
    return nodeWorkspaceFocus?.id || "";
  }, [fleetView, nodeWorkspaceFocus?.id, selectedNodeIds.length]);

  const filteredNodeStashItems = useMemo(() => {
    const files = (nodeStash?.cache?.files ?? []).map((file) => ({
      fileName: readString((file as any)?.name),
      sizeBytes:
        typeof (file as any)?.size === "number" ? (file as any).size : 0,
      updatedAtMs:
        typeof (file as any)?.mtimeMs === "number" ? (file as any).mtimeMs : 0,
    }));
    const query = nodeStashFilterQuery.trim().toLowerCase();
    const filtered = query
      ? files.filter((file) => file.fileName.toLowerCase().includes(query))
      : files;
    return [...filtered].sort((a, b) => {
      if (nodeStashSort === "name") return a.fileName.localeCompare(b.fileName);
      if (nodeStashSort === "size_desc") return b.sizeBytes - a.sizeBytes;
      if (nodeStashSort === "size_asc") return a.sizeBytes - b.sizeBytes;
      if (nodeStashSort === "updated_asc") return a.updatedAtMs - b.updatedAtMs;
      return b.updatedAtMs - a.updatedAtMs;
    });
  }, [nodeStash, nodeStashFilterQuery, nodeStashSort]);

  const quickSendRows = useMemo(() => {
    const q = quickSendQuery.trim().toLowerCase();
    if (!q) return fleetRows;
    return fleetRows.filter((row) => {
      const haystack = [row.id, row.nodeName, row.host, row.ip]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [fleetRows, quickSendQuery]);

  const toggleNodeSelection = useCallback((id: string, checked: boolean) => {
    setSelectedNodeIds((prev) => {
      if (checked) return Array.from(new Set([...prev, id]));
      return prev.filter((x) => x !== id);
    });
  }, []);

  const selectVisible = useCallback(() => {
    setSelectedNodeIds(
      Array.from(
        new Set([...selectedNodeIds, ...filteredRows.map((r) => r.id)])
      )
    );
  }, [selectedNodeIds, filteredRows]);

  const clearSelection = useCallback(() => setSelectedNodeIds([]), []);

  useEffect(() => {
    if (mainTab !== "fleet") {
      setSelectedNodeIds([]);
      setLastTick(null);
    }
  }, [mainTab]);
  const openNodeWorkspace = useCallback(() => {
    if (selectedNodeIds.length === 0) return;
    if (
      !nodeWorkspaceFocusId ||
      !selectedNodeIds.includes(nodeWorkspaceFocusId)
    ) {
      setNodeWorkspaceFocusId(selectedNodeIds[0] || "");
    }
    setFleetView("workspace");
  }, [nodeWorkspaceFocusId, selectedNodeIds]);

  const refreshNodeStash = useCallback(
    async (nodeId: string, silent = false) => {
      const id = nodeId.trim();
      if (!id) return;
      if (!silent) setNodeStashBusy(true);
      setNodeStashError(null);
      try {
        const result = await fetchOpsNodeCache(id);
        setNodeStash(result);
      } catch (error) {
        if (!silent) setNodeStash(null);
        setNodeStashError(
          error instanceof Error ? error.message : String(error)
        );
      } finally {
        if (!silent) setNodeStashBusy(false);
      }
    },
    []
  );

  const refreshNodeRuntime = useCallback(
    async (nodeId: string, silent = false) => {
      const id = nodeId.trim();
      if (!id) return;
      if (!silent) setNodeRuntimeBusy(true);
      setNodeRuntimeError(null);
      try {
        const result = await fetchOpsNodeRuntimeStatus(id);
        setNodeRuntimeStatus(result);
      } catch (error) {
        if (!silent) setNodeRuntimeStatus(null);
        setNodeRuntimeError(
          error instanceof Error ? error.message : String(error)
        );
      } finally {
        if (!silent) setNodeRuntimeBusy(false);
      }
    },
    []
  );

  const sendNodeInputAction = useCallback(
    async (action: NodeRuntimeInputAction) => {
      const nodeId = workspaceSingleNodeId.trim();
      if (!nodeId) {
        notifications.show({
          color: "red",
          title: "No node selected",
          message: "Select one node before sending runtime input.",
        });
        return;
      }
      setNodeInputBusy(true);
      setNodeInputError(null);
      try {
        const result = await sendOpsNodeInput(nodeId, { action });
        const actionLabel =
          action.kind === "key"
            ? `key:${action.key}`
            : action.kind === "text"
            ? "text"
            : action.kind === "mouse_move"
            ? "mouse_move"
            : action.kind === "mouse_button"
            ? `mouse_button:${action.state}:${action.button || "left"}`
            : `mouse_click:${action.button || "left"}`;
        setNodeInputLastAction(actionLabel);
        if (result.code !== 0) {
          const detail = (result.stderr || result.stdout || "unknown_error")
            .split("\n")
            .filter(Boolean)[0];
          setNodeInputError(detail || `runtime_input_exit_${result.code}`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setNodeInputError(message);
        notifications.show({
          color: "red",
          title: "Node input failed",
          message,
        });
      } finally {
        setNodeInputBusy(false);
      }
    },
    [workspaceSingleNodeId]
  );

  const bootstrapNodeRuntime = useCallback(
    async (payload: {
      controlApiUrl: string;
      nodeControlApiUrl: string;
      guideBaseUrl: string;
      namespace?: string;
      registryId?: string;
      endpointsOnly?: boolean;
      sshUser?: string;
      sshPort?: number;
      sshPassword?: string;
      host?: string;
      guidePort?: number;
      dryRun?: boolean;
    }) => {
      const nodeId = workspaceSingleNodeId.trim();
      if (!nodeId) {
        notifications.show({
          color: "red",
          title: "No node selected",
          message: "Select one node before running bootstrap.",
        });
        return;
      }
      setNodeBootstrapBusy(true);
      setNodeBootstrapError(null);
      setNodeBootstrapResult(null);
      setNodeBootstrapStdout("");
      setNodeBootstrapStderr("");
      try {
        const result = await bootstrapOpsNodeStream(
          nodeId,
          {
            controlApiUrl: payload.controlApiUrl.trim(),
            nodeControlApiUrl: payload.nodeControlApiUrl.trim(),
            guideBaseUrl: payload.guideBaseUrl.trim(),
            namespace: payload.namespace?.trim() || undefined,
            registryId:
              payload.registryId?.trim() || activeRegistryId || undefined,
            endpointsOnly: payload.endpointsOnly === true,
            sshUser: payload.sshUser?.trim() || undefined,
            sshPort:
              typeof payload.sshPort === "number" && Number.isFinite(payload.sshPort)
                ? payload.sshPort
                : undefined,
            sshPassword: payload.sshPassword?.trim() || undefined,
            host: payload.host?.trim() || undefined,
            guidePort:
              typeof payload.guidePort === "number" && Number.isFinite(payload.guidePort)
                ? payload.guidePort
                : undefined,
            dryRun: payload.dryRun === true,
          },
          {
            onStdout: (chunk) => {
              setNodeBootstrapStdout((current) => appendLogChunk(current, chunk));
            },
            onStderr: (chunk) => {
              setNodeBootstrapStderr((current) => appendLogChunk(current, chunk));
            },
          }
        );
        setNodeBootstrapStdout(result.stdout || "");
        setNodeBootstrapStderr(result.stderr || "");
        setNodeBootstrapResult(result);
        const code =
          typeof result.code === "number" ? String(result.code) : "n/a";
        const suffix = result.dryRun ? "dry run" : `exit ${code}`;
        notifications.show({
          color: result.ok ? "teal" : "red",
          title: result.ok
            ? "Node bootstrap finished"
            : "Node bootstrap failed",
          message: `${nodeId} • ${suffix}`,
        });
        if (!result.ok) {
          const message = (result.stderr || result.stdout || "bootstrap_failed")
            .split("\n")
            .filter(Boolean)[0];
          setNodeBootstrapError(message || "bootstrap_failed");
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setNodeBootstrapError(message);
        notifications.show({
          color: "red",
          title: "Node bootstrap failed",
          message,
        });
      } finally {
        setNodeBootstrapBusy(false);
      }
    },
    [activeRegistryId, workspaceSingleNodeId]
  );

  const setNodeDisplayMode = useCallback(
    async (payload: {
      mode: "native" | "2160p30" | "1440p60" | "1080p60" | "900p60" | "720p60";
      restartDisplayManager?: boolean;
      namespace?: string;
      registryId?: string;
      host?: string;
      sshUser?: string;
      sshPort?: number;
      sshPassword?: string;
      output?: string;
      dryRun?: boolean;
    }) => {
      const nodeId = workspaceSingleNodeId.trim();
      if (!nodeId) {
        notifications.show({
          color: "red",
          title: "No node selected",
          message: "Select one node before applying display mode.",
        });
        return;
      }
      setNodeDisplayModeBusy(true);
      setNodeDisplayModeError(null);
      try {
        const result = await setOpsNodeDisplayMode(nodeId, {
          mode: payload.mode,
          restartDisplayManager: payload.restartDisplayManager === true,
          namespace: payload.namespace?.trim() || undefined,
          registryId: payload.registryId?.trim() || activeRegistryId || undefined,
          host: payload.host?.trim() || undefined,
          sshUser: payload.sshUser?.trim() || undefined,
          sshPort:
            typeof payload.sshPort === "number" && Number.isFinite(payload.sshPort)
              ? payload.sshPort
              : undefined,
          sshPassword: payload.sshPassword?.trim() || undefined,
          output: payload.output?.trim() || undefined,
          dryRun: payload.dryRun === true,
        });
        setNodeDisplayModeResult(result);
        const code =
          typeof result.code === "number" ? String(result.code) : "n/a";
        const suffix = result.dryRun ? "dry run" : `exit ${code}`;
        notifications.show({
          color: result.ok ? "teal" : "red",
          title: result.ok
            ? "Display mode applied"
            : "Display mode apply failed",
          message: `${nodeId} • ${result.mode} • ${suffix}`,
        });
        if (!result.ok) {
          const message = (result.stderr || result.stdout || "display_mode_failed")
            .split("\n")
            .filter(Boolean)[0];
          setNodeDisplayModeError(message || "display_mode_failed");
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setNodeDisplayModeError(message);
        notifications.show({
          color: "red",
          title: "Display mode apply failed",
          message,
        });
      } finally {
        setNodeDisplayModeBusy(false);
      }
    },
    [activeRegistryId, workspaceSingleNodeId]
  );

  const clearNodeStash = useCallback(async () => {
    const nodeId = workspaceSingleNodeId.trim();
    if (!nodeId) return;
    const ok = window.confirm(
      `Clear all cached media files on node "${nodeId}"?`
    );
    if (!ok) return;
    setNodeStashClearing(true);
    setNodeStashError(null);
    try {
      const result = await clearOpsNodeCache(nodeId);
      setNodeStash({
        ok: true,
        nodeId: result.nodeId,
        registryId: result.registryId,
        namespace: result.namespace,
        host: result.host,
        nodePort: result.nodePort,
        cache: result.after,
      });
      notifications.show({
        color: "teal",
        title: "Node stash cleared",
        message: `${result.deletedFiles} file(s) removed • ${formatBytes(
          result.deletedBytes
        )} reclaimed`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setNodeStashError(message);
      notifications.show({
        color: "red",
        title: "Failed to clear node stash",
        message,
      });
    } finally {
      setNodeStashClearing(false);
    }
  }, [workspaceSingleNodeId]);

  const deleteNodeStashItem = useCallback(
    async (fileName: string) => {
      const nodeId = workspaceSingleNodeId.trim();
      const normalizedFileName = readString(fileName);
      if (!nodeId || !normalizedFileName) return;
      const ok = window.confirm(
        `Delete cached file "${normalizedFileName}" from node "${nodeId}"?`
      );
      if (!ok) return;
      setNodeStashClearing(true);
      setNodeStashError(null);
      try {
        const result = await deleteOpsNodeCacheFile(nodeId, normalizedFileName);
        setNodeStash({
          ok: true,
          nodeId: result.nodeId,
          registryId: result.registryId,
          namespace: result.namespace,
          host: result.host,
          nodePort: result.nodePort,
          cache: result.after,
        });
        notifications.show({
          color: "teal",
          title: "Cached file removed",
          message: `${result.fileName} • ${formatBytes(result.deletedBytes)} reclaimed`,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setNodeStashError(message);
        notifications.show({
          color: "red",
          title: "Failed to delete cached file",
          message,
        });
      } finally {
        setNodeStashClearing(false);
      }
    },
    [workspaceSingleNodeId]
  );

  useEffect(() => {
    if (!workspaceSingleNodeId) {
      setNodeStash(null);
      setNodeStashError(null);
      setNodeStashBusy(false);
      setNodeRuntimeStatus(null);
      setNodeRuntimeError(null);
      setNodeRuntimeBusy(false);
      setNodeInputError(null);
      setNodeInputLastAction(null);
      setNodeInputBusy(false);
      setNodeBootstrapBusy(false);
      setNodeBootstrapError(null);
      setNodeBootstrapResult(null);
      setNodeBootstrapStdout("");
      setNodeBootstrapStderr("");
      setNodeDisplayModeBusy(false);
      setNodeDisplayModeError(null);
      setNodeDisplayModeResult(null);
      return;
    }
    void refreshNodeStash(workspaceSingleNodeId);
    void refreshNodeRuntime(workspaceSingleNodeId);
  }, [
    refreshNodeRuntime,
    refreshNodeStash,
    workspaceSingleNodeId,
  ]);

  useEffect(() => {
    const nodeId = workspaceSingleNodeId.trim();
    if (!nodeId) return;
    const status = nodeRuntimeStatus?.status;
    if (!status) return;
    const cacheReady =
      typeof status.cacheReady === "number" && Number.isFinite(status.cacheReady)
        ? Math.max(0, Math.floor(status.cacheReady))
        : 0;
    const cacheTotal =
      typeof status.cacheTotal === "number" && Number.isFinite(status.cacheTotal)
        ? Math.max(0, Math.floor(status.cacheTotal))
        : 0;
    const phase = typeof status.phase === "string" ? status.phase.toLowerCase() : "";
    const shouldPoll = phase === "warming" || (cacheTotal > 0 && cacheReady < cacheTotal);
    if (!shouldPoll) return;
    const intervalId = window.setInterval(() => {
      void refreshNodeRuntime(nodeId, true);
    }, 1800);
    return () => window.clearInterval(intervalId);
  }, [
    nodeRuntimeStatus?.status,
    refreshNodeRuntime,
    workspaceSingleNodeId,
  ]);

  const openCreateNodeEditor = useCallback(() => {
    setEditingNodeId(null);
    setNodeDraft(emptyNodeDraft(activeRegistryId));
    setNodeEditorOpen(true);
  }, [activeRegistryId]);

  const openEditNodeEditor = useCallback(
    (nodeId: string) => {
      const existing = opsNodeMap[nodeId] || fleetMap[nodeId];
      if (!existing) return;
      setEditingNodeId(nodeId);
      setNodeDraft(nodeDraftFromRecord(existing));
      setNodeEditorOpen(true);
    },
    [fleetMap, opsNodeMap]
  );

  const saveNodeDraft = useCallback(async () => {
    const nodeId = nodeDraft.nodeId.trim();
    if (!nodeId) {
      notifications.show({
        color: "red",
        title: "Node id required",
        message: "Provide a node id before saving.",
      });
      return;
    }
    const payload = {
      registryId: nodeDraft.registryId.trim() || activeRegistryId,
      nodeId,
      host: nodeDraft.host.trim() || undefined,
      ip: nodeDraft.ip.trim() || undefined,
      nodeName: nodeDraft.nodeName.trim() || undefined,
      orientation: nodeDraft.orientation.trim() || undefined,
      displayRotate:
        nodeDraft.displayRotate.length > 0
          ? (Number(nodeDraft.displayRotate) as 0 | 90 | 180 | 270)
          : undefined,
      guidePort:
        typeof nodeDraft.guidePort === "number" &&
        Number.isFinite(nodeDraft.guidePort)
          ? nodeDraft.guidePort
          : undefined,
      nodePort:
        typeof nodeDraft.nodePort === "number" &&
        Number.isFinite(nodeDraft.nodePort)
          ? nodeDraft.nodePort
          : undefined,
      serverPort:
        typeof nodeDraft.serverPort === "number" &&
        Number.isFinite(nodeDraft.serverPort)
          ? nodeDraft.serverPort
          : undefined,
      apiKey: nodeDraft.apiKey.trim() || undefined,
    };
    try {
      setNodeSaving(true);
      if (editingNodeId) {
        await updateOpsNode(editingNodeId, {
          registryId: payload.registryId,
          host: payload.host,
          ip: payload.ip,
          nodeName: payload.nodeName,
          orientation: payload.orientation,
          displayRotate: payload.displayRotate,
          guidePort: payload.guidePort,
          nodePort: payload.nodePort,
          serverPort: payload.serverPort,
          apiKey: payload.apiKey,
        });
      } else {
        await createOpsNode(payload);
      }
      notifications.show({
        color: "teal",
        title: editingNodeId ? "Node updated" : "Node created",
        message: nodeId,
      });
      setNodeEditorOpen(false);
      await refreshNodesInventory();
      refreshFleet();
    } catch (error) {
      notifications.show({
        color: "red",
        title: editingNodeId ? "Node update failed" : "Node create failed",
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setNodeSaving(false);
    }
  }, [
    activeRegistryId,
    editingNodeId,
    nodeDraft,
    refreshFleet,
    refreshNodesInventory,
  ]);

  const removeNode = useCallback(
    async (nodeId: string) => {
      if (!window.confirm(`Delete node "${nodeId}" from registry inventory?`))
        return;
      try {
        await deleteOpsNode(nodeId);
        notifications.show({
          color: "teal",
          title: "Node deleted",
          message: nodeId,
        });
        if (activeNodeId === nodeId) setActiveNodeId(null);
        await refreshNodesInventory();
        refreshFleet();
      } catch (error) {
        notifications.show({
          color: "red",
          title: "Node delete failed",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    },
    [activeNodeId, refreshFleet, refreshNodesInventory]
  );

  const exportNodes = useCallback(async (format: "json" | "toml") => {
    try {
      const payload = await downloadOpsNodesExport(format);
      triggerDownload(payload.blob, payload.filename);
    } catch (error) {
      notifications.show({
        color: "red",
        title: "Node export failed",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }, []);

  const applyTargetToNodes = useCallback(
    async (args: {
      target: OpsApplyTarget;
      id: string;
      nodeIds: string[];
      mode?: OptionMode;
      lock?: OptionBool;
      qr?: OptionBool;
      playlist?: OptionBool;
      nosplash?: OptionBool;
      remoteInput?: OptionBool;
      remoteApp?: OptionBool;
      remoteMic?: OptionBool;
      remoteGuide?: OptionBool;
      hud?: OptionHud;
      hudSec?: number | "";
      theme?: string;
      rotate?: OptionRotate;
    }) => {
      return applyTarget({
        target: args.target,
        id: args.id.trim(),
        piIds: args.nodeIds,
        mode: args.mode === "inherit" ? undefined : args.mode,
        lock: toOptionBool(args.lock ?? "inherit"),
        showQr: toOptionBool(args.qr ?? "inherit"),
        playlist: toOptionBool(args.playlist ?? "inherit"),
        nosplash: toOptionBool(args.nosplash ?? "inherit"),
        remoteInput: toOptionBool(args.remoteInput ?? "inherit"),
        remoteApp: toOptionBool(args.remoteApp ?? "inherit"),
        remoteMic: toOptionBool(args.remoteMic ?? "inherit"),
        remoteGuide: toOptionBool(args.remoteGuide ?? "inherit"),
        hudMode: args.hud === "inherit" || !args.hud ? undefined : args.hud,
        hudShowSec:
          typeof args.hudSec === "number" && Number.isFinite(args.hudSec)
            ? args.hudSec
            : undefined,
        theme: args.theme?.trim() || undefined,
        displayRotate:
          args.rotate === "inherit" || !args.rotate
            ? undefined
            : (Number(args.rotate) as 0 | 90 | 180 | 270),
      });
    },
    []
  );

  const buildMediaLookup = useCallback((): Map<string, Media> => {
    const map = new Map<string, Media>();
    for (const media of serverSnapshot?.media ?? []) map.set(media.id, media);
    for (const media of draftStore.media) {
      map.set(media.id, {
        id: media.id,
        title: media.title || undefined,
        artist: media.artist || undefined,
        description: media.description || undefined,
        sourceType: media.sourceType,
        sourceValue: media.sourceValue,
        thumbnailUrl: media.thumbnailUrl,
        thumbnailObjectKey: media.thumbnailObjectKey,
        web: media.web,
        cache: media.cache,
      });
    }
    return map;
  }, [draftStore.media, serverSnapshot?.media]);

  const runApply = useCallback(async () => {
    if (selectedNodeIds.length === 0) {
      notifications.show({
        color: "red",
        title: "No nodes selected",
        message: "Select at least one node.",
      });
      return;
    }

    const targetId = applyId.trim();
    const hasLaunchOverrides =
      optMode !== "inherit" ||
      optLock !== "inherit" ||
      optQr !== "inherit" ||
      optPlaylist !== "inherit" ||
      optNosplash !== "inherit" ||
      optRemoteInput !== "inherit" ||
      optRemoteApp !== "inherit" ||
      optRemoteMic !== "inherit" ||
      optRemoteGuide !== "inherit" ||
      optHud !== "inherit" ||
      (typeof optHudSec === "number" && Number.isFinite(optHudSec)) ||
      optTheme.trim().length > 0 ||
      optRotate !== "inherit";

    if (!targetId && !hasLaunchOverrides) {
      notifications.show({
        color: "red",
        title: "No changes to apply",
        message: "Choose a target or change launch settings first.",
      });
      return;
    }

    const toApplyErrorResult = (nodeId: string, error: string): OpsApplyResult => {
      const node = fleetMap[nodeId];
      return {
        id: nodeId,
        host: node?.host || node?.ip || nodeId,
        ip: node?.ip ?? null,
        nodeName: node?.nodeName || nodeId,
        guidePort: 5173,
        url: "",
        ok: false,
        status: null,
        ms: null,
        error,
      };
    };

    try {
      const mediaLookup = buildMediaLookup();
      if (targetId) {
        if (applyKind === "media") {
          const media = mediaLookup.get(targetId);
          if (media) {
            await importResources({
              media: [
                {
                  id: media.id,
                  title: media.title,
                  artist: media.artist,
                  description: media.description,
                  sourceType: media.sourceType,
                  sourceValue: media.sourceValue,
                  thumbnailUrl: media.thumbnailUrl,
                  thumbnailObjectKey: media.thumbnailObjectKey,
                  web: media.web,
                  cache: media.cache,
                },
              ],
              playlists: [],
              blocks: [],
              channels: [],
              profiles: [],
            });
          }
        }
        if (applyKind === "playlist") {
          const playlist = draftStore.playlists.find(
            (row) => row.id === targetId
          );
          if (playlist) {
            const mediaRows = playlist.mediaIds
              .map((mediaId) => mediaLookup.get(mediaId))
              .filter((row): row is Media => Boolean(row))
              .map((media) => ({
                id: media.id,
                title: media.title,
                artist: media.artist,
                description: media.description,
                sourceType: media.sourceType,
                sourceValue: media.sourceValue,
                thumbnailUrl: media.thumbnailUrl,
                thumbnailObjectKey: media.thumbnailObjectKey,
                web: media.web,
                cache: media.cache,
              }));
            await importResources({
              media: mediaRows,
              playlists: [
                {
                  id: playlist.id,
                  title: playlist.title || undefined,
                  artist: playlist.artist || undefined,
                  description: playlist.description || undefined,
                  items: playlist.mediaIds.map((mediaId, index) => ({
                    index,
                    mediaId,
                  })),
                },
              ],
              blocks: [],
              channels: [],
              profiles: [],
            });
          }
        }
        const result = await applyTargetToNodes({
          target: applyKind,
          id: targetId,
          nodeIds: selectedNodeIds,
          mode: optMode,
          lock: optLock,
          qr: optQr,
          playlist: optPlaylist,
          nosplash: optNosplash,
          remoteInput: optRemoteInput,
          remoteApp: optRemoteApp,
          remoteMic: optRemoteMic,
          remoteGuide: optRemoteGuide,
          hud: optHud,
          hudSec: optHudSec,
          theme: optTheme,
          rotate: optRotate,
        });
        setApplyResult(result);
        notifications.show({
          color: result.ok ? "teal" : "orange",
          title: "Apply completed",
          message: summarizeApplyResult(result),
        });
        await refreshServerSnapshot();
        refreshFleet();
        return;
      }

      const assignments = await fetchDesiredScreenAssignments({
        namespace: activeRegistryId,
      });
      const assignmentByNodeId = new Map(
        assignments.items.map((item) => [item.screenId, item])
      );
      const nodesWithAssignment = selectedNodeIds
        .map((nodeId) => ({
          nodeId,
          assignment: assignmentByNodeId.get(nodeId) || null,
        }))
        .filter(
          (row): row is { nodeId: string; assignment: (typeof assignments.items)[number] } =>
            Boolean(row.assignment?.target?.id && row.assignment?.target?.kind)
        );

      if (nodesWithAssignment.length === 0) {
        notifications.show({
          color: "red",
          title: "No existing targets found",
          message:
            "None of the selected nodes have desired state in this namespace. Pick a target first.",
        });
        return;
      }

      const perNodeResults = await Promise.all(
        nodesWithAssignment.map(async ({ nodeId, assignment }) => {
          try {
            const response = await applyTargetToNodes({
              target: assignment.target.kind,
              id: assignment.target.id,
              nodeIds: [nodeId],
              mode: optMode,
              lock: optLock,
              qr: optQr,
              playlist: optPlaylist,
              nosplash: optNosplash,
              remoteInput: optRemoteInput,
              remoteApp: optRemoteApp,
              remoteMic: optRemoteMic,
              remoteGuide: optRemoteGuide,
              hud: optHud,
              hudSec: optHudSec,
              theme: optTheme,
              rotate: optRotate,
            });
            return response.results;
          } catch (error) {
            const message =
              error instanceof Error ? error.message : String(error);
            return [toApplyErrorResult(nodeId, message)];
          }
        })
      );

      const missingNodeIds = selectedNodeIds.filter(
        (nodeId) => !assignmentByNodeId.has(nodeId)
      );
      const missingResults = missingNodeIds.map((nodeId) =>
        toApplyErrorResult(nodeId, "missing_current_target")
      );
      const mergedResults = [...perNodeResults.flat(), ...missingResults];
      const mergedResult: OpsApplyResponse = {
        ok: mergedResults.every((row) => row.ok),
        results: mergedResults,
        target: applyKind,
        ...(targetId ? { id: targetId } : {}),
        ...(missingNodeIds.length > 0
          ? {
              warning: `missing_current_target:${missingNodeIds.join(",")}`,
            }
          : {}),
      };

      setApplyResult(mergedResult);
      notifications.show({
        color: mergedResult.ok ? "teal" : "orange",
        title: "Apply completed",
        message: summarizeApplyResult(mergedResult),
      });
      refreshFleet();
    } catch (error) {
      notifications.show({
        color: "red",
        title: "Apply failed",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }, [
    applyId,
    applyKind,
    activeRegistryId,
    fleetMap,
    optHud,
    optHudSec,
    optLock,
    optMode,
    optNosplash,
    optRemoteInput,
    optRemoteApp,
    optRemoteMic,
    optRemoteGuide,
    optPlaylist,
    optQr,
    optRotate,
    optTheme,
    applyTargetToNodes,
    buildMediaLookup,
    draftStore.playlists,
    fetchDesiredScreenAssignments,
    refreshServerSnapshot,
    refreshFleet,
    selectedNodeIds,
  ]);

  const returnToGuide = useCallback(async () => {
    if (selectedNodeIds.length === 0) {
      notifications.show({
        color: "red",
        title: "No nodes selected",
        message: "Select at least one node.",
      });
      return;
    }
    try {
      const result = await openGuide({
        piIds: selectedNodeIds,
        nosplash: true,
      });
      notifications.show({
        color: result.ok ? "teal" : "orange",
        title: "Return to guide",
        message: summarizeApplyResult(result),
      });
      refreshFleet();
    } catch (error) {
      notifications.show({
        color: "red",
        title: "Guide command failed",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }, [refreshFleet, selectedNodeIds]);

  const openQuickSend = useCallback(
    (target: QuickSendTarget) => {
      setQuickSendTarget(target);
      setQuickSendNodeIds((prev) => prev.filter((id) => Boolean(fleetMap[id])));
      setQuickSendQuery("");
      setQuickSendOpen(true);
    },
    [fleetMap]
  );

  const runQuickSend = useCallback(async () => {
    if (!quickSendTarget) return;
    if (quickSendNodeIds.length === 0) {
      notifications.show({
        color: "red",
        title: "No nodes selected",
        message: "Pick at least one node before sending.",
      });
      return;
    }
    try {
      setQuickSendBusy(true);
      const mediaLookup = buildMediaLookup();
      if (quickSendTarget.kind === "media") {
        const media = mediaLookup.get(quickSendTarget.id);
        if (media) {
          await importResources({
            media: [
              {
                id: media.id,
                title: media.title,
                artist: media.artist,
                description: media.description,
                sourceType: media.sourceType,
                sourceValue: media.sourceValue,
                thumbnailUrl: media.thumbnailUrl,
                thumbnailObjectKey: media.thumbnailObjectKey,
                web: media.web,
                cache: media.cache,
              },
            ],
            playlists: [],
            blocks: [],
            channels: [],
            profiles: [],
          });
        }
      }
      if (quickSendTarget.kind === "playlist") {
        const playlist = draftStore.playlists.find(
          (row) => row.id === quickSendTarget.id
        );
        if (playlist) {
          const mediaRows = playlist.mediaIds
            .map((mediaId) => mediaLookup.get(mediaId))
            .filter((row): row is Media => Boolean(row))
            .map((media) => ({
              id: media.id,
              title: media.title,
              artist: media.artist,
              description: media.description,
              sourceType: media.sourceType,
              sourceValue: media.sourceValue,
              thumbnailUrl: media.thumbnailUrl,
              thumbnailObjectKey: media.thumbnailObjectKey,
              web: media.web,
              cache: media.cache,
            }));
          await importResources({
            media: mediaRows,
            playlists: [
              {
                id: playlist.id,
                title: playlist.title || undefined,
                artist: playlist.artist || undefined,
                description: playlist.description || undefined,
                items: playlist.mediaIds.map((mediaId, index) => ({
                  index,
                  mediaId,
                })),
              },
            ],
            blocks: [],
            channels: [],
            profiles: [],
          });
        }
      }
      const result = await applyTargetToNodes({
        target: quickSendTarget.kind,
        id: quickSendTarget.id,
        nodeIds: quickSendNodeIds,
        mode: "gallery",
      });
      setApplyResult(result);
      notifications.show({
        color: result.ok ? "teal" : "orange",
        title: `Sent ${quickSendTarget.kind}`,
        message: summarizeApplyResult(result),
      });
      await refreshServerSnapshot();
      setQuickSendOpen(false);
      refreshFleet();
    } catch (error) {
      notifications.show({
        color: "red",
        title: "Send to nodes failed",
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setQuickSendBusy(false);
    }
  }, [
    applyTargetToNodes,
    buildMediaLookup,
    draftStore.playlists,
    quickSendNodeIds,
    quickSendTarget,
    refreshFleet,
    refreshServerSnapshot,
  ]);

  const syncDraftStoreToControlDb = useCallback(
    async (
      nextStore: DraftStore,
      options?: { successTitle?: string; successMessage?: string; quietSuccess?: boolean }
    ): Promise<boolean> => {
      try {
        setBuilderBusy(true);
        const payload = toResourcePayload(nextStore);
        const result = await importResources(payload);
        setDraftStore(nextStore);
        await refreshServerSnapshot({ silent: true });
        if (!options?.quietSuccess) {
          notifications.show({
            color: "teal",
            title: options?.successTitle || "Drafts synced to control DB",
            message:
              options?.successMessage ||
              `media:${result.counts.media} playlists:${result.counts.playlists} blocks:${result.counts.blocks} channels:${result.counts.channels} profiles:${result.counts.profiles}`,
          });
        }
        return true;
      } catch (error) {
        notifications.show({
          color: "red",
          title: "Sync to control DB failed",
          message: error instanceof Error ? error.message : String(error),
        });
        return false;
      } finally {
        setBuilderBusy(false);
      }
    },
    [refreshServerSnapshot]
  );

  const refreshDraftsAfterIngest = useCallback(async () => {
    const result = await fetchResourceSnapshot();
    setDraftStore(fromResourcePayload(result.snapshot));
    setServerSnapshot(result.snapshot);
  }, []);

  const upsertIngestJob = useCallback(
    (job: MediaIngestJob, options?: { notifyTransitions?: boolean }) => {
      const previousStatus = ingestJobStatusRef.current[job.id];
      ingestJobStatusRef.current[job.id] = job.status;
      setIngestJobs((prev) => {
        const without = prev.filter((row) => row.id !== job.id);
        return [job, ...without]
          .sort((a, b) => b.createdAt - a.createdAt)
          .slice(0, 20);
      });
      if (!options?.notifyTransitions) return;
      if (previousStatus === job.status) return;
      if (job.status === "succeeded") {
        void refreshDraftsAfterIngest();
        notifications.show({
          color: "teal",
          title: "Ingest complete",
          message: `${job.kind} • ${job.id}`,
        });
        return;
      }
      if (job.status === "failed") {
        notifications.show({
          color: "red",
          title: "Ingest failed",
          message: `${job.kind} • ${job.id} • ${job.error || "unknown_error"}`,
        });
      }
    },
    [refreshDraftsAfterIngest]
  );

  const stopPollingJob = useCallback((jobId: string) => {
    const handle = ingestPollersRef.current[jobId];
    if (typeof handle === "number") {
      window.clearInterval(handle);
      delete ingestPollersRef.current[jobId];
    }
  }, []);

  const startPollingJob = useCallback(
    (jobId: string) => {
      if (typeof ingestPollersRef.current[jobId] === "number") return;
      const tick = async () => {
        try {
          const result = await fetchIngestJob(jobId);
          upsertIngestJob(result.job, { notifyTransitions: true });
          if (
            result.job.status === "succeeded" ||
            result.job.status === "failed"
          ) {
            stopPollingJob(jobId);
          }
        } catch (error) {
          stopPollingJob(jobId);
          notifications.show({
            color: "orange",
            title: "Ingest job poll failed",
            message: error instanceof Error ? error.message : String(error),
          });
        }
      };
      void tick();
      ingestPollersRef.current[jobId] = window.setInterval(() => {
        void tick();
      }, 1200);
    },
    [stopPollingJob, upsertIngestJob]
  );

  const syncIngestJobs = useCallback(
    async (notifyTransitions: boolean) => {
      const result = await fetchIngestJobs(60);
      for (const job of result.jobs) {
        upsertIngestJob(job, { notifyTransitions });
        if (job.status === "queued" || job.status === "running") {
          startPollingJob(job.id);
        }
      }
    },
    [startPollingJob, upsertIngestJob]
  );

  useEffect(() => {
    let active = true;
    const tick = async (notifyTransitions: boolean) => {
      try {
        await syncIngestJobs(notifyTransitions);
        ingestWatchWarnedRef.current = false;
      } catch (error) {
        if (!active || ingestWatchWarnedRef.current) return;
        ingestWatchWarnedRef.current = true;
        notifications.show({
          color: "orange",
          title: "Ingest watcher warning",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    };
    void tick(false);
    const handle = window.setInterval(() => {
      void tick(true);
    }, 2500);
    return () => {
      active = false;
      window.clearInterval(handle);
    };
  }, [syncIngestJobs]);

  const routeToMediaLibraryAfterQueue = useCallback(() => {
    setMainTab("builder");
    setBuilderTab("media");
    setMediaLibrarySection("media");
    setIngestStep(1);
    updateOpsUrl({ view: null, playlistId: null }, "replace");
    if (isMobile) setControlOpen(false);
  }, [isMobile]);

  useEffect(() => {
    return () => {
      for (const handle of Object.values(ingestPollersRef.current)) {
        window.clearInterval(handle);
      }
      ingestPollersRef.current = {};
    };
  }, []);

  const runYouTubeIngest = useCallback(async () => {
    if (!youtubeUrl.trim()) {
      notifications.show({
        color: "red",
        title: "YouTube URL required",
        message: "Paste a youtube.com or youtu.be URL first.",
      });
      return;
    }
    try {
      setIngestBusy(true);
      const result = await startYouTubeIngestJob({
        url: youtubeUrl.trim(),
        title: youtubeTitle.trim() || undefined,
        artist: youtubeArtist.trim() || undefined,
        description: youtubeDescription.trim() || undefined,
      });
      upsertIngestJob(result.job, { notifyTransitions: true });
      startPollingJob(result.job.id);
      notifications.show({
        color: "teal",
        title: "YouTube ingest queued",
        message: `job:${result.job.id}`,
      });
      routeToMediaLibraryAfterQueue();
    } catch (error) {
      notifications.show({
        color: "red",
        title: "YouTube ingest failed",
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIngestBusy(false);
    }
  }, [
    routeToMediaLibraryAfterQueue,
    startPollingJob,
    upsertIngestJob,
    youtubeArtist,
    youtubeDescription,
    youtubeTitle,
    youtubeUrl,
  ]);

  const runEdenIngest = useCallback(async () => {
    if (!edenInput.trim()) {
      notifications.show({
        color: "red",
        title: "Eden input required",
        message: "Provide an Eden collection URL or collection ID.",
      });
      return;
    }
    try {
      setIngestBusy(true);
      const result = await startEdenIngestJob({
        input: edenInput.trim(),
        ...(edenCreatePlaylist ? { playlist: true } : {}),
        ...(edenArtist.trim() ? { artist: edenArtist.trim() } : {}),
        ...(edenDescription.trim()
          ? { description: edenDescription.trim() }
          : {}),
      });
      upsertIngestJob(result.job, { notifyTransitions: true });
      startPollingJob(result.job.id);
      notifications.show({
        color: "teal",
        title: "Eden ingest queued",
        message: `job:${result.job.id}`,
      });
      routeToMediaLibraryAfterQueue();
    } catch (error) {
      notifications.show({
        color: "red",
        title: "Eden ingest failed",
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIngestBusy(false);
    }
  }, [
    edenCreatePlaylist,
    edenArtist,
    edenDescription,
    edenInput,
    routeToMediaLibraryAfterQueue,
    startPollingJob,
    upsertIngestJob,
  ]);

  const parsedWebLaunchConfig = useMemo(() => {
    return buildWebLaunchConfigFromEntries({
      entries: webLaunchArgsEntries,
      launchProfile: webLaunchProfile,
    });
  }, [webLaunchArgsEntries, webLaunchProfile]);

  const runWebIngest = useCallback(async () => {
    const url = webUrl.trim();
    if (!url) {
      notifications.show({
        color: "red",
        title: "Web URL required",
        message: "Provide an http(s) URL to add as media.",
      });
      return;
    }
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        notifications.show({
          color: "red",
          title: "Invalid URL protocol",
          message: "Only http:// and https:// URLs are supported.",
        });
        return;
      }
    } catch {
      notifications.show({
        color: "red",
        title: "Invalid URL",
        message: "Enter a valid web URL.",
      });
      return;
    }
    if (parsedWebLaunchConfig.error) {
      notifications.show({
        color: "red",
        title: "Invalid web launch args",
        message: parsedWebLaunchConfig.error,
      });
      return;
    }
    try {
      setIngestBusy(true);
      const idSeed =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
          : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
      const mediaId = `m-web-${idSeed}`;
      await importResources({
        media: [
          {
            id: mediaId,
            title: webTitle.trim() || undefined,
            artist: webArtist.trim() || undefined,
            description: webDescription.trim() || undefined,
            sourceType: "url",
            sourceValue: url,
            web: parsedWebLaunchConfig.config,
            cache: webCache,
          },
        ],
        playlists: [],
        blocks: [],
        channels: [],
        profiles: [],
      });
      await refreshServerSnapshot({ silent: true });
      notifications.show({
        color: "teal",
        title: "Web media added",
        message: mediaId,
      });
      setWebUrl("");
      setWebTitle("");
      setWebArtist("");
      setWebDescription("");
      setWebCache(true);
      setWebLaunchProfile("none");
      setWebLaunchArgsEntries([]);
      routeToMediaLibraryAfterQueue();
    } catch (error) {
      notifications.show({
        color: "red",
        title: "Web media add failed",
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIngestBusy(false);
    }
  }, [
    refreshServerSnapshot,
    routeToMediaLibraryAfterQueue,
    parsedWebLaunchConfig,
    webArtist,
    webCache,
    webDescription,
    webLaunchArgsEntries,
    webTitle,
    webUrl,
  ]);

  const runUploadIngest = useCallback(async () => {
    if (uploadFiles.length === 0) {
      notifications.show({
        color: "red",
        title: "No files selected",
        message: "Attach media files or one zip archive first.",
      });
      return;
    }
    try {
      setIngestBusy(true);
      const formData = new FormData();
      const nonArchiveFiles = uploadFiles.filter(
        (file) => !file.name.toLowerCase().endsWith(".zip")
      );
      for (const file of uploadFiles) {
        const lower = file.name.toLowerCase();
        if (lower.endsWith(".zip")) formData.append("archive", file);
        else formData.append("files", file);
      }
      if (nonArchiveFiles.length > 0) {
        const perFileTitles = nonArchiveFiles.map((file, index) => {
          const raw = uploadTitleOverrides[index] ?? defaultUploadTitle(file.name);
          return raw.trim() || defaultUploadTitle(file.name);
        });
        formData.append("fileTitles", JSON.stringify(perFileTitles));
        const perFileArtists = nonArchiveFiles.map(
          (_, index) => uploadArtistOverrides[index]?.trim() || ""
        );
        const perFileDescriptions = nonArchiveFiles.map(
          (_, index) => uploadDescriptionOverrides[index]?.trim() || ""
        );
        formData.append("fileArtists", JSON.stringify(perFileArtists));
        formData.append("fileDescriptions", JSON.stringify(perFileDescriptions));
      }
      if (uploadArtist.trim()) formData.append("artist", uploadArtist.trim());
      if (uploadDescription.trim())
        formData.append("description", uploadDescription.trim());
      if (uploadCreatePlaylist) {
        formData.append("playlist", "true");
        if (uploadPlaylistTitle.trim()) {
          formData.append("playlistTitle", uploadPlaylistTitle.trim());
        }
      }
      const result = await startUploadIngestJob(formData);
      upsertIngestJob(result.job, { notifyTransitions: true });
      startPollingJob(result.job.id);
      notifications.show({
        color: "teal",
        title: "Upload ingest queued",
        message: `job:${result.job.id}`,
      });
      setUploadFiles([]);
      setUploadTitleOverrides([]);
      setUploadArtistOverrides([]);
      setUploadDescriptionOverrides([]);
      setUploadArtist("");
      setUploadDescription("");
      setUploadCreatePlaylist(false);
      setUploadPlaylistTitle("");
      setUploadDropError(null);
      routeToMediaLibraryAfterQueue();
    } catch (error) {
      notifications.show({
        color: "red",
        title: "Upload ingest failed",
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIngestBusy(false);
    }
  }, [
    routeToMediaLibraryAfterQueue,
    startPollingJob,
    upsertIngestJob,
    uploadArtist,
    uploadCreatePlaylist,
    uploadDescription,
    uploadFiles,
    uploadArtistOverrides,
    uploadTitleOverrides,
    uploadDescriptionOverrides,
    uploadPlaylistTitle,
  ]);

  const serverMedia = useMemo(() => {
    const rows = serverSnapshot?.media ?? [];
    return [...rows];
  }, [serverSnapshot]);

  const playlistServerOrder = useMemo(
    () => buildServerOrderMap(serverSnapshot?.playlists ?? []),
    [serverSnapshot?.playlists]
  );
  const blockServerOrder = useMemo(
    () => buildServerOrderMap(serverSnapshot?.blocks ?? []),
    [serverSnapshot?.blocks]
  );
  const channelServerOrder = useMemo(
    () => buildServerOrderMap(serverSnapshot?.channels ?? []),
    [serverSnapshot?.channels]
  );
  const profileServerOrder = useMemo(
    () => buildServerOrderMap(serverSnapshot?.profiles ?? []),
    [serverSnapshot?.profiles]
  );

  const playlistsSorted = useMemo(
    () => sortByServerOrder(draftStore.playlists, playlistServerOrder),
    [draftStore.playlists, playlistServerOrder]
  );
  const blocksSorted = useMemo(
    () => sortByServerOrder(draftStore.blocks, blockServerOrder),
    [blockServerOrder, draftStore.blocks]
  );
  const channelsSorted = useMemo(
    () => sortByServerOrder(draftStore.channels, channelServerOrder),
    [channelServerOrder, draftStore.channels]
  );
  const profilesSorted = useMemo(
    () => sortByServerOrder(draftStore.profiles, profileServerOrder),
    [draftStore.profiles, profileServerOrder]
  );

  const mergedMedia = useMemo<Media[]>(() => {
    const map = new Map<string, Media>();
    for (const media of serverMedia) map.set(media.id, media);
    for (const media of draftStore.media) {
      map.set(media.id, {
        id: media.id,
        title: media.title || undefined,
        artist: media.artist || undefined,
        description: media.description || undefined,
        sourceType: media.sourceType,
        sourceValue: media.sourceValue,
        thumbnailUrl: media.thumbnailUrl,
        thumbnailObjectKey: media.thumbnailObjectKey,
        web: media.web,
        cache: media.cache,
      });
    }
    return Array.from(map.values()).sort((a, b) => a.id.localeCompare(b.id));
  }, [draftStore.media, serverMedia]);

  const mergedMediaById = useMemo(() => {
    const map = new Map<string, Media>();
    for (const media of mergedMedia) map.set(media.id, media);
    return map;
  }, [mergedMedia]);

  const workspacePlaybackMedia = useMemo(() => {
    const mediaId = nodeRuntimeStatus?.status.playback?.mediaId?.trim();
    if (!mediaId) return null;
    return mergedMediaById.get(mediaId) || null;
  }, [mergedMediaById, nodeRuntimeStatus?.status.playback?.mediaId]);

  const mergedPlaylists = useMemo<
    Array<{
      id: string;
      title?: string;
      artist?: string;
      description?: string;
      mediaIds: string[];
    }>
  >(() => {
    const byId = new Map<
      string,
      {
        id: string;
        title?: string;
        artist?: string;
        description?: string;
        mediaIds: string[];
      }
    >();
    for (const row of serverSnapshot?.playlists ?? []) {
      byId.set(row.id, {
        id: row.id,
        title: row.title,
        artist: row.artist,
        description: row.description,
        mediaIds: playlistMediaIdsFromSnapshot(row),
      });
    }
    for (const row of draftStore.playlists) {
      byId.set(row.id, {
        id: row.id,
        title: row.title,
        artist: row.artist,
        description: row.description,
        mediaIds: [...row.mediaIds],
      });
    }
    return Array.from(byId.values()).sort((a, b) => a.id.localeCompare(b.id));
  }, [draftStore.playlists, serverSnapshot?.playlists]);

  const mergedPlaylistsById = useMemo(() => {
    const byId = new Map<string, (typeof mergedPlaylists)[number]>();
    for (const row of mergedPlaylists) byId.set(row.id, row);
    return byId;
  }, [mergedPlaylists]);

  const mergedBlocks = useMemo<
    Array<{
      id: string;
      title?: string;
      items: Array<{ kind: "media" | "playlist"; id: string }>;
    }>
  >(() => {
    const byId = new Map<
      string,
      {
        id: string;
        title?: string;
        items: Array<{ kind: "media" | "playlist"; id: string }>;
      }
    >();
    for (const row of serverSnapshot?.blocks ?? []) {
      byId.set(row.id, {
        id: row.id,
        title: row.title,
        items: blockItemsFromUnknownBlock(row),
      });
    }
    for (const row of draftStore.blocks) {
      byId.set(row.id, {
        id: row.id,
        title: row.title,
        items: row.items
          .map((item) => ({ kind: item.kind, id: item.id.trim() }))
          .filter((item) => item.id.length > 0),
      });
    }
    return Array.from(byId.values()).sort((a, b) => a.id.localeCompare(b.id));
  }, [draftStore.blocks, serverSnapshot?.blocks]);

  const targetPickerItemsByKind = useMemo<
    Record<TargetKind, ResourcePickerItem[]>
  >(() => {
    const toMediaTile = (mediaId: string) => {
      const media = mergedMediaById.get(mediaId);
      if (!media) return { label: mediaId };
      return {
        src: media.thumbnailUrl || mediaPreviewSource(media) || undefined,
        label: media.title || mediaId,
      };
    };

    const playlistPreviewById = new Map<
      string,
      { tiles: Array<{ src?: string; label: string }>; total: number }
    >();
    for (const playlist of mergedPlaylists) {
      const mediaIds = playlist.mediaIds.filter(Boolean);
      playlistPreviewById.set(playlist.id, {
        tiles: mediaIds.slice(0, 4).map((id) => toMediaTile(id)),
        total: mediaIds.length,
      });
    }

    const blockPreviewById = new Map<
      string,
      { tiles: Array<{ src?: string; label: string }>; total: number }
    >();
    for (const block of mergedBlocks) {
      const mediaIds: string[] = [];
      const fallbackTiles: Array<{ src?: string; label: string }> = [];
      for (const item of block.items) {
        if (item.kind === "media") {
          mediaIds.push(item.id);
          fallbackTiles.push(toMediaTile(item.id));
          continue;
        }
        const playlist = mergedPlaylistsById.get(item.id);
        if (playlist) {
          mediaIds.push(...playlist.mediaIds);
          if (playlist.mediaIds.length === 0) {
            fallbackTiles.push({
              label: playlist.title || "Playlist",
            });
          }
        } else {
          fallbackTiles.push({
            label: item.id,
          });
        }
        if (mediaIds.length >= 16) break;
      }
      const resolvedTiles = mediaIds.slice(0, 4).map((id) => toMediaTile(id));
      const tiles =
        resolvedTiles.length > 0
          ? resolvedTiles
          : fallbackTiles.slice(0, 4);
      blockPreviewById.set(block.id, {
        tiles,
        total: mediaIds.length > 0 ? mediaIds.length : block.items.length,
      });
    }

    return {
      media: mergedMedia.map((row) => ({
        id: row.id,
        title: row.title || "Untitled media",
        subtitle: row.artist || undefined,
        description: row.description || undefined,
        thumbnailUrl: row.thumbnailUrl,
        previewUrl: mediaPreviewSource(row) || undefined,
        badge:
          row.sourceType === "url"
            ? "web"
            : isVideoMedia(row)
              ? "video"
              : "media",
        searchText: [row.id, row.title, row.artist, row.description, row.sourceValue]
          .filter(Boolean)
          .join(" "),
      })),
      playlist: mergedPlaylists.map((row) => {
        const preview = playlistPreviewById.get(row.id);
        return {
          id: row.id,
          title: row.title || "Untitled playlist",
          subtitle:
            row.artist ||
            `${row.mediaIds.length} item${row.mediaIds.length === 1 ? "" : "s"}`,
          description: row.description || undefined,
          previewTiles: preview?.tiles || [],
          previewTilesTotalCount: preview?.total || row.mediaIds.length,
          badge: "playlist",
          searchText: [row.id, row.title, row.artist, row.description]
            .filter(Boolean)
            .join(" "),
        };
      }),
      block: mergedBlocks.map((row) => {
        const preview = blockPreviewById.get(row.id);
        return {
          id: row.id,
          title: row.title || "Untitled block",
          subtitle: `${row.items.length} item${row.items.length === 1 ? "" : "s"}`,
          previewTiles: preview?.tiles || [],
          previewTilesTotalCount: preview?.total || 0,
          badge: "block",
          searchText: [row.id, row.title].filter(Boolean).join(" "),
        };
      }),
      channel: channelOptions.map((row) => ({
        id: row.value,
        title: row.label || "Untitled channel",
        badge: "channel",
        searchText: row.value,
      })),
    };
  }, [
    channelOptions,
    mergedBlocks,
    mergedMedia,
    mergedMediaById,
    mergedPlaylists,
    mergedPlaylistsById,
  ]);

  const applyResourcePickerItems = useMemo<ResourcePickerItem[]>(() => {
    if (
      applyKind === "media" ||
      applyKind === "playlist" ||
      applyKind === "block" ||
      applyKind === "channel"
    ) {
      return targetPickerItemsByKind[applyKind] || [];
    }
    if (applyKind === "profile") {
      return profileOptions.map((row) => ({
        id: row.value,
        title: row.label,
        badge: "profile",
        searchText: `${row.value} ${row.label}`,
      }));
    }
    return [];
  }, [
    applyKind,
    profileOptions,
    targetPickerItemsByKind,
  ]);

  const applyTargetPreviewCard = useMemo(() => {
    const targetId = applyId.trim();
    if (!targetId) return null;

    if (applyKind === "media") {
      const media = mergedMedia.find((row) => row.id === targetId);
      if (!media) {
        return (
          <Paper withBorder p="sm">
            <Text size="xs" c="dimmed">
              Selected media not found in current catalog snapshot.
            </Text>
          </Paper>
        );
      }
      return (
        <Card withBorder p="sm" className="ops-media-card">
          <Stack gap={8}>
            {media.thumbnailUrl ? (
              <Image
                src={media.thumbnailUrl}
                alt={media.title || media.id}
                h={148}
                radius="sm"
                fit="cover"
              />
            ) : null}
            <Group justify="space-between" align="center" wrap="nowrap">
              <Text fw={700} lineClamp={1}>
                {media.title || media.id}
              </Text>
              <Badge variant="light">
                {isVideoMedia(media) ? "VIDEO" : "MEDIA"}
              </Badge>
            </Group>
            <Text size="sm" c="dimmed" lineClamp={1}>
              {media.artist || "unknown artist"}
            </Text>
            <Text size="xs" c="dimmed" ff="monospace" lineClamp={1}>
              {media.id}
            </Text>
          </Stack>
        </Card>
      );
    }

    if (applyKind === "playlist") {
      const draftPlaylist = draftStore.playlists.find(
        (row) => row.id === targetId
      );
      const serverPlaylist = serverSnapshot?.playlists.find(
        (row) => row.id === targetId
      );
      const mediaIds = draftPlaylist
        ? draftPlaylist.mediaIds
        : serverPlaylist?.items
            .map((item) => item.mediaId || "")
            .filter((id) => id.length > 0) ?? [];
      const coverMedia = mediaIds
        .map((id) => mergedMedia.find((row) => row.id === id))
        .filter((row): row is Media => Boolean(row))
        .slice(0, 4);
      return (
        <Paper withBorder p="sm">
          <Stack gap="sm">
            <Group justify="space-between" wrap="nowrap">
              <Text fw={700} lineClamp={1}>
                {draftPlaylist?.title || serverPlaylist?.title || targetId}
              </Text>
              <Badge variant="light">{mediaIds.length} items</Badge>
            </Group>
            {coverMedia.length > 0 ? (
              <SimpleGrid cols={{ base: 2, sm: 4 }} spacing={6}>
                {coverMedia.map((row) => (
                  <Image
                    key={`apply-preview-playlist-${targetId}-${row.id}`}
                    src={row.thumbnailUrl}
                    alt={row.title || row.id}
                    h={64}
                    radius="sm"
                    fit="cover"
                    fallbackSrc=""
                  />
                ))}
              </SimpleGrid>
            ) : (
              <Text size="xs" c="dimmed">
                No media previews available.
              </Text>
            )}
            <Text size="xs" c="dimmed" ff="monospace" lineClamp={1}>
              {targetId}
            </Text>
          </Stack>
        </Paper>
      );
    }

    if (applyKind === "block") {
      const draftBlock = draftStore.blocks.find((row) => row.id === targetId);
      const serverBlock = serverSnapshot?.blocks.find(
        (row) => row.id === targetId
      );
      const blockItems = draftBlock
        ? draftBlock.items
        : serverBlock?.items
            .map((item) => {
              if (item.mediaId?.trim()) {
                return { kind: "media" as const, id: item.mediaId.trim() };
              }
              if (item.playlistId?.trim()) {
                return { kind: "playlist" as const, id: item.playlistId.trim() };
              }
              return null;
            })
            .filter((item) => Boolean(item)) ?? [];
      const mediaCount = blockItems.filter((item) => item?.kind === "media").length;
      const playlistCount = blockItems.filter(
        (item) => item?.kind === "playlist"
      ).length;
      return (
        <Paper withBorder p="sm">
          <Stack gap={6}>
            <Group justify="space-between">
              <Text fw={700}>
                {draftBlock?.title || serverBlock?.title || targetId}
              </Text>
              <Badge variant="light">{blockItems.length} items</Badge>
            </Group>
            <Text size="xs" c="dimmed">
              media:{mediaCount} playlist:{playlistCount}
            </Text>
            <Text size="xs" c="dimmed" ff="monospace">
              {targetId}
            </Text>
          </Stack>
        </Paper>
      );
    }

    if (applyKind === "channel") {
      const draftChannel = draftStore.channels.find(
        (row) => row.id === targetId
      );
      const serverChannel = serverSnapshot?.channels.find(
        (row) => row.id === targetId
      );
      const blockIds = draftChannel?.blockIds ?? serverChannel?.blockIds ?? [];
      return (
        <Paper withBorder p="sm">
          <Stack gap={6}>
            <Group justify="space-between">
              <Text fw={700}>
                {draftChannel?.title || serverChannel?.name || targetId}
              </Text>
              <Badge variant="light">{blockIds.length} blocks</Badge>
            </Group>
            <Text size="xs" c="dimmed" ff="monospace">
              {targetId}
            </Text>
          </Stack>
        </Paper>
      );
    }

    const draftProfile = draftStore.profiles.find((row) => row.id === targetId);
    const serverProfile = serverSnapshot?.profiles.find(
      (row) => row.id === targetId
    );
    const managedNodes =
      draftProfile?.nodeAssignments.filter(
        (row) => row.targetId.trim().length > 0
      ).length ??
      serverProfile?.nodes.length ??
      0;
    return (
      <Paper withBorder p="sm">
        <Stack gap={6}>
          <Group justify="space-between">
            <Text fw={700}>
              {draftProfile?.title || serverProfile?.title || targetId}
            </Text>
            <Badge variant="light">{managedNodes} nodes</Badge>
          </Group>
          <Text size="xs" c="dimmed" ff="monospace">
            {targetId}
          </Text>
        </Stack>
      </Paper>
    );
  }, [
    applyId,
    applyKind,
    draftStore.blocks,
    draftStore.channels,
    draftStore.playlists,
    draftStore.profiles,
    mergedMedia,
    serverSnapshot,
  ]);

  const serverMediaKinds = useMemo(
    () => ({
      path: serverMedia.filter((row) => row.sourceType === "path").length,
      url: serverMedia.filter((row) => row.sourceType === "url").length,
    }),
    [serverMedia]
  );

  const serverMediaFiltered = useMemo(() => {
    const q = serverMediaQuery.trim().toLowerCase();
    return serverMedia.filter((row) => {
      if (
        serverMediaSourceFilter !== "all" &&
        row.sourceType !== serverMediaSourceFilter
      )
        return false;
      if (!q) return true;
      return [row.id, row.title, row.artist, row.description, row.sourceValue]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [serverMedia, serverMediaQuery, serverMediaSourceFilter]);

  const playlistRowsFiltered = useMemo(() => {
    const q = serverMediaQuery.trim().toLowerCase();
    if (!q) return playlistsSorted;
    return playlistsSorted.filter((row) =>
      [row.id, row.title, row.artist, row.description]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [playlistsSorted, serverMediaQuery]);

  const blockRowsFiltered = useMemo(() => {
    const q = serverMediaQuery.trim().toLowerCase();
    if (!q) return blocksSorted;
    return blocksSorted.filter((row) => {
      const mediaCount = row.items.filter((item) => item.kind === "media").length;
      const playlistCount = row.items.filter((item) => item.kind === "playlist").length;
      return [row.id, row.title, row.mode, row.items.length, mediaCount, playlistCount]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [blocksSorted, serverMediaQuery]);

  const channelRowsFiltered = useMemo(() => {
    const q = serverMediaQuery.trim().toLowerCase();
    if (!q) return channelsSorted;
    return channelsSorted.filter((row) =>
      [row.id, row.title, row.blockIds.join(" ")]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [channelsSorted, serverMediaQuery]);

  const profileRowsFiltered = useMemo(() => {
    const q = serverMediaQuery.trim().toLowerCase();
    if (!q) return profilesSorted;
    return profilesSorted.filter((row) =>
      [
        row.id,
        row.title,
        row.defaultTargetKind,
        row.defaultTargetId,
        ...row.nodeAssignments.flatMap((node) => [
          node.nodeId,
          node.targetKind,
          node.targetId,
        ]),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [profilesSorted, serverMediaQuery]);

  const mediaFeedItems = useMemo(
    () => [],
    []
  );

  const hasMoreMediaFeed = useMemo(
    () => false,
    []
  );

  const selectedMediaDetail = useMemo(() => {
    if (!mediaDetailId) return null;
    return serverMedia.find((row) => row.id === mediaDetailId) ?? null;
  }, [mediaDetailId, serverMedia]);

  const selectedMediaDetailPreviewSrc = useMemo(
    () =>
      selectedMediaDetail ? mediaPreviewSource(selectedMediaDetail) : null,
    [selectedMediaDetail]
  );
  const selectedMediaDetailIsVideo = useMemo(
    () => (selectedMediaDetail ? isVideoMedia(selectedMediaDetail) : false),
    [selectedMediaDetail]
  );

  const deleteMediaItem = useCallback(
    async (mediaId: string) => {
      const ok = window.confirm(
        `Delete media "${mediaId}"? This also prunes references from playlists, blocks, channels, and profiles.`
      );
      if (!ok) return;
      try {
        setMediaDeleteBusy(true);
        const result = await deleteMedia(mediaId);
        if (!result.deleted) {
          throw new Error(`delete_media_failed:404:media_not_found:${mediaId}`);
        }
        if (selectedServerMediaId === mediaId) setSelectedServerMediaId(null);
        setMediaDetailId(null);
        setBuilderTab("media");
        await refreshDraftsAfterIngest();
        notifications.show({
          color: "teal",
          title: "Media deleted",
          message:
            `removed:${result.mediaId} ` +
            `playlistItems:${result.removedPlaylistItems} blockItems:${result.removedBlockItems} ` +
            `playlists:${result.removedPlaylists} blocks:${result.removedBlocks} ` +
            `channels:${result.removedChannels} profiles:${result.removedProfiles}`,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await refreshDraftsAfterIngest().catch(() => {});
        notifications.show({
          color: "red",
          title: "Delete media failed",
          message,
        });
      } finally {
        setMediaDeleteBusy(false);
      }
    },
    [refreshDraftsAfterIngest, selectedServerMediaId]
  );

  const deleteBlockDraft = useCallback(
    async (blockId: string): Promise<boolean> => {
      const id = blockId.trim();
      if (!id) return false;
      try {
        setBuilderBusy(true);
        const result = await deleteBlock(id);
        if (!result.deleted) {
          throw new Error(`delete_block_failed:404:block_not_found:${id}`);
        }
        await refreshServerSnapshot({ silent: true });
        notifications.show({
          color: "teal",
          title: "Block deleted",
          message:
            `removed:${result.blockId} ` +
            `channelRefs:${result.removedChannelBlocks} ` +
            `profileAssignments:${result.removedProfileAssignments} ` +
            `profilesUpdated:${result.updatedProfiles}`,
        });
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await refreshServerSnapshot({ silent: true }).catch(() => {});
        notifications.show({
          color: "red",
          title: "Delete block failed",
          message,
        });
        return false;
      } finally {
        setBuilderBusy(false);
      }
    },
    [refreshServerSnapshot]
  );

  const saveMediaMetadata = useCallback(
    async (args: {
      id: string;
      title?: string;
      artist?: string;
      description?: string;
      web?: Media["web"];
    }) => {
      const existing = serverMedia.find((row) => row.id === args.id);
      if (!existing) {
        throw new Error(`media_not_found:${args.id}`);
      }
      setMediaSaveBusy(true);
      try {
        await importResources({
          media: [
            {
              ...existing,
              title: args.title?.trim() || undefined,
              artist: args.artist?.trim() || undefined,
              description: args.description?.trim() || undefined,
              web: args.web,
            },
          ],
          playlists: [],
          blocks: [],
          channels: [],
          profiles: [],
        });
        await refreshDraftsAfterIngest();
        notifications.show({
          color: "teal",
          title: "Media updated",
          message: existing.id,
        });
      } finally {
        setMediaSaveBusy(false);
      }
    },
    [refreshDraftsAfterIngest, serverMedia]
  );

  const saveManyMediaMetadata = useCallback(
    async (args: { ids: string[]; artist?: string; description?: string }) => {
      const ids = Array.from(new Set(args.ids.map((id) => id.trim()).filter(Boolean)));
      if (ids.length === 0) return;

      const applyArtist = typeof args.artist === "string";
      const applyDescription = typeof args.description === "string";
      if (!applyArtist && !applyDescription) return;

      const selectedRows = serverMedia.filter((row) => ids.includes(row.id));
      if (selectedRows.length === 0) {
        throw new Error("no_media_selected_for_batch_update");
      }

      setMediaSaveBusy(true);
      try {
        await importResources({
          media: selectedRows.map((row) => ({
            ...row,
            artist: applyArtist
              ? args.artist?.trim() || undefined
              : row.artist,
            description: applyDescription
              ? args.description?.trim() || undefined
              : row.description,
          })),
          playlists: [],
          blocks: [],
          channels: [],
          profiles: [],
        });
        await refreshDraftsAfterIngest();
        notifications.show({
          color: "teal",
          title: "Media updated",
          message: `${selectedRows.length} item${selectedRows.length === 1 ? "" : "s"}`,
        });
      } finally {
        setMediaSaveBusy(false);
      }
    },
    [refreshDraftsAfterIngest, serverMedia]
  );

  const deleteManyMediaItems = useCallback(
    async (idsInput: string[]) => {
      const ids = Array.from(
        new Set(idsInput.map((id) => id.trim()).filter(Boolean))
      );
      if (ids.length === 0) return;

      const ok = window.confirm(
        `Delete ${ids.length} media item${ids.length === 1 ? "" : "s"}? This also prunes references from playlists, blocks, channels, and profiles.`
      );
      if (!ok) return;

      setMediaDeleteBusy(true);
      let deleted = 0;
      const failed: string[] = [];
      try {
        for (const mediaId of ids) {
          try {
            const result = await deleteMedia(mediaId);
            if (result.deleted) deleted += 1;
            else failed.push(mediaId);
          } catch {
            failed.push(mediaId);
          }
        }
        if (ids.includes(selectedServerMediaId || "")) {
          setSelectedServerMediaId(null);
        }
        setMediaDetailId(null);
        setBuilderTab("media");
        await refreshDraftsAfterIngest();
        if (deleted > 0) {
          notifications.show({
            color: "teal",
            title: "Media deleted",
            message: `${deleted} item${deleted === 1 ? "" : "s"} removed`,
          });
        }
        if (failed.length > 0) {
          notifications.show({
            color: "red",
            title: "Some deletes failed",
            message: failed.slice(0, 3).join(", "),
          });
        }
      } finally {
        setMediaDeleteBusy(false);
      }
    },
    [refreshDraftsAfterIngest, selectedServerMediaId]
  );

  const deletePlaylistDraft = useCallback(
    async (playlistId: string): Promise<boolean> => {
      const ok = window.confirm(`Delete playlist "${playlistId}"?`);
      if (!ok) return false;
      const id = playlistId.trim();
      if (!id) return false;
      try {
        setBuilderBusy(true);
        const result = await deletePlaylist(id);
        if (!result.deleted) {
          throw new Error(`delete_playlist_failed:404:playlist_not_found:${id}`);
        }
        if (selectedPlaylistId === id) setSelectedPlaylistId(null);
        await refreshServerSnapshot({ silent: true });
        notifications.show({
          color: "teal",
          title: "Playlist deleted",
          message:
            `removed:${result.playlistId} ` +
            `blockItems:${result.removedBlockItems} ` +
            `playlistItems:${result.removedPlaylistItems} ` +
            `profileAssignments:${result.removedProfileAssignments} ` +
            `profilesUpdated:${result.updatedProfiles}`,
        });
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await refreshServerSnapshot({ silent: true }).catch(() => {});
        notifications.show({
          color: "red",
          title: "Delete playlist failed",
          message,
        });
        return false;
      } finally {
        setBuilderBusy(false);
      }
    },
    [refreshServerSnapshot, selectedPlaylistId]
  );

  const deleteChannelDraft = useCallback(
    async (channelId: string): Promise<boolean> => {
      const id = channelId.trim();
      if (!id) return false;
      try {
        setBuilderBusy(true);
        const result = await deleteChannel(id);
        if (!result.deleted) {
          throw new Error(`delete_channel_failed:404:channel_not_found:${id}`);
        }
        await refreshServerSnapshot({ silent: true });
        notifications.show({
          color: "teal",
          title: "Channel deleted",
          message:
            `removed:${result.channelId} ` +
            `profileAssignments:${result.removedProfileAssignments} ` +
            `profilesUpdated:${result.updatedProfiles}`,
        });
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await refreshServerSnapshot({ silent: true }).catch(() => {});
        notifications.show({
          color: "red",
          title: "Delete channel failed",
          message,
        });
        return false;
      } finally {
        setBuilderBusy(false);
      }
    },
    [refreshServerSnapshot]
  );

  const deleteProfileDraft = useCallback(
    async (profileId: string): Promise<boolean> => {
      const id = profileId.trim();
      if (!id) return false;
      try {
        setBuilderBusy(true);
        const result = await deleteProfile(id);
        if (!result.deleted) {
          throw new Error(`delete_profile_failed:404:profile_not_found:${id}`);
        }
        await refreshServerSnapshot({ silent: true });
        notifications.show({
          color: "teal",
          title: "Profile deleted",
          message:
            `removed:${result.profileId} ` +
            `nodeAssignments:${result.removedNodeAssignments}`,
        });
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await refreshServerSnapshot({ silent: true }).catch(() => {});
        notifications.show({
          color: "red",
          title: "Delete profile failed",
          message,
        });
        return false;
      } finally {
        setBuilderBusy(false);
      }
    },
    [refreshServerSnapshot]
  );

  const mediaFilterData = useMemo(
    () => [
      { value: "all", label: `All (${serverMedia.length})` },
      { value: "path", label: `Path (${serverMediaKinds.path})` },
      { value: "url", label: `URL (${serverMediaKinds.url})` },
    ],
    [serverMedia.length, serverMediaKinds.path, serverMediaKinds.url]
  );

  const registryNodes = useMemo(
    () => {
      const byId = new Map<
        string,
        { nodeId: string; label: string; registered: boolean }
      >();
      for (const row of Object.values(opsNodeMap)) {
        byId.set(row.nodeId, {
          nodeId: row.nodeId,
          label: [row.nodeName, row.host, row.nodeId].filter(Boolean).join(" • "),
          registered: true,
        });
      }
      for (const row of profileDraft.nodeAssignments) {
        const nodeId = row.nodeId.trim();
        if (!nodeId || byId.has(nodeId)) continue;
        byId.set(nodeId, {
          nodeId,
          label: `${nodeId} • unregistered`,
          registered: false,
        });
      }
      return Array.from(byId.values()).sort((a, b) =>
        a.nodeId.localeCompare(b.nodeId)
      );
    },
    [opsNodeMap, profileDraft.nodeAssignments]
  );

  const pickerMedia = useMemo<Media[]>(() => mergedMedia, [mergedMedia]);

  useEffect(() => {
    if (!selectedServerMediaId) {
      setSelectedServerMediaId(serverMediaFiltered[0]?.id || null);
      return;
    }
    if (!serverMediaFiltered.some((row) => row.id === selectedServerMediaId)) {
      setSelectedServerMediaId(serverMediaFiltered[0]?.id || null);
    }
  }, [selectedServerMediaId, serverMediaFiltered]);

  useEffect(() => {
    setMediaLibraryPage(1);
    setPlaylistTablePage(1);
    setBlockTablePage(1);
    setChannelTablePage(1);
    setProfileTablePage(1);
  }, [serverMediaQuery, serverMediaSourceFilter]);

  useEffect(() => {
    if (!mediaDetailId) return;
    if (!serverMedia.some((row) => row.id === mediaDetailId)) {
      setMediaDetailId(null);
    }
  }, [mediaDetailId, serverMedia]);

  const canQueueIngest = useMemo(() => {
    if (ingestSource === "youtube") return youtubeUrl.trim().length > 0;
    if (ingestSource === "eden") return edenInput.trim().length > 0;
    if (ingestSource === "web") {
      return webUrl.trim().length > 0 && !parsedWebLaunchConfig.error;
    }
    return uploadFiles.length > 0;
  }, [
    edenInput,
    ingestSource,
    parsedWebLaunchConfig.error,
    uploadFiles.length,
    webUrl,
    youtubeUrl,
  ]);

  const selectedIngestLabel = useMemo(() => {
    if (ingestSource === "youtube") return "YouTube (yt-dlp)";
    if (ingestSource === "eden") return "Eden Collection";
    if (ingestSource === "web") return "Web Link";
    return "Upload Files / Zip";
  }, [ingestSource]);

  const activeIngestJobs = useMemo(
    () =>
      ingestJobs.filter(
        (job) => job.status === "queued" || job.status === "running"
      ),
    [ingestJobs]
  );

  const runningIngestCount = useMemo(
    () => activeIngestJobs.filter((job) => job.status === "running").length,
    [activeIngestJobs]
  );

  const currentLibraryPane = useMemo<
    "media" | "playlists" | "blocks" | "channels" | "profiles"
  >(() => {
    if (builderTab === "block" || builderTab === "blockEditor") return "blocks";
    if (builderTab === "channel" || builderTab === "channelEditor")
      return "channels";
    if (builderTab === "profile" || builderTab === "profileEditor")
      return "profiles";
    return mediaLibrarySection;
  }, [builderTab, mediaLibrarySection]);

  const builderFeatureKey = useMemo(() => {
    if (builderTab === "ingest") return "ingest";
    if (builderTab === "media" || builderTab === "mediaDetail") return "media";
    if (builderTab === "playlistEditor") return "playlists";
    if (builderTab === "block" || builderTab === "blockEditor") return "blocks";
    if (builderTab === "channel" || builderTab === "channelEditor")
      return "channels";
    return "profiles";
  }, [builderTab]);

  const previousBuilderFeatureKeyRef = useRef(builderFeatureKey);
  useEffect(() => {
    const previous = previousBuilderFeatureKeyRef.current;
    if (previous === builderFeatureKey) return;
    if (previous === "ingest") {
      resetIngestComposer();
    } else if (previous === "media") {
      resetMediaBrowserState();
    } else if (previous === "playlists") {
      resetPlaylistBrowserState();
    } else if (previous === "blocks") {
      resetBlockBrowserState();
    } else if (previous === "channels") {
      resetChannelBrowserState();
    } else if (previous === "profiles") {
      resetProfileBrowserState();
    }
    previousBuilderFeatureKeyRef.current = builderFeatureKey;
  }, [
    builderFeatureKey,
    resetBlockBrowserState,
    resetChannelBrowserState,
    resetIngestComposer,
    resetMediaBrowserState,
    resetPlaylistBrowserState,
    resetProfileBrowserState,
  ]);

  const previousMainTabRef = useRef(mainTab);
  useEffect(() => {
    const previous = previousMainTabRef.current;
    if (previous === mainTab) return;
    if (previous === "fleet") resetFleetWorkspaceState();
    previousMainTabRef.current = mainTab;
  }, [mainTab, resetFleetWorkspaceState]);

  const fleetPageCount = useMemo(
    () => Math.max(1, Math.ceil(filteredRows.length / TABLE_PAGE_SIZE.fleet)),
    [filteredRows.length]
  );
  const mediaLibraryPageCount = useMemo(
    () =>
      Math.max(1, Math.ceil(serverMediaFiltered.length / TABLE_PAGE_SIZE.media)),
    [serverMediaFiltered.length]
  );
  const playlistTablePageCount = useMemo(
    () =>
      Math.max(
        1,
        Math.ceil(playlistRowsFiltered.length / TABLE_PAGE_SIZE.playlists)
      ),
    [playlistRowsFiltered.length]
  );
  const blockTablePageCount = useMemo(
    () =>
      Math.max(1, Math.ceil(blockRowsFiltered.length / TABLE_PAGE_SIZE.blocks)),
    [blockRowsFiltered.length]
  );
  const channelTablePageCount = useMemo(
    () =>
      Math.max(
        1,
        Math.ceil(channelRowsFiltered.length / TABLE_PAGE_SIZE.channels)
      ),
    [channelRowsFiltered.length]
  );
  const profileTablePageCount = useMemo(
    () =>
      Math.max(
        1,
        Math.ceil(profileRowsFiltered.length / TABLE_PAGE_SIZE.profiles)
      ),
    [profileRowsFiltered.length]
  );

  useEffect(() => {
    setFleetPage((prev) => Math.min(prev, fleetPageCount));
  }, [fleetPageCount]);
  useEffect(() => {
    setMediaLibraryPage((prev) => Math.min(prev, mediaLibraryPageCount));
  }, [mediaLibraryPageCount]);
  useEffect(() => {
    setPlaylistTablePage((prev) => Math.min(prev, playlistTablePageCount));
  }, [playlistTablePageCount]);
  useEffect(() => {
    setBlockTablePage((prev) => Math.min(prev, blockTablePageCount));
  }, [blockTablePageCount]);
  useEffect(() => {
    setChannelTablePage((prev) => Math.min(prev, channelTablePageCount));
  }, [channelTablePageCount]);
  useEffect(() => {
    setProfileTablePage((prev) => Math.min(prev, profileTablePageCount));
  }, [profileTablePageCount]);

  const fleetRowsPage = useMemo(
    () => paginateRows(filteredRows, fleetPage, TABLE_PAGE_SIZE.fleet),
    [filteredRows, fleetPage]
  );
  const mediaRowsPage = useMemo(
    () =>
      paginateRows(serverMediaFiltered, mediaLibraryPage, TABLE_PAGE_SIZE.media),
    [mediaLibraryPage, serverMediaFiltered]
  );
  const playlistRowsPage = useMemo(
    () =>
      paginateRows(
        playlistRowsFiltered,
        playlistTablePage,
        TABLE_PAGE_SIZE.playlists
      ),
    [playlistRowsFiltered, playlistTablePage]
  );
  const blockRowsPage = useMemo(
    () =>
      paginateRows(blockRowsFiltered, blockTablePage, TABLE_PAGE_SIZE.blocks),
    [blockRowsFiltered, blockTablePage]
  );
  const channelRowsPage = useMemo(
    () =>
      paginateRows(
        channelRowsFiltered,
        channelTablePage,
        TABLE_PAGE_SIZE.channels
      ),
    [channelRowsFiltered, channelTablePage]
  );
  const profileRowsPage = useMemo(
    () =>
      paginateRows(
        profileRowsFiltered,
        profileTablePage,
        TABLE_PAGE_SIZE.profiles
      ),
    [profileRowsFiltered, profileTablePage]
  );

  const onUploadDrop = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;
      const nextFiles = [...uploadFiles, ...files];
      const zipFiles = nextFiles.filter((file) =>
        file.name.toLowerCase().endsWith(".zip")
      );
      const mediaFiles = nextFiles.filter(
        (file) => !file.name.toLowerCase().endsWith(".zip")
      );
      if (zipFiles.length > 1) {
        setUploadDropError("Only one zip archive is allowed.");
        return;
      }
      if (zipFiles.length === 1 && mediaFiles.length > 0) {
        setUploadDropError(
          "Upload either one zip archive or up to 20 media files, not both."
        );
        return;
      }
      if (mediaFiles.length > 20) {
        setUploadDropError("You can upload up to 20 media files at once.");
        return;
      }
      const totalBytes = nextFiles.reduce((sum, file) => sum + file.size, 0);
      if (totalBytes > 2 * 1024 * 1024 * 1024) {
        setUploadDropError("Uploads are limited to 2GB total.");
        return;
      }
      setUploadDropError(null);
      setUploadFiles(nextFiles);
      setUploadTitleOverrides([
        ...uploadFiles.map((file, index) => {
          const existing = uploadTitleOverrides[index]?.trim();
          return existing && existing.length > 0
            ? existing
            : defaultUploadTitle(file.name);
        }),
        ...files.map((file) => defaultUploadTitle(file.name)),
      ]);
      setUploadArtistOverrides([
        ...uploadFiles.map((_, index) => uploadArtistOverrides[index] ?? ""),
        ...files.map(() => ""),
      ]);
      setUploadDescriptionOverrides([
        ...uploadFiles.map(
          (_, index) => uploadDescriptionOverrides[index] ?? ""
        ),
        ...files.map(() => ""),
      ]);
    },
    [
      uploadArtistOverrides,
      uploadDescriptionOverrides,
      uploadFiles,
      uploadTitleOverrides,
    ]
  );

  const setUploadTitleOverrideAtIndex = useCallback((index: number, value: string) => {
    setUploadTitleOverrides((prev) => {
      const next = [...prev];
      next[index] = value.slice(0, UPLOAD_TITLE_MAX_LENGTH);
      return next;
    });
  }, []);

  const setUploadTitleForAll = useCallback(
    (value: string) => {
      const nextValue = value.slice(0, UPLOAD_TITLE_MAX_LENGTH);
      setUploadTitleOverrides(uploadFiles.map(() => nextValue));
    },
    [uploadFiles]
  );

  const setUploadArtistOverrideAtIndex = useCallback(
    (index: number, value: string) => {
      setUploadArtistOverrides((prev) => {
        const next = [...prev];
        next[index] = value.slice(0, 256);
        return next;
      });
    },
    []
  );

  const setUploadDescriptionOverrideAtIndex = useCallback(
    (index: number, value: string) => {
      setUploadDescriptionOverrides((prev) => {
        const next = [...prev];
        next[index] = value.slice(0, 4000);
        return next;
      });
    },
    []
  );

  const removeUploadFileAtIndex = useCallback((index: number) => {
    setUploadFiles((prev) => prev.filter((_, i) => i !== index));
    setUploadTitleOverrides((prev) => prev.filter((_, i) => i !== index));
    setUploadArtistOverrides((prev) => prev.filter((_, i) => i !== index));
    setUploadDescriptionOverrides((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const uploadPreviewItems = useMemo<UploadPreviewItem[]>(
    () =>
      uploadFiles.map((file) => {
        const kind = inferUploadPreviewKind(file);
        const url =
          kind === "image" || kind === "video" || kind === "audio"
            ? URL.createObjectURL(file)
            : null;
        return { file, kind, url };
      }),
    [uploadFiles]
  );

  useEffect(
    () => () => {
      for (const item of uploadPreviewItems) {
        if (item.url) URL.revokeObjectURL(item.url);
      }
    },
    [uploadPreviewItems]
  );

  const {
    getRootProps: getUploadRootProps,
    getInputProps: getUploadInputProps,
    isDragActive: isUploadDragActive,
  } = useDropzone({
    onDrop: onUploadDrop,
    multiple: true,
    maxSize: 2 * 1024 * 1024 * 1024,
    accept: {
      "video/*": [],
      "image/*": [],
      "audio/*": [],
      "application/zip": [".zip"],
      "application/x-zip-compressed": [".zip"],
    },
  });

  const loadPlaylistDraftById = useCallback(
    (playlistId: string): boolean => {
      const id = playlistId.trim();
      if (!id) return false;
      const row = draftStore.playlists.find((item) => item.id === id);
      if (!row) return false;
      setSelectedPlaylistId(id);
      setPlaylistDraft({
        id: row.id,
        title: row.title,
        artist: row.artist,
        description: row.description,
        mediaIds: [...row.mediaIds],
      });
      return true;
    },
    [draftStore.playlists]
  );

  const openPlaylistEditorRoute = useCallback(
    (playlistId?: string) => {
      const nextId = playlistId?.trim() || "";
      setMainTab("builder");
      setBuilderTab("playlistEditor");
      setMediaLibrarySection("playlists");
      if (nextId) {
        const loaded = loadPlaylistDraftById(nextId);
        if (!loaded) {
          setSelectedPlaylistId(null);
          setPlaylistDraft({
            ...EMPTY_PLAYLIST_DRAFT,
            id: nextId,
          });
        }
        updateOpsUrl({ view: "playlist-editor", playlistId: nextId });
      } else {
        setSelectedPlaylistId(null);
        setPlaylistDraft(EMPTY_PLAYLIST_DRAFT);
        updateOpsUrl({ view: "playlist-editor", playlistId: null });
      }
      if (isMobile) setControlOpen(false);
    },
    [isMobile, loadPlaylistDraftById]
  );

  const closePlaylistEditorRoute = useCallback(() => {
    setBuilderTab("media");
    setMediaLibrarySection("playlists");
    setPlaylistDragIndex(null);
    setPlaylistDropIndex(null);
    updateOpsUrl({ view: null, playlistId: null });
  }, []);

  const commitPlaylistDrop = useCallback(
    (targetIndex: number | null) => {
      if (playlistDragIndex === null || targetIndex === null) {
        setPlaylistDragIndex(null);
        setPlaylistDropIndex(null);
        return;
      }
      setPlaylistDraft((current) => {
        if (
          playlistDragIndex < 0 ||
          playlistDragIndex >= current.mediaIds.length
        )
          return current;
        const next = [...current.mediaIds];
        const [moved] = next.splice(playlistDragIndex, 1);
        if (!moved) return current;
        let insertionIndex = Math.max(0, Math.min(targetIndex, next.length));
        if (targetIndex > playlistDragIndex) {
          insertionIndex = Math.max(0, insertionIndex - 1);
        }
        if (insertionIndex === playlistDragIndex) return current;
        next.splice(insertionIndex, 0, moved);
        return { ...current, mediaIds: next };
      });
      setPlaylistDragIndex(null);
      setPlaylistDropIndex(null);
    },
    [playlistDragIndex]
  );

  useEffect(() => {
    const applyFromUrl = () => {
      const route = readOpsViewFromUrl();
      if (route.view === "playlist-editor") {
        setMainTab("builder");
        setBuilderTab("playlistEditor");
        setMediaLibrarySection("playlists");
        if (route.playlistId) {
          const loaded = loadPlaylistDraftById(route.playlistId);
          if (!loaded) {
            setSelectedPlaylistId(null);
            setPlaylistDraft({
              ...EMPTY_PLAYLIST_DRAFT,
              id: route.playlistId,
            });
          }
        } else {
          setSelectedPlaylistId(null);
          setPlaylistDraft(EMPTY_PLAYLIST_DRAFT);
        }
        return;
      }
      if (builderTab === "playlistEditor") {
        setBuilderTab("media");
        setMediaLibrarySection("playlists");
      }
    };
    applyFromUrl();
    window.addEventListener("popstate", applyFromUrl);
    return () => {
      window.removeEventListener("popstate", applyFromUrl);
    };
  }, [builderTab, loadPlaylistDraftById]);

  const loadProfileDraftById = useCallback(
    (profileId: string): boolean => {
      const id = profileId.trim();
      if (!id) return false;
      const row = draftStore.profiles.find((item) => item.id === id);
      if (!row) return false;
      setSelectedProfileId(id);
      setProfileDraft({
        id: row.id,
        title: row.title,
        defaultTargetKind: row.defaultTargetKind,
        defaultTargetId: row.defaultTargetId,
        nodeAssignments: row.nodeAssignments.map((node) => ({ ...node })),
      });
      return true;
    },
    [draftStore.profiles]
  );

  const loadBlockDraftById = useCallback(
    (blockId: string): boolean => {
      const id = blockId.trim();
      if (!id) return false;
      const row = draftStore.blocks.find((item) => item.id === id);
      if (!row) return false;
      setSelectedBlockId(id);
      setBlockDraft({
        id: row.id,
        title: row.title,
        mode: row.mode,
        items: row.items.map((item) => ({ ...item })),
      });
      return true;
    },
    [draftStore.blocks]
  );

  const loadChannelDraftById = useCallback(
    (channelId: string): boolean => {
      const id = channelId.trim();
      if (!id) return false;
      const row = draftStore.channels.find((item) => item.id === id);
      if (!row) return false;
      setSelectedChannelId(id);
      setChannelDraft({
        id: row.id,
        title: row.title,
        blockIds: [...row.blockIds],
      });
      return true;
    },
    [draftStore.channels]
  );

  const openBlockEditorRoute = useCallback(
    (blockId?: string) => {
      const nextId = blockId?.trim() || "";
      setMainTab("builder");
      setBuilderTab("blockEditor");
      setMediaLibrarySection("blocks");
      if (nextId) {
        const loaded = loadBlockDraftById(nextId);
        if (!loaded) {
          setSelectedBlockId(null);
          setBlockDraft({
            ...EMPTY_BLOCK_DRAFT,
            id: nextId,
          });
        }
      } else {
        setSelectedBlockId(null);
        setBlockDraft(EMPTY_BLOCK_DRAFT);
      }
      if (isMobile) setControlOpen(false);
    },
    [isMobile, loadBlockDraftById]
  );

  const closeBlockEditorRoute = useCallback(() => {
    setBuilderTab("block");
    setMediaLibrarySection("blocks");
  }, []);

  const openChannelEditorRoute = useCallback(
    (channelId?: string) => {
      const nextId = channelId?.trim() || "";
      setMainTab("builder");
      setBuilderTab("channelEditor");
      setMediaLibrarySection("channels");
      if (nextId) {
        const loaded = loadChannelDraftById(nextId);
        if (!loaded) {
          setSelectedChannelId(null);
          setChannelDraft({
            ...EMPTY_CHANNEL_DRAFT,
            id: nextId,
          });
        }
      } else {
        setSelectedChannelId(null);
        setChannelDraft(EMPTY_CHANNEL_DRAFT);
      }
      if (isMobile) setControlOpen(false);
    },
    [isMobile, loadChannelDraftById]
  );

  const closeChannelEditorRoute = useCallback(() => {
    setBuilderTab("channel");
    setMediaLibrarySection("channels");
  }, []);

  const openProfileEditorRoute = useCallback(
    (profileId?: string) => {
      const nextId = profileId?.trim() || "";
      setMainTab("builder");
      setBuilderTab("profileEditor");
      setMediaLibrarySection("profiles");
      if (nextId) {
        const loaded = loadProfileDraftById(nextId);
        if (!loaded) {
          setSelectedProfileId(null);
          setProfileDraft({
            ...EMPTY_PROFILE_DRAFT,
            id: nextId,
          });
        }
      } else {
        setSelectedProfileId(null);
        setProfileDraft(EMPTY_PROFILE_DRAFT);
      }
      if (isMobile) setControlOpen(false);
    },
    [isMobile, loadProfileDraftById]
  );

  const closeProfileEditorRoute = useCallback(() => {
    setBuilderTab("profile");
    setMediaLibrarySection("profiles");
  }, []);

  useEffect(() => {
    if (builderTab !== "profile") return;
    if (
      selectedProfileId &&
      draftStore.profiles.some((row) => row.id === selectedProfileId)
    )
      return;
    const first = draftStore.profiles[0];
    if (first) loadProfileDraftById(first.id);
  }, [builderTab, draftStore.profiles, loadProfileDraftById, selectedProfileId]);

  useEffect(() => {
    if (builderTab !== "block") return;
    if (
      selectedBlockId &&
      draftStore.blocks.some((row) => row.id === selectedBlockId)
    )
      return;
    const first = draftStore.blocks[0];
    if (first) loadBlockDraftById(first.id);
  }, [builderTab, draftStore.blocks, loadBlockDraftById, selectedBlockId]);

  useEffect(() => {
    if (builderTab !== "channel") return;
    if (
      selectedChannelId &&
      draftStore.channels.some((row) => row.id === selectedChannelId)
    )
      return;
    const first = draftStore.channels[0];
    if (first) loadChannelDraftById(first.id);
  }, [builderTab, draftStore.channels, loadChannelDraftById, selectedChannelId]);

  const fleetScreenVm = {
    isMobile: Boolean(isMobile),
    loadingFleet,
    fleetView,
    setFleetView,
    selectedNodeIds,
    nodeWorkspaceFocus,
    activeRegistryId,
    openEditNodeEditor,
    setAssignTargetOpen,
    setActiveNodeId,
    returnToGuide,
    nodeRuntimeBusy,
    refreshNodeRuntime,
    nodeRuntimeError,
    nodeRuntimeStatus,
    workspacePlaybackMedia,
    nodeStashBusy,
    refreshNodeStash,
    nodeStashClearing,
    nodeStash,
    clearNodeStash,
    deleteNodeStashItem,
    nodeStashError,
    sendNodeInputAction,
    nodeInputBusy,
    nodeInputError,
    nodeInputLastAction,
    bootstrapNodeRuntime,
    nodeBootstrapBusy,
    nodeBootstrapError,
    nodeBootstrapResult,
    nodeBootstrapStdout,
    nodeBootstrapStderr,
    setNodeDisplayMode,
    nodeDisplayModeBusy,
    nodeDisplayModeError,
    nodeDisplayModeResult,
    nodeStashFilterQuery,
    setNodeStashFilterQuery,
    nodeStashSort,
    setNodeStashSort,
    filteredNodeStashItems,
    nodeEditorOpen,
    setNodeEditorOpen,
    editingNodeId,
    nodeDraft,
    setNodeDraft,
    nodeSaving,
    saveNodeDraft,
    assignTargetOpen,
    applyKind,
    setApplyKind,
    applyId,
    setApplyId,
    currentApplyOptions,
    setTargetPickerOpen,
    applyTargetPreviewCard,
    optMode,
    setOptMode,
    optLock,
    setOptLock,
    optQr,
    setOptQr,
    optPlaylist,
    setOptPlaylist,
    optNosplash,
    setOptNosplash,
    optRemoteInput,
    setOptRemoteInput,
    optRemoteApp,
    setOptRemoteApp,
    optRemoteMic,
    setOptRemoteMic,
    optRemoteGuide,
    setOptRemoteGuide,
    optHud,
    setOptHud,
    optHudSec,
    setOptHudSec,
    optTheme,
    setOptTheme,
    optRotate,
    setOptRotate,
    runApply,
    applyResult,
    summarizeApplyResult,
    search,
    setSearch,
    selectVisible,
    clearSelection,
    openNodeWorkspace,
    setControlOpen,
    openCreateNodeEditor,
    exportNodes,
    filteredRows,
    toggleNodeSelection,
    removeNode,
    fleetRowsPage,
    selectedNodeRows,
    setSelectedNodeIds,
    fleetPage,
    setFleetPage,
    fleetPageCount,
    mergedMedia,
    mergedMediaById,
    mergedPlaylists,
  };

  const ingestSectionVm = {
    ingestStep,
    activeIngestJobs,
    runningIngestCount,
    ingestSource,
    setIngestSource,
    setIngestStep,
    selectedIngestLabel,
    youtubeUrl,
    setYoutubeUrl,
    youtubeTitle,
    setYoutubeTitle,
    youtubeArtist,
    setYoutubeArtist,
    youtubeDescription,
    setYoutubeDescription,
    webUrl,
    setWebUrl,
    webTitle,
    setWebTitle,
    webArtist,
    setWebArtist,
    webDescription,
    setWebDescription,
    webCache,
    setWebCache,
    webLaunchProfile,
    setWebLaunchProfile,
    webLaunchArgsEntries,
    setWebLaunchArgsEntries,
    webLaunchConfig: parsedWebLaunchConfig.config,
    webLaunchArgsError: parsedWebLaunchConfig.error,
    edenInput,
    setEdenInput,
    edenCreatePlaylist,
    setEdenCreatePlaylist,
    edenArtist,
    setEdenArtist,
    edenDescription,
    setEdenDescription,
    getUploadRootProps,
    getUploadInputProps,
    isUploadDragActive,
    uploadFiles,
    uploadTitleOverrides,
    setUploadTitleOverrideAtIndex,
    setUploadTitleForAll,
    uploadArtistOverrides,
    setUploadArtistOverrideAtIndex,
    uploadDescriptionOverrides,
    setUploadDescriptionOverrideAtIndex,
    uploadArtist,
    setUploadArtist,
    uploadDescription,
    setUploadDescription,
    uploadCreatePlaylist,
    setUploadCreatePlaylist,
    uploadPlaylistTitle,
    setUploadPlaylistTitle,
    uploadPreviewItems,
    removeUploadFileAtIndex,
    uploadDropError,
    canQueueIngest,
    ingestBusy,
    runYouTubeIngest,
    runEdenIngest,
    runWebIngest,
    runUploadIngest,
  };

  const mediaLibraryVm = {
    builderTab,
    loadingSnapshot,
    mediaLibrarySection,
    serverMediaFiltered,
    serverMedia,
    refreshServerSnapshot,
    openPlaylistEditorRoute,
    serverMediaQuery,
    setServerMediaQuery,
    serverMediaSourceFilter,
    setServerMediaSourceFilter,
    mediaFilterData,
    hasMoreMediaFeed,
    setMediaFeedLimit,
    activeIngestJobs,
    mediaFeedItems,
    mediaRowsPage,
    mediaLibraryPage,
    setMediaLibraryPage,
    mediaLibraryPageCount,
    selectedServerMediaId,
    setSelectedServerMediaId,
    setMediaDetailId,
    setBuilderTab,
    openQuickSend,
    deleteMediaItem,
    deleteManyMediaItems,
    saveManyMediaMetadata,
    mediaSaveBusy,
    mediaDeleteBusy,
    playlistCount: playlistRowsFiltered.length,
    playlistTotalCount: draftStore.playlists.length,
    mergedMediaById,
    deletePlaylistDraft,
    playlistRowsPage,
    playlistTablePage,
    setPlaylistTablePage,
    playlistTablePageCount,
    isMobile: Boolean(isMobile),
  };

  const playlistEditorVm = {
    isMobile: Boolean(isMobile),
    draftStore,
    playlistDraft,
    setPlaylistDraft,
    closePlaylistEditorRoute,
    setMediaPickerOpen,
    syncDraftStoreToControlDb,
    setSelectedPlaylistId,
    existingPlaylistIds: draftStore.playlists.map((row) => row.id),
    mergedMedia,
    playlistDragIndex,
    setPlaylistDragIndex,
    playlistDropIndex,
    setPlaylistDropIndex,
    commitPlaylistDrop,
  };

  const mediaDetailVm = {
    isMobile: Boolean(isMobile),
    setBuilderTab,
    setMediaLibrarySection,
    selectedMediaDetail,
    selectedMediaDetailPreviewSrc,
    selectedMediaDetailIsVideo,
    openQuickSend,
    mediaDeleteBusy,
    deleteMediaItem,
    mediaSaveBusy,
    saveMediaMetadata,
  };

  const containerEditorsVm = {
    builderTab,
    draftStore,
    syncDraftStoreToControlDb,
    deleteBlockDraft,
    deleteChannelDraft,
    deleteProfileDraft,
    isMobile: Boolean(isMobile),
    serverMediaQuery,
    setServerMediaQuery,
    blockRowsPage,
    blockCount: blockRowsFiltered.length,
    selectedBlockId,
    setSelectedBlockId,
    blockTablePage,
    setBlockTablePage,
    blockTablePageCount,
    blockDraft,
    setBlockDraft,
    openBlockEditorRoute,
    closeBlockEditorRoute,
    channelRowsPage,
    channelCount: channelRowsFiltered.length,
    selectedChannelId,
    setSelectedChannelId,
    channelTablePage,
    setChannelTablePage,
    channelTablePageCount,
    channelDraft,
    setChannelDraft,
    openChannelEditorRoute,
    closeChannelEditorRoute,
    profileRowsPage,
    profileCount: profileRowsFiltered.length,
    selectedProfileId,
    setSelectedProfileId,
    profileTablePage,
    setProfileTablePage,
    profileTablePageCount,
    profileDraft,
    setProfileDraft,
    openProfileEditorRoute,
    closeProfileEditorRoute,
    mediaOptions,
    playlistOptions,
    blockOptions,
    channelOptions,
    targetPickerItemsByKind,
    registryNodes,
  };

  return {
    isMobile,
    controlOpen,
    setControlOpen,
    toggleControlOpen,
    mainTab,
    setMainTab,
    builderTab,
    setBuilderTab,
    fleetView,
    setFleetView,
    mediaLibrarySection,
    setMediaLibrarySection,
    mediaPickerOpen,
    setMediaPickerOpen,
    targetPickerOpen,
    setTargetPickerOpen,
    quickSendOpen,
    setQuickSendOpen,
    nodeEditorOpen,
    setNodeEditorOpen,
    assignTargetOpen,
    setAssignTargetOpen,
    ingestPollersRef,
    ingestJobStatusRef,
    ingestWatchWarnedRef,
    refreshCatalogAndProfiles,
    refreshServerSnapshot,
    refreshNodesInventory,
    refreshFleet,
    fleetRows,
    filteredRows,
    selectedNode,
    metrics,
    profileOptions,
    channelOptions,
    blockOptions,
    playlistOptions,
    mediaOptions,
    currentApplyOptions,
    selectedNodeRows,
    nodeWorkspaceFocus,
    workspaceSingleNodeId,
    filteredNodeStashItems,
    quickSendRows,
    toggleNodeSelection,
    selectVisible,
    clearSelection,
    openNodeWorkspace,
    refreshNodeStash,
    refreshNodeRuntime,
    clearNodeStash,
    deleteNodeStashItem,
    openCreateNodeEditor,
    openEditNodeEditor,
    saveNodeDraft,
    removeNode,
    exportNodes,
    applyTargetToNodes,
    buildMediaLookup,
    runApply,
    returnToGuide,
    openQuickSend,
    runQuickSend,
    syncDraftStoreToControlDb,
    refreshDraftsAfterIngest,
    upsertIngestJob,
    stopPollingJob,
    startPollingJob,
    syncIngestJobs,
    routeToMediaLibraryAfterQueue,
    runYouTubeIngest,
    runEdenIngest,
    runUploadIngest,
    serverMedia,
    mergedMedia,
    mergedMediaById,
    workspacePlaybackMedia,
    mergedPlaylists,
    applyResourcePickerItems,
    applyTargetPreviewCard,
    serverMediaKinds,
    serverMediaFiltered,
    mediaFeedItems,
    hasMoreMediaFeed,
    selectedMediaDetail,
    selectedMediaDetailPreviewSrc,
    deleteMediaItem,
    saveMediaMetadata,
    deletePlaylistDraft,
    mediaFilterData,
    registryNodes,
    pickerMedia,
    canQueueIngest,
    selectedIngestLabel,
    activeIngestJobs,
    runningIngestCount,
    currentLibraryPane,
    fleetPageCount,
    playlistTablePageCount,
    blockTablePageCount,
    channelTablePageCount,
    profileTablePageCount,
    fleetRowsPage,
    playlistRowsPage,
    blockRowsPage,
    channelRowsPage,
    profileRowsPage,
    onUploadDrop,
    removeUploadFileAtIndex,
    uploadPreviewItems,
    loadPlaylistDraftById,
    openPlaylistEditorRoute,
    closePlaylistEditorRoute,
    commitPlaylistDrop,
    openBlockEditorRoute,
    closeBlockEditorRoute,
    openChannelEditorRoute,
    closeChannelEditorRoute,
    openProfileEditorRoute,
    closeProfileEditorRoute,
    fleetScreenVm,
    ingestSectionVm,
    mediaLibraryVm,
    playlistEditorVm,
    mediaDetailVm,
    containerEditorsVm,
    profiles,
    setProfiles,
    fleetMap,
    setFleetMap,
    opsNodeMap,
    setOpsNodeMap,
    activeRegistryId,
    setActiveRegistryId,
    selectedNodeIds,
    setSelectedNodeIds,
    activeNodeId,
    setActiveNodeId,
    editingNodeId,
    setEditingNodeId,
    nodeDraft,
    setNodeDraft,
    nodeSaving,
    setNodeSaving,
    loadingFleet,
    setLoadingFleet,
    loadingSnapshot,
    search,
    setSearch,
    lastTick,
    setLastTick,
    autoRefresh,
    setAutoRefresh,
    applyResult,
    setApplyResult,
    draftStore,
    serverSnapshot,
    setServerSnapshot,
    builderBusy,
    setBuilderBusy,
    quickSendTarget,
    setQuickSendTarget,
    quickSendNodeIds,
    setQuickSendNodeIds,
    quickSendQuery,
    setQuickSendQuery,
    quickSendBusy,
    setQuickSendBusy,
    playlistDragIndex,
    setPlaylistDragIndex,
    playlistDropIndex,
    setPlaylistDropIndex,
    fleetPage,
    setFleetPage,
    playlistTablePage,
    setPlaylistTablePage,
    blockTablePage,
    setBlockTablePage,
    channelTablePage,
    setChannelTablePage,
    profileTablePage,
    setProfileTablePage,
    mediaDeleteBusy,
    setMediaDeleteBusy,
    mediaSaveBusy,
    setMediaSaveBusy,
    serverMediaQuery,
    setServerMediaQuery,
    serverMediaSourceFilter,
    setServerMediaSourceFilter,
    selectedServerMediaId,
    setSelectedServerMediaId,
    mediaDetailId,
    setMediaDetailId,
    mediaFeedLimit,
    setMediaFeedLimit,
    selectedPlaylistId,
    setSelectedPlaylistId,
    selectedProfileId,
    setSelectedProfileId,
    selectedBlockId,
    setSelectedBlockId,
    selectedChannelId,
    setSelectedChannelId,
    nodeWorkspaceFocusId,
    setNodeWorkspaceFocusId,
    nodeStash,
    setNodeStash,
    nodeStashBusy,
    setNodeStashBusy,
    nodeStashClearing,
    setNodeStashClearing,
    nodeStashError,
    setNodeStashError,
    nodeStashFilterQuery,
    setNodeStashFilterQuery,
    nodeStashSort,
    setNodeStashSort,
    nodeRuntimeStatus,
    setNodeRuntimeStatus,
    nodeRuntimeBusy,
    setNodeRuntimeBusy,
    nodeRuntimeError,
    setNodeRuntimeError,
    ingestBusy,
    setIngestBusy,
    ingestSource,
    setIngestSource,
    ingestStep,
    setIngestStep,
    youtubeUrl,
    setYoutubeUrl,
    youtubeTitle,
    setYoutubeTitle,
    youtubeArtist,
    setYoutubeArtist,
    edenInput,
    setEdenInput,
    uploadFiles,
    setUploadFiles,
    uploadArtist,
    setUploadArtist,
    uploadDescription,
    setUploadDescription,
    uploadDropError,
    setUploadDropError,
    ingestJobs,
    setIngestJobs,
    applyKind,
    setApplyKind,
    applyId,
    setApplyId,
    optMode,
    setOptMode,
    optLock,
    setOptLock,
    optQr,
    setOptQr,
    optPlaylist,
    setOptPlaylist,
    optNosplash,
    setOptNosplash,
    optRemoteInput,
    setOptRemoteInput,
    optRemoteApp,
    setOptRemoteApp,
    optRemoteMic,
    setOptRemoteMic,
    optRemoteGuide,
    setOptRemoteGuide,
    optHud,
    setOptHud,
    optHudSec,
    setOptHudSec,
    optTheme,
    setOptTheme,
    optRotate,
    setOptRotate,
    playlistDraft,
    setPlaylistDraft,
    blockDraft,
    setBlockDraft,
    channelDraft,
    setChannelDraft,
    profileDraft,
    setProfileDraft,
    updateOpsUrl,
    parseTargetFromKioskUrl,
    statusBadge,
    summarizeApplyResult,
  };
}

export type OpsAppModel = ReturnType<typeof useOpsAppModel>;
