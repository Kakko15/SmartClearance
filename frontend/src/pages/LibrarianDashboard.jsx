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
import { getLibrarianTheme } from "../constants/dashboardThemes";
import SearchFilterBar from "../components/ui/SearchFilterBar";
import { exportToCSV } from "../utils/exportData";

export default function LibraryAdminDashboard({
  adminId,
  user,
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
  const [activeView, setActiveView] = useState(
    () => sessionStorage.getItem("tab_librarian") || "pending",
  );

  useEffect(() => {
    sessionStorage.setItem("tab_librarian", activeView);
  }, [activeView]);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  // G5: Bulk selection state
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);

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

  useRealtimeSubscription("requests", () => fetchPendingRequests(true));

  useEffect(() => {
    const interval = setInterval(() => fetchPendingRequests(true), 30000);
    return () => clearInterval(interval);
  }, [fetchPendingRequests]);

  const handleApprove = async () => {
    if (!selectedRequest) return;
    setActionLoading(true);
    try {
      const response = await authAxios.post(`graduation/library/approve`, {
        request_id: selectedRequest.id,
        admin_id: adminId,
        comments: comments.trim() || null,
      });
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
      const response = await authAxios.post(`graduation/library/reject`, {
        request_id: selectedRequest.id,
        admin_id: adminId,
        comments: comments.trim(),
      });
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
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (
        !(req.student?.full_name || "").toLowerCase().includes(q) &&
        !(req.student?.student_number || "").toLowerCase().includes(q)
      )
        return false;
    }
    if (dateFrom && req.created_at && req.created_at < dateFrom) return false;
    if (dateTo && req.created_at && req.created_at > dateTo + "T23:59:59")
      return false;
    return true;
  });

  const handleExport = () => {
    exportToCSV(
      filteredRequests,
      [
        { label: "Student Name", accessor: (r) => r.student?.full_name || "" },
        {
          label: "Student Number",
          accessor: (r) => r.student?.student_number || "",
        },
        { label: "Status", key: "library_status" },
        {
          label: "Submitted",
          accessor: (r) =>
            r.created_at ? new Date(r.created_at).toLocaleDateString() : "",
        },
      ],
      "library_clearances",
    );
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredRequests.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredRequests.map((r) => r.id)));
  };

  const handleBulkApprove = async () => {
    if (selectedIds.size === 0) return;
    setBulkLoading(true);
    try {
      const response = await authAxios.post("graduation/bulk-approve", {
        request_ids: [...selectedIds],
        admin_id: adminId,
        stage: "library",
      });
      if (response.data.success) {
        toast.success(
          `${response.data.results.approved.length} clearances approved`,
        );
        setSelectedIds(new Set());
        setBulkMode(false);
        setSelectedRequest(null);
        setComments("");
        fetchPendingRequests();
      }
    } catch (error) {
      toast.error(error.response?.data?.error || "Bulk approve failed");
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkReject = async () => {
    if (selectedIds.size === 0 || !comments.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }
    setBulkLoading(true);
    try {
      const response = await authAxios.post("graduation/bulk-reject", {
        request_ids: [...selectedIds],
        admin_id: adminId,
        stage: "library",
        comments: comments.trim(),
      });
      if (response.data.success) {
        toast.success(
          `${response.data.results.rejected.length} clearances rejected`,
        );
        setSelectedIds(new Set());
        setBulkMode(false);
        setSelectedRequest(null);
        setComments("");
        fetchPendingRequests();
      }
    } catch (error) {
      toast.error(error.response?.data?.error || "Bulk reject failed");
    } finally {
      setBulkLoading(false);
    }
  };

  const theme = getLibrarianTheme(isDarkMode);

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
      userInfo={{
        name: "Campus Librarian",
        subtitle: "Library Admin",
        avatar: user?.user_metadata?.avatar_url,
      }}
      onSignOut={onSignOut}
      onOpenSettings={onOpenSettings}
      onManageAccount={onManageAccount}
      toggleTheme={toggleTheme}
      isDarkMode={isDarkMode}
    >
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2
              className={`text-3xl font-bold ${isDarkMode ? "text-white" : "text-gray-900"}`}
            >
              Library Clearance
            </h2>
            <p
              className={`mt-1 ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}
            >
              Review student library obligations and book returns
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div
              className={`px-4 py-2 rounded-xl border text-center ${isDarkMode ? "text-amber-400 bg-amber-500/10 border-amber-500/20" : "text-amber-600 bg-amber-50 border-amber-200"}`}
            >
              <div className="text-xl font-bold">{requests.length}</div>
              <div className="text-xs font-medium">Pending</div>
            </div>
          </div>
        </div>

        {!loading && requests.length > 0 && (
          <div className="space-y-3">
            <SearchFilterBar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              dateFrom={dateFrom}
              dateTo={dateTo}
              onDateFromChange={setDateFrom}
              onDateToChange={setDateTo}
              onExport={handleExport}
              isDarkMode={isDarkMode}
            >
              {filteredRequests.length > 1 && (
                <button
                  onClick={() => {
                    setBulkMode(!bulkMode);
                    setSelectedIds(new Set());
                  }}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
                    bulkMode
                      ? "bg-violet-600 text-white"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  {bulkMode ? "Cancel Bulk" : "Bulk Actions"}
                </button>
              )}
            </SearchFilterBar>
            {bulkMode && (
              <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-violet-50 border border-violet-200">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === filteredRequests.length}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Select All ({selectedIds.size}/{filteredRequests.length})
                  </span>
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={handleBulkApprove}
                    disabled={selectedIds.size === 0 || bulkLoading}
                    className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-green-600 text-white disabled:opacity-50"
                  >
                    {bulkLoading ? "..." : `Approve (${selectedIds.size})`}
                  </button>
                  <button
                    onClick={handleBulkReject}
                    disabled={
                      selectedIds.size === 0 || bulkLoading || !comments.trim()
                    }
                    className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-red-600 text-white disabled:opacity-50"
                  >
                    {bulkLoading ? "..." : `Reject (${selectedIds.size})`}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider animate-pulse">
                Loading Students...
              </h3>
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="p-4 rounded-xl border-2 border-gray-100 bg-white/70"
                >
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
          <GlassCard className="p-12 text-center" isDark={isDarkMode}>
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              className={`w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-5 ${isDarkMode ? "bg-violet-500/10" : "bg-violet-50"}`}
            >
              <InboxStackIcon
                className={`w-10 h-10 ${isDarkMode ? "text-violet-400" : "text-violet-400"}`}
              />
            </motion.div>
            <h3
              className={`text-xl font-bold mb-2 ${isDarkMode ? "text-white" : "text-gray-900"}`}
            >
              No Pending Clearances
            </h3>
            <p className={isDarkMode ? "text-gray-400" : "text-gray-500"}>
              All library clearance requests have been processed.
            </p>
          </GlassCard>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-3">
              <h3
                className={`text-sm font-semibold uppercase tracking-wider ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}
              >
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
                          : bulkMode && selectedIds.has(req.id)
                            ? "border-blue-400 bg-blue-50/50 shadow-md"
                            : "border-gray-100 bg-white/70 hover:border-violet-200 hover:shadow-md"
                      }`}
                      onClick={() => {
                        if (bulkMode) {
                          toggleSelect(req.id);
                          return;
                        }
                        setSelectedRequest(req);
                        setComments("");
                      }}
                    >
                      <div className="flex items-center gap-3">
                        {bulkMode && (
                          <input
                            type="checkbox"
                            checked={selectedIds.has(req.id)}
                            onChange={() => toggleSelect(req.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-4 h-4 rounded"
                          />
                        )}
                        <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold shadow-lg shadow-violet-500/20">
                          {req.student?.full_name?.charAt(0) || "?"}
                        </div>
                        <div className="flex-1">
                          <h4
                            className={`font-bold text-sm ${isDarkMode ? "text-white" : "text-gray-900"}`}
                          >
                            {req.student?.full_name || "Unknown Student"}
                          </h4>
                          <p
                            className={`text-xs ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}
                          >
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
              <h3
                className={`text-sm font-semibold uppercase tracking-wider mb-3 ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}
              >
                Review Panel
              </h3>
              {selectedRequest ? (
                <GlassCard className="p-5" isDark={isDarkMode}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg">
                      {selectedRequest.student?.full_name?.charAt(0) || "?"}
                    </div>
                    <div>
                      <h3
                        className={`font-bold ${isDarkMode ? "text-white" : "text-gray-900"}`}
                      >
                        {selectedRequest.student?.full_name}
                      </h3>
                      <p
                        className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}
                      >
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
                        isDarkMode={isDarkMode}
                      />
                    </div>
                  )}

                  <div className="mb-4">
                    <label
                      className={`text-sm font-medium mb-1.5 flex items-center gap-2 ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}
                    >
                      <ChatBubbleIcon
                        className={`w-4 h-4 ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}
                      />
                      Add Comment
                    </label>
                    <textarea
                      placeholder="Comments (required for rejection)..."
                      value={comments}
                      onChange={(e) => setComments(e.target.value)}
                      rows={3}
                      className={`w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all resize-none ${isDarkMode ? "bg-slate-800 border-slate-600 text-white placeholder-gray-500" : "bg-white/60 border-gray-200 text-gray-900"}`}
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
                <GlassCard className="p-8 text-center" isDark={isDarkMode}>
                  <div
                    className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${isDarkMode ? "bg-violet-500/10" : "bg-violet-50"}`}
                  >
                    <UserIcon
                      className={`w-8 h-8 ${isDarkMode ? "text-violet-400" : "text-violet-400"}`}
                    />
                  </div>
                  <p
                    className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}
                  >
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
