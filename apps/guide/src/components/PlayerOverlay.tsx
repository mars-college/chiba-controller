import { useEffect, useRef, useState, useMemo, type CSSProperties, type RefObject } from "react";
import { createLogger } from "../lib/logger";
import { getMediaKind as inferMediaKind } from "../lib/media";
import type {
  CacheWarmStatus,
  GuideChannel,
  MediaKind,
  PlayerMeta,
  ProgramSlot,
} from "../types/guide";

const log = createLogger("player-overlay");
const IMAGE_DURATION_DEFAULT_SEC = 15;

type PlayerOverlayProps = {
  playerUrl: string | null;
  playerOpen: boolean;
  playerReady: boolean;
  playerKind: MediaKind | null;
  playerMeta: PlayerMeta | null;
  loadingStatus: CacheWarmStatus | null;
  selectedChannel?: GuideChannel;
  selectedProgram?: ProgramSlot | null;
  showPlayerHud: boolean;
  loopVideo?: boolean;
  imageDurationSec?: number;
  onMediaEnded?: () => void;
  onMediaError?: (kind: MediaKind, url: string) => void;
  ambientAudio: {
    url: string;
    volume?: number;
    offsetMinSec?: number;
    offsetMaxSec?: number;
  } | null;
  masterVolume: number;
  masterMuted: boolean;
  setPlayerReady: (ready: boolean) => void;
  surfaceRef?: RefObject<HTMLDivElement | null>;
  remoteCursor?: { x: number; y: number; visible: boolean; pressed: boolean };
  forceCursor?: boolean;
};

export function PlayerOverlay({
  playerUrl,
  playerOpen,
  playerReady,
  playerKind,
  playerMeta,
  loadingStatus,
  selectedChannel,
  selectedProgram,
  showPlayerHud,
  loopVideo = true,
  imageDurationSec,
  onMediaEnded,
  onMediaError,
  ambientAudio,
  masterVolume,
  masterMuted,
  setPlayerReady,
  surfaceRef,
  remoteCursor,
  forceCursor = false,
}: PlayerOverlayProps) {
  const ambientAudioRef = useRef<HTMLAudioElement | null>(null);
  const mediaAudioRef = useRef<HTMLAudioElement | null>(null);
  const mediaVideoRef = useRef<HTMLVideoElement | null>(null);
  const didSeekRef = useRef(false);
  const onMediaEndedRef = useRef(onMediaEnded);
  const [ambientOffsetSec, setAmbientOffsetSec] = useState<number | null>(null);
  const [sniffedKind, setSniffedKind] = useState<MediaKind | null>(null);

  useEffect(() => {
    onMediaEndedRef.current = onMediaEnded;
  }, [onMediaEnded]);

  const playlistForcesNoLoop = useMemo(() => {
    // Defensive: force no-loop in gallery playlist mode even if props are stale.
    try {
      const params = new URLSearchParams(window.location.search);
      const norm = (v: string | null) => (v ?? "").trim().toLowerCase();
      const truthy = (v: string | null) => ["1", "true", "yes", "on"].includes(norm(v));
      const gallery = truthy(params.get("gallery"));
      const playlist = truthy(params.get("playlist"));
      return gallery && playlist;
    } catch {
      return false;
    }
  }, []);

  const effectivePlayerKind = useMemo(() => {
    if (!playerUrl) return playerKind;
    const inferred = inferMediaKind(playerUrl);
    return playerKind === "iframe" && inferred !== "iframe" ? inferred : playerKind ?? inferred;
  }, [playerKind, playerUrl]);
  const resolvedPlayerKind = sniffedKind ?? effectivePlayerKind;

  useEffect(() => {
    setSniffedKind(null);
  }, [playerUrl]);

  useEffect(() => {
    if (!playerUrl) return;
    if (effectivePlayerKind && effectivePlayerKind !== "iframe") return;
    let cancelled = false;
    const ac = new AbortController();
    const inferFromContentType = (contentType: string | null): MediaKind | null => {
      const ct = (contentType ?? "").toLowerCase();
      if (!ct) return null;
      if (ct.startsWith("video/")) return "video";
      if (ct.startsWith("image/")) return "image";
      if (ct.startsWith("audio/")) return "audio";
      return null;
    };
    const sniffKind = async () => {
      const attempts: Array<{ method: "HEAD" | "GET"; headers?: Record<string, string> }> = [
        { method: "HEAD" },
        { method: "GET", headers: { Range: "bytes=0-0" } },
      ];
      for (const attempt of attempts) {
        try {
          const response = await fetch(playerUrl, {
            method: attempt.method,
            headers: attempt.headers,
            signal: ac.signal,
          });
          const inferred = inferFromContentType(response.headers.get("content-type"));
          if (inferred) {
            if (!cancelled) {
              setSniffedKind(inferred);
              log.debug("kind-sniffed", {
                url: playerUrl,
                method: attempt.method,
                contentType: response.headers.get("content-type"),
                inferred,
              });
            }
            return;
          }
        } catch {
          // Ignore network/CORS failures and keep iframe fallback.
        }
      }
    };
    void sniffKind();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [playerUrl, effectivePlayerKind]);

  const playlistTimedAdvanceFallback = useMemo(() => {
    // In gallery+playlist mode, unknown/iframe kinds should still advance.
    // This prevents "stuck on one frame" when a URL extension cannot be inferred.
    if (!playlistForcesNoLoop) return false;
    return resolvedPlayerKind === "iframe" || !resolvedPlayerKind;
  }, [playlistForcesNoLoop, resolvedPlayerKind]);

  const effectiveLoopVideo = playlistForcesNoLoop ? false : loopVideo;
  useEffect(() => {
    if (!playerUrl) return;
    log.info("mount", { url: playerUrl, kind: resolvedPlayerKind, open: playerOpen });
    return () => {
      log.info("unmount", { url: playerUrl, kind: resolvedPlayerKind });
    };
  }, [playerUrl, resolvedPlayerKind, playerOpen]);

  useEffect(() => {
    if (!playerUrl) return;
    log.debug("state", { url: playerUrl, kind: resolvedPlayerKind, open: playerOpen });
  }, [playerUrl, resolvedPlayerKind, playerOpen]);

  const iframePolicy = useMemo(() => {
    if (!playerUrl) {
      return {
        allow: "autoplay; fullscreen",
        sandbox: "allow-scripts allow-same-origin allow-pointer-lock",
      };
    }
    const isTrusted =
      playerUrl.startsWith("/mars") ||
      playerUrl.startsWith("/village/live") ||
      playerUrl.startsWith("/embed/");
    return {
      allow: isTrusted
        ? "autoplay; fullscreen; camera; microphone"
        : "autoplay; fullscreen",
      sandbox: isTrusted
        ? undefined
        : "allow-scripts allow-same-origin allow-pointer-lock",
    };
  }, [playerUrl]);

  useEffect(() => {
    if (!ambientAudio?.url || !playerOpen) {
      setAmbientOffsetSec(null);
      return;
    }
    const rawMin = ambientAudio.offsetMinSec ?? 0;
    const rawMax = ambientAudio.offsetMaxSec ?? rawMin;
    const min = Number.isFinite(rawMin) ? Math.max(0, rawMin) : 0;
    const max = Number.isFinite(rawMax) ? Math.max(min, rawMax) : min;
    const nextOffset = max <= min ? min : min + Math.random() * (max - min);
    setAmbientOffsetSec(nextOffset);
  }, [
    ambientAudio?.url,
    ambientAudio?.offsetMinSec,
    ambientAudio?.offsetMaxSec,
    playerOpen,
  ]);

  useEffect(() => {
    didSeekRef.current = false;
  }, [ambientAudio?.url, playerOpen]);

  useEffect(() => {
    const audio = ambientAudioRef.current;
    if (!audio) return;
    const base =
      typeof ambientAudio?.volume === "number" &&
      Number.isFinite(ambientAudio.volume)
        ? ambientAudio.volume
        : 1;
    audio.volume = Math.min(1, Math.max(0, base * masterVolume));
    audio.muted = masterMuted || !playerOpen;
  }, [
    ambientAudio?.volume,
    ambientAudio?.url,
    masterVolume,
    masterMuted,
    playerOpen,
  ]);

  useEffect(() => {
    const audio = mediaAudioRef.current;
    if (audio) {
      audio.volume = Math.min(1, Math.max(0, masterVolume));
      audio.muted = masterMuted || !playerOpen;
    }
    const video = mediaVideoRef.current;
    if (video) {
      video.volume = Math.min(1, Math.max(0, masterVolume));
      video.muted = masterMuted || !playerOpen;
    }
  }, [masterVolume, masterMuted, playerOpen, resolvedPlayerKind]);

  useEffect(() => {
    const audio = ambientAudioRef.current;
    if (!audio || ambientOffsetSec === null) return;
    const target = Math.max(0, ambientOffsetSec);
    const shouldSeek = () => {
      if (!Number.isFinite(audio.currentTime)) return true;
      return Math.abs(audio.currentTime - target) > 0.05;
    };
    const seek = () => {
      if (didSeekRef.current && !shouldSeek()) return;
      try {
        const duration = Number.isFinite(audio.duration)
          ? audio.duration
          : null;
        audio.currentTime =
          duration && duration > 0 ? Math.min(target, duration - 0.5) : target;
        didSeekRef.current = true;
      } catch {
        return;
      }
    };
    if (audio.readyState >= 1) {
      seek();
    }
    audio.addEventListener("loadedmetadata", seek);
    audio.addEventListener("canplay", seek);
    audio.addEventListener("play", seek);
    return () => {
      audio.removeEventListener("loadedmetadata", seek);
      audio.removeEventListener("canplay", seek);
      audio.removeEventListener("play", seek);
    };
  }, [ambientOffsetSec, ambientAudio?.url]);

  useEffect(() => {
    // Best-effort autoplay: some Chromium builds can still be finicky in kiosk mode.
    if (!playerOpen) return;
    if (!playerUrl) return;
    if (resolvedPlayerKind !== "video" && resolvedPlayerKind !== "audio") return;

    const target = resolvedPlayerKind === "video" ? mediaVideoRef.current : mediaAudioRef.current;
    if (!target) return;

    let cancelled = false;
    const desiredMuted = masterMuted || !playerOpen;
    const tryPlay = async (reason: "mount" | "canplay" | "loadeddata") => {
      // For autoplay reliability, start muted and restore desired mute after play resolves.
      const restoreMuted = desiredMuted;
      if (!desiredMuted) {
        target.muted = true;
      }
      try {
        await target.play();
        if (!cancelled) {
          target.muted = restoreMuted;
          log.debug("autoplay-ok", { url: playerUrl, kind: resolvedPlayerKind, reason });
        }
      } catch (err) {
        if (cancelled) return;
        target.muted = restoreMuted;
        log.warn("autoplay-failed", { url: playerUrl, kind: resolvedPlayerKind, err: String(err) });
      }
    };

    const onCanPlay = () => void tryPlay("canplay");
    const onLoadedData = () => void tryPlay("loadeddata");
    target.addEventListener("canplay", onCanPlay);
    target.addEventListener("loadeddata", onLoadedData);
    // Defer one tick so `muted` props have applied.
    const t = window.setTimeout(() => void tryPlay("mount"), 0);
    return () => {
      cancelled = true;
      target.removeEventListener("canplay", onCanPlay);
      target.removeEventListener("loadeddata", onLoadedData);
      window.clearTimeout(t);
    };
  }, [playerOpen, playerUrl, resolvedPlayerKind, masterMuted]);

  useEffect(() => {
    if (!playerOpen) return;
    if (!playerUrl) return;
    if (resolvedPlayerKind !== "image" && !playlistTimedAdvanceFallback) return;
    const sec =
      typeof imageDurationSec === "number" && imageDurationSec > 0
        ? imageDurationSec
        : IMAGE_DURATION_DEFAULT_SEC;
    const timer = window.setTimeout(() => {
      onMediaEndedRef.current?.();
    }, Math.round(sec * 1000));
    return () => window.clearTimeout(timer);
  }, [
    imageDurationSec,
    resolvedPlayerKind,
    playlistTimedAdvanceFallback,
    playerOpen,
    playerUrl,
  ]);

  if (!playerUrl) return null;

  const cursorState = remoteCursor ?? {
    x: 0.5,
    y: 0.5,
    visible: forceCursor,
    pressed: false,
  };
  const showCursor = playerOpen;
  const cursorStyle: CSSProperties | undefined = showCursor
    ? {
        left: "var(--remote-cursor-x, 50%)",
        top: "var(--remote-cursor-y, 50%)",
      }
    : undefined;

  return (
    <div
      className={`player-overlay ${playerOpen ? "is-open" : ""}`}
      aria-hidden={!playerOpen}
    >
      <div className="player-surface" ref={surfaceRef}>
        {resolvedPlayerKind === "image" ? (
          <img
            className="player-media player-image"
            src={playerUrl}
            alt={playerMeta?.title ?? "Program image"}
            onLoad={() => {
              log.info("loaded", { url: playerUrl, kind: "image" });
              setPlayerReady(true);
            }}
            onError={() => {
              log.warn("error", { url: playerUrl, kind: "image" });
              onMediaError?.("image", playerUrl);
            }}
          />
        ) : resolvedPlayerKind === "video" ? (
          <video
            className="player-media player-video"
            src={playerUrl}
            autoPlay
            loop={effectiveLoopVideo}
            muted
            playsInline
            ref={mediaVideoRef}
            onLoadedData={() => {
              log.info("loaded", { url: playerUrl, kind: "video" });
              setPlayerReady(true);
            }}
            onEnded={() => {
              onMediaEnded?.();
            }}
            onError={() => {
              log.warn("error", { url: playerUrl, kind: "video" });
              onMediaError?.("video", playerUrl);
            }}
          />
        ) : resolvedPlayerKind === "audio" ? (
          <div className="player-audio">
            <div className="player-audio-visual" />
            <audio
              ref={mediaAudioRef}
              src={playerUrl}
              autoPlay
              loop
              muted
              onCanPlay={() => {
                log.info("loaded", { url: playerUrl, kind: "audio" });
                setPlayerReady(true);
              }}
              onError={() => {
                log.warn("error", { url: playerUrl, kind: "audio" });
                onMediaError?.("audio", playerUrl);
              }}
            />
          </div>
        ) : (
          <iframe
            className="player-frame"
            src={playerUrl}
            title={playerMeta?.title ?? "Program"}
            allow={iframePolicy.allow}
            sandbox={iframePolicy.sandbox}
            onLoad={() => {
              log.info("loaded", { url: playerUrl, kind: "iframe" });
              setPlayerReady(true);
            }}
          />
        )}
        {playerOpen && ambientAudio?.url ? (
          <audio
            ref={ambientAudioRef}
            className="player-ambient-audio"
            src={ambientAudio.url}
            autoPlay
            loop
            playsInline
            muted={masterMuted || !playerOpen}
          />
        ) : null}
        <div className={`player-loading ${playerReady ? "is-hidden" : ""}`}>
          <div className="player-loading-content">
            <span className="player-loading-label">
              {loadingStatus?.label ?? "Tuning…"}
            </span>
            <span className="player-loading-sub">
              {loadingStatus?.detail ?? "Signal lock"}
            </span>
            {loadingStatus?.total && typeof loadingStatus.cached === "number" ? (
              <span className="player-loading-sub player-loading-progress">
                {loadingStatus.cached}/{loadingStatus.total} ready
              </span>
            ) : null}
          </div>
        </div>
        {showPlayerHud ? (
          <div className="player-hud">
            <div className="player-channel">
              {playerMeta?.callSign ?? selectedChannel?.callSign ?? "CH"}
            </div>
            <div className="player-title">
              {playerMeta?.title ?? selectedProgram?.title}
            </div>
            {playerMeta?.artist ? (
              <div className="player-artist">{playerMeta.artist}</div>
            ) : null}
            {(() => {
              const subtitle = (playerMeta?.subtitle ?? selectedProgram?.subtitle ?? "").trim();
              // "Loop" is useful in the grid, but looks like junk in the info card.
              if (!subtitle) return null;
              if (subtitle.toLowerCase() === "loop") return null;
              return <div className="player-subtitle">{subtitle}</div>;
            })()}
            {playerMeta?.description ? (
              <div className="player-description">{playerMeta.description}</div>
            ) : null}
          </div>
        ) : null}
        {showCursor ? (
          <div
            className={`remote-cursor ${cursorState.pressed ? "is-pressed" : ""}`}
            style={cursorStyle}
          />
        ) : null}
      </div>
    </div>
  );
}
