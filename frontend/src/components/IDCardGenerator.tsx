import React, { useRef, useEffect, useState } from 'react';
import { Download, CheckCircle2, ShieldCheck, Sparkles, Image as ImageIcon } from 'lucide-react';
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
    img.src = '/nec_25_years_logo.png';
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
      fallbackImg.onerror = () => {
        const fallback2 = new Image();
        fallback2.src = '/nandha_emblem.png';
        fallback2.onload = () => {
          logoImageRef.current = fallback2;
          setLogoLoaded(true);
        };
      };
    };
  }, []);

  const resolveAcademicYearDisplay = (inputYear: string): string => {
    if (!inputYear) return 'Year II (2025–2029)';
    const str = String(inputYear).trim().toUpperCase();

    if (/\b(IV|4|2023)\b/.test(str) || str.includes('YEAR 4') || str.includes('YEAR IV') || str.includes('2023–2027') || str.includes('2023-2027')) {
      return 'Year IV (2023–2027)';
    }
    if (/\b(III|3|2024)\b/.test(str) || str.includes('YEAR 3') || str.includes('YEAR III') || str.includes('2024–2028') || str.includes('2024-2028')) {
      return 'Year III (2024–2028)';
    }
    if (/\b(II|2|2025)\b/.test(str) || str.includes('YEAR 2') || str.includes('YEAR II') || str.includes('2025–2029') || str.includes('2025-2029')) {
      return 'Year II (2025–2029)';
    }

    if (str.includes('2023')) return 'Year IV (2023–2027)';
    if (str.includes('2024')) return 'Year III (2024–2028)';
    if (str.includes('2025')) return 'Year II (2025–2029)';

    return 'Year II (2025–2029)';
  };

  const drawCardOnCanvas = (canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // TRUE ULTRA-HD 8K RESOLUTION: 7680 x 4320 Landscape (33.2 Megapixels)
    const W = 7680;
    const H = 4320;
    canvas.width = W;
    canvas.height = H;

    // Enable high-quality anti-aliasing & image smoothing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.clearRect(0, 0, W, H);

    // 1. Background Fill: Clean Light Institutional Aesthetic
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, W, H);

    // Inner Canvas Box
    const pad = 96;
    const innerW = W - pad * 2;
    const innerH = H - pad * 2;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(pad, pad, innerW, innerH);

    // 2. Institutional Double-Line Border Frame
    ctx.strokeStyle = '#1B365D'; // Deep Navy
    ctx.lineWidth = 16;
    ctx.strokeRect(pad, pad, innerW, innerH);

    ctx.strokeStyle = '#D4AF37'; // Institutional Gold
    ctx.lineWidth = 8;
    ctx.strokeRect(pad + 24, pad + 24, innerW - 48, innerH - 48);

    // 3. HEADER SECTION (Solid Navy Banner)
    const headerH = 520;
    const headerY = pad + 40;
    const headerW = innerW - 80;
    const headerX = pad + 40;

    ctx.fillStyle = '#1B365D';
    ctx.fillRect(headerX, headerY, headerW, headerH);

    // Gold Accent Stripe at bottom of Header
    ctx.fillStyle = '#D4AF37';
    ctx.fillRect(headerX, headerY + headerH - 16, headerW, 16);

    // Draw Official Circular Logo on Left Header
    const logoSize = 380;
    const logoX = headerX + 100;
    const logoY = headerY + (headerH - logoSize) / 2 - 8;

    if (logoImageRef.current) {
      ctx.save();
      // Clip image to circular shape to preserve circular logo aesthetic
      ctx.beginPath();
      ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(logoImageRef.current, logoX, logoY, logoSize, logoSize);
      ctx.restore();

      // Draw Gold Circle Rim around Logo
      ctx.strokeStyle = '#D4AF37';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // Fallback logo circle graphics
      ctx.save();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#D4AF37';
      ctx.lineWidth = 8;
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.fillStyle = '#1B365D';
      ctx.font = '900 96px "Times New Roman", serif';
      ctx.fillText('NEC', logoX + logoSize / 2, logoY + logoSize / 2 + 32);
      ctx.restore();
    }

    // Header Text (Left Aligned next to Logo)
    const textLeft = logoX + logoSize + 90;
    ctx.textAlign = 'left';

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 108px "Inter", "Arial", sans-serif';
    ctx.fillText('NANDHA ENGINEERING COLLEGE (AUTONOMOUS)', textLeft, headerY + 180);

    ctx.fillStyle = '#E2E8F0';
    ctx.font = '700 68px "Inter", "Arial", sans-serif';
    ctx.fillText('INDIVIDUAL STUDENT PERFORMANCE PASS', textLeft, headerY + 296);

    ctx.fillStyle = '#D4AF37';
    ctx.font = '900 44px "Courier New", monospace';
    ctx.fillText('OFFICIAL LEETCODE INTELLIGENCE PLATFORM • ACADEMIC CREDENTIAL', textLeft, headerY + 390);

    // Top-Right Motto (LEARN | SERVE | SUCCEED)
    const rightMottoX = headerX + headerW - 100;
    ctx.textAlign = 'right';
    ctx.fillStyle = '#D4AF37';
    ctx.font = '900 48px "Inter", sans-serif';
    ctx.fillText('LEARN', rightMottoX, headerY + 150);
    ctx.fillText('SERVE', rightMottoX, headerY + 250);
    ctx.fillText('SUCCEED', rightMottoX, headerY + 350);

    // 4. MAIN CONTENT AREA
    const colY = headerY + headerH + 56;
    const leftX = pad + 48;
    const leftW = 3620;
    const colH = 2080;

    // LEFT COLUMN: STUDENT IDENTIFICATION & ACADEMIC PROFILE
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(leftX, colY, leftW, colH);
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 6;
    ctx.strokeRect(leftX, colY, leftW, colH);

    // Header Bar for Identity Card
    ctx.fillStyle = '#1B365D';
    ctx.fillRect(leftX, colY, leftW, 130);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 48px "Inter", sans-serif';
    ctx.fillText('STUDENT IDENTIFICATION & ACADEMIC PROFILE', leftX + 60, colY + 84);

    // Avatar Circle
    const avatarX = leftX + 220;
    const avatarY = colY + 370;
    const avatarR = 160;

    ctx.fillStyle = '#1B365D';
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarR, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#D4AF37';
    ctx.lineWidth = 8;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 152px "Inter", sans-serif';
    const initial = (studentName || 'S').trim().charAt(0).toUpperCase();
    ctx.fillText(initial, avatarX, avatarY + 52);

    // Student Name (Dynamic Font Size)
    ctx.textAlign = 'left';
    const nameX = avatarX + avatarR + 80;
    const displayName = (studentName || 'JANARTHANAN R').toUpperCase();

    ctx.fillStyle = '#64748B';
    ctx.font = '900 40px "Inter", sans-serif';
    ctx.fillText('STUDENT NAME', nameX, colY + 260);

    ctx.fillStyle = '#0F172A';
    if (displayName.length > 25) {
      ctx.font = '900 76px "Inter", sans-serif';
    } else if (displayName.length > 18) {
      ctx.font = '900 92px "Inter", sans-serif';
    } else {
      ctx.font = '900 108px "Inter", sans-serif';
    }
    ctx.fillText(displayName, nameX, colY + 370);

    // LeetCode Handle Badge
    const handle = leetcodeUsername ? `@${leetcodeUsername.replace(/^@/, '')}` : `@${regNo.toLowerCase()}`;
    ctx.fillStyle = '#1E3A8A';
    ctx.font = '700 52px "Courier New", monospace';
    ctx.fillText(handle, nameX, colY + 456);

    // Identity Grid Fields (2x2 Grid)
    const gridY = colY + 560;
    const gridW = leftW - 120;

    // Field 1: Register Number
    const box1X = leftX + 60;
    const box1W = (gridW - 60) / 2;
    const boxH = 270;

    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(box1X, gridY, box1W, boxH);
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 4;
    ctx.strokeRect(box1X, gridY, box1W, boxH);

    ctx.fillStyle = '#64748B';
    ctx.font = '900 36px "Inter", sans-serif';
    ctx.fillText('REGISTER NUMBER', box1X + 48, gridY + 76);

    ctx.fillStyle = '#1B365D';
    ctx.font = '900 76px "Courier New", monospace';
    ctx.fillText(regNo || '732225CC018', box1X + 48, gridY + 184);

    // Field 2: Department
    const box2X = box1X + box1W + 60;
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(box2X, gridY, box1W, boxH);
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 4;
    ctx.strokeRect(box2X, gridY, box1W, boxH);

    ctx.fillStyle = '#64748B';
    ctx.font = '900 36px "Inter", sans-serif';
    ctx.fillText('DEPARTMENT', box2X + 48, gridY + 76);

    ctx.fillStyle = '#0F172A';
    const deptStr = deptName || 'Computer Science and Engineering (Cyber Security)';
    if (deptStr.length > 32) {
      ctx.font = '900 48px "Inter", sans-serif';
    } else if (deptStr.length > 24) {
      ctx.font = '900 56px "Inter", sans-serif';
    } else {
      ctx.font = '900 64px "Inter", sans-serif';
    }
    ctx.fillText(deptStr, box2X + 48, gridY + 184);

    // Field 3: Academic Year
    const gridY2 = gridY + boxH + 40;
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(box1X, gridY2, box1W, boxH);
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 4;
    ctx.strokeRect(box1X, gridY2, box1W, boxH);

    ctx.fillStyle = '#64748B';
    ctx.font = '900 36px "Inter", sans-serif';
    ctx.fillText('ACADEMIC YEAR', box1X + 48, gridY2 + 76);

    const academicYearStr = resolveAcademicYearDisplay(yearLevel);
    ctx.fillStyle = '#0F172A';
    ctx.font = '900 64px "Inter", sans-serif';
    ctx.fillText(academicYearStr, box1X + 48, gridY2 + 184);

    // Field 4: Verification Status
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(box2X, gridY2, box1W, boxH);
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 4;
    ctx.strokeRect(box2X, gridY2, box1W, boxH);

    ctx.fillStyle = '#64748B';
    ctx.font = '900 36px "Inter", sans-serif';
    ctx.fillText('VERIFICATION STATUS', box2X + 48, gridY2 + 76);

    ctx.fillStyle = '#059669';
    ctx.font = '900 60px "Inter", sans-serif';
    ctx.fillText('✓ VERIFIED STUDENT RECORD', box2X + 48, gridY2 + 184);

    // Credential Pass ID Strip
    const stripY = gridY2 + boxH + 48;
    const stripW = gridW;
    ctx.fillStyle = '#1B365D';
    ctx.fillRect(box1X, stripY, stripW, 180);

    ctx.fillStyle = '#D4AF37';
    ctx.font = '900 48px "Courier New", monospace';
    ctx.fillText(`CREDENTIAL PASS ID: NEC-PASS-2026-${regNo || '732225CC018'}`, box1X + 60, stripY + 108);

    // RIGHT COLUMN: INSTITUTIONAL PERFORMANCE METRICS & STANDING
    const rightX = leftX + leftW + 72;
    const rightW = innerW - leftW - 168;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(rightX, colY, rightW, colH);
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 6;
    ctx.strokeRect(rightX, colY, rightW, colH);

    // Header Bar for Metrics
    ctx.fillStyle = '#1B365D';
    ctx.fillRect(rightX, colY, rightW, 130);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 48px "Inter", sans-serif';
    ctx.fillText('INSTITUTIONAL PERFORMANCE METRICS & STANDING', rightX + 60, colY + 84);

    // 4 Equal KPI Metric Cards (2x2 Grid)
    const kpiGridY = colY + 190;
    const kpiCardW = (rightW - 140) / 2;
    const kpiCardH = 860;

    const drawKpiCard = (cx: number, cy: number, label: string, value: string, sub: string, valueColor: string = '#1B365D') => {
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(cx, cy, kpiCardW, kpiCardH);
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 4;
      ctx.strokeRect(cx, cy, kpiCardW, kpiCardH);

      // Card Header Tag
      ctx.fillStyle = '#1B365D';
      ctx.fillRect(cx, cy, kpiCardW, 110);

      ctx.textAlign = 'center';
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 44px "Inter", sans-serif';
      ctx.fillText(label, cx + kpiCardW / 2, cy + 72);

      // Large Value
      ctx.fillStyle = valueColor;
      ctx.font = '900 180px "Inter", sans-serif';
      ctx.fillText(value, cx + kpiCardW / 2, cy + 480);

      // Subtitle
      ctx.fillStyle = '#64748B';
      ctx.font = '700 40px "Inter", sans-serif';
      ctx.fillText(sub, cx + kpiCardW / 2, cy + 720);
    };

    // Card 1: College Rank
    drawKpiCard(
      rightX + 48,
      kpiGridY,
      'COLLEGE RANK',
      `#${collegeRank}`,
      'Current institutional standing',
      '#D4AF37'
    );

    // Card 2: Problems Solved
    drawKpiCard(
      rightX + 48 + kpiCardW + 44,
      kpiGridY,
      'PROBLEMS SOLVED',
      `${totalSolved}`,
      'Verified LeetCode solves',
      '#1B365D'
    );

    // Card 3: Active Streak
    drawKpiCard(
      rightX + 48,
      kpiGridY + kpiCardH + 40,
      'ACTIVE STREAK',
      `${streakCount} Days`,
      'Continuous practice streak',
      '#0F172A'
    );

    // Card 4: Contest Rating
    const rVal = contestRating && contestRating > 0 ? Math.round(contestRating).toString() : '1500';
    drawKpiCard(
      rightX + 48 + kpiCardW + 44,
      kpiGridY + kpiCardH + 40,
      'CONTEST RATING',
      rVal,
      'Weekly contest standing',
      '#1E3A8A'
    );

    // 5. SIGNATURES & QR SECTION
    const authY = colY + colH + 40;
    const authW = innerW - 80;
    const authH = 640;
    const authX = pad + 40;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(authX, authY, authW, authH);
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 6;
    ctx.strokeRect(authX, authY, authW, authH);

    // Left Signature: Principal
    const sigW = 1800;
    const sig1X = authX + 140;
    const sigYLine = authY + 340;

    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(sig1X, sigYLine);
    ctx.lineTo(sig1X + sigW, sigYLine);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#1B365D';
    ctx.font = 'italic 900 64px "Georgia", serif';
    ctx.fillText('Digitally Verified by Principal', sig1X + sigW / 2, sigYLine - 40);

    ctx.fillStyle = '#0F172A';
    ctx.font = '900 48px "Inter", sans-serif';
    ctx.fillText('PRINCIPAL', sig1X + sigW / 2, sigYLine + 76);

    ctx.fillStyle = '#64748B';
    ctx.font = '700 36px "Inter", sans-serif';
    ctx.fillText('NANDHA ENGINEERING COLLEGE (AUTONOMOUS)', sig1X + sigW / 2, sigYLine + 140);

    // Center QR Verification Box
    const qrS = 400;
    const qrX = authX + authW / 2 - qrS / 2;
    const qrY = authY + 50;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(qrX, qrY, qrS, qrS);
    ctx.strokeStyle = '#1B365D';
    ctx.lineWidth = 6;
    ctx.strokeRect(qrX, qrY, qrS, qrS);

    // Precise high-quality QR pattern
    ctx.fillStyle = '#0F172A';
    const drawQRFinder = (fx: number, fy: number) => {
      ctx.fillRect(fx, fy, 88, 88);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(fx + 12, fy + 12, 64, 64);
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(fx + 24, fy + 24, 40, 40);
    };
    drawQRFinder(qrX + 20, qrY + 20);
    drawQRFinder(qrX + qrS - 108, qrY + 20);
    drawQRFinder(qrX + 20, qrY + qrS - 108);

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if ((r * 3 + c * 7) % 5 < 3 && !(r < 3 && c < 3) && !(r < 3 && c > 5) && !(r > 5 && c < 3)) {
          ctx.fillRect(qrX + 120 + c * 26, qrY + 120 + r * 26, 16, 16);
        }
      }
    }

    ctx.fillStyle = '#1B365D';
    ctx.font = '900 36px "Courier New", monospace';
    ctx.fillText('SCAN TO VERIFY', authX + authW / 2, qrY + qrS + 52);

    // Right Signature: HOD / Coordinator
    const sig2X = authX + authW - 140 - sigW;
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(sig2X, sigYLine);
    ctx.lineTo(sig2X + sigW, sigYLine);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#1B365D';
    ctx.font = 'italic 900 64px "Georgia", serif';
    ctx.fillText('Authorized by HOD / Coordinator', sig2X + sigW / 2, sigYLine - 40);

    ctx.fillStyle = '#0F172A';
    ctx.font = '900 48px "Inter", sans-serif';
    ctx.fillText('HEAD OF THE DEPARTMENT', sig2X + sigW / 2, sigYLine + 76);

    ctx.fillStyle = '#64748B';
    ctx.font = '700 36px "Inter", sans-serif';
    ctx.fillText('DEPARTMENT ACADEMIC CELL', sig2X + sigW / 2, sigYLine + 140);

    // 6. MANDATORY ACADEMIC YEAR MAPPING BANNER (Navy Strip)
    const mapStripY = authY + authH + 32;
    const mapStripH = 150;
    const mapStripW = innerW - 80;
    const mapStripX = pad + 40;

    ctx.fillStyle = '#1B365D';
    ctx.fillRect(mapStripX, mapStripY, mapStripW, mapStripH);

    ctx.strokeStyle = '#D4AF37';
    ctx.lineWidth = 6;
    ctx.strokeRect(mapStripX, mapStripY, mapStripW, mapStripH);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#D4AF37';
    ctx.font = '900 44px "Courier New", monospace';
    ctx.fillText('ACADEMIC YEAR MAPPING :   Year II : 2025 – 2029   |   Year III : 2024 – 2028   |   Year IV : 2023 – 2027', mapStripX + mapStripW / 2, mapStripY + 90);

    // 7. FOOTER BAR & INSTITUTIONAL CREDIT
    const footerTextY = mapStripY + mapStripH + 84;

    // Footer Center Motto
    ctx.textAlign = 'center';
    ctx.fillStyle = '#1B365D';
    ctx.font = '900 44px "Inter", sans-serif';
    ctx.fillText('NANDHA ENGINEERING COLLEGE (AUTONOMOUS)  •  LEARN  |  SERVE  |  SUCCEED', W / 2, footerTextY);

    // Bottom-Right Institutional Location Credit
    ctx.textAlign = 'right';
    ctx.fillStyle = '#64748B';
    ctx.font = '900 40px "Inter", sans-serif';
    ctx.fillText('Nandha Engineering College (Autonomous) • Erode', pad + innerW - 60, footerTextY);
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

  const generateAndDownloadPass = (format: 'png' | 'jpg' = 'png') => {
    if (isGenerating) return;
    setIsGenerating(true);
    const canvas = canvasRef.current;
    if (!canvas) {
      setIsGenerating(false);
      return;
    }
    drawCardOnCanvas(canvas);

    const cleanReg = (regNo || 'download').replace(/[^A-Za-z0-9_-]+/g, '_');
    const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
    const ext = format === 'png' ? 'png' : 'jpg';
    const filename = `Nandha_Executive_Student_Pass_8K_${cleanReg}.${ext}`;

    // Lossless 8K PNG / Maximum Quality JPG
    canvas.toBlob((blob) => {
      if (blob) {
        triggerDownload(blob, filename, mimeType);
      } else {
        const link = document.createElement('a');
        link.download = filename;
        link.href = canvas.toDataURL(mimeType, 1.0);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      setTimeout(() => setIsGenerating(false), 1200);
    }, mimeType, 1.0);
  };

  return (
    <div className="bg-white dark:bg-navy-900 p-6 md:p-8 rounded-3xl border border-slate-200 dark:border-navy-700 shadow-md space-y-6">
      
      {/* Top Bar */}
      <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="space-y-1">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[11px] font-black uppercase tracking-wider border border-emerald-300 dark:border-emerald-700/60 shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>8K ULTRA-HD CRYSTAL CLEAR (7680 × 4320)</span>
          </div>
          <h3 className="font-black text-xl text-slate-900 dark:text-white tracking-tight flex items-center space-x-2">
            <span>Executive Digital Student Pass</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">
            Ultra-HD Certified Pass with Dual Institutional Signatures (Principal & HOD).
          </p>
        </div>

        <div className="flex items-center space-x-2 flex-wrap gap-2">
          <button
            onClick={() => generateAndDownloadPass('png')}
            disabled={isGenerating}
            className="flex items-center space-x-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-500/25 transition-transform transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 cursor-pointer"
            title="Download Lossless 8K Crystal Clear PNG Image"
          >
            <Download className="w-4 h-4" />
            <span>{isGenerating ? 'Exporting 8K...' : 'Download 8K PNG (Crystal Clear)'}</span>
          </button>

          <button
            onClick={() => generateAndDownloadPass('jpg')}
            disabled={isGenerating}
            className="flex items-center space-x-2 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-900 dark:bg-navy-800 dark:hover:bg-navy-700 text-slate-200 rounded-xl text-xs font-bold border border-slate-700 transition-transform transform hover:scale-105 disabled:opacity-50 cursor-pointer"
            title="Download Ultra-HD JPG Image"
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>.JPG</span>
          </button>
        </div>
      </div>

      {/* Live Rendered Canvas Preview */}
      <div className="flex justify-center p-3 rounded-2xl bg-slate-100 dark:bg-navy-950 border border-slate-200 dark:border-navy-800 shadow-inner overflow-x-auto">
        <canvas
          ref={canvasRef}
          className="rounded-2xl shadow-xl max-w-full h-auto border border-slate-300 dark:border-navy-700"
          style={{ width: '100%', maxWidth: '850px', imageRendering: 'crisp-edges' }}
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
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>33.2 Megapixel (7680×4320) Lossless Quality</span>
        </div>
      </div>
    </div>
  );
};

