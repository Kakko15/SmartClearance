import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";

export default function EnvironmentalImpact({ studentId = null }) {
  const [impact, setImpact] = useState({
    paperSaved: 0,
    treesSaved: 0,
    energySaved: 0,
    co2Reduced: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchImpact = useCallback(async () => {
    try {
      let query = supabase
        .from("requests")
        .select("paper_saved_count")
        .eq("is_completed", true);

      if (studentId) {
        query = query.eq("student_id", studentId);
      }

      const { data, error } = await query;

      if (error) throw error;

      const totalPaper =
        data?.reduce((sum, req) => sum + (req.paper_saved_count || 0), 0) || 0;

      setImpact({
        paperSaved: totalPaper,
        treesSaved: (totalPaper / 8333).toFixed(2),
        energySaved: (totalPaper * 0.006).toFixed(2),
        co2Reduced: (totalPaper * 0.005).toFixed(2),
      });
    } catch (error) {
      console.error("Error fetching impact:", error);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    fetchImpact();
  }, [fetchImpact]);

  if (loading) {
    return (
      <div className="card animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="card bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <svg
              className="w-7 h-7 text-green-600"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            Environmental Impact
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            {studentId ? "Your personal contribution" : "School-wide impact"}
          </p>
        </div>
        <button
          onClick={fetchImpact}
          className="text-green-600 hover:text-green-700 transition-colors"
          title="Refresh"
        >
          <svg
            className="w-6 h-6"
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
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg
                className="w-6 h-6 text-blue-600"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M9 2a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V6.414A2 2 0 0016.414 5L14 2.586A2 2 0 0012.586 2H9z" />
                <path d="M3 8a2 2 0 012-2v10h8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {impact.paperSaved.toLocaleString()}
          </p>
          <p className="text-sm text-gray-600">Sheets Saved</p>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <svg
                className="w-6 h-6 text-green-600"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {impact.treesSaved}
          </p>
          <p className="text-sm text-gray-600">Trees Saved</p>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
              <svg
                className="w-6 h-6 text-yellow-600"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {impact.energySaved}
          </p>
          <p className="text-sm text-gray-600">kWh Saved</p>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <svg
                className="w-6 h-6 text-purple-600"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.912-2.706C6.512 5.73 6.974 6 7.5 6A1.5 1.5 0 019 7.5V8a2 2 0 004 0 2 2 0 011.523-1.943A5.977 5.977 0 0116 10c0 .34-.028.675-.083 1H15a2 2 0 00-2 2v2.197A5.973 5.973 0 0110 16v-2a2 2 0 00-2-2 2 2 0 01-2-2 2 2 0 00-1.668-1.973z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {impact.co2Reduced}
          </p>
          <p className="text-sm text-gray-600">kg CO₂ Reduced</p>
        </div>
      </div>

      {impact.paperSaved > 0 && (
        <div className="mt-6 p-4 bg-white rounded-xl border-2 border-green-200">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <svg
                className="w-6 h-6 text-green-600"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Did you know?</p>
              <p className="text-sm text-gray-600 mt-1">
                {impact.paperSaved >= 8333
                  ? `You've saved enough paper to equal ${Math.floor(impact.paperSaved / 8333)} tree${Math.floor(impact.paperSaved / 8333) > 1 ? "s" : ""}! 🌳`
                  : `You're ${(8333 - impact.paperSaved).toLocaleString()} sheets away from saving a full tree! Keep going! 🌱`}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
