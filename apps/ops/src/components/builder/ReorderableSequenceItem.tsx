import type { DragEvent, ReactNode } from "react";
import { ActionIcon, Badge, Group, Paper, Stack, Text } from "@mantine/core";
import { IconGripVertical, IconTrash } from "@tabler/icons-react";

type Props = {
  index: number;
  title: string;
  subtitle?: string;
  preview?: ReactNode;
  badgeLabel?: string;
  badgeColor?: string;
  onRemove: () => void;
  onDragStart: (event: DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
};

export function ReorderableSequenceItem({
  index,
  title,
  subtitle,
  preview,
  badgeLabel,
  badgeColor,
  onRemove,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: Props) {
  return (
    <Paper
      withBorder
      p="sm"
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      <Group justify="space-between" align="center" wrap="nowrap">
        <Group gap="sm" wrap="nowrap">
          <ActionIcon
            variant="subtle"
            color="gray"
            title="Drag to reorder"
            style={{ cursor: "grab" }}
          >
            <IconGripVertical size={16} />
          </ActionIcon>
          <Badge variant="light">{index + 1}</Badge>
          {badgeLabel ? (
            <Badge variant="light" color={badgeColor || "gray"}>
              {badgeLabel}
            </Badge>
          ) : null}
          {preview}
          <Stack gap={1}>
            <Text fw={600} lineClamp={1}>
              {title}
            </Text>
            {subtitle ? (
              <Text size="xs" c="dimmed" lineClamp={1}>
                {subtitle}
              </Text>
            ) : null}
          </Stack>
        </Group>
        <ActionIcon variant="light" color="red" onClick={onRemove}>
          <IconTrash size={14} />
        </ActionIcon>
      </Group>
    </Paper>
  );
}
