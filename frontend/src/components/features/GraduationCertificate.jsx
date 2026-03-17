import { useEffect, useState, useCallback } from "react";
import { useTheme } from "../../contexts/ThemeContext";
import { authAxios } from "../../services/api";

const API_URL = import.meta.env.VITE_API_URL;

export default function GraduationCertificate({ requestId, studentId, studentInfo }) {
  const [certificateData, setCertificateData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { isDarkMode } = useTheme();

  const fetchCertificateData = useCallback(async () => {
    try {
      const response = await authAxios.get(
        `graduation/status/${studentId}`,
      );
      if (response.data.success && response.data.request) {
        const req = response.data.request;
        // Merge student profile info since the request row doesn't carry it
        req.student_name = req.student_name || studentInfo?.full_name || "N/A";
        req.student_number = req.student_number || studentInfo?.student_number || "N/A";
        req.course_year = req.course_year || studentInfo?.course_year || "N/A";
        setCertificateData(req);
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

  const handlePrint = async () => {
    const { default: jsPDF } = await import("jspdf");
    const { default: html2canvas } = await import("html2canvas");
    const QRCode = (await import("qrcode")).default;

    const currentDateStr = certificateData.certificate_generated_at
      ? new Date(certificateData.certificate_generated_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
      : new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

    const verifyUrl = `${window.location.origin}/verify/${certificateData.certificate_number}`;
    let qrDataUrl = "";
    try {
      qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: 90, margin: 1 });
    } catch (_) {}

    const container = document.createElement("div");
    container.style.cssText = "position:absolute;left:-9999px;top:0;width:794px;background:#fff;";
    container.innerHTML = `
      <div style="font-family:'Times New Roman',Times,serif;color:#000;width:794px;background:#fff;padding:40px 60px;border:8px double #166534;box-sizing:border-box;">
        <div style="text-align:center;margin-bottom:8px;">
          <img src="${window.location.origin}/IsabelaLogo.jpg" style="width:70px;height:70px;display:block;margin:0 auto 6px;" crossorigin="anonymous" />
          <div style="font-size:16px;font-weight:bold;letter-spacing:3px;text-transform:uppercase;">ISABELA STATE UNIVERSITY</div>
          <div style="font-size:10px;font-style:italic;">Echague, Isabela</div>
        </div>
        <div style="width:40px;height:3px;background:#166534;margin:8px auto 16px;"></div>
        <div style="text-align:center;margin-bottom:20px;">
          <div style="font-size:18px;font-weight:bold;color:#166534;letter-spacing:2px;">GRADUATION CLEARANCE CERTIFICATE</div>
          <div style="font-size:10px;color:#666;margin-top:4px;">Certificate No: <span style="font-family:monospace;font-weight:bold;">${certificateData.certificate_number}</span></div>
        </div>
        <div style="text-align:center;font-size:13px;color:#333;margin-bottom:10px;">This is to certify that</div>
        <div style="text-align:center;margin-bottom:16px;">
          <div style="font-size:22px;font-weight:bold;color:#000;border-bottom:2px solid #333;display:inline-block;padding:0 30px 4px;">${certificateData.student_name || "N/A"}</div>
        </div>
        <table style="width:60%;margin:0 auto 16px;font-size:11px;border:none;" cellpadding="0" cellspacing="0">
          <tr>
            <td style="width:50%;padding:3px 0;"><strong>Student Number:</strong></td>
            <td style="padding:3px 0;">${certificateData.student_number || "N/A"}</td>
          </tr>
          <tr>
            <td style="padding:3px 0;"><strong>Course/Program:</strong></td>
            <td style="padding:3px 0;">${certificateData.course_year || "N/A"}</td>
          </tr>
        </table>
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:12px 20px;margin-bottom:16px;text-align:center;font-size:12px;color:#333;line-height:1.6;">
          has fulfilled all <strong>academic</strong>, <strong>library</strong>, and <strong>financial obligations</strong> required for graduation and is hereby cleared to participate in the commencement exercises.
        </div>
        <div style="text-align:center;font-size:11px;color:#333;margin-bottom:24px;">
          <strong>Date Issued:</strong> ${currentDateStr}
        </div>
        <table style="width:80%;margin:0 auto;border:none;font-size:10px;" cellpadding="0" cellspacing="0">
          <tr>
            <td style="width:45%;text-align:center;padding-top:40px;">
              <div style="border-top:1.5px solid #333;display:inline-block;min-width:180px;padding-top:4px;font-weight:bold;">Registrar Name</div>
              <div style="font-size:9px;color:#666;margin-top:2px;">University Registrar</div>
            </td>
            <td style="width:10%;"></td>
            <td style="width:45%;text-align:center;padding-top:40px;">
              <div style="border-top:1.5px solid #333;display:inline-block;min-width:180px;padding-top:4px;font-weight:bold;">Campus Director</div>
              <div style="font-size:9px;color:#666;margin-top:2px;">ISU Campus Director</div>
            </td>
          </tr>
        </table>
        <div style="display:flex;align-items:flex-end;justify-content:space-between;margin-top:24px;border-top:1px solid #ccc;padding-top:10px;">
          <div style="flex:1;text-align:center;font-size:8px;color:#999;">
            This certificate is valid and verifiable. For verification, contact the Office of the Registrar.<br/>
            Generated on ${currentDateStr}
          </div>
          ${qrDataUrl ? `<div style="flex-shrink:0;margin-left:15px;text-align:center;">
            <img src="${qrDataUrl}" style="width:55px;height:55px;" />
            <div style="font-size:7px;color:#888;margin-top:1px;">Scan to verify</div>
          </div>` : ""}
        </div>
      </div>
    `;
    document.body.appendChild(container);

    const img = container.querySelector("img");
    if (img && !img.complete) {
      await new Promise((resolve) => { img.onload = resolve; img.onerror = resolve; });
    }

    try {
      const canvas = await html2canvas(container.firstElementChild, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        width: 794,
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      const pdfBlob = pdf.output("blob");
      const pdfUrl = URL.createObjectURL(pdfBlob);
      window.open(pdfUrl, "_blank");
    } finally {
      document.body.removeChild(container);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8" role="status" aria-label="Loading certificate">
        <div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!certificateData || !certificateData.certificate_generated) {
    return (
      <div className={`p-8 text-center ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
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
      {/* F8: Dark-mode aware toolbar */}
      <div className="flex justify-end gap-3 print:hidden">
        <button
          onClick={handlePrint}
          className={`px-6 py-2 rounded-lg font-medium transition-all shadow-md flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 ${
            isDarkMode
              ? "bg-green-600 text-white hover:bg-green-500 focus:ring-offset-gray-900"
              : "bg-green-500 text-white hover:bg-green-600"
          }`}
          aria-label="Download certificate as PDF"
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
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          Download PDF
        </button>
      </div>

      {/* Certificate document — always light for print fidelity */}
      <div className={`bg-white p-8 sm:p-12 border-8 border-double border-green-700 rounded-lg shadow-2xl print:shadow-none print:border-black ${
        isDarkMode ? "ring-1 ring-white/10" : ""
      }`}>
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

    </div>
  );
}
