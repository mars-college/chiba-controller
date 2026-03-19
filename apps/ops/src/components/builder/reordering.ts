import type { DragEvent } from "react";

type ResolveReorderDropIndexArgs = {
  dragIndex: number | null;
  hoverIndex: number;
  relativeY: number;
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

export function resolveReorderDropIndex(args: ResolveReorderDropIndexArgs): number {
  const relativeY = clamp01(args.relativeY);
  if (args.dragIndex === null || args.dragIndex === args.hoverIndex) {
    return relativeY < 0.5 ? args.hoverIndex : args.hoverIndex + 1;
  }

  // Adjacent downward moves were too easy to drop back into the original slot.
  // Bias the hovered row toward the drag direction so landing on a row usually
  // means "move here", while still leaving a smaller opposite-edge zone.
  if (args.dragIndex < args.hoverIndex) {
    return relativeY < 0.35 ? args.hoverIndex : args.hoverIndex + 1;
  }

  return relativeY > 0.65 ? args.hoverIndex + 1 : args.hoverIndex;
}

export function resolveReorderDropIndexFromEvent(args: {
  dragIndex: number | null;
  hoverIndex: number;
  event: DragEvent<HTMLDivElement>;
}): number {
  const rect = args.event.currentTarget.getBoundingClientRect();
  const relativeY =
    rect.height > 0 ? (args.event.clientY - rect.top) / rect.height : 0.5;
  return resolveReorderDropIndex({
    dragIndex: args.dragIndex,
    hoverIndex: args.hoverIndex,
    relativeY,
  });
}
