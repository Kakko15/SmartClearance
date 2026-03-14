import { useState, useCallback, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { verifyStudentID, validateImageQuality } from '../../services/idVerification';
import { detectFace } from '../../services/faceVerification';



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
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        resolve(new File([blob], file.name, { type: 'image/png' }));
      }, 'image/png');
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

export default function IDVerification({ onVerified, isDark, firstName, lastName, studentNumber }) {
  const [uploading, setUploading] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [processingStage, setProcessingStage] = useState('');
  const [verificationResult, setVerificationResult] = useState(null);
  const [idPreview, setIdPreview] = useState(null);
  const [dragging, setDragging] = useState(false);
  const faceDescriptorRef = useRef(null);

  // Revoke blob URL on unmount to prevent memory leaks
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

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    if (uploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      handleIDUploadRef.current?.(file);
    }
  }, [uploading]);

  const handleIDUpload = async (file) => {
    if (!file) return;

    setUploading(true);
    setVerificationResult(null);
    setOcrProgress(0);
    setProcessingStage('ocr');

    try {
      const processFile = await resizeImage(file, 1280);
      // Yield so the "Processing your ID..." spinner renders before heavy work begins
      await new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));

      const qualityCheck = await validateImageQuality(processFile);
      if (!qualityCheck.valid) {
        setVerificationResult({ success: false, message: qualityCheck.error });
        setUploading(false);
        return;
      }

      const idVerification = await verifyStudentID(processFile, (progress) => {
        setOcrProgress(progress);
      });

      if (!idVerification.success) {
        setVerificationResult({
          success: false,
          message: idVerification.error || 'Invalid ISU student ID'
        });
        setUploading(false);
        return;
      }

      if (firstName && lastName) {
        const ocrText = (idVerification.details?.extractedText || '').toLowerCase();
        const formLastName = lastName.trim().toLowerCase();
        const formFirstName = firstName.trim().toLowerCase();

        const lastNameFound = ocrText.includes(formLastName) ||
          (formLastName.length >= 3 && ocrText.includes(formLastName.substring(0, 3)));
        const firstNameFound = ocrText.includes(formFirstName) ||
          (formFirstName.length >= 3 && ocrText.includes(formFirstName.substring(0, 3)));

        if (!lastNameFound && !firstNameFound) {
          setVerificationResult({
            success: false,
            message: `Name mismatch! The name on your ID does not match "${firstName} ${lastName}". Please use your own student ID.`
          });
          setUploading(false);
          return;
        }
      }

      if (studentNumber) {
        const ocrRaw = idVerification.details?.extractedText || '';
        const normalize = (s) => s.trim().replace(/[\s–—.]+/g, '-').toLowerCase();
        const formNum = normalize(studentNumber);

        const idNumberPatterns = [
          /\d{2}[-–—.\s]\d{3,5}([-–—.\s][A-Za-z]{1,3})?/g,
        ];

        let matchFound = false;
        for (const pattern of idNumberPatterns) {
          const matches = ocrRaw.match(pattern);
          if (matches) {
            for (const m of matches) {
              const extracted = normalize(m);
              if (extracted === formNum) {
                matchFound = true;
                break;
              }
            }
          }
          if (matchFound) break;
        }

        if (!matchFound) {
          setVerificationResult({
            success: false,
            message: `Student number mismatch! "${studentNumber}" does not match the student number on your ID. Enter your exact student number (e.g., 23-2984-TS if you are a transferee).`
          });
          setUploading(false);
          return;
        }
      }

      setOcrProgress(100);
      setProcessingStage('face_detect');
      // Give the browser two full frames to paint the progress update before starting heavy ML work
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 50))));

      const faceDetection = await detectFace(processFile);

      if (!faceDetection.success) {
        setVerificationResult({
          success: false,
          message: faceDetection.error || 'No face detected in ID. Please upload a clear ID photo showing your face.'
        });
        setUploading(false);
        return;
      }

      // Revoke previous blob URL before creating a new one
      if (idPreview) URL.revokeObjectURL(idPreview);
      setIdPreview(URL.createObjectURL(file));
      setVerificationResult({
        success: true,
        message: 'ISU Student ID Verified',
      });

      faceDescriptorRef.current = faceDetection.descriptor;

    } catch (error) {
      console.error('ID verification error:', error);
      setVerificationResult({
        success: false,
        message: 'Error processing ID. Please try again.'
      });
    } finally {
      setUploading(false);
    }
  };

  // Keep ref in sync so handleDrop always calls the latest version
  handleIDUploadRef.current = handleIDUpload;

  return (
    <div className="max-w-2xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`p-8 rounded-3xl ${isDark ? 'bg-slate-800/50' : 'bg-white'} border ${isDark ? 'border-slate-700' : 'border-gray-200'} shadow-xl`}
      >
        <div className="text-center mb-6">
          <div className={`w-16 h-16 rounded-full ${isDark ? 'bg-blue-500/20' : 'bg-blue-100'} flex items-center justify-center mx-auto mb-4`}>
            <svg className={`w-8 h-8 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
            </svg>
          </div>
          <h3 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Upload Your ISU Student ID
          </h3>
          <p className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
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
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10'
              : isDark
                ? 'border-slate-600 hover:border-blue-500 bg-slate-900/50'
                : 'border-gray-300 hover:border-blue-500 bg-gray-50'
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
                <svg className="animate-spin h-10 w-10 text-blue-500 mb-3" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <p className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Processing your ID...</p>
              </div>
            ) : dragging ? (
              <div className="flex flex-col items-center">
                <svg className="w-12 h-12 mb-3 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3-3m0 0l3 3m-3-3v12" />
                </svg>
                <p className={`font-semibold mb-1 text-blue-600`}>Drop your image here</p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <svg className={`w-12 h-12 mb-3 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className={`font-semibold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>Click or drag to upload your Student ID</p>
                <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>PNG, JPG up to 10MB</p>
              </div>
            )}
          </label>
        </div>

        {uploading && (ocrProgress > 0 || processingStage === 'face_detect') && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-6"
          >
            <div className="flex justify-between text-sm mb-2">
              <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                {processingStage === 'face_detect' ? 'Detecting face in ID...' : 'Reading ID text...'}
              </span>
              <span className={`font-semibold ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                {processingStage === 'face_detect' ? '✓' : `${ocrProgress}%`}
              </span>
            </div>
            <div className={`w-full rounded-full h-2 overflow-hidden ${isDark ? 'bg-slate-700' : 'bg-gray-200'}`}>
              <motion.div
                className={`h-full rounded-full ${processingStage === 'face_detect' ? 'bg-green-500' : 'bg-blue-500'}`}
                initial={{ width: 0 }}
                animate={{ width: processingStage === 'face_detect' ? '100%' : `${ocrProgress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            {processingStage === 'face_detect' && (
              <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                This may take a few seconds...
              </p>
            )}
          </motion.div>
        )}

        {verificationResult && !verificationResult.success && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mt-6 p-4 rounded-xl border ${isDark ? 'bg-red-500/10 border-red-500/30' : 'bg-red-50 border-red-200'}`}
          >
            <div className="flex items-start gap-3">
              <div className={`flex-shrink-0 ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className={`font-semibold ${isDark ? 'text-red-400' : 'text-red-800'}`}>{verificationResult.message}</p>
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

            <div className={`p-4 rounded-xl border ${isDark ? 'bg-green-500/10 border-green-500/30' : 'bg-green-50 border-green-200'}`}>
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isDark ? 'bg-green-500/20' : 'bg-green-100'}`}>
                  <svg className={`w-5 h-5 ${isDark ? 'text-green-400' : 'text-green-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h4 className={`font-bold ${isDark ? 'text-green-400' : 'text-green-800'}`}>ID Verification Passed</h4>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Valid ISU ID' },
                  { label: 'Student No. Matched' },
                  { label: 'Name Matched' },
                  { label: 'Face Detected' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-2">
                    <svg className={`w-4 h-4 flex-shrink-0 ${isDark ? 'text-green-400' : 'text-green-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className={`text-sm font-medium ${isDark ? 'text-green-300' : 'text-green-700'}`}>{item.label}</span>
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
