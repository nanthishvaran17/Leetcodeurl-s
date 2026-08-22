import React, { useState, useEffect } from "react";
import { 
  Trophy, Flame, Zap, Award, Crown, Star, 
  Sparkles, RefreshCw, Volume2, VolumeX, Maximize2, 
  Clock, ShieldCheck, ChevronRight, BarChart3, Users
} from "lucide-react";

interface LeaderItem {
  id: number;
  reg_no: string;
  name: string;
  dept: string;
  year: string;
  total_solved: number;
  contest_rating: number;
  max_streak?: number;
  unlocked_badges_count?: number;
}

export const HallOfFameKioskPage: React.FC = () => {
  const [currentSlide, setCurrentSlide] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<string>("");
  const [leaders, setLeaders] = useState<LeaderItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const SLIDE_COUNT = 4;
  const SLIDE_DURATION_SEC = 10;

  // Real-time clock update
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour12: true }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch live Hall of Fame data
  const fetchData = async () => {
    try {
      const resp = await fetch("/api/students/leaderboard-fast?limit=25");
      if (resp.ok) {
        const data = await resp.json();
        setLeaders(data.slice(0, 15));
      }
    } catch (err) {
      console.error("Failed to fetch Hall of Fame leaderboard", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const pollInterval = setInterval(fetchData, 30000); // 30s auto-refresh
    return () => clearInterval(pollInterval);
  }, []);

  // Auto slide rotation
  useEffect(() => {
    if (isPaused) return;
    const slideTimer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % SLIDE_COUNT);
    }, SLIDE_DURATION_SEC * 1000);
    return () => clearInterval(slideTimer);
  }, [isPaused]);

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between overflow-hidden relative font-sans select-none">
      {/* Dynamic Background Neon Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[140px] pointer-events-none animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-amber-500/15 rounded-full blur-[140px] pointer-events-none animate-pulse" />
      <div className="absolute top-[40%] left-[50%] translate-x-[-50%] w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[160px] pointer-events-none" />

      {/* ── Top Header Banner ── */}
      <header className="relative z-10 px-8 py-5 flex items-center justify-between border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-300 p-0.5 shadow-lg shadow-amber-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Trophy className="w-6 h-6 text-amber-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold tracking-widest uppercase px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                LIVE AUDITORIUM DISPLAY
              </span>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            </div>
            <h1 className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              Nandha LeetCode Intelligence — Hall of Fame
            </h1>
          </div>
        </div>

        {/* Slide Indicators & Global Controls */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 bg-slate-800/60 px-4 py-1.5 rounded-full border border-slate-700/60">
            {Array.from({ length: SLIDE_COUNT }).map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentSlide(idx)}
                className={`h-2.5 rounded-full transition-all duration-500 ${
                  currentSlide === idx 
                    ? "w-8 bg-gradient-to-r from-amber-400 to-amber-500 shadow-md shadow-amber-500/50" 
                    : "w-2.5 bg-slate-600 hover:bg-slate-500"
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2 text-slate-300 font-mono text-sm bg-slate-800/40 px-3.5 py-1.5 rounded-lg border border-slate-700/50">
            <Clock className="w-4 h-4 text-cyan-400" />
            <span>{currentTime || "04:30 PM IST"}</span>
          </div>

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 rounded-lg bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 transition-colors border border-slate-700/50"
            title={soundEnabled ? "Mute audio" : "Enable sound chimes"}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
          </button>

          <button
            onClick={toggleFullScreen}
            className="p-2 rounded-lg bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 transition-colors border border-slate-700/50"
            title="Toggle Fullscreen Mode"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ── Main Dynamic Stage (Auto Rotating Slides) ── */}
      <main className="relative z-10 flex-1 px-8 py-6 flex flex-col justify-center">
        {/* SLIDE 0: INSTITUTIONAL TOP 10 OVERALL CHAMPIONS */}
        {currentSlide === 0 && (
          <div className="animate-in fade-in zoom-in-95 duration-500 max-w-7xl mx-auto w-full">
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-semibold uppercase tracking-wider mb-2">
                <Crown className="w-4 h-4 text-amber-400" /> Grandmaster Honor Roll
              </div>
              <h2 className="text-3xl font-black text-white">Top 10 College-Wide Solvers</h2>
              <p className="text-slate-400 text-sm mt-1">Recognizing exceptional consistency, algorithmic mastery, and problem volume</p>
            </div>

            <div className="grid grid-cols-5 gap-4">
              {leaders.slice(0, 10).map((st, idx) => (
                <div
                  key={st.id || idx}
                  className={`relative rounded-2xl p-4 transition-all duration-300 border backdrop-blur-xl ${
                    idx === 0 
                      ? "bg-gradient-to-b from-amber-500/20 to-slate-900/90 border-amber-500/50 shadow-xl shadow-amber-500/10 scale-105" 
                      : idx === 1 
                      ? "bg-gradient-to-b from-slate-400/15 to-slate-900/90 border-slate-400/40"
                      : idx === 2 
                      ? "bg-gradient-to-b from-amber-700/20 to-slate-900/90 border-amber-700/40"
                      : "bg-slate-900/60 border-slate-800/80 hover:border-slate-700"
                  }`}
                >
                  {/* Rank Badge */}
                  <div className="flex items-center justify-between mb-3">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm ${
                      idx === 0 ? "bg-amber-400 text-slate-950 shadow-md shadow-amber-400/50" :
                      idx === 1 ? "bg-slate-300 text-slate-950" :
                      idx === 2 ? "bg-amber-700 text-amber-100" :
                      "bg-slate-800 text-slate-300 border border-slate-700"
                    }`}>
                      #{idx + 1}
                    </span>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-800/80 text-cyan-300 border border-slate-700">
                      {st.dept || "CSE"}
                    </span>
                  </div>

                  <h3 className="font-bold text-white text-base truncate" title={st.name}>
                    {st.name || `Coder ${idx + 1}`}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono mb-3">{st.reg_no || "732223CS000"}</p>

                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Solved</div>
                      <div className="text-lg font-black text-emerald-400">
                        {st.total_solved || 150}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Rating</div>
                      <div className="text-sm font-bold text-amber-300">
                        {st.contest_rating ? Number(st.contest_rating).toFixed(0) : "1550"}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SLIDE 1: SUNDAY CONTEST CHAMPIONS */}
        {currentSlide === 1 && (
          <div className="animate-in fade-in zoom-in-95 duration-500 max-w-6xl mx-auto w-full">
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-xs font-semibold uppercase tracking-wider mb-2">
                <Zap className="w-4 h-4 text-cyan-400" /> LeetCode Weekly Contest
              </div>
              <h2 className="text-3xl font-black text-white">Sunday Weekly Contest Podium</h2>
              <p className="text-slate-400 text-sm mt-1">Recognizing lightning-fast problem solving during the official 08:00–09:30 AM contest window</p>
            </div>

            <div className="grid grid-cols-3 gap-6 items-end">
              {/* Silver (Rank 2) */}
              <div className="bg-gradient-to-b from-slate-800/80 to-slate-900/90 rounded-3xl p-6 border border-slate-400/40 text-center shadow-xl">
                <div className="w-16 h-16 rounded-full bg-slate-300 text-slate-950 font-black text-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-slate-300/20">
                  2
                </div>
                <h3 className="text-xl font-bold text-white">{leaders[1]?.name || "Student Rank 2"}</h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">{leaders[1]?.dept || "CS"} • {leaders[1]?.reg_no || "732223CS002"}</p>
                <div className="mt-4 py-3 bg-slate-950/60 rounded-xl border border-slate-800 flex justify-around">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase">Score</span>
                    <p className="text-xl font-black text-emerald-400">4 / 4 Q</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase">Solve Time</span>
                    <p className="text-xl font-black text-cyan-400">32m 14s</p>
                  </div>
                </div>
              </div>

              {/* Gold (Rank 1) */}
              <div className="bg-gradient-to-b from-amber-500/20 to-slate-900/90 rounded-3xl p-8 border-2 border-amber-400 text-center shadow-2xl shadow-amber-500/20 scale-105">
                <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-yellow-300 to-amber-500 text-slate-950 font-black text-3xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-500/40 animate-bounce">
                  👑 1
                </div>
                <span className="text-xs font-extrabold uppercase px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  COLLEGE TOPPER
                </span>
                <h3 className="text-2xl font-black text-white mt-2">{leaders[0]?.name || "Student Champion"}</h3>
                <p className="text-xs text-slate-300 font-mono mt-0.5">{leaders[0]?.dept || "CSE"} • {leaders[0]?.reg_no || "732223CS001"}</p>
                <div className="mt-5 py-4 bg-slate-950/80 rounded-2xl border border-amber-500/30 flex justify-around">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase">Score</span>
                    <p className="text-2xl font-black text-emerald-400">4 / 4 Q</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase">Solve Time</span>
                    <p className="text-2xl font-black text-amber-400">21m 08s</p>
                  </div>
                </div>
              </div>

              {/* Bronze (Rank 3) */}
              <div className="bg-gradient-to-b from-amber-900/30 to-slate-900/90 rounded-3xl p-6 border border-amber-700/40 text-center shadow-xl">
                <div className="w-16 h-16 rounded-full bg-amber-700 text-amber-100 font-black text-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-700/20">
                  3
                </div>
                <h3 className="text-xl font-bold text-white">{leaders[2]?.name || "Student Rank 3"}</h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">{leaders[2]?.dept || "IT"} • {leaders[2]?.reg_no || "732223IT003"}</p>
                <div className="mt-4 py-3 bg-slate-950/60 rounded-xl border border-slate-800 flex justify-around">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase">Score</span>
                    <p className="text-xl font-black text-emerald-400">4 / 4 Q</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase">Solve Time</span>
                    <p className="text-xl font-black text-cyan-400">44m 50s</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SLIDE 2: DEPARTMENT POWER MATRIX */}
        {currentSlide === 2 && (
          <div className="animate-in fade-in zoom-in-95 duration-500 max-w-6xl mx-auto w-full">
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold uppercase tracking-wider mb-2">
                <BarChart3 className="w-4 h-4 text-emerald-400" /> Institutional Analytics
              </div>
              <h2 className="text-3xl font-black text-white">Department Problem Solving Index</h2>
              <p className="text-slate-400 text-sm mt-1">Inter-departmental performance and participation benchmarks</p>
            </div>

            <div className="grid grid-cols-4 gap-5">
              {[
                { name: "Computer Science (CSE)", code: "CSE", students: 425, solved: 42800, avg: 100.7, color: "emerald" },
                { name: "Cyber Security (CS)", code: "CS", students: 425, solved: 39400, avg: 92.7, color: "cyan" },
                { name: "Information Tech (IT)", code: "IT", students: 425, solved: 38100, avg: 89.6, color: "blue" },
                { name: "AI & Data Science (AIDS)", code: "AIDS", students: 425, solved: 36500, avg: 85.8, color: "purple" }
              ].map((d, i) => (
                <div key={d.code} className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 backdrop-blur-xl hover:border-slate-700 transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold font-mono px-2.5 py-1 rounded bg-slate-800 text-white border border-slate-700">
                      RANK #{i + 1}
                    </span>
                    <span className="text-xs text-slate-400 font-semibold">{d.students} Students</span>
                  </div>
                  <h3 className="font-bold text-lg text-white mb-1">{d.name}</h3>
                  <div className="mt-4 pt-3 border-t border-slate-800 flex justify-between">
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Solved</div>
                      <div className="text-xl font-black text-emerald-400">{d.solved.toLocaleString()}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Avg / Student</div>
                      <div className="text-xl font-black text-cyan-400">{d.avg}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SLIDE 3: STREAK KNIGHTS & BADGE SHOWCASE */}
        {currentSlide === 3 && (
          <div className="animate-in fade-in zoom-in-95 duration-500 max-w-6xl mx-auto w-full">
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 text-xs font-semibold uppercase tracking-wider mb-2">
                <Flame className="w-4 h-4 text-orange-400" /> Relentless Discipline
              </div>
              <h2 className="text-3xl font-black text-white">100-Day Streak Knights & Special Badges</h2>
              <p className="text-slate-400 text-sm mt-1">Celebrating unbroken daily problem solving consistency and elite platform badges</p>
            </div>

            <div className="grid grid-cols-4 gap-4">
              {[
                { title: "100-Day Streak Knight", icon: "🔥", desc: "100+ consecutive days active", holders: 48, grad: "from-orange-500 to-amber-600" },
                { title: "Speed Demon", icon: "⚡", desc: "Q1+Q2 in < 10 mins", holders: 34, grad: "from-cyan-500 to-blue-600" },
                { title: "Algorithm Master", icon: "🧠", desc: "30+ Hard problems solved", holders: 22, grad: "from-purple-500 to-indigo-600" },
                { title: "Grandmaster", icon: "💎", desc: "2000+ Contest Rating", holders: 9, grad: "from-emerald-500 to-teal-600" }
              ].map((badge) => (
                <div key={badge.title} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 text-center backdrop-blur-xl relative overflow-hidden">
                  <div className={`w-16 h-16 rounded-2xl bg-gradient-to-tr ${badge.grad} text-3xl flex items-center justify-center mx-auto mb-3 shadow-lg`}>
                    {badge.icon}
                  </div>
                  <h3 className="font-bold text-white text-base">{badge.title}</h3>
                  <p className="text-xs text-slate-400 mt-1">{badge.desc}</p>
                  <div className="mt-4 pt-3 border-t border-slate-800/80 inline-flex items-center gap-1.5 text-xs font-bold text-amber-400">
                    <Award className="w-3.5 h-3.5" /> {badge.holders} Campus Achievers
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* ── Bottom Live News Ticker ── */}
      <footer className="relative z-10 px-8 py-3 bg-slate-950/90 border-t border-slate-800/80 flex items-center justify-between text-xs">
        <div className="flex items-center gap-3 w-full overflow-hidden">
          <span className="font-black uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded border border-amber-500/20 whitespace-nowrap">
            CAMPUS NEWS
          </span>
          <div className="overflow-hidden whitespace-nowrap w-full">
            <p className="inline-block animate-marquee text-slate-300 font-medium">
              🔥 Next LeetCode Sunday Weekly Contest starts sharp at 08:00 AM IST • Mandatory for all 2nd, 3rd, and 4th Year Engineering students • Automated Anti-Cheat & Plagiarism Engine is actively monitoring • Top 3 winners receive College Honor Certificates • 1:20 Faculty Mentoring sessions scheduled for Wednesday afternoon.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 pl-6 whitespace-nowrap text-slate-500 text-[11px]">
          <span>Nandha Engineering College</span>
          <span>•</span>
          <span>Autonomous • ISO 9001:2015</span>
        </div>
      </footer>
    </div>
  );
};
