import type { Dispatch, SetStateAction } from "react";
import {
  Button,
  Group,
  Image,
  Paper,
  ScrollArea,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { OpsFormDock, OpsPageHeader } from "../ui/OpsSurface";
import type { Media } from "../../lib/controlApi";
import {
  generateAutoResourceId,
  type DraftPlaylist,
} from "../../lib/opsModel";
import { ReorderableSequenceItem } from "./ReorderableSequenceItem";

export type PlaylistEditorViewVm = {
  isMobile: boolean;
  playlistDraft: DraftPlaylist;
  setPlaylistDraft: Dispatch<SetStateAction<DraftPlaylist>>;
  closePlaylistEditorRoute: () => void;
  setMediaPickerOpen: (open: boolean) => void;
  savePlaylistDraftToControlDb: (playlist: DraftPlaylist) => Promise<boolean>;
  setSelectedPlaylistId: (id: string | null) => void;
  existingPlaylistIds: string[];
  mergedMedia: Media[];
  playlistDragIndex: number | null;
  setPlaylistDragIndex: (index: number | null) => void;
  playlistDropIndex: number | null;
  setPlaylistDropIndex: Dispatch<SetStateAction<number | null>>;
  commitPlaylistDrop: (targetIndex: number) => void;
};

export function PlaylistEditorView({ vm }: { vm: PlaylistEditorViewVm }) {
  const {
    isMobile,
    playlistDraft,
    setPlaylistDraft,
    closePlaylistEditorRoute,
    setMediaPickerOpen,
    savePlaylistDraftToControlDb,
    setSelectedPlaylistId,
    existingPlaylistIds,
    mergedMedia,
    playlistDragIndex,
    setPlaylistDragIndex,
    playlistDropIndex,
    setPlaylistDropIndex,
    commitPlaylistDrop,
  } = vm;

  const playlistTitle =
    playlistDraft.title.trim() || playlistDraft.id.trim() || "New Playlist";
  const libraryLabel = isMobile ? "Library" : "Media Library";

  const savePlaylist = async () => {
    const playlistId =
      playlistDraft.id.trim() ||
      generateAutoResourceId(
        "playlist",
        playlistDraft.title || "playlist",
        existingPlaylistIds
      );
    const synced = await savePlaylistDraftToControlDb({
      ...playlistDraft,
      id: playlistId,
    });
    if (!synced) return;
    setSelectedPlaylistId(playlistId);
    closePlaylistEditorRoute();
    notifications.show({
      color: "teal",
      title: "Playlist saved",
      message: playlistId,
    });
  };

  return (
    <Stack gap="md">
      <OpsPageHeader
        compact
        title={playlistTitle}
        description="Build playlist order and the metadata shown in overlays."
        breadcrumbs={[
          {
            label: libraryLabel,
            onClick: closePlaylistEditorRoute,
          },
          {
            label: "Playlists",
            onClick: closePlaylistEditorRoute,
          },
          {
            label: playlistDraft.id.trim() || "New Playlist",
          },
        ]}
        actions={
          <Button variant="light" onClick={closePlaylistEditorRoute}>
            Back
          </Button>
        }
      />

      <SimpleGrid cols={{ base: 1, md: 2 }}>
        <TextInput
          label="Title"
          value={playlistDraft.title}
          onChange={(e) => {
            const value = e.currentTarget.value;
            setPlaylistDraft((draft) => ({ ...draft, title: value }));
          }}
        />
        <TextInput
          label="Artist"
          value={playlistDraft.artist}
          onChange={(e) => {
            const value = e.currentTarget.value;
            setPlaylistDraft((draft) => ({ ...draft, artist: value }));
          }}
        />
        <TextInput
          label="Description"
          value={playlistDraft.description}
          onChange={(e) => {
            const value = e.currentTarget.value;
            setPlaylistDraft((draft) => ({
              ...draft,
              description: value,
            }));
          }}
        />
      </SimpleGrid>

      <Paper withBorder p="sm">
        <Group justify="space-between" align="center" mb="xs" wrap="wrap">
          <Stack gap={2}>
            <Text fw={700}>Items ({playlistDraft.mediaIds.length})</Text>
            <Text size="xs" c="dimmed">
              {playlistDraft.mediaIds.length > 0
                ? "Drag to reorder"
                : "Choose media to start building the playlist"}
            </Text>
          </Stack>
          <Button
            size="xs"
            variant="light"
            onClick={() => setMediaPickerOpen(true)}
          >
            Add Media
          </Button>
        </Group>
        <ScrollArea
          h={
            isMobile
              ? "max(260px, calc(100dvh - 520px))"
              : "max(320px, calc(100dvh - 460px))"
          }
        >
          <Stack gap="xs">
            {playlistDraft.mediaIds.length === 0 ? (
              <Paper
                withBorder
                p="xl"
                radius="md"
                className="ops-playlist-empty-state"
                role="button"
                tabIndex={0}
                onClick={() => setMediaPickerOpen(true)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setMediaPickerOpen(true);
                  }
                }}
              >
                <Stack gap={6} align="center">
                  <Text fw={700}>Click to add items</Text>
                  <Text size="sm" c="dimmed">
                    Open the media selector and choose one or more items for
                    this playlist.
                  </Text>
                </Stack>
              </Paper>
            ) : null}
            {playlistDraft.mediaIds.map((id, index) => {
              const media = mergedMedia.find((row) => row.id === id);
              return (
                <div
                  key={`${id}-${index}`}
                  className="ops-playlist-item-wrap"
                >
                  {playlistDragIndex !== null &&
                  playlistDropIndex === index ? (
                    <div className="ops-playlist-drop-indicator" />
                  ) : null}
                  <ReorderableSequenceItem
                    index={index}
                    title={media?.title || id}
                    subtitle={media?.artist || "unknown artist"}
                    preview={
                      media?.thumbnailUrl ? (
                        <Image
                          src={media.thumbnailUrl}
                          alt={media.title || id}
                          radius="sm"
                          w={88}
                          h={52}
                          fit="cover"
                        />
                      ) : undefined
                    }
                    onRemove={() =>
                      setPlaylistDraft((draft) => ({
                        ...draft,
                        mediaIds: draft.mediaIds.filter((_, i) => i !== index),
                      }))
                    }
                    onDragStart={() => {
                      setPlaylistDragIndex(index);
                      setPlaylistDropIndex(index);
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      if (playlistDragIndex === null) return;
                      const rect = event.currentTarget.getBoundingClientRect();
                      const midpoint = rect.top + rect.height / 2;
                      const nextDropIndex =
                        event.clientY < midpoint ? index : index + 1;
                      setPlaylistDropIndex((prev) =>
                        prev === nextDropIndex ? prev : nextDropIndex
                      );
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      commitPlaylistDrop(playlistDropIndex ?? index);
                    }}
                    onDragEnd={() => {
                      setPlaylistDragIndex(null);
                      setPlaylistDropIndex(null);
                    }}
                  />
                </div>
              );
            })}
            {playlistDragIndex !== null ? (
              <div
                className="ops-playlist-drop-tail is-active"
                onDragOver={(event) => {
                  event.preventDefault();
                  setPlaylistDropIndex((prev) =>
                    prev === playlistDraft.mediaIds.length
                      ? prev
                      : playlistDraft.mediaIds.length
                  );
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  commitPlaylistDrop(
                    playlistDropIndex ?? playlistDraft.mediaIds.length
                  );
                }}
              >
                {playlistDropIndex === playlistDraft.mediaIds.length ? (
                  <div className="ops-playlist-drop-indicator is-tail" />
                ) : (
                  <div className="ops-playlist-drop-tail-placeholder">
                    Drop at end
                  </div>
                )}
              </div>
            ) : null}
          </Stack>
        </ScrollArea>
      </Paper>

      <OpsFormDock
        secondaryLabel="Back"
        onSecondary={closePlaylistEditorRoute}
        primaryLabel="Save Playlist"
        onPrimary={() => {
          void savePlaylist();
        }}
        aside={
          <Text size="xs" c="dimmed">
            {playlistDraft.mediaIds.length} item(s)
          </Text>
        }
      />
    </Stack>
  );
}
