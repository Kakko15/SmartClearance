import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { supabase } from "../lib/supabase";
import { authAxios } from "../services/api";
import useRealtimeSubscription from "../hooks/useRealtimeSubscription";
import RequestHistory from "../components/features/RequestHistory";
import PendingAccountsView from "../components/admin/PendingAccountsView";
import SecretCodesManager from "../components/admin/SecretCodesManager";
import NotificationBell from "../components/features/NotificationBell";
import Sidebar from "../components/layout/Sidebar";
import Topbar from "../components/layout/Topbar";

const THEME = {
  bg: "bg-[#020617]",
  glass: "backdrop-blur-3xl bg-white/[0.02] border border-white/[0.05]",
  glassHover: "hover:bg-white/[0.05] hover:border-white/[0.1]",
};

const SPRING = { type: "spring", stiffness: 300, damping: 30 };

const GlassCard = ({ children, className = "", delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ ...SPRING, delay }}
    className={`relative overflow-hidden rounded-2xl ${THEME.glass} shadow-2xl shadow-black/50 ${className}`}
  >
    <div className="relative z-10 h-full">{children}</div>
  </motion.div>
);

const MetricPill = ({ label, value, icon, color = "indigo" }) => {
  const colors = {
    indigo: "group-hover:bg-indigo-500",
    amber: "group-hover:bg-amber-500",
    emerald: "group-hover:bg-emerald-500",
    rose: "group-hover:bg-rose-500",
  };
  return (
    <GlassCard className="flex flex-col justify-center p-6 min-h-[140px] group">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-2xl bg-white/5 text-white/80 ${colors[color]} group-hover:text-white transition-colors duration-300`}>
          {icon}
        </div>
      </div>
      <div className="text-3xl font-bold text-white mb-1 tracking-tight">{value}</div>
      <div className="text-xs font-medium text-slate-500 uppercase tracking-widest">{label}</div>
    </GlassCard>
  );
};

export default function SuperAdminDashboard({ adminId, adminRole, onSignOut }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeView, setActiveView] = useState("dashboard");
  const [stats, setStats] = useState({ pending: 0, totalStudents: 0, totalStaff: 0, totalRequests: 0 });
  const [analytics, setAnalytics] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [adminName, setAdminName] = useState("Super Admin");
  const [pendingEdits, setPendingEdits] = useState([]);
  const [editActionLoading, setEditActionLoading] = useState(null);

  const adminInfo = {
    full_name: adminName,
    role: adminRole || "super_admin",
    student_number: null,
  };

  const loadDashboardStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      // Fetch real counts from Supabase in parallel
      const [pendingRes, studentsRes, staffRes, requestsRes, historyRes, profileRes] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("verification_status", "pending_review"),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "student"),
        supabase.from("profiles").select("id", { count: "exact", head: true }).in("role", ["librarian", "cashier", "registrar", "signatory"]),
        supabase.from("requests").select("id", { count: "exact", head: true }),
        supabase.from("request_history").select("*, profiles!request_history_processed_by_fkey(full_name, role)").order("timestamp", { ascending: false }).limit(8),
        supabase.from("profiles").select("full_name").eq("id", adminId).single(),
      ]);

      setStats({
        pending: pendingRes.count ?? 0,
        totalStudents: studentsRes.count ?? 0,
        totalStaff: staffRes.count ?? 0,
        totalRequests: requestsRes.count ?? 0,
      });
      setRecentActivity(historyRes.data || []);
      if (profileRes.data?.full_name) {
        setAdminName(profileRes.data.full_name);
      }

      // F1: Fetch analytics
      try {
        const { data: analyticsData } = await authAxios.get("analytics/dashboard");
        if (analyticsData.success) setAnalytics(analyticsData.analytics);
      } catch {
        // analytics endpoint may not be available yet
      }

      // F3: Fetch pending profile edits
      try {
        const { data: editsData } = await authAxios.get("profile/pending-edits");
        if (editsData.success) setPendingEdits(editsData.requests || []);
      } catch {
        // silent
      }
    } catch (err) {
      console.error("Failed to load dashboard stats:", err);
    } finally {
      setStatsLoading(false);
    }
  }, [adminId]);

  useEffect(() => {
    document.title = "Smart Clearance | Admin Portal";
    loadDashboardStats();
  }, [loadDashboardStats]);

  // Live updates — refresh stats when profiles or requests change
  useRealtimeSubscription("profiles", loadDashboardStats);
  useRealtimeSubscription("requests", loadDashboardStats);

  const menuItems = [
    {
      id: "dashboard", label: "Dashboard",
      icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
    },
    {
      id: "analytics", label: "Analytics",
      icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>,
    },
    {
      id: "pending-accounts", label: "Pending Accounts",
      icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>,
      badge: stats.pending || null,
    },
    {
      id: "profile-edits", label: "Profile Edits",
      icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" /></svg>,
      badge: pendingEdits.length || null,
    },
    {
      id: "secret-codes", label: "Secret Codes",
      icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>,
    },
    {
      id: "history", label: "Clearance History",
      icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    },
  ];

  const handleReviewEdit = async (editId, action, comment = "") => {
    setEditActionLoading(editId);
    try {
      const { data } = await authAxios.post(`profile/review-edit/${editId}`, { action, comment });
      if (data.success) {
        toast.success(`Edit request ${action}`);
        setPendingEdits((prev) => prev.filter((e) => e.id !== editId));
      }
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to review edit");
    } finally {
      setEditActionLoading(null);
    }
  };

  const formatAction = (action) => {
    const map = { approved: "Approved", rejected: "Rejected", resubmitted: "Resubmitted", created: "Created", completed: "Completed" };
    return map[action] || action;
  };

  const getActionColor = (action) => {
    const map = { approved: "text-emerald-400", rejected: "text-rose-400", resubmitted: "text-amber-400", created: "text-blue-400", completed: "text-indigo-400" };
    return map[action] || "text-slate-400";
  };

  return (
    <div className={`min-h-screen ${THEME.bg}`}>
      <div className="fixed inset-0 z-0">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-violet-600/10 rounded-full blur-[120px]" />
      </div>

      <Sidebar
        menuItems={menuItems}
        activeView={activeView}
        onViewChange={setActiveView}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        theme="dark"
      />

      <Topbar
        user={adminInfo}
        onSignOut={onSignOut}
        onOpenSettings={() => {}}
        theme="dark"
        sidebarCollapsed={sidebarCollapsed}
      />

      <main
        className="pt-20 transition-all duration-300 relative z-10"
        style={{ marginLeft: sidebarCollapsed ? "80px" : "280px" }}
      >
        <div className="p-8">
          {activeView === "dashboard" && (
            <div className="space-y-8">
              <div className="flex items-start justify-between">
              <div>
                <h2 className="text-3xl font-bold text-white mb-1">Admin Dashboard</h2>
                <p className="text-slate-400">System overview and recent activity</p>
              </div>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={loadDashboardStats}
                disabled={statsLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white transition-all disabled:opacity-50"
              >
                <svg className={`w-4 h-4 ${statsLoading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {statsLoading ? "Refreshing..." : "Refresh"}
              </motion.button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                <MetricPill
                  label="Pending Accounts"
                  value={statsLoading ? "—" : stats.pending}
                  color="amber"
                  icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>}
                />
                <MetricPill
                  label="Total Students"
                  value={statsLoading ? "—" : stats.totalStudents}
                  color="emerald"
                  icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>}
                />
                <MetricPill
                  label="Staff Members"
                  value={statsLoading ? "—" : stats.totalStaff}
                  color="indigo"
                  icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>}
                />
                <MetricPill
                  label="Total Requests"
                  value={statsLoading ? "—" : stats.totalRequests}
                  color="rose"
                  icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
                />
              </div>

              <GlassCard className="p-6">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-lg font-bold text-white">Recent Activity</h3>
                  <button
                    onClick={() => setActiveView("history")}
                    className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    View All →
                  </button>
                </div>
                {statsLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center gap-4 p-3 rounded-xl bg-white/[0.02]">
                        <div className="w-8 h-8 rounded-full bg-white/10 animate-pulse" />
                        <div className="flex-1 space-y-2">
                          <div className="w-40 h-3 bg-white/10 rounded animate-pulse" />
                          <div className="w-24 h-2 bg-white/10 rounded animate-pulse" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : recentActivity.length === 0 ? (
                  <p className="text-slate-500 text-sm text-center py-8">No recent activity</p>
                ) : (
                  <div className="space-y-2">
                    {recentActivity.map((entry) => (
                      <div key={entry.id} className="flex items-center gap-4 p-3 rounded-xl bg-white/[0.02] border border-white/[0.03]">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${getActionColor(entry.action_taken).replace("text-", "bg-")}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">
                            <span className={`font-semibold ${getActionColor(entry.action_taken)}`}>
                              {formatAction(entry.action_taken)}
                            </span>
                            {entry.profiles?.full_name && (
                              <span className="text-slate-400"> by {entry.profiles.full_name}</span>
                            )}
                          </p>
                          {entry.comments && (
                            <p className="text-xs text-slate-500 truncate mt-0.5">"{entry.comments}"</p>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-600 flex-shrink-0">
                          {new Date(entry.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </GlassCard>
            </div>
          )}

          {activeView === "pending-accounts" && (
            <PendingAccountsView adminId={adminId} isDark={true} />
          )}

          {activeView === "secret-codes" && <SecretCodesManager />}

          {activeView === "history" && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-6">Clearance History</h2>
              <RequestHistory isAdmin={true} isDark={true} />
            </div>
          )}

          {activeView === "analytics" && (
            <div className="space-y-8">
              <div>
                <h2 className="text-3xl font-bold text-white mb-1">Analytics</h2>
                <p className="text-slate-400">Clearance system performance and insights</p>
              </div>

              {analytics ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    <MetricPill label="Pending" value={analytics.requests.pending} color="amber"
                      icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
                    <MetricPill label="Completed" value={analytics.requests.completed} color="emerald"
                      icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
                    <MetricPill label="On Hold" value={analytics.requests.rejected} color="rose"
                      icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
                    <MetricPill label="Avg Completion" value={analytics.avgCompletionHours < 24 ? `${analytics.avgCompletionHours}h` : `${Math.round(analytics.avgCompletionHours / 24)}d`} color="indigo"
                      icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75z" /></svg>} />
                  </div>

                  {analytics.bottlenecks.length > 0 && (
                    <GlassCard className="p-6">
                      <h3 className="text-lg font-bold text-white mb-4">Bottleneck Stages</h3>
                      <p className="text-slate-400 text-sm mb-4">Stages with the most pending requests</p>
                      <div className="space-y-3">
                        {analytics.bottlenecks.map((b) => (
                          <div key={b.stage} className="flex items-center gap-4">
                            <span className="text-sm text-slate-300 w-24 capitalize">{b.stage}</span>
                            <div className="flex-1 h-3 rounded-full bg-white/5 overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(100, (b.count / Math.max(...analytics.bottlenecks.map(x => x.count))) * 100)}%` }}
                                transition={{ duration: 0.8, ease: "easeOut" }}
                                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
                              />
                            </div>
                            <span className="text-sm font-bold text-white w-10 text-right">{b.count}</span>
                          </div>
                        ))}
                      </div>
                    </GlassCard>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <GlassCard className="p-6">
                      <h3 className="text-lg font-bold text-white mb-2">Student Enrollment</h3>
                      <div className="text-4xl font-bold text-emerald-400 mb-1">{analytics.users.students}</div>
                      <p className="text-xs text-slate-500 uppercase tracking-widest">Registered Students</p>
                    </GlassCard>
                    <GlassCard className="p-6">
                      <h3 className="text-lg font-bold text-white mb-2">Staff Members</h3>
                      <div className="text-4xl font-bold text-indigo-400 mb-1">{analytics.users.staff}</div>
                      <p className="text-xs text-slate-500 uppercase tracking-widest">Active Staff</p>
                    </GlassCard>
                  </div>
                </>
              ) : (
                <GlassCard className="p-12 text-center">
                  <p className="text-slate-400">Loading analytics...</p>
                </GlassCard>
              )}
            </div>
          )}

          {activeView === "profile-edits" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-3xl font-bold text-white mb-1">Profile Edit Requests</h2>
                <p className="text-slate-400">Review and approve student profile changes</p>
              </div>

              {pendingEdits.length === 0 ? (
                <GlassCard className="p-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-1">All caught up</h3>
                  <p className="text-slate-400 text-sm">No pending profile edit requests</p>
                </GlassCard>
              ) : (
                <div className="space-y-3">
                  {pendingEdits.map((edit) => (
                    <GlassCard key={edit.id} className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white">
                            {edit.profiles?.full_name || "Unknown"}{" "}
                            <span className="text-slate-500 font-normal">({edit.profiles?.student_number || edit.profiles?.role})</span>
                          </p>
                          <p className="text-sm text-slate-300 mt-1">
                            <span className="text-slate-500">Field:</span>{" "}
                            <span className="capitalize">{edit.field_name.replace(/_/g, " ")}</span>
                          </p>
                          <div className="flex items-center gap-2 mt-1 text-sm">
                            <span className="text-slate-500">Current:</span>
                            <span className="text-rose-400">{edit.old_value || "—"}</span>
                            <span className="text-slate-600">→</span>
                            <span className="text-emerald-400">{edit.new_value}</span>
                          </div>
                          <p className="text-[11px] text-slate-600 mt-1">
                            {new Date(edit.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </p>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleReviewEdit(edit.id, "approved")}
                            disabled={editActionLoading === edit.id}
                            className="px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-400 text-sm font-medium hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                          >
                            Approve
                          </motion.button>
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleReviewEdit(edit.id, "rejected")}
                            disabled={editActionLoading === edit.id}
                            className="px-4 py-2 rounded-xl bg-rose-500/10 text-rose-400 text-sm font-medium hover:bg-rose-500/20 transition-colors disabled:opacity-50"
                          >
                            Reject
                          </motion.button>
                        </div>
                      </div>
                    </GlassCard>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}