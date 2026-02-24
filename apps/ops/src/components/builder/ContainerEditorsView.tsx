import {
  useMemo,
  useState,
  type CSSProperties,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  ActionIcon,
  Anchor,
  Badge,
  Breadcrumbs,
  Button,
  Card,
  Group,
  Image,
  Pagination,
  Paper,
  ScrollArea,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconPencil, IconTrash } from "@tabler/icons-react";
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
    options?: { successTitle?: string; successMessage?: string; quietSuccess?: boolean }
  ) => Promise<boolean>;
  isMobile: boolean;

  blockLibraryView: "cards" | "table";
  setBlockLibraryView: (value: "cards" | "table") => void;
  blockRowsPage: DraftBlock[];
  selectedBlockId: string | null;
  setSelectedBlockId: (id: string | null) => void;
  blockTablePage: number;
  setBlockTablePage: (page: number) => void;
  blockTablePageCount: number;
  blockDraft: DraftBlock;
  setBlockDraft: Dispatch<SetStateAction<DraftBlock>>;
  openBlockEditorRoute: (blockId?: string) => void;
  closeBlockEditorRoute: () => void;

  channelLibraryView: "cards" | "table";
  setChannelLibraryView: (value: "cards" | "table") => void;
  channelRowsPage: DraftChannel[];
  selectedChannelId: string | null;
  setSelectedChannelId: (id: string | null) => void;
  channelTablePage: number;
  setChannelTablePage: (page: number) => void;
  channelTablePageCount: number;
  channelDraft: DraftChannel;
  setChannelDraft: Dispatch<SetStateAction<DraftChannel>>;
  openChannelEditorRoute: (channelId?: string) => void;
  closeChannelEditorRoute: () => void;

  profileLibraryView: "cards" | "table";
  setProfileLibraryView: (value: "cards" | "table") => void;
  profileRowsPage: DraftProfile[];
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
  const targetKind = next.targetKind || existing?.targetKind || profile.defaultTargetKind;
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
    isMobile,

    blockLibraryView,
    setBlockLibraryView,
    blockRowsPage,
    selectedBlockId,
    setSelectedBlockId,
    blockTablePage,
    setBlockTablePage,
    blockTablePageCount,
    blockDraft,
    setBlockDraft,
    openBlockEditorRoute,
    closeBlockEditorRoute,

    channelLibraryView,
    setChannelLibraryView,
    channelRowsPage,
    selectedChannelId,
    setSelectedChannelId,
    channelTablePage,
    setChannelTablePage,
    channelTablePageCount,
    channelDraft,
    setChannelDraft,
    openChannelEditorRoute,
    closeChannelEditorRoute,

    profileLibraryView,
    setProfileLibraryView,
    profileRowsPage,
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
    const nextStore: DraftStore = {
      ...draftStore,
      blocks: draftStore.blocks.filter((item) => item.id !== id),
      channels: draftStore.channels.map((channel) => ({
        ...channel,
        blockIds: channel.blockIds.filter((rowId) => rowId !== id),
      })),
      profiles: draftStore.profiles.map((profile) => ({
        ...profile,
        defaultTargetId:
          profile.defaultTargetKind === "block" && profile.defaultTargetId === id
            ? ""
            : profile.defaultTargetId,
        nodeAssignments: profile.nodeAssignments.map((assignment) =>
          assignment.targetKind === "block" && assignment.targetId === id
            ? { ...assignment, targetId: "" }
            : assignment
        ),
      })),
    };
    const synced = await syncDraftStoreToControlDb(nextStore, {
      quietSuccess: true,
    });
    if (!synced) return;
    if (selectedBlockId === id) setSelectedBlockId(null);
    notifications.show({
      color: "teal",
      title: "Block deleted",
      message: id,
    });
  };

  const deleteChannelResource = async (channelId: string) => {
    const id = channelId.trim();
    if (!id) return;
    const nextStore: DraftStore = {
      ...draftStore,
      channels: draftStore.channels.filter((item) => item.id !== id),
      profiles: draftStore.profiles.map((profile) => ({
        ...profile,
        defaultTargetId:
          profile.defaultTargetKind === "channel" && profile.defaultTargetId === id
            ? ""
            : profile.defaultTargetId,
        nodeAssignments: profile.nodeAssignments.map((assignment) =>
          assignment.targetKind === "channel" && assignment.targetId === id
            ? { ...assignment, targetId: "" }
            : assignment
        ),
      })),
    };
    const synced = await syncDraftStoreToControlDb(nextStore, {
      quietSuccess: true,
    });
    if (!synced) return;
    if (selectedChannelId === id) setSelectedChannelId(null);
    notifications.show({
      color: "teal",
      title: "Channel deleted",
      message: id,
    });
  };

  const deleteProfileResource = async (profileId: string) => {
    const id = profileId.trim();
    if (!id) return;
    const nextStore: DraftStore = {
      ...draftStore,
      profiles: draftStore.profiles.filter((item) => item.id !== id),
    };
    const synced = await syncDraftStoreToControlDb(nextStore, {
      quietSuccess: true,
    });
    if (!synced) return;
    if (selectedProfileId === id) setSelectedProfileId(null);
    notifications.show({
      color: "teal",
      title: "Profile deleted",
      message: id,
    });
  };

  return (
    <>
      {builderTab === "block" ? (
        <Stack gap="md">
          <Group justify="space-between" align="center" wrap="wrap">
            <Group gap="xs" wrap="wrap">
              <Button size="xs" variant="light" onClick={() => openBlockEditorRoute()}>
                New Block
              </Button>
              <SegmentedControl
                value={blockLibraryView}
                onChange={(value) =>
                  setBlockLibraryView((value as "cards" | "table") || "cards")
                }
                data={[
                  { value: "cards", label: "Card View" },
                  { value: "table", label: "List View" },
                ]}
              />
            </Group>
            <Badge variant="light">{draftStore.blocks.length} blocks</Badge>
          </Group>

          {blockLibraryView === "cards" ? (
            <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }} spacing="sm">
              {draftStore.blocks.map((row) => {
                const mediaCount = row.items.filter((item) => item.kind === "media").length;
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
                      <Group justify="space-between" align="flex-start" wrap="nowrap">
                        <Stack gap={2}>
                          <Text fw={700} lineClamp={1}>
                            {row.title || row.id || "Untitled block"}
                          </Text>
                        </Stack>
                        <Group gap={6}>
                          <ActionIcon
                            color="blue"
                            variant="light"
                            size="sm"
                            onClick={(event) => {
                              event.stopPropagation();
                              openBlockEditorRoute(row.id);
                            }}
                            title="Open block editor"
                          >
                            <IconPencil size={14} />
                          </ActionIcon>
                          <ActionIcon
                            color="red"
                            variant="light"
                            size="sm"
                            onClick={async (event) => {
                              event.stopPropagation();
                              await deleteBlockResource(row.id);
                            }}
                            title="Delete block"
                          >
                            <IconTrash size={14} />
                          </ActionIcon>
                        </Group>
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
                    </Stack>
                  </Card>
                );
              })}
            </SimpleGrid>
          ) : (
            <Card withBorder p="sm">
              <ScrollArea h={560}>
                <Table striped highlightOnHover withTableBorder withColumnBorders>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Title</Table.Th>
                      <Table.Th>Mode</Table.Th>
                      <Table.Th>Items</Table.Th>
                      <Table.Th>Breakdown</Table.Th>
                      <Table.Th w={96}>Actions</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {blockRowsPage.map((row) => {
                      const mediaCount = row.items.filter((item) => item.kind === "media").length;
                      const playlistCount = row.items.filter(
                        (item) => item.kind === "playlist"
                      ).length;
                      return (
                        <Table.Tr
                          key={row.id}
                          onClick={() => openBlockEditorRoute(row.id)}
                          style={tableRowStyle(selectedBlockId === row.id)}
                        >
                          <Table.Td>{row.title || "untitled"}</Table.Td>
                          <Table.Td>{row.mode}</Table.Td>
                          <Table.Td>{row.items.length}</Table.Td>
                          <Table.Td>
                            <Text size="sm" c="dimmed">
                              m:{mediaCount} / pl:{playlistCount}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Group gap={6}>
                              <ActionIcon
                                color="blue"
                                variant="light"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openBlockEditorRoute(row.id);
                                }}
                                title="Open block editor"
                              >
                                <IconPencil size={14} />
                              </ActionIcon>
                              <ActionIcon
                                color="red"
                                variant="light"
                                onClick={async (event) => {
                                  event.stopPropagation();
                                  await deleteBlockResource(row.id);
                                }}
                                title="Delete block"
                              >
                                <IconTrash size={14} />
                              </ActionIcon>
                            </Group>
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
              <Group justify="space-between" mt="xs" wrap="wrap">
                <Text size="xs" c="dimmed">
                  {tableRangeLabel(
                    draftStore.blocks.length,
                    blockTablePage,
                    TABLE_PAGE_SIZE.blocks
                  )}
                </Text>
                <Pagination
                  total={blockTablePageCount}
                  value={blockTablePage}
                  onChange={setBlockTablePage}
                  size={isMobile ? "sm" : "md"}
                  siblings={1}
                  boundaries={1}
                  withEdges
                />
              </Group>
            </Card>
          )}

          {draftStore.blocks.length === 0 ? (
            <Paper withBorder p="md">
              <Text size="sm" c="dimmed">
                No blocks yet. Blocks can sequence media and/or playlists.
              </Text>
            </Paper>
          ) : null}
        </Stack>
      ) : null}

      {builderTab === "blockEditor" ? (
        <Stack gap="md">
          <Group justify="space-between" align="center" wrap="wrap">
            <Stack gap={4}>
              <Breadcrumbs separator="/" separatorMargin="xs">
                <Anchor
                  size="sm"
                  href="#"
                  onClick={(event) => {
                    event.preventDefault();
                    closeBlockEditorRoute();
                  }}
                >
                  Media Library
                </Anchor>
                <Anchor
                  size="sm"
                  href="#"
                  onClick={(event) => {
                    event.preventDefault();
                    closeBlockEditorRoute();
                  }}
                >
                  Blocks
                </Anchor>
                <Text size="sm" c="dimmed">
                  {blockDraft.id.trim() || "New Block"}
                </Text>
              </Breadcrumbs>
              <Title order={5}>{blockDraft.title.trim() || blockDraft.id.trim() || "New Block"}</Title>
            </Stack>
            <Group gap="xs">
              <Button variant="light" onClick={closeBlockEditorRoute}>
                Back
              </Button>
              <Button
                onClick={async () => {
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
                }}
              >
                Save Block
              </Button>
            </Group>
          </Group>

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
            <ScrollArea h={320}>
              <Stack gap="xs">
                {blockDraft.items.map((item, index) => {
                  const pickerItem = pickerByKind[item.kind].get(item.id);
                  const label =
                    pickerItem?.title ||
                    targetOptionsByKind[item.kind].find((row) => row.value === item.id)
                      ?.label ||
                    item.id;
                  const subtitle =
                    pickerItem?.subtitle ||
                    (item.kind === "playlist" ? "Playlist" : "Media");
                  const previewTiles = pickerItem?.previewTiles || [];
                  const previewSrc = pickerItem?.previewUrl || pickerItem?.thumbnailUrl || "";
                  const isVideo = (pickerItem?.badge || "").toLowerCase() === "video";
                  return (
                    <div key={`${item.kind}-${item.id}-${index}`} className="ops-playlist-item-wrap">
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
                          const rect = event.currentTarget.getBoundingClientRect();
                          const midpoint = rect.top + rect.height / 2;
                          const nextIndex = event.clientY < midpoint ? index : index + 1;
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
                      commitBlockDrop(blockDropIndex ?? blockDraft.items.length);
                    }}
                  >
                    {blockDropIndex === blockDraft.items.length ? (
                      <div className="ops-playlist-drop-indicator is-tail" />
                    ) : (
                      <div className="ops-playlist-drop-tail-placeholder">Drop at end</div>
                    )}
                  </div>
                ) : null}
                {blockDraft.items.length === 0 ? (
                  <Text size="sm" c="dimmed">
                    No items yet. Add media and/or playlists to define this block.
                  </Text>
                ) : null}
              </Stack>
            </ScrollArea>
          </Paper>
        </Stack>
      ) : null}

      {builderTab === "channel" ? (
        <Stack gap="md">
          <Group justify="space-between" align="center" wrap="wrap">
            <Group gap="xs" wrap="wrap">
              <Button
                size="xs"
                variant="light"
                onClick={() => openChannelEditorRoute()}
              >
                New Channel
              </Button>
              <SegmentedControl
                value={channelLibraryView}
                onChange={(value) =>
                  setChannelLibraryView((value as "cards" | "table") || "cards")
                }
                data={[
                  { value: "cards", label: "Card View" },
                  { value: "table", label: "List View" },
                ]}
              />
            </Group>
            <Badge variant="light">{draftStore.channels.length} channels</Badge>
          </Group>

          {channelLibraryView === "cards" ? (
            <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }} spacing="sm">
              {draftStore.channels.map((row) => (
                <Card
                  key={row.id}
                  withBorder
                  p="sm"
                  className="ops-resource-card"
                  onClick={() => openChannelEditorRoute(row.id)}
                >
                  <Stack gap="xs">
                    <Group justify="space-between" align="flex-start" wrap="nowrap">
                      <Stack gap={2}>
                        <Text fw={700} lineClamp={1}>
                          {row.title || row.id || "Untitled channel"}
                        </Text>
                      </Stack>
                      <Group gap={6}>
                        <ActionIcon
                          color="blue"
                          variant="light"
                          size="sm"
                          onClick={(event) => {
                            event.stopPropagation();
                            openChannelEditorRoute(row.id);
                          }}
                          title="Open channel editor"
                        >
                          <IconPencil size={14} />
                        </ActionIcon>
                        <ActionIcon
                          color="red"
                          variant="light"
                          size="sm"
                          onClick={async (event) => {
                            event.stopPropagation();
                            await deleteChannelResource(row.id);
                          }}
                          title="Delete channel"
                        >
                          <IconTrash size={14} />
                        </ActionIcon>
                      </Group>
                    </Group>
                    <Badge size="sm" variant="light">
                      {row.blockIds.length} block items
                    </Badge>
                    <Text size="sm" c="dimmed" lineClamp={2}>
                      {row.blockIds.slice(0, 4).join(" • ") || "No blocks yet"}
                    </Text>
                  </Stack>
                </Card>
              ))}
            </SimpleGrid>
          ) : (
            <Card withBorder p="sm">
              <ScrollArea h={560}>
                <Table striped highlightOnHover withTableBorder withColumnBorders>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Title</Table.Th>
                      <Table.Th>Block Items</Table.Th>
                      <Table.Th w={96}>Actions</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {channelRowsPage.map((row) => (
                      <Table.Tr
                        key={row.id}
                        onClick={() => openChannelEditorRoute(row.id)}
                        style={tableRowStyle(selectedChannelId === row.id)}
                      >
                        <Table.Td>{row.title || "untitled"}</Table.Td>
                        <Table.Td>{row.blockIds.length}</Table.Td>
                        <Table.Td>
                          <Group gap={6}>
                            <ActionIcon
                              color="blue"
                              variant="light"
                              onClick={(event) => {
                                event.stopPropagation();
                                openChannelEditorRoute(row.id);
                              }}
                              title="Open channel editor"
                            >
                              <IconPencil size={14} />
                            </ActionIcon>
                            <ActionIcon
                              color="red"
                              variant="light"
                              onClick={async (event) => {
                                event.stopPropagation();
                                await deleteChannelResource(row.id);
                              }}
                              title="Delete channel"
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
                    draftStore.channels.length,
                    channelTablePage,
                    TABLE_PAGE_SIZE.channels
                  )}
                </Text>
                <Pagination
                  total={channelTablePageCount}
                  value={channelTablePage}
                  onChange={setChannelTablePage}
                  size={isMobile ? "sm" : "md"}
                  siblings={1}
                  boundaries={1}
                  withEdges
                />
              </Group>
            </Card>
          )}

          {draftStore.channels.length === 0 ? (
            <Paper withBorder p="md">
              <Text size="sm" c="dimmed">
                No channels yet. Channels sequence blocks in a repeatable order.
              </Text>
            </Paper>
          ) : null}
        </Stack>
      ) : null}

      {builderTab === "channelEditor" ? (
        <Stack gap="md">
          <Group justify="space-between" align="center" wrap="wrap">
            <Stack gap={4}>
              <Breadcrumbs separator="/" separatorMargin="xs">
                <Anchor
                  size="sm"
                  href="#"
                  onClick={(event) => {
                    event.preventDefault();
                    closeChannelEditorRoute();
                  }}
                >
                  Media Library
                </Anchor>
                <Anchor
                  size="sm"
                  href="#"
                  onClick={(event) => {
                    event.preventDefault();
                    closeChannelEditorRoute();
                  }}
                >
                  Channels
                </Anchor>
                <Text size="sm" c="dimmed">
                  {channelDraft.id.trim() || "New Channel"}
                </Text>
              </Breadcrumbs>
              <Title order={5}>
                {channelDraft.title.trim() || channelDraft.id.trim() || "New Channel"}
              </Title>
            </Stack>
            <Group gap="xs">
              <Button variant="light" onClick={closeChannelEditorRoute}>
                Back
              </Button>
              <Button
                onClick={async () => {
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
                }}
              >
                Save Channel
              </Button>
            </Group>
          </Group>

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
            <ScrollArea h={320}>
              <Stack gap="xs">
                {channelDraft.blockIds.map((blockId, index) => {
                  const blockPickerItem = pickerByKind.block.get(blockId);
                  const block = draftStore.blocks.find((row) => row.id === blockId);
                  const label =
                    blockPickerItem?.title ||
                    blockOptions.find((row) => row.value === blockId)?.label ||
                    blockId;
                  const subtitle = `${block?.items.length || 0} items`;
                  return (
                    <div key={`${blockId}-${index}`} className="ops-playlist-item-wrap">
                      {channelDragIndex !== null && channelDropIndex === index ? (
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
                          const rect = event.currentTarget.getBoundingClientRect();
                          const midpoint = rect.top + rect.height / 2;
                          const nextIndex = event.clientY < midpoint ? index : index + 1;
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
                      commitChannelDrop(channelDropIndex ?? channelDraft.blockIds.length);
                    }}
                  >
                    {channelDropIndex === channelDraft.blockIds.length ? (
                      <div className="ops-playlist-drop-indicator is-tail" />
                    ) : (
                      <div className="ops-playlist-drop-tail-placeholder">Drop at end</div>
                    )}
                  </div>
                ) : null}
                {channelDraft.blockIds.length === 0 ? (
                  <Text size="sm" c="dimmed">
                    No block items yet. Add blocks to build this channel sequence.
                  </Text>
                ) : null}
              </Stack>
            </ScrollArea>
          </Paper>
        </Stack>
      ) : null}

      {builderTab === "profile" ? (
        <Stack gap="md">
          <Group justify="space-between" align="center" wrap="wrap">
            <Group gap="xs" wrap="wrap">
              <Button
                size="xs"
                variant="light"
                onClick={() => openProfileEditorRoute()}
              >
                New Profile
              </Button>
              <SegmentedControl
                value={profileLibraryView}
                onChange={(value) =>
                  setProfileLibraryView((value as "cards" | "table") || "cards")
                }
                data={[
                  { value: "cards", label: "Card View" },
                  { value: "table", label: "List View" },
                ]}
              />
            </Group>
            <Badge variant="light">{draftStore.profiles.length} profiles</Badge>
          </Group>

          {profileLibraryView === "cards" ? (
            <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }} spacing="sm">
              {draftStore.profiles.map((row) => (
                <Card
                  key={row.id}
                  withBorder
                  p="sm"
                  className="ops-resource-card"
                  onClick={() => openProfileEditorRoute(row.id)}
                >
                  <Stack gap="xs">
                    <Group justify="space-between" align="flex-start" wrap="nowrap">
                      <Stack gap={2}>
                        <Text fw={700} lineClamp={1}>
                          {row.title || row.id || "Untitled profile"}
                        </Text>
                      </Stack>
                      <Group gap={6}>
                        <ActionIcon
                          color="blue"
                          variant="light"
                          size="sm"
                          onClick={(event) => {
                            event.stopPropagation();
                            openProfileEditorRoute(row.id);
                          }}
                          title="Open profile editor"
                        >
                          <IconPencil size={14} />
                        </ActionIcon>
                        <ActionIcon
                          color="red"
                          variant="light"
                          size="sm"
                          onClick={async (event) => {
                            event.stopPropagation();
                            await deleteProfileResource(row.id);
                          }}
                          title="Delete profile"
                        >
                          <IconTrash size={14} />
                        </ActionIcon>
                      </Group>
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
                  </Stack>
                </Card>
              ))}
            </SimpleGrid>
          ) : (
            <Card withBorder p="sm">
              <ScrollArea h={560}>
                <Table striped highlightOnHover withTableBorder withColumnBorders>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Title</Table.Th>
                      <Table.Th>Default target</Table.Th>
                      <Table.Th>Nodes</Table.Th>
                      <Table.Th w={96}>Actions</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {profileRowsPage.map((row) => (
                      <Table.Tr
                        key={row.id}
                        onClick={() => openProfileEditorRoute(row.id)}
                        style={tableRowStyle(selectedProfileId === row.id)}
                      >
                        <Table.Td>{row.title || "untitled"}</Table.Td>
                        <Table.Td>
                          <Text size="sm" c="dimmed">
                            {row.defaultTargetKind}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          {
                            row.nodeAssignments.filter(
                              (node) => node.targetId.trim().length > 0
                            ).length
                          }
                        </Table.Td>
                        <Table.Td>
                          <Group gap={6}>
                            <ActionIcon
                              color="blue"
                              variant="light"
                              onClick={(event) => {
                                event.stopPropagation();
                                openProfileEditorRoute(row.id);
                              }}
                              title="Open profile editor"
                            >
                              <IconPencil size={14} />
                            </ActionIcon>
                            <ActionIcon
                              color="red"
                              variant="light"
                              onClick={async (event) => {
                                event.stopPropagation();
                                await deleteProfileResource(row.id);
                              }}
                              title="Delete profile"
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
                    draftStore.profiles.length,
                    profileTablePage,
                    TABLE_PAGE_SIZE.profiles
                  )}
                </Text>
                <Pagination
                  total={profileTablePageCount}
                  value={profileTablePage}
                  onChange={setProfileTablePage}
                  size={isMobile ? "sm" : "md"}
                  siblings={1}
                  boundaries={1}
                  withEdges
                />
              </Group>
            </Card>
          )}

          {draftStore.profiles.length === 0 ? (
            <Paper withBorder p="md">
              <Text size="sm" c="dimmed">
                No profiles yet. Profiles assign default and per-node targets.
              </Text>
            </Paper>
          ) : null}
        </Stack>
      ) : null}

      {builderTab === "profileEditor" ? (
        <Stack gap="md">
          <Group justify="space-between" align="center" wrap="wrap">
            <Stack gap={4}>
              <Breadcrumbs separator="/" separatorMargin="xs">
                <Anchor
                  size="sm"
                  href="#"
                  onClick={(event) => {
                    event.preventDefault();
                    closeProfileEditorRoute();
                  }}
                >
                  Media Library
                </Anchor>
                <Anchor
                  size="sm"
                  href="#"
                  onClick={(event) => {
                    event.preventDefault();
                    closeProfileEditorRoute();
                  }}
                >
                  Profiles
                </Anchor>
                <Text size="sm" c="dimmed">
                  {profileDraft.id.trim() || "New Profile"}
                </Text>
              </Breadcrumbs>
              <Title order={5}>
                {profileDraft.title.trim() || profileDraft.id.trim() || "New Profile"}
              </Title>
            </Stack>
            <Group gap="xs">
              <Button variant="light" onClick={closeProfileEditorRoute}>
                Back
              </Button>
              <Button
                onClick={async () => {
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
                }}
              >
                Save Profile
              </Button>
            </Group>
          </Group>

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
                  setProfileDraft((current) => ({ ...current, defaultTargetId: targetId }));
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
                    disabled={!profileDraft.defaultTargetId.trim() || registryNodes.length === 0}
                    onClick={() => {
                      const defaultTargetId = profileDraft.defaultTargetId.trim();
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

              <ScrollArea h={420}>
                <Stack gap="sm">
                  {registryNodes.map((node) => {
                    const assigned = profileDraft.nodeAssignments.find(
                      (row) => row.nodeId === node.nodeId
                    );
                    const kind = assigned?.targetKind || profileDraft.defaultTargetKind;
                    const targetId = assigned?.targetId || "";
                    return (
                      <Paper key={node.nodeId} withBorder p="sm">
                        <Stack gap="xs">
                          <Group justify="space-between" align="center" wrap="wrap">
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
                                  const defaultTargetId = profileDraft.defaultTargetId.trim();
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
                                    nodeAssignments: current.nodeAssignments.filter(
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
                      No nodes are registered yet. Add nodes in Fleet to assign profile targets.
                    </Text>
                  ) : null}
                </Stack>
              </ScrollArea>
            </Stack>
          </Paper>
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
