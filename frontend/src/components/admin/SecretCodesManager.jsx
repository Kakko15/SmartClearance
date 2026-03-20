import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import {
  getSecretCodes,
  createSecretCode,
  toggleSecretCode,
  deleteSecretCode,
} from "../../services/api";

const ROLE_LABELS = {
  signatory: "Signatory",
  librarian: "Librarian",
  cashier: "Cashier",
  registrar: "Registrar",
};

const ROLE_COLORS = {
  signatory: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  librarian: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  cashier: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  registrar: "bg-violet-500/20 text-violet-300 border-violet-500/30",
};

export default function SecretCodesManager({ isDark = true }) {
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const [newCode, setNewCode] = useState({
    role: "signatory",
    description: "",
    maxUses: 50,
    expiresAt: "",
  });

  const loadCodes = async () => {
    try {
      const res = await getSecretCodes();
      if (res.success) setCodes(res.codes);
      else toast.error(res.error || "Failed to load codes");
    } catch {
      toast.error("Failed to connect to server");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCodes();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await createSecretCode(
        newCode.role,
        newCode.description,
        newCode.maxUses,
        newCode.expiresAt || null,
      );
      if (res.success) {
        toast.success(`Code created: ${res.code.code}`);
        setCodes((prev) => [res.code, ...prev]);
        setShowCreate(false);
        setNewCode({
          role: "signatory",
          description: "",
          maxUses: 50,
          expiresAt: "",
        });
      } else {
        toast.error(res.error || "Failed to create code");
      }
    } catch {
      toast.error("Failed to create code");
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (id) => {
    try {
      const res = await toggleSecretCode(id);
      if (res.success) {
        setCodes((prev) => prev.map((c) => (c.id === id ? res.code : c)));
        toast.success(res.code.is_active ? "Code activated" : "Code revoked");
      } else {
        toast.error(res.error || "Failed to update code");
      }
    } catch {
      toast.error("Failed to update code");
    }
  };

  const handleDelete = async (id) => {
    try {
      const res = await deleteSecretCode(id);
      if (res.success) {
        setCodes((prev) => prev.filter((c) => c.id !== id));
        toast.success("Code deleted");
        setConfirmDelete(null);
      } else {
        toast.error(res.error || "Failed to delete code");
      }
    } catch {
      toast.error("Failed to delete code");
    }
  };

  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    toast.success("Code copied to clipboard");
  };

  const isExpired = (expiresAt) =>
    expiresAt && new Date(expiresAt) < new Date();

  const renderSkeleton = () => (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div
            className={`h-8 w-48 rounded-lg ${isDark ? "bg-[#3c4043]" : "bg-gray-200"}`}
          ></div>
          <div
            className={`h-4 w-64 rounded-lg bg-opacity-50 ${isDark ? "bg-[#3c4043]" : "bg-gray-200"}`}
          ></div>
        </div>
        <div
          className={`h-10 w-36 rounded-xl ${isDark ? "bg-[#3c4043]" : "bg-gray-200"}`}
        ></div>
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`p-5 rounded-2xl border ${isDark ? "bg-[#282a2d] border-[#3c4043]" : "bg-white border-gray-200"}`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`h-6 w-32 rounded font-mono ${isDark ? "bg-[#3c4043]" : "bg-gray-200"}`}
                  ></div>
                  <div
                    className={`h-5 w-20 rounded-md ${isDark ? "bg-[#3c4043]" : "bg-gray-200"}`}
                  ></div>
                </div>
                <div className="flex gap-4">
                  <div
                    className={`h-3 w-16 rounded bg-opacity-50 ${isDark ? "bg-[#3c4043]" : "bg-gray-200"}`}
                  ></div>
                  <div
                    className={`h-3 w-24 rounded bg-opacity-50 ${isDark ? "bg-[#3c4043]" : "bg-gray-200"}`}
                  ></div>
                </div>
              </div>
              <div
                className={`h-8 w-20 rounded-lg shrink-0 ${isDark ? "bg-[#3c4043]" : "bg-gray-200"}`}
              ></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  if (loading) {
    return renderSkeleton();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2
            className={`text-2xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}
          >
            Secret Codes
          </h2>
          <p
            className={`text-sm mt-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}
          >
            Generate, manage, and revoke signup codes for staff and signatory
            accounts
          </p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-5 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-semibold text-sm transition-colors flex items-center gap-2"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d={showCreate ? "M6 18L18 6M6 6l12 12" : "M12 4v16m8-8H4"}
            />
          </svg>
          {showCreate ? "Cancel" : "Generate Code"}
        </button>
      </div>

      <AnimatePresence>
        {showCreate && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleCreate}
            className="overflow-hidden"
          >
            <div
              className={`p-6 rounded-2xl border space-y-4 mb-4 ${
                isDark
                  ? "bg-[#282a2d] border-[#3c4043]"
                  : "bg-white border-gray-200 shadow-sm"
              }`}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    className={`block text-sm font-semibold mb-1.5 ${isDark ? "text-slate-300" : "text-gray-700"}`}
                  >
                    Role
                  </label>
                  <select
                    value={newCode.role}
                    onChange={(e) =>
                      setNewCode({ ...newCode, role: e.target.value })
                    }
                    className={`w-full px-4 py-2.5 rounded-xl border outline-none focus:border-indigo-500 transition-colors ${
                      isDark
                        ? "bg-slate-800 border-slate-700 text-white"
                        : "bg-white border-gray-300 text-gray-900"
                    }`}
                  >
                    {Object.entries(ROLE_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    className={`block text-sm font-semibold mb-1.5 ${isDark ? "text-slate-300" : "text-gray-700"}`}
                  >
                    Max Uses
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={newCode.maxUses}
                    onChange={(e) =>
                      setNewCode({
                        ...newCode,
                        maxUses: parseInt(e.target.value) || 1,
                      })
                    }
                    className={`w-full px-4 py-2.5 rounded-xl border outline-none focus:border-indigo-500 transition-colors ${
                      isDark
                        ? "bg-slate-800 border-slate-700 text-white"
                        : "bg-white border-gray-300 text-gray-900"
                    }`}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    className={`block text-sm font-semibold mb-1.5 ${isDark ? "text-slate-300" : "text-gray-700"}`}
                  >
                    Description (optional)
                  </label>
                  <input
                    type="text"
                    value={newCode.description}
                    onChange={(e) =>
                      setNewCode({ ...newCode, description: e.target.value })
                    }
                    placeholder="e.g. Spring 2026 batch"
                    className={`w-full px-4 py-2.5 rounded-xl border outline-none focus:border-indigo-500 transition-colors ${
                      isDark
                        ? "bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                        : "bg-white border-gray-300 text-gray-900 placeholder:text-gray-400"
                    }`}
                  />
                </div>
                <div>
                  <label
                    className={`block text-sm font-semibold mb-1.5 ${isDark ? "text-slate-300" : "text-gray-700"}`}
                  >
                    Expires (optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={newCode.expiresAt}
                    onChange={(e) =>
                      setNewCode({ ...newCode, expiresAt: e.target.value })
                    }
                    className={`w-full px-4 py-2.5 rounded-xl border outline-none focus:border-indigo-500 transition-colors ${
                      isDark
                        ? "bg-slate-800 border-slate-700 text-white"
                        : "bg-white border-gray-300 text-gray-900"
                    }`}
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={creating}
                className="px-6 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-semibold text-sm transition-colors disabled:opacity-50"
              >
                {creating ? "Generating..." : "Generate Code"}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {codes.length === 0 ? (
        <div
          className={`p-12 rounded-2xl border text-center ${isDark ? "bg-white/[0.02] border-white/[0.05]" : "bg-gray-50 border-gray-200"}`}
        >
          <div
            className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${isDark ? "bg-white/5" : "bg-gray-200"}`}
          >
            <svg
              className={`w-8 h-8 ${isDark ? "text-slate-500" : "text-gray-400"}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
              />
            </svg>
          </div>
          <p className={isDark ? "text-slate-400" : "text-gray-500"}>
            No secret codes yet. Generate one to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {codes.map((code) => {
            const expired = isExpired(code.expires_at);
            const maxedOut = code.current_uses >= code.max_uses;
            const inactive = !code.is_active;
            const statusBad = expired || maxedOut || inactive;

            return (
              <motion.div
                key={code.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-5 rounded-2xl border transition-all ${
                  statusBad
                    ? isDark
                      ? "bg-white/[0.01] border-white/[0.04] opacity-60"
                      : "bg-gray-50 border-gray-100 opacity-60"
                    : isDark
                      ? "bg-[#282a2d] border-[#3c4043]"
                      : "bg-white border-gray-200 shadow-sm"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <button
                        onClick={() => copyCode(code.code)}
                        title="Click to copy"
                        className={`font-mono text-base font-bold transition-colors cursor-pointer ${
                          isDark
                            ? "text-white hover:text-indigo-300"
                            : "text-gray-900 hover:text-indigo-600"
                        }`}
                      >
                        {code.code}
                      </button>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${ROLE_COLORS[code.role] || "bg-white/10 text-slate-300 border-white/10"}`}
                      >
                        {ROLE_LABELS[code.role] || code.role}
                      </span>
                      {inactive && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-red-500/20 text-red-300 border border-red-500/30">
                          Revoked
                        </span>
                      )}
                      {expired && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-orange-500/20 text-orange-300 border border-orange-500/30">
                          Expired
                        </span>
                      )}
                      {maxedOut && !expired && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
                          Maxed Out
                        </span>
                      )}
                    </div>
                    <div
                      className={`flex flex-wrap items-center gap-x-4 gap-y-2 text-xs mt-2 sm:mt-0 ${
                        isDark ? "text-slate-400" : "text-gray-500"
                      }`}
                    >
                      {code.description && (
                        <span className="w-full sm:w-auto text-[13px] font-medium block sm:inline">
                          {code.description}
                        </span>
                      )}
                      <span>
                        Uses: {code.current_uses}/{code.max_uses}
                      </span>
                      {code.expires_at && (
                        <span>
                          Expires:{" "}
                          {new Date(code.expires_at).toLocaleDateString()}
                        </span>
                      )}
                      {code.created_at && (
                        <span>
                          Created:{" "}
                          {new Date(code.created_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleToggle(code.id)}
                      title={code.is_active ? "Revoke code" : "Reactivate code"}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        code.is_active
                          ? isDark
                            ? "bg-red-500/10 text-red-500 hover:bg-red-500/20"
                            : "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100"
                          : isDark
                            ? "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"
                            : "bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100"
                      }`}
                    >
                      {code.is_active ? "Revoke" : "Activate"}
                    </button>

                    {confirmDelete === code.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(code.id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500 text-white hover:bg-red-600 transition-colors"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                            isDark
                              ? "bg-white/10 text-slate-300 hover:bg-white/20"
                              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                          }`}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(code.id)}
                        title="Delete code"
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                          isDark
                            ? "bg-white/5 text-slate-400 hover:bg-red-500/10 hover:text-red-400"
                            : "border border-gray-200 bg-white text-gray-600 hover:bg-red-50 hover:border-red-200 hover:text-red-600"
                        }`}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
