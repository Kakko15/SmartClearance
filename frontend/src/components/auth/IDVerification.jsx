import { useState, useCallback, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import {
  verifyStudentID,
  validateImageQuality,
} from "../../services/idVerification";
import { detectFace } from "../../services/faceVerification";

const STUDENT_NUMBER_INPUT_PATTERN = /^\d{2}-\d{3,5}(?:-[A-Z]{1,3})?$/;
const SHOW_OCR_DEBUG = false;
const OCR_DIGIT_SUBSTITUTIONS = {
  O: "0",
  Q: "0",
  D: "0",
  I: "1",
  L: "1",
  Z: "2",
  S: "5",
  B: "8",
  G: "6",
};

function normalizeStudentNumber(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9-]/g, "");
}

function parseStudentNumber(value) {
  const normalized = normalizeStudentNumber(value);
  const match = normalized.match(/^(\d{2})-?(\d{3,5})(?:-?([A-Z]{1,3}))?$/);
  if (!match) return null;

  return {
    year: match[1],
    serial: match[2],
    suffix: match[3] || "",
  };
}

function normalizeOcrDigits(value, expectedLength) {
  const upper = String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  const mapped = upper
    .split("")
    .map((ch) => OCR_DIGIT_SUBSTITUTIONS[ch] ?? ch)
    .join("");
  const digits = mapped.replace(/[^0-9]/g, "");
  if (expectedLength && digits.length !== expectedLength) return "";
  return digits;
}

function normalizeSuffix(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/5/g, "S")
    .replace(/[^A-Z]/g, "");
}

function countDigitDifferences(a, b) {
  if (!a || !b || a.length !== b.length) return Number.POSITIVE_INFINITY;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) diff += 1;
  }
  return diff;
}

function levenshteinDistance(a, b) {
  const s = String(a || "");
  const t = String(b || "");
  if (s === t) return 0;
  if (!s.length) return t.length;
  if (!t.length) return s.length;

  const rows = s.length + 1;
  const cols = t.length + 1;
  const dist = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let i = 0; i < rows; i++) dist[i][0] = i;
  for (let j = 0; j < cols; j++) dist[0][j] = j;

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      dist[i][j] = Math.min(
        dist[i - 1][j] + 1,
        dist[i][j - 1] + 1,
        dist[i - 1][j - 1] + cost,
      );
    }
  }

  return dist[s.length][t.length];
}

function isLikelySameStudentNumber(expected, candidate) {
  if (!expected || !candidate) return false;
  if (candidate.year !== expected.year) return false;
  if ((candidate.serial || "").length !== (expected.serial || "").length)
    return false;

  const serialDiff = countDigitDifferences(expected.serial, candidate.serial);
  return serialDiff <= 1;
}

function hasApproximateDigitsWindow(expectedDigits, ocrText, maxDiff = 1) {
  const digitsText = normalizeOcrDigits(ocrText);
  if (!expectedDigits || expectedDigits.length < 4 || !digitsText) return false;

  const len = expectedDigits.length;
  const minLen = Math.max(1, len - maxDiff);
  const maxLen = len + maxDiff;

  for (let windowLen = minLen; windowLen <= maxLen; windowLen++) {
    if (digitsText.length < windowLen) continue;

    for (let i = 0; i <= digitsText.length - windowLen; i++) {
      const window = digitsText.slice(i, i + windowLen);
      if (levenshteinDistance(window, expectedDigits) <= maxDiff) {
        return true;
      }
    }
  }

  return false;
}

function toCanonicalStudentNumber({ year, serial, suffix }) {
  return `${year}-${serial}${suffix ? `-${suffix}` : ""}`;
}

function extractStudentNumberCandidates(ocrText) {
  const text = String(ocrText || "")
    .toUpperCase()
    .replace(/[–—]/g, "-");
  const labelAfterPattern =
    /\b([0-9OILSBZGQ]{2})\s*[-./\s]?\s*([0-9OILSBZGQ]{3,5})(?:\s*[-]\s*([A-Z5]{1,3}))?\s*(?=STUDENT\s*(?:NUMBER|NO|N)\b)/g;
  const labelBeforePattern =
    /STUDENT\s*(?:NUMBER|NO|N)\b\s*[:#-]?\s*([0-9OILSBZGQ]{2})\s*[-./\s]?\s*([0-9OILSBZGQ]{3,5})(?:\s*[-]\s*([A-Z5]{1,3}))?/g;
  const withSuffixPattern =
    /\b([0-9OILSBZGQ]{2})\s*[-./\s]?\s*([0-9OILSBZGQ]{3,5})\s*[-]\s*([A-Z5]{1,3})\b/g;
  const basePattern =
    /\b([0-9OILSBZGQ]{2})\s*[-./\s]?\s*([0-9OILSBZGQ]{3,5})\b/g;
  const candidates = new Map();

  const addCandidate = (rawYear, rawSerial, rawSuffix = "") => {
    const year = normalizeOcrDigits(rawYear, 2);
    const serialLength = String(rawSerial || "").replace(
      /[^A-Z0-9]/gi,
      "",
    ).length;
    const serial = normalizeOcrDigits(rawSerial, serialLength);
    const suffix = normalizeSuffix(rawSuffix);

    if (!year || !serial || serial.length < 3 || serial.length > 5) return;

    const canonical = toCanonicalStudentNumber({ year, serial, suffix });
    candidates.set(canonical, { year, serial, suffix });
  };

  let match;
  while ((match = labelAfterPattern.exec(text)) !== null) {
    addCandidate(match[1], match[2], match[3]);
  }

  while ((match = labelBeforePattern.exec(text)) !== null) {
    addCandidate(match[1], match[2], match[3]);
  }

  while ((match = withSuffixPattern.exec(text)) !== null) {
    addCandidate(match[1], match[2], match[3]);
  }

  while ((match = basePattern.exec(text)) !== null) {
    addCandidate(match[1], match[2]);
  }

  return Array.from(candidates.values());
}

function studentNumberMatchesOCR(expectedStudentNumber, ocrText) {
  const parsedExpected = parseStudentNumber(expectedStudentNumber);
  if (!parsedExpected) return false;

  const expectedSuffix = normalizeSuffix(parsedExpected.suffix);
  const candidates = extractStudentNumberCandidates(ocrText);

  const hasLikelyTsCandidate = candidates.some((candidate) => {
    const candidateSuffix = normalizeSuffix(candidate.suffix);
    return (
      candidateSuffix === "TS" &&
      isLikelySameStudentNumber(parsedExpected, candidate)
    );
  });

  if (!expectedSuffix && hasLikelyTsCandidate) {
    return false;
  }

  const matchedByCandidates = candidates.some((candidate) => {
    if (!isLikelySameStudentNumber(parsedExpected, candidate)) {
      return false;
    }

    const candidateSuffix = normalizeSuffix(candidate.suffix);

    if (expectedSuffix === "TS") {
      return candidateSuffix === "TS";
    }

    if (!expectedSuffix) {
      return candidateSuffix !== "TS";
    }

    return candidateSuffix === expectedSuffix;
  });

  if (matchedByCandidates) return true;

  if (!expectedSuffix) {
    const upperText = String(ocrText || "")
      .toUpperCase()
      .replace(/[–—]/g, "-");
    const hasStudentLabel = /(STUDENT\s*(NUMBER|NO|N|NUM)|STUD\.?\s*NO)/.test(
      upperText,
    );
    const expectedDigits = `${parsedExpected.year}${parsedExpected.serial}`;
    if (
      hasStudentLabel &&
      hasApproximateDigitsWindow(expectedDigits, upperText, 2)
    ) {
      return true;
    }

    if (hasApproximateDigitsWindow(expectedDigits, upperText, 1)) {
      return true;
    }
  }

  return false;
}

function buildOcrDebugSummary(expectedStudentNumber, ocrText) {
  const parsedExpected = parseStudentNumber(expectedStudentNumber);
  const expectedDigits = parsedExpected
    ? `${parsedExpected.year}${parsedExpected.serial}${normalizeSuffix(parsedExpected.suffix) ? `-${normalizeSuffix(parsedExpected.suffix)}` : ""}`
    : expectedStudentNumber;
  const candidates = extractStudentNumberCandidates(ocrText)
    .slice(0, 8)
    .map((candidate) => toCanonicalStudentNumber(candidate));
  const normalizedDigits = normalizeOcrDigits(ocrText);
  const digitPreview = normalizedDigits.slice(0, 36);

  return `OCR debug | expected: ${expectedDigits} | candidates: ${candidates.join(", ") || "none"} | digits: ${digitPreview || "none"}`;
}

function resizeImage(file, maxDim = 1280) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      if (img.width <= maxDim && img.height <= maxDim) {
        resolve(file);
        return;
      }
      const scale = maxDim / Math.max(img.width, img.height);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        resolve(new File([blob], file.name, { type: "image/png" }));
      }, "image/png");
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}

export default function IDVerification({
  onVerified,
  isDark,
  firstName,
  lastName,
  studentNumber,
}) {
  const [uploading, setUploading] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [processingStage, setProcessingStage] = useState("");
  const [verificationResult, setVerificationResult] = useState(null);
  const [idPreview, setIdPreview] = useState(null);
  const [dragging, setDragging] = useState(false);
  const faceDescriptorRef = useRef(null);

  useEffect(() => {
    return () => {
      if (idPreview) URL.revokeObjectURL(idPreview);
    };
  }, [idPreview]);

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragIn = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.items?.length > 0) setDragging(true);
  }, []);

  const handleDragOut = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
  }, []);

  const handleIDUploadRef = useRef(null);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      setDragging(false);
      if (uploading) return;
      const file = e.dataTransfer.files?.[0];
      if (file && file.type.startsWith("image/")) {
        handleIDUploadRef.current?.(file);
      }
    },
    [uploading],
  );

  const handleIDUpload = async (file) => {
    if (!file) return;

    setUploading(true);
    setVerificationResult(null);
    setOcrProgress(0);
    setProcessingStage("ocr");

    try {
      const processFile = await resizeImage(file, 1280);

      await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

      const qualityCheck = await validateImageQuality(processFile);
      if (!qualityCheck.valid) {
        setVerificationResult({ success: false, message: qualityCheck.error });
        setUploading(false);
        return;
      }

      const idVerification = await verifyStudentID(processFile, (progress) => {
        setOcrProgress((prev) => Math.max(prev, progress || 0));
      });

      if (!idVerification.success) {
        setVerificationResult({
          success: false,
          message: idVerification.error || "Invalid ISU student ID",
        });
        setUploading(false);
        return;
      }

      if (firstName && lastName) {
        const ocrText = (
          idVerification.details?.extractedText || ""
        ).toLowerCase();
        const formLastName = lastName.trim().toLowerCase();
        const formFirstName = firstName.trim().toLowerCase();

        const lastNameFound =
          ocrText.includes(formLastName) ||
          (formLastName.length >= 3 &&
            ocrText.includes(formLastName.substring(0, 3)));
        const firstNameFound =
          ocrText.includes(formFirstName) ||
          (formFirstName.length >= 3 &&
            ocrText.includes(formFirstName.substring(0, 3)));

        if (!lastNameFound && !firstNameFound) {
          setVerificationResult({
            success: false,
            message: `Name mismatch! The name on your ID does not match "${firstName} ${lastName}". Please use your own student ID.`,
          });
          setUploading(false);
          return;
        }
      }

      if (studentNumber) {
        const expectedStudentNumber = normalizeStudentNumber(studentNumber);
        const ocrRaw =
          idVerification.details?.extractedTextRaw ||
          idVerification.details?.extractedText ||
          "";

        if (!STUDENT_NUMBER_INPUT_PATTERN.test(expectedStudentNumber)) {
          setVerificationResult({
            success: false,
            message:
              "Invalid student number format. Use format: [Year]-[Digits] (e.g., 23-1234 or 23-1234-TS)",
          });
          setUploading(false);
          return;
        }

        const matchFound = studentNumberMatchesOCR(
          expectedStudentNumber,
          ocrRaw,
        );

        if (!matchFound) {
          const debugText = SHOW_OCR_DEBUG
            ? `\n\n${buildOcrDebugSummary(expectedStudentNumber, ocrRaw)}`
            : "";
          setVerificationResult({
            success: false,
            message: `Student number mismatch! "${studentNumber}" does not match the student number on your ID. Enter your exact student number (e.g., 23-1234-TS if you are a transferee).${debugText}`,
          });
          setUploading(false);
          return;
        }
      }

      setOcrProgress(100);
      setProcessingStage("face_detect");

      await new Promise((r) =>
        requestAnimationFrame(() =>
          requestAnimationFrame(() => setTimeout(r, 50)),
        ),
      );

      const faceDetection = await detectFace(processFile);

      if (!faceDetection.success) {
        setVerificationResult({
          success: false,
          message:
            faceDetection.error ||
            "No face detected in ID. Please upload a clear ID photo showing your face.",
        });
        setUploading(false);
        return;
      }

      if (idPreview) URL.revokeObjectURL(idPreview);
      setIdPreview(URL.createObjectURL(file));
      setVerificationResult({
        success: true,
        message: "ISU Student ID Verified",
      });

      faceDescriptorRef.current = faceDetection.descriptor;
    } catch (error) {
      console.error("ID verification error:", error);
      setVerificationResult({
        success: false,
        message: "Error processing ID. Please try again.",
      });
    } finally {
      setUploading(false);
    }
  };

  handleIDUploadRef.current = handleIDUpload;

  return (
    <div className="max-w-2xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`p-8 rounded-3xl ${isDark ? "bg-slate-800/50" : "bg-white"} border ${isDark ? "border-slate-700" : "border-gray-200"} shadow-xl`}
      >
        <div className="text-center mb-6">
          <div
            className={`w-16 h-16 rounded-full ${isDark ? "bg-blue-500/20" : "bg-blue-100"} flex items-center justify-center mx-auto mb-4`}
          >
            <svg
              className={`w-8 h-8 ${isDark ? "text-blue-400" : "text-blue-600"}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2"
              />
            </svg>
          </div>
          <h3
            className={`text-2xl font-bold mb-2 ${isDark ? "text-white" : "text-gray-900"}`}
          >
            Upload Your ISU Student ID
          </h3>
          <p className={`${isDark ? "text-gray-400" : "text-gray-600"}`}>
            Take a clear photo of your student ID showing your face
          </p>
        </div>

        <div
          onDragEnter={handleDragIn}
          onDragLeave={handleDragOut}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-2xl p-8 text-center transition-colors ${
            dragging
              ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10"
              : isDark
                ? "border-slate-600 hover:border-blue-500 bg-slate-900/50"
                : "border-gray-300 hover:border-blue-500 bg-gray-50"
          }`}
        >
          <input
            type="file"
            accept="image/*"
            onChange={(e) => handleIDUpload(e.target.files[0])}
            className="hidden"
            id="id-upload"
            disabled={uploading}
          />
          <label htmlFor="id-upload" className="cursor-pointer block">
            {uploading ? (
              <div className="flex flex-col items-center">
                <svg
                  className="animate-spin h-10 w-10 text-blue-500 mb-3"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <p
                  className={`font-semibold ${isDark ? "text-white" : "text-gray-900"}`}
                >
                  Processing your ID...
                </p>
              </div>
            ) : dragging ? (
              <div className="flex flex-col items-center">
                <svg
                  className="w-12 h-12 mb-3 text-blue-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3-3m0 0l3 3m-3-3v12"
                  />
                </svg>
                <p className={`font-semibold mb-1 text-blue-600`}>
                  Drop your image here
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <svg
                  className={`w-12 h-12 mb-3 ${isDark ? "text-gray-500" : "text-gray-400"}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <p
                  className={`font-semibold mb-1 ${isDark ? "text-white" : "text-gray-900"}`}
                >
                  Click or drag to upload your Student ID
                </p>
                <p
                  className={`text-sm ${isDark ? "text-gray-500" : "text-gray-500"}`}
                >
                  PNG, JPG up to 10MB
                </p>
              </div>
            )}
          </label>
        </div>

        {uploading &&
          (ocrProgress > 0 || processingStage === "face_detect") && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-6"
            >
              <div className="flex justify-between text-sm mb-2">
                <span className={isDark ? "text-gray-400" : "text-gray-600"}>
                  {processingStage === "face_detect"
                    ? "Detecting face in ID..."
                    : "Reading ID text..."}
                </span>
                <span
                  className={`font-semibold ${isDark ? "text-blue-400" : "text-blue-600"}`}
                >
                  {processingStage === "face_detect" ? "✓" : `${ocrProgress}%`}
                </span>
              </div>
              <div
                role="progressbar"
                aria-valuenow={
                  processingStage === "face_detect" ? 100 : ocrProgress
                }
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={
                  processingStage === "face_detect"
                    ? "Detecting face in ID"
                    : "Reading ID text"
                }
                className={`w-full rounded-full h-2 overflow-hidden ${isDark ? "bg-slate-700" : "bg-gray-200"}`}
              >
                <motion.div
                  className={`h-full rounded-full ${processingStage === "face_detect" ? "bg-green-500" : "bg-blue-500"}`}
                  initial={{ width: 0 }}
                  animate={{
                    width:
                      processingStage === "face_detect"
                        ? "100%"
                        : `${ocrProgress}%`,
                  }}
                  transition={{ duration: 0.3 }}
                />
              </div>
              {processingStage === "face_detect" && (
                <p
                  className={`text-xs mt-1 ${isDark ? "text-gray-500" : "text-gray-400"}`}
                >
                  This may take a few seconds...
                </p>
              )}
            </motion.div>
          )}

        {verificationResult && !verificationResult.success && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mt-6 p-4 rounded-xl border ${isDark ? "bg-red-500/10 border-red-500/30" : "bg-red-50 border-red-200"}`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`flex-shrink-0 ${isDark ? "text-red-400" : "text-red-600"}`}
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <p
                  className={`font-semibold ${isDark ? "text-red-400" : "text-red-800"}`}
                >
                  {verificationResult.message}
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {idPreview && verificationResult?.success && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-6 space-y-4"
          >
            <img
              src={idPreview}
              alt="ID Preview"
              className="w-full rounded-xl border-2 border-green-500/50 shadow-lg"
            />

            <div
              className={`p-4 rounded-xl border ${isDark ? "bg-green-500/10 border-green-500/30" : "bg-green-50 border-green-200"}`}
            >
              <div className="flex items-center gap-2 mb-3">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${isDark ? "bg-green-500/20" : "bg-green-100"}`}
                >
                  <svg
                    className={`w-5 h-5 ${isDark ? "text-green-400" : "text-green-600"}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    />
                  </svg>
                </div>
                <h4
                  className={`font-bold ${isDark ? "text-green-400" : "text-green-800"}`}
                >
                  ID Verification Passed
                </h4>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Valid ISU ID" },
                  { label: "Student No. Matched" },
                  { label: "Name Matched" },
                  { label: "Face Detected" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-2">
                    <svg
                      className={`w-4 h-4 flex-shrink-0 ${isDark ? "text-green-400" : "text-green-600"}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span
                      className={`text-sm font-medium ${isDark ? "text-green-300" : "text-green-700"}`}
                    >
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => {
                if (faceDescriptorRef.current) {
                  onVerified(faceDescriptorRef.current);
                }
              }}
              className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-full shadow-lg transition-all"
            >
              Continue to Face Verification →
            </button>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
