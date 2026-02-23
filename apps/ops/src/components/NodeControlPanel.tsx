import { useMemo, useState, type ReactNode } from "react";
import {
  Badge,
  Button,
  Checkbox,
  Divider,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
} from "@mantine/core";
import {
  IconArrowDown,
  IconArrowLeft,
  IconArrowRight,
  IconArrowUp,
  IconClick,
  IconKeyboard,
  IconSend,
} from "@tabler/icons-react";
import type { NodeRuntimeInputAction } from "@chiba-cable3/contracts";
import type { OpsNodeBootstrapResponse } from "../types";
import { DetailBreadcrumbs, type DetailBreadcrumb } from "./DetailBreadcrumbs";

type NodeControlPanelProps = {
  selectedNodeCount: number;
  nodeId: string;
  busy: boolean;
  error: string | null;
  lastAction: string | null;
  onSendAction: (action: NodeRuntimeInputAction) => Promise<void>;
  onBootstrap: (payload: {
    controlApiUrl: string;
    nodeControlApiUrl: string;
    guideBaseUrl: string;
    namespace?: string;
    registryId?: string;
    endpointsOnly?: boolean;
    sshUser?: string;
    sshPort?: number;
    sshPassword?: string;
    host?: string;
    guidePort?: number;
    dryRun?: boolean;
  }) => Promise<void>;
  bootstrapBusy: boolean;
  bootstrapError: string | null;
  bootstrapResult: OpsNodeBootstrapResponse | null;
  defaultRegistryId: string;
  defaultNamespace: string;
  defaultNodeHost: string;
  onClose: () => void;
  breadcrumbs: DetailBreadcrumb[];
};

type KeyAction = {
  label: string;
  keyValue: string;
  icon?: ReactNode;
};

const KEY_ACTIONS: KeyAction[] = [
  { label: "Up", keyValue: "Up", icon: <IconArrowUp size={14} /> },
  { label: "Down", keyValue: "Down", icon: <IconArrowDown size={14} /> },
  { label: "Left", keyValue: "Left", icon: <IconArrowLeft size={14} /> },
  { label: "Right", keyValue: "Right", icon: <IconArrowRight size={14} /> },
  { label: "Enter", keyValue: "Enter" },
  { label: "Escape", keyValue: "Escape" },
  { label: "Space", keyValue: "Space" },
  { label: "Backspace", keyValue: "Backspace" },
];

function inferPublicUrl(port: number): string {
  if (typeof window === "undefined") return `http://127.0.0.1:${port}`;
  const protocol = window.location.protocol === "https:" ? "https" : "http";
  const host = window.location.hostname || "127.0.0.1";
  return `${protocol}://${host}:${port}`;
}

export function NodeControlPanel({
  selectedNodeCount,
  nodeId,
  busy,
  error,
  lastAction,
  onSendAction,
  onBootstrap,
  bootstrapBusy,
  bootstrapError,
  bootstrapResult,
  defaultRegistryId,
  defaultNamespace,
  defaultNodeHost,
  onClose,
  breadcrumbs,
}: NodeControlPanelProps) {
  const [textInput, setTextInput] = useState("");
  const defaults = useMemo(
    () => ({
      lookupControlApiUrl: inferPublicUrl(8795),
      nodeControlApiUrl: inferPublicUrl(8795),
      guideBaseUrl: inferPublicUrl(5173),
    }),
    []
  );
  const [lookupControlApiUrl, setLookupControlApiUrl] = useState(defaults.lookupControlApiUrl);
  const [nodeControlApiUrl, setNodeControlApiUrl] = useState(defaults.nodeControlApiUrl);
  const [guideBaseUrl, setGuideBaseUrl] = useState(defaults.guideBaseUrl);
  const [namespace, setNamespace] = useState(defaultNamespace || defaultRegistryId || "prod");
  const [registryId, setRegistryId] = useState(defaultRegistryId || defaultNamespace || "prod");
  const [hostOverride, setHostOverride] = useState(defaultNodeHost || "");
  const [sshUser, setSshUser] = useState("pi");
  const [sshPortInput, setSshPortInput] = useState("22");
  const [sshPassword, setSshPassword] = useState("");
  const [guidePortInput, setGuidePortInput] = useState("5173");
  const [endpointsOnly, setEndpointsOnly] = useState(true);
  const [dryRun, setDryRun] = useState(false);

  const sendText = async () => {
    const text = textInput.trim();
    if (!text) return;
    await onSendAction({ kind: "text", text });
    setTextInput("");
  };

  const runBootstrap = async () => {
    const sshPort = Number(sshPortInput);
    const guidePort = Number(guidePortInput);
    await onBootstrap({
      controlApiUrl: lookupControlApiUrl,
      nodeControlApiUrl,
      guideBaseUrl,
      namespace,
      registryId,
      host: hostOverride,
      sshUser,
      sshPort: Number.isFinite(sshPort) && sshPort > 0 ? sshPort : undefined,
      sshPassword,
      guidePort: Number.isFinite(guidePort) && guidePort > 0 ? guidePort : undefined,
      endpointsOnly,
      dryRun,
    });
  };

  return (
    <Paper withBorder p="md" radius="md">
      <Stack gap="md">
        <Stack gap={4}>
          <DetailBreadcrumbs items={breadcrumbs} />
          <Title order={5}>Control App/Web</Title>
        </Stack>

        <Group gap="xs" wrap="wrap">
          <Badge variant="light">{selectedNodeCount} selected node(s)</Badge>
          <Badge variant="light" color="blue">
            target: {nodeId}
          </Badge>
          {lastAction ? (
            <Badge variant="light" color="teal">
              last: {lastAction}
            </Badge>
          ) : null}
        </Group>

        <Text size="sm" c="dimmed">
          Send keyboard, text, and click input to the active runtime window on
          the selected node.
        </Text>

        <Paper withBorder p="sm" radius="sm">
          <Stack gap="sm">
            <Group gap={8}>
              <IconKeyboard size={16} />
              <Text fw={600}>Quick keys</Text>
            </Group>
            <SimpleGrid cols={{ base: 2, sm: 4 }}>
              {KEY_ACTIONS.map((keyAction) => (
                <Button
                  key={keyAction.keyValue}
                  variant="light"
                  leftSection={keyAction.icon}
                  loading={busy}
                  onClick={() =>
                    void onSendAction({ kind: "key", key: keyAction.keyValue })
                  }
                >
                  {keyAction.label}
                </Button>
              ))}
            </SimpleGrid>
          </Stack>
        </Paper>

        <Paper withBorder p="sm" radius="sm">
          <Stack gap="sm">
            <Group gap={8}>
              <IconSend size={16} />
              <Text fw={600}>Send text</Text>
            </Group>
            <Group align="flex-end" wrap="nowrap">
              <TextInput
                style={{ flex: 1 }}
                value={textInput}
                placeholder="Type text to send to focused app input"
                onChange={(event) => setTextInput(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  void sendText();
                }}
              />
              <Button
                loading={busy}
                disabled={!textInput.trim()}
                onClick={() => void sendText()}
              >
                Send
              </Button>
            </Group>
          </Stack>
        </Paper>

        <Paper withBorder p="sm" radius="sm">
          <Stack gap="sm">
            <Group gap={8}>
              <IconClick size={16} />
              <Text fw={600}>Pointer</Text>
            </Group>
            <Group>
              <Button
                variant="light"
                loading={busy}
                onClick={() =>
                  void onSendAction({ kind: "mouse_click", button: "left" })
                }
              >
                Left Click
              </Button>
              <Button
                variant="light"
                loading={busy}
                onClick={() =>
                  void onSendAction({ kind: "mouse_click", button: "right" })
                }
              >
                Right Click
              </Button>
            </Group>
          </Stack>
        </Paper>

        {error ? (
          <Text size="sm" c="red">
            {error}
          </Text>
        ) : null}

        <Divider label="Node Bootstrap" labelPosition="center" />

        <Paper withBorder p="sm" radius="sm">
          <Stack gap="sm">
            <Text fw={600}>Bootstrap Node Runtime</Text>
            <Text size="sm" c="dimmed">
              Runs the control-plane bootstrap script for this node so you can set
              control API and guide URLs without leaving Ops.
            </Text>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput
                label="Lookup Control API URL"
                value={lookupControlApiUrl}
                onChange={(event) => setLookupControlApiUrl(event.currentTarget.value)}
              />
              <TextInput
                label="Node Control API URL"
                value={nodeControlApiUrl}
                onChange={(event) => setNodeControlApiUrl(event.currentTarget.value)}
              />
              <TextInput
                label="Guide Base URL"
                value={guideBaseUrl}
                onChange={(event) => setGuideBaseUrl(event.currentTarget.value)}
              />
              <TextInput
                label="Host Override (optional)"
                placeholder="10.10.13.42"
                value={hostOverride}
                onChange={(event) => setHostOverride(event.currentTarget.value)}
              />
              <TextInput
                label="Namespace"
                value={namespace}
                onChange={(event) => setNamespace(event.currentTarget.value)}
              />
              <TextInput
                label="Registry ID"
                value={registryId}
                onChange={(event) => setRegistryId(event.currentTarget.value)}
              />
              <TextInput
                label="SSH User"
                value={sshUser}
                onChange={(event) => setSshUser(event.currentTarget.value)}
              />
              <TextInput
                label="SSH Port"
                value={sshPortInput}
                onChange={(event) => setSshPortInput(event.currentTarget.value)}
              />
              <TextInput
                label="Guide Port"
                value={guidePortInput}
                onChange={(event) => setGuidePortInput(event.currentTarget.value)}
              />
              <TextInput
                label="SSH Password (optional)"
                type="password"
                value={sshPassword}
                onChange={(event) => setSshPassword(event.currentTarget.value)}
              />
            </SimpleGrid>
            <Group>
              <Checkbox
                label="Endpoints only (skip deploy/build)"
                checked={endpointsOnly}
                onChange={(event) => setEndpointsOnly(event.currentTarget.checked)}
              />
              <Checkbox
                label="Dry run"
                checked={dryRun}
                onChange={(event) => setDryRun(event.currentTarget.checked)}
              />
            </Group>
            <Group justify="space-between" wrap="wrap">
              <Button loading={bootstrapBusy} onClick={() => void runBootstrap()}>
                Bootstrap Node
              </Button>
              {bootstrapResult ? (
                <Badge variant="light" color={bootstrapResult.ok ? "teal" : "red"}>
                  {bootstrapResult.dryRun
                    ? "dry run"
                    : `exit ${
                        typeof bootstrapResult.code === "number"
                          ? bootstrapResult.code
                          : "n/a"
                      }`}
                </Badge>
              ) : null}
            </Group>
            {bootstrapError ? (
              <Text size="sm" c="red">
                {bootstrapError}
              </Text>
            ) : null}
            {bootstrapResult?.command?.length ? (
              <Textarea
                label="Executed command"
                minRows={2}
                autosize
                readOnly
                value={bootstrapResult.command.join(" ")}
              />
            ) : null}
            {bootstrapResult?.stdout ? (
              <Textarea
                label="Bootstrap stdout"
                minRows={4}
                maxRows={12}
                autosize
                readOnly
                value={bootstrapResult.stdout}
              />
            ) : null}
            {bootstrapResult?.stderr ? (
              <Textarea
                label="Bootstrap stderr"
                minRows={4}
                maxRows={12}
                autosize
                readOnly
                value={bootstrapResult.stderr}
              />
            ) : null}
          </Stack>
        </Paper>

        <Group justify="space-between">
          <Button variant="light" onClick={onClose}>
            Close
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}
