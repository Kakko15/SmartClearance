import Tesseract from "tesseract.js";

// ─── Worker Management ─────────────────────────────────────────
let cachedWorker = null;
let currentProgressCb = null;
let currentProgressPhase = 0;
let currentProgressValue = 0;
let currentTotalPhases = 7;

function emitProgress(progress) {
  if (!currentProgressCb) return;
  const clamped = Math.max(0, Math.min(100, Math.round(progress)));
  currentProgressValue = Math.max(currentProgressValue, clamped);
  currentProgressCb(currentProgressValue);
}

function emitPhaseProgress(phaseIndex, rawPercent) {
  const phaseSize = 100 / currentTotalPhases;
  const base = phaseIndex * phaseSize;
  emitProgress(base + rawPercent * (phaseSize / 100));
}

async function getWorker() {
  if (cachedWorker) return cachedWorker;
  const worker = await Tesseract.createWorker("eng", undefined, {
    logger: (m) => {
      if (m.status === "recognizing text" && currentProgressCb) {
        const raw = Math.round((m.progress ?? 0) * 100);
        emitPhaseProgress(currentProgressPhase, raw);
      }
    },
  });
  await worker.setParameters({
    tessedit_pageseg_mode: "6",
    preserve_interword_spaces: "1",
    user_defined_dpi: "300",
  });
  cachedWorker = worker;
  return worker;
}

// ─── Image Processing Primitives ───────────────────────────────

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(source);
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image load failed")); };
    img.src = url;
  });
}

function imageToCanvas(img, scale = 1, cropRect = null) {
  let sx = 0, sy = 0, sw = img.width, sh = img.height;
  if (cropRect) {
    sx = cropRect.x;
    sy = cropRect.y;
    sw = cropRect.w;
    sh = cropRect.h;
  }
  const w = Math.round(sw * scale);
  const h = Math.round(sh * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
  return { canvas, ctx, width: w, height: h };
}

function canvasToFile(canvas, name = "processed.png") {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob ? new File([blob], name, { type: "image/png" }) : null);
    }, "image/png");
  });
}

// ─── Advanced Image Processing Functions ────────────────────────

function extractChannel(imageData, channel = 1) {
  const { width, height, data } = imageData;
  const result = new Uint8ClampedArray(data.length);
  for (let i = 0; i < data.length; i += 4) {
    const v = data[i + channel];
    result[i] = v;
    result[i + 1] = v;
    result[i + 2] = v;
    result[i + 3] = 255;
  }
  return new ImageData(result, width, height);
}

/**
 * CLAHE — tile-based adaptive histogram equalization with clip limiting.
 * Preserves local contrast across regions with varying illumination,
 * far superior to global histogram eq for ID card photos.
 */
function claheEnhance(imageData, gridX = 8, gridY = 8, clipLimit = 2.5) {
  const { width, height, data } = imageData;
  const result = new Uint8ClampedArray(data.length);

  const tileW = Math.ceil(width / gridX);
  const tileH = Math.ceil(height / gridY);

  const tileLuts = new Array(gridY);
  for (let ty = 0; ty < gridY; ty++) {
    tileLuts[ty] = new Array(gridX);
    for (let tx = 0; tx < gridX; tx++) {
      const x0 = tx * tileW;
      const y0 = ty * tileH;
      const x1 = Math.min(x0 + tileW, width);
      const y1 = Math.min(y0 + tileH, height);

      const hist = new Uint32Array(256);
      let count = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          hist[data[(y * width + x) * 4]]++;
          count++;
        }
      }

      if (count > 0) {
        const clip = Math.max(1, Math.round((clipLimit * count) / 256));
        let excess = 0;
        for (let i = 0; i < 256; i++) {
          if (hist[i] > clip) {
            excess += hist[i] - clip;
            hist[i] = clip;
          }
        }
        const avg = Math.floor(excess / 256);
        const remainder = excess - avg * 256;
        for (let i = 0; i < 256; i++) {
          hist[i] += avg + (i < remainder ? 1 : 0);
        }
      }

      const lut = new Uint8Array(256);
      if (count > 0) {
        let cumulative = 0;
        for (let i = 0; i < 256; i++) {
          cumulative += hist[i];
          lut[i] = Math.round((cumulative / count) * 255);
        }
      } else {
        for (let i = 0; i < 256; i++) lut[i] = i;
      }

      tileLuts[ty][tx] = lut;
    }
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const val = data[idx];

      const cx = (x + 0.5) / tileW - 0.5;
      const cy = (y + 0.5) / tileH - 0.5;
      const tx0 = Math.max(0, Math.floor(cx));
      const ty0 = Math.max(0, Math.floor(cy));
      const tx1 = Math.min(gridX - 1, tx0 + 1);
      const ty1 = Math.min(gridY - 1, ty0 + 1);

      const fx = Math.max(0, Math.min(1, cx - tx0));
      const fy = Math.max(0, Math.min(1, cy - ty0));

      const v00 = tileLuts[ty0][tx0][val];
      const v10 = tileLuts[ty0][tx1][val];
      const v01 = tileLuts[ty1][tx0][val];
      const v11 = tileLuts[ty1][tx1][val];

      const top = v00 + (v10 - v00) * fx;
      const bot = v01 + (v11 - v01) * fx;
      const v = Math.round(top + (bot - top) * fy);

      result[idx] = v;
      result[idx + 1] = v;
      result[idx + 2] = v;
      result[idx + 3] = 255;
    }
  }

  return new ImageData(result, width, height);
}

function sharpen(imageData, amount = 0.6) {
  const { width, height, data } = imageData;
  const result = new Uint8ClampedArray(data.length);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      if (y === 0 || y === height - 1 || x === 0 || x === width - 1) {
        result[idx] = data[idx];
        result[idx + 1] = data[idx + 1];
        result[idx + 2] = data[idx + 2];
        result[idx + 3] = 255;
        continue;
      }
      const center = data[idx];
      const top    = data[((y - 1) * width + x) * 4];
      const bottom = data[((y + 1) * width + x) * 4];
      const left   = data[(y * width + (x - 1)) * 4];
      const right  = data[(y * width + (x + 1)) * 4];
      const blur = (top + bottom + left + right) / 4;
      const v = Math.max(0, Math.min(255, center + (center - blur) * amount));
      result[idx] = v;
      result[idx + 1] = v;
      result[idx + 2] = v;
      result[idx + 3] = 255;
    }
  }
  return new ImageData(result, width, height);
}

function toGrayscale(imageData) {
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    const gray = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    d[i] = gray;
    d[i + 1] = gray;
    d[i + 2] = gray;
  }
  return imageData;
}

function applyContrast(imageData, factor = 1.5) {
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = Math.max(0, Math.min(255, (d[i] - 128) * factor + 128));
    d[i] = v;
    d[i + 1] = v;
    d[i + 2] = v;
  }
  return imageData;
}

function otsuBinarize(imageData) {
  const { width, height, data } = imageData;
  const total = width * height;

  const histogram = new Uint32Array(256);
  for (let i = 0; i < data.length; i += 4) histogram[data[i]]++;

  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * histogram[i];

  let sumB = 0, wB = 0, maxVar = 0, threshold = 128;
  for (let t = 0; t < 256; t++) {
    wB += histogram[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * histogram[t];
    const diff = sumB / wB - (sum - sumB) / wF;
    const between = wB * wF * diff * diff;
    if (between > maxVar) { maxVar = between; threshold = t; }
  }

  for (let i = 0; i < data.length; i += 4) {
    const val = data[i] >= threshold ? 255 : 0;
    data[i] = val;
    data[i + 1] = val;
    data[i + 2] = val;
  }
  return imageData;
}

function gammaCorrect(imageData, gamma = 1.0) {
  const d = imageData.data;
  const invGamma = 1.0 / gamma;
  const lut = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    lut[i] = Math.round(255 * Math.pow(i / 255, invGamma));
  }
  for (let i = 0; i < d.length; i += 4) {
    d[i] = lut[d[i]];
    d[i + 1] = lut[d[i + 1]];
    d[i + 2] = lut[d[i + 2]];
  }
  return imageData;
}

/**
 * Morphological close (dilate-then-erode on dark text).
 * Reconnects broken letter strokes caused by holographic overlays.
 */
function morphologicalClose(imageData, radius = 1) {
  const { width, height, data } = imageData;

  const dilated = new Uint8ClampedArray(data.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let minVal = 255;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const ny = Math.max(0, Math.min(height - 1, y + dy));
          const nx = Math.max(0, Math.min(width - 1, x + dx));
          minVal = Math.min(minVal, data[(ny * width + nx) * 4]);
        }
      }
      const idx = (y * width + x) * 4;
      dilated[idx] = minVal;
      dilated[idx + 1] = minVal;
      dilated[idx + 2] = minVal;
      dilated[idx + 3] = 255;
    }
  }

  const result = new Uint8ClampedArray(data.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let maxVal = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const ny = Math.max(0, Math.min(height - 1, y + dy));
          const nx = Math.max(0, Math.min(width - 1, x + dx));
          maxVal = Math.max(maxVal, dilated[(ny * width + nx) * 4]);
        }
      }
      const idx = (y * width + x) * 4;
      result[idx] = maxVal;
      result[idx + 1] = maxVal;
      result[idx + 2] = maxVal;
      result[idx + 3] = 255;
    }
  }

  return new ImageData(result, width, height);
}

// ─── Image Variant Factory ─────────────────────────────────────

function createSimpleGrayscaleVariant(img, scale) {
  const { canvas, ctx, width, height } = imageToCanvas(img, scale);
  let imgData = ctx.getImageData(0, 0, width, height);

  toGrayscale(imgData);
  imgData = sharpen(imgData, 0.5);

  ctx.putImageData(imgData, 0, 0);
  return canvasToFile(canvas, "v1-grayscale.png");
}

function createGreenChannelVariant(img, scale) {
  const { canvas, ctx, width, height } = imageToCanvas(img, scale);
  let imgData = ctx.getImageData(0, 0, width, height);

  imgData = extractChannel(imgData, 1);
  imgData = claheEnhance(imgData);
  imgData = sharpen(imgData, 0.6);

  ctx.putImageData(imgData, 0, 0);
  return canvasToFile(canvas, "v2-green-clahe.png");
}

function createBinarizedVariant(img, scale) {
  const { canvas, ctx, width, height } = imageToCanvas(img, scale);
  let imgData = ctx.getImageData(0, 0, width, height);

  toGrayscale(imgData);
  applyContrast(imgData, 1.4);
  otsuBinarize(imgData);
  imgData = morphologicalClose(imgData, 1);

  ctx.putImageData(imgData, 0, 0);
  return canvasToFile(canvas, "v3-binarized.png");
}

function createBottomCropVariant(img, scale) {
  const cropY = Math.round(img.height * 0.50);
  const cropRect = { x: 0, y: cropY, w: img.width, h: img.height - cropY };
  const { canvas, ctx, width, height } = imageToCanvas(img, scale, cropRect);
  let imgData = ctx.getImageData(0, 0, width, height);

  toGrayscale(imgData);
  imgData = claheEnhance(imgData);
  imgData = sharpen(imgData, 0.5);

  ctx.putImageData(imgData, 0, 0);
  return canvasToFile(canvas, "v4-bottom-crop.png");
}

function createBrightenedVariant(img, scale) {
  const { canvas, ctx, width, height } = imageToCanvas(img, scale);
  let imgData = ctx.getImageData(0, 0, width, height);

  toGrayscale(imgData);
  gammaCorrect(imgData, 0.6);
  applyContrast(imgData, 1.5);
  imgData = sharpen(imgData, 0.5);

  ctx.putImageData(imgData, 0, 0);
  return canvasToFile(canvas, "v5-brightened.png");
}

function createTopCropVariant(img, scale) {
  const cropH = Math.round(img.height * 0.40);
  const cropRect = { x: 0, y: 0, w: img.width, h: cropH };
  const { canvas, ctx, width, height } = imageToCanvas(img, scale, cropRect);
  let imgData = ctx.getImageData(0, 0, width, height);

  toGrayscale(imgData);
  imgData = claheEnhance(imgData);
  imgData = sharpen(imgData, 0.5);

  ctx.putImageData(imgData, 0, 0);
  return canvasToFile(canvas, "v6-top-crop.png");
}

/**
 * Variant 7 — Text-zone crop (55-85% height) with heavy contrast.
 * Targets the name + student number + college area on ISU IDs,
 * which sits between the photo and the bottom edge.
 */
function createTextZoneCropVariant(img, scale) {
  const startY = Math.round(img.height * 0.55);
  const endY = Math.round(img.height * 0.88);
  const cropRect = { x: 0, y: startY, w: img.width, h: endY - startY };
  const { canvas, ctx, width, height } = imageToCanvas(img, scale, cropRect);
  let imgData = ctx.getImageData(0, 0, width, height);

  imgData = extractChannel(imgData, 1);
  imgData = claheEnhance(imgData, 6, 6, 3.0);
  applyContrast(imgData, 1.6);
  imgData = sharpen(imgData, 0.7);

  ctx.putImageData(imgData, 0, 0);
  return canvasToFile(canvas, "v7-text-zone.png");
}

async function createImageVariants(imageFile) {
  const variants = [];

  try {
    const img = await loadImage(imageFile);

    const maxDim = Math.max(img.width, img.height);
    const scale = maxDim < 1400 ? Math.min(2.5, 2400 / maxDim) : 1;

    const [v1, v2, v3, v4, v5, v6, v7] = await Promise.all([
      createSimpleGrayscaleVariant(img, scale),
      createGreenChannelVariant(img, scale),
      createBinarizedVariant(img, scale),
      createBottomCropVariant(img, scale),
      createBrightenedVariant(img, scale),
      createTopCropVariant(img, scale),
      createTextZoneCropVariant(img, scale),
    ]);

    if (v1) variants.push({ name: "grayscale",      file: v1 });
    if (v6) variants.push({ name: "top-crop",       file: v6 });
    if (v7) variants.push({ name: "text-zone",      file: v7 });
    if (v4) variants.push({ name: "bottom-crop",    file: v4 });
    if (v2) variants.push({ name: "green-channel",  file: v2 });
    if (v3) variants.push({ name: "binarized",      file: v3 });
    if (v5) variants.push({ name: "brightened",     file: v5 });
  } catch (e) {
    console.warn("Variant creation failed, using original:", e);
  }

  if (variants.length === 0) {
    variants.push({ name: "original", file: imageFile });
  }

  return variants;
}

// ─── WASM Error Suppression ────────────────────────────────────

const SUPPRESSED_WASM_PATTERNS = [
  "Image too small to scale",
  "Line cannot be recognized",
  "Too few characters",
  "Empty page",
  "boxClipToRectangle",
  "pixScanForForeground",
  "box outside rectangle",
  "invalid box",
];

// PERF-002 FIX: Reference-counted suppression to handle concurrent calls safely.
// Only the first caller installs the filter; only the last caller restores it.
let _wasmSuppressionDepth = 0;
let _originalConsoleError = null;

function installWasmSuppression() {
  _wasmSuppressionDepth++;
  if (_wasmSuppressionDepth === 1) {
    _originalConsoleError = console.error;
    console.error = (...args) => {
      const msg = args.length > 0 ? String(args[0]) : "";
      if (SUPPRESSED_WASM_PATTERNS.some((p) => msg.includes(p))) return;
      _originalConsoleError.apply(console, args);
    };
  }
  return () => {
    _wasmSuppressionDepth = Math.max(0, _wasmSuppressionDepth - 1);
    if (_wasmSuppressionDepth === 0 && _originalConsoleError) {
      console.error = _originalConsoleError;
      _originalConsoleError = null;
    }
  };
}

// ─── Per-Variant Tesseract Configuration ────────────────────────

const VARIANT_PSM = {
  "grayscale":     "6",   // SINGLE_BLOCK — reliable default
  "top-crop":      "6",   // SINGLE_BLOCK — university header
  "text-zone":     "6",   // SINGLE_BLOCK — name/number/college region
  "bottom-crop":   "6",   // SINGLE_BLOCK — lower half text
  "green-channel": "3",   // AUTO — let Tesseract decide layout
  "binarized":     "6",   // SINGLE_BLOCK — high-contrast
  "brightened":    "6",   // SINGLE_BLOCK — brightened photo
};

// ─── Multi-Pass OCR ────────────────────────────────────────────

async function multiPassOCR(imageFile) {
  const worker = await getWorker();
  const variants = await createImageVariants(imageFile);
  currentTotalPhases = variants.length;
  const allResults = [];

  const restoreConsole = installWasmSuppression();

  try {
    for (let i = 0; i < variants.length; i++) {
      currentProgressPhase = i;
      try {
        const psm = VARIANT_PSM[variants[i].name] || "6";
        await worker.setParameters({ tessedit_pageseg_mode: psm });

        const { data } = await worker.recognize(
          variants[i].file, {}, { blocks: true },
        );
        const rawText = (data.text || "").trim();
        const confidence = data.confidence || 0;

        const filteredText = extractHighConfidenceText(data.blocks);

        if (rawText.length > 0) {
          allResults.push({
            variant: variants[i].name,
            text: filteredText || rawText,
            rawText,
            confidence,
          });

          // PERF-001 FIX: Early exit when we have enough ISU signal.
          // After at least 3 passes, check if the merged text already contains
          // strong ISU indicators. This saves 30-60s on lower-end devices.
          if (i >= 2 && allResults.length >= 2) {
            const partialMerged = mergeOCRResults(allResults, "text").toLowerCase();
            const hasISUName = /isabela|lsabela|1sabela/i.test(partialMerged) ||
                               /state\s*univ/i.test(partialMerged) ||
                               /\b[il1][sz5]u\b/i.test(partialMerged);
            const hasStudentNum = /\d{2}\s*[-–—]\s*\d{3,5}/i.test(partialMerged);
            if (hasISUName && hasStudentNum) {
              if (import.meta.env.DEV) {
                console.log(
                  `%cPERF-001: Early OCR exit after pass ${i + 1}/${variants.length} — ISU indicators found`,
                  "color:#22c55e;font-weight:bold",
                );
              }
              break;
            }
          }
        }
      } catch (e) {
        console.warn(`OCR pass [${variants[i].name}] failed:`, e);
        // EDGE-002 FIX: If a single OCR pass errors, the Tesseract WASM module
        // may have corrupted its internal state. Terminate and null the worker
        // so the next call creates a fresh instance instead of reusing corruption.
        if (worker) {
          try { await worker.terminate(); } catch (_) { /* ignore */ }
        }
        cachedWorker = null;
        break; // Exit the loop — remaining passes would use a dead worker
      }
    }
  } finally {
    await worker.setParameters({ tessedit_pageseg_mode: "6" }).catch(() => {});
    restoreConsole();
  }

  allResults.sort((a, b) => b.confidence - a.confidence);

  const mergedText = mergeOCRResults(allResults, "text");
  const rawMergedText = mergeOCRResults(allResults, "rawText");

  return { mergedText, rawMergedText, allResults };
}

// ─── OCR Text Quality Functions ─────────────────────────────────

function extractHighConfidenceText(blocks) {
  if (!blocks || !Array.isArray(blocks)) return "";

  const lines = [];

  for (const block of blocks) {
    if (!block.paragraphs) continue;
    for (const para of block.paragraphs) {
      if (!para.lines) continue;
      for (const line of para.lines) {
        if (!line.words || line.words.length === 0) continue;

        const goodWords = line.words.filter((w) => (w.confidence || 0) >= 30);
        if (goodWords.length === 0) continue;

        const avgConf =
          goodWords.reduce((s, w) => s + (w.confidence || 0), 0) / goodWords.length;
        if (avgConf < 40) continue;

        const lineText = goodWords.map((w) => w.text).join(" ");
        const cleaned = cleanOCRLine(lineText);
        if (cleaned.length >= 4 && !isNoiseLine(cleaned)) {
          lines.push(cleaned);
        }
      }
    }
  }

  return lines.join("\n");
}

function cleanOCRLine(line) {
  return line
    .replace(/^[-–—\\|/[\]{}()<>»«*#=+~`,.;:!?]+\s*/g, "")
    .replace(/\s*[-–—\\|/[\]{}()<>»«*#=+~`,.;:!?]+$/g, "")
    .replace(/\s{3,}/g, "  ")
    .trim();
}

function isNoiseLine(line) {
  if (line.length < 4) return true;
  const alphaNum = (line.match(/[a-zA-Z0-9]/g) || []).length;
  if (alphaNum / line.length < 0.5) return true;
  const letters = (line.match(/[a-zA-Z]/g) || []).length;
  if (letters < 3) return true;
  const words = line.split(/\s+/).filter((w) => w.length > 0);
  const maxWordLetters = Math.max(0, ...words.map((w) => (w.match(/[a-zA-Z]/g) || []).length));
  if (maxWordLetters < 4) return true;
  return false;
}

// ─── Merge OCR Results ──────────────────────────────────────────

function mergeOCRResults(results, textKey = "text") {
  if (results.length === 0) return "";

  const lineEntries = [];
  const keyCount = new Map();

  for (const result of results) {
    const source = result[textKey] || result.text || "";
    const lines = source.split("\n").map((l) => cleanOCRLine(l)).filter(Boolean);
    for (const line of lines) {
      if (isNoiseLine(line)) continue;

      const key = line.toLowerCase().replace(/\s+/g, " ");
      if (key.length < 2) continue;

      lineEntries.push({ line, key, confidence: result.confidence });
      keyCount.set(key, (keyCount.get(key) || 0) + 1);
    }
  }

  lineEntries.sort((a, b) => {
    const ac = keyCount.get(a.key) || 0;
    const bc = keyCount.get(b.key) || 0;
    if (ac !== bc) return bc - ac;
    return b.confidence - a.confidence;
  });

  const seen = new Set();
  const merged = [];

  for (const entry of lineEntries) {
    let dup = false;
    for (const s of seen) {
      if (s === entry.key) { dup = true; break; }
      if (entry.key.length > 5 && s.length > 5) {
        if (s.includes(entry.key) || entry.key.includes(s)) { dup = true; break; }
      }
    }
    if (!dup) {
      seen.add(entry.key);
      merged.push(entry.line);
    }
  }

  return merged.join("\n");
}

// ─── Public API ─────────────────────────────────────────────────

export async function extractTextFromID(imageFile, onProgress = null) {
  try {
    currentProgressCb = onProgress;
    currentProgressValue = 0;
    currentProgressPhase = 0;
    emitProgress(1);

    const { mergedText, rawMergedText, allResults } = await multiPassOCR(imageFile);
    emitProgress(100);

    if (import.meta.env.DEV) {
      const readable = mergedText
        .split("\n")
        .map((l) => l.trim())
        .filter((line) => !isNoiseLine(line));

      const allText = rawMergedText || mergedText;
      const stuNumMatch = allText.match(
        /\d{2}\s*[-–—.]\s*\d{3,5}(?:\s*[-–—.]\s*[A-Z!|7]{1,3})?/gi,
      );

      console.group("OCR Multi-Pass Results");
      console.log(
        "%cPer-Variant Confidence:",
        "font-weight:bold;color:#6366f1",
      );
      for (const r of allResults) {
        const bar = "\u2588".repeat(Math.round(r.confidence / 5));
        console.log(
          `  [${r.variant}] ${bar} ${r.confidence.toFixed(1)}%`,
        );
      }
      console.log(
        "%c\nFiltered Text (" + readable.length + " lines):",
        "font-weight:bold;color:#22c55e",
      );
      console.log(readable.join("\n") || "(no readable text extracted)");
      console.log(
        "%c\nDetected Fields:",
        "font-weight:bold;color:#f59e0b",
      );
      console.log(
        "  Student No: " + (stuNumMatch ? stuNumMatch.join(", ") : "not found"),
      );
      console.groupEnd();
    }

    currentProgressCb = null;
    currentProgressPhase = 0;
    currentProgressValue = 0;

    return {
      success: true,
      text: mergedText.toLowerCase(),
      rawText: rawMergedText || mergedText,
    };
  } catch (error) {
    console.error("OCR error:", error);
    currentProgressCb = null;
    currentProgressPhase = 0;
    currentProgressValue = 0;
    cachedWorker = null;
    return {
      success: false,
      error: "Failed to read ID. Please upload a clear, well-lit photo.",
    };
  }
}

// ─── Non-ISU Document Detection ─────────────────────────────────

const NON_ISU_INDICATORS = {
  government_id: {
    label: "a government-issued ID (not a student ID)",
    patterns: [
      "driver's license", "drivers license", "driver license", "driving license",
      "land transportation office", "land transportation",
      "philhealth", "phil health", "philippine health insurance",
      "social security system", "social security",
      "unified multi-purpose", "umid card",
      "bureau of internal revenue",
      "department of foreign affairs",
      "postal id", "philippine postal",
      "national bureau of investigation", "nbi clearance",
      "professional regulation commission", "professional regulation",
      "commission on elections", "comelec",
      "philsys", "philippine identification system",
      "senior citizen id", "senior citizen card",
      "person with disability",
      "overseas filipino worker",
    ],
  },
  high_school: {
    label: "a high school or basic education ID",
    patterns: [
      "high school", "junior high", "senior high",
      "secondary school", "elementary school",
      "grade school", "primary school",
      "department of education", "deped",
    ],
  },
  other_university: {
    label: "a student ID from a different university",
    patterns: [
      "university of the philippines",
      "ateneo de manila", "ateneo de davao", "ateneo de cagayan",
      "de la salle university", "la salle university",
      "university of santo tomas",
      "far eastern university",
      "polytechnic university of the philippines",
      "mapua university", "mapua institute",
      "adamson university",
      "ama computer college", "ama university",
      "sti college", "sti education",
      "letran college", "colegio de san juan de letran",
      "national university",
      "university of the east",
      "centro escolar university",
      "san beda university", "san sebastian college",
      "technological university of the philippines",
      "batangas state university",
      "bulacan state university",
      "cavite state university",
      "nueva ecija university",
      "tarlac state university",
      "pangasinan state university",
      "benguet state university",
      "central luzon state university",
      "don mariano marcos",
      "cagayan state university",
      "mindanao state university",
      "western mindanao state",
      "silliman university",
      "xavier university",
      "university of san carlos",
      "cebu technological university",
      "holy angel university",
      "lyceum of the philippines",
      "university of perpetual help",
      "arellano university",
      "emilio aguinaldo college",
      "university of makati",
      "pamantasan ng lungsod",
      "university of pangasinan",
      "bicol university",
      "visayas state university",
    ],
  },
  non_student_doc: {
    label: "a non-student document",
    patterns: [
      "birth certificate", "certificate of live birth",
      "marriage certificate", "death certificate",
      "transcript of records",
      "barangay clearance", "barangay certificate",
      "police clearance",
      "community tax certificate",
    ],
  },
};

function detectNonISUDocument(text) {
  const lower = text.toLowerCase();

  for (const [category, { label, patterns }] of Object.entries(NON_ISU_INDICATORS)) {
    for (const pattern of patterns) {
      if (lower.includes(pattern)) {
        return { detected: true, category, matchedPattern: pattern, label };
      }
    }
  }

  return { detected: false };
}

// ─── ISU Color Profile Analysis ─────────────────────────────────

function analyzeISUColorProfile(imageFile) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(imageFile);
    img.onload = () => {
      URL.revokeObjectURL(url);

      const canvas = document.createElement("canvas");
      const maxDim = 200;
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

      let greenDominant = 0;
      let goldYellow = 0;
      let totalPixels = 0;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        totalPixels++;

        if (g > r + 20 && g > b + 20 && g > 80) {
          greenDominant++;
        }

        if (r > 120 && g > 120 && b < 100 && Math.abs(r - g) < 50) {
          goldYellow++;
        }
      }

      const greenRatio = greenDominant / totalPixels;
      const goldRatio = goldYellow / totalPixels;
      const hasISUColors = greenRatio > 0.12 || goldRatio > 0.08 || (greenRatio + goldRatio) > 0.10;

      resolve({ hasISUColors, greenRatio, goldRatio });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ hasISUColors: false, greenRatio: 0, goldRatio: 0 });
    };
    img.src = url;
  });
}

// ─── ISU Student ID Verification ────────────────────────────────

export function verifyISUStudentID(extractedText, options = {}) {
  const text = extractedText.toLowerCase();
  const rawText = extractedText;

  // ── Stage A: Reject non-ISU documents ──────────────────────
  const nonISU = detectNonISUDocument(text);

  const universityPatterns = [
    "isabela state university",
    "isabela state",
    "state university",
    "lsabela state", "isabeia state", "isahela state", "1sabela state",
    "isabela st", "sabela state",
    "state univ", "tate univ", "state u",
  ];
  let hasUniversityName = universityPatterns.some((p) => text.includes(p));

  if (!hasUniversityName) {
    const uniRegexes = [
      /i\s*s\s*a\s*b\s*e\s*l\s*a/i,
      /s[ai]be[li]a?\s*state/i,
      /state\s*uni/i,
      /\bisa?\w{2,5}\s+state/i,
      /\buniv\w*sity/i,
      /\b[il1][sz5]u\b/i,
      /\bphi[li1]+pp/i,
    ];
    hasUniversityName = uniRegexes.some((r) => r.test(text));
  }

  // Hard reject specific non-student documents even if they accidentally match an ISU marker
  const isHardRejectCategory = nonISU.category === "government_id" || 
                               nonISU.category === "high_school" || 
                               nonISU.category === "non_student_doc";

  // Early reject if it's explicitly a prohibited document, OR if it's an undefined non-ISU doc without ISU signals
  if (nonISU.detected && (isHardRejectCategory || !hasUniversityName)) {
    if (import.meta.env.DEV) {
      console.log(
        `%c\nNon-ISU document detected: "${nonISU.matchedPattern}" (${nonISU.category})`,
        "font-weight:bold;color:#ef4444",
      );
    }
    return {
      isValid: false,
      confidence: 0,
      checks: { hasUniversityName, hasLocation: false, hasStudentNumber: false, hasCollegeKeyword: false, hasStructural: false },
      extractedText: text,
      extractedTextRaw: rawText,
      rejectionReason: nonISU.label,
      message: `This appears to be ${nonISU.label}, not an ISU student ID.`,
    };
  }

  // Check for other-university detection more carefully:
  // "isabela" can't be confused with other university names, but we must
  // not reject if ISU markers are strongly present alongside a false positive.
  const hasISUSpecificText = text.includes("isabela state") || text.includes("isu") ||
    text.includes("lsabela state") || text.includes("1sabela state") ||
    /\b[il1][sz5]u\b/i.test(text);

  if (nonISU.detected && nonISU.category === "other_university" && !hasISUSpecificText) {
    return {
      isValid: false,
      confidence: 0,
      checks: { hasUniversityName: false, hasLocation: false, hasStudentNumber: false, hasCollegeKeyword: false, hasStructural: false },
      extractedText: text,
      extractedTextRaw: rawText,
      rejectionReason: nonISU.label,
      message: `This appears to be ${nonISU.label}. Only ISU student IDs are accepted.`,
    };
  }

  // ── Location Detection ───────────────────────────────────────
  const locationPatterns = [
    "echague", "echag", "chague",
    "santiago", "cauayan", "cabagan", "ilagan",
    "roxas", "jones", "san mariano", "angadanan",
    "san mateo", "palanan", "dinapigue",
    "echagu", "chagu",
    "campus",
  ];
  const hasLocation = locationPatterns.some((p) => text.includes(p));

  // ── Student Number Detection ─────────────────────────────────
  const studentNumberPatterns = [
    /\d{2}[-–—]\d{3,5}(?:[-–—][A-Z]{1,3})?/i,
    /\d{2}\s*[-–—]\s*\d{3,5}/i,
    /\d{2}\d{4}/,
    /\d{2}[-.,]\d{3,5}/i,
    /\d{2}[-–—.\s]\d{3,5}[-–—.\s]+[A-Za-z]{1,3}/i,
    /student\s*n/i,
    /student\s*no/i,
    /stud\.?\s*no/i,
    /stud\w*\s*num/i,
    /\d{2}\s+\d{3,5}/,
    /\d{2}[~`]\d{3,5}/,
  ];
  const hasStudentNumber = studentNumberPatterns.some((p) => p.test(rawText));

  // ── College/ID Keyword Detection (cleaned up) ─────────────────
  const collegeKeywords = [
    "college", "colleg", "ollege", "colle", "colege",
    "computing", "comput", "omputing", "computi",
    "technology", "technol", "echnology", "techno",
    "information", "informat", "nformation", "inform",
    "communication", "communic", "ommunication", "commun",
    "engineering", "engineer", "ngineer",
    "science", "scienc",
    "education", "educat",
    "agriculture", "agricult",
    "nursing", "business", "busines",
    "criminology", "criminol",
    "studies", "studie",
    "student", "studen", "tudent",
    "bachelor", "department", "depart",
    "registrar", "enrollment", "semester", "validity",
    "faculty", "program", "degree",
  ];
  const hasCollegeKeyword = collegeKeywords.some((kw) => text.includes(kw));

  // ── Structural Pattern Detection ─────────────────────────────
  const structuralPatterns = [
    /\b\d{4}\s*[-–—]\s*\d{4}\b/,
    /\b(1st|2nd|first|second)\s*sem/i,
    /\bvalid/i,
    /\bcourse/i,
    /\byear\s*(?:level|&)/i,
    /\byr\.?\s*(?:level|&)/i,
    /\bregistrar/i,
    /\b197[0-9]\b/,
  ];
  const hasStructural = structuralPatterns.some((p) => p.test(rawText));

  // ── Confidence Calculation ───────────────────────────────────
  let confidence = 0;
  if (hasUniversityName)  confidence += 40;
  if (hasStudentNumber)   confidence += 30;
  if (hasLocation)        confidence += 15;
  if (hasCollegeKeyword)  confidence += 10;
  if (hasStructural)      confidence += 5;
  if (options.hasISUColors) confidence += 10;

  const hasPrimaryIndicator = hasUniversityName || hasStudentNumber;
  const isValid = confidence >= 50 && hasPrimaryIndicator;

  if (import.meta.env.DEV) {
    console.log(
      "%c\nVerification Checks:",
      "font-weight:bold;color:#ef4444",
    );
    console.log(
      `  University: ${hasUniversityName ? "\u2705" : "\u274C"}` +
      `  Location: ${hasLocation ? "\u2705" : "\u274C"}` +
      `  Student#: ${hasStudentNumber ? "\u2705" : "\u274C"}` +
      `  College: ${hasCollegeKeyword ? "\u2705" : "\u274C"}` +
      `  Structure: ${hasStructural ? "\u2705" : "\u274C"}` +
      `  ISU Colors: ${options.hasISUColors ? "\u2705" : "\u274C"}`,
    );
    console.log(
      `  Confidence: ${confidence}% (need 50% + primary) \u2192 ${isValid ? "\u2705 VALID" : "\u274C INVALID"}`,
    );
    if (nonISU.detected) {
      console.log(
        `  Non-ISU flag: "${nonISU.matchedPattern}" (overridden by ISU markers)`,
      );
    }
  }

  let rejectionReason = null;
  if (!isValid) {
    if (!hasPrimaryIndicator) {
      rejectionReason = "no ISU-specific indicators found";
    } else {
      rejectionReason = "insufficient confidence";
    }
  }

  return {
    isValid,
    confidence: Math.min(confidence, 100),
    checks: { hasUniversityName, hasLocation, hasStudentNumber, hasCollegeKeyword, hasStructural },
    extractedText: text,
    extractedTextRaw: rawText,
    rejectionReason,
    message: isValid
      ? `Valid ISU student ID (${Math.min(confidence, 100)}% confidence)`
      : `Not a valid ISU student ID (${confidence}% confidence, need 50%)`,
  };
}

// ─── Full Verification Pipeline ─────────────────────────────────

export async function verifyStudentID(imageFile, onProgress = null) {
  try {
    const [ocrResult, colorProfile] = await Promise.all([
      extractTextFromID(imageFile, onProgress),
      analyzeISUColorProfile(imageFile),
    ]);

    if (!ocrResult.success) {
      return { success: false, step: "ocr", error: ocrResult.error };
    }

    const verification = verifyISUStudentID(
      ocrResult.rawText || ocrResult.text,
      { hasISUColors: colorProfile.hasISUColors },
    );

    if (!verification.isValid) {
      let error = "This does not appear to be a valid ISU student ID.";
      if (verification.rejectionReason) {
        if (verification.rejectionReason.startsWith("a ")) {
          error = `This appears to be ${verification.rejectionReason}. Only official ISU student IDs are accepted.`;
        } else if (verification.rejectionReason === "no ISU-specific indicators found") {
          error = "We could not identify this as an ISU student ID. Make sure the ISU university name or your student number is clearly visible.";
        }
      }

      return {
        success: false,
        step: "validation",
        error,
        details: verification,
        rejectionReason: verification.rejectionReason,
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
    return { success: false, error: "Verification failed. Please try again." };
  }
}

// ─── Image Quality Validation ───────────────────────────────────

export async function validateImageQuality(imageFile) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(imageFile);

    img.onload = () => {
      URL.revokeObjectURL(url);
      const minDim = 320;
      if (img.width < minDim || img.height < minDim) {
        resolve({ valid: false, error: `Image too small. Minimum ${minDim}\u00d7${minDim} pixels required.` });
      } else {
        resolve({ valid: true, width: img.width, height: img.height });
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ valid: false, error: "Invalid image file." });
    };

    img.src = url;
  });
}
