import { useRef, useState } from "react";
import { motion } from "framer-motion";

export const SlideTabs = ({ isDark }) => {
  const [position, setPosition] = useState({
    left: 0,
    width: 0,
    opacity: 0,
  });

  return (
    <ul
      onMouseLeave={() => {
        setPosition((pv) => ({
          ...pv,
          opacity: 0,
        }));
      }}
      className={`relative mx-auto flex w-fit rounded-full border p-1 transition-colors duration-300 ${
        isDark
          ? "border-slate-700 bg-slate-900/50"
          : "border-slate-200 bg-white/50"
      }`}
    >
      <Tab
        setPosition={setPosition}
        isDark={isDark}
        href="#"
        onClick={(e) => {
          e.preventDefault();
          history.pushState(null, "", window.location.pathname);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      >
        Home
      </Tab>
      <Tab setPosition={setPosition} isDark={isDark} href="#features">
        Features
      </Tab>
      <Tab setPosition={setPosition} isDark={isDark} href="#about">
        About ISUE
      </Tab>

      <Cursor position={position} isDark={isDark} />
    </ul>
  );
};

const Tab = ({ children, setPosition, isDark, href, onClick }) => {
  const ref = useRef(null);

  return (
    <li
      ref={ref}
      onMouseEnter={() => {
        if (!ref?.current) return;

        const { width } = ref.current.getBoundingClientRect();

        setPosition({
          left: ref.current.offsetLeft,
          width,
          opacity: 1,
        });
      }}
      className="relative z-10 block"
    >
      <a
        href={href}
        onClick={onClick}
        className={`flex items-center justify-center w-full h-full cursor-pointer px-4 py-2 text-xs uppercase font-bold tracking-widest transition-colors duration-300 md:px-6 md:py-2.5 md:text-sm ${
          isDark
            ? "text-slate-400 hover:text-white"
            : "text-slate-500 hover:text-slate-900"
        }`}
      >
        {children}
      </a>
    </li>
  );
};

const Cursor = ({ position, isDark }) => {
  return (
    <motion.li
      animate={{
        ...position,
      }}
      className={`absolute z-0 inset-y-1 rounded-full ${
        isDark ? "bg-slate-800" : "bg-slate-100"
      }`}
    />
  );
};
