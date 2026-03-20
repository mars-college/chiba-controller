import type { LaunchOptions } from "@chiba-cable3/contracts";

export type OpsApplyTargetKind =
  | "profile"
  | "channel"
  | "block"
  | "playlist"
  | "media";

export function normalizeOpsApplyLaunch(args: {
  target: OpsApplyTargetKind;
  launch: LaunchOptions;
  modeExplicit: boolean;
}): LaunchOptions {
  const next: LaunchOptions = { ...args.launch };
  if (
    !args.modeExplicit &&
    !next.mode &&
    (args.target === "channel" || args.target === "block")
  ) {
    next.mode = "gallery";
  }
  return next;
}
