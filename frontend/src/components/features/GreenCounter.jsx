import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

export default function GreenCounter() {
  const [paperSaved, setPaperSaved] = useState(0);
  const [loading, setLoading] = useState(true);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    fetchGreenStats();

    const subscription = supabase
      .channel("green-counter")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "requests",
          filter: "is_completed=eq.true",
        },
        () => {
          setAnimating(true);
          fetchGreenStats();
          setTimeout(() => setAnimating(false), 1000);
        },
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchGreenStats = async () => {
    try {
      const { data, error } = await supabase
        .from("green_impact_stats")
        .select("total_paper_saved")
        .single();

      if (error) throw error;

      setPaperSaved(data?.total_paper_saved || 0);
    } catch (error) {
      console.error("Error fetching green stats:", error);
      setPaperSaved(0);
    } finally {
      setLoading(false);
    }
  };

  const calculateImpact = () => {
    const treesPerSheet = 0.00002;
    const co2PerSheet = 0.005;

    return {
      trees: (paperSaved * treesPerSheet).toFixed(4),
      co2: (paperSaved * co2PerSheet).toFixed(2),
    };
  };

  const impact = calculateImpact();

  return (
    <div className="card bg-gradient-to-br from-green-500 via-emerald-500 to-teal-600 text-white overflow-hidden relative">
      <div className="absolute inset-0 opacity-10">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern
              id="leaf-pattern"
              x="0"
              y="0"
              width="40"
              height="40"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M20 5 Q 25 10, 20 15 Q 15 10, 20 5 M20 25 Q 25 30, 20 35 Q 15 30, 20 25"
                fill="currentColor"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#leaf-pattern)" />
        </svg>
      </div>

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <svg
                className="w-7 h-7 text-white"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold">Green Impact</h2>
              <p className="text-green-100 text-sm">Environmental Savings</p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-white bg-opacity-20 px-3 py-1.5 rounded-full backdrop-blur-sm">
            <div className="w-2 h-2 bg-green-300 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium">Live</span>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-pulse text-white text-lg">
              Loading impact data...
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              <div className="bg-white bg-opacity-10 rounded-xl p-6 backdrop-blur-sm">
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0">
                    <svg
                      className="w-16 h-16 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-green-100 text-sm font-medium mb-1">
                      Paper Sheets Saved
                    </p>
                    <div
                      className={`text-5xl font-bold transition-all duration-500 ${animating ? "scale-110" : "scale-100"}`}
                    >
                      {paperSaved.toLocaleString()}
                    </div>
                    <p className="text-green-100 text-sm mt-2">
                      Every completed clearance saves paper 📄
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-white bg-opacity-10 rounded-xl p-4 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-white"
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
                  <div>
                    <p className="text-green-100 text-xs">Trees Saved</p>
                    <p className="text-xl font-bold">{impact.trees}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white bg-opacity-10 rounded-xl p-4 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-white"
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
                  <div>
                    <p className="text-green-100 text-xs">CO₂ Reduced</p>
                    <p className="text-xl font-bold">{impact.co2} kg</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 pt-6 border-t border-white border-opacity-20">
          <div className="flex items-center justify-center gap-2 text-green-100">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <p className="text-sm font-medium">
              Together, we're making a difference for our planet 🌍
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
