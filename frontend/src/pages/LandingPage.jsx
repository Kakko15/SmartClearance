import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
  useSpring,
} from "framer-motion";
import ThemeToggle from "../components/ui/ThemeToggle";
import { SlideTabs } from "../components/ui/SlideTabs";
import Modal from "../components/ui/Modal";
import logo from "../assets/logo.png";
import isuLogo from "../assets/isu-logo.jpg";

const LegalPolicy = ({ type }) => {
  if (type === "privacy") {
    return (
      <div className="space-y-6 text-sm leading-relaxed">
        <div className="p-4 bg-primary-500/10 rounded-xl border border-primary-500/20">
          <p className="font-bold text-primary-600">
            Effective Date: January 2026
          </p>
        </div>
        <p className="text-slate-700">
          At Smart Clearance System (Isabela State University - Echague Campus),
          we value your privacy and are committed to protecting your personal
          data. This Privacy Policy explains how we collect, use, and safeguard
          your information.
        </p>

        <div className="space-y-4">
          <h4 className="text-lg font-bold tracking-tight text-slate-800">
            1. Information We Collect
          </h4>
          <ul className="list-disc pl-5 space-y-2 text-slate-600">
            <li>
              <strong className="text-slate-800">
                Personal Identification:
              </strong>{" "}
              Name, Student ID, Course, and Year Level.
            </li>
            <li>
              <strong className="text-slate-800">Academic Records:</strong>{" "}
              Clearance status, grades, and enrollment data.
            </li>
            <li>
              <strong className="text-slate-800">Digital Logs:</strong> Login
              timestamps and transaction history.
            </li>
          </ul>
        </div>

        <div className="space-y-4">
          <h4 className="text-lg font-bold tracking-tight text-slate-800">
            2. How We Use Your Data
          </h4>
          <ul className="list-disc pl-5 space-y-2 text-slate-600">
            <li>Processing academic clearance applications.</li>
            <li>Verifying student identity and enrollment status.</li>
            <li>
              Generating digital certificates and reports for university
              administration.
            </li>
          </ul>
        </div>
      </div>
    );
  }

  if (type === "guides") {
    return (
      <div className="space-y-6 text-sm leading-relaxed">
        <div className="p-4 bg-primary-500/10 rounded-xl border border-primary-500/20">
          <p className="font-bold text-primary-600">
            Digital Guides & Documentation
          </p>
        </div>
        <p className="text-slate-700">
          Access comprehensive step-by-step documentation designed to help you
          navigate the Smart Clearance System efficiently.
        </p>

        <div className="space-y-4">
          <h4 className="text-lg font-bold tracking-tight text-slate-800">
            Student Guide
          </h4>
          <ul className="list-disc pl-5 space-y-2 text-slate-600">
            <li>
              <strong className="text-slate-800">Clearance Tracking:</strong>{" "}
              Monitor your clearance tasks and pending signatures in real-time.
            </li>
            <li>
              <strong className="text-slate-800">Document Submission:</strong>{" "}
              Upload deficiency requirements directly to your department heads.
            </li>
          </ul>
        </div>
      </div>
    );
  }

  if (type === "help") {
    return (
      <div className="space-y-6 text-sm leading-relaxed">
        <div className="p-4 bg-secondary-500/10 rounded-xl border border-secondary-500/20">
          <p className="font-bold text-secondary-600">Help Center & Support</p>
        </div>
        <p className="text-slate-700">
          Need assistance? Here are the best ways to get help with your account
          or clearance issues.
        </p>

        <div className="space-y-4">
          <h4 className="text-lg font-bold tracking-tight text-slate-800">
            Contact Directories
          </h4>
          <ul className="list-disc pl-5 space-y-2 text-slate-600">
            <li>
              <strong className="text-slate-800">IT Support Desk:</strong> Reach
              out to the campus IT department for login credentials recovery.
            </li>
            <li>
              <strong className="text-slate-800">Registrar's Office:</strong>{" "}
              Contact for questions regarding your academic records and
              clearance graduation status.
            </li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-sm leading-relaxed">
      <div className="p-4 bg-secondary-500/10 rounded-xl border border-secondary-500/20">
        <p className="font-bold text-secondary-600">
          Last Updated: January 2026
        </p>
      </div>
      <p className="text-slate-700">
        Welcome to Smart Clearance System. By accessing the system, you agree to
        these Terms of Use.
      </p>

      <div className="space-y-4">
        <h4 className="text-lg font-bold tracking-tight text-slate-800">
          1. Authorized Use
        </h4>
        <p className="text-slate-600">
          Smart Clearance System is strictly for the use of actively enrolled
          students, faculty, and staff of Isabela State University - Echague
          Campus. Unauthorized access is prohibited.
        </p>
      </div>

      <div className="space-y-4">
        <h4 className="text-lg font-bold tracking-tight text-slate-800">
          2. User Responsibilities
        </h4>
        <ul className="list-disc pl-5 space-y-2 text-slate-600">
          <li>
            You are responsible for maintaining the confidentiality of your
            login credentials.
          </li>
          <li>You agree to provide accurate and truthful information.</li>
          <li>
            Any attempt to falsify records or bypass system security will result
            in disciplinary action.
          </li>
        </ul>
      </div>
    </div>
  );
};

const FeatureCard = ({ title, desc, icon, delay, isDark, color }) => {
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseXSpring = useSpring(x, { stiffness: 300, damping: 20 });
  const mouseYSpring = useSpring(y, { stiffness: 300, damping: 20 });

  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["10deg", "-10deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-10deg", "10deg"]);

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const xPct = mouseX / width - 0.5;
    const yPct = mouseY / height - 0.5;

    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.98 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.6, delay, type: "spring", bounce: 0.2 }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX,
        rotateY,
        transformStyle: "preserve-3d",
      }}
      className={`relative p-8 rounded-[2rem] border overflow-hidden group will-change-transform ${
        isDark
          ? "bg-slate-900/40 border-slate-800 hover:border-slate-700/80 shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:shadow-primary-500/10"
          : "bg-white border-slate-100 hover:border-slate-200 shadow-xl shadow-slate-200/40 hover:shadow-2xl hover:shadow-primary-500/10"
      }`}
    >
      <motion.div
        style={{
          background: `radial-gradient(400px circle at center, ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.03)"}, transparent 40%)`,
          transform: "translateZ(10px)",
        }}
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
      />

      <div
        style={{ transform: "translateZ(40px)" }}
        className={`relative w-16 h-16 rounded-2xl flex items-center justify-center text-white mb-8 shadow-lg transition-transform duration-300 will-change-transform ${color}`}
      >
        <div className="absolute inset-0 bg-white/20 rounded-2xl group-hover:scale-110 transition-transform duration-300" />
        <span className="relative z-10 drop-shadow-md">{icon}</span>
      </div>

      <div style={{ transform: "translateZ(30px)" }}>
        <h3
          className={`text-2xl font-bold tracking-tight mb-4 transition-colors duration-300 ${isDark ? "text-white group-hover:text-primary-400" : "text-slate-900 group-hover:text-primary-600"}`}
        >
          {title}
        </h3>
        <p
          className={`leading-relaxed text-base ${isDark ? "text-slate-400" : "text-slate-500"}`}
        >
          {desc}
        </p>
      </div>
    </motion.div>
  );
};

const WORDS = ["Digital", "Rapid", "Smart", "Eco"];

const LandingPage = ({ onEnter, isDark, toggleTheme }) => {
  const navigate = useNavigate();
  const handleEnter = () => {
    if (onEnter) onEnter();
    navigate("/select-role");
  };
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeModal, setActiveModal] = useState(null);

  const [wordIndex, setWordIndex] = useState(0);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    document.title = "Smart Clearance System | Premium Experience";

    const wordInterval = setInterval(() => {
      setWordIndex((prev) => (prev + 1) % WORDS.length);
    }, 2500);

    return () => {
      clearInterval(wordInterval);
    };
  }, []);

  const staggerMain = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.15, delayChildren: 0.1 },
    },
  };

  const fadeUp = {
    hidden: { opacity: 0, y: 40 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.8, type: "spring", bounce: 0.3 },
    },
  };

  return (
    <div
      className={`relative min-h-screen w-full font-sans transition-colors duration-700 ${isDark ? "bg-[#030712] text-slate-100" : "bg-[#FAFAFA] text-slate-900"}`}
    >
      <div
        className="fixed inset-0 z-0 pointer-events-none overflow-hidden"
        aria-hidden="true"
      >
        <div
          className={`absolute -top-[20%] -right-[10%] w-[70vw] h-[70vw] max-w-[800px] max-h-[800px] rounded-full opacity-40 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] ${isDark ? "from-primary-900/40 via-primary-900/10 to-transparent" : "from-primary-300/40 via-primary-300/10 to-transparent"}`}
        />
        <div
          className={`absolute top-[40%] -left-[20%] w-[60vw] h-[60vw] max-w-[700px] max-h-[700px] rounded-full opacity-30 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] ${isDark ? "from-secondary-900/40 via-secondary-900/10 to-transparent" : "from-secondary-300/40 via-secondary-300/10 to-transparent"}`}
        />
        <div
          className={`absolute inset-0 bg-[url('/noise.png')] opacity-[0.03]`}
        />
      </div>

      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${isScrolled ? (isDark ? "bg-slate-900/80 mt-4 mx-4 md:mx-10 rounded-2xl border border-slate-800 shadow-2xl backdrop-blur-md" : "bg-white/80 mt-4 mx-4 md:mx-10 rounded-2xl border border-white shadow-2xl shadow-slate-200/50 backdrop-blur-md") : "bg-transparent mt-6 px-4 md:px-12"}`}
      >
        <div className="w-full h-16 md:h-20 px-4 md:px-8 flex justify-between items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-4 cursor-pointer group"
          >
            <div className="relative">
              <div
                className={`absolute inset-0 rounded-full blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${isDark ? "bg-primary-500/50" : "bg-primary-500/30"}`}
              />
              <img
                src={logo}
                alt="Logo"
                className="relative h-12 w-12 object-contain drop-shadow-lg transform group-hover:scale-105 transition-transform duration-500"
              />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-xl md:text-2xl font-black tracking-tighter uppercase">
                SMART
                <span
                  className={`text-transparent bg-clip-text bg-gradient-to-r ${isDark ? "from-primary-400 to-secondary-400" : "from-primary-600 to-secondary-600"}`}
                >
                  CLEARANCE
                </span>
              </h1>
            </div>
          </motion.div>

          <motion.nav
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="hidden lg:flex items-center gap-2"
          >
            <SlideTabs isDark={isDark} />
            <div
              className={`ml-4 pl-4 border-l ${isDark ? "border-slate-800" : "border-slate-200"}`}
            >
              <ThemeToggle isDark={isDark} toggle={toggleTheme} />
            </div>
          </motion.nav>

          <div className="flex lg:hidden items-center gap-4">
            <ThemeToggle isDark={isDark} toggle={toggleTheme} />
          </div>
        </div>
      </header>

      <main className="relative pt-40 pb-24 md:pt-48 md:pb-32 px-6 md:px-12 lg:px-20 z-10 min-h-screen flex items-center">
        <div className="w-full max-w-7xl mx-auto grid lg:grid-cols-[1.2fr,1fr] gap-16 items-center">
          <motion.div
            variants={staggerMain}
            initial="hidden"
            animate="visible"
            className="flex flex-col gap-8"
          >
            <motion.h1
              variants={fadeUp}
              className="text-6xl sm:text-7xl lg:text-8xl font-black leading-[0.95] tracking-tighter flex flex-col h-[180px] sm:h-[220px] lg:h-[240px]"
            >
              <div className="relative h-[1.1em] overflow-hidden">
                <AnimatePresence mode="popLayout">
                  <motion.span
                    key={wordIndex}
                    initial={{ y: 80, opacity: 0, rotateX: -90 }}
                    animate={{ y: 0, opacity: 1, rotateX: 0 }}
                    exit={{ y: -80, opacity: 0, rotateX: 90 }}
                    transition={{ duration: 0.6, type: "spring", bounce: 0.3 }}
                    className={`absolute inset-0 block pb-2 tracking-tight ${isDark ? "text-white" : "text-slate-900"} drop-shadow-sm`}
                    style={{ transformOrigin: "bottom" }}
                  >
                    {WORDS[wordIndex]}
                  </motion.span>
                </AnimatePresence>
              </div>
              <span
                className={`block text-transparent bg-clip-text bg-gradient-to-r pb-4 drop-shadow-sm ${isDark ? "from-primary-300 via-primary-500 to-secondary-400" : "from-primary-600 via-primary-500 to-secondary-500"}`}
              >
                Clearance.
              </span>
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className={`text-xl md:text-2xl max-w-xl font-medium leading-relaxed ${isDark ? "text-slate-400" : "text-slate-600"}`}
            >
              Seamless, rapid, and eco-conscious processing for the modern{" "}
              <strong className={isDark ? "text-slate-200" : "text-slate-900"}>
                Smart-Green University
              </strong>
              .
            </motion.p>

            <motion.div
              variants={fadeUp}
              className="flex flex-col sm:flex-row gap-5 pt-4"
            >
              <button
                onClick={handleEnter}
                className={`group relative overflow-hidden px-8 py-4 rounded-2xl font-bold tracking-widest transition-all hover:scale-105 active:scale-95 shadow-2xl ${isDark ? "bg-white text-slate-950 hover:shadow-white/20" : "bg-slate-950 text-white hover:shadow-black/20"}`}
              >
                <div
                  className={`absolute inset-0 w-full h-full -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent`}
                />
                <span className="flex items-center gap-3">
                  ACCESS SYSTEM
                  <span className="material-symbols-rounded transition-transform group-hover:translate-x-1">
                    arrow_forward
                  </span>
                </span>
              </button>
            </motion.div>

            <motion.div
              variants={fadeUp}
              className="grid grid-cols-3 gap-6 pt-10 border-t border-slate-200 dark:border-slate-800/50 mt-4"
            >
              {[
                { value: "5k+", label: "STUDENTS" },
                { value: "24h", label: "PROCESSING" },
                { value: "100%", label: "PAPERLESS" },
              ].map((stat, idx) => (
                <div key={idx}>
                  <p
                    className={`text-4xl font-black tracking-tight mb-1 ${isDark ? "text-white" : "text-slate-900"}`}
                  >
                    {stat.value}
                  </p>
                  <p
                    className={`text-xs font-bold tracking-[0.2em] ${isDark ? "text-slate-500" : "text-slate-400"}`}
                  >
                    {stat.label}
                  </p>
                </div>
              ))}
            </motion.div>
          </motion.div>

          <motion.div
            variants={fadeUp}
            className="hidden lg:flex relative h-[600px] w-full items-center justify-center perspective-[2000px] will-change-transform"
          >
            <div
              className={`relative w-full max-w-lg aspect-square rounded-[3rem] p-8 glass-panel shadow-2xl overflow-hidden animate-float ${isDark ? "bg-slate-900/40 border-slate-700/50 shadow-primary-900/20" : "bg-white/40 border-white shadow-primary-500/10"}`}
              style={{ transformStyle: "preserve-3d" }}
            >
              <div
                className={`absolute top-0 right-0 w-full h-full bg-gradient-to-br opacity-50 ${isDark ? "from-primary-900/40 to-secondary-900/40" : "from-primary-100 to-secondary-100"}`}
              />

              <div className="relative z-10 flex flex-col h-full gap-6 transform translate-z-[50px]">
                <div
                  className={`p-5 rounded-2xl backdrop-blur-md flex justify-between items-center ${isDark ? "bg-slate-800/80 border border-slate-700" : "bg-white/80 border border-slate-100"}`}
                >
                  <div className="flex gap-4 items-center">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-primary-500 to-primary-700 flex items-center justify-center shadow-m3-2">
                      <span className="material-symbols-rounded text-white">
                        verified_user
                      </span>
                    </div>
                    <div>
                      <div
                        className={`h-3 w-24 rounded-full mb-2 ${isDark ? "bg-slate-600" : "bg-slate-200"}`}
                      />
                      <div
                        className={`h-2 w-16 rounded-full ${isDark ? "bg-slate-700" : "bg-slate-100"}`}
                      />
                    </div>
                  </div>
                  <div className="px-3 py-1 bg-green-500/20 text-green-500 text-xs font-bold rounded-full border border-green-500/30">
                    VERIFIED
                  </div>
                </div>

                <div className="space-y-4 my-auto">
                  <div
                    className={`h-2.5 w-full rounded-full ${isDark ? "bg-slate-800" : "bg-slate-200/80"}`}
                  />
                  <div
                    className={`h-2.5 w-4/5 rounded-full ${isDark ? "bg-slate-800" : "bg-slate-200/80"}`}
                  />
                  <div
                    className={`h-2.5 w-2/3 rounded-full ${isDark ? "bg-slate-800" : "bg-slate-200/80"}`}
                  />
                </div>

                <div
                  className={`p-6 rounded-3xl mt-auto ${isDark ? "bg-slate-950/60 border border-slate-800" : "bg-slate-50/80 border border-slate-200"}`}
                >
                  <div className="flex justify-between items-end mb-4">
                    <div>
                      <p
                        className={`text-xs font-bold tracking-wider mb-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}
                      >
                        OVERALL PROGRESS
                      </p>
                      <p
                        className={`text-2xl font-black ${isDark ? "text-white" : "text-slate-900"}`}
                      >
                        100%
                      </p>
                    </div>
                    <span className="material-symbols-rounded text-primary-500 text-[32px]">
                      check_circle
                    </span>
                  </div>
                  <div
                    className={`h-2 w-full rounded-full overflow-hidden ${isDark ? "bg-slate-800" : "bg-slate-200"}`}
                  >
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: "100%" }}
                      transition={{
                        duration: 1.5,
                        delay: 0.5,
                        ease: "easeOut",
                      }}
                      className="h-full bg-gradient-to-r from-primary-500 to-secondary-500 rounded-full"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div
              className={`absolute -bottom-10 -left-10 p-5 rounded-2xl shadow-2xl border backdrop-blur-xl flex items-center gap-4 animate-float ${isDark ? "bg-slate-800/90 border-slate-700" : "bg-white/90 border-slate-100"}`}
              style={{ animationDelay: "1s" }}
            >
              <div className="w-12 h-12 rounded-full bg-primary-50 flex items-center justify-center text-primary-600">
                <span className="material-symbols-rounded">eco</span>
              </div>
              <div>
                <p
                  className={`text-[10px] font-bold tracking-widest uppercase ${isDark ? "text-slate-400" : "text-slate-500"}`}
                >
                  Eco Impact
                </p>
                <p
                  className={`text-xl font-black ${isDark ? "text-white" : "text-slate-900"}`}
                >
                  120 Trees Saved
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </main>

      <section
        className={`py-24 relative z-10 overflow-hidden ${isDark ? "bg-[#030712]" : "bg-[#FAFAFA]"}`}
      >
        <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-20">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-24 will-change-[opacity,transform]"
          >
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-black mb-6 tracking-tight">
              Seamless{" "}
              <span
                className={`text-transparent bg-clip-text bg-gradient-to-r ${isDark ? "from-primary-400 to-secondary-400" : "from-primary-600 to-secondary-600"}`}
              >
                Workflow.
              </span>
            </h2>
            <p
              className={`text-lg md:text-xl max-w-2xl mx-auto leading-relaxed ${isDark ? "text-slate-400" : "text-slate-600"}`}
            >
              Clearance processing simplified into a straightforward, automated
              digital experience.
            </p>
          </motion.div>

          <div className="space-y-12 md:space-y-0 md:grid md:grid-cols-3 gap-8 relative">
            <div
              className={`hidden md:block absolute top-[20%] left-[10%] w-[80%] h-0.5 ${isDark ? "bg-slate-700" : "bg-slate-200"} -z-10`}
            />

            {[
              {
                step: "01",
                title: "Login Authentication",
                text: "Securely sign in using your portal credentials.",
                icon: (
                  <span className="material-symbols-rounded text-[32px]">
                    login
                  </span>
                ),
              },
              {
                step: "02",
                title: "Digital Processing",
                text: "Offices verify your clearance in real-time.",
                icon: (
                  <span className="material-symbols-rounded text-[32px]">
                    manage_history
                  </span>
                ),
              },
              {
                step: "03",
                title: "Instant Verification",
                text: "Generate your secure digital clearance.",
                icon: (
                  <span className="material-symbols-rounded text-[32px]">
                    verified
                  </span>
                ),
              },
            ].map((item, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, scale: 0.9, y: 30 }}
                whileInView={{ opacity: 1, scale: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{
                  duration: 0.5,
                  delay: idx * 0.15,
                  type: "spring",
                  bounce: 0.2,
                }}
                className={`group relative p-8 rounded-3xl overflow-hidden hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 will-change-transform ${isDark ? "bg-slate-900 border border-slate-800" : "bg-white border border-slate-100 shadow-xl shadow-slate-200/40"}`}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                <div className="mb-8 flex justify-between items-start">
                  <div
                    className={`p-4 rounded-2xl ${isDark ? "bg-primary-900/30 text-primary-400" : "bg-primary-100 text-primary-600"}`}
                  >
                    {item.icon}
                  </div>
                  <span
                    className={`text-5xl font-black ${isDark ? "text-white/5 group-hover:text-primary-500/10" : "text-slate-900/5 group-hover:text-primary-500/10"} transition-colors duration-300`}
                  >
                    {item.step}
                  </span>
                </div>
                <h4
                  className={`text-2xl font-bold mb-3 ${isDark ? "text-white" : "text-slate-900"}`}
                >
                  {item.title}
                </h4>
                <p
                  className={`text-base leading-relaxed ${isDark ? "text-slate-400" : "text-slate-500"}`}
                >
                  {item.text}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section
        id="features"
        className={`scroll-mt-32 py-32 relative z-10 ${isDark ? "bg-slate-950/50" : "bg-white/50 border-y border-slate-100"}`}
      >
        <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-20">
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.98 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, type: "spring", bounce: 0.3 }}
            className="text-center mb-20 will-change-[opacity,transform]"
          >
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-black mb-6 tracking-tight">
              Built for the{" "}
              <span
                className={`text-transparent bg-clip-text bg-gradient-to-r ${isDark ? "from-primary-400 to-secondary-400" : "from-primary-600 to-secondary-600"}`}
              >
                Future.
              </span>
            </h2>
            <p
              className={`text-lg md:text-xl max-w-2xl mx-auto leading-relaxed ${isDark ? "text-slate-400" : "text-slate-600"}`}
            >
              Advanced technology streamlining your academic journey through
              secure, instant, and paperless processing.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard
              isDark={isDark}
              delay={0.1}
              title="100% Paperless"
              desc="Eliminate physical forms and reduce campus waste. Help build our Smart-Green University vision while saving your time."
              color="bg-primary-500"
              icon={
                <span className="material-symbols-rounded text-[32px]">
                  nature
                </span>
              }
            />
            <FeatureCard
              isDark={isDark}
              delay={0.2}
              title="Real-time Tracking"
              desc="Monitor your clearance status instantly. Get notified immediately when an office verifies and approves your request."
              color="bg-secondary-500"
              icon={
                <svg
                  className="w-8 h-8"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              }
            />
            <FeatureCard
              isDark={isDark}
              delay={0.3}
              title="Secure & Verified"
              desc="Enterprise-grade security. Digital signatures and QR verification ensure absolute authenticity for every document."
              color="bg-purple-500"
              icon={
                <svg
                  className="w-8 h-8"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
              }
            />
          </div>
        </div>
      </section>

      {}
      <section
        id="about"
        className={`scroll-mt-32 py-24 relative z-10 ${isDark ? "bg-[#030712]" : "bg-[#FAFAFA]"}`}
      >
        <div className="max-w-5xl mx-auto px-6 md:px-12 lg:px-20">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6 }}
            className="flex flex-col md:flex-row items-center gap-12"
          >
            <div className="flex-shrink-0">
              <img
                src={isuLogo}
                alt="Isabela State University"
                className="w-32 h-32 md:w-40 md:h-40 rounded-full shadow-2xl object-cover"
              />
            </div>
            <div>
              <h2
                className={`text-3xl md:text-4xl font-black tracking-tight mb-4 ${isDark ? "text-white" : "text-slate-900"}`}
              >
                Isabela State University
              </h2>
              <p
                className={`text-lg leading-relaxed mb-4 ${isDark ? "text-slate-400" : "text-slate-600"}`}
              >
                Echague Campus — pioneering digital transformation in academic
                services through the Smart Clearance System. Our mission is to
                deliver seamless, paperless, and secure clearance processing for
                every student.
              </p>
              <p
                className={`text-sm ${isDark ? "text-slate-500" : "text-slate-400"}`}
              >
                San Fabian, Echague, Isabela 3309, Philippines
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      <motion.footer
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.1 }}
        transition={{ duration: 0.6, type: "spring", bounce: 0.2 }}
        className={`relative pt-24 pb-8 z-10 transition-colors duration-500 will-change-[opacity,transform] ${isDark ? "bg-slate-950 border-t border-slate-900/50" : "bg-slate-50 border-t border-slate-200"}`}
      >
        <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-20">
          <div className="grid md:grid-cols-4 gap-12 mb-16">
            <div className="col-span-2">
              <div className="flex items-center gap-3 mb-6">
                <img
                  src={logo}
                  alt="Smart Clearance System Logo"
                  className="h-10 w-10 object-contain drop-shadow-md"
                />
                <span
                  className={`text-2xl font-black tracking-tighter ${isDark ? "text-white" : "text-slate-900"}`}
                >
                  SMART<span className="text-primary-600">CLEARANCE</span>
                </span>
              </div>
              <p
                className={`text-base leading-relaxed max-w-md mb-8 ${isDark ? "text-slate-400" : "text-slate-500"}`}
              >
                The official digital clearance system of Isabela State
                University - Echague Campus. Elevating academic service through
                innovation and sustainable practices.
              </p>
              <div className="flex gap-4 items-center">
                <a
                  href="https://isu.edu.ph/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`p-2 rounded-full transition-all hover:scale-110 ${isDark ? "bg-slate-800 hover:bg-slate-700" : "bg-white shadow-md hover:shadow-lg"}`}
                >
                  <img
                    src={isuLogo}
                    alt="ISU"
                    className="w-6 h-6 object-cover rounded-full"
                  />
                </a>
                <a
                  href="https://www.facebook.com/isabelastateuniversity"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`p-2 rounded-full transition-all hover:scale-110 text-[#1877F2] ${isDark ? "bg-slate-800 hover:bg-slate-700" : "bg-white shadow-md hover:shadow-lg"}`}
                >
                  <svg
                    className="w-6 h-6"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                </a>
              </div>
            </div>

            <div>
              <h4
                className={`font-bold tracking-widest text-sm mb-6 ${isDark ? "text-white" : "text-slate-900"}`}
              >
                RESOURCES
              </h4>
              <ul
                className={`space-y-4 font-medium flex flex-col items-start ${isDark ? "text-slate-400" : "text-slate-500"}`}
              >
                <li>
                  <button
                    onClick={handleEnter}
                    className="hover:text-primary-500 transition-colors text-left"
                  >
                    Portal Login
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setActiveModal("guides")}
                    className="hover:text-primary-500 transition-colors text-left"
                  >
                    Digital Guides
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setActiveModal("help")}
                    className="hover:text-primary-500 transition-colors text-left"
                  >
                    Help Center
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <h4
                className={`font-bold tracking-widest text-sm mb-6 ${isDark ? "text-white" : "text-slate-900"}`}
              >
                LOCATION
              </h4>
              <ul
                className={`space-y-4 font-medium ${isDark ? "text-slate-400" : "text-slate-500"}`}
              >
                <li className="flex items-start gap-3">
                  <svg
                    className="w-5 h-5 text-primary-500 shrink-0 mt-0.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  <span>
                    San Fabian, Echague,
                    <br />
                    Isabela 3309
                  </span>
                </li>
                <li className="flex items-center gap-3">
                  <svg
                    className="w-5 h-5 text-primary-500 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                    />
                  </svg>
                  <span>(078) 305 9013</span>
                </li>
              </ul>
            </div>
          </div>

          <div
            className={`pt-8 border-t flex flex-col md:flex-row justify-between items-center gap-4 text-xs font-bold tracking-widest ${isDark ? "border-slate-800/60 text-slate-500" : "border-slate-200 text-slate-400"}`}
          >
            <p>&copy; 2026 ISABELA STATE UNIVERSITY.</p>
            <div className="flex gap-6">
              <button
                onClick={() => setActiveModal("privacy")}
                className="hover:text-primary-500 transition-colors uppercase"
              >
                PRIVACY POLICY
              </button>
              <button
                onClick={() => setActiveModal("terms")}
                className="hover:text-primary-500 transition-colors uppercase"
              >
                TERMS OF USE
              </button>
            </div>
          </div>
        </div>
      </motion.footer>

      <AnimatePresence>
        {activeModal && (
          <Modal
            isOpen={!!activeModal}
            onClose={() => setActiveModal(null)}
            title={
              activeModal === "privacy"
                ? "Privacy Policy"
                : activeModal === "terms"
                  ? "Terms of Use"
                  : activeModal === "guides"
                    ? "Digital Guides"
                    : activeModal === "help"
                      ? "Help Center"
                      : ""
            }
            isDark={isDark}
            showCancel={false}
            confirmText="I UNDERSTAND"
            onConfirm={() => setActiveModal(null)}
            size="lg"
          >
            <LegalPolicy type={activeModal} />
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LandingPage;
