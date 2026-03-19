import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs/promises";
import http, { type IncomingMessage, type Server, type ServerResponse } from "node:http";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const body = Buffer.concat(chunks).toString("utf8");
  if (!body.trim()) return {};
  return JSON.parse(body) as Record<string, unknown>;
}

async function getFreePort(): Promise<number> {
  const server = http.createServer((_req, res) => {
    res.statusCode = 204;
    res.end();
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const { port } = address;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}

async function waitFor<T>(
  read: () => Promise<T>,
  predicate: (value: T) => boolean,
  timeoutMs: number,
  label: string
): Promise<T> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const value = await read();
    if (predicate(value)) return value;
    await sleep(120);
  }
  throw new Error(`timeout:${label}:${timeoutMs}`);
}

async function waitForHttpOk(url: string, timeoutMs: number): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // server not ready yet
    }
    await sleep(100);
  }
  throw new Error(`timeout:http_ready:${url}`);
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

async function stopChild(child: ChildProcessWithoutNullStreams): Promise<void> {
  if (child.exitCode !== null || child.killed) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise<void>((resolve) => {
      child.once("exit", () => resolve());
    }),
    sleep(2_000).then(() => {
      if (child.exitCode === null) child.kill("SIGKILL");
    }),
  ]);
}

test("qr overlay forces guide surface for gallery media", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "c3-node-qr-guide-"));
  const cacheDir = path.join(tempRoot, "cache");
  const runtimeDir = path.join(tempRoot, "runtime");
  const mediaPath = path.join(tempRoot, "qr-media.mp4");
  const chromiumLog = path.join(tempRoot, "mock-chromium.log");
  const mpvLog = path.join(tempRoot, "mock-mpv.log");
  const chromiumBinPath = path.join(tempRoot, "mock-chromium.sh");
  const mpvBinPath = path.join(tempRoot, "mock-mpv.sh");
  const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const localNodePath = path.join(packageDir, "src/local-node.ts");

  const nodeId = "node-qr-guide";
  const namespace = "test";

  let nodeProcess: ChildProcessWithoutNullStreams | null = null;
  let controlServer: Server | null = null;
  let guideServer: Server | null = null;

  try {
    await fs.mkdir(cacheDir, { recursive: true });
    await fs.mkdir(runtimeDir, { recursive: true });
    await fs.writeFile(mediaPath, Buffer.from("qr-guide-media", "utf8"));

    await fs.writeFile(
      chromiumBinPath,
      `#!/usr/bin/env bash
echo "$@" >> "${chromiumLog}"
sleep 3600
`,
      { mode: 0o755 }
    );
    await fs.writeFile(
      mpvBinPath,
      `#!/usr/bin/env bash
echo "$@" >> "${mpvLog}"
sleep 3600
`,
      { mode: 0o755 }
    );

    const guidePort = await getFreePort();
    const guideBase = `http://127.0.0.1:${guidePort}`;
    guideServer = http.createServer((req, res) => {
      const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
      if (pathname === "/") {
        res.statusCode = 200;
        res.setHeader("content-type", "text/html; charset=utf-8");
        res.end("<html><body>guide</body></html>");
        return;
      }
      res.statusCode = 404;
      res.end("not_found");
    });
    await new Promise<void>((resolve, reject) => {
      guideServer?.once("error", reject);
      guideServer?.listen(guidePort, "127.0.0.1", () => resolve());
    });

    const controlPort = await getFreePort();
    controlServer = http.createServer(async (req, res) => {
      const method = req.method ?? "GET";
      const url = new URL(req.url ?? "/", "http://localhost");
      const pathname = url.pathname;

      if (method === "GET" && pathname === `/api/v1/runtime/resolve/${nodeId}`) {
        sendJson(res, 200, {
          ok: true,
          screenId: nodeId,
          namespace,
          desired: {
            revision: 1,
            target: { kind: "media", id: "m-qr-1" },
            launch: { mode: "gallery", qr: true },
          },
          resolved: {
            items: [
              {
                itemId: "m-qr-1:0",
                mediaId: "m-qr-1",
                sourceType: "path",
                sourceValue: mediaPath,
                cache: true,
                renderer: "mpv",
                title: "QR Media",
              },
            ],
            warnings: [],
            cache: { total: 1, cacheable: 1 },
            renderers: { mpv: 1, web: 0 },
          },
        });
        return;
      }

      if (
        method === "POST" &&
        pathname.startsWith("/api/v1/nodes/") &&
        pathname.endsWith("/runtime-report")
      ) {
        await readJson(req);
        sendJson(res, 200, { ok: true });
        return;
      }

      sendJson(res, 404, { ok: false, error: "not_found" });
    });
    await new Promise<void>((resolve, reject) => {
      controlServer?.once("error", reject);
      controlServer?.listen(controlPort, "127.0.0.1", () => resolve());
    });

    const nodePort = await getFreePort();
    const serverPort = await getFreePort();
    const controlBase = `http://127.0.0.1:${controlPort}`;

    nodeProcess = spawn(
      process.execPath,
      [
        "--import",
        "tsx",
        localNodePath,
        "--api",
        controlBase,
        "--node-id",
        nodeId,
        "--namespace",
        namespace,
        "--poll-ms",
        "120",
        "--node-port",
        String(nodePort),
        "--server-port",
        String(serverPort),
        "--guide-base-url",
        guideBase,
        "--cache-dir",
        cacheDir,
        "--runtime-dir",
        runtimeDir,
        "--chromium-bin",
        chromiumBinPath,
        "--mpv-bin",
        mpvBinPath,
        "--switch-overlap-ms",
        "0",
      ],
      {
        cwd: packageDir,
        stdio: "pipe",
      }
    );

    await waitForHttpOk(`http://127.0.0.1:${nodePort}/health`, 10_000);
    await waitFor(
      async () => {
        const statusRes = await fetch(`http://127.0.0.1:${nodePort}/status`);
        return (await statusRes.json()) as {
          runtime: {
            backend: string;
            activeRevision: number | null;
            cacheReady: number;
            cacheTotal: number;
          };
        };
      },
      (json) =>
        json.runtime.backend === "chromium" &&
        json.runtime.activeRevision === 1 &&
        json.runtime.cacheReady === 1 &&
        json.runtime.cacheTotal === 1,
      10_000,
      "chromium_backend_active"
    );

    const chromiumArgs = await waitFor(
      async () => (await fs.readFile(chromiumLog, "utf8").catch(() => "")).trim(),
      (value) => value.length > 0,
      10_000,
      "chromium_spawned"
    );
    assert.match(chromiumArgs, /qr=1/);
    assert.match(chromiumArgs, /targetKind=media/);

    const mpvArgs = (await fs.readFile(mpvLog, "utf8").catch(() => "")).trim();
    assert.equal(mpvArgs, "");

    const cacheEntries = await fs.readdir(cacheDir);
    const expectedCacheFile = `${createHash("sha1")
      .update(`m-qr-1:${mediaPath}`)
      .digest("hex")}.mp4`;
    assert.deepEqual(cacheEntries, [expectedCacheFile]);
  } finally {
    if (nodeProcess) await stopChild(nodeProcess);
    if (controlServer) await closeServer(controlServer);
    if (guideServer) await closeServer(guideServer);
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});
