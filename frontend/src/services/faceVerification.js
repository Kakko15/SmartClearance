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

export async function detectFace(input) {
  try {
    if (!modelsLoaded) {
      await loadFaceModels();
    }

    let imageElement = input;
    if (input instanceof File || input instanceof Blob) {
      const img = await faceapi.bufferToImage(input);
      const maxDim = 416;
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      imageElement = canvas;
    }

    await new Promise((r) => setTimeout(r, 0));

    const detection = await faceapi
      .detectSingleFace(imageElement)
      .withFaceLandmarks()
      .withFaceDescriptor();

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

    const similarity = Math.max(
      0,
      Math.min(100, (1 - (distance * distance) / 2.2) * 100),
    );

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
