import {
  ActionIcon,
  Button,
  Checkbox,
  Group,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  TagsInput,
  Text,
  TextInput,
} from "@mantine/core";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import {
  createEmptyWebLaunchArgEntry,
  type WebLaunchArgChoiceType,
  type WebLaunchArgEntry,
  type WebLaunchArgEntryKind,
} from "../../lib/webLaunchArgs";

const KIND_OPTIONS: Array<{ value: WebLaunchArgEntryKind; label: string }> = [
  { value: "string", label: "Text" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "Boolean" },
  { value: "int_range", label: "Random number range" },
  { value: "choice", label: "Random choice from list" },
];

const CHOICE_TYPE_OPTIONS: Array<{ value: WebLaunchArgChoiceType; label: string }> = [
  { value: "string", label: "Text" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "Boolean" },
];

function updateAt<T>(rows: T[], index: number, next: T): T[] {
  return rows.map((row, i) => (i === index ? next : row));
}

export function WebLaunchArgsEditor(args: {
  entries: WebLaunchArgEntry[];
  onChange: (entries: WebLaunchArgEntry[]) => void;
  error?: string | null;
}) {
  const { entries, onChange, error } = args;

  return (
    <Stack gap="sm">
      <Group justify="space-between" align="center">
        <Text size="sm" c="dimmed">
          Launch args become URL query params. For random modes, values are stable per
          screen by default.
        </Text>
        <Button
          size="xs"
          variant="light"
          leftSection={<IconPlus size={14} />}
          onClick={() => onChange([...entries, createEmptyWebLaunchArgEntry()])}
        >
          Add arg
        </Button>
      </Group>

      {entries.length === 0 ? (
        <Paper withBorder p="sm" radius="sm">
          <Text size="sm" c="dimmed">
            No launch args configured.
          </Text>
        </Paper>
      ) : null}

      {entries.map((entry, index) => (
        <Paper key={entry.id} withBorder p="sm" radius="sm">
          <Stack gap="sm">
            <Group justify="space-between" align="center">
              <Text size="sm" fw={600}>
                Arg {index + 1}
              </Text>
              <ActionIcon
                variant="light"
                color="red"
                onClick={() =>
                  onChange(entries.filter((candidate) => candidate.id !== entry.id))
                }
                aria-label={`Remove arg ${index + 1}`}
              >
                <IconTrash size={14} />
              </ActionIcon>
            </Group>

            <SimpleGrid cols={{ base: 1, md: 2 }}>
              <TextInput
                label="Key"
                placeholder="seed"
                value={entry.key}
                onChange={(event) =>
                  onChange(
                    updateAt(entries, index, {
                      ...entry,
                      key: event.currentTarget.value,
                    })
                  )
                }
              />
              <Select
                label="Value type"
                data={KIND_OPTIONS}
                value={entry.kind}
                onChange={(value) => {
                  const nextKind = (value as WebLaunchArgEntryKind | null) || "string";
                  onChange(
                    updateAt(entries, index, {
                      ...entry,
                      kind: nextKind,
                    })
                  );
                }}
              />
            </SimpleGrid>

            {entry.kind === "string" ? (
              <TextInput
                label="Value"
                placeholder="mono"
                value={entry.valueText}
                onChange={(event) =>
                  onChange(
                    updateAt(entries, index, {
                      ...entry,
                      valueText: event.currentTarget.value,
                    })
                  )
                }
              />
            ) : null}

            {entry.kind === "number" ? (
              <TextInput
                label="Value"
                placeholder="1.25"
                value={entry.valueText}
                onChange={(event) =>
                  onChange(
                    updateAt(entries, index, {
                      ...entry,
                      valueText: event.currentTarget.value,
                    })
                  )
                }
              />
            ) : null}

            {entry.kind === "boolean" ? (
              <Select
                label="Value"
                data={[
                  { value: "true", label: "True" },
                  { value: "false", label: "False" },
                ]}
                value={entry.valueBool ? "true" : "false"}
                onChange={(value) =>
                  onChange(
                    updateAt(entries, index, {
                      ...entry,
                      valueBool: value !== "false",
                    })
                  )
                }
              />
            ) : null}

            {entry.kind === "int_range" ? (
              <Stack gap="sm">
                <SimpleGrid cols={{ base: 2, md: 4 }}>
                  <TextInput
                    label="Min"
                    placeholder="1"
                    value={entry.rangeMin}
                    onChange={(event) =>
                      onChange(
                        updateAt(entries, index, {
                          ...entry,
                          rangeMin: event.currentTarget.value,
                        })
                      )
                    }
                  />
                  <TextInput
                    label="Max"
                    placeholder="999999"
                    value={entry.rangeMax}
                    onChange={(event) =>
                      onChange(
                        updateAt(entries, index, {
                          ...entry,
                          rangeMax: event.currentTarget.value,
                        })
                      )
                    }
                  />
                  <TextInput
                    label="Step (optional)"
                    placeholder="1"
                    value={entry.rangeStep}
                    onChange={(event) =>
                      onChange(
                        updateAt(entries, index, {
                          ...entry,
                          rangeStep: event.currentTarget.value,
                        })
                      )
                    }
                  />
                  <TextInput
                    label="Pad (optional)"
                    placeholder="6"
                    value={entry.rangePad}
                    onChange={(event) =>
                      onChange(
                        updateAt(entries, index, {
                          ...entry,
                          rangePad: event.currentTarget.value,
                        })
                      )
                    }
                  />
                </SimpleGrid>
                <SimpleGrid cols={{ base: 1, md: 2 }}>
                  <Select
                    label="Number format"
                    data={[
                      { value: "dec", label: "Decimal" },
                      { value: "hex", label: "Hex" },
                    ]}
                    value={entry.rangeBase}
                    onChange={(value) =>
                      onChange(
                        updateAt(entries, index, {
                          ...entry,
                          rangeBase: value === "hex" ? "hex" : "dec",
                        })
                      )
                    }
                  />
                  <Checkbox
                    mt="xl"
                    label="Vary by screen (stable)"
                    checked={entry.rangePerScreen}
                    onChange={(event) =>
                      onChange(
                        updateAt(entries, index, {
                          ...entry,
                          rangePerScreen: event.currentTarget.checked,
                        })
                      )
                    }
                  />
                </SimpleGrid>
              </Stack>
            ) : null}

            {entry.kind === "choice" ? (
              <Stack gap="sm">
                <SimpleGrid cols={{ base: 1, md: 2 }}>
                  <Select
                    label="Choice value type"
                    data={CHOICE_TYPE_OPTIONS}
                    value={entry.choiceType}
                    onChange={(value) =>
                      onChange(
                        updateAt(entries, index, {
                          ...entry,
                          choiceType:
                            value === "number" || value === "boolean"
                              ? value
                              : "string",
                        })
                      )
                    }
                  />
                  <Checkbox
                    mt="xl"
                    label="Vary by screen (stable)"
                    checked={entry.choicePerScreen}
                    onChange={(event) =>
                      onChange(
                        updateAt(entries, index, {
                          ...entry,
                          choicePerScreen: event.currentTarget.checked,
                        })
                      )
                    }
                  />
                </SimpleGrid>
                <TagsInput
                  label="Choices"
                  data={[]}
                  value={entry.choiceValues}
                  onChange={(value) =>
                    onChange(
                      updateAt(entries, index, {
                        ...entry,
                        choiceValues: value,
                      })
                    )
                  }
                  placeholder="Press Enter after each value"
                  description="Add as many options as you want. One is chosen per launch context."
                />
              </Stack>
            ) : null}
          </Stack>
        </Paper>
      ))}

      {error ? (
        <Text size="sm" c="red.4">
          {error}
        </Text>
      ) : null}
    </Stack>
  );
}
