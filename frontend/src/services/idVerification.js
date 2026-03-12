import Tesseract from "tesseract.js";

let cachedWorker = null;
let currentProgressCb = null;

async function getWorker() {
  if (cachedWorker) return cachedWorker;
  const worker = await Tesseract.createWorker("eng", undefined, {
    logger: (m) => {
      if (m.status === "recognizing text" && currentProgressCb) {
        currentProgressCb(Math.round(m.progress * 100));
      }
    },
  });
  cachedWorker = worker;
  return worker;
}

export async function extractTextFromID(imageFile, onProgress = null) {
  try {
    currentProgressCb = onProgress;
    const worker = await getWorker();

    const {
      data: { text },
    } = await worker.recognize(imageFile);

    currentProgressCb = null;

    return {
      success: true,
      text: text.toLowerCase(),
      rawText: text,
    };
  } catch (error) {
    console.error("OCR error:", error);
    currentProgressCb = null;
    cachedWorker = null;
    return {
      success: false,
      error: "Failed to read ID. Please upload a clear photo.",
    };
  }
}

export function verifyISUStudentID(extractedText) {
  const text = extractedText.toLowerCase();
  const rawText = extractedText;

  const universityPatterns = [
    "isabela state university",
    "isabela state",
    "state university",
    "isabela",
    "isu",
    "lsabela",
    "isabeia",
    "lsu",
    "isabe",
    "universi",
    "republic of the philippines",
    "republic",
    "philippines",
  ];
  const hasUniversityName = universityPatterns.some((p) => text.includes(p));

  const locationPatterns = [
    "echague",
    "echag",
    "isabela",
    "campus",
    "santiago",
    "cauayan",
    "cabagan",
    "ilagan",
    "roxas",
    "jones",
    "san mariano",
    "angadanan",
  ];
  const hasLocation = locationPatterns.some((p) => text.includes(p));

  const studentNumberPatterns = [
    /\d{2}[-–—]\d{3,5}([-–—][A-Z]{1,3})?/i,
    /\d{2}\s*[-–—]\s*\d{3,5}/i,
    /\d{2}\d{4}/,
    /\d{2}[-.]\d{3,5}/i,
    /\d{2}[-–—.\s]\d{3,5}[-–—.\s]+[A-Za-z]{1,3}/i,
    /student\s*n/i,
    /student\s*no/i,
  ];
  const hasStudentNumber = studentNumberPatterns.some((p) => p.test(rawText));

  const collegeKeywords = [
    "college",
    "colleg",
    "ollege",
    "computing",
    "comput",
    "omputing",
    "awput",
    "technology",
    "technol",
    "echnology",
    "echnol",
    "student",
    "information",
    "informat",
    "nformation",
    "communication",
    "communic",
    "ommunication",
    "ommunic",
    "engineering",
    "engineer",
    "science",
    "scienc",
    "education",
    "educat",
    "agriculture",
    "agricult",
    "nursing",
    "business",
    "criminology",
    "criminol",
    "studies",
    "studie",
    "bachelor",
    "department",
    "depart",
    "name",
    "number",
    "dean",
    "director",
    "course",
    "gallardo",
    "almario",
  ];
  const hasCollegeKeyword = collegeKeywords.some((kw) => text.includes(kw));

  let confidence = 0;
  if (hasUniversityName) confidence += 35;
  if (hasLocation) confidence += 15;
  if (hasStudentNumber) confidence += 35;
  if (hasCollegeKeyword) confidence += 15;

  const isValid = confidence >= 35;

  return {
    isValid: isValid,
    confidence: confidence,
    checks: {
      hasUniversityName,
      hasLocation,
      hasStudentNumber,
      hasCollegeKeyword,
    },
    extractedText: text,
    message: isValid
      ? `Valid ISU student ID (${confidence}% confidence)`
      : `Invalid ID format (${confidence}% confidence, need 35%)`,
  };
}

export async function verifyStudentID(imageFile, onProgress = null) {
  try {
    const ocrResult = await extractTextFromID(imageFile, onProgress);

    if (!ocrResult.success) {
      return {
        success: false,
        step: "ocr",
        error: ocrResult.error,
      };
    }

    const verification = verifyISUStudentID(ocrResult.text);

    if (!verification.isValid) {
      return {
        success: false,
        step: "validation",
        error: "This does not appear to be a valid ISU student ID.",
        details: verification,
      };
    }

    return {
      success: true,
      confidence: verification.confidence,
      message: verification.message,
      details: verification,
    };
  } catch (error) {
    console.error("ID verification error:", error);
    return {
      success: false,
      error: "Verification failed. Please try again.",
    };
  }
}

export async function validateImageQuality(imageFile) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(imageFile);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const width = img.width;
      const height = img.height;
      const minDimension = 320;

      if (width < minDimension || height < minDimension) {
        resolve({
          valid: false,
          error: `Image too small. Minimum ${minDimension}x${minDimension} pixels required.`,
        });
      } else {
        resolve({
          valid: true,
          width: width,
          height: height,
        });
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({
        valid: false,
        error: "Invalid image file.",
      });
    };

    img.src = url;
  });
}
