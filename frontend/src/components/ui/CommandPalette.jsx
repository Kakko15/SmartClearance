import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

const COMMANDS = [
  { id: "home", label: "Go to Home", icon: "🏠", section: "Navigation", keywords: ["dashboard", "overview"] },
  { id: "status", label: "View Clearance Status", icon: "📋", section: "Navigation", keywords: ["progress", "track"] },
  { id: "notifications", label: "Open Notifications", icon: "🔔", section: "Navigation", keywords: ["alerts", "updates"] },
  { id: "certificate", label: "View Certificate", icon: "🎓", section: "Navigation", keywords: ["graduation", "diploma"] },
  { id: "history", label: "Request History", icon: "📜", section: "Navigation", keywords: ["past", "previous"] },
  { id: "settings", label: "Account Settings", icon: "⚙️", section: "Settings", keywords: ["profile", "account"] },
  { id: "security", label: "Security Settings", icon: "🔒", section: "Settings", keywords: ["password", "2fa"] },
  { id: "theme", label: "Toggle Theme", icon: "🎨", section: "Settings", keywords: ["dark", "light", "mode"] },
  { id: "signout", label: "Sign Out", icon: "🚪", section: "Account", keywords: ["logout", "exit"] },
];

/**
 * Hook to manage Command Palette open/close state with Ctrl+K shortcut.
 */
export function useCommandPalette() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen((prev) => !prev),
  };
}

export default function CommandPalette({ isOpen, onClose, isDark, onAction }) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Filter commands based on search query
  const filtered = useMemo(() => {
    if (!query.trim()) return COMMANDS;
    const q = query.toLowerCase();
    return COMMANDS.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(q) ||
        cmd.id.toLowerCase().includes(q) ||
        cmd.keywords.some((k) => k.includes(q))
    );
  }, [query]);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Clamp selected index
  useEffect(() => {
    setSelectedIndex(0);
  }, [filtered.length]);

  // Scroll selected item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const item = list.children[selectedIndex];
    if (item) item.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const handleSelect = useCallback(
    (cmd) => {
      onAction?.(cmd.id);
      onClose?.();
    },
    [onAction, onClose]
  );

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filtered[selectedIndex]) {
      e.preventDefault();
      handleSelect(filtered[selectedIndex]);
    }
  };

  // Group commands by section
  const sections = useMemo(() => {
    const map = new Map();
    filtered.forEach((cmd) => {
      if (!map.has(cmd.section)) map.set(cmd.section, []);
      map.get(cmd.section).push(cmd);
    });
    return map;
  }, [filtered]);

  // Flat index helper
  let flatIndex = -1;

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[99999] flex items-start justify-center pt-[15vh]"
          onClick={onClose}
          onKeyDown={handleKeyDown}
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />

          {/* Palette */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            className={`relative w-full max-w-[560px] mx-4 rounded-2xl overflow-hidden shadow-2xl border ${
              isDark
                ? "bg-[#292a2d] border-[#3c4043]"
                : "bg-white border-gray-200"
            }`}
            style={{ fontFamily: "'Google Sans', 'Inter', sans-serif" }}
          >
            {/* Search Input */}
            <div
              className={`flex items-center gap-3 px-5 py-4 border-b ${
                isDark ? "border-[#3c4043]" : "border-gray-100"
              }`}
            >
              <svg
                className={`w-5 h-5 flex-shrink-0 ${
                  isDark ? "text-[#9aa0a6]" : "text-gray-400"
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type a command..."
                className={`flex-1 bg-transparent outline-none text-[15px] placeholder:text-[14px] ${
                  isDark
                    ? "text-[#e8eaed] placeholder-[#9aa0a6]"
                    : "text-[#202124] placeholder-gray-400"
                }`}
              />
              <kbd
                className={`hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${
                  isDark
                    ? "bg-[#3c4043] text-[#9aa0a6] border-[#5f6368]"
                    : "bg-gray-50 text-gray-400 border-gray-200"
                }`}
              >
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div
              ref={listRef}
              className="max-h-[320px] overflow-y-auto py-2 scroll-smooth"
            >
              {filtered.length === 0 ? (
                <div
                  className={`px-5 py-8 text-center text-[14px] ${
                    isDark ? "text-[#9aa0a6]" : "text-gray-400"
                  }`}
                >
                  No results found for "{query}"
                </div>
              ) : (
                Array.from(sections.entries()).map(([section, cmds]) => (
                  <div key={section}>
                    <div
                      className={`px-5 pt-3 pb-1.5 text-[11px] font-bold uppercase tracking-wider ${
                        isDark ? "text-[#9aa0a6]" : "text-gray-400"
                      }`}
                    >
                      {section}
                    </div>
                    {cmds.map((cmd) => {
                      flatIndex++;
                      const idx = flatIndex;
                      const isSelected = idx === selectedIndex;
                      return (
                        <button
                          key={cmd.id}
                          onClick={() => handleSelect(cmd)}
                          onMouseEnter={() => setSelectedIndex(idx)}
                          className={`w-full flex items-center gap-3 px-5 py-2.5 text-left transition-colors duration-75 ${
                            isSelected
                              ? isDark
                                ? "bg-[#3c4043]"
                                : "bg-[#f1f3f4]"
                              : ""
                          }`}
                        >
                          <span className="text-[18px] flex-shrink-0 w-7 text-center">
                            {cmd.icon}
                          </span>
                          <span
                            className={`text-[14px] font-medium ${
                              isDark ? "text-[#e8eaed]" : "text-[#202124]"
                            }`}
                          >
                            {cmd.label}
                          </span>
                          {isSelected && (
                            <span
                              className={`ml-auto text-[11px] ${
                                isDark ? "text-[#9aa0a6]" : "text-gray-400"
                              }`}
                            >
                              ↵ Enter
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div
              className={`flex items-center justify-between px-5 py-2.5 border-t text-[11px] ${
                isDark
                  ? "border-[#3c4043] text-[#9aa0a6]"
                  : "border-gray-100 text-gray-400"
              }`}
            >
              <span>
                <kbd className="font-mono">↑↓</kbd> Navigate
                <span className="mx-2">·</span>
                <kbd className="font-mono">↵</kbd> Select
              </span>
              <span>
                <kbd className="font-mono">Ctrl+K</kbd> Toggle
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
