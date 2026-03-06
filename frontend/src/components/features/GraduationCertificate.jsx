import { useEffect, useState, useCallback } from "react";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL;

export default function GraduationCertificate({ requestId, studentId }) {
  const [certificateData, setCertificateData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchCertificateData = useCallback(async () => {
    try {
      const response = await axios.get(
        `${API_URL}/graduation/status/${studentId}`,
      );
      if (response.data.success && response.data.request) {
        setCertificateData(response.data.request);
      }
    } catch (error) {
      console.error("Error fetching certificate data:", error);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    fetchCertificateData();
  }, [requestId, fetchCertificateData]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!certificateData || !certificateData.certificate_generated) {
    return (
      <div className="p-8 text-center text-gray-600">
        Certificate not yet generated
      </div>
    );
  }

  const currentDate = certificateData.certificate_generated_at
    ? new Date(certificateData.certificate_generated_at).toLocaleDateString(
        "en-US",
        {
          year: "numeric",
          month: "long",
          day: "numeric",
        },
      )
    : new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

  return (
    <div className="space-y-4">
      <div className="flex justify-end print:hidden">
        <button
          onClick={handlePrint}
          className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium transition-all shadow-md flex items-center gap-2"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
            />
          </svg>
          Print Certificate
        </button>
      </div>

      <div className="bg-white p-12 border-8 border-double border-green-700 rounded-lg shadow-2xl print:shadow-none print:border-black">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <img
              src="/IsabelaLogo.jpg"
              alt="ISU Logo"
              className="h-24 w-24 object-contain"
              onError={(e) => {
                e.target.style.display = "none";
              }}
            />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            ISABELA STATE UNIVERSITY CAMPUS
          </h1>
          <div className="w-32 h-1 bg-green-600 mx-auto mb-4"></div>
          <h2 className="text-2xl font-semibold text-green-700 mb-2">
            GRADUATION CLEARANCE CERTIFICATE
          </h2>
          <p className="text-sm text-gray-600">
            Certificate No:{" "}
            <span className="font-mono font-bold">
              {certificateData.certificate_number}
            </span>
          </p>
        </div>

        <div className="space-y-6 text-center">
          <p className="text-lg text-gray-700 leading-relaxed">
            This is to certify that
          </p>

          <div className="py-4">
            <h3 className="text-3xl font-bold text-gray-900 border-b-2 border-gray-300 inline-block px-8 pb-2">
              {certificateData.student_name}
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-4 max-w-md mx-auto text-left">
            <div>
              <p className="text-sm text-gray-600">Student Number:</p>
              <p className="font-semibold text-gray-900">
                {certificateData.student_number}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Course/Program:</p>
              <p className="font-semibold text-gray-900">
                {certificateData.course_year || "N/A"}
              </p>
            </div>
          </div>

          <div className="py-6 px-8 bg-green-50 rounded-lg border border-green-200">
            <p className="text-base text-gray-800 leading-relaxed">
              has fulfilled all <strong>academic</strong>,{" "}
              <strong>library</strong>, and{" "}
              <strong>financial obligations</strong> required for graduation and
              is hereby cleared to participate in the commencement exercises.
            </p>
          </div>

          <div className="pt-8">
            <p className="text-sm text-gray-600 mb-1">Date Issued:</p>
            <p className="font-semibold text-gray-900 text-lg">{currentDate}</p>
          </div>

          <div className="pt-12 grid grid-cols-2 gap-8 max-w-2xl mx-auto">
            <div className="text-center">
              <div className="border-t-2 border-gray-400 pt-2 mb-2">
                <p className="font-semibold text-gray-900">Registrar Name</p>
              </div>
              <p className="text-sm text-gray-600">University Registrar</p>
            </div>
            <div className="text-center">
              <div className="border-t-2 border-gray-400 pt-2 mb-2">
                <p className="font-semibold text-gray-900">Campus Director</p>
              </div>
              <p className="text-sm text-gray-600">ISU Campus Director</p>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-gray-300 text-center">
          <p className="text-xs text-gray-500">
            This certificate is valid and verifiable. For verification, contact
            the Office of the Registrar.
          </p>
          <p className="text-xs text-gray-400 mt-2">
            Generated on {currentDate}
          </p>
        </div>
      </div>

      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:shadow-none,
          .print\\:shadow-none * {
            visibility: visible;
          }
          .print\\:shadow-none {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .print\\:hidden {
            display: none !important;
          }
          @page {
            size: A4;
            margin: 1cm;
          }
        }
      `}</style>
    </div>
  );
}
