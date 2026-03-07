import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Group,
  Image,
  Loader,
  Modal,
  Pagination,
  Paper,
  Progress,
  ScrollArea,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import {
  IconAdjustments,
  IconBroadcast,
  IconPencil,
  IconSearch,
  IconTrash,
} from "@tabler/icons-react";
import type { Media, MediaIngestJob } from "../../lib/controlApi";
import type { BuilderMode } from "../../store/uiStore";
import {
  isVideoMedia,
  mediaPreviewSource,
  TABLE_PAGE_SIZE,
  tableRangeLabel,
  type DraftPlaylist,
} from "../../lib/opsModel";
import { PreviewTileCluster } from "../PreviewTileCluster";
import { SectionLoader } from "../SectionLoader";

export type MediaLibraryViewVm = {
  builderTab: BuilderMode;
  loadingSnapshot: boolean;
  mediaLibrarySection: "media" | "playlists" | "blocks" | "channels" | "profiles";
  playlistLibraryView: "cards" | "table";
  setPlaylistLibraryView: (value: "cards" | "table") => void;
  serverMediaFiltered: Media[];
  serverMedia: Media[];
  serverMediaSourceFilter: "all" | "path" | "url";
  setServerMediaSourceFilter: (value: "all" | "path" | "url") => void;
  mediaFilterData: Array<{ value: string; label: string }>;
  openPlaylistEditorRoute: (playlistId?: string) => void;
  serverMediaQuery: string;
  setServerMediaQuery: (value: string) => void;
  activeIngestJobs: MediaIngestJob[];
  mediaRowsPage: Media[];
  mediaLibraryPage: number;
  setMediaLibraryPage: (page: number) => void;
  mediaLibraryPageCount: number;
  selectedServerMediaId: string | null;
  setSelectedServerMediaId: (id: string | null) => void;
  setMediaDetailId: (id: string | null) => void;
  setBuilderTab: (tab: BuilderMode) => void;
  openQuickSend: (target: { kind: "media" | "playlist"; id: string; label: string }) => void;
  deleteMediaItem: (id: string) => Promise<void>;
  deleteManyMediaItems: (ids: string[]) => Promise<void>;
  saveManyMediaMetadata: (args: {
    ids: string[];
    artist?: string;
    description?: string;
  }) => Promise<void>;
  mediaSaveBusy: boolean;
  mediaDeleteBusy: boolean;
  playlistCount: number;
  playlistTotalCount: number;
  mergedMediaById: Map<string, Media>;
  deletePlaylistDraft: (id: string) => void | Promise<void> | Promise<boolean>;
  playlistRowsPage: DraftPlaylist[];
  selectedPlaylistId: string | null;
  playlistTablePage: number;
  setPlaylistTablePage: (page: number) => void;
  playlistTablePageCount: number;
  isMobile: boolean;
};

export function MediaLibraryView({ vm }: { vm: MediaLibraryViewVm }) {
  const {
    builderTab,
    loadingSnapshot,
    mediaLibrarySection,
    playlistLibraryView,
    setPlaylistLibraryView,
    serverMediaFiltered,
    serverMedia,
    serverMediaSourceFilter,
    setServerMediaSourceFilter,
    mediaFilterData,
    openPlaylistEditorRoute,
    serverMediaQuery,
    setServerMediaQuery,
    activeIngestJobs,
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
    playlistCount,
    playlistTotalCount,
    mergedMediaById,
    deletePlaylistDraft,
    playlistRowsPage,
    selectedPlaylistId,
    playlistTablePage,
    setPlaylistTablePage,
    playlistTablePageCount,
    isMobile,
  } = vm;

  const [selectionMode, setSelectionMode] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedMediaIds, setSelectedMediaIds] = useState<string[]>([]);
  const [batchArtist, setBatchArtist] = useState("");
  const [batchDescription, setBatchDescription] = useState("");

  const mediaIdsOnPage = useMemo(
    () => mediaRowsPage.map((row) => row.id),
    [mediaRowsPage]
  );
  const allVisibleSelected =
    mediaIdsOnPage.length > 0 && mediaIdsOnPage.every((id) => selectedMediaIds.includes(id));
  const hasBatchChanges =
    batchArtist.trim().length > 0 || batchDescription.trim().length > 0;
  const activeFilterCount =
    (serverMediaSourceFilter !== "all" ? 1 : 0) + (selectionMode ? 1 : 0);
  const mediaRange = tableRangeLabel(
    serverMediaFiltered.length,
    mediaLibraryPage,
    TABLE_PAGE_SIZE.media
  );
  const showMediaPagination = mediaLibraryPageCount > 1;

  useEffect(() => {
    if (mediaLibrarySection !== "media") {
      setSelectionMode(false);
      setSelectedMediaIds([]);
    }
  }, [mediaLibrarySection]);

  useEffect(() => {
    setSelectedMediaIds((prev) =>
      prev.filter((id) => serverMedia.some((row) => row.id === id))
    );
  }, [serverMedia]);

  useEffect(() => {
    if (!selectionMode) {
      setSelectedMediaIds([]);
      setBatchArtist("");
      setBatchDescription("");
    }
  }, [selectionMode]);

  if (builderTab !== "media") return null;

  return (
    <Stack gap="md">
      {mediaLibrarySection === "media" ? (
        <Stack gap="md" className="ops-library-media-layout">
          {loadingSnapshot && serverMedia.length === 0 ? (
            <SectionLoader label="Loading media library..." />
          ) : null}

          <Stack gap="sm" className="ops-content-sticky-header ops-media-control-header">
            <TextInput
              className="ops-media-search-input"
              leftSection={<IconSearch size={16} />}
              placeholder="Search by title, id, artist, or URL"
              value={serverMediaQuery}
              onChange={(e) => setServerMediaQuery(e.currentTarget.value)}
              w="100%"
            />
            <Group
              justify="space-between"
              align="center"
              wrap="nowrap"
              gap="xs"
              className="ops-media-control-row"
            >
              <Group gap="xs" wrap="nowrap" className="ops-media-control-actions">
                <Button
                  size="xs"
                  variant="light"
                  leftSection={<IconAdjustments size={14} />}
                  onClick={() => setFiltersOpen(true)}
                >
                  Filters
                </Button>
                {activeFilterCount > 0 ? (
                  <Badge variant="light" color="blue">
                    {activeFilterCount} active
                  </Badge>
                ) : null}
              </Group>
              {showMediaPagination ? (
                <Pagination
                  total={mediaLibraryPageCount}
                  value={mediaLibraryPage}
                  onChange={setMediaLibraryPage}
                  size={isMobile ? "xs" : "sm"}
                  siblings={isMobile ? 0 : 1}
                  boundaries={isMobile ? 0 : 1}
                  withEdges={!isMobile}
                  className="ops-media-control-pagination"
                />
              ) : null}
            </Group>
            <Text size="xs" c="dimmed" className="ops-media-control-meta">
              {mediaRange} • {serverMediaFiltered.length} shown • {serverMedia.length} total
              {selectionMode ? ` • ${selectedMediaIds.length} selected` : ""}
            </Text>
          </Stack>

          <Modal
            opened={filtersOpen}
            onClose={() => setFiltersOpen(false)}
            title="Media Filters"
            size={isMobile ? "100%" : "lg"}
          >
            <Stack gap="md">
              <Stack gap={6}>
                <Text fw={600} size="sm">
                  Source
                </Text>
                <SegmentedControl
                  value={serverMediaSourceFilter}
                  onChange={(value) =>
                    setServerMediaSourceFilter((value as "all" | "path" | "url") || "all")
                  }
                  data={mediaFilterData}
                />
              </Stack>
              <Stack gap={6}>
                <Text fw={600} size="sm">
                  Selection Mode
                </Text>
                <SegmentedControl
                  value={selectionMode ? "select" : "browse"}
                  onChange={(value) => setSelectionMode(value === "select")}
                  data={[
                    { value: "browse", label: "Browse" },
                    { value: "select", label: "Select" },
                  ]}
                />
              </Stack>
              {selectionMode ? (
                <Group justify="space-between" wrap="wrap" gap="xs">
                  <Badge variant="light" color="blue">
                    {selectedMediaIds.length} selected
                  </Badge>
                  <Group gap="xs">
                    <Button
                      size="xs"
                      variant="light"
                      onClick={() => {
                        setSelectedMediaIds((prev) => {
                          if (allVisibleSelected) {
                            return prev.filter((id) => !mediaIdsOnPage.includes(id));
                          }
                          const next = new Set(prev);
                          for (const id of mediaIdsOnPage) next.add(id);
                          return Array.from(next);
                        });
                      }}
                    >
                      {allVisibleSelected ? "Unselect Visible" : "Select Visible"}
                    </Button>
                    <Button
                      size="xs"
                      variant="light"
                      onClick={() => setSelectedMediaIds([])}
                      disabled={selectedMediaIds.length === 0}
                    >
                      Clear
                    </Button>
                  </Group>
                </Group>
              ) : null}
              <Button size="xs" onClick={() => setFiltersOpen(false)}>
                Done
              </Button>
            </Stack>
          </Modal>

          {selectionMode ? (
            <Card withBorder p="sm">
              <Stack gap="sm">
                <Group justify="space-between" wrap="wrap" gap="xs">
                  <Badge variant="light" color="blue">
                    {selectedMediaIds.length} selected
                  </Badge>
                  <Group gap="xs">
                    <Button
                      size="xs"
                      variant="light"
                      onClick={() => {
                        setSelectedMediaIds((prev) => {
                          if (allVisibleSelected) {
                            return prev.filter((id) => !mediaIdsOnPage.includes(id));
                          }
                          const next = new Set(prev);
                          for (const id of mediaIdsOnPage) next.add(id);
                          return Array.from(next);
                        });
                      }}
                    >
                      {allVisibleSelected ? "Unselect Visible" : "Select Visible"}
                    </Button>
                    <Button
                      size="xs"
                      variant="light"
                      onClick={() => setSelectedMediaIds([])}
                      disabled={selectedMediaIds.length === 0}
                    >
                      Clear
                    </Button>
                  </Group>
                </Group>
                <Group grow align="flex-start">
                  <TextInput
                    label="Artist"
                    placeholder="Apply to selected media"
                    value={batchArtist}
                    onChange={(event) => setBatchArtist(event.currentTarget.value)}
                  />
                  <Textarea
                    label="Description"
                    placeholder="Apply to selected media"
                    autosize
                    minRows={2}
                    maxRows={4}
                    value={batchDescription}
                    onChange={(event) => setBatchDescription(event.currentTarget.value)}
                  />
                </Group>
                <Group justify="space-between" wrap="wrap" gap="xs">
                  <Button
                    size="xs"
                    variant="light"
                    loading={mediaSaveBusy}
                    disabled={selectedMediaIds.length === 0 || !hasBatchChanges}
                    onClick={() => {
                      void saveManyMediaMetadata({
                        ids: selectedMediaIds,
                        ...(batchArtist.trim()
                          ? { artist: batchArtist.trim() }
                          : {}),
                        ...(batchDescription.trim()
                          ? { description: batchDescription.trim() }
                          : {}),
                      }).catch(() => {});
                    }}
                  >
                    Apply Metadata
                  </Button>
                  <Button
                    size="xs"
                    variant="light"
                    color="red"
                    loading={mediaDeleteBusy}
                    disabled={selectedMediaIds.length === 0}
                    onClick={() => {
                      void deleteManyMediaItems(selectedMediaIds).then(() =>
                        setSelectedMediaIds([])
                      );
                    }}
                  >
                    Delete Selected
                  </Button>
                </Group>
              </Stack>
            </Card>
          ) : null}

          <div className="ops-media-feed">
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3, xl: 4 }} spacing="sm">
              {activeIngestJobs.map((job) => (
                <Card
                  key={job.id}
                  withBorder
                  p="sm"
                  className="ops-media-card ops-media-card-pending"
                >
                  <Stack gap={8}>
                    <Group justify="space-between" align="center">
                      <Badge variant="light" color="gray">
                        pending ingest
                      </Badge>
                      <Loader size={14} />
                    </Group>
                    <Text fw={700} lineClamp={1}>
                      {job.kind.replace("_", " ")}
                    </Text>
                    <Text size="xs" c="dimmed" lineClamp={1}>
                      {job.id}
                    </Text>
                    <Progress value={job.progress.percent} animated />
                    <Text size="xs" c="dimmed" lineClamp={1}>
                      {job.progress.message || (job.status === "queued" ? "queued" : "processing")}
                    </Text>
                  </Stack>
                </Card>
              ))}

              {mediaRowsPage.map((row) => {
                const previewSrc = mediaPreviewSource(row);
                const isVideo = isVideoMedia(row);
                const isSelected = selectionMode
                  ? selectedMediaIds.includes(row.id)
                  : selectedServerMediaId === row.id;
                return (
                  <Card
                    key={row.id}
                    withBorder
                    p="sm"
                    className={`ops-media-card${isSelected ? " is-selected" : ""}`}
                    onClick={() => {
                      if (selectionMode) {
                        setSelectedMediaIds((prev) =>
                          prev.includes(row.id)
                            ? prev.filter((id) => id !== row.id)
                            : [...prev, row.id]
                        );
                        return;
                      }
                      setSelectedServerMediaId(row.id);
                      setMediaDetailId(row.id);
                      setBuilderTab("mediaDetail");
                    }}
                  >
                    <Stack gap={8}>
                      {previewSrc && isVideo ? (
                        <video
                          className="ops-media-thumb-video"
                          muted
                          loop
                          playsInline
                          preload="metadata"
                          poster={row.thumbnailUrl}
                          src={previewSrc}
                          onMouseEnter={(e) => {
                            void e.currentTarget.play().catch(() => {});
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.pause();
                            e.currentTarget.currentTime = 0;
                          }}
                        />
                      ) : previewSrc ? (
                        <Image src={previewSrc} alt={row.title || row.id} radius="sm" h={120} fit="cover" />
                      ) : row.thumbnailUrl ? (
                        <Image src={row.thumbnailUrl} alt={row.title || row.id} radius="sm" h={120} fit="cover" />
                      ) : (
                        <Paper
                          withBorder
                          radius="sm"
                          h={120}
                          p="xs"
                          className="ops-media-thumb-fallback"
                        >
                          <Stack gap={2} justify="center" h="100%">
                            <Text size="xs" fw={700}>
                              {row.sourceType === "url" ? "WEB" : "MEDIA"}
                            </Text>
                            <Text size="xs" c="dimmed" lineClamp={2}>
                              {row.sourceType === "url" ? row.sourceValue : "No thumbnail generated yet"}
                            </Text>
                          </Stack>
                        </Paper>
                      )}

                      <Group justify="space-between" align="flex-start" wrap="nowrap">
                        <Stack gap={2} style={{ minWidth: 0 }}>
                          <Text fw={700} lineClamp={1}>
                            {row.title || row.id}
                          </Text>
                          <Text size="xs" c="dimmed" lineClamp={1}>
                            {row.artist || "unknown artist"}
                          </Text>
                        </Stack>
                        <Group gap={6} wrap="nowrap">
                          {row.sourceType === "url" ? (
                            <Badge size="sm" variant="light" color="indigo">
                              web
                            </Badge>
                          ) : null}
                          {isVideo ? (
                            <Badge size="sm" variant="light" color="cyan">
                              video
                            </Badge>
                          ) : null}
                          {selectionMode && isSelected ? (
                            <Badge size="sm" variant="light" color="blue">
                              selected
                            </Badge>
                          ) : null}
                        </Group>
                      </Group>

                      {row.sourceType === "url" && row.sourceValue ? (
                        <Text size="xs" c="dimmed" lineClamp={1}>
                          {row.sourceValue}
                        </Text>
                      ) : null}

                      {selectionMode ? null : (
                        <Group gap={6} grow wrap="nowrap" className="ops-card-actions">
                          <Button
                            size="xs"
                            variant="light"
                            color="cyan"
                            leftSection={<IconBroadcast size={14} />}
                            onClick={(event) => {
                              event.stopPropagation();
                              openQuickSend({
                                kind: "media",
                                id: row.id,
                                label: row.title || row.id,
                              });
                            }}
                          >
                            Send
                          </Button>
                          <Button
                            size="xs"
                            variant="light"
                            color="red"
                            leftSection={<IconTrash size={14} />}
                            onClick={(event) => {
                              event.stopPropagation();
                              void deleteMediaItem(row.id);
                            }}
                          >
                            Delete
                          </Button>
                        </Group>
                      )}
                    </Stack>
                  </Card>
                );
              })}
            </SimpleGrid>

            {serverMediaFiltered.length === 0 ? (
              <Text size="sm" c="dimmed" mt="sm">
                No media matches this filter.
              </Text>
            ) : null}
          </div>

        </Stack>
      ) : (
        <>
          <Group justify="space-between" align="center" wrap="wrap">
            <TextInput
              className="ops-media-search-input"
              leftSection={<IconSearch size={16} />}
              placeholder="Search playlists by id, title, artist, description"
              value={serverMediaQuery}
              onChange={(e) => setServerMediaQuery(e.currentTarget.value)}
            />
            <SegmentedControl
              value={playlistLibraryView}
              onChange={(value) =>
                setPlaylistLibraryView((value as "cards" | "table") || "cards")
              }
              size={isMobile ? "xs" : "sm"}
              data={[
                { value: "cards", label: "Cards" },
                { value: "table", label: "Table" },
              ]}
            />
          </Group>

          {playlistLibraryView === "cards" ? (
            <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }} spacing="sm">
              {playlistRowsPage.map((row) => (
                <Card
                  key={row.id}
                  withBorder
                  p="sm"
                  className="ops-playlist-card"
                  onClick={() => openPlaylistEditorRoute(row.id)}
                >
                  <Stack gap="xs">
                    <PreviewTileCluster
                      tiles={row.mediaIds.slice(0, 4).map((mediaId) => {
                        const media = mergedMediaById.get(mediaId);
                        const previewSrc = media
                          ? media.thumbnailUrl ||
                            (!isVideoMedia(media) ? mediaPreviewSource(media) || undefined : undefined)
                          : undefined;
                        return {
                          src: previewSrc,
                          label: media?.title || mediaId,
                        };
                      })}
                      totalCount={row.mediaIds.length}
                      height={176}
                    />
                    <Group justify="space-between" align="flex-start" wrap="nowrap">
                      <Stack gap={2}>
                        <Text fw={700} lineClamp={1}>
                          {row.title || row.id}
                        </Text>
                      </Stack>
                      <Badge size="sm" variant="light" color="blue">
                        playlist
                      </Badge>
                    </Group>
                    <Group gap={6}>
                      <Badge size="sm" variant="light">
                        {row.mediaIds.length} items
                      </Badge>
                      {row.artist ? (
                        <Badge size="sm" variant="light" color="gray">
                          {row.artist}
                        </Badge>
                      ) : null}
                    </Group>
                    <Text size="sm" c="dimmed" lineClamp={2}>
                      {row.description || "No description"}
                    </Text>
                    <Group gap={6} grow className="ops-card-actions">
                      <Button
                        size="xs"
                        variant="light"
                        color="blue"
                        leftSection={<IconPencil size={14} />}
                        onClick={(event) => {
                          event.stopPropagation();
                          openPlaylistEditorRoute(row.id);
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
                          openQuickSend({
                            kind: "playlist",
                            id: row.id,
                            label: row.title || row.id,
                          });
                        }}
                      >
                        Send
                      </Button>
                      <Button
                        size="xs"
                        variant="light"
                        color="red"
                        leftSection={<IconTrash size={14} />}
                        onClick={(event) => {
                          event.stopPropagation();
                          void deletePlaylistDraft(row.id);
                        }}
                      >
                        Delete
                      </Button>
                    </Group>
                  </Stack>
                </Card>
              ))}
            </SimpleGrid>
          ) : (
            <Card withBorder p="sm">
              <ScrollArea>
                <Table striped highlightOnHover withTableBorder withColumnBorders>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Title</Table.Th>
                      <Table.Th>Artist</Table.Th>
                      <Table.Th>Description</Table.Th>
                      <Table.Th>Items</Table.Th>
                      <Table.Th w={248}>Actions</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {playlistRowsPage.map((row) => (
                      <Table.Tr
                        key={row.id}
                        onClick={() => openPlaylistEditorRoute(row.id)}
                        style={
                          selectedPlaylistId === row.id
                            ? {
                                background: "rgba(56, 132, 227, 0.18)",
                                cursor: "pointer",
                              }
                            : { cursor: "pointer" }
                        }
                      >
                        <Table.Td>{row.title || "untitled"}</Table.Td>
                        <Table.Td>{row.artist || "—"}</Table.Td>
                        <Table.Td>
                          <Text size="sm" c="dimmed" lineClamp={1}>
                            {row.description || "—"}
                          </Text>
                        </Table.Td>
                        <Table.Td>{row.mediaIds.length}</Table.Td>
                        <Table.Td>
                          <Group gap={6} wrap="nowrap">
                            <Button
                              size="xs"
                              variant="light"
                              color="blue"
                              leftSection={<IconPencil size={14} />}
                              onClick={(event) => {
                                event.stopPropagation();
                                openPlaylistEditorRoute(row.id);
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
                                openQuickSend({
                                  kind: "playlist",
                                  id: row.id,
                                  label: row.title || row.id,
                                });
                              }}
                            >
                              Send
                            </Button>
                            <Button
                              size="xs"
                              variant="light"
                              color="red"
                              leftSection={<IconTrash size={14} />}
                              onClick={(event) => {
                                event.stopPropagation();
                                void deletePlaylistDraft(row.id);
                              }}
                            >
                              Delete
                            </Button>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            </Card>
          )}

          <Group justify="space-between" mt="xs" wrap="wrap">
            <Text size="xs" c="dimmed">
              {tableRangeLabel(playlistCount, playlistTablePage, TABLE_PAGE_SIZE.playlists)}
            </Text>
            <Pagination
              total={playlistTablePageCount}
              value={playlistTablePage}
              onChange={setPlaylistTablePage}
              size={isMobile ? "sm" : "md"}
              siblings={1}
              boundaries={1}
              withEdges
            />
          </Group>

          {playlistTotalCount === 0 ? (
            <Paper withBorder p="md">
              <Text size="sm" c="dimmed">
                No playlists yet. Create one to start assembling programming.
              </Text>
            </Paper>
          ) : playlistCount === 0 ? (
            <Paper withBorder p="md">
              <Text size="sm" c="dimmed">
                No playlists match this search.
              </Text>
            </Paper>
          ) : null}
        </>
      )}
    </Stack>
  );
}
