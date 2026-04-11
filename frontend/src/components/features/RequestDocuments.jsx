import { useState, useEffect, useCallback, useRef } from "react";
import { authAxios } from "../../services/api";
import useRealtimeSubscription from "../../hooks/useRealtimeSubscription";

export const documentsCache = {};
export const documentFetchPromises = {};

export const preloadRequestDocuments = (requestId) => {
  if (documentsCache[requestId] || documentFetchPromises[requestId]) return;
  documentFetchPromises[requestId] = authAxios.get(`/documents/request/${requestId}`).then(res => {
     if (res.data && res.data.success) {
        documentsCache[requestId] = res.data.documents || [];
     }
     return res;
  }).catch(() => null);
};

export default function RequestDocuments({
  requestId,
  userId,
  isDarkMode = false,
}) {
  const hasCache = !!documentsCache[requestId];
  const [documents, setDocuments] = useState(documentsCache[requestId] || []);
  const [loading, setLoading] = useState(!hasCache);
  const [isExpanded, setIsExpanded] = useState(true);

  const loadingTimerRef = useRef(null);

  const fetchDocuments = useCallback(async () => {
    if (!documentsCache[requestId]) {
      loadingTimerRef.current = setTimeout(() => setLoading(true), 150);
    }
    try {
      let response;
      if (documentFetchPromises[requestId]) {
        response = await documentFetchPromises[requestId];
        delete documentFetchPromises[requestId];
      } else {
        response = await authAxios.get(`/documents/request/${requestId}`);
      }
      
      if (response && response.data && response.data.success) {
        documentsCache[requestId] = response.data.documents || [];
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



  if (documents.length === 0) {
    return (
      <div className={`mt-2 pt-2 transition-all duration-300`}>
        <div className={`px-2 py-3 mb-4 flex items-center justify-between border-b ${isDarkMode ? "border-[#3c4043]" : "border-slate-100"}`}>
          <div className="flex items-center gap-2.5">
            <div className={`p-1.5 rounded-lg ${isDarkMode ? "bg-blue-900/30 text-blue-400" : "bg-blue-50 text-blue-600"}`}>
               <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
            </div>
            <h4 className={`text-[15px] font-bold tracking-tight ${isDarkMode ? "text-[#e8eaed]" : "text-slate-800"}`} style={{ fontFamily: "Google Sans, sans-serif" }}>
              Uploaded Documents
            </h4>
          </div>
          <span className={`text-[12px] font-bold px-3 py-1 rounded-full border shadow-sm ${isDarkMode ? "bg-slate-800 text-slate-400 border-[#3c4043]" : "bg-slate-50 text-slate-500 border-slate-200 shadow-[0_1px_2px_rgba(0,0,0,0.05)]"}`}>
            {loading ? "..." : "0 Files"}
          </span>
        </div>
        {!loading && (
          <div className={`mx-2 mb-4 mt-2 px-6 py-8 rounded-2xl flex flex-col items-center justify-center border-2 border-dashed transition-all duration-300 ${isDarkMode ? "border-[#3c4043] bg-[#282a2d]/50 hover:bg-[#282a2d] hover:border-[#5f6368]" : "border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300"}`}>
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-sm ${isDarkMode ? "bg-[#3c4043] text-slate-400" : "bg-white text-slate-400 border border-slate-100"}`}>
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className={`text-[14px] font-bold mb-1 ${isDarkMode ? "text-[#e8eaed]" : "text-slate-700"}`} style={{ fontFamily: "Google Sans, sans-serif" }}>No Documents Yet</p>
            <p className={`text-[13px] text-center max-w-[250px] leading-relaxed ${isDarkMode ? "text-[#9aa0a6]" : "text-slate-500"}`}>The student has not uploaded any required files.</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`mt-2 pt-2 transition-all duration-300`}>
      <div className={`px-2 py-3 mb-4 flex items-center justify-between border-b ${isDarkMode ? "border-[#3c4043]" : "border-slate-100"}`}>
        <div className="flex items-center gap-2.5">
          <div className={`p-1.5 rounded-lg ${isDarkMode ? "bg-blue-900/30 text-blue-400" : "bg-blue-50 text-blue-600"}`}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
          </div>
          <h4 className={`text-[15px] font-bold tracking-tight ${isDarkMode ? "text-[#e8eaed]" : "text-slate-800"}`} style={{ fontFamily: "Google Sans, sans-serif" }}>
            Uploaded Documents
          </h4>
        </div>
        <span className={`text-[12px] font-bold px-3 py-1 rounded-full border shadow-sm transition-colors ${documents.length > 0 ? (isDarkMode ? "bg-blue-900/40 text-blue-300 border-blue-800/50" : "bg-blue-50 text-blue-600 border-blue-200") : (isDarkMode ? "bg-slate-800 text-slate-400 border-[#3c4043]" : "bg-slate-50 text-slate-500 border-slate-200")}`}>
          {documents.length} {documents.length === 1 ? 'File' : 'Files'}
        </span>
      </div>

      <div className="px-2 pb-4 bg-transparent grid grid-cols-1 sm:grid-cols-2 gap-3">
        {documents.map((doc) => {
          const isDocType = (doc.file_type?.includes("word") || doc.file_name?.endsWith(".docx") || doc.file_name?.endsWith(".doc"));
          const isPdfType = doc.file_type?.includes("pdf");
          const isExcelType = doc.file_type?.includes("excel") || doc.file_type?.includes("spreadsheet") || doc.file_name?.endsWith(".xls") || doc.file_name?.endsWith(".xlsx");
          const isImage = doc.file_type?.includes("image");
          
          let fileTypeVerbose = "Document";
          if (isDocType) fileTypeVerbose = "Microsoft Word";
          else if (isPdfType) fileTypeVerbose = "PDF Document";
          else if (isExcelType) fileTypeVerbose = "Microsoft Excel";
          else if (isImage) fileTypeVerbose = "Image";
          
          return (
            <div
              key={doc.id}
              className={`group flex items-stretch p-0 rounded-[16px] border transition-all duration-300 relative z-10 ${
                isDarkMode 
                  ? "bg-[#202124] border-[#3c4043] hover:border-blue-500/50 hover:shadow-[0_4px_12px_rgba(0,0,0,0.3)]" 
                  : "bg-white border-slate-200 shadow-sm hover:border-blue-400 hover:shadow-[0_8px_20px_-6px_rgba(59,130,246,0.2)]"
              }`}
            >
              {/* Left side: Information */}
              <div
                className={`flex flex-col justify-center min-w-0 flex-1 p-4 sm:p-5 cursor-pointer`}
                onClick={() => handlePreview(doc)}
                title="Click to open"
              >
                <p 
                  className={`text-[16px] sm:text-[18px] font-semibold truncate transition-colors duration-200 underline-offset-[3px] decoration-2 group-hover:underline ${
                    isDarkMode 
                      ? "text-[#e8eaed] decoration-[#e8eaed]/30" 
                      : "text-[#202124] decoration-[#202124]/30"
                  }`}
                  style={{ fontFamily: "Google Sans, sans-serif" }}
                >
                  {doc.file_name}
                </p>
                
                <div className="mt-1 flex items-center gap-2">
                  <p className={`text-[13px] sm:text-[14px] font-medium ${isDarkMode ? "text-[#9aa0a6]" : "text-[#5f6368]"}`} style={{ fontFamily: "Google Sans, sans-serif" }}>
                    {fileTypeVerbose}
                  </p>
                  <span className={`text-[11px] leading-none ${isDarkMode ? "text-[#5f6368]" : "text-slate-300"}`}>•</span>
                  <p className={`text-[12px] font-medium ${isDarkMode ? "text-[#9aa0a6]" : "text-[#5f6368]"}`}>
                    {getFileSize(doc.file_size)}
                  </p>
                </div>
              </div>
              
              {/* Right side: Preview Thumbnail */}
              <div 
                className={`w-[110px] sm:w-[130px] flex-shrink-0 relative overflow-hidden rounded-r-[15px] border-l transition-colors duration-300 ${
                  isDarkMode 
                    ? "border-[#3c4043] bg-[#282a2d]" 
                    : "border-slate-200 bg-slate-50"
                }`}
              >
                <div 
                  className="absolute inset-0 cursor-pointer pointer-events-auto"
                  onClick={() => handlePreview(doc)}
                >
                  {isImage && doc.file_url ? (
                    <div className="w-full h-full relative group/img">
                      <img 
                        src={doc.file_url} 
                        alt="Preview" 
                        className="w-full h-full object-cover transition-transform duration-500 group-hover/img:scale-110"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/10 transition-colors duration-300" />
                    </div>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-3 opacity-60 group-hover:opacity-100 transition-opacity duration-300">
                      <div className={`p-2 rounded-xl mb-1 ${
                        isPdfType ? (isDarkMode ? "bg-red-900/30 text-red-500" : "bg-red-50 text-red-600") :
                        isExcelType ? (isDarkMode ? "bg-green-900/30 text-green-500" : "bg-green-50 text-green-600") :
                        isDocType ? (isDarkMode ? "bg-blue-900/30 text-blue-500" : "bg-blue-50 text-blue-600") :
                        (isDarkMode ? "bg-[#3c4043] text-[#9aa0a6]" : "bg-slate-200 text-slate-500")
                      }`}>
                         <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                         </svg>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Download Button Overlay */}
                <div className={`absolute top-2 right-2 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0`}>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDownload(doc); }}
                    className={`p-1.5 sm:p-2 rounded-full shadow-lg backdrop-blur-sm transition-all duration-300 hover:scale-110 active:scale-95 ${
                      isDarkMode 
                        ? "bg-[#202124]/90 text-blue-400 hover:bg-blue-500/20 hover:text-blue-300" 
                        : "bg-white/90 text-blue-600 hover:bg-blue-50"
                    }`}
                    title="Download"
                  >
                    <svg className="w-[14px] h-[14px] sm:w-[16px] sm:h-[16px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
