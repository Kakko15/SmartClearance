import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function CustomSelect({
  value,
  onChange,
  options,
  error,
  isDark,
  placeholder,
  searchable = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef(null);
  const clearTimerRef = useRef(null);

  const findLabel = (opts, val) => {
    for (const opt of opts) {
      if (opt.options) {
        const found = findLabel(opt.options, val);
        if (found) return found;
      } else if (opt.value === val) {
        return opt.label;
      }
    }
    return null;
  };

  const selectedLabel = findLabel(options, value) || value || placeholder;

  const filterOptions = (opts, query) => {
    if (!query) return opts;
    const q = query.toLowerCase();

    return opts
      .map((opt) => {
        if (opt.options) {
          const filtered = opt.options.filter((sub) =>
            sub.label.toLowerCase().includes(q),
          );
          if (filtered.length > 0) return { ...opt, options: filtered };
          return null;
        }
        return opt.label.toLowerCase().includes(q) ? opt : null;
      })
      .filter(Boolean);
  };

  const filteredOptions = searchable ? filterOptions(options, search) : options;

  const handleKeyDown = useCallback(
    (e) => {
      if (!isOpen || !searchable) return;
      if (e.key === "Escape") {
        setIsOpen(false);
        setSearch("");
        return;
      }
      if (e.key === "Backspace") {
        setSearch((prev) => prev.slice(0, -1));
        return;
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        setSearch((prev) => prev + e.key);
        clearTimeout(clearTimerRef.current);
        clearTimerRef.current = setTimeout(() => setSearch(""), 1500);
      }
    },
    [isOpen, searchable],
  );

  useEffect(() => {
    if (isOpen && searchable) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, searchable, handleKeyDown]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) setSearch("");
  }, [isOpen]);

  return (
    <div className="relative" ref={containerRef}>
      <div
        tabIndex={0}
        role="combobox"
        aria-expanded={isOpen}
        className={`w-full border rounded-xl cursor-pointer group relative shadow-sm outline-none transition-all duration-300
          focus:ring-1 focus:ring-green-500 focus:border-green-500
          ${
            isDark
              ? `bg-slate-900/50 border-slate-700 text-slate-200 hover:bg-slate-900/80 hover:border-slate-600 ${isOpen ? "!border-green-500 ring-1 ring-green-500 bg-slate-900" : ""}`
              : `bg-white border-gray-200 text-gray-900 hover:border-green-500 ${isOpen ? "!border-green-500 ring-1 ring-green-500" : ""}`
          }
          ${error ? "!border-red-500" : ""}
        `}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsOpen(!isOpen);
          } else if (e.key === "Escape" && isOpen) {
            setIsOpen(false);
          }
        }}
      >
        <div className="flex items-center justify-between px-4 py-3 h-full">
          <span
            className={`font-medium ${isDark ? "text-slate-200" : "text-gray-900"} ${error ? "text-red-600" : ""}`}
          >
            {selectedLabel}
          </span>

          <div
            className={`transition-transform duration-300 ${isOpen ? "rotate-180 text-green-600" : isDark ? "text-slate-500 group-hover:text-green-500" : "text-gray-400 group-hover:text-green-600"}`}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 8 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className={`absolute z-50 left-0 right-0 top-full border rounded-2xl shadow-xl overflow-hidden backdrop-blur-md
              ${isDark ? "bg-slate-900/95 border-slate-700" : "bg-white border-slate-200"}
            `}
          >
            <AnimatePresence>
              {searchable && search && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.15 }}
                  className={`border-b ${isDark ? "border-slate-700" : "border-gray-100"}`}
                >
                  <div className="flex items-center gap-2 px-4 py-2.5">
                    <svg
                      className={`w-4 h-4 shrink-0 ${isDark ? "text-green-400" : "text-green-600"}`}
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
                    <span
                      className={`text-sm font-bold ${isDark ? "text-green-400" : "text-green-600"}`}
                    >
                      {search}
                    </span>
                    <span
                      className={`text-xs ml-auto ${isDark ? "text-slate-500" : "text-gray-400"}`}
                    >
                      {filteredOptions.reduce(
                        (count, opt) =>
                          count + (opt.options ? opt.options.length : 1),
                        0,
                      )}{" "}
                      results
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="py-2 max-h-[200px] overflow-y-auto custom-scrollbar">
              {searchable && search && filteredOptions.length === 0 && (
                <div
                  className={`px-5 py-8 text-center text-sm ${isDark ? "text-slate-500" : "text-gray-400"}`}
                >
                  No results for &ldquo;{search}&rdquo;
                </div>
              )}
              {filteredOptions.map((option, index) =>
                option.options ? (
                  <div key={index}>
                    <div
                      className={`px-5 py-2 text-xs font-bold uppercase tracking-wider ${isDark ? "text-slate-500" : "text-gray-400"}`}
                    >
                      {option.label}
                    </div>
                    {option.options.map((subOption) => (
                      <div
                        key={subOption.value}
                        onClick={() => {
                          onChange(subOption.value);
                          setIsOpen(false);
                          setSearch("");
                        }}
                        className={`
                          px-5 py-3 text-sm font-bold cursor-pointer transition-all duration-200 pl-8
                          flex items-center justify-between
                          ${
                            subOption.value === value
                              ? isDark
                                ? "bg-green-900/20 text-green-400"
                                : "bg-green-50 text-green-700"
                              : isDark
                                ? "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                          }
                        `}
                      >
                        {subOption.label}
                        {subOption.value === value && (
                          <motion.svg
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="w-4 h-4 text-green-500 shrink-0 ml-2"
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
                          </motion.svg>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    key={option.value}
                    onClick={() => {
                      onChange(option.value);
                      setIsOpen(false);
                      setSearch("");
                    }}
                    className={`
                      px-5 py-3 text-sm font-bold cursor-pointer transition-all duration-200
                      flex items-center justify-between
                      ${
                        option.value === value
                          ? isDark
                            ? "bg-green-900/20 text-green-400"
                            : "bg-green-50 text-green-700"
                          : isDark
                            ? "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      }
                    `}
                  >
                    {option.label}
                    {option.value === value && (
                      <motion.svg
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-4 h-4 text-green-500 shrink-0 ml-2"
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
                      </motion.svg>
                    )}
                  </div>
                ),
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
