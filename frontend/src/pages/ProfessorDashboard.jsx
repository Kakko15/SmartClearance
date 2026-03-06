import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import RequestComments from "../components/features/RequestComments";
import DashboardLayout, {
  GlassCard,
  StatusBadge,
} from "../components/ui/DashboardLayout";
import {
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  CheckIcon,
  XMarkIcon,
  ChatBubbleIcon,
  InboxStackIcon,
} from "../components/ui/Icons";

const API_URL = import.meta.env.VITE_API_URL;

export default function ProfessorDashboard({
  professorId,
  professorInfo,
  onSignOut,
  onOpenSettings,
  _isDarkMode = false,
}) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState("pending");
  const [expandedStudent, setExpandedStudent] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedRejectId, setSelectedRejectId] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    document.title = "Professor Dashboard | ISU Clearance";
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const response = await axios.get(
        `${API_URL}/graduation/professor/students/${professorId}`,
      );
      if (response.data.success) setStudents(response.data.approvals || []);
    } catch (error) {
      console.error("Error fetching students:", error);
      toast.error("Failed to load student data");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (approvalId) => {
    setActionLoading(true);
    try {
      const response = await axios.post(
        `${API_URL}/graduation/professor/approve`,
        {
          approval_id: approvalId,
          professor_id: professorId,
        },
      );
      if (response.data.success) {
        toast.success("Student approved successfully");
        fetchStudents();
      }
    } catch {
      toast.error("Failed to approve student");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (approvalId) => {
    if (!rejectReason.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }
    setActionLoading(true);
    try {
      const response = await axios.post(
        `${API_URL}/graduation/professor/reject`,
        {
          approval_id: approvalId,
          professor_id: professorId,
          comments: rejectReason,
        },
      );
      if (response.data.success) {
        toast.success("Student rejected");
        setRejectReason("");
        setSelectedRejectId(null);
        fetchStudents();
      }
    } catch {
      toast.error("Failed to reject student");
    } finally {
      setActionLoading(false);
    }
  };

  const pendingStudents = students.filter((s) => s.status === "pending");
  const approvedStudents = students.filter((s) => s.status === "approved");
  const rejectedStudents = students.filter((s) => s.status === "rejected");

  const displayStudents =
    activeView === "pending"
      ? pendingStudents
      : activeView === "approved"
        ? approvedStudents
        : rejectedStudents;

  const theme = {
    name: "Professor Panel",
    abbrev: "PP",
    dashboardTitle: "Professor Dashboard",
    sidebarGradient:
      "bg-gradient-to-b from-sky-800 to-blue-900 border-r border-sky-700/20",
    sidebarActive: "bg-white text-sky-800 shadow-sky-900/20",
    accentGradient: "bg-gradient-to-br from-sky-600 to-blue-700",
    accentShadow: "shadow-sky-600/20",
    dotColor: "bg-sky-300",
    bg: "bg-gradient-to-br from-sky-50 via-blue-50/30 to-slate-50",
    glow1: "bg-sky-400/8",
    glow2: "bg-blue-400/5",
    topbar: "bg-white/80 border-b border-sky-100",
    topbarText: "text-gray-900",
    topbarSub: "text-gray-500",
    topbarBtn: "hover:bg-sky-50",
    topbarIcon: "text-gray-500",
    topbarDivider: "bg-gray-200",
    logoutBtn:
      "bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white",
  };

  const menuItems = [
    {
      id: "pending",
      label: "Pending Approvals",
      icon: <ClockIcon className="w-5 h-5" />,
      count: pendingStudents.length,
    },
    {
      id: "approved",
      label: "Approved",
      icon: <CheckCircleIcon className="w-5 h-5" />,
      count: approvedStudents.length,
    },
    {
      id: "rejected",
      label: "Rejected",
      icon: <XCircleIcon className="w-5 h-5" />,
      count: rejectedStudents.length,
    },
  ];

  return (
    <DashboardLayout
      theme={theme}
      menuItems={menuItems}
      activeView={activeView}
      setActiveView={setActiveView}
      userInfo={{ name: professorInfo?.full_name, subtitle: "Professor" }}
      onSignOut={onSignOut}
      onOpenSettings={onOpenSettings}
    >
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">
              {activeView === "pending"
                ? "Pending Approvals"
                : activeView === "approved"
                  ? "Approved Students"
                  : "Rejected Students"}
            </h2>
            <p className="text-gray-500 mt-1">
              Review and manage student graduation clearance requests
            </p>
          </div>
          <div className="flex items-center gap-3">
            {[
              {
                label: "Pending",
                value: pendingStudents.length,
                color: "text-amber-600 bg-amber-50 border-amber-200",
              },
              {
                label: "Approved",
                value: approvedStudents.length,
                color: "text-emerald-600 bg-emerald-50 border-emerald-200",
              },
              {
                label: "Rejected",
                value: rejectedStudents.length,
                color: "text-red-600 bg-red-50 border-red-200",
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className={`px-3 py-2 rounded-xl border text-center ${stat.color}`}
              >
                <div className="text-xl font-bold">{stat.value}</div>
                <div className="text-xs font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {loading ? (
          <GlassCard className="p-12">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-500">Loading student data...</p>
            </div>
          </GlassCard>
        ) : displayStudents.length === 0 ? (
          <GlassCard className="p-12 text-center">
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              className="w-20 h-20 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-5"
            >
              <InboxStackIcon className="w-10 h-10 text-blue-400" />
            </motion.div>
            <h3 className="text-xl font-bold mb-2 text-gray-900">
              No {activeView} requests
            </h3>
            <p className="text-gray-500">
              {activeView === "pending"
                ? "All student requests have been processed."
                : `No ${activeView} students at this time.`}
            </p>
          </GlassCard>
        ) : (
          <div className="space-y-4">
            {displayStudents.map((student, idx) => (
              <motion.div
                key={student.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: idx * 0.05,
                  type: "spring",
                  stiffness: 200,
                  damping: 25,
                }}
              >
                <GlassCard className="overflow-hidden">
                  <div
                    className="p-5 cursor-pointer hover:bg-blue-50/30 transition-colors"
                    onClick={() =>
                      setExpandedStudent(
                        expandedStudent === student.id ? null : student.id,
                      )
                    }
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/20">
                          {student.request?.student?.full_name?.charAt(0) ||
                            "?"}
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-900">
                            {student.request?.student?.full_name ||
                              "Unknown Student"}
                          </h3>
                          <p className="text-sm text-gray-500">
                            {student.request?.student?.student_number || ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <StatusBadge status={student.status} />
                        <motion.div
                          animate={{
                            rotate: expandedStudent === student.id ? 180 : 0,
                          }}
                          transition={{ duration: 0.2 }}
                          className="text-gray-400"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                            />
                          </svg>
                        </motion.div>
                      </div>
                    </div>
                  </div>

                  <AnimatePresence>
                    {expandedStudent === student.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
                        <div className="px-5 pb-5 border-t border-gray-100">
                          <div className="mt-4 grid grid-cols-2 gap-3">
                            <div className="p-3 rounded-lg bg-blue-50/50">
                              <p className="text-xs text-gray-500 font-medium">
                                Course & Year
                              </p>
                              <p className="text-sm font-semibold text-gray-900">
                                {student.request?.student?.course_year || "N/A"}
                              </p>
                            </div>
                            <div className="p-3 rounded-lg bg-blue-50/50">
                              <p className="text-xs text-gray-500 font-medium">
                                Email
                              </p>
                              <p className="text-sm font-semibold text-gray-900 truncate">
                                {student.request?.student?.email || "N/A"}
                              </p>
                            </div>
                          </div>

                          {student.request_id && (
                            <div className="mt-4">
                              <RequestComments
                                requestId={student.request_id}
                                userRole="professor"
                                userId={professorId}
                              />
                            </div>
                          )}

                          {student.status === "pending" && (
                            <div className="mt-4 pt-4 border-t border-gray-100">
                              <p className="text-xs text-gray-500 mb-3 font-medium uppercase tracking-wide">
                                Decision
                              </p>
                              <div className="flex items-center gap-3">
                                <motion.button
                                  whileHover={{ scale: 1.02 }}
                                  whileTap={{ scale: 0.98 }}
                                  onClick={() => handleApprove(student.id)}
                                  disabled={actionLoading}
                                  className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-xl font-medium shadow-lg shadow-green-500/20 hover:shadow-green-500/30 disabled:opacity-50 transition-all text-sm"
                                >
                                  <CheckIcon className="w-4 h-4" />
                                  Approve
                                </motion.button>

                                {selectedRejectId === student.id ? (
                                  <div className="flex-1 flex gap-3 items-start">
                                    <textarea
                                      placeholder="Reason for rejection (required)..."
                                      value={rejectReason}
                                      onChange={(e) =>
                                        setRejectReason(e.target.value)
                                      }
                                      rows={2}
                                      className="flex-1 px-4 py-2.5 rounded-xl border border-red-200 bg-red-50/30 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all resize-none"
                                    />
                                    <div className="flex flex-col gap-2">
                                      <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => handleReject(student.id)}
                                        disabled={actionLoading}
                                        className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-xl font-medium shadow-lg shadow-red-500/20 disabled:opacity-50 transition-all text-sm"
                                      >
                                        <XMarkIcon className="w-4 h-4" />
                                        Confirm
                                      </motion.button>
                                      <button
                                        onClick={() => {
                                          setSelectedRejectId(null);
                                          setRejectReason("");
                                        }}
                                        className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <motion.button
                                    whileHover={{ scale: 1.01 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() =>
                                      setSelectedRejectId(student.id)
                                    }
                                    className="flex items-center gap-2 px-5 py-2.5 text-red-500 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 transition-all text-sm font-medium"
                                  >
                                    <XMarkIcon className="w-4 h-4" />
                                    Reject
                                  </motion.button>
                                )}
                              </div>
                            </div>
                          )}

                          {student.status !== "pending" && student.comments && (
                            <div className="mt-4 p-3 rounded-lg bg-gray-50 text-sm text-gray-600">
                              <div className="flex items-center gap-2 mb-1">
                                <ChatBubbleIcon className="w-4 h-4 text-gray-400" />
                                <span className="font-semibold text-gray-700">
                                  Your decision comment:
                                </span>
                              </div>
                              {student.comments}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
