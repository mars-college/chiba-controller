import type { Dispatch, SetStateAction } from "react";
import {
  Badge,
  Group,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { type DetailBreadcrumb } from "./DetailBreadcrumbs";
import {
  OpsFormDock,
  OpsPageHeader,
  OpsSurface,
} from "./ui/OpsSurface";

export type NodeDraft = {
  registryId: string;
  nodeId: string;
  host: string;
  ip: string;
  nodeName: string;
  orientation: string;
  displayRotate: "" | "0" | "90" | "180" | "270";
  guidePort: number | undefined;
  nodePort: number | undefined;
  serverPort: number | undefined;
  apiKey: string;
};

type NodeEditorPanelProps = {
  editingNodeId: string | null;
  nodeDraft: NodeDraft;
  setNodeDraft: Dispatch<SetStateAction<NodeDraft>>;
  onSave: () => Promise<void>;
  saving: boolean;
  onClose: () => void;
  breadcrumbs: DetailBreadcrumb[];
};

export function NodeEditorPanel({
  editingNodeId,
  nodeDraft,
  setNodeDraft,
  onSave,
  saving,
  onClose,
  breadcrumbs,
}: NodeEditorPanelProps) {
  const canSave = Boolean(
    nodeDraft.registryId.trim() && nodeDraft.nodeId.trim()
  );

  return (
    <OpsSurface>
      <Stack gap="md">
        <OpsPageHeader
          title={editingNodeId ? `Edit Node • ${editingNodeId}` : "New Node"}
          description="Node records drive fleet probing, deployments, and profile overrides. Define identity first, then network/runtime settings."
          breadcrumbs={breadcrumbs}
          compact
        />

        <OpsSurface padded="md">
          <Stack gap="sm">
            <Group justify="space-between">
              <Text fw={700}>Identity</Text>
              <Badge color="red" variant="light">
                Required
              </Badge>
            </Group>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput
                label="Registry ID"
                placeholder="local"
                value={nodeDraft.registryId}
                onChange={(e) => {
                  const value = e.currentTarget.value;
                  setNodeDraft((prev) => ({ ...prev, registryId: value }));
                }}
              />
              <TextInput
                label="Node ID"
                description="Unique stable node identifier"
                placeholder="upper-east-1"
                value={nodeDraft.nodeId}
                disabled={Boolean(editingNodeId)}
                onChange={(e) => {
                  const value = e.currentTarget.value;
                  setNodeDraft((prev) => ({ ...prev, nodeId: value }));
                }}
              />
              <TextInput
                label="Node name"
                placeholder="Upper East 1"
                value={nodeDraft.nodeName}
                onChange={(e) => {
                  const value = e.currentTarget.value;
                  setNodeDraft((prev) => ({ ...prev, nodeName: value }));
                }}
              />
              <Select
                label="Orientation"
                placeholder="Choose orientation"
                data={[
                  { value: "landscape", label: "landscape" },
                  { value: "portrait", label: "portrait" },
                ]}
                value={nodeDraft.orientation || null}
                onChange={(value) =>
                  setNodeDraft((prev) => ({
                    ...prev,
                    orientation: value || "",
                  }))
                }
                clearable
              />
            </SimpleGrid>
          </Stack>
        </OpsSurface>

        <OpsSurface padded="md">
          <Stack gap="sm">
            <Text fw={700}>Network</Text>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput
                label="Host"
                placeholder="upper-east-1.local"
                value={nodeDraft.host}
                onChange={(e) => {
                  const value = e.currentTarget.value;
                  setNodeDraft((prev) => ({ ...prev, host: value }));
                }}
              />
              <TextInput
                label="IP"
                placeholder="10.0.0.21"
                value={nodeDraft.ip}
                onChange={(e) => {
                  const value = e.currentTarget.value;
                  setNodeDraft((prev) => ({ ...prev, ip: value }));
                }}
              />
            </SimpleGrid>
          </Stack>
        </OpsSurface>

        <OpsSurface padded="md">
          <Stack gap="sm">
            <Text fw={700}>Node Runtime</Text>
            <Text size="sm" c="dimmed">
              Configure node-local runtime only. Guide/Cable app endpoints are
              server-hosted and not configured per node.
            </Text>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <NumberInput
                label="Node API port"
                placeholder="8080"
                value={nodeDraft.nodePort}
                onChange={(value) =>
                  setNodeDraft((prev) => ({
                    ...prev,
                    nodePort:
                      typeof value === "number" && Number.isFinite(value)
                        ? value
                        : undefined,
                  }))
                }
                min={1}
                max={65535}
              />
              <Select
                label="Runtime default rotate"
                description="Default launch rotation when apply payload does not override it."
                data={[
                  { value: "", label: "inherit/default" },
                  { value: "0", label: "0" },
                  { value: "90", label: "90" },
                  { value: "180", label: "180" },
                  { value: "270", label: "270" },
                ]}
                value={nodeDraft.displayRotate}
                onChange={(value) =>
                  setNodeDraft((prev) => ({
                    ...prev,
                    displayRotate:
                      (value as "" | "0" | "90" | "180" | "270") || "",
                  }))
                }
              />
            </SimpleGrid>
          </Stack>
        </OpsSurface>

        <OpsSurface padded="md">
          <Stack gap="sm">
            <Group justify="space-between">
              <Text fw={700}>Security</Text>
              <Badge color="gray" variant="light">
                Optional
              </Badge>
            </Group>
            <TextInput
              label="API key"
              placeholder="Used for node-side protected endpoints"
              value={nodeDraft.apiKey}
              onChange={(e) => {
                const value = e.currentTarget.value;
                setNodeDraft((prev) => ({ ...prev, apiKey: value }));
              }}
            />
          </Stack>
        </OpsSurface>

        <OpsFormDock
          secondaryLabel="Cancel"
          onSecondary={onClose}
          primaryLabel={editingNodeId ? "Save Node" : "Create Node"}
          onPrimary={() => void onSave()}
          primaryLoading={saving}
          primaryDisabled={!canSave}
          aside={
            canSave ? (
              <Text size="xs" c="dimmed">
                Required fields are complete.
              </Text>
            ) : (
              <Text size="xs" c="dimmed">
                Registry ID and Node ID are required.
              </Text>
            )
          }
        />
      </Stack>
    </OpsSurface>
  );
}
