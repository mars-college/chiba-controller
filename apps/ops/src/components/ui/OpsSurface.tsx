import type { ReactNode } from "react";
import { Button, Group, Pagination, Paper, Stack, Text, Title } from "@mantine/core";
import { DetailBreadcrumbs, type DetailBreadcrumb } from "../DetailBreadcrumbs";

function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

type OpsSurfaceProps = {
  children: ReactNode;
  className?: string;
  padded?: "sm" | "md" | "lg";
};

export function OpsSurface({
  children,
  className,
  padded = "md",
}: OpsSurfaceProps) {
  return (
    <Paper
      withBorder
      radius="xl"
      p={padded}
      className={cx("ops-surface", className)}
    >
      {children}
    </Paper>
  );
}

type OpsPageHeaderProps = {
  title: string;
  description?: ReactNode;
  breadcrumbs?: DetailBreadcrumb[];
  actions?: ReactNode;
  meta?: ReactNode;
  sticky?: boolean;
  compact?: boolean;
  className?: string;
};

export function OpsPageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  meta,
  sticky = false,
  compact = false,
  className,
}: OpsPageHeaderProps) {
  return (
    <Paper
      withBorder
      radius="lg"
      p={compact ? "sm" : "md"}
      className={cx(
        "ops-page-header",
        sticky && "ops-page-header-sticky",
        compact && "ops-page-header-compact",
        className
      )}
    >
      <Stack gap={compact ? 8 : 12}>
        {breadcrumbs?.length ? <DetailBreadcrumbs items={breadcrumbs} /> : null}
        <Group justify="space-between" align="flex-start" gap="md" wrap="wrap">
          <Stack gap={description ? 4 : 0} className="ops-page-header-copy">
            <Title order={compact ? 4 : 3}>{title}</Title>
            {description ? (
              <Text size={compact ? "sm" : "md"} c="dimmed">
                {description}
              </Text>
            ) : null}
          </Stack>
          {actions ? (
            <Group gap="xs" wrap="wrap" className="ops-page-header-actions">
              {actions}
            </Group>
          ) : null}
        </Group>
        {meta ? <Group gap="xs" wrap="wrap">{meta}</Group> : null}
      </Stack>
    </Paper>
  );
}

type OpsToolbarProps = {
  children: ReactNode;
  sticky?: boolean;
  className?: string;
};

export function OpsToolbar({
  children,
  sticky = false,
  className,
}: OpsToolbarProps) {
  return (
    <Paper
      withBorder
      radius="lg"
      p="sm"
      className={cx("ops-toolbar-surface", sticky && "ops-toolbar-sticky", className)}
    >
      {children}
    </Paper>
  );
}

type OpsPaginationBarProps = {
  rangeLabel: string;
  summary?: ReactNode;
  totalPages: number;
  value: number;
  onChange: (page: number) => void;
  size?: "xs" | "sm" | "md";
  withEdges?: boolean;
  siblings?: number;
  boundaries?: number;
  sticky?: boolean;
  className?: string;
};

export function OpsPaginationBar({
  rangeLabel,
  summary,
  totalPages,
  value,
  onChange,
  size = "sm",
  withEdges = true,
  siblings = 1,
  boundaries = 1,
  sticky = false,
  className,
}: OpsPaginationBarProps) {
  return (
    <Paper
      withBorder
      radius="lg"
      p="sm"
      className={cx("ops-pagination-bar", sticky && "ops-pagination-bar-sticky", className)}
    >
      <Group justify="space-between" align="center" gap="sm" wrap="wrap">
        <Stack gap={2}>
          <Text size="sm">{rangeLabel}</Text>
          {summary ? (
            <Text size="xs" c="dimmed">
              {summary}
            </Text>
          ) : null}
        </Stack>
        <Pagination
          total={Math.max(1, totalPages)}
          value={value}
          onChange={onChange}
          size={size}
          siblings={siblings}
          boundaries={boundaries}
          withEdges={withEdges}
        />
      </Group>
    </Paper>
  );
}

type OpsEmptyStateProps = {
  title: string;
  description: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  actionVariant?: "filled" | "light" | "default" | "outline" | "subtle" | "transparent" | "white";
};

export function OpsEmptyState({
  title,
  description,
  actionLabel,
  onAction,
  actionVariant = "light",
}: OpsEmptyStateProps) {
  return (
    <Paper withBorder radius="lg" p="lg" className="ops-empty-state">
      <Stack gap="sm" align="flex-start">
        <Title order={5}>{title}</Title>
        <Text c="dimmed">{description}</Text>
        {actionLabel && onAction ? (
          <Button variant={actionVariant} onClick={onAction}>
            {actionLabel}
          </Button>
        ) : null}
      </Stack>
    </Paper>
  );
}

type OpsFormDockProps = {
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  primaryLoading?: boolean;
  secondaryLabel?: string;
  onSecondary?: () => void;
  secondaryDisabled?: boolean;
  aside?: ReactNode;
  className?: string;
};

export function OpsFormDock({
  primaryLabel,
  onPrimary,
  primaryDisabled,
  primaryLoading,
  secondaryLabel,
  onSecondary,
  secondaryDisabled,
  aside,
  className,
}: OpsFormDockProps) {
  return (
    <Paper withBorder radius="lg" p="sm" className={cx("ops-form-dock", className)}>
      <Group justify="space-between" align="center" gap="sm" wrap="wrap">
        <Group gap="sm" wrap="wrap">
          {secondaryLabel && onSecondary ? (
            <Button
              variant="light"
              onClick={onSecondary}
              disabled={secondaryDisabled}
            >
              {secondaryLabel}
            </Button>
          ) : null}
          <Button
            onClick={onPrimary}
            disabled={primaryDisabled}
            loading={primaryLoading}
          >
            {primaryLabel}
          </Button>
        </Group>
        {aside ? <div className="ops-form-dock-aside">{aside}</div> : null}
      </Group>
    </Paper>
  );
}
