import { useEffect, useRef, useCallback } from "react";
import { supabase } from "../lib/supabase";

/**
 * Subscribe to Supabase Realtime changes on a table.
 * When a change is detected, calls `onUpdate` (typically a re-fetch).
 *
 * @param {string} table - The Supabase table name to listen on
 * @param {Function} onUpdate - Callback fired on INSERT/UPDATE/DELETE
 * @param {Object} [options]
 * @param {string} [options.event='*'] - Postgres change event type
 * @param {string} [options.filter] - Supabase realtime filter e.g. "status=eq.pending"
 * @param {boolean} [options.enabled=true] - Toggle subscription on/off
 */
export default function useRealtimeSubscription(table, onUpdate, options = {}) {
  const { event = "*", filter, enabled = true } = options;
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  // Debounce rapid-fire changes so we don't spam the API
  const timerRef = useRef(null);
  const debouncedUpdate = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onUpdateRef.current();
    }, 400);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const channelName = `realtime-${table}-${filter || "all"}-${Date.now()}`;
    const channelConfig = {
      event,
      schema: "public",
      table,
    };
    if (filter) channelConfig.filter = filter;

    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", channelConfig, () => {
        debouncedUpdate();
      })
      .subscribe((status, err) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn(`Realtime subscription error on "${table}":`, err || status);
        }
      });

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      supabase.removeChannel(channel);
    };
  }, [table, event, filter, enabled, debouncedUpdate]);
}
