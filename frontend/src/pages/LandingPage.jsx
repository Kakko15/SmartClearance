import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { motion, useScroll, useTransform } from 'framer-motion';
import ThemeToggle from '../components/ui/ThemeToggle';
import { SlideTabs } from '../components/ui/SlideTabs';
import Modal from '../components/ui/Modal';
import logo from '../assets/logo.png';
import isuLogo from '../assets/isu-logo.jpg';

const LandingPage = ({ onEnter, isDark, toggleTheme }) => {
  const { scrollY } = useScroll();
  // Removed local isDark state

  const _headerOpacity = useTransform(scrollY, [0, 50], [0, 1]);
  // Dynamic shadow/bg logic inside render based on isDark/isScrolled

  // Dynamic shadow/bg logic inside render based on isDark/isScrolled

  const [_isScrolled, setIsScrolled] = useState(false);
  const [activeModal, setActiveModal] = useState(null); // 'privacy' | 'terms' | null

  // Legal Content
  const legalContent = {
    privacy: (
      <div className="space-y-4 text-sm leading-relaxed">
        <p><strong>Effective Date:</strong> January 2026</p>
        <p>At Smart Clearance System (Isabela State University - Echague Campus), we value your privacy and are committed to protecting your personal data. This Privacy Policy explains how we collect, use, and safeguard your information when you use our digital clearance system.</p>

        <h4 className="font-bold text-lg mt-4">1. Information We Collect</h4>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Personal Identification:</strong> Name, Student ID, Course, and Year Level.</li>
          <li><strong>Academic Records:</strong> Clearance status, grades (if applicable for verification), and enrollment data.</li>
          <li><strong>Digital Logs:</strong> Login timestamps and transaction history within the system.</li>
        </ul>

        <h4 className="font-bold text-lg mt-4">2. How We Use Your Data</h4>
        <p>Your data is used solely for:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Processing academic clearance applications.</li>
          <li>Verifying student identity and enrollment status.</li>
          <li>Generating digital certificates and reports for university administration.</li>
        </ul>

        <h4 className="font-bold text-lg mt-4">3. Data Security</h4>
        <p>We implement strict security measures, including encryption and role-based access control, to prevent unauthorized access or disclosure of your information.</p>
      </div>
    ),
    terms: (
      <div className="space-y-4 text-sm leading-relaxed">
        <p><strong>Last Updated:</strong> January 2026</p>
        <p>Welcome to Smart Clearance System. By accessing the system, you agree to these Terms of Use. Please read them carefully.</p>

        <h4 className="font-bold text-lg mt-4">1. Authorized Use</h4>
        <p>Smart Clearance System is strictly for the use of actively enrolled students, faculty, and staff of Isabela State University - Echague Campus. Unauthorized access is prohibited.</p>

        <h4 className="font-bold text-lg mt-4">2. User Responsibilities</h4>
        <ul className="list-disc pl-5 space-y-1">
          <li>You are responsible for maintaining the confidentiality of your login credentials.</li>
          <li>You agree to provide accurate and truthful information during the clearance process.</li>
          <li>Any attempt to falsify records or bypass system security will result in disciplinary action.</li>
        </ul>

        <h4 className="font-bold text-lg mt-4">3. System Availability</h4>
        <p>While we strive for 24/7 availability, the University reserves the right to suspend the system for maintenance or updates without prior notice.</p>
      </div>
    )
  };

  useEffect(() => {
    const updateScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', updateScroll);
    return () => window.removeEventListener('scroll', updateScroll);
  }, []);

  useEffect(() => {
    document.title = "Smart Clearance System | Homepage";
  }, []);

  const fadeInUp = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2
      }
    }
  };



  return (
    <div id="home" className={`relative min-h-screen w-full font-sans transition-colors duration-500 overflow-hidden ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-[#f8fafc] text-slate-800'}`}>

      <div className={`absolute inset-0 z-0 grid-bg pointer-events-none transition-opacity duration-500 ${isDark ? 'opacity-10' : 'opacity-40'}`} />

      <div className={`absolute top-0 right-0 w-[600px] h-[600px] rounded-full blur-[100px] -z-10 translate-x-1/3 -translate-y-1/3 transition-colors duration-500 ${isDark ? 'bg-primary-900/20' : 'bg-primary-100/50'}`} />
      <div className={`absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full blur-[100px] -z-10 -translate-x-1/3 transition-colors duration-500 ${isDark ? 'bg-secondary-900/20' : 'bg-secondary-100/50'}`} />

      <header
        className={`fixed-compensate fixed top-6 left-6 right-6 md:left-12 md:right-12 lg:left-20 lg:right-20 z-50 rounded-2xl transition-colors duration-300 py-3 backdrop-blur-xl border shadow-xl ${isDark
            ? 'bg-slate-900/60 border-white/10 shadow-black/20'
            : 'bg-white/60 border-white/40 shadow-slate-200/40'
          }`}
      >
        <div className="w-full px-6 md:px-12 lg:px-20 flex justify-between items-center">
          <div
            onClick={() => {
              history.pushState(null, '', window.location.pathname);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="flex items-center gap-3 cursor-pointer"
          >
            <img src={logo} alt="Smart Clearance System Logo" className="h-10 w-10 object-contain drop-shadow-md" />
            <div>
              <h1 className={`text-xl font-bold leading-none tracking-tight font-display ${isDark ? 'text-white' : 'text-slate-900'}`}>SMART<span className="text-primary-600">CLEARANCE</span></h1>
              <p className="text-[10px] tracking-widest text-slate-500 uppercase font-bold">ISU Echague Campus</p>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-4">
            <SlideTabs isDark={isDark} />

            <div className="pl-4 border-l border-slate-200/20">
              <ThemeToggle isDark={isDark} toggle={toggleTheme} />
            </div>
          </nav>

          <button
            onClick={onEnter}
            className="hidden md:flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-2.5 rounded-full font-bold tracking-wide transition-all shadow-md hover:shadow-lg hover:shadow-primary-500/30 text-sm"
          >
            <span>SMART CLEARANCE PORTAL</span>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
          </button>
        </div>
      </header>

      <main className="relative pt-32 pb-20 px-6 md:px-12 lg:px-20 overflow-hidden">
        <div className="w-full grid md:grid-cols-2 gap-12 items-center">

          <motion.div
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
            className="text-left space-y-6 z-10"
          >
            <motion.div variants={fadeInUp} className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-bold tracking-wider mb-2 backdrop-blur-md shadow-lg ${isDark ? 'bg-white/5 border-white/10 text-secondary-400 shadow-black/10' : 'bg-white/40 border-white/60 text-secondary-700 shadow-secondary-500/10'}`}>
              <span className="h-2 w-2 rounded-full bg-secondary-500 animate-pulse shadow-[0_0_10px_rgba(234,179,8,0.5)]"></span>
              NEW VMGO ALIGNED SYSTEM
            </motion.div>

            <motion.h1 variants={fadeInUp} className={`text-5xl md:text-7xl font-bold leading-[0.9] font-display ${isDark ? 'text-white' : 'text-slate-900'}`}>
              <span className={`${isDark ? 'text-slate-100' : 'text-[#0f172a]'} drop-shadow-sm transition-colors duration-500`}>DIGITAL</span> <br />
              <span className={`text-transparent bg-clip-text bg-gradient-to-r drop-shadow-sm transition-all duration-500 ${isDark ? 'from-primary-400 to-secondary-400' : 'from-primary-600 to-secondary-600'}`}>CLEARANCE</span>
            </motion.h1>

            <motion.p variants={fadeInUp} className={`text-lg max-w-lg leading-relaxed font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Experience the next generation of academic processing. Fast, paperless, and eco-friendly clearance management for the modern <span className="text-primary-600 font-bold">Smart-Green University</span>.
            </motion.p>

            <motion.div variants={fadeInUp} className="flex flex-wrap gap-4 pt-4">
              <button
                onClick={onEnter}
                className={`px-8 py-4 rounded-lg font-bold tracking-widest transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 flex items-center gap-3 ${isDark ? 'bg-white text-slate-900 hover:bg-slate-200' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
              >
                ACCESS SYSTEM
                <svg className="w-5 h-5 text-secondary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </button>

              <button className={`px-8 py-4 rounded-lg font-bold tracking-widest border-2 transition-all ${isDark ? 'border-slate-700 text-white hover:border-primary-500 hover:text-primary-400 bg-slate-900' : 'border-slate-200 hover:border-primary-500 hover:text-primary-600 text-slate-600 bg-white'}`}>
                LEARN MORE
              </button>
            </motion.div>

            <motion.div variants={fadeInUp} className="flex items-center gap-8 pt-8 opacity-80">
              <div>
                <p className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>5k+</p>
                <p className="text-xs font-bold text-slate-500 tracking-wider">STUDENTS</p>
              </div>
              <div className={`w-px h-10 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}></div>
              <div>
                <p className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>24h</p>
                <p className="text-xs font-bold text-slate-500 tracking-wider">PROCESSING</p>
              </div>
              <div className={`w-px h-10 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}></div>
              <div>
                <p className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>100%</p>
                <p className="text-xs font-bold text-slate-500 tracking-wider">PAPERLESS</p>
              </div>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative h-[500px] w-full hidden md:block"
          >
            <div className={`absolute top-10 right-10 w-3/4 h-3/4 bg-gradient-to-br rounded-2xl rotate-3 opacity-10 ${isDark ? 'from-primary-400 to-primary-600' : 'from-primary-500 to-primary-700'}`}></div>
            <div className={`absolute top-10 right-10 w-3/4 h-3/4 rounded-2xl p-6 flex flex-col gap-4 rotate-[-3deg] z-10 transition-all duration-500 ${isDark ? 'spatial-glass-dark' : 'spatial-glass'}`}>
              <div className={`flex justify-between items-center border-b pb-4 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}></div>
                  <div>
                    <div className={`w-32 h-3 rounded ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}></div>
                    <div className={`w-20 h-2 rounded mt-2 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}></div>
                  </div>
                </div>
                <div className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">VERIFIED</div>
              </div>
              <div className="space-y-3">
                <div className={`w-full h-2 rounded ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}></div>
                <div className={`w-5/6 h-2 rounded ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}></div>
                <div className={`w-4/6 h-2 rounded ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}></div>
              </div>
              <div className={`mt-auto rounded-xl p-4 border transition-colors duration-500 ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                <div className="flex justify-between mb-2">
                  <span className="text-xs font-bold text-slate-400">STATUS</span>
                  <span className="text-xs font-bold text-primary-600">COMPLETED</span>
                </div>
                <div className={`w-full rounded-full h-2 overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}>
                  <div className="bg-primary-500 w-full h-full"></div>
                </div>
              </div>
            </div>

            <motion.div
              animate={{
                y: [0, -15],
                rotate: [0, 1]
              }}
              transition={{
                duration: 5,
                repeat: Infinity,
                repeatType: "reverse",
                ease: "easeInOut"
              }}
              className={`absolute bottom-20 left-0 p-4 rounded-xl shadow-xl border z-20 flex items-center gap-3 transition-colors duration-500 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-secondary-200'}`}
            >
              <div className={`p-3 rounded-lg ${isDark ? 'bg-secondary-900/30 text-secondary-400' : 'bg-secondary-100 text-secondary-600'}`}>
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400">IMPACT</p>
                <p className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>120 Trees Saved</p>
              </div>
            </motion.div>
          </motion.div>

        </div>
      </main>

      {/* --- FEATURES SECTION --- */}
      <section id="features" className={`scroll-mt-32 py-24 relative overflow-hidden ${isDark ? 'bg-slate-900/50' : 'bg-white/50'}`}>
        <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-20 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className={`text-3xl md:text-5xl font-bold font-display mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Why Choose <span className="text-primary-600">Smart Clearance System</span>?
            </h2>
            <p className={`text-lg max-w-2xl mx-auto ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Streamline your clearance process with our advanced digital solution designed for the modern academic environment.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                title: "100% Paperless",
                desc: "Eliminate physical forms and reduce campus waste. contribute to a greener environment while saving time.",
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg>
                ),
                color: "bg-green-500"
              },
              {
                title: "Real-time Tracking",
                desc: "Monitor your clearance status instantly. Get notified when an office approves your request.",
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                ),
                color: "bg-blue-500"
              },
              {
                title: "Secure & Verified",
                desc: "Digital signatures and QR code verification ensure authenticity for every document processed.",
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                ),
                color: "bg-purple-500"
              }
            ].map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className={`p-8 rounded-2xl border transition-all hover:-translate-y-1 hover:shadow-2xl ${isDark ? 'bg-slate-800/50 border-slate-700 hover:border-primary-500/50' : 'bg-white border-slate-200 hover:border-primary-200'}`}
              >
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-white mb-6 shadow-lg ${feature.color}`}>
                  {feature.icon}
                </div>
                <h3 className={`text-xl font-bold mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>{feature.title}</h3>
                <p className={`leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* --- ABOUT SECTION --- */}
      <section id="about" className={`scroll-mt-32 py-32 relative overflow-hidden ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
        {/* Background Decorations */}
        <div className={`absolute inset-0 grid-bg opacity-30 pointer-events-none ${isDark ? 'opacity-20' : 'opacity-10'}`} />
        <div className={`absolute top-0 right-0 w-[500px] h-[500px] bg-primary-500/20 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2`}></div>
        <div className={`absolute bottom-0 left-0 w-[500px] h-[500px] bg-secondary-500/10 rounded-full blur-[120px] translate-y-1/2 -translate-x-1/2`}></div>

        <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-20 relative z-10">
          <div className="grid md:grid-cols-2 gap-16 items-center">

            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="relative"
            >
              <div className={`relative h-[500px] rounded-3xl overflow-hidden shadow-2xl transition-all duration-500 group ${isDark ? 'bg-slate-900 border border-slate-800' : 'bg-white border border-slate-200'}`}>
                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary-500/10 via-transparent to-secondary-500/10 group-hover:opacity-100 transition-opacity duration-500"></div>

                {/* Abstract Tech Visual */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative w-64 h-64">
                    <div className={`absolute inset-0 rounded-full border-2 border-dashed animate-[spin_10s_linear_infinite] ${isDark ? 'border-slate-700' : 'border-slate-300'}`}></div>
                    <div className={`absolute inset-4 rounded-full border-2 border-dashed animate-[spin_15s_linear_infinite_reverse] ${isDark ? 'border-primary-900' : 'border-primary-100'}`}></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <motion.div
                        animate={{ y: [0, -10, 0] }}
                        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                        className={`w-32 h-32 rounded-2xl flex items-center justify-center backdrop-blur-xl border-2 shadow-2xl relative z-10 ${isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-white/80 border-white'}`}
                      >
                        <img src={logo} alt="ISU Logo" className="w-20 h-20 object-contain drop-shadow-xl" />

                        {/* Floating badge */}
                        <div className="absolute -top-4 -right-4 bg-green-500 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-lg flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                          VERIFIED
                        </div>
                      </motion.div>
                    </div>
                  </div>
                </div>

                {/* Stats Cards */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className={`absolute bottom-8 left-8 right-8 p-4 rounded-xl border backdrop-blur-md ${isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-white/60 border-white/50'}`}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <p className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>TOTAL PROCESSED</p>
                      <p className={`text-2xl font-bold font-display ${isDark ? 'text-white' : 'text-slate-900'}`}>15,402+</p>
                    </div>
                    <div className={`h-10 w-px ${isDark ? 'bg-slate-700' : 'bg-slate-300'}`}></div>
                    <div>
                      <p className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>EFFICIENCY</p>
                      <p className="text-2xl font-bold font-display text-green-500">99.9%</p>
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Decorative background element behind card */}
              <div className={`absolute -inset-4 -z-10 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-[2.5rem] opacity-20 blur-2xl transition-opacity duration-500 ${isDark ? 'opacity-20' : 'opacity-10'}`}></div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <div className="inline-flex items-center gap-2 mb-6">
                <span className="w-8 h-[2px] bg-primary-500"></span>
                <span className={`text-xs font-bold tracking-[0.2em] uppercase ${isDark ? 'text-primary-400' : 'text-primary-600'}`}>About The Institution</span>
              </div>

              <h2 className={`text-4xl md:text-5xl lg:text-6xl font-bold font-display mb-8 leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Innovation Meets <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-500 via-secondary-500 to-primary-500 bg-[length:200%_auto] animate-gradient">Academic Excellence</span>
              </h2>

              <p className={`text-lg mb-6 leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                Isabela State University - Echague Campus serves as the main campus of the university system. We are committed to delivering quality education while championing environmental sustainability through digital transformation.
              </p>

              <p className={`text-lg mb-10 leading-relaxed border-l-4 pl-6 ${isDark ? 'text-slate-400 border-slate-800' : 'text-slate-600 border-primary-100'}`}>
                <span className={`block font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>Our Vision</span>
                Smart Clearance System represents our pledge to a "Smart Green University" — reducing carbon footprints while increasing operational efficiency for thousands of students.
              </p>

              <div className="flex flex-wrap gap-4">
                <a
                  href="https://isu.edu.ph/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`group px-8 py-4 rounded-full font-bold tracking-wider transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 flex items-center gap-3 ${isDark ? 'bg-white text-slate-900 hover:bg-slate-200' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
                >
                  VISIT WEBSITE
                  <svg className="w-5 h-5 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                </a>

                <button
                  onClick={() => {
                    toast("Call us at: (078) 305 9013", {
                      icon: '📞',
                      style: {
                        background: isDark ? '#1e293b' : '#fff',
                        color: isDark ? '#fff' : '#333',
                        fontWeight: 'bold',
                        border: isDark ? '1px solid #334155' : '1px solid #e2e8f0'
                      },
                      duration: 4000
                    });
                  }}
                  className={`px-8 py-4 rounded-full font-bold tracking-wider border-2 transition-all ${isDark ? 'border-slate-800 text-slate-300 hover:border-slate-600 hover:text-white' : 'border-slate-200 text-slate-600 hover:border-slate-400 hover:text-slate-900'}`}
                >
                  CONTACT US
                </button>
              </div>
            </motion.div>

          </div>
        </div>
      </section>

      <footer className={`border-t pt-16 transition-colors duration-500 ${isDark ? 'bg-slate-950 border-slate-900' : 'bg-white border-slate-200'}`}>
        <div className="w-full px-6 md:px-12 lg:px-20">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div className="col-span-2">
              <div className="flex items-center gap-2 mb-6">
                <img src={logo} alt="Smart Clearance System Logo" className="h-8 w-8 object-contain" />
                <span className={`text-xl font-bold font-display ${isDark ? 'text-white' : 'text-slate-800'}`}>SMART<span className="text-primary-600">CLEARANCE</span></span>
              </div>
              <p className="text-slate-500 text-sm leading-relaxed max-w-sm mb-6">
                The official digital clearance system of Isabela State University - Echague Campus.
                Dedicated to providing efficient, transparent, and eco-friendly academic services.
              </p>
              <div className="flex gap-4">
                {[
                  {
                    icon: (
                      <svg className="w-full h-full" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                      </svg>
                    ),
                    label: "Facebook",
                    link: "https://www.facebook.com/isabelastateuniversity",
                    colorClass: "text-[#1877F2]"
                  },
                  {
                    icon: (
                      <img src={isuLogo} alt="ISU" className="w-full h-full object-cover rounded-full" />
                    ),
                    label: "Official Website",
                    link: "https://isu.edu.ph/"
                  }
                ].map((social, i) => (
                  <a
                    key={i}
                    href={social.link}
                    target={social.link !== '#' ? "_blank" : "_self"}
                    rel="noopener noreferrer"
                    className={`w-9 h-9 flex items-center justify-center transition-transform hover:scale-110 cursor-pointer rounded-full ${social.colorClass ? social.colorClass : 'text-slate-400'}`}
                    aria-label={social.label}
                  >
                    {social.icon}
                  </a>
                ))}
              </div>
            </div>

            <div>
              <h4 className={`font-bold mb-6 font-display text-sm ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>QUICK LINKS</h4>
              <ul className="space-y-3 text-sm text-slate-500 font-medium">
                <li><a href="#" className="hover:text-primary-600 transition-colors">Student Login</a></li>
                <li><a href="#" className="hover:text-primary-600 transition-colors">Admin Portal</a></li>
                <li><a href="#" className="hover:text-primary-600 transition-colors">System Guide</a></li>
                <li><a href="#" className="hover:text-primary-600 transition-colors">Report Issue</a></li>
              </ul>
            </div>

            <div>
              <h4 className={`font-bold mb-6 font-display text-sm ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>CONTACT</h4>
              <ul className="space-y-3 text-sm text-slate-500 font-medium">
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-primary-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  <span>San Fabian, Echague,<br />Isabela 3309</span>
                </li>
                <li className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-primary-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                  <span>(078) 305 9013</span>
                </li>
                <li className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-primary-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  <span>registrar@isu.edu.ph</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4 pb-4 flex flex-col md:flex-row justify-between items-center gap-4 text-xs font-bold text-slate-400 tracking-wider">
            <p>&copy; 2026 ISABELA STATE UNIVERSITY. ALL RIGHTS RESERVED.</p>
            <div className="flex gap-6">
              <button onClick={() => setActiveModal('privacy')} className="hover:text-slate-600 transition-colors uppercase">PRIVACY POLICY</button>
              <button onClick={() => setActiveModal('terms')} className="hover:text-slate-600 transition-colors uppercase">TERMS OF USE</button>
            </div>
          </div>
        </div>
      </footer>

      {/* Legal Modals */}
      <Modal
        isOpen={!!activeModal}
        onClose={() => setActiveModal(null)}
        title={activeModal === 'privacy' ? 'Privacy Policy' : 'Terms of Use'}
        isDark={isDark}
        showCancel={false}
        confirmText="I UNDERSTAND"
        onConfirm={() => setActiveModal(null)}
        size="lg"
      >
        {activeModal && legalContent[activeModal]}
      </Modal>
    </div>
  );
};

export default LandingPage;