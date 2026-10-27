import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Download, CheckCircle2, ShieldCheck, Trophy, Calendar, Smartphone, FileText } from 'lucide-react';
import { triggerDownload } from '../utils/mobileDownload';
import { QRCodeCanvas } from 'qrcode.react';

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
  easySolved?: number;
  mediumSolved?: number;
  hardSolved?: number;
  lastVerifiedAt?: string | null;
  officialContests?: number;
  virtualContests?: number;
  verificationSource?: string;
  credentialStatus?: string;
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
  contestRating,
  easySolved = 0,
  mediumSolved = 0,
  hardSolved = 0,
  lastVerifiedAt,
  officialContests = 0,
  virtualContests = 0,
  verificationSource = 'LEETCODE API',
  credentialStatus = 'PENDING AUTHORIZATION'
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const logoImageRef = useRef<HTMLImageElement | null>(null);
  const secondaryLogoImageRef = useRef<HTMLImageElement | null>(null);
  const [logoLoaded, setLogoLoaded] = useState(false);
  const [secondaryLogoLoaded, setSecondaryLogoLoaded] = useState(false);

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

  useEffect(() => {
    const emblem = new Image();
    emblem.src = '/nandha_emblem_white_transparent.png';
    emblem.onload = () => {
      secondaryLogoImageRef.current = emblem;
      setSecondaryLogoLoaded(true);
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

    // Secondary institutional emblem balances the primary logo in the header.
    const rightMottoX = headerX + headerW - 100;
    const secondaryLogoSize = 190;
    const secondaryLogoX = rightMottoX - 520;
    const secondaryLogoY = headerY + (headerH - secondaryLogoSize) / 2 - 8;

    if (secondaryLogoImageRef.current) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(
        secondaryLogoX + secondaryLogoSize / 2,
        secondaryLogoY + secondaryLogoSize / 2,
        secondaryLogoSize / 2,
        0,
        Math.PI * 2
      );
      ctx.clip();
      ctx.drawImage(secondaryLogoImageRef.current, secondaryLogoX, secondaryLogoY, secondaryLogoSize, secondaryLogoSize);
      ctx.restore();

      ctx.strokeStyle = '#D4AF37';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(
        secondaryLogoX + secondaryLogoSize / 2,
        secondaryLogoY + secondaryLogoSize / 2,
        secondaryLogoSize / 2,
        0,
        Math.PI * 2
      );
      ctx.stroke();
    }

    // Top-Right Motto (LEARN | SERVE | SUCCEED)
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
    const colH = 2320;

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
    ctx.fillText(' VERIFIED STUDENT RECORD', box2X + 48, gridY2 + 184);

    // Credential Pass ID Strip
    const stripY = gridY2 + boxH + 48;
    const stripW = gridW;
    ctx.fillStyle = '#1B365D';
    ctx.fillRect(box1X, stripY, stripW, 180);

    ctx.fillStyle = '#D4AF37';
    ctx.font = '900 48px "Courier New", monospace';
    ctx.fillText(`CREDENTIAL PASS ID: NEC-PASS-2026-${regNo || '732225CC018'}`, box1X + 60, stripY + 108);

    // Additional credential details use the open space below the pass ID.
    const detailY = stripY + 270;
    const detailGap = 32;
    const detailW = (stripW - detailGap * 2) / 3;
    const detailH = 230;
    const issuedDate = new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(new Date()).toUpperCase();

    const drawDetailBox = (x: number, label: string, value: string, valueColor = '#1B365D') => {
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(x, detailY, detailW, detailH);
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 4;
      ctx.strokeRect(x, detailY, detailW, detailH);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#64748B';
      ctx.font = '900 30px "Inter", sans-serif';
      ctx.fillText(label, x + 32, detailY + 68);
      ctx.fillStyle = valueColor;
      ctx.font = value.length > 18 ? '900 34px "Inter", sans-serif' : '900 42px "Inter", sans-serif';
      ctx.fillText(value, x + 32, detailY + 150);
    };

    drawDetailBox(box1X, 'LEETCODE ID', leetcodeUsername ? `@${leetcodeUsername.replace(/^@/, '')}` : 'NOT LINKED');
    drawDetailBox(box1X + detailW + detailGap, 'PROFILE STATUS', 'VERIFIED', '#059669');
    drawDetailBox(box1X + (detailW + detailGap) * 2, 'PASS ISSUED', issuedDate);

    const problemY = detailY + 255;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#64748B';
    ctx.font = '900 30px "Inter", sans-serif';
    ctx.fillText('VERIFIED PROBLEM PROFILE', box1X, problemY);

    const problemBoxY = problemY + 34;
    const problemBoxH = 145;
    const drawProblemBox = (x: number, label: string, value: number, color: string) => {
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(x, problemBoxY, detailW, problemBoxH);
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 4;
      ctx.strokeRect(x, problemBoxY, detailW, problemBoxH);
      ctx.fillStyle = color;
      ctx.font = '900 52px "Inter", sans-serif';
      ctx.fillText(String(value), x + 30, problemBoxY + 82);
      ctx.fillStyle = '#64748B';
      ctx.font = '900 28px "Inter", sans-serif';
      ctx.fillText(label, x + 30, problemBoxY + 122);
    };

    drawProblemBox(box1X, 'EASY', easySolved, '#059669');
    drawProblemBox(box1X + detailW + detailGap, 'MEDIUM', mediumSolved, '#D97706');
    drawProblemBox(box1X + (detailW + detailGap) * 2, 'HARD', hardSolved, '#DC2626');

    const evidenceY = problemBoxY + problemBoxH + 24;
    const evidenceH = 135;
    const formatVerifiedAt = (value?: string | null) => {
      if (!value) return 'NOT AVAILABLE';
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) return 'NOT AVAILABLE';
      return parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
    };
    const drawEvidenceBox = (x: number, label: string, value: string, color = '#1B365D') => {
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(x, evidenceY, detailW, evidenceH);
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 4;
      ctx.strokeRect(x, evidenceY, detailW, evidenceH);
      ctx.fillStyle = '#64748B';
      ctx.font = '900 25px "Inter", sans-serif';
      ctx.fillText(label, x + 30, evidenceY + 50);
      ctx.fillStyle = color;
      ctx.font = '900 31px "Inter", sans-serif';
      ctx.fillText(value, x + 30, evidenceY + 99);
    };

    drawEvidenceBox(box1X, 'CREDENTIAL STATUS', credentialStatus, credentialStatus === 'VALID' ? '#059669' : '#B45309');
    drawEvidenceBox(box1X + detailW + detailGap, 'LAST DATA VERIFIED', formatVerifiedAt(lastVerifiedAt));
    drawEvidenceBox(box1X + (detailW + detailGap) * 2, 'CONTEST EVIDENCE', `${officialContests} ACTUAL / ${virtualContests} VIRTUAL`);

    const credentialMetaY = problemBoxY + problemBoxH + 28;
    const drawCredentialMetaBox = (x: number, label: string, value: string, valueColor = '#1B365D') => {
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(x, credentialMetaY, detailW, problemBoxH);
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 4;
      ctx.strokeRect(x, credentialMetaY, detailW, problemBoxH);
      ctx.fillStyle = '#64748B';
      ctx.font = '900 28px "Inter", sans-serif';
      ctx.fillText(label, x + 30, credentialMetaY + 58);
      ctx.fillStyle = valueColor;
      ctx.font = value.length > 20 ? '900 30px "Inter", sans-serif' : '900 38px "Inter", sans-serif';
      ctx.fillText(value, x + 30, credentialMetaY + 118);
    };

    drawCredentialMetaBox(box1X, 'CONTEST RATING', contestRating && contestRating > 0 ? String(Math.round(contestRating)) : 'NOT AVAILABLE', '#1E3A8A');
    drawCredentialMetaBox(box1X + detailW + detailGap, 'ACTIVE STREAK', `${streakCount} DAYS`, '#0F172A');
    drawCredentialMetaBox(box1X + (detailW + detailGap) * 2, 'VERIFICATION SOURCE', verificationSource, '#059669');

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
    const rVal = contestRating && contestRating > 0 && Math.round(contestRating) !== 1500 ? Math.round(contestRating).toString() : '—';
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

    // Use the same real QR source for the preview and exported credential.
    if (qrCanvasRef.current) {
      ctx.drawImage(qrCanvasRef.current, qrX, qrY, qrS, qrS);
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
  }, [studentName, regNo, deptName, yearLevel, totalSolved, collegeRank, streakCount, leetcodeUsername, contestRating, easySolved, mediumSolved, hardSolved, lastVerifiedAt, officialContests, virtualContests, verificationSource, credentialStatus, logoLoaded, secondaryLogoLoaded]);

  const cleanYear = yearLevel?.replace(/\s*year\b/gi, '').trim() || yearLevel || 'I';
  const credentialId = `NEC-PASS-2026-${regNo || '732225CC018'}`;
  const resolvedOrigin = typeof window !== 'undefined' && window.location.origin && !window.location.origin.includes('localhost') && !window.location.origin.includes('127.0.0.1')
    ? window.location.origin
    : 'https://nandha-leetcode.duckdns.org';

  const verificationUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (regNo) params.set('reg', regNo);
    if (studentName) params.set('name', studentName);
    if (deptName) params.set('dept', deptName);
    if (cleanYear) params.set('year', `${cleanYear} Year`);
    if (leetcodeUsername) params.set('user', leetcodeUsername);
    if (totalSolved !== undefined && totalSolved !== null) params.set('solved', String(totalSolved));
    if (collegeRank) params.set('rank', String(collegeRank));
    if (streakCount !== undefined && streakCount !== null) params.set('streak', String(streakCount));
    if (contestRating) params.set('rating', String(contestRating));
    if (easySolved !== undefined && easySolved !== null) params.set('easy', String(easySolved));
    if (mediumSolved !== undefined && mediumSolved !== null) params.set('med', String(mediumSolved));
    if (hardSolved !== undefined && hardSolved !== null) params.set('hard', String(hardSolved));
    params.set('type', 'student_pass');
    return `${resolvedOrigin}/verify/${encodeURIComponent(credentialId)}?${params.toString()}`;
  }, [resolvedOrigin, credentialId, regNo, studentName, deptName, cleanYear, leetcodeUsername, totalSolved, collegeRank, streakCount, contestRating, easySolved, mediumSolved, hardSolved]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [viewMode, setViewMode] = useState<'pass' | 'certificate'>('pass');

  const handleToggleView = (mode: 'pass' | 'certificate') => {
    setViewMode(mode);
    if (mode === 'certificate') {
      setTimeout(() => {
        if (canvasRef.current) {
          drawCardOnCanvas(canvasRef.current);
        }
      }, 50);
    }
  };

  const generateAndDownloadPass = () => {
    if (isGenerating) return;
    setIsGenerating(true);
    const canvas = canvasRef.current;
    if (!canvas) {
      setIsGenerating(false);
      return;
    }
    drawCardOnCanvas(canvas);

    const cleanReg = (regNo || 'download').replace(/[^A-Za-z0-9_-]+/g, '_');
    const mimeType = 'image/png';
    const filename = `Nandha_Executive_Student_Pass_8K_${cleanReg}.png`;

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
    <div className="bg-white dark:bg-navy-900 p-3 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-navy-700 shadow-md space-y-4 sm:space-y-6">
      
      {/* Top Bar with Segment Switcher & Download */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3 sm:pb-4">
        <div className="space-y-0.5">
          <h3 className="font-black text-base sm:text-xl text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <span>Executive Digital Student Pass</span>
          </h3>
          <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
            Nandha Engineering College Autonomous Verified Credential
          </p>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2 flex-wrap">
          {/* Segment Toggle */}
          <div className="p-1 rounded-xl bg-slate-100 dark:bg-navy-950 border border-slate-200 dark:border-navy-800 flex items-center gap-1">
            <button
              onClick={() => handleToggleView('pass')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'pass'
                  ? 'bg-white dark:bg-navy-800 text-brand-600 dark:text-brand-400 shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Mobile Pass</span>
            </button>
            <button
              onClick={() => handleToggleView('certificate')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'certificate'
                  ? 'bg-white dark:bg-navy-800 text-brand-600 dark:text-brand-400 shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>8K Print</span>
            </button>
          </div>

          <button
            onClick={generateAndDownloadPass}
            disabled={isGenerating}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-500/25 transition-transform transform active:scale-95 disabled:opacity-50 cursor-pointer"
            title="Download 8K PNG"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isGenerating ? 'Exporting...' : 'Download PNG'}</span>
          </button>
        </div>
      </div>

      {/* VIEW 1: Mobile Digital Pass View */}
      {viewMode === 'pass' && (
        <div className="w-full flex justify-center py-1 sm:py-2">
          <div className="relative w-full max-w-sm rounded-[28px] p-0.5 bg-gradient-to-b from-amber-400/50 via-indigo-500/30 to-brand-500/40 shadow-2xl overflow-hidden transition-all duration-300">
            <div className="relative rounded-[26px] bg-gradient-to-b from-[#0B1528] via-[#101E38] to-[#080E1C] text-white p-4 sm:p-5 space-y-4 overflow-hidden">
              
              {/* Background ambient lighting */}
              <div className="absolute -top-16 -right-16 w-44 h-44 rounded-full bg-amber-500/15 blur-2xl pointer-events-none" />
              <div className="absolute -bottom-16 -left-16 w-44 h-44 rounded-full bg-brand-500/15 blur-2xl pointer-events-none" />

              {/* College Branding Strip */}
              <div className="relative flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center space-x-2.5">
                  <div className="w-9 h-9 rounded-xl bg-white/10 p-1 backdrop-blur-xs flex items-center justify-center border border-white/15 shrink-0 shadow-inner">
                    <img
                      src="/nec_25_years_logo.png"
                      alt="NEC"
                      className="w-full h-full object-contain"
                      onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-black tracking-wider text-amber-300 uppercase truncate">Nandha Engineering College</div>
                    <div className="text-[9px] font-semibold text-slate-400 tracking-wide uppercase">Autonomous • Erode</div>
                  </div>
                </div>
                <div className="shrink-0 px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-[9px] font-black text-emerald-300 flex items-center gap-1 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  VERIFIED
                </div>
              </div>

              {/* Student Profile Row */}
              <div className="relative flex items-center gap-3.5 pt-0.5">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 via-brand-500 to-indigo-600 p-0.5 shadow-lg shadow-brand-500/25 shrink-0 aspect-square flex items-center justify-center">
                  <div className="w-full h-full rounded-full bg-[#0E1A30] flex items-center justify-center text-xl font-black text-white">
                    {studentName.charAt(0).toUpperCase()}
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-base sm:text-lg font-black text-white tracking-tight truncate leading-snug">{studentName}</h4>
                  <div className="flex items-center gap-1.5 flex-wrap text-xs text-slate-300 mt-0.5 font-mono">
                    <span className="font-bold text-amber-300">{regNo}</span>
                    <span className="text-white/30">•</span>
                    <span className="text-slate-300">{deptName || 'CSE'}</span>
                    <span className="text-white/30">•</span>
                    <span className="text-emerald-400 font-bold">{cleanYear} Year</span>
                  </div>
                  {leetcodeUsername && (
                    <div className="text-[11px] text-amber-400/90 font-mono mt-0.5 truncate">
                      @{leetcodeUsername}
                    </div>
                  )}
                </div>
              </div>

              {/* Performance Badges Grid */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="p-2.5 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-xs flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-300 shrink-0">
                    <Trophy className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[9px] uppercase font-bold text-slate-400 tracking-wider truncate">College Rank</div>
                    <div className="text-base font-black text-amber-300 truncate">#{collegeRank || 1}</div>
                  </div>
                </div>

                <div className="p-2.5 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-xs flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300 shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[9px] uppercase font-bold text-slate-400 tracking-wider truncate">Total Solved</div>
                    <div className="text-base font-black text-emerald-300 truncate">{totalSolved}</div>
                  </div>
                </div>

                <div className="p-2.5 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-xs flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shrink-0">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[9px] uppercase font-bold text-slate-400 tracking-wider truncate">Active Streak</div>
                    <div className="text-base font-black text-indigo-300 truncate">{streakCount} Days</div>
                  </div>
                </div>

                <div className="p-2.5 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-xs flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-xl bg-rose-500/20 border border-rose-400/30 flex items-center justify-center text-rose-300 shrink-0">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[9px] uppercase font-bold text-slate-400 tracking-wider truncate">Skill Level</div>
                    <div className="text-xs font-black text-white truncate">
                      {totalSolved > 100 ? 'Advanced' : totalSolved > 30 ? 'Proficient' : 'Foundation'}
                    </div>
                  </div>
                </div>
              </div>

              {/* QR Code & Digital Signature */}
              <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-between gap-3">
                <div className="p-1.5 rounded-xl bg-white shrink-0 shadow-md">
                  <QRCodeCanvas
                    value={verificationUrl}
                    size={68}
                    level="M"
                    bgColor="#ffffff"
                    fgColor="#0B1528"
                  />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="text-[10px] uppercase font-black tracking-wider text-amber-300">Digital Authenticity</div>
                  <p className="text-[10px] text-slate-300 leading-tight">
                    Scan QR to verify real-time LeetCode metrics and institutional certificate.
                  </p>
                  <div className="text-[9px] font-mono text-slate-400 truncate">
                    ID: {credentialId}
                  </div>
                </div>
              </div>

              {/* Footer Bar */}
              <div className="pt-1 flex items-center justify-between text-[10px] text-slate-400 border-t border-white/10 font-semibold">
                <span className="flex items-center gap-1 text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Principal Digitally Signed</span>
                </span>
                <span className="shrink-0 text-slate-500">NEC Autonomous</span>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: Live Rendered 8K Canvas Preview (Always in DOM so ref exists) */}
      <div className={`p-2 sm:p-3 rounded-2xl bg-slate-100 dark:bg-navy-950 border border-slate-200 dark:border-navy-800 shadow-inner overflow-x-auto ${viewMode === 'certificate' ? 'flex justify-center' : 'hidden'}`}>
        <canvas
          ref={canvasRef}
          className="rounded-2xl shadow-xl max-w-full h-auto border border-slate-300 dark:border-navy-700"
          style={{ width: '100%', maxWidth: '850px', imageRendering: 'crisp-edges' }}
        />
      </div>

      <div className="sr-only" aria-hidden="true">
        <QRCodeCanvas
          ref={qrCanvasRef}
          value={verificationUrl}
          size={400}
          level="M"
          includeMargin
          bgColor="#ffffff"
          fgColor="#0F172A"
        />
      </div>

      {/* Verification Footer Notes */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 text-xs">
        <div className="p-2.5 sm:p-3 rounded-xl bg-slate-50 dark:bg-navy-800/80 border border-slate-200 dark:border-navy-700 flex items-center space-x-2 text-slate-700 dark:text-slate-200 font-bold shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span className="text-[11px] sm:text-xs">Principal Digital Authorization Included</span>
        </div>
        <div className="p-2.5 sm:p-3 rounded-xl bg-slate-50 dark:bg-navy-800/80 border border-slate-200 dark:border-navy-700 flex items-center space-x-2 text-slate-700 dark:text-slate-200 font-bold shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span className="text-[11px] sm:text-xs">HOD & Coordinator Certified Badge</span>
        </div>
        <div className="p-2.5 sm:p-3 rounded-xl bg-slate-50 dark:bg-navy-800/80 border border-slate-200 dark:border-navy-700 flex items-center space-x-2 text-slate-700 dark:text-slate-200 font-bold shadow-xs">
          <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
          <span className="text-[11px] sm:text-xs">High-Quality 8K Image Export</span>
        </div>
      </div>
    </div>
  );
};

