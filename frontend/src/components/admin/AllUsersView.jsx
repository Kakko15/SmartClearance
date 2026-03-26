import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { authAxios } from "../../services/api";
import useRealtimeSubscription from "../../hooks/useRealtimeSubscription";

const CustomSelect = ({ value, onChange, options, isDark }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption =
    options.find((opt) => opt.value === value) || options[0];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between gap-3 min-w-[140px] h-11 px-4 rounded-xl border text-sm outline-none font-medium transition-colors ${
          isDark
            ? "bg-[#282a2d] border-[#3c4043] text-white hover:border-indigo-500"
            : "bg-white border-gray-300 text-gray-700 hover:border-indigo-500"
        } ${isOpen ? "ring-2 ring-indigo-500/20 border-indigo-500" : ""}`}
      >
        <span>{selectedOption.label}</span>
        <svg
          className={`w-4 h-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""} ${isDark ? "text-slate-400" : "text-gray-500"}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className={`absolute z-50 right-0 min-w-full mt-2 rounded-xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] border overflow-hidden ${
              isDark
                ? "bg-[#303236] border-[#3c4043]"
                : "bg-white border-gray-200"
            }`}
          >
            <div className="py-1">
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                    value === option.value
                      ? isDark
                        ? "bg-indigo-500/20 text-indigo-400"
                        : "bg-indigo-50 text-indigo-700"
                      : isDark
                        ? "text-slate-300 hover:bg-[#3c4043]"
                        : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <span
                    className={
                      value === option.value
                        ? "font-semibold"
                        : "font-medium whitespace-nowrap"
                    }
                  >
                    {option.label}
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default function AllUsersView({ adminId, isDark = false }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, roleFilter, statusFilter]);

  const fetchUsers = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await authAxios.get("/admin/all-users");
      if (response.data.success) {
        setUsers(response.data.users);
      }
    } catch (error) {
      console.error("Error fetching all users:", error);
      if (!silent) toast.error("Failed to load user data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useRealtimeSubscription("profiles", () => fetchUsers(true));

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        (user.full_name || "").toLowerCase().includes(q) ||
        (user.email || "").toLowerCase().includes(q) ||
        (user.student_number || "").toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (roleFilter === "students" && user.role !== "student") return false;
      if (roleFilter === "staff" && user.role === "student") return false;

      if (statusFilter !== "all" && user.verification_status !== statusFilter)
        return false;

      return true;
    });
  }, [users, searchQuery, roleFilter, statusFilter]);

  const totalUsersCount = users.length;
  const staffCount = users.filter((u) => u.role !== "student").length;
  const studentCount = users.filter((u) => u.role === "student").length;

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedUsers = filteredUsers.slice(
    startIndex,
    startIndex + itemsPerPage,
  );

  const getRoleBadge = (role) => {
    const map = {
      super_admin: {
        label: "Super Admin",
        color: "bg-purple-500/20 text-purple-400 border-purple-500/30",
      },
      librarian: {
        label: "Librarian",
        color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
      },
      cashier: {
        label: "Cashier",
        color: "bg-amber-500/20 text-amber-500 border-amber-500/30",
      },
      registrar: {
        label: "Registrar",
        color: "bg-violet-500/20 text-violet-400 border-violet-500/30",
      },
      signatory: {
        label: "Signatory",
        color: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      },
      student: {
        label: "Student",
        color: "bg-gray-500/20 text-gray-400 border-gray-500/30",
      },
    };
    const mapped = map[role] || {
      label: role,
      color: "bg-gray-500/20 text-gray-400 border-gray-500/30",
    };

    return (
      <span
        className={`px-2.5 py-1 text-[10px] uppercase font-bold tracking-wider rounded-md border ${mapped.color}`}
      >
        {mapped.label}
      </span>
    );
  };

  const getStatusBadge = (status) => {
    const s =
      {
        approved: "bg-green-500/10 text-green-500 border-green-500/20",
        pending_review: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
        auto_approved:
          "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
        rejected: "bg-red-500/10 text-red-500 border-red-500/20",
      }[status] || "bg-gray-500/10 text-gray-400 border-gray-500/20";

    const label = status ? status.replace(/_/g, " ") : "Unknown";

    return (
      <span
        className={`px-2 py-0.5 rounded text-[11px] font-semibold capitalize border ${s}`}
      >
        {label}
      </span>
    );
  };

  const renderSkeleton = () => (
    <div className="space-y-6 max-w-7xl mx-auto animate-pulse">
      {}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="space-y-2">
          <div
            className={`h-8 w-48 rounded-lg ${isDark ? "bg-[#3c4043]" : "bg-gray-200"}`}
          ></div>
          <div
            className={`h-4 w-64 rounded-lg ${isDark ? "bg-[#3c4043]" : "bg-gray-200"}`}
          ></div>
        </div>
      </div>

      {}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2].map((i) => (
          <div
            key={i}
            className={`h-24 rounded-2xl border ${isDark ? "bg-[#282a2d] border-[#3c4043]" : "bg-white border-gray-200"}`}
          ></div>
        ))}
      </div>

      {}
      <div
        className={`h-20 rounded-2xl border ${isDark ? "bg-[#282a2d] border-[#3c4043]" : "bg-white border-gray-200"}`}
      ></div>

      {}
      <div
        className={`rounded-2xl border overflow-hidden ${isDark ? "bg-[#282a2d] border-[#3c4043]" : "bg-white border-gray-200"}`}
      >
        <div
          className={`h-12 border-b ${isDark ? "border-[#3c4043] bg-white/[0.02]" : "border-gray-200 bg-gray-50"}`}
        ></div>
        <div
          className={`divide-y ${isDark ? "divide-[#3c4043]" : "divide-gray-100"}`}
        >
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center p-6 gap-6">
              <div
                className={`w-10 h-10 rounded-full shrink-0 ${isDark ? "bg-[#3c4043]" : "bg-gray-200"}`}
              ></div>
              <div className="flex-1 space-y-2">
                <div
                  className={`h-4 w-32 rounded bg-opacity-50 ${isDark ? "bg-[#3c4043]" : "bg-gray-200"}`}
                ></div>
                <div
                  className={`h-3 w-48 rounded bg-opacity-50 ${isDark ? "bg-[#3c4043]" : "bg-gray-200"}`}
                ></div>
              </div>
              <div
                className={`h-6 w-20 rounded-md shrink-0 ${isDark ? "bg-[#3c4043]" : "bg-gray-200"}`}
              ></div>
              <div
                className={`h-6 w-24 rounded-md shrink-0 ${isDark ? "bg-[#3c4043]" : "bg-gray-200"}`}
              ></div>
              <div
                className={`hidden md:block h-8 w-24 rounded shrink-0 ${isDark ? "bg-[#3c4043]" : "bg-gray-200"}`}
              ></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  if (loading) {
    return renderSkeleton();
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2
            className={`text-2xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}
          >
            All Platform Users
          </h2>
          <p
            className={`text-sm mt-1 ${isDark ? "text-slate-400" : "text-gray-500"}`}
          >
            Manage and view a complete list of {totalUsersCount} registered
            students and staff.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          className={`p-5 rounded-2xl border flex items-center gap-4 ${isDark ? "bg-[#282a2d] border-[#3c4043]" : "bg-white border-gray-200 shadow-sm"}`}
        >
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center ${isDark ? "bg-indigo-500/20" : "bg-indigo-100"}`}
          >
            <svg
              className={`w-6 h-6 ${isDark ? "text-indigo-400" : "text-indigo-600"}`}
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
          <div>
            <h3
              className={`text-2xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}
            >
              {studentCount}
            </h3>
            <p
              className={`text-xs uppercase font-bold tracking-widest ${isDark ? "text-slate-500" : "text-gray-500"}`}
            >
              Students
            </p>
          </div>
        </div>
        <div
          className={`p-5 rounded-2xl border flex items-center gap-4 ${isDark ? "bg-[#282a2d] border-[#3c4043]" : "bg-white border-gray-200 shadow-sm"}`}
        >
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center ${isDark ? "bg-emerald-500/20" : "bg-emerald-100"}`}
          >
            <svg
              className={`w-6 h-6 ${isDark ? "text-emerald-400" : "text-emerald-600"}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </div>
          <div>
            <h3
              className={`text-2xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}
            >
              {staffCount}
            </h3>
            <p
              className={`text-xs uppercase font-bold tracking-widest ${isDark ? "text-slate-500" : "text-gray-500"}`}
            >
              Staff Members
            </p>
          </div>
        </div>
      </div>

      <div
        className={`p-4 rounded-2xl border ${isDark ? "bg-[#282a2d] border-[#3c4043]" : "bg-white border-gray-200 shadow-sm"}`}
      >
        <div className="flex flex-col md:flex-row gap-4 justify-between">
          <div className="flex-1 relative">
            <svg
              className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? "text-slate-500" : "text-gray-400"}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search by name, email, or student #"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm outline-none transition-colors ${
                isDark
                  ? "bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:border-indigo-500"
                  : "bg-gray-50 border-gray-300 text-gray-900 placeholder:text-gray-500 focus:border-indigo-500 focus:bg-white"
              }`}
            />
          </div>
          <div className="flex gap-2">
            <CustomSelect
              value={roleFilter}
              onChange={setRoleFilter}
              isDark={isDark}
              options={[
                { value: "all", label: "All Roles" },
                { value: "students", label: "Students Only" },
                { value: "staff", label: "Staff Only" },
              ]}
            />
            <CustomSelect
              value={statusFilter}
              onChange={setStatusFilter}
              isDark={isDark}
              options={[
                { value: "all", label: "Any Status" },
                { value: "approved", label: "Approved" },
                { value: "pending_review", label: "Pending" },
                { value: "rejected", label: "Rejected" },
              ]}
            />
          </div>
        </div>
      </div>

      <div
        className={`rounded-2xl border overflow-hidden ${isDark ? "bg-[#282a2d] border-[#3c4043]" : "bg-white border-gray-200 shadow-sm"}`}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr
                className={`text-xs uppercase tracking-wider font-semibold border-b ${isDark ? "text-slate-400 border-[#3c4043] bg-white/[0.02]" : "text-gray-500 border-gray-200 bg-gray-50"}`}
              >
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Course / details</th>
                <th className="px-6 py-4">Joined</th>
              </tr>
            </thead>
            <tbody
              className={`divide-y ${isDark ? "divide-[#3c4043]" : "divide-gray-100"}`}
            >
              {paginatedUsers.length === 0 ? (
                <tr>
                  <td
                    colSpan="5"
                    className={`px-6 py-8 text-center text-sm ${isDark ? "text-slate-500" : "text-gray-500"}`}
                  >
                    No users match your filters.
                  </td>
                </tr>
              ) : (
                <AnimatePresence>
                  {paginatedUsers.map((user) => (
                    <motion.tr
                      key={user.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className={`transition-colors ${isDark ? "hover:bg-white/[0.02]" : "hover:bg-gray-50"}`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isDark ? "bg-slate-800 text-slate-300 border border-slate-700" : "bg-blue-50 text-blue-600 border border-blue-100"}`}
                          >
                            {user.full_name?.charAt(0) || "?"}
                          </div>
                          <div className="min-w-0">
                            <p
                              className={`text-sm font-bold truncate ${isDark ? "text-white" : "text-gray-900"}`}
                            >
                              {user.full_name || "Unknown User"}
                            </p>
                            <p
                              className={`text-xs truncate max-w-[200px] ${isDark ? "text-slate-400" : "text-gray-500"}`}
                            >
                              {user.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getRoleBadge(user.role)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {getStatusBadge(user.verification_status)}
                      </td>
                      <td className="px-6 py-4">
                        <div
                          className={`text-xs ${isDark ? "text-slate-300" : "text-gray-700"}`}
                        >
                          {user.role === "student" ? (
                            <>
                              <span className="font-semibold">
                                {user.student_number || "No ID"}
                              </span>
                              <span
                                className={`block mt-0.5 ${isDark ? "text-slate-500" : "text-gray-500"}`}
                              >
                                {user.course_year || "-"}
                              </span>
                            </>
                          ) : (
                            <span
                              className={
                                isDark ? "text-slate-500" : "text-gray-500"
                              }
                            >
                              Staff Account
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div
                          className={`text-xs ${isDark ? "text-slate-400" : "text-gray-500"}`}
                        >
                          {user.created_at
                            ? new Date(user.created_at).toLocaleDateString(
                                "en-US",
                                {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                },
                              )
                            : "-"}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              )}
            </tbody>
          </table>
        </div>

        {}
        {totalPages > 1 && (
          <div
            className={`px-6 py-4 border-t flex flex-col sm:flex-row items-center justify-between gap-4 ${isDark ? "border-[#3c4043] bg-white/[0.02]" : "border-gray-200 bg-gray-50"}`}
          >
            <p
              className={`text-sm ${isDark ? "text-slate-400" : "text-gray-500"}`}
            >
              Showing <span className="font-medium">{startIndex + 1}</span> to{" "}
              <span className="font-medium">
                {Math.min(startIndex + itemsPerPage, filteredUsers.length)}
              </span>{" "}
              of <span className="font-medium">{filteredUsers.length}</span>{" "}
              results
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  isDark
                    ? "bg-[#3c4043]/50 text-white hover:bg-[#3c4043] border border-[#3c4043]"
                    : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200 shadow-sm"
                }`}
              >
                Previous
              </button>
              <div className="hidden sm:flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (page) => {
                    const isFirst = page === 1;
                    const isLast = page === totalPages;
                    const isWithinRange =
                      page >= currentPage - 1 && page <= currentPage + 1;

                    if (isFirst || isLast || isWithinRange) {
                      return (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-medium transition-colors ${
                            currentPage === page
                              ? isDark
                                ? "bg-indigo-500 text-white"
                                : "bg-indigo-600 text-white"
                              : isDark
                                ? "text-slate-400 hover:bg-[#3c4043]"
                                : "text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          {page}
                        </button>
                      );
                    }
                    if (page === currentPage - 2 || page === currentPage + 2) {
                      return (
                        <span
                          key={page}
                          className={`px-1 text-sm ${isDark ? "text-slate-500" : "text-gray-400"}`}
                        >
                          ...
                        </span>
                      );
                    }
                    return null;
                  },
                )}
              </div>
              <button
                onClick={() =>
                  setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                }
                disabled={currentPage === totalPages}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  isDark
                    ? "bg-[#3c4043]/50 text-white hover:bg-[#3c4043] border border-[#3c4043]"
                    : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200 shadow-sm"
                }`}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
