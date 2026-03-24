import { useEffect, useRef, useCallback } from "react";
import { supabase } from "../lib/supabase";

let channelCounter = 0;

export default function useRealtimeSubscription(table, onUpdate, options = {}) {
  const { event = "*", filter, enabled = true } = options;
  const onUpdateRef = useRef(onUpdate);
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  const timerRef = useRef(null);
  const debouncedUpdate = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onUpdateRef.current();
    }, 400);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const channelName = `realtime-${table}-${filter || "all"}-${++channelCounter}`;
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
          console.warn(
            `Realtime subscription error on "${table}":`,
            err || status,
          );
        }
      });

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      supabase.removeChannel(channel);
    };
  }, [table, event, filter, enabled, debouncedUpdate]);
}
