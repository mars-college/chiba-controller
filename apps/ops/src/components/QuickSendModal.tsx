import type { Dispatch, SetStateAction } from "react";
import {
  Button,
  Card,
  Checkbox,
  Group,
  Modal,
  ScrollArea,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { IconBroadcast, IconSearch } from "@tabler/icons-react";

type QuickSendTarget = {
  kind: "media" | "playlist";
  id: string;
  label: string;
};

type QuickSendRow = {
  id: string;
  nodeName?: string;
  host?: string;
  ip?: string;
};

type Props = {
  opened: boolean;
  onClose: () => void;
  isMobile: boolean;
  target: QuickSendTarget | null;
  query: string;
  setQuery: Dispatch<SetStateAction<string>>;
  rows: QuickSendRow[];
  nodeIds: string[];
  setNodeIds: Dispatch<SetStateAction<string[]>>;
  busy: boolean;
  onRun: () => Promise<void>;
};

export function QuickSendModal(props: Props) {
  const visibleRowIds = props.rows.map((row) => row.id);
  const selectedNodeIds = new Set(props.nodeIds);
  const selectedVisibleCount = visibleRowIds.filter((id) =>
    selectedNodeIds.has(id)
  ).length;
  const allVisibleSelected =
    visibleRowIds.length > 0 && selectedVisibleCount === visibleRowIds.length;
  const someVisibleSelected =
    selectedVisibleCount > 0 && selectedVisibleCount < visibleRowIds.length;

  return (
    <Modal
      opened={props.opened}
      onClose={props.onClose}
      title={props.target ? `Send ${props.target.kind} to nodes` : "Send to nodes"}
      size={props.isMobile ? "100%" : "lg"}
    >
      <Stack gap="md">
        <TextInput
          leftSection={<IconSearch size={16} />}
          placeholder="Filter nodes by id/host/ip"
          value={props.query}
          onChange={(event) => props.setQuery(event.currentTarget.value)}
        />
        <Group justify="space-between" align="center" wrap="nowrap">
          <Checkbox
            label={`Select all (${props.rows.length})`}
            checked={allVisibleSelected}
            indeterminate={someVisibleSelected}
            disabled={props.rows.length === 0}
            onChange={(event) => {
              const shouldSelect = event.currentTarget.checked;
              props.setNodeIds((prev) => {
                if (shouldSelect) {
                  return Array.from(new Set([...prev, ...visibleRowIds]));
                }
                const hidden = new Set(visibleRowIds);
                return prev.filter((id) => !hidden.has(id));
              });
            }}
          />
          <Button
            variant="subtle"
            size="compact-sm"
            disabled={selectedVisibleCount === 0}
            onClick={() =>
              props.setNodeIds((prev) => {
                const hidden = new Set(visibleRowIds);
                return prev.filter((id) => !hidden.has(id));
              })
            }
          >
            Clear visible
          </Button>
        </Group>
        <ScrollArea h={320}>
          <Stack gap="xs">
            {props.rows.map((row) => {
              const checked = props.nodeIds.includes(row.id);
              return (
                <Card
                  key={`quick-send-${row.id}`}
                  withBorder
                  p="xs"
                  className={`ops-media-card${checked ? " is-selected" : ""}`}
                  onClick={() =>
                    props.setNodeIds((prev) => {
                      if (prev.includes(row.id)) return prev.filter((id) => id !== row.id);
                      return [...prev, row.id];
                    })
                  }
                >
                  <Group justify="space-between" align="center" wrap="nowrap">
                    <Stack gap={2}>
                      <Text fw={600}>{row.id}</Text>
                      <Text size="xs" c="dimmed">
                        {row.nodeName || row.host || row.ip || "node"}
                      </Text>
                    </Stack>
                    <Checkbox
                      checked={checked}
                      onClick={(event) => event.stopPropagation()}
                      onChange={() =>
                        props.setNodeIds((prev) => {
                          if (prev.includes(row.id)) return prev.filter((id) => id !== row.id);
                          return [...prev, row.id];
                        })
                      }
                    />
                  </Group>
                </Card>
              );
            })}
            {props.rows.length === 0 ? (
              <Text size="sm" c="dimmed">
                No nodes match this filter.
              </Text>
            ) : null}
          </Stack>
        </ScrollArea>
        <Group justify="space-between" align="center">
          <Text size="sm" c="dimmed">
            {props.nodeIds.length} selected
          </Text>
          <Group gap="xs">
            <Button variant="light" onClick={props.onClose}>
              Cancel
            </Button>
            <Button
              leftSection={<IconBroadcast size={14} />}
              loading={props.busy}
              disabled={!props.target || props.nodeIds.length === 0}
              onClick={() => void props.onRun()}
            >
              Send to selected
            </Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}
