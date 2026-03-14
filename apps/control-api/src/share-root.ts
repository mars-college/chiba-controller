import * as fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const sourceDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(sourceDir, "../../..");
const localDefaultShareRoot = path.join(repoRoot, ".local", "share-root");
const assetMarker = `${path.sep}chiba-cable${path.sep}assets${path.sep}`;

export function getDefaultShareRoot(): string {
  return localDefaultShareRoot;
}

export function getShareRoot(): string {
  const configured = process.env.SHARE_ROOT?.trim();
  if (!configured) return localDefaultShareRoot;
  return path.isAbsolute(configured) ? configured : path.resolve(configured);
}

export function getAssetsRoot(): string {
  return path.join(getShareRoot(), "chiba-cable", "assets");
}

export function getThumbsRoot(): string {
  return path.join(getAssetsRoot(), ".thumbs");
}

export function mediaPathCandidates(sourceValue: string): string[] {
  const raw = String(sourceValue ?? "").trim();
  if (!raw) return [];
  const normalized = path.normalize(raw);
  if (!path.isAbsolute(normalized)) return [];

  const candidates = [normalized];
  const markerIdx = normalized.lastIndexOf(assetMarker);
  if (markerIdx >= 0) {
    const relativePath = normalized.slice(markerIdx + assetMarker.length);
    if (relativePath) candidates.push(path.join(getAssetsRoot(), relativePath));
  }

  return Array.from(new Set(candidates));
}

export function resolveExistingMediaFileSync(sourceValue: string): {
  path: string;
  stat: fs.Stats;
} | null {
  for (const candidate of mediaPathCandidates(sourceValue)) {
    try {
      const stat = fs.statSync(candidate);
      if (stat.isFile()) return { path: candidate, stat };
    } catch {
      // try next candidate
    }
  }
  return null;
}

export async function resolveExistingMediaFile(sourceValue: string): Promise<{
  path: string;
  stat: fs.Stats;
} | null> {
  for (const candidate of mediaPathCandidates(sourceValue)) {
    const stat = await fs.promises.stat(candidate).catch(() => null);
    if (stat?.isFile()) return { path: candidate, stat };
  }
  return null;
}
