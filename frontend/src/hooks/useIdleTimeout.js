import { useEffect, useRef, useCallback } from "react";

const ACTIVITY_EVENTS = ["mousedown", "keydown", "touchstart", "scroll", "mousemove"];
const THROTTLE_MS = 30_000; // Only update last-active timestamp every 30s to avoid perf overhead

/**
 * Tracks user activity and calls `onIdle` after `timeoutMs` of inactivity.
 * Shows a warning callback `warningMs` before the timeout fires.
 *
 * - Only active when `enabled` is true (i.e., user is authenticated).
 * - Persists last-active timestamp to sessionStorage so it survives page refreshes.
 * - Throttles activity tracking to avoid performance overhead.
 *
 * @param {Object} options
 * @param {boolean} options.enabled - Whether the timer is active
 * @param {number} options.timeoutMs - Idle duration before logout (default: 15 min)
 * @param {number} options.warningMs - Time before timeout to fire warning (default: 2 min)
 * @param {() => void} options.onIdle - Called when idle timeout expires
 * @param {(secondsLeft: number) => void} [options.onWarning] - Called when warning threshold is reached
 * @param {() => void} [options.onActive] - Called when user becomes active again after warning
 */
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

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  const STORAGE_KEY = "idle_last_active";

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

    // Warning timer — fires (timeoutMs - warningMs) after last activity
    const warningDelay = Math.max(0, timeoutMs - warningMs);
    warningRef.current = setTimeout(() => {
      if (!enabledRef.current) return;
      warningFiredRef.current = true;
      const secondsLeft = Math.ceil(warningMs / 1000);
      onWarning?.(secondsLeft);
    }, warningDelay);

    // Idle timer — fires after full timeoutMs
    timeoutRef.current = setTimeout(() => {
      if (!enabledRef.current) return;
      onIdle();
    }, timeoutMs);
  }, [clearTimers, timeoutMs, warningMs, onIdle, onWarning]);

  const resetActivity = useCallback(() => {
    if (!enabledRef.current) return;

    // Throttle: only process once per THROTTLE_MS
    const now = Date.now();
    if (now - lastThrottleRef.current < THROTTLE_MS) return;
    lastThrottleRef.current = now;

    sessionStorage.setItem(STORAGE_KEY, now.toString());

    // If warning was showing, notify that user is active again
    if (warningFiredRef.current) {
      warningFiredRef.current = false;
      onActive?.();
    }

    startTimers();
  }, [startTimers, onActive]);

  useEffect(() => {
    if (!enabled) {
      clearTimers();
      warningFiredRef.current = false;
      return;
    }

    // On mount/enable: check if we were idle before a page refresh
    const lastActive = parseInt(sessionStorage.getItem(STORAGE_KEY) || "0", 10);
    const elapsed = Date.now() - lastActive;

    if (lastActive > 0 && elapsed >= timeoutMs) {
      // L21 FIX: Instead of firing idle immediately after browser sleep/wake,
      // give a 10-second grace period so the user sees the page before being signed out.
      const GRACE_PERIOD_MS = 10_000;
      const graceTimer = setTimeout(() => {
        if (!enabledRef.current) return;
        onIdle();
      }, GRACE_PERIOD_MS);
      // If user interacts during grace period, the activity listener will reset timers
      return () => clearTimeout(graceTimer);
    }

    // Set initial timestamp if none exists
    if (!lastActive) {
      sessionStorage.setItem(STORAGE_KEY, Date.now().toString());
    }

    // Start timers accounting for time already elapsed
    const remaining = lastActive > 0 ? Math.max(0, timeoutMs - elapsed) : timeoutMs;
    const warningDelay = Math.max(0, remaining - warningMs);

    clearTimers();

    warningRef.current = setTimeout(() => {
      if (!enabledRef.current) return;
      warningFiredRef.current = true;
      const secondsLeft = Math.ceil(Math.min(warningMs, remaining) / 1000);
      onWarning?.(secondsLeft);
    }, warningDelay);

    timeoutRef.current = setTimeout(() => {
      if (!enabledRef.current) return;
      onIdle();
    }, remaining);

    // Listen for user activity
    ACTIVITY_EVENTS.forEach((event) => {
      document.addEventListener(event, resetActivity, { passive: true });
    });

    // Listen for activity in other tabs via storage events
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
  }, [enabled, timeoutMs, warningMs, onIdle, onWarning, onActive, clearTimers, resetActivity]);
}
