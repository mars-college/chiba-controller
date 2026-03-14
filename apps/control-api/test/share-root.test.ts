import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
  getAssetsRoot,
  getDefaultShareRoot,
  getShareRoot,
  mediaPathCandidates,
  resolveExistingMediaFile,
  resolveExistingMediaFileSync,
} from "../src/share-root.ts";

test("default share root is persistent and outside the OS temp dir", () => {
  const prev = process.env.SHARE_ROOT;
  delete process.env.SHARE_ROOT;
  try {
    assert.equal(getShareRoot(), getDefaultShareRoot());
    assert.equal(getShareRoot().startsWith(path.join(os.tmpdir(), "share-root")), false);
    assert.match(getShareRoot(), new RegExp(`\\${path.sep}\\.local\\${path.sep}share-root$`));
  } finally {
    if (typeof prev === "string") process.env.SHARE_ROOT = prev;
    else delete process.env.SHARE_ROOT;
  }
});

test("legacy asset paths fall back to the current share root", async () => {
  const prev = process.env.SHARE_ROOT;
  const shareRoot = await fs.mkdtemp(path.join(os.tmpdir(), "c3-share-root-"));
  process.env.SHARE_ROOT = shareRoot;
  try {
    const expectedPath = path.join(getAssetsRoot(), "nested", "asset.jpg");
    await fs.mkdir(path.dirname(expectedPath), { recursive: true });
    await fs.writeFile(expectedPath, "asset-bytes");

    const legacyPath = path.join("/share", "chiba-cable", "assets", "nested", "asset.jpg");
    const candidates = mediaPathCandidates(legacyPath);
    assert.deepEqual(candidates, [legacyPath, expectedPath]);

    const resolvedAsync = await resolveExistingMediaFile(legacyPath);
    assert.equal(resolvedAsync?.path, expectedPath);
    assert.equal(resolvedAsync?.stat.isFile(), true);

    const resolvedSync = resolveExistingMediaFileSync(legacyPath);
    assert.equal(resolvedSync?.path, expectedPath);
    assert.equal(resolvedSync?.stat.isFile(), true);
  } finally {
    if (typeof prev === "string") process.env.SHARE_ROOT = prev;
    else delete process.env.SHARE_ROOT;
    await fs.rm(shareRoot, { recursive: true, force: true });
  }
});
