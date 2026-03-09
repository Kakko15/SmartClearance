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
        className={`w-full py-3.5 px-5 rounded-full border transition-all duration-200 flex items-center gap-3 ${
          isDarkMode
            ? "border-[#3c4043] text-[#9aa0a6] hover:bg-[#3c4043]/30 hover:border-[#8ab4f8] hover:text-[#8ab4f8]"
            : "border-[#dadce0] text-[#5f6368] hover:bg-[#f1f3f4] hover:border-[#1a73e8] hover:text-[#1a73e8]"
        }`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="transition-colors">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z" fill="currentColor"/>
        </svg>
        <span className="font-medium text-[14px]">Add a comment...</span>
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={`rounded-[16px] border p-4 sm:p-5 transition-all ${
        isDarkMode
          ? "bg-[#282a2d] border-[#3c4043]"
          : "bg-white border-[#dadce0] shadow-[0_1px_2px_0_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)]"
      }`}
    >
      <h4
        className={`text-[15px] font-medium mb-3 ${isDarkMode ? "text-[#e8eaed]" : "text-[#202124]"}`}
        style={{ fontFamily: 'Google Sans, sans-serif' }}
      >
        Write a comment
      </h4>

      <textarea
        value={commentText}
        onChange={(e) => setCommentText(e.target.value)}
        placeholder="Enter your comment..."
        rows={3}
        className={`w-full px-4 py-3 rounded-[16px] resize-none text-[14px] focus:outline-none transition-shadow ${
          isDarkMode
            ? "bg-[#202124] border-[#3c4043] text-[#e8eaed] placeholder-[#9aa0a6] focus:shadow-[inset_0_0_0_1px_#8ab4f8]"
            : "bg-[#f1f3f4] border-transparent text-[#202124] placeholder-[#5f6368] focus:bg-white focus:shadow-[inset_0_0_0_1px_#1a73e8]"
        }`}
        disabled={isSubmitting}
        autoFocus
      />

      <div className="mt-4">
        <label
          className={`block text-[12px] font-semibold tracking-wide uppercase mb-2 ${isDarkMode ? "text-[#9aa0a6]" : "text-[#5f6368]"}`}
        >
          Visibility
        </label>
        <div className="flex flex-wrap gap-2">
          {visibilityOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setVisibility(opt.value)}
              className={`text-[13px] px-4 py-1.5 rounded-full border transition-all font-medium ${
                visibility === opt.value
                  ? isDarkMode
                    ? "bg-[#8ab4f8]/20 text-[#8ab4f8] border-transparent"
                    : "bg-[#e8f0fe] text-[#1a73e8] border-[#e8f0fe]"
                  : isDarkMode
                    ? "bg-transparent text-[#9aa0a6] border-[#3c4043] hover:bg-[#3c4043]/50 hover:text-[#e8eaed]"
                    : "bg-transparent text-[#5f6368] border-[#dadce0] hover:bg-[#f8f9fa] hover:text-[#202124]"
              }`}
            >
              <div className="flex items-center gap-1.5">
                {opt.label}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-5 pt-4 border-t border-[#dadce0] dark:border-[#3c4043]">
        <p
          className={`text-[12px] leading-tight max-w-[200px] ${isDarkMode ? "text-[#9aa0a6]" : "text-[#5f6368]"}`}
        >
          {visibilityOptions.find((v) => v.value === visibility)?.desc}
        </p>
        <div className="flex w-full sm:w-auto gap-2">
          <button
            type="button"
            onClick={handleCancel}
            disabled={isSubmitting}
            className={`flex-1 sm:flex-none text-[14px] px-5 py-2.5 rounded-full font-medium transition-colors ${
              isDarkMode
                ? "text-[#9aa0a6] hover:bg-[#3c4043] hover:text-[#e8eaed]"
                : "text-[#5f6368] hover:bg-[#f1f3f4] hover:text-[#202124]"
            }`}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !commentText.trim()}
            className={`flex-1 sm:flex-none text-[14px] px-6 py-2.5 rounded-full font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              isDarkMode
                ? "bg-[#8ab4f8] text-[#202124] hover:bg-[#8ab4f8]/90"
                : "bg-[#1a73e8] text-white hover:bg-[#1a73e8]/90"
            }`}
          >
            {isSubmitting ? "Posting..." : "Post"}
          </button>
        </div>
      </div>
    </form>
  );
}
