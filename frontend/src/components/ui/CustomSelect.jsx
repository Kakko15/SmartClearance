import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function CustomSelect({
  value,
  onChange,
  options,
  error,
  isDark,
  placeholder,
  searchable = false,
  placement = "auto",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [menuPlacement, setMenuPlacement] = useState("bottom");
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);
  const listboxRef = useRef(null);

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
  const selectableOptions = filteredOptions.reduce((acc, opt) => {
    if (opt.options) return [...acc, ...opt.options];
    return [...acc, opt];
  }, []);

  const [prevSearch, setPrevSearch] = useState(search);
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);

  if (search !== prevSearch || isOpen !== prevIsOpen) {
    setPrevSearch(search);
    setPrevIsOpen(isOpen);
    setFocusedIndex(-1);
    if (isOpen !== prevIsOpen && !isOpen) {
      setSearch("");
    }
  }

  useEffect(() => {
    if (isOpen && focusedIndex >= 0 && listboxRef.current) {
      const activeEl = listboxRef.current.querySelector(
        `[data-index="${focusedIndex}"]`,
      );
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [focusedIndex, isOpen]);

  useEffect(() => {
    if (isOpen && searchable) {
      const t = setTimeout(() => searchInputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [isOpen, searchable]);

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
    if (isOpen && containerRef.current) {
      if (placement === "auto") {
        const rect = containerRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        if (spaceBelow < 300 && rect.top > 300) {
          setMenuPlacement("top");
        } else {
          setMenuPlacement("bottom");
        }
      } else {
        setMenuPlacement(placement);
      }
    }
  }, [isOpen, placement]);

  const resultCount = filteredOptions.reduce(
    (count, opt) => count + (opt.options ? opt.options.length : 1),
    0,
  );

  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setFocusedIndex((prev) =>
          prev < selectableOptions.length - 1 ? prev + 1 : prev,
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setFocusedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      case "Enter":
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < selectableOptions.length) {
          onChange(selectableOptions[focusedIndex].value);
          setIsOpen(false);
          setSearch("");
        } else if (!searchable || !search) {
          setIsOpen(false);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        setSearch("");
        break;
      default:
        break;
    }
  };

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
        onKeyDown={handleKeyDown}
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
            initial={{ opacity: 0, y: menuPlacement === "top" ? 5 : -5 }}
            animate={{ opacity: 1, y: menuPlacement === "top" ? -4 : 4 }}
            exit={{ opacity: 0, y: menuPlacement === "top" ? 5 : -5 }}
            transition={{ duration: 0.2 }}
            className={`absolute z-[60] left-0 right-0 ${
              menuPlacement === "top" ? "bottom-full mb-1" : "top-full mt-1"
            } border rounded-2xl shadow-xl overflow-hidden backdrop-blur-md
              ${isDark ? "bg-slate-900/95 border-slate-700" : "bg-white border-slate-200"}
            `}
          >
            {searchable && (
              <div
                className={`border-b ${isDark ? "border-slate-700" : "border-gray-100"}`}
              >
                <div className="flex items-center gap-2 px-4 py-2.5">
                  <svg
                    className={`w-4 h-4 shrink-0 ${isDark ? "text-slate-500" : "text-gray-400"}`}
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
                    ref={searchInputRef}
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (
                        ["ArrowDown", "ArrowUp", "Enter", "Escape"].includes(
                          e.key,
                        )
                      ) {
                        handleKeyDown(e);
                      }
                      e.stopPropagation();
                    }}
                    placeholder="Search..."
                    className={`flex-1 text-sm font-medium outline-none bg-transparent ${
                      isDark
                        ? "text-white placeholder:text-slate-600"
                        : "text-gray-900 placeholder:text-gray-400"
                    }`}
                  />
                  {search && (
                    <span
                      className={`text-xs shrink-0 ${isDark ? "text-slate-500" : "text-gray-400"}`}
                    >
                      {resultCount} result{resultCount !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </div>
            )}

            <div
              ref={listboxRef}
              className="py-1 my-1 max-h-[250px] overflow-y-auto custom-scrollbar pr-1 mr-1"
            >
              {searchable && search && filteredOptions.length === 0 && (
                <div
                  className={`px-5 py-8 text-center text-sm ${isDark ? "text-slate-500" : "text-gray-400"}`}
                >
                  No results found
                </div>
              )}
              {filteredOptions.map((option, index) =>
                option.options ? (
                  <div key={index}>
                    <div
                      className={`px-4 py-2 mt-1 text-xs font-bold uppercase tracking-wider ${isDark ? "text-slate-500" : "text-gray-400"}`}
                    >
                      {option.label}
                    </div>
                    {option.options.map((subOption) => {
                      const flatIndex = selectableOptions.findIndex(
                        (o) => o.value === subOption.value,
                      );
                      return (
                        <div
                          key={subOption.value}
                          data-index={flatIndex}
                          onClick={() => {
                            onChange(subOption.value);
                            setIsOpen(false);
                            setSearch("");
                          }}
                          onMouseEnter={() => setFocusedIndex(flatIndex)}
                          className={`
                          px-4 py-2.5 mx-1.5 my-0.5 text-sm font-bold cursor-pointer transition-all duration-200 pl-8 rounded-xl
                          flex items-center justify-between
                          ${
                            focusedIndex === flatIndex ||
                            subOption.value === value
                              ? isDark
                                ? "bg-green-500/20 text-green-400"
                                : "bg-green-50 text-green-700"
                              : isDark
                                ? "text-slate-300 hover:bg-slate-800 hover:text-white"
                                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
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
                      );
                    })}
                  </div>
                ) : (
                  (() => {
                    const flatIndex = selectableOptions.findIndex(
                      (o) => o.value === option.value,
                    );
                    return (
                      <div
                        key={option.value}
                        data-index={flatIndex}
                        onClick={() => {
                          onChange(option.value);
                          setIsOpen(false);
                          setSearch("");
                        }}
                        onMouseEnter={() => setFocusedIndex(flatIndex)}
                        className={`
                      px-4 py-2.5 mx-1.5 my-0.5 text-sm font-bold cursor-pointer transition-all duration-200 rounded-xl
                      flex items-center justify-between
                      ${
                        focusedIndex === flatIndex || option.value === value
                          ? isDark
                            ? "bg-green-500/20 text-green-400"
                            : "bg-green-50 text-green-700"
                          : isDark
                            ? "text-slate-300 hover:bg-slate-800 hover:text-white"
                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
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
                    );
                  })()
                ),
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
