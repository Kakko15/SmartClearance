import DocumentUpload from "./DocumentUpload";
import RequestComments from "./RequestComments";
import CertificateDownload from "./CertificateDownload";

export default function RequestCard({
  request,
  studentId,
  onResubmit,
  onDelete,
  loading,
  isDark = false,
}) {
  const calculateProgress = (request) => {
    const totalStages = request.document_types.required_stages.length;
    const currentIndex = request.current_stage_index;

    if (request.is_completed) return 100;
    return Math.round((currentIndex / totalStages) * 100);
  };

  const getCurrentStage = (request) => {
    if (request.is_completed) return "Completed";
    return request.document_types.required_stages[request.current_stage_index];
  };

  return (
    {/* L12 FIX: Added dark mode support */}
    <div className={`spatial-glass rounded-3xl p-6 border hover:shadow-2xl hover:shadow-green-500/10 transition-all duration-300 ${isDark ? "border-slate-700/50 bg-slate-800/50" : "border-gray-200/50"}`}>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h4 className={`text-xl font-bold mb-2 ${isDark ? "text-white" : "text-gray-900"}`}>
            {request.document_types.name}
          </h4>
          <p className={`text-sm flex items-center gap-2 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            Created{" "}
            {new Date(request.created_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>
        <span
          className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider ${
            request.current_status === "completed"
              ? "bg-green-100 text-green-700"
              : request.current_status === "approved"
                ? "bg-blue-100 text-blue-700"
                : request.current_status === "on_hold"
                  ? "bg-red-100 text-red-700"
                  : "bg-yellow-100 text-yellow-700"
          }`}
        >
          {request.current_status.replace("_", " ")}
        </span>
      </div>

      <div className={`mb-6 p-4 rounded-2xl border ${isDark ? "bg-green-900/20 border-green-800/30" : "bg-green-50 border-green-100"}`}>
        <p className={`text-sm font-bold mb-1 ${isDark ? "text-gray-300" : "text-gray-700"}`}>Current Stage</p>
        <p className="text-lg font-bold text-green-600 capitalize flex items-center gap-2">
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
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          {getCurrentStage(request)}
        </p>
      </div>

      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          {request.document_types.required_stages.map((stage, index) => (
            <div key={stage} className="flex flex-col items-center flex-1">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 transition-all shadow-lg ${
                  index <= request.current_stage_index
                    ? "bg-gradient-to-br from-green-400 to-emerald-500 text-white shadow-green-500/50"
                    : (isDark ? "bg-slate-700 text-gray-400" : "bg-gray-100 text-gray-400")
                }`}
              >
                {index < request.current_stage_index || request.is_completed ? (
                  <svg
                    className="w-7 h-7"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  <span className="text-sm font-bold">{index + 1}</span>
                )}
              </div>
              <p
                className={`text-xs font-bold capitalize ${
                  index <= request.current_stage_index
                    ? "text-green-600"
                    : (isDark ? "text-gray-500" : "text-gray-400")
                }`}
              >
                {stage}
              </p>
            </div>
          ))}
        </div>

        <div className={`w-full rounded-full h-3 shadow-inner ${isDark ? "bg-slate-700" : "bg-gray-100"}`}>
          <div
            className="bg-gradient-to-r from-green-400 to-emerald-500 h-3 rounded-full transition-all duration-500 shadow-lg"
            style={{ width: `${calculateProgress(request)}%` }}
          ></div>
        </div>
        <p className={`text-xs mt-2 text-right font-semibold ${isDark ? "text-gray-400" : "text-gray-500"}`}>
          {calculateProgress(request)}% Complete
        </p>
      </div>

      {request.is_completed && (
        <div className="mt-4">
          <CertificateDownload
            requestId={request.id}
            userId={studentId}
            isCompleted={request.is_completed}
          />
        </div>
      )}

      <div className="mt-4">
        <DocumentUpload
          requestId={request.id}
          userId={studentId}
          isOwner={true}
          isAdmin={false}
        />
      </div>

      <div className="mt-4">
        <RequestComments
          requestId={request.id}
          userId={studentId}
          userRole="student"
        />
      </div>

      {(request.current_status === "pending" ||
        request.current_status === "on_hold") && (
        <div className={`pt-6 border-t flex gap-3 ${isDark ? "border-slate-700" : "border-gray-200"}`}>
          {request.current_status === "on_hold" && (
            <button
              onClick={() => onResubmit(request.id)}
              disabled={loading}
              className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-3 px-6 rounded-full shadow-lg shadow-yellow-500/30 transition-all hover:scale-105 disabled:opacity-50 flex-1 sm:flex-none flex items-center justify-center gap-2"
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
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Resubmit
            </button>
          )}

          <button
            onClick={() => onDelete(request.id, request.document_types.name)}
            disabled={loading}
            className="bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-6 rounded-full shadow-lg shadow-red-500/30 transition-all hover:scale-105 disabled:opacity-50 flex-1 sm:flex-none flex items-center justify-center gap-2"
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
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
