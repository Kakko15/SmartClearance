import { useEffect, useState, useCallback, useRef } from "react";
import { useTheme } from "../../contexts/ThemeContext";
import { authAxios } from "../../services/api";

export default function GraduationCertificate({
  requestId,
  studentId,
  studentInfo,
}) {
  const [certificateData, setCertificateData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");
  const { isDarkMode } = useTheme();
  const certRef = useRef(null);

  const fetchCertificateData = useCallback(async () => {
    try {
      const response = await authAxios.get(`graduation/status/${studentId}`);
      if (response.data.success && response.data.request) {
        const req = response.data.request;
        req.student_name = req.student_name || studentInfo?.full_name || "N/A";
        req.student_number =
          req.student_number || studentInfo?.student_number || "N/A";
        req.course_year = req.course_year || studentInfo?.course_year || "N/A";
        req.professorApprovals = response.data.professorApprovals || [];
        setCertificateData(req);
      }
    } catch (error) {
      console.error("Error fetching certificate data:", error);
    } finally {
      setLoading(false);
    }
  }, [studentId, studentInfo]);

  useEffect(() => {
    fetchCertificateData();
  }, [requestId, fetchCertificateData]);

  useEffect(() => {
    const generateQr = async () => {
      if (certificateData?.certificate_number) {
        const verifyUrl = `${window.location.origin}/verify/${certificateData.certificate_number}`;
        try {
          const QRCode = (await import("qrcode")).default;
          const url = await QRCode.toDataURL(verifyUrl, {
            width: 100,
            margin: 1,
          });
          setQrCodeDataUrl(url);
        } catch (e) {
          console.error("Failed to generate QR code", e);
        }
      }
    };
    generateQr();
  }, [certificateData]);

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatDateShort = (dateStr) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const issuedDate = certificateData?.certificate_generated_at
    ? formatDate(certificateData.certificate_generated_at)
    : formatDate(new Date().toISOString());

  const appliedDate = certificateData?.created_at
    ? formatDate(certificateData.created_at)
    : "";

  const portionLabel =
    certificateData?.portion === "graduate"
      ? "Graduate Portion"
      : "Undergraduate Portion";

  const getClearedStages = () => {
    if (!certificateData) return [];
    const stages = [];
    const approvals = certificateData.professorApprovals || [];
    const findProf = (name) =>
      approvals.find((a) => a.professor?.full_name === name);

    const isUndergrad = certificateData.portion !== "graduate";
    const stageList = isUndergrad
      ? [
          { name: "Department Chairman", type: "prof" },
          { name: "College Dean", type: "prof" },
          { name: "Director Student Affairs", type: "prof" },
          {
            name: "Campus Librarian",
            type: "admin",
            dateField: "library_approved_at",
          },
          {
            name: "Chief Accountant",
            type: "admin",
            dateField: "cashier_approved_at",
          },
          { name: "NSTP Director", type: "prof" },
          { name: "Executive Officer", type: "prof" },
        ]
      : [
          {
            name: "Chief Accountant",
            type: "admin",
            dateField: "cashier_approved_at",
          },
          {
            name: "Campus Librarian",
            type: "admin",
            dateField: "library_approved_at",
          },
          {
            name: "Student's Record Evaluator",
            type: "admin",
            dateField: "registrar_approved_at",
          },
          { name: "Dean Graduate School", type: "prof" },
        ];

    for (const s of stageList) {
      let date = "";
      if (s.type === "prof") {
        const prof = findProf(s.name);
        date = prof?.approved_at
          ? formatDateShort(prof.approved_at)
          : "Cleared";
      } else {
        date = certificateData[s.dateField]
          ? formatDateShort(certificateData[s.dateField])
          : "Cleared";
      }
      stages.push({ name: s.name, date });
    }
    return stages;
  };

  const handlePrint = async () => {
    const { default: jsPDF } = await import("jspdf");
    const { default: html2canvas } = await import("html2canvas");
    const QRCode = (await import("qrcode")).default;

    const verifyUrl = `${window.location.origin}/verify/${certificateData.certificate_number}`;
    let qrDataUrl = "";
    try {
      qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: 100, margin: 1 });
    } catch (_) {}

    const stages = getClearedStages();
    const stageRows = stages
      .map(
        (s, i) => `
      <tr>
        <td style="border:1px solid #c5c5c5;padding:4px 10px;text-align:center;font-size:10px;color:#555;">${i + 1}</td>
        <td style="border:1px solid #c5c5c5;padding:4px 10px;font-size:10px;">${s.name}</td>
        <td style="border:1px solid #c5c5c5;padding:4px 10px;text-align:center;font-size:10px;color:#166534;font-weight:600;">✓ CLEARED</td>
        <td style="border:1px solid #c5c5c5;padding:4px 10px;text-align:center;font-size:10px;color:#555;">${s.date}</td>
      </tr>
    `,
      )
      .join("");

    const container = document.createElement("div");
    container.style.cssText =
      "position:absolute;left:-9999px;top:0;width:794px;background:#fff;";
    container.innerHTML = `
      <div style="font-family:'Times New Roman',Times,serif;color:#1a1a1a;width:794px;background:#fff;padding:0;box-sizing:border-box;position:relative;">
        <!-- Outer decorative border -->
        <div style="border:3px solid #166534;margin:8px;padding:0;">
          <div style="border:1px solid #166534;margin:4px;padding:35px 50px;">

            <!-- Header -->
            <div style="text-align:center;margin-bottom:6px;">
              <div style="display:flex;align-items:center;justify-content:center;gap:16px;margin-bottom:4px;">
                <img src="${window.location.origin}/IsabelaLogo.jpg" style="width:65px;height:65px;" crossorigin="anonymous" />
                <div>
                  <div style="font-size:11px;letter-spacing:4px;text-transform:uppercase;color:#333;">Republic of the Philippines</div>
                  <div style="font-size:20px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:#166534;margin:2px 0;">Isabela State University</div>
                  <div style="font-size:10px;color:#555;font-style:italic;">Echague, Isabela, Philippines</div>
                </div>
              </div>
            </div>

            <div style="width:100%;height:2px;background:linear-gradient(to right,transparent,#166534,transparent);margin:10px 0 18px;"></div>

            <!-- Title -->
            <div style="text-align:center;margin-bottom:18px;">
              <div style="font-size:12px;letter-spacing:6px;text-transform:uppercase;color:#888;margin-bottom:4px;">Office of the Registrar</div>
              <div style="font-size:22px;font-weight:bold;color:#166534;letter-spacing:3px;text-transform:uppercase;">Graduation Clearance Certificate</div>
              <div style="font-size:10px;color:#777;margin-top:6px;letter-spacing:1px;">${portionLabel.toUpperCase()}</div>
            </div>

            <!-- Certificate number -->
            <div style="text-align:center;margin-bottom:16px;">
              <span style="font-size:10px;color:#888;">Certificate No: </span>
              <span style="font-family:'Courier New',monospace;font-size:11px;font-weight:bold;color:#333;background:#f5f5f5;padding:2px 8px;border-radius:3px;">${certificateData.certificate_number}</span>
            </div>

            <!-- Body -->
            <div style="text-align:center;font-size:13px;color:#444;margin-bottom:8px;">This is to certify that</div>

            <div style="text-align:center;margin-bottom:14px;">
              <div style="font-size:26px;font-weight:bold;color:#1a1a1a;border-bottom:2px solid #1a1a1a;display:inline-block;padding:0 40px 4px;letter-spacing:1px;">${(certificateData.student_name || "N/A").toUpperCase()}</div>
            </div>

            <!-- Student details -->
            <table style="margin:0 auto 14px;font-size:11px;border:none;" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:2px 12px 2px 0;color:#666;text-align:right;">Student No.:</td>
                <td style="padding:2px 0;font-weight:bold;">${certificateData.student_number || "N/A"}</td>
                <td style="padding:2px 12px 2px 30px;color:#666;text-align:right;">Program:</td>
                <td style="padding:2px 0;font-weight:bold;">${certificateData.course_year || "N/A"}</td>
              </tr>
              <tr>
                <td style="padding:2px 12px 2px 0;color:#666;text-align:right;">Date Applied:</td>
                <td style="padding:2px 0;font-weight:bold;">${appliedDate}</td>
                <td style="padding:2px 12px 2px 30px;color:#666;text-align:right;">Date Completed:</td>
                <td style="padding:2px 0;font-weight:bold;">${issuedDate}</td>
              </tr>
            </table>

            <!-- Certification text -->
            <div style="text-align:center;font-size:12px;color:#333;line-height:1.7;margin-bottom:16px;padding:0 20px;">
              has satisfactorily complied with and fulfilled all <strong>academic</strong>, <strong>library</strong>,
              and <strong>financial obligations</strong> as prescribed by the University, and is hereby
              <strong>cleared</strong> of all accountabilities required for graduation.
            </div>

            <!-- Clearance summary table -->
            <div style="margin-bottom:16px;">
              <div style="font-size:10px;font-weight:bold;text-transform:uppercase;letter-spacing:2px;color:#555;margin-bottom:6px;text-align:center;">Clearance Summary</div>
              <table style="width:90%;margin:0 auto;border-collapse:collapse;font-size:10px;" cellpadding="0" cellspacing="0">
                <thead>
                  <tr style="background:#f8faf8;">
                    <th style="border:1px solid #c5c5c5;padding:5px 8px;text-align:center;font-size:9px;color:#555;width:30px;">No.</th>
                    <th style="border:1px solid #c5c5c5;padding:5px 8px;text-align:left;font-size:9px;color:#555;">Office / Signatory</th>
                    <th style="border:1px solid #c5c5c5;padding:5px 8px;text-align:center;font-size:9px;color:#555;width:80px;">Status</th>
                    <th style="border:1px solid #c5c5c5;padding:5px 8px;text-align:center;font-size:9px;color:#555;width:100px;">Date Cleared</th>
                  </tr>
                </thead>
                <tbody>${stageRows}</tbody>
              </table>
            </div>

            <!-- Signatories -->
            <table style="width:90%;margin:20px auto 0;border:none;font-size:10px;" cellpadding="0" cellspacing="0">
              <tr>
                <td style="width:45%;text-align:center;padding-top:35px;vertical-align:bottom;">
                  <div style="border-top:1.5px solid #333;display:inline-block;min-width:180px;padding-top:4px;font-weight:bold;font-size:11px;">University Registrar</div>
                  <div style="font-size:9px;color:#666;margin-top:2px;">Office of the Registrar</div>
                </td>
                <td style="width:10%;"></td>
                <td style="width:45%;text-align:center;padding-top:35px;vertical-align:bottom;">
                  <div style="border-top:1.5px solid #333;display:inline-block;min-width:180px;padding-top:4px;font-weight:bold;font-size:11px;">Campus Executive Director</div>
                  <div style="font-size:9px;color:#666;margin-top:2px;">ISU Echague Campus</div>
                </td>
              </tr>
            </table>

            <!-- Footer with QR -->
            <div style="display:flex;align-items:flex-end;justify-content:space-between;margin-top:20px;border-top:1px solid #ddd;padding-top:10px;">
              <div style="flex:1;font-size:8px;color:#999;line-height:1.5;">
                <strong>Effectivity: February 20, 2024</strong>&nbsp;&nbsp;&nbsp;&nbsp;<strong>Revision: 0</strong><br/>
            <em>Isui-ReO-Stc-001f</em><br/><br/>
            <em>This document is system-generated by the ISU SmartClearance System.</em><br/>
                For verification, scan the QR code or visit the Office of the Registrar.<br/>
                Document ID: ${certificateData.certificate_number} &nbsp;|&nbsp; Issued: ${issuedDate}
              </div>
              ${
                qrDataUrl
                  ? `<div style="flex-shrink:0;margin-left:15px;text-align:center;">
                <img src="${qrDataUrl}" style="width:60px;height:60px;" />
                <div style="font-size:7px;color:#888;margin-top:2px;">Scan to verify</div>
              </div>`
                  : ""
              }
            </div>

          </div>
        </div>
      </div>
    `;
    document.body.appendChild(container);

    const imgs = container.querySelectorAll("img");
    await Promise.all(
      [...imgs].map((img) =>
        img.complete
          ? Promise.resolve()
          : new Promise((r) => {
              img.onload = r;
              img.onerror = r;
            }),
      ),
    );

    try {
      const canvas = await html2canvas(container.firstElementChild, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        width: 794,
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      const pdfBlob = pdf.output("blob");
      window.open(URL.createObjectURL(pdfBlob), "_blank");
    } finally {
      document.body.removeChild(container);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        {}
        <div className="flex justify-end gap-3">
          <div
            className={`w-40 h-10 rounded-lg ${isDarkMode ? "bg-slate-800" : "bg-gray-200"}`}
          ></div>
        </div>

        {}
        <div
          className={`p-8 sm:p-12 border-8 border-double rounded-lg shadow-xl ${isDarkMode ? "bg-slate-900 border-slate-700 ring-1 ring-white/5" : "bg-white border-gray-100"}`}
        >
          <div className="text-center mb-8 flex flex-col items-center">
            {}
            <div
              className={`h-24 w-24 rounded-full mb-4 ${isDarkMode ? "bg-slate-800" : "bg-gray-200"}`}
            ></div>
            {}
            <div
              className={`w-3/4 max-w-md h-8 rounded mb-4 ${isDarkMode ? "bg-slate-800" : "bg-gray-200"}`}
            ></div>
            <div className="w-32 h-1 bg-green-600/20 mx-auto mb-4"></div>
            <div
              className={`w-1/2 max-w-sm h-6 rounded mb-4 ${isDarkMode ? "bg-slate-800" : "bg-gray-200"}`}
            ></div>
            <div
              className={`w-1/4 h-4 rounded mt-2 ${isDarkMode ? "bg-slate-800" : "bg-gray-200"}`}
            ></div>
          </div>

          <div className="space-y-6 text-center flex flex-col items-center">
            <div
              className={`w-48 h-5 rounded ${isDarkMode ? "bg-slate-800" : "bg-gray-200"}`}
            ></div>

            <div className="py-4">
              <div
                className={`w-64 h-10 rounded mb-2 ${isDarkMode ? "bg-slate-800" : "bg-gray-200"}`}
              ></div>
              <div
                className={`w-64 h-0.5 mx-auto ${isDarkMode ? "bg-slate-700" : "bg-gray-300"}`}
              ></div>
            </div>

            <div className="grid grid-cols-2 gap-4 max-w-md w-full mx-auto text-left">
              <div>
                <div
                  className={`w-24 h-4 rounded mb-2 ${isDarkMode ? "bg-slate-800" : "bg-gray-200"}`}
                ></div>
                <div
                  className={`w-32 h-5 rounded ${isDarkMode ? "bg-slate-800" : "bg-gray-300"}`}
                ></div>
              </div>
              <div>
                <div
                  className={`w-20 h-4 rounded mb-2 ${isDarkMode ? "bg-slate-800" : "bg-gray-200"}`}
                ></div>
                <div
                  className={`w-40 h-5 rounded ${isDarkMode ? "bg-slate-800" : "bg-gray-300"}`}
                ></div>
              </div>
            </div>

            <div
              className={`w-full max-w-2xl py-6 px-8 rounded-lg mt-8 ${isDarkMode ? "bg-slate-800/50" : "bg-gray-100"}`}
            >
              <div
                className={`w-full h-4 rounded mb-2 ${isDarkMode ? "bg-slate-700" : "bg-gray-200"}`}
              ></div>
              <div
                className={`w-5/6 h-4 rounded mx-auto ${isDarkMode ? "bg-slate-700" : "bg-gray-200"}`}
              ></div>
            </div>

            <div className="pt-8">
              <div
                className={`w-24 h-4 rounded mx-auto mb-2 ${isDarkMode ? "bg-slate-800" : "bg-gray-200"}`}
              ></div>
              <div
                className={`w-32 h-6 rounded mx-auto ${isDarkMode ? "bg-slate-800" : "bg-gray-300"}`}
              ></div>
            </div>

            <div className="pt-12 grid grid-cols-2 gap-8 max-w-2xl w-full mx-auto">
              <div className="text-center flex flex-col items-center">
                <div
                  className={`w-48 h-0.5 mb-4 ${isDarkMode ? "bg-slate-700" : "bg-gray-400"}`}
                ></div>
                <div
                  className={`w-32 h-5 rounded mb-2 ${isDarkMode ? "bg-slate-800" : "bg-gray-200"}`}
                ></div>
                <div
                  className={`w-24 h-4 rounded ${isDarkMode ? "bg-slate-800" : "bg-gray-200"}`}
                ></div>
              </div>
              <div className="text-center flex flex-col items-center">
                <div
                  className={`w-48 h-0.5 mb-4 ${isDarkMode ? "bg-slate-700" : "bg-gray-400"}`}
                ></div>
                <div
                  className={`w-40 h-5 rounded mb-2 ${isDarkMode ? "bg-slate-800" : "bg-gray-200"}`}
                ></div>
                <div
                  className={`w-24 h-4 rounded ${isDarkMode ? "bg-slate-800" : "bg-gray-200"}`}
                ></div>
              </div>
            </div>
          </div>

          <div
            className={`mt-12 pt-6 border-t flex items-end justify-between gap-4 ${isDarkMode ? "border-slate-800" : "border-gray-200"}`}
          >
            <div className="space-y-2 w-full max-w-sm">
              <div
                className={`w-full h-3 rounded ${isDarkMode ? "bg-slate-800" : "bg-gray-200"}`}
              ></div>
              <div
                className={`w-3/4 h-3 rounded ${isDarkMode ? "bg-slate-800" : "bg-gray-200"}`}
              ></div>
              <div
                className={`w-1/2 h-3 rounded ${isDarkMode ? "bg-slate-800" : "bg-gray-200"}`}
              ></div>
            </div>
            <div className="flex-shrink-0 flex flex-col items-center">
              <div
                className={`w-[80px] h-[80px] rounded ${isDarkMode ? "bg-slate-800" : "bg-gray-200"}`}
              ></div>
              <div
                className={`w-16 h-2 rounded mt-2 ${isDarkMode ? "bg-slate-800" : "bg-gray-200"}`}
              ></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!certificateData) {
    return (
      <div
        className={`p-8 text-center ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}
      >
        Certificate data not found
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {}
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

      {}
      <div
        className={`bg-white p-8 sm:p-12 border-8 border-double border-green-700 rounded-lg shadow-2xl print:shadow-none print:border-black ${
          isDarkMode ? "ring-1 ring-white/10" : ""
        }`}
      >
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
          <p className="text-xs text-gray-500 mt-2">
            {portionLabel.toUpperCase()}
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
              <p className="text-sm text-gray-600">Program:</p>
              <p className="font-semibold text-gray-900">
                {certificateData.course_year || "N/A"}
              </p>
            </div>
          </div>

          <div className="py-6 px-8 bg-green-50 rounded-lg border border-green-200 mt-8">
            <p className="text-base text-gray-800 leading-relaxed">
              has fulfilled all <strong>academic</strong>,{" "}
              <strong>library</strong>, and{" "}
              <strong>financial obligations</strong> required for graduation and
              is hereby cleared to participate in the commencement exercises.
            </p>
          </div>

          <div className="pt-8">
            <p className="text-sm text-gray-600 mb-1">Date Issued:</p>
            <p className="font-semibold text-gray-900 text-lg">{issuedDate}</p>
          </div>

          <div className="pt-12 grid grid-cols-2 gap-8 max-w-2xl mx-auto">
            <div className="text-center">
              <div className="border-t-2 border-gray-400 pt-2 mb-2">
                <p className="font-semibold text-gray-900">
                  University Registrar
                </p>
              </div>
              <p className="text-sm text-gray-600">Office of the Registrar</p>
            </div>
            <div className="text-center">
              <div className="border-t-2 border-gray-400 pt-2 mb-2">
                <p className="font-semibold text-gray-900">
                  Campus Executive Director
                </p>
              </div>
              <p className="text-sm text-gray-600">ISU Echague Campus</p>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-gray-300 flex items-end justify-between gap-4">
          <div className="text-xs text-gray-500 text-left leading-relaxed">
            <strong>Effectivity: February 20, 2024</strong>
            &nbsp;&nbsp;&nbsp;&nbsp;<strong>Revision: 0</strong>
            <br />
            <em>Isui-ReO-Stc-001f</em>
            <br />
            <br />
            <em>
              This document is system-generated by the ISU SmartClearance
              System.
            </em>
            <br />
            For verification, scan the QR code or visit the Office of the
            Registrar.
            <br />
            Document ID: {certificateData.certificate_number} &nbsp;|&nbsp;
            Issued: {issuedDate}
          </div>
          {qrCodeDataUrl && (
            <div className="flex-shrink-0 text-center">
              <img
                src={qrCodeDataUrl}
                alt="Verification QR Code"
                className="w-[80px] h-[80px] object-contain ml-auto"
              />
              <div className="text-[10px] text-gray-400 mt-1 uppercase tracking-wider">
                Scan to verify
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
