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
    ctx.font = 'bold 20px "Inter", sans-serif';
    ctx.fillText('NANDHA ENGINEERING COLLEGE (AUTONOMOUS)', 400, 52);

    ctx.fillStyle = '#10B981';
    ctx.font = 'bold 12px monospace';
    ctx.fillText('OFFICIAL LEETCODE PLATFORM • DIGITAL PERFORMANCE PASS', 400, 74);

    // Header Separator
    const sepGrad = ctx.createLinearGradient(60, 85, 740, 85);
    sepGrad.addColorStop(0, 'rgba(16, 185, 129, 0)');
    sepGrad.addColorStop(0.5, 'rgba(16, 185, 129, 0.8)');
    sepGrad.addColorStop(1, 'rgba(16, 185, 129, 0)');
    ctx.strokeStyle = sepGrad;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(60, 88);
    ctx.lineTo(740, 88);
    ctx.stroke();

    // 4. Student Details (Left Column)
    ctx.textAlign = 'left';
    
    // Student Name
    ctx.fillStyle = '#94A3B8';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('STUDENT NAME', 45, 130);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 24px sans-serif';
    ctx.fillText(studentName.toUpperCase(), 45, 160);

    // Register Number (Glowing Badge)
    ctx.fillStyle = '#94A3B8';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('REGISTER NO', 45, 202);

    ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
    ctx.fillRect(45, 214, 210, 32);
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 1;
    ctx.strokeRect(45, 214, 210, 32);

    ctx.fillStyle = '#34D399';
    ctx.font = 'bold 17px monospace';
    ctx.fillText(regNo, 58, 236);

    // Department & Year
    ctx.fillStyle = '#94A3B8';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('DEPARTMENT & ACADEMIC YEAR', 45, 280);

    ctx.fillStyle = '#E2E8F0';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(`${deptName} • ${yearLevel} Year`, 45, 304);

    // 5. Metrics Glass Card (Right Column)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(520, 115, 235, 210);
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(520, 115, 235, 210);

    // Metric 1: College Rank
    ctx.textAlign = 'center';
    ctx.fillStyle = '#94A3B8';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('COLLEGE RANK', 637, 142);

    ctx.fillStyle = '#F59E0B';
    ctx.font = '900 28px sans-serif';
    ctx.fillText(`#${collegeRank}`, 637, 175);

    // Metric 2: Solved Problems
    ctx.fillStyle = '#94A3B8';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('PROBLEMS SOLVED', 637, 212);

    ctx.fillStyle = '#10B981';
    ctx.font = '900 24px sans-serif';
    ctx.fillText(`${totalSolved}`, 637, 242);

    // Metric 3: Active Streak
    ctx.fillStyle = '#94A3B8';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('ACTIVE STREAK', 637, 276);

    ctx.fillStyle = '#EF4444';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(`🔥 ${streakCount} Days`, 637, 302);

    // 6. Dual Digital Signature & Seal Bar (Bottom)
    const sigLineY = 380;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(45, sigLineY);
    ctx.lineTo(755, sigLineY);
    ctx.stroke();

    // Principal Signature (Left)
    ctx.textAlign = 'left';
    ctx.fillStyle = '#34D399';
    ctx.font = 'italic bold 12px sans-serif';
    ctx.fillText('Digitally Verified by Principal', 45, 410);

    ctx.fillStyle = '#64748B';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('NANDHA ENGINEERING COLLEGE', 45, 426);

    // Center Official Badge
    ctx.textAlign = 'center';
    ctx.fillStyle = '#D4AF37';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(`ID: NEC-PASS-${regNo}`, 400, 418);

    // HOD Signature (Right)
    ctx.textAlign = 'right';
    ctx.fillStyle = '#34D399';
    ctx.font = 'italic bold 12px sans-serif';
    ctx.fillText('Authorized by HOD / Coordinator', 755, 410);

    ctx.fillStyle = '#64748B';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('DEPARTMENT ACADEMIC CELL', 755, 426);

    // Micro Footer
    ctx.textAlign = 'center';
    ctx.fillStyle = '#475569';
    ctx.font = '9px monospace';
    ctx.fillText('AUTHENTICATED VIA CONTINUOUS LEETCODE PLATFORM TRACKING SYSTEM • IEEE SMC', 400, 450);
  };

  useEffect(() => {
    if (canvasRef.current) {
      drawCardOnCanvas(canvasRef.current);
    }
  }, [studentName, regNo, deptName, yearLevel, totalSolved, collegeRank, streakCount]);

  const generateAndDownloadPass = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawCardOnCanvas(canvas);

    const link = document.createElement('a');
    link.download = `LeetCode_Student_Pass_${regNo}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="glass-card p-6 md:p-8 rounded-3xl border border-emerald-500/30 dark:border-emerald-500/20 shadow-2xl space-y-6 bg-gradient-to-br from-navy-950/80 via-slate-900/80 to-emerald-950/60">
      
      {/* Top Bar */}
      <div className="flex items-center justify-between flex-wrap gap-4 border-b border-gray-800 pb-4">
        <div className="space-y-1">
          <div className="inline-flex items-center space-x-2 px-3 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-wider border border-emerald-500/30">
            <Award className="w-3.5 h-3.5" />
            <span>OFFICIAL AUTONOMOUS DIGITAL VERIFICATION BADGE</span>
          </div>
          <h3 className="font-black text-lg text-white tracking-tight flex items-center space-x-2">
            <span>Executive Digital Student Pass</span>
          </h3>
          <p className="text-xs text-gray-400 font-medium">
            Ultra-HD Certified Pass with Dual Institutional Signatures (Principal & HOD).
          </p>
        </div>

        <button
          onClick={generateAndDownloadPass}
          className="flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-500/30 transition-transform transform hover:scale-105 cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>Download Ultra-HD Pass (.PNG)</span>
        </button>
      </div>

      {/* Live Rendered Canvas Preview */}
      <div className="flex justify-center p-2 rounded-2xl bg-black/40 border border-gray-800 shadow-inner overflow-x-auto">
        <canvas
          ref={canvasRef}
          className="rounded-2xl shadow-2xl max-w-full h-auto border border-emerald-500/40"
          style={{ width: '100%', maxWidth: '720px' }}
        />
      </div>

      {/* Verification Footer Notes */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 flex items-center space-x-2 text-gray-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Principal Digital Authorization Included</span>
        </div>
        <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 flex items-center space-x-2 text-gray-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>HOD & Coordinator Certified Badge</span>
        </div>
        <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 flex items-center space-x-2 text-gray-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Ready for LinkedIn & Resume Portfolios</span>
        </div>
      </div>
    </div>
  );
};

