import { motion } from "framer-motion";

export default function ThemeToggle({ isDark, toggle }) {
  return (
    <button
      onClick={toggle}
      className={`relative w-16 h-8 rounded-full p-1 transition-all duration-300 focus:outline-none flex items-center ${
        isDark
          ? "bg-slate-800 shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)]"
          : "bg-blue-100 shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)]"
      } ${isDark ? "justify-end" : "justify-start"}`}
      aria-label="Toggle Theme"
    >
      <motion.div
        className={`w-6 h-6 rounded-full shadow-md flex items-center justify-center relative z-10 ${
          isDark ? "bg-slate-950 border border-slate-700" : "bg-white"
        }`}
        layout
        transition={{ type: "spring", stiffness: 700, damping: 30 }}
      >
        <motion.div
          initial={false}
          animate={{
            rotate: isDark ? 0 : 90,
            scale: isDark ? 1 : 0,
            opacity: isDark ? 1 : 0,
          }}
          transition={{ duration: 0.2 }}
          className="absolute flex items-center justify-center"
        >
          <svg
            className="w-4 h-4 text-sky-100 drop-shadow-[0_0_3px_rgba(224,242,254,0.5)]"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            viewBox="0 0 24 24"
          >
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        </motion.div>

        <motion.div
          initial={false}
          animate={{
            rotate: isDark ? -90 : 0,
            scale: isDark ? 0 : 1,
            opacity: isDark ? 0 : 1,
          }}
          transition={{ duration: 0.2 }}
          className="absolute flex items-center justify-center"
        >
          <svg
            className="w-4 h-4 text-orange-500 drop-shadow-[0_0_2px_rgba(249,115,22,0.4)]"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            viewBox="0 0 24 24"
          >
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2" />
            <path d="M12 20v2" />
            <path d="M4.93 4.93l1.41 1.41" />
            <path d="M17.66 17.66l1.41 1.41" />
            <path d="M2 12h2" />
            <path d="M20 12h2" />
            <path d="M6.34 17.66l-1.41 1.41" />
            <path d="M19.07 4.93l-1.41 1.41" />
          </svg>
        </motion.div>
      </motion.div>
    </button>
  );
}
