import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
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
import { authAxios } from "../services/api";

export default function ProfessorDashboard({
  professorId,
  professorInfo,
  onSignOut,
  onOpenSettings,
  onManageAccount,
  isDarkMode = false,
  toggleTheme,
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
      const response = await authAxios.get(
        `graduation/professor/students/${professorId}`,
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
      const response = await authAxios.post(
        `graduation/professor/approve`,
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
      const response = await authAxios.post(
        `graduation/professor/reject`,
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

  /**
   * Detect whether a student record is missing (deleted from DB).
   * When a profile row is removed, the Supabase join returns null
   * for the nested student object.
   */
  const isDeletedStudent = (s) => !s.request?.student;

  const getStudentName = (s) =>
    s.request?.student?.full_name || "Deleted Account";
  const getStudentInitial = (s) =>
    s.request?.student?.full_name?.charAt(0) || "?";
  const getStudentNumber = (s) =>
    s.request?.student?.student_number || "";
  const getStudentCourse = (s) =>
    s.request?.student?.course_year || "N/A";
  const getStudentEmail = (s) =>
    s.request?.student?.email || "N/A";

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
      userInfo={{ name: professorInfo?.full_name, subtitle: "Signatory" }}
      onSignOut={onSignOut}
      onOpenSettings={onOpenSettings}
      onManageAccount={onManageAccount}
      toggleTheme={toggleTheme}
      isDarkMode={isDarkMode}
    >
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div>
            <h2
              className={`text-[28px] leading-tight font-medium tracking-tight ${
                isDarkMode ? "text-[#e8eaed]" : "text-[#202124]"
              }`}
              style={{ fontFamily: 'Google Sans, sans-serif' }}
            >
              {activeView === "pending"
                ? "Pending Approvals"
                : activeView === "approved"
                  ? "Approved Requests"
                  : "Rejected Requests"}
            </h2>
            <p
              className={`text-[15px] mt-1 ${
                isDarkMode ? "text-[#9aa0a6]" : "text-[#5f6368]"
              }`}
            >
              Review and manage student graduation clearance requests
            </p>
          </div>
          <div className="flex items-center gap-3">
            {[
              {
                label: "Pending",
                value: pendingStudents.length,
                color: isDarkMode
                  ? "text-[#fde293] bg-[#422c00]/30 border-[#422c00]"
                  : "text-[#b06000] bg-[#fef7e0]/70 border-[#fef7e0]",
              },
              {
                label: "Approved",
                value: approvedStudents.length,
                color: isDarkMode
                  ? "text-[#81c995] bg-[#0d3b16]/30 border-[#0d3b16]"
                  : "text-[#137333] bg-[#e6f4ea]/70 border-[#e6f4ea]",
              },
              {
                label: "Rejected",
                value: rejectedStudents.length,
                color: isDarkMode
                  ? "text-[#f28b82] bg-[#5c1010]/30 border-[#5c1010]"
                  : "text-[#c5221f] bg-[#fce8e6]/70 border-[#fce8e6]",
              },
            ].map((stat) => (
              <motion.div
                whileHover={{ y: -2 }}
                key={stat.label}
                className={`min-w-[90px] px-4 py-3 rounded-[16px] border text-center flex flex-col items-center justify-center transition-all duration-300 ${stat.color}`}
              >
                <div className="text-[22px] font-medium leading-none mb-1" style={{ fontFamily: 'Google Sans, sans-serif' }}>
                  {stat.value}
                </div>
                <div className="text-[12px] font-medium tracking-wide">
                  {stat.label}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <GlassCard key={i} className="overflow-hidden border-none shadow-[0_1px_2px_0_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)] rounded-[20px] mb-2" isDark={isDarkMode}>
                <div className={`p-4 sm:p-5 transition-colors duration-200 ${isDarkMode ? "bg-[#3c4043]/10" : "bg-[#f8f9fa]"}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-full animate-pulse ${isDarkMode ? 'bg-[#3c4043]' : 'bg-[#e8f0fe]'}`} />
                      <div>
                        <div className={`h-4 w-40 rounded mb-2 animate-pulse ${isDarkMode ? 'bg-[#3c4043]' : 'bg-[#e8f0fe]'}`} />
                        <div className={`h-3 w-24 rounded animate-pulse ${isDarkMode ? 'bg-[#3c4043]' : 'bg-[#e8f0fe]'}`} />
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className={`hidden sm:block h-6 w-24 rounded-full animate-pulse ${isDarkMode ? 'bg-[#3c4043]' : 'bg-[#e8f0fe]'}`} />
                      <div className={`w-8 h-8 rounded-full animate-pulse ${isDarkMode ? 'bg-[#3c4043]' : 'bg-[#e8f0fe]'}`} />
                    </div>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        ) : displayStudents.length === 0 ? (
          <GlassCard className="p-12 text-center" isDark={isDarkMode}>
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5 ${
                isDarkMode ? "bg-[#3c4043]/40" : "bg-[#f1f3f4]"
              }`}
            >
              <InboxStackIcon className={`w-10 h-10 ${isDarkMode ? "text-[#8ab4f8]" : "text-[#1a73e8]"}`} />
            </motion.div>
            <h3 className={`text-[20px] font-medium mb-2 ${isDarkMode ? "text-[#e8eaed]" : "text-[#202124]"}`} style={{ fontFamily: 'Google Sans, sans-serif' }}>
              No {activeView} requests
            </h3>
            <p className={`text-[15px] ${isDarkMode ? "text-[#9aa0a6]" : "text-[#5f6368]"}`}>
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
                <GlassCard className="overflow-hidden border-none shadow-[0_1px_2px_0_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)] hover:shadow-[0_1px_3px_0_rgba(60,64,67,0.3),0_4px_8px_3px_rgba(60,64,67,0.15)] transition-shadow duration-300 rounded-[20px] mb-2" isDark={isDarkMode}>
                  <div
                    className={`p-4 sm:p-5 cursor-pointer transition-colors duration-200 ${
                      isDarkMode ? "hover:bg-[#3c4043]/40" : "hover:bg-[#f8f9fa]"
                    }`}
                    onClick={() =>
                      setExpandedStudent(
                        expandedStudent === student.id ? null : student.id,
                      )
                    }
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-medium text-[18px] flex-shrink-0 ${
                          isDeletedStudent(student)
                            ? (isDarkMode ? "bg-[#3c4043] text-[#9aa0a6]" : "bg-[#f1f3f4] text-[#9aa0a6]")
                            : (isDarkMode ? "bg-[#8ab4f8]/20 text-[#8ab4f8]" : "bg-[#e8f0fe] text-[#1a73e8]")
                        }`}>
                          {isDeletedStudent(student) ? (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                              <circle cx="9" cy="7" r="4" />
                              <line x1="17" y1="11" x2="22" y2="11" />
                            </svg>
                          ) : (
                            getStudentInitial(student)
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className={`font-medium text-[16px] leading-tight ${
                              isDeletedStudent(student)
                                ? (isDarkMode ? "text-[#9aa0a6]" : "text-[#9aa0a6]")
                                : (isDarkMode ? "text-[#e8eaed]" : "text-[#202124]")
                            }`} style={{ fontFamily: 'Google Sans, sans-serif' }}>
                              {getStudentName(student)}
                            </h3>
                            {isDeletedStudent(student) && (
                              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                                isDarkMode ? "bg-[#3c4043] text-[#f28b82]" : "bg-[#fce8e6] text-[#c5221f]"
                              }`}>
                                Removed
                              </span>
                            )}
                          </div>
                          <p className={`text-[13px] mt-0.5 ${isDarkMode ? "text-[#9aa0a6]" : "text-[#5f6368]"}`}>
                            {getStudentNumber(student)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="hidden sm:block">
                          <StatusBadge status={student.status} isDark={isDarkMode} />
                        </div>
                        <motion.div
                          animate={{
                            rotate: expandedStudent === student.id ? 180 : 0,
                          }}
                          transition={{ duration: 0.2, ease: "easeInOut" }}
                          className={`flex items-center justify-center w-8 h-8 rounded-full ${
                            isDarkMode ? "text-[#9aa0a6] hover:bg-[#3c4043] hover:text-[#e8eaed]" : "text-[#5f6368] hover:bg-[#f1f3f4] hover:text-[#202124]"
                          }`}
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="transition-colors">
                            <path d="M7 10l5 5 5-5H7z" fill="currentColor"/>
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
                        <div className={`px-4 sm:px-5 pb-5 border-t ${isDarkMode ? "border-[#3c4043]" : "border-[#dadce0]"}`}>
                          {isDeletedStudent(student) ? (
                            <div className={`mt-4 flex items-center gap-3 p-4 rounded-[16px] ${
                              isDarkMode ? "bg-[#3c4043]/30 text-[#9aa0a6]" : "bg-[#f8f9fa] text-[#5f6368]"
                            }`}>
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="8" x2="12" y2="12" />
                                <line x1="12" y1="16" x2="12.01" y2="16" />
                              </svg>
                              <p className="text-[14px]">
                                This student's account has been removed from the system. The approval record is preserved for audit purposes.
                              </p>
                            </div>
                          ) : (
                          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className={`p-4 rounded-[16px] ${isDarkMode ? "bg-[#3c4043]/30" : "bg-[#f8f9fa]"}`}>
                              <p className={`text-[12px] font-medium tracking-wide ${isDarkMode ? "text-[#9aa0a6]" : "text-[#5f6368]"}`}>
                                Course & Year
                              </p>
                              <p className={`text-[15px] font-medium mt-1 ${isDarkMode ? "text-[#e8eaed]" : "text-[#202124]"}`}>
                                {getStudentCourse(student)}
                              </p>
                            </div>
                            <div className={`p-4 rounded-[16px] ${isDarkMode ? "bg-[#3c4043]/30" : "bg-[#f8f9fa]"}`}>
                              <p className={`text-[12px] font-medium tracking-wide ${isDarkMode ? "text-[#9aa0a6]" : "text-[#5f6368]"}`}>
                                Email
                              </p>
                              <p className={`text-[15px] font-medium mt-1 truncate ${isDarkMode ? "text-[#e8eaed]" : "text-[#202124]"}`}>
                                {getStudentEmail(student)}
                              </p>
                            </div>
                          </div>
                          )}

                          {student.request_id && (
                            <div className="mt-5">
                              <RequestComments
                                requestId={student.request_id}
                                userRole="signatory"
                                userId={professorId}
                                isDarkMode={isDarkMode}
                              />
                            </div>
                          )}

                              {student.status === "pending" && (
                                <div className={`mt-5 pt-5 border-t ${isDarkMode ? "border-[#3c4043]" : "border-[#dadce0]"}`}>
                                  <p className={`text-[11px] mb-3 font-semibold uppercase tracking-wider ${isDarkMode ? "text-[#9aa0a6]" : "text-[#5f6368]"}`}>
                                    Decision
                                  </p>
                                  {student.is_locked ? (
                                    <div className={`flex items-center gap-3 px-4 py-3.5 rounded-[12px] border text-[14px] font-medium ${
                                      isDarkMode ? "bg-[#3c4043]/50 text-[#9aa0a6] border-[#3c4043]" : "bg-[#f8f9fa] text-[#5f6368] border-[#dadce0]"
                                    }`}>
                                      <ClockIcon className="w-5 h-5 flex-shrink-0" />
                                      <span>Waiting for previous clearance approvals...</span>
                                    </div>
                                  ) : (
                                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                                      <motion.button
                                        whileHover={{ scale: 1.01 }}
                                        whileTap={{ scale: 0.99 }}
                                        onClick={() => handleApprove(student.id)}
                                        disabled={actionLoading}
                                        className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-full font-medium transition-colors disabled:opacity-50 text-[14px] ${
                                          isDarkMode ? "bg-[#81c995] text-[#0d3b16] hover:bg-[#81c995]/90" : "bg-[#137333] text-white hover:bg-[#137333]/90"
                                        }`}
                                      >
                                        <CheckIcon className="w-4 h-4" />
                                        Approve
                                      </motion.button>

                                      <div className="flex-1">
                                        {selectedRejectId === student.id ? (
                                          <div className="flex flex-col sm:flex-row gap-3 w-full items-start sm:items-center">
                                            <textarea
                                              placeholder="Reason for rejection (required)..."
                                              value={rejectReason}
                                              onChange={(e) =>
                                                setRejectReason(e.target.value)
                                              }
                                              rows={1}
                                              className={`flex-1 w-full px-4 py-2.5 rounded-[12px] border text-[14px] focus:outline-none transition-shadow resize-none ${
                                                isDarkMode 
                                                  ? "bg-[#202124] border-[#d93025] text-[#e8eaed] focus:shadow-[inset_0_0_0_1px_#f28b82] border-opacity-50" 
                                                  : "bg-white border-[#d93025] text-[#202124] focus:shadow-[inset_0_0_0_1px_#c5221f]"
                                              }`}
                                            />
                                            <div className="flex gap-2 flex-shrink-0 w-full sm:w-auto">
                                              <motion.button
                                                whileHover={{ scale: 1.01 }}
                                                whileTap={{ scale: 0.99 }}
                                                onClick={() => handleReject(student.id)}
                                                disabled={actionLoading}
                                                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-full font-medium transition-colors disabled:opacity-50 text-[14px] ${
                                                  isDarkMode ? "bg-[#f28b82] text-[#5c1010] hover:bg-[#f28b82]/90" : "bg-[#c5221f] text-white hover:bg-[#c5221f]/90"
                                                }`}
                                              >
                                                Confirm
                                              </motion.button>
                                              <button
                                                onClick={() => {
                                                  setSelectedRejectId(null);
                                                  setRejectReason("");
                                                }}
                                                className={`flex items-center justify-center px-4 py-2 rounded-full text-[14px] font-medium transition-colors ${
                                                  isDarkMode ? "text-[#9aa0a6] hover:bg-[#3c4043]" : "text-[#5f6368] hover:bg-[#f1f3f4]"
                                                }`}
                                              >
                                                Cancel
                                              </button>
                                            </div>
                                          </div>
                                        ) : (
                                          <motion.button
                                            whileHover={{ scale: 1.01 }}
                                            whileTap={{ scale: 0.99 }}
                                            onClick={() =>
                                              setSelectedRejectId(student.id)
                                            }
                                            className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-full border transition-colors text-[14px] font-medium ${
                                              isDarkMode ? "border-[#f28b82] text-[#f28b82] hover:bg-[#f28b82]/10" : "border-[#c5221f] text-[#c5221f] hover:bg-[#c5221f]/5"
                                            }`}
                                          >
                                            <XMarkIcon className="w-4 h-4" />
                                            Reject
                                          </motion.button>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}

                            {student.status !== "pending" && student.comments && (
                              <div className={`mt-5 p-4 rounded-[16px] text-[14px] ${
                                isDarkMode ? "bg-[#3c4043]/30 text-[#e8eaed]" : "bg-[#f8f9fa] text-[#202124]"
                              }`}>
                                <div className="flex items-center gap-2 mb-2">
                                  <ChatBubbleIcon className={`w-4 h-4 ${isDarkMode ? "text-[#9aa0a6]" : "text-[#5f6368]"}`} />
                                  <span className="font-semibold" style={{ fontFamily: 'Google Sans, sans-serif' }}>
                                    Your decision comment:
                                  </span>
                                </div>
                                <p className="leading-relaxed whitespace-pre-wrap">{student.comments}</p>
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
