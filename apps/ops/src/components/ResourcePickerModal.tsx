import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Group,
  Image,
  Modal,
  Paper,
  ScrollArea,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";
import { PreviewTileCluster, type PreviewTile } from "./PreviewTileCluster";

export type ResourcePickerItem = {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  thumbnailUrl?: string;
  previewUrl?: string;
  previewTiles?: PreviewTile[];
  previewTilesTotalCount?: number;
  badge?: string;
  searchText?: string;
};

type KindOption = { value: string; label: string };

type Props = {
  opened: boolean;
  onClose: () => void;
  title: string;
  items: ResourcePickerItem[];
  selectedIds: string[];
  multi?: boolean;
  applyLabel?: string;
  onApply: (ids: string[]) => void;
  kind?: string;
  kindOptions?: KindOption[];
  onKindChange?: (kind: string) => void;
};

function normalizeSearch(item: ResourcePickerItem): string {
  if (item.searchText?.trim()) return item.searchText.toLowerCase();
  return [item.id, item.title, item.subtitle, item.description, item.badge]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function badgeColor(value: string): string {
  const lower = value.toLowerCase();
  if (lower === "video") return "cyan";
  if (lower === "web") return "indigo";
  if (lower === "playlist") return "teal";
  if (lower === "channel") return "green";
  if (lower === "block") return "orange";
  if (lower === "profile") return "grape";
  return "blue";
}

export function ResourcePickerModal(props: Props) {
  const multi = props.multi !== false;
  const [query, setQuery] = useState("");
  const [selectedSet, setSelectedSet] = useState<Set<string>>(
    new Set(props.selectedIds)
  );
  const [badgeFilter, setBadgeFilter] = useState<string>("all");
  const [selectionFilter, setSelectionFilter] = useState<"all" | "selected">(
    "all"
  );
  const selectedIdsKey = useMemo(
    () => props.selectedIds.join("\u0001"),
    [props.selectedIds]
  );

  useEffect(() => {
    if (!props.opened) return;
    setSelectedSet(new Set(props.selectedIds));
    setQuery("");
    setBadgeFilter("all");
    setSelectionFilter("all");
  }, [props.opened, selectedIdsKey]);

  const badgeOptions = useMemo(() => {
    const unique = Array.from(
      new Set(
        props.items
          .map((item) => item.badge?.trim().toLowerCase() || "")
          .filter((value) => value.length > 0)
      )
    ).sort();
    return [
      { value: "all", label: "All Types" },
      ...unique.map((value) => ({
        value,
        label: value[0].toUpperCase() + value.slice(1),
      })),
    ];
  }, [props.items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return props.items.filter((item) => {
      if (selectionFilter === "selected" && !selectedSet.has(item.id))
        return false;
      if (badgeFilter !== "all") {
        const badge = item.badge?.trim().toLowerCase() || "";
        if (badge !== badgeFilter) return false;
      }
      if (!q) return true;
      return normalizeSearch(item).includes(q);
    });
  }, [badgeFilter, props.items, query, selectedSet, selectionFilter]);

  const selectedOrdered = useMemo(
    () => props.items.filter((item) => selectedSet.has(item.id)).map((item) => item.id),
    [props.items, selectedSet]
  );

  const toggle = (id: string) => {
    setSelectedSet((prev) => {
      const next = new Set(prev);
      if (multi) {
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }
      if (next.has(id)) return new Set();
      return new Set([id]);
    });
  };

  return (
    <Modal opened={props.opened} onClose={props.onClose} title={props.title} fullScreen>
      <Stack gap="sm">
        {props.kindOptions?.length ? (
          <Select
            label="Step 1: Target type"
            value={props.kind || ""}
            data={props.kindOptions}
            onChange={(value) => {
              if (!value || !props.onKindChange) return;
              props.onKindChange(value);
              setSelectedSet(new Set());
            }}
          />
        ) : null}

        <TextInput
          leftSection={<IconSearch size={16} />}
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          placeholder="Step 2: Search by id/title/artist/description"
        />
        <Group grow>
          <SegmentedControl
            value={badgeFilter}
            onChange={setBadgeFilter}
            data={badgeOptions}
          />
          <SegmentedControl
            value={selectionFilter}
            onChange={(value) =>
              setSelectionFilter((value as "all" | "selected") || "all")
            }
            data={[
              { value: "all", label: "All" },
              { value: "selected", label: "Selected" },
            ]}
          />
        </Group>

        <Text size="xs" c="dimmed">
          Showing {filtered.length} result(s), {selectedOrdered.length} selected
        </Text>

        <ScrollArea h="62vh">
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3, xl: 4 }} spacing="sm">
            {filtered.map((item) => {
              const selected = selectedSet.has(item.id);
              const badge = item.badge?.trim();
              const renderVideoPreview =
                (badge || "").toLowerCase() === "video" && Boolean(item.previewUrl);
              return (
                <Card
                  key={item.id}
                  withBorder
                  p="sm"
                  radius="md"
                  className={`ops-media-card${selected ? " is-selected" : ""}`}
                  style={{ cursor: "pointer" }}
                  onClick={() => toggle(item.id)}
                >
                  <Stack gap="sm">
                    <Group justify="space-between" align="center" wrap="nowrap">
                      {badge ? (
                        <Badge variant="light" color={badgeColor(badge)}>
                          {badge}
                        </Badge>
                      ) : (
                        <span />
                      )}
                      <Checkbox
                        checked={selected}
                        onClick={(event) => event.stopPropagation()}
                        onChange={() => toggle(item.id)}
                      />
                    </Group>

                    {item.previewTiles && item.previewTiles.length > 0 ? (
                      <PreviewTileCluster
                        tiles={item.previewTiles}
                        totalCount={item.previewTilesTotalCount}
                        height={160}
                      />
                    ) : renderVideoPreview ? (
                      <video
                        className="ops-media-thumb-video"
                        muted
                        loop
                        playsInline
                        preload="metadata"
                        poster={item.thumbnailUrl}
                        src={item.previewUrl}
                        onMouseEnter={(event) => {
                          void event.currentTarget.play().catch(() => {});
                        }}
                        onMouseLeave={(event) => {
                          event.currentTarget.pause();
                          event.currentTarget.currentTime = 0;
                        }}
                      />
                    ) : item.previewUrl || item.thumbnailUrl ? (
                      <Image
                        src={item.previewUrl || item.thumbnailUrl}
                        alt={item.title || item.id}
                        h={160}
                        fit="cover"
                        radius="sm"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <Paper withBorder h={160} radius="sm" p="sm">
                        <Group justify="center" align="center" h="100%">
                          <Text size="sm" c="dimmed">
                            No preview
                          </Text>
                        </Group>
                      </Paper>
                    )}

                    <Stack gap={2}>
                      <Text fw={700} lineClamp={1}>
                        {item.title || item.id}
                      </Text>
                      {item.subtitle ? (
                        <Text size="xs" c="dimmed" lineClamp={1}>
                          {item.subtitle}
                        </Text>
                      ) : null}
                      {item.description ? (
                        <Text size="xs" c="dimmed" lineClamp={1}>
                          {item.description}
                        </Text>
                      ) : null}
                    </Stack>
                  </Stack>
                </Card>
              );
            })}
          </SimpleGrid>
          {filtered.length === 0 ? (
            <Paper withBorder p="lg" mt="sm">
              <Text c="dimmed" size="sm">
                No targets match the current search/filter set.
              </Text>
            </Paper>
          ) : null}
        </ScrollArea>

        <Paper withBorder p="sm">
          <Group justify="space-between" align="center">
            <Text size="sm" c="dimmed">
              Selected: {selectedOrdered.length}
            </Text>
            <Group gap="xs">
              <Button variant="light" onClick={props.onClose}>
                Cancel
              </Button>
              <Button
                disabled={selectedOrdered.length === 0}
                onClick={() => {
                  props.onApply(selectedOrdered);
                  props.onClose();
                }}
              >
                {props.applyLabel ||
                  (multi
                    ? `Apply (${selectedOrdered.length})`
                    : "Use selected target")}
              </Button>
            </Group>
          </Group>
        </Paper>
      </Stack>
    </Modal>
  );
}
