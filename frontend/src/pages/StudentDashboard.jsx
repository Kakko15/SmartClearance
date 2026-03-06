import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  createRequest,
  getStudentRequests,
  resubmitRequest,
  deleteRequest,
} from "../services/api";
import { ConfirmModal } from "../components/ui/Modal";
import Announcements from "../components/features/Announcements";
import RequestHistory from "../components/features/RequestHistory";
import DocumentUpload from "../components/features/DocumentUpload";
import RequestComments from "../components/features/RequestComments";
import CertificateDownload from "../components/features/CertificateDownload";

const MD3_TRANSITION = { ease: [0.2, 0, 0, 1], duration: 0.4 };
const SPRING_TRANSITION = { type: "spring", stiffness: 500, damping: 35 };

const SVGIcons = {
  Menu: (props) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      height="24"
      viewBox="0 -960 960 960"
      width="24"
      fill="currentColor"
      {...props}
    >
      <path d="M120-240v-80h720v80H120Zm0-200v-80h720v80H120Zm0-200v-80h720v80H120Z" />
    </svg>
  ),
  Dashboard: (props) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      height="24"
      viewBox="0 -960 960 960"
      width="24"
      fill="currentColor"
      {...props}
    >
      <path d="M520-600v-240h320v240H520ZM120-440v-400h320v400H120Zm400 320v-400h320v400H520Zm-400 0v-240h320v240H120ZM200-520h160v-240H200v240Zm400 400h160v-240H600v240ZM600-680h160v-80H600v80Zm-400 320h160v-80H200v80Z" />
    </svg>
  ),
  Add: (props) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      height="24"
      viewBox="0 -960 960 960"
      width="24"
      fill="currentColor"
      {...props}
    >
      <path d="M440-440H200v-80h240v-240h80v240h240v80H520v240h-80v-240Z" />
    </svg>
  ),
  List: (props) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      height="24"
      viewBox="0 -960 960 960"
      width="24"
      fill="currentColor"
      {...props}
    >
      <path d="M320-240h480v-80H320v80Zm0-200h480v-80H320v80Zm0-200h480v-80H320v80ZM160-200q-33 0-56.5-23.5T80-280q0-33 23.5-56.5T160-360q33 0 56.5 23.5T240-280q0 33-23.5 56.5T160-200Zm0-200q-33 0-56.5-23.5T80-480q0-33 23.5-56.5T160-560q33 0 56.5 23.5T240-480q0 33-23.5 56.5T160-400Zm0-200q-33 0-56.5-23.5T80-680q0-33 23.5-56.5T160-760q33 0 56.5 23.5T240-680q0 33-23.5 56.5T160-600Z" />
    </svg>
  ),
  History: (props) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      height="24"
      viewBox="0 -960 960 960"
      width="24"
      fill="currentColor"
      {...props}
    >
      <path d="M480-160q-134 0-227-93t-93-227q0-134 93-227t227-93q69 0 132 28.5T720-690v-110h80v280H520v-80h168q-32-56-87.5-88T480-720q-100 0-170 70t-70 170q0 100 70 170t170 70q77 0 139-44t87-116h84q-28 106-114 173t-196 67Zm-40-200 184-184-56-56-128 128v-168h-80v224l80 56Z" />
    </svg>
  ),
  Announcement: (props) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      height="24"
      viewBox="0 -960 960 960"
      width="24"
      fill="currentColor"
      {...props}
    >
      <path d="M160-120v-200H80v-480h800v480H600L400-120v-200H160Zm80-280h200v107L547-400h253v-320H240v320Z" />
    </svg>
  ),
  Certificate: (props) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      height="24"
      viewBox="0 -960 960 960"
      width="24"
      fill="currentColor"
      {...props}
    >
      <path d="M480-480q33 0 56.5-23.5T560-560q0-33-23.5-56.5T480-640q-33 0-56.5 23.5T400-560q0 33 23.5 56.5T480-480Zm0 80q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35ZM240-160q-33 0-56.5-23.5T160-240v-400q0-33 23.5-56.5T240-720h120v80H240v400h480v-400H600v-80h120q33 0 56.5 23.5T800-640v400q0 33-23.5 56.5T720-160H240Zm400-600h-80v-120h-80v120h-80v80h80v120h80v-120h80v-80ZM240-240h480v-400H240v400Zm240-200Z" />
    </svg>
  ),
  Settings: (props) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      height="24"
      viewBox="0 -960 960 960"
      width="24"
      fill="currentColor"
      {...props}
    >
      <path d="m370-80-16-128q-13-5-24.5-12T307-235l-119 50L78-375l103-78q-1-7-1-13.5v-27q0-6.5 1-13.5L78-585l110-190 119 50q11-8 23-15t24-12l16-128h220l16 128q13 5 24.5 12t22.5 15l119-50 110 190-103 78q1 7 1 13.5v27q0 6.5-2 13.5l103 78-110 190-118-50q-11 8-23 15t-24 12L590-80H370Zm70-80h79l14-106q31-8 57.5-23.5T639-327l103 44 40-68-88-65q5-14 7-29t2-31q0-16-2-31t-7-29l88-65-40-68-103 44q-24-19-50.5-35T533-574l-14-106h-79l-14 106q-31 8-57.5 23.5T321-513l-103-44-40 68 88 65q-5 14-7 29t-2 31q0 16 2 31t7 29l-88 65 40 68 103-44q24 19 50.5 35T427-186l14 106Zm40-180q33 0 56.5-23.5T560-420q0-33-23.5-56.5T480-500q-33 0-56.5 23.5T400-420q0 33 23.5 56.5T480-340Zm0-80Z" />
    </svg>
  ),
  More: (props) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      height="24"
      viewBox="0 -960 960 960"
      width="24"
      fill="currentColor"
      {...props}
    >
      <path d="M480-160q-33 0-56.5-23.5T400-240q0-33 23.5-56.5T480-320q33 0 56.5 23.5T560-240q0 33-23.5 56.5T480-160Zm0-240q-33 0-56.5-23.5T400-480q0-33 23.5-56.5T480-560q33 0 56.5 23.5T560-480q0 33-23.5 56.5T480-400Zm0-240q-33 0-56.5-23.5T400-720q0-33 23.5-56.5T480-800q33 0 56.5 23.5T560-720q0 33-23.5 56.5T480-640Z" />
    </svg>
  ),
  Warning: (props) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      height="24"
      viewBox="0 -960 960 960"
      width="24"
      fill="currentColor"
      {...props}
    >
      <path d="M480-280q17 0 28.5-11.5T520-320q0-17-11.5-28.5T480-360q-17 0-28.5 11.5T440-320q0 17 11.5 28.5T480-280Zm-40-160h80v-240h-80v240Zm40 360q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z" />
    </svg>
  ),
  CheckCircle: (props) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      height="24"
      viewBox="0 -960 960 960"
      width="24"
      fill="currentColor"
      {...props}
    >
      <path d="m424-296 282-282-56-56-226 226-114-114-56 56 170 170Zm56 216q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z" />
    </svg>
  ),
};

const MD3Card = ({ children, className = "", noPadding = false }) => (
  <motion.div
    initial={{ opacity: 0, y: 15 }}
    animate={{ opacity: 1, y: 0 }}
    transition={MD3_TRANSITION}
    className={`bg-white rounded-[24px] shadow-sm border border-gray-100 ${noPadding ? "" : "p-6"} ${className}`}
  >
    {children}
  </motion.div>
);

const Button = ({
  children,
  variant = "primary",
  icon,
  onClick,
  disabled,
  className = "",
  type = "button",
}) => {
  const baseStyle =
    "flex items-center justify-center gap-2 px-6 py-2.5 rounded-full font-medium transition-all duration-200 outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";

  const variants = {
    primary:
      "bg-[#146c2e] hover:bg-[#0f5223] text-white shadow-md hover:shadow-lg focus:ring-[#146c2e]",
    secondary:
      "bg-[#e8f5e9] hover:bg-[#c8e6c9] text-[#146c2e] focus:ring-[#c8e6c9]",
    outline:
      "border border-gray-300 hover:bg-gray-50 text-gray-700 focus:ring-gray-200",
    danger:
      "bg-[#fce8e6] hover:bg-[#fad2cf] text-[#b3261e] focus:ring-[#fad2cf]",
  };

  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyle} ${variants[variant]} ${className}`}
    >
      {icon && (
        <span className="w-5 h-5 flex items-center justify-center leading-none">
          {icon}
        </span>
      )}
      {children}
    </motion.button>
  );
};

export default function StudentDashboard({
  studentId,
  studentInfo,
  onSignOut,
  onOpenSettings,
}) {
  const [requests, setRequests] = useState([]);
  const [clearanceTypes] = useState([
    {
      id: 1,
      name: "Graduation Clearance",
      stages: ["library", "cashier", "registrar"],
    },
    {
      id: 2,
      name: "Transfer Clearance",
      stages: ["library", "cashier", "registrar"],
    },
    {
      id: 3,
      name: "Leave of Absence Clearance",
      stages: ["library", "cashier"],
    },
  ]);
  const [selectedClearanceType, setSelectedClearanceType] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState({
    show: false,
    requestId: null,
    requestName: "",
  });
  const [activeView, setActiveView] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    document.title = "Clearance | Workspace";
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const data = await getStudentRequests(studentId);
      if (data && Array.isArray(data)) {
        setRequests(data);
      } else {
        setRequests([]);
      }
    } catch (error) {
      console.error("Error fetching requests:", error);
      setRequests([]);
    }
  };

  const handleCreateRequest = async (e) => {
    e.preventDefault();
    if (!selectedClearanceType) return;

    setLoading(true);
    try {
      const response = await createRequest(studentId, selectedClearanceType);
      if (response.success) {
        setSelectedClearanceType("");
        setActiveView("my-clearances");
        fetchRequests();
        toast.success("Clearance request created seamlessly.");
      } else {
        toast.error(response.error || "Failed to create request.");
      }
    } catch {
      toast.error("Error creating request.");
    } finally {
      setLoading(false);
    }
  };

  const handleResubmit = async (requestId) => {
    setLoading(true);
    try {
      const response = await resubmitRequest(requestId);
      if (response.success) {
        fetchRequests();
        toast.success("Request resubmitted.");
      } else {
        toast.error(response.error || "Failed to resubmit request.");
      }
    } catch {
      toast.error("Error resubmitting request.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (requestId, requestName) => {
    setDeleteConfirm({ show: true, requestId, requestName });
  };

  const confirmDelete = async () => {
    setLoading(true);
    try {
      const response = await deleteRequest(deleteConfirm.requestId);
      if (response.success) {
        fetchRequests();
        toast.success("Request permanently deleted.");
      } else {
        toast.error(response.error || "Failed to delete request.");
      }
    } catch {
      toast.error("Error deleting request.");
    } finally {
      setLoading(false);
      setDeleteConfirm({ show: false, requestId: null, requestName: "" });
    }
  };

  const menuItems = [
    {
      id: "dashboard",
      label: "Home",
      icon: <SVGIcons.Dashboard className="w-6 h-6" />,
    },
    {
      id: "new-clearance",
      label: "New Request",
      icon: <SVGIcons.Add className="w-6 h-6" />,
    },
    {
      id: "my-clearances",
      label: "My Clearances",
      icon: <SVGIcons.List className="w-6 h-6" />,
    },
    {
      id: "history",
      label: "History log",
      icon: <SVGIcons.History className="w-6 h-6" />,
    },
    {
      id: "announcements",
      label: "Announcements",
      icon: <SVGIcons.Announcement className="w-6 h-6" />,
    },
    {
      id: "certificates",
      label: "Certificates",
      icon: <SVGIcons.Certificate className="w-6 h-6" />,
    },
  ];

  return (
    <div className="flex h-screen bg-[#F8FDF9] text-gray-800 font-sans selection:bg-[#c8e6c9] selection:text-[#0f5223]">
      <motion.nav
        initial={false}
        animate={{ width: sidebarOpen ? 280 : 80 }}
        transition={MD3_TRANSITION}
        className="flex flex-col bg-[#F3F6F4] border-r border-gray-200/50 z-20 overflow-hidden relative"
      >
        <div className="flex items-center h-[72px] px-4 shrink-0">
          <motion.button
            whileHover={{ backgroundColor: "rgba(0,0,0,0.05)" }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-3 rounded-full text-gray-700 outline-none"
          >
            <SVGIcons.Menu className="w-6 h-6" />
          </motion.button>

          <AnimatePresence>
            {sidebarOpen && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="ml-4 flex items-center gap-2 overflow-hidden whitespace-nowrap"
              >
                <div className="w-8 h-8 rounded-lg bg-[#146c2e] text-white flex items-center justify-center font-bold text-sm tracking-wider">
                  ISU
                </div>
                <span className="font-medium text-xl text-gray-800 tracking-tight">
                  Clearance
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex-1 px-3 py-4 space-y-1 overflow-x-hidden">
          {menuItems.map((item) => {
            const isActive = activeView === item.id;
            return (
              <motion.button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                whileHover={{
                  backgroundColor: isActive ? "" : "rgba(0,0,0,0.04)",
                }}
                whileTap={{ scale: 0.98 }}
                className={`w-full flex items-center h-14 px-4 rounded-full transition-colors relative outline-none
                  ${isActive ? "text-[#0f5223] font-medium" : "text-gray-700"}
                `}
              >
                {isActive && (
                  <motion.div
                    layoutId="active-pill"
                    className="absolute inset-0 bg-[#c2ead2] rounded-full"
                    transition={SPRING_TRANSITION}
                  />
                )}
                <div
                  className={`relative z-10 flex items-center gap-4 ${!sidebarOpen ? "mx-auto" : ""}`}
                >
                  <span className={`${isActive ? "fill-current" : ""}`}>
                    {item.icon}
                  </span>
                  <AnimatePresence>
                    {sidebarOpen && (
                      <motion.span
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: "auto" }}
                        exit={{ opacity: 0, width: 0 }}
                        className="whitespace-nowrap"
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              </motion.button>
            );
          })}
        </div>
      </motion.nav>

      <div className="flex-1 flex flex-col relative overflow-hidden">
        <header className="h-[72px] bg-[#F8FDF9] flex items-center justify-between px-6 shrink-0 z-10">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-normal text-gray-800 hidden md:block">
              {menuItems.find((m) => m.id === activeView)?.label || "Dashboard"}
            </h1>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <motion.button
              whileHover={{ backgroundColor: "rgba(0,0,0,0.05)" }}
              whileTap={{ scale: 0.95 }}
              onClick={onOpenSettings}
              className="p-2.5 rounded-full text-gray-600 outline-none tooltip-trigger relative"
              title="Settings"
            >
              <SVGIcons.Settings className="w-6 h-6" />
            </motion.button>

            <motion.div
              whileHover={{ backgroundColor: "rgba(0,0,0,0.05)" }}
              className="flex items-center gap-3 pr-2 pl-3 py-1.5 rounded-full border border-gray-200 cursor-pointer transition-colors"
              onClick={onSignOut}
              title="Click to sign out"
            >
              <div className="hidden md:block text-right">
                <p className="text-sm font-medium text-gray-900 leading-tight">
                  {studentInfo?.full_name}
                </p>
                <p className="text-xs text-gray-500">
                  {studentInfo?.student_number}
                </p>
              </div>
              <div className="w-9 h-9 rounded-full bg-[#146c2e] text-white flex items-center justify-center font-bold text-lg">
                {studentInfo?.full_name?.charAt(0) || "S"}
              </div>
            </motion.div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 md:px-8 pb-12 pt-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeView}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={MD3_TRANSITION}
              className="max-w-[1200px] mx-auto"
            >
              {activeView === "dashboard" && (
                <DashboardView studentInfo={studentInfo} requests={requests} />
              )}
              {activeView === "new-clearance" && (
                <NewClearanceView
                  clearanceTypes={clearanceTypes}
                  selectedClearanceType={selectedClearanceType}
                  setSelectedClearanceType={setSelectedClearanceType}
                  handleCreateRequest={handleCreateRequest}
                  loading={loading}
                />
              )}
              {activeView === "my-clearances" && (
                <MyClearancesView
                  requests={requests}
                  studentId={studentId}
                  handleResubmit={handleResubmit}
                  handleDelete={handleDelete}
                  loading={loading}
                />
              )}
              {activeView === "history" && (
                <RequestHistory studentId={studentId} isAdmin={false} />
              )}
              {activeView === "announcements" && (
                <Announcements userRole="student" />
              )}
              {activeView === "certificates" && (
                <CertificatesView requests={requests} studentId={studentId} />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <ConfirmModal
        isOpen={deleteConfirm.show}
        onClose={() =>
          setDeleteConfirm({ show: false, requestId: null, requestName: "" })
        }
        onConfirm={confirmDelete}
        title="Delete Request"
        message={`Are you sure you want to delete "${deleteConfirm.requestName}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />
    </div>
  );
}

function DashboardView({ requests = [] }) {
  const pendingCount = Array.isArray(requests)
    ? requests.filter((r) => !r.is_completed).length
    : 0;
  const completedCount = Array.isArray(requests)
    ? requests.filter((r) => r.is_completed).length
    : 0;
  const totalCount = Array.isArray(requests) ? requests.length : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MD3Card className="flex flex-col bg-[#e8f5e9] border-none">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[#0f5223] font-medium text-sm tracking-wide uppercase">
              All Clearances
            </span>
            <SVGIcons.List className="text-[#146c2e] w-6 h-6" />
          </div>
          <div className="text-[40px] font-normal tracking-tight text-[#0f5223]">
            {totalCount}
          </div>
        </MD3Card>

        <MD3Card className="flex flex-col bg-[#fff8e1] border-none">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[#b28b00] font-medium text-sm tracking-wide uppercase">
              Pending
            </span>
            <SVGIcons.Warning className="text-[#fbc02d] w-6 h-6" />
          </div>
          <div className="text-[40px] font-normal tracking-tight text-[#b28b00]">
            {pendingCount}
          </div>
        </MD3Card>

        <MD3Card className="flex flex-col bg-[#e3f2fd] border-none">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[#004f9e] font-medium text-sm tracking-wide uppercase">
              Completed
            </span>
            <SVGIcons.CheckCircle className="text-[#1976d2] w-6 h-6" />
          </div>
          <div className="text-[40px] font-normal tracking-tight text-[#004f9e]">
            {completedCount}
          </div>
        </MD3Card>
      </div>

      <h2 className="text-xl font-medium text-gray-800 pt-6 px-1">
        Recent Activity
      </h2>

      <MD3Card noPadding className="overflow-hidden">
        {!Array.isArray(requests) || requests.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <SVGIcons.List className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-lg">No clearances yet.</p>
            <p className="text-sm mt-1">
              Start a new clearance request to get started.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {requests.slice(0, 5).map((req, idx) => (
              <motion.div
                key={req.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: idx * 0.05 }}
                className="flex items-center justify-between p-4 px-6 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-medium ${req.is_completed ? "bg-[#1976d2]" : "bg-[#fbc02d]"}`}
                  >
                    {req.document_type?.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {req.document_type}
                    </p>
                    <p className="text-sm text-gray-500">
                      {new Date(req.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
                      req.is_completed
                        ? "bg-[#e3f2fd] text-[#004f9e]"
                        : "bg-[#fff8e1] text-[#b28b00]"
                    }`}
                  >
                    {req.is_completed ? "Completed" : "Pending"}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </MD3Card>
    </div>
  );
}

function NewClearanceView({
  clearanceTypes,
  selectedClearanceType,
  setSelectedClearanceType,
  handleCreateRequest,
  loading,
}) {
  return (
    <div className="max-w-xl mx-auto mt-8">
      <MD3Card className="p-8">
        <div className="mb-8">
          <h2 className="text-2xl font-normal text-gray-900">Create Request</h2>
          <p className="text-gray-600 mt-2">
            Select the type of clearance you wish to apply for.
          </p>
        </div>

        <form onSubmit={handleCreateRequest} className="space-y-8">
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-2 ml-1">
              Clearance Type
            </label>
            <div className="relative">
              <select
                value={selectedClearanceType}
                onChange={(e) => setSelectedClearanceType(e.target.value)}
                className="w-full appearance-none px-4 py-3.5 bg-gray-50 border border-gray-300 text-gray-900 rounded-[16px] focus:outline-none focus:ring-2 focus:ring-[#146c2e] focus:bg-white transition-all duration-200"
                required
              >
                <option value="" disabled>
                  Select an option...
                </option>
                {clearanceTypes.map((type) => (
                  <option key={type.id} value={type.name}>
                    {type.name}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-500">
                <svg
                  className="fill-current h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                >
                  <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-gray-100">
            <Button
              type="submit"
              disabled={loading || !selectedClearanceType}
              icon={!loading && <SVGIcons.Add />}
            >
              {loading ? "Submitting..." : "Submit Request"}
            </Button>
          </div>
        </form>
      </MD3Card>
    </div>
  );
}

function MyClearancesView({
  requests = [],
  studentId,
  handleResubmit,
  handleDelete,
  loading,
}) {
  const requestsArray = Array.isArray(requests) ? requests : [];

  return (
    <div className="space-y-6">
      {requestsArray.length === 0 ? (
        <MD3Card className="p-16 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4 text-gray-400">
            <SVGIcons.List className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-medium text-gray-900 mb-2">
            No clearances found
          </h3>
          <p className="text-gray-500">
            You haven't requested any clearances yet.
          </p>
        </MD3Card>
      ) : (
        <div className="grid gap-6">
          {requestsArray.map((request) => (
            <MD3Card key={request.id} className="p-0 overflow-hidden group">
              <div className="flex items-start justify-between p-6 bg-white border-b border-gray-100">
                <div>
                  <h3 className="text-xl font-normal text-gray-900 group-hover:text-[#146c2e] transition-colors">
                    {request.document_type}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Applied on{" "}
                    {new Date(request.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span
                  className={`px-4 py-1.5 rounded-full text-sm font-medium ${
                    request.is_completed
                      ? "bg-[#e8f5e9] text-[#146c2e]"
                      : "bg-[#fff8e1] text-[#b28b00]"
                  }`}
                >
                  {request.is_completed ? "Completed" : "Pending Progress"}
                </span>
              </div>

              <div className="p-6 bg-[#fafafd] space-y-6">
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                  <DocumentUpload requestId={request.id} userId={studentId} />
                </div>

                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                  <RequestComments
                    requestId={request.id}
                    userId={studentId}
                    userRole="student"
                  />
                </div>

                {request.is_completed && (
                  <div className="bg-[#e8f5e9] rounded-2xl p-4 border border-[#c8e6c9]">
                    <CertificateDownload
                      requestId={request.id}
                      userId={studentId}
                    />
                  </div>
                )}

                {!request.is_completed && (
                  <div className="flex gap-3 pt-4 border-t border-gray-200 justify-end">
                    <Button
                      variant="outline"
                      onClick={() => handleResubmit(request.id)}
                      disabled={loading}
                    >
                      Resubmit
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() =>
                        handleDelete(request.id, request.document_type)
                      }
                      disabled={loading}
                    >
                      Cancel Request
                    </Button>
                  </div>
                )}
              </div>
            </MD3Card>
          ))}
        </div>
      )}
    </div>
  );
}

function CertificatesView({ requests = [], studentId }) {
  const requestsArray = Array.isArray(requests) ? requests : [];
  const completedRequests = requestsArray.filter((r) => r.is_completed);

  return (
    <div className="space-y-6">
      {completedRequests.length === 0 ? (
        <MD3Card className="p-16 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4 text-gray-400">
            <SVGIcons.Certificate className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-medium text-gray-900 mb-2">
            No certificates available
          </h3>
          <p className="text-gray-500">
            Complete a clearance request to receive a certificate.
          </p>
        </MD3Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {completedRequests.map((request) => (
            <MD3Card
              key={request.id}
              className="flex flex-col items-center p-8 text-center hover:shadow-md transition-shadow"
            >
              <div className="w-16 h-16 bg-[#e8f5e9] text-[#146c2e] rounded-full flex items-center justify-center mb-6">
                <SVGIcons.Certificate className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {request.document_type}
              </h3>
              <div className="mt-auto w-full">
                <CertificateDownload
                  requestId={request.id}
                  userId={studentId}
                />
              </div>
            </MD3Card>
          ))}
        </div>
      )}
    </div>
  );
}
