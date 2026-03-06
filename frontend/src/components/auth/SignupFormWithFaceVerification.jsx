import { useState, useRef, useEffect } from "react";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import ReCAPTCHA from "react-google-recaptcha";
import { loadFaceModels } from "../../services/faceVerification";
import IDVerification from "./IDVerification";
import SelfieCapture from "./SelfieCapture";
import PasswordStrengthMeter from "../ui/PasswordStrengthMeter";
import SpotlightBorder from "../ui/SpotlightBorder";
import TwoFactorSetup from "./TwoFactorSetup";
import CustomSelect from "../ui/CustomSelect";

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
const IS_LOCALHOST = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

const COURSE_OPTIONS = [
  {
    label: "Agriculture, Forestry & Environment",
    options: [
      {
        value: "Bachelor of Science in Agriculture",
        label: "BS Ag / BSA: Bachelor of Science in Agriculture",
      },
      {
        value: "Bachelor of Science in Animal Husbandry",
        label: "BSAH: Bachelor of Science in Animal Husbandry",
      },
      {
        value: "Bachelor of Science in Agri Business",
        label: "BSAB: Bachelor of Science in Agri Business",
      },
      {
        value: "Bachelor of Science in Forestry",
        label: "BSF: Bachelor of Science in Forestry",
      },
      {
        value: "Bachelor of Science Environmental Science",
        label: "BS Env Sci: Bachelor of Science Environmental Science",
      },
      {
        value: "Bachelor of Science in Fisheries and Aquatic Sciences",
        label: "BSFAS: Bachelor of Science in Fisheries and Aquatic Sciences",
      },
      {
        value: "Diploma in Agricultural Technology",
        label: "DAT: Diploma in Agricultural Technology",
      },
      {
        value: "Diploma in Agricultural Sciences",
        label: "DAS: Diploma in Agricultural Sciences",
      },
    ],
  },
  {
    label: "Engineering & Technology",
    options: [
      {
        value: "Bachelor of Science in Agricultural and Biosystems Engineering",
        label:
          "BSABE: Bachelor of Science in Agricultural and Biosystems Engineering",
      },
      {
        value: "Bachelor of Science in Civil Engineering",
        label: "BSCE: Bachelor of Science in Civil Engineering",
      },
      {
        value: "Bachelor of Science in Computer Science",
        label: "BSCS: Bachelor of Science in Computer Science",
      },
      {
        value: "Bachelor of Science in Information Technology",
        label: "BSIT: Bachelor of Science in Information Technology",
      },
      {
        value: "Bachelor of Science in Information Systems",
        label: "BSIS: Bachelor of Science in Information Systems",
      },
      {
        value: "Bachelor of Science in Data Science and Analytics",
        label: "BSDSA: Bachelor of Science in Data Science and Analytics",
      },
      {
        value:
          "Bachelor of Technology and Livelihood Education - Home Economics",
        label:
          "BTLEd-HE: Bachelor of Technology and Livelihood Education - Home Economics",
      },
      {
        value:
          "Bachelor of Technology and Livelihood Education - Information and Communication Technology",
        label:
          "BTLEd-ICT: Bachelor of Technology and Livelihood Education - Information and Communication Technology",
      },
    ],
  },
  {
    label: "Health & Medical Sciences",
    options: [
      {
        value: "Doctor of Veterinary Medicine",
        label: "DVM: Doctor of Veterinary Medicine",
      },
      {
        value: "Bachelor of Science in Nursing",
        label: "BSN: Bachelor of Science in Nursing",
      },
    ],
  },
  {
    label: "Business & Public Administration",
    options: [
      {
        value: "Bachelor of Science in Accountancy",
        label: "BSA: Bachelor of Science in Accountancy",
      },
      {
        value: "Bachelor of Science in Management Accounting",
        label: "BSMA: Bachelor of Science in Management Accounting",
      },
      {
        value:
          "Bachelor of Science in Business Administration (Human Resource Management)",
        label:
          "BSBA-HRM: Bachelor of Science in Business Administration (Human Resource Management)",
      },
      {
        value:
          "Bachelor of Science in Business Administration (Marketing Management)",
        label:
          "BSBA-MM: Bachelor of Science in Business Administration (Marketing Management)",
      },
      {
        value: "Bachelor of Science in Entrepreneurship",
        label: "BS Entrep: Bachelor of Science in Entrepreneurship",
      },
      {
        value: "Bachelor in Public Administration",
        label: "BPA: Bachelor in Public Administration",
      },
    ],
  },
  {
    label: "Education & Library Science",
    options: [
      {
        value: "Bachelor of Elementary Education",
        label: "BEEd: Bachelor of Elementary Education",
      },
      {
        value: "Bachelor of Secondary Education (English)",
        label: "BSEd: Bachelor of Secondary Education (English)",
      },
      {
        value: "Bachelor of Secondary Education (Filipino)",
        label: "BSEd: Bachelor of Secondary Education (Filipino)",
      },
      {
        value: "Bachelor of Secondary Education (Mathematics)",
        label: "BSEd: Bachelor of Secondary Education (Mathematics)",
      },
      {
        value: "Bachelor of Secondary Education (Social Studies)",
        label: "BSEd: Bachelor of Secondary Education (Social Studies)",
      },
      {
        value:
          "Bachelor of Secondary Education (Library & Information Management)",
        label:
          "BSEd-LISM: Bachelor of Secondary Education (Library & Information Management)",
      },
      {
        value: "Bachelor of Library and Information Science",
        label: "BLIS: Bachelor of Library and Information Science",
      },
      {
        value: "Bachelor of Early Childhood Education",
        label: "BECEd: Bachelor of Early Childhood Education",
      },
      {
        value: "Bachelor of Physical Education",
        label: "BPEd: Bachelor of Physical Education",
      },
    ],
  },
  {
    label: "Arts & Sciences",
    options: [
      {
        value: "Bachelor of Science in Biology",
        label: "BS Bio: Bachelor of Science in Biology",
      },
      {
        value: "Bachelor of Science in Chemistry",
        label: "BS Chem: Bachelor of Science in Chemistry",
      },
      {
        value: "Bachelor of Science in Mathematics",
        label: "BS Math: Bachelor of Science in Mathematics",
      },
      {
        value: "Bachelor of Science in Psychology",
        label: "BS Psych: Bachelor of Science in Psychology",
      },
      {
        value: "Bachelor of Arts in English Language Studies",
        label: "BA ELS: Bachelor of Arts in English Language Studies",
      },
      {
        value: "Bachelor of Arts in Communication",
        label: "BA Comm: Bachelor of Arts in Communication",
      },
    ],
  },
  {
    label: "Criminal Justice & Tourism",
    options: [
      {
        value: "Bachelor of Science in Criminology",
        label: "BS Crim: Bachelor of Science in Criminology",
      },
      {
        value: "Bachelor of Science in Law Enforcement Administration",
        label: "BSLEA: Bachelor of Science in Law Enforcement Administration",
      },
      {
        value: "Bachelor of Science in Hospitality Management",
        label: "BSHM: Bachelor of Science in Hospitality Management",
      },
      {
        value: "Bachelor of Science in Tourism Management",
        label: "BSTM: Bachelor of Science in Tourism Management",
      },
    ],
  },
];

const YEAR_LEVEL_OPTIONS = [
  { value: "1st Year", label: "1st Year" },
  { value: "2nd Year", label: "2nd Year" },
  { value: "3rd Year", label: "3rd Year" },
  { value: "4th Year", label: "4th Year" },
  { value: "5th Year", label: "5th Year" },
  { value: "6th Year", label: "6th Year" },
];

export default function SignupFormWithFaceVerification({
  onSwitchMode,
  isDark,
}) {
  const [currentStep, setCurrentStep] = useState(() => {
    const saved = sessionStorage.getItem("signupStep");
    if (saved) {
      const step = parseInt(saved, 10);

      return step >= 3 ? 2 : step;
    }
    return 1;
  });
  const [modelsLoading, setModelsLoading] = useState(true);

  const [formData, setFormData] = useState(() => {
    const saved = sessionStorage.getItem("signupFormData");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (_e) {
        sessionStorage.removeItem("signupFormData");
      }
    }
    return {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      confirmPassword: "",
      studentNumber: "",
      course: "",
      yearLevel: "",
    };
  });

  const [idDescriptor, setIdDescriptor] = useState(null);

  const [loading, setLoading] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState(null);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [show2FASetup, setShow2FASetup] = useState(false);
  const [signupUserId, setSignupUserId] = useState(null);
  const recaptchaRef = useRef(null);

  useEffect(() => {
    sessionStorage.setItem("signupStep", String(currentStep));
  }, [currentStep]);

  useEffect(() => {
    sessionStorage.setItem("signupFormData", JSON.stringify(formData));
  }, [formData]);

  useEffect(() => {
    loadFaceModels()
      .then(() => {
        setModelsLoading(false);
      })
      .catch((error) => {
        console.error("Failed to load models:", error);
        toast.error("Failed to load face detection models");
      });
  }, []);

  const handleStep1Submit = (e) => {
    e.preventDefault();

    if (!formData.firstName.trim() || formData.firstName.trim().length < 2) {
      toast.error("First name too short");
      return;
    }
    if (!formData.lastName.trim() || formData.lastName.trim().length < 2) {
      toast.error("Last name too short");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      toast.error("Invalid email address");
      return;
    }
    if (formData.password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (
      !/[A-Z]/.test(formData.password) ||
      !/[a-z]/.test(formData.password) ||
      !/[0-9]/.test(formData.password) ||
      !/[^A-Za-z0-9]/.test(formData.password)
    ) {
      toast.error(
        "Password must contain uppercase, lowercase, number, and special character",
      );
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (!formData.studentNumber.trim()) {
      toast.error("Student number is required");
      return;
    }
    if (!formData.course) {
      toast.error("Please select your course");
      return;
    }
    if (!formData.yearLevel) {
      toast.error("Please select your year level");
      return;
    }
    if (!recaptchaToken && !IS_LOCALHOST) {
      toast.error("Please verify reCAPTCHA");
      return;
    }

    setCurrentStep(2);
  };

  const handleIDVerified = (descriptor) => {
    setIdDescriptor(descriptor);
    toast.success("ID verified! Now take a selfie.");
    setCurrentStep(3);
  };

  const handleFaceMatch = async (isMatch, similarity) => {
    await submitSignup(isMatch, similarity);
  };

  const submitSignup = async (faceVerified, similarity) => {
    setLoading(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/auth/signup-student`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password,
            firstName: formData.firstName.trim(),
            lastName: formData.lastName.trim(),
            role: "student",
            studentNumber: formData.studentNumber.trim(),
            courseYear: `${formData.course} - ${formData.yearLevel}`,
            recaptchaToken: recaptchaToken,
            faceVerification: {
              verified: faceVerified,
              similarity: similarity,
            },
          }),
        },
      );

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Signup failed");
      }

      if (result.autoApproved) {
        toast.success(
          `✅ Account approved! Now set up 2FA. (${similarity.toFixed(1)}% match)`,
        );
      } else {
        toast.success(
          `⚠️ Account pending review. Set up 2FA while you wait. (${similarity.toFixed(1)}% match)`,
        );
      }

      sessionStorage.removeItem("signupStep");
      sessionStorage.removeItem("signupFormData");
      setSignupUserId(result.user.id);
      setShow2FASetup(true);
    } catch (error) {
      console.error("Signup error:", error);
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const StepIndicator = () => (
    <div className="flex items-center justify-center mb-8">
      {[1, 2, 3].map((step) => (
        <div key={step} className="flex items-center">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${
              currentStep >= step
                ? isDark
                  ? "bg-green-500 text-white"
                  : "bg-green-600 text-white"
                : isDark
                  ? "bg-slate-700 text-slate-400"
                  : "bg-gray-200 text-gray-500"
            }`}
          >
            {step}
          </div>
          {step < 3 && (
            <div
              className={`w-16 h-1 mx-2 ${
                currentStep > step
                  ? isDark
                    ? "bg-green-500"
                    : "bg-green-600"
                  : isDark
                    ? "bg-slate-700"
                    : "bg-gray-200"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );

  if (show2FASetup && signupUserId) {
    return (
      <TwoFactorSetup
        userId={signupUserId}
        email={formData.email}
        isDark={isDark}
        onComplete={() => {
          toast.success("You're all set! Please sign in.");
          setTimeout(() => {
            if (onSwitchMode) onSwitchMode();
          }, 1000);
        }}
      />
    );
  }

  if (modelsLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <svg
          className="animate-spin h-12 w-12 text-green-500 mb-4"
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
        <p className={isDark ? "text-gray-400" : "text-gray-600"}>
          Loading face detection models...
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      <StepIndicator />

      {currentStep === 1 && (
        <motion.form
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          onSubmit={handleStep1Submit}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                className={`block text-sm font-bold mb-2 ${isDark ? "text-slate-300" : "text-gray-700"}`}
              >
                First Name <span className="text-red-500">*</span>
              </label>
              <SpotlightBorder isDark={isDark}>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) =>
                    setFormData({ ...formData, firstName: e.target.value })
                  }
                  required
                  className={`w-full border rounded-xl px-4 py-3 outline-none ${
                    isDark
                      ? "bg-slate-900 border-slate-700 text-white caret-green-500 focus:border-green-500"
                      : "bg-white border-gray-200 text-gray-900 caret-green-500 focus:border-green-500"
                  }`}
                />
              </SpotlightBorder>
            </div>

            <div>
              <label
                className={`block text-sm font-bold mb-2 ${isDark ? "text-slate-300" : "text-gray-700"}`}
              >
                Last Name <span className="text-red-500">*</span>
              </label>
              <SpotlightBorder isDark={isDark}>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) =>
                    setFormData({ ...formData, lastName: e.target.value })
                  }
                  required
                  className={`w-full border rounded-xl px-4 py-3 outline-none ${
                    isDark
                      ? "bg-slate-900 border-slate-700 text-white caret-green-500 focus:border-green-500"
                      : "bg-white border-gray-200 text-gray-900 caret-green-500 focus:border-green-500"
                  }`}
                />
              </SpotlightBorder>
            </div>
          </div>

          <div>
            <label
              className={`block text-sm font-bold mb-2 ${isDark ? "text-slate-300" : "text-gray-700"}`}
            >
              Email <span className="text-red-500">*</span>
            </label>
            <SpotlightBorder isDark={isDark}>
              <input
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    email: e.target.value.toLowerCase(),
                  })
                }
                required
                className={`w-full border rounded-xl px-4 py-3 outline-none ${
                  isDark
                    ? "bg-slate-900 border-slate-700 text-white caret-green-500 focus:border-green-500"
                    : "bg-white border-gray-200 text-gray-900 caret-green-500 focus:border-green-500"
                }`}
              />
            </SpotlightBorder>
          </div>

          <div>
            <label
              className={`block text-sm font-bold mb-2 ${isDark ? "text-slate-300" : "text-gray-700"}`}
            >
              Password <span className="text-red-500">*</span>
            </label>
            <SpotlightBorder isDark={isDark}>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  onFocus={() => setIsPasswordFocused(true)}
                  onBlur={() => setIsPasswordFocused(false)}
                  required
                  className={`w-full border rounded-xl px-4 py-3 outline-none ${
                    isDark
                      ? "bg-slate-900 border-slate-700 text-white caret-green-500 focus:border-green-500"
                      : "bg-white border-gray-200 text-gray-900 caret-green-500 focus:border-green-500"
                  }`}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowPassword((prev) => !prev);
                  }}
                  className={`absolute right-4 top-1/2 -translate-y-1/2 focus:outline-none transition-colors z-10 ${isDark ? "text-slate-500 hover:text-slate-300" : "text-gray-400 hover:text-gray-600"}`}
                >
                  {showPassword ? (
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
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                      />
                    </svg>
                  ) : (
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
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                  )}
                </button>
                <div className="absolute right-12 top-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center">
                  <AnimatePresence mode="popLayout">
                    {formData.password &&
                    formData.confirmPassword &&
                    formData.password === formData.confirmPassword ? (
                      <motion.div
                        key="match"
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{
                          scale: 0,
                          opacity: 0,
                          transition: { duration: 0.1 },
                        }}
                        transition={{
                          type: "spring",
                          stiffness: 500,
                          damping: 25,
                        }}
                        className="text-green-500"
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
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      </motion.div>
                    ) : formData.password &&
                      formData.confirmPassword &&
                      formData.password !== formData.confirmPassword ? (
                      <motion.div
                        key="mismatch"
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{
                          scale: 0,
                          opacity: 0,
                          transition: { duration: 0.1 },
                        }}
                        transition={{
                          type: "spring",
                          stiffness: 500,
                          damping: 25,
                        }}
                        className="text-red-500"
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
                            d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              </div>
            </SpotlightBorder>
            <PasswordStrengthMeter
              password={formData.password}
              isVisible={isPasswordFocused}
              isDark={isDark}
            />
          </div>

          <div>
            <label
              className={`block text-sm font-bold mb-2 ${isDark ? "text-slate-300" : "text-gray-700"}`}
            >
              Confirm Password <span className="text-red-500">*</span>
            </label>
            <SpotlightBorder isDark={isDark}>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={formData.confirmPassword}
                  onChange={(e) =>
                    setFormData({ ...formData, confirmPassword: e.target.value })
                  }
                  required
                  className={`w-full border rounded-xl px-4 py-3 outline-none ${
                    isDark
                      ? "bg-slate-900 border-slate-700 text-white caret-green-500 focus:border-green-500"
                      : "bg-white border-gray-200 text-gray-900 caret-green-500 focus:border-green-500"
                  }`}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowPassword((prev) => !prev);
                  }}
                  className={`absolute right-4 top-1/2 -translate-y-1/2 focus:outline-none transition-colors z-10 ${isDark ? "text-slate-500 hover:text-slate-300" : "text-gray-400 hover:text-gray-600"}`}
                >
                  {showPassword ? (
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
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                      />
                    </svg>
                  ) : (
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
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                  )}
                </button>
                <div className="absolute right-12 top-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center">
                  <AnimatePresence mode="popLayout">
                    {formData.password &&
                    formData.confirmPassword &&
                    formData.password === formData.confirmPassword ? (
                      <motion.div
                        key="match"
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{
                          scale: 0,
                          opacity: 0,
                          transition: { duration: 0.1 },
                        }}
                        transition={{
                          type: "spring",
                          stiffness: 500,
                          damping: 25,
                        }}
                        className="text-green-500"
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
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      </motion.div>
                    ) : formData.password &&
                      formData.confirmPassword &&
                      formData.password !== formData.confirmPassword ? (
                      <motion.div
                        key="mismatch"
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{
                          scale: 0,
                          opacity: 0,
                          transition: { duration: 0.1 },
                        }}
                        transition={{
                          type: "spring",
                          stiffness: 500,
                          damping: 25,
                        }}
                        className="text-red-500"
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
                            d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              </div>
            </SpotlightBorder>
          </div>

          <div>
            <label
              className={`block text-sm font-bold mb-2 ${isDark ? "text-slate-300" : "text-gray-700"}`}
            >
              Student Number <span className="text-red-500">*</span>
            </label>
            <SpotlightBorder isDark={isDark}>
              <input
                type="text"
                value={formData.studentNumber}
                onChange={(e) =>
                  setFormData({ ...formData, studentNumber: e.target.value })
                }
                placeholder="e.g., 21-3243 or 23-3174-TS"
                required
                className={`w-full border rounded-xl px-4 py-3 outline-none ${
                  isDark
                    ? "bg-slate-900 border-slate-700 text-white caret-green-500 focus:border-green-500"
                    : "bg-white border-gray-200 text-gray-900 caret-green-500 focus:border-green-500"
                }`}
              />
            </SpotlightBorder>
          </div>

          <div>
            <label
              className={`block text-sm font-bold mb-2 ${isDark ? "text-slate-300" : "text-gray-700"}`}
            >
              Course <span className="text-red-500">*</span>
            </label>
            <CustomSelect
              options={COURSE_OPTIONS}
              value={formData.course}
              onChange={(value) => setFormData({ ...formData, course: value })}
              placeholder="Select your course"
              isDark={isDark}
              searchable
            />
          </div>

          <div>
            <label
              className={`block text-sm font-bold mb-2 ${isDark ? "text-slate-300" : "text-gray-700"}`}
            >
              Year Level <span className="text-red-500">*</span>
            </label>
            <CustomSelect
              options={YEAR_LEVEL_OPTIONS}
              value={formData.yearLevel}
              onChange={(value) =>
                setFormData({ ...formData, yearLevel: value })
              }
              placeholder="Select your year level"
              isDark={isDark}
            />
          </div>

          {!IS_LOCALHOST && (
            <div className="flex justify-center py-4">
              <ReCAPTCHA
                ref={recaptchaRef}
                sitekey={RECAPTCHA_SITE_KEY}
                onChange={(token) => setRecaptchaToken(token)}
                onExpired={() => setRecaptchaToken(null)}
                theme={isDark ? "dark" : "light"}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading || (!recaptchaToken && !IS_LOCALHOST)}
            className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-full shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            Next: Verify ID →
          </button>
        </motion.form>
      )}

      {currentStep === 2 && (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
        >
          <IDVerification
            onVerified={handleIDVerified}
            isDark={isDark}
            firstName={formData.firstName}
            lastName={formData.lastName}
            studentNumber={formData.studentNumber}
          />
          <button
            onClick={() => setCurrentStep(1)}
            className={`mt-4 w-full py-3 rounded-full font-semibold ${
              isDark
                ? "bg-slate-700 hover:bg-slate-600 text-white"
                : "bg-gray-200 hover:bg-gray-300 text-gray-800"
            }`}
          >
            ← Back to Form
          </button>
        </motion.div>
      )}

      {currentStep === 3 && (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
        >
          <SelfieCapture
            idDescriptor={idDescriptor}
            onMatch={handleFaceMatch}
            isDark={isDark}
          />
          <button
            onClick={() => setCurrentStep(2)}
            disabled={loading}
            className={`mt-4 w-full py-3 rounded-full font-semibold ${
              loading
                ? "bg-gray-400 cursor-not-allowed"
                : isDark
                  ? "bg-slate-700 hover:bg-slate-600 text-white"
                  : "bg-gray-200 hover:bg-gray-300 text-gray-800"
            }`}
          >
            ← Back to ID Upload
          </button>
        </motion.div>
      )}
    </div>
  );
}
