import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  onConfirm,
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmButtonClass = "bg-primary-600 hover:bg-primary-700 text-white",
  showCancel = true,
  size = "md",
  isDark = false,
}) {
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      const scrollbarWidth =
        window.innerWidth - document.documentElement.clientWidth;
      document.body.style.paddingRight = `${scrollbarWidth}px`;

      const fixedElements = document.querySelectorAll(".fixed-compensate");
      fixedElements.forEach((el) => {
        el.style.marginRight = `${scrollbarWidth}px`;
      });

      document.body.style.overflow = "hidden";
      document.addEventListener("keydown", handleEscape);
    } else {
      document.body.style.paddingRight = "0px";

      const fixedElements = document.querySelectorAll(".fixed-compensate");
      fixedElements.forEach((el) => {
        el.style.marginRight = "0px";
      });

      document.body.style.overflow = "unset";
      document.removeEventListener("keydown", handleEscape);
    }
    return () => {
      document.body.style.paddingRight = "0px";

      const fixedElements = document.querySelectorAll(".fixed-compensate");
      fixedElements.forEach((el) => {
        el.style.marginRight = "0px";
      });

      document.body.style.overflow = "unset";
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  const sizeClasses = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className={`relative w-full rounded-2xl shadow-2xl ${sizeClasses[size]} overflow-hidden border ${
              isDark
                ? "bg-slate-900 border-slate-700 text-slate-100"
                : "bg-white border-slate-100 text-slate-900"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={`flex items-center justify-between p-6 border-b ${isDark ? "border-slate-800" : "border-slate-100"}`}
            >
              <h3
                className={`text-xl font-bold font-display ${isDark ? "text-white" : "text-slate-900"}`}
              >
                {title}
              </h3>
              <button
                onClick={onClose}
                className={`transition-colors rounded-lg p-1 ${
                  isDark
                    ? "text-slate-400 hover:text-white hover:bg-slate-800"
                    : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                }`}
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="p-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
              {children}
            </div>

            {onConfirm && (
              <div
                className={`flex items-center justify-end gap-3 p-6 border-t ${isDark ? "border-slate-800 bg-slate-900/50" : "border-slate-100 bg-slate-50/50"}`}
              >
                {showCancel && (
                  <button
                    onClick={onClose}
                    className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                      isDark
                        ? "text-slate-300 hover:text-white hover:bg-slate-800"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-200"
                    }`}
                  >
                    {cancelText}
                  </button>
                )}
                <button
                  onClick={onConfirm}
                  className={`px-6 py-2 rounded-lg font-bold text-sm shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all ${confirmButtonClass}`}
                >
                  {confirmText}
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  type = "danger",
  isDark = false,
}) {
  const typeConfig = {
    danger: {
      icon: (
        <svg
          className="w-6 h-6 text-red-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      ),
      buttonClass: "bg-red-600 hover:bg-red-700 text-white",
    },
    warning: {
      icon: (
        <svg
          className="w-6 h-6 text-yellow-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      ),
      buttonClass: "bg-yellow-600 hover:bg-yellow-700 text-white",
    },
    info: {
      icon: (
        <svg
          className="w-6 h-6 text-blue-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
      buttonClass: "bg-primary-600 hover:bg-primary-700 text-white",
    },
  };

  const config = typeConfig[type];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title={title}
      confirmText={confirmText}
      cancelText={cancelText}
      confirmButtonClass={config.buttonClass}
      size="sm"
      isDark={isDark}
    >
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">{config.icon}</div>
        <div className="flex-1">
          <p className={isDark ? "text-slate-300" : "text-gray-700"}>
            {message}
          </p>
        </div>
      </div>
    </Modal>
  );
}
