import { useState, useEffect, useCallback, useRef } from "react";
import { authAxios } from "../../services/api";
import useRealtimeSubscription from "../../hooks/useRealtimeSubscription";

export default function RequestDocuments({
  requestId,
  userId,
  isDarkMode = false,
}) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(true);

  const loadingTimerRef = useRef(null);

  const fetchDocuments = useCallback(async () => {
    loadingTimerRef.current = setTimeout(() => setLoading(true), 150);
    try {
      const response = await authAxios.get(`/documents/request/${requestId}`);
      if (response.data.success) {
        setDocuments(response.data.documents || []);
      }
    } catch (error) {
      console.error("Error fetching documents:", error);
    } finally {
      if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Live updates when documents are added/removed
  useRealtimeSubscription("request_documents", fetchDocuments, {
    filter: `request_id=eq.${requestId}`,
  });

  const handlePreview = (doc) => {
    if (doc.file_url) {
      window.open(doc.file_url, "_blank", "noopener,noreferrer");
    }
  };

  const handleDownload = async (doc) => {
    if (!doc.file_url) return;
    try {
      const response = await fetch(doc.file_url);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.file_name || "document";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      // Fallback: open in new tab
      window.open(doc.file_url, "_blank", "noopener,noreferrer");
    }
  };

  const getFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  if (loading && documents.length === 0) {
    return (
      <div className={`rounded-[16px] border transition-all mt-4 ${isDarkMode ? "bg-[#282a2d] border-[#3c4043]" : "bg-white border-[#dadce0]"}`}>
        <div className={`w-full flex items-center justify-between p-4 rounded-[16px] transition-colors ${isDarkMode ? "bg-[#3c4043]/50" : "bg-[#f8f9fa]"}`}>
          <div className="flex items-center gap-3 w-full">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 animate-pulse ${isDarkMode ? "bg-[#8ab4f8]/20" : "bg-blue-100"}`} />
            <div className="flex flex-col gap-1.5 flex-1">
              <div className={`h-4 w-32 rounded animate-pulse ${isDarkMode ? "bg-[#5f6368]" : "bg-gray-200"}`} />
              <div className={`h-3 w-48 rounded animate-pulse ${isDarkMode ? "bg-[#3c4043]" : "bg-gray-100"}`} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!loading && documents.length === 0) {
    return (
      <div className={`rounded-[16px] border transition-all mt-4 ${isDarkMode ? "bg-[#282a2d] border-[#3c4043]" : "bg-white border-[#dadce0]"}`}>
        <div className={`w-full flex items-center justify-between p-4 rounded-[16px] transition-colors ${isDarkMode ? "bg-[#3c4043]/50" : "bg-[#f8f9fa]"}`}>
          <div className="flex items-center gap-3 w-full opacity-50">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isDarkMode ? "bg-[#3c4043]" : "bg-gray-100"}`}>
              <svg className={`w-5 h-5 ${isDarkMode ? "text-[#9aa0a6]" : "text-gray-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="flex flex-col">
              <h4 className={`font-semibold text-[15px] ${isDarkMode ? "text-[#e8eaed]" : "text-[#202124]"}`} style={{ fontFamily: "Google Sans, sans-serif" }}>No Documents</h4>
              <p className={`text-[13px] mt-0.5 ${isDarkMode ? "text-[#9aa0a6]" : "text-[#5f6368]"}`}>Student has not uploaded any supporting documents.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-[16px] border transition-all mt-4 ${
        isDarkMode
          ? "bg-[#282a2d] border-[#3c4043]"
          : "bg-white border-[#dadce0]"
      }`}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full flex items-center justify-between p-4 rounded-[16px] transition-colors ${
          isDarkMode ? "hover:bg-[#3c4043]/50" : "hover:bg-[#f8f9fa]"
        }`}
      >
        <div className="flex items-center gap-3 w-full">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
              isDarkMode ? "bg-[#8ab4f8]/20" : "bg-[#e8f0fe]"
            }`}
          >
            <svg
              className={`w-5 h-5 ${isDarkMode ? "text-[#8ab4f8]" : "text-[#1a73e8]"}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </div>
          <div className="text-left flex-1">
            <h4
              className={`font-medium text-[16px] leading-tight ${isDarkMode ? "text-[#e8eaed]" : "text-[#202124]"}`}
              style={{ fontFamily: "Google Sans, sans-serif" }}
            >
              Attached Documents
            </h4>
            <p
              className={`text-[13px] mt-0.5 ${isDarkMode ? "text-[#9aa0a6]" : "text-[#5f6368]"}`}
            >
              {documents.length} document{documents.length !== 1 ? "s" : ""} uploaded by student
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <span
            className={`text-[12px] font-medium px-2.5 py-0.5 rounded-full ${
              documents.length === 0
                ? isDarkMode
                  ? "bg-[#3c4043] text-[#9aa0a6]"
                  : "bg-[#f1f3f4] text-[#5f6368]"
                : isDarkMode
                  ? "bg-[#8ab4f8] text-[#202124]"
                  : "bg-[#1a73e8] text-white"
            }`}
          >
            {documents.length === 0 ? "0" : documents.length}
          </span>

          <svg
            className={`w-5 h-5 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""} ${isDarkMode ? "text-[#9aa0a6]" : "text-[#5f6368]"}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {isExpanded && (
        <div
          className={`border-t px-4 pt-4 pb-5 rounded-b-[16px] ${isDarkMode ? "border-[#3c4043] bg-[#282a2d]" : "border-[#dadce0] bg-white"}`}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className={`flex justify-between items-center p-3 rounded-[12px] border transition-all ${
                  isDarkMode
                    ? "bg-[#202124] border-[#3c4043] hover:border-[#8ab4f8]/50"
                    : "bg-white border-[#dadce0] hover:border-[#1a73e8] hover:shadow-sm"
                }`}
              >
                <div
                  className="flex items-center gap-3 overflow-hidden cursor-pointer flex-1 min-w-0"
                  onClick={() => handlePreview(doc)}
                  title="Click to preview"
                >
                  <div className={`p-2 rounded-lg flex-shrink-0 ${isDarkMode ? "bg-[#3c4043]" : "bg-blue-50"}`}>
                    <svg className={`w-6 h-6 ${isDarkMode ? "text-[#8ab4f8]" : "text-blue-600"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-[14px] font-medium truncate ${isDarkMode ? "text-[#e8eaed]" : "text-gray-900"}`}>
                      {doc.file_name}
                    </p>
                    <p className={`text-[12px] flex items-center gap-2 ${isDarkMode ? "text-[#9aa0a6]" : "text-gray-500"}`}>
                      <span>{getFileSize(doc.file_size)}</span>
                      <span>&bull;</span>
                      <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDownload(doc); }}
                  className={`p-1.5 rounded-full flex-shrink-0 cursor-pointer transition-colors ${isDarkMode ? "text-[#9aa0a6] hover:bg-[#3c4043] hover:text-[#e8eaed]" : "text-gray-400 hover:bg-gray-100 hover:text-gray-700"}`}
                  title="Download file"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
