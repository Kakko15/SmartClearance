import { useEffect, useRef, useCallback } from "react";

const ACTIVITY_EVENTS = [
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
  "mousemove",
];
const THROTTLE_MS = 30_000;

export default function useIdleTimeout({
  enabled = false,
  timeoutMs = 15 * 60 * 1000,
  warningMs = 2 * 60 * 1000,
  onIdle,
  onWarning,
  onActive,
}) {
  const timeoutRef = useRef(null);
  const warningRef = useRef(null);
  const warningFiredRef = useRef(false);
  const lastThrottleRef = useRef(0);
  const enabledRef = useRef(enabled);
  const onIdleRef = useRef(onIdle);
  const onWarningRef = useRef(onWarning);
  const onActiveRef = useRef(onActive);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    onIdleRef.current = onIdle;
    onWarningRef.current = onWarning;
    onActiveRef.current = onActive;
  }, [onIdle, onWarning, onActive]);

  const STORAGE_KEY = "sc_idle_last_active";

  const clearTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (warningRef.current) {
      clearTimeout(warningRef.current);
      warningRef.current = null;
    }
  }, []);

  const startTimers = useCallback(() => {
    clearTimers();

    const warningDelay = Math.max(0, timeoutMs - warningMs);
    warningRef.current = setTimeout(() => {
      if (!enabledRef.current) return;
      warningFiredRef.current = true;
      const secondsLeft = Math.ceil(warningMs / 1000);
      onWarningRef.current?.(secondsLeft);
    }, warningDelay);

    timeoutRef.current = setTimeout(() => {
      if (!enabledRef.current) return;
      onIdleRef.current();
    }, timeoutMs);
  }, [clearTimers, timeoutMs, warningMs]);

  const resetActivity = useCallback(() => {
    if (!enabledRef.current) return;

    const now = Date.now();
    if (now - lastThrottleRef.current < THROTTLE_MS) return;
    lastThrottleRef.current = now;

    localStorage.setItem(STORAGE_KEY, now.toString());

    if (warningFiredRef.current) {
      warningFiredRef.current = false;
      onActiveRef.current?.();
    }

    startTimers();
  }, [startTimers]);

  useEffect(() => {
    if (!enabled) {
      clearTimers();
      warningFiredRef.current = false;
      return;
    }

    const lastActive = parseInt(localStorage.getItem(STORAGE_KEY) || "0", 10);
    const elapsed = Date.now() - lastActive;

    if (lastActive > 0 && elapsed >= timeoutMs) {
      const GRACE_PERIOD_MS = 10_000;
      const graceTimer = setTimeout(() => {
        if (!enabledRef.current) return;
        onIdleRef.current();
      }, GRACE_PERIOD_MS);

      return () => clearTimeout(graceTimer);
    }

    if (!lastActive) {
      localStorage.setItem(STORAGE_KEY, Date.now().toString());
    }

    const remaining =
      lastActive > 0 ? Math.max(0, timeoutMs - elapsed) : timeoutMs;
    const warningDelay = Math.max(0, remaining - warningMs);

    clearTimers();

    warningRef.current = setTimeout(() => {
      if (!enabledRef.current) return;
      warningFiredRef.current = true;
      const secondsLeft = Math.ceil(Math.min(warningMs, remaining) / 1000);
      onWarningRef.current?.(secondsLeft);
    }, warningDelay);

    timeoutRef.current = setTimeout(() => {
      if (!enabledRef.current) return;
      onIdleRef.current();
    }, remaining);

    ACTIVITY_EVENTS.forEach((event) => {
      document.addEventListener(event, resetActivity, { passive: true });
    });

    const handleStorage = (e) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        resetActivity();
      }
    };
    window.addEventListener("storage", handleStorage);

    return () => {
      clearTimers();
      ACTIVITY_EVENTS.forEach((event) => {
        document.removeEventListener(event, resetActivity);
      });
      window.removeEventListener("storage", handleStorage);
    };
  }, [
    enabled,
    timeoutMs,
    warningMs,
    clearTimers,
    resetActivity,
  ]);
}
