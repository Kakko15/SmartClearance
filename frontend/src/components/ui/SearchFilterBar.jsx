/**
 * F6: Reusable search + date-range filter bar for all dashboards.
 * F7: Includes optional CSV export button.
 */
import { useState } from "react";

export default function SearchFilterBar({
  searchQuery,
  onSearchChange,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  onExport,
  exportLabel = "Export CSV",
  placeholder = "Search by name or student number...",
  isDarkMode = false,
  children,
}) {
  const [showFilters, setShowFilters] = useState(false);

  const inputBase = isDarkMode
    ? "bg-[#202124] border-[#3c4043] text-[#e8eaed] placeholder-[#9aa0a6] focus:ring-primary-500"
    : "bg-white/60 border-gray-200 text-gray-900 placeholder-gray-400 focus:ring-primary-500";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search input */}
        <div className="relative flex-1 min-w-[200px]">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="search"
            placeholder={placeholder}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label="Search"
            className={`w-full pl-9 pr-4 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-all ${inputBase}`}
          />
        </div>

        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          aria-expanded={showFilters}
          aria-controls="date-filter-panel"
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap border ${
            showFilters
              ? isDarkMode
                ? "bg-primary-900/30 border-primary-700 text-primary-400"
                : "bg-primary-50 border-primary-200 text-primary-700"
              : isDarkMode
                ? "bg-[#202124] border-[#3c4043] text-[#9aa0a6] hover:text-[#e8eaed]"
                : "bg-white border-gray-200 text-gray-600 hover:text-gray-900"
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          Filter
        </button>

        {/* Export button */}
        {onExport && (
          <button
            onClick={onExport}
            aria-label={exportLabel}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap border ${
              isDarkMode
                ? "bg-[#202124] border-[#3c4043] text-[#9aa0a6] hover:text-emerald-400 hover:border-emerald-800"
                : "bg-white border-gray-200 text-gray-600 hover:text-emerald-700 hover:border-emerald-200"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {exportLabel}
          </button>
        )}

        {/* Extra actions (e.g. bulk mode toggle) */}
        {children}
      </div>

      {/* Date range filter panel */}
      {showFilters && (
        <div
          id="date-filter-panel"
          role="region"
          aria-label="Date range filter"
          className={`flex items-center gap-3 flex-wrap p-3 rounded-xl border ${
            isDarkMode
              ? "bg-[#202124] border-[#3c4043]"
              : "bg-slate-50 border-slate-200"
          }`}
        >
          <label className={`text-xs font-medium ${isDarkMode ? "text-[#9aa0a6]" : "text-gray-500"}`}>
            From
          </label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
            aria-label="Start date"
            className={`px-3 py-1.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${inputBase}`}
          />
          <label className={`text-xs font-medium ${isDarkMode ? "text-[#9aa0a6]" : "text-gray-500"}`}>
            To
          </label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => onDateToChange(e.target.value)}
            aria-label="End date"
            className={`px-3 py-1.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${inputBase}`}
          />
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { onDateFromChange(""); onDateToChange(""); }}
              className={`text-xs font-medium px-2 py-1 rounded-lg transition-colors ${
                isDarkMode ? "text-red-400 hover:bg-red-900/20" : "text-red-600 hover:bg-red-50"
              }`}
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}
