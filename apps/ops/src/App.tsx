import {
  AppShell,
  Button,
  Group,
  Paper,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Tabs,
  Title,
} from "@mantine/core";
import { Navigate, Route, Routes } from "react-router-dom";
import { IngestSection } from "./components/builder/IngestSection";
import { ContainerEditorsView } from "./components/builder/ContainerEditorsView";
import { MediaDetailView } from "./components/builder/MediaDetailView";
import { MediaLibraryView } from "./components/builder/MediaLibraryView";
import { PlaylistEditorView } from "./components/builder/PlaylistEditorView";
import { MediaPickerModal } from "./components/MediaPickerModal";
import { NodeInspectorModal } from "./components/NodeInspectorModal";
import { OpsHeader } from "./components/OpsHeader";
import { OpsSidebar } from "./components/OpsSidebar";
import { QuickSendModal } from "./components/QuickSendModal";
import { ResourcePickerModal } from "./components/ResourcePickerModal";
import { FleetScreen } from "./components/screens/FleetScreen";
import { LightsScreen } from "./components/screens/LightsScreen";
import { OpsPageHeader, OpsToolbar } from "./components/ui/OpsSurface";
import { useOpsAppModel } from "./hooks/useOpsAppModel";

function OpsRoute() {
  const {
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
    deletePlaylistDraft,
    mediaFilterData,
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
    openChannelEditorRoute,
    openProfileEditorRoute,
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
    updateOpsUrl,
    parseTargetFromKioskUrl,
    statusBadge,
    summarizeApplyResult,
  } = useOpsAppModel();

  const libraryPaneOptions: Array<{
    value: "media" | "playlists" | "blocks" | "channels" | "profiles";
    label: string;
    compactLabel: string;
  }> = [
    {
      value: "media",
      label: `Media (${serverMedia.length})`,
      compactLabel: "Media",
    },
    {
      value: "playlists",
      label: `Playlists (${draftStore.playlists.length})`,
      compactLabel: "Lists",
    },
    {
      value: "blocks",
      label: `Blocks (${draftStore.blocks.length})`,
      compactLabel: "Blocks",
    },
    {
      value: "channels",
      label: `Channels (${draftStore.channels.length})`,
      compactLabel: "Chan",
    },
    {
      value: "profiles",
      label: `Profiles (${draftStore.profiles.length})`,
      compactLabel: "Prof",
    },
  ];

  const openLibraryPane = (
    next: "media" | "playlists" | "blocks" | "channels" | "profiles"
  ) => {
    setServerMediaQuery("");
    setSelectedServerMediaId(null);
    setMediaDetailId(null);
    if (next === "media" || next === "playlists") {
      setMediaLibrarySection(next);
      setBuilderTab("media");
      return;
    }
    setMediaLibrarySection(next);
    if (next === "blocks") setBuilderTab("block");
    if (next === "channels") setBuilderTab("channel");
    if (next === "profiles") setBuilderTab("profile");
  };

  const isLibraryBrowserView =
    builderTab !== "ingest" &&
    builderTab !== "mediaDetail" &&
    builderTab !== "playlistEditor" &&
    builderTab !== "blockEditor" &&
    builderTab !== "channelEditor" &&
    builderTab !== "profileEditor";
  const showBuilderHeader = builderTab === "ingest" && !isMobile;
  const builderTitle =
    builderTab === "ingest"
      ? "Add Media"
      : builderTab === "playlistEditor"
      ? isMobile
        ? "Playlists"
        : "Playlist Editor"
      : builderTab === "blockEditor"
      ? isMobile
        ? "Blocks"
        : "Block Editor"
      : builderTab === "channelEditor"
      ? isMobile
        ? "Channels"
        : "Channel Editor"
      : builderTab === "profileEditor"
      ? isMobile
        ? "Profiles"
        : "Profile Editor"
      : builderTab === "mediaDetail"
      ? isMobile
        ? "Media"
        : "Media Detail"
      : isMobile
      ? "Library"
      : "Media Library";
  const createActionLabel = isMobile
    ? currentLibraryPane === "media"
      ? "Add Media"
      : currentLibraryPane === "playlists"
      ? "New Playlist"
      : currentLibraryPane === "blocks"
      ? "New Block"
      : currentLibraryPane === "channels"
      ? "New Channel"
      : "New Profile"
    : currentLibraryPane === "media"
    ? "Add Media"
    : currentLibraryPane === "playlists"
    ? "New Playlist"
    : currentLibraryPane === "blocks"
    ? "New Block"
    : currentLibraryPane === "channels"
    ? "New Channel"
    : "New Profile";
  const openCurrentCreateRoute = () => {
    if (currentLibraryPane === "media") {
      setBuilderTab("ingest");
      return;
    }
    if (currentLibraryPane === "playlists") {
      openPlaylistEditorRoute();
      return;
    }
    if (currentLibraryPane === "blocks") {
      openBlockEditorRoute();
      return;
    }
    if (currentLibraryPane === "channels") {
      openChannelEditorRoute();
      return;
    }
    openProfileEditorRoute();
  };

  return (
    <AppShell
      className="ops-shell"
      padding={isMobile ? "sm" : "md"}
      header={{ height: isMobile ? 64 : 72 }}
      navbar={{
        width: 280,
        breakpoint: "sm",
        collapsed: { mobile: !controlOpen, desktop: !controlOpen },
      }}
    >
      <AppShell.Header>
        <OpsHeader
          isMobile={Boolean(isMobile)}
          controlOpen={controlOpen}
          onToggleControl={toggleControlOpen}
          autoRefresh={autoRefresh}
          onAutoRefreshChange={setAutoRefresh}
        />
      </AppShell.Header>

      <AppShell.Navbar p="sm">
        <OpsSidebar
          isMobile={Boolean(isMobile)}
          mainTab={mainTab}
          builderTab={builderTab}
          onOpenNodeOps={() => {
            setMainTab("fleet");
            setFleetView("table");
            updateOpsUrl({ view: null, playlistId: null }, "replace");
            if (isMobile) setControlOpen(false);
          }}
          onOpenLights={() => {
            setMainTab("devices");
            updateOpsUrl({ view: null, playlistId: null }, "replace");
            if (isMobile) setControlOpen(false);
          }}
          onOpenIngestion={() => {
            setMainTab("builder");
            setBuilderTab("ingest");
            updateOpsUrl({ view: null, playlistId: null }, "replace");
            if (isMobile) setControlOpen(false);
          }}
          onOpenMediaLibrary={() => {
            setMainTab("builder");
            setBuilderTab("media");
            setMediaLibrarySection("media");
            setServerMediaQuery("");
            setSelectedServerMediaId(null);
            setMediaDetailId(null);
            updateOpsUrl({ view: null, playlistId: null }, "replace");
            if (isMobile) setControlOpen(false);
          }}
          selectedNodeCount={selectedNodeIds.length}
          visibleNodeCount={filteredRows.length}
          metrics={metrics}
          onOpenNodeWorkspace={() => {
            openNodeWorkspace();
            if (isMobile) setControlOpen(false);
          }}
          lastTick={lastTick}
        />
      </AppShell.Navbar>

      <AppShell.Main className="ops-main">
        <Tabs
          className="ops-main-tabs"
          value={mainTab}
          onChange={(value) => {
            if (value === "fleet" || value === "builder" || value === "devices")
              setMainTab(value);
          }}
          keepMounted={false}
        >
          <FleetScreen vm={fleetScreenVm} />

          <Tabs.Panel value="devices" pt="md">
            <LightsScreen />
          </Tabs.Panel>

          <Tabs.Panel value="builder" pt="md" className="ops-builder-tab-panel">
            <SimpleGrid cols={1} spacing="md" className="ops-builder-grid">
              <Paper withBorder radius="md" p="md" className="ops-builder-panel">
                <Stack gap="md" className="ops-builder-content">
                  {showBuilderHeader ? (
                    <OpsPageHeader
                      title={builderTitle}
                      compact
                      actions={null}
                    />
                  ) : null}
                  {isLibraryBrowserView ? (
                    isMobile ? (
                      <OpsToolbar sticky className="ops-library-mobile-toolbar">
                        <Group align="center" gap="xs" wrap="nowrap">
                          <Select
                            value={currentLibraryPane}
                            onChange={(value) =>
                              openLibraryPane(
                                ((value as
                                  | "media"
                                  | "playlists"
                                  | "blocks"
                                  | "channels"
                                  | "profiles") ?? "media")
                              )
                            }
                            data={libraryPaneOptions.map((option) => ({
                              value: option.value,
                              label: option.label,
                            }))}
                            allowDeselect={false}
                            className="ops-library-pane-select"
                          />
                          <Button
                            size="xs"
                            variant="light"
                            onClick={openCurrentCreateRoute}
                          >
                            {createActionLabel}
                          </Button>
                        </Group>
                      </OpsToolbar>
                    ) : (
                      <OpsToolbar sticky className="ops-library-pane-toolbar">
                        <Group justify="space-between" align="center" gap="sm" wrap="nowrap">
                          <ScrollArea
                            type="never"
                            scrollbarSize={0}
                            className="ops-library-pane-scroll"
                          >
                            <Group gap="xs" wrap="nowrap" className="ops-library-pane-tabs">
                              {libraryPaneOptions.map((option) => (
                                <Button
                                  key={option.value}
                                  size="sm"
                                  variant={currentLibraryPane === option.value ? "filled" : "light"}
                                  onClick={() => openLibraryPane(option.value)}
                                >
                                  {option.label}
                                </Button>
                              ))}
                            </Group>
                          </ScrollArea>
                          <Button size="sm" variant="light" onClick={openCurrentCreateRoute}>
                            {createActionLabel}
                          </Button>
                        </Group>
                      </OpsToolbar>
                    )
                  ) : null}

                  {builderTab === "ingest" ? (
                    <IngestSection key="builder-ingest" vm={ingestSectionVm} />
                  ) : null}

                  <MediaLibraryView key={`library-${currentLibraryPane}`} vm={mediaLibraryVm} />

                  {builderTab === "playlistEditor" ? (
                    <PlaylistEditorView key="playlist-editor" vm={playlistEditorVm} />
                  ) : null}

                  {builderTab === "mediaDetail" ? (
                    <MediaDetailView key="media-detail" vm={mediaDetailVm} />
                  ) : null}

                  <ContainerEditorsView key={`container-${builderTab}`} vm={containerEditorsVm} />
                </Stack>
              </Paper>
            </SimpleGrid>
          </Tabs.Panel>
        </Tabs>
      </AppShell.Main>

      <MediaPickerModal
        opened={mediaPickerOpen}
        onClose={() => setMediaPickerOpen(false)}
        media={pickerMedia}
        selectedIds={playlistDraft.mediaIds}
        onApply={(mediaIds) =>
          setPlaylistDraft((current) => ({
            ...current,
            mediaIds,
          }))
        }
      />

      <ResourcePickerModal
        opened={targetPickerOpen}
        onClose={() => setTargetPickerOpen(false)}
        title="Pick Target"
        items={applyResourcePickerItems}
        selectedIds={applyId ? [applyId] : []}
        multi={false}
        applyLabel="Use selected target"
        kind={applyKind}
        kindOptions={[
          { value: "profile", label: "Profile" },
          { value: "channel", label: "Channel" },
          { value: "block", label: "Block" },
          { value: "playlist", label: "Playlist" },
          { value: "media", label: "Media" },
        ]}
        onKindChange={(kind) => {
          const next = kind as
            | "profile"
            | "channel"
            | "block"
            | "playlist"
            | "media";
          setApplyKind(next);
          setApplyId("");
        }}
        onApply={(ids) => setApplyId(ids[0] || "")}
      />

      <QuickSendModal
        opened={quickSendOpen}
        onClose={() => setQuickSendOpen(false)}
        isMobile={Boolean(isMobile)}
        target={quickSendTarget}
        query={quickSendQuery}
        setQuery={setQuickSendQuery}
        rows={quickSendRows}
        nodeIds={quickSendNodeIds}
        setNodeIds={setQuickSendNodeIds}
        busy={quickSendBusy}
        onRun={runQuickSend}
      />

      <NodeInspectorModal
        opened={Boolean(selectedNode)}
        onClose={() => setActiveNodeId(null)}
        isMobile={Boolean(isMobile)}
        selectedNode={selectedNode}
        parseTargetFromKioskUrl={parseTargetFromKioskUrl}
        statusBadge={statusBadge}
        onEditNode={(nodeId) => {
          if (!nodeId) return;
          openEditNodeEditor(nodeId);
        }}
      />
    </AppShell>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<OpsRoute />} />
      <Route path="/controls/*" element={<Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
