export type PingResult = {
  ok: boolean
  ms: number | null
  error?: string
}

export type TcpCheck = {
  ok: boolean
  ms: number | null
  error?: string
}

export type HttpCheck = {
  ok: boolean
  ms: number | null
  status: number | null
  error?: string
}

export type RemoteCableVersion = {
  version: string
  gitSha: string | null
}

export type RemoteNodeStatus = {
  version: string | null
  ipReported: string | null
  kioskUrl?: string | null
  displayMode?: string | null
  displayOutput?: string | null
  displayBackend?: string | null
  runtime?: {
    phase: string | null
    cacheReady: number | null
    cacheTotal: number | null
    currentItemId: string | null
    updatedAt: number | null
  } | null
}

export type FleetPi = {
  registryId?: string
  id: string
  host: string
  ip?: string
  nodeName: string
  cable?: {
    orientation?: string
    channel?: string
  }
}

export type FleetPiHealth = FleetPi & {
  resolvedIp: string | null
  dnsOk: boolean
  ping: PingResult
  tcp: {
    ssh22: TcpCheck
    node8080: TcpCheck
    cable8787: TcpCheck
  }
  http: {
    nodeStatus: HttpCheck
    cableVersion: HttpCheck
  }
  chibaNode: RemoteNodeStatus
  cableServer: RemoteCableVersion | null
  needsUpdate: boolean | null
  lastCheckedAt: number
  connectivity?: {
    score: number
    total: number
    status: 'online' | 'degraded' | 'offline' | 'progressing'
    lastCheckedAt: number
  }
  errorSummary?: string
}

export type FleetResponse = {
  now: number
  local: {
    gitSha: string | null
    registryPath: string | null
  }
  pis: FleetPiHealth[]
}

export type OpsNodeConnectivity = {
  registryId: string
  nodeId: string
  namespace: string
  dnsOk: boolean
  pingOk: boolean
  sshOk: boolean
  nodeApiOk: boolean
  cableApiOk: boolean
  connectivityScore: number
  connectivityTotal: number
  status: 'online' | 'degraded' | 'offline' | 'progressing'
  latencyMs: number | null
  errorSummary?: string
  checkedAt: number
}

export type OpsNodeRecord = {
  registryId: string
  nodeId: string
  host?: string
  ip?: string
  nodeName?: string
  orientation?: string
  displayRotate?: 0 | 90 | 180 | 270
  guidePort?: number
  nodePort?: number
  serverPort?: number
  apiKey?: string
  importedAt?: number
  createdAt?: number
  updatedAt?: number
  connectivity?: OpsNodeConnectivity | null
}

export type OpsNodesResponse = {
  ok: boolean
  registryId: string
  namespace: string
  count: number
  nodes: OpsNodeRecord[]
}

export type OpsBootstrapDefaultsResponse = {
  ok: boolean
  preferredHost: string
  candidates: string[]
  defaults: {
    lookupControlApiUrl: string
    nodeControlApiUrl: string
    guideBaseUrl: string
    namespace: string
    registryId: string
    guidePort: number
    sshUser: string
    sshPort: number
  }
}

export type OpsNodeBootstrapRequest = {
  dryRun?: boolean
  stream?: boolean
  endpointsOnly?: boolean
  controlApiUrl?: string
  nodeControlApiUrl?: string
  guideBaseUrl?: string
  namespace?: string
  registryId?: string
  host?: string
  sshUser?: string
  sshPort?: number
  sshPassword?: string
  guidePort?: number
}

export type OpsNodeBootstrapResponse = {
  ok: boolean
  dryRun?: boolean
  nodeId: string
  namespace: string
  registryId: string
  command: string[]
  code?: number | null
  signal?: string | null
  timedOut?: boolean
  durationMs?: number
  stdout?: string
  stderr?: string
}

export type OpsNodeDisplayModePreset =
  | 'native'
  | '2160p30'
  | '1440p60'
  | '1080p60'
  | '900p60'
  | '720p60'

export type OpsNodeDisplayModeRequest = {
  dryRun?: boolean
  mode?: OpsNodeDisplayModePreset
  restartDisplayManager?: boolean
  namespace?: string
  registryId?: string
  host?: string
  sshUser?: string
  sshPort?: number
  sshPassword?: string
  output?: string
}

export type OpsNodeDisplayModeResponse = {
  ok: boolean
  dryRun?: boolean
  nodeId: string
  namespace: string
  registryId: string
  host: string
  mode: OpsNodeDisplayModePreset
  command: string[]
  code?: number | null
  signal?: string | null
  timedOut?: boolean
  durationMs?: number
  stdout?: string
  stderr?: string
}

export type OpsProfile = {
  id: string
  file: string
  modePath: string
  defaults: {
    mode?: string
    target_kind?: 'media' | 'playlist' | 'block' | 'channel'
    target_id?: string
    theme?: string
    nosplash?: boolean
    hud?: 'always' | 'start' | 'never'
    hud_sec?: number
    lock?: boolean
    qr?: boolean
    channel?: string
    playlist?: boolean
    prefetch_channels?: string[]
    prefetch_stash?: boolean
    prefetch_cache?: boolean
    display_rotate?: 0 | 90 | 180 | 270
    scale?: number
    text_scale?: number
    hours?: number
    prefetch_targets?: string[]
  }
  overridePis: string[]
}

export type OpsProfilesResponse = {
  ok: boolean
  profiles: OpsProfile[]
}

export type OpsApplyResult = {
  id: string
  host: string
  ip: string | null
  nodeName: string
  guidePort: number
  url: string
  ok: boolean
  status: number | null
  ms: number | null
  error: string | null
  state?: { ok: boolean; status: number | null; ms: number | null; error?: string } | null
  prefetch?: {
    channelIds: string[]
    stash?: { ok: boolean; status: number | null; ms: number | null; queued: number | null; error?: string }
    cache?: { ok: boolean; status: number | null; ms: number | null; queued: number | null; error?: string }
  } | null
}

export type OpsApplyResponse = {
  ok: boolean
  results: OpsApplyResult[]
  modePath?: string
  channelId?: string
  index?: number
  target?: 'profile' | 'channel' | 'block' | 'playlist' | 'media'
  id?: string
  resolvedChannelId?: string | null
  warning?: string
}

export type OpsApplyTarget = 'profile' | 'channel' | 'block' | 'playlist' | 'media'

export type OpsApplyTargetRequest = {
  target: OpsApplyTarget
  id: string
  piIds: string[]
  dryRun?: boolean
  mode?: 'guide' | 'gallery'
  targetKind?: 'media' | 'playlist' | 'block' | 'channel'
  targetId?: string
  channel?: string
  lock?: boolean
  showQr?: boolean
  playlist?: boolean
  nosplash?: boolean
  remoteInput?: boolean
  remoteApp?: boolean
  remoteMic?: boolean
  remoteGuide?: boolean
  hudMode?: 'always' | 'start' | 'never'
  hudShowSec?: number
  theme?: string
  displayRotate?: 0 | 90 | 180 | 270
  scale?: number
  textScale?: number
  hours?: number
}

export type DesiredScreenAssignment = {
  screenId: string
  namespace: string
  revision: number
  controllerId: string
  operationId: string
  target: {
    kind: 'profile' | 'channel' | 'block' | 'playlist' | 'media'
    id: string
  }
  launch: {
    mode?: 'guide' | 'gallery'
    lock?: boolean
    qr?: boolean
    nosplash?: boolean
    remoteInput?: boolean
    remoteApp?: boolean
    remoteMic?: boolean
    remoteGuide?: boolean
    hudMode?: 'always' | 'start' | 'never'
    hudSec?: number
    theme?: string
    displayRotate?: 0 | 90 | 180 | 270
  }
  updatedAt: number
}

export type DesiredScreenAssignmentsResponse = {
  ok: boolean
  namespace: string
  count: number
  items: DesiredScreenAssignment[]
}

export type OpsCatalogResponse = {
  ok: boolean
  configPath?: string
  manifestDir?: string
  libraryRoots?: string[]
  counts?: { channels: number; blocks: number; playlists: number; media: number }
  channels?: any[]
  blocks?: any[]
  playlists?: any[]
  media?: any[]
  error?: string
}

export type GuideIndex = {
  generatedAt?: number
  slotMinutes?: number
  slotCount?: number
  startTime?: string
  channels: Array<{
    id: string
    number?: string
    name?: string
    callSign?: string
    description?: string
    schedule: Array<{
      title?: string
      subtitle?: string
      url?: string | null
      artist?: string
      description?: string
      start?: number
      end?: number
      span?: number
    }>
  }>
}
