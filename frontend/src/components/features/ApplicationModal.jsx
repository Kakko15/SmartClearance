import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { XMarkIcon, ChevronDownIcon, DocumentCheckIcon } from "../ui/Icons";

const INTENT_OPTIONS = [
  "Certification",
  "Transcript of Records",
  "Honorable Dismissal",
  "Diploma/Certificate",
  "Others",
];

const ApplicationModal = ({
  isOpen,
  onClose,
  onSubmit,
  portion,
  studentInfo,
  isDarkMode,
}) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    intents: [],
    intentOthers: "",
    acceptedWarning: false,
    thesisTitle: "",
    semestersEnrolled: "",
    summersEnrolled: "",
    nstpSerial: studentInfo?.nstp_serial_no || "",
    major: studentInfo?.major || "",
    agreedToTerms: false,
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [step3Touched, setStep3Touched] = useState(false);

  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setStep(1);
      setFormData((prev) => ({
        ...prev,
        intents: [],
        intentOthers: "",
        acceptedWarning: false,
        agreedToTerms: false,
      }));
    }
  }

  const handleIntentToggle = (intent) => {
    setFormData((prev) => ({
      ...prev,
      intents: prev.intents.includes(intent)
        ? prev.intents.filter((i) => i !== intent)
        : [...prev.intents, intent],
    }));
  };

  const nextStep = () => {
    if (step === 1 && formData.intents.includes("Honorable Dismissal")) {
      setStep(2);
    } else if (step === 1 || step === 2) {
      setStep(3);
      setStep3Touched(false);
      setFieldErrors({});
    } else if (step === 3) {
      setStep3Touched(true);
      const errors = getStep3Errors();
      setFieldErrors(errors);
      if (Object.values(errors).some((e) => e !== "")) return;
      setStep(4);
    }
  };

  const prevStep = () => {
    if (step === 4) setStep(3);
    else if (step === 3 && formData.intents.includes("Honorable Dismissal"))
      setStep(2);
    else if (step === 3) setStep(1);
    else if (step === 2) setStep(1);
  };

  const validateStep3Field = (name, value) => {
    switch (name) {
      case "major": {
        const v = (value ?? "").trim();
        if (!v) return "Course major is required.";
        if (/^N\/A$/i.test(v)) return "";

        if (/^[A-Z][A-Z\s.]{0,11}$/.test(v)) return "";
        if (v.length < 3) return "Must be at least 3 characters.";
        if (/(.)\1{2,}/i.test(v)) return "Please enter a valid course major.";
        const vowelCount = (v.match(/[aeiou]/gi) || []).length;
        if (vowelCount === 0) return "Please enter a valid course major.";

        const words = v.split(/\s+/).filter((w) => w.length > 0);
        if (words.length === 1 && v.length < 5)
          return "Please enter your full course major.";
        return "";
      }
      case "semestersEnrolled": {
        const num = parseInt(value, 10);
        if (!value && value !== 0) return "Semesters enrolled is required.";
        if (isNaN(num) || num < 1) return "Must be at least 1.";
        if (num > 20) return "Cannot exceed 20 semesters.";
        return "";
      }
      case "summersEnrolled": {
        if (value === "" || value === undefined) return "";
        const num = parseInt(value, 10);
        if (isNaN(num) || num < 0) return "Cannot be negative.";
        if (num > 10) return "Cannot exceed 10 summers.";
        return "";
      }
      case "nstpSerial": {
        if (portion !== "undergraduate") return "";
        const v = (value ?? "").trim();
        if (!v) return "NSTP Serial No. is required.";
        if (v.length < 5) return "Must be at least 5 characters (e.g. 19-02685-IsU).";
        if (!/\d/.test(v)) return "Must contain at least one number (e.g. 19-02685-IsU).";
        if (!/[-]/.test(v)) return "Must contain a hyphen (e.g. 19-02685-IsU).";
        return "";
      }
      default:
        return "";
    }
  };

  const getStep3Errors = () => {
    const errors = {};
    errors.major = validateStep3Field("major", formData.major);
    errors.semestersEnrolled = validateStep3Field("semestersEnrolled", formData.semestersEnrolled);
    errors.summersEnrolled = validateStep3Field("summersEnrolled", formData.summersEnrolled);
    if (portion === "undergraduate") {
      errors.nstpSerial = validateStep3Field("nstpSerial", formData.nstpSerial);
    }
    return errors;
  };

  const handleStep3Change = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (step3Touched) {
      setFieldErrors((prev) => ({
        ...prev,
        [name]: validateStep3Field(name, value),
      }));
    }
  };

  const handleStep3Blur = (name) => {
    setFieldErrors((prev) => ({
      ...prev,
      [name]: validateStep3Field(name, formData[name]),
    }));
  };

  const isNextDisabled = () => {
    if (step === 1)
      return (
        formData.intents.length === 0 ||
        (formData.intents.includes("Others") && !formData.intentOthers.trim())
      );
    if (step === 2) return !formData.acceptedWarning;
    if (step === 3) {
      const errors = getStep3Errors();
      return Object.values(errors).some((e) => e !== "");
    }
    if (step === 4) return !formData.agreedToTerms;
    return false;
  };

  const handleSubmit = () => {
    onSubmit({
      portion,
      clearance_intent: formData.intents,
      clearance_intent_others: formData.intentOthers,
      thesis_title: formData.thesisTitle,
      semesters_enrolled: parseInt(formData.semestersEnrolled, 10),
      summers_enrolled: parseInt(formData.summersEnrolled, 10) || 0,
      student_agreement_accepted: formData.agreedToTerms,

      nstp_serial_no: formData.nstpSerial,
      major: formData.major,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-[#202124]/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className={`relative w-full max-w-[560px] rounded-[28px] overflow-hidden flex flex-col shadow-2xl ${
          isDarkMode ? "bg-[#28292a] text-[#e8eaed]" : "bg-white text-[#202124]"
        }`}
        style={{ fontFamily: "'Google Sans', 'Inter', sans-serif" }}
      >
        {}
        <div
          className={`px-6 py-4 flex items-center justify-between border-b ${isDarkMode ? "border-[#3c4043]" : "border-gray-100"}`}
        >
          <div>
            <h2 className="text-[20px] font-medium tracking-tight">
              Clearance Application
            </h2>
            <p
              className={`text-[13px] ${isDarkMode ? "text-[#9aa0a6]" : "text-gray-500"}`}
            >
              {portion === "undergraduate" ? "Undergraduate" : "Graduate"}{" "}
              Portion - Step {step} of 4
            </p>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-full transition-colors ${isDarkMode ? "hover:bg-[#3c4043]" : "hover:bg-gray-100"}`}
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {}
        <div className="h-1 w-full bg-gray-100 dark:bg-[#3c4043]">
          <motion.div
            className="h-full bg-primary-600 dark:bg-primary-400"
            initial={{ width: "25%" }}
            animate={{ width: `${(step / 4) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        {}
        <div className="px-6 py-6 max-h-[60vh] overflow-y-auto">
          <AnimatePresence mode="wait">
            {}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <h3 className="text-[18px] font-medium mb-4">
                  What limits are you securing this clearance for?
                </h3>
                <p
                  className={`text-[14px] mb-5 ${isDarkMode ? "text-[#9aa0a6]" : "text-gray-500"}`}
                >
                  Please mark all applicable items as required by REG. Form 07.
                </p>
                <div className="space-y-3">
                  {INTENT_OPTIONS.map((intent) => (
                    <label
                      key={intent}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                        formData.intents.includes(intent)
                          ? isDarkMode
                            ? "bg-primary-900/20 border-primary-500/50"
                            : "bg-primary-50 border-primary-500"
                          : isDarkMode
                            ? "border-[#3c4043] hover:bg-[#3c4043]/50"
                            : "border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className={`w-5 h-5 rounded ${isDarkMode ? "accent-primary-400" : "accent-primary-600"}`}
                        checked={formData.intents.includes(intent)}
                        onChange={() => handleIntentToggle(intent)}
                      />
                      <span className="text-[15px] font-medium">{intent}</span>
                    </label>
                  ))}

                  <AnimatePresence>
                    {formData.intents.includes("Others") && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                      >
                        <input
                          type="text"
                          placeholder="Please specify..."
                          value={formData.intentOthers}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              intentOthers: e.target.value,
                            })
                          }
                          className={`w-full mt-2 px-4 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-primary-500/50 ${
                            isDarkMode
                              ? "bg-[#202124] border-[#3c4043] text-white"
                              : "bg-white border-gray-200"
                          }`}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}

            {}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <div
                  className={`p-4 rounded-2xl mb-6 ${isDarkMode ? "bg-red-900/20 text-red-200" : "bg-red-50 text-red-800"}`}
                >
                  <h3 className="text-[18px] font-bold mb-2 flex items-center gap-2">
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
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                    Important Notice
                  </h3>
                  <p className="text-[14px] leading-relaxed">
                    It is understood that any{" "}
                    <strong>"Incomplete Grades"</strong> incurred by me which
                    has not yet been completed before the issuance of my
                    Honorable Dismissal shall automatically become{" "}
                    <strong>"5.0"</strong> even if the reglementary period of
                    one (1) academic year for the completion of the same has not
                    yet lapsed.
                  </p>
                </div>

                <label className="flex items-start gap-4 cursor-pointer p-2">
                  <input
                    type="checkbox"
                    className="w-5 h-5 rounded mt-1 accent-red-600"
                    checked={formData.acceptedWarning}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        acceptedWarning: e.target.checked,
                      })
                    }
                  />
                  <span
                    className={`text-[15px] font-medium ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}
                  >
                    I acknowledge and accept the automatic "5.0" grade
                    conversion policy for all my incomplete grades upon issuance
                    of my Honorable Dismissal.
                  </span>
                </label>
              </motion.div>
            )}

            {}
            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <h3 className="text-[18px] font-medium mb-4">
                  Academic Details
                </h3>
                <p
                  className={`text-[14px] mb-5 ${isDarkMode ? "text-[#9aa0a6]" : "text-gray-500"}`}
                >
                  Fill in all necessary information required by the {portion}{" "}
                  portion evaluation.
                </p>

                <div className="space-y-4">
                  <div>
                    <label
                      className={`block text-xs font-semibold mb-1 uppercase tracking-wider ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}
                    >
                      Course Major <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.major}
                      onChange={(e) => handleStep3Change("major", e.target.value)}
                      onBlur={() => handleStep3Blur("major")}
                      placeholder="e.g. Major in Business Analytics"
                      className={`w-full px-4 py-2.5 rounded-xl border outline-none focus:ring-2 transition-colors duration-200 ${fieldErrors.major ? "border-red-500 focus:ring-red-500/50" : `focus:ring-primary-500/50 ${isDarkMode ? "border-[#3c4043]" : "border-gray-200"}`} ${isDarkMode ? "bg-[#202124] text-white" : "bg-white"}`}
                    />
                    <AnimatePresence>
                      {fieldErrors.major && (
                        <motion.div
                          key="major-error"
                          initial={{ opacity: 0, y: -5, height: 0 }}
                          animate={{ opacity: 1, y: 0, height: "auto" }}
                          exit={{ opacity: 0, y: -5, height: 0 }}
                          transition={{ duration: 0.2, ease: "easeInOut" }}
                          className="overflow-hidden"
                        >
                          <p className="mt-1.5 text-[11px] font-bold leading-tight text-red-500">
                            {fieldErrors.major}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <p
                      className={`mt-1.5 text-[11px] leading-tight ${isDarkMode ? "text-[#9aa0a6]" : "text-gray-500"}`}
                    >
                      Specify your program major. If none, type &quot;N/A&quot;.
                    </p>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label
                        className={`block text-xs font-semibold mb-1 uppercase tracking-wider ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}
                      >
                        Semesters Enrolled{" "}
                        <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={formData.semestersEnrolled}
                        onChange={(e) => handleStep3Change("semestersEnrolled", e.target.value)}
                        onBlur={() => handleStep3Blur("semestersEnrolled")}
                        className={`w-full px-4 py-2.5 rounded-xl border outline-none focus:ring-2 transition-colors duration-200 ${fieldErrors.semestersEnrolled ? "border-red-500 focus:ring-red-500/50" : `focus:ring-primary-500/50 ${isDarkMode ? "border-[#3c4043]" : "border-gray-200"}`} ${isDarkMode ? "bg-[#202124] text-white" : "bg-white"}`}
                      />
                      <AnimatePresence>
                        {fieldErrors.semestersEnrolled && (
                          <motion.div
                            key="sem-error"
                            initial={{ opacity: 0, y: -5, height: 0 }}
                            animate={{ opacity: 1, y: 0, height: "auto" }}
                            exit={{ opacity: 0, y: -5, height: 0 }}
                            transition={{ duration: 0.2, ease: "easeInOut" }}
                            className="overflow-hidden"
                          >
                            <p className="mt-1.5 text-[11px] font-bold leading-tight text-red-500">
                              {fieldErrors.semestersEnrolled}
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                      <p
                        className={`mt-1.5 text-[11px] leading-tight ${isDarkMode ? "text-[#9aa0a6]" : "text-gray-500"}`}
                      >
                        Total regular semesters attended (e.g. 8 for a 4-year
                        course).
                      </p>
                    </div>
                    <div className="flex-1">
                      <label
                        className={`block text-xs font-semibold mb-1 uppercase tracking-wider ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}
                      >
                        Summers Enrolled
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="10"
                        value={formData.summersEnrolled}
                        onChange={(e) => handleStep3Change("summersEnrolled", e.target.value)}
                        onBlur={() => handleStep3Blur("summersEnrolled")}
                        className={`w-full px-4 py-2.5 rounded-xl border outline-none focus:ring-2 transition-colors duration-200 ${fieldErrors.summersEnrolled ? "border-red-500 focus:ring-red-500/50" : `focus:ring-primary-500/50 ${isDarkMode ? "border-[#3c4043]" : "border-gray-200"}`} ${isDarkMode ? "bg-[#202124] text-white" : "bg-white"}`}
                      />
                      <AnimatePresence>
                        {fieldErrors.summersEnrolled && (
                          <motion.div
                            key="sum-error"
                            initial={{ opacity: 0, y: -5, height: 0 }}
                            animate={{ opacity: 1, y: 0, height: "auto" }}
                            exit={{ opacity: 0, y: -5, height: 0 }}
                            transition={{ duration: 0.2, ease: "easeInOut" }}
                            className="overflow-hidden"
                          >
                            <p className="mt-1.5 text-[11px] font-bold leading-tight text-red-500">
                              {fieldErrors.summersEnrolled}
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                      <p
                        className={`mt-1.5 text-[11px] leading-tight ${isDarkMode ? "text-[#9aa0a6]" : "text-gray-500"}`}
                      >
                        Mid-year/summer terms. Leave blank if none.
                      </p>
                    </div>
                  </div>

                  <div>
                    <label
                      className={`block text-xs font-semibold mb-1 uppercase tracking-wider ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}
                    >
                      {portion === "undergraduate"
                        ? "Thesis / Major Field Practice Title"
                        : "Doctoral Dissertation / Master's Thesis Title"}
                    </label>
                    <textarea
                      rows="2"
                      value={formData.thesisTitle}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          thesisTitle: e.target.value,
                        })
                      }
                      placeholder="Enter full title here..."
                      className={`w-full px-4 py-2.5 rounded-xl border outline-none focus:ring-2 focus:ring-primary-500/50 resize-none ${isDarkMode ? "bg-[#202124] border-[#3c4043] text-white" : "bg-white border-gray-200"}`}
                    />
                    <p
                      className={`mt-1.5 text-[11px] leading-tight ${isDarkMode ? "text-[#9aa0a6]" : "text-gray-500"}`}
                    >
                      Exact approved title of your final manuscript/practicum
                      required by the Campus Library.
                    </p>
                  </div>

                  {portion === "undergraduate" && (
                    <div>
                      <label
                        className={`block text-xs font-semibold mb-1 uppercase tracking-wider ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}
                      >
                        NSTP Serial No. <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.nstpSerial}
                        onChange={(e) => handleStep3Change("nstpSerial", e.target.value)}
                        onBlur={() => handleStep3Blur("nstpSerial")}
                        placeholder="e.g. 19-02685-IsU"
                        className={`w-full px-4 py-2.5 rounded-xl border outline-none focus:ring-2 transition-colors duration-200 ${fieldErrors.nstpSerial ? "border-red-500 focus:ring-red-500/50" : `focus:ring-primary-500/50 ${isDarkMode ? "border-[#3c4043]" : "border-gray-200"}`} ${isDarkMode ? "bg-[#202124] text-white" : "bg-white"}`}
                      />
                      <AnimatePresence>
                        {fieldErrors.nstpSerial && (
                          <motion.div
                            key="nstp-error"
                            initial={{ opacity: 0, y: -5, height: 0 }}
                            animate={{ opacity: 1, y: 0, height: "auto" }}
                            exit={{ opacity: 0, y: -5, height: 0 }}
                            transition={{ duration: 0.2, ease: "easeInOut" }}
                            className="overflow-hidden"
                          >
                            <p className="mt-1.5 text-[11px] font-bold leading-tight text-red-500">
                              {fieldErrors.nstpSerial}
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                      <p
                        className={`mt-1.5 text-[11px] leading-tight ${isDarkMode ? "text-[#9aa0a6]" : "text-gray-500"}`}
                      >
                        Found on your NSTP Certificate of Completion or TOR.
                        Contact the NSTP Office if unsure.
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {}
            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="text-center pt-2"
              >
                <div
                  className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-5 ${isDarkMode ? "bg-primary-900/30 text-primary-400" : "bg-primary-50 text-primary-600"}`}
                >
                  <DocumentCheckIcon className="w-10 h-10" />
                </div>
                <h3 className="text-[22px] font-medium mb-3">
                  Final Acknowledgment
                </h3>
                <p
                  className={`text-[15px] leading-relaxed mb-8 max-w-sm mx-auto ${isDarkMode ? "text-[#9aa0a6]" : "text-gray-600"}`}
                >
                  I have the honor to apply for clearance from property and
                  financial responsibilities with the University.
                </p>

                <div
                  className={`p-5 rounded-2xl border text-left flex items-start gap-4 cursor-pointer transition-colors ${
                    formData.agreedToTerms
                      ? isDarkMode
                        ? "border-primary-500/50 bg-primary-900/10"
                        : "border-primary-500 bg-primary-50"
                      : isDarkMode
                        ? "border-[#3c4043]"
                        : "border-gray-200"
                  }`}
                  onClick={() =>
                    setFormData({
                      ...formData,
                      agreedToTerms: !formData.agreedToTerms,
                    })
                  }
                >
                  <div
                    className={`w-6 h-6 shrink-0 rounded mt-0.5 flex items-center justify-center border-2 transition-colors ${
                      formData.agreedToTerms
                        ? "bg-primary-600 border-primary-600 dark:bg-primary-500 dark:border-primary-500"
                        : "border-gray-300 dark:border-gray-600"
                    }`}
                  >
                    {formData.agreedToTerms && (
                      <svg
                        className="w-4 h-4 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </div>
                  <div>
                    <span className="text-[14px] font-medium block mb-1">
                      Digital Signature Agreement
                    </span>
                    <span
                      className={`text-[13px] block ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}
                    >
                      By checking this box, I legally bind my typed name as my
                      official signature and attest that all provided academic
                      information is accurate.
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {}
        <div
          className={`px-6 py-4 flex items-center justify-between border-t ${isDarkMode ? "border-[#3c4043] bg-[#202124]" : "border-gray-100 bg-gray-50/50"}`}
        >
          <button
            onClick={prevStep}
            className={`px-5 py-2.5 rounded-full font-medium text-[14px] transition-colors ${step === 1 ? "invisible" : isDarkMode ? "text-gray-300 hover:bg-[#3c4043]" : "text-gray-600 hover:bg-gray-200"}`}
          >
            Back
          </button>

          {step < 4 ? (
            <button
              onClick={nextStep}
              disabled={isNextDisabled()}
              className={`px-6 py-2.5 rounded-full font-medium text-[14px] transition-all ${
                isNextDisabled()
                  ? "opacity-50 cursor-not-allowed bg-gray-300 text-gray-500 dark:bg-[#3c4043] dark:text-gray-500"
                  : "bg-primary-600 text-white hover:bg-primary-700 shadow-md active:scale-95 dark:bg-primary-500 dark:text-[#202124] dark:hover:bg-primary-400"
              }`}
            >
              Continue
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isNextDisabled()}
              className={`px-8 py-2.5 rounded-full font-bold text-[14px] flex items-center gap-2 transition-all ${
                isNextDisabled()
                  ? "opacity-50 cursor-not-allowed bg-gray-300 text-gray-500 dark:bg-[#3c4043] dark:text-gray-500"
                  : "bg-primary-600 text-white hover:bg-primary-700 shadow-lg hover:shadow-xl active:scale-95 dark:bg-primary-500 dark:text-[#202124] dark:hover:bg-primary-400"
              }`}
            >
              Submit Application
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default ApplicationModal;
