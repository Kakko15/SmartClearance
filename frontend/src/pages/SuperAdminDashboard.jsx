import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { supabase } from "../lib/supabase";
import { authAxios } from "../services/api";
import useRealtimeSubscription from "../hooks/useRealtimeSubscription";
import RequestHistory from "../components/features/RequestHistory";
import PendingAccountsView from "../components/admin/PendingAccountsView";
import SecretCodesManager from "../components/admin/SecretCodesManager";
import AllUsersView from "../components/admin/AllUsersView";
import DashboardLayout, { GlassCard } from "../components/ui/DashboardLayout";
import {
  ComputerDesktopIcon,
  ChartBarIcon,
  UsersIcon,
  PencilSquareIcon,
  ShieldCheckIcon,
  DocumentTextIcon,
  CheckIcon,
  XMarkIcon
} from "../components/ui/Icons";
import { getSuperAdminTheme } from "../constants/dashboardThemes";

const MetricPill = ({ label, value, icon, color = "indigo", isDarkMode }) => {
  const colors = {
    indigo: "text-indigo-500",
    amber: "text-amber-500",
    emerald: "text-emerald-500",
    rose: "text-rose-500",
  };
  const bgColors = {
    indigo: isDarkMode ? "bg-indigo-500/10" : "bg-indigo-50",
    amber: isDarkMode ? "bg-amber-500/10" : "bg-amber-50",
    emerald: isDarkMode ? "bg-emerald-500/10" : "bg-emerald-50",
    rose: isDarkMode ? "bg-rose-500/10" : "bg-rose-50",
  };
  return (
    <GlassCard className="flex flex-col justify-center p-6 min-h-[140px]" isDark={isDarkMode}>
      <div className="flex items-start mb-4">
        <div className={`p-3 rounded-2xl ${bgColors[color]} ${colors[color]} transition-colors duration-300`}>
          {icon}
        </div>
      </div>
      <div className={`text-3xl font-bold mb-1 tracking-tight ${isDarkMode ? "text-white" : "text-gray-900"}`}>{value}</div>
      <div className={`text-xs font-medium uppercase tracking-widest ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>{label}</div>
    </GlassCard>
  );
};

export default function SuperAdminDashboard({ adminId, adminRole, onSignOut, isDarkMode, toggleTheme, onOpenSettings, onManageAccount }) {
  const [activeView, setActiveView] = useState("dashboard");
  const [stats, setStats] = useState({ pending: 0, totalStudents: 0, totalStaff: 0, totalRequests: 0 });
  const [analytics, setAnalytics] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [adminName, setAdminName] = useState("Super Admin");
  const [pendingEdits, setPendingEdits] = useState([]);
  const [editActionLoading, setEditActionLoading] = useState(null);

  const adminInfo = {
    name: adminName,
    subtitle: adminRole === "super_admin" ? "Super Admin" : "Admin",
    role: adminRole || "super_admin",
  };

  const loadDashboardStats = useCallback(async () => {
    setStatsLoading(true);
    try {
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

      try {
        const { data: analyticsData } = await authAxios.get("analytics/dashboard");
        if (analyticsData.success) setAnalytics(analyticsData.analytics);
      } catch {}

      try {
        const { data: editsData } = await authAxios.get("profile/pending-edits");
        if (editsData.success) setPendingEdits(editsData.requests || []);
      } catch {}
    } catch (err) {
      console.error("Failed to load dashboard stats:", err);
    } finally {
      setStatsLoading(false);
    }
  }, [adminId]);

  useEffect(() => {
    document.title = "Smart Clearance | Super Admin Portal";
    loadDashboardStats();
  }, [loadDashboardStats]);

  useRealtimeSubscription("profiles", loadDashboardStats);
  useRealtimeSubscription("requests", loadDashboardStats);

  const menuItems = [
    {
      id: "dashboard", label: "Dashboard",
      icon: <ComputerDesktopIcon className="w-5 h-5" />,
    },
    {
      id: "analytics", label: "Analytics",
      icon: <ChartBarIcon className="w-5 h-5" />,
    },
    {
      id: "pending-accounts", label: "Pending Accounts",
      icon: <UsersIcon className="w-5 h-5" />,
      count: stats.pending || null,
    },
    {
      id: "profile-edits", label: "Profile Edits",
      icon: <PencilSquareIcon className="w-5 h-5" />,
      count: pendingEdits.length || null,
    },
    {
      id: "all-users", label: "All Users",
      icon: <UsersIcon className="w-5 h-5" />,
    },
    {
      id: "secret-codes", label: "Secret Codes",
      icon: <ShieldCheckIcon className="w-5 h-5" />,
    },
    {
      id: "history", label: "Clearance History",
      icon: <DocumentTextIcon className="w-5 h-5" />,
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
    const map = { approved: "text-emerald-500", rejected: "text-rose-500", resubmitted: "text-amber-500", created: "text-blue-500", completed: "text-indigo-500" };
    return map[action] || "text-slate-500";
  };

  const getActionBgColor = (action, dark) => {
    const map = {
      approved: dark ? "bg-emerald-500/10" : "bg-emerald-50",
      rejected: dark ? "bg-rose-500/10" : "bg-rose-50",
      resubmitted: dark ? "bg-amber-500/10" : "bg-amber-50",
      created: dark ? "bg-blue-500/10" : "bg-blue-50",
      completed: dark ? "bg-indigo-500/10" : "bg-indigo-50"
    };
    return map[action] || (dark ? "bg-slate-800" : "bg-slate-100");
  };

  const theme = getSuperAdminTheme(isDarkMode);

  return (
    <DashboardLayout
      theme={theme}
      menuItems={menuItems}
      activeView={activeView}
      setActiveView={setActiveView}
      userInfo={adminInfo}
      onSignOut={onSignOut}
      onOpenSettings={onOpenSettings}
      onManageAccount={onManageAccount}
      isDarkMode={isDarkMode}
      toggleTheme={toggleTheme}
    >
      <div className="max-w-5xl mx-auto space-y-8 pb-10">
        {activeView === "dashboard" && (
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className={`text-3xl font-bold ${isDarkMode ? "text-white" : "text-gray-900"} mb-1`}>Admin Dashboard</h2>
                <p className={`${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>System overview and recent activity</p>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={loadDashboardStats}
                disabled={statsLoading}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl border text-sm font-semibold transition-all disabled:opacity-50 ${
                  isDarkMode 
                    ? "border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white" 
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-sm"
                }`}
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
                icon={<UsersIcon className="w-6 h-6" />}
                isDarkMode={isDarkMode}
              />
              <MetricPill
                label="Total Students"
                value={statsLoading ? "—" : stats.totalStudents}
                color="emerald"
                icon={<UsersIcon className="w-6 h-6" />}
                isDarkMode={isDarkMode}
              />
              <MetricPill
                label="Staff Members"
                value={statsLoading ? "—" : stats.totalStaff}
                color="indigo"
                icon={<ShieldCheckIcon className="w-6 h-6" />}
                isDarkMode={isDarkMode}
              />
              <MetricPill
                label="Total Requests"
                value={statsLoading ? "—" : stats.totalRequests}
                color="rose"
                icon={<DocumentTextIcon className="w-6 h-6" />}
                isDarkMode={isDarkMode}
              />
            </div>

            <GlassCard className="p-6" isDark={isDarkMode}>
              <div className="flex items-center justify-between mb-5">
                <h3 className={`text-lg font-bold ${isDarkMode ? "text-white" : "text-gray-900"}`}>Recent Activity</h3>
                <button
                  onClick={() => setActiveView("history")}
                  className={`text-sm font-semibold transition-colors ${isDarkMode ? "text-primary-400 hover:text-primary-300" : "text-primary-600 hover:text-primary-700"}`}
                >
                  View All →
                </button>
              </div>
              {statsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className={`flex items-center gap-4 p-3 rounded-xl border ${isDarkMode ? "bg-slate-800/50 border-slate-700/50" : "bg-slate-50 border-slate-100"}`}>
                      <div className={`w-8 h-8 rounded-full animate-pulse ${isDarkMode ? "bg-slate-700" : "bg-slate-200"}`} />
                      <div className="flex-1 space-y-2">
                        <div className={`w-40 h-3 rounded animate-pulse ${isDarkMode ? "bg-slate-700" : "bg-slate-200"}`} />
                        <div className={`w-24 h-2 rounded animate-pulse ${isDarkMode ? "bg-slate-700" : "bg-slate-200"}`} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : recentActivity.length === 0 ? (
                <p className={`text-sm text-center py-8 ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>No recent activity</p>
              ) : (
                <div className="space-y-3">
                  {recentActivity.map((entry, index) => (
                    <div key={entry.id} className={`flex items-center gap-4 p-3 rounded-xl border ${isDarkMode ? "bg-[#282a2d] border-[#3c4043]" : "bg-white border-[#dadce0] shadow-sm"}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${getActionBgColor(entry.action_taken, isDarkMode)}`}>
                         <div className={`w-2 h-2 rounded-full ${getActionColor(entry.action_taken).replace("text-", "bg-")}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-[14px] truncate ${isDarkMode ? "text-white" : "text-gray-900"}`}>
                          <span className={`font-semibold ${getActionColor(entry.action_taken)} mr-1`}>
                            {formatAction(entry.action_taken)}
                          </span>
                          {entry.profiles?.full_name ? <span className={isDarkMode ? "text-slate-300" : "text-gray-600"}>by {entry.profiles.full_name}</span> : null}
                        </p>
                        {entry.comments && (
                          <p className={`text-[13px] truncate mt-0.5 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>"{entry.comments}"</p>
                        )}
                      </div>
                      <span className={`text-[12px] flex-shrink-0 font-medium ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
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
          <PendingAccountsView adminId={adminId} isDark={isDarkMode} />
        )}

        {activeView === "all-users" && <AllUsersView adminId={adminId} isDark={isDarkMode} />}

        {activeView === "secret-codes" && <SecretCodesManager isDark={isDarkMode} />}

        {activeView === "history" && (
          <div>
            <h2 className={`text-3xl font-bold mb-6 ${isDarkMode ? "text-white" : "text-gray-900"}`}>Clearance History</h2>
            <RequestHistory isAdmin={true} isDark={isDarkMode} />
          </div>
        )}

        {activeView === "analytics" && (
          <div className="space-y-8">
            <div>
              <h2 className={`text-3xl font-bold ${isDarkMode ? "text-white" : "text-gray-900"} mb-1`}>Analytics</h2>
              <p className={isDarkMode ? "text-slate-400" : "text-slate-500"}>Clearance system performance and insights</p>
            </div>

            {analytics ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  <MetricPill label="Pending" value={analytics.requests.pending} color="amber" icon={<DocumentTextIcon className="w-6 h-6" />} isDarkMode={isDarkMode} />
                  <MetricPill label="Completed" value={analytics.requests.completed} color="emerald" icon={<CheckIcon className="w-6 h-6" />} isDarkMode={isDarkMode} />
                  <MetricPill label="On Hold" value={analytics.requests.rejected} color="rose" icon={<XMarkIcon className="w-6 h-6" />} isDarkMode={isDarkMode} />
                  <MetricPill label="Avg Completion" value={analytics.avgCompletionHours < 24 ? `${analytics.avgCompletionHours}h` : `${Math.round(analytics.avgCompletionHours / 24)}d`} color="indigo" icon={<ChartBarIcon className="w-6 h-6" />} isDarkMode={isDarkMode} />
                </div>

                {analytics.bottlenecks.length > 0 && (
                  <GlassCard className="p-6" isDark={isDarkMode}>
                    <h3 className={`text-lg font-bold mb-4 ${isDarkMode ? "text-white" : "text-gray-900"}`}>Bottleneck Stages</h3>
                    <p className={`text-sm mb-5 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>Stages with the most pending requests</p>
                    <div className="space-y-4">
                      {analytics.bottlenecks.map((b) => (
                        <div key={b.stage} className="flex items-center gap-4">
                          <span className={`text-[14px] font-medium w-28 capitalize ${isDarkMode ? "text-slate-300" : "text-gray-700"}`}>{b.stage}</span>
                          <div className={`flex-1 h-2.5 rounded-full overflow-hidden ${isDarkMode ? "bg-slate-700" : "bg-slate-100"}`}>
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(100, (b.count / Math.max(...analytics.bottlenecks.map(x => x.count))) * 100)}%` }}
                              transition={{ duration: 0.8, ease: "easeOut" }}
                              className="h-full rounded-full bg-primary-500"
                            />
                          </div>
                          <span className={`text-[14px] font-bold w-10 text-right ${isDarkMode ? "text-white" : "text-gray-900"}`}>{b.count}</span>
                        </div>
                      ))}
                    </div>
                  </GlassCard>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <GlassCard className="p-6" isDark={isDarkMode}>
                    <h3 className={`text-lg font-bold mb-2 ${isDarkMode ? "text-white" : "text-gray-900"}`}>Student Enrollment</h3>
                    <div className="text-4xl font-bold text-emerald-500 mb-1">{analytics.users.students}</div>
                    <p className={`text-[11px] uppercase tracking-widest font-semibold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>Registered Students</p>
                  </GlassCard>
                  <GlassCard className="p-6" isDark={isDarkMode}>
                    <h3 className={`text-lg font-bold mb-2 ${isDarkMode ? "text-white" : "text-gray-900"}`}>Staff Members</h3>
                    <div className="text-4xl font-bold text-indigo-500 mb-1">{analytics.users.staff}</div>
                    <p className={`text-[11px] uppercase tracking-widest font-semibold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>Active Staff</p>
                  </GlassCard>
                </div>
              </>
            ) : (
              <GlassCard className="p-12 text-center" isDark={isDarkMode}>
                <p className={isDarkMode ? "text-slate-400" : "text-slate-500"}>Loading analytics...</p>
              </GlassCard>
            )}
          </div>
        )}

        {activeView === "profile-edits" && (
          <div className="space-y-6">
            <div>
              <h2 className={`text-3xl font-bold mb-1 ${isDarkMode ? "text-white" : "text-gray-900"}`}>Profile Edit Requests</h2>
              <p className={isDarkMode ? "text-slate-400" : "text-slate-500"}>Review and approve student profile changes</p>
            </div>

            {pendingEdits.length === 0 ? (
              <GlassCard className="p-12 text-center" isDark={isDarkMode}>
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${isDarkMode ? "bg-slate-800" : "bg-slate-100"}`}>
                  <CheckIcon className={`w-8 h-8 ${isDarkMode ? "text-slate-500" : "text-slate-400"}`} />
                </div>
                <h3 className={`text-lg font-bold mb-1 ${isDarkMode ? "text-white" : "text-gray-900"}`}>All caught up</h3>
                <p className={`text-sm ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>No pending profile edit requests</p>
              </GlassCard>
            ) : (
              <div className="space-y-4">
                {pendingEdits.map((edit) => (
                  <GlassCard key={edit.id} className="p-5" isDark={isDarkMode}>
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className={`text-sm font-semibold mb-1.5 ${isDarkMode ? "text-white" : "text-gray-900"}`}>
                          {edit.profiles?.full_name || "Unknown"}{" "}
                          <span className={`${isDarkMode ? "text-slate-500" : "text-slate-400"} font-normal`}>({edit.profiles?.student_number || edit.profiles?.role})</span>
                        </p>
                        <p className={`text-[13px] ${isDarkMode ? "text-slate-300" : "text-gray-700"}`}>
                          <span className={isDarkMode ? "text-slate-500" : "text-slate-500"}>Field:</span>{" "}
                          <span className="capitalize font-medium">{edit.field_name.replace(/_/g, " ")}</span>
                        </p>
                        <div className="flex items-center gap-2 mt-1.5 text-[13px]">
                          <span className={isDarkMode ? "text-slate-500" : "text-slate-500"}>Change:</span>
                          <span className="text-rose-500 font-medium bg-rose-500/10 px-2 py-0.5 rounded">{edit.old_value || "—"}</span>
                          <span className={isDarkMode ? "text-slate-600" : "text-slate-400"}>→</span>
                          <span className="text-emerald-500 font-medium bg-emerald-500/10 px-2 py-0.5 rounded">{edit.new_value}</span>
                        </div>
                        <p className={`text-[11px] mt-3 ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
                          {new Date(edit.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "numeric" })}
                        </p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0 mt-4 sm:mt-0 w-full sm:w-auto">
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleReviewEdit(edit.id, "approved")}
                          disabled={editActionLoading === edit.id}
                          className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-emerald-500 text-white text-[13px] font-semibold hover:bg-emerald-600 transition-colors disabled:opacity-50 shadow-sm"
                        >
                          Approve
                        </motion.button>
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleReviewEdit(edit.id, "rejected")}
                          disabled={editActionLoading === edit.id}
                          className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl border text-[13px] font-semibold transition-colors disabled:opacity-50 ${
                            isDarkMode 
                              ? "border-rose-500/50 text-rose-400 hover:bg-rose-500/10" 
                              : "border-rose-200 text-rose-600 bg-rose-50 hover:bg-rose-100"
                          }`}
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
    </DashboardLayout>
  );
}