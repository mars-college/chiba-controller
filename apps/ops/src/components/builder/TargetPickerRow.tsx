import { useMemo, useState } from "react";
import { Button, Group, Select, SimpleGrid, Text } from "@mantine/core";
import type { CatalogOption, TargetKind } from "../../lib/opsModel";
import {
  ResourcePickerModal,
  type ResourcePickerItem,
} from "../ResourcePickerModal";

export type TargetPickerRowProps = {
  kind: TargetKind;
  targetId: string;
  onKindChange?: (kind: TargetKind) => void;
  onTargetIdChange: (targetId: string) => void;
  kindOptions: Array<{ value: TargetKind; label: string }>;
  optionsByKind: Record<TargetKind, CatalogOption[]>;
  pickerItemsByKind?: Partial<Record<TargetKind, ResourcePickerItem[]>>;
  kindLabel?: string;
  targetLabel?: string;
  targetPlaceholder?: string;
  targetNothingFound?: string;
};

export function TargetPickerRow({
  kind,
  targetId,
  onKindChange,
  onTargetIdChange,
  kindOptions,
  optionsByKind,
  pickerItemsByKind,
  kindLabel = "Kind",
  targetLabel = "Target",
  targetPlaceholder,
  targetNothingFound = "No matching targets",
}: TargetPickerRowProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const options = optionsByKind[kind] ?? [];
  const selectedLabel = useMemo(
    () => options.find((option) => option.value === targetId)?.label || "",
    [options, targetId]
  );
  const pickerItems = useMemo<ResourcePickerItem[]>(
    () =>
      pickerItemsByKind?.[kind] && pickerItemsByKind[kind]?.length
        ? pickerItemsByKind[kind] || []
        : options.map((option) => ({
            id: option.value,
            title: option.label,
            description: option.value,
            badge: kind,
            searchText: `${option.value} ${option.label}`,
          })),
    [kind, options, pickerItemsByKind]
  );

  return (
    <>
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xs">
      <Select
        label={kindLabel}
        data={kindOptions}
        value={kind}
        allowDeselect={false}
        onChange={(value) => {
          if (!value || !onKindChange) return;
          if (
            value === "media" ||
            value === "playlist" ||
            value === "block" ||
            value === "channel"
          ) {
            onKindChange(value);
          }
        }}
        disabled={!onKindChange || kindOptions.length <= 1}
      />
        <div>
          <Text size="sm" fw={500} mb={6}>
            {targetLabel}
          </Text>
          <Group grow wrap="nowrap">
            <Button
              variant="default"
              justify="flex-start"
              onClick={() => setPickerOpen(true)}
            >
              {selectedLabel || targetPlaceholder || `Select ${kind}`}
            </Button>
            <Button
              variant="light"
              color="gray"
              disabled={!targetId}
              onClick={() => onTargetIdChange("")}
            >
              Clear
            </Button>
          </Group>
        </div>
      </SimpleGrid>

      <ResourcePickerModal
        opened={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title={`Pick ${kind}`}
        items={pickerItems}
        selectedIds={targetId ? [targetId] : []}
        multi={false}
        applyLabel={`Use ${kind}`}
        onApply={(ids) => onTargetIdChange(ids[0] || "")}
      />
    </>
  );
}
