/**
 * F7: CSV/Excel export utility for admin dashboards.
 * Converts an array of objects into a downloadable CSV file.
 */

/**
 * Escape a CSV cell value — handles commas, quotes, and newlines.
 */
function escapeCSV(value) {
  if (value == null) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Export an array of objects as a CSV file download.
 *
 * @param {Object[]} data - Array of row objects
 * @param {Object[]} columns - Column definitions: { key, label }
 * @param {string} filename - Download filename (without extension)
 */
export function exportToCSV(data, columns, filename = "export") {
  if (!data || data.length === 0) return;

  const header = columns.map((c) => escapeCSV(c.label)).join(",");
  const rows = data.map((row) =>
    columns.map((c) => escapeCSV(typeof c.accessor === "function" ? c.accessor(row) : row[c.key])).join(",")
  );

  const csv = [header, ...rows].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
