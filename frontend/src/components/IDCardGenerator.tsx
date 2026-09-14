import React, { useRef, useEffect, useState } from 'react';
import { Download, CheckCircle2, Award, ShieldCheck } from 'lucide-react';
import { triggerDownload } from '../utils/mobileDownload';

interface IDCardGeneratorProps {
  studentName: string;
  regNo: string;
  deptName: string;
  yearLevel: string;
  totalSolved: number;
  collegeRank?: number;
  streakCount?: number;
  leetcodeUsername?: string;
  contestRating?: number;
}

export const IDCardGenerator: React.FC<IDCardGeneratorProps> = ({
  studentName,
  regNo,
  deptName,
  yearLevel,
  totalSolved,
  collegeRank = 1,
  streakCount = 0,
  leetcodeUsername,
  contestRating
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const logoImageRef = useRef<HTMLImageElement | null>(null);
  const [logoLoaded, setLogoLoaded] = useState(false);

  useEffect(() => {
    const img = new Image();
    img.src = '/nandha_emblem.png';
    img.onload = () => {
      logoImageRef.current = img;
      setLogoLoaded(true);
    };
    img.onerror = () => {
      const fallbackImg = new Image();
      fallbackImg.src = '/nec_25_logo.png';
      fallbackImg.onload = () => {
        logoImageRef.current = fallbackImg;
        setLogoLoaded(true);
      };
    };
  }, []);

  const drawCardOnCanvas = (canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Ultra-HD 4K Resolution: 3840 x 2160 Landscape Ratio
    const W = 3840;
    const H = 2160;
    canvas.width = W;
    canvas.height = H;

    ctx.clearRect(0, 0, W, H);

    // 1. Background Fill: Clean Light Institutional Aesthetic
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, W, H);

    // Light neutral inner canvas background
    const pad = 48;
    const innerW = W - pad * 2;
    const innerH = H - pad * 2;

    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(pad, pad, innerW, innerH);

    // 2. Institutional Border Frame
    ctx.strokeStyle = '#1B365D'; // Deep Navy
    ctx.lineWidth = 8;
    ctx.strokeRect(pad, pad, innerW, innerH);

    ctx.strokeStyle = '#D4AF37'; // Institutional Gold
    ctx.lineWidth = 3;
    ctx.strokeRect(pad + 12, pad + 12, innerW - 24, innerH - 24);

    // 3. HEADER SECTION (Navy Banner)
    const headerH = 260;
    const headerY = pad + 16;
    const headerW = innerW - 32;
    const headerX = pad + 16;

    const navGrad = ctx.createLinearGradient(headerX, headerY, headerX + headerW, headerY);
    navGrad.addColorStop(0, '#0F172A');
    navGrad.addColorStop(0.5, '#1B365D');
    navGrad.addColorStop(1, '#0F172A');

    ctx.fillStyle = navGrad;
    ctx.fillRect(headerX, headerY, headerW, headerH);

    // Gold Accent Stripe at bottom of Header
    ctx.fillStyle = '#D4AF37';
    ctx.fillRect(headerX, headerY + headerH - 8, headerW, 8);

    // Draw Official Logo on Left Header
    const logoSize = 190;
    const logoX = headerX + 50;
    const logoY = headerY + (headerH - logoSize) / 2 - 4;

    if (logoImageRef.current) {
      ctx.drawImage(logoImageRef.current, logoX, logoY, logoSize, logoSize);
    } else {
      // Fallback logo circle graphics
      ctx.save();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#D4AF37';
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.fillStyle = '#1B365D';
      ctx.font = '900 48px "Times New Roman", serif';
      ctx.fillText('NEC', logoX + logoSize / 2, logoY + logoSize / 2 + 16);
      ctx.restore();
    }

    // Header Text (Left Aligned next to Logo)
    const textLeft = logoX + logoSize + 50;
    ctx.textAlign = 'left';

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 58px "Inter", "Arial", sans-serif';
    ctx.fillText('NANDHA ENGINEERING COLLEGE (AUTONOMOUS)', textLeft, headerY + 95);

    ctx.fillStyle = '#E2E8F0';
    ctx.font = '700 36px "Inter", "Arial", sans-serif';
    ctx.fillText('INDIVIDUAL STUDENT PERFORMANCE PASS', textLeft, headerY + 155);

    ctx.fillStyle = '#D4AF37';
    ctx.font = '900 24px "Courier New", monospace';
    ctx.fillText('OFFICIAL LEETCODE INTELLIGENCE PLATFORM • ACADEMIC CREDENTIAL', textLeft, headerY + 200);

    // 4. MAIN CONTENT AREA (Y: 350 -> 1720)
    // LEFT COLUMN: STUDENT IDENTITY CARD (X: 80 -> 1880)
    const colY = pad + headerH + 40;
    const leftX = pad + 32;
    const leftW = 1780;
    const colH = 1140;

    // Student Card Container
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(leftX, colY, leftW, colH);
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 3;
    ctx.strokeRect(leftX, colY, leftW, colH);

    // Header Stripe for Identity Card
    ctx.fillStyle = '#F1F5F9';
    ctx.fillRect(leftX, colY, leftW, 70);
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 2;
    ctx.strokeRect(leftX, colY, leftW, 70);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#1B365D';
    ctx.font = '900 26px "Inter", sans-serif';
    ctx.fillText('STUDENT IDENTIFICATION & ACADEMIC PROFILE', leftX + 30, colY + 45);

    // Avatar Circle
    const avatarX = leftX + 110;
    const avatarY = colY + 200;
    const avatarR = 85;

    ctx.fillStyle = '#1B365D';
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarR, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#D4AF37';
    ctx.lineWidth = 5;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 80px "Inter", sans-serif';
    const initial = (studentName || 'S').trim().charAt(0).toUpperCase();
    ctx.fillText(initial, avatarX, avatarY + 28);

    // Student Name (Dynamic Font Size)
    ctx.textAlign = 'left';
    const nameX = avatarX + avatarR + 45;
    const displayName = (studentName || 'STUDENT NAME').toUpperCase();

    ctx.fillStyle = '#64748B';
    ctx.font = '900 22px "Inter", sans-serif';
    ctx.fillText('STUDENT NAME', nameX, colY + 140);

    ctx.fillStyle = '#0F172A';
    if (displayName.length > 25) {
      ctx.font = '900 40px "Inter", sans-serif';
    } else if (displayName.length > 18) {
      ctx.font = '900 48px "Inter", sans-serif';
    } else {
      ctx.font = '900 58px "Inter", sans-serif';
    }
    ctx.fillText(displayName, nameX, colY + 198);

    // Handle Badge
    const handle = leetcodeUsername ? `@${leetcodeUsername.replace(/^@/, '')}` : `@${regNo.toLowerCase()}`;
    ctx.fillStyle = '#1E3A8A';
    ctx.font = '700 28px "Courier New", monospace';
    ctx.fillText(handle, nameX, colY + 242);

    // Identity Grid Fields (2x2 Grid)
    const gridY = colY + 310;
    const gridW = leftW - 60;

    // Field 1: Register Number
    const box1X = leftX + 30;
    const box1W = (gridW - 30) / 2;
    const boxH = 140;

    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(box1X, gridY, box1W, boxH);
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 2;
    ctx.strokeRect(box1X, gridY, box1W, boxH);

    ctx.fillStyle = '#64748B';
    ctx.font = '900 20px "Inter", sans-serif';
    ctx.fillText('REGISTER NUMBER', box1X + 24, gridY + 42);

    ctx.fillStyle = '#1B365D';
    ctx.font = '900 40px "Courier New", monospace';
    ctx.fillText(regNo || '—', box1X + 24, gridY + 98);

    // Field 2: Department
    const box2X = box1X + box1W + 30;
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(box2X, gridY, box1W, boxH);
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 2;
    ctx.strokeRect(box2X, gridY, box1W, boxH);

    ctx.fillStyle = '#64748B';
    ctx.font = '900 20px "Inter", sans-serif';
    ctx.fillText('DEPARTMENT', box2X + 24, gridY + 42);

    ctx.fillStyle = '#0F172A';
    const deptStr = deptName || 'Department';
    if (deptStr.length > 28) {
      ctx.font = '900 26px "Inter", sans-serif';
    } else {
      ctx.font = '900 32px "Inter", sans-serif';
    }
    ctx.fillText(deptStr, box2X + 24, gridY + 98);

    // Field 3: Academic Year
    const gridY2 = gridY + boxH + 20;
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(box1X, gridY2, box1W, boxH);
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 2;
    ctx.strokeRect(box1X, gridY2, box1W, boxH);

    ctx.fillStyle = '#64748B';
    ctx.font = '900 20px "Inter", sans-serif';
    ctx.fillText('ACADEMIC YEAR', box1X + 24, gridY2 + 42);

    const cleanYear = String(yearLevel || 'III').replace(/\s*Yr\s*/gi, '').replace(/\s*Year\s*/gi, '').trim();
    ctx.fillStyle = '#0F172A';
    ctx.font = '900 32px "Inter", sans-serif';
    ctx.fillText(`Year ${cleanYear} (2023–2027)`, box1X + 24, gridY2 + 98);

    // Field 4: Audit Status
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(box2X, gridY2, box1W, boxH);
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 2;
    ctx.strokeRect(box2X, gridY2, box1W, boxH);

    ctx.fillStyle = '#64748B';
    ctx.font = '900 20px "Inter", sans-serif';
    ctx.fillText('VERIFICATION STATUS', box2X + 24, gridY2 + 42);

    ctx.fillStyle = '#059669';
    ctx.font = '900 32px "Inter", sans-serif';
    ctx.fillText('✓ VERIFIED STUDENT RECORD', box2X + 24, gridY2 + 98);

    // Pass Credential ID Strip
    const stripY = gridY2 + boxH + 24;
    const stripW = gridW;
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(box1X, stripY, stripW, 95);

    ctx.fillStyle = '#D4AF37';
    ctx.font = '900 24px "Courier New", monospace';
    ctx.fillText(`CREDENTIAL PASS ID: NEC-PASS-2026-${regNo || 'RECORD'}`, box1X + 30, stripY + 58);

    // RIGHT COLUMN: PERFORMANCE DASHBOARD (X: 1940 -> 3740)
    const rightX = leftX + leftW + 40;
    const rightW = innerW - leftW - 96;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(rightX, colY, rightW, colH);
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 3;
    ctx.strokeRect(rightX, colY, rightW, colH);

    // Header Stripe for Dashboard
    ctx.fillStyle = '#F1F5F9';
    ctx.fillRect(rightX, colY, rightW, 70);
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 2;
    ctx.strokeRect(rightX, colY, rightW, 70);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#1B365D';
    ctx.font = '900 26px "Inter", sans-serif';
    ctx.fillText('INSTITUTIONAL PERFORMANCE METRICS & STANDING', rightX + 30, colY + 45);

    // 4 KPI Cards in unified institutional style (2x2 Grid)
    const kpiGridY = colY + 100;
    const kpiCardW = (rightW - 70) / 2;
    const kpiCardH = 480;

    const drawKpiCard = (cx: number, cy: number, label: string, value: string, sub: string, valueColor: string = '#1B365D') => {
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(cx, cy, kpiCardW, kpiCardH);
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 2;
      ctx.strokeRect(cx, cy, kpiCardW, kpiCardH);

      // Card Header Tag
      ctx.fillStyle = '#1B365D';
      ctx.fillRect(cx, cy, kpiCardW, 55);

      ctx.textAlign = 'center';
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 22px "Inter", sans-serif';
      ctx.fillText(label, cx + kpiCardW / 2, cy + 36);

      // Large Value
      ctx.fillStyle = valueColor;
      ctx.font = '900 96px "Inter", sans-serif';
      ctx.fillText(value, cx + kpiCardW / 2, cy + 270);

      // Subtitle
      ctx.fillStyle = '#64748B';
      ctx.font = '700 22px "Inter", sans-serif';
      ctx.fillText(sub, cx + kpiCardW / 2, cy + 400);
    };

    // Card 1: College Rank
    drawKpiCard(
      rightX + 24,
      kpiGridY,
      'COLLEGE RANK',
      `#${collegeRank}`,
      'Current institutional standing',
      '#D4AF37'
    );

    // Card 2: Problems Solved
    drawKpiCard(
      rightX + 24 + kpiCardW + 22,
      kpiGridY,
      'PROBLEMS SOLVED',
      `${totalSolved}`,
      'Verified LeetCode solves',
      '#1B365D'
    );

    // Card 3: Active Streak
    drawKpiCard(
      rightX + 24,
      kpiGridY + kpiCardH + 20,
      'ACTIVE STREAK',
      `${streakCount} Days`,
      'Continuous practice streak',
      '#0F172A'
    );

    // Card 4: Contest Rating
    const rVal = contestRating && contestRating > 0 ? Math.round(contestRating).toString() : 'OFFICIAL';
    drawKpiCard(
      rightX + 24 + kpiCardW + 22,
      kpiGridY + kpiCardH + 20,
      'CONTEST RATING',
      rVal,
      'Weekly contest standing',
      '#1E3A8A'
    );

    // 5. AUTHORIZATION & QR FOOTER BAR (Y: 1540 -> 2040)
    const authY = colY + colH + 24;
    const authW = innerW - 32;
    const authH = 340;
    const authX = pad + 16;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(authX, authY, authW, authH);
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 3;
    ctx.strokeRect(authX, authY, authW, authH);

    // Left Signature: Principal
    const sigW = 920;
    const sig1X = authX + 80;
    const sigYLine = authY + 180;

    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sig1X, sigYLine);
    ctx.lineTo(sig1X + sigW, sigYLine);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#1B365D';
    ctx.font = 'italic 900 34px "Georgia", serif';
    ctx.fillText('Digitally Verified by Principal', sig1X + sigW / 2, sigYLine - 24);

    ctx.fillStyle = '#0F172A';
    ctx.font = '900 24px "Inter", sans-serif';
    ctx.fillText('PRINCIPAL', sig1X + sigW / 2, sigYLine + 38);

    ctx.fillStyle = '#64748B';
    ctx.font = '700 18px "Inter", sans-serif';
    ctx.fillText('NANDHA ENGINEERING COLLEGE (AUTONOMOUS)', sig1X + sigW / 2, sigYLine + 72);

    // Center QR Verification Box
    const qrS = 210;
    const qrX = authX + authW / 2 - qrS / 2;
    const qrY = authY + 30;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(qrX, qrY, qrS, qrS);
    ctx.strokeStyle = '#1B365D';
    ctx.lineWidth = 3;
    ctx.strokeRect(qrX, qrY, qrS, qrS);

    // Simulated QR pattern
    ctx.fillStyle = '#0F172A';
    const drawQRFinder = (fx: number, fy: number) => {
      ctx.fillRect(fx, fy, 46, 46);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(fx + 7, fy + 7, 32, 32);
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(fx + 14, fy + 14, 18, 18);
    };
    drawQRFinder(qrX + 12, qrY + 12);
    drawQRFinder(qrX + qrS - 58, qrY + 12);
    drawQRFinder(qrX + 12, qrY + qrS - 58);

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if ((r + c) % 2 === 0 && !(r < 3 && c < 3) && !(r < 3 && c > 4) && !(r > 4 && c < 3)) {
          ctx.fillRect(qrX + 64 + c * 14, qrY + 64 + r * 14, 9, 9);
        }
      }
    }

    ctx.fillStyle = '#1B365D';
    ctx.font = '900 18px "Courier New", monospace';
    ctx.fillText('SCAN TO VERIFY', authX + authW / 2, qrY + qrS + 28);

    // Right Signature: HOD
    const sig2X = authX + authW - 80 - sigW;
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sig2X, sigYLine);
    ctx.lineTo(sig2X + sigW, sigYLine);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#1B365D';
    ctx.font = 'italic 900 34px "Georgia", serif';
    ctx.fillText('Authorized by HOD / Coordinator', sig2X + sigW / 2, sigYLine - 24);

    ctx.fillStyle = '#0F172A';
    ctx.font = '900 24px "Inter", sans-serif';
    ctx.fillText('HEAD OF THE DEPARTMENT', sig2X + sigW / 2, sigYLine + 38);

    ctx.fillStyle = '#64748B';
    ctx.font = '700 18px "Inter", sans-serif';
    ctx.fillText('DEPARTMENT ACADEMIC CELL', sig2X + sigW / 2, sigYLine + 72);

    // Footer Motto (Bottom)
    ctx.fillStyle = '#1B365D';
    ctx.font = '900 22px "Inter", sans-serif';
    ctx.fillText('NANDHA ENGINEERING COLLEGE (AUTONOMOUS)  •  LEARN  |  SERVE  |  SUCCEED', authX + authW / 2, authY + authH - 20);
  };

  useEffect(() => {
    const renderCanvas = () => {
      if (canvasRef.current) {
        drawCardOnCanvas(canvasRef.current);
      }
    };

    renderCanvas();
    const t1 = setTimeout(renderCanvas, 100);
    const t2 = setTimeout(renderCanvas, 400);

    if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
      document.fonts.ready.then(renderCanvas).catch(() => {});
    }

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [studentName, regNo, deptName, yearLevel, totalSolved, collegeRank, streakCount, leetcodeUsername, contestRating, logoLoaded]);

  const [isGenerating, setIsGenerating] = useState(false);

  const generateAndDownloadPass = () => {
    if (isGenerating) return;
    setIsGenerating(true);
    const canvas = canvasRef.current;
    if (!canvas) {
      setIsGenerating(false);
      return;
    }
    drawCardOnCanvas(canvas);

    // Quality JPG export at maximum 1.0 compression quality
    canvas.toBlob((blob) => {
      if (blob) {
        const cleanReg = (regNo || 'download').replace(/[^A-Za-z0-9_-]+/g, '_');
        const filename = `Nandha_Executive_Student_Pass_${cleanReg}.jpg`;
        triggerDownload(blob, filename, 'image/jpeg');
      } else {
        const link = document.createElement('a');
        link.download = `Nandha_Executive_Student_Pass_${regNo || 'download'}.jpg`;
        link.href = canvas.toDataURL('image/jpeg', 1.0);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      setTimeout(() => setIsGenerating(false), 1500);
    }, 'image/jpeg', 1.0);
  };

  return (
    <div className="bg-white dark:bg-navy-900 p-6 md:p-8 rounded-3xl border border-slate-200 dark:border-navy-700 shadow-md space-y-6">
      
      {/* Top Bar */}
      <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="space-y-1">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-navy-50 dark:bg-navy-800/80 text-navy-900 dark:text-navy-100 text-[11px] font-black uppercase tracking-wider border border-navy-200 dark:border-navy-700 shadow-xs">
            <ShieldCheck className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
            <span>OFFICIAL AUTONOMOUS DIGITAL VERIFICATION CREDENTIAL</span>
          </div>
          <h3 className="font-black text-xl text-slate-900 dark:text-white tracking-tight flex items-center space-x-2">
            <span>Executive Digital Student Pass</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">
            Ultra-HD Certified Pass with Dual Institutional Signatures (Principal & HOD).
          </p>
        </div>

        <button
          onClick={generateAndDownloadPass}
          disabled={isGenerating}
          className="flex items-center space-x-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-black shadow-lg shadow-brand-500/25 transition-transform transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>{isGenerating ? 'Downloading...' : 'Download Ultra-HD Pass (.PNG / .JPG)'}</span>
        </button>
      </div>

      {/* Live Rendered Canvas Preview */}
      <div className="flex justify-center p-3 rounded-2xl bg-slate-100 dark:bg-navy-950 border border-slate-200 dark:border-navy-800 shadow-inner overflow-x-auto">
        <canvas
          ref={canvasRef}
          className="rounded-2xl shadow-xl max-w-full h-auto border border-slate-300 dark:border-navy-700"
          style={{ width: '100%', maxWidth: '820px' }}
        />
      </div>

      {/* Verification Footer Notes */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 flex items-center space-x-2 text-slate-700 dark:text-slate-200 font-extrabold shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>Principal Digital Authorization Included</span>
        </div>
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 flex items-center space-x-2 text-slate-700 dark:text-slate-200 font-extrabold shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>HOD & Coordinator Certified Badge</span>
        </div>
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 flex items-center space-x-2 text-slate-700 dark:text-slate-200 font-extrabold shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>Ready for LinkedIn & Resume Portfolios</span>
        </div>
      </div>
    </div>
  );
};
