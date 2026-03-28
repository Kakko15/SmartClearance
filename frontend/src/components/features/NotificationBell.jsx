import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-hot-toast";
import { authAxios } from "../../services/api";
import { BellIcon } from "../ui/Icons";

const EllipsisIcon = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24"><path d="M6 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" /></svg>
);

export default function NotificationBell({ isDarkMode = false, onOpenSettings, onOpenNotificationsPage, onPendingClick }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [ackPendingCount, setAckPendingCount] = useState(() => parseInt(localStorage.getItem('ackPendingCount') || '0', 10));
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [itemMenuConfig, setItemMenuConfig] = useState(null);
  const ref = useRef(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const { data } = await authAxios.get("notifications");
      if (data.success) {
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      }
    } catch (err) {
      console.warn("Failed to fetch notifications:", err);
    }
  }, []);

  const fetchPendingCount = useCallback(async () => {
    try {
      const { data } = await authAxios.get("notifications/pending-count");
      if (data.success) setPendingCount(data.pendingCount || 0);
    } catch (err) {
      console.warn("Failed to fetch pending count:", err);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    fetchPendingCount();
    const interval = setInterval(() => {
      fetchNotifications();
      fetchPendingCount();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications, fetchPendingCount]);

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setItemMenuConfig(null);
        setHeaderMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const markAsRead = async (id) => {
    // Optimistically update the UI instantly
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, read_at: new Date().toISOString() } : n,
      ),
    );
    setUnreadCount((c) => Math.max(0, c - 1));

    try {
      await authAxios.post(`notifications/read/${id}`);
    } catch (err) {
      console.warn("Failed to mark notification as read:", err);
      // Revert optimism strictly if it failed
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, read_at: null } : n,
        ),
      );
      setUnreadCount((c) => c + 1);
    }
  };

  const markAsUnread = async (id) => {
    // Optimistically update the UI instantly
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, read_at: null } : n,
      ),
    );
    setUnreadCount((c) => c + 1);

    try {
      await authAxios.post(`notifications/unread/${id}`);
    } catch (err) {
      console.warn("Failed to mark unread:", err);
      // Revert optimism if failed
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, read_at: new Date().toISOString() } : n,
        ),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    }
  };

  const deleteNotification = async (id) => {
    try {
      // Simulate local deletion for responsive UX
      const n = notifications.find(x => x.id === id);
      setNotifications(prev => prev.filter(x => x.id !== id));
      if (n && !n.read_at) setUnreadCount(c => Math.max(0, c - 1));
      setItemMenuConfig(null);
    } catch (err) {
      console.warn("Failed to delete notification:", err);
    }
  };

  const markAllRead = async () => {
    setLoading(true);
    try {
      await authAxios.post("notifications/read-all");
      setNotifications((prev) =>
        prev.map((n) => ({
          ...n,
          read_at: n.read_at || new Date().toISOString(),
        })),
      );
      setUnreadCount(0);
      setAckPendingCount(pendingCount);
      localStorage.setItem('ackPendingCount', pendingCount.toString());
    } catch (err) {
      console.warn("Failed to mark all notifications as read:", err);
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
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    const days = Math.floor(diff / 86400);
    if (days < 7) return `${days}d`;
    return `${days}d`; // Facebook uses '1w', '2w' etc, falling back to 'd' for simplicity
  };

  const displayNotifications = activeTab === "unread" 
    ? notifications.filter(n => !n.read_at) 
    : notifications;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => {
          if (open) {
            setOpen(false);
            setItemMenuConfig(null);
            setHeaderMenuOpen(false);
          } else {
            setOpen(true);
            fetchNotifications();
          }
        }}
        className={`relative p-2 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ${
          isDarkMode
            ? "hover:bg-white/10 text-slate-300 focus-visible:ring-offset-gray-900"
            : "hover:bg-slate-100 text-slate-600"
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

      {}
      {pendingCount > ackPendingCount && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className={`absolute -bottom-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[9px] font-bold px-1 ${
            isDarkMode
              ? "bg-amber-500 text-black"
              : "bg-amber-400 text-amber-900"
          }`}
          title={`${pendingCount} pending request${pendingCount !== 1 ? "s" : ""} awaiting your action`}
          aria-hidden="true"
        >
          {pendingCount > 99 ? "99+" : pendingCount}
        </motion.span>
      )}

      {}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {unreadCount > 0
          ? `${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}`
          : "No unread notifications"}
        {pendingCount > 0
          ? `. ${pendingCount} pending request${pendingCount !== 1 ? "s" : ""} awaiting your action`
          : ""}
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className={`absolute right-0 top-full mt-2 w-[360px] rounded-2xl shadow-[0_4px_16px_rgba(0,0,0,0.2)] border z-50 ${
              isDarkMode
                ? "bg-[#242526] border-[#3E4042]"
                : "bg-white border-[#dadce0]"
            }`}
            role="dialog"
            aria-label="Notifications panel"
          >
            <div className="flex flex-col px-4 pt-4 pb-2 relative">
              <div className="flex items-center justify-between mb-3">
                <h3 className={`text-[24px] font-bold tracking-tight ${isDarkMode ? "text-[#E4E6EB]" : "text-[#050505]"}`} style={{ fontFamily: "Segoe UI, system-ui, sans-serif" }}>
                  Notifications
                </h3>
                <div className="relative">
                  <button onClick={(e) => { e.stopPropagation(); setHeaderMenuOpen(!headerMenuOpen); setItemMenuConfig(null); }} className={`p-1.5 rounded-full transition-colors ${isDarkMode ? "hover:bg-[#3A3B3C] text-[#B0B3B8]" : "hover:bg-[#F2F2F2] text-[#65676B]"}`}>
                    <EllipsisIcon className="w-6 h-6" />
                  </button>
                  {headerMenuOpen && (
                    <div className={`absolute right-0 top-full mt-1 w-[300px] rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.15)] p-2 z-[100] ${isDarkMode ? "bg-[#242526] border border-[#3E4042]" : "bg-white border border-[#E4E6EB]"}`}>
                      <button onClick={(e) => { e.stopPropagation(); markAllRead(); setHeaderMenuOpen(false); }} className={`w-full text-left px-3 py-2.5 rounded-md flex items-center gap-3 text-[15px] font-medium transition-colors ${isDarkMode ? "hover:bg-[#3A3B3C] text-[#E4E6EB]" : "hover:bg-[#F2F2F2] text-[#050505]"}`}>
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        Mark all as read
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setHeaderMenuOpen(false); onOpenSettings && onOpenSettings("notifications"); }} className={`w-full text-left px-3 py-2.5 rounded-md flex items-center gap-3 text-[15px] font-medium transition-colors mt-0.5 ${isDarkMode ? "hover:bg-[#3A3B3C] text-[#E4E6EB]" : "hover:bg-[#F2F2F2] text-[#050505]"}`}>
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        Notification settings
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setHeaderMenuOpen(false); if (onOpenNotificationsPage) onOpenNotificationsPage(); else toast("Redirecting to full notifications timeline...", { icon: '🔔' }); }} className={`w-full text-left px-3 py-2.5 rounded-md flex items-center gap-3 text-[15px] font-medium transition-colors mt-0.5 ${isDarkMode ? "hover:bg-[#3A3B3C] text-[#E4E6EB]" : "hover:bg-[#F2F2F2] text-[#050505]"}`}>
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                        Open Notifications
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setActiveTab('all')} className={`px-3 py-1.5 rounded-full text-[15px] font-semibold transition-colors ${activeTab === 'all' ? (isDarkMode ? "bg-[#2D88FF]/20 text-[#4599FF]" : "bg-[#E7F3FF] text-[#1877F2]") : (isDarkMode ? "hover:bg-[#3A3B3C] text-[#B0B3B8]" : "hover:bg-[#F2F2F2] text-[#050505]")}`}>All</button>
                <button onClick={() => setActiveTab('unread')} className={`px-3 py-1.5 rounded-full text-[15px] font-semibold transition-colors ${activeTab === 'unread' ? (isDarkMode ? "bg-[#2D88FF]/20 text-[#4599FF]" : "bg-[#E7F3FF] text-[#1877F2]") : (isDarkMode ? "hover:bg-[#3A3B3C] text-[#B0B3B8]" : "hover:bg-[#F2F2F2] text-[#050505]")}`}>Unread</button>
              </div>
            </div>

            <div className="overflow-y-auto max-h-[460px] pb-2 px-2" onScroll={(e) => setItemMenuConfig(null)} onClick={() => { setHeaderMenuOpen(false); setItemMenuConfig(null); }}>
              {pendingCount > 0 && activeTab === 'all' && (
                <div
                  onClick={() => {
                     setAckPendingCount(pendingCount);
                     localStorage.setItem('ackPendingCount', pendingCount.toString());
                     setOpen(false);
                     setHeaderMenuOpen(false);
                     setItemMenuConfig(null);
                     if (onPendingClick) onPendingClick();
                  }}
                  className={`group relative mx-2 mb-2 p-3 rounded-lg flex items-center gap-3 cursor-pointer transition-colors ${
                    pendingCount > ackPendingCount
                      ? isDarkMode
                        ? "bg-[#3A3B3C] hover:bg-[#4E4F50]"
                        : "bg-[#E7F3FF]/50 hover:bg-[#E7F3FF]"
                      : isDarkMode
                        ? "bg-transparent hover:bg-[#3A3B3C]"
                        : "bg-transparent hover:bg-[#F2F2F2]"
                  }`}
                >
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${isDarkMode ? "bg-amber-500/20" : "bg-amber-100"}`}>
                    <svg className={`w-6 h-6 ${isDarkMode ? "text-amber-400" : "text-amber-600"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <div className="flex-1">
                    <p className={`text-[15px] ${pendingCount > ackPendingCount ? "font-semibold" : "font-medium"} ${isDarkMode ? (pendingCount > ackPendingCount ? "text-[#E4E6EB]" : "text-[#B0B3B8]") : (pendingCount > ackPendingCount ? "text-[#050505]" : "text-[#65676B]")}`}>
                      Pending Request{pendingCount !== 1 ? "s" : ""}
                    </p>
                    <p className={`text-[13px] ${isDarkMode ? "text-[#B0B3B8]" : "text-[#65676B]"}`}>
                      You have {pendingCount} request{pendingCount !== 1 ? "s" : ""} awaiting your action
                    </p>
                  </div>
                  <div className="flex items-center self-center pr-2 drop-shadow-sm">
                      <span className={`w-3 h-3 rounded-full bg-primary-500 transition-opacity duration-300 ${pendingCount > ackPendingCount ? "opacity-100" : "opacity-0"}`} />
                  </div>
                  <div className="flex items-center self-center pl-1 h-full opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          setHeaderMenuOpen(false);
                          if (itemMenuConfig?.n?.id === "pending_alert") {
                            setItemMenuConfig(null);
                          } else {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setItemMenuConfig({
                              n: { 
                                id: "pending_alert", 
                                read_at: pendingCount <= ackPendingCount ? new Date().toISOString() : null, 
                                pendingCount,
                                isPending: true 
                              },
                              top: rect.bottom + 8,
                              right: window.innerWidth - rect.right
                            });
                          }
                        }} 
                        className={`p-2 rounded-full transition-colors border ${isDarkMode ? "bg-[#242526] border-[#3E4042] text-[#B0B3B8] hover:bg-[#3A3B3C]" : "bg-white border-[#E4E6EB] text-[#65676B] hover:bg-[#F2F2F2]"}`}
                      >
                        <EllipsisIcon className="w-5 h-5" />
                      </button>
                  </div>
                </div>
              )}
              {displayNotifications.length === 0 ? (
                <div
                  className={`py-6 pb-8 text-center text-[15px] font-medium ${isDarkMode ? "text-[#B0B3B8]" : "text-[#65676B]"}`}
                >
                  No notifications
                </div>
              ) : (
                displayNotifications.map((n) => (
                  <div
                    key={n.id}
                    className={`relative w-full text-left p-2 rounded-lg flex items-start gap-3 transition-colors cursor-pointer group ${
                      isDarkMode
                        ? `hover:bg-[#3A3B3C]`
                        : `hover:bg-[#F2F2F2]`
                    }`}
                    onClick={() => {
                      if (!n.read_at) markAsRead(n.id);
                    }}
                  >
                    <div className="relative">
                      <div className={`w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 ${isDarkMode ? "bg-[#3A3B3C]" : "bg-[#E4E6EB]"}`}>
                         <BellIcon className={`w-6 h-6 ${isDarkMode ? "text-[#E4E6EB]" : "text-[#050505]"}`} />
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-primary-500 rounded-full border-2 border-white dark:border-[#242526] flex items-center justify-center text-white">
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" /></svg>
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0 flex flex-col pt-1">
                      <p className={`text-[15px] leading-[1.3] truncate ${!n.read_at ? "font-semibold" : ""} ${isDarkMode ? (!n.read_at ? "text-[#E4E6EB]" : "text-[#B0B3B8]") : (!n.read_at ? "text-[#050505]" : "text-[#65676B]")}`}>
                        {n.title}
                      </p>
                      <p className={`text-[14px] mt-0.5 leading-[1.3] line-clamp-2 ${!n.read_at ? "font-medium" : ""} ${isDarkMode ? (!n.read_at ? "text-[#E4E6EB]" : "text-[#B0B3B8]") : (!n.read_at ? "text-[#050505]" : "text-[#65676B]")}`}>
                        {n.message}
                      </p>
                      <p className={`text-[13px] mt-1 font-medium ${isDarkMode ? (!n.read_at ? "text-[#2D88FF]" : "text-[#B0B3B8]") : (!n.read_at ? "text-[#1877F2]" : "text-[#65676B]")}`}>
                        {formatTime(n.created_at)}
                      </p>
                    </div>

                    <div className="flex items-center self-center pl-1 pr-2 drop-shadow-sm">
                        <span className={`w-3 h-3 rounded-full bg-primary-500 transition-opacity duration-300 ${!n.read_at ? "opacity-100" : "opacity-0"}`} />
                    </div>
                    <div className="flex items-center self-center h-full opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            setHeaderMenuOpen(false);
                            if (itemMenuConfig?.n?.id === n.id) {
                              setItemMenuConfig(null);
                            } else {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setItemMenuConfig({
                                n,
                                top: rect.bottom + 8, // Appears beneath the button instead of covering it
                                right: window.innerWidth - rect.right // Properly aligns right edge to right edge of button
                              });
                            }
                          }} 
                          className={`p-2 rounded-full transition-colors border ${isDarkMode ? "bg-[#242526] border-[#3E4042] text-[#B0B3B8] hover:bg-[#3A3B3C]" : "bg-white border-[#E4E6EB] text-[#65676B] hover:bg-[#F2F2F2]"}`}
                        >
                          <EllipsisIcon className="w-5 h-5" />
                        </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {itemMenuConfig && (
        <div 
          style={{ top: itemMenuConfig.top, right: itemMenuConfig.right }}
          className={`fixed w-[280px] rounded-lg shadow-[0_4px_20px_rgba(0,0,0,0.2)] p-2 z-[99999] ${isDarkMode ? "bg-[#242526] border border-[#3E4042]" : "bg-white border border-[#E4E6EB]"}`}
        >
          <button onClick={(e) => { 
            e.stopPropagation(); 
            if (itemMenuConfig.n.isPending) {
               if (itemMenuConfig.n.read_at) {
                 setAckPendingCount(0); localStorage.setItem('ackPendingCount', '0');
               } else {
                 setAckPendingCount(itemMenuConfig.n.pendingCount); localStorage.setItem('ackPendingCount', itemMenuConfig.n.pendingCount.toString());
               }
            } else {
               itemMenuConfig.n.read_at ? markAsUnread(itemMenuConfig.n.id) : markAsRead(itemMenuConfig.n.id); 
            }
            setItemMenuConfig(null); 
          }} className={`w-full text-left px-3 py-2.5 rounded-md flex items-center gap-3 text-[15px] font-medium transition-colors ${isDarkMode ? "hover:bg-[#3A3B3C] text-[#E4E6EB]" : "hover:bg-[#F2F2F2] text-[#050505]"}`}>
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            Mark as {itemMenuConfig.n.read_at ? "unread" : "read"}
          </button>
          {!itemMenuConfig.n.isPending && (
            <button onClick={(e) => { e.stopPropagation(); deleteNotification(itemMenuConfig.n.id); }} className={`w-full text-left px-3 py-2.5 rounded-md flex items-center gap-3 text-[15px] font-medium transition-colors mt-0.5 ${isDarkMode ? "hover:bg-[#3A3B3C] text-[#E4E6EB]" : "hover:bg-[#F2F2F2] text-[#050505]"}`}>
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              Remove this notification
            </button>
          )}
          <button onClick={(e) => { e.stopPropagation(); toast("You will no longer receive notifications of this type.", { icon: "🧹" }); if (!itemMenuConfig.n.isPending) deleteNotification(itemMenuConfig.n.id); setItemMenuConfig(null); }} className={`w-full text-left px-3 py-2.5 rounded-md flex items-center gap-3 text-[15px] font-medium transition-colors mt-0.5 ${isDarkMode ? "hover:bg-[#3A3B3C] text-[#E4E6EB]" : "hover:bg-[#F2F2F2] text-[#050505]"}`}>
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            Turn off notifications like this
          </button>
          <button onClick={(e) => { e.stopPropagation(); toast.success("Issue reported. Thank you for your feedback."); setItemMenuConfig(null); }} className={`w-full text-left px-3 py-2.5 rounded-md flex items-center gap-3 text-[15px] font-medium transition-colors mt-0.5 ${isDarkMode ? "hover:bg-[#3A3B3C] text-[#E4E6EB]" : "hover:bg-[#F2F2F2] text-[#050505]"}`}>
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            Report issue to Notifications Team
          </button>
        </div>
      )}
    </div>
  );
}
