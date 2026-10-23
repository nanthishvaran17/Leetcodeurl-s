import React, { useRef, useState, useEffect } from 'react';
import { 
  X, 
  Share2, 
  Copy, 
  Check, 
  Trophy, 
  Award,
  Calendar,
  Target,
  Download,
  Smartphone,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { Share } from '@capacitor/share';
import { StudentData } from './LeaderboardTable';
import { triggerDownload } from '../utils/mobileDownload';

interface StudentShareCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  student?: StudentData | any;
}

export const StudentShareCardModal: React.FC<StudentShareCardModalProps> = ({
  isOpen,
  onClose,
  student
}) => {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [sharing, setSharing] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !student) return null;

  const easy = Number(student.easy_solved) || 0;
  const medium = Number(student.medium_solved) || 0;
  const hard = Number(student.hard_solved) || 0;
  const calculatedSolved = easy + medium + hard;
  const totalSolved = Number(student.total_solved) || (calculatedSolved > 0 ? calculatedSolved : 0);

  const rawRank = student.college_rank ?? student.rank ?? student.dept_rank;
  const rankDisplay = (rawRank !== undefined && rawRank !== null && rawRank !== '' && !isNaN(Number(rawRank))) 
    ? `#${rawRank}` 
    : 'Unranked';

  const rawStreak = student.streak_count ?? student.current_streak;
  const streak = (rawStreak !== undefined && rawStreak !== null && !isNaN(Number(rawStreak))) 
    ? Number(rawStreak) 
    : 0;

  const rawRating = student.stats?.contest_rating ?? student.contest_rating;
  const contestRating = (rawRating !== undefined && rawRating !== null && !isNaN(Number(rawRating))) 
    ? Math.round(Number(rawRating)) 
    : 'Unrated';

  const deptName = typeof student.department === 'object' 
    ? (student.department?.code || student.department?.name || 'CSE') 
    : (student.department || 'CSE');

  const regNo = student.reg_no || student.username || 'Student';
  const cleanReg = regNo.replace(/[^A-Za-z0-9_-]+/g, '_');

  const shareText = `Nandha LeetCode Intelligence — Student Achievement Pass\nStudent: ${student.name || 'Student'} (${deptName} • ${regNo})\nCollege Rank: ${rankDisplay} | Rating: ${contestRating}\nTotal Solved: ${totalSolved} Problems (Easy: ${easy} | Medium: ${medium} | Hard: ${hard})\nActive Streak: ${streak} Days Active\n\nOfficial Verified Pass • Nandha Engineering College Autonomous (25 Years)`;

  // High-Resolution 2D Canvas Generator for Gallery Download
  const generateCardBlob = async (): Promise<Blob | null> => {
    const width = 900;
    const height = 1120;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // 1. Deep Midnight Gradient Background
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, '#090d16');
    bgGrad.addColorStop(0.5, '#0b1329');
    bgGrad.addColorStop(1, '#111827');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Ambient Glowing Orbs
    const orb1 = ctx.createRadialGradient(800, 100, 10, 800, 100, 350);
    orb1.addColorStop(0, 'rgba(59, 130, 246, 0.25)');
    orb1.addColorStop(1, 'rgba(59, 130, 246, 0)');
    ctx.fillStyle = orb1;
    ctx.fillRect(0, 0, width, height);

    const orb2 = ctx.createRadialGradient(100, 950, 10, 100, 950, 320);
    orb2.addColorStop(0, 'rgba(245, 158, 11, 0.20)');
    orb2.addColorStop(1, 'rgba(245, 158, 11, 0)');
    ctx.fillStyle = orb2;
    ctx.fillRect(0, 0, width, height);

    // 3. Card Outer Border with Glass Glow
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 3;
    ctx.strokeRect(30, 30, width - 60, height - 60);

    // 4. Header Badge: Nandha Engineering College Autonomous
    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
    ctx.letterSpacing = '1.5px';
    ctx.fillText('NANDHA ENGINEERING COLLEGE (AUTONOMOUS)', 60, 85);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 16px system-ui, -apple-system, sans-serif';
    ctx.fillText('25 YEARS OF EXCELLENCE • LEETCODE INTELLIGENCE', 60, 115);

    // Separator line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(60, 140);
    ctx.lineTo(width - 60, 140);
    ctx.stroke();

    // 5. Student Info Section
    // Avatar Circle
    const avatarX = 115;
    const avatarY = 220;
    const avatarRadius = 55;
    const avatarGrad = ctx.createLinearGradient(60, 165, 170, 275);
    avatarGrad.addColorStop(0, '#3b82f6');
    avatarGrad.addColorStop(1, '#6366f1');
    ctx.fillStyle = avatarGrad;
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Initials
    const initials = (student.name || 'ST')
      .split(' ')
      .map((w: string) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 38px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initials, avatarX, avatarY);

    // Reset text alignment
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    // Student Name
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 36px system-ui, -apple-system, sans-serif';
    const cleanName = student.name || 'Student';
    ctx.fillText(cleanName.length > 22 ? cleanName.slice(0, 20) + '...' : cleanName, 195, 205);

    // Reg No & Department
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 20px monospace, monospace';
    ctx.fillText(regNo, 195, 235);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '600 18px system-ui, -apple-system, sans-serif';
    ctx.fillText(`${deptName} • Year ${student.year_level || 'II'}`, 195, 262);

    // College Rank Badge (Top Right)
    const rankBadgeWidth = 170;
    const rankBadgeHeight = 54;
    const rankBadgeX = width - 60 - rankBadgeWidth;
    const rankBadgeY = 195;

    ctx.fillStyle = 'rgba(245, 158, 11, 0.18)';
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(rankBadgeX, rankBadgeY, rankBadgeWidth, rankBadgeHeight, 16);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fbbf24';
    ctx.font = '900 24px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`RANK ${rankDisplay}`, rankBadgeX + rankBadgeWidth / 2, rankBadgeY + 36);
    ctx.textAlign = 'left';

    // 6. Huge Problems Solved Showcase Box
    const showcaseY = 320;
    const showcaseH = 210;
    const boxGrad = ctx.createLinearGradient(60, showcaseY, width - 60, showcaseY + showcaseH);
    boxGrad.addColorStop(0, 'rgba(255, 255, 255, 0.05)');
    boxGrad.addColorStop(1, 'rgba(255, 255, 255, 0.02)');
    ctx.fillStyle = boxGrad;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(60, showcaseY, width - 120, showcaseH, 24);
    ctx.fill();
    ctx.stroke();

    // Showcase Title
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 16px system-ui, -apple-system, sans-serif';
    ctx.letterSpacing = '1px';
    ctx.fillText('TOTAL PROBLEMS SOLVED', 95, showcaseY + 50);

    // Giant Solved Number
    ctx.fillStyle = '#34d399';
    ctx.font = '900 88px system-ui, -apple-system, sans-serif';
    ctx.fillText(String(totalSolved), 95, showcaseY + 145);

    // Streak Count
    const streakX = width - 260;
    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 36px system-ui, -apple-system, sans-serif';
    ctx.fillText(`${streak} Days`, streakX, showcaseY + 95);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 15px system-ui, -apple-system, sans-serif';
    ctx.fillText('Active Streak', streakX, showcaseY + 125);

    // 7. Difficulty Grid (3 Equal Columns)
    const diffY = 560;
    const diffH = 145;
    const colW = (width - 120 - 40) / 3;

    // Easy Col
    ctx.fillStyle = 'rgba(16, 185, 129, 0.12)';
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.35)';
    ctx.beginPath();
    ctx.roundRect(60, diffY, colW, diffH, 18);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#34d399';
    ctx.font = 'bold 16px system-ui, -apple-system, sans-serif';
    ctx.fillText('EASY SOLVED', 85, diffY + 45);
    ctx.font = '900 48px system-ui, -apple-system, sans-serif';
    ctx.fillText(String(easy), 85, diffY + 105);

    // Medium Col
    const medX = 60 + colW + 20;
    ctx.fillStyle = 'rgba(245, 158, 11, 0.12)';
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.35)';
    ctx.beginPath();
    ctx.roundRect(medX, diffY, colW, diffH, 18);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 16px system-ui, -apple-system, sans-serif';
    ctx.fillText('MEDIUM SOLVED', medX + 25, diffY + 45);
    ctx.font = '900 48px system-ui, -apple-system, sans-serif';
    ctx.fillText(String(medium), medX + 25, diffY + 105);

    // Hard Col
    const hardX = medX + colW + 20;
    ctx.fillStyle = 'rgba(244, 63, 94, 0.12)';
    ctx.strokeStyle = 'rgba(244, 63, 94, 0.35)';
    ctx.beginPath();
    ctx.roundRect(hardX, diffY, colW, diffH, 18);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fb7185';
    ctx.font = 'bold 16px system-ui, -apple-system, sans-serif';
    ctx.fillText('HARD SOLVED', hardX + 25, diffY + 45);
    ctx.font = '900 48px system-ui, -apple-system, sans-serif';
    ctx.fillText(String(hard), hardX + 25, diffY + 105);

    // 8. Contest Rating & LeetCode Handle Bar
    const contestBarY = 735;
    const contestBarH = 90;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.roundRect(60, contestBarY, width - 120, contestBarH, 18);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
    ctx.fillText(`Contest Rating: ${contestRating}`, 95, contestBarY + 54);

    if (student.username) {
      ctx.fillStyle = '#a855f7';
      ctx.font = 'bold 20px monospace, monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`@${student.username}`, width - 95, contestBarY + 54);
      ctx.textAlign = 'left';
    }

    // 9. Watermark Footer
    const footerY = 875;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.moveTo(60, footerY);
    ctx.lineTo(width - 60, footerY);
    ctx.stroke();

    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 18px system-ui, -apple-system, sans-serif';
    ctx.fillText('✓ VERIFIED STUDENT PROFILE • OFFICIAL CAMPUS CREDENTIAL', 60, footerY + 45);

    ctx.fillStyle = '#64748b';
    ctx.font = '500 15px system-ui, -apple-system, sans-serif';
    const dateStr = new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    ctx.fillText(`Issued: ${dateStr} • Nandha Engineering College, Erode`, 60, footerY + 75);

    return new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/png', 1.0);
    });
  };

  // 1-Tap Gallery Download Function
  const handleDownloadGallery = async () => {
    setDownloading(true);
    try {
      const blob = await generateCardBlob();
      if (!blob) throw new Error('Canvas rendering failed');

      const filename = `Nandha_LeetCode_Pass_${cleanReg}.png`;
      await triggerDownload(blob, filename, 'image/png');

      setDownloaded(true);
      setTimeout(() => setDownloaded(false), 3000);
    } catch (err) {
      console.error('Gallery Download failed:', err);
    } finally {
      setDownloading(false);
    }
  };

  // 1-Tap WhatsApp Status Share
  const handleWhatsAppShare = async () => {
    setSharing(true);
    try {
      // First attempt native image share if supported
      const blob = await generateCardBlob();
      if (blob && typeof navigator !== 'undefined' && navigator.canShare) {
        const file = new File([blob], `LeetCode_${cleanReg}.png`, { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: `${student.name || 'Student'} LeetCode Achievement Card`,
            text: shareText
          });
          setSharing(false);
          return;
        }
      }
    } catch (_e) {}

    // Fallback: Direct WhatsApp URL scheme
    try {
      const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
      window.open(whatsappUrl, '_blank');
    } catch (_e) {}

    setSharing(false);
  };

  // Handle Native Share functionality
  const handleShare = async () => {
    setSharing(true);
    try {
      const canNativeShare = await Share.canShare();
      if (canNativeShare.value) {
        await Share.share({
          title: `${student.name || 'Student'} LeetCode Achievements`,
          text: shareText,
          dialogTitle: 'Share Achievement Card',
        });
        setSharing(false);
        return;
      }
    } catch (_e) {}

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `${student.name || 'Student'} LeetCode Achievements`,
          text: shareText,
        });
      } catch (_e) {}
    } else {
      await handleCopy();
    }
    setSharing(false);
  };

  // Handle Direct Copy functionality
  const handleCopy = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareText);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = shareText;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (_e) {}
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-sm sm:max-w-md bg-white dark:bg-navy-900 rounded-3xl shadow-2xl border border-slate-200/80 dark:border-navy-800 overflow-hidden flex flex-col max-h-[95vh]">
        {/* Header bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-navy-800">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-500" />
            <span className="font-extrabold text-slate-900 dark:text-white text-base">
              25 Years Student Pass
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-navy-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dynamic Mobile Rank Card Preview */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3 custom-scrollbar">
          <div 
            ref={cardRef}
            className="relative rounded-2xl p-5 sm:p-6 bg-gradient-to-br from-slate-950 via-navy-950 to-blue-950 text-white shadow-2xl overflow-hidden border border-blue-500/30 space-y-4"
          >
            {/* Background Glow Accents */}
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-blue-500/20 rounded-full blur-2xl pointer-events-none"></div>
            <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-amber-500/20 rounded-full blur-2xl pointer-events-none"></div>

            {/* Top User Header */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold text-amber-400 tracking-wider uppercase block">
                  NEC 25 YEARS • AUTONOMOUS
                </span>
                <h3 className="text-lg sm:text-xl font-black text-white tracking-tight mt-0.5 truncate">
                  {student.name || 'Student'}
                </h3>
                <p className="text-xs text-slate-400 font-mono truncate">
                  {regNo} • {deptName}
                </p>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 font-black text-xs shrink-0 shadow-xs">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                <span>{rankDisplay}</span>
              </div>
            </div>

            {/* Total Solved Main Display */}
            <div className="bg-white/5 backdrop-blur-md rounded-xl p-3.5 sm:p-4 border border-white/10 flex items-center justify-between">
              <div>
                <p className="text-[11px] text-slate-300 font-medium">Total Problems Solved</p>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-amber-300">
                    {totalSolved}
                  </span>
                  <span className="text-xs text-slate-400">Solved</span>
                </div>
              </div>
              <div className="flex flex-col items-end">
                <div className="flex items-center gap-1 text-amber-400 font-bold text-sm">
                  <Calendar className="w-4 h-4 text-amber-400" />
                  {streak} Days
                </div>
                <span className="text-[10px] text-slate-400">Active Streak</span>
              </div>
            </div>

            {/* Difficulty Breakdown Grid */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <span className="text-[10px] font-semibold text-emerald-400 block uppercase">Easy</span>
                <span className="text-base font-bold text-emerald-300">{easy}</span>
              </div>
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <span className="text-[10px] font-semibold text-amber-400 block uppercase">Medium</span>
                <span className="text-base font-bold text-amber-300">{medium}</span>
              </div>
              <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <span className="text-[10px] font-semibold text-rose-400 block uppercase">Hard</span>
                <span className="text-base font-bold text-rose-300">{hard}</span>
              </div>
            </div>

            {/* Rating / Badge Footer */}
            <div className="pt-2 flex items-center justify-between border-t border-white/10 text-xs text-slate-400">
              <div className="flex items-center gap-1.5">
                <Target className="w-4 h-4 text-amber-400" />
                <span>Rating: <strong className="text-white">{contestRating}</strong></span>
              </div>
              <div className="flex items-center gap-1 text-emerald-400 font-medium text-[11px]">
                <Award className="w-3.5 h-3.5" /> Verified Pass
              </div>
            </div>
          </div>

          {/* Quick Notice */}
          <p className="text-[11px] text-center text-slate-400 dark:text-slate-500">
            Tap below to save this high-resolution badge to your phone or share directly on WhatsApp Status.
          </p>
        </div>

        {/* Action Buttons Footer */}
        <div className="p-3.5 sm:p-4 bg-slate-50 dark:bg-navy-950 border-t border-slate-100 dark:border-navy-800 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            {/* 1-Tap Gallery Download Button */}
            <button
              onClick={handleDownloadGallery}
              disabled={downloading}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white font-extrabold text-xs transition-all shadow-md shadow-emerald-600/25 cursor-pointer touch-manipulation select-none"
            >
              {downloaded ? <Check className="w-4 h-4 text-white" /> : <Download className="w-4 h-4" />}
              <span>{downloading ? 'Rendering...' : downloaded ? 'Saved to Gallery!' : 'Save to Gallery'}</span>
            </button>

            {/* WhatsApp Share Button */}
            <button
              onClick={handleWhatsAppShare}
              disabled={sharing}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-500 via-green-600 to-emerald-700 hover:opacity-90 active:scale-95 text-white font-extrabold text-xs transition-all shadow-md shadow-emerald-500/25 cursor-pointer touch-manipulation select-none"
            >
              <Share2 className="w-4 h-4" />
              <span>WhatsApp Status</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Native Full Share Button */}
            <button
              onClick={handleShare}
              disabled={sharing}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-200 dark:bg-navy-800 hover:bg-slate-300 dark:hover:bg-navy-700 text-slate-700 dark:text-slate-200 font-bold text-xs active:scale-95 transition-all cursor-pointer border border-slate-300/60 dark:border-navy-700 select-none"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>More Share Options</span>
            </button>
            
            {/* Copy Text Button */}
            <button
              onClick={handleCopy}
              className="flex items-center justify-center w-10 h-8 rounded-xl bg-slate-200 dark:bg-navy-800 hover:bg-slate-300 dark:hover:bg-navy-700 text-slate-700 dark:text-slate-200 font-medium active:scale-95 transition-all cursor-pointer border border-slate-300/60 dark:border-navy-700 shrink-0"
              title="Copy Stats Text"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
