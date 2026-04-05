import { useState, useCallback, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import {
  verifyStudentID,
  validateImageQuality,
} from "../../services/idVerification";
import { detectFace } from "../../services/faceVerification";

const STUDENT_NUMBER_INPUT_PATTERN = /^\d{2}-\d{3,5}(?:-[A-Z]{1,3})?$/;
const SHOW_OCR_DEBUG = false;

// ─── OCR Digit Substitution Map ─────────────────────────────────
// Common characters that Tesseract misreads as digits or vice versa
const OCR_DIGIT_SUBSTITUTIONS = {
  O: "0",
  Q: "0",
  D: "0",
  I: "1",
  L: "1",
  l: "1",
  "|": "1",
  "!": "1",
  Z: "2",
  z: "2",
  S: "5",
  s: "5",
  B: "8",
  G: "6",
  g: "9",
  q: "9",
  A: "4",
  T: "7",
};

// ─── OCR Letter Substitution Map ─────────────────────────────────
// Common characters that Tesseract misreads when they should be letters
const OCR_LETTER_SUBSTITUTIONS = {
  "0": "O",
  "1": "I",
  "5": "S",
  "8": "B",
  "6": "G",
  "4": "A",
  "7": "T",
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
    .replace(/0/g, "O")
    .replace(/1/g, "I")
    .replace(/!/g, "T")
    .replace(/\|/g, "I")
    .replace(/7/g, "T")
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

  // Year must match exactly or differ by at most 1 digit
  const yearDiff = countDigitDifferences(expected.year, candidate.year);
  if (yearDiff > 1) return false;

  // Serial length should be similar
  const eLenSerial = (expected.serial || "").length;
  const cLenSerial = (candidate.serial || "").length;
  if (Math.abs(eLenSerial - cLenSerial) > 1) return false;

  // Use Levenshtein distance for serial comparison (more permissive)
  const serialDist = levenshteinDistance(expected.serial, candidate.serial);
  // Allow up to 2 character differences for longer serials
  const maxDist = eLenSerial >= 4 ? 2 : 1;
  return serialDist <= maxDist;
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

// ─── Enhanced Candidate Extraction ──────────────────────────────
// More robust patterns that handle various OCR artifacts

function extractStudentNumberCandidates(ocrText) {
  const text = String(ocrText || "")
    .toUpperCase()
    .replace(/[–—]/g, "-");

  // Characters that OCR might substitute for digits in student numbers
  const D = "[0-9OILSBZGQDTA|!]";

  // Label-before patterns: "Student No: XX-XXXXX"
  const labelBeforePatterns = [
    new RegExp(
      `STUD(?:ENT)?\\s*(?:NUMBER|NO\\.?|N(?:UM)?|#|ID)\\s*[:#\\-.]?\\s*(${D}{2})\\s*[\\-./\\s]?\\s*(${D}{3,5})(?:\\s*[\\-]\\s*([A-Z5]{1,3}))?`,
      "g",
    ),
    new RegExp(
      `(?:NO\\.?|NUMBER|NUM|#|ID)\\s*[:#\\-.]?\\s*(${D}{2})\\s*[\\-./\\s]?\\s*(${D}{3,5})(?:\\s*[\\-]\\s*([A-Z5]{1,3}))?`,
      "g",
    ),
  ];

  // Label-after patterns: "XX-XXXXX Student No"
  const labelAfterPatterns = [
    new RegExp(
      `(${D}{2})\\s*[\\-./\\s]?\\s*(${D}{3,5})(?:\\s*[\\-]\\s*([A-Z5]{1,3}))?\\s*(?=STUD(?:ENT)?\\s*(?:NUMBER|NO\\.?|N))`,
      "g",
    ),
  ];

  // Suffix patterns: "XX-XXXXX-TS" (also handles OCR garbles like "! S", "|S", "7S")
  const SUFFIX_CHARS = "[A-Z0-9!|]";
  const withSuffixPatterns = [
    // With dash: "24-2984-TS"
    new RegExp(
      `\\b(${D}{2})\\s*[\\-./\\s]?\\s*(${D}{3,5})\\s*[\\-]\\s*(${SUFFIX_CHARS}{1,3})\\b`,
      "g",
    ),
    // With space/punctuation instead of dash: "24 2984 !S" or "24 2984 ! S"
    new RegExp(
      `\\b(${D}{2})\\s*[\\-./\\s]?\\s*(${D}{3,5})\\s+([!|7T][S5])\\b`,
      "g",
    ),
    // Suffix glued or separated by space: "24 2984! S" or "24 2984 T S"
    new RegExp(
      `\\b(${D}{2})\\s*[\\-./\\s]?\\s*(${D}{3,5})\\s*[\\-\\s.]*([!|7T]\\s*[S5])`,
      "g",
    ),
  ];

  // Base patterns: "XX-XXXXX" (dash required for less false positives)
  const basePatterns = [
    new RegExp(`\\b(${D}{2})\\s*[\\-.]\\s*(${D}{3,5})\\b`, "g"),
    // Without dash but only if near student keywords
    new RegExp(
      `(?:STUD|NO\\.?|ID)\\s*.{0,5}?(${D}{2})\\s*(${D}{3,5})\\b`,
      "g",
    ),
  ];

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

    // Validate year is reasonable (00-99)
    const yearNum = parseInt(year, 10);
    if (isNaN(yearNum)) return;

    const canonical = toCanonicalStudentNumber({ year, serial, suffix });
    candidates.set(canonical, { year, serial, suffix });
  };

  let match;

  // Process in priority order
  for (const pattern of labelBeforePatterns) {
    while ((match = pattern.exec(text)) !== null) {
      addCandidate(match[1], match[2], match[3]);
    }
  }

  for (const pattern of labelAfterPatterns) {
    while ((match = pattern.exec(text)) !== null) {
      addCandidate(match[1], match[2], match[3]);
    }
  }

  for (const pattern of withSuffixPatterns) {
    while ((match = pattern.exec(text)) !== null) {
      addCandidate(match[1], match[2], match[3]);
    }
  }

  for (const pattern of basePatterns) {
    while ((match = pattern.exec(text)) !== null) {
      addCandidate(match[1], match[2]);
    }
  }

  return Array.from(candidates.values());
}

// ─── Student Number Matching ────────────────────────────────────

/**
 * Check if raw OCR text contains a suffix like "TS" near a digit group.
 * Handles OCR artifacts: !, |, 7 → T and 5 → S.
 */
function ocrTextHasSuffixNearby(ocrText, suffix) {
  if (!suffix) return true;
  const upper = String(ocrText || "").toUpperCase();

  // Generate fuzzy variants of the suffix (e.g., TS → [TS, !S, 7S, T5, !5, 75, |S])
  const suffixVariants = new Set([suffix]);
  const charVariants = {
    T: ["T", "!", "7", "|", "F"],
    S: ["S", "5"],
    I: ["I", "1", "|", "!", "L"],
    O: ["O", "0", "Q"],
  };

  if (suffix.length === 2) {
    const c1Variants = charVariants[suffix[0]] || [suffix[0]];
    const c2Variants = charVariants[suffix[1]] || [suffix[1]];
    for (const a of c1Variants) {
      for (const b of c2Variants) {
        suffixVariants.add(a + b);
        suffixVariants.add(a + " " + b); // space-separated: "! S"
      }
    }
  }

  for (const variant of suffixVariants) {
    if (upper.includes(variant)) return true;
  }
  return false;
}

function studentNumberMatchesOCR(expectedStudentNumber, ocrText) {
  const parsedExpected = parseStudentNumber(expectedStudentNumber);
  if (!parsedExpected) return false;

  const expectedSuffix = normalizeSuffix(parsedExpected.suffix);
  const candidates = extractStudentNumberCandidates(ocrText);

  // Check for TS candidates to prevent non-TS students from using TS IDs
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

  // ── Strategy 1: Candidate matching with fuzzy suffix ─────────
  const matchedByCandidates = candidates.some((candidate) => {
    if (!isLikelySameStudentNumber(parsedExpected, candidate)) {
      return false;
    }

    const candidateSuffix = normalizeSuffix(candidate.suffix);

    // No suffix expected and no suffix found → match
    if (!expectedSuffix && !candidateSuffix) return true;

    // No suffix expected but candidate has TS → reject
    if (!expectedSuffix && candidateSuffix === "TS") return false;

    // No suffix expected, candidate has non-TS suffix → accept (probably noise)
    if (!expectedSuffix && candidateSuffix && candidateSuffix !== "TS") return true;

    // Suffix expected: fuzzy match (allow 1 char difference)
    if (expectedSuffix && candidateSuffix) {
      return levenshteinDistance(expectedSuffix, candidateSuffix) <= 1;
    }

    // Suffix expected but candidate has none: check if suffix is nearby in raw text
    if (expectedSuffix && !candidateSuffix) {
      return ocrTextHasSuffixNearby(ocrText, expectedSuffix);
    }

    return false;
  });

  if (matchedByCandidates) return true;

  // ── Strategy 2: Digits-only matching (ignores suffix parsing) ──
  // If digits match closely, verify suffix exists somewhere in OCR text
  const matchedByDigitsOnly = candidates.some((candidate) => {
    if (!isLikelySameStudentNumber(parsedExpected, candidate)) return false;
    // Digits match! If suffix is expected, just confirm it's somewhere in the text
    if (expectedSuffix) {
      return ocrTextHasSuffixNearby(ocrText, expectedSuffix);
    }
    return true;
  });

  if (matchedByDigitsOnly) return true;

  // ── Strategy 3: Sliding window digit matching (all students) ──
  const upperText = String(ocrText || "")
    .toUpperCase()
    .replace(/[–—]/g, "-");
  const expectedDigits = `${parsedExpected.year}${parsedExpected.serial}`;

  // Check if there's a student-related label
  const hasStudentLabel = /(STUDENT\s*(NUMBER|NO|N|NUM)|STUD\.?\s*NO)/.test(
    upperText,
  );

  // For suffix students, also require suffix text be present in OCR
  const suffixOk = !expectedSuffix || ocrTextHasSuffixNearby(ocrText, expectedSuffix);

  if (suffixOk) {
    // With a student label, allow more tolerance
    if (
      hasStudentLabel &&
      hasApproximateDigitsWindow(expectedDigits, upperText, 2)
    ) {
      return true;
    }

    // Without label, moderate tolerance
    if (hasApproximateDigitsWindow(expectedDigits, upperText, 2)) {
      return true;
    }
  }

  // ── Strategy 4: Serial-only search (last resort) ──────────────
  // Just look for the serial number digits in the OCR text
  if (parsedExpected.serial && parsedExpected.serial.length >= 4) {
    const serialFound = hasApproximateDigitsWindow(
      parsedExpected.serial, upperText, 1,
    );
    if (serialFound && suffixOk) {
      return true;
    }
  }

  return false;
}

// ─── Enhanced Name Matching ─────────────────────────────────────

/**
 * Fuzzy name matching that handles OCR artifacts in names
 * Uses multiple strategies: exact, substring, phonetic proximity,
 * character-level edit distance
 */
function fuzzyNameMatch(expectedName, ocrText) {
  if (!expectedName || expectedName.length < 2) return true; // Skip very short names

  const expected = expectedName.trim().toLowerCase();
  const text = ocrText.toLowerCase();

  // Strategy 1: Exact substring match
  if (text.includes(expected)) return true;

  // Strategy 2: First N characters match (N = min(length, 4))
  const prefixLen = Math.min(expected.length, 4);
  if (prefixLen >= 3 && text.includes(expected.substring(0, prefixLen))) {
    return true;
  }

  // Strategy 3: OCR-normalized match
  // Apply common OCR letter substitutions and check again
  const ocrVariants = generateOCRNameVariants(expected);
  for (const variant of ocrVariants) {
    if (text.includes(variant)) return true;
  }

  // Strategy 4: Word-level search with Levenshtein distance
  // Split OCR text into words and find close matches
  const ocrWords = text
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3);

  for (const word of ocrWords) {
    if (word.length < 3) continue;
    const dist = levenshteinDistance(expected, word);
    // Allow 1 error for short names, 2 for long ones
    const maxDist = expected.length <= 5 ? 1 : 2;
    if (dist <= maxDist) return true;

    // Also check if expected name is a substantial substring of a word
    if (word.length > expected.length && word.includes(expected.substring(0, 3))) {
      return true;
    }
  }

  // Strategy 5: Check for name split across words
  // e.g., "DELA CRUZ" might be OCR'd as "DE LA CRUZ" or "DELAC RUZ"
  const noSpaceText = text.replace(/\s+/g, "");
  const noSpaceExpected = expected.replace(/\s+/g, "");
  if (noSpaceText.includes(noSpaceExpected)) return true;
  if (
    noSpaceExpected.length >= 4 &&
    noSpaceText.includes(noSpaceExpected.substring(0, 4))
  ) {
    return true;
  }

  return false;
}

/**
 * Generate common OCR misread variants of a name
 */
function generateOCRNameVariants(name) {
  const variants = new Set();
  const chars = name.split("");

  // Single character substitutions
  const substitutions = {
    i: ["l", "1", "|", "!"],
    l: ["i", "1", "|"],
    o: ["0", "q"],
    "0": ["o", "q"],
    "1": ["i", "l"],
    s: ["5"],
    "5": ["s"],
    b: ["8", "6"],
    g: ["9", "q"],
    a: ["4"],
    e: ["c"],
    c: ["e", "("],
    n: ["m", "ri"],
    m: ["n", "rn"],
    u: ["v", "ii"],
    v: ["u", "y"],
    w: ["vv"],
    r: ["n"],
    h: ["b"],
    d: ["cl", "a"],
    t: ["f", "7"],
    f: ["t"],
  };

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const subs = substitutions[ch];
    if (subs) {
      for (const sub of subs) {
        const variant = chars.slice(0, i).join("") + sub + chars.slice(i + 1).join("");
        variants.add(variant);
      }
    }
  }

  // Common OCR artifacts: rn→m, m→rn
  const nameStr = name;
  if (nameStr.includes("rn")) {
    variants.add(nameStr.replace(/rn/g, "m"));
  }
  if (nameStr.includes("m")) {
    variants.add(nameStr.replace(/m/g, "rn"));
  }
  if (nameStr.includes("cl")) {
    variants.add(nameStr.replace(/cl/g, "d"));
  }
  if (nameStr.includes("d")) {
    variants.add(nameStr.replace(/d/g, "cl"));
  }

  return Array.from(variants);
}

// ─── Debug ──────────────────────────────────────────────────────

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

// ─── Image Resize ───────────────────────────────────────────────

function resizeImage(file, maxDim = 1600) {
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
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
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

// ─── Component ──────────────────────────────────────────────────

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
  // UX-004 FIX: Track whether student number passed via soft-pass (OCR couldn't match)
  const [studentNumSoftPass, setStudentNumSoftPass] = useState(false);
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
      // SEC-002 FIX: Validate MIME type on drop — don't rely solely on startsWith("image/")
      const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/bmp"];
      if (file && ALLOWED_TYPES.includes(file.type)) {
        handleIDUploadRef.current?.(file);
      } else if (file) {
        setVerificationResult({
          success: false,
          title: "Unsupported File Type",
          message: `"${file.type || "unknown"}" is not supported. Please upload a JPEG, PNG, or WebP image.`,
          tips: ["Accepted formats: JPG, JPEG, PNG, WebP", "SVG and GIF files are not accepted"],
        });
      }
    },
    [uploading],
  );

  const handleIDUpload = async (file) => {
    if (!file) return;

    // SEC-001 FIX: Validate file size — prevent browser tab crashes from oversized images
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_FILE_SIZE) {
      setVerificationResult({
        success: false,
        title: "File Too Large",
        message: `This file is ${(file.size / (1024 * 1024)).toFixed(1)}MB. Please upload an image smaller than 10MB.`,
        tips: [
          "Compress or resize the image before uploading",
          "Take the photo at a lower resolution",
          "Use a photo editing app to reduce the file size",
        ],
      });
      return;
    }

    // SEC-002 FIX: Validate MIME type — block SVG (XSS vector) and non-image files
    const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/bmp"];
    if (!ALLOWED_TYPES.includes(file.type)) {
      setVerificationResult({
        success: false,
        title: "Unsupported File Type",
        message: `"${file.type || "unknown"}" is not supported. Please upload a JPEG, PNG, or WebP image.`,
        tips: ["Accepted formats: JPG, JPEG, PNG, WebP", "SVG and GIF files are not accepted"],
      });
      return;
    }

    setUploading(true);
    setVerificationResult(null);
    setOcrProgress(0);
    setProcessingStage("ocr");
    setStudentNumSoftPass(false); // UX-004 FIX: Reset on new upload

    try {
      const processFile = await resizeImage(file, 2400);

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
        const reason = idVerification.rejectionReason;
        const isNonISU = reason && reason.startsWith("a ");

        let title = "Invalid Student ID";
        let message =
          "We couldn't verify this as an ISU student ID. Please upload a clear photo of your official Isabela State University student ID card.";
        let tips = [
          "Make sure the ISU logo and university name are visible",
          "Ensure your name and student number are readable",
          "Avoid uploading other types of IDs (driver's license, national ID, etc.)",
        ];

        if (isNonISU) {
          title = "Not a Valid ISU Student ID";
          message = `This appears to be ${reason}. Only official Isabela State University (ISU) student IDs are accepted for verification.`;
          tips = [
            "Upload your official ISU student ID card only",
            "Government IDs, high school IDs, and IDs from other schools are not accepted",
            "Make sure the ISU university name is visible on the card",
          ];
        } else if (reason === "no ISU-specific indicators found") {
          title = "Unrecognized ID";
          message =
            "We could not identify this as an ISU student ID. Make sure the university name or your student number is clearly visible in the photo.";
          tips = [
            "Lay the ID flat on a well-lit surface with no shadows",
            "Ensure the ISU logo, university name, and student number are all in frame",
            "Avoid glare from holographic security overlays",
            "Try retaking the photo with better lighting",
          ];
        }

        setVerificationResult({ success: false, title, message, tips });
        setUploading(false);
        return;
      }

      // ─── Name Verification (Enhanced Fuzzy Matching) ──────
      if (firstName && lastName) {
        const ocrText = (
          idVerification.details?.extractedText || ""
        ).toLowerCase();

        const formLastName = lastName.trim().toLowerCase();
        const formFirstName = firstName.trim().toLowerCase();

        const lastNameFound = fuzzyNameMatch(formLastName, ocrText);
        const firstNameFound = fuzzyNameMatch(formFirstName, ocrText);

        if (!lastNameFound && !firstNameFound) {
          setVerificationResult({
            success: false,
            title: "Name Does Not Match",
            message: `The name detected on the uploaded ID does not match the name you entered (${firstName} ${lastName}). You must upload your own student ID.`,
            tips: [
              "Ensure you're uploading your own ISU student ID",
              "Check that the name on Step 1 matches your ID exactly",
              "If the text is hard to read, try better lighting or a flat angle",
            ],
          });
          setUploading(false);
          return;
        }
      }

      // ─── Student Number Verification ──────────────────────
      // Holographic overlays on ISU cards make student numbers
      // extremely hard for client-side OCR. The backend already
      // validates format + uniqueness, and face verification
      // prevents impersonation, so we use a tiered approach:
      //   - Hard block on invalid format (catches typos)
      //   - OCR match attempt (catches obvious mismatches)
      //   - Soft pass when OCR can't read the number but ISU
      //     validation + name match already succeeded
      if (studentNumber) {
        const expectedStudentNumber = normalizeStudentNumber(studentNumber);
        const ocrRaw =
          idVerification.details?.extractedTextRaw ||
          idVerification.details?.extractedText ||
          "";

        if (!STUDENT_NUMBER_INPUT_PATTERN.test(expectedStudentNumber)) {
          setVerificationResult({
            success: false,
            title: "Invalid Student Number Format",
            message:
              "The student number you entered doesn't follow the expected format. Please go back and correct it.",
            tips: [
              "Use the format: 23-1234 or 23-1234-TS",
              "The first two digits are your enrollment year",
              "Add -TS at the end if you are a transferee student",
            ],
          });
          setUploading(false);
          return;
        }

        const matchFound = studentNumberMatchesOCR(
          expectedStudentNumber,
          ocrRaw,
        );

        if (!matchFound) {
          const isuConfidence = idVerification.confidence || 0;
          const nameAlreadyVerified = firstName && lastName;

          if (isuConfidence >= 60 && nameAlreadyVerified) {
            // UX-004 FIX: Flag the soft-pass so the success UI shows accurate status
            setStudentNumSoftPass(true);
            if (import.meta.env.DEV) {
              console.log(
                "%cStudent number OCR match failed — soft pass (ISU confidence %d%%, name verified)",
                "color:#f59e0b;font-weight:bold",
                isuConfidence,
              );
            }
          } else {
            setVerificationResult({
              success: false,
              title: "Student Number Mismatch",
              message: `The student number "${studentNumber}" you entered does not match the one detected on your ID. Please verify and try again.`,
              tips: [
                "Double-check the student number you entered on the previous step",
                "If you're a transferee, include the -TS suffix (e.g., 23-2984-TS)",
                "Retake the photo with the student number area clearly visible",
              ],
            });
            setUploading(false);
            return;
          }
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
          title: "Face Not Detected",
          message:
            "We couldn't detect a face on the uploaded ID photo. A visible face is required to proceed with verification.",
          tips: [
            "Make sure your ID photo area is not covered or obscured",
            "Avoid excessive glare on the face portion of the ID",
            "Upload a higher resolution image if possible",
          ],
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
        title: "Processing Error",
        message:
          "Something went wrong while processing your ID. This may be due to a temporary issue.",
        tips: [
          "Try uploading the image again",
          "Use a different photo of your student ID",
          "Make sure your internet connection is stable",
        ],
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
          <div className={`mt-3 text-xs space-y-1 ${isDark ? "text-gray-500" : "text-gray-400"}`}>
            <p>📸 Use good lighting • Avoid glare and shadows</p>
            <p>🔍 Ensure all text is readable and in focus</p>
          </div>
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
            accept="image/jpeg,image/png,image/webp,image/bmp"
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
                  {processingStage === "face_detect"
                    ? "Detecting face..."
                    : "Analyzing your ID (multi-pass OCR)..."}
                </p>
                <p className={`text-xs mt-1 ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                  Enhanced recognition — this may take a moment
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
                  className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}
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
                    : "Reading ID text (multi-pass)..."}
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
              {processingStage === "ocr" && ocrProgress > 0 && ocrProgress < 100 && (
                <p
                  className={`text-xs mt-1 ${isDark ? "text-gray-500" : "text-gray-400"}`}
                >
                  {/* UX-003 FIX: 7 OCR variants, not 5 */}
                  Pass {Math.min(Math.ceil(ocrProgress / (100 / 7)), 7)} of 7 — analyzing with different image filters...
                </p>
              )}
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
            className={`mt-6 p-5 rounded-2xl border ${
              isDark
                ? "bg-red-500/10 border-red-500/20"
                : "bg-red-50 border-red-100"
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                  isDark ? "bg-red-500/20" : "bg-red-100"
                }`}
              >
                <svg
                  className={`w-5 h-5 ${isDark ? "text-red-400" : "text-red-600"}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                  />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h4
                  className={`font-bold text-sm ${
                    isDark ? "text-red-400" : "text-red-800"
                  }`}
                >
                  {verificationResult.title || "Verification Failed"}
                </h4>
                <p
                  className={`text-sm mt-1 leading-relaxed ${
                    isDark ? "text-red-300/80" : "text-red-700/80"
                  }`}
                >
                  {verificationResult.message}
                </p>
                {verificationResult.tips && verificationResult.tips.length > 0 && (
                  <div
                    className={`mt-3 pt-3 border-t ${
                      isDark ? "border-red-500/15" : "border-red-200/60"
                    }`}
                  >
                    <p
                      className={`text-xs font-semibold mb-1.5 ${
                        isDark ? "text-red-400/70" : "text-red-600/70"
                      }`}
                    >
                      How to fix this:
                    </p>
                    <ul className="space-y-1">
                      {verificationResult.tips.map((tip, i) => (
                        <li
                          key={i}
                          className={`text-xs flex items-start gap-1.5 ${
                            isDark ? "text-red-300/60" : "text-red-600/60"
                          }`}
                        >
                          <span className="mt-0.5 flex-shrink-0">•</span>
                          <span>{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
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
                  { label: "Valid ISU ID", passed: true },
                  // UX-004 FIX: Show accurate status when student number was soft-passed
                  {
                    label: studentNumSoftPass
                      ? "Student No. (Needs Review)"
                      : "Student No. Matched",
                    passed: !studentNumSoftPass,
                  },
                  { label: "Name Matched", passed: true },
                  { label: "Face Detected", passed: true },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-2">
                    <svg
                      className={`w-4 h-4 flex-shrink-0 ${
                        item.passed
                          ? isDark ? "text-green-400" : "text-green-600"
                          : isDark ? "text-amber-400" : "text-amber-600"
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d={item.passed ? "M5 13l4 4L19 7" : "M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"}
                      />
                    </svg>
                    <span
                      className={`text-sm font-medium ${
                        item.passed
                          ? isDark ? "text-green-300" : "text-green-700"
                          : isDark ? "text-amber-300" : "text-amber-700"
                      }`}
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
