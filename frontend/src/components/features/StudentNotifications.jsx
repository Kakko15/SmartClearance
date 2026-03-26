import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { authAxios } from "../../services/api";
import { GlassCard } from "../ui/DashboardLayout";
import {
  BellIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  CheckIcon,
  InboxStackIcon,
} from "../ui/Icons";

const TYPE_CONFIG = {
  success: {
    icon: CheckCircleIcon,
    lightBg: "bg-emerald-50",
    darkBg: "bg-emerald-500/10",
    lightText: "text-emerald-600",
    darkText: "text-emerald-400",
    lightBorder: "border-emerald-200",
    darkBorder: "border-emerald-500/20",
  },
  warning: {
    icon: XCircleIcon,
    lightBg: "bg-amber-50",
    darkBg: "bg-amber-500/10",
    lightText: "text-amber-600",
    darkText: "text-amber-400",
    lightBorder: "border-amber-200",
    darkBorder: "border-amber-500/20",
  },
  info: {
    icon: BellIcon,
    lightBg: "bg-blue-50",
    darkBg: "bg-blue-500/10",
    lightText: "text-blue-600",
    darkText: "text-blue-400",
    lightBorder: "border-blue-200",
    darkBorder: "border-blue-500/20",
  },
  error: {
    icon: XCircleIcon,
    lightBg: "bg-red-50",
    darkBg: "bg-red-500/10",
    lightText: "text-red-600",
    darkText: "text-red-400",
    lightBorder: "border-red-200",
    darkBorder: "border-red-500/20",
  },
};

const FILTER_TABS = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "success", label: "Approvals" },
  { id: "warning", label: "Alerts" },
];

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export default function StudentNotifications({ isDarkMode = false }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [markingAll, setMarkingAll] = useState(false);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await authAxios.get("/notifications");
      if (data.success) setNotifications(data.notifications || []);
    } catch {

    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAsRead = async (id) => {
    try {
      await authAxios.post(`/notifications/read/${id}`);
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, read_at: new Date().toISOString() } : n,
        ),
      );
    } catch {

    }
  };

  const markAllRead = async () => {
    setMarkingAll(true);
    try {
      await authAxios.post("/notifications/read-all");
      setNotifications((prev) =>
        prev.map((n) => ({
          ...n,
          read_at: n.read_at || new Date().toISOString(),
        })),
      );
    } catch {

    } finally {
      setMarkingAll(false);
    }
  };

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  const filtered = notifications.filter((n) => {
    if (filter === "unread") return !n.read_at;
    if (filter === "success") return n.type === "success";
    if (filter === "warning")
      return n.type === "warning" || n.type === "error";
    return true;
  });

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <GlassCard key={i} isDark={isDarkMode} className="p-5 border-none shadow-[0_1px_2px_0_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)] rounded-3xl">
            <div className="flex items-start gap-4">
              <div
                className={`w-10 h-10 rounded-full animate-pulse ${isDarkMode ? "bg-white/10" : "bg-black/5"}`}
              />
              <div className="flex-1">
                <div
                  className={`h-4 w-48 rounded animate-pulse ${isDarkMode ? "bg-white/10" : "bg-black/5"}`}
                />
                <div
                  className={`h-3 w-64 rounded mt-2.5 animate-pulse ${isDarkMode ? "bg-white/5" : "bg-black/5"}`}
                />
                <div
                  className={`h-3 w-20 rounded mt-2 animate-pulse ${isDarkMode ? "bg-white/5" : "bg-black/5"}`}
                />
              </div>
            </div>
          </GlassCard>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2 flex-wrap">
          {FILTER_TABS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filter === f.id
                  ? isDarkMode
                    ? "bg-primary-400 text-[#202124]"
                    : "bg-primary-600 text-white"
                  : isDarkMode
                    ? "bg-[#3c4043] text-[#e8eaed] hover:bg-[#4c4f53]"
                    : "bg-[#f1f3f4] text-[#5f6368] hover:bg-[#e8eaed]"
              }`}
            >
              {f.label}
              {f.id === "unread" && unreadCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500 text-white">
                  {unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>
        {unreadCount > 0 && (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={markAllRead}
            disabled={markingAll}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              isDarkMode
                ? "bg-[#3c4043] text-primary-400 hover:bg-[#4c4f53]"
                : "bg-primary-50 text-primary-700 hover:bg-primary-100"
            } ${markingAll ? "opacity-50" : ""}`}
          >
            <CheckIcon className="w-4 h-4" />
            Mark all read
          </motion.button>
        )}
      </div>

      {filtered.length === 0 ? (
        <GlassCard isDark={isDarkMode} className="p-12 text-center border-none shadow-[0_1px_2px_0_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)] rounded-3xl relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none opacity-20 z-0">
             <motion.div animate={{ rotate: 360 }} transition={{ duration: 50, repeat: Infinity, ease: "linear" }} className="absolute -top-20 -right-20 w-64 h-64 bg-primary-400 rounded-full mix-blend-multiply filter blur-3xl opacity-50" />
             <motion.div animate={{ rotate: -360 }} transition={{ duration: 50, repeat: Infinity, ease: "linear" }} className="absolute -bottom-20 -left-20 w-64 h-64 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-50" />
          </div>
          <div className="relative z-10">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 20 }}
              className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner ${isDarkMode ? "bg-[#3c4043]" : "bg-white"}`}
            >
            <InboxStackIcon
              className={`w-10 h-10 ${isDarkMode ? "text-primary-400" : "text-primary-600"}`}
            />
          </motion.div>
          <h3
            className={`text-xl font-medium mb-1.5 ${isDarkMode ? "text-[#e8eaed]" : "text-[#202124]"}`}
            style={{ fontFamily: "Google Sans, sans-serif" }}
          >
            {filter === "unread" ? "All caught up!" : "No notifications"}
          </h3>
          <p
            className={`text-sm ${isDarkMode ? "text-[#9aa0a6]" : "text-[#5f6368]"}`}
          >
            {filter === "unread"
              ? "You have no unread notifications."
              : "Notifications about your clearance will appear here."}
          </p>
          </div>
        </GlassCard>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {filtered.map((n, idx) => {
              const config =
                TYPE_CONFIG[n.type] || TYPE_CONFIG.info;
              const Icon = config.icon;
              const isUnread = !n.read_at;

              return (
                <motion.div
                  layout
                  key={n.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: idx * 0.03, type: "spring", stiffness: 300, damping: 25 }}
                >
                  <GlassCard
                    isDark={isDarkMode}
                    className={`p-4 sm:p-5 rounded-3xl border-none transition-all duration-300 cursor-pointer group hover:-translate-y-0.5 ${
                      isUnread
                        ? (isDarkMode
                          ? "shadow-[0_1px_2px_0_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)] ring-1 ring-primary-500/50"
                          : "shadow-[0_2px_6px_0_rgba(60,64,67,0.15),0_1px_2px_0_rgba(60,64,67,0.3)] ring-1 ring-primary-500/30")
                        : (isDarkMode
                          ? "shadow-[0_1px_2px_0_rgba(60,64,67,0.3)] opacity-80 hover:opacity-100"
                          : "shadow-[0_1px_2px_0_rgba(60,64,67,0.15)] opacity-85 hover:opacity-100")
                    }`}
                    onClick={() => isUnread && markAsRead(n.id)}
                  >
                    <div className="flex items-start gap-3 sm:gap-4">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isDarkMode ? config.darkBg : config.lightBg}`}
                      >
                        <Icon
                          className={`w-5 h-5 ${isDarkMode ? config.darkText : config.lightText}`}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className={`text-[15px] font-medium ${isDarkMode ? "text-[#e8eaed]" : "text-[#202124]"} ${isUnread ? "" : "font-normal"}`}
                            style={{ fontFamily: "Google Sans, sans-serif" }}
                          >
                            {n.title}
                          </p>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span
                              className={`text-xs whitespace-nowrap font-medium ${isDarkMode ? "text-[#9aa0a6]" : "text-[#5f6368]"}`}
                            >
                              {timeAgo(n.created_at)}
                            </span>
                            {isUnread && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="w-2.5 h-2.5 rounded-full bg-primary-500 flex-shrink-0"
                              />
                            )}
                          </div>
                        </div>
                        <p
                          className={`text-sm mt-1 leading-relaxed ${isDarkMode ? "text-[#9aa0a6]" : "text-[#5f6368]"}`}
                        >
                          {n.message}
                        </p>
                      </div>
                    </div>
                  </GlassCard>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
