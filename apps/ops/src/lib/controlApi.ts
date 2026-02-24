import {
  type DeleteChannelResponse,
  createControlApiClient,
  type DeleteBlockResponse,
  type DeleteMediaResponse,
  type DeletePlaylistResponse,
  type DeleteProfileResponse,
  type IngestJobResponse,
  type IngestJobsResponse,
  type IngestResponse,
  type ImportResourcesResponse,
  type ResourceSnapshotResponse,
} from '@chiba-cable3/contracts/control-api'
import type {
  IngestEdenCollectionRequest,
  IngestJob,
  IngestYouTubeRequest,
  MediaResource,
  ResourceSnapshot,
} from '@chiba-cable3/contracts'

export type Media = MediaResource
export type ResourcePayload = ResourceSnapshot
export type MediaIngestJob = IngestJob

const client = createControlApiClient({ basePath: '/api/v1' })

export function mediaStreamUrl(mediaId: string): string {
  return client.mediaStreamUrl(mediaId)
}

export async function importResources(payload: ResourcePayload): Promise<ImportResourcesResponse> {
  return client.importResources(payload)
}

export async function fetchResourceSnapshot(): Promise<ResourceSnapshotResponse> {
  return client.getResourceSnapshot()
}

export async function deleteMedia(mediaId: string): Promise<DeleteMediaResponse> {
  return client.deleteMedia(mediaId)
}

export async function deleteBlock(blockId: string): Promise<DeleteBlockResponse> {
  return client.deleteBlock(blockId)
}

export async function deletePlaylist(playlistId: string): Promise<DeletePlaylistResponse> {
  return client.deletePlaylist(playlistId)
}

export async function deleteChannel(channelId: string): Promise<DeleteChannelResponse> {
  return client.deleteChannel(channelId)
}

export async function deleteProfile(profileId: string): Promise<DeleteProfileResponse> {
  return client.deleteProfile(profileId)
}

export async function ingestYouTubeSource(payload: IngestYouTubeRequest): Promise<IngestResponse> {
  return client.ingestYouTube(payload)
}

export async function ingestEdenCollectionSource(
  payload: IngestEdenCollectionRequest
): Promise<IngestResponse> {
  return client.ingestEdenCollection(payload)
}

export async function ingestUploadSource(formData: FormData): Promise<IngestResponse> {
  return client.ingestUpload(formData)
}

export async function startUploadIngestJob(formData: FormData): Promise<IngestJobResponse> {
  return client.startUploadIngestJob(formData)
}

export async function startYouTubeIngestJob(payload: IngestYouTubeRequest): Promise<IngestJobResponse> {
  return client.startYouTubeIngestJob(payload)
}

export async function startEdenIngestJob(
  payload: IngestEdenCollectionRequest
): Promise<IngestJobResponse> {
  return client.startEdenCollectionIngestJob(payload)
}

export async function fetchIngestJob(jobId: string): Promise<IngestJobResponse> {
  return client.getIngestJob(jobId)
}

export async function fetchIngestJobs(limit = 50): Promise<IngestJobsResponse> {
  return client.listIngestJobs(limit)
}
