import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import { getRequestCertificate, generateCertificate } from "../../services/api";

export default function CertificateDownload({
  requestId,
  userId,
  isCompleted,
}) {
  const [certificate, setCertificate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const fetchCertificate = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getRequestCertificate(requestId, userId);
      if (response.success) {
        setCertificate(response.certificate);
      }
    } catch (error) {
      console.error("Error fetching certificate:", error);
    } finally {
      setLoading(false);
    }
  }, [requestId, userId]);

  useEffect(() => {
    if (isCompleted) {
      fetchCertificate();
    } else {
      setLoading(false);
    }
  }, [isCompleted, fetchCertificate]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const response = await generateCertificate(requestId, userId);
      if (response.success) {
        toast.success("Certificate generated successfully!");
        setCertificate(response.certificate);
      } else {
        toast.error(response.error || "Failed to generate certificate");
      }
    } catch (error) {
      toast.error("Error generating certificate: " + error.message);
    } finally {
      setGenerating(false);
    }
  };

  if (!isCompleted) {
    return null;
  }

  if (loading) {
    return (
      <div className="card">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          <p className="text-gray-500 text-sm mt-2">Loading certificate...</p>
        </div>
      </div>
    );
  }

  if (!certificate) {
    return (
      <div className="card bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-10 h-10 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
              />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            Generate Your Certificate
          </h3>
          <p className="text-gray-600 mb-6">
            Your clearance is complete! Generate your official certificate now.
          </p>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="btn-primary"
          >
            {generating ? "Generating..." : "Generate Certificate"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
      <div className="flex items-center gap-4 mb-4">
        <div className="w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center flex-shrink-0">
          <svg
            className="w-10 h-10 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
            />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="text-xl font-bold text-gray-900 mb-1">
            🎉 Clearance Certificate Ready!
          </h3>
          <p className="text-gray-600">
            Your official clearance certificate is available for download
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg p-4 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-gray-600">Certificate Number:</span>
            <p className="font-mono font-semibold text-gray-900">
              {certificate.certificate_number}
            </p>
          </div>
          <div>
            <span className="text-gray-600">Verification Code:</span>
            <p className="font-mono font-semibold text-gray-900">
              {certificate.verification_code}
            </p>
          </div>
          <div className="sm:col-span-2">
            <span className="text-gray-600">Generated:</span>
            <p className="font-semibold text-gray-900">
              {new Date(certificate.generated_at).toLocaleString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <a
          href={certificate.certificate_url}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary flex-1 flex items-center justify-center gap-2"
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
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          Download Certificate
        </a>
        <button
          onClick={() => {
            navigator.clipboard.writeText(certificate.verification_code);
            toast.success("Verification code copied!");
          }}
          className="btn-secondary flex items-center gap-2"
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
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
          Copy Code
        </button>
      </div>

      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex gap-2">
          <svg
            className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">Certificate Verification</p>
            <p>
              This certificate can be verified using the verification code
              above. Keep it safe for future reference.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
