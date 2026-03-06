import { useState } from "react";

export default function AddCommentForm({
  onSubmit,
  isSubmitting = false,
  isDarkMode = false,
}) {
  const [commentText, setCommentText] = useState("");
  const [visibility, setVisibility] = useState("all");
  const [isExpanded, setIsExpanded] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    await onSubmit(commentText.trim(), visibility);
    setCommentText("");
    setVisibility("all");
    setIsExpanded(false);
  };

  const handleCancel = () => {
    setCommentText("");
    setVisibility("all");
    setIsExpanded(false);
  };

  const visibilityOptions = [
    {
      value: "all",
      label: "🌐 All",
      desc: "Visible to everyone including student",
    },
    {
      value: "admins_only",
      label: "🔒 Admins Only",
      desc: "Only admin roles can see",
    },
    {
      value: "professors_only",
      label: "🎓 Professors Only",
      desc: "Only professors can see",
    },
  ];

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className={`w-full py-3 px-4 rounded-xl border-2 border-dashed text-sm font-medium transition-all ${
          isDarkMode
            ? "border-slate-600 text-slate-400 hover:border-blue-500 hover:text-blue-400 hover:bg-blue-900/10"
            : "border-gray-300 text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50"
        }`}
      >
        💬 Add Comment
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={`rounded-xl border p-4 ${
        isDarkMode
          ? "bg-slate-800/50 border-slate-600"
          : "bg-white border-gray-200 shadow-sm"
      }`}
    >
      <h4
        className={`text-sm font-semibold mb-3 ${isDarkMode ? "text-white" : "text-gray-900"}`}
      >
        Add Comment
      </h4>

      <textarea
        value={commentText}
        onChange={(e) => setCommentText(e.target.value)}
        placeholder="Enter your comment..."
        rows={3}
        className={`w-full px-3 py-2 rounded-lg resize-none text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
          isDarkMode
            ? "bg-slate-700 border border-slate-500 text-white placeholder-slate-400"
            : "bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-400"
        }`}
        disabled={isSubmitting}
        autoFocus
      />

      <div className="mt-3">
        <label
          className={`block text-xs font-medium mb-1.5 ${isDarkMode ? "text-slate-300" : "text-gray-600"}`}
        >
          Visibility
        </label>
        <div className="flex flex-wrap gap-2">
          {visibilityOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setVisibility(opt.value)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                visibility === opt.value
                  ? isDarkMode
                    ? "bg-blue-600 text-white border-blue-500 shadow-md"
                    : "bg-blue-500 text-white border-blue-500 shadow-md"
                  : isDarkMode
                    ? "bg-slate-700 text-slate-300 border-slate-500 hover:border-blue-500"
                    : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
              }`}
              title={opt.desc}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between mt-4">
        <p
          className={`text-xs ${isDarkMode ? "text-slate-500" : "text-gray-400"}`}
        >
          {visibilityOptions.find((v) => v.value === visibility)?.desc}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleCancel}
            disabled={isSubmitting}
            className={`text-xs px-4 py-2 rounded-lg transition-colors ${
              isDarkMode
                ? "text-slate-300 hover:bg-slate-600"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !commentText.trim()}
            className="text-xs px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            {isSubmitting ? "Posting..." : "Post Comment"}
          </button>
        </div>
      </div>
    </form>
  );
}
