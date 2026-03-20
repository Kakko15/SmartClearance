import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useMemo } from "react";
import logo from "../../assets/logo.png";

const Loader = () => {
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);

  const loadingSteps = [
    "Initializing",
    "Loading Modules",
    "Connecting",
    "Syncing Data",
    "Ready",
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setLoadingProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }

        const increment = prev < 70 ? 3 : prev < 90 ? 2 : 1;
        return Math.min(prev + increment, 100);
      });
    }, 30);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const stepInterval = setInterval(() => {
      setCurrentStep((prev) => (prev + 1) % loadingSteps.length);
    }, 180);

    return () => clearInterval(stepInterval);
  }, []);

  const particles = useMemo(
    () =>
      Array.from({ length: 30 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 3 + 1,
        duration: Math.random() * 20 + 10,
        delay: Math.random() * 5,
        animX: Math.random() * 50 - 25,
      })),
    [],
  );

  const rings = [
    { radius: 140, duration: 15, delay: 0, direction: 1 },
    { radius: 180, duration: 20, delay: 2, direction: -1 },
    { radius: 220, duration: 25, delay: 4, direction: 1 },
    { radius: 260, duration: 30, delay: 6, direction: -1 },
  ];

  const glowVariants = {
    animate: {
      opacity: [0.4, 0.8, 0.4],
      scale: [1, 1.2, 1],
      transition: {
        duration: 2,
        repeat: Infinity,
        ease: "easeInOut",
      },
    },
  };

  const pulseRingVariants = {
    animate: {
      scale: [1, 1.5, 1],
      opacity: [0.6, 0, 0.6],
      transition: {
        duration: 3,
        repeat: Infinity,
        ease: "easeOut",
      },
    },
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#010a02] overflow-hidden"
      role="status"
      aria-live="polite"
      aria-label="Loading SmartClearance"
    >
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-[#010a02] via-[#051a08] to-[#010a02]" />
        <motion.div
          animate={{
            background: [
              "radial-gradient(ellipse at 20% 80%, rgba(34,197,94,0.15) 0%, transparent 50%)",
              "radial-gradient(ellipse at 80% 20%, rgba(34,197,94,0.15) 0%, transparent 50%)",
              "radial-gradient(ellipse at 20% 80%, rgba(34,197,94,0.15) 0%, transparent 50%)",
            ],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0"
        />
        <motion.div
          animate={{
            background: [
              "radial-gradient(ellipse at 80% 80%, rgba(234,179,8,0.08) 0%, transparent 40%)",
              "radial-gradient(ellipse at 20% 20%, rgba(234,179,8,0.08) 0%, transparent 40%)",
              "radial-gradient(ellipse at 80% 80%, rgba(234,179,8,0.08) 0%, transparent 40%)",
            ],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0"
        />
      </div>

      <div className="absolute inset-0 z-[1] overflow-hidden">
        {particles.map((particle) => (
          <motion.div
            key={particle.id}
            className="absolute rounded-full"
            style={{
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              width: particle.size,
              height: particle.size,
              background:
                particle.id % 3 === 0
                  ? "linear-gradient(135deg, #22c55e, #16a34a)"
                  : particle.id % 3 === 1
                    ? "linear-gradient(135deg, #eab308, #ca8a04)"
                    : "linear-gradient(135deg, #ffffff, #e5e7eb)",
              boxShadow:
                particle.id % 3 === 0
                  ? "0 0 10px rgba(34,197,94,0.8)"
                  : particle.id % 3 === 1
                    ? "0 0 10px rgba(234,179,8,0.8)"
                    : "0 0 10px rgba(255,255,255,0.8)",
            }}
            animate={{
              y: [0, -100, 0],
              x: [0, particle.animX, 0],
              opacity: [0, 1, 0],
              scale: [0.5, 1, 0.5],
            }}
            transition={{
              duration: particle.duration,
              repeat: Infinity,
              delay: particle.delay,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      <div className="absolute inset-0 z-[2] opacity-20">
        <motion.div
          animate={{
            backgroundPosition: ["0% 0%", "100% 100%"],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(rgba(34, 197, 94, 0.3) 1px, transparent 1px),
              linear-gradient(90deg, rgba(34, 197, 94, 0.3) 1px, transparent 1px)
            `,
            backgroundSize: "80px 80px",
            transform:
              "perspective(1000px) rotateX(60deg) translateY(200px) scale(2)",
            transformOrigin: "center bottom",
          }}
        />
      </div>

      <div className="relative z-10 flex flex-col items-center">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {rings.map((ring, index) => (
            <motion.div
              key={index}
              className="absolute rounded-full border"
              style={{
                width: ring.radius,
                height: ring.radius,
                borderColor:
                  index % 2 === 0
                    ? "rgba(34, 197, 94, 0.2)"
                    : "rgba(234, 179, 8, 0.15)",
                borderWidth: index === 0 ? 2 : 1,
              }}
              animate={{
                rotate: ring.direction === 1 ? 360 : -360,
              }}
              transition={{
                duration: ring.duration,
                repeat: Infinity,
                ease: "linear",
                delay: ring.delay,
              }}
            >
              <motion.div
                className="absolute w-2 h-2 rounded-full"
                style={{
                  top: -4,
                  left: "50%",
                  transform: "translateX(-50%)",
                  background:
                    index % 2 === 0
                      ? "linear-gradient(135deg, #22c55e, #16a34a)"
                      : "linear-gradient(135deg, #eab308, #ca8a04)",
                  boxShadow:
                    index % 2 === 0
                      ? "0 0 20px rgba(34,197,94,0.8)"
                      : "0 0 20px rgba(234,179,8,0.8)",
                }}
                animate={{
                  scale: [1, 1.5, 1],
                  opacity: [0.8, 1, 0.8],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            </motion.div>
          ))}
        </div>

        <div
          className="relative w-48 h-48 mb-12 flex items-center justify-center"
          style={{ perspective: "1000px" }}
        >
          {[1, 2, 3].map((ring) => (
            <motion.div
              key={ring}
              variants={pulseRingVariants}
              animate="animate"
              className="absolute rounded-full border-2 border-primary-500/30"
              style={{
                width: 140 + ring * 40,
                height: 140 + ring * 40,
                transitionDelay: `${ring * 0.5}s`,
              }}
            />
          ))}

          <motion.div
            variants={glowVariants}
            animate="animate"
            className="absolute w-40 h-40 rounded-full bg-gradient-to-r from-primary-500/20 via-secondary-500/20 to-primary-500/20 blur-2xl"
          />

          <motion.div
            animate={{
              scale: [1, 1.1, 1],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="absolute w-36 h-36 rounded-full bg-gradient-to-br from-primary-500/30 to-secondary-500/30 blur-3xl"
          />

          <motion.div
            animate={{
              scale: [1, 0.85, 1],
              opacity: [0.4, 0.2, 0.4],
            }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="absolute bottom-2 w-28 h-10 bg-black/80 blur-2xl rounded-[100%]"
          />

          <motion.div
            animate={{
              y: [0, -15, 0],
              rotateY: [0, 5, 0],
              rotateX: [0, -5, 0],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="relative z-30"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-primary-500/40 via-secondary-500/40 to-primary-500/40 blur-2xl scale-110" />

            <motion.img
              src={logo}
              alt="SmartClearance"
              className="relative w-28 h-28 object-contain drop-shadow-2xl"
              style={{
                filter:
                  "drop-shadow(0 0 30px rgba(34,197,94,0.5)) drop-shadow(0 20px 40px rgba(0,0,0,0.4))",
              }}
              animate={{
                scale: [1, 1.02, 1],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />

            <motion.div
              animate={{ x: ["-100%", "200%"] }}
              transition={{
                duration: 2.5,
                repeat: Infinity,
                repeatDelay: 4,
                ease: "easeInOut",
              }}
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12 pointer-events-none"
            />
          </motion.div>

          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <motion.div
              key={i}
              className="absolute w-1.5 h-1.5 rounded-full"
              style={{
                background: i % 2 === 0 ? "#22c55e" : "#eab308",
                boxShadow:
                  i % 2 === 0
                    ? "0 0 15px rgba(34,197,94,0.8)"
                    : "0 0 15px rgba(234,179,8,0.8)",
              }}
              animate={{
                x: [0, Math.cos((i * 45 * Math.PI) / 180) * 80, 0],
                y: [0, Math.sin((i * 45 * Math.PI) / 180) * 80, 0],
                opacity: [0, 1, 0],
                scale: [0, 1.5, 0],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                delay: i * 0.3,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>

        <div className="flex flex-col items-center space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="relative"
          >
            <h1 className="text-5xl font-bold tracking-tight">
              <span className="text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.3)]">
                Smart
              </span>
              <span className="relative">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 via-primary-300 to-secondary-400 drop-shadow-[0_0_30px_rgba(34,197,94,0.6)]">
                  Clearance
                </span>

                <motion.div
                  animate={{ x: ["-100%", "200%"] }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    repeatDelay: 3,
                    ease: "easeInOut",
                  }}
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12"
                />
              </span>
            </h1>
          </motion.div>

          <div className="flex flex-col items-center space-y-3">
            <div className="flex items-center gap-3">
              <motion.span
                className="h-[1px] w-8 bg-gradient-to-r from-transparent to-primary-500/50"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <AnimatePresence mode="wait">
                <motion.span
                  key={currentStep}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.2 }}
                  className="text-xs uppercase tracking-[0.2em] text-primary-300/80 font-medium"
                >
                  {loadingSteps[currentStep]}
                </motion.span>
              </AnimatePresence>
              <motion.span
                className="h-[1px] w-8 bg-gradient-to-l from-transparent to-primary-500/50"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
              />
            </div>

            <div
              className="w-56 h-1 bg-white/10 rounded-full overflow-hidden"
              role="progressbar"
              aria-valuenow={loadingProgress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Loading progress"
            >
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-primary-500 to-secondary-400"
                style={{
                  boxShadow: "0 0 10px rgba(34, 197, 94, 0.5)",
                }}
                initial={{ width: 0 }}
                animate={{ width: `${loadingProgress}%` }}
                transition={{ duration: 0.05, ease: "linear" }}
              />
            </div>

            <motion.span
              className="text-xs font-mono text-primary-400/70"
              key={loadingProgress}
            >
              {loadingProgress}%
            </motion.span>
            <span className="sr-only">
              Loading SmartClearance, {loadingProgress} percent complete
            </span>
          </div>
        </div>

        <div className="absolute bottom-10 flex items-center gap-4">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-2 h-2 rounded-full"
              style={{
                background: i === 1 ? "#eab308" : "#22c55e",
                boxShadow: `0 0 10px ${i === 1 ? "rgba(234,179,8,0.8)" : "rgba(34,197,94,0.8)"}`,
              }}
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0.5, 1, 0.5],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                delay: i * 0.3,
              }}
            />
          ))}
        </div>
      </div>

      <div className="absolute top-8 left-8 w-20 h-20 border-l-2 border-t-2 border-primary-500/20 rounded-tl-3xl" />
      <div className="absolute top-8 right-8 w-20 h-20 border-r-2 border-t-2 border-primary-500/20 rounded-tr-3xl" />
      <div className="absolute bottom-8 left-8 w-20 h-20 border-l-2 border-b-2 border-primary-500/20 rounded-bl-3xl" />
      <div className="absolute bottom-8 right-8 w-20 h-20 border-r-2 border-b-2 border-primary-500/20 rounded-br-3xl" />
    </div>
  );
};

export default Loader;
