import { useState, useRef, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../../lib/supabase";
import Cropper from "react-easy-crop";
import { CameraIcon, PhotoIcon, XMarkIcon } from "../ui/Icons";

const getCroppedImg = async (imageSrc, pixelCrop, rotation = 0) => {
  const image = new Image();
  image.src = imageSrc;
  await new Promise((resolve) => { image.onload = resolve; });
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  const maxSize = Math.max(image.width, image.height);
  const safeArea = 2 * ((maxSize / 2) * Math.sqrt(2));

  canvas.width = safeArea;
  canvas.height = safeArea;

  ctx.translate(safeArea / 2, safeArea / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.translate(-safeArea / 2, -safeArea / 2);

  ctx.drawImage(
    image,
    safeArea / 2 - image.width * 0.5,
    safeArea / 2 - image.height * 0.5
  );

  const data = ctx.getImageData(0, 0, safeArea, safeArea);
  
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.putImageData(
    data,
    Math.round(0 - safeArea / 2 + image.width * 0.5 - pixelCrop.x),
    Math.round(0 - safeArea / 2 + image.height * 0.5 - pixelCrop.y)
  );

  const finalCanvas = document.createElement("canvas");
  finalCanvas.width = 300;
  finalCanvas.height = 300;
  const finalCtx = finalCanvas.getContext("2d");
  finalCtx.drawImage(canvas, 0, 0, pixelCrop.width, pixelCrop.height, 0, 0, 300, 300);

  return finalCanvas.toDataURL("image/jpeg", 0.85);
};

export default function AvatarManager({ user, profile, isDark, onAvatarUpdate }) {
  const [avatar, setAvatar] = useState(user?.user_metadata?.avatar_url || null);
  const [mode, setMode] = useState("view"); // view, camera, edit
  const [loading, setLoading] = useState(false);
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [capturedDataUrl, setCapturedDataUrl] = useState(null);

  // Cropper states
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "user" }
      });
      setStream(mediaStream);
      setCapturedDataUrl(null);
      setMode("camera");
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      }, 100);
    } catch (err) {
      toast.error("Could not access camera. Please check permissions.");
      console.error(err);
    }
  };

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  }, [stream]);

  const closeAll = useCallback(() => {
    stopCamera();
    setCapturedDataUrl(null);
    setMode("view");
  }, [stopCamera]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && mode !== "view") {
        closeAll();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mode, closeAll]);

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    
    // Capture uncropped source image
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
      
      setCapturedDataUrl(dataUrl);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setRotation(0);
      setMode("edit");
      stopCamera();
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setCapturedDataUrl(event.target.result);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setRotation(0);
      setMode("edit");
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const saveEditedPhoto = async () => {
    try {
      const croppedImage = await getCroppedImg(capturedDataUrl, croppedAreaPixels, rotation);
      await uploadAvatar(croppedImage);
      closeAll();
    } catch (e) {
      console.error(e);
      toast.error("Failed to crop image.");
    }
  };

  const uploadAvatar = async (dataUrl) => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { avatar_url: dataUrl }
      });
      if (error) throw error;
      
      setAvatar(dataUrl);
      toast.success("Avatar updated successfully!");
      if (onAvatarUpdate) onAvatarUpdate(dataUrl);
    } catch (err) {
      toast.error("Failed to update avatar.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const removeAvatar = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { avatar_url: null }
      });
      if (error) throw error;
      
      setAvatar(null);
      toast.success("Avatar removed successfully!");
      if (onAvatarUpdate) onAvatarUpdate(null);
    } catch (err) {
      toast.error("Failed to remove avatar.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const textPrimary = isDark ? "text-[#e8eaed]" : "text-[#202124]";
  const textSecondary = isDark ? "text-[#9aa0a6]" : "text-[#5f6368]";
  const bgCard = isDark ? "bg-[#303134] border-[#5f6368]" : "bg-white border-[#dadce0]";

  return (
    <div className={`p-6 rounded-2xl border ${bgCard} mb-8 flex flex-col md:flex-row items-center gap-6`}>
      <div className="relative group shrink-0">
        {loading ? (
          <div className="w-24 h-24 rounded-full border-2 border-primary-500 border-t-transparent animate-spin" />
        ) : avatar ? (
          <img 
            src={avatar} 
            alt="Profile Avatar" 
            className="w-24 h-24 rounded-full object-cover shadow-sm bg-gray-100" 
          />
        ) : (
          <div className="w-24 h-24 rounded-full bg-primary-600 flex items-center justify-center font-bold text-3xl text-white shadow-sm">
            {profile?.full_name?.charAt(0) || "U"}
          </div>
        )}
      </div>

      <div className="flex-1 text-center md:text-left">
        <h4 className={`text-base font-medium mb-1 ${textPrimary}`}>Profile Picture</h4>
        <p className={`text-sm mb-4 ${textSecondary}`}>
          A picture helps people recognize you and lets you know when you're signed in to your account.
        </p>

        <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 border border-primary-600 text-primary-600 font-medium text-sm rounded-full hover:bg-primary-50 transition-colors disabled:opacity-50"
          >
            <PhotoIcon className="w-4 h-4" />
            Upload Photo
          </button>
          
          <button
            type="button"
            onClick={startCamera}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white font-medium text-sm rounded-full hover:bg-primary-700 transition-colors disabled:opacity-50"
          >
            <CameraIcon className="w-4 h-4" />
            Take Photo
          </button>
          
          {avatar && (
            <button
              type="button"
              onClick={removeAvatar}
              disabled={loading}
              className={`flex items-center gap-2 px-4 py-2 font-medium text-sm rounded-full transition-colors disabled:opacity-50 ${isDark ? 'text-red-400 hover:bg-red-400/10' : 'text-red-600 hover:bg-red-50'}`}
            >
              Remove
            </button>
          )}
        </div>

        <input 
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept="image/*"
          className="hidden" 
        />
      </div>

      <AnimatePresence>
        {mode === "camera" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className={`fixed inset-0 z-[200] flex items-center justify-center backdrop-blur-xl px-4 md:px-0 ${isDark ? 'bg-black/90' : 'bg-[#202124]/80'}`}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 10 }}
              transition={{ type: "spring", stiffness: 350, damping: 30 }}
              className={`relative w-full max-w-[420px] rounded-[32px] overflow-hidden shadow-[0_24px_60px_rgba(0,0,0,0.4)] border ${isDark ? "border-[#3c4043] bg-[#202124]" : "border-[#dadce0] bg-white"} flex flex-col`}
            >
              <div className="absolute top-5 right-5 z-50">
                <button
                  onClick={closeAll}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md hover:bg-black/60 transition-all shadow-lg active:scale-95"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

              <div className="relative aspect-square w-full bg-[#111] flex items-center justify-center overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="absolute inset-0 w-full h-full object-cover transform -scale-x-100"
                ></video>
                
                <div 
                  className="absolute z-10 pointer-events-none rounded-full" 
                  style={{ 
                    width: "80%",
                    height: "80%",
                    boxShadow: "0 0 0 2000px rgba(0,0,0,0.55)", 
                    border: "2px solid rgba(255,255,255,0.85)"
                  }} 
                />
                <div className="absolute z-10 text-white/50 text-xs font-medium tracking-widest uppercase bottom-4" style={{ fontFamily: 'Google Sans, sans-serif' }}>
                  Align Face in Circle
                </div>
              </div>

              <div className={`p-8 flex flex-col items-center justify-center gap-6 ${isDark ? "bg-[#202124]" : "bg-white"}`}>
                <div className="text-center space-y-1">
                  <h3 className={`text-[20px] font-medium tracking-tight ${isDark ? "text-white" : "text-[#202124]"}`} style={{ fontFamily: 'Google Sans, sans-serif' }}>
                    Capture Avatar
                  </h3>
                  <p className={`text-sm ${isDark ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}`}>
                    Ensure good lighting and centered face.
                  </p>
                </div>
                
                <button
                  type="button"
                  onClick={capturePhoto}
                  className="relative flex items-center justify-center w-[76px] h-[76px] rounded-full border-[3px] border-[#dadce0] dark:border-[#5f6368] active:scale-[0.97] transition-all group outline-none focus:ring-4 focus:ring-primary-500/30"
                >
                  <div className={`w-[60px] h-[60px] ${isDark ? 'bg-[#8ab4f8] group-hover:bg-[#aecbfa]' : 'bg-[#1a73e8] group-hover:bg-[#1557b0]'} rounded-full transition-colors shadow-md flex items-center justify-center`}>
                    <CameraIcon className={`w-7 h-7 ${isDark ? 'text-[#202124]' : 'text-white'}`} />
                  </div>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {mode === "edit" && capturedDataUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className={`fixed inset-0 z-[200] flex items-center justify-center backdrop-blur-xl px-4 md:px-0 ${isDark ? 'bg-black/90' : 'bg-[#202124]/80'}`}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 10 }}
              transition={{ type: "spring", stiffness: 350, damping: 30 }}
              className={`relative w-full max-w-[420px] rounded-[32px] overflow-hidden shadow-[0_24px_60px_rgba(0,0,0,0.4)] border ${isDark ? "border-[#3c4043] bg-[#292a2d]" : "border-[#dadce0] bg-white"} flex flex-col`}
            >
              <div className={`flex items-center justify-between px-6 py-4 border-b ${isDark ? "border-[#3c4043]" : "border-[#dadce0]"}`}>
                <h3 className={`text-[16px] font-medium tracking-wide ${isDark ? "text-white" : "text-[#202124]"}`} style={{ fontFamily: 'Google Sans, sans-serif' }}>
                  Edit Image
                </h3>
                <button
                  onClick={closeAll}
                  className={`p-1.5 -mr-1.5 rounded-full transition-colors ${isDark ? "text-[#9aa0a6] hover:bg-[#3c4043] hover:text-white" : "text-[#5f6368] hover:bg-[#f1f3f4] hover:text-[#202124]"}`}
                >
                  <XMarkIcon className="w-[22px] h-[22px]" />
                </button>
              </div>

              <div className="relative aspect-square w-full bg-[#202124]">
                <Cropper
                  image={capturedDataUrl}
                  crop={crop}
                  zoom={zoom}
                  rotation={rotation}
                  aspect={1}
                  cropShape="round"
                  showGrid={false}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onRotationChange={setRotation}
                  onCropComplete={onCropComplete}
                  style={{
                    containerStyle: { backgroundColor: '#202124' },
                    cropAreaStyle: { border: '3px solid white', boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)' }
                  }}
                />
              </div>

              <div className={`px-6 py-6 pb-8 ${isDark ? "bg-[#292a2d]" : "bg-white"}`}>
                
                <div className="flex items-center gap-4 mb-8">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className={isDark ? "text-[#9aa0a6]" : "text-[#5f6368]"}><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zm-5.04-6.71l-2.75 3.54-1.96-2.36L6.5 17h11l-3.54-4.71z"/></svg>
                  
                  <input
                    type="range"
                    value={zoom}
                    min={1}
                    max={3}
                    step={0.1}
                    aria-label="Zoom"
                    onChange={(e) => setZoom(Number(e.target.value))}
                    className={`flex-1 h-1 rounded-lg appearance-none cursor-pointer outline-none ${isDark ? "bg-[#4a4d51] accent-white" : "bg-gray-200 accent-[#1a73e8]"}`}
                    style={{ WebkitAppearance: 'none' }}
                  />
                  
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className={isDark ? "text-[#9aa0a6]" : "text-[#5f6368]"}><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zm-5.04-6.71l-2.75 3.54-1.96-2.36L6.5 17h11l-3.54-4.71z"/></svg>

                  <div className="ml-auto flex items-center">
                    <button 
                      onClick={() => setRotation(r => r + 90)}
                      className={`p-2 -mr-2 rounded-full transition-colors ${isDark ? "text-[#9aa0a6] hover:bg-[#3c4043] hover:text-white" : "text-[#5f6368] hover:bg-[#f1f3f4] hover:text-[#202124]"}`}
                      aria-label="Rotate"
                    >
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M15.55 5.55L11 1v3C6.03 4 2 8.03 2 13s4.03 9 9 9 9-4.03 9-9h-2c0 3.86-3.14 7-7 7s-7-3.14-7-7 3.14-7 7-7v3l4.55-4.45z"/></svg>
                    </button>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                        setCapturedDataUrl(null);
                        setMode("camera");
                        startCamera();
                    }}
                    className={`flex-1 py-2.5 rounded-full font-medium transition-all duration-200 ${
                      isDark
                        ? "bg-[#3c4043] text-[#e8eaed] hover:bg-[#4a4d51] border border-transparent"
                        : "bg-white text-[#3c4043] hover:bg-[#f1f3f4] border border-[#dadce0]"
                    }`}
                  >
                    Retake
                  </button>
                  <button
                    onClick={saveEditedPhoto}
                    className={`flex-1 py-2.5 rounded-full font-medium transition-all duration-200 ${
                      isDark
                        ? "bg-[#8ab4f8] text-[#202124] hover:bg-[#aecbfa] hover:shadow-[0_1px_3px_rgba(0,0,0,0.15)]"
                        : "bg-[#1a73e8] text-white hover:bg-[#1b66c9] hover:shadow-[0_1px_3px_rgba(60,64,67,0.15)]"
                    }`}
                  >
                    Apply
                  </button>
                </div>

              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
