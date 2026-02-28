import { useCallback, useEffect, useState } from "react";
import { createLogger } from "../lib/logger";
import type { RemoteControl, RemoteMessage, ViewMode } from "../types/guide";

export type RemoteControlsStatus = "idle" | "loading" | "ready" | "missing";

type RemoteControlsOptions = {
  viewMode: ViewMode;
  activeRemoteAppId: string;
  send: (message: RemoteMessage) => void;
  enabled?: boolean;
};

const log = createLogger("remote-controls");

export function useRemoteControls({
  viewMode,
  activeRemoteAppId,
  send,
  enabled = true,
}: RemoteControlsOptions) {
  const [remoteControls, setRemoteControls] = useState<RemoteControl[]>([]);
  const [remoteControlsStatus, setRemoteControlsStatus] =
    useState<RemoteControlsStatus>("idle");
  const [controlDispatchAppId, setControlDispatchAppId] = useState(
    activeRemoteAppId
  );

  const mergeRemoteControls = useCallback(
    (incoming: RemoteControl[], current: RemoteControl[]) =>
      incoming.map((control) => {
        const prev = current.find((item) => item.id === control.id);
        if (!prev) return control;
        if ("value" in prev && prev.value !== undefined) {
          return { ...control, value: prev.value } as RemoteControl;
        }
        return control;
      }),
    []
  );

  const handleRemoteControl = useCallback(
    (controlId: string, value: number | string | boolean) => {
      const dispatchAppId = (controlDispatchAppId || activeRemoteAppId).trim();
      if (!dispatchAppId) return;
      setRemoteControls((prev) =>
        prev.map((control): RemoteControl => {
          if (control.id !== controlId) return control;
          if (control.type === "range" && typeof value === "number") {
            return { ...control, value };
          }
          if (control.type === "select" && typeof value === "string") {
            return { ...control, value };
          }
          if (control.type === "toggle" && typeof value === "boolean") {
            return { ...control, value };
          }
          return control;
        })
      );
      send({ type: "control", appId: dispatchAppId, controlId, value });
    },
    [activeRemoteAppId, controlDispatchAppId, send]
  );

  useEffect(() => {
    if (viewMode !== "remote" || !activeRemoteAppId || !enabled) return;
    let cancelled = false;

    const loadControls = async () => {
      setRemoteControlsStatus((prev) => (prev === "ready" ? prev : "loading"));
      try {
        const res = await fetch(`/api/controls/${activeRemoteAppId}`);
        if (!res.ok) {
          if (!cancelled && res.status === 404) {
            setRemoteControlsStatus("missing");
          }
          return;
        }
        const data = (await res.json()) as {
          appId?: string;
          controlAppId?: string;
          controls?: RemoteControl[];
        };
        if (cancelled) return;
        const nextDispatchAppId = String(
          data.controlAppId || data.appId || activeRemoteAppId
        ).trim();
        if (nextDispatchAppId) {
          setControlDispatchAppId(nextDispatchAppId);
        }
        setRemoteControls((prev) =>
          mergeRemoteControls(data.controls ?? [], prev)
        );
        setRemoteControlsStatus("ready");
      } catch (error) {
        if (!cancelled) setRemoteControlsStatus("missing");
        log.warn("controls-load-failed", error);
      }
    };

    loadControls();
    const interval = window.setInterval(loadControls, 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [viewMode, activeRemoteAppId, enabled, mergeRemoteControls]);

  useEffect(() => {
    if (viewMode !== "remote") return;
    if (!enabled) {
      setRemoteControls([]);
      setControlDispatchAppId(activeRemoteAppId);
      setRemoteControlsStatus("idle");
      return;
    }
    setRemoteControls([]);
    setControlDispatchAppId(activeRemoteAppId);
    setRemoteControlsStatus(activeRemoteAppId ? "loading" : "idle");
  }, [viewMode, activeRemoteAppId, enabled]);

  return {
    remoteControls,
    remoteControlsStatus,
    handleRemoteControl,
    setRemoteControls,
    setRemoteControlsStatus,
  };
}
