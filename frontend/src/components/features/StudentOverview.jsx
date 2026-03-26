import React, { useState, useEffect } from "react";
// eslint-disable-next-line no-unused-vars
import { motion } from "framer-motion";
import { GlassCard } from "../ui/DashboardLayout";
import { authAxios } from "../../services/api";
import {
  DocumentCheckIcon,
  ClockIcon,
  BellIcon,
  ChartBarIcon,
  CheckCircleIcon,
  AcademicCapIcon,
  SparklesIcon,
  ArrowRightIcon,
} from "../ui/Icons";

export default function StudentOverview({
  studentInfo,
  clearanceStatus,
  stages = [],
  setActiveView,
  isDarkMode = false,
}) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Fetch unread notifications count
    const fetchUnread = async () => {
      try {
        const { data } = await authAxios.get("/notifications");
        if (data && data.success) {
          setUnreadCount(data.items.filter((n) => !n.read_at).length);
        }
      } catch {
        // Silent catch
      }
    };
    fetchUnread();
  }, []);

  // Calculate Progress
  const approvedStages = stages.filter((s) => s.status === "approved").length;
  const totalStages = stages.length;
  
  const hasRequest = !!clearanceStatus?.hasRequest;
  const request = clearanceStatus?.request || null;
  const isCompleted = request?.is_completed;

  // Calculate Days Since Applied
  let daysSinceApplied = 0;
  if (hasRequest && request?.created_at) {
    const diff = new Date() - new Date(request.created_at);
    daysSinceApplied = Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  // Activity Feed Construction (Max 5)
  const buildActivityFeed = () => {
    if (!hasRequest) return [];
    const activities = [];
    
    // Application Submitted
    activities.push({
      date: new Date(request.created_at),
      title: "Application Submitted",
      desc: `Applied for ${request.portion} portion clearance.`,
      icon: <DocumentCheckIcon className="w-5 h-5" />,
      color: "blue",
    });

    // Admin stages
    const adminStages = [
      { key: "library", title: "Library Clearance", date: request.library_approved_at, status: request.library_status },
      { key: "cashier", title: "Financial Clearance", date: request.cashier_approved_at, status: request.cashier_status },
      { key: "registrar", title: "Registrar Validation", date: request.registrar_approved_at, status: request.registrar_status },
    ];
    
    adminStages.forEach(st => {
      if (st.date && st.status !== 'pending') {
        activities.push({
          date: new Date(st.date),
          title: st.title,
          desc: st.status === 'approved' ? 'Cleared by admin' : 'Action requested',
          icon: <CheckCircleIcon className="w-5 h-5" />,
          color: st.status === 'approved' ? 'green' : 'red',
        });
      }
    });

    // Professor Approvals
    if (clearanceStatus?.professorApprovals) {
      clearanceStatus.professorApprovals.forEach((prof) => {
        if (prof.status !== 'pending' && prof.approved_at) {
          activities.push({
            date: new Date(prof.approved_at),
            title: "Signatory Approval",
            desc: `Cleared by ${(prof.professor?.full_name || "Signatory")}`,
            icon: <CheckCircleIcon className="w-5 h-5" />,
            color: prof.status === 'approved' ? 'green' : 'red',
          });
        }
      });
    }

    if (isCompleted) {
       activities.push({
          date: new Date(request.updated_at || new Date()),
          title: "Clearance Completed",
          desc: `All requirements met and finalized.`,
          icon: <SparklesIcon className="w-5 h-5" />,
          color: "emerald",
       });
    }

    // Sort descending by date and take top 5
    return activities.sort((a, b) => b.date - a.date).slice(0, 5);
  };

  const activityFeed = buildActivityFeed();

  // Greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = studentInfo?.full_name?.split(" ")[0] || "Student";

  return (
    <div className="max-w-[1100px] mx-auto space-y-8 animate-fade-in w-full pb-10">
      
      {/* 1. HERO SECTION (Ultra-Premium Card) */}
      <div className={`relative overflow-hidden rounded-[32px] sm:rounded-[40px] shadow-[0_8px_30px_rgb(0,0,0,0.06)] ${isDarkMode ? "bg-gradient-to-br from-[#0c1f15] via-[#091511] to-black border border-[#2a3c33]" : "bg-gradient-to-br from-[#0b3b24] via-[#0a4d2e] to-[#042817]"}`}>
        
        {/* Dynamic Glowing Orbs */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#22c55e] opacity-[0.15] blur-[100px] rounded-full mix-blend-screen pointer-events-none translate-x-1/3 -translate-y-1/3 transition-all duration-1000" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-[#10b981] opacity-[0.12] blur-[80px] rounded-full mix-blend-screen pointer-events-none -translate-x-1/3 translate-y-1/3 transition-all duration-1000" />
        
        {/* Micro-dot overlay pattern for texture */}
        <div className="absolute inset-0 opacity-[0.04] dark:opacity-[0.06] pointer-events-none" style={{ backgroundImage: "radial-gradient(#ffffff 1.5px, transparent 1.5px)", backgroundSize: "28px 28px" }} />

        {/* Content Container */}
        <div className="relative z-10 px-8 py-12 sm:px-14 sm:py-20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-10">
           <div className="max-w-xl">
             <motion.h1 
               initial={{ opacity: 0, y: 15 }}
               animate={{ opacity: 1, y: 0 }}
               className="text-4xl sm:text-[46px] leading-[1.1] font-semibold tracking-[-0.03em] text-white mb-4"
               style={{ fontFamily: "'Product Sans', 'Google Sans', sans-serif" }}
             >
               {greeting}, <span className="text-[#6ee7b7]">{firstName}</span>!
             </motion.h1>
             <motion.p 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-[#a7f3d0] text-[17px] sm:text-[19px] font-normal leading-relaxed opacity-90"
             >
               {isCompleted ? "You're successfully cleared for graduation. Outstanding work, and congratulations!" : hasRequest ? "Let's get you fully cleared for graduation. Stay on top of your application below." : "Ready to take the final step towards graduation? The clearance process is fully digitized."}
             </motion.p>
           </div>
           
           <motion.div 
             initial={{ opacity: 0, scale: 0.95 }}
             animate={{ opacity: 1, scale: 1 }}
             transition={{ delay: 0.2, type: "spring", stiffness: 300, damping: 20 }}
             className="flex gap-3 shrink-0"
           >
             {!hasRequest ? (
               <button 
                 onClick={() => setActiveView("status")}
                 className="group relative px-8 py-4 bg-white text-[#0b3b24] hover:bg-[#f0fdf4] rounded-[20px] font-bold text-[16px] tracking-wide shadow-[0_12px_40px_rgba(0,0,0,0.2)] hover:shadow-[0_12px_40px_rgba(16,185,129,0.3)] transition-all active:scale-[0.97] flex items-center gap-3 overflow-hidden border border-white"
               >
                 <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-emerald-100/40 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-in-out pointer-events-none" />
                 <SparklesIcon className="w-6 h-6 text-[#10b981] drop-shadow-sm" />
                 Start Clearance
               </button>
             ) : (
                <button 
                 onClick={() => setActiveView("status")}
                 className="group relative px-8 py-4 bg-white text-[#0b3b24] hover:bg-[#f0fdf4] rounded-[20px] font-bold text-[16px] tracking-wide shadow-[0_12px_40px_rgba(0,0,0,0.2)] hover:shadow-[0_12px_40px_rgba(16,185,129,0.3)] transition-all active:scale-[0.97] flex items-center gap-3 overflow-hidden border border-white"
               >
                 <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-emerald-100/40 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-in-out pointer-events-none" />
                 <ChartBarIcon className="w-6 h-6 text-[#10b981] drop-shadow-sm" />
                 View Details
               </button>
             )}
           </motion.div>
        </div>
      </div>

      {/* 2. STATS GRID (The 4 Dashboards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        
        {/* Stat 1: Progress */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} onClick={() => setActiveView("status")} className="cursor-pointer group h-full">
          <GlassCard isDark={isDarkMode} className={`p-6 sm:p-7 rounded-[28px] sm:border-t-[4px] border-t-emerald-500 border-x border-b ${isDarkMode ? "bg-[#181a1b] border-x-[#2a2d2f] border-b-[#2a2d2f] hover:border-x-gray-600 hover:border-b-gray-600" : "bg-white border-x-gray-100 border-b-gray-100 hover:border-x-gray-200 hover:border-b-gray-200"} shadow-[0_2px_10px_rgba(0,0,0,0.02)] hover:shadow-[0_12px_30px_rgba(0,0,0,0.05)] transition-all duration-300 h-full flex flex-col justify-between relative`}>
             <div className="flex justify-between items-start mb-6">
                <div className={`p-3.5 rounded-2xl flex items-center justify-center transition-colors ${isDarkMode ? "bg-emerald-900/40 text-emerald-400 group-hover:bg-emerald-900/60" : "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100"}`}>
                   <CheckCircleIcon className="w-6 h-6 stroke-[2px]" />
                </div>
             </div>
             <div>
               <h3 className={`text-[44px] leading-none tracking-tight font-semibold mb-2 transition-transform origin-left group-hover:scale-[1.03] ${isDarkMode ? "text-white" : "text-gray-900"}`} style={{ fontFamily: "Google Sans, sans-serif" }}>
                 {hasRequest ? `${approvedStages}/${totalStages}` : "0"}
               </h3>
               <p className={`text-[15px] font-medium tracking-wide ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>Stages Cleared</p>
             </div>
          </GlassCard>
        </motion.div>

        {/* Stat 2: Days Elapsed */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="h-full">
          <GlassCard isDark={isDarkMode} className={`p-6 sm:p-7 rounded-[28px] sm:border-t-[4px] border-t-blue-500 border-x border-b ${isDarkMode ? "bg-[#181a1b] border-x-[#2a2d2f] border-b-[#2a2d2f]" : "bg-white border-x-gray-100 border-b-gray-100"} hover:shadow-[0_12px_30px_rgba(0,0,0,0.04)] shadow-[0_2px_10px_rgba(0,0,0,0.02)] transition-all duration-300 h-full flex flex-col justify-between relative group`}>
             <div className="flex justify-between items-start mb-6">
                <div className={`p-3.5 rounded-2xl flex items-center justify-center transition-colors ${isDarkMode ? "bg-blue-900/40 text-blue-400 group-hover:bg-blue-900/60" : "bg-blue-50 text-blue-600 group-hover:bg-blue-100"}`}>
                   <ClockIcon className="w-6 h-6 stroke-[2px]" />
                </div>
             </div>
             <div>
               <h3 className={`text-[44px] leading-none tracking-tight font-semibold mb-2 transition-transform origin-left group-hover:scale-[1.03] ${isDarkMode ? "text-white" : "text-gray-900"}`} style={{ fontFamily: "Google Sans, sans-serif" }}>
                 {hasRequest ? daysSinceApplied : "0"}
               </h3>
               <p className={`text-[15px] font-medium tracking-wide ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>Days Processing</p>
             </div>
          </GlassCard>
        </motion.div>

        {/* Stat 3: Est Completion */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="h-full">
          <GlassCard isDark={isDarkMode} className={`p-6 sm:p-7 rounded-[28px] sm:border-t-[4px] border-t-amber-400 border-x border-b ${isDarkMode ? "bg-[#181a1b] border-x-[#2a2d2f] border-b-[#2a2d2f]" : "bg-white border-x-gray-100 border-b-gray-100"} hover:shadow-[0_12px_30px_rgba(0,0,0,0.04)] shadow-[0_2px_10px_rgba(0,0,0,0.02)] transition-all duration-300 h-full flex flex-col justify-between relative group`}>
             <div className="flex justify-between items-start mb-6">
                <div className={`p-3.5 rounded-2xl flex items-center justify-center transition-colors ${isDarkMode ? "bg-amber-900/40 text-amber-400 group-hover:bg-amber-900/60" : "bg-amber-50 text-amber-600 group-hover:bg-amber-100"}`}>
                   <CheckCircleIcon className="w-6 h-6 stroke-[2px]" />
                </div>
             </div>
             <div>
               <h3 className={`text-[28px] sm:text-[32px] leading-none tracking-tight font-semibold mb-[18px] transition-transform origin-left group-hover:scale-[1.03] ${isDarkMode ? "text-white" : "text-gray-900"}`} style={{ fontFamily: "Google Sans, sans-serif" }}>
                 {isCompleted ? "Done" : hasRequest ? "TBD" : "N/A"}
               </h3>
               <p className={`text-[15px] font-medium tracking-wide ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>Est. Completion</p>
             </div>
          </GlassCard>
        </motion.div>

        {/* Stat 4: Notifications */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} onClick={() => setActiveView("notifications")} className="cursor-pointer group h-full">
          <GlassCard isDark={isDarkMode} className={`p-6 sm:p-7 rounded-[28px] sm:border-t-[4px] border-t-purple-500 border-x border-b ${isDarkMode ? "bg-[#181a1b] border-x-[#2a2d2f] border-b-[#2a2d2f] hover:border-x-gray-600 hover:border-b-gray-600" : "bg-white border-x-gray-100 border-b-gray-100 hover:border-x-gray-200 hover:border-b-gray-200"} hover:shadow-[0_12px_30px_rgba(0,0,0,0.05)] shadow-[0_2px_10px_rgba(0,0,0,0.02)] transition-all duration-300 h-full flex flex-col justify-between relative`}>
             <div className="flex justify-between items-start mb-6 relative">
                <div className={`p-3.5 rounded-2xl flex items-center justify-center transition-colors ${isDarkMode ? "bg-purple-900/40 text-purple-400 group-hover:bg-purple-900/60" : "bg-purple-50 text-purple-600 group-hover:bg-purple-100"}`}>
                   <BellIcon className="w-6 h-6 stroke-[2px]" />
                </div>
                {unreadCount > 0 && <span className="absolute top-0 right-0 -mt-1 -mr-1 w-3.5 h-3.5 bg-red-500 rounded-full ring-[3px] ring-white dark:ring-[#181a1b] shadow-sm animate-pulse"></span>}
             </div>
             <div>
               <h3 className={`text-[44px] leading-none tracking-tight font-semibold mb-2 transition-transform origin-left group-hover:scale-[1.03] ${isDarkMode ? "text-white" : "text-gray-900"}`} style={{ fontFamily: "Google Sans, sans-serif" }}>
                 {unreadCount}
               </h3>
               <p className={`text-[15px] font-medium tracking-wide ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>Unread Alerts</p>
             </div>
          </GlassCard>
        </motion.div>

      </div>

      {/* 3. BOTTOM SECTION: Activity & Shortcuts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
         
         {/* Recent Activity Timeline */}
         <div className="lg:col-span-2 space-y-4">
           <div className="flex items-center justify-between px-2">
             <h2 className={`text-[20px] font-semibold tracking-tight ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`} style={{ fontFamily: "Google Sans, sans-serif" }}>Recent Activity</h2>
             {activityFeed.length > 0 && (
               <button onClick={() => setActiveView("history")} className={`text-[14px] font-medium transition-colors ${isDarkMode ? 'text-emerald-400 hover:text-emerald-300' : 'text-emerald-600 hover:text-emerald-700'}`}>View all</button>
             )}
           </div>
           
           <div className="h-full">
              <GlassCard isDark={isDarkMode} className={`rounded-[32px] border ${isDarkMode ? 'bg-[#181a1b] border-[#2a2d2f]' : 'bg-white border-gray-100'} shadow-[0_4px_20px_rgba(0,0,0,0.03)] h-[380px] overflow-hidden`}>
                {!hasRequest ? (
                  <div className="h-full w-full flex flex-col items-center justify-center text-center p-8 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-[radial-gradient(#2a2d2f_1px,transparent_1px)] [background-size:20px_20px]">
                    <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-5 ${isDarkMode ? 'bg-[#282a2d] shadow-inner border border-[#3c4043]' : 'bg-white shadow-[0_8px_30px_rgba(0,0,0,0.08)] border border-gray-100'} transition-transform hover:scale-105`}>
                       <ArchiveBoxIcon className={`w-10 h-10 ${isDarkMode ? 'text-gray-500' : 'text-gray-300'}`} />
                    </div>
                    <p className={`text-lg font-semibold tracking-tight ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>No clearance activity</p>
                    <p className={`text-[15px] mt-1 text-balance ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>Once you start your application, your timeline will magically appear right here.</p>
                  </div>
                ) : activityFeed.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8">
                    <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-5 ${isDarkMode ? 'bg-blue-900/10 shadow-inner border border-blue-900/30' : 'bg-blue-50/50 shadow-md border border-blue-100'} animate-pulse`}>
                       <ClockIcon className={`w-10 h-10 ${isDarkMode ? 'text-blue-400' : 'text-blue-500'}`} />
                    </div>
                    <p className={`text-lg font-semibold tracking-tight ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>Awaiting Signatories</p>
                    <p className={`text-[15px] mt-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>Your application is safely processing in the background.</p>
                  </div>
                ) : (
                  <div className="h-full w-full overflow-y-auto p-6 sm:p-8 custom-scrollbar">
                    {activityFeed.map((item, idx) => {
                      return (
                        <motion.div 
                          initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 * idx }}
                          key={idx} className="relative pl-12 py-3 group"
                        >
                           {/* Connecting Line */}
                           {idx !== activityFeed.length - 1 && (
                             <div className={`absolute left-[23px] top-[40px] bottom-[-16px] w-[2px] rounded-full transition-colors ${isDarkMode ? "bg-[#2a2d2f]" : "bg-gray-100 group-hover:bg-gray-200"}`} />
                           )}
                           
                           {/* Icon Status Dot */}
                           <div className={`absolute left-0 top-3 w-12 h-12 rounded-full flex items-center justify-center ring-8 ${isDarkMode ? 'ring-[#181a1b]' : 'ring-white'} 
                              ${item.color === 'green' ? 'bg-[#e6f4ea] text-[#137333] dark:bg-[#137333]/20 dark:text-[#81c995]' :
                                item.color === 'blue' ? 'bg-[#e8f0fe] text-[#1a73e8] dark:bg-[#1a73e8]/20 dark:text-[#8ab4f8]' :
                                item.color === 'emerald' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400' :
                                'bg-[#fce8e6] text-[#c5221f] dark:bg-[#c5221f]/20 dark:text-[#f28b82]'}`}
                           >
                             {React.cloneElement(item.icon, { className: "w-[22px] h-[22px]" })}
                           </div>

                           <div className={`bg-transparent p-4 rounded-2xl transition-colors ${isDarkMode ? "group-hover:bg-[#282a2d]" : "group-hover:bg-gray-50"}`}>
                             <div className="flex justify-between items-baseline gap-4 mb-1">
                               <h4 className={`font-semibold text-[16px] tracking-tight ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>{item.title}</h4>
                               <span className={`text-[13px] font-medium whitespace-nowrap ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                                 {item.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric'})}
                               </span>
                             </div>
                             <p className={`text-[14.5px] leading-relaxed ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{item.desc}</p>
                           </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </GlassCard>
           </div>
         </div>

         {/* 3. Quick Actions Panel */}
         <div className="space-y-4">
           <h2 className={`px-2 text-[20px] font-semibold tracking-tight ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`} style={{ fontFamily: "Google Sans, sans-serif" }}>Tools</h2>
           <div className="flex flex-col gap-4 sm:gap-6">
              
              <button 
                onClick={() => setActiveView("certificate")}
                className={`relative flex flex-col justify-end p-7 rounded-[32px] overflow-hidden group transition-all duration-300 h-[178px] text-left border ${isDarkMode ? 'bg-[#181a1b] hover:bg-[#282a2d] border-[#2a2d2f]' : 'bg-white hover:bg-[#f0fdf4] border-gray-100 hover:border-emerald-200'} shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-[0_12px_30px_rgba(16,185,129,0.06)]`}
              >
                  <div className={`absolute top-0 right-0 w-40 h-40 bg-gradient-to-br transition-all duration-500 ${isDarkMode ? 'from-emerald-400/10' : 'from-emerald-400/20'} to-transparent rounded-bl-full group-hover:scale-110 origin-top-right`} />
                  <div className={`absolute top-6 right-6 w-14 h-14 rounded-2xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 shadow-sm ${isDarkMode ? 'bg-[#282a2d] border border-[#3c4043]' : 'bg-white border border-gray-50'}`}>
                     <AcademicCapIcon className={`w-7 h-7 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`} />
                  </div>
                  <div className="relative z-10">
                    <h3 className={`text-[22px] font-semibold tracking-tight ${isDarkMode ? 'text-white' : 'text-gray-900'} mb-1.5`}>Certificate</h3>
                    <p className={`text-[15px] font-medium ${isDarkMode ? 'text-gray-400 group-hover:text-gray-300' : 'text-gray-500 group-hover:text-emerald-700'} flex items-center transition-colors`}>
                      Preview & download
                      <ArrowRightIcon className="w-4 h-4 opacity-0 -translate-x-3 group-hover:opacity-100 group-hover:translate-x-1.5 transition-all duration-300" />
                    </p>
                  </div>
              </button>

              <button 
                onClick={() => setActiveView("history")}
               className={`relative flex flex-col justify-end p-7 rounded-[32px] overflow-hidden group transition-all duration-300 h-[178px] text-left border ${isDarkMode ? 'bg-[#181a1b] hover:bg-[#282a2d] border-[#2a2d2f]' : 'bg-white hover:bg-blue-50 border-gray-100 hover:border-blue-200'} shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-[0_12px_30px_rgba(59,130,246,0.06)]`}
              >
                  <div className={`absolute top-0 right-0 w-40 h-40 bg-gradient-to-br transition-all duration-500 ${isDarkMode ? 'from-blue-400/10' : 'from-blue-400/20'} to-transparent rounded-bl-full group-hover:scale-110 origin-top-right`} />
                  <div className={`absolute top-6 right-6 w-14 h-14 rounded-2xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 shadow-sm ${isDarkMode ? 'bg-[#282a2d] border border-[#3c4043]' : 'bg-white border border-gray-50'}`}>
                     <ClockIcon className={`w-7 h-7 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                  </div>
                  <div className="relative z-10">
                    <h3 className={`text-[22px] font-semibold tracking-tight ${isDarkMode ? 'text-white' : 'text-gray-900'} mb-1.5`}>History</h3>
                    <p className={`text-[15px] font-medium ${isDarkMode ? 'text-gray-400 group-hover:text-gray-300' : 'text-gray-500 group-hover:text-blue-700'} flex items-center transition-colors`}>
                      Past applications
                      <ArrowRightIcon className="w-4 h-4 opacity-0 -translate-x-3 group-hover:opacity-100 group-hover:translate-x-1.5 transition-all duration-300" />
                    </p>
                  </div>
              </button>

           </div>
         </div>
      </div>

    </div>
  );
}

function ArchiveBoxIcon(props) {
  return (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
    </svg>
  );
}
