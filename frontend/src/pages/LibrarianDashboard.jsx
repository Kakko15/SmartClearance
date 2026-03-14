import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import RequestComments from "../components/features/RequestComments";
import useRealtimeSubscription from "../hooks/useRealtimeSubscription";
import DashboardLayout, {
  GlassCard,
  StatusBadge,
} from "../components/ui/DashboardLayout";
import {
  BookOpenIcon,
  CheckIcon,
  XMarkIcon,
  ChatBubbleIcon,
  InboxStackIcon,
  UserIcon,
} from "../components/ui/Icons";
import { authAxios } from "../services/api";

export default function LibraryAdminDashboard({
  adminId,
  onSignOut,
  onOpenSettings,
  onManageAccount,
  isDarkMode = false,
  toggleTheme,
}) {
  const [requests, setRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [comments, setComments] = useState("");
  const [activeView, setActiveView] = useState("pending");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchPendingRequests = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await authAxios.get(`graduation/library/pending`);
      if (response.data.success) setRequests(response.data.requests);
    } catch (error) {
      console.error("Error fetching requests:", error);
      if (!silent) toast.error("Failed to load pending clearances");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    document.title = "Library Dashboard | ISU Clearance System";
    fetchPendingRequests();
  }, [fetchPendingRequests]);

  // Live updates — re-fetch silently when requests table changes
  useRealtimeSubscription("requests", () => fetchPendingRequests(true));

  const handleApprove = async () => {
    if (!selectedRequest) return;
    setActionLoading(true);
    try {
      const response = await authAxios.post(
        `graduation/library/approve`,
        {
          request_id: selectedRequest.id,
          admin_id: adminId,
          comments: comments.trim() || null,
        },
      );
      if (response.data.success) {
        toast.success("Library clearance approved!");
        setComments("");
        setSelectedRequest(null);
        fetchPendingRequests();
      }
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to approve");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRequest) return;
    if (!comments.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }
    setActionLoading(true);
    try {
      const response = await authAxios.post(
        `graduation/library/reject`,
        {
          request_id: selectedRequest.id,
          admin_id: adminId,
          comments: comments.trim(),
        },
      );
      if (response.data.success) {
        toast.success("Library clearance rejected");
        setComments("");
        setSelectedRequest(null);
        fetchPendingRequests();
      }
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to reject");
    } finally {
      setActionLoading(false);
    }
  };

  const filteredRequests = requests.filter((req) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (req.student?.full_name || "").toLowerCase().includes(q) ||
      (req.student?.student_number || "").toLowerCase().includes(q)
    );
  });

  const theme = {
    name: "Library Admin",
    abbrev: "LA",
    dashboardTitle: "Library Dashboard",
    sidebarGradient: isDarkMode ? "bg-slate-900 border-r border-slate-800" : "bg-white border-r border-slate-200",
    sidebarActive: isDarkMode ? "bg-primary-900/40 text-primary-400" : "bg-primary-50 text-primary-600",
    sidebarInactive: isDarkMode ? "text-slate-400 hover:bg-slate-800 hover:text-slate-200" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
    accentGradient: isDarkMode ? "bg-primary-500 text-white" : "bg-primary-600 text-white",
    dotColor: "bg-primary-500",
    bg: isDarkMode ? "bg-[#030712]" : "bg-[#FAFAFA]",
    topbar: isDarkMode ? "bg-slate-900/80 border-b border-slate-800" : "bg-white/80 border-b border-slate-200",
    topbarText: isDarkMode ? "text-slate-100" : "text-slate-900",
    topbarSub: isDarkMode ? "text-slate-400" : "text-slate-500",
    topbarBtn: isDarkMode ? "hover:bg-slate-800" : "hover:bg-slate-50",
  };

  const menuItems = [
    {
      id: "pending",
      label: "Pending Clearances",
      icon: <BookOpenIcon className="w-5 h-5" />,
      count: requests.length,
    },
  ];

  return (
    <DashboardLayout
      theme={theme}
      menuItems={menuItems}
      activeView={activeView}
      setActiveView={setActiveView}
      userInfo={{ name: "Campus Librarian", subtitle: "Library Admin" }}
      onSignOut={onSignOut}
      onOpenSettings={onOpenSettings}
      onManageAccount={onManageAccount}
      toggleTheme={toggleTheme}
      isDarkMode={isDarkMode}
    >
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">
              Library Clearance
            </h2>
            <p className="text-gray-500 mt-1">
              Review student library obligations and book returns
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="px-4 py-2 rounded-xl border text-amber-600 bg-amber-50 border-amber-200 text-center">
              <div className="text-xl font-bold">{requests.length}</div>
              <div className="text-xs font-medium">Pending</div>
            </div>
          </div>
        </div>

        {!loading && requests.length > 0 && (
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by name or student number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white/60 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
            />
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider animate-pulse">
                Loading Students...
              </h3>
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-4 rounded-xl border-2 border-gray-100 bg-white/70">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-200 rounded-xl animate-pulse" />
                    <div className="flex-1">
                      <div className="h-4 w-32 bg-slate-200 rounded animate-pulse mb-1.5" />
                      <div className="h-3 w-24 bg-slate-200 rounded animate-pulse" />
                    </div>
                    <div className="w-16 h-6 bg-slate-200 rounded-full animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 animate-pulse">
                Review Panel
              </h3>
              <GlassCard className="p-5 h-[400px] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4 w-full">
                   <div className="w-16 h-16 rounded-2xl bg-slate-200 animate-pulse" />
                   <div className="h-4 w-48 bg-slate-200 rounded animate-pulse mb-2" />
                   <div className="h-3 w-32 bg-slate-200 rounded animate-pulse" />
                </div>
              </GlassCard>
            </div>
          </div>
        ) : requests.length === 0 ? (
          <GlassCard className="p-12 text-center">
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              className="w-20 h-20 rounded-2xl bg-violet-50 flex items-center justify-center mx-auto mb-5"
            >
              <InboxStackIcon className="w-10 h-10 text-violet-400" />
            </motion.div>
            <h3 className="text-xl font-bold mb-2 text-gray-900">
              No Pending Clearances
            </h3>
            <p className="text-gray-500">
              All library clearance requests have been processed.
            </p>
          </GlassCard>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                Student Requests
              </h3>
              <AnimatePresence mode="popLayout">
                {filteredRequests.map((req) => (
                  <motion.div
                    key={req.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, x: -30 }}
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  >
                    <div
                      className={`p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                        selectedRequest?.id === req.id
                          ? "border-violet-400 bg-violet-50/50 shadow-lg shadow-violet-500/10"
                          : "border-gray-100 bg-white/70 hover:border-violet-200 hover:shadow-md"
                      }`}
                      onClick={() => {
                        setSelectedRequest(req);
                        setComments("");
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold shadow-lg shadow-violet-500/20">
                          {req.student?.full_name?.charAt(0) || "?"}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-sm text-gray-900">
                            {req.student?.full_name || "Unknown Student"}
                          </h4>
                          <p className="text-xs text-gray-500">
                            {req.student?.student_number || ""}
                          </p>
                        </div>
                        <StatusBadge status="pending" />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Review Panel
              </h3>
              {selectedRequest ? (
                <GlassCard className="p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg">
                      {selectedRequest.student?.full_name?.charAt(0) || "?"}
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">
                        {selectedRequest.student?.full_name}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {selectedRequest.student?.student_number}
                      </p>
                    </div>
                  </div>

                  {selectedRequest.id && (
                    <div className="mb-4">
                      <RequestComments
                        requestId={selectedRequest.id}
                        userRole="librarian"
                        userId={adminId}
                      />
                    </div>
                  )}

                  <div className="mb-4">
                    <label className="text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-2">
                      <ChatBubbleIcon className="w-4 h-4 text-gray-400" />
                      Add Comment
                    </label>
                    <textarea
                      placeholder="Comments (required for rejection)..."
                      value={comments}
                      onChange={(e) => setComments(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white/60 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all resize-none"
                    />
                  </div>

                  <div className="flex gap-3">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleApprove}
                      disabled={actionLoading}
                      className="flex-1 flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-xl font-semibold shadow-lg shadow-green-500/20 disabled:opacity-50 transition-all text-sm"
                    >
                      <CheckIcon className="w-4 h-4" />
                      Approve
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleReject}
                      disabled={actionLoading}
                      className="flex-1 flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-xl font-semibold shadow-lg shadow-red-500/20 disabled:opacity-50 transition-all text-sm"
                    >
                      <XMarkIcon className="w-4 h-4" />
                      Reject
                    </motion.button>
                  </div>
                </GlassCard>
              ) : (
                <GlassCard className="p-8 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center mx-auto mb-4">
                    <UserIcon className="w-8 h-8 text-violet-400" />
                  </div>
                  <p className="text-gray-500 text-sm">
                    Select a student to review their request
                  </p>
                </GlassCard>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
