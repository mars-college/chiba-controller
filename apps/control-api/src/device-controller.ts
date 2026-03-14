import { randomUUID } from "node:crypto";
import dgram from "node:dgram";
import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import { fileURLToPath } from "node:url";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import type { Cable3Db } from "@chiba-cable3/db";
import { schema } from "@chiba-cable3/db";

import tplinkPkg from "tplink-smarthome-api";

type TplinkClient = {
  startDiscovery(args: { deviceTypes: string[]; discoveryTimeout: number }): void;
  stopDiscovery(): void;
  on(event: "plug-new" | "error", cb: (value: any) => void): void;
  removeListener(event: "plug-new" | "error", cb: (value: any) => void): void;
  getPlug(args: { host: string; sysInfo: Record<string, unknown> }): {
    getSysInfo(): Promise<Record<string, unknown>>;
    setPowerState(on: boolean): Promise<void>;
    getPowerState(): Promise<boolean>;
  };
};

const { Client } = tplinkPkg as unknown as {
  Client: new () => TplinkClient;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");

const MULTICAST_ADDRESS = "239.255.255.250";
const GOVEE_SCAN_PORT = 4001;
const GOVEE_RESPONSE_PORT = 4002;
const DEFAULT_LIGHT_PORT = 4003;
const UDP_TIMEOUT_MS = 2_000;
const DEFAULT_DISCOVERY_TIMEOUT_MS = 5_000;
const DISCOVERY_SCAN_ATTEMPTS = 3;
const DISCOVERY_SCAN_ATTEMPT_DELAY_MS = 1_000;
const AUTO_DISCOVERY_INTERVAL_MS = 30 * 60 * 1_000;

const GOVEE_CLOUD_BASE_URL = "https://openapi.api.govee.com/router/api/v1";
const GOVEE_CLOUD_TIMEOUT_MS = 10_000;

const LIGHT_ALIASES: Record<string, string> = {
  gw1: "Gallery West 1",
  gw2: "Gallery West 2",
  ge1: "Gallery East 1",
  ge2: "Gallery East 2",
  a: "Auditorium",
  aud: "Auditorium",
  auditorium: "Auditorium",
  mm: "Mimos",
  m: "Mimos",
  mimos: "Mimos",
  t: "Terrace",
  terrace: "Terrace",
};

const BreakpointTimeTypeSchema = z.union([
  z.literal("clock"),
  z.literal("sunrise"),
  z.literal("sunset"),
]);

type BreakpointTimeType = z.infer<typeof BreakpointTimeTypeSchema>;

const LightControlRequestSchema = z
  .object({
    power: z.boolean().optional(),
    hue: z.number().min(0).max(360).optional(),
    saturation: z.number().min(0).max(100).optional(),
    brightness: z.number().min(0).max(100).optional(),
    kelvin: z.number().min(2000).max(9000).optional(),
  })
  .strict();

type LightControlRequest = z.infer<typeof LightControlRequestSchema>;

const PlugControlRequestSchema = z
  .object({
    power: z.boolean(),
  })
  .strict();

type PlugControlRequest = z.infer<typeof PlugControlRequestSchema>;

const LightScheduleBreakpointInputSchema = z
  .object({
    timeType: BreakpointTimeTypeSchema,
    time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    offsetMinutes: z.number().int().optional(),
    power: z.boolean(),
    brightness: z.number().min(0).max(100),
    hue: z.number().min(0).max(360).optional(),
    saturation: z.number().min(0).max(100).optional(),
    kelvin: z.number().min(2000).max(9000).optional(),
  })
  .strict();

const SetLightScheduleRequestSchema = z
  .object({
    enabled: z.boolean(),
    breakpoints: z.array(LightScheduleBreakpointInputSchema),
  })
  .strict();

const PlugScheduleBreakpointInputSchema = z
  .object({
    timeType: BreakpointTimeTypeSchema,
    time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    offsetMinutes: z.number().int().optional(),
    power: z.boolean(),
  })
  .strict();

const SetPlugScheduleRequestSchema = z
  .object({
    enabled: z.boolean(),
    breakpoints: z.array(PlugScheduleBreakpointInputSchema),
  })
  .strict();

const CreatePresetRequestSchema = z
  .object({
    name: z.string().min(1),
    settings: z
      .array(
        z
          .object({
            lightId: z.string().min(1),
            power: z.boolean().optional(),
            hue: z.number().min(0).max(360).optional(),
            saturation: z.number().min(0).max(100).optional(),
            brightness: z.number().min(0).max(100).optional(),
            kelvin: z.number().min(2000).max(9000).optional(),
          })
          .strict()
      )
      .min(1),
  })
  .strict();

const ManualLightInputSchema = z
  .object({
    id: z.string().min(1).optional(),
    name: z.string().min(1).optional(),
    ip: z.string().min(1).optional(),
    ipAddress: z.string().min(1).optional(),
    port: z.number().int().min(1).max(65535).optional(),
    deviceId: z.string().min(1).optional(),
    sku: z.string().min(1).optional(),
    deviceType: z.string().min(1).optional(),
  })
  .strict();

type LightState = {
  lightId: string;
  power: boolean;
  hue: number;
  saturation: number;
  brightness: number;
  kelvin?: number;
  updatedAt: number;
};

type PlugState = {
  plugId: string;
  power: boolean;
  updatedAt: number;
};

type LightScheduleBreakpoint = {
  id: string;
  timeType: BreakpointTimeType;
  time?: string;
  offsetMinutes?: number;
  power: boolean;
  brightness: number;
  hue?: number;
  saturation?: number;
  kelvin?: number;
};

type PlugScheduleBreakpoint = {
  id: string;
  timeType: BreakpointTimeType;
  time?: string;
  offsetMinutes?: number;
  power: boolean;
};

type DiscoveredLight = {
  ip: string;
  deviceId: string;
  sku: string;
  name?: string;
};

type DiscoveredPlug = {
  ip: string;
  deviceId: string;
  alias: string;
  model: string;
};

type LightConfigFile = {
  lights: Array<{ id: string; name: string; ip: string; deviceId?: string }>;
  port?: number;
};

type PlugConfigFile = {
  plugs: Array<{ id: string; name: string; ip: string; deviceId?: string; model?: string }>;
};

type CloudDevice = {
  sku: string;
  device: string;
  deviceName: string;
};

function nowMs(): number {
  return Date.now();
}

function responseSuccess(
  res: FastifyReply,
  payload?: { data?: unknown; message?: string },
  statusCode = 200
): void {
  const out: Record<string, unknown> = { success: true };
  if (payload && payload.data !== undefined) out.data = payload.data;
  if (payload && payload.message) out.message = payload.message;
  res.status(statusCode).send(out);
}

function responseError(res: FastifyReply, message: string, statusCode = 400): void {
  res.status(statusCode).send({ success: false, error: message });
}

function paramsOf(req: FastifyRequest): Record<string, unknown> {
  if (req.params && typeof req.params === "object") {
    return req.params as Record<string, unknown>;
  }
  return {};
}

function bodyOf(req: FastifyRequest): Record<string, unknown> {
  if (req.body && typeof req.body === "object") {
    return req.body as Record<string, unknown>;
  }
  return {};
}

function requestParam(req: FastifyRequest, key: string): string {
  const value = paramsOf(req)[key];
  return typeof value === "string" ? value.trim() : "";
}

function log(
  app: FastifyInstance,
  level: "debug" | "info" | "warn" | "error",
  message: string,
  meta?: Record<string, unknown>
): void {
  const payload = meta ? { scope: "devices", ...meta } : { scope: "devices" };
  const logger = app.log as unknown as Record<string, (...args: unknown[]) => void>;
  const fn = logger[level];
  if (typeof fn === "function") {
    fn(payload, message);
    return;
  }
  const line = JSON.stringify({ level, message, ...payload });
  if (level === "error") {
    // eslint-disable-next-line no-console
    console.error(line);
    return;
  }
  // eslint-disable-next-line no-console
  console.log(line);
}

function normalizeSubnet(input: string): string | null {
  const trimmed = input.trim();
  const m = trimmed.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const parts = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (parts.some((part) => part < 0 || part > 255 || !Number.isInteger(part))) {
    return null;
  }
  return `${parts[0]}.${parts[1]}.${parts[2]}`;
}

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function cleanOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function cleanPort(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(1, Math.min(65535, Math.round(value)));
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.max(1, Math.min(65535, Math.round(parsed)));
    }
  }
  return fallback;
}

function parseJsonFile<T>(filePath: string): T | null {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

function readLightsConfig(): LightConfigFile | null {
  const configuredPath = process.env.CHIBA3_LIGHTS_CONFIG_PATH?.trim();
  const configPath =
    configuredPath && configuredPath.length > 0
      ? configuredPath
      : path.join(REPO_ROOT, "config", "lights.json");
  const parsed = parseJsonFile<LightConfigFile>(configPath);
  if (!parsed || !Array.isArray(parsed.lights)) return null;
  return parsed;
}

function readPlugsConfig(): PlugConfigFile | null {
  const configuredPath = process.env.CHIBA3_PLUGS_CONFIG_PATH?.trim();
  const configPath =
    configuredPath && configuredPath.length > 0
      ? configuredPath
      : path.join(REPO_ROOT, "config", "plugs.json");
  const parsed = parseJsonFile<PlugConfigFile>(configPath);
  if (!parsed || !Array.isArray(parsed.plugs)) return null;
  return parsed;
}

function parseBooleanEnv(key: string, fallback: boolean): boolean {
  const raw = process.env[key];
  if (!raw) return fallback;
  const normalized = raw.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function hsbToRgb(h: number, s: number, b: number): { r: number; g: number; b: number } {
  const saturation = s / 100;
  const brightness = b / 100;
  const hue = h / 360;

  let r = 0;
  let g = 0;
  let bl = 0;

  if (saturation === 0) {
    r = brightness;
    g = brightness;
    bl = brightness;
  } else {
    const i = Math.floor(hue * 6);
    const f = hue * 6 - i;
    const p = brightness * (1 - saturation);
    const q = brightness * (1 - f * saturation);
    const t = brightness * (1 - (1 - f) * saturation);

    switch (i % 6) {
      case 0:
        r = brightness;
        g = t;
        bl = p;
        break;
      case 1:
        r = q;
        g = brightness;
        bl = p;
        break;
      case 2:
        r = p;
        g = brightness;
        bl = t;
        break;
      case 3:
        r = p;
        g = q;
        bl = brightness;
        break;
      case 4:
        r = t;
        g = p;
        bl = brightness;
        break;
      default:
        r = brightness;
        g = p;
        bl = q;
        break;
    }
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(bl * 255),
  };
}

function rgbToHsb(r: number, g: number, b: number): { h: number; s: number; b: number } {
  const nr = r / 255;
  const ng = g / 255;
  const nb = b / 255;

  const max = Math.max(nr, ng, nb);
  const min = Math.min(nr, ng, nb);
  const diff = max - min;

  let h = 0;
  const s = max === 0 ? 0 : (diff / max) * 100;
  const br = max * 100;

  if (diff !== 0) {
    switch (max) {
      case nr:
        h = ((ng - nb) / diff) % 6;
        break;
      case ng:
        h = (nb - nr) / diff + 2;
        break;
      default:
        h = (nr - ng) / diff + 4;
        break;
    }
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }

  return { h, s: Math.round(s), b: Math.round(br) };
}

async function sendGoveeCommand(
  ip: string,
  port: number,
  cmd: string,
  data: Record<string, unknown>
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const socket = dgram.createSocket("udp4");
    const message = JSON.stringify({ msg: { cmd, data } });

    const timeout = setTimeout(() => {
      socket.close();
      reject(new Error("UDP timeout"));
    }, UDP_TIMEOUT_MS);

    socket.send(message, port, ip, (err) => {
      clearTimeout(timeout);
      socket.close();
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

function isCloudConfigured(): boolean {
  return Boolean(process.env.GOVEE_API_KEY?.trim());
}

async function goveeCloudRequest(
  method: "GET" | "POST" | "PUT",
  routePath: string,
  body?: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const apiKey = process.env.GOVEE_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GOVEE_API_KEY not configured");
  }

  await new Promise<void>((resolve) => {
    // Avoid accidental tight-loop retries if DNS is unstable.
    setImmediate(resolve);
  });

  return await new Promise((resolve, reject) => {
    const url = new URL(routePath, GOVEE_CLOUD_BASE_URL);
    const payload = body ? JSON.stringify(body) : undefined;

    const req = https.request(
      {
        hostname: url.hostname,
        port: 443,
        path: url.pathname,
        method,
        headers: {
          "Content-Type": "application/json",
          "Govee-API-Key": apiKey,
          ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (chunk) => {
          raw += chunk.toString();
        });
        res.on("end", () => {
          let parsed: Record<string, unknown> = {};
          try {
            parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
          } catch {
            reject(new Error(`Failed to parse Govee cloud response: ${raw.slice(0, 200)}`));
            return;
          }

          if (res.statusCode === 429) {
            reject(new Error("Govee cloud rate limited (429)"));
            return;
          }

          if ((res.statusCode ?? 500) >= 400) {
            const message =
              typeof parsed.message === "string" && parsed.message
                ? parsed.message
                : `status_${res.statusCode}`;
            reject(new Error(`Govee cloud error ${res.statusCode}: ${message}`));
            return;
          }

          resolve(parsed);
        });
      }
    );

    req.on("error", reject);
    req.setTimeout(GOVEE_CLOUD_TIMEOUT_MS, () => {
      req.destroy();
      reject(new Error("Govee cloud request timeout"));
    });

    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

async function cloudControlDevice(
  sku: string,
  device: string,
  capability: { type: string; instance: string; value: unknown }
): Promise<void> {
  await goveeCloudRequest("POST", "/router/api/v1/device/control", {
    requestId: `cable3_${Date.now()}`,
    payload: {
      sku,
      device,
      capability,
    },
  });
}

async function cloudControlPower(sku: string, device: string, on: boolean): Promise<void> {
  await cloudControlDevice(sku, device, {
    type: "devices.capabilities.on_off",
    instance: "powerSwitch",
    value: on ? 1 : 0,
  });
}

async function cloudControlBrightness(
  sku: string,
  device: string,
  brightness: number
): Promise<void> {
  await cloudControlDevice(sku, device, {
    type: "devices.capabilities.range",
    instance: "brightness",
    value: Math.max(0, Math.min(100, Math.trunc(brightness))),
  });
}

async function cloudControlColorRgb(
  sku: string,
  device: string,
  r: number,
  g: number,
  b: number
): Promise<void> {
  await cloudControlDevice(sku, device, {
    type: "devices.capabilities.color_setting",
    instance: "colorRgb",
    value: r * 65536 + g * 256 + b,
  });
}

async function cloudControlColorTemp(sku: string, device: string, kelvin: number): Promise<void> {
  await cloudControlDevice(sku, device, {
    type: "devices.capabilities.color_setting",
    instance: "colorTemperatureK",
    value: Math.max(2000, Math.min(9000, Math.trunc(kelvin))),
  });
}

async function cloudListDevices(): Promise<CloudDevice[]> {
  const response = await goveeCloudRequest("GET", "/router/api/v1/user/devices");
  const data = response.data;
  if (!Array.isArray(data)) return [];

  const out: CloudDevice[] = [];
  for (const row of data) {
    if (!row || typeof row !== "object") continue;
    const obj = row as Record<string, unknown>;
    const sku = typeof obj.sku === "string" ? obj.sku : "";
    const device = typeof obj.device === "string" ? obj.device : "";
    const deviceName = typeof obj.deviceName === "string" ? obj.deviceName : "";
    if (!sku || !device) continue;
    out.push({ sku, device, deviceName });
  }
  return out;
}

function passesNameFilter(name: string | undefined): boolean {
  const filter = process.env.GOVEE_FILTER?.trim();
  if (!filter) return true;

  const lowerName = (name || "").toLowerCase();
  if (filter.startsWith("!")) {
    const keyword = filter.slice(1).toLowerCase();
    return !lowerName.includes(keyword);
  }
  return lowerName.includes(filter.toLowerCase());
}

async function getAllLights(db: Cable3Db): Promise<Array<typeof schema.lights.$inferSelect>> {
  return db.select().from(schema.lights).orderBy(asc(schema.lights.name));
}

async function getLightByDeviceId(
  db: Cable3Db,
  deviceId: string
): Promise<typeof schema.lights.$inferSelect | null> {
  const trimmed = deviceId.trim();
  if (!trimmed) return null;
  const rows = await db
    .select()
    .from(schema.lights)
    .where(eq(schema.lights.deviceId, trimmed))
    .limit(1);
  return rows[0] ?? null;
}

async function getLightById(
  db: Cable3Db,
  lightId: string
): Promise<typeof schema.lights.$inferSelect | null> {
  const byId = await db
    .select()
    .from(schema.lights)
    .where(eq(schema.lights.id, lightId))
    .limit(1);
  if (byId[0]) return byId[0];

  const aliasName = LIGHT_ALIASES[lightId.toLowerCase()];
  const allLights = await getAllLights(db);

  if (aliasName) {
    const byAlias = allLights.find((row) => row.name.toLowerCase() === aliasName.toLowerCase());
    if (byAlias) return byAlias;
  }

  const byName = allLights.find((row) => row.name.toLowerCase() === lightId.toLowerCase());
  return byName ?? null;
}

function fallbackLightName(args: {
  name?: string | null;
  sku?: string | null;
  id?: string | null;
  deviceId?: string | null;
  ipAddress: string;
}): string {
  const explicit = args.name?.trim();
  if (explicit) return explicit;
  const sku = args.sku?.trim();
  if (sku) return `Light (${sku})`;
  const id = args.id?.trim();
  if (id) return id;
  const deviceId = args.deviceId?.trim();
  if (deviceId) return `Light ${deviceId.slice(-6)}`;
  return args.ipAddress;
}

async function allocateLightId(db: Cable3Db, preferred?: string | null): Promise<string> {
  const base = toSlug(preferred?.trim() || "") || `light-${Date.now()}`;
  let candidate = base;
  let suffix = 2;
  while (true) {
    const existing = await db
      .select({ id: schema.lights.id })
      .from(schema.lights)
      .where(eq(schema.lights.id, candidate))
      .limit(1);
    if (!existing[0]) return candidate;
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
}

function serializeLightRecord(args: {
  light: typeof schema.lights.$inferSelect;
  state?: typeof schema.lightState.$inferSelect | LightState | null;
  reachable: boolean;
}) {
  const state = args.state;
  return {
    id: args.light.id,
    name: args.light.name,
    ipAddress: args.light.ipAddress,
    port: args.light.port,
    ...(args.light.deviceId ? { deviceId: args.light.deviceId } : {}),
    ...(args.light.sku ? { sku: args.light.sku } : {}),
    ...(args.light.deviceType ? { deviceType: args.light.deviceType } : {}),
    createdAt: args.light.createdAt,
    updatedAt: args.light.updatedAt,
    state: state
      ? {
          lightId: args.light.id,
          power: state.power,
          hue: state.hue,
          saturation: state.saturation,
          brightness: state.brightness,
          ...(typeof state.kelvin === "number" ? { kelvin: state.kelvin } : {}),
          updatedAt: state.updatedAt,
        }
      : null,
    reachable: args.reachable,
  };
}

async function createManualLight(args: {
  db: Cable3Db;
  input: z.infer<typeof ManualLightInputSchema>;
}): Promise<typeof schema.lights.$inferSelect> {
  const ipAddress = cleanOptionalString(args.input.ipAddress ?? args.input.ip);
  if (!ipAddress) {
    throw new Error("ip_address_required");
  }

  const name = fallbackLightName({
    name: cleanOptionalString(args.input.name),
    sku: cleanOptionalString(args.input.sku),
    id: cleanOptionalString(args.input.id),
    deviceId: cleanOptionalString(args.input.deviceId),
    ipAddress,
  });
  const preferredId = cleanOptionalString(args.input.id) ?? toSlug(name);
  const id = await allocateLightId(args.db, preferredId);
  const now = nowMs();

  await args.db.insert(schema.lights).values({
    id,
    name,
    ipAddress,
    port: cleanPort(args.input.port, DEFAULT_LIGHT_PORT),
    deviceId: cleanOptionalString(args.input.deviceId),
    sku: cleanOptionalString(args.input.sku),
    deviceType: cleanOptionalString(args.input.deviceType),
    createdAt: now,
    updatedAt: now,
  });

  const created = await getLightById(args.db, id);
  if (!created) {
    throw new Error("light_create_failed");
  }
  return created;
}

async function updateManualLight(args: {
  db: Cable3Db;
  lightId: string;
  input: z.infer<typeof ManualLightInputSchema>;
}): Promise<typeof schema.lights.$inferSelect | null> {
  const existing = await getLightById(args.db, args.lightId);
  if (!existing) return null;

  const nextName =
    cleanOptionalString(args.input.name) ?? existing.name;
  const nextIpAddress =
    cleanOptionalString(args.input.ipAddress ?? args.input.ip) ?? existing.ipAddress;

  if (!nextName.trim()) {
    throw new Error("name_required");
  }
  if (!nextIpAddress.trim()) {
    throw new Error("ip_address_required");
  }

  await args.db
    .update(schema.lights)
    .set({
      name: nextName,
      ipAddress: nextIpAddress,
      port: cleanPort(args.input.port, existing.port),
      deviceId:
        args.input.deviceId !== undefined
          ? cleanOptionalString(args.input.deviceId)
          : existing.deviceId,
      sku: args.input.sku !== undefined ? cleanOptionalString(args.input.sku) : existing.sku,
      deviceType:
        args.input.deviceType !== undefined
          ? cleanOptionalString(args.input.deviceType)
          : existing.deviceType,
      updatedAt: nowMs(),
    })
    .where(eq(schema.lights.id, existing.id));

  return await getLightById(args.db, existing.id);
}

async function importLightRecord(args: {
  db: Cable3Db;
  input: z.infer<typeof ManualLightInputSchema>;
}): Promise<"added" | "updated"> {
  const input = args.input;
  const requestedId = cleanOptionalString(input.id);
  const requestedDeviceId = cleanOptionalString(input.deviceId);
  const requestedIp =
    cleanOptionalString(input.ipAddress ?? input.ip);

  let existing: typeof schema.lights.$inferSelect | null = null;
  if (requestedId) {
    existing = await getLightById(args.db, requestedId);
  }
  if (!existing && requestedDeviceId) {
    existing = await getLightByDeviceId(args.db, requestedDeviceId);
  }
  if (!existing && requestedIp) {
    const rows = await args.db
      .select()
      .from(schema.lights)
      .where(eq(schema.lights.ipAddress, requestedIp))
      .limit(1);
    existing = rows[0] ?? null;
  }

  if (existing) {
    await updateManualLight({
      db: args.db,
      lightId: existing.id,
      input,
    });
    return "updated";
  }

  await createManualLight({ db: args.db, input });
  return "added";
}

async function getAllPlugs(db: Cable3Db): Promise<Array<typeof schema.plugs.$inferSelect>> {
  return db.select().from(schema.plugs).orderBy(asc(schema.plugs.name));
}

async function getPlugById(
  db: Cable3Db,
  plugId: string
): Promise<typeof schema.plugs.$inferSelect | null> {
  const byId = await db
    .select()
    .from(schema.plugs)
    .where(eq(schema.plugs.id, plugId))
    .limit(1);
  if (byId[0]) return byId[0];

  const allPlugs = await getAllPlugs(db);
  const byName = allPlugs.find((row) => row.name.toLowerCase() === plugId.toLowerCase());
  return byName ?? null;
}

async function setLightPower(light: typeof schema.lights.$inferSelect, on: boolean): Promise<void> {
  if (isCloudConfigured() && light.deviceId && light.sku) {
    try {
      await cloudControlPower(light.sku, light.deviceId, on);
      return;
    } catch {
      // Fall back to UDP.
    }
  }
  await sendGoveeCommand(light.ipAddress, light.port, "turn", { value: on ? 1 : 0 });
}

async function setLightBrightness(
  light: typeof schema.lights.$inferSelect,
  brightness: number
): Promise<void> {
  if (isCloudConfigured() && light.deviceId && light.sku) {
    try {
      await cloudControlBrightness(light.sku, light.deviceId, brightness);
      return;
    } catch {
      // Fall back to UDP.
    }
  }
  await sendGoveeCommand(light.ipAddress, light.port, "brightness", {
    value: Math.max(0, Math.min(100, Math.round(brightness))),
  });
}

async function setLightColor(
  light: typeof schema.lights.$inferSelect,
  hue: number,
  saturation: number,
  brightness: number
): Promise<void> {
  const rgb = hsbToRgb(hue, saturation, brightness);

  if (isCloudConfigured() && light.deviceId && light.sku) {
    try {
      await cloudControlColorRgb(light.sku, light.deviceId, rgb.r, rgb.g, rgb.b);
      return;
    } catch {
      // Fall back to UDP.
    }
  }

  await sendGoveeCommand(light.ipAddress, light.port, "colorwc", {
    color: rgb,
    colorTemInKelvin: 0,
  });
}

async function setLightTemperature(
  light: typeof schema.lights.$inferSelect,
  kelvin: number
): Promise<void> {
  const clamped = Math.max(2000, Math.min(9000, Math.round(kelvin)));

  if (isCloudConfigured() && light.deviceId && light.sku) {
    try {
      await cloudControlColorTemp(light.sku, light.deviceId, clamped);
      return;
    } catch {
      // Fall back to UDP.
    }
  }

  await sendGoveeCommand(light.ipAddress, light.port, "colorwc", {
    color: { r: 0, g: 0, b: 0 },
    colorTemInKelvin: clamped,
  });
}

async function controlLight(args: {
  db: Cable3Db;
  light: typeof schema.lights.$inferSelect;
  request: LightControlRequest;
}): Promise<LightState> {
  const stateRows = await args.db
    .select()
    .from(schema.lightState)
    .where(eq(schema.lightState.lightId, args.light.id))
    .limit(1);

  const current = stateRows[0] ?? {
    lightId: args.light.id,
    power: false,
    hue: 0,
    saturation: 100,
    brightness: 100,
    kelvin: null,
    updatedAt: 0,
  };

  let nextPower = current.power;
  let nextHue = current.hue;
  let nextSaturation = current.saturation;
  let nextBrightness = current.brightness;
  let nextKelvin = current.kelvin;

  if (args.request.power !== undefined) {
    await setLightPower(args.light, args.request.power);
    nextPower = args.request.power;
  }

  if (args.request.kelvin !== undefined) {
    await setLightTemperature(args.light, args.request.kelvin);
    nextKelvin = Math.round(args.request.kelvin);
    if (args.request.brightness !== undefined) {
      await setLightBrightness(args.light, args.request.brightness);
      nextBrightness = Math.round(args.request.brightness);
    }
  } else if (args.request.hue !== undefined || args.request.saturation !== undefined) {
    nextHue = Math.round(args.request.hue ?? nextHue);
    nextSaturation = Math.round(args.request.saturation ?? nextSaturation);
    nextBrightness = Math.round(args.request.brightness ?? nextBrightness);
    nextKelvin = null;
    await setLightColor(args.light, nextHue, nextSaturation, nextBrightness);
  } else if (args.request.brightness !== undefined) {
    nextBrightness = Math.round(args.request.brightness);
    await setLightBrightness(args.light, nextBrightness);
  }

  const updatedAt = nowMs();

  await args.db
    .insert(schema.lightState)
    .values({
      lightId: args.light.id,
      power: nextPower,
      hue: nextHue,
      saturation: nextSaturation,
      brightness: nextBrightness,
      kelvin: nextKelvin,
      updatedAt,
    })
    .onConflictDoUpdate({
      target: schema.lightState.lightId,
      set: {
        power: nextPower,
        hue: nextHue,
        saturation: nextSaturation,
        brightness: nextBrightness,
        kelvin: nextKelvin,
        updatedAt,
      },
    });

  return {
    lightId: args.light.id,
    power: nextPower,
    hue: nextHue,
    saturation: nextSaturation,
    brightness: nextBrightness,
    ...(typeof nextKelvin === "number" ? { kelvin: nextKelvin } : {}),
    updatedAt,
  };
}

type GoveeStatusResponse = {
  msg?: {
    data?: {
      onOff?: number;
      brightness?: number;
      color?: { r?: number; g?: number; b?: number };
      colorTemInKelvin?: number;
    };
  };
};

async function queryLightState(
  light: typeof schema.lights.$inferSelect
): Promise<LightState | null> {
  return await new Promise((resolve) => {
    const socket = dgram.createSocket("udp4");
    const message = JSON.stringify({ msg: { cmd: "devStatus", data: {} } });

    const timeout = setTimeout(() => {
      socket.close();
      resolve(null);
    }, UDP_TIMEOUT_MS);

    socket.on("message", (raw) => {
      clearTimeout(timeout);
      socket.close();

      try {
        const response = JSON.parse(raw.toString()) as GoveeStatusResponse;
        const data = response.msg?.data;
        if (!data) {
          resolve(null);
          return;
        }

        const brightness =
          typeof data.brightness === "number"
            ? Math.max(0, Math.min(100, Math.round(data.brightness)))
            : 100;
        const color = data.color ?? {};
        const rgb = {
          r: typeof color.r === "number" ? color.r : 0,
          g: typeof color.g === "number" ? color.g : 0,
          b: typeof color.b === "number" ? color.b : 0,
        };
        const kelvin =
          typeof data.colorTemInKelvin === "number" && data.colorTemInKelvin > 0
            ? Math.round(data.colorTemInKelvin)
            : 0;

        let hue = 0;
        let saturation = 100;
        if (kelvin === 0) {
          const hsb = rgbToHsb(rgb.r, rgb.g, rgb.b);
          hue = hsb.h;
          saturation = hsb.s;
        }

        resolve({
          lightId: light.id,
          power: Boolean(data.onOff),
          hue,
          saturation,
          brightness,
          ...(kelvin > 0 ? { kelvin } : {}),
          updatedAt: nowMs(),
        });
      } catch {
        resolve(null);
      }
    });

    socket.send(message, light.port, light.ipAddress, (err) => {
      if (err) {
        clearTimeout(timeout);
        socket.close();
        resolve(null);
      }
    });
  });
}

async function refreshLightState(args: {
  db: Cable3Db;
  light: typeof schema.lights.$inferSelect;
}): Promise<LightState | null> {
  const state = await queryLightState(args.light);
  if (!state) return null;

  await args.db
    .insert(schema.lightState)
    .values({
      lightId: args.light.id,
      power: state.power,
      hue: state.hue,
      saturation: state.saturation,
      brightness: state.brightness,
      kelvin: typeof state.kelvin === "number" ? state.kelvin : null,
      updatedAt: state.updatedAt,
    })
    .onConflictDoUpdate({
      target: schema.lightState.lightId,
      set: {
        power: state.power,
        hue: state.hue,
        saturation: state.saturation,
        brightness: state.brightness,
        kelvin: typeof state.kelvin === "number" ? state.kelvin : null,
        updatedAt: state.updatedAt,
      },
    });

  return state;
}

async function refreshAllLightStates(db: Cable3Db): Promise<Map<string, LightState | null>> {
  const lights = await getAllLights(db);
  const out = new Map<string, LightState | null>();
  await Promise.all(
    lights.map(async (light) => {
      const state = await refreshLightState({ db, light });
      out.set(light.id, state);
    })
  );
  return out;
}

async function renameLight(args: {
  db: Cable3Db;
  lightId: string;
  name: string;
}): Promise<typeof schema.lights.$inferSelect | null> {
  const existing = await getLightById(args.db, args.lightId);
  if (!existing) return null;

  const updatedAt = nowMs();
  await args.db
    .update(schema.lights)
    .set({ name: args.name, updatedAt })
    .where(eq(schema.lights.id, existing.id));

  return await getLightById(args.db, existing.id);
}

async function deleteLight(args: { db: Cable3Db; lightId: string }): Promise<boolean> {
  const existing = await getLightById(args.db, args.lightId);
  if (!existing) return false;
  await args.db.delete(schema.lights).where(eq(schema.lights.id, existing.id));
  return true;
}

async function syncLightsFromConfig(args: {
  db: Cable3Db;
  app: FastifyInstance;
}): Promise<{ added: number; updated: number; total: number }> {
  const config = readLightsConfig();
  if (!config) {
    return { added: 0, updated: 0, total: 0 };
  }

  const filter = process.env.GOVEE_FILTER?.trim();
  const sourceLights = filter
    ? config.lights.filter((row) => passesNameFilter(row.name))
    : config.lights;

  const port =
    typeof config.port === "number" && Number.isFinite(config.port)
      ? Math.max(1, Math.min(65535, Math.round(config.port)))
      : DEFAULT_LIGHT_PORT;

  let added = 0;
  let updated = 0;

  await args.db.transaction(async (tx) => {
    for (const row of sourceLights) {
      const id = String(row.id || "").trim();
      const name = String(row.name || "").trim();
      const ip = String(row.ip || "").trim();
      const deviceId = row.deviceId ? String(row.deviceId).trim() : "";
      if (!id || !name || !ip) continue;

      const existingRows = await tx
        .select()
        .from(schema.lights)
        .where(eq(schema.lights.id, id))
        .limit(1);
      const existing = existingRows[0];
      const updatedAt = nowMs();

      if (!existing) {
        await tx.insert(schema.lights).values({
          id,
          name,
          ipAddress: ip,
          port,
          deviceId: deviceId || null,
          sku: null,
          deviceType: null,
          createdAt: updatedAt,
          updatedAt,
        });
        added += 1;
        continue;
      }

      const hasChange =
        existing.name !== name ||
        existing.ipAddress !== ip ||
        existing.port !== port ||
        (deviceId && existing.deviceId !== deviceId);
      if (!hasChange) continue;

      await tx
        .update(schema.lights)
        .set({
          name,
          ipAddress: ip,
          port,
          ...(deviceId ? { deviceId } : {}),
          updatedAt,
        })
        .where(eq(schema.lights.id, id));
      updated += 1;
    }
  });

  log(args.app, "info", "Synced lights from config", {
    added,
    updated,
    total: sourceLights.length,
  });

  return { added, updated, total: sourceLights.length };
}

const GOVEE_SCAN_MESSAGE = JSON.stringify({
  msg: {
    cmd: "scan",
    data: {
      account_topic: "reserve",
    },
  },
});

type GoveeScanResponse = {
  msg?: {
    cmd?: string;
    data?: {
      ip?: string;
      device?: string;
      sku?: string;
    };
  };
};

function sendGoveeScanRequest(app: FastifyInstance): void {
  const sendMulticast = dgram.createSocket({ type: "udp4", reuseAddr: true });
  sendMulticast.on("error", () => {
    try {
      sendMulticast.close();
    } catch {
      // ignore
    }
  });

  sendMulticast.bind(0, () => {
    try {
      sendMulticast.setMulticastTTL(2);
    } catch {
      // ignore
    }

    sendMulticast.send(GOVEE_SCAN_MESSAGE, GOVEE_SCAN_PORT, MULTICAST_ADDRESS, () => {
      try {
        sendMulticast.close();
      } catch {
        // ignore
      }
    });
  });

  const sendBroadcast = dgram.createSocket({ type: "udp4", reuseAddr: true });
  sendBroadcast.on("error", () => {
    try {
      sendBroadcast.close();
    } catch {
      // ignore
    }
  });

  sendBroadcast.bind(0, () => {
    try {
      sendBroadcast.setBroadcast(true);
    } catch {
      // ignore
    }
    sendBroadcast.send(GOVEE_SCAN_MESSAGE, GOVEE_SCAN_PORT, "255.255.255.255", () => {
      try {
        sendBroadcast.close();
      } catch {
        // ignore
      }
    });
  });

  log(app, "debug", "Sent Govee scan request");
}

async function discoverLights(app: FastifyInstance, timeoutMs: number): Promise<DiscoveredLight[]> {
  return await new Promise((resolve, reject) => {
    const discovered = new Map<string, DiscoveredLight>();
    let socket: dgram.Socket | null = null;

    const cleanup = () => {
      if (!socket) return;
      try {
        socket.dropMembership(MULTICAST_ADDRESS);
      } catch {
        // ignore
      }
      try {
        socket.close();
      } catch {
        // ignore
      }
      socket = null;
    };

    try {
      socket = dgram.createSocket({ type: "udp4", reuseAddr: true });

      socket.on("error", (err) => {
        cleanup();
        reject(err);
      });

      socket.on("message", (msg, rinfo) => {
        try {
          const response = JSON.parse(msg.toString()) as GoveeScanResponse;
          if (response.msg?.cmd !== "scan") return;
          const data = response.msg.data;
          if (!data) return;
          const deviceId = (data.device || "").trim();
          const sku = (data.sku || "").trim();
          const ip = (data.ip || rinfo.address || "").trim();
          if (!deviceId || !sku || !ip) return;
          if (!discovered.has(deviceId)) {
            discovered.set(deviceId, { ip, deviceId, sku });
          }
        } catch {
          // ignore malformed packets
        }
      });

      socket.bind(GOVEE_RESPONSE_PORT, "", () => {
        try {
          socket?.addMembership(MULTICAST_ADDRESS);
        } catch {
          // ignore membership errors
        }

        sendGoveeScanRequest(app);
        for (let i = 1; i < DISCOVERY_SCAN_ATTEMPTS; i += 1) {
          setTimeout(() => sendGoveeScanRequest(app), i * DISCOVERY_SCAN_ATTEMPT_DELAY_MS);
        }
      });

      setTimeout(() => {
        cleanup();
        resolve(Array.from(discovered.values()));
      }, timeoutMs);
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}

async function probeLight(ip: string, timeoutMs: number): Promise<DiscoveredLight | null> {
  return await new Promise((resolve) => {
    const listenSocket = dgram.createSocket({ type: "udp4", reuseAddr: true });
    let settled = false;

    const finish = (value: DiscoveredLight | null) => {
      if (settled) return;
      settled = true;
      try {
        listenSocket.close();
      } catch {
        // ignore
      }
      resolve(value);
    };

    const timer = setTimeout(() => finish(null), timeoutMs);

    listenSocket.on("error", () => {
      clearTimeout(timer);
      finish(null);
    });

    listenSocket.on("message", (msg, rinfo) => {
      if (rinfo.address !== ip) return;

      clearTimeout(timer);
      try {
        const response = JSON.parse(msg.toString()) as GoveeScanResponse;
        if (response.msg?.cmd !== "scan") {
          finish(null);
          return;
        }
        const data = response.msg.data;
        if (!data) {
          finish(null);
          return;
        }
        const deviceId = (data.device || "").trim();
        const sku = (data.sku || "").trim();
        const resolvedIp = (data.ip || ip).trim();
        if (!deviceId || !sku || !resolvedIp) {
          finish(null);
          return;
        }
        finish({ ip: resolvedIp, deviceId, sku });
      } catch {
        finish(null);
      }
    });

    listenSocket.bind(GOVEE_RESPONSE_PORT, () => {
      const sendSocket = dgram.createSocket("udp4");
      sendSocket.send(GOVEE_SCAN_MESSAGE, GOVEE_SCAN_PORT, ip, (err) => {
        sendSocket.close();
        if (err) {
          clearTimeout(timer);
          finish(null);
        }
      });
    });
  });
}

async function probeLights(ips: string[], timeoutMs: number): Promise<DiscoveredLight[]> {
  const results = await Promise.all(ips.map((ip) => probeLight(ip, timeoutMs)));
  return results.filter((row): row is DiscoveredLight => row !== null);
}

async function scanSubnet(subnet: string, timeoutMs: number): Promise<DiscoveredLight[]> {
  return await new Promise((resolve) => {
    const discovered = new Map<string, DiscoveredLight>();
    const ips: string[] = [];
    for (let i = 1; i <= 254; i += 1) {
      ips.push(`${subnet}.${i}`);
    }

    const listenSocket = dgram.createSocket({ type: "udp4", reuseAddr: true });

    const cleanup = () => {
      try {
        listenSocket.close();
      } catch {
        // ignore
      }
    };

    listenSocket.on("error", () => {
      cleanup();
      resolve([]);
    });

    listenSocket.on("message", (msg, rinfo) => {
      try {
        const response = JSON.parse(msg.toString()) as GoveeScanResponse;
        if (response.msg?.cmd !== "scan") return;
        const data = response.msg.data;
        if (!data) return;
        const deviceId = (data.device || "").trim();
        const sku = (data.sku || "").trim();
        const ip = (data.ip || rinfo.address || "").trim();
        if (!deviceId || !sku || !ip) return;
        if (!discovered.has(deviceId)) {
          discovered.set(deviceId, { ip, deviceId, sku });
        }
      } catch {
        // ignore
      }
    });

    listenSocket.bind(GOVEE_RESPONSE_PORT, () => {
      const sendSocket = dgram.createSocket("udp4");
      let sent = 0;

      const sendNext = () => {
        if (sent >= ips.length) {
          sendSocket.close();
          return;
        }
        const ip = ips[sent];
        sent += 1;
        sendSocket.send(GOVEE_SCAN_MESSAGE, GOVEE_SCAN_PORT, ip, () => {
          if (sent < ips.length) {
            setTimeout(sendNext, 2);
          } else {
            sendSocket.close();
          }
        });
      };

      sendNext();
    });

    setTimeout(() => {
      cleanup();
      resolve(Array.from(discovered.values()));
    }, timeoutMs);
  });
}

async function syncDiscoveredLights(args: {
  db: Cable3Db;
  discovered: DiscoveredLight[];
  prune?: boolean;
}): Promise<{ added: number; updated: number; pruned: number }> {
  let added = 0;
  let updated = 0;
  let pruned = 0;

  const discoveredDeviceIds = new Set(
    args.discovered.map((row) => row.deviceId).filter((row) => row.length > 0)
  );

  await args.db.transaction(async (tx) => {
    for (const row of args.discovered) {
      const deviceId = row.deviceId.trim();
      const ip = row.ip.trim();
      const sku = row.sku.trim();
      if (!deviceId || !ip || !sku) continue;

      const existingRows = await tx
        .select()
        .from(schema.lights)
        .where(eq(schema.lights.deviceId, deviceId))
        .limit(1);
      const existing = existingRows[0];

      const updatedAt = nowMs();

      if (existing) {
        const nextIp = ip || existing.ipAddress;
        await tx
          .update(schema.lights)
          .set({
            ipAddress: nextIp,
            sku,
            updatedAt,
          })
          .where(eq(schema.lights.id, existing.id));
        updated += 1;
      } else {
        await tx.insert(schema.lights).values({
          id: randomUUID(),
          name: row.name?.trim() || `Light (${sku})`,
          ipAddress: ip,
          port: DEFAULT_LIGHT_PORT,
          deviceId,
          sku,
          deviceType: null,
          createdAt: updatedAt,
          updatedAt,
        });
        added += 1;
      }
    }

    if (args.prune) {
      const existingWithDeviceId = await tx.select().from(schema.lights);
      for (const row of existingWithDeviceId) {
        if (!row.deviceId) continue;
        if (discoveredDeviceIds.has(row.deviceId)) continue;
        await tx.delete(schema.lights).where(eq(schema.lights.id, row.id));
        pruned += 1;
      }
    }
  });

  return { added, updated, pruned };
}

async function pruneLightsByNameFilter(db: Cable3Db): Promise<number> {
  const filter = process.env.GOVEE_FILTER?.trim();
  if (!filter) return 0;

  const allLights = await getAllLights(db);
  const toRemove = allLights.filter((row) => !passesNameFilter(row.name));
  if (toRemove.length === 0) return 0;

  for (const row of toRemove) {
    await db.delete(schema.lights).where(eq(schema.lights.id, row.id));
  }
  return toRemove.length;
}

async function runLightDiscovery(args: {
  db: Cable3Db;
  app: FastifyInstance;
  timeoutMs: number;
  subnet?: string;
  prune?: boolean;
}): Promise<{
  discovered: number;
  added: number;
  updated: number;
  pruned: number;
  lights: DiscoveredLight[];
}> {
  let initialLights: DiscoveredLight[] = [];

  if (isCloudConfigured()) {
    try {
      const cloudDevices = await cloudListDevices();
      if (cloudDevices.length > 0) {
        const existingLights = await args.db.select().from(schema.lights);
        const ipByDeviceId = new Map(
          existingLights
            .filter((row) => row.deviceId)
            .map((row) => [String(row.deviceId), row.ipAddress])
        );
        initialLights = cloudDevices.map((row) => ({
          ip: ipByDeviceId.get(row.device) || "",
          deviceId: row.device,
          sku: row.sku,
          ...(row.deviceName ? { name: row.deviceName } : {}),
        }));
      }
    } catch (error) {
      log(args.app, "warn", "Cloud discovery failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  let lanLights: DiscoveredLight[] = [];
  if (args.subnet) {
    lanLights = await scanSubnet(args.subnet, Math.max(500, args.timeoutMs));
  } else {
    lanLights = await discoverLights(args.app, Math.max(500, args.timeoutMs));
  }

  if (initialLights.length > 0 && lanLights.length > 0) {
    const lanByDeviceId = new Map(lanLights.map((row) => [row.deviceId, row]));
    for (const light of initialLights) {
      const match = lanByDeviceId.get(light.deviceId);
      if (match) {
        light.ip = match.ip;
      }
    }

    const knownCloudIds = new Set(initialLights.map((row) => row.deviceId));
    for (const lan of lanLights) {
      if (!knownCloudIds.has(lan.deviceId)) {
        initialLights.push(lan);
      }
    }
  } else if (initialLights.length === 0) {
    initialLights = lanLights;
  }

  const discoveredIds = new Set(initialLights.map((row) => row.deviceId));

  const knownLights = await args.db
    .select({ ipAddress: schema.lights.ipAddress, deviceId: schema.lights.deviceId })
    .from(schema.lights);

  const missingLights = knownLights.filter(
    (row) => row.deviceId && !discoveredIds.has(row.deviceId)
  );

  if (missingLights.length > 0) {
    const probed = await probeLights(
      missingLights.map((row) => row.ipAddress),
      UDP_TIMEOUT_MS
    );
    for (const row of probed) {
      if (!discoveredIds.has(row.deviceId)) {
        initialLights.push(row);
        discoveredIds.add(row.deviceId);
      }
    }
  }

  let filteredLights = initialLights;
  if (process.env.GOVEE_FILTER?.trim()) {
    filteredLights = filteredLights.filter((row) => passesNameFilter(row.name));
  }

  const { added, updated, pruned } = await syncDiscoveredLights({
    db: args.db,
    discovered: filteredLights,
    ...(typeof args.prune === "boolean" ? { prune: args.prune } : {}),
  });

  return {
    discovered: filteredLights.length,
    added,
    updated,
    pruned,
    lights: filteredLights,
  };
}

let autoDiscoveryTimer: NodeJS.Timeout | null = null;

function startAutoDiscovery(args: { db: Cable3Db; app: FastifyInstance }): void {
  if (autoDiscoveryTimer) return;

  const enabled = parseBooleanEnv("CHIBA3_LIGHTS_AUTO_DISCOVERY", true);
  if (!enabled) return;

  void runLightDiscovery({
    db: args.db,
    app: args.app,
    timeoutMs: DEFAULT_DISCOVERY_TIMEOUT_MS,
  }).catch((error) => {
    log(args.app, "warn", "Initial auto discovery failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  });

  autoDiscoveryTimer = setInterval(() => {
    void runLightDiscovery({
      db: args.db,
      app: args.app,
      timeoutMs: DEFAULT_DISCOVERY_TIMEOUT_MS,
    }).catch((error) => {
      log(args.app, "warn", "Scheduled auto discovery failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }, AUTO_DISCOVERY_INTERVAL_MS);
}

function stopAutoDiscovery(): void {
  if (!autoDiscoveryTimer) return;
  clearInterval(autoDiscoveryTimer);
  autoDiscoveryTimer = null;
}

let tplinkClient: TplinkClient | null = null;

function getTplinkClient(): TplinkClient {
  if (!tplinkClient) {
    tplinkClient = new Client();
  }
  return tplinkClient;
}

async function discoverPlugs(timeoutMs: number): Promise<DiscoveredPlug[]> {
  const client = getTplinkClient();
  const discovered = new Map<string, DiscoveredPlug>();

  return await new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      client.removeListener("plug-new", onPlug as (value: any) => void);
      client.removeListener("error", onError as (value: any) => void);
      try {
        client.stopDiscovery();
      } catch {
        // ignore
      }
      resolve(Array.from(discovered.values()));
    };

    const onPlug = (plug: any) => {
      const ip = typeof plug?.host === "string" ? plug.host : "";
      const deviceId = typeof plug?.deviceId === "string" ? plug.deviceId : "";
      const alias =
        typeof plug?.alias === "string" && plug.alias.trim().length > 0
          ? plug.alias
          : ip;
      const model = typeof plug?.model === "string" ? plug.model : "";
      if (!ip) return;
      const key = deviceId || ip;
      if (!discovered.has(key)) {
        discovered.set(key, { ip, deviceId, alias, model });
      }
    };

    const onError = () => {
      finish();
    };

    client.on("plug-new", onPlug as (value: any) => void);
    client.on("error", onError as (value: any) => void);

    try {
      client.startDiscovery({
        deviceTypes: ["plug"],
        discoveryTimeout: 0,
      });
    } catch {
      finish();
      return;
    }

    const timer = setTimeout(finish, Math.max(500, timeoutMs));
  });
}

async function probePlugAt(ip: string, timeoutMs: number): Promise<DiscoveredPlug | null> {
  try {
    const client = getTplinkClient();
    const device = client.getPlug({ host: ip, sysInfo: {} });
    const sysInfo = await Promise.race([
      device.getSysInfo(),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("timeout")), timeoutMs);
      }),
    ]);

    const deviceId =
      typeof sysInfo.deviceId === "string" ? String(sysInfo.deviceId) : "";
    const alias =
      typeof sysInfo.alias === "string" && String(sysInfo.alias).trim().length > 0
        ? String(sysInfo.alias)
        : ip;
    const model = typeof sysInfo.model === "string" ? String(sysInfo.model) : "";

    return {
      ip,
      deviceId,
      alias,
      model,
    };
  } catch {
    return null;
  }
}

async function scanSubnetForPlugs(
  subnet: string,
  timeoutMs: number
): Promise<DiscoveredPlug[]> {
  const out: DiscoveredPlug[] = [];
  const batchSize = 50;
  for (let start = 1; start <= 254; start += batchSize) {
    const end = Math.min(start + batchSize - 1, 254);
    const batch: Array<Promise<DiscoveredPlug | null>> = [];
    for (let i = start; i <= end; i += 1) {
      batch.push(probePlugAt(`${subnet}.${i}`, timeoutMs));
    }
    const rows = await Promise.all(batch);
    for (const row of rows) {
      if (row) out.push(row);
    }
  }
  return out;
}

async function syncPlugsFromConfig(args: {
  db: Cable3Db;
  app: FastifyInstance;
}): Promise<{ added: number; updated: number; total: number }> {
  const config = readPlugsConfig();
  if (!config) {
    return { added: 0, updated: 0, total: 0 };
  }

  let added = 0;
  let updated = 0;

  await args.db.transaction(async (tx) => {
    for (const row of config.plugs) {
      const id = String(row.id || "").trim();
      const name = String(row.name || "").trim();
      const ip = String(row.ip || "").trim();
      if (!id || !name || !ip) continue;

      const deviceId = row.deviceId ? String(row.deviceId).trim() : "";
      const model = row.model ? String(row.model).trim() : "";

      const existingRows = await tx
        .select()
        .from(schema.plugs)
        .where(eq(schema.plugs.id, id))
        .limit(1);
      const existing = existingRows[0];

      const updatedAt = nowMs();
      if (!existing) {
        await tx.insert(schema.plugs).values({
          id,
          name,
          ipAddress: ip,
          host: ip,
          deviceId: deviceId || null,
          model: model || null,
          createdAt: updatedAt,
          updatedAt,
        });
        added += 1;
        continue;
      }

      const hasChange =
        existing.name !== name ||
        existing.ipAddress !== ip ||
        existing.host !== ip ||
        (deviceId && existing.deviceId !== deviceId) ||
        (model && existing.model !== model);

      if (!hasChange) continue;

      await tx
        .update(schema.plugs)
        .set({
          name,
          ipAddress: ip,
          host: ip,
          ...(deviceId ? { deviceId } : {}),
          ...(model ? { model } : {}),
          updatedAt,
        })
        .where(eq(schema.plugs.id, id));
      updated += 1;
    }
  });

  log(args.app, "info", "Synced plugs from config", {
    added,
    updated,
    total: config.plugs.length,
  });

  return { added, updated, total: config.plugs.length };
}

async function syncDiscoveredPlugs(args: {
  db: Cable3Db;
  discovered: DiscoveredPlug[];
}): Promise<{ added: number; updated: number }> {
  let added = 0;
  let updated = 0;

  await args.db.transaction(async (tx) => {
    for (const row of args.discovered) {
      const ip = row.ip.trim();
      if (!ip) continue;
      const deviceId = row.deviceId.trim();
      const alias = row.alias.trim() || ip;
      const model = row.model.trim();
      const updatedAt = nowMs();

      if (deviceId) {
        const existingByDevice = await tx
          .select()
          .from(schema.plugs)
          .where(eq(schema.plugs.deviceId, deviceId))
          .limit(1);
        const existing = existingByDevice[0];
        if (existing) {
          await tx
            .update(schema.plugs)
            .set({
              ipAddress: ip,
              host: ip,
              model: model || existing.model,
              updatedAt,
            })
            .where(eq(schema.plugs.id, existing.id));
          updated += 1;
          continue;
        }
      }

      let id = toSlug(alias) || `plug-${Date.now()}`;
      const existingById = await tx
        .select({ id: schema.plugs.id })
        .from(schema.plugs)
        .where(eq(schema.plugs.id, id))
        .limit(1);
      if (existingById[0]) {
        id = `${id}-${Math.floor(Math.random() * 100000)}`;
      }
      await tx.insert(schema.plugs).values({
        id,
        name: alias,
        ipAddress: ip,
        host: ip,
        deviceId: deviceId || null,
        model: model || null,
        createdAt: updatedAt,
        updatedAt,
      });
      added += 1;
    }
  });

  return { added, updated };
}

async function runPlugDiscovery(args: {
  db: Cable3Db;
  timeoutMs: number;
  subnet?: string;
}): Promise<{
  discovered: number;
  added: number;
  updated: number;
  plugs: DiscoveredPlug[];
}> {
  const discovered = args.subnet
    ? await scanSubnetForPlugs(args.subnet, args.timeoutMs)
    : await discoverPlugs(args.timeoutMs);
  const { added, updated } = await syncDiscoveredPlugs({
    db: args.db,
    discovered,
  });
  return {
    discovered: discovered.length,
    added,
    updated,
    plugs: discovered,
  };
}

async function setPlugPower(
  plug: typeof schema.plugs.$inferSelect,
  on: boolean
): Promise<void> {
  const client = getTplinkClient();
  const device = client.getPlug({ host: plug.ipAddress, sysInfo: {} });
  await device.setPowerState(on);
}

async function controlPlug(args: {
  db: Cable3Db;
  plug: typeof schema.plugs.$inferSelect;
  request: PlugControlRequest;
}): Promise<PlugState> {
  await setPlugPower(args.plug, args.request.power);
  const updatedAt = nowMs();

  await args.db
    .insert(schema.plugState)
    .values({
      plugId: args.plug.id,
      power: args.request.power,
      updatedAt,
    })
    .onConflictDoUpdate({
      target: schema.plugState.plugId,
      set: {
        power: args.request.power,
        updatedAt,
      },
    });

  return {
    plugId: args.plug.id,
    power: args.request.power,
    updatedAt,
  };
}

async function queryPlugState(
  plug: typeof schema.plugs.$inferSelect
): Promise<PlugState | null> {
  try {
    const client = getTplinkClient();
    const device = client.getPlug({ host: plug.ipAddress, sysInfo: {} });
    const power = await device.getPowerState();
    return {
      plugId: plug.id,
      power,
      updatedAt: nowMs(),
    };
  } catch {
    return null;
  }
}

async function refreshPlugState(args: {
  db: Cable3Db;
  plug: typeof schema.plugs.$inferSelect;
}): Promise<PlugState | null> {
  const state = await queryPlugState(args.plug);
  if (!state) return null;

  await args.db
    .insert(schema.plugState)
    .values({
      plugId: state.plugId,
      power: state.power,
      updatedAt: state.updatedAt,
    })
    .onConflictDoUpdate({
      target: schema.plugState.plugId,
      set: {
        power: state.power,
        updatedAt: state.updatedAt,
      },
    });

  return state;
}

async function refreshAllPlugStates(db: Cable3Db): Promise<Map<string, PlugState | null>> {
  const plugs = await getAllPlugs(db);
  const out = new Map<string, PlugState | null>();
  await Promise.all(
    plugs.map(async (plug) => {
      const state = await refreshPlugState({ db, plug });
      out.set(plug.id, state);
    })
  );
  return out;
}

async function renamePlug(args: {
  db: Cable3Db;
  plugId: string;
  name: string;
}): Promise<typeof schema.plugs.$inferSelect | null> {
  const existing = await getPlugById(args.db, args.plugId);
  if (!existing) return null;

  await args.db
    .update(schema.plugs)
    .set({
      name: args.name,
      updatedAt: nowMs(),
    })
    .where(eq(schema.plugs.id, existing.id));

  return await getPlugById(args.db, existing.id);
}

async function deletePlug(args: { db: Cable3Db; plugId: string }): Promise<boolean> {
  const existing = await getPlugById(args.db, args.plugId);
  if (!existing) return false;
  await args.db.delete(schema.plugs).where(eq(schema.plugs.id, existing.id));
  return true;
}

const SOLAR_LAT = 33.324779;
const SOLAR_LNG = -115.839313;
const SOLAR_TZ = "America/Los_Angeles";

function toJulianDay(date: Date): number {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate();
  const a = Math.floor((14 - m) / 12);
  const y1 = y + 4800 - a;
  const m1 = m + 12 * a - 3;
  return (
    d +
    Math.floor((153 * m1 + 2) / 5) +
    365 * y1 +
    Math.floor(y1 / 4) -
    Math.floor(y1 / 100) +
    Math.floor(y1 / 400) -
    32045
  );
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

function calcSolarNoon(jd: number, lng: number): number {
  const n = jd - 2451545.0 + 0.0008;
  const jStar = n - lng / 360;
  const m = (357.5291 + 0.98560028 * jStar) % 360;
  const c =
    1.9148 * Math.sin(toRad(m)) +
    0.02 * Math.sin(toRad(2 * m)) +
    0.0003 * Math.sin(toRad(3 * m));
  const lambda = (m + c + 180 + 102.9372) % 360;
  return (
    2451545.0 +
    jStar +
    0.0053 * Math.sin(toRad(m)) -
    0.0069 * Math.sin(toRad(2 * lambda))
  );
}

function calcHourAngle(jd: number, lng: number, lat: number): number {
  const n = jd - 2451545.0 + 0.0008;
  const jStar = n - lng / 360;
  const m = (357.5291 + 0.98560028 * jStar) % 360;
  const c =
    1.9148 * Math.sin(toRad(m)) +
    0.02 * Math.sin(toRad(2 * m)) +
    0.0003 * Math.sin(toRad(3 * m));
  const lambda = (m + c + 180 + 102.9372) % 360;
  const sinDec = Math.sin(toRad(lambda)) * Math.sin(toRad(23.4397));
  const cosDec = Math.cos(Math.asin(sinDec));
  const cosOmega =
    (Math.sin(toRad(-0.833)) - Math.sin(toRad(lat)) * sinDec) /
    (Math.cos(toRad(lat)) * cosDec);
  return toDeg(Math.acos(cosOmega));
}

function julianToDate(jd: number): Date {
  const ms = (jd - 2440587.5) * 86400000;
  return new Date(ms);
}

function getSolarTimes(date: Date): { sunrise: Date; sunset: Date } {
  const noon = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0)
  );
  const jd = toJulianDay(noon);

  const jTransit = calcSolarNoon(jd, SOLAR_LNG);
  const omega = calcHourAngle(jd, SOLAR_LNG, SOLAR_LAT);

  const jRise = jTransit - omega / 360;
  const jSet = jTransit + omega / 360;

  return {
    sunrise: julianToDate(jRise),
    sunset: julianToDate(jSet),
  };
}

function resolveBreakpointTime(
  bp: { timeType: BreakpointTimeType; time?: string; offsetMinutes?: number },
  date: Date
): Date {
  if (bp.timeType === "clock") {
    const [hh, mm] = (bp.time || "00:00").split(":").map(Number);
    const localStr = date.toLocaleDateString("en-CA", {
      timeZone: SOLAR_TZ,
    });
    const [year, month, day] = localStr.split("-").map(Number);
    const target = new Date(
      `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(
        hh
      ).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`
    );

    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: SOLAR_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

    const refParts = formatter.formatToParts(date);
    const refYear = Number(refParts.find((part) => part.type === "year")?.value);
    const refMonth = Number(refParts.find((part) => part.type === "month")?.value);
    const refDay = Number(refParts.find((part) => part.type === "day")?.value);

    const utcTarget = new Date(Date.UTC(refYear, refMonth - 1, refDay, hh!, mm!, 0));
    const testStr = formatter.format(utcTarget);
    const testParts = testStr.match(/(\d+)\/(\d+)\/(\d+),?\s+(\d+):(\d+):(\d+)/);
    if (testParts) {
      const testHour = Number(testParts[4]);
      let offsetHours = testHour - hh!;
      if (offsetHours > 12) offsetHours -= 24;
      if (offsetHours < -12) offsetHours += 24;
      return new Date(utcTarget.getTime() - offsetHours * 3600000);
    }

    return target;
  }

  const solar = getSolarTimes(date);
  const base = bp.timeType === "sunrise" ? solar.sunrise : solar.sunset;
  const offsetMs = (bp.offsetMinutes || 0) * 60000;
  return new Date(base.getTime() + offsetMs);
}

const lightTimers = new Map<string, NodeJS.Timeout[]>();
let lightMidnightTimer: NodeJS.Timeout | null = null;
let lightSchedulerRunning = false;

const plugTimers = new Map<string, NodeJS.Timeout[]>();
let plugMidnightTimer: NodeJS.Timeout | null = null;
let plugSchedulerRunning = false;

function nextLosAngelesMidnightDelayMs(now: Date): number {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const [y, m, d] = formatter.format(tomorrow).split("-").map(Number);

  const testDate = new Date(Date.UTC(y!, m! - 1, d!, 12, 0, 0));
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "numeric",
    hour12: false,
  }).formatToParts(testDate);
  const localHourAtNoonUtc = Number(parts.find((part) => part.type === "hour")?.value || 0);
  const offsetHours = localHourAtNoonUtc - 12;
  const midnightTargetUtc = new Date(Date.UTC(y!, m! - 1, d!, -offsetHours, 0, 0));

  const diff = midnightTargetUtc.getTime() - now.getTime();
  if (diff > 0) return diff;
  return diff + 86400000;
}

function clearTimers(map: Map<string, NodeJS.Timeout[]>, key: string): void {
  const timers = map.get(key);
  if (!timers) return;
  for (const timer of timers) {
    clearTimeout(timer);
  }
  map.delete(key);
}

async function loadLightSchedule(
  db: Cable3Db,
  lightId: string
): Promise<{ enabled: boolean; breakpoints: LightScheduleBreakpoint[] } | null> {
  const rows = await db
    .select()
    .from(schema.lightSchedules)
    .where(eq(schema.lightSchedules.lightId, lightId))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const breakpoints = Array.isArray(row.breakpoints)
    ? (row.breakpoints as LightScheduleBreakpoint[])
    : [];

  return {
    enabled: row.enabled,
    breakpoints,
  };
}

async function listEnabledLightSchedules(
  db: Cable3Db
): Promise<Array<{ lightId: string; breakpoints: LightScheduleBreakpoint[] }>> {
  const rows = await db
    .select()
    .from(schema.lightSchedules)
    .where(eq(schema.lightSchedules.enabled, true));

  return rows.map((row) => ({
    lightId: row.lightId,
    breakpoints: Array.isArray(row.breakpoints)
      ? (row.breakpoints as LightScheduleBreakpoint[])
      : [],
  }));
}

async function applyLightBreakpoint(args: {
  db: Cable3Db;
  lightId: string;
  breakpoint: LightScheduleBreakpoint;
}): Promise<void> {
  const light = await getLightById(args.db, args.lightId);
  if (!light) return;

  const request: LightControlRequest = {
    power: args.breakpoint.power,
    brightness: args.breakpoint.brightness,
    ...(typeof args.breakpoint.kelvin === "number"
      ? { kelvin: args.breakpoint.kelvin }
      : {
          ...(typeof args.breakpoint.hue === "number" ? { hue: args.breakpoint.hue } : {}),
          ...(typeof args.breakpoint.saturation === "number"
            ? { saturation: args.breakpoint.saturation }
            : {}),
        }),
  };

  try {
    await controlLight({
      db: args.db,
      light,
      request,
    });
  } catch {
    // ignore schedule command failures
  }
}

function scheduleLightForToday(args: {
  db: Cable3Db;
  lightId: string;
  breakpoints: LightScheduleBreakpoint[];
}): void {
  clearTimers(lightTimers, args.lightId);
  if (args.breakpoints.length === 0) return;

  const now = new Date();
  const timers: NodeJS.Timeout[] = [];

  const resolved = args.breakpoints
    .map((bp) => ({
      breakpoint: bp,
      time: resolveBreakpointTime(bp, now),
    }))
    .sort((a, b) => a.time.getTime() - b.time.getTime());

  let mostRecentPast: LightScheduleBreakpoint | null = null;
  for (const row of resolved) {
    if (row.time.getTime() <= now.getTime()) {
      mostRecentPast = row.breakpoint;
    }
  }

  if (mostRecentPast) {
    void applyLightBreakpoint({
      db: args.db,
      lightId: args.lightId,
      breakpoint: mostRecentPast,
    });
  }

  for (const row of resolved) {
    const delay = row.time.getTime() - now.getTime();
    if (delay <= 0) continue;
    const timer = setTimeout(() => {
      void applyLightBreakpoint({
        db: args.db,
        lightId: args.lightId,
        breakpoint: row.breakpoint,
      });
    }, delay);
    timers.push(timer);
  }

  lightTimers.set(args.lightId, timers);
}

async function scheduleAllLights(args: { db: Cable3Db }): Promise<void> {
  const schedules = await listEnabledLightSchedules(args.db);
  for (const row of schedules) {
    scheduleLightForToday({
      db: args.db,
      lightId: row.lightId,
      breakpoints: row.breakpoints,
    });
  }
}

function scheduleLightMidnightResync(args: { db: Cable3Db }): void {
  if (lightMidnightTimer) {
    clearTimeout(lightMidnightTimer);
    lightMidnightTimer = null;
  }

  const delay = nextLosAngelesMidnightDelayMs(new Date());
  lightMidnightTimer = setTimeout(() => {
    void scheduleAllLights({ db: args.db });
    scheduleLightMidnightResync(args);
  }, delay);
}

async function reloadLightSchedule(args: { db: Cable3Db; lightId: string }): Promise<void> {
  clearTimers(lightTimers, args.lightId);
  const schedule = await loadLightSchedule(args.db, args.lightId);
  if (schedule && schedule.enabled && schedule.breakpoints.length > 0) {
    scheduleLightForToday({
      db: args.db,
      lightId: args.lightId,
      breakpoints: schedule.breakpoints,
    });
  }
}

function startLightScheduler(args: { db: Cable3Db }): void {
  if (lightSchedulerRunning) return;
  lightSchedulerRunning = true;
  void scheduleAllLights({ db: args.db });
  scheduleLightMidnightResync(args);
}

function stopLightScheduler(): void {
  if (!lightSchedulerRunning) return;
  lightSchedulerRunning = false;

  for (const lightId of lightTimers.keys()) {
    clearTimers(lightTimers, lightId);
  }

  if (lightMidnightTimer) {
    clearTimeout(lightMidnightTimer);
    lightMidnightTimer = null;
  }
}

async function loadPlugSchedule(
  db: Cable3Db,
  plugId: string
): Promise<{ enabled: boolean; breakpoints: PlugScheduleBreakpoint[] } | null> {
  const rows = await db
    .select()
    .from(schema.plugSchedules)
    .where(eq(schema.plugSchedules.plugId, plugId))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const breakpoints = Array.isArray(row.breakpoints)
    ? (row.breakpoints as PlugScheduleBreakpoint[])
    : [];

  return {
    enabled: row.enabled,
    breakpoints,
  };
}

async function listEnabledPlugSchedules(
  db: Cable3Db
): Promise<Array<{ plugId: string; breakpoints: PlugScheduleBreakpoint[] }>> {
  const rows = await db
    .select()
    .from(schema.plugSchedules)
    .where(eq(schema.plugSchedules.enabled, true));

  return rows.map((row) => ({
    plugId: row.plugId,
    breakpoints: Array.isArray(row.breakpoints)
      ? (row.breakpoints as PlugScheduleBreakpoint[])
      : [],
  }));
}

async function applyPlugBreakpoint(args: {
  db: Cable3Db;
  plugId: string;
  breakpoint: PlugScheduleBreakpoint;
}): Promise<void> {
  const plug = await getPlugById(args.db, args.plugId);
  if (!plug) return;

  try {
    await controlPlug({
      db: args.db,
      plug,
      request: {
        power: args.breakpoint.power,
      },
    });
  } catch {
    // ignore schedule command failures
  }
}

function schedulePlugForToday(args: {
  db: Cable3Db;
  plugId: string;
  breakpoints: PlugScheduleBreakpoint[];
}): void {
  clearTimers(plugTimers, args.plugId);
  if (args.breakpoints.length === 0) return;

  const now = new Date();
  const timers: NodeJS.Timeout[] = [];

  const resolved = args.breakpoints
    .map((bp) => ({
      breakpoint: bp,
      time: resolveBreakpointTime(bp, now),
    }))
    .sort((a, b) => a.time.getTime() - b.time.getTime());

  let mostRecentPast: PlugScheduleBreakpoint | null = null;
  for (const row of resolved) {
    if (row.time.getTime() <= now.getTime()) {
      mostRecentPast = row.breakpoint;
    }
  }

  if (mostRecentPast) {
    void applyPlugBreakpoint({
      db: args.db,
      plugId: args.plugId,
      breakpoint: mostRecentPast,
    });
  }

  for (const row of resolved) {
    const delay = row.time.getTime() - now.getTime();
    if (delay <= 0) continue;
    const timer = setTimeout(() => {
      void applyPlugBreakpoint({
        db: args.db,
        plugId: args.plugId,
        breakpoint: row.breakpoint,
      });
    }, delay);
    timers.push(timer);
  }

  plugTimers.set(args.plugId, timers);
}

async function scheduleAllPlugs(args: { db: Cable3Db }): Promise<void> {
  const schedules = await listEnabledPlugSchedules(args.db);
  for (const row of schedules) {
    schedulePlugForToday({
      db: args.db,
      plugId: row.plugId,
      breakpoints: row.breakpoints,
    });
  }
}

function schedulePlugMidnightResync(args: { db: Cable3Db }): void {
  if (plugMidnightTimer) {
    clearTimeout(plugMidnightTimer);
    plugMidnightTimer = null;
  }

  const delay = nextLosAngelesMidnightDelayMs(new Date());
  plugMidnightTimer = setTimeout(() => {
    void scheduleAllPlugs({ db: args.db });
    schedulePlugMidnightResync(args);
  }, delay);
}

async function reloadPlugSchedule(args: { db: Cable3Db; plugId: string }): Promise<void> {
  clearTimers(plugTimers, args.plugId);
  const schedule = await loadPlugSchedule(args.db, args.plugId);
  if (schedule && schedule.enabled && schedule.breakpoints.length > 0) {
    schedulePlugForToday({
      db: args.db,
      plugId: args.plugId,
      breakpoints: schedule.breakpoints,
    });
  }
}

function startPlugScheduler(args: { db: Cable3Db }): void {
  if (plugSchedulerRunning) return;
  plugSchedulerRunning = true;
  void scheduleAllPlugs({ db: args.db });
  schedulePlugMidnightResync(args);
}

function stopPlugScheduler(): void {
  if (!plugSchedulerRunning) return;
  plugSchedulerRunning = false;

  for (const plugId of plugTimers.keys()) {
    clearTimers(plugTimers, plugId);
  }

  if (plugMidnightTimer) {
    clearTimeout(plugMidnightTimer);
    plugMidnightTimer = null;
  }
}

async function ensureDefaultLightPresets(db: Cable3Db): Promise<void> {
  const now = nowMs();
  const defaults = [
    {
      id: "preset-all-off",
      name: "All Off",
      settings: [{ lightId: "*", power: false }],
    },
    {
      id: "preset-all-on",
      name: "All On",
      settings: [{ lightId: "*", power: true, brightness: 100 }],
    },
    {
      id: "preset-warm-dim",
      name: "Warm Dim",
      settings: [{ lightId: "*", power: true, kelvin: 3250, brightness: 30 }],
    },
    {
      id: "preset-cool-bright",
      name: "Cool Bright",
      settings: [{ lightId: "*", power: true, kelvin: 6500, brightness: 100 }],
    },
    {
      id: "preset-max-bright",
      name: "Max Bright",
      settings: [{ lightId: "*", power: true, kelvin: 6500, brightness: 100 }],
    },
    {
      id: "preset-warm-bright",
      name: "Warm Bright",
      settings: [{ lightId: "*", power: true, kelvin: 3250, brightness: 100 }],
    },
  ];

  for (const preset of defaults) {
    await db
      .insert(schema.lightPresets)
      .values({
        id: preset.id,
        name: preset.name,
        isPredefined: true,
        settings: preset.settings,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing();
  }
}

export async function registerDeviceController(args: {
  app: FastifyInstance;
  db: Cable3Db;
}): Promise<{ stop: () => void }> {
  await ensureDefaultLightPresets(args.db);
  await syncLightsFromConfig({ db: args.db, app: args.app });
  await syncPlugsFromConfig({ db: args.db, app: args.app });

  const pruned = await pruneLightsByNameFilter(args.db);
  if (pruned > 0) {
    log(args.app, "info", "Pruned lights by GOVEE_FILTER", { pruned });
  }

  startAutoDiscovery({ db: args.db, app: args.app });
  startLightScheduler({ db: args.db });
  startPlugScheduler({ db: args.db });

  args.app.get("/api/lights", async (_req, res) => {
    const reachability = await refreshAllLightStates(args.db);
    const rows = await args.db
      .select({
        light: schema.lights,
        state: schema.lightState,
      })
      .from(schema.lights)
      .leftJoin(schema.lightState, eq(schema.lights.id, schema.lightState.lightId))
      .orderBy(asc(schema.lights.name));

    const data = rows.map((row) =>
      serializeLightRecord({
        light: row.light,
        state: row.state,
        reachable: reachability.get(row.light.id) !== null,
      })
    );

    responseSuccess(res, { data });
  });

  args.app.post("/api/lights", async (req, res) => {
    const parsed = ManualLightInputSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      responseError(res, "Invalid light payload", 400);
      return;
    }

    try {
      const created = await createManualLight({ db: args.db, input: parsed.data });
      const state = await refreshLightState({ db: args.db, light: created });
      responseSuccess(
        res,
        {
          data: serializeLightRecord({
            light: created,
            state,
            reachable: state !== null,
          }),
        },
        201
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      responseError(res, `Create failed: ${message}`, 400);
    }
  });

  args.app.post("/api/lights/discover", async (req, res) => {
    const body = bodyOf(req);
    const timeout =
      typeof body.timeout === "number" && Number.isFinite(body.timeout)
        ? Math.max(500, Math.min(60000, Math.round(body.timeout)))
        : DEFAULT_DISCOVERY_TIMEOUT_MS;
    const subnetRaw = typeof body.subnet === "string" ? body.subnet : "";
    const subnet = subnetRaw ? normalizeSubnet(subnetRaw) : null;
    if (subnetRaw && !subnet) {
      responseError(res, "Invalid subnet format; expected A.B.C", 400);
      return;
    }
    const prune = body.prune === true;

    try {
      const result = await runLightDiscovery({
        db: args.db,
        app: args.app,
        timeoutMs: timeout,
        ...(subnet ? { subnet } : {}),
        prune,
      });
      responseSuccess(res, { data: result });
    } catch (error) {
      responseError(
        res,
        `Discovery failed: ${error instanceof Error ? error.message : String(error)}`,
        500
      );
    }
  });

  args.app.post("/api/lights/sync", async (_req, res) => {
    try {
      const result = await syncLightsFromConfig({ db: args.db, app: args.app });
      responseSuccess(res, { data: result });
    } catch (error) {
      responseError(
        res,
        `Sync failed: ${error instanceof Error ? error.message : String(error)}`,
        500
      );
    }
  });

  args.app.post("/api/lights/import", async (req, res) => {
    const body = bodyOf(req);
    const lights = body.lights;
    if (!Array.isArray(lights)) {
      responseError(res, "lights array is required", 400);
      return;
    }

    const parsed: Array<z.infer<typeof ManualLightInputSchema>> = [];
    for (const row of lights) {
      const item = ManualLightInputSchema.safeParse(row);
      if (!item.success) {
        responseError(res, "Each light must have at least ip/ipAddress and optional metadata", 400);
        return;
      }
      parsed.push(item.data);
    }

    try {
      let added = 0;
      let updated = 0;
      for (const item of parsed) {
        const result = await importLightRecord({ db: args.db, input: item });
        if (result === "added") added += 1;
        if (result === "updated") updated += 1;
      }
      responseSuccess(res, {
        data: {
          imported: parsed.length,
          added,
          updated,
        },
      });
    } catch (error) {
      responseError(
        res,
        `Import failed: ${error instanceof Error ? error.message : String(error)}`,
        500
      );
    }
  });

  args.app.put("/api/lights/:id", async (req, res) => {
    const lightId = requestParam(req, "id");
    if (!lightId) {
      responseError(res, "Missing light ID", 400);
      return;
    }

    const parsed = ManualLightInputSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      responseError(res, "Invalid light payload", 400);
      return;
    }

    try {
      const updated = await updateManualLight({
        db: args.db,
        lightId,
        input: parsed.data,
      });
      if (!updated) {
        responseError(res, "Light not found", 404);
        return;
      }
      const state = await refreshLightState({ db: args.db, light: updated });
      responseSuccess(res, {
        data: serializeLightRecord({
          light: updated,
          state,
          reachable: state !== null,
        }),
      });
    } catch (error) {
      responseError(
        res,
        `Update failed: ${error instanceof Error ? error.message : String(error)}`,
        400
      );
    }
  });

  args.app.delete("/api/lights/:id", async (req, res) => {
    const lightId = requestParam(req, "id");
    if (!lightId) {
      responseError(res, "Missing light ID", 400);
      return;
    }

    try {
      const deleted = await deleteLight({ db: args.db, lightId });
      if (!deleted) {
        responseError(res, "Light not found", 404);
        return;
      }
      responseSuccess(res, { message: "Light deleted" });
    } catch (error) {
      responseError(
        res,
        `Delete failed: ${error instanceof Error ? error.message : String(error)}`,
        500
      );
    }
  });

  args.app.post("/api/lights/all/control", async (req, res) => {
    const parsed = LightControlRequestSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      responseError(res, "Invalid JSON body", 400);
      return;
    }

    const lights = await getAllLights(args.db);
    const results: Array<{ lightId: string; success: boolean; error?: string }> = [];

    await Promise.all(
      lights.map(async (light) => {
        try {
          await controlLight({
            db: args.db,
            light,
            request: parsed.data,
          });
          results.push({ lightId: light.id, success: true });
        } catch (error) {
          results.push({
            lightId: light.id,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      })
    );

    responseSuccess(res, { data: { results } });
  });

  args.app.post("/api/lights/:id/control", async (req, res) => {
    const lightId = requestParam(req, "id");
    if (!lightId) {
      responseError(res, "Missing light ID", 400);
      return;
    }

    const light = await getLightById(args.db, lightId);
    if (!light) {
      responseError(res, "Light not found", 404);
      return;
    }

    const parsed = LightControlRequestSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      responseError(res, "Invalid JSON body", 400);
      return;
    }

    try {
      const state = await controlLight({
        db: args.db,
        light,
        request: parsed.data,
      });
      responseSuccess(res, { data: { lightId: light.id, state } });
    } catch (error) {
      responseError(
        res,
        `Light control failed: ${error instanceof Error ? error.message : String(error)}`,
        500
      );
    }
  });

  args.app.get("/api/presets", async (_req, res) => {
    const rows = await args.db
      .select()
      .from(schema.lightPresets)
      .orderBy(asc(schema.lightPresets.name));

    const data = [...rows]
      .sort((a, b) => Number(b.isPredefined) - Number(a.isPredefined) || a.name.localeCompare(b.name))
      .map((row) => ({
        id: row.id,
        name: row.name,
        isPredefined: row.isPredefined,
        settings: Array.isArray(row.settings) ? row.settings : [],
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }));

    responseSuccess(res, { data });
  });

  args.app.get("/api/presets/:id", async (req, res) => {
    const presetId = requestParam(req, "id");
    if (!presetId) {
      responseError(res, "Missing preset ID", 400);
      return;
    }

    const rows = await args.db
      .select()
      .from(schema.lightPresets)
      .where(eq(schema.lightPresets.id, presetId))
      .limit(1);
    const preset = rows[0];
    if (!preset) {
      responseError(res, "Preset not found", 404);
      return;
    }

    responseSuccess(res, {
      data: {
        id: preset.id,
        name: preset.name,
        isPredefined: preset.isPredefined,
        settings: Array.isArray(preset.settings) ? preset.settings : [],
        createdAt: preset.createdAt,
        updatedAt: preset.updatedAt,
      },
    });
  });

  args.app.post("/api/presets", async (req, res) => {
    const parsed = CreatePresetRequestSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      responseError(res, "Name and settings are required", 400);
      return;
    }

    const id = randomUUID();
    const now = nowMs();

    try {
      await args.db.insert(schema.lightPresets).values({
        id,
        name: parsed.data.name.trim(),
        isPredefined: false,
        settings: parsed.data.settings,
        createdAt: now,
        updatedAt: now,
      });

      responseSuccess(res, {
        data: {
          id,
          name: parsed.data.name.trim(),
          isPredefined: false,
          settings: parsed.data.settings,
          createdAt: now,
          updatedAt: now,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.toLowerCase().includes("unique")) {
        responseError(res, "A preset with that name already exists", 409);
        return;
      }
      responseError(res, `Create failed: ${message}`, 500);
    }
  });

  args.app.put("/api/presets/:id", async (req, res) => {
    const presetId = requestParam(req, "id");
    if (!presetId) {
      responseError(res, "Missing preset ID", 400);
      return;
    }

    const parsed = CreatePresetRequestSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      responseError(res, "Name and settings are required", 400);
      return;
    }

    const rows = await args.db
      .select()
      .from(schema.lightPresets)
      .where(eq(schema.lightPresets.id, presetId))
      .limit(1);
    const preset = rows[0];
    if (!preset) {
      responseError(res, "Preset not found", 404);
      return;
    }
    if (preset.isPredefined) {
      responseError(res, "Cannot edit predefined presets", 403);
      return;
    }

    const updatedAt = nowMs();
    try {
      await args.db
        .update(schema.lightPresets)
        .set({
          name: parsed.data.name.trim(),
          settings: parsed.data.settings,
          updatedAt,
        })
        .where(eq(schema.lightPresets.id, presetId));

      responseSuccess(res, {
        data: {
          id: presetId,
          name: parsed.data.name.trim(),
          isPredefined: false,
          settings: parsed.data.settings,
          createdAt: preset.createdAt,
          updatedAt,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.toLowerCase().includes("unique")) {
        responseError(res, "A preset with that name already exists", 409);
        return;
      }
      responseError(res, `Update failed: ${message}`, 500);
    }
  });

  args.app.post("/api/presets/:id/apply", async (req, res) => {
    const presetId = requestParam(req, "id");
    if (!presetId) {
      responseError(res, "Missing preset ID", 400);
      return;
    }

    const rows = await args.db
      .select()
      .from(schema.lightPresets)
      .where(eq(schema.lightPresets.id, presetId))
      .limit(1);
    const preset = rows[0];

    if (!preset) {
      responseError(res, "Preset not found", 404);
      return;
    }

    const settings = Array.isArray(preset.settings) ? preset.settings : [];
    const allLights = await getAllLights(args.db);
    const results: Array<{ lightId: string; success: boolean; error?: string }> = [];

    for (const raw of settings) {
      if (!raw || typeof raw !== "object") continue;
      const setting = raw as Record<string, unknown>;
      const lightId = typeof setting.lightId === "string" ? setting.lightId : "";
      if (!lightId) continue;

      const targetLights =
        lightId === "*"
          ? allLights
          : allLights.filter((row) => row.id === lightId || row.name.toLowerCase() === lightId.toLowerCase());

      const request: LightControlRequest = {
        ...(typeof setting.power === "boolean" ? { power: setting.power } : {}),
        ...(typeof setting.hue === "number" ? { hue: setting.hue } : {}),
        ...(typeof setting.saturation === "number" ? { saturation: setting.saturation } : {}),
        ...(typeof setting.brightness === "number" ? { brightness: setting.brightness } : {}),
        ...(typeof setting.kelvin === "number" ? { kelvin: setting.kelvin } : {}),
      };

      for (const light of targetLights) {
        try {
          await controlLight({
            db: args.db,
            light,
            request,
          });
          results.push({ lightId: light.id, success: true });
        } catch (error) {
          results.push({
            lightId: light.id,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    responseSuccess(res, { data: { presetId, results } });
  });

  args.app.delete("/api/presets/:id", async (req, res) => {
    const presetId = requestParam(req, "id");
    if (!presetId) {
      responseError(res, "Missing preset ID", 400);
      return;
    }

    const rows = await args.db
      .select()
      .from(schema.lightPresets)
      .where(eq(schema.lightPresets.id, presetId))
      .limit(1);
    const preset = rows[0];

    if (!preset) {
      responseError(res, "Preset not found", 404);
      return;
    }

    if (preset.isPredefined) {
      responseError(res, "Cannot delete predefined presets", 403);
      return;
    }

    await args.db.delete(schema.lightPresets).where(eq(schema.lightPresets.id, presetId));
    responseSuccess(res, { message: "Preset deleted" });
  });

  args.app.get("/api/lights/:id/schedule", async (req, res) => {
    const lightId = requestParam(req, "id");
    if (!lightId) {
      responseError(res, "Missing light ID", 400);
      return;
    }

    const light = await getLightById(args.db, lightId);
    if (!light) {
      responseError(res, "Light not found", 404);
      return;
    }

    const rows = await args.db
      .select()
      .from(schema.lightSchedules)
      .where(eq(schema.lightSchedules.lightId, light.id))
      .limit(1);
    const row = rows[0];

    const data = row
      ? {
          lightId: row.lightId,
          enabled: row.enabled,
          breakpoints: Array.isArray(row.breakpoints) ? row.breakpoints : [],
          updatedAt: row.updatedAt,
        }
      : {
          lightId: light.id,
          enabled: false,
          breakpoints: [],
          updatedAt: 0,
        };

    responseSuccess(res, { data });
  });

  args.app.put("/api/lights/:id/schedule", async (req, res) => {
    const lightId = requestParam(req, "id");
    if (!lightId) {
      responseError(res, "Missing light ID", 400);
      return;
    }

    const light = await getLightById(args.db, lightId);
    if (!light) {
      responseError(res, "Light not found", 404);
      return;
    }

    const parsed = SetLightScheduleRequestSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      responseError(
        res,
        "Invalid request body: enabled (boolean) and breakpoints (array) required",
        400
      );
      return;
    }

    for (const breakpoint of parsed.data.breakpoints) {
      if (breakpoint.timeType === "clock" && !breakpoint.time) {
        responseError(res, "Clock breakpoints require time in HH:MM format", 400);
        return;
      }
    }

    const stamped: LightScheduleBreakpoint[] = parsed.data.breakpoints.map((bp, index) => ({
      id: `bp-${Date.now()}-${index}`,
      timeType: bp.timeType,
      ...(bp.time ? { time: bp.time } : {}),
      ...(typeof bp.offsetMinutes === "number" ? { offsetMinutes: bp.offsetMinutes } : {}),
      power: bp.power,
      brightness: bp.brightness,
      ...(typeof bp.hue === "number" ? { hue: bp.hue } : {}),
      ...(typeof bp.saturation === "number" ? { saturation: bp.saturation } : {}),
      ...(typeof bp.kelvin === "number" ? { kelvin: bp.kelvin } : {}),
    }));

    const updatedAt = nowMs();
    await args.db
      .insert(schema.lightSchedules)
      .values({
        lightId: light.id,
        enabled: parsed.data.enabled,
        breakpoints: stamped,
        updatedAt,
      })
      .onConflictDoUpdate({
        target: schema.lightSchedules.lightId,
        set: {
          enabled: parsed.data.enabled,
          breakpoints: stamped,
          updatedAt,
        },
      });

    await reloadLightSchedule({ db: args.db, lightId: light.id });

    responseSuccess(res, {
      data: {
        lightId: light.id,
        enabled: parsed.data.enabled,
        breakpoints: stamped,
        updatedAt,
      },
    });
  });

  args.app.delete("/api/lights/:id/schedule", async (req, res) => {
    const lightId = requestParam(req, "id");
    if (!lightId) {
      responseError(res, "Missing light ID", 400);
      return;
    }

    const light = await getLightById(args.db, lightId);
    if (!light) {
      responseError(res, "Light not found", 404);
      return;
    }

    await args.db
      .delete(schema.lightSchedules)
      .where(eq(schema.lightSchedules.lightId, light.id));
    await reloadLightSchedule({ db: args.db, lightId: light.id });
    responseSuccess(res, { message: "Schedule deleted" });
  });

  args.app.get("/api/plugs", async (_req, res) => {
    const reachability = await refreshAllPlugStates(args.db);
    const rows = await args.db
      .select({
        plug: schema.plugs,
        state: schema.plugState,
      })
      .from(schema.plugs)
      .leftJoin(schema.plugState, eq(schema.plugs.id, schema.plugState.plugId))
      .orderBy(asc(schema.plugs.name));

    const data = rows.map((row) => {
      const liveState = reachability.get(row.plug.id) ?? null;
      return {
        id: row.plug.id,
        name: row.plug.name,
        ipAddress: row.plug.ipAddress,
        host: row.plug.host,
        ...(row.plug.deviceId ? { deviceId: row.plug.deviceId } : {}),
        ...(row.plug.model ? { model: row.plug.model } : {}),
        createdAt: row.plug.createdAt,
        updatedAt: row.plug.updatedAt,
        state:
          liveState ??
          (row.state
            ? {
                plugId: row.plug.id,
                power: row.state.power,
                updatedAt: row.state.updatedAt,
              }
            : null),
        reachable: liveState !== null,
      };
    });

    responseSuccess(res, { data });
  });

  args.app.post("/api/plugs/discover", async (req, res) => {
    const body = bodyOf(req);
    const timeout =
      typeof body.timeout === "number" && Number.isFinite(body.timeout)
        ? Math.max(500, Math.min(60000, Math.round(body.timeout)))
        : DEFAULT_DISCOVERY_TIMEOUT_MS;
    const subnetRaw = typeof body.subnet === "string" ? body.subnet : "";
    const subnet = subnetRaw ? normalizeSubnet(subnetRaw) : null;
    if (subnetRaw && !subnet) {
      responseError(res, "Invalid subnet format; expected A.B.C", 400);
      return;
    }

    try {
      const result = await runPlugDiscovery({
        db: args.db,
        timeoutMs: timeout,
        ...(subnet ? { subnet } : {}),
      });
      responseSuccess(res, { data: result });
    } catch (error) {
      responseError(
        res,
        `Discovery failed: ${error instanceof Error ? error.message : String(error)}`,
        500
      );
    }
  });

  args.app.post("/api/plugs/import", async (req, res) => {
    const body = bodyOf(req);
    const plugs = body.plugs;
    if (!Array.isArray(plugs)) {
      responseError(res, "plugs array is required", 400);
      return;
    }

    const discovered: DiscoveredPlug[] = [];
    for (const row of plugs) {
      if (!row || typeof row !== "object") {
        responseError(res, "Each plug must have an ip", 400);
        return;
      }
      const item = row as Record<string, unknown>;
      const ip = typeof item.ip === "string" ? item.ip.trim() : "";
      if (!ip) {
        responseError(res, "Each plug must have an ip", 400);
        return;
      }
      discovered.push({
        ip,
        deviceId: typeof item.deviceId === "string" ? item.deviceId.trim() : "",
        alias:
          typeof item.alias === "string" && item.alias.trim().length > 0
            ? item.alias.trim()
            : ip,
        model: typeof item.model === "string" ? item.model.trim() : "",
      });
    }

    try {
      const { added, updated } = await syncDiscoveredPlugs({
        db: args.db,
        discovered,
      });

      responseSuccess(res, {
        data: {
          imported: discovered.length,
          added,
          updated,
        },
      });
    } catch (error) {
      responseError(
        res,
        `Import failed: ${error instanceof Error ? error.message : String(error)}`,
        500
      );
    }
  });

  args.app.post("/api/plugs/sync", async (_req, res) => {
    try {
      const result = await syncPlugsFromConfig({ db: args.db, app: args.app });
      responseSuccess(res, { data: result });
    } catch (error) {
      responseError(
        res,
        `Sync failed: ${error instanceof Error ? error.message : String(error)}`,
        500
      );
    }
  });

  args.app.put("/api/plugs/:id", async (req, res) => {
    const plugId = requestParam(req, "id");
    if (!plugId) {
      responseError(res, "Missing plug ID", 400);
      return;
    }

    const body = bodyOf(req);
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      responseError(res, "Name is required", 400);
      return;
    }

    try {
      const updated = await renamePlug({
        db: args.db,
        plugId,
        name,
      });
      if (!updated) {
        responseError(res, "Plug not found", 404);
        return;
      }
      responseSuccess(res, { data: updated });
    } catch (error) {
      responseError(
        res,
        `Rename failed: ${error instanceof Error ? error.message : String(error)}`,
        500
      );
    }
  });

  args.app.delete("/api/plugs/:id", async (req, res) => {
    const plugId = requestParam(req, "id");
    if (!plugId) {
      responseError(res, "Missing plug ID", 400);
      return;
    }

    try {
      const deleted = await deletePlug({ db: args.db, plugId });
      if (!deleted) {
        responseError(res, "Plug not found", 404);
        return;
      }
      await reloadPlugSchedule({ db: args.db, plugId });
      responseSuccess(res, { message: "Plug deleted" });
    } catch (error) {
      responseError(
        res,
        `Delete failed: ${error instanceof Error ? error.message : String(error)}`,
        500
      );
    }
  });

  args.app.post("/api/plugs/all/control", async (req, res) => {
    const parsed = PlugControlRequestSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      responseError(res, "Invalid JSON body: power (boolean) required", 400);
      return;
    }

    const plugs = await getAllPlugs(args.db);
    const results: Array<{ plugId: string; success: boolean; error?: string }> = [];

    await Promise.all(
      plugs.map(async (plug) => {
        try {
          await controlPlug({
            db: args.db,
            plug,
            request: parsed.data,
          });
          results.push({ plugId: plug.id, success: true });
        } catch (error) {
          results.push({
            plugId: plug.id,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      })
    );

    responseSuccess(res, { data: { results } });
  });

  args.app.post("/api/plugs/:id/control", async (req, res) => {
    const plugId = requestParam(req, "id");
    if (!plugId) {
      responseError(res, "Missing plug ID", 400);
      return;
    }

    const plug = await getPlugById(args.db, plugId);
    if (!plug) {
      responseError(res, "Plug not found", 404);
      return;
    }

    const parsed = PlugControlRequestSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      responseError(res, "Invalid JSON body: power (boolean) required", 400);
      return;
    }

    try {
      const state = await controlPlug({
        db: args.db,
        plug,
        request: parsed.data,
      });
      responseSuccess(res, { data: { plugId: plug.id, state } });
    } catch (error) {
      responseError(
        res,
        `Plug control failed: ${error instanceof Error ? error.message : String(error)}`,
        500
      );
    }
  });

  args.app.get("/api/plugs/:id/schedule", async (req, res) => {
    const plugId = requestParam(req, "id");
    if (!plugId) {
      responseError(res, "Missing plug ID", 400);
      return;
    }

    const plug = await getPlugById(args.db, plugId);
    if (!plug) {
      responseError(res, "Plug not found", 404);
      return;
    }

    const rows = await args.db
      .select()
      .from(schema.plugSchedules)
      .where(eq(schema.plugSchedules.plugId, plug.id))
      .limit(1);
    const row = rows[0];

    const data = row
      ? {
          plugId: row.plugId,
          enabled: row.enabled,
          breakpoints: Array.isArray(row.breakpoints) ? row.breakpoints : [],
          updatedAt: row.updatedAt,
        }
      : {
          plugId: plug.id,
          enabled: false,
          breakpoints: [],
          updatedAt: 0,
        };

    responseSuccess(res, { data });
  });

  args.app.put("/api/plugs/:id/schedule", async (req, res) => {
    const plugId = requestParam(req, "id");
    if (!plugId) {
      responseError(res, "Missing plug ID", 400);
      return;
    }

    const plug = await getPlugById(args.db, plugId);
    if (!plug) {
      responseError(res, "Plug not found", 404);
      return;
    }

    const parsed = SetPlugScheduleRequestSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      responseError(
        res,
        "Invalid request body: enabled (boolean) and breakpoints (array) required",
        400
      );
      return;
    }

    for (const breakpoint of parsed.data.breakpoints) {
      if (breakpoint.timeType === "clock" && !breakpoint.time) {
        responseError(res, "Clock breakpoints require time in HH:MM format", 400);
        return;
      }
    }

    const stamped: PlugScheduleBreakpoint[] = parsed.data.breakpoints.map((bp, index) => ({
      id: `bp-${Date.now()}-${index}`,
      timeType: bp.timeType,
      ...(bp.time ? { time: bp.time } : {}),
      ...(typeof bp.offsetMinutes === "number" ? { offsetMinutes: bp.offsetMinutes } : {}),
      power: bp.power,
    }));

    const updatedAt = nowMs();

    await args.db
      .insert(schema.plugSchedules)
      .values({
        plugId: plug.id,
        enabled: parsed.data.enabled,
        breakpoints: stamped,
        updatedAt,
      })
      .onConflictDoUpdate({
        target: schema.plugSchedules.plugId,
        set: {
          enabled: parsed.data.enabled,
          breakpoints: stamped,
          updatedAt,
        },
      });

    await reloadPlugSchedule({ db: args.db, plugId: plug.id });

    responseSuccess(res, {
      data: {
        plugId: plug.id,
        enabled: parsed.data.enabled,
        breakpoints: stamped,
        updatedAt,
      },
    });
  });

  args.app.delete("/api/plugs/:id/schedule", async (req, res) => {
    const plugId = requestParam(req, "id");
    if (!plugId) {
      responseError(res, "Missing plug ID", 400);
      return;
    }

    const plug = await getPlugById(args.db, plugId);
    if (!plug) {
      responseError(res, "Plug not found", 404);
      return;
    }

    await args.db
      .delete(schema.plugSchedules)
      .where(eq(schema.plugSchedules.plugId, plug.id));
    await reloadPlugSchedule({ db: args.db, plugId: plug.id });
    responseSuccess(res, { message: "Schedule deleted" });
  });

  return {
    stop: () => {
      stopAutoDiscovery();
      stopLightScheduler();
      stopPlugScheduler();
    },
  };
}
