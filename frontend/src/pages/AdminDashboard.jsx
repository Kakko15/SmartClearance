import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import {
  getAdminRequests,
  approveRequest,
  rejectRequest,
} from "../services/api";
import Announcements from "../components/features/Announcements";
import RequestHistory from "../components/features/RequestHistory";
import DocumentUpload from "../components/features/DocumentUpload";
import RequestComments from "../components/features/RequestComments";
import PendingAccountsView from "../components/admin/PendingAccountsView";
import Sidebar from "../components/layout/Sidebar";
import Topbar from "../components/layout/Topbar";

const ROLE_DISPLAY_MAP = {
  library_admin: "Library Admin",
  cashier_admin: "Cashier Admin",
  registrar_admin: "Registrar Admin",
  department_head: "Department Head Admin",
  super_admin: "Super Admin",
};

const THEME = {
  bg: "bg-[#020617]",
  accent: "bg-indigo-500",
  accentGradient: "from-indigo-500 to-violet-600",
  surface: "bg-slate-900/40",
  glass: "backdrop-blur-3xl bg-white/[0.02] border border-white/[0.05]",
  glassHover: "hover:bg-white/[0.05] hover:border-white/[0.1]",
  text: {
    primary: "text-slate-100",
    secondary: "text-slate-400",
    accent: "text-indigo-400",
  },
};

const SPRING_TRANSITION = { type: "spring", stiffness: 300, damping: 30 };

const GlassCard = ({ children, className = "", onClick, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ ...SPRING_TRANSITION, delay }}
    onClick={onClick}
    className={`relative overflow-hidden rounded-[32px] ${THEME.glass} ${onClick ? "cursor-pointer " + THEME.glassHover : ""} shadow-2xl shadow-black/50 ${className}`}
  >
    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] pointer-events-none mix-blend-overlay" />
    <div className="absolute -top-[50%] -left-[50%] w-[200%] h-[200%] bg-gradient-to-br from-indigo-500/10 via-transparent to-transparent opacity-30 blur-3xl pointer-events-none" />
    <div className="relative z-10 h-full">{children}</div>
  </motion.div>
);

const MetricPill = ({ label, value, trend, icon }) => (
  <GlassCard className="flex flex-col justify-center p-6 min-h-[160px] group">
    <div className="flex justify-between items-start mb-4">
      <div className="p-3 rounded-2xl bg-white/5 text-white/80 group-hover:bg-indigo-500 group-hover:text-white transition-colors duration-300">
        {icon}
      </div>
      {trend && (
        <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/20">
          {trend}
        </span>
      )}
    </div>
    <div className="text-4xl font-display font-bold text-white mb-1 tracking-tight group-hover:scale-105 transition-transform origin-left">
      {value}
    </div>
    <div className="text-sm font-medium text-slate-500 uppercase tracking-widest">
      {label}
    </div>
  </GlassCard>
);

const ActionButton = ({
  onClick,
  variant = "primary",
  children,
  icon,
  isLoading,
}) => {
  const baseClass =
    "relative h-12 px-6 rounded-full font-bold text-sm tracking-wide flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden";
  const variants = {
    primary: `bg-gradient-to-r ${THEME.accentGradient} text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:brightness-110`,
    danger:
      "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500 hover:text-white hover:border-red-500",
    ghost: "bg-white/5 text-white/60 hover:text-white hover:bg-white/10",
  };

  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      className={`${baseClass} ${variants[variant]}`}
    >
      {isLoading ? (
        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
            fill="none"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ) : (
        <>
          {icon}
          {children}
        </>
      )}
    </button>
  );
};

export default function AdminDashboard({ adminId, adminRole, onSignOut }) {
  const [requests, setRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [_isLoading, setIsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeView, setActiveView] = useState("dashboard");

  const adminInfo = {
    full_name: ROLE_DISPLAY_MAP[adminRole] || "Admin",
    role: adminRole,
    student_number: null,
  };

  useEffect(() => {
    document.title = "Smart Clearance System | Admin Portal";
    loadData();
  }, [adminRole]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const res = await getAdminRequests(adminRole);
      if (res.success) setRequests(res.requests);
    } catch {
      toast.error("Sync failed");
    } finally {
      setIsLoading(false);
    }
  };

  const processAction = async (action, id) => {
    setActionLoading(true);
    const toastId = toast.loading("Processing transaction...");
    try {
      let res;
      if (action === "approve") {
        res = await approveRequest(id, adminId);
      } else {
        if (!rejectReason) throw new Error("Reason required");
        res = await rejectRequest(id, adminId, rejectReason);
      }

      if (res.success) {
        toast.success(
          action === "approve" ? "Transaction Approved" : "Request Rejected",
          { id: toastId },
        );
        setRequests((prev) => prev.filter((r) => r.id !== id));
        setSelectedRequest(null);
        setRejectReason("");
        loadData();
      } else {
        throw new Error(res.error || "Operation failed");
      }
    } catch (err) {
      toast.error(err.message, { id: toastId });
    } finally {
      setActionLoading(false);
    }
  };

  const menuItems = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
          />
        </svg>
      ),
    },
    {
      id: "queue",
      label: "Clearance Queue",
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
          />
        </svg>
      ),
      badge: requests.length || null,
    },
    {
      id: "history",
      label: "Clearance History",
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
    },
    {
      id: "announcements",
      label: "Announcements",
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"
          />
        </svg>
      ),
    },
    {
      id: "pending-accounts",
      label: "Pending Accounts",
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
          />
        </svg>
      ),
    },
    {
      id: "reports",
      label: "Reports / Metrics",
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
      ),
    },
    {
      id: "users",
      label: "User Management",
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      ),
    },
  ];

  const renderQueueItem = (req, idx) => (
    <motion.div
      layoutId={req.id}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: idx * 0.05 }}
      onClick={() => setSelectedRequest(req)}
      className="group relative p-6 rounded-3xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.08] hover:border-white/20 transition-all cursor-pointer mb-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-5">
          <div
            className={`w-14 h-14 rounded-2xl ${THEME.accent} flex items-center justify-center text-xl font-bold text-white shadow-lg shadow-indigo-500/20 group-hover:scale-110 transition-transform`}
          >
            {req.profiles.full_name?.charAt(0) || "U"}
          </div>
          <div>
            <h3 className="text-lg font-bold text-white leading-tight group-hover:text-indigo-300 transition-colors">
              {req.profiles.full_name}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="px-2 py-0.5 rounded-md bg-white/10 text-[10px] font-bold text-slate-300 uppercase tracking-wider">
                {req.profiles.student_number}
              </span>
              <span className="text-xs text-slate-500">
                {new Date(req.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-0.5">
              Document Type
            </div>
            <div className="text-sm font-medium text-white">
              {req.document_types.name}
            </div>
          </div>
          <div className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-white/40 group-hover:bg-white group-hover:text-black transition-all">
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </div>
        </div>
      </div>
    </motion.div>
  );

  return (
    <div className={`min-h-screen ${THEME.bg}`}>
      <div className="fixed inset-0 z-0">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-violet-600/10 rounded-full blur-[120px]" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.02]" />
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
              <div>
                <h2 className="text-3xl font-bold text-white mb-2">
                  Metrics Overview
                </h2>
                <p className="text-slate-400">
                  Welcome to your admin dashboard
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <MetricPill
                  label="Total Revenue"
                  value="₱24,500"
                  trend="+12%"
                  icon={
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  }
                />
                <MetricPill
                  label="Pending Requests"
                  value={requests.length}
                  icon={
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  }
                />
                <MetricPill
                  label="Processed Today"
                  value="142"
                  icon={
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  }
                />
              </div>

              <GlassCard className="p-6">
                <h3 className="text-xl font-bold text-white mb-4">
                  Recent Activity
                </h3>
                <div className="space-y-4">
                  {requests.slice(0, 5).map((req) => (
                    <div
                      key={req.id}
                      className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05]"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold">
                          {req.profiles.full_name?.charAt(0)}
                        </div>
                        <div>
                          <p className="text-white font-semibold">
                            {req.profiles.full_name}
                          </p>
                          <p className="text-xs text-slate-400">
                            {req.document_types.name}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs text-slate-500">
                        {new Date(req.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              </GlassCard>
            </div>
          )}

          {activeView === "queue" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-7">
                <h2 className="text-2xl font-bold text-white mb-6">
                  Clearance Queue
                </h2>
                {requests.length === 0 ? (
                  <GlassCard className="p-12 text-center">
                    <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                      <svg
                        className="w-8 h-8 text-slate-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                    <p className="text-slate-400">All clearances processed</p>
                  </GlassCard>
                ) : (
                  <div className="space-y-4">
                    {requests.map((req, i) => renderQueueItem(req, i))}
                  </div>
                )}
              </div>

              <div className="lg:col-span-5">
                <GlassCard className="sticky top-24">
                  {!selectedRequest ? (
                    <div className="p-12 text-center">
                      <div className="w-32 h-32 rounded-full bg-gradient-to-tr from-white/5 to-transparent border border-white/5 flex items-center justify-center mx-auto mb-6">
                        <svg
                          className="w-12 h-12 text-indigo-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                          />
                        </svg>
                      </div>
                      <h3 className="text-xl font-bold text-white mb-2">
                        Clearance Details
                      </h3>
                      <p className="text-slate-400 text-sm">
                        Select a clearance to view details and take action
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col h-full">
                      <div className="p-6 border-b border-white/5 bg-gradient-to-b from-indigo-500/10 to-transparent">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h2 className="text-xl font-bold text-white">
                              {selectedRequest.profiles.full_name}
                            </h2>
                            <p className="text-indigo-300 text-sm">
                              {selectedRequest.profiles.student_number}
                            </p>
                          </div>
                          <button
                            onClick={() => setSelectedRequest(null)}
                            className="p-2 hover:bg-white/10 rounded-full transition-colors"
                          >
                            <svg
                              className="w-5 h-5 text-slate-400"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-3 rounded-xl bg-black/20 border border-white/5">
                            <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">
                              Clearance
                            </p>
                            <p className="text-xs font-medium text-white">
                              {selectedRequest.document_types.name}
                            </p>
                          </div>
                          <div className="p-3 rounded-xl bg-black/20 border border-white/5">
                            <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">
                              Amount
                            </p>
                            <p className="text-xs font-bold text-emerald-400">
                              ₱150.00
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                        <div>
                          <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">
                            Documents
                          </h4>
                          <DocumentUpload
                            requestId={selectedRequest.id}
                            userId={adminId}
                            isAdmin={true}
                          />
                        </div>

                        <div>
                          <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">
                            Comments
                          </h4>
                          <RequestComments
                            requestId={selectedRequest.id}
                            userRole={adminRole}
                            userId={adminId}
                            isDarkMode={true}
                          />
                        </div>
                      </div>

                      <div className="p-6 border-t border-white/5 bg-black/20">
                        <div className="space-y-3">
                          <ActionButton
                            variant="primary"
                            onClick={() =>
                              processAction("approve", selectedRequest.id)
                            }
                            isLoading={actionLoading}
                            icon={
                              <svg
                                className="w-5 h-5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                              </svg>
                            }
                          >
                            Approve Request
                          </ActionButton>

                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="Rejection reason..."
                              className="flex-1 h-12 px-4 rounded-full bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-red-500/50"
                              value={rejectReason}
                              onChange={(e) => setRejectReason(e.target.value)}
                            />
                            <ActionButton
                              variant="danger"
                              onClick={() =>
                                processAction("reject", selectedRequest.id)
                              }
                              isLoading={actionLoading}
                            >
                              Reject
                            </ActionButton>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </GlassCard>
              </div>
            </div>
          )}

          {activeView === "history" && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-6">
                Request History
              </h2>
              <RequestHistory isAdmin={true} />
            </div>
          )}

          {activeView === "announcements" && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-6">
                Announcements
              </h2>
              <Announcements userRole={adminRole} />
            </div>
          )}

          {activeView === "pending-accounts" && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-6">
                Pending Student Accounts
              </h2>
              <PendingAccountsView
                adminId={adminId}
                adminRole={adminRole}
                isDark={true}
              />
            </div>
          )}

          {activeView === "reports" && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-6">
                Reports & Metrics
              </h2>
              <GlassCard className="p-8 text-center">
                <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-10 h-10 text-indigo-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">
                  Reports Coming Soon
                </h3>
                <p className="text-slate-400">
                  Detailed analytics and reports will be available here
                </p>
              </GlassCard>
            </div>
          )}

          {activeView === "users" && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-6">
                User Management
              </h2>
              <GlassCard className="p-8 text-center">
                <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-10 h-10 text-indigo-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">
                  User Management Coming Soon
                </h3>
                <p className="text-slate-400">
                  Create and manage student accounts here
                </p>
              </GlassCard>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
