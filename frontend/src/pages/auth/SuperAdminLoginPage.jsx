import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useMotionValue, useMotionTemplate } from "framer-motion";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import logo from "../../assets/logo.png";

const OutlineInput = ({ id, label, type, value, onChange, isHidden, toggleHide, ...props }) => {
  const [isFocused, setIsFocused] = useState(false);
  const isActive = isFocused || value.length > 0;

  return (
    <div className="relative">
      <input
        id={id}
        type={type === "password" ? (isHidden ? "password" : "text") : type}
        value={value}
        onChange={onChange}
        onFocus={(e) => { setIsFocused(true); if(props.onFocus) props.onFocus(e); }}
        onBlur={(e) => { setIsFocused(false); if(props.onBlur) props.onBlur(e); }}
        className={`w-full bg-transparent outline-none px-4 py-4 rounded-xl border transition-all text-white ${
          isFocused
            ? "border-[#8ab4f8] ring-2 ring-[#8ab4f8]/20"
            : "border-slate-600 hover:border-slate-400"
        } ${type === "password" ? "pr-12" : ""}`}
        {...props}
      />
      <label
        htmlFor={id}
        className={`absolute left-3 transition-all duration-200 pointer-events-none px-1.5 ${
          isActive
            ? "-top-2.5 text-xs font-medium text-[#8ab4f8] bg-[#1a1b1f]"
            : "top-4 text-base text-slate-400 bg-transparent"
        } ${!isFocused && isActive ? "!text-slate-300" : ""}`}
      >
        {label}
      </label>
      {type === "password" && (
        <button
          type="button"
          onClick={toggleHide}
          onMouseDown={(e) => e.preventDefault()}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#8ab4f8] transition-colors p-2 rounded-full hover:bg-white/5"
          aria-label={isHidden ? "Show password" : "Hide password"}
        >
          {isHidden ? (
            <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.579 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
              <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
              <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
              <path d="m2 2 20 20" />
            </svg>
          ) : (
            <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      )}
    </div>
  );
};

const SecurityMascot = ({ status, trackingIndex = 0 }) => {
  const trackX = Math.min(Math.max((trackingIndex * 0.6) - 12, -12), 12);
  const trackY = status === "tracking" ? 8 : 0; 

  return (
    <motion.div 
      className="w-[88px] h-[88px] relative mx-auto flex flex-col items-center justify-end"
      animate={{ 
         x: status === "error" ? [-5, 5, -4, 4, -2, 2, 0] : 0,
         y: status === "idle" ? 64 : 0
      }}
      transition={{ type: "spring", stiffness: 220, damping: 20 }}
    >
      <div className="absolute top-0 flex flex-col items-center">
         <motion.div 
            className="w-[12px] h-[12px] rounded-full z-10" 
            animate={{ 
               backgroundColor: status === "error" ? "#f28b82" : status === "hiding" ? "#fbbc04" : "#8ab4f8",
               boxShadow: status === "error" ? "0 0 12px #f28b82" : status === "hiding" ? "0 0 8px #fbbc04" : "0 0 12px #8ab4f8"
            }}
         />
         <div className="w-1.5 h-4 bg-slate-600 z-0 -mt-1 rounded-sm" />
      </div>

      <div className="w-[88px] h-[70px] bg-gradient-to-b from-[#2a2d35] to-[#1a1b1f] rounded-[32px] border border-white/10 shadow-[0_0_20px_rgba(0,0,0,0.5)] relative overflow-hidden flex flex-col items-center justify-center z-20">
         <div className="w-[64px] h-[28px] bg-[#090a0c] rounded-full border border-white/[0.03] shadow-inner relative overflow-hidden flex items-center justify-center mt-1">
            <motion.div 
               className="flex items-center justify-center gap-3 absolute"
               animate={{ 
                  x: status === "hiding" || status === "error" ? 0 : trackX,
                  y: status === "hiding" || status === "error" ? 0 : trackY
               }}
            >
               <motion.div 
                  className="rounded-full"
                  animate={{ 
                     width: status === "hiding" ? 16 : 8,
                     height: status === "hiding" ? 2 : 8,
                     backgroundColor: status === "error" ? "#f28b82" : "#8ab4f8",
                     boxShadow: status === "error" ? "0 0 10px #f28b82" : "0 0 8px #8ab4f8",
                     borderRadius: status === "hiding" ? "2px" : "9999px"
                  }}
               />
               <motion.div 
                  className="rounded-full"
                  animate={{ 
                     width: status === "hiding" ? 16 : 8,
                     height: status === "hiding" ? 2 : 8,
                     backgroundColor: status === "error" ? "#f28b82" : "#8ab4f8",
                     boxShadow: status === "error" ? "0 0 10px #f28b82" : "0 0 8px #8ab4f8",
                     borderRadius: status === "hiding" ? "2px" : "9999px"
                  }}
               />
            </motion.div>
         </div>
      </div>
    </motion.div>
  );
};

export default function SuperAdminLoginPage() {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  function handleMouseMove({ currentTarget, clientX, clientY }) {
    let { left, top } = currentTarget.getBoundingClientRect();
    mouseX.set(clientX - left);
    mouseY.set(clientY - top);
  }

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isEmailFocused, setIsEmailFocused] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const { handleLoginSuccess, user, profile, setSelectedRole } = useAuth();
  const navigate = useNavigate();

  let mascotStatus = "idle";
  let trackingIndex = 0;

  if (error) {
    mascotStatus = "error";
  } else if (isPasswordFocused) {
    if (!showPassword) {
      mascotStatus = "hiding";
    } else {
      mascotStatus = "tracking";
      trackingIndex = password.length;
    }
  } else if (isEmailFocused) {
    mascotStatus = "tracking";
    trackingIndex = email.length;
  }

  useEffect(() => {
    if (user && profile?.role === "super_admin") {
      navigate("/dashboard", { replace: true });
    }

    if (user && profile && profile.role !== "super_admin") {
      navigate("/dashboard", { replace: true });
    }
  }, [user, profile, navigate]);

  useEffect(() => {
    if (!user) {
      sessionStorage.setItem("selectedRole", "super_admin");
      setSelectedRole("super_admin");
    }
  }, [setSelectedRole, user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const data = await res.json();

      if (!data.success) {
        if (res.status === 429) {
          const resetSecs = data.rateLimit?.resetInSeconds;
          if (resetSecs) {
            const mins = Math.ceil(resetSecs / 60);
            setError(`Security Lockout: Please try again in ${mins} minute${mins !== 1 ? 's' : ''}.`);
          } else {
            setError("Security Lockout: Too many attempts. Try again later.");
          }
        } else {
          let errorMsg = data.error || "Invalid credentials.";
          const remaining = data.rateLimit?.remaining;
          if (typeof remaining === 'number') {
             if (remaining > 0) {
               errorMsg += ` (${remaining} attempt${remaining !== 1 ? 's' : ''} remaining)`;
             } else {
               errorMsg = "Account locked due to consecutive failed attempts.";
             }
          }
          setError(errorMsg);
        }
        return;
      }

      const { data: sessionData, error: sessionError } =
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
      if (sessionError) throw sessionError;

      const sessionUser = sessionData?.session?.user || sessionData?.user;
      if (sessionUser) {
        await handleLoginSuccess(sessionUser);
      }
    } catch (err) {
      setError(err.message || "An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0E0F12] flex items-center justify-center p-4 relative overflow-hidden font-sans text-slate-200">
      <style>{`
        input:-webkit-autofill,
        input:-webkit-autofill:hover, 
        input:-webkit-autofill:focus, 
        input:-webkit-autofill:active {
            transition: background-color 5000s ease-in-out 0s;
            -webkit-text-fill-color: #f1f5f9 !important;
        }
      `}</style>
      {/* Immersive Background Effects */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#8ab4f8]/10 rounded-full blur-[140px] mix-blend-screen opacity-50 animate-pulse-slow"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#c58af9]/10 rounded-full blur-[140px] mix-blend-screen opacity-50"></div>
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_10%,transparent_100%)] opacity-20"></div>
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-[440px]"
      >
        <div className="absolute left-1/2 -translate-x-1/2 -top-[82px] z-0">
          <SecurityMascot status={mascotStatus} trackingIndex={trackingIndex} />
        </div>

        <div 
           className="bg-[#1a1b1f] border border-white/[0.08] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] rounded-[2.5rem] relative z-10 overflow-hidden group"
           onMouseMove={handleMouseMove}
        >
          <motion.div
            className="pointer-events-none absolute -inset-px rounded-[2.5rem] opacity-0 transition duration-300 group-hover:opacity-100 z-0"
            style={{
              background: useMotionTemplate`
                radial-gradient(
                  600px circle at ${mouseX}px ${mouseY}px,
                  rgba(138, 180, 248, 0.08),
                  transparent 80%
                )
              `,
            }}
          />
          <div className="p-10 sm:p-12 relative z-10">
          
            <div className="flex flex-col items-center mb-10">
            <motion.div
              initial={{ y: -10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="mb-8 p-3 rounded-2xl bg-white/[0.03] border border-white/[0.05] shadow-inner"
            >
              <img src={logo} alt="SmartClearance Theme" className="w-10 h-10 object-contain drop-shadow-lg" />
            </motion.div>
            
            <motion.h1 
              initial={{ y: 5, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-[28px] font-medium tracking-tight text-white mb-2 text-center"
            >
              Sign in
            </motion.h1>
            <motion.p 
              initial={{ y: 5, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.35 }}
              className="text-[15px] font-normal text-slate-400 text-center"
            >
              Use your Admin Account
            </motion.p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
             <motion.div initial={{ x: -10, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.4 }}>
                <OutlineInput 
                   id="email"
                   label="Email or phone"
                   type="email"
                   value={email}
                   onChange={(e) => { setEmail(e.target.value); setError(null); }}
                   autoComplete="username"
                   required
                   onFocus={() => setIsEmailFocused(true)}
                   onBlur={() => setIsEmailFocused(false)}
                />
             </motion.div>

             <motion.div initial={{ x: -10, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.45 }}>
                <OutlineInput 
                   id="password"
                   label="Enter your password"
                   type="password"
                   value={password}
                   onChange={(e) => { setPassword(e.target.value); setError(null); }}
                   autoComplete="current-password"
                   required
                   isHidden={!showPassword}
                   toggleHide={() => setShowPassword(!showPassword)}
                   onFocus={() => setIsPasswordFocused(true)}
                   onBlur={() => setIsPasswordFocused(false)}
                />
             </motion.div>

             <AnimatePresence>
                {error && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0, marginTop: 0 }}
                    animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
                    exit={{ opacity: 0, height: 0, marginTop: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="flex items-center gap-3 text-[#f28b82] text-[13px] bg-[#f28b82]/10 p-3.5 rounded-2xl border border-[#f28b82]/20 mt-3">
                      <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                      {error}
                    </div>
                  </motion.div>
                )}
             </AnimatePresence>

             <motion.div 
               initial={{ y: 10, opacity: 0 }} 
               animate={{ y: 0, opacity: 1 }} 
               transition={{ delay: 0.5 }}
               className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4"
             >
                <button
                   type="button"
                   onClick={() => alert("Restricted: Please contact the Database Administrator to securely reset Super Admin credentials.")}
                   className="text-[14px] font-medium text-[#8ab4f8] hover:text-[#aecbfa] hover:bg-[#8ab4f8]/10 px-4 py-2 sm:-ml-3 rounded-full transition-colors w-full sm:w-auto text-center"
                >
                   Forgot password?
                </button>
                <button
                   type="submit"
                   disabled={loading}
                   className="relative overflow-hidden group bg-[#8ab4f8] hover:bg-[#aecbfa] active:bg-[#8ab4f8] disabled:bg-[#8ab4f8]/50 disabled:text-[#1a1b1f]/50 disabled:cursor-not-allowed text-[#1a1b1f] text-[14px] font-medium px-8 py-2.5 rounded-full transition-all duration-300 flex items-center justify-center min-w-[100px] w-full sm:w-auto"
                >
                   {loading ? (
                       <svg className="animate-spin h-5 w-5 text-[#1a1b1f]" fill="none" viewBox="0 0 24 24">
                         <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                         <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                       </svg>
                   ) : (
                       "Sign In"
                   )}
                </button>
             </motion.div>
          </form>
         </div>
        </div>
      </motion.div>
    </div>
  );
}
