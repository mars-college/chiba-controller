import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { PARAM_GALLERY, PARAM_LOCK_KEYS } from "../constants/params";
import { DebugPanel } from "../components/DebugPanel";
import { DialOverlay } from "../components/DialOverlay";
import { DisplayTuningPanel } from "../components/DisplayTuningPanel";
import { createLogger } from "../lib/logger";
import { getFirstParam, parseBooleanParam } from "../lib/queryParams";
import { useRemoteViewStore } from "../store/useRemoteViewStore";

const log = createLogger("remote-view");

export function RemoteView() {
  const params = useRef(new URLSearchParams(window.location.search)).current;
  const lockParam = getFirstParam(params, PARAM_LOCK_KEYS);
  const lockParsed = parseBooleanParam(lockParam);
  const galleryParsed = parseBooleanParam(params.get(PARAM_GALLERY));
  const channelLocked = lockParsed ?? galleryParsed === true;

  const {
    status,
    galleryMode,
    uiScale,
    textScale,
    visibleHours,
    activeThemeId,
    onDisplayChange,
    send,
    isRemoteDebug,
    showGodPanel,
    setRemoteGodmodeOpen,
    filteredGodmodeItems,
    godmodeQuery,
    setGodmodeQuery,
    setDialBuffer,
    showAppPanel,
    showInputPanel,
    showScreenPanel,
    activeScreenId,
    screenOptions,
    screenOptionsLoading,
    screenOptionsError,
    hasAppControls,
    hasKeyboardMouse,
    hasMicControls,
    remoteGuideEnabled,
    remoteControlsStatus,
    remoteControls,
    setActiveScreenId,
    refreshScreenOptions,
    handleRemoteControl,
    setRemotePanel,
    pushDialDigit,
    onMicToggle,
    micToggleDisabled,
    showDebug,
    memoryStats,
    mediaStats,
    dialOverlay,
  } = useRemoteViewStore();
  const padRef = useRef<HTMLDivElement | null>(null);
  const padLastRef = useRef<{ x: number; y: number } | null>(null);
  const padTapRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const scrollPadRef = useRef<HTMLDivElement | null>(null);
  const scrollPadLastYRef = useRef<number | null>(null);
  const keyboardInputRef = useRef<HTMLInputElement | null>(null);
  const [keyboardValue, setKeyboardValue] = useState("");
  const keyboardValueRef = useRef("");
  const [manualScreenId, setManualScreenId] = useState("");
  const isCompactMode = showAppPanel || showInputPanel || showScreenPanel;
  const hideGuideControls = !remoteGuideEnabled && (channelLocked || galleryMode);

  const startPad = useCallback((clientX: number, clientY: number) => {
    padLastRef.current = { x: clientX, y: clientY };
    padTapRef.current = { x: clientX, y: clientY, time: Date.now() };
  }, []);

  const movePad = useCallback(
    (clientX: number, clientY: number) => {
      const last = padLastRef.current;
      const rect = padRef.current?.getBoundingClientRect();
      if (!last || !rect || !rect.width || !rect.height) return;
      const dx = (clientX - last.x) / rect.width;
      const dy = (clientY - last.y) / rect.height;
      padLastRef.current = { x: clientX, y: clientY };
      if (dx === 0 && dy === 0) return;
      send({ type: "mouse", action: "move", dx, dy });
      log.debug("trackpad-move", { dx, dy });
    },
    [send]
  );

  const endPad = useCallback(
    (clientX: number, clientY: number) => {
      const tap = padTapRef.current;
      padLastRef.current = null;
      padTapRef.current = null;
      if (!tap) return;
      const dt = Date.now() - tap.time;
      const dist = Math.hypot(clientX - tap.x, clientY - tap.y);
      if (dt < 450 && dist < 12) {
        send({ type: "mouse", action: "click" });
        log.debug("trackpad-click");
      }
    },
    [send]
  );

  const handlePadPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // ignore if pointer capture unsupported
      }
      startPad(event.clientX, event.clientY);
      log.debug("trackpad-pointer", { phase: "down" });
    },
    [startPad]
  );

  const handlePadPointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      movePad(event.clientX, event.clientY);
    },
    [movePad]
  );

  const handlePadPointerUp = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // ignore if pointer capture unsupported
      }
      endPad(event.clientX, event.clientY);
      log.debug("trackpad-pointer", { phase: "up" });
    },
    [endPad]
  );

  const handlePadPointerCancel = useCallback(() => {
    padLastRef.current = null;
    padTapRef.current = null;
  }, []);

  const handleScrollPadPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // ignore if pointer capture unsupported
      }
      scrollPadLastYRef.current = event.clientY;
      log.debug("scrollpad-pointer", { phase: "down" });
    },
    []
  );

  const handleScrollPadPointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      const lastY = scrollPadLastYRef.current;
      const rect = scrollPadRef.current?.getBoundingClientRect();
      if (lastY === null || !rect || !rect.height) return;
      const dy = (event.clientY - lastY) / rect.height;
      scrollPadLastYRef.current = event.clientY;
      if (Math.abs(dy) < 0.001) return;
      send({ type: "mouse", action: "scroll", dy });
      log.debug("scrollpad-move", { dy });
    },
    [send]
  );

  const handleScrollPadPointerUp = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // ignore if pointer capture unsupported
      }
      scrollPadLastYRef.current = null;
      log.debug("scrollpad-pointer", { phase: "up" });
    },
    []
  );

  const handleScrollPadPointerCancel = useCallback(() => {
    scrollPadLastYRef.current = null;
  }, []);


  const handleKeyboardChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const next = event.currentTarget.value;
      const prev = keyboardValueRef.current;
      if (next === prev) return;
      if (next.startsWith(prev)) {
        const delta = next.slice(prev.length);
        if (delta) {
          send({ type: "keyboard", action: "text", text: delta });
        }
      } else if (prev.startsWith(next)) {
        const count = prev.length - next.length;
        if (count > 0) {
          send({ type: "keyboard", action: "backspace", count });
        }
      } else {
        if (prev.length) {
          send({ type: "keyboard", action: "backspace", count: prev.length });
        }
        if (next) {
          send({ type: "keyboard", action: "text", text: next });
        }
      }
      keyboardValueRef.current = next;
      setKeyboardValue(next);
    },
    [send]
  );

  const handleKeyboardKey = useCallback(
    (key: "Enter" | "Escape" | "Tab") => {
      send({ type: "keyboard", action: "key", key });
    },
    [send]
  );

  const handleKeyboardBackspace = useCallback(() => {
    send({ type: "keyboard", action: "backspace", count: 1 });
  }, [send]);

  const handleKeyboardInputKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        send({ type: "keyboard", action: "key", key: "Enter" });
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        send({ type: "keyboard", action: "key", key: "Escape" });
        return;
      }
      if (event.key === "Tab") {
        event.preventDefault();
        send({ type: "keyboard", action: "key", key: "Tab" });
      }
    },
    [send]
  );

  const clearKeyboardBuffer = useCallback(() => {
    keyboardValueRef.current = "";
    setKeyboardValue("");
  }, []);

  useEffect(() => {
    if (!showInputPanel) {
      clearKeyboardBuffer();
    }
  }, [clearKeyboardBuffer, showInputPanel]);

  useEffect(() => {
    setManualScreenId(activeScreenId);
  }, [activeScreenId]);

  return (
    <div
      className={`remote-shell ${isCompactMode ? "app-active" : ""} ${
        showGodPanel ? "godmode-active" : ""
      }`}
    >
      <div className="remote-body">
        <div className="remote-top">
          <button
            className="remote-title-button"
            onClick={() => setRemotePanel("screen")}
          >
            Change Screen
          </button>
          <div className={`remote-status ${status}`}>
            {activeScreenId || "No Screen"}
          </div>
        </div>

        {isRemoteDebug ? (
          <DisplayTuningPanel
            className="remote-display"
            uiScale={uiScale}
            textScale={textScale}
            visibleHours={visibleHours}
            activeThemeId={activeThemeId}
            onChange={onDisplayChange}
          />
        ) : null}

        {showGodPanel ? (
          <div className="remote-god-panel">
            <div className="remote-god-title">God Mode</div>
            <div className="remote-god-subtitle">
              Pick any program
              {filteredGodmodeItems.length
                ? ` · ${filteredGodmodeItems.length}`
                : ""}
            </div>
            <div className="remote-god-search">
              <input
                className="remote-god-input"
                type="search"
                value={godmodeQuery}
                onChange={(event) => setGodmodeQuery(event.target.value)}
                placeholder="Filter programs"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
              />
              {godmodeQuery ? (
                <button
                  className="remote-god-clear"
                  onClick={() => setGodmodeQuery("")}
                >
                  Clear
                </button>
              ) : null}
            </div>
            <div className="remote-god-list">
              {filteredGodmodeItems.length ? (
                filteredGodmodeItems.map((item) => (
                  <button
                    key={item.id}
                    className="remote-god-item"
                    onClick={() => {
                      if (!item.program.url) return;
                      send({
                        type: "godselect",
                        channelId: item.channel.id,
                        url: item.program.url,
                      });
                      setDialBuffer("");
                      setRemoteGodmodeOpen(false);
                    }}
                  >
                    <div className="remote-god-item-title">
                      {item.program.title}
                    </div>
                    <div className="remote-god-item-meta">
                      {item.channel.number} · {item.channel.name}
                      {item.program.subtitle
                        ? ` · ${item.program.subtitle}`
                        : ""}
                    </div>
                  </button>
                ))
              ) : (
                <div className="remote-god-empty">
                  {godmodeQuery ? "No matches found." : "No media found."}
                </div>
              )}
            </div>
            <button
              className="remote-god-close"
              onClick={() => setRemoteGodmodeOpen(false)}
            >
              Close
            </button>
          </div>
        ) : showScreenPanel ? (
          <div className="remote-screen-panel">
            <div className="remote-app-title">
              <span>Select Screen</span>
            </div>
            <button
              className="remote-app-back"
              onClick={() => setRemotePanel("remote")}
            >
              Back to Remote
            </button>
            <div className="remote-screen-current">
              Active: {activeScreenId || "No Screen"}
            </div>
            <div className="remote-screen-manual">
              <input
                type="text"
                className="remote-keyboard-input"
                value={manualScreenId}
                onChange={(event) => setManualScreenId(event.currentTarget.value)}
                placeholder="Enter screen ID"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
              />
              <button
                className="remote-screen-apply"
                disabled={!manualScreenId.trim()}
                onClick={() => setActiveScreenId(manualScreenId)}
              >
                Set Screen
              </button>
            </div>
            <button className="remote-screen-refresh" onClick={refreshScreenOptions}>
              Refresh Node Registry
            </button>
            {screenOptionsLoading ? (
              <div className="remote-app-status">Loading screens…</div>
            ) : null}
            {screenOptionsError ? (
              <div className="remote-app-status">
                Could not load nodes: {screenOptionsError}
              </div>
            ) : null}
            <div className="remote-screen-list">
              {screenOptions.length ? (
                screenOptions.map((option) => (
                  <button
                    key={option.id}
                    className={`remote-screen-option ${
                      option.id === activeScreenId ? "is-active" : ""
                    }`}
                    onClick={() => setActiveScreenId(option.id)}
                  >
                    <span className="remote-screen-option-id">{option.id}</span>
                    <span className="remote-screen-option-label">{option.label}</span>
                    {option.detail ? (
                      <span className="remote-screen-option-detail">
                        {option.detail}
                      </span>
                    ) : null}
                  </button>
                ))
              ) : (
                <div className="remote-god-empty">
                  No nodes found. Add nodes in Ops to target screens.
                </div>
              )}
            </div>
          </div>
        ) : showAppPanel ? (
          <div className="remote-app">
            <div className="remote-app-title">
              <span>App Controls</span>
            </div>
            <button
              className="remote-app-back"
              onClick={() => setRemotePanel("remote")}
            >
              Back to Remote
            </button>
            {remoteControlsStatus === "loading" ? (
              <div className="remote-app-status">Loading controls…</div>
            ) : null}
            {remoteControlsStatus === "missing" ? (
              <div className="remote-app-status">
                No controls yet. Open the app once.
              </div>
            ) : null}
            {remoteControls.length ? (
              <div className="remote-app-controls">
                {remoteControls.map((control) => {
                  if (control.type === "range") {
                    const value =
                      typeof control.value === "number"
                        ? control.value
                        : control.min;
                    return (
                      <label
                        key={control.id}
                        className="remote-control remote-range"
                      >
                        <span className="remote-control-label">
                          {control.label}
                          <span className="remote-control-value">
                            {value.toFixed(2)}
                          </span>
                        </span>
                        <input
                          type="range"
                          min={control.min}
                          max={control.max}
                          step={control.step ?? 0.1}
                          value={value}
                          onChange={(event) =>
                            handleRemoteControl(
                              control.id,
                              Number(event.currentTarget.value)
                            )
                          }
                        />
                      </label>
                    );
                  }
                  if (control.type === "select") {
                    const value =
                      control.value ?? control.options[0]?.value ?? "";
                    return (
                      <label
                        key={control.id}
                        className="remote-control remote-select"
                      >
                        <span className="remote-control-label">
                          {control.label}
                        </span>
                        <select
                          value={value}
                          onChange={(event) =>
                            handleRemoteControl(
                              control.id,
                              event.currentTarget.value
                            )
                          }
                        >
                          {control.options.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    );
                  }
                  if (control.type === "toggle") {
                    const value = Boolean(control.value);
                    return (
                      <div
                        key={control.id}
                        className="remote-control remote-toggle"
                      >
                        <span className="remote-control-label">
                          {control.label}
                        </span>
                        <button
                          className={value ? "is-on" : ""}
                          onClick={() =>
                            handleRemoteControl(control.id, !value)
                          }
                        >
                          {value ? "On" : "Off"}
                        </button>
                      </div>
                    );
                  }
                  return (
                    <div
                      key={control.id}
                      className="remote-control remote-button"
                    >
                      <span className="remote-control-label">
                        {control.label}
                      </span>
                      <button
                        onClick={() =>
                          handleRemoteControl(control.id, Date.now())
                        }
                      >
                        Trigger
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : showInputPanel ? (
          <div className="remote-input">
            <div className="remote-app-title">
              <span>Keyboard / Mouse</span>
            </div>
            <button
              className="remote-app-back"
              onClick={() => setRemotePanel("remote")}
            >
              Back to Remote
            </button>
            <div
              className="remote-trackpad"
              ref={padRef}
              onPointerDown={handlePadPointerDown}
              onPointerMove={handlePadPointerMove}
              onPointerUp={handlePadPointerUp}
              onPointerCancel={handlePadPointerCancel}
            >
              <div className="remote-trackpad-label">
                Drag to move · Tap to click
              </div>
            </div>
            <div className="remote-keyboard">
              <input
                ref={keyboardInputRef}
                className="remote-keyboard-input"
                type="text"
                value={keyboardValue}
                onChange={handleKeyboardChange}
                onKeyDown={handleKeyboardInputKeyDown}
                onBlur={clearKeyboardBuffer}
                placeholder="Type here to send keys"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
              />
              <div className="remote-keyboard-actions">
                <button onClick={handleKeyboardBackspace}>Backspace</button>
                <button onClick={() => handleKeyboardKey("Enter")}>Enter</button>
                <button onClick={() => handleKeyboardKey("Escape")}>Esc</button>
              </div>
              <div
                className="remote-scrollpad"
                ref={scrollPadRef}
                onPointerDown={handleScrollPadPointerDown}
                onPointerMove={handleScrollPadPointerMove}
                onPointerUp={handleScrollPadPointerUp}
                onPointerCancel={handleScrollPadPointerCancel}
              >
                <div className="remote-scrollpad-label">
                  Drag up/down to scroll
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="remote-controls">
              {hideGuideControls ? null : (
                <div className="rocker">
                  <button onClick={() => send({ type: "channel", dir: "up" })}>
                    CH UP
                  </button>
                  <span>CH</span>
                  <button
                    onClick={() => send({ type: "channel", dir: "down" })}
                  >
                    CH DOWN
                  </button>
                </div>
              )}

              <div className="rocker">
                <button onClick={() => send({ type: "volume", dir: "up" })}>
                  VOL UP
                </button>
                <span>VOL</span>
                <button onClick={() => send({ type: "volume", dir: "down" })}>
                  VOL DOWN
                </button>
              </div>
            </div>

            {hideGuideControls ? null : (
              <div className="remote-dpad">
                <button
                  className="up"
                  onClick={() => send({ type: "nav", dir: "up" })}
                >
                  <svg viewBox="0 0 48 48" aria-hidden="true">
                    <path d="M24 6l14 16h-8v20H18V22h-8L24 6z" />
                  </svg>
                </button>
                <button
                  className="left"
                  onClick={() => send({ type: "nav", dir: "left" })}
                >
                  <svg viewBox="0 0 48 48" aria-hidden="true">
                    <path d="M6 24l16-14v8h20v12H22v8L6 24z" />
                  </svg>
                </button>
                <button
                  className="ok"
                  onClick={() => send({ type: "select" })}
                >
                  OK
                </button>
                <button
                  className="right"
                  onClick={() => send({ type: "nav", dir: "right" })}
                >
                  <svg viewBox="0 0 48 48" aria-hidden="true">
                    <path d="M42 24L26 38v-8H6V18h20v-8l16 14z" />
                  </svg>
                </button>
                <button
                  className="down"
                  onClick={() => send({ type: "nav", dir: "down" })}
                >
                  <svg viewBox="0 0 48 48" aria-hidden="true">
                    <path d="M24 42L10 26h8V6h12v20h8L24 42z" />
                  </svg>
                </button>
              </div>
            )}

            <div className="remote-actions">
              {hideGuideControls ? null : (
                <button onClick={() => send({ type: "guide" })}>Guide</button>
              )}
              <button onClick={() => send({ type: "info" })}>Info</button>
              <button onClick={() => send({ type: "mute" })}>Mute</button>
            </div>

            <div className="remote-feature-row">
              <button
                className={`remote-feature-button ${
                  hasAppControls ? "is-available" : ""
                }`}
                onClick={() => setRemotePanel("app")}
                disabled={!hasAppControls}
              >
                App Controls
              </button>
              <button
                className={`remote-feature-button ${
                  hasKeyboardMouse ? "is-available" : ""
                }`}
                onClick={() => setRemotePanel("input")}
                disabled={!hasKeyboardMouse}
              >
                Mouse
              </button>
              <button
                className={`remote-feature-button ${
                  hasMicControls ? "is-available" : ""
                }`}
                onClick={onMicToggle}
                disabled={!hasMicControls || micToggleDisabled}
              >
                Mic
              </button>
            </div>

            {hideGuideControls ? null : (
              <div className="remote-numpad">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                  <button
                    key={num}
                    disabled={showAppPanel || showInputPanel}
                    onClick={() => pushDialDigit(num)}
                  >
                    {num}
                  </button>
                ))}
                <button
                  className="zero"
                  disabled={showAppPanel || showInputPanel}
                  onClick={() => pushDialDigit(0)}
                >
                  0
                </button>
              </div>
            )}
          </>
        )}
      </div>
      <DebugPanel show={showDebug} memoryStats={memoryStats} mediaStats={mediaStats} />
      <DialOverlay value={dialOverlay} />
    </div>
  );
}
