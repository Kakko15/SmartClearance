import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { authAxios } from "../../services/api";
import { BellIcon } from "../ui/Icons";

export default function NotificationBell({ isDarkMode = false }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const { data } = await authAxios.get("notifications");
      if (data.success) {
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const markAsRead = async (id) => {
    try {
      await authAxios.post(`notifications/read/${id}`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // silent
    }
  };

  const markAllRead = async () => {
    setLoading(true);
    try {
      await authAxios.post("notifications/read-all");
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const typeColors = {
    success: isDarkMode ? "text-emerald-400" : "text-emerald-600",
    warning: isDarkMode ? "text-amber-400" : "text-amber-600",
    error: isDarkMode ? "text-red-400" : "text-red-600",
    info: isDarkMode ? "text-blue-400" : "text-blue-600",
  };

  const formatTime = (dateStr) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = (now - d) / 1000;
    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setOpen(!open); if (!open) fetchNotifications(); }}
        className={`relative p-2 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ${
          isDarkMode ? "hover:bg-white/10 text-slate-300 focus-visible:ring-offset-gray-900" : "hover:bg-slate-100 text-slate-600"
        }`}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <BellIcon className="w-5 h-5" aria-hidden="true" />
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1"
            aria-hidden="true"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </motion.span>
        )}
      </button>

      {/* F10: Screen reader live region for notification count updates */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}` : "No unread notifications"}
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className={`absolute right-0 top-full mt-2 w-80 max-h-[420px] rounded-2xl shadow-xl border overflow-hidden z-50 ${
              isDarkMode
                ? "bg-[#282a2d] border-[#3c4043]"
                : "bg-white border-[#dadce0]"
            }`}
            role="dialog"
            aria-label="Notifications panel"
          >
            <div className={`flex items-center justify-between px-4 py-3 border-b ${
              isDarkMode ? "border-[#3c4043]" : "border-[#e8eaed]"
            }`}>
              <h3 className={`text-sm font-semibold ${isDarkMode ? "text-white" : "text-[#202124]"}`}>
                Notifications
              </h3>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  disabled={loading}
                  className={`text-xs font-medium ${isDarkMode ? "text-blue-400 hover:text-blue-300" : "text-blue-600 hover:text-blue-700"}`}
                >
                  Mark all read
                </button>
              )}
            </div>

            <div className="overflow-y-auto max-h-[360px]">
              {notifications.length === 0 ? (
                <div className={`py-10 text-center text-sm ${isDarkMode ? "text-[#9aa0a6]" : "text-[#5f6368]"}`}>
                  No notifications yet
                </div>
              ) : (
                notifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => { if (!n.read_at) markAsRead(n.id); }}
                    className={`w-full text-left px-4 py-3 border-b last:border-b-0 transition-colors ${
                      isDarkMode
                        ? `border-[#3c4043] ${n.read_at ? "opacity-60" : "bg-white/[0.03]"} hover:bg-white/[0.06]`
                        : `border-[#f1f3f4] ${n.read_at ? "opacity-60" : "bg-blue-50/40"} hover:bg-slate-50`
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {!n.read_at && (
                        <span className="mt-1.5 w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                      )}
                      <div className={`flex-1 ${n.read_at ? "ml-4" : ""}`}>
                        <p className={`text-[13px] font-medium leading-tight ${typeColors[n.type] || (isDarkMode ? "text-white" : "text-[#202124]")}`}>
                          {n.title}
                        </p>
                        <p className={`text-[12px] mt-0.5 leading-snug ${isDarkMode ? "text-[#9aa0a6]" : "text-[#5f6368]"}`}>
                          {n.message}
                        </p>
                        <p className={`text-[11px] mt-1 ${isDarkMode ? "text-[#5f6368]" : "text-[#9aa0a6]"}`}>
                          {formatTime(n.created_at)}
                        </p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
