import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export default function CertificateVerifyPage() {
  const { code } = useParams();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    document.title = "Verify Certificate | ISU Clearance System";
    const verify = async () => {
      try {
        const res = await axios.get(`${API_URL}/certificates/verify/${code}`);
        setResult(res.data);
      } catch (err) {
        setError(err.response?.data?.error || "Verification failed");
      } finally {
        setLoading(false);
      }
    };
    if (code) verify();
  }, [code]);

  const cert = result?.certificate;
  const student = cert?.requests?.profiles;
  const docType = cert?.requests?.document_types;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-green-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg"
      >
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">ISU Smart Clearance</h1>
          <p className="text-sm text-gray-500 mt-1">Certificate Verification</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="w-10 h-10 border-3 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-500 text-sm">Verifying certificate...</p>
            </div>
          ) : error || !result?.valid ? (
            <div className="p-10 text-center">
              <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Invalid Certificate</h2>
              <p className="text-gray-500 text-sm">
                {error || "This certificate could not be verified. It may be invalid or expired."}
              </p>
            </div>
          ) : (
            <>
              {/* Valid badge */}
              <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-6 py-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-white font-bold text-lg">Verified</h2>
                  <p className="text-green-100 text-xs">This certificate is authentic</p>
                </div>
              </div>

              {/* Details */}
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Detail label="Student Name" value={student?.full_name} />
                  <Detail label="Student Number" value={student?.student_number} />
                  <Detail label="Program" value={student?.course_year} />
                  <Detail label="Document Type" value={docType?.name} />
                  <Detail label="Certificate No." value={cert?.certificate_number} />
                  <Detail
                    label="Issued On"
                    value={cert?.created_at ? new Date(cert.created_at).toLocaleDateString("en-US", {
                      year: "numeric", month: "long", day: "numeric",
                    }) : "N/A"}
                  />
                </div>
              </div>
            </>
          )}

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-400">
              Isabela State University — Echague Campus
            </p>
            <Link to="/home" className="text-xs text-green-600 hover:underline mt-1 inline-block">
              Go to Smart Clearance
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div>
      <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">{label}</p>
      <p className="text-sm font-semibold text-gray-900 mt-0.5">{value || "N/A"}</p>
    </div>
  );
}
