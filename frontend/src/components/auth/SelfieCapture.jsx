import { useRef, useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  requestCameraAccess,
  detectFace,
  compareFaces,
} from "../../services/faceVerification";

const LIVE_FACE_RULES = {
  minAreaRatio: 0.09,
  maxCenterOffsetX: 0.18,
  maxCenterOffsetY: 0.2,
  minEdgeMarginRatio: 0.04,
  minDetectionScore: 0.75,
  maxEyeTiltDeg: 12,
  minEyeDistanceRatio: 0.26,
  maxNoseOffsetRatio: 0.45,
};

function averagePoint(points = []) {
  if (!Array.isArray(points) || points.length === 0) return null;
  const sum = points.reduce(
    (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
    { x: 0, y: 0 },
  );
  return {
    x: sum.x / points.length,
    y: sum.y / points.length,
  };
}

export default function SelfieCapture({ idDescriptor, onMatch, isDark }) {
  const videoRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [stream, setStream] = useState(null);
  const [result, setResult] = useState(null);
  const [autoDetectStatus, setAutoDetectStatus] = useState("");
  const [faceDetected, setFaceDetected] = useState(false);
  const [failCount, setFailCount] = useState(0);
  const [consentGiven, setConsentGiven] = useState(false);
  const autoDetectRef = useRef(null);
  const hasSubmittedRef = useRef(false);
  const lastSimilarityRef = useRef(0);
  const cameraActiveRef = useRef(false);
  const streamRef = useRef(null);
  const startAutoDetectionRef = useRef(null);
  const readyStreakRef = useRef(0);
  const pageVisibleRef = useRef(typeof document !== "undefined" ? !document.hidden : true);
  const windowFocusedRef = useRef(typeof document !== "undefined" ? document.hasFocus() : true);

  useEffect(() => {
    cameraActiveRef.current = cameraActive;
  }, [cameraActive]);

  useEffect(() => {
    streamRef.current = stream;
  }, [stream]);

  const stopAutoDetection = useCallback(() => {
    if (autoDetectRef.current) {
      clearInterval(autoDetectRef.current);
      autoDetectRef.current = null;
    }
    scanningRef.current = false;
  }, []);

  const isWindowActive = useCallback(() => {
    if (typeof document === "undefined") return true;
    return !document.hidden && document.hasFocus();
  }, []);

  const startCameraRef = useRef(null);
  const isCameraActiveAndValid = () => {
    if (!streamRef.current || !streamRef.current.active) return false;
    const tracks = streamRef.current.getVideoTracks();
    if (!tracks || tracks.length === 0) return false;
    return tracks.every(track => track.readyState === 'live');
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      stopAutoDetection();
    };
  }, [stopAutoDetection]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      pageVisibleRef.current = !document.hidden;

      if (!pageVisibleRef.current) {
        setFaceDetected(false);
        setAutoDetectStatus("Verification paused while window is not active.");
        stopAutoDetection();
        if (videoRef.current && !videoRef.current.paused) {
          videoRef.current.pause();
        }
        return;
      }

      if (
        windowFocusedRef.current &&
        cameraActiveRef.current &&
        !hasSubmittedRef.current &&
        !capturing &&
        !result
      ) {
        if (!isCameraActiveAndValid()) {
          console.log("Restarting camera due to invalid stream state on visibility");
          startCameraRef.current?.();
        } else if (videoRef.current && videoRef.current.paused) {
          videoRef.current.play().catch(console.error);
        }
        startAutoDetectionRef.current?.();
      }
    };

    const handleWindowBlur = () => {
      windowFocusedRef.current = false;
      setFaceDetected(false);
      setAutoDetectStatus("Verification paused while window is not active.");
      stopAutoDetection();
    };

    const handleWindowFocus = () => {
      windowFocusedRef.current = true;
      if (
        pageVisibleRef.current &&
        cameraActiveRef.current &&
        !hasSubmittedRef.current &&
        !capturing &&
        !result
      ) {
        if (!isCameraActiveAndValid()) {
          console.log("Restarting camera due to invalid stream state on focus");
          startCameraRef.current?.();
        } else if (videoRef.current && videoRef.current.paused) {
          videoRef.current.play().catch(console.error);
        }
        startAutoDetectionRef.current?.();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("focus", handleWindowFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [capturing, result, stopAutoDetection]);

  useEffect(() => {
    if (consentGiven) startCamera();
  }, [consentGiven]);

  const startCamera = async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      const cameraResult = await requestCameraAccess();

      if (!cameraResult.success) {
        setResult({ success: false, message: cameraResult.error });
        return;
      }

      if (videoRef.current) {
        videoRef.current.srcObject = cameraResult.stream;
        setStream(cameraResult.stream);
        setCameraActive(true);
        hasSubmittedRef.current = false;

        setTimeout(() => {
          startAutoDetection();
        }, 1500);
      }
    } catch (error) {
      console.error("Camera error:", error);
      setResult({
        success: false,
        message: "Failed to access camera. Please check permissions.",
      });
    }
  };

  useEffect(() => {
    startCameraRef.current = startCamera;
  });

  const idDescriptorRef = useRef(idDescriptor);
  const onMatchRef = useRef(onMatch);
  useEffect(() => { idDescriptorRef.current = idDescriptor; }, [idDescriptor]);
  useEffect(() => { onMatchRef.current = onMatch; }, [onMatch]);

  const scanningRef = useRef(false);

  const evaluateLiveFaceQuality = useCallback((faceResult) => {
    const detectionPayload = faceResult?.detection;
    const rawDetection = detectionPayload?.detection;
    const box = rawDetection?.box;
    const landmarks = detectionPayload?.landmarks;
    const videoEl = videoRef.current;

    const frameWidth = videoEl?.videoWidth || videoEl?.clientWidth || 0;
    const frameHeight = videoEl?.videoHeight || videoEl?.clientHeight || 0;

    if (!box || !landmarks || !frameWidth || !frameHeight) {
      return { valid: false, message: "Position your full face in the circle." };
    }

    const detectionScore = typeof rawDetection?.score === "number" ? rawDetection.score : 1;
    if (detectionScore < LIVE_FACE_RULES.minDetectionScore) {
      return { valid: false, message: "Hold still and face the camera directly." };
    }

    const faceAreaRatio = (box.width * box.height) / (frameWidth * frameHeight);
    if (faceAreaRatio < LIVE_FACE_RULES.minAreaRatio) {
      return { valid: false, message: "Move closer so your full face fills the guide." };
    }

    const marginX = frameWidth * LIVE_FACE_RULES.minEdgeMarginRatio;
    const marginY = frameHeight * LIVE_FACE_RULES.minEdgeMarginRatio;
    if (
      box.x < marginX ||
      box.y < marginY ||
      box.x + box.width > frameWidth - marginX ||
      box.y + box.height > frameHeight - marginY
    ) {
      return { valid: false, message: "Center your full face in the circle." };
    }

    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;
    const offsetX = Math.abs(centerX / frameWidth - 0.5);
    const offsetY = Math.abs(centerY / frameHeight - 0.5);
    if (
      offsetX > LIVE_FACE_RULES.maxCenterOffsetX ||
      offsetY > LIVE_FACE_RULES.maxCenterOffsetY
    ) {
      return { valid: false, message: "Align your face to the center of the circle." };
    }

    const leftEye = averagePoint(landmarks.getLeftEye?.() || []);
    const rightEye = averagePoint(landmarks.getRightEye?.() || []);
    const nose = averagePoint(landmarks.getNose?.() || []);

    if (leftEye && rightEye && nose) {
      const dx = rightEye.x - leftEye.x;
      const dy = rightEye.y - leftEye.y;
      const eyeDistance = Math.hypot(dx, dy);
      const eyeTiltDeg = Math.abs((Math.atan2(dy, dx) * 180) / Math.PI);
      const eyeDistanceRatio = eyeDistance / box.width;

      const eyeMidX = (leftEye.x + rightEye.x) / 2;
      const noseOffsetRatio = Math.abs(nose.x - eyeMidX) / Math.max(eyeDistance, 1);

      if (eyeTiltDeg > LIVE_FACE_RULES.maxEyeTiltDeg) {
        return { valid: false, message: "Keep your head upright." };
      }

      if (eyeDistanceRatio < LIVE_FACE_RULES.minEyeDistanceRatio) {
        return { valid: false, message: "Face the camera directly (avoid side angles)." };
      }

      if (noseOffsetRatio > LIVE_FACE_RULES.maxNoseOffsetRatio) {
        return { valid: false, message: "Turn your face toward the camera." };
      }
    }

    return { valid: true, message: "Face quality good." };
  }, []);

  const startAutoDetection = useCallback(() => {
    stopAutoDetection();

    if (!isWindowActive()) {
      setFaceDetected(false);
      setAutoDetectStatus("Return to this window to continue verification.");
      return;
    }

    setAutoDetectStatus("Looking for your face...");

    autoDetectRef.current = setInterval(async () => {
      if (!videoRef.current || hasSubmittedRef.current || scanningRef.current) return;

      if (!isWindowActive()) {
        setFaceDetected(false);
        setAutoDetectStatus("Verification paused while window is not active.");
        return;
      }

      if (videoRef.current.paused || videoRef.current.ended || videoRef.current.readyState < 2) {
        setFaceDetected(false);
        setAutoDetectStatus("Waiting for camera feed...");
        return;
      }

      scanningRef.current = true;
      try {
        const faceResult = await detectFace(videoRef.current);

        if (!faceResult.success) {
          readyStreakRef.current = 0;
          setFaceDetected(false);
          setAutoDetectStatus("Position your face in the circle...");
          scanningRef.current = false;
          return;
        }

        const qualityCheck = evaluateLiveFaceQuality(faceResult);
        if (!qualityCheck.valid) {
          readyStreakRef.current = 0;
          setFaceDetected(false);
          setAutoDetectStatus(qualityCheck.message);
          scanningRef.current = false;
          return;
        }

        setFaceDetected(true);

        const comparison = compareFaces(idDescriptorRef.current, faceResult.descriptor);

        if (comparison.success && comparison.isMatch) {
          readyStreakRef.current += 1;
          lastSimilarityRef.current = comparison.similarity;
          if (readyStreakRef.current >= 2) {
            setAutoDetectStatus(
              `Face match ready (${comparison.similarity.toFixed(0)}%). Click Capture Now to verify.`,
            );
          } else {
            setAutoDetectStatus("Good alignment. Hold still...");
          }
        } else {
          readyStreakRef.current = 0;
          const sim = comparison.success ? comparison.similarity : 0;
          lastSimilarityRef.current = sim;
          const threshold = comparison.success ? comparison.threshold : 90;
          setAutoDetectStatus(
            sim > 0
              ? `Matching... ${sim.toFixed(0)}% (need ${threshold}%)`
              : "Verifying face..."
          );
        }
      } catch (err) {
        console.error("Auto-detect cycle error:", err);
      }
      scanningRef.current = false;
    }, 1000);
  }, [evaluateLiveFaceQuality, isWindowActive, stopAutoDetection]);

  useEffect(() => {
    startAutoDetectionRef.current = startAutoDetection;
  }, [startAutoDetection]);

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const collectComparisonSamples = useCallback(async () => {
    const comparisons = [];
    let lastGuidanceMessage = "Center your full face in the circle.";

    for (let i = 0; i < 5; i++) {
      if (!isWindowActive()) break;
      if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) break;

      const faceSample = await detectFace(videoRef.current);
      if (faceSample.success) {
        const qualityCheck = evaluateLiveFaceQuality(faceSample);
        if (!qualityCheck.valid) {
          lastGuidanceMessage = qualityCheck.message;
        } else {
          const comparison = compareFaces(idDescriptorRef.current, faceSample.descriptor);
          if (comparison.success) comparisons.push(comparison);
        }
      } else {
        lastGuidanceMessage = "Position your face in the circle...";
      }

      if (i < 4) {
        await wait(170);
      }
    }

    return { comparisons, guidanceMessage: lastGuidanceMessage };
  }, [evaluateLiveFaceQuality, isWindowActive]);

  const performCapture = useCallback(async () => {
    if (!videoRef.current || !cameraActiveRef.current || hasSubmittedRef.current) return;

    if (!isWindowActive()) {
      setResult({
        success: false,
        message: "Return to the SmartClearance window before capturing your selfie.",
      });
      return;
    }

    stopAutoDetection();

    setCapturing(true);
    setResult(null);
    hasSubmittedRef.current = true;

    try {
      if (!isWindowActive()) {
        setResult({
          success: false,
          message: "Verification paused while another window is active. Please try again.",
        });
        hasSubmittedRef.current = false;
        startAutoDetection();
        setCapturing(false);
        return;
      }

      const { comparisons: sampleComparisons, guidanceMessage } = await collectComparisonSamples();
      if (sampleComparisons.length < 3) {
        setResult({
          success: false,
          message: `Unable to capture a stable face sample. ${guidanceMessage}`,
        });
        hasSubmittedRef.current = false;
        startAutoDetection();
        setCapturing(false);
        return;
      }

      const threshold = sampleComparisons[0].threshold ?? 90;
      const similarities = sampleComparisons
        .map((sample) => sample.similarity)
        .sort((a, b) => a - b);
      const medianSimilarity = similarities[Math.floor(similarities.length / 2)];
      const bestSimilarity = similarities[similarities.length - 1];
      const passCount = sampleComparisons.filter((sample) => sample.isMatch).length;
      const minPassesNeeded = Math.ceil(sampleComparisons.length / 2);
      const isMatch = medianSimilarity >= threshold && passCount >= minPassesNeeded;
      const similarity = medianSimilarity;

      if (!isMatch) {
        setFailCount((prev) => prev + 1);
        lastSimilarityRef.current = similarity;
      }

      setResult({
        success: true,
        similarity,
        threshold,
        isMatch,
        message: isMatch
          ? `Face verified! ${similarity.toFixed(1)}% match`
          : `Face doesn't match. ${similarity.toFixed(1)}% median match (best ${bestSimilarity.toFixed(1)}%, need ${threshold}%)`,
      });

      if (isMatch) {
        onMatchRef.current(isMatch, similarity);
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          setCameraActive(false);
        }
      } else {
        hasSubmittedRef.current = false;
        startAutoDetection();
      }
    } catch (error) {
      console.error("Selfie capture error:", error);
      setResult({
        success: false,
        message: "Error capturing selfie. Please try again.",
      });
      hasSubmittedRef.current = false;
      startAutoDetection();
    } finally {
      setCapturing(false);
    }
  }, [isWindowActive, startAutoDetection, stopAutoDetection]);

  const handleRetake = () => {
    setResult(null);
    setFaceDetected(false);
    readyStreakRef.current = 0;
    hasSubmittedRef.current = false;
    scanningRef.current = false;
    setAutoDetectStatus("Looking for your face...");

    if (cameraActiveRef.current) {
      startAutoDetection();
    } else {
      startCamera();
    }
  };

  const handleManualCapture = async () => {
    if (!videoRef.current || !cameraActiveRef.current || hasSubmittedRef.current) return;
    setAutoDetectStatus("Capturing...");
    await performCapture();
  };

  const handleSubmitToRegistrar = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      setCameraActive(false);
    }
    stopAutoDetection();

    onMatch(false, lastSimilarityRef.current);
  };

  return (
    <div className="max-w-2xl mx-auto">
      {!consentGiven ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-8 rounded-3xl ${isDark ? "bg-slate-800/50" : "bg-white"} border ${isDark ? "border-slate-700" : "border-gray-200"} shadow-xl`}
        >
          <div className="text-center mb-6">
            <div className={`w-16 h-16 rounded-full ${isDark ? "bg-purple-500/20" : "bg-purple-100"} flex items-center justify-center mx-auto mb-4`}>
              <svg className={`w-8 h-8 ${isDark ? "text-purple-400" : "text-purple-600"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className={`text-2xl font-bold mb-2 ${isDark ? "text-white" : "text-gray-900"}`}>Camera Access Required</h3>
            <p className={`text-sm leading-relaxed max-w-md mx-auto ${isDark ? "text-gray-400" : "text-gray-600"}`}>
              We need to access your camera to take a live selfie and verify it matches the photo on your uploaded ID. This ensures your identity is protected.
            </p>
          </div>
          <div className={`p-4 rounded-xl mb-6 ${isDark ? "bg-slate-900/50" : "bg-gray-50"}`}>
            <p className={`text-sm font-semibold mb-2 ${isDark ? "text-gray-300" : "text-gray-700"}`}>What to expect:</p>
            <ul className={`text-sm space-y-1.5 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
              <li>• Your browser will ask for camera permission</li>
              <li>• Position your face in the on-screen circle</li>
              <li>• The system will automatically detect and verify your face</li>
              <li>• Your camera feed is not recorded or stored</li>
            </ul>
          </div>
          <button
            onClick={() => setConsentGiven(true)}
            className={`w-full px-8 py-3.5 rounded-full font-medium transition-all flex items-center justify-center gap-2 ${isDark ? "bg-[#8ab4f8] hover:bg-[#aecbfa] text-slate-900" : "bg-[#1a73e8] hover:bg-[#1557b0] text-white"}`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Allow Camera Access
          </button>
        </motion.div>
      ) : (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`p-6 md:p-8 rounded-[28px] ${isDark ? "bg-[#202124]" : "bg-white"} border ${isDark ? "border-[#3c4043]" : "border-[#dadce0]"} shadow-sm`}
      >
        <div className="text-center mb-8">
          <div
            className={`w-14 h-14 rounded-full ${isDark ? "bg-[#8ab4f8]/20" : "bg-[#e8f0fe]"} flex items-center justify-center mx-auto mb-4`}
          >
            <svg
              className={`w-7 h-7 ${isDark ? "text-[#8ab4f8]" : "text-[#1a73e8]"}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </div>
          <h3
            className={`text-[22px] font-normal tracking-tight mb-2 ${isDark ? "text-[#e8eaed]" : "text-[#202124]"}`}
          >
            Live Face Verification
          </h3>
          <p className={`text-sm ${isDark ? "text-[#9aa0a6]" : "text-[#5f6368]"}`}>
            Position your face in the circle, then click Capture Now
          </p>
        </div>

        <div
          className={`relative rounded-3xl overflow-hidden ${isDark ? "bg-[#303134]" : "bg-[#f1f3f4]"} mb-8`}
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-[400px] object-cover"
            style={{ transform: "scaleX(-1)" }}
          />

          {!cameraActive && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <svg
                  className={`w-20 h-20 mx-auto mb-4 ${isDark ? "text-gray-600" : "text-gray-400"}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
                <p
                  className={`text-sm ${isDark ? "text-gray-500" : "text-gray-500"}`}
                >
                  Camera not started
                </p>
              </div>
            </div>
          )}

          {cameraActive && !result && (
            <div className="absolute inset-0 pointer-events-none">
              <div
                className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[280px] h-[360px] rounded-[160px] border-2 transition-all duration-300 ${
                  capturing
                    ? "border-[#fbbc04] shadow-[0_0_0_999px_rgba(0,0,0,0.5)]"
                    : faceDetected
                      ? "border-[#34a853] shadow-[0_0_0_999px_rgba(0,0,0,0.55)]"
                      : "border-white/70 shadow-[0_0_0_999px_rgba(0,0,0,0.65)]"
                }`}
              />
            </div>
          )}

          {cameraActive && !result && (
            <div className="absolute bottom-6 left-0 right-0 flex justify-center">
              <span
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium tracking-wide shadow-sm transition-colors duration-300 ${
                  capturing
                    ? "bg-[#fef7e0] text-[#ea8600]"
                    : faceDetected
                      ? "bg-[#e6f4ea] text-[#137333]"
                      : "bg-[#f1f3f4]/90 text-[#3c4043] backdrop-blur-md"
                }`}
              >
                {capturing ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
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
                    Verifying...
                  </>
                ) : (
                  <>
                    <span
                      className={`w-2 h-2 rounded-full ${faceDetected ? "bg-[#34a853] animate-pulse" : "bg-[#ea4335]"}`}
                    />
                    {autoDetectStatus || "Starting camera..."}
                  </>
                )}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
          {!cameraActive && !result && (
            <button
              onClick={startCamera}
              className={`w-full sm:w-auto px-8 py-2.5 rounded-full font-medium transition-all flex items-center justify-center gap-2 ${
                isDark
                  ? "bg-[#303134] hover:bg-[#3c4043] text-[#e8eaed]"
                  : "bg-[#f1f3f4] hover:bg-[#e8eaed] text-[#3c4043]"
              }`}
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
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              Start Camera
            </button>
          )}
          {cameraActive && !result && !capturing && (
            <button
              onClick={handleManualCapture}
              className={`w-full sm:w-auto px-8 py-2.5 rounded-full font-medium transition-all flex items-center justify-center gap-2 ${
                isDark
                  ? "bg-[#8ab4f8] hover:bg-[#aecbfa] text-slate-900"
                  : "bg-[#1a73e8] hover:bg-[#1557b0] text-white"
              }`}
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
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              Capture Now
            </button>
          )}
        </div>

        {result && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-5 rounded-[16px] border ${
              result.success && result.isMatch
                ? isDark
                  ? "bg-[#1e8e3e]/10 border-[#1e8e3e]/30 text-[#81c995]"
                  : "bg-[#e6f4ea] border-[#ceead6] text-[#137333]"
                : isDark
                  ? "bg-[#d93025]/10 border-[#d93025]/30 text-[#f28b82]"
                  : "bg-[#fce8e6] border-[#fad2cf] text-[#c5221f]"
            }`}
          >
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 mt-0.5">
                {result.success && result.isMatch ? (
                  <svg
                    className={`w-5 h-5 ${isDark ? "text-[#81c995]" : "text-[#1e8e3e]"}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                ) : (
                  <svg
                    className={`w-5 h-5 ${isDark ? "text-[#f28b82]" : "text-[#d93025]"}`}
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
                )}
              </div>
              <div className="flex-1">
                <p className="font-medium text-[15px]">{result.message}</p>
                {result.similarity !== undefined && (
                  <div className="mt-3">
                    <div className={`flex justify-between text-[13px] mb-1.5 ${isDark ? "text-[#9aa0a6]" : "text-[#5f6368]"}`}>
                      <span>Similarity Score</span>
                      <span className="font-medium">
                        {result.similarity.toFixed(1)}%
                      </span>
                    </div>
                    <div
                      className={`w-full rounded-full h-1.5 overflow-hidden ${isDark ? "bg-[#3c4043]" : "bg-[#dadce0]"}`}
                    >
                      <div
                        className={`h-full rounded-full transition-all duration-1000 ${
                          result.isMatch ? (isDark ? "bg-[#81c995]" : "bg-[#1e8e3e]") : (isDark ? "bg-[#f28b82]" : "bg-[#d93025]")
                        }`}
                        style={{
                          width: `${Math.min(result.similarity, 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {result && (
          <div className="flex flex-wrap justify-center gap-3 mt-5">
            {!result.isMatch && (
              <button
                onClick={handleRetake}
                className={`px-6 py-2.5 rounded-full font-medium transition-all flex items-center gap-2 ${
                  isDark
                    ? "bg-[#3c4043] hover:bg-[#5f6368] text-[#e8eaed]"
                    : "bg-[#f1f3f4] hover:bg-[#e8eaed] text-[#3c4043]"
                }`}
              >
                <svg
                  className="w-[18px] h-[18px]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Retake Selfie ({3 - failCount} left)
              </button>
            )}

            {failCount >= 3 && !result.isMatch && (
              <button
                onClick={handleSubmitToRegistrar}
                className={`px-6 py-2.5 rounded-full font-medium transition-all flex items-center gap-2 ${
                  isDark
                    ? "bg-[#fbbc04] hover:bg-[#fde293] text-slate-900"
                    : "bg-[#f9ab00] hover:bg-[#e37400] text-white"
                }`}
              >
                <svg
                  className="w-[18px] h-[18px]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                Submit to Registrar
              </button>
            )}
          </div>
        )}

        {failCount > 0 && failCount < 3 && result && !result.isMatch && (
          <p
            className={`text-center text-[13px] mt-3 font-medium ${
              isDark ? "text-[#fbbc04]" : "text-[#ea8600]"
            }`}
          >
            Attempt {failCount}/3 — {3 - failCount}{" "}
            {3 - failCount === 1 ? "try" : "tries"} remaining before registrar
            review
          </p>
        )}

        {failCount >= 3 && result && !result.isMatch && (
          <div
            className={`text-center mt-4 p-4 rounded-[16px] border ${
              isDark
                ? "bg-[#fbbc04]/10 border-[#fbbc04]/30"
                : "bg-[#fef7e0] border-[#fde293]"
            }`}
          >
            <div className="flex items-center justify-center gap-2 mb-1">
              <svg className={`w-4 h-4 ${isDark ? "text-[#fbbc04]" : "text-[#ea8600]"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p
                className={`text-sm font-medium ${
                  isDark ? "text-[#fbbc04]" : "text-[#ea8600]"
                }`}
              >
                Maximum attempts reached
              </p>
            </div>
            <p
              className={`text-[13px] ${
                isDark ? "text-[#e8eaed]" : "text-[#5f6368]"
              }`}
            >
              You can still retake or submit your application to the Registrar
              for manual review.
            </p>
          </div>
        )}

        <div
          className={`mt-6 p-5 rounded-[16px] border ${isDark ? "bg-[#202124] border-[#3c4043]" : "bg-[#f8f9fa] border-[#f1f3f4]"}`}
        >
          <div className="flex items-center gap-2 mb-3">
            <svg
              className={`w-[18px] h-[18px] ${isDark ? "text-[#fbbc04]" : "text-[#ea8600]"}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h4
              className={`text-[14px] font-medium tracking-tight ${isDark ? "text-[#e8eaed]" : "text-[#202124]"}`}
            >
              Tips for best results:
            </h4>
          </div>
          <ul
            className={`text-[13px] space-y-1.5 ml-1 leading-relaxed ${isDark ? "text-[#9aa0a6]" : "text-[#5f6368]"}`}
          >
            <li className="flex items-start gap-2">
              <span className="mt-1.5 flex-shrink-0 w-1 h-1 rounded-full bg-current opacity-60"></span>
              <span>Wait for the guide to turn green before capturing.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 flex-shrink-0 w-1 h-1 rounded-full bg-current opacity-60"></span>
              <span>Ensure good lighting on your face.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 flex-shrink-0 w-1 h-1 rounded-full bg-current opacity-60"></span>
              <span>Look directly at the camera.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 flex-shrink-0 w-1 h-1 rounded-full bg-current opacity-60"></span>
              <span>Keep your face centered in the circle.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 flex-shrink-0 w-1 h-1 rounded-full bg-current opacity-60"></span>
              <span>Remove glasses or hats if possible.</span>
            </li>
            <li className={`flex items-start gap-2 font-medium ${isDark ? "text-[#fbbc04]" : "text-[#ea8600]"}`}>
              <span className="mt-1.5 flex-shrink-0 w-1 h-1 rounded-full bg-current opacity-80"></span>
              <span>Maximum of 3 attempts — after that, submit to the Registrar for manual review.</span>
            </li>
          </ul>
        </div>
      </motion.div>
      )}
    </div>
  );
}
