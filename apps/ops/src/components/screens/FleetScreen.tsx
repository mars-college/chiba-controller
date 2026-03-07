import {
  useEffect,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Checkbox,
  Group,
  Image,
  Pagination,
  Paper,
  Progress,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import {
  IconAdjustments,
  IconArrowLeft,
  IconBroadcast,
  IconChecklist,
  IconDownload,
  IconKeyboard,
  IconPencil,
  IconRefresh,
  IconSearch,
  IconSquareRoundedPlus,
  IconTrash,
} from "@tabler/icons-react";
import { AssignTargetPanel } from "../AssignTargetPanel";
import { DetailBreadcrumbs } from "../DetailBreadcrumbs";
import { NodeControlPanel } from "../NodeControlPanel";
import { NodeEditorPanel, type NodeDraft } from "../NodeEditorPanel";
import { SectionLoader } from "../SectionLoader";
import { type Media } from "../../lib/controlApi";
import {
  type FleetPiHealth,
  type OpsNodeBootstrapResponse,
  type OpsNodeDisplayModeResponse,
} from "../../types";
import type { NodeRuntimeInputAction } from "@chiba-cable3/contracts";
import {
  TABLE_PAGE_SIZE,
  formatBytes,
  formatDurationSec,
  isVideoMedia,
  mediaPreviewSource,
  parseKioskTarget,
  statusBadge,
  tableRangeLabel,
} from "../../lib/opsModel";

export type FleetScreenVm = {
  isMobile: boolean;
  loadingFleet: boolean;
  fleetView: "table" | "workspace";
  setFleetView: (view: "table" | "workspace") => void;
  selectedNodeIds: string[];
  nodeWorkspaceFocus: FleetPiHealth | null;
  activeRegistryId: string;
  openEditNodeEditor: (nodeId: string) => void;
  setAssignTargetOpen: (open: boolean) => void;
  setActiveNodeId: (nodeId: string) => void;
  returnToGuide: () => Promise<void>;
  nodeRuntimeBusy: boolean;
  refreshNodeRuntime: (nodeId: string, silent?: boolean) => Promise<void>;
  nodeRuntimeError: string | null;
  nodeRuntimeStatus: any;
  workspacePlaybackMedia: Media | null;
  nodeStashBusy: boolean;
  refreshNodeStash: (nodeId: string, silent?: boolean) => Promise<void>;
  nodeStashClearing: boolean;
  nodeStash: any;
  clearNodeStash: () => Promise<void>;
  deleteNodeStashItem: (fileName: string) => Promise<void>;
  nodeStashError: string | null;
  sendNodeInputAction: (action: NodeRuntimeInputAction) => Promise<void>;
  nodeInputBusy: boolean;
  nodeInputError: string | null;
  nodeInputLastAction: string | null;
  bootstrapNodeRuntime: (payload: {
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
  }) => Promise<void>;
  nodeBootstrapBusy: boolean;
  nodeBootstrapError: string | null;
  nodeBootstrapResult: OpsNodeBootstrapResponse | null;
  nodeBootstrapStdout: string;
  nodeBootstrapStderr: string;
  setNodeDisplayMode: (payload: {
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
  }) => Promise<void>;
  nodeDisplayModeBusy: boolean;
  nodeDisplayModeError: string | null;
  nodeDisplayModeResult: OpsNodeDisplayModeResponse | null;
  nodeStashFilterQuery: string;
  setNodeStashFilterQuery: (query: string) => void;
  nodeStashSort:
    | "name"
    | "size_desc"
    | "size_asc"
    | "updated_desc"
    | "updated_asc";
  setNodeStashSort: (
    sort: "name" | "size_desc" | "size_asc" | "updated_desc" | "updated_asc"
  ) => void;
  filteredNodeStashItems: Array<{
    fileName: string;
    sizeBytes: number;
    updatedAtMs: number;
  }>;
  nodeEditorOpen: boolean;
  setNodeEditorOpen: (open: boolean) => void;
  editingNodeId: string | null;
  nodeDraft: NodeDraft;
  setNodeDraft: Dispatch<SetStateAction<NodeDraft>>;
  nodeSaving: boolean;
  saveNodeDraft: () => Promise<void>;
  assignTargetOpen: boolean;
  applyKind: "media" | "playlist" | "block" | "channel" | "profile";
  applyId: string;
  setTargetPickerOpen: (open: boolean) => void;
  applyTargetPreviewCard: ReactNode;
  optMode: "inherit" | "guide" | "gallery";
  setOptMode: (value: "inherit" | "guide" | "gallery") => void;
  optLock: "inherit" | "on" | "off";
  setOptLock: (value: "inherit" | "on" | "off") => void;
  optQr: "inherit" | "on" | "off";
  setOptQr: (value: "inherit" | "on" | "off") => void;
  optPlaylist: "inherit" | "on" | "off";
  setOptPlaylist: (value: "inherit" | "on" | "off") => void;
  optNosplash: "inherit" | "on" | "off";
  setOptNosplash: (value: "inherit" | "on" | "off") => void;
  optRemoteInput: "inherit" | "on" | "off";
  setOptRemoteInput: (value: "inherit" | "on" | "off") => void;
  optRemoteApp: "inherit" | "on" | "off";
  setOptRemoteApp: (value: "inherit" | "on" | "off") => void;
  optRemoteMic: "inherit" | "on" | "off";
  setOptRemoteMic: (value: "inherit" | "on" | "off") => void;
  optRemoteGuide: "inherit" | "on" | "off";
  setOptRemoteGuide: (value: "inherit" | "on" | "off") => void;
  optHud: "inherit" | "always" | "start" | "never";
  setOptHud: (value: "inherit" | "always" | "start" | "never") => void;
  optHudSec: number | "";
  setOptHudSec: (value: number | "") => void;
  optTheme: string;
  setOptTheme: (value: string) => void;
  optRotate: "inherit" | "0" | "90" | "180" | "270";
  setOptRotate: (value: "inherit" | "0" | "90" | "180" | "270") => void;
  runApply: () => Promise<void>;
  applyResult: any;
  summarizeApplyResult: (result: any) => string;
  search: string;
  setSearch: (value: string) => void;
  selectVisible: () => void;
  clearSelection: () => void;
  openNodeWorkspace: () => void;
  setControlOpen: (open: boolean) => void;
  openCreateNodeEditor: () => void;
  filteredRows: FleetPiHealth[];
  toggleNodeSelection: (nodeId: string, checked: boolean) => void;
  removeNode: (nodeId: string) => Promise<void>;
  fleetRowsPage: FleetPiHealth[];
  selectedNodeRows: FleetPiHealth[];
  setSelectedNodeIds: Dispatch<SetStateAction<string[]>>;
  fleetPage: number;
  setFleetPage: (page: number) => void;
  fleetPageCount: number;
  mergedMedia: Media[];
  mergedMediaById: Map<string, Media>;
  mergedPlaylists: Array<{
    id: string;
    title?: string;
    artist?: string;
    description?: string;
    mediaIds: string[];
  }>;
};

type WorkspacePanel =
  | "overview"
  | "assign"
  | "control"
  | "edit"
  | "stash"
  | "runtime";

function cacheSourceExt(sourceValue: string): string {
  const raw = sourceValue.trim();
  if (!raw) return "";
  try {
    const pathname = new URL(raw).pathname || "";
    const match = pathname.match(/\.[a-z0-9]+$/i);
    return match ? match[0].toLowerCase() : "";
  } catch {
    const match = raw.match(/\.[a-z0-9]+$/i);
    return match ? match[0].toLowerCase() : "";
  }
}

async function sha1Hex(value: string): Promise<string> {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    throw new Error("sha1_unavailable");
  }
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-1", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function FleetScreen({ vm }: { vm: FleetScreenVm }) {
  const {
    isMobile,
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
    applyId,
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
  } = vm;

  const [workspacePanel, setWorkspacePanel] =
    useState<WorkspacePanel>("overview");
  const [mobileSelectionMode, setMobileSelectionMode] = useState(false);

  useEffect(() => {
    if (nodeEditorOpen) setWorkspacePanel("edit");
  }, [nodeEditorOpen]);

  useEffect(() => {
    if (assignTargetOpen) setWorkspacePanel("assign");
  }, [assignTargetOpen]);

  useEffect(() => {
    if (fleetView !== "workspace") {
      setWorkspacePanel("overview");
      setAssignTargetOpen(false);
      setNodeEditorOpen(false);
    }
  }, [fleetView, setAssignTargetOpen, setNodeEditorOpen]);

  useEffect(() => {
    if (!isMobile && mobileSelectionMode) {
      setMobileSelectionMode(false);
    }
  }, [isMobile, mobileSelectionMode]);

  const openRowWorkspace = (nodeId: string) => {
    setSelectedNodeIds([nodeId]);
    setFleetView("workspace");
  };

  const mediaSourceLabel = (media: Media): string => {
    const raw = media.sourceValue.trim();
    if (!raw) return "Media source";
    if (media.sourceType === "url") {
      try {
        const parsed = new URL(raw);
        const host = parsed.hostname.replace(/^www\./i, "").trim();
        const leaf = decodeURIComponent(
          parsed.pathname.split("/").filter(Boolean).pop() || ""
        ).trim();
        if (host && leaf) return `${host}/${leaf}`;
        if (host) return host;
      } catch {
        // no-op
      }
    }
    const leaf = raw.split(/[\\/]/).filter(Boolean).pop()?.trim();
    return leaf || raw;
  };

  const mediaDisplayLabel = (media: Media): string => {
    const title = media.title?.trim();
    if (title) return title;
    return mediaSourceLabel(media);
  };

  const mediaDisplaySubtitle = (media: Media): string => {
    const artist = media.artist?.trim();
    if (artist) return artist;
    return media.sourceType === "url" ? "Web media" : "Media";
  };

  const resolveRuntimeCard = (kioskUrl: string | null | undefined) => {
    const target = parseKioskTarget(kioskUrl);
    if (target.kind === "media" && target.id) {
      const media = mergedMediaById.get(target.id);
      if (!media) {
        return {
          kind: "media",
          label: "Missing media item",
          subtitle: "Not found in media library",
          thumbnailUrl: null as string | null,
        };
      }
      return {
        kind: "media",
        label: mediaDisplayLabel(media),
        subtitle: mediaDisplaySubtitle(media),
        thumbnailUrl: media.thumbnailUrl || null,
      };
    }
    if (target.kind === "playlist" && target.id) {
      const playlist = mergedPlaylists.find((row) => row.id === target.id);
      if (!playlist) {
        return {
          kind: "playlist",
          label: "Missing playlist",
          subtitle: "Not found in playlist library",
          thumbnailUrl: null as string | null,
        };
      }
      const thumb = playlist.mediaIds
        .map((mediaId) => mergedMediaById.get(mediaId))
        .find((row) => Boolean(row?.thumbnailUrl));
      return {
        kind: "playlist",
        label: playlist.title || playlist.id,
        subtitle: playlist.artist || `${playlist.mediaIds.length} item(s)`,
        thumbnailUrl: thumb?.thumbnailUrl || null,
      };
    }
    return {
      kind: target.kind,
      label: target.label,
      subtitle: "",
      thumbnailUrl: null as string | null,
    };
  };

  const connectivityStatusColor = (row: FleetPiHealth) => {
    const status = row.connectivity?.status;
    if (status === "online") return "teal";
    if (status === "degraded") return "yellow";
    if (status === "progressing") return "blue";
    return "red";
  };

  const connectivityStatusLabel = (row: FleetPiHealth) => {
    const status = row.connectivity?.status || "offline";
    if (status === "progressing") return "progressing";
    const score = row.connectivity?.score ?? 0;
    const total = row.connectivity?.total ?? 5;
    return `${status} ${score}/${total}`;
  };

  const displayResolutionLabel = (row: FleetPiHealth) => {
    const mode = (row.chibaNode.displayMode || "").trim();
    if (mode) return mode;
    return "res ?";
  };

  const nodeMetaLabel = (row: FleetPiHealth) => {
    const parts = [
      row.nodeName?.trim() || "",
      (row.host || row.ip || "").trim(),
    ].filter(Boolean);
    return parts.join(" • ") || "Unnamed node";
  };

  const nodeHostLabel = (row: FleetPiHealth) => {
    const parts = [(row.host || "").trim(), (row.ip || "").trim()].filter(
      Boolean
    );
    return parts.join(" • ") || "host unavailable";
  };

  const versionsCompactLabel = (row: FleetPiHealth) =>
    `n ${row.chibaNode.version ?? "?"} · c ${row.cableServer?.version ?? "?"}`;

  const lastCheckedLabel = (row: FleetPiHealth) => {
    if (row.connectivity?.status === "progressing") return "checking...";
    return `${Math.max(
      0,
      Math.round((Date.now() - row.lastCheckedAt) / 1000)
    )}s ago`;
  };

  const renderConnectivitySignals = (row: FleetPiHealth) => {
    const signals = [
      { label: "DNS", ok: row.dnsOk },
      { label: "SSH", ok: row.tcp.ssh22.ok },
      { label: "APP", ok: row.http.nodeStatus.ok },
      { label: "API", ok: row.http.cableVersion.ok },
    ];
    return (
      <Group gap={4} wrap="wrap" className="ops-fleet-signal-strip">
        {signals.map((signal) => (
          <Text
            key={`${row.id}-${signal.label}`}
            component="span"
            className={`ops-fleet-signal-pill ${
              signal.ok ? "is-up" : "is-down"
            }`}
          >
            {signal.label}
          </Text>
        ))}
      </Group>
    );
  };

  const renderRuntimeSummary = (
    row: FleetPiHealth,
    variant: "mobile" | "table"
  ) => {
    const runtime = resolveRuntimeCard(row.chibaNode.kioskUrl ?? null);
    const cacheProgress = toCacheProgress({
      cacheReady: row.chibaNode.runtime?.cacheReady,
      cacheTotal: row.chibaNode.runtime?.cacheTotal,
      phase: row.chibaNode.runtime?.phase,
    });
    const cacheDownloadProgress = cacheProgress?.active ? cacheProgress : null;
    const thumbWidth = variant === "mobile" ? 64 : 76;
    const thumbHeight = variant === "mobile" ? 40 : 46;
    const subtitle = runtime.subtitle?.trim() || versionsCompactLabel(row);

    if (variant === "mobile") {
      return (
        <Group
          wrap="nowrap"
          align="center"
          gap="xs"
          className="ops-fleet-runtime-row"
        >
          {runtime.thumbnailUrl ? (
            <Image
              src={runtime.thumbnailUrl}
              alt={runtime.label}
              w={thumbWidth}
              h={thumbHeight}
              radius="sm"
              fit="cover"
            />
          ) : null}
          <Stack gap={1} style={{ minWidth: 0, flex: 1 }}>
            <Text size="sm" fw={600} lineClamp={1} title={runtime.label}>
              {runtime.label}
            </Text>
            {subtitle ? (
              <Text size="xs" c="dimmed" lineClamp={1} title={subtitle}>
                {subtitle}
              </Text>
            ) : null}
          </Stack>
        </Group>
      );
    }

    return (
      <Stack gap={6} className="ops-fleet-runtime-summary">
        <Group
          wrap="nowrap"
          align="flex-start"
          gap="xs"
          className="ops-fleet-runtime-row"
        >
          {runtime.thumbnailUrl ? (
            <Image
              src={runtime.thumbnailUrl}
              alt={runtime.label}
              w={thumbWidth}
              h={thumbHeight}
              radius="sm"
              fit="cover"
            />
          ) : null}
          <Stack gap={2} style={{ minWidth: 0, flex: 1 }}>
            <Group gap={6} wrap="wrap">
              <Badge size="xs" variant="light">
                {runtime.kind}
              </Badge>
            </Group>
            <Text size="sm" fw={600} lineClamp={1} title={runtime.label}>
              {runtime.label}
            </Text>
            <Text size="xs" c="dimmed" lineClamp={1} title={subtitle}>
              {subtitle}
            </Text>
          </Stack>
        </Group>
        {cacheDownloadProgress ? (
          <Group gap={8} wrap="nowrap" align="center">
            <Progress
              size="xs"
              radius="xl"
              value={cacheDownloadProgress.percent}
              color="blue"
              striped
              animated
              className="ops-fleet-runtime-progress"
            />
            <Text
              size="xs"
              c="dimmed"
              className="ops-fleet-runtime-progress-label"
            >
              {cacheDownloadProgress.ready}/{cacheDownloadProgress.total}
            </Text>
          </Group>
        ) : null}
      </Stack>
    );
  };

  const openEditPanel = () => {
    if (selectedNodeIds.length === 1 && nodeWorkspaceFocus) {
      openEditNodeEditor(nodeWorkspaceFocus.id);
    } else if (!nodeEditorOpen) {
      openCreateNodeEditor();
    }
    setAssignTargetOpen(false);
    setNodeEditorOpen(true);
    setWorkspacePanel("edit");
  };

  const openAssignPanel = () => {
    setNodeEditorOpen(false);
    setAssignTargetOpen(true);
    setWorkspacePanel("assign");
  };

  const openControlPanel = () => {
    setAssignTargetOpen(false);
    setNodeEditorOpen(false);
    setWorkspacePanel("control");
  };

  const openStashPanel = () => {
    setAssignTargetOpen(false);
    setNodeEditorOpen(false);
    setWorkspacePanel("stash");
  };

  const closeWorkspacePanels = () => {
    setAssignTargetOpen(false);
    setNodeEditorOpen(false);
    setWorkspacePanel("overview");
  };

  const workspaceScopeLabel =
    selectedNodeIds.length === 1
      ? nodeWorkspaceFocus?.id || selectedNodeIds[0] || "1 node"
      : `${selectedNodeIds.length} nodes`;
  const runtimePlaybackFileName = (
    nodeRuntimeStatus?.status.playback?.path || ""
  )
    .split("/")
    .filter(Boolean)
    .pop();
  const runtimeCurrentTargetLabel =
    nodeRuntimeStatus?.status.currentTarget?.kind &&
    nodeRuntimeStatus?.status.currentTarget?.id
      ? `${nodeRuntimeStatus.status.currentTarget.kind}:${nodeRuntimeStatus.status.currentTarget.id}`
      : null;
  const runtimeNowPlayingLabel =
    nodeRuntimeStatus?.status.playback?.title ||
    workspacePlaybackMedia?.title ||
    nodeRuntimeStatus?.status.playback?.mediaId ||
    nodeRuntimeStatus?.status.currentItemId ||
    runtimeCurrentTargetLabel ||
    "No active media";
  const runtimeProgressUnavailableMessage =
    nodeRuntimeStatus?.status.backend === "chromium"
      ? "Playback telemetry unavailable while Chromium backend is active."
      : "Playback progress unavailable for this target.";
  const toCacheProgress = (args: {
    cacheReady?: unknown;
    cacheTotal?: unknown;
    phase?: unknown;
  }) => {
    const total =
      typeof args.cacheTotal === "number" && Number.isFinite(args.cacheTotal)
        ? Math.max(0, Math.floor(args.cacheTotal))
        : 0;
    if (total <= 0) return null;
    const readyRaw =
      typeof args.cacheReady === "number" && Number.isFinite(args.cacheReady)
        ? Math.floor(args.cacheReady)
        : 0;
    const ready = Math.max(0, Math.min(total, readyRaw));
    const phase =
      typeof args.phase === "string" ? args.phase.toLowerCase() : "";
    const active = phase === "warming" || ready < total;
    const percent = Math.max(0, Math.min(100, (ready / total) * 100));
    return {
      ready,
      total,
      phase,
      active,
      percent,
    };
  };
  const runtimeCacheProgress = toCacheProgress({
    cacheReady: nodeRuntimeStatus?.status.cacheReady,
    cacheTotal: nodeRuntimeStatus?.status.cacheTotal,
    phase: nodeRuntimeStatus?.status.phase,
  });
  const runtimeCacheDownloadProgress = runtimeCacheProgress?.active
    ? runtimeCacheProgress
    : null;
  const [stashPreviewMap, setStashPreviewMap] = useState<
    Record<
      string,
      {
        mediaId: string;
        label: string;
        subtitle: string;
        previewSrc: string | null;
      }
    >
  >({});

  useEffect(() => {
    const fileNames = new Set(
      (nodeStash?.cache?.files ?? [])
        .map((file: { name?: unknown }) =>
          typeof file.name === "string" ? file.name.trim() : ""
        )
        .filter(Boolean)
    );
    if (fileNames.size === 0 || mergedMedia.length === 0) {
      setStashPreviewMap({});
      return;
    }
    if (typeof crypto === "undefined" || !crypto.subtle) {
      setStashPreviewMap({});
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const nextEntries = await Promise.all(
          mergedMedia.map(async (media) => {
            const ext = cacheSourceExt(media.sourceValue) || ".bin";
            const fileName = `${await sha1Hex(`${media.id}:${media.sourceValue}`)}${ext}`;
            if (!fileNames.has(fileName)) return null;
            return [
              fileName,
              {
                mediaId: media.id,
                label: media.title || media.id,
                subtitle: media.artist || media.id,
                previewSrc: media.thumbnailUrl || mediaPreviewSource(media),
              },
            ] as const;
          })
        );
        if (cancelled) return;
        setStashPreviewMap(
          Object.fromEntries(
            nextEntries.filter(
              (
                entry
              ): entry is readonly [
                string,
                {
                  mediaId: string;
                  label: string;
                  subtitle: string;
                  previewSrc: string | null;
                }
              ] => Boolean(entry)
            )
          )
        );
      } catch {
        if (!cancelled) setStashPreviewMap({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mergedMedia, nodeStash]);

  return (
    <Tabs.Panel value="fleet" pt="md">
      {fleetView === "workspace" ? (
        <Paper
          withBorder={!isMobile}
          radius={isMobile ? 0 : "md"}
          p={isMobile ? "xs" : "md"}
          className="ops-fleet-panel"
        >
          <Stack gap="md">
            <Group justify="space-between" align="center" wrap="wrap">
              <Stack gap={4}>
                <DetailBreadcrumbs
                  items={[
                    {
                      label: "Node Ops",
                      onClick: () => {
                        setFleetView("table");
                        closeWorkspacePanels();
                      },
                    },
                    {
                      label: workspaceScopeLabel,
                      onClick: closeWorkspacePanels,
                    },
                    ...(workspacePanel === "assign"
                      ? [{ label: "Assign Target" }]
                      : workspacePanel === "control"
                      ? [{ label: "Control App/Web" }]
                      : workspacePanel === "edit"
                      ? [{ label: editingNodeId ? "Edit Node" : "Add Node" }]
                      : workspacePanel === "stash"
                      ? [{ label: "Media Stash" }]
                      : workspacePanel === "runtime"
                      ? [{ label: "Runtime" }]
                      : []),
                  ]}
                />
              </Stack>
              <Badge variant="light">{selectedNodeIds.length} selected</Badge>
            </Group>

            {selectedNodeIds.length === 0 ? (
              <>
                <Card withBorder p="md">
                  <Stack gap="xs">
                    <Text fw={700}>No nodes selected</Text>
                    <Text size="sm" c="dimmed">
                      Select one or more nodes from Node Ops to edit details or
                      apply state.
                    </Text>
                    <Group>
                      <Button
                        variant="light"
                        onClick={() => setFleetView("table")}
                      >
                        Open node list
                      </Button>
                      <Button
                        variant="light"
                        leftSection={<IconSquareRoundedPlus size={14} />}
                        onClick={openEditPanel}
                      >
                        Add Node
                      </Button>
                    </Group>
                  </Stack>
                </Card>
                {workspacePanel === "edit" && nodeEditorOpen ? (
                  <NodeEditorPanel
                    editingNodeId={editingNodeId}
                    nodeDraft={nodeDraft}
                    setNodeDraft={setNodeDraft}
                    onSave={saveNodeDraft}
                    saving={nodeSaving}
                    onClose={closeWorkspacePanels}
                    breadcrumbs={[
                      {
                        label: workspaceScopeLabel,
                        onClick: closeWorkspacePanels,
                      },
                      { label: editingNodeId ? "Edit Node" : "Add Node" },
                    ]}
                  />
                ) : null}
              </>
            ) : (
              <>
                {workspacePanel === "overview" &&
                selectedNodeIds.length === 1 &&
                nodeWorkspaceFocus ? (
                  <Card withBorder p="md">
                    <Stack gap="sm">
                      <Group justify="space-between" align="flex-start">
                        <div>
                          <Text fw={700}>{nodeWorkspaceFocus.id}</Text>
                          <Text size="sm" c="dimmed">
                            {nodeWorkspaceFocus.nodeName || "Unnamed node"}
                          </Text>
                        </div>
                        <Badge variant="light">
                          {nodeWorkspaceFocus.registryId || activeRegistryId}
                        </Badge>
                      </Group>
                      <Text size="xs" ff="monospace">
                        {nodeWorkspaceFocus.host || "—"}{" "}
                        {nodeWorkspaceFocus.ip
                          ? `• ${nodeWorkspaceFocus.ip}`
                          : ""}
                      </Text>
                      <Group gap={6}>
                        {statusBadge(nodeWorkspaceFocus.dnsOk, "DNS", "DNS")}
                        {statusBadge(
                          nodeWorkspaceFocus.tcp.ssh22.ok,
                          "SSH",
                          "SSH"
                        )}
                        {statusBadge(
                          nodeWorkspaceFocus.http.nodeStatus.ok,
                          "Node",
                          "Node"
                        )}
                        {statusBadge(
                          nodeWorkspaceFocus.http.cableVersion.ok,
                          "Cable",
                          "Cable"
                        )}
                      </Group>
                      <Paper withBorder p="sm" radius="md">
                        <Stack gap="xs">
                          <Group
                            justify="space-between"
                            align="center"
                            wrap="wrap"
                          >
                            <Text fw={600}>Now Playing</Text>
                            <Button
                              size="xs"
                              variant="light"
                              leftSection={<IconRefresh size={12} />}
                              loading={nodeRuntimeBusy}
                              onClick={() =>
                                void refreshNodeRuntime(nodeWorkspaceFocus.id)
                              }
                            >
                              Refresh
                            </Button>
                          </Group>
                          {nodeRuntimeError ? (
                            <Text size="sm" c="red">
                              {nodeRuntimeError}
                            </Text>
                          ) : null}
                          {!nodeRuntimeStatus && nodeRuntimeBusy ? (
                            <SectionLoader label="Loading runtime playback..." />
                          ) : nodeRuntimeStatus ? (
                            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                              <Card withBorder p="xs">
                                {workspacePlaybackMedia?.thumbnailUrl ? (
                                  <Image
                                    src={workspacePlaybackMedia.thumbnailUrl}
                                    alt={
                                      workspacePlaybackMedia.title ||
                                      workspacePlaybackMedia.id
                                    }
                                    radius="sm"
                                    h={112}
                                    fit="cover"
                                  />
                                ) : workspacePlaybackMedia &&
                                  isVideoMedia(workspacePlaybackMedia) &&
                                  mediaPreviewSource(workspacePlaybackMedia) ? (
                                  <video
                                    key={`workspace-inline-video-preview-${workspacePlaybackMedia.id}`}
                                    src={
                                      mediaPreviewSource(
                                        workspacePlaybackMedia
                                      ) || undefined
                                    }
                                    muted
                                    playsInline
                                    autoPlay
                                    loop
                                    style={{
                                      width: "100%",
                                      height: 112,
                                      borderRadius: 8,
                                      objectFit: "cover",
                                      background: "#000",
                                    }}
                                  />
                                ) : (
                                  <Card withBorder p="sm">
                                    <Text size="sm" c="dimmed">
                                      No preview available
                                    </Text>
                                  </Card>
                                )}
                              </Card>
                              <Stack gap={6}>
                                <Group gap={8} wrap="wrap">
                                  <Badge variant="light">
                                    {nodeRuntimeStatus.status.backend}
                                  </Badge>
                                  <Badge variant="light">
                                    {nodeRuntimeStatus.status.playback?.state ||
                                      "unknown"}
                                  </Badge>
                                </Group>
                                <Text fw={700} lineClamp={1}>
                                  {runtimeNowPlayingLabel}
                                </Text>
                                <Text size="sm" c="dimmed" lineClamp={1}>
                                  {nodeRuntimeStatus.status.playback?.artist ||
                                    workspacePlaybackMedia?.artist ||
                                    "unknown artist"}
                                </Text>
                                {typeof nodeRuntimeStatus.status.playback
                                  ?.progressPercent === "number" ? (
                                  <>
                                    <Progress
                                      value={Math.max(
                                        0,
                                        Math.min(
                                          100,
                                          nodeRuntimeStatus.status.playback
                                            .progressPercent
                                        )
                                      )}
                                    />
                                    <Text size="xs" c="dimmed">
                                      {formatDurationSec(
                                        nodeRuntimeStatus.status.playback
                                          .positionSec ?? null
                                      )}{" "}
                                      /{" "}
                                      {formatDurationSec(
                                        nodeRuntimeStatus.status.playback
                                          .durationSec ?? null
                                      )}
                                    </Text>
                                  </>
                                ) : (
                                  <Text size="xs" c="dimmed">
                                    {runtimeProgressUnavailableMessage}
                                  </Text>
                                )}
                                {runtimeCacheDownloadProgress ? (
                                  <>
                                    <Progress
                                      value={runtimeCacheDownloadProgress.percent}
                                      color="blue"
                                      striped
                                      animated
                                    />
                                    <Text size="xs" c="dimmed">
                                      Cache {runtimeCacheDownloadProgress.ready}/
                                      {runtimeCacheDownloadProgress.total} (
                                      {Math.round(runtimeCacheDownloadProgress.percent)}
                                      %) downloading
                                    </Text>
                                  </>
                                ) : null}
                              </Stack>
                            </SimpleGrid>
                          ) : (
                            <Text size="sm" c="dimmed">
                              No runtime playback data loaded yet.
                            </Text>
                          )}
                        </Stack>
                      </Paper>
                      <Stack gap="xs">
                        <Button
                          leftSection={<IconPencil size={14} />}
                          onClick={openEditPanel}
                        >
                          Edit Node Details
                        </Button>
                        <Button
                          variant="light"
                          color="teal"
                          leftSection={<IconAdjustments size={14} />}
                          onClick={openAssignPanel}
                        >
                          Assign Target
                        </Button>
                        <Button
                          variant="light"
                          color="green"
                          leftSection={<IconKeyboard size={14} />}
                          onClick={openControlPanel}
                        >
                          Remote Ops
                        </Button>
                        <Button
                          variant="light"
                          leftSection={<IconBroadcast size={14} />}
                          onClick={() => setWorkspacePanel("runtime")}
                        >
                          Runtime Details
                        </Button>
                        <Button
                          variant="light"
                          color="orange"
                          leftSection={<IconChecklist size={14} />}
                          onClick={() => void returnToGuide()}
                        >
                          Return Node to Guide
                        </Button>
                        <Button
                          variant="light"
                          color="gray"
                          leftSection={<IconDownload size={14} />}
                          onClick={openStashPanel}
                        >
                          Media Stash
                        </Button>
                      </Stack>
                    </Stack>
                  </Card>
                ) : workspacePanel === "overview" ? (
                  <Card withBorder p="md">
                    <Stack gap="sm">
                      <Text fw={700}>
                        Selected Nodes ({selectedNodeRows.length})
                      </Text>
                      <ScrollArea h={260}>
                        <Stack gap="xs">
                          {selectedNodeRows.map((row) => (
                            <Card
                              key={`workspace-node-${row.id}`}
                              withBorder
                              p="xs"
                            >
                              <Group
                                justify="space-between"
                                align="flex-start"
                                wrap="nowrap"
                              >
                                <div>
                                  <Text fw={600}>{row.id}</Text>
                                  <Text size="xs" c="dimmed">
                                    {row.nodeName ||
                                      row.host ||
                                      row.ip ||
                                      "node"}
                                  </Text>
                                </div>
                                <Badge
                                  variant="light"
                                  color={connectivityStatusColor(row)}
                                >
                                  {row.connectivity?.status || "offline"}
                                </Badge>
                              </Group>
                            </Card>
                          ))}
                        </Stack>
                      </ScrollArea>
                      <Group>
                        <Button
                          variant="light"
                          color="teal"
                          leftSection={<IconAdjustments size={14} />}
                          onClick={openAssignPanel}
                        >
                          Assign Target
                        </Button>
                        <Button
                          variant="light"
                          color="orange"
                          leftSection={<IconChecklist size={14} />}
                          onClick={() => void returnToGuide()}
                        >
                          Return Selected to Guide
                        </Button>
                      </Group>
                    </Stack>
                  </Card>
                ) : null}

                {workspacePanel === "edit" && nodeEditorOpen ? (
                  <NodeEditorPanel
                    editingNodeId={editingNodeId}
                    nodeDraft={nodeDraft}
                    setNodeDraft={setNodeDraft}
                    onSave={saveNodeDraft}
                    saving={nodeSaving}
                    onClose={closeWorkspacePanels}
                    breadcrumbs={[]}
                  />
                ) : null}

                {workspacePanel === "assign" && assignTargetOpen ? (
                  <AssignTargetPanel
                    selectedNodeCount={selectedNodeIds.length}
                    applyKind={applyKind}
                    applyId={applyId}
                    onOpenTargetPicker={() => setTargetPickerOpen(true)}
                    applyTargetPreviewCard={applyTargetPreviewCard}
                    optMode={optMode}
                    setOptMode={setOptMode}
                    optLock={optLock}
                    setOptLock={setOptLock}
                    optQr={optQr}
                    setOptQr={setOptQr}
                    optPlaylist={optPlaylist}
                    setOptPlaylist={setOptPlaylist}
                    optNosplash={optNosplash}
                    setOptNosplash={setOptNosplash}
                    optRemoteInput={optRemoteInput}
                    setOptRemoteInput={setOptRemoteInput}
                    optRemoteApp={optRemoteApp}
                    setOptRemoteApp={setOptRemoteApp}
                    optRemoteMic={optRemoteMic}
                    setOptRemoteMic={setOptRemoteMic}
                    optRemoteGuide={optRemoteGuide}
                    setOptRemoteGuide={setOptRemoteGuide}
                    optHud={optHud}
                    setOptHud={setOptHud}
                    optHudSec={optHudSec}
                    setOptHudSec={setOptHudSec}
                    optTheme={optTheme}
                    setOptTheme={setOptTheme}
                    optRotate={optRotate}
                    setOptRotate={setOptRotate}
                    runApply={runApply}
                    applyResult={applyResult}
                    summarizeApplyResult={summarizeApplyResult}
                    onClose={closeWorkspacePanels}
                    breadcrumbs={[]}
                  />
                ) : null}

                {workspacePanel === "control" &&
                selectedNodeIds.length === 1 ? (
                  <NodeControlPanel
                    selectedNodeCount={selectedNodeIds.length}
                    nodeId={selectedNodeIds[0]}
                    busy={nodeInputBusy}
                    error={nodeInputError}
                    lastAction={nodeInputLastAction}
                    onSendAction={sendNodeInputAction}
                    onBootstrap={bootstrapNodeRuntime}
                    bootstrapBusy={nodeBootstrapBusy}
                    bootstrapError={nodeBootstrapError}
                    bootstrapResult={nodeBootstrapResult}
                    bootstrapStdout={nodeBootstrapStdout}
                    bootstrapStderr={nodeBootstrapStderr}
                    onSetDisplayMode={setNodeDisplayMode}
                    displayModeBusy={nodeDisplayModeBusy}
                    displayModeError={nodeDisplayModeError}
                    displayModeResult={nodeDisplayModeResult}
                    defaultRegistryId={activeRegistryId}
                    defaultNamespace={activeRegistryId}
                    defaultNodeHost={(
                      nodeWorkspaceFocus?.ip ||
                      nodeWorkspaceFocus?.host ||
                      ""
                    ).trim()}
                    onClose={closeWorkspacePanels}
                    breadcrumbs={[]}
                  />
                ) : null}

                {workspacePanel === "stash" && selectedNodeIds.length === 1 ? (
                  <Paper withBorder p="sm" radius="md">
                    <Stack gap="xs">
                      <Group justify="space-between" align="center" wrap="wrap">
                        <Text fw={700}>Media Stash</Text>
                        <Group gap={8}>
                          <Button
                            size="xs"
                            variant="light"
                            leftSection={<IconRefresh size={14} />}
                            loading={nodeStashBusy}
                            onClick={() => {
                              if (nodeWorkspaceFocus) {
                                void refreshNodeStash(nodeWorkspaceFocus.id);
                              }
                            }}
                          >
                            Refresh
                          </Button>
                          <Button
                            size="xs"
                            color="red"
                            variant="light"
                            leftSection={<IconTrash size={14} />}
                            loading={nodeStashClearing}
                            disabled={
                              !nodeStash || nodeStash.cache.fileCount === 0
                            }
                            onClick={() => void clearNodeStash()}
                          >
                            Clear Stash
                          </Button>
                        </Group>
                      </Group>
                      <SimpleGrid cols={{ base: 1, sm: 2 }}>
                        <TextInput
                          leftSection={<IconSearch size={14} />}
                          placeholder="Filter stash files"
                          value={nodeStashFilterQuery}
                          onChange={(event) =>
                            setNodeStashFilterQuery(event.currentTarget.value)
                          }
                        />
                        <Select
                          data={[
                            {
                              value: "updated_desc",
                              label: "Updated (newest)",
                            },
                            { value: "updated_asc", label: "Updated (oldest)" },
                            { value: "size_desc", label: "Size (largest)" },
                            { value: "size_asc", label: "Size (smallest)" },
                            { value: "name", label: "Name" },
                          ]}
                          value={nodeStashSort}
                          onChange={(value) =>
                            setNodeStashSort(
                              (value as
                                | "name"
                                | "size_desc"
                                | "size_asc"
                                | "updated_desc"
                                | "updated_asc") || "updated_desc"
                            )
                          }
                        />
                      </SimpleGrid>
                      {nodeStashError ? (
                        <Text c="red">{nodeStashError}</Text>
                      ) : null}
                      {nodeStashBusy && !nodeStash ? (
                        <SectionLoader label="Loading node stash..." />
                      ) : nodeStash ? (
                        <>
                          <Group gap="xs">
                            <Badge variant="light">
                              {nodeStash.cache.fileCount} files
                            </Badge>
                            <Badge variant="light">
                              {formatBytes(nodeStash.cache.bytes)}
                            </Badge>
                          </Group>
                          {filteredNodeStashItems.length > 0 ? (
                            <ScrollArea h={260}>
                              <Table
                                striped
                                highlightOnHover
                                withTableBorder
                                withColumnBorders
                              >
                                <Table.Thead>
                                  <Table.Tr>
                                    <Table.Th w={112}>Preview</Table.Th>
                                    <Table.Th>File</Table.Th>
                                    <Table.Th w={120}>Size</Table.Th>
                                    <Table.Th w={180}>Updated</Table.Th>
                                    <Table.Th w={104}>Actions</Table.Th>
                                  </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                  {filteredNodeStashItems.map((file) => {
                                    const preview = stashPreviewMap[file.fileName];
                                    return (
                                    <Table.Tr key={`stash-${file.fileName}`}>
                                      <Table.Td>
                                        {preview?.previewSrc ? (
                                          <Image
                                            src={preview.previewSrc}
                                            alt={preview.label}
                                            h={48}
                                            w={80}
                                            fit="cover"
                                            radius="sm"
                                          />
                                        ) : (
                                          <Paper withBorder p="xs" radius="sm">
                                            <Text size="xs" c="dimmed">
                                              No preview
                                            </Text>
                                          </Paper>
                                        )}
                                      </Table.Td>
                                      <Table.Td>
                                        <Stack gap={4}>
                                          <Text size="xs" ff="monospace">
                                            {file.fileName}
                                          </Text>
                                          {preview ? (
                                            <Group gap={8} wrap="nowrap">
                                              <Badge size="sm" variant="light" color="blue">
                                                matched
                                              </Badge>
                                              <Text
                                                size="xs"
                                                c="dimmed"
                                                lineClamp={1}
                                              >
                                                {preview.label}
                                              </Text>
                                            </Group>
                                          ) : null}
                                          {runtimePlaybackFileName ===
                                            file.fileName &&
                                          workspacePlaybackMedia ? (
                                            <Group gap={8} wrap="nowrap">
                                              {workspacePlaybackMedia.thumbnailUrl ? (
                                                <Image
                                                  src={
                                                    workspacePlaybackMedia.thumbnailUrl
                                                  }
                                                  alt={
                                                    workspacePlaybackMedia.title ||
                                                    workspacePlaybackMedia.id
                                                  }
                                                  h={28}
                                                  w={48}
                                                  fit="cover"
                                                  radius="sm"
                                                />
                                              ) : null}
                                              <Text
                                                size="xs"
                                                c="dimmed"
                                                lineClamp={1}
                                              >
                                                {workspacePlaybackMedia.title ||
                                                  workspacePlaybackMedia.id}
                                              </Text>
                                            </Group>
                                          ) : null}
                                        </Stack>
                                      </Table.Td>
                                      <Table.Td>
                                        {formatBytes(file.sizeBytes)}
                                      </Table.Td>
                                      <Table.Td>
                                        <Text size="xs" c="dimmed">
                                          {new Date(
                                            file.updatedAtMs
                                          ).toLocaleString()}
                                        </Text>
                                      </Table.Td>
                                      <Table.Td>
                                        <Button
                                          size="xs"
                                          variant="light"
                                          color="red"
                                          leftSection={<IconTrash size={12} />}
                                          loading={nodeStashClearing}
                                          onClick={() =>
                                            void deleteNodeStashItem(file.fileName)
                                          }
                                        >
                                          Delete
                                        </Button>
                                      </Table.Td>
                                    </Table.Tr>
                                  )})}
                                </Table.Tbody>
                              </Table>
                            </ScrollArea>
                          ) : (
                            <Text size="sm" c="dimmed">
                              No files in stash.
                            </Text>
                          )}
                        </>
                      ) : (
                        <Text size="sm" c="dimmed">
                          No stash data loaded yet.
                        </Text>
                      )}
                    </Stack>
                  </Paper>
                ) : null}

                {workspacePanel === "runtime" ? (
                  <Paper withBorder p="sm" radius="md">
                    <Stack gap="xs">
                      <Group justify="space-between" align="center" wrap="wrap">
                        <Text fw={700}>Runtime</Text>
                        <Group gap={8}>
                          <Button
                            size="xs"
                            variant="light"
                            leftSection={<IconRefresh size={14} />}
                            loading={nodeRuntimeBusy}
                            onClick={() => {
                              if (nodeWorkspaceFocus) {
                                void refreshNodeRuntime(nodeWorkspaceFocus.id);
                              }
                            }}
                          >
                            Refresh
                          </Button>
                          <Button
                            size="xs"
                            variant="light"
                            onClick={closeWorkspacePanels}
                          >
                            Close
                          </Button>
                        </Group>
                      </Group>
                      {nodeRuntimeError ? (
                        <Text size="sm" c="red">
                          {nodeRuntimeError}
                        </Text>
                      ) : null}
                      {!nodeRuntimeStatus && nodeRuntimeBusy ? (
                        <SectionLoader label="Loading runtime playback..." />
                      ) : nodeRuntimeStatus ? (
                        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                          <Card withBorder p="xs">
                            {workspacePlaybackMedia?.thumbnailUrl ? (
                              <Image
                                src={workspacePlaybackMedia.thumbnailUrl}
                                alt={
                                  workspacePlaybackMedia.title ||
                                  workspacePlaybackMedia.id
                                }
                                radius="sm"
                                h={140}
                                fit="cover"
                              />
                            ) : workspacePlaybackMedia &&
                              isVideoMedia(workspacePlaybackMedia) &&
                              mediaPreviewSource(workspacePlaybackMedia) ? (
                              <video
                                key={`workspace-video-preview-${workspacePlaybackMedia.id}`}
                                src={
                                  mediaPreviewSource(workspacePlaybackMedia) ||
                                  undefined
                                }
                                muted
                                playsInline
                                autoPlay
                                loop
                                style={{
                                  width: "100%",
                                  height: 140,
                                  borderRadius: 8,
                                  objectFit: "cover",
                                  background: "#000",
                                }}
                              />
                            ) : (
                              <Card withBorder p="sm">
                                <Text size="sm" c="dimmed">
                                  No preview available
                                </Text>
                              </Card>
                            )}
                          </Card>
                          <Stack gap={6}>
                            <Group gap={8} wrap="wrap">
                              <Badge variant="light">
                                {nodeRuntimeStatus.status.backend}
                              </Badge>
                              <Badge variant="light">
                                {nodeRuntimeStatus.status.playback?.state ||
                                  "unknown"}
                              </Badge>
                              {nodeRuntimeBusy ? (
                                <Badge variant="light">refreshing</Badge>
                              ) : null}
                            </Group>
                            <Text fw={700}>{runtimeNowPlayingLabel}</Text>
                            <Text size="sm" c="dimmed">
                              {nodeRuntimeStatus.status.playback?.artist ||
                                workspacePlaybackMedia?.artist ||
                                "unknown artist"}
                            </Text>
                            {typeof nodeRuntimeStatus.status.playback
                              ?.progressPercent === "number" ? (
                              <>
                                <Progress
                                  value={Math.max(
                                    0,
                                    Math.min(
                                      100,
                                      nodeRuntimeStatus.status.playback
                                        .progressPercent
                                    )
                                  )}
                                />
                                <Text size="xs" c="dimmed">
                                  {formatDurationSec(
                                    nodeRuntimeStatus.status.playback
                                      .positionSec ?? null
                                  )}{" "}
                                  /{" "}
                                  {formatDurationSec(
                                    nodeRuntimeStatus.status.playback
                                      .durationSec ?? null
                                  )}
                                </Text>
                              </>
                            ) : (
                              <Text size="xs" c="dimmed">
                                {runtimeProgressUnavailableMessage}
                              </Text>
                            )}
                            {runtimeCacheDownloadProgress ? (
                              <>
                                <Progress
                                  value={runtimeCacheDownloadProgress.percent}
                                  color="blue"
                                  striped
                                  animated
                                />
                                <Text size="xs" c="dimmed">
                                  Cache {runtimeCacheDownloadProgress.ready}/
                                  {runtimeCacheDownloadProgress.total} (
                                  {Math.round(runtimeCacheDownloadProgress.percent)}
                                  %) downloading
                                </Text>
                              </>
                            ) : null}
                          </Stack>
                        </SimpleGrid>
                      ) : (
                        <Text size="sm" c="dimmed">
                          No runtime playback data loaded yet.
                        </Text>
                      )}
                    </Stack>
                  </Paper>
                ) : null}
              </>
            )}
          </Stack>
        </Paper>
      ) : (
        <Paper withBorder radius="md" p="md">
          <Stack gap="xs" mb="sm">
            <div>
              <Title order={4}>Connected Nodes</Title>
            </div>
            <TextInput
              leftSection={<IconSearch size={16} />}
              placeholder="Filter nodes by id/host/ip"
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
              w={isMobile ? "100%" : 260}
            />
            {isMobile ? (
              <Group wrap="wrap">
                <Button
                  size="xs"
                  variant={mobileSelectionMode ? "filled" : "light"}
                  onClick={() => {
                    setMobileSelectionMode((prev) => {
                      const next = !prev;
                      if (!next) clearSelection();
                      return next;
                    });
                  }}
                >
                  {mobileSelectionMode ? "Done" : "Select"}
                </Button>
                {mobileSelectionMode ? (
                  <>
                    <Button size="xs" variant="light" onClick={selectVisible}>
                      Select Visible
                    </Button>
                    <Button
                      size="xs"
                      variant="light"
                      color="gray"
                      onClick={clearSelection}
                    >
                      Clear
                    </Button>
                  </>
                ) : null}
                {mobileSelectionMode && selectedNodeIds.length > 0 ? (
                  <Button
                    size="xs"
                    variant="light"
                    leftSection={<IconPencil size={14} />}
                    onClick={() => {
                      openNodeWorkspace();
                      setControlOpen(false);
                    }}
                  >
                    {`Edit (${selectedNodeIds.length})`}
                  </Button>
                ) : null}
                <Button
                  size="xs"
                  variant="light"
                  leftSection={<IconSquareRoundedPlus size={14} />}
                  onClick={() => {
                    openCreateNodeEditor();
                    setFleetView("workspace");
                  }}
                >
                  Add
                </Button>
              </Group>
            ) : (
              <Group wrap="wrap">
                <Button size="sm" variant="light" onClick={selectVisible}>
                  Select Visible
                </Button>
                <Button
                  size="sm"
                  variant="light"
                  color="gray"
                  onClick={clearSelection}
                >
                  Clear
                </Button>
                <Button
                  size="sm"
                  variant="light"
                  leftSection={<IconPencil size={16} />}
                  onClick={() => {
                    openNodeWorkspace();
                    if (isMobile) setControlOpen(false);
                  }}
                  disabled={selectedNodeIds.length === 0}
                >
                  {`Edit ${selectedNodeIds.length} ${
                    selectedNodeIds.length === 1 ? "node" : "nodes"
                  }`}
                </Button>
                <Button
                  size="sm"
                  variant="light"
                  leftSection={<IconSquareRoundedPlus size={16} />}
                  onClick={() => {
                    openCreateNodeEditor();
                    setFleetView("workspace");
                  }}
                >
                  Add Node
                </Button>
              </Group>
            )}
          </Stack>

          {loadingFleet && filteredRows.length === 0 ? (
            <SectionLoader label="Loading node inventory..." />
          ) : isMobile ? (
            <Stack>
              {filteredRows.map((row) => (
                <Card
                  key={row.id}
                  withBorder
                  p="sm"
                  className="ops-fleet-mobile-card"
                  style={{ cursor: "pointer" }}
                  onClick={() => {
                    if (mobileSelectionMode) {
                      toggleNodeSelection(
                        row.id,
                        !selectedNodeIds.includes(row.id)
                      );
                      return;
                    }
                    openRowWorkspace(row.id);
                  }}
                >
                  <Stack gap="xs">
                    <Group
                      justify="space-between"
                      wrap="nowrap"
                      align="flex-start"
                    >
                      <Group gap="xs" wrap="nowrap">
                        {mobileSelectionMode ? (
                          <Checkbox
                            checked={selectedNodeIds.includes(row.id)}
                            onClick={(event) => event.stopPropagation()}
                            onChange={(e) =>
                              toggleNodeSelection(
                                row.id,
                                e.currentTarget.checked
                              )
                            }
                          />
                        ) : null}
                        <Stack gap={1} style={{ minWidth: 0 }}>
                          <Group gap={6} wrap="wrap">
                            <Text fw={700} size="lg" lh={1.1} lineClamp={1}>
                              {row.id}
                            </Text>
                            <Badge
                              color={connectivityStatusColor(row)}
                              variant="light"
                              size="xs"
                            >
                              {row.connectivity?.status || "offline"}
                            </Badge>
                          </Group>
                          <Text
                            size="xs"
                            c="dimmed"
                            lineClamp={1}
                            title={nodeMetaLabel(row)}
                          >
                            {nodeMetaLabel(row)}
                          </Text>
                        </Stack>
                      </Group>
                      <Text size="xs" c="dimmed">
                        {lastCheckedLabel(row)}
                      </Text>
                    </Group>
                    {renderRuntimeSummary(row, "mobile")}
                    {mobileSelectionMode ? null : (
                      <Group
                        gap={6}
                        grow
                        wrap="nowrap"
                        className="ops-card-actions"
                      >
                        <Button
                          size="xs"
                          variant="light"
                          color="blue"
                          leftSection={<IconPencil size={14} />}
                          onClick={(event) => {
                            event.stopPropagation();
                            openEditNodeEditor(row.id);
                            setFleetView("workspace");
                            setNodeEditorOpen(true);
                            setAssignTargetOpen(false);
                            setWorkspacePanel("edit");
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          size="xs"
                          variant="light"
                          color="cyan"
                          leftSection={<IconBroadcast size={14} />}
                          onClick={(event) => {
                            event.stopPropagation();
                            setActiveNodeId(row.id);
                          }}
                        >
                          Inspect
                        </Button>
                        <Button
                          size="xs"
                          variant="light"
                          color="red"
                          leftSection={<IconTrash size={14} />}
                          onClick={(event) => {
                            event.stopPropagation();
                            void removeNode(row.id);
                          }}
                        >
                          Delete
                        </Button>
                      </Group>
                    )}
                  </Stack>
                </Card>
              ))}
            </Stack>
          ) : (
            <Stack gap="xs">
              <ScrollArea>
                <Table
                  striped
                  highlightOnHover
                  withTableBorder
                  withColumnBorders
                >
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th w={42}>
                        <Checkbox
                          checked={
                            filteredRows.length > 0 &&
                            filteredRows.every((row) =>
                              selectedNodeIds.includes(row.id)
                            )
                          }
                          onChange={(e) => {
                            if (e.currentTarget.checked) {
                              setSelectedNodeIds(
                                Array.from(
                                  new Set([
                                    ...selectedNodeIds,
                                    ...filteredRows.map((row) => row.id),
                                  ])
                                )
                              );
                            } else {
                              setSelectedNodeIds((prev) =>
                                prev.filter(
                                  (id) =>
                                    !filteredRows.some((row) => row.id === id)
                                )
                              );
                            }
                          }}
                        />
                      </Table.Th>
                      <Table.Th w={280}>Node</Table.Th>
                      <Table.Th w={220}>Health</Table.Th>
                      <Table.Th w={360}>Target</Table.Th>
                      <Table.Th w={88}>Updated</Table.Th>
                      <Table.Th w={120}>Actions</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {fleetRowsPage.map((row) => (
                      <Table.Tr
                        key={row.id}
                        onClick={() => openRowWorkspace(row.id)}
                        style={{ cursor: "pointer" }}
                      >
                        <Table.Td>
                          <Checkbox
                            checked={selectedNodeIds.includes(row.id)}
                            onClick={(event) => event.stopPropagation()}
                            onChange={(e) =>
                              toggleNodeSelection(
                                row.id,
                                e.currentTarget.checked
                              )
                            }
                          />
                        </Table.Td>
                        <Table.Td>
                          <Stack gap={2} style={{ minWidth: 0 }}>
                            <Group gap={6} wrap="wrap">
                              <Text fw={700}>{row.id}</Text>
                              <Badge
                                color={connectivityStatusColor(row)}
                                variant="light"
                                size="xs"
                              >
                                {row.connectivity?.status || "offline"}
                              </Badge>
                            </Group>
                            <Text
                              size="xs"
                              c="dimmed"
                              lineClamp={1}
                              title={row.nodeName || ""}
                            >
                              {row.nodeName || "Unnamed node"}
                            </Text>
                            <Text
                              size="xs"
                              ff="monospace"
                              c="dimmed"
                              lineClamp={1}
                              title={nodeHostLabel(row)}
                            >
                              {nodeHostLabel(row)}
                            </Text>
                          </Stack>
                        </Table.Td>
                        <Table.Td>
                          <Stack gap={6}>
                            <Badge
                              color={connectivityStatusColor(row)}
                              variant="light"
                              size="xs"
                            >
                              {connectivityStatusLabel(row)}
                            </Badge>
                            {renderConnectivitySignals(row)}
                            <Text
                              size="xs"
                              c="dimmed"
                              ff="monospace"
                              title={versionsCompactLabel(row)}
                            >
                              {versionsCompactLabel(row)}
                            </Text>
                          </Stack>
                        </Table.Td>
                        <Table.Td>
                          {renderRuntimeSummary(row, "table")}
                        </Table.Td>
                        <Table.Td>
                          <Stack gap={2}>
                            <Text size="xs" c="dimmed">
                              {lastCheckedLabel(row)}
                            </Text>
                          </Stack>
                        </Table.Td>
                        <Table.Td>
                          <Group gap={6}>
                            <ActionIcon
                              variant="light"
                              color="blue"
                              onClick={(event) => {
                                event.stopPropagation();
                                setActiveNodeId(row.id);
                              }}
                              title="Inspect node"
                            >
                              <IconBroadcast size={14} />
                            </ActionIcon>
                            <ActionIcon
                              variant="light"
                              color="blue"
                              onClick={(event) => {
                                event.stopPropagation();
                                openEditNodeEditor(row.id);
                                setFleetView("workspace");
                                setNodeEditorOpen(true);
                                setAssignTargetOpen(false);
                                setWorkspacePanel("edit");
                              }}
                              title="Edit node"
                            >
                              <IconPencil size={14} />
                            </ActionIcon>
                            <ActionIcon
                              variant="light"
                              color="red"
                              onClick={(event) => {
                                event.stopPropagation();
                                void removeNode(row.id);
                              }}
                              title="Delete node"
                            >
                              <IconTrash size={14} />
                            </ActionIcon>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
              <Group justify="space-between" mt="xs" wrap="wrap">
                <Text size="xs" c="dimmed">
                  {tableRangeLabel(
                    filteredRows.length,
                    fleetPage,
                    TABLE_PAGE_SIZE.fleet
                  )}
                </Text>
                <Pagination
                  total={fleetPageCount}
                  value={fleetPage}
                  onChange={setFleetPage}
                  size={isMobile ? "sm" : "md"}
                  siblings={1}
                  boundaries={1}
                  withEdges
                />
              </Group>
            </Stack>
          )}
        </Paper>
      )}
    </Tabs.Panel>
  );
}
