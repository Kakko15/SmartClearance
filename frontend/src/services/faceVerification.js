import * as faceapi from "face-api.js";

let modelsLoaded = false;

export async function loadFaceModels() {
  if (modelsLoaded) {
    return true;
  }

  try {
    const MODEL_URL = "/models";

    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);

    modelsLoaded = true;
    return true;
  } catch (error) {
    console.error("Error loading face models:", error);
    throw new Error(
      "Failed to load face detection models. Please refresh the page.",
    );
  }
}

// Yield control back to the browser so it can paint frames and stay responsive
function yieldToMain() {
  return new Promise((resolve) => {
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(resolve, { timeout: 50 });
    } else {
      setTimeout(resolve, 0);
    }
  });
}

export async function detectFace(input) {
  try {
    if (!modelsLoaded) {
      await loadFaceModels();
    }

    // Yield before heavy image processing
    await yieldToMain();

    let imageElement = input;
    if (input instanceof File || input instanceof Blob) {
      const img = await faceapi.bufferToImage(input);
      // Use a larger dimension for ID photos to get better face descriptor quality
      const maxDim = 640;
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      imageElement = canvas;
    }

    // Yield before the heavy ML inference so the browser can paint
    await yieldToMain();

    // Run face detection with a higher minConfidence to skip low-quality passes faster
    const detection = await faceapi
      .detectSingleFace(imageElement, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
      .withFaceLandmarks()
      .withFaceDescriptor();

    // Yield after inference so any pending UI updates flush
    await yieldToMain();

    if (!detection) {
      return {
        success: false,
        error: "No face detected. Please ensure your face is clearly visible.",
      };
    }

    return {
      success: true,
      descriptor: detection.descriptor,
      detection: detection,
    };
  } catch (error) {
    console.error("Face detection error:", error);
    return {
      success: false,
      error: "Error detecting face. Please try again.",
    };
  }
}

export function compareFaces(descriptor1, descriptor2) {
  try {
    if (!descriptor1 || !descriptor2) {
      return {
        success: false,
        error: "Invalid face descriptors",
      };
    }

    const distance = faceapi.euclideanDistance(descriptor1, descriptor2);

    // face-api.js euclidean distance: <0.6 = same person, >0.6 = different person
    // Tuned for real-world ID card photos (glare, wear, small printed photos)
    const similarity = Math.max(
      0,
      Math.min(100, (1 - (distance * distance) / 1.8) * 100),
    );

    console.log(`[Face Compare] distance=${distance.toFixed(4)}, similarity=${similarity.toFixed(1)}%`);

    const isMatch = similarity >= 90;

    return {
      success: true,
      similarity: similarity,
      isMatch: isMatch,
      distance: distance,
      threshold: 90,
    };
  } catch (error) {
    console.error("Face comparison error:", error);
    return {
      success: false,
      error: "Error comparing faces. Please try again.",
    };
  }
}

export async function verifyFace(idPhoto, videoElement) {
  try {
    const idFaceResult = await detectFace(idPhoto);

    if (!idFaceResult.success) {
      return {
        success: false,
        step: "id_detection",
        error: idFaceResult.error,
      };
    }

    const selfieFaceResult = await detectFace(videoElement);

    if (!selfieFaceResult.success) {
      return {
        success: false,
        step: "selfie_detection",
        error: selfieFaceResult.error,
      };
    }

    const comparisonResult = compareFaces(
      idFaceResult.descriptor,
      selfieFaceResult.descriptor,
    );

    if (!comparisonResult.success) {
      return {
        success: false,
        step: "comparison",
        error: comparisonResult.error,
      };
    }

    return {
      success: true,
      similarity: comparisonResult.similarity,
      isMatch: comparisonResult.isMatch,
      verified: comparisonResult.isMatch,
      autoApprove: comparisonResult.isMatch,
      message: comparisonResult.isMatch
        ? `Face verified! ${comparisonResult.similarity.toFixed(1)}% match`
        : `Face verification failed. ${comparisonResult.similarity.toFixed(1)}% match (need 90%)`,
    };
  } catch (error) {
    console.error("Face verification error:", error);
    return {
      success: false,
      error: "Verification failed. Please try again.",
    };
  }
}

export function isCameraSupported() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

export async function requestCameraAccess() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: "user",
      },
    });
    return {
      success: true,
      stream: stream,
    };
  } catch (error) {
    console.error("Camera access error:", error);
    return {
      success: false,
      error: "Camera access denied. Please allow camera access to continue.",
    };
  }
}
