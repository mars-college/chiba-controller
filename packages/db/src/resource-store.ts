import { and, asc, desc, eq, inArray, or } from "drizzle-orm";
import type { ResourceImportPayload, ResourceSnapshot } from "@chiba-cable3/contracts";
import type { Cable3Db } from "./db.js";
import { schema } from "./db.js";

export async function importResources(args: {
  db: Cable3Db;
  payload: ResourceImportPayload;
}): Promise<{
  media: number;
  playlists: number;
  blocks: number;
  channels: number;
  profiles: number;
}> {
  const now = Date.now();
  return args.db.transaction(async (tx) => {
    for (const media of args.payload.media) {
      await tx
        .insert(schema.mediaResources)
        .values({
          id: media.id,
          title: media.title ?? null,
          artist: media.artist ?? null,
          description: media.description ?? null,
          sourceType: media.sourceType,
          sourceValue: media.sourceValue,
          thumbnailUrl: media.thumbnailUrl ?? null,
          thumbnailObjectKey: media.thumbnailObjectKey ?? null,
          webConfigJson: media.web ?? null,
          cache: media.cache,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: schema.mediaResources.id,
          set: {
            title: media.title ?? null,
            artist: media.artist ?? null,
            description: media.description ?? null,
            sourceType: media.sourceType,
            sourceValue: media.sourceValue,
            thumbnailUrl: media.thumbnailUrl ?? null,
            thumbnailObjectKey: media.thumbnailObjectKey ?? null,
            webConfigJson: media.web ?? null,
            cache: media.cache,
            updatedAt: now,
          },
        });
    }

    for (const playlist of args.payload.playlists) {
      await tx
        .insert(schema.playlistResources)
        .values({
          id: playlist.id,
          title: playlist.title ?? null,
          artist: playlist.artist ?? null,
          description: playlist.description ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: schema.playlistResources.id,
          set: {
            title: playlist.title ?? null,
            artist: playlist.artist ?? null,
            description: playlist.description ?? null,
            updatedAt: now,
          },
        });

      await tx.delete(schema.playlistItems).where(eq(schema.playlistItems.playlistId, playlist.id));
      if (playlist.items.length > 0) {
        await tx.insert(schema.playlistItems).values(
          playlist.items.map((item) => ({
            playlistId: playlist.id,
            itemIndex: item.index,
            mediaId: item.mediaId ?? null,
            childPlaylistId: item.playlistId ?? null,
            durationSec: item.durationSec ?? null,
            createdAt: now,
            updatedAt: now,
          }))
        );
      }
    }

    for (const block of args.payload.blocks) {
      await tx
        .insert(schema.blockResources)
        .values({
          id: block.id,
          title: block.title ?? null,
          mode: block.mode ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: schema.blockResources.id,
          set: {
            title: block.title ?? null,
            mode: block.mode ?? null,
            updatedAt: now,
          },
        });

      await tx.delete(schema.blockItems).where(eq(schema.blockItems.blockId, block.id));
      if (block.items.length > 0) {
        await tx.insert(schema.blockItems).values(
          block.items.map((item) => ({
            blockId: block.id,
            itemIndex: item.index,
            mediaId: item.mediaId ?? null,
            playlistId: item.playlistId ?? null,
            durationSec: item.durationSec ?? null,
            createdAt: now,
            updatedAt: now,
          }))
        );
      }
    }

    for (const channel of args.payload.channels) {
      await tx
        .insert(schema.channelResources)
        .values({
          id: channel.id,
          numberText: channel.number ?? null,
          name: channel.name ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: schema.channelResources.id,
          set: {
            numberText: channel.number ?? null,
            name: channel.name ?? null,
            updatedAt: now,
          },
        });

      await tx.delete(schema.channelBlocks).where(eq(schema.channelBlocks.channelId, channel.id));
      if (channel.blockIds.length > 0) {
        await tx.insert(schema.channelBlocks).values(
          channel.blockIds.map((blockId, index) => ({
            channelId: channel.id,
            blockIndex: index,
            blockId,
            createdAt: now,
            updatedAt: now,
          }))
        );
      }
    }

    for (const profile of args.payload.profiles) {
      await tx
        .insert(schema.profileResources)
        .values({
          id: profile.id,
          title: profile.title ?? null,
          defaultsJson: {
            ...profile.defaults,
            defaultTarget: profile.defaultTarget,
          },
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: schema.profileResources.id,
          set: {
            title: profile.title ?? null,
            defaultsJson: {
              ...profile.defaults,
              defaultTarget: profile.defaultTarget,
            },
            updatedAt: now,
          },
        });

      await tx
        .delete(schema.profileNodeAssignments)
        .where(eq(schema.profileNodeAssignments.profileId, profile.id));
      if (profile.nodes.length > 0) {
        await tx.insert(schema.profileNodeAssignments).values(
          profile.nodes.map((node) => ({
            profileId: profile.id,
            nodeId: node.nodeId,
            targetKind: node.target.kind,
            targetId: node.target.id,
            launchJson: node.launch ?? {},
            createdAt: now,
            updatedAt: now,
          }))
        );
      }
    }

    return {
      media: args.payload.media.length,
      playlists: args.payload.playlists.length,
      blocks: args.payload.blocks.length,
      channels: args.payload.channels.length,
      profiles: args.payload.profiles.length,
    };
  });
}

export async function deleteMediaResource(args: {
  db: Cable3Db;
  mediaId: string;
}): Promise<{
  mediaId: string;
  deleted: boolean;
  removedPlaylistItems: number;
  removedBlockItems: number;
  removedProfileAssignments: number;
  updatedProfiles: number;
  removedPlaylists: number;
  removedBlocks: number;
  removedChannels: number;
  removedProfiles: number;
}> {
  const now = Date.now();

  const readDefaultTarget = (
    defaults: Record<string, unknown>
  ): { kind: string; id: string } | null => {
    const raw = defaults.defaultTarget;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const target = raw as Record<string, unknown>;
    const kind = String(target.kind ?? "").trim();
    const id = String(target.id ?? "").trim();
    if (!kind || !id) return null;
    return { kind, id };
  };

  const targetKey = (target: { kind: string; id: string } | null): string =>
    target ? `${target.kind}:${target.id}` : "";

  return args.db.transaction(async (tx) => {
    const [
      mediaRows,
      playlists,
      playlistItems,
      blocks,
      blockItems,
      channels,
      channelBlocks,
      profiles,
      profileNodes,
    ] = await Promise.all([
      tx
        .select({
          id: schema.mediaResources.id,
        })
        .from(schema.mediaResources)
        .where(eq(schema.mediaResources.id, args.mediaId)),
      tx
        .select({
          id: schema.playlistResources.id,
        })
        .from(schema.playlistResources),
      tx
        .select({
          playlistId: schema.playlistItems.playlistId,
          itemIndex: schema.playlistItems.itemIndex,
          mediaId: schema.playlistItems.mediaId,
          childPlaylistId: schema.playlistItems.childPlaylistId,
          durationSec: schema.playlistItems.durationSec,
        })
        .from(schema.playlistItems)
        .orderBy(asc(schema.playlistItems.playlistId), asc(schema.playlistItems.itemIndex)),
      tx
        .select({
          id: schema.blockResources.id,
        })
        .from(schema.blockResources),
      tx
        .select({
          blockId: schema.blockItems.blockId,
          itemIndex: schema.blockItems.itemIndex,
          mediaId: schema.blockItems.mediaId,
          playlistId: schema.blockItems.playlistId,
          durationSec: schema.blockItems.durationSec,
        })
        .from(schema.blockItems)
        .orderBy(asc(schema.blockItems.blockId), asc(schema.blockItems.itemIndex)),
      tx
        .select({
          id: schema.channelResources.id,
        })
        .from(schema.channelResources),
      tx
        .select({
          channelId: schema.channelBlocks.channelId,
          blockId: schema.channelBlocks.blockId,
          blockIndex: schema.channelBlocks.blockIndex,
        })
        .from(schema.channelBlocks)
        .orderBy(asc(schema.channelBlocks.channelId), asc(schema.channelBlocks.blockIndex)),
      tx
        .select({
          id: schema.profileResources.id,
          defaultsJson: schema.profileResources.defaultsJson,
        })
        .from(schema.profileResources),
      tx
        .select({
          profileId: schema.profileNodeAssignments.profileId,
          nodeId: schema.profileNodeAssignments.nodeId,
          targetKind: schema.profileNodeAssignments.targetKind,
          targetId: schema.profileNodeAssignments.targetId,
          launchJson: schema.profileNodeAssignments.launchJson,
        })
        .from(schema.profileNodeAssignments)
        .orderBy(asc(schema.profileNodeAssignments.profileId), asc(schema.profileNodeAssignments.nodeId)),
    ]);

    if (mediaRows.length === 0) {
      return {
        mediaId: args.mediaId,
        deleted: false,
        removedPlaylistItems: 0,
        removedBlockItems: 0,
        removedProfileAssignments: 0,
        updatedProfiles: 0,
        removedPlaylists: 0,
        removedBlocks: 0,
        removedChannels: 0,
        removedProfiles: 0,
      };
    }

    const deletedPlaylists = new Set<string>();
    const deletedBlocks = new Set<string>();
    const deletedChannels = new Set<string>();
    const deletedProfiles = new Set<string>();

    const playlistItemsByPlaylist = new Map<
      string,
      Array<{
        playlistId: string;
        itemIndex: number;
        mediaId: string | null;
        childPlaylistId: string | null;
        durationSec: number | null;
      }>
    >();
    for (const row of playlistItems) {
      const list = playlistItemsByPlaylist.get(row.playlistId) ?? [];
      list.push({ ...row });
      playlistItemsByPlaylist.set(row.playlistId, list);
    }
    const originalPlaylistCounts = new Map<string, number>(
      playlists.map((row) => [row.id, playlistItemsByPlaylist.get(row.id)?.length ?? 0])
    );

    const blockItemsByBlock = new Map<
      string,
      Array<{
        blockId: string;
        itemIndex: number;
        mediaId: string | null;
        playlistId: string | null;
        durationSec: number | null;
      }>
    >();
    for (const row of blockItems) {
      const list = blockItemsByBlock.get(row.blockId) ?? [];
      list.push({ ...row });
      blockItemsByBlock.set(row.blockId, list);
    }
    const originalBlockCounts = new Map<string, number>(
      blocks.map((row) => [row.id, blockItemsByBlock.get(row.id)?.length ?? 0])
    );

    const channelBlocksByChannel = new Map<string, string[]>();
    for (const row of channelBlocks) {
      const list = channelBlocksByChannel.get(row.channelId) ?? [];
      list.push(row.blockId);
      channelBlocksByChannel.set(row.channelId, list);
    }

    const profileNodesByProfile = new Map<
      string,
      Array<{
        profileId: string;
        nodeId: string;
        targetKind: string;
        targetId: string;
        launchJson: Record<string, unknown>;
      }>
    >();
    for (const row of profileNodes) {
      const list = profileNodesByProfile.get(row.profileId) ?? [];
      list.push({
        profileId: row.profileId,
        nodeId: row.nodeId,
        targetKind: row.targetKind,
        targetId: row.targetId,
        launchJson: (row.launchJson ?? {}) as Record<string, unknown>,
      });
      profileNodesByProfile.set(row.profileId, list);
    }
    const originalProfileCounts = new Map<string, number>(
      profiles.map((row) => [row.id, profileNodesByProfile.get(row.id)?.length ?? 0])
    );
    const originalProfileDefaultTargets = new Map<string, string>(
      profiles.map((row) => {
        const defaults =
          row.defaultsJson && typeof row.defaultsJson === "object" && !Array.isArray(row.defaultsJson)
            ? ({ ...(row.defaultsJson as Record<string, unknown>) } as Record<string, unknown>)
            : {};
        return [row.id, targetKey(readDefaultTarget(defaults))];
      })
    );
    const profileDefaultsByProfile = new Map<string, Record<string, unknown>>(
      profiles.map((row) => {
        const defaults =
          row.defaultsJson && typeof row.defaultsJson === "object" && !Array.isArray(row.defaultsJson)
            ? ({ ...(row.defaultsJson as Record<string, unknown>) } as Record<string, unknown>)
            : {};
        return [row.id, defaults];
      })
    );

    const isTargetDeleted = (kind: string, id: string): boolean => {
      if (!id) return false;
      if (kind === "media") return id === args.mediaId;
      if (kind === "playlist") return deletedPlaylists.has(id);
      if (kind === "block") return deletedBlocks.has(id);
      if (kind === "channel") return deletedChannels.has(id);
      if (kind === "profile") return deletedProfiles.has(id);
      return false;
    };

    let changed = true;
    while (changed) {
      changed = false;

      for (const playlist of playlists) {
        if (deletedPlaylists.has(playlist.id)) continue;
        const prev = playlistItemsByPlaylist.get(playlist.id) ?? [];
        const next = prev.filter(
          (row) =>
            row.mediaId !== args.mediaId &&
            !(row.childPlaylistId && deletedPlaylists.has(row.childPlaylistId))
        );
        if (next.length !== prev.length) {
          playlistItemsByPlaylist.set(playlist.id, next);
          changed = true;
        }
        if (next.length === 0 && !deletedPlaylists.has(playlist.id)) {
          deletedPlaylists.add(playlist.id);
          changed = true;
        }
      }

      for (const block of blocks) {
        if (deletedBlocks.has(block.id)) continue;
        const prev = blockItemsByBlock.get(block.id) ?? [];
        const next = prev.filter(
          (row) =>
            row.mediaId !== args.mediaId &&
            !(row.playlistId && deletedPlaylists.has(row.playlistId))
        );
        if (next.length !== prev.length) {
          blockItemsByBlock.set(block.id, next);
          changed = true;
        }
        if (next.length === 0 && !deletedBlocks.has(block.id)) {
          deletedBlocks.add(block.id);
          changed = true;
        }
      }

      for (const channel of channels) {
        if (deletedChannels.has(channel.id)) continue;
        const prev = channelBlocksByChannel.get(channel.id) ?? [];
        const next = prev.filter((blockId) => !deletedBlocks.has(blockId));
        if (next.length !== prev.length) {
          channelBlocksByChannel.set(channel.id, next);
          changed = true;
        }
        if (next.length === 0 && !deletedChannels.has(channel.id)) {
          deletedChannels.add(channel.id);
          changed = true;
        }
      }

      for (const profile of profiles) {
        if (deletedProfiles.has(profile.id)) continue;
        const prevNodes = profileNodesByProfile.get(profile.id) ?? [];
        const nextNodes = prevNodes.filter(
          (node) => !isTargetDeleted(node.targetKind, node.targetId)
        );
        if (nextNodes.length !== prevNodes.length) {
          profileNodesByProfile.set(profile.id, nextNodes);
          changed = true;
        }
        const defaults = profileDefaultsByProfile.get(profile.id) ?? {};
        const defaultTarget = readDefaultTarget(defaults);
        if (defaultTarget && isTargetDeleted(defaultTarget.kind, defaultTarget.id)) {
          const nextDefaults = { ...defaults };
          delete nextDefaults.defaultTarget;
          profileDefaultsByProfile.set(profile.id, nextDefaults);
          changed = true;
        }
        const finalDefaults = profileDefaultsByProfile.get(profile.id) ?? {};
        const finalTarget = readDefaultTarget(finalDefaults);
        const finalNodes = profileNodesByProfile.get(profile.id) ?? [];
        if (finalNodes.length === 0 && !finalTarget && !deletedProfiles.has(profile.id)) {
          deletedProfiles.add(profile.id);
          changed = true;
        }
      }
    }

    let removedPlaylistItems = 0;
    for (const playlist of playlists) {
      const before = originalPlaylistCounts.get(playlist.id) ?? 0;
      const after = deletedPlaylists.has(playlist.id)
        ? 0
        : playlistItemsByPlaylist.get(playlist.id)?.length ?? 0;
      removedPlaylistItems += Math.max(0, before - after);
    }

    let removedBlockItems = 0;
    for (const block of blocks) {
      const before = originalBlockCounts.get(block.id) ?? 0;
      const after = deletedBlocks.has(block.id)
        ? 0
        : blockItemsByBlock.get(block.id)?.length ?? 0;
      removedBlockItems += Math.max(0, before - after);
    }

    let updatedProfiles = 0;
    for (const profile of profiles) {
      if (deletedProfiles.has(profile.id)) continue;
      const beforeCount = originalProfileCounts.get(profile.id) ?? 0;
      const afterCount = profileNodesByProfile.get(profile.id)?.length ?? 0;
      const beforeTarget = originalProfileDefaultTargets.get(profile.id) ?? "";
      const afterTarget = targetKey(
        readDefaultTarget(profileDefaultsByProfile.get(profile.id) ?? {})
      );
      if (beforeCount !== afterCount || beforeTarget !== afterTarget) {
        updatedProfiles += 1;
      }
    }

    const removedProfileAssignments =
      profileNodes.length -
      profiles
        .filter((profile) => !deletedProfiles.has(profile.id))
        .reduce(
          (sum, profile) => sum + (profileNodesByProfile.get(profile.id)?.length ?? 0),
          0
        );

    await tx
      .delete(schema.playlistItems)
      .where(eq(schema.playlistItems.mediaId, args.mediaId));
    await tx
      .delete(schema.blockItems)
      .where(eq(schema.blockItems.mediaId, args.mediaId));

    const playlistIds = Array.from(deletedPlaylists);
    if (playlistIds.length > 0) {
      await tx
        .delete(schema.playlistItems)
        .where(inArray(schema.playlistItems.childPlaylistId, playlistIds));
      await tx
        .delete(schema.blockItems)
        .where(inArray(schema.blockItems.playlistId, playlistIds));
      await tx
        .delete(schema.playlistResources)
        .where(inArray(schema.playlistResources.id, playlistIds));
    }

    const blockIds = Array.from(deletedBlocks);
    if (blockIds.length > 0) {
      await tx
        .delete(schema.channelBlocks)
        .where(inArray(schema.channelBlocks.blockId, blockIds));
      await tx
        .delete(schema.blockResources)
        .where(inArray(schema.blockResources.id, blockIds));
    }

    const channelIds = Array.from(deletedChannels);
    if (channelIds.length > 0) {
      await tx
        .delete(schema.channelResources)
        .where(inArray(schema.channelResources.id, channelIds));
    }

    const targetDeleteClauses = [
      and(
        eq(schema.profileNodeAssignments.targetKind, "media"),
        eq(schema.profileNodeAssignments.targetId, args.mediaId)
      ),
    ];
    if (playlistIds.length > 0) {
      targetDeleteClauses.push(
        and(
          eq(schema.profileNodeAssignments.targetKind, "playlist"),
          inArray(schema.profileNodeAssignments.targetId, playlistIds)
        )
      );
    }
    if (blockIds.length > 0) {
      targetDeleteClauses.push(
        and(
          eq(schema.profileNodeAssignments.targetKind, "block"),
          inArray(schema.profileNodeAssignments.targetId, blockIds)
        )
      );
    }
    if (channelIds.length > 0) {
      targetDeleteClauses.push(
        and(
          eq(schema.profileNodeAssignments.targetKind, "channel"),
          inArray(schema.profileNodeAssignments.targetId, channelIds)
        )
      );
    }
    const profileIds = Array.from(deletedProfiles);
    if (profileIds.length > 0) {
      targetDeleteClauses.push(
        and(
          eq(schema.profileNodeAssignments.targetKind, "profile"),
          inArray(schema.profileNodeAssignments.targetId, profileIds)
        )
      );
    }
    await tx
      .delete(schema.profileNodeAssignments)
      .where(or(...targetDeleteClauses));

    if (profileIds.length > 0) {
      await tx
        .delete(schema.profileResources)
        .where(inArray(schema.profileResources.id, profileIds));
    }

    for (const profile of profiles) {
      if (deletedProfiles.has(profile.id)) continue;
      const nextDefaults = profileDefaultsByProfile.get(profile.id) ?? {};
      const nextNodes = profileNodesByProfile.get(profile.id) ?? [];
      const beforeCount = originalProfileCounts.get(profile.id) ?? 0;
      const afterCount = nextNodes.length;
      const beforeTarget = originalProfileDefaultTargets.get(profile.id) ?? "";
      const afterTarget = targetKey(readDefaultTarget(nextDefaults));
      if (beforeCount === afterCount && beforeTarget === afterTarget) continue;

      await tx
        .update(schema.profileResources)
        .set({
          defaultsJson: nextDefaults,
          updatedAt: now,
        })
        .where(eq(schema.profileResources.id, profile.id));

      await tx
        .delete(schema.profileNodeAssignments)
        .where(eq(schema.profileNodeAssignments.profileId, profile.id));
      if (nextNodes.length > 0) {
        await tx.insert(schema.profileNodeAssignments).values(
          nextNodes.map((node) => ({
            profileId: profile.id,
            nodeId: node.nodeId,
            targetKind: node.targetKind,
            targetId: node.targetId,
            launchJson: node.launchJson ?? {},
            createdAt: now,
            updatedAt: now,
          }))
        );
      }
    }

    const deletedRows = await tx
      .delete(schema.mediaResources)
      .where(eq(schema.mediaResources.id, args.mediaId))
      .returning({ id: schema.mediaResources.id });

    return {
      mediaId: args.mediaId,
      deleted: deletedRows.length > 0,
      removedPlaylistItems,
      removedBlockItems,
      removedProfileAssignments: Math.max(0, removedProfileAssignments),
      updatedProfiles,
      removedPlaylists: deletedPlaylists.size,
      removedBlocks: deletedBlocks.size,
      removedChannels: deletedChannels.size,
      removedProfiles: deletedProfiles.size,
    };
  });
}

export async function deleteBlockResource(args: {
  db: Cable3Db;
  blockId: string;
}): Promise<{
  blockId: string;
  deleted: boolean;
  removedChannelBlocks: number;
  removedProfileAssignments: number;
  updatedProfiles: number;
}> {
  const now = Date.now();
  const readDefaultTarget = (
    defaults: Record<string, unknown>
  ): { kind: string; id: string } | null => {
    const raw = defaults.defaultTarget;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const target = raw as Record<string, unknown>;
    const kind = String(target.kind ?? "").trim();
    const id = String(target.id ?? "").trim();
    if (!kind || !id) return null;
    return { kind, id };
  };

  return args.db.transaction(async (tx) => {
    const [
      blockRows,
      channelRefs,
      profileAssignments,
      profileRows,
    ] = await Promise.all([
      tx
        .select({ id: schema.blockResources.id })
        .from(schema.blockResources)
        .where(eq(schema.blockResources.id, args.blockId)),
      tx
        .select({
          channelId: schema.channelBlocks.channelId,
        })
        .from(schema.channelBlocks)
        .where(eq(schema.channelBlocks.blockId, args.blockId)),
      tx
        .select({
          profileId: schema.profileNodeAssignments.profileId,
        })
        .from(schema.profileNodeAssignments)
        .where(
          and(
            eq(schema.profileNodeAssignments.targetKind, "block"),
            eq(schema.profileNodeAssignments.targetId, args.blockId)
          )
        ),
      tx
        .select({
          id: schema.profileResources.id,
          defaultsJson: schema.profileResources.defaultsJson,
        })
        .from(schema.profileResources),
    ]);

    if (blockRows.length === 0) {
      return {
        blockId: args.blockId,
        deleted: false,
        removedChannelBlocks: 0,
        removedProfileAssignments: 0,
        updatedProfiles: 0,
      };
    }

    if (channelRefs.length > 0) {
      await tx
        .delete(schema.channelBlocks)
        .where(eq(schema.channelBlocks.blockId, args.blockId));
    }

    if (profileAssignments.length > 0) {
      await tx
        .delete(schema.profileNodeAssignments)
        .where(
          and(
            eq(schema.profileNodeAssignments.targetKind, "block"),
            eq(schema.profileNodeAssignments.targetId, args.blockId)
          )
        );
    }

    let updatedProfiles = 0;
    for (const row of profileRows) {
      const defaults =
        row.defaultsJson &&
        typeof row.defaultsJson === "object" &&
        !Array.isArray(row.defaultsJson)
          ? ({ ...(row.defaultsJson as Record<string, unknown>) } as Record<
              string,
              unknown
            >)
          : {};
      const defaultTarget = readDefaultTarget(defaults);
      if (
        !defaultTarget ||
        defaultTarget.kind !== "block" ||
        defaultTarget.id !== args.blockId
      ) {
        continue;
      }
      delete defaults.defaultTarget;
      await tx
        .update(schema.profileResources)
        .set({
          defaultsJson: defaults,
          updatedAt: now,
        })
        .where(eq(schema.profileResources.id, row.id));
      updatedProfiles += 1;
    }

    const deletedRows = await tx
      .delete(schema.blockResources)
      .where(eq(schema.blockResources.id, args.blockId))
      .returning({ id: schema.blockResources.id });

    return {
      blockId: args.blockId,
      deleted: deletedRows.length > 0,
      removedChannelBlocks: channelRefs.length,
      removedProfileAssignments: profileAssignments.length,
      updatedProfiles,
    };
  });
}

export async function deletePlaylistResource(args: {
  db: Cable3Db;
  playlistId: string;
}): Promise<{
  playlistId: string;
  deleted: boolean;
  removedBlockItems: number;
  removedPlaylistItems: number;
  removedProfileAssignments: number;
  updatedProfiles: number;
}> {
  const now = Date.now();
  const readDefaultTarget = (
    defaults: Record<string, unknown>
  ): { kind: string; id: string } | null => {
    const raw = defaults.defaultTarget;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const target = raw as Record<string, unknown>;
    const kind = String(target.kind ?? "").trim();
    const id = String(target.id ?? "").trim();
    if (!kind || !id) return null;
    return { kind, id };
  };

  return args.db.transaction(async (tx) => {
    const [playlistRows, blockRefs, playlistRefs, profileAssignments, profileRows] =
      await Promise.all([
        tx
          .select({ id: schema.playlistResources.id })
          .from(schema.playlistResources)
          .where(eq(schema.playlistResources.id, args.playlistId)),
        tx
          .select({ blockId: schema.blockItems.blockId })
          .from(schema.blockItems)
          .where(eq(schema.blockItems.playlistId, args.playlistId)),
        tx
          .select({ playlistId: schema.playlistItems.playlistId })
          .from(schema.playlistItems)
          .where(eq(schema.playlistItems.childPlaylistId, args.playlistId)),
        tx
          .select({
            profileId: schema.profileNodeAssignments.profileId,
          })
          .from(schema.profileNodeAssignments)
          .where(
            and(
              eq(schema.profileNodeAssignments.targetKind, "playlist"),
              eq(schema.profileNodeAssignments.targetId, args.playlistId)
            )
          ),
        tx
          .select({
            id: schema.profileResources.id,
            defaultsJson: schema.profileResources.defaultsJson,
          })
          .from(schema.profileResources),
      ]);

    if (playlistRows.length === 0) {
      return {
        playlistId: args.playlistId,
        deleted: false,
        removedBlockItems: 0,
        removedPlaylistItems: 0,
        removedProfileAssignments: 0,
        updatedProfiles: 0,
      };
    }

    if (blockRefs.length > 0) {
      await tx
        .delete(schema.blockItems)
        .where(eq(schema.blockItems.playlistId, args.playlistId));
    }

    if (playlistRefs.length > 0) {
      await tx
        .delete(schema.playlistItems)
        .where(eq(schema.playlistItems.childPlaylistId, args.playlistId));
    }

    if (profileAssignments.length > 0) {
      await tx
        .delete(schema.profileNodeAssignments)
        .where(
          and(
            eq(schema.profileNodeAssignments.targetKind, "playlist"),
            eq(schema.profileNodeAssignments.targetId, args.playlistId)
          )
        );
    }

    let updatedProfiles = 0;
    for (const row of profileRows) {
      const defaults =
        row.defaultsJson &&
        typeof row.defaultsJson === "object" &&
        !Array.isArray(row.defaultsJson)
          ? ({ ...(row.defaultsJson as Record<string, unknown>) } as Record<
              string,
              unknown
            >)
          : {};
      const defaultTarget = readDefaultTarget(defaults);
      if (
        !defaultTarget ||
        defaultTarget.kind !== "playlist" ||
        defaultTarget.id !== args.playlistId
      ) {
        continue;
      }
      delete defaults.defaultTarget;
      await tx
        .update(schema.profileResources)
        .set({
          defaultsJson: defaults,
          updatedAt: now,
        })
        .where(eq(schema.profileResources.id, row.id));
      updatedProfiles += 1;
    }

    const deletedRows = await tx
      .delete(schema.playlistResources)
      .where(eq(schema.playlistResources.id, args.playlistId))
      .returning({ id: schema.playlistResources.id });

    return {
      playlistId: args.playlistId,
      deleted: deletedRows.length > 0,
      removedBlockItems: blockRefs.length,
      removedPlaylistItems: playlistRefs.length,
      removedProfileAssignments: profileAssignments.length,
      updatedProfiles,
    };
  });
}

export async function deleteChannelResource(args: {
  db: Cable3Db;
  channelId: string;
}): Promise<{
  channelId: string;
  deleted: boolean;
  removedProfileAssignments: number;
  updatedProfiles: number;
}> {
  const now = Date.now();
  const readDefaultTarget = (
    defaults: Record<string, unknown>
  ): { kind: string; id: string } | null => {
    const raw = defaults.defaultTarget;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const target = raw as Record<string, unknown>;
    const kind = String(target.kind ?? "").trim();
    const id = String(target.id ?? "").trim();
    if (!kind || !id) return null;
    return { kind, id };
  };

  return args.db.transaction(async (tx) => {
    const [channelRows, profileAssignments, profileRows] = await Promise.all([
      tx
        .select({ id: schema.channelResources.id })
        .from(schema.channelResources)
        .where(eq(schema.channelResources.id, args.channelId)),
      tx
        .select({
          profileId: schema.profileNodeAssignments.profileId,
        })
        .from(schema.profileNodeAssignments)
        .where(
          and(
            eq(schema.profileNodeAssignments.targetKind, "channel"),
            eq(schema.profileNodeAssignments.targetId, args.channelId)
          )
        ),
      tx
        .select({
          id: schema.profileResources.id,
          defaultsJson: schema.profileResources.defaultsJson,
        })
        .from(schema.profileResources),
    ]);

    if (channelRows.length === 0) {
      return {
        channelId: args.channelId,
        deleted: false,
        removedProfileAssignments: 0,
        updatedProfiles: 0,
      };
    }

    if (profileAssignments.length > 0) {
      await tx
        .delete(schema.profileNodeAssignments)
        .where(
          and(
            eq(schema.profileNodeAssignments.targetKind, "channel"),
            eq(schema.profileNodeAssignments.targetId, args.channelId)
          )
        );
    }

    let updatedProfiles = 0;
    for (const row of profileRows) {
      const defaults =
        row.defaultsJson &&
        typeof row.defaultsJson === "object" &&
        !Array.isArray(row.defaultsJson)
          ? ({ ...(row.defaultsJson as Record<string, unknown>) } as Record<
              string,
              unknown
            >)
          : {};
      const defaultTarget = readDefaultTarget(defaults);
      if (
        !defaultTarget ||
        defaultTarget.kind !== "channel" ||
        defaultTarget.id !== args.channelId
      ) {
        continue;
      }
      delete defaults.defaultTarget;
      await tx
        .update(schema.profileResources)
        .set({
          defaultsJson: defaults,
          updatedAt: now,
        })
        .where(eq(schema.profileResources.id, row.id));
      updatedProfiles += 1;
    }

    const deletedRows = await tx
      .delete(schema.channelResources)
      .where(eq(schema.channelResources.id, args.channelId))
      .returning({ id: schema.channelResources.id });

    return {
      channelId: args.channelId,
      deleted: deletedRows.length > 0,
      removedProfileAssignments: profileAssignments.length,
      updatedProfiles,
    };
  });
}

export async function deleteProfileResource(args: {
  db: Cable3Db;
  profileId: string;
}): Promise<{
  profileId: string;
  deleted: boolean;
  removedNodeAssignments: number;
}> {
  return args.db.transaction(async (tx) => {
    const [profileRows, assignments] = await Promise.all([
      tx
        .select({ id: schema.profileResources.id })
        .from(schema.profileResources)
        .where(eq(schema.profileResources.id, args.profileId)),
      tx
        .select({ nodeId: schema.profileNodeAssignments.nodeId })
        .from(schema.profileNodeAssignments)
        .where(eq(schema.profileNodeAssignments.profileId, args.profileId)),
    ]);

    if (profileRows.length === 0) {
      return {
        profileId: args.profileId,
        deleted: false,
        removedNodeAssignments: 0,
      };
    }

    const deletedRows = await tx
      .delete(schema.profileResources)
      .where(eq(schema.profileResources.id, args.profileId))
      .returning({ id: schema.profileResources.id });

    return {
      profileId: args.profileId,
      deleted: deletedRows.length > 0,
      removedNodeAssignments: assignments.length,
    };
  });
}

export async function getResourceSnapshot(args: {
  db: Cable3Db;
}): Promise<ResourceSnapshot> {
  const [mediaRows, playlistRows, playlistItemRows, blockRows, blockItemRows, channelRows, channelBlockRows, profileRows, profileNodeRows] =
    await Promise.all([
      args.db
        .select()
        .from(schema.mediaResources)
        .orderBy(desc(schema.mediaResources.createdAt), desc(schema.mediaResources.id)),
      args.db
        .select()
        .from(schema.playlistResources)
        .orderBy(desc(schema.playlistResources.updatedAt), desc(schema.playlistResources.id)),
      args.db.select().from(schema.playlistItems).orderBy(
        asc(schema.playlistItems.playlistId),
        asc(schema.playlistItems.itemIndex)
      ),
      args.db
        .select()
        .from(schema.blockResources)
        .orderBy(desc(schema.blockResources.updatedAt), desc(schema.blockResources.id)),
      args.db.select().from(schema.blockItems).orderBy(
        asc(schema.blockItems.blockId),
        asc(schema.blockItems.itemIndex)
      ),
      args.db
        .select()
        .from(schema.channelResources)
        .orderBy(desc(schema.channelResources.updatedAt), desc(schema.channelResources.id)),
      args.db.select().from(schema.channelBlocks).orderBy(
        asc(schema.channelBlocks.channelId),
        asc(schema.channelBlocks.blockIndex)
      ),
      args.db
        .select()
        .from(schema.profileResources)
        .orderBy(desc(schema.profileResources.updatedAt), desc(schema.profileResources.id)),
      args.db
        .select()
        .from(schema.profileNodeAssignments)
        .orderBy(asc(schema.profileNodeAssignments.profileId), asc(schema.profileNodeAssignments.nodeId)),
    ]);

  const playlistItemMap = new Map<string, typeof playlistItemRows>();
  for (const row of playlistItemRows) {
    const list = playlistItemMap.get(row.playlistId) ?? [];
    list.push(row);
    playlistItemMap.set(row.playlistId, list);
  }

  const blockItemMap = new Map<string, typeof blockItemRows>();
  for (const row of blockItemRows) {
    const list = blockItemMap.get(row.blockId) ?? [];
    list.push(row);
    blockItemMap.set(row.blockId, list);
  }

  const channelBlockMap = new Map<string, typeof channelBlockRows>();
  for (const row of channelBlockRows) {
    const list = channelBlockMap.get(row.channelId) ?? [];
    list.push(row);
    channelBlockMap.set(row.channelId, list);
  }

  const profileNodeMap = new Map<string, typeof profileNodeRows>();
  for (const row of profileNodeRows) {
    const list = profileNodeMap.get(row.profileId) ?? [];
    list.push(row);
    profileNodeMap.set(row.profileId, list);
  }

  return {
    media: mediaRows.map((row) => ({
      id: row.id,
      title: row.title ?? undefined,
      artist: row.artist ?? undefined,
      description: row.description ?? undefined,
      sourceType: row.sourceType === "path" ? "path" : "url",
      sourceValue: row.sourceValue,
      thumbnailUrl: row.thumbnailUrl ?? undefined,
      thumbnailObjectKey: row.thumbnailObjectKey ?? undefined,
      web:
        row.webConfigJson &&
        typeof row.webConfigJson === "object" &&
        !Array.isArray(row.webConfigJson)
          ? row.webConfigJson
          : undefined,
      cache: row.cache,
    })),
    playlists: playlistRows.map((row) => ({
      id: row.id,
      title: row.title ?? undefined,
      artist: row.artist ?? undefined,
      description: row.description ?? undefined,
      items: (playlistItemMap.get(row.id) ?? []).map((item) => ({
        index: item.itemIndex,
        mediaId: item.mediaId ?? undefined,
        playlistId: item.childPlaylistId ?? undefined,
        durationSec: item.durationSec ?? undefined,
      })),
    })),
    blocks: blockRows.map((row) => ({
      id: row.id,
      title: row.title ?? undefined,
      mode:
        row.mode === "loop" || row.mode === "once" || row.mode === "clocked"
          ? row.mode
          : undefined,
      items: (blockItemMap.get(row.id) ?? []).map((item) => ({
        index: item.itemIndex,
        mediaId: item.mediaId ?? undefined,
        playlistId: item.playlistId ?? undefined,
        durationSec: item.durationSec ?? undefined,
      })),
    })),
    channels: channelRows.map((row) => ({
      id: row.id,
      number: row.numberText ?? undefined,
      name: row.name ?? undefined,
      blockIds: (channelBlockMap.get(row.id) ?? [])
        .sort((a, b) => a.blockIndex - b.blockIndex)
        .map((item) => item.blockId),
    })),
    profiles: profileRows.map((row) => {
      const defaults = row.defaultsJson ?? {};
      const defaultTargetRaw =
        defaults &&
        typeof defaults === "object" &&
        !Array.isArray(defaults) &&
        "defaultTarget" in defaults
          ? (defaults as { defaultTarget?: unknown }).defaultTarget
          : undefined;
      const defaultTarget =
        defaultTargetRaw &&
        typeof defaultTargetRaw === "object" &&
        !Array.isArray(defaultTargetRaw) &&
        "kind" in defaultTargetRaw &&
        "id" in defaultTargetRaw
          ? {
              kind: String((defaultTargetRaw as Record<string, unknown>).kind) as
                | "media"
                | "playlist"
                | "block"
                | "channel"
                | "profile",
              id: String((defaultTargetRaw as Record<string, unknown>).id),
            }
          : undefined;

      return {
        id: row.id,
        title: row.title ?? undefined,
        defaults:
          defaults && typeof defaults === "object" && !Array.isArray(defaults)
            ? Object.fromEntries(
                Object.entries(defaults).filter(([k]) => k !== "defaultTarget")
              )
            : {},
        defaultTarget,
        nodes: (profileNodeMap.get(row.id) ?? []).map((node) => ({
          nodeId: node.nodeId,
          target: {
            kind: node.targetKind as "media" | "playlist" | "block" | "channel" | "profile",
            id: node.targetId,
          },
          launch: node.launchJson ?? {},
        })),
      };
    }),
  };
}
