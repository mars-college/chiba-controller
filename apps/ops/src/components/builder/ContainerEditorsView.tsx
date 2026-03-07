import {
  useMemo,
  useState,
  type CSSProperties,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  Badge,
  Button,
  Card,
  Group,
  Image,
  Paper,
  ScrollArea,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconPencil, IconSearch, IconTrash } from "@tabler/icons-react";
import type { BuilderMode } from "../../store/uiStore";
import {
  generateAutoResourceId,
  TABLE_PAGE_SIZE,
  tableRangeLabel,
  type CatalogOption,
  type DraftBlock,
  type DraftBlockItem,
  type DraftChannel,
  type DraftProfile,
  type DraftStore,
  type TargetKind,
} from "../../lib/opsModel";
import type { ResourcePickerItem } from "../ResourcePickerModal";
import { ResourcePickerModal } from "../ResourcePickerModal";
import { PreviewTileCluster } from "../PreviewTileCluster";
import {
  OpsEmptyState,
  OpsFormDock,
  OpsPaginationBar,
  OpsPageHeader,
  OpsToolbar,
} from "../ui/OpsSurface";
import { ReorderableSequenceItem } from "./ReorderableSequenceItem";
import { TargetPickerRow } from "./TargetPickerRow";

type RegistryNodeRow = {
  nodeId: string;
  label: string;
  registered: boolean;
};

export type ContainerEditorsVm = {
  builderTab: BuilderMode;
  draftStore: DraftStore;
  syncDraftStoreToControlDb: (
    nextStore: DraftStore,
    options?: {
      successTitle?: string;
      successMessage?: string;
      quietSuccess?: boolean;
    }
  ) => Promise<boolean>;
  deleteBlockDraft: (blockId: string) => Promise<boolean>;
  deleteChannelDraft: (channelId: string) => Promise<boolean>;
  deleteProfileDraft: (profileId: string) => Promise<boolean>;
  isMobile: boolean;
  serverMediaQuery: string;
  setServerMediaQuery: (value: string) => void;

  blockRowsPage: DraftBlock[];
  blockCount: number;
  selectedBlockId: string | null;
  setSelectedBlockId: (id: string | null) => void;
  blockTablePage: number;
  setBlockTablePage: (page: number) => void;
  blockTablePageCount: number;
  blockDraft: DraftBlock;
  setBlockDraft: Dispatch<SetStateAction<DraftBlock>>;
  openBlockEditorRoute: (blockId?: string) => void;
  closeBlockEditorRoute: () => void;

  channelRowsPage: DraftChannel[];
  channelCount: number;
  selectedChannelId: string | null;
  setSelectedChannelId: (id: string | null) => void;
  channelTablePage: number;
  setChannelTablePage: (page: number) => void;
  channelTablePageCount: number;
  channelDraft: DraftChannel;
  setChannelDraft: Dispatch<SetStateAction<DraftChannel>>;
  openChannelEditorRoute: (channelId?: string) => void;
  closeChannelEditorRoute: () => void;

  profileRowsPage: DraftProfile[];
  profileCount: number;
  selectedProfileId: string | null;
  setSelectedProfileId: (id: string | null) => void;
  profileTablePage: number;
  setProfileTablePage: (page: number) => void;
  profileTablePageCount: number;
  profileDraft: DraftProfile;
  setProfileDraft: Dispatch<SetStateAction<DraftProfile>>;
  openProfileEditorRoute: (profileId?: string) => void;
  closeProfileEditorRoute: () => void;

  mediaOptions: CatalogOption[];
  playlistOptions: CatalogOption[];
  blockOptions: CatalogOption[];
  channelOptions: CatalogOption[];
  targetPickerItemsByKind: Partial<Record<TargetKind, ResourcePickerItem[]>>;
  registryNodes: RegistryNodeRow[];
};

function tableRowStyle(isSelected: boolean): CSSProperties {
  if (!isSelected) return { cursor: "pointer" };
  return {
    cursor: "pointer",
    background: "rgba(56, 132, 227, 0.18)",
  };
}

function upsertNodeAssignment(
  profile: DraftProfile,
  nodeId: string,
  next: { targetKind?: TargetKind; targetId?: string }
): DraftProfile {
  const id = nodeId.trim();
  if (!id) return profile;
  const existing = profile.nodeAssignments.find((row) => row.nodeId === id);
  const targetKind =
    next.targetKind || existing?.targetKind || profile.defaultTargetKind;
  const targetId = (next.targetId ?? existing?.targetId ?? "").trim();
  const nextRow = { nodeId: id, targetKind, targetId };
  const without = profile.nodeAssignments.filter((row) => row.nodeId !== id);
  return {
    ...profile,
    nodeAssignments: [...without, nextRow],
  };
}

export function ContainerEditorsView({ vm }: { vm: ContainerEditorsVm }) {
  const {
    builderTab,
    draftStore,
    syncDraftStoreToControlDb,
    deleteBlockDraft,
    deleteChannelDraft,
    deleteProfileDraft,
    isMobile,
    serverMediaQuery,
    setServerMediaQuery,
    blockRowsPage,
    blockCount,
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
    channelCount,
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
    profileCount,
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
  } = vm;

  const targetOptionsByKind = useMemo(
    () => ({
      media: mediaOptions,
      playlist: playlistOptions,
      block: blockOptions,
      channel: channelOptions,
    }),
    [blockOptions, channelOptions, mediaOptions, playlistOptions]
  );
  const pickerByKind = useMemo(() => {
    const toMap = (items: ResourcePickerItem[] | undefined) =>
      new Map((items || []).map((item) => [item.id, item]));
    return {
      media: toMap(targetPickerItemsByKind.media),
      playlist: toMap(targetPickerItemsByKind.playlist),
      block: toMap(targetPickerItemsByKind.block),
      channel: toMap(targetPickerItemsByKind.channel),
    };
  }, [targetPickerItemsByKind]);

  const [nextBlockItemKind, setNextBlockItemKind] =
    useState<DraftBlockItem["kind"]>("playlist");
  const [blockItemPickerOpen, setBlockItemPickerOpen] = useState(false);
  const [channelBlockPickerOpen, setChannelBlockPickerOpen] = useState(false);
  const [blockDragIndex, setBlockDragIndex] = useState<number | null>(null);
  const [blockDropIndex, setBlockDropIndex] = useState<number | null>(null);
  const [channelDragIndex, setChannelDragIndex] = useState<number | null>(null);
  const [channelDropIndex, setChannelDropIndex] = useState<number | null>(null);
  const blockPickerItems = targetPickerItemsByKind[nextBlockItemKind] || [];
  const channelPickerItems = targetPickerItemsByKind.block || [];

  const commitBlockDrop = (targetIndex: number | null) => {
    if (blockDragIndex === null || targetIndex === null) {
      setBlockDragIndex(null);
      setBlockDropIndex(null);
      return;
    }
    setBlockDraft((current) => {
      if (blockDragIndex < 0 || blockDragIndex >= current.items.length)
        return current;
      const next = [...current.items];
      const [moved] = next.splice(blockDragIndex, 1);
      if (!moved) return current;
      let insertionIndex = Math.max(0, Math.min(targetIndex, next.length));
      if (targetIndex > blockDragIndex) {
        insertionIndex = Math.max(0, insertionIndex - 1);
      }
      if (insertionIndex === blockDragIndex) return current;
      next.splice(insertionIndex, 0, moved);
      return { ...current, items: next };
    });
    setBlockDragIndex(null);
    setBlockDropIndex(null);
  };

  const commitChannelDrop = (targetIndex: number | null) => {
    if (channelDragIndex === null || targetIndex === null) {
      setChannelDragIndex(null);
      setChannelDropIndex(null);
      return;
    }
    setChannelDraft((current) => {
      if (channelDragIndex < 0 || channelDragIndex >= current.blockIds.length)
        return current;
      const next = [...current.blockIds];
      const [moved] = next.splice(channelDragIndex, 1);
      if (!moved) return current;
      let insertionIndex = Math.max(0, Math.min(targetIndex, next.length));
      if (targetIndex > channelDragIndex) {
        insertionIndex = Math.max(0, insertionIndex - 1);
      }
      if (insertionIndex === channelDragIndex) return current;
      next.splice(insertionIndex, 0, moved);
      return { ...current, blockIds: next };
    });
    setChannelDragIndex(null);
    setChannelDropIndex(null);
  };

  const renderClusterPreview = (
    item: ResourcePickerItem | undefined,
    height: number
  ) => {
    const tiles = item?.previewTiles || [];
    if (tiles.length > 0) {
      return (
        <PreviewTileCluster
          tiles={tiles}
          totalCount={item?.previewTilesTotalCount}
          height={height}
        />
      );
    }
    return (
      <Paper withBorder h={height} radius="sm" p="sm">
        <Group justify="center" align="center" h="100%">
          <Text size="xs" c="dimmed">
            No preview
          </Text>
        </Group>
      </Paper>
    );
  };

  const deleteBlockResource = async (blockId: string) => {
    const id = blockId.trim();
    if (!id) return;
    const deleted = await deleteBlockDraft(id);
    if (!deleted) return;
    if (selectedBlockId === id) setSelectedBlockId(null);
  };

  const deleteChannelResource = async (channelId: string) => {
    const id = channelId.trim();
    if (!id) return;
    const deleted = await deleteChannelDraft(id);
    if (!deleted) return;
    if (selectedChannelId === id) setSelectedChannelId(null);
  };

  const deleteProfileResource = async (profileId: string) => {
    const id = profileId.trim();
    if (!id) return;
    const deleted = await deleteProfileDraft(id);
    if (!deleted) return;
    if (selectedProfileId === id) setSelectedProfileId(null);
  };

  const libraryLabel = isMobile ? "Library" : "Media Library";
  const blockEditorTitle =
    blockDraft.title.trim() || blockDraft.id.trim() || "New Block";
  const channelEditorTitle =
    channelDraft.title.trim() || channelDraft.id.trim() || "New Channel";
  const profileEditorTitle =
    profileDraft.title.trim() || profileDraft.id.trim() || "New Profile";

  const saveBlock = async () => {
    const blockId =
      blockDraft.id.trim() ||
      generateAutoResourceId(
        "block",
        blockDraft.title || "block",
        draftStore.blocks.map((row) => row.id)
      );
    const normalizedItems = blockDraft.items
      .map((item) => ({ ...item, id: item.id.trim() }))
      .filter((item) => item.id.length > 0);
    const nextStore: DraftStore = {
      ...draftStore,
      blocks: [
        ...draftStore.blocks.filter((row) => row.id !== blockId),
        {
          ...blockDraft,
          id: blockId,
          mode: blockDraft.mode,
          items: normalizedItems,
        },
      ],
    };
    const synced = await syncDraftStoreToControlDb(nextStore, {
      quietSuccess: true,
    });
    if (!synced) return;
    setSelectedBlockId(blockId);
    closeBlockEditorRoute();
    notifications.show({
      color: "teal",
      title: "Block saved",
      message: blockId,
    });
  };

  const saveChannel = async () => {
    const channelId =
      channelDraft.id.trim() ||
      generateAutoResourceId(
        "channel",
        channelDraft.title || "channel",
        draftStore.channels.map((row) => row.id)
      );
    const normalizedBlockIds = channelDraft.blockIds
      .map((id) => id.trim())
      .filter((id) => id.length > 0);
    const nextStore: DraftStore = {
      ...draftStore,
      channels: [
        ...draftStore.channels.filter((row) => row.id !== channelId),
        {
          ...channelDraft,
          id: channelId,
          blockIds: normalizedBlockIds,
        },
      ],
    };
    const synced = await syncDraftStoreToControlDb(nextStore, {
      quietSuccess: true,
    });
    if (!synced) return;
    setSelectedChannelId(channelId);
    closeChannelEditorRoute();
    notifications.show({
      color: "teal",
      title: "Channel saved",
      message: channelId,
    });
  };

  const saveProfile = async () => {
    const profileId =
      profileDraft.id.trim() ||
      generateAutoResourceId(
        "profile",
        profileDraft.title || "profile",
        draftStore.profiles.map((row) => row.id)
      );
    const normalizedNodes = profileDraft.nodeAssignments
      .map((row) => ({
        nodeId: row.nodeId.trim(),
        targetKind: row.targetKind,
        targetId: row.targetId.trim(),
      }))
      .filter((row) => row.nodeId.length > 0 && row.targetId.length > 0);
    const nextStore: DraftStore = {
      ...draftStore,
      profiles: [
        ...draftStore.profiles.filter((row) => row.id !== profileId),
        {
          ...profileDraft,
          id: profileId,
          nodeAssignments: normalizedNodes,
        },
      ],
    };
    const synced = await syncDraftStoreToControlDb(nextStore, {
      quietSuccess: true,
    });
    if (!synced) return;
    setSelectedProfileId(profileId);
    closeProfileEditorRoute();
    notifications.show({
      color: "teal",
      title: "Profile saved",
      message: profileId,
    });
  };

  return (
    <>
      {builderTab === "block" ? (
        <Stack gap="md">
          <OpsToolbar sticky className="ops-toolbar-sticky-secondary">
            <Stack gap="sm">
              <Group justify="space-between" align="center" wrap="wrap">
                <Group gap="xs" wrap="wrap">
                  <Button
                    size="xs"
                    variant="light"
                    onClick={() => openBlockEditorRoute()}
                  >
                    New Block
                  </Button>
                </Group>
                <Group gap="xs">
                  <Badge variant="light">{blockCount} shown</Badge>
                  <Badge variant="light" color="gray">
                    {draftStore.blocks.length} total
                  </Badge>
                </Group>
              </Group>
              <TextInput
                leftSection={<IconSearch size={16} />}
                placeholder="Search blocks by id, title, mode, or item breakdown"
                value={serverMediaQuery}
                onChange={(event) =>
                  setServerMediaQuery(event.currentTarget.value)
                }
              />
            </Stack>
          </OpsToolbar>

          <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }} spacing="sm">
            {blockRowsPage.map((row) => {
              const mediaCount = row.items.filter(
                (item) => item.kind === "media"
              ).length;
              const playlistCount = row.items.filter(
                (item) => item.kind === "playlist"
              ).length;
              const blockPickerItem = pickerByKind.block.get(row.id);
              return (
                <Card
                  key={row.id}
                  withBorder
                  p="sm"
                  className="ops-resource-card"
                  onClick={() => openBlockEditorRoute(row.id)}
                >
                  <Stack gap="xs">
                    {renderClusterPreview(blockPickerItem, 116)}
                    <Group
                      justify="space-between"
                      align="flex-start"
                      wrap="nowrap"
                    >
                      <Stack gap={2}>
                        <Text fw={700} lineClamp={1}>
                          {row.title || row.id || "Untitled block"}
                        </Text>
                      </Stack>
                      <Badge size="sm" variant="light" color="orange">
                        block
                      </Badge>
                    </Group>
                    <Group gap={6}>
                      <Badge size="sm" variant="light">
                        {row.items.length} items
                      </Badge>
                      <Badge size="sm" variant="light" color="gray">
                        mode:{row.mode}
                      </Badge>
                    </Group>
                    <Text size="sm" c="dimmed">
                      media:{mediaCount} playlist:{playlistCount}
                    </Text>
                    <Group gap={6} grow>
                      <Button
                        size="xs"
                        variant="light"
                        color="blue"
                        leftSection={<IconPencil size={14} />}
                        onClick={(event) => {
                          event.stopPropagation();
                          openBlockEditorRoute(row.id);
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        size="xs"
                        variant="light"
                        color="red"
                        leftSection={<IconTrash size={14} />}
                        onClick={async (event) => {
                          event.stopPropagation();
                          await deleteBlockResource(row.id);
                        }}
                      >
                        Delete
                      </Button>
                    </Group>
                  </Stack>
                </Card>
              );
            })}
          </SimpleGrid>
          <OpsPaginationBar
            rangeLabel={tableRangeLabel(
              blockCount,
              blockTablePage,
              TABLE_PAGE_SIZE.blocks
            )}
            summary={`${blockCount} shown • ${draftStore.blocks.length} total`}
            totalPages={blockTablePageCount}
            value={blockTablePage}
            onChange={setBlockTablePage}
            size={isMobile ? "sm" : "md"}
            sticky
          />

          {draftStore.blocks.length === 0 ? (
            <OpsEmptyState
              title="No blocks yet"
              description="Blocks sequence media and playlists into reusable programming units."
              actionLabel="New Block"
              onAction={() => openBlockEditorRoute()}
            />
          ) : blockCount === 0 ? (
            <OpsEmptyState
              title="No blocks found"
              description="No blocks match the current search."
            />
          ) : null}
        </Stack>
      ) : null}

      {builderTab === "blockEditor" ? (
        <Stack gap="md">
          <OpsPageHeader
            compact
            title={blockEditorTitle}
            description="Sequence media and playlists into one reusable programming block."
            breadcrumbs={[
              {
                label: libraryLabel,
                onClick: closeBlockEditorRoute,
              },
              {
                label: "Blocks",
                onClick: closeBlockEditorRoute,
              },
              {
                label: blockDraft.id.trim() || "New Block",
              },
            ]}
            actions={
              <Button variant="light" onClick={closeBlockEditorRoute}>
                Back
              </Button>
            }
          />

          <TextInput
            label="Title"
            value={blockDraft.title}
            onChange={(event) => {
              const value = event.currentTarget.value;
              setBlockDraft((current) => ({ ...current, title: value }));
            }}
          />

          <SegmentedControl
            value={blockDraft.mode}
            onChange={(value) =>
              setBlockDraft((current) => ({
                ...current,
                mode:
                  value === "once" || value === "clocked" || value === "loop"
                    ? value
                    : current.mode,
              }))
            }
            data={[
              { value: "loop", label: "Loop" },
              { value: "once", label: "Once" },
              { value: "clocked", label: "Clocked" },
            ]}
          />

          <Paper withBorder p="sm">
            <Stack gap="xs">
              <Group justify="space-between" align="center">
                <Text fw={700}>Add Items</Text>
                <Button
                  size="xs"
                  variant="light"
                  onClick={() => setBlockItemPickerOpen(true)}
                  disabled={blockPickerItems.length === 0}
                >
                  Select {nextBlockItemKind === "media" ? "Media" : "Playlists"}
                </Button>
              </Group>
              <SegmentedControl
                value={nextBlockItemKind}
                onChange={(value) => {
                  if (value === "media" || value === "playlist") {
                    setNextBlockItemKind(value);
                  }
                }}
                data={[
                  { value: "media", label: "Media" },
                  { value: "playlist", label: "Playlist" },
                ]}
              />
            </Stack>
          </Paper>

          <Paper withBorder p="sm">
            <Group justify="space-between" mb="xs">
              <Text fw={700}>Items ({blockDraft.items.length})</Text>
              <Text size="xs" c="dimmed">
                Drag to reorder, repeatable
              </Text>
            </Group>
            <ScrollArea>
              <Stack gap="xs">
                {blockDraft.items.map((item, index) => {
                  const pickerItem = pickerByKind[item.kind].get(item.id);
                  const label =
                    pickerItem?.title ||
                    targetOptionsByKind[item.kind].find(
                      (row) => row.value === item.id
                    )?.label ||
                    item.id;
                  const subtitle =
                    pickerItem?.subtitle ||
                    (item.kind === "playlist" ? "Playlist" : "Media");
                  const previewTiles = pickerItem?.previewTiles || [];
                  const previewSrc =
                    pickerItem?.previewUrl || pickerItem?.thumbnailUrl || "";
                  const isVideo =
                    (pickerItem?.badge || "").toLowerCase() === "video";
                  return (
                    <div
                      key={`${item.kind}-${item.id}-${index}`}
                      className="ops-playlist-item-wrap"
                    >
                      {blockDragIndex !== null && blockDropIndex === index ? (
                        <div className="ops-playlist-drop-indicator" />
                      ) : null}
                      <ReorderableSequenceItem
                        index={index}
                        badgeLabel={item.kind}
                        badgeColor={item.kind === "media" ? "blue" : "teal"}
                        title={label}
                        subtitle={subtitle}
                        preview={
                          previewTiles.length > 0 ? (
                            <div style={{ width: 88, minWidth: 88 }}>
                              <PreviewTileCluster
                                tiles={previewTiles}
                                totalCount={pickerItem?.previewTilesTotalCount}
                                height={52}
                              />
                            </div>
                          ) : previewSrc ? (
                            isVideo ? (
                              <video
                                muted
                                loop
                                playsInline
                                preload="metadata"
                                poster={pickerItem?.thumbnailUrl}
                                src={previewSrc}
                                style={{
                                  width: 88,
                                  height: 52,
                                  borderRadius: 8,
                                  objectFit: "cover",
                                  background: "#020913",
                                }}
                              />
                            ) : (
                              <Image
                                src={previewSrc}
                                alt={label}
                                radius="sm"
                                w={88}
                                h={52}
                                fit="cover"
                              />
                            )
                          ) : undefined
                        }
                        onRemove={() => {
                          setBlockDraft((current) => ({
                            ...current,
                            items: current.items.filter(
                              (_, rowIndex) => rowIndex !== index
                            ),
                          }));
                        }}
                        onDragStart={() => {
                          setBlockDragIndex(index);
                          setBlockDropIndex(index);
                        }}
                        onDragOver={(event) => {
                          event.preventDefault();
                          if (blockDragIndex === null) return;
                          const rect =
                            event.currentTarget.getBoundingClientRect();
                          const midpoint = rect.top + rect.height / 2;
                          const nextIndex =
                            event.clientY < midpoint ? index : index + 1;
                          setBlockDropIndex((prev) =>
                            prev === nextIndex ? prev : nextIndex
                          );
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          commitBlockDrop(blockDropIndex ?? index);
                        }}
                        onDragEnd={() => {
                          setBlockDragIndex(null);
                          setBlockDropIndex(null);
                        }}
                      />
                    </div>
                  );
                })}
                {blockDragIndex !== null ? (
                  <div
                    className="ops-playlist-drop-tail is-active"
                    onDragOver={(event) => {
                      event.preventDefault();
                      setBlockDropIndex((prev) =>
                        prev === blockDraft.items.length
                          ? prev
                          : blockDraft.items.length
                      );
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      commitBlockDrop(
                        blockDropIndex ?? blockDraft.items.length
                      );
                    }}
                  >
                    {blockDropIndex === blockDraft.items.length ? (
                      <div className="ops-playlist-drop-indicator is-tail" />
                    ) : (
                      <div className="ops-playlist-drop-tail-placeholder">
                        Drop at end
                      </div>
                    )}
                  </div>
                ) : null}
                {blockDraft.items.length === 0 ? (
                  <Text size="sm" c="dimmed">
                    No items yet. Add media and/or playlists to define this
                    block.
                  </Text>
                ) : null}
              </Stack>
            </ScrollArea>
          </Paper>
          <OpsFormDock
            secondaryLabel="Back"
            onSecondary={closeBlockEditorRoute}
            primaryLabel="Save Block"
            onPrimary={() => {
              void saveBlock();
            }}
            aside={
              <Text size="xs" c="dimmed">
                {blockDraft.items.length} item(s)
              </Text>
            }
          />
        </Stack>
      ) : null}

      {builderTab === "channel" ? (
        <Stack gap="md">
          <OpsToolbar sticky className="ops-toolbar-sticky-secondary">
            <Stack gap="sm">
              <Group justify="space-between" align="center" wrap="wrap">
                <Group gap="xs" wrap="wrap">
                  <Button
                    size="xs"
                    variant="light"
                    onClick={() => openChannelEditorRoute()}
                  >
                    New Channel
                  </Button>
                </Group>
                <Group gap="xs">
                  <Badge variant="light">{channelCount} shown</Badge>
                  <Badge variant="light" color="gray">
                    {draftStore.channels.length} total
                  </Badge>
                </Group>
              </Group>
              <TextInput
                leftSection={<IconSearch size={16} />}
                placeholder="Search channels by id, title, or block ids"
                value={serverMediaQuery}
                onChange={(event) =>
                  setServerMediaQuery(event.currentTarget.value)
                }
              />
            </Stack>
          </OpsToolbar>

          <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }} spacing="sm">
            {channelRowsPage.map((row) => (
              <Card
                key={row.id}
                withBorder
                p="sm"
                className="ops-resource-card"
                onClick={() => openChannelEditorRoute(row.id)}
              >
                <Stack gap="xs">
                  <Group
                    justify="space-between"
                    align="flex-start"
                    wrap="nowrap"
                  >
                    <Stack gap={2}>
                      <Text fw={700} lineClamp={1}>
                        {row.title || row.id || "Untitled channel"}
                      </Text>
                    </Stack>
                    <Badge size="sm" variant="light" color="grape">
                      channel
                    </Badge>
                  </Group>
                  <Badge size="sm" variant="light">
                    {row.blockIds.length} block items
                  </Badge>
                  <Text size="sm" c="dimmed" lineClamp={2}>
                    {row.blockIds.slice(0, 4).join(" • ") || "No blocks yet"}
                  </Text>
                  <Group gap={6} grow>
                    <Button
                      size="xs"
                      variant="light"
                      color="blue"
                      leftSection={<IconPencil size={14} />}
                      onClick={(event) => {
                        event.stopPropagation();
                        openChannelEditorRoute(row.id);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      size="xs"
                      variant="light"
                      color="red"
                      leftSection={<IconTrash size={14} />}
                      onClick={async (event) => {
                        event.stopPropagation();
                        await deleteChannelResource(row.id);
                      }}
                    >
                      Delete
                    </Button>
                  </Group>
                </Stack>
              </Card>
            ))}
          </SimpleGrid>
          <OpsPaginationBar
            rangeLabel={tableRangeLabel(
              channelCount,
              channelTablePage,
              TABLE_PAGE_SIZE.channels
            )}
            summary={`${channelCount} shown • ${draftStore.channels.length} total`}
            totalPages={channelTablePageCount}
            value={channelTablePage}
            onChange={setChannelTablePage}
            size={isMobile ? "sm" : "md"}
            sticky
          />

          {draftStore.channels.length === 0 ? (
            <OpsEmptyState
              title="No channels yet"
              description="Channels sequence blocks in a repeatable order."
              actionLabel="New Channel"
              onAction={() => openChannelEditorRoute()}
            />
          ) : channelCount === 0 ? (
            <OpsEmptyState
              title="No channels found"
              description="No channels match the current search."
            />
          ) : null}
        </Stack>
      ) : null}

      {builderTab === "channelEditor" ? (
        <Stack gap="md">
          <OpsPageHeader
            compact
            title={channelEditorTitle}
            description="Build a repeatable sequence of blocks for channel playback."
            breadcrumbs={[
              {
                label: libraryLabel,
                onClick: closeChannelEditorRoute,
              },
              {
                label: "Channels",
                onClick: closeChannelEditorRoute,
              },
              {
                label: channelDraft.id.trim() || "New Channel",
              },
            ]}
            actions={
              <Button variant="light" onClick={closeChannelEditorRoute}>
                Back
              </Button>
            }
          />

          <TextInput
            label="Title"
            value={channelDraft.title}
            onChange={(event) => {
              const value = event.currentTarget.value;
              setChannelDraft((current) => ({ ...current, title: value }));
            }}
          />

          <Paper withBorder p="sm">
            <Stack gap="xs">
              <Group justify="space-between" align="center">
                <Text fw={700}>Add Block Items</Text>
                <Button
                  size="xs"
                  variant="light"
                  onClick={() => setChannelBlockPickerOpen(true)}
                  disabled={channelPickerItems.length === 0}
                >
                  Select Blocks
                </Button>
              </Group>
            </Stack>
          </Paper>

          <Paper withBorder p="sm">
            <Group justify="space-between" mb="xs">
              <Text fw={700}>Block Items ({channelDraft.blockIds.length})</Text>
              <Text size="xs" c="dimmed">
                Drag to reorder, repeatable
              </Text>
            </Group>
            <ScrollArea>
              <Stack gap="xs">
                {channelDraft.blockIds.map((blockId, index) => {
                  const blockPickerItem = pickerByKind.block.get(blockId);
                  const block = draftStore.blocks.find(
                    (row) => row.id === blockId
                  );
                  const label =
                    blockPickerItem?.title ||
                    blockOptions.find((row) => row.value === blockId)?.label ||
                    blockId;
                  const subtitle = `${block?.items.length || 0} items`;
                  return (
                    <div
                      key={`${blockId}-${index}`}
                      className="ops-playlist-item-wrap"
                    >
                      {channelDragIndex !== null &&
                      channelDropIndex === index ? (
                        <div className="ops-playlist-drop-indicator" />
                      ) : null}
                      <ReorderableSequenceItem
                        index={index}
                        badgeLabel="block"
                        badgeColor="orange"
                        title={label}
                        subtitle={subtitle}
                        preview={
                          <div style={{ width: 88, minWidth: 88 }}>
                            {renderClusterPreview(blockPickerItem, 52)}
                          </div>
                        }
                        onRemove={() => {
                          setChannelDraft((current) => ({
                            ...current,
                            blockIds: current.blockIds.filter(
                              (_, rowIndex) => rowIndex !== index
                            ),
                          }));
                        }}
                        onDragStart={() => {
                          setChannelDragIndex(index);
                          setChannelDropIndex(index);
                        }}
                        onDragOver={(event) => {
                          event.preventDefault();
                          if (channelDragIndex === null) return;
                          const rect =
                            event.currentTarget.getBoundingClientRect();
                          const midpoint = rect.top + rect.height / 2;
                          const nextIndex =
                            event.clientY < midpoint ? index : index + 1;
                          setChannelDropIndex((prev) =>
                            prev === nextIndex ? prev : nextIndex
                          );
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          commitChannelDrop(channelDropIndex ?? index);
                        }}
                        onDragEnd={() => {
                          setChannelDragIndex(null);
                          setChannelDropIndex(null);
                        }}
                      />
                    </div>
                  );
                })}
                {channelDragIndex !== null ? (
                  <div
                    className="ops-playlist-drop-tail is-active"
                    onDragOver={(event) => {
                      event.preventDefault();
                      setChannelDropIndex((prev) =>
                        prev === channelDraft.blockIds.length
                          ? prev
                          : channelDraft.blockIds.length
                      );
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      commitChannelDrop(
                        channelDropIndex ?? channelDraft.blockIds.length
                      );
                    }}
                  >
                    {channelDropIndex === channelDraft.blockIds.length ? (
                      <div className="ops-playlist-drop-indicator is-tail" />
                    ) : (
                      <div className="ops-playlist-drop-tail-placeholder">
                        Drop at end
                      </div>
                    )}
                  </div>
                ) : null}
                {channelDraft.blockIds.length === 0 ? (
                  <Text size="sm" c="dimmed">
                    No block items yet. Add blocks to build this channel
                    sequence.
                  </Text>
                ) : null}
              </Stack>
            </ScrollArea>
          </Paper>
          <OpsFormDock
            secondaryLabel="Back"
            onSecondary={closeChannelEditorRoute}
            primaryLabel="Save Channel"
            onPrimary={() => {
              void saveChannel();
            }}
            aside={
              <Text size="xs" c="dimmed">
                {channelDraft.blockIds.length} block(s)
              </Text>
            }
          />
        </Stack>
      ) : null}

      {builderTab === "profile" ? (
        <Stack gap="md">
          <OpsToolbar sticky className="ops-toolbar-sticky-secondary">
            <Stack gap="sm">
              <Group justify="space-between" align="center" wrap="wrap">
                <Group gap="xs" wrap="wrap">
                  <Button
                    size="xs"
                    variant="light"
                    onClick={() => openProfileEditorRoute()}
                  >
                    New Profile
                  </Button>
                </Group>
                <Group gap="xs">
                  <Badge variant="light">{profileCount} shown</Badge>
                  <Badge variant="light" color="gray">
                    {draftStore.profiles.length} total
                  </Badge>
                </Group>
              </Group>
              <TextInput
                leftSection={<IconSearch size={16} />}
                placeholder="Search profiles by id, title, targets, or node assignments"
                value={serverMediaQuery}
                onChange={(event) =>
                  setServerMediaQuery(event.currentTarget.value)
                }
              />
            </Stack>
          </OpsToolbar>

          <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }} spacing="sm">
            {profileRowsPage.map((row) => (
              <Card
                key={row.id}
                withBorder
                p="sm"
                className="ops-resource-card"
                onClick={() => openProfileEditorRoute(row.id)}
              >
                <Stack gap="xs">
                  <Group
                    justify="space-between"
                    align="flex-start"
                    wrap="nowrap"
                  >
                    <Stack gap={2}>
                      <Text fw={700} lineClamp={1}>
                        {row.title || row.id || "Untitled profile"}
                      </Text>
                    </Stack>
                    <Badge size="sm" variant="light" color="violet">
                      profile
                    </Badge>
                  </Group>
                  <Badge size="sm" variant="light" color="gray">
                    default:{row.defaultTargetKind}
                  </Badge>
                  <Text size="sm" c="dimmed">
                    {
                      row.nodeAssignments.filter(
                        (node) => node.targetId.trim().length > 0
                      ).length
                    }{" "}
                    node assignment(s)
                  </Text>
                  <Group gap={6} grow>
                    <Button
                      size="xs"
                      variant="light"
                      color="blue"
                      leftSection={<IconPencil size={14} />}
                      onClick={(event) => {
                        event.stopPropagation();
                        openProfileEditorRoute(row.id);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      size="xs"
                      variant="light"
                      color="red"
                      leftSection={<IconTrash size={14} />}
                      onClick={async (event) => {
                        event.stopPropagation();
                        await deleteProfileResource(row.id);
                      }}
                    >
                      Delete
                    </Button>
                  </Group>
                </Stack>
              </Card>
            ))}
          </SimpleGrid>
          <OpsPaginationBar
            rangeLabel={tableRangeLabel(
              profileCount,
              profileTablePage,
              TABLE_PAGE_SIZE.profiles
            )}
            summary={`${profileCount} shown • ${draftStore.profiles.length} total`}
            totalPages={profileTablePageCount}
            value={profileTablePage}
            onChange={setProfileTablePage}
            size={isMobile ? "sm" : "md"}
            sticky
          />

          {draftStore.profiles.length === 0 ? (
            <OpsEmptyState
              title="No profiles yet"
              description="Profiles assign default and per-node targets."
              actionLabel="New Profile"
              onAction={() => openProfileEditorRoute()}
            />
          ) : profileCount === 0 ? (
            <OpsEmptyState
              title="No profiles found"
              description="No profiles match the current search."
            />
          ) : null}
        </Stack>
      ) : null}

      {builderTab === "profileEditor" ? (
        <Stack gap="md">
          <OpsPageHeader
            compact
            title={profileEditorTitle}
            description="Set default targets and per-node overrides in one place."
            breadcrumbs={[
              {
                label: libraryLabel,
                onClick: closeProfileEditorRoute,
              },
              {
                label: "Profiles",
                onClick: closeProfileEditorRoute,
              },
              {
                label: profileDraft.id.trim() || "New Profile",
              },
            ]}
            actions={
              <Button variant="light" onClick={closeProfileEditorRoute}>
                Back
              </Button>
            }
          />

          <TextInput
            label="Title"
            value={profileDraft.title}
            onChange={(event) => {
              const value = event.currentTarget.value;
              setProfileDraft((current) => ({ ...current, title: value }));
            }}
          />

          <Paper withBorder p="sm">
            <Stack gap="xs">
              <Group justify="space-between" align="center">
                <Text fw={700}>Default Target</Text>
                <Text size="xs" c="dimmed">
                  Used when node-specific target is not set
                </Text>
              </Group>
              <TargetPickerRow
                kind={profileDraft.defaultTargetKind}
                targetId={profileDraft.defaultTargetId}
                onKindChange={(kind) => {
                  setProfileDraft((current) => ({
                    ...current,
                    defaultTargetKind: kind,
                    defaultTargetId: "",
                  }));
                }}
                onTargetIdChange={(targetId) => {
                  setProfileDraft((current) => ({
                    ...current,
                    defaultTargetId: targetId,
                  }));
                }}
                kindOptions={[
                  { value: "media", label: "Media" },
                  { value: "playlist", label: "Playlist" },
                  { value: "block", label: "Block" },
                  { value: "channel", label: "Channel" },
                ]}
                optionsByKind={targetOptionsByKind}
                pickerItemsByKind={targetPickerItemsByKind}
                kindLabel="Default kind"
                targetLabel="Default target"
              />
            </Stack>
          </Paper>

          <Paper withBorder p="sm">
            <Stack gap="xs">
              <Group justify="space-between" align="center" wrap="wrap">
                <Text fw={700}>Node Assignments</Text>
                <Group gap="xs">
                  <Badge variant="light">{registryNodes.length} nodes</Badge>
                  <Button
                    size="xs"
                    variant="light"
                    disabled={
                      !profileDraft.defaultTargetId.trim() ||
                      registryNodes.length === 0
                    }
                    onClick={() => {
                      const defaultTargetId =
                        profileDraft.defaultTargetId.trim();
                      if (!defaultTargetId) return;
                      setProfileDraft((current) => ({
                        ...current,
                        nodeAssignments: registryNodes.map((node) => ({
                          nodeId: node.nodeId,
                          targetKind: current.defaultTargetKind,
                          targetId: defaultTargetId,
                        })),
                      }));
                    }}
                  >
                    Assign Default To All Nodes
                  </Button>
                </Group>
              </Group>

              <ScrollArea>
                <Stack gap="sm">
                  {registryNodes.map((node) => {
                    const assigned = profileDraft.nodeAssignments.find(
                      (row) => row.nodeId === node.nodeId
                    );
                    const kind =
                      assigned?.targetKind || profileDraft.defaultTargetKind;
                    const targetId = assigned?.targetId || "";
                    return (
                      <Paper key={node.nodeId} withBorder p="sm">
                        <Stack gap="xs">
                          <Group
                            justify="space-between"
                            align="center"
                            wrap="wrap"
                          >
                            <Group gap="xs">
                              <Text fw={700}>{node.label}</Text>
                              {node.registered ? null : (
                                <Badge size="xs" color="orange" variant="light">
                                  not in registry
                                </Badge>
                              )}
                            </Group>
                            <Group gap="xs">
                              <Button
                                size="xs"
                                variant="light"
                                disabled={!profileDraft.defaultTargetId.trim()}
                                onClick={() => {
                                  const defaultTargetId =
                                    profileDraft.defaultTargetId.trim();
                                  if (!defaultTargetId) return;
                                  setProfileDraft((current) =>
                                    upsertNodeAssignment(current, node.nodeId, {
                                      targetKind: current.defaultTargetKind,
                                      targetId: defaultTargetId,
                                    })
                                  );
                                }}
                              >
                                Use Default
                              </Button>
                              <Button
                                size="xs"
                                variant="subtle"
                                color="gray"
                                onClick={() => {
                                  setProfileDraft((current) => ({
                                    ...current,
                                    nodeAssignments:
                                      current.nodeAssignments.filter(
                                        (row) => row.nodeId !== node.nodeId
                                      ),
                                  }));
                                }}
                              >
                                Clear
                              </Button>
                            </Group>
                          </Group>

                          <TargetPickerRow
                            kind={kind}
                            targetId={targetId}
                            onKindChange={(nextKind) => {
                              setProfileDraft((current) =>
                                upsertNodeAssignment(current, node.nodeId, {
                                  targetKind: nextKind,
                                  targetId: "",
                                })
                              );
                            }}
                            onTargetIdChange={(nextTargetId) => {
                              setProfileDraft((current) =>
                                upsertNodeAssignment(current, node.nodeId, {
                                  targetKind: kind,
                                  targetId: nextTargetId,
                                })
                              );
                            }}
                            kindOptions={[
                              { value: "media", label: "Media" },
                              { value: "playlist", label: "Playlist" },
                              { value: "block", label: "Block" },
                              { value: "channel", label: "Channel" },
                            ]}
                            optionsByKind={targetOptionsByKind}
                            pickerItemsByKind={targetPickerItemsByKind}
                            kindLabel="Target kind"
                            targetLabel="Target"
                          />
                        </Stack>
                      </Paper>
                    );
                  })}

                  {registryNodes.length === 0 ? (
                    <Text size="sm" c="dimmed">
                      No nodes are registered yet. Add nodes in Fleet to assign
                      profile targets.
                    </Text>
                  ) : null}
                </Stack>
              </ScrollArea>
            </Stack>
          </Paper>
          <OpsFormDock
            secondaryLabel="Back"
            onSecondary={closeProfileEditorRoute}
            primaryLabel="Save Profile"
            onPrimary={() => {
              void saveProfile();
            }}
            aside={
              <Text size="xs" c="dimmed">
                {profileDraft.nodeAssignments.length} node override(s)
              </Text>
            }
          />
        </Stack>
      ) : null}

      <ResourcePickerModal
        opened={blockItemPickerOpen}
        onClose={() => setBlockItemPickerOpen(false)}
        title={`Pick ${nextBlockItemKind}`}
        items={blockPickerItems}
        selectedIds={[]}
        multi
        applyLabel={`Add ${nextBlockItemKind}`}
        onApply={(ids) => {
          if (ids.length === 0) return;
          setBlockDraft((current) => ({
            ...current,
            items: [
              ...current.items,
              ...ids.map((id) => ({ kind: nextBlockItemKind, id })),
            ],
          }));
        }}
      />

      <ResourcePickerModal
        opened={channelBlockPickerOpen}
        onClose={() => setChannelBlockPickerOpen(false)}
        title="Pick blocks"
        items={channelPickerItems}
        selectedIds={[]}
        multi
        applyLabel="Add blocks"
        onApply={(ids) => {
          if (ids.length === 0) return;
          setChannelDraft((current) => ({
            ...current,
            blockIds: [...current.blockIds, ...ids],
          }));
        }}
      />
    </>
  );
}
