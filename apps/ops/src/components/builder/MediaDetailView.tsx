import { useEffect, useMemo, useState } from "react";
import {
  Accordion,
  Button,
  Card,
  Code,
  Group,
  Image,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconBroadcast } from "@tabler/icons-react";
import { DetailBreadcrumbs } from "../DetailBreadcrumbs";
import type { Media } from "../../lib/controlApi";
import type { BuilderMode } from "../../store/uiStore";
import type { QuickSendTarget } from "../../lib/opsModel";
import { WebLaunchArgsEditor } from "./WebLaunchArgsEditor";
import {
  buildWebLaunchConfigFromEntries,
  webLaunchArgEntriesFromWebConfig,
  webLaunchConfigSignature,
  type WebLaunchArgEntry,
} from "../../lib/webLaunchArgs";

export type MediaDetailViewVm = {
  isMobile: boolean;
  setBuilderTab: (tab: BuilderMode) => void;
  setMediaLibrarySection: (
    section: "media" | "playlists" | "blocks" | "channels" | "profiles"
  ) => void;
  selectedMediaDetail: Media | null;
  selectedMediaDetailPreviewSrc: string | null;
  selectedMediaDetailIsVideo: boolean;
  openQuickSend: (target: QuickSendTarget) => void;
  mediaDeleteBusy: boolean;
  deleteMediaItem: (mediaId: string) => Promise<void>;
  mediaSaveBusy: boolean;
  saveMediaMetadata: (args: {
    id: string;
    title?: string;
    artist?: string;
    description?: string;
    web?: Media["web"];
  }) => Promise<void>;
};

export function MediaDetailView({ vm }: { vm: MediaDetailViewVm }) {
  const {
    isMobile,
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
  } = vm;

  const [titleDraft, setTitleDraft] = useState("");
  const [artistDraft, setArtistDraft] = useState("");
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [webLaunchProfileDraft, setWebLaunchProfileDraft] = useState<
    "none" | "home_assistant_login"
  >("none");
  const [webAppControlsApiDraft, setWebAppControlsApiDraft] = useState("");
  const [webLaunchArgsEntriesDraft, setWebLaunchArgsEntriesDraft] = useState<
    WebLaunchArgEntry[]
  >([]);
  const [webInitialSignature, setWebInitialSignature] = useState("");

  useEffect(() => {
    setTitleDraft(selectedMediaDetail?.title || "");
    setArtistDraft(selectedMediaDetail?.artist || "");
    setDescriptionDraft(selectedMediaDetail?.description || "");
    const web = selectedMediaDetail?.web;
    setWebLaunchProfileDraft(
      web?.launchProfile === "home_assistant_login"
        ? "home_assistant_login"
        : "none"
    );
    setWebAppControlsApiDraft(web?.appControlsApi || "");
    setWebLaunchArgsEntriesDraft(webLaunchArgEntriesFromWebConfig(web));
    setWebInitialSignature(webLaunchConfigSignature(web));
  }, [selectedMediaDetail]);

  const parsedWebDraft = useMemo(
    () =>
      buildWebLaunchConfigFromEntries({
        entries: webLaunchArgsEntriesDraft,
        launchProfile: webLaunchProfileDraft,
        appControlsApi: webAppControlsApiDraft,
      }),
    [webAppControlsApiDraft, webLaunchArgsEntriesDraft, webLaunchProfileDraft]
  );
  const webDraftSignature = useMemo(
    () => webLaunchConfigSignature(parsedWebDraft.config),
    [parsedWebDraft.config]
  );

  const hasUnsavedChanges = useMemo(() => {
    if (!selectedMediaDetail) return false;
    return (
      titleDraft.trim() !== (selectedMediaDetail.title || "") ||
      artistDraft.trim() !== (selectedMediaDetail.artist || "") ||
      descriptionDraft.trim() !== (selectedMediaDetail.description || "") ||
      (selectedMediaDetail.sourceType === "url" &&
        webDraftSignature !== webInitialSignature)
    );
  }, [
    artistDraft,
    descriptionDraft,
    selectedMediaDetail,
    titleDraft,
    webDraftSignature,
    webInitialSignature,
  ]);

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center" wrap="wrap">
        <Stack gap={4}>
          <DetailBreadcrumbs
            items={[
              {
                label: "Media Library",
                onClick: () => {
                  setMediaLibrarySection("media");
                  setBuilderTab("media");
                },
              },
              { label: selectedMediaDetail?.title || selectedMediaDetail?.id || "Media Detail" },
            ]}
          />
          <Title order={5}>Media Detail</Title>
        </Stack>
        {selectedMediaDetail ? (
          <Group gap="xs">
            <Button
              color="cyan"
              variant="light"
              leftSection={<IconBroadcast size={14} />}
              onClick={() =>
                openQuickSend({
                  kind: "media",
                  id: selectedMediaDetail.id,
                  label: selectedMediaDetail.title || selectedMediaDetail.id,
                })
              }
            >
              Send To Node
            </Button>
            <Button
              variant="light"
              loading={mediaSaveBusy}
              disabled={!hasUnsavedChanges || Boolean(parsedWebDraft.error)}
              onClick={() => {
                let parsedWeb: Media["web"] | undefined = selectedMediaDetail.web;
                if (selectedMediaDetail.sourceType === "url") {
                  if (parsedWebDraft.error) {
                    notifications.show({
                      color: "red",
                      title: "Invalid web config",
                      message: parsedWebDraft.error,
                    });
                    return;
                  }
                  parsedWeb = parsedWebDraft.config;
                }
                void saveMediaMetadata({
                  id: selectedMediaDetail.id,
                  title: titleDraft,
                  artist: artistDraft,
                  description: descriptionDraft,
                  web: parsedWeb,
                }).catch((error) => {
                  notifications.show({
                    color: "red",
                    title: "Save media failed",
                    message: error instanceof Error ? error.message : String(error),
                  });
                });
              }}
            >
              Save Changes
            </Button>
            <Button
              color="red"
              variant="light"
              loading={mediaDeleteBusy}
              onClick={() => void deleteMediaItem(selectedMediaDetail.id)}
            >
              Delete Media
            </Button>
          </Group>
        ) : null}
      </Group>
      {selectedMediaDetail ? (
        <Card withBorder p="md">
          <Stack>
            {selectedMediaDetailPreviewSrc && selectedMediaDetailIsVideo ? (
              <video
                className="ops-media-detail-video"
                controls
                muted
                loop
                playsInline
                preload="metadata"
                poster={selectedMediaDetail.thumbnailUrl}
                src={selectedMediaDetailPreviewSrc}
              />
            ) : selectedMediaDetailPreviewSrc ? (
              <Image
                src={selectedMediaDetailPreviewSrc}
                alt={selectedMediaDetail.title || selectedMediaDetail.id}
                radius="sm"
                h={isMobile ? 240 : 520}
                fit="cover"
              />
            ) : selectedMediaDetail.thumbnailUrl ? (
              <Image
                src={selectedMediaDetail.thumbnailUrl}
                alt={selectedMediaDetail.title || selectedMediaDetail.id}
                radius="sm"
                h={isMobile ? 240 : 520}
                fit="cover"
              />
            ) : null}
            <SimpleGrid cols={{ base: 1, md: 2 }}>
              <TextInput label="ID" value={selectedMediaDetail.id} readOnly />
              <TextInput label="Type" value={selectedMediaDetail.sourceType} readOnly />
              <TextInput
                label="Title"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.currentTarget.value)}
              />
              <TextInput
                label="Artist"
                value={artistDraft}
                onChange={(e) => setArtistDraft(e.currentTarget.value)}
              />
            </SimpleGrid>
            <Textarea
              label="Description"
              autosize
              minRows={3}
              maxRows={8}
              value={descriptionDraft}
              onChange={(e) => setDescriptionDraft(e.currentTarget.value)}
            />
            <Accordion multiple defaultValue={[]}>
              {selectedMediaDetail.sourceType === "url" ? (
                <Accordion.Item value="web-config">
                  <Accordion.Control>Web Launch Config</Accordion.Control>
                  <Accordion.Panel>
                    <Stack gap="sm">
                      <Text size="sm" c="dimmed">
                        URL media can define launch args and optional custom launch
                        logic.
                      </Text>
                      <Select
                        label="Custom launch logic"
                        value={webLaunchProfileDraft}
                        data={[
                          { value: "none", label: "None" },
                          {
                            value: "home_assistant_login",
                            label: "Home Assistant login",
                          },
                        ]}
                        onChange={(value) =>
                          setWebLaunchProfileDraft(
                            value === "home_assistant_login"
                              ? "home_assistant_login"
                              : "none"
                          )
                        }
                      />
                      <TextInput
                        label="App controls API endpoint"
                        placeholder="https://example.com/api/app-controls?appId=bnw-slop"
                        value={webAppControlsApiDraft}
                        onChange={(event) =>
                          setWebAppControlsApiDraft(event.currentTarget.value)
                        }
                        description="Optional JSON endpoint for remote app controls. Returns { controls: [...] }."
                      />
                      <WebLaunchArgsEditor
                        entries={webLaunchArgsEntriesDraft}
                        onChange={setWebLaunchArgsEntriesDraft}
                        error={parsedWebDraft.error}
                      />
                    </Stack>
                  </Accordion.Panel>
                </Accordion.Item>
              ) : null}
              <Accordion.Item value="source">
                <Accordion.Control>Advanced Source</Accordion.Control>
                <Accordion.Panel>
                  <Stack gap="sm">
                    <Text size="sm" c="dimmed">
                      Source path/url is immutable for this media record.
                    </Text>
                    <Code block>{selectedMediaDetail.sourceValue}</Code>
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>
              <Accordion.Item value="raw-json">
                <Accordion.Control>Raw JSON</Accordion.Control>
                <Accordion.Panel>
                  <Code block>{JSON.stringify(selectedMediaDetail, null, 2)}</Code>
                </Accordion.Panel>
              </Accordion.Item>
            </Accordion>
          </Stack>
        </Card>
      ) : (
        <Paper withBorder p="md">
          <Text size="sm" c="dimmed">
            Media item not found.
          </Text>
        </Paper>
      )}
    </Stack>
  );
}
