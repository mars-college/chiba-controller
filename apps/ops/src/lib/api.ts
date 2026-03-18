import type {
  DesiredScreenAssignmentsResponse,
  FleetPi,
  FleetPiHealth,
  FleetResponse,
  GuideIndex,
  OpsApplyResponse,
  OpsApplyTargetRequest,
  OpsCatalogResponse,
  OpsBootstrapDefaultsResponse,
  OpsNodeRecord,
  OpsNodeBootstrapRequest,
  OpsNodeBootstrapResponse,
  OpsNodeDisplayModeRequest,
  OpsNodeDisplayModeResponse,
  OpsNodesResponse,
  OpsProfilesResponse,
} from '../types'
import {
  NodeRuntimeInputActionSchema,
  OpsNodeCacheClearResponseSchema,
  OpsNodeCacheDeleteResponseSchema,
  OpsNodeCacheInspectResponseSchema,
  OpsNodeInputResponseSchema,
  OpsNodeRuntimeStatusResponseSchema,
  type NodeRuntimeInputAction,
  type OpsNodeCacheClearResponse,
  type OpsNodeCacheDeleteResponse,
  type OpsNodeCacheInspectResponse,
  type OpsNodeInputResponse,
  type OpsNodeRuntimeStatusResponse,
} from '@chiba-cable3/contracts'

async function parseJsonResponseOrThrow<T>(args: {
  res: Response
  schema?: { parse: (value: unknown) => T }
  errorPrefix: string
  maxErrorChars?: number
}): Promise<T> {
  const maxChars = args.maxErrorChars ?? 240
  const raw = await args.res.text().catch(() => '')
  let parsed: unknown = {}
  if (raw) {
    try {
      parsed = JSON.parse(raw)
    } catch {
      parsed = { error: raw.slice(0, maxChars) }
    }
  }
  if (!args.res.ok) {
    const detail =
      parsed && typeof parsed === 'object' && parsed !== null && 'error' in parsed
        ? String((parsed as { error?: unknown }).error ?? 'request_failed')
        : raw.slice(0, maxChars)
    throw new Error(`${args.errorPrefix}:${args.res.status}:${detail}`)
  }
  if (args.schema) return args.schema.parse(parsed)
  return parsed as T
}

export async function fetchFleet(signal?: AbortSignal): Promise<FleetResponse> {
  const res = await fetch('/api/ops/fleet', { signal })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`fleet_fetch_failed:${res.status}:${text.slice(0, 120)}`)
  }
  return (await res.json()) as FleetResponse
}

export async function fetchDesiredScreenAssignments(opts?: {
  namespace?: string
  screenId?: string
  signal?: AbortSignal
}): Promise<DesiredScreenAssignmentsResponse> {
  const params = new URLSearchParams()
  if (opts?.namespace?.trim()) params.set('namespace', opts.namespace.trim())
  if (opts?.screenId?.trim()) params.set('screenId', opts.screenId.trim())
  const path = `/api/v1/screen-assignments${params.toString() ? `?${params.toString()}` : ''}`
  const res = await fetch(path, { signal: opts?.signal })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`screen_assignments_fetch_failed:${res.status}:${text.slice(0, 240)}`)
  }
  return (await res.json()) as DesiredScreenAssignmentsResponse
}

export async function fetchPiHealth(id: string, signal?: AbortSignal): Promise<FleetPiHealth> {
  const qs = new URLSearchParams({ id })
  const res = await fetch(`/api/ops/pi?${qs}`, { signal })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`pi_fetch_failed:${res.status}:${text.slice(0, 120)}`)
  }
  return (await res.json()) as FleetPiHealth
}

export async function fetchProfiles(signal?: AbortSignal): Promise<OpsProfilesResponse> {
  const res = await fetch('/api/ops/profiles', { signal })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`profiles_fetch_failed:${res.status}:${text.slice(0, 120)}`)
  }
  return (await res.json()) as OpsProfilesResponse
}

export async function fetchGuideIndex(signal?: AbortSignal): Promise<GuideIndex> {
  const res = await fetch('/api/index', { signal })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`index_fetch_failed:${res.status}:${text.slice(0, 120)}`)
  }
  return (await res.json()) as GuideIndex
}

export async function fetchCatalog(signal?: AbortSignal): Promise<OpsCatalogResponse> {
  const res = await fetch('/api/ops/catalog', { signal })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`catalog_fetch_failed:${res.status}:${text.slice(0, 240)}`)
  }
  return (await res.json()) as OpsCatalogResponse
}

export async function fetchOpsNodes(signal?: AbortSignal): Promise<OpsNodesResponse> {
  const res = await fetch('/api/ops/nodes', { signal })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`nodes_fetch_failed:${res.status}:${text.slice(0, 240)}`)
  }
  return (await res.json()) as OpsNodesResponse
}

export async function fetchOpsBootstrapDefaults(
  signal?: AbortSignal
): Promise<OpsBootstrapDefaultsResponse> {
  const res = await fetch('/api/ops/bootstrap-defaults', { signal })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`bootstrap_defaults_failed:${res.status}:${text.slice(0, 240)}`)
  }
  return (await res.json()) as OpsBootstrapDefaultsResponse
}

export async function fetchOpsNodeCache(
  nodeId: string,
  signal?: AbortSignal
): Promise<OpsNodeCacheInspectResponse> {
  const id = nodeId.trim()
  if (!id) throw new Error('node_cache_fetch_failed:400:node_id_required')
  const res = await fetch(`/api/ops/nodes/${encodeURIComponent(id)}/cache`, { signal })
  return parseJsonResponseOrThrow({
    res,
    schema: OpsNodeCacheInspectResponseSchema,
    errorPrefix: 'node_cache_fetch_failed',
  })
}

export async function clearOpsNodeCache(nodeId: string): Promise<OpsNodeCacheClearResponse> {
  const id = nodeId.trim()
  if (!id) throw new Error('node_cache_clear_failed:400:node_id_required')
  const res = await fetch(`/api/ops/nodes/${encodeURIComponent(id)}/cache`, {
    method: 'DELETE',
  })
  return parseJsonResponseOrThrow({
    res,
    schema: OpsNodeCacheClearResponseSchema,
    errorPrefix: 'node_cache_clear_failed',
  })
}

export async function deleteOpsNodeCacheFile(
  nodeId: string,
  fileName: string
): Promise<OpsNodeCacheDeleteResponse> {
  const id = nodeId.trim()
  const normalizedFileName = fileName.trim()
  if (!id) throw new Error('node_cache_delete_failed:400:node_id_required')
  if (!normalizedFileName) throw new Error('node_cache_delete_failed:400:file_name_required')
  const res = await fetch(
    `/api/ops/nodes/${encodeURIComponent(id)}/cache/${encodeURIComponent(normalizedFileName)}`,
    {
      method: 'DELETE',
    }
  )
  return parseJsonResponseOrThrow({
    res,
    schema: OpsNodeCacheDeleteResponseSchema,
    errorPrefix: 'node_cache_delete_failed',
  })
}

export async function fetchOpsNodeRuntimeStatus(
  nodeId: string,
  signal?: AbortSignal
): Promise<OpsNodeRuntimeStatusResponse> {
  const id = nodeId.trim()
  if (!id) throw new Error('node_runtime_status_fetch_failed:400:node_id_required')
  const res = await fetch(`/api/ops/nodes/${encodeURIComponent(id)}/runtime-status`, { signal })
  return parseJsonResponseOrThrow({
    res,
    schema: OpsNodeRuntimeStatusResponseSchema,
    errorPrefix: 'node_runtime_status_fetch_failed',
  })
}

export async function sendOpsNodeInput(
  nodeId: string,
  payload: { action: NodeRuntimeInputAction }
): Promise<OpsNodeInputResponse> {
  const id = nodeId.trim()
  if (!id) throw new Error('node_input_failed:400:node_id_required')
  const action = NodeRuntimeInputActionSchema.parse(payload.action)
  const res = await fetch(`/api/ops/nodes/${encodeURIComponent(id)}/input`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action }),
  })
  return parseJsonResponseOrThrow({
    res,
    schema: OpsNodeInputResponseSchema,
    errorPrefix: 'node_input_failed',
  })
}

export async function bootstrapOpsNode(
  nodeId: string,
  payload: OpsNodeBootstrapRequest
): Promise<OpsNodeBootstrapResponse> {
  const id = nodeId.trim()
  if (!id) throw new Error('node_bootstrap_failed:400:node_id_required')
  const res = await fetch(`/api/ops/nodes/${encodeURIComponent(id)}/bootstrap`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return parseJsonResponseOrThrow<OpsNodeBootstrapResponse>({
    res,
    errorPrefix: 'node_bootstrap_failed',
    maxErrorChars: 600,
  })
}

export async function bootstrapOpsNodeStream(
  nodeId: string,
  payload: OpsNodeBootstrapRequest,
  handlers: {
    onStart?: (event: { command?: string[]; nodeId?: string; namespace?: string; registryId?: string }) => void
    onStdout?: (chunk: string) => void
    onStderr?: (chunk: string) => void
  }
): Promise<OpsNodeBootstrapResponse> {
  const id = nodeId.trim()
  if (!id) throw new Error('node_bootstrap_failed:400:node_id_required')
  const res = await fetch(`/api/ops/nodes/${encodeURIComponent(id)}/bootstrap`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...payload, stream: true }),
  })
  if (!res.ok) {
    return parseJsonResponseOrThrow<OpsNodeBootstrapResponse>({
      res,
      errorPrefix: 'node_bootstrap_failed',
      maxErrorChars: 600,
    })
  }
  const contentType = (res.headers.get('content-type') || '').toLowerCase()
  if (contentType.includes('application/json')) {
    return parseJsonResponseOrThrow<OpsNodeBootstrapResponse>({
      res,
      errorPrefix: 'node_bootstrap_failed',
      maxErrorChars: 600,
    })
  }
  if (!res.body) {
    const text = await res.text().catch(() => '')
    throw new Error(`node_bootstrap_failed:${res.status}:${text.slice(0, 600) || 'empty_stream'}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let finalResult: OpsNodeBootstrapResponse | null = null

  const flushLine = (line: string) => {
    if (!line) return
    let event: unknown
    try {
      event = JSON.parse(line)
    } catch {
      return
    }
    if (!event || typeof event !== 'object') return
    const typed = event as {
      type?: string
      chunk?: unknown
      command?: string[]
      nodeId?: string
      namespace?: string
      registryId?: string
      result?: OpsNodeBootstrapResponse
    }
    if (typed.type === 'start') {
      handlers.onStart?.({
        command: Array.isArray(typed.command) ? typed.command : undefined,
        nodeId: typeof typed.nodeId === 'string' ? typed.nodeId : undefined,
        namespace: typeof typed.namespace === 'string' ? typed.namespace : undefined,
        registryId: typeof typed.registryId === 'string' ? typed.registryId : undefined,
      })
      return
    }
    if (typed.type === 'stdout' && typeof typed.chunk === 'string') {
      handlers.onStdout?.(typed.chunk)
      return
    }
    if (typed.type === 'stderr' && typeof typed.chunk === 'string') {
      handlers.onStderr?.(typed.chunk)
      return
    }
    if (typed.type === 'result' && typed.result && typeof typed.result === 'object') {
      finalResult = typed.result
      return
    }
    if (
      typeof (event as { ok?: unknown }).ok === 'boolean' &&
      typeof (event as { nodeId?: unknown }).nodeId === 'string'
    ) {
      finalResult = event as OpsNodeBootstrapResponse
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done })
    let lineBreak = buffer.indexOf('\n')
    while (lineBreak >= 0) {
      const line = buffer.slice(0, lineBreak).trim()
      buffer = buffer.slice(lineBreak + 1)
      flushLine(line)
      lineBreak = buffer.indexOf('\n')
    }
    if (done) break
  }
  const trailing = buffer.trim()
  if (trailing) flushLine(trailing)
  if (finalResult) return finalResult
  throw new Error('node_bootstrap_failed:500:stream_result_missing')
}

export async function setOpsNodeDisplayMode(
  nodeId: string,
  payload: OpsNodeDisplayModeRequest
): Promise<OpsNodeDisplayModeResponse> {
  const id = nodeId.trim()
  if (!id) throw new Error('node_display_mode_failed:400:node_id_required')
  const res = await fetch(`/api/ops/nodes/${encodeURIComponent(id)}/display-mode`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return parseJsonResponseOrThrow<OpsNodeDisplayModeResponse>({
    res,
    errorPrefix: 'node_display_mode_failed',
    maxErrorChars: 600,
  })
}

export async function createOpsNode(
  input: Omit<OpsNodeRecord, 'createdAt' | 'updatedAt' | 'importedAt' | 'connectivity'>
): Promise<{ ok: boolean; registryId: string; node: OpsNodeRecord }> {
  const res = await fetch('/api/ops/nodes', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`node_create_failed:${res.status}:${text.slice(0, 240)}`)
  }
  return (await res.json()) as { ok: boolean; registryId: string; node: OpsNodeRecord }
}

export async function updateOpsNode(
  nodeId: string,
  input: Omit<OpsNodeRecord, 'nodeId' | 'createdAt' | 'updatedAt' | 'importedAt' | 'connectivity'>
): Promise<{ ok: boolean; registryId: string; node: OpsNodeRecord }> {
  const res = await fetch(`/api/ops/nodes/${encodeURIComponent(nodeId)}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`node_update_failed:${res.status}:${text.slice(0, 240)}`)
  }
  return (await res.json()) as { ok: boolean; registryId: string; node: OpsNodeRecord }
}

export async function deleteOpsNode(nodeId: string): Promise<{ ok: boolean; registryId: string; nodeId: string; deleted: number }> {
  const res = await fetch(`/api/ops/nodes/${encodeURIComponent(nodeId)}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`node_delete_failed:${res.status}:${text.slice(0, 240)}`)
  }
  return (await res.json()) as { ok: boolean; registryId: string; nodeId: string; deleted: number }
}

export async function downloadOpsNodesExport(format: 'json' | 'toml'): Promise<{ blob: Blob; filename: string }> {
  const res = await fetch(`/api/ops/nodes/export?format=${encodeURIComponent(format)}`)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`nodes_export_failed:${res.status}:${text.slice(0, 240)}`)
  }
  const contentDisposition = res.headers.get('content-disposition') || ''
  const match = /filename=\"?([^\";]+)\"?/i.exec(contentDisposition)
  const filename = match?.[1] || `registry-export.${format}`
  const blob = await res.blob()
  return { blob, filename }
}

export async function applyProfile(opts: { profileId: string; piIds: string[]; dryRun?: boolean }): Promise<OpsApplyResponse> {
  const res = await fetch('/api/ops/apply-profile', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ profileId: opts.profileId, piIds: opts.piIds, dryRun: opts.dryRun === true }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`apply_profile_failed:${res.status}:${text.slice(0, 240)}`)
  }
  return (await res.json()) as OpsApplyResponse
}

export async function setChannel(opts: {
  channelId: string
  piIds: string[]
  lock?: boolean
  showQr?: boolean
  playlist?: boolean
  nosplash?: boolean
  theme?: string
  dryRun?: boolean
}): Promise<OpsApplyResponse> {
  const res = await fetch('/api/ops/set-channel', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      channelId: opts.channelId,
      piIds: opts.piIds,
      lock: opts.lock === true,
      showQr: opts.showQr === true,
      playlist: opts.playlist === true,
      nosplash: opts.nosplash !== false,
      theme: opts.theme,
      dryRun: opts.dryRun === true,
    }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`set_channel_failed:${res.status}:${text.slice(0, 240)}`)
  }
  return (await res.json()) as OpsApplyResponse
}

export async function openProgram(opts: { channelId: string; index: number; piIds: string[]; dryRun?: boolean }): Promise<OpsApplyResponse> {
  const res = await fetch('/api/ops/open-program', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ channelId: opts.channelId, index: opts.index, piIds: opts.piIds, dryRun: opts.dryRun === true }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`open_program_failed:${res.status}:${text.slice(0, 240)}`)
  }
  return (await res.json()) as OpsApplyResponse
}

export async function openGuide(opts: {
  piIds: string[]
  lock?: boolean
  showQr?: boolean
  nosplash?: boolean
  dryRun?: boolean
}): Promise<OpsApplyResponse> {
  const res = await fetch('/api/ops/open-guide', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      piIds: opts.piIds,
      lock: opts.lock,
      showQr: opts.showQr,
      nosplash: opts.nosplash,
      dryRun: opts.dryRun === true,
    }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`open_guide_failed:${res.status}:${text.slice(0, 240)}`)
  }
  return (await res.json()) as OpsApplyResponse
}

export async function applyTarget(opts: OpsApplyTargetRequest): Promise<OpsApplyResponse> {
  const res = await fetch('/api/ops/apply-target', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      target: opts.target,
      id: opts.id,
      method: 'state',
      piIds: opts.piIds,
      dryRun: opts.dryRun === true,
      mode: opts.mode,
      targetKind: opts.targetKind,
      targetId: opts.targetId,
      channel: opts.channel,
      lock: opts.lock,
      showQr: opts.showQr,
      playlist: opts.playlist,
      nosplash: opts.nosplash,
      remoteInput: opts.remoteInput,
      remoteApp: opts.remoteApp,
      remoteMic: opts.remoteMic,
      remoteGuide: opts.remoteGuide,
      hudMode: opts.hudMode,
      hudShowSec: opts.hudShowSec,
      infoTitle: opts.infoTitle,
      infoArtist: opts.infoArtist,
      infoDescription: opts.infoDescription,
      theme: opts.theme,
      displayRotate: opts.displayRotate,
      scale: opts.scale,
      textScale: opts.textScale,
      hours: opts.hours,
    }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`apply_target_failed:${res.status}:${text.slice(0, 240)}`)
  }
  return (await res.json()) as OpsApplyResponse
}

export type FleetStreamMeta = {
  now: number
  local: { gitSha: string | null; registryPath: string | null }
  pis: FleetPi[]
  probes?: { timeoutMs?: number; concurrency?: number }
}

export function openFleetStream(opts: {
  onMeta: (meta: FleetStreamMeta) => void
  onPi: (pi: FleetPiHealth) => void
  onDone?: () => void
  onError?: (message: string) => void
  timeoutMs?: number
  parallel?: number
}): { close: () => void } {
  const params = new URLSearchParams()
  if (typeof opts.timeoutMs === 'number') params.set('timeoutMs', String(opts.timeoutMs))
  if (typeof opts.parallel === 'number') params.set('parallel', String(opts.parallel))
  const url = `/api/ops/fleet/stream${params.toString() ? `?${params}` : ''}`

  let closed = false
  const es = new EventSource(url)

  const safe = <T extends any[]>(fn: ((...args: T) => void) | undefined, ...args: T) => {
    try {
      fn?.(...args)
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[ops] handler failed', e)
    }
  }

  es.addEventListener('meta', (ev) => {
    try {
      const meta = JSON.parse((ev as MessageEvent).data) as FleetStreamMeta
      safe(opts.onMeta, meta)
    } catch (e) {
      safe(opts.onError, `meta_parse_failed:${(e as Error).message}`)
    }
  })

  es.addEventListener('pi', (ev) => {
    try {
      const pi = JSON.parse((ev as MessageEvent).data) as FleetPiHealth
      safe(opts.onPi, pi)
    } catch (e) {
      safe(opts.onError, `pi_parse_failed:${(e as Error).message}`)
    }
  })

  es.addEventListener('done', () => {
    safe(opts.onDone)
    try {
      es.close()
    } catch {}
  })

  es.addEventListener('error', (ev) => {
    // Browser will auto-reconnect; we prefer to surface error and let the caller restart if desired.
    if (closed) return
    // eslint-disable-next-line no-console
    console.warn('[ops] stream error', ev)
    safe(opts.onError, 'stream_error')
  })

  return {
    close: () => {
      closed = true
      try {
        es.close()
      } catch {}
    },
  }
}
