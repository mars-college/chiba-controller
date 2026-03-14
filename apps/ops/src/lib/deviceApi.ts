export type LightState = {
  lightId: string
  power: boolean
  hue: number
  saturation: number
  brightness: number
  kelvin?: number
  updatedAt: number
}

export type LightRecord = {
  id: string
  name: string
  ipAddress: string
  port: number
  deviceId?: string
  sku?: string
  deviceType?: string
  createdAt: number
  updatedAt: number
  state: LightState | null
  reachable: boolean
}

export type LightUpsertInput = {
  id?: string
  name: string
  ipAddress: string
  port?: number
  deviceId?: string
  sku?: string
  deviceType?: string
}

export type LightControlRequest = {
  power?: boolean
  hue?: number
  saturation?: number
  brightness?: number
  kelvin?: number
}

export type PresetLightSetting = {
  lightId: string
  power?: boolean
  hue?: number
  saturation?: number
  brightness?: number
  kelvin?: number
}

export type LightPreset = {
  id: string
  name: string
  isPredefined: boolean
  settings: PresetLightSetting[]
  createdAt: number
  updatedAt: number
}

export type LightImportInput = {
  id?: string
  name?: string
  ip?: string
  ipAddress?: string
  port?: number
  deviceId?: string
  sku?: string
  deviceType?: string
}

export type DiscoveryResult = {
  discovered: number
  added: number
  updated: number
  pruned?: number
}

type ApiEnvelope<T> = {
  success?: boolean
  data?: T
  error?: unknown
}

async function parseEnvelopeOrThrow<T>(args: {
  res: Response
  errorPrefix: string
}): Promise<T> {
  const raw = await args.res.text().catch(() => '')
  let parsed: unknown = {}
  if (raw) {
    try {
      parsed = JSON.parse(raw)
    } catch {
      parsed = { error: raw.slice(0, 240) }
    }
  }

  if (!args.res.ok) {
    const detail =
      parsed && typeof parsed === 'object' && parsed !== null && 'error' in parsed
        ? String((parsed as { error?: unknown }).error ?? 'request_failed')
        : raw.slice(0, 240)
    throw new Error(`${args.errorPrefix}:${args.res.status}:${detail}`)
  }

  if (parsed && typeof parsed === 'object' && parsed !== null && 'data' in parsed) {
    return ((parsed as ApiEnvelope<T>).data ?? null) as T
  }

  return parsed as T
}

export async function fetchLights(signal?: AbortSignal): Promise<LightRecord[]> {
  const res = await fetch('/api/lights', { signal })
  return parseEnvelopeOrThrow<LightRecord[]>({
    res,
    errorPrefix: 'lights_fetch_failed',
  })
}

export async function createLight(input: LightUpsertInput): Promise<LightRecord> {
  const res = await fetch('/api/lights', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })
  return parseEnvelopeOrThrow<LightRecord>({
    res,
    errorPrefix: 'lights_create_failed',
  })
}

export async function updateLight(lightId: string, input: Partial<LightUpsertInput>): Promise<LightRecord> {
  const id = lightId.trim()
  if (!id) throw new Error('lights_update_failed:400:light_id_required')
  const res = await fetch(`/api/lights/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })
  return parseEnvelopeOrThrow<LightRecord>({
    res,
    errorPrefix: 'lights_update_failed',
  })
}

export async function deleteLight(lightId: string): Promise<void> {
  const id = lightId.trim()
  if (!id) throw new Error('lights_delete_failed:400:light_id_required')
  const res = await fetch(`/api/lights/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
  await parseEnvelopeOrThrow<unknown>({
    res,
    errorPrefix: 'lights_delete_failed',
  })
}

export async function importLights(payload: {
  lights: LightImportInput[]
}): Promise<{ imported: number; added: number; updated: number }> {
  const res = await fetch('/api/lights/import', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return parseEnvelopeOrThrow<{ imported: number; added: number; updated: number }>({
    res,
    errorPrefix: 'lights_import_failed',
  })
}

export async function discoverLights(payload?: {
  timeout?: number
  subnet?: string
  prune?: boolean
}): Promise<DiscoveryResult> {
  const res = await fetch('/api/lights/discover', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload ?? {}),
  })
  return parseEnvelopeOrThrow<DiscoveryResult>({
    res,
    errorPrefix: 'lights_discover_failed',
  })
}

export async function controlAllLights(payload: LightControlRequest): Promise<void> {
  const res = await fetch('/api/lights/all/control', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
  await parseEnvelopeOrThrow<unknown>({
    res,
    errorPrefix: 'lights_control_all_failed',
  })
}

export async function controlLight(lightId: string, payload: LightControlRequest): Promise<void> {
  const id = lightId.trim()
  if (!id) throw new Error('lights_control_failed:400:light_id_required')
  const res = await fetch(`/api/lights/${encodeURIComponent(id)}/control`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
  await parseEnvelopeOrThrow<unknown>({
    res,
    errorPrefix: 'lights_control_failed',
  })
}

export async function fetchPresets(signal?: AbortSignal): Promise<LightPreset[]> {
  const res = await fetch('/api/presets', { signal })
  return parseEnvelopeOrThrow<LightPreset[]>({
    res,
    errorPrefix: 'presets_fetch_failed',
  })
}

export async function applyPreset(presetId: string): Promise<void> {
  const id = presetId.trim()
  if (!id) throw new Error('preset_apply_failed:400:preset_id_required')
  const res = await fetch(`/api/presets/${encodeURIComponent(id)}/apply`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  })
  await parseEnvelopeOrThrow<unknown>({
    res,
    errorPrefix: 'preset_apply_failed',
  })
}

export async function createPreset(payload: {
  name: string
  settings: PresetLightSetting[]
}): Promise<LightPreset> {
  const res = await fetch('/api/presets', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return parseEnvelopeOrThrow<LightPreset>({
    res,
    errorPrefix: 'preset_create_failed',
  })
}

export async function updatePreset(
  presetId: string,
  payload: {
    name: string
    settings: PresetLightSetting[]
  }
): Promise<LightPreset> {
  const id = presetId.trim()
  if (!id) throw new Error('preset_update_failed:400:preset_id_required')
  const res = await fetch(`/api/presets/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return parseEnvelopeOrThrow<LightPreset>({
    res,
    errorPrefix: 'preset_update_failed',
  })
}

export async function deletePreset(presetId: string): Promise<void> {
  const id = presetId.trim()
  if (!id) throw new Error('preset_delete_failed:400:preset_id_required')
  const res = await fetch(`/api/presets/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
  await parseEnvelopeOrThrow<unknown>({
    res,
    errorPrefix: 'preset_delete_failed',
  })
}
