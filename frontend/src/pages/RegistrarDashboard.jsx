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
  CheckIcon,
  XMarkIcon,
  ChatBubbleIcon,
  InboxStackIcon,
  ShieldCheckIcon,
  DocumentCheckIcon,
  UsersIcon,
} from "../components/ui/Icons";
import { authAxios } from "../services/api";
import { getRegistrarTheme } from "../constants/dashboardThemes";

export default function RegistrarAdminDashboard({
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
  // G5: Bulk selection state
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);

  const [pendingAccounts, setPendingAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [searchAccounts, setSearchAccounts] = useState("");

  const fetchPendingRequests = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await authAxios.get(
        `graduation/registrar/pending`,
      );
      if (response.data.success) setRequests(response.data.requests);
    } catch (error) {
      console.error("Error fetching requests:", error);
      if (!silent) toast.error("Failed to load pending clearances");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPendingAccounts = useCallback(async (silent = false) => {
    if (!silent) setAccountsLoading(true);
    try {
      const response = await authAxios.get(`admin/pending-accounts`);
      if (response.data.success) setPendingAccounts(response.data.accounts);
    } catch (error) {
      console.error("Error fetching pending accounts:", error);
    } finally {
      setAccountsLoading(false);
    }
  }, []);

  useEffect(() => {
    document.title = "Registrar Dashboard | ISU Clearance System";
    fetchPendingRequests();
    fetchPendingAccounts();
  }, [fetchPendingRequests, fetchPendingAccounts]);

  // Live updates — re-fetch silently when data changes
  useRealtimeSubscription("requests", () => fetchPendingRequests(true));
  useRealtimeSubscription("profiles", () => fetchPendingAccounts(true));

  const handleApproveAccount = async (userId) => {
    setActionLoading(true);
    try {
      const response = await authAxios.post(`admin/approve-account`, {
        userId,
        adminId,
      });
      if (response.data.success) {
        toast.success("Account approved! Student can now login.");
        setSelectedAccount(null);
        fetchPendingAccounts();
      }
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to approve account");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectAccount = async (userId) => {
    if (!rejectReason.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }
    setActionLoading(true);
    try {
      const response = await authAxios.post(`admin/reject-account`, {
        userId,
        adminId,
        reason: rejectReason.trim(),
      });
      if (response.data.success) {
        toast.success("Account rejected.");
        setSelectedAccount(null);
        setRejectReason("");
        fetchPendingAccounts();
      }
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to reject account");
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedRequest) return;
    setActionLoading(true);
    try {
      const response = await authAxios.post(
        `graduation/registrar/approve`,
        {
          request_id: selectedRequest.id,
          admin_id: adminId,
          comments: comments.trim() || null,
        },
      );
      if (response.data.success) {
        toast.success("Registrar clearance approved — certificate generated!");
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
        `graduation/registrar/reject`,
        {
          request_id: selectedRequest.id,
          admin_id: adminId,
          comments: comments.trim(),
        },
      );
      if (response.data.success) {
        toast.success("Registrar clearance rejected");
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

  const filteredAccounts = pendingAccounts.filter((acc) => {
    if (!searchAccounts.trim()) return true;
    const q = searchAccounts.toLowerCase();
    return (
      (acc.full_name || "").toLowerCase().includes(q) ||
      (acc.student_number || "").toLowerCase().includes(q)
    );
  });

  // G5: Bulk action handlers
  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
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
        request_ids: [...selectedIds], admin_id: adminId, stage: "registrar",
      });
      if (response.data.success) {
        toast.success(`${response.data.results.approved.length} clearances approved`);
        setSelectedIds(new Set()); setBulkMode(false); fetchPendingRequests();
      }
    } catch (error) {
      toast.error(error.response?.data?.error || "Bulk approve failed");
    } finally { setBulkLoading(false); }
  };

  const handleBulkReject = async () => {
    if (selectedIds.size === 0 || !comments.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }
    setBulkLoading(true);
    try {
      const response = await authAxios.post("graduation/bulk-reject", {
        request_ids: [...selectedIds], admin_id: adminId, stage: "registrar", comments: comments.trim(),
      });
      if (response.data.success) {
        toast.success(`${response.data.results.rejected.length} clearances rejected`);
        setSelectedIds(new Set()); setBulkMode(false); setComments(""); fetchPendingRequests();
      }
    } catch (error) {
      toast.error(error.response?.data?.error || "Bulk reject failed");
    } finally { setBulkLoading(false); }
  };

  const theme = getRegistrarTheme(isDarkMode);

  const menuItems = [
    {
      id: "pending",
      label: "Final Approvals",
      icon: <ShieldCheckIcon className="w-5 h-5" />,
      count: requests.length,
    },
    {
      id: "accounts",
      label: "Pending Accounts",
      icon: <UsersIcon className="w-5 h-5" />,
      count: pendingAccounts.length,
    },
  ];

  return (
    <DashboardLayout
      theme={theme}
      menuItems={menuItems}
      activeView={activeView}
      setActiveView={setActiveView}
      userInfo={{ name: "Registrar", subtitle: "Registrar Admin" }}
      onSignOut={onSignOut}
      onOpenSettings={onOpenSettings}
      onManageAccount={onManageAccount}
      toggleTheme={toggleTheme}
      isDarkMode={isDarkMode}
    >
      <div className="max-w-5xl mx-auto space-y-6">
        {activeView === "pending" && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold text-gray-900">
                  Registrar Final Approval
                </h2>
                <p className="text-gray-500 mt-1">
                  Final validation and certificate generation for graduating
                  students
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="px-4 py-2 rounded-xl border text-slate-600 bg-slate-50 border-slate-200 text-center">
                  <div className="text-xl font-bold">{requests.length}</div>
                  <div className="text-xs font-medium">Awaiting Final</div>
                </div>
              </div>
            </div>

            {!loading && requests.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      placeholder="Search by name or student number..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white/60 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-all"
                    />
                  </div>
                  {filteredRequests.length > 1 && (
                    <button
                      onClick={() => { setBulkMode(!bulkMode); setSelectedIds(new Set()); }}
                      className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
                        bulkMode ? "bg-slate-700 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                      }`}
                    >
                      {bulkMode ? "Cancel Bulk" : "Bulk Actions"}
                    </button>
                  )}
                </div>
                {bulkMode && (
                  <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={selectedIds.size === filteredRequests.length} onChange={toggleSelectAll} className="w-4 h-4 rounded" />
                      <span className="text-sm font-medium text-gray-700">Select All ({selectedIds.size}/{filteredRequests.length})</span>
                    </label>
                    <div className="flex gap-2">
                      <button onClick={handleBulkApprove} disabled={selectedIds.size === 0 || bulkLoading}
                        className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-green-600 text-white disabled:opacity-50">
                        {bulkLoading ? "..." : `Approve (${selectedIds.size})`}
                      </button>
                      <button onClick={handleBulkReject} disabled={selectedIds.size === 0 || bulkLoading || !comments.trim()}
                        className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-red-600 text-white disabled:opacity-50">
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
                  className="w-20 h-20 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-5"
                >
                  <InboxStackIcon className="w-10 h-10 text-slate-400" />
                </motion.div>
                <h3 className="text-xl font-bold mb-2 text-gray-900">
                  No Pending Final Approvals
                </h3>
                <p className="text-gray-500">
                  All registrar clearance requests have been processed.
                </p>
              </GlassCard>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                    Students Awaiting Final Approval
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
                              ? "border-slate-400 bg-slate-50/50 shadow-lg shadow-slate-500/10"
                              : bulkMode && selectedIds.has(req.id)
                                ? "border-blue-400 bg-blue-50/50 shadow-md"
                                : "border-gray-100 bg-white/70 hover:border-slate-300 hover:shadow-md"
                          }`}
                          onClick={() => {
                            if (bulkMode) { toggleSelect(req.id); return; }
                            setSelectedRequest(req);
                            setComments("");
                          }}
                        >
                          <div className="flex items-center gap-3">
                            {bulkMode && (
                              <input type="checkbox" checked={selectedIds.has(req.id)} onChange={() => toggleSelect(req.id)} onClick={(e) => e.stopPropagation()} className="w-4 h-4 rounded" />
                            )}
                            <div className="w-10 h-10 bg-gradient-to-br from-slate-600 to-slate-800 rounded-xl flex items-center justify-center text-white font-bold shadow-lg shadow-slate-500/20">
                              {req.student?.full_name?.charAt(0) || "?"}
                            </div>
                            <div className="flex-1">
                              <h4 className="font-bold text-sm text-gray-900">
                                {req.student?.full_name || "Unknown Student"}
                              </h4>
                              <div className="flex items-center gap-2 mt-0.5">
                                <p className="text-xs text-gray-500">
                                  {req.student?.student_number || ""}
                                </p>
                                <div className="flex items-center gap-1">
                                {req.professors_status === "approved" && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-600">
                                    Prof ✓
                                  </span>
                                )}
                                {req.library_status === "approved" && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-600">
                                    Lib ✓
                                  </span>
                                )}
                                {req.cashier_status === "approved" && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-600">
                                    Cash ✓
                                  </span>
                                )}
                              </div>
                            </div>
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
                    Final Review
                  </h3>
                  {selectedRequest ? (
                    <GlassCard className="p-5">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-slate-600 to-slate-800 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg">
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

                      <div className="mb-4 p-3 rounded-xl bg-slate-50 border border-slate-100">
                        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <DocumentCheckIcon className="w-3.5 h-3.5" />
                          Clearance Status
                        </h4>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            {
                              label: "Professors",
                              status: selectedRequest.professors_status,
                            },
                            {
                              label: "Library",
                              status: selectedRequest.library_status,
                            },
                            {
                              label: "Cashier",
                              status: selectedRequest.cashier_status,
                            },
                          ].map((item) => (
                            <div
                              key={item.label}
                              className="text-center p-2 rounded-lg bg-white"
                            >
                              <div className="text-xs text-gray-500 mb-0.5">
                                {item.label}
                              </div>
                              <StatusBadge status={item.status || "pending"} />
                            </div>
                          ))}
                        </div>
                      </div>

                      {selectedRequest.id && (
                        <div className="mb-4">
                          <RequestComments
                            requestId={selectedRequest.id}
                            userRole="registrar"
                            userId={adminId}
                          />
                        </div>
                      )}

                      <div className="mb-4">
                        <label className="text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-2">
                          <ChatBubbleIcon className="w-4 h-4 text-gray-400" />
                          Final Comments
                        </label>
                        <textarea
                          placeholder="Comments (required for rejection)..."
                          value={comments}
                          onChange={(e) => setComments(e.target.value)}
                          rows={3}
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white/60 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-all resize-none"
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
                          <ShieldCheckIcon className="w-4 h-4" />
                          Approve & Generate Certificate
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
                      <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-4">
                        <ShieldCheckIcon className="w-8 h-8 text-slate-400" />
                      </div>
                      <p className="text-gray-500 text-sm">
                        Select a student for final review
                      </p>
                    </GlassCard>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {activeView === "accounts" && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold text-gray-900">
                  Pending Account Verifications
                </h2>
                <p className="text-gray-500 mt-1">
                  Review and approve student accounts with low face verification
                  scores
                </p>
              </div>
              <div className="flex items-center gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={fetchPendingAccounts}
                  className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 transition-all"
                >
                  Refresh
                </motion.button>
                <div className="px-4 py-2 rounded-xl border text-amber-600 bg-amber-50 border-amber-200 text-center">
                  <div className="text-xl font-bold">
                    {pendingAccounts.length}
                  </div>
                  <div className="text-xs font-medium">Pending</div>
                </div>
              </div>
            </div>

            {!accountsLoading && pendingAccounts.length > 0 && (
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search by name or student number..."
                  value={searchAccounts}
                  onChange={(e) => setSearchAccounts(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white/60 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                />
              </div>
            )}

            {accountsLoading ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider animate-pulse">
                    Loading Accounts...
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
                    Account Review
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
            ) : pendingAccounts.length === 0 ? (
              <GlassCard className="p-12 text-center">
                <motion.div
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  className="w-20 h-20 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-5"
                >
                  <CheckIcon className="w-10 h-10 text-green-400" />
                </motion.div>
                <h3 className="text-xl font-bold mb-2 text-gray-900">
                  All Accounts Verified
                </h3>
                <p className="text-gray-500">
                  No pending account verifications at this time.
                </p>
              </GlassCard>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                    Accounts Awaiting Review
                  </h3>
                  <AnimatePresence mode="popLayout">
                    {filteredAccounts.map((account) => (
                      <motion.div
                        key={account.id}
                        layout
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, x: -30 }}
                        transition={{ type: "spring", stiffness: 350, damping: 30 }}
                      >
                        <div
                          className={`p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                            selectedAccount?.id === account.id
                              ? "border-amber-400 bg-amber-50/50 shadow-lg shadow-amber-500/10"
                              : "border-gray-100 bg-white/70 hover:border-amber-300 hover:shadow-md"
                          }`}
                          onClick={() => {
                            setSelectedAccount(account);
                            setRejectReason("");
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center text-white font-bold shadow-lg shadow-amber-500/20">
                              {account.full_name?.charAt(0) || "?"}
                            </div>
                            <div className="flex-1">
                              <h4 className="font-bold text-sm text-gray-900">
                                {account.full_name || "Unknown"}
                              </h4>
                              <div className="flex items-center gap-2 mt-0.5">
                                <p className="text-xs text-gray-500">
                                  {account.student_number || "No student #"}
                                </p>
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    (account.face_similarity || 0) >= 70
                                      ? "bg-yellow-100 text-yellow-700"
                                      : "bg-red-100 text-red-700"
                                  }`}
                                >
                                  {(account.face_similarity || 0).toFixed(0)}%
                                  match
                                </span>
                              </div>
                            </div>
                            <span className="px-2 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                              Pending
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                    Account Review
                  </h3>
                  {selectedAccount ? (
                    <GlassCard className="p-5">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg">
                          {selectedAccount.full_name?.charAt(0) || "?"}
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-900">
                            {selectedAccount.full_name}
                          </h3>
                          <p className="text-sm text-gray-500">
                            {selectedAccount.student_number}
                          </p>
                        </div>
                      </div>

                      <div className="mb-4 space-y-3">
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                            Account Information
                          </h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-500">
                                Course & Year
                              </span>
                              <span className="font-medium text-gray-900">
                                {selectedAccount.course_year || "N/A"}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">
                                Face Verified
                              </span>
                              <span
                                className={`font-medium ${selectedAccount.face_verified ? "text-green-600" : "text-red-600"}`}
                              >
                                {selectedAccount.face_verified ? "Yes" : "No"}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">
                                Face Similarity
                              </span>
                              <span
                                className={`font-bold ${(selectedAccount.face_similarity || 0) >= 70 ? "text-yellow-600" : "text-red-600"}`}
                              >
                                {(selectedAccount.face_similarity || 0).toFixed(
                                  1,
                                )}
                                %
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">Registered</span>
                              <span className="font-medium text-gray-900">
                                {selectedAccount.created_at
                                  ? new Date(
                                      selectedAccount.created_at,
                                    ).toLocaleDateString()
                                  : "N/A"}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                            Face Match Score
                          </h4>
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  (selectedAccount.face_similarity || 0) >= 70
                                    ? "bg-yellow-500"
                                    : "bg-red-500"
                                }`}
                                style={{
                                  width: `${Math.min(selectedAccount.face_similarity || 0, 100)}%`,
                                }}
                              />
                            </div>
                            <span className="text-sm font-bold text-gray-700 min-w-[50px] text-right">
                              {(selectedAccount.face_similarity || 0).toFixed(
                                1,
                              )}
                              %
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 mt-1">
                            {(selectedAccount.face_similarity || 0) >= 90
                              ? "Auto-approved threshold met"
                              : (selectedAccount.face_similarity || 0) >= 70
                                ? "Moderate match — manual review recommended"
                                : "Low match — verify identity carefully"}
                          </p>
                        </div>
                      </div>

                      <div className="mb-4">
                        <label className="text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-2">
                          <ChatBubbleIcon className="w-4 h-4 text-gray-400" />
                          Rejection Reason (required to reject)
                        </label>
                        <textarea
                          placeholder="Provide reason if rejecting..."
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          rows={2}
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white/60 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-all resize-none"
                        />
                      </div>

                      <div className="flex gap-3">
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() =>
                            handleApproveAccount(selectedAccount.id)
                          }
                          disabled={actionLoading}
                          className="flex-1 flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-xl font-semibold shadow-lg shadow-green-500/20 disabled:opacity-50 transition-all text-sm"
                        >
                          <CheckIcon className="w-4 h-4" />
                          Approve Account
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() =>
                            handleRejectAccount(selectedAccount.id)
                          }
                          disabled={actionLoading}
                          className="flex-1 flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-xl font-semibold shadow-lg shadow-red-500/20 disabled:opacity-50 transition-all text-sm"
                        >
                          <XMarkIcon className="w-4 h-4" />
                          Reject Account
                        </motion.button>
                      </div>
                    </GlassCard>
                  ) : (
                    <GlassCard className="p-8 text-center">
                      <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-4">
                        <UsersIcon className="w-8 h-8 text-amber-400" />
                      </div>
                      <p className="text-gray-500 text-sm">
                        Select an account to review
                      </p>
                    </GlassCard>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
