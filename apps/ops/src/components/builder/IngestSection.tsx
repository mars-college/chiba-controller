import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Checkbox,
  Divider,
  Group,
  Image,
  Loader,
  Paper,
  Progress,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useMemo } from "react";
import {
  IconPhotoPlus,
  IconStack2,
  IconTrash,
  IconUpload,
  IconWorldWww,
} from "@tabler/icons-react";
import type { Media, MediaIngestJob } from "../../lib/controlApi";
import {
  formatBytes,
  type IngestSource,
  type UploadPreviewItem,
} from "../../lib/opsModel";
import { WebLaunchArgsEditor } from "./WebLaunchArgsEditor";
import type { WebLaunchArgEntry } from "../../lib/webLaunchArgs";

export type IngestSectionVm = {
  ingestStep: 1 | 2 | 3;
  activeIngestJobs: MediaIngestJob[];
  runningIngestCount: number;
  ingestSource: IngestSource;
  setIngestSource: (source: IngestSource) => void;
  setIngestStep: (step: 1 | 2 | 3) => void;
  selectedIngestLabel: string;
  youtubeUrl: string;
  setYoutubeUrl: (value: string) => void;
  youtubeTitle: string;
  setYoutubeTitle: (value: string) => void;
  youtubeArtist: string;
  setYoutubeArtist: (value: string) => void;
  youtubeDescription: string;
  setYoutubeDescription: (value: string) => void;
  webUrl: string;
  setWebUrl: (value: string) => void;
  webTitle: string;
  setWebTitle: (value: string) => void;
  webArtist: string;
  setWebArtist: (value: string) => void;
  webDescription: string;
  setWebDescription: (value: string) => void;
  webCache: boolean;
  setWebCache: (value: boolean) => void;
  webLaunchProfile: "none" | "home_assistant_login";
  setWebLaunchProfile: (value: "none" | "home_assistant_login") => void;
  webLaunchArgsEntries: WebLaunchArgEntry[];
  setWebLaunchArgsEntries: (value: WebLaunchArgEntry[]) => void;
  webLaunchConfig: Media["web"] | undefined;
  webLaunchArgsError: string | null;
  edenInput: string;
  setEdenInput: (value: string) => void;
  edenCreatePlaylist: boolean;
  setEdenCreatePlaylist: (value: boolean) => void;
  edenArtist: string;
  setEdenArtist: (value: string) => void;
  edenDescription: string;
  setEdenDescription: (value: string) => void;
  getUploadRootProps: () => any;
  getUploadInputProps: () => any;
  isUploadDragActive: boolean;
  uploadFiles: File[];
  uploadTitleOverrides: string[];
  setUploadTitleOverrideAtIndex: (index: number, value: string) => void;
  setUploadTitleForAll: (value: string) => void;
  uploadArtistOverrides: string[];
  setUploadArtistOverrideAtIndex: (index: number, value: string) => void;
  uploadDescriptionOverrides: string[];
  setUploadDescriptionOverrideAtIndex: (index: number, value: string) => void;
  uploadArtist: string;
  setUploadArtist: (value: string) => void;
  uploadDescription: string;
  setUploadDescription: (value: string) => void;
  uploadCreatePlaylist: boolean;
  setUploadCreatePlaylist: (value: boolean) => void;
  uploadPlaylistTitle: string;
  setUploadPlaylistTitle: (value: string) => void;
  uploadPreviewItems: UploadPreviewItem[];
  removeUploadFileAtIndex: (index: number) => void;
  uploadDropError: string | null;
  canQueueIngest: boolean;
  ingestBusy: boolean;
  runYouTubeIngest: () => Promise<void>;
  runEdenIngest: () => Promise<void>;
  runWebIngest: () => Promise<void>;
  runUploadIngest: () => Promise<void>;
};

export function IngestSection({ vm }: { vm: IngestSectionVm }) {
  const {
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
    webLaunchArgsError,
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
  } = vm;

  const uploadTitleForAllValue = useMemo(() => {
    if (uploadPreviewItems.length === 0) return "";
    const titles = uploadPreviewItems.map(
      (_, index) => uploadTitleOverrides[index] ?? ""
    );
    const first = titles[0] ?? "";
    return titles.every((title) => title === first) ? first : "";
  }, [uploadPreviewItems, uploadTitleOverrides]);

  const runFinalQueueAction = () => {
    if (ingestSource === "youtube") {
      void runYouTubeIngest();
      return;
    }
    if (ingestSource === "eden") {
      void runEdenIngest();
      return;
    }
    if (ingestSource === "web") {
      void runWebIngest();
      return;
    }
    void runUploadIngest();
  };
  const ingestStepHint =
    ingestStep === 2
      ? canQueueIngest
        ? "Step 2 of 3 • ready for review"
        : ingestSource === "upload"
        ? `Step 2 of 3 • add files to continue (${uploadFiles.length}/20)`
        : ingestSource === "youtube"
        ? "Step 2 of 3 • paste a YouTube URL to continue"
        : ingestSource === "web"
        ? "Step 2 of 3 • enter a web URL to continue"
        : "Step 2 of 3 • enter a collection URL or ID to continue"
      : "Step 3 of 3 • review metadata, then queue ingest";

  return (
    <Stack gap="lg" className="ops-ingest-layout">
      <Group justify="flex-end" align="center" wrap="wrap">
        <Group gap="xs">
          {activeIngestJobs.length > 0 ? (
            <Group gap={6}>
              <Loader size={14} />
              <Text size="xs" c="dimmed">
                {runningIngestCount} running • {activeIngestJobs.length} active
              </Text>
            </Group>
          ) : null}
        </Group>
      </Group>

      <Progress value={ingestStep === 1 ? 33 : ingestStep === 2 ? 66 : 100} />

      {ingestStep > 1 ? (
        <Group
          justify="space-between"
          align="center"
          wrap="wrap"
          className="ops-content-sticky-header ops-ingest-step-nav"
        >
          <Text size="xs" c="dimmed">
            {ingestStepHint}
          </Text>
          <Group gap="xs" wrap="nowrap">
            <Button
              size="xs"
              variant="light"
              onClick={() => setIngestStep(ingestStep === 2 ? 1 : 2)}
              disabled={ingestBusy}
            >
              Back
            </Button>
            {ingestStep === 2 ? (
              <Button size="xs" onClick={() => setIngestStep(3)} disabled={!canQueueIngest}>
                Review Queue
              </Button>
            ) : (
              <Button
                size="xs"
                loading={ingestBusy}
                disabled={!canQueueIngest}
                onClick={runFinalQueueAction}
              >
                {ingestSource === "web"
                  ? "Create Media Record"
                  : "Queue Ingest Job"}
              </Button>
            )}
          </Group>
        </Group>
      ) : null}

      {ingestStep === 1 ? (
        <Stack gap="md">
          <Text fw={700} size="sm">
            Online Sources
          </Text>
          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
            <Card
              withBorder
              p="lg"
              className={`ops-ingest-source-card${
                ingestSource === "youtube" ? " is-selected" : ""
              }`}
              onClick={() => {
                setIngestSource("youtube");
                setIngestStep(2);
              }}
            >
              <Group gap={8}>
                <IconUpload size={18} />
                <Text fw={700}>YouTube</Text>
              </Group>
            </Card>
            <Card
              withBorder
              p="lg"
              className={`ops-ingest-source-card${
                ingestSource === "eden" ? " is-selected" : ""
              }`}
              onClick={() => {
                setIngestSource("eden");
                setIngestStep(2);
              }}
            >
              <Group gap={8}>
                <IconStack2 size={18} />
                <Text fw={700}>Eden Collection</Text>
              </Group>
            </Card>
            <Card
              withBorder
              p="lg"
              className={`ops-ingest-source-card${
                ingestSource === "web" ? " is-selected" : ""
              }`}
              onClick={() => {
                setIngestSource("web");
                setIngestStep(2);
              }}
            >
              <Group gap={8}>
                <IconWorldWww size={18} />
                <Text fw={700}>Web Link</Text>
              </Group>
            </Card>
          </SimpleGrid>

          <Divider />

          <Text fw={700} size="sm">
            Local Assets
          </Text>
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
            <Card
              withBorder
              p="lg"
              className={`ops-ingest-source-card${
                ingestSource === "upload" ? " is-selected" : ""
              }`}
              onClick={() => {
                setIngestSource("upload");
                setIngestStep(2);
              }}
            >
              <Group gap={8}>
                <IconPhotoPlus size={18} />
                <Text fw={700}>Files / Zip Upload</Text>
              </Group>
            </Card>
          </SimpleGrid>
        </Stack>
      ) : null}

      {ingestStep === 2 ? (
        <Card withBorder p="md" className="ops-ingest-step-card">
          <Stack>
            {ingestSource === "youtube" ? (
              <Stack>
                <TextInput
                  label="YouTube URL"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.currentTarget.value)}
                />
              </Stack>
            ) : null}
            {ingestSource === "web" ? (
              <Stack>
                <TextInput
                  label="Web URL"
                  placeholder="https://example.com/media.mp4"
                  value={webUrl}
                  onChange={(e) => setWebUrl(e.currentTarget.value)}
                />
                <Button
                  variant={webCache ? "filled" : "light"}
                  onClick={() => setWebCache(!webCache)}
                  style={{ alignSelf: "flex-start" }}
                >
                  {webCache
                    ? "Cache enabled on nodes"
                    : "Cache disabled on nodes"}
                </Button>
                <SimpleGrid cols={{ base: 1, sm: 2 }}>
                  <Select
                    label="Custom launch logic"
                    value={webLaunchProfile}
                    data={[
                      { value: "none", label: "None" },
                      {
                        value: "home_assistant_login",
                        label: "Home Assistant login",
                      },
                    ]}
                    onChange={(value) =>
                      setWebLaunchProfile(
                        value === "home_assistant_login"
                          ? "home_assistant_login"
                          : "none"
                      )
                    }
                  />
                </SimpleGrid>
                <WebLaunchArgsEditor
                  entries={webLaunchArgsEntries}
                  onChange={setWebLaunchArgsEntries}
                  error={webLaunchArgsError}
                />
              </Stack>
            ) : null}
            {ingestSource === "eden" ? (
              <Stack>
                <TextInput
                  label="Collection URL or ID"
                  placeholder="https://app.eden.art/collections/... or 6980..."
                  value={edenInput}
                  onChange={(e) => setEdenInput(e.currentTarget.value)}
                />
              </Stack>
            ) : null}
            {ingestSource === "upload" ? (
              <Stack>
                <Paper
                  withBorder
                  p="md"
                  radius="md"
                  {...getUploadRootProps()}
                  style={{
                    cursor: "pointer",
                    borderStyle: "dashed",
                    borderColor: isUploadDragActive
                      ? "rgba(95, 169, 255, 0.95)"
                      : undefined,
                  }}
                >
                  <input {...getUploadInputProps()} />
                  <Stack gap={6}>
                    <Text fw={600}>
                      {isUploadDragActive
                        ? "Drop files here"
                        : "Drag & drop files or zip here, or click to browse"}
                    </Text>
                    <Text size="xs" c="dimmed">
                      Up to 20 media files, or one zip archive. Total limit:
                      2GB.
                    </Text>
                  </Stack>
                </Paper>
                <Text size="xs" c="dimmed">
                  Selected: {uploadFiles.length} file(s)
                </Text>
                {uploadFiles.length > 0 ? (
                  <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm">
                    {uploadPreviewItems.map((item, itemIndex) => (
                      <Card
                        key={`${item.file.name}-${item.file.size}-${item.file.lastModified}`}
                        withBorder
                        p="xs"
                        className="ops-upload-preview-card"
                      >
                        <Stack gap={8}>
                          <Group
                            justify="space-between"
                            align="flex-start"
                            wrap="nowrap"
                          >
                            <Badge size="sm" variant="light">
                              {item.kind === "image"
                                ? "IMAGE"
                                : item.kind === "video"
                                ? "VIDEO"
                                : item.kind === "audio"
                                ? "AUDIO"
                                : item.kind === "zip"
                                ? "ZIP"
                                : "FILE"}
                            </Badge>
                            <ActionIcon
                              color="red"
                              variant="light"
                              size="sm"
                              title="Remove from upload"
                              onClick={(event) => {
                                event.stopPropagation();
                                removeUploadFileAtIndex(itemIndex);
                              }}
                            >
                              <IconTrash size={14} />
                            </ActionIcon>
                          </Group>
                          {item.kind === "image" && item.url ? (
                            <Image
                              src={item.url}
                              alt={item.file.name}
                              radius="sm"
                              h={124}
                              fit="cover"
                            />
                          ) : null}
                          {item.kind === "video" && item.url ? (
                            <video
                              className="ops-upload-preview-video"
                              src={item.url}
                              muted
                              controls
                              preload="metadata"
                            />
                          ) : null}
                          {item.kind === "audio" && item.url ? (
                            <audio
                              src={item.url}
                              controls
                              preload="metadata"
                              style={{ width: "100%" }}
                            />
                          ) : null}
                          {item.kind === "zip" || item.kind === "file" ? (
                            <Paper
                              withBorder
                              p="md"
                              radius="sm"
                              className="ops-upload-preview-fallback"
                            >
                              <Stack gap={4}>
                                <Text size="xs" c="dimmed">
                                  No inline preview
                                </Text>
                              </Stack>
                            </Paper>
                          ) : null}
                          <Text size="sm" fw={600} lineClamp={1}>
                            {item.file.name}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {formatBytes(item.file.size)}
                          </Text>
                        </Stack>
                      </Card>
                    ))}
                  </SimpleGrid>
                ) : null}
                {uploadDropError ? (
                  <Text size="xs" c="red">
                    {uploadDropError}
                  </Text>
                ) : null}
              </Stack>
            ) : null}
          </Stack>
        </Card>
      ) : null}

      {ingestStep === 3 ? (
        <Card withBorder p="md" className="ops-ingest-step-card">
          <Stack gap="md">
            <Text fw={700}>Review & Queue</Text>
            {ingestSource === "upload" ? (
              <Stack gap="sm">
                <Card withBorder p="sm">
                  <Stack gap="sm">
                    <Text fw={700} size="sm">
                      Default Metadata
                    </Text>
                    <TextInput
                      label="Title for all items"
                      placeholder="Set once, then fine-tune per item below"
                      value={uploadTitleForAllValue}
                      onChange={(event) =>
                        setUploadTitleForAll(event.currentTarget.value)
                      }
                    />
                    <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
                      <TextInput
                        label="Artist"
                        placeholder="Applied to all items unless overridden"
                        value={uploadArtist}
                        onChange={(e) => setUploadArtist(e.currentTarget.value)}
                      />
                      <Textarea
                        label="Description"
                        placeholder="Applied to all items unless overridden"
                        autosize
                        minRows={2}
                        maxRows={4}
                        value={uploadDescription}
                        onChange={(e) =>
                          setUploadDescription(e.currentTarget.value)
                        }
                      />
                    </SimpleGrid>
                    {uploadFiles.length > 1 ? (
                      <Stack gap="xs">
                        <Checkbox
                          label="Create playlist from imported media"
                          checked={uploadCreatePlaylist}
                          onChange={(event) =>
                            setUploadCreatePlaylist(event.currentTarget.checked)
                          }
                        />
                        {uploadCreatePlaylist ? (
                          <TextInput
                            label="Playlist title (optional)"
                            placeholder="Uploaded Media"
                            value={uploadPlaylistTitle}
                            onChange={(e) =>
                              setUploadPlaylistTitle(e.currentTarget.value)
                            }
                          />
                        ) : null}
                      </Stack>
                    ) : null}
                  </Stack>
                </Card>

                <Group justify="space-between" align="center">
                  <Text fw={700} size="sm">
                    Items
                  </Text>
                  <Badge variant="light" color="blue">
                    {uploadFiles.length} file(s)
                  </Badge>
                </Group>

                <Stack gap="sm">
                  {uploadPreviewItems.map((item, itemIndex) => (
                    <Card
                      key={`review-${item.file.name}-${item.file.size}-${item.file.lastModified}-${itemIndex}`}
                      withBorder
                      p="sm"
                    >
                      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
                        <Paper withBorder p={0} radius="sm" h={140}>
                          {item.kind === "image" && item.url ? (
                            <Image
                              src={item.url}
                              alt={item.file.name}
                              radius="sm"
                              h={140}
                              fit="cover"
                            />
                          ) : item.kind === "video" && item.url ? (
                            <video
                              className="ops-upload-preview-video"
                              src={item.url}
                              muted
                              controls
                              preload="metadata"
                              style={{ height: 140 }}
                            />
                          ) : item.kind === "audio" && item.url ? (
                            <Stack
                              justify="center"
                              align="center"
                              h="100%"
                              p="md"
                            >
                              <audio
                                src={item.url}
                                controls
                                preload="metadata"
                                style={{ width: "100%" }}
                              />
                            </Stack>
                          ) : (
                            <Stack
                              justify="center"
                              align="center"
                              h="100%"
                              gap={2}
                            >
                              <Text size="xs" c="dimmed">
                                {item.kind.toUpperCase()}
                              </Text>
                            </Stack>
                          )}
                        </Paper>
                        <Stack gap="xs" style={{ minWidth: 0 }}>
                          <Group justify="space-between" align="center">
                            <Text size="sm" fw={700} lineClamp={1}>
                              {item.file.name}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {formatBytes(item.file.size)}
                            </Text>
                          </Group>
                          <TextInput
                            label="Title"
                            value={uploadTitleOverrides[itemIndex] ?? ""}
                            onChange={(event) =>
                              setUploadTitleOverrideAtIndex(
                                itemIndex,
                                event.currentTarget.value
                              )
                            }
                          />
                          <TextInput
                            label="Artist Override"
                            placeholder={uploadArtist || "None"}
                            value={uploadArtistOverrides[itemIndex] ?? ""}
                            onChange={(event) =>
                              setUploadArtistOverrideAtIndex(
                                itemIndex,
                                event.currentTarget.value
                              )
                            }
                          />
                          <Textarea
                            label="Description Override"
                            placeholder={uploadDescription || "None"}
                            autosize
                            minRows={2}
                            maxRows={4}
                            value={uploadDescriptionOverrides[itemIndex] ?? ""}
                            onChange={(event) =>
                              setUploadDescriptionOverrideAtIndex(
                                itemIndex,
                                event.currentTarget.value
                              )
                            }
                          />
                        </Stack>
                      </SimpleGrid>
                    </Card>
                  ))}
                </Stack>
              </Stack>
            ) : ingestSource === "youtube" ? (
              <Card withBorder p="sm">
                <Stack gap="sm">
                  <Text fw={700} size="sm">
                    Item Metadata
                  </Text>
                  <TextInput
                    label="Title (optional)"
                    value={youtubeTitle}
                    onChange={(e) => setYoutubeTitle(e.currentTarget.value)}
                  />
                  <TextInput
                    label="Artist (optional)"
                    value={youtubeArtist}
                    onChange={(e) => setYoutubeArtist(e.currentTarget.value)}
                  />
                  <Textarea
                    label="Description (optional)"
                    autosize
                    minRows={2}
                    maxRows={4}
                    value={youtubeDescription}
                    onChange={(e) =>
                      setYoutubeDescription(e.currentTarget.value)
                    }
                  />
                </Stack>
              </Card>
            ) : ingestSource === "web" ? (
              <Card withBorder p="sm">
                <Stack gap="sm">
                  <Text fw={700} size="sm">
                    Item Metadata
                  </Text>
                  <TextInput
                    label="Title (optional)"
                    value={webTitle}
                    onChange={(e) => setWebTitle(e.currentTarget.value)}
                  />
                  <TextInput
                    label="Artist (optional)"
                    value={webArtist}
                    onChange={(e) => setWebArtist(e.currentTarget.value)}
                  />
                  <Textarea
                    label="Description (optional)"
                    autosize
                    minRows={2}
                    maxRows={4}
                    value={webDescription}
                    onChange={(e) => setWebDescription(e.currentTarget.value)}
                  />
                </Stack>
              </Card>
            ) : (
              <Card withBorder p="sm">
                <Stack gap="sm">
                  <Text fw={700} size="sm">
                    Default Metadata
                  </Text>
                  <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
                    <TextInput
                      label="Artist"
                      placeholder="Applied to imported collection items"
                      value={edenArtist}
                      onChange={(e) => setEdenArtist(e.currentTarget.value)}
                    />
                    <Textarea
                      label="Description"
                      placeholder="Applied to imported collection items"
                      autosize
                      minRows={2}
                      maxRows={4}
                      value={edenDescription}
                      onChange={(e) =>
                        setEdenDescription(e.currentTarget.value)
                      }
                    />
                  </SimpleGrid>
                  <Checkbox
                    label="Create playlist from imported media"
                    checked={edenCreatePlaylist}
                    onChange={(event) =>
                      setEdenCreatePlaylist(event.currentTarget.checked)
                    }
                  />
                </Stack>
              </Card>
            )}
          </Stack>
        </Card>
      ) : null}
    </Stack>
  );
}
