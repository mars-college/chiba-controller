import {
  Burger,
  Checkbox,
  Group,
  Title,
} from "@mantine/core";

type Props = {
  isMobile: boolean;
  controlOpen: boolean;
  onToggleControl: () => void;
  autoRefresh: boolean;
  onAutoRefreshChange: (value: boolean) => void;
};

export function OpsHeader(props: Props) {
  return (
    <Group h="100%" px="md" justify="space-between" wrap="nowrap">
      <Group gap="sm">
        <Burger
          opened={props.controlOpen}
          onClick={props.onToggleControl}
          aria-label="Toggle navigation"
          size="sm"
        />
        <Title order={props.isMobile ? 4 : 3}>Chiba Controller</Title>
      </Group>
      <Group gap="xs" wrap="nowrap">
        {!props.isMobile ? (
          <Checkbox
            checked={props.autoRefresh}
            onChange={(e) => props.onAutoRefreshChange(e.currentTarget.checked)}
            label="Auto refresh"
          />
        ) : null}
      </Group>
    </Group>
  );
}
