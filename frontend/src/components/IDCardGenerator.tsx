import React, { useRef, useEffect } from 'react';
import { Download, QrCode, ShieldCheck, Share2, Sparkles, CheckCircle2, Award } from 'lucide-react';

interface IDCardGeneratorProps {
  studentName: string;
  regNo: string;
  deptName: string;
  yearLevel: string;
  totalSolved: number;
  collegeRank?: number;
  streakCount?: number;
}

export const IDCardGenerator: React.FC<IDCardGeneratorProps> = ({
  studentName,
  regNo,
  deptName,
  yearLevel,
  totalSolved,
  collegeRank = 1,
  streakCount = 0
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const drawCardOnCanvas = (canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // High-Resolution 800 x 480 Canvas
    canvas.width = 800;
    canvas.height = 480;

    // 1. Deep Cybernetic Executive Background Gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 800, 480);
    bgGrad.addColorStop(0, '#030712');
    bgGrad.addColorStop(0.5, '#0B192C');
    bgGrad.addColorStop(1, '#022C22');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 800, 480);

    // Decorative radial glow behind rank
    const radialGlow = ctx.createRadialGradient(640, 190, 10, 640, 190, 180);
    radialGlow.addColorStop(0, 'rgba(16, 185, 129, 0.25)');
    radialGlow.addColorStop(1, 'rgba(16, 185, 129, 0)');
    ctx.fillStyle = radialGlow;
    ctx.fillRect(400, 60, 380, 300);

    // 2. High-Tech Dual Border with Gold & Emerald Accents
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 3;
    ctx.strokeRect(16, 16, 768, 448);

    ctx.strokeStyle = 'rgba(212, 175, 55, 0.4)'; // Gold circuit inner
    ctx.lineWidth = 1;
    ctx.strokeRect(22, 22, 756, 436);

    // Corner Luminous Brackets
    const drawBracket = (x: number, y: number, dx: number, dy: number) => {
      ctx.strokeStyle = '#34D399';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x, y + dy * 20);
      ctx.lineTo(x, y);
      ctx.lineTo(x + dx * 20, y);
      ctx.stroke();
    };
    drawBracket(16, 16, 1, 1);
    drawBracket(784, 16, -1, 1);
    drawBracket(16, 464, 1, -1);
    drawBracket(784, 464, -1, -1);

    // 3. College Header Section
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 22px "Inter", sans-serif';
    ctx.fillText('NANDHA ENGINEERING COLLEGE (AUTONOMOUS)', 400, 52);

    ctx.fillStyle = '#34D399';
    ctx.font = '900 13px monospace';
    ctx.fillText('OFFICIAL LEETCODE PLATFORM • DIGITAL PERFORMANCE PASS', 400, 74);

    // Header Separator
    const sepGrad = ctx.createLinearGradient(60, 85, 740, 85);
    sepGrad.addColorStop(0, 'rgba(16, 185, 129, 0)');
    sepGrad.addColorStop(0.5, 'rgba(16, 185, 129, 0.9)');
    sepGrad.addColorStop(1, 'rgba(16, 185, 129, 0)');
    ctx.strokeStyle = sepGrad;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(60, 88);
    ctx.lineTo(740, 88);
    ctx.stroke();

    // 4. Student Details (Left Column)
    ctx.textAlign = 'left';
    
    // Student Name
    ctx.fillStyle = '#CBD5E1';
    ctx.font = '900 12px sans-serif';
    ctx.fillText('STUDENT NAME', 45, 126);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 26px sans-serif';
    ctx.fillText(studentName.toUpperCase(), 45, 158);

    // Register Number (Glowing Badge)
    ctx.fillStyle = '#CBD5E1';
    ctx.font = '900 12px sans-serif';
    ctx.fillText('REGISTER NO', 45, 200);

    ctx.fillStyle = 'rgba(6, 78, 59, 0.7)';
    ctx.fillRect(45, 212, 230, 36);
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 2;
    ctx.strokeRect(45, 212, 230, 36);

    ctx.fillStyle = '#6EE7B7';
    ctx.font = '900 19px monospace';
    ctx.fillText(regNo, 58, 236);

    // Department & Year
    ctx.fillStyle = '#CBD5E1';
    ctx.font = '900 12px sans-serif';
    ctx.fillText('DEPARTMENT & ACADEMIC YEAR', 45, 282);

    ctx.fillStyle = '#F8FAFC';
    ctx.font = '900 15px sans-serif';
    ctx.fillText(`${deptName} • ${yearLevel} Year`, 45, 308);

    // 5. Metrics Glass Card (Right Column)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.fillRect(510, 110, 245, 220);
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 2;
    ctx.strokeRect(510, 110, 245, 220);

    // Metric 1: College Rank
    ctx.textAlign = 'center';
    ctx.fillStyle = '#E2E8F0';
    ctx.font = '900 12px sans-serif';
    ctx.fillText('COLLEGE RANK', 632, 138);

    ctx.fillStyle = '#FBBF24';
    ctx.font = '900 32px sans-serif';
    ctx.fillText(`#${collegeRank}`, 632, 174);

    // Metric 2: Solved Problems
    ctx.fillStyle = '#E2E8F0';
    ctx.font = '900 12px sans-serif';
    ctx.fillText('PROBLEMS SOLVED', 632, 210);

    ctx.fillStyle = '#34D399';
    ctx.font = '900 26px sans-serif';
    ctx.fillText(`${totalSolved}`, 632, 242);

    // Metric 3: Active Streak
    ctx.fillStyle = '#E2E8F0';
    ctx.font = '900 12px sans-serif';
    ctx.fillText('ACTIVE STREAK', 632, 276);

    ctx.fillStyle = '#F87171';
    ctx.font = '900 20px sans-serif';
    ctx.fillText(`🔥 ${streakCount} Days`, 632, 304);

    // 6. Dual Digital Signature & Seal Bar (Bottom)
    const sigLineY = 375;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(45, sigLineY);
    ctx.lineTo(755, sigLineY);
    ctx.stroke();

    // Principal Signature (Left)
    ctx.textAlign = 'left';
    ctx.fillStyle = '#6EE7B7';
    ctx.font = 'italic 900 13px sans-serif';
    ctx.fillText('Digitally Verified by Principal', 45, 405);

    ctx.fillStyle = '#94A3B8';
    ctx.font = '900 11px sans-serif';
    ctx.fillText('NANDHA ENGINEERING COLLEGE', 45, 424);

    // Center Official Badge
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FBBF24';
    ctx.font = '900 12px monospace';
    ctx.fillText(`ID: NEC-PASS-${regNo}`, 400, 415);

    // HOD Signature (Right)
    ctx.textAlign = 'right';
    ctx.fillStyle = '#6EE7B7';
    ctx.font = 'italic 900 13px sans-serif';
    ctx.fillText('Authorized by HOD / Coordinator', 755, 405);

    ctx.fillStyle = '#94A3B8';
    ctx.font = '900 11px sans-serif';
    ctx.fillText('DEPARTMENT ACADEMIC CELL', 755, 424);

    // Micro Footer
    ctx.textAlign = 'center';
    ctx.fillStyle = '#64748B';
    ctx.font = '900 10px monospace';
    ctx.fillText('AUTHENTICATED VIA CONTINUOUS LEETCODE PLATFORM TRACKING SYSTEM • IEEE SMC', 400, 452);
  };

  useEffect(() => {
    const renderCanvas = () => {
      if (canvasRef.current) {
        drawCardOnCanvas(canvasRef.current);
      }
    };

    renderCanvas();
    const t1 = setTimeout(renderCanvas, 80);
    const t2 = setTimeout(renderCanvas, 300);

    if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
      document.fonts.ready.then(renderCanvas).catch(() => {});
    }

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [studentName, regNo, deptName, yearLevel, totalSolved, collegeRank, streakCount]);

  const generateAndDownloadPass = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawCardOnCanvas(canvas);

    const link = document.createElement('a');
    link.download = `LeetCode_Student_Pass_${regNo || 'download'}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="glass-card p-6 md:p-8 rounded-3xl border border-emerald-500/40 dark:border-emerald-500/30 shadow-2xl space-y-6 bg-gradient-to-br from-navy-950/90 via-slate-900/90 to-emerald-950/70 text-white">
      
      {/* Top Bar */}
      <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-800 pb-4">
        <div className="space-y-1">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-black uppercase tracking-wider border border-emerald-500/40 shadow-sm">
            <Award className="w-3.5 h-3.5 text-emerald-400" />
            <span>OFFICIAL AUTONOMOUS DIGITAL VERIFICATION BADGE</span>
          </div>
          <h3 className="font-black text-xl text-white tracking-tight flex items-center space-x-2">
            <span>Executive Digital Student Pass</span>
          </h3>
          <p className="text-xs text-slate-300 dark:text-slate-300 font-bold">
            Ultra-HD Certified Pass with Dual Institutional Signatures (Principal & HOD).
          </p>
        </div>

        <button
          onClick={generateAndDownloadPass}
          className="flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-500/30 transition-transform transform hover:scale-105 cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>Download Ultra-HD Pass (.PNG)</span>
        </button>
      </div>

      {/* Live Rendered Canvas Preview */}
      <div className="flex justify-center p-2 rounded-2xl bg-black/60 border border-slate-700/80 shadow-inner overflow-x-auto">
        <canvas
          ref={canvasRef}
          className="rounded-2xl shadow-2xl max-w-full h-auto border border-emerald-500/50"
          style={{ width: '100%', maxWidth: '750px' }}
        />
      </div>

      {/* Verification Footer Notes */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-700/80 flex items-center space-x-2 text-slate-100 font-extrabold shadow-sm">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Principal Digital Authorization Included</span>
        </div>
        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-700/80 flex items-center space-x-2 text-slate-100 font-extrabold shadow-sm">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>HOD & Coordinator Certified Badge</span>
        </div>
        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-700/80 flex items-center space-x-2 text-slate-100 font-extrabold shadow-sm">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Ready for LinkedIn & Resume Portfolios</span>
        </div>
      </div>
    </div>
  );
};

