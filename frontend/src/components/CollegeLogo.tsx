import React from 'react';

interface CollegeLogoProps {
  className?: string;
  size?: number;
}

export const CollegeLogo: React.FC<CollegeLogoProps> = ({ className = "w-10 h-10", size = 44 }) => {
  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-md transition-transform hover:scale-105"
      >
        {/* Outer Circular White Ring */}
        <circle cx="50" cy="50" r="48" fill="#0A192F" stroke="#38BDF8" strokeWidth="2.5" />
        <circle cx="50" cy="50" r="45" stroke="#FFFFFF" strokeWidth="1.5" strokeDasharray="none" />

        {/* 25 Big Bold Stylized Graphic */}
        {/* Number 2 */}
        <path
          d="M26 32 C26 24, 40 24, 40 32 C40 38, 26 44, 26 52 L42 52"
          stroke="#FFFFFF"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />

        {/* Number 5 */}
        <path
          d="M62 26 L48 26 L48 38 C48 38, 62 36, 62 45 C62 53, 48 54, 46 48"
          stroke="#FFFFFF"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />

        {/* YEARS OF EXCELLENCE Banner text */}
        <rect x="46" y="47" width="28" height="4" fill="#0A192F" />
        <text x="60" y="50" fill="#38BDF8" fontSize="3.2" fontStyle="bold" fontFamily="Times New Roman, serif" textAnchor="middle">
          YEARS OF EXCELLENCE
        </text>

        {/* NEC Text */}
        <text x="35" y="66" fill="#FFFFFF" fontSize="11" fontWeight="900" fontFamily="Times New Roman, serif" textAnchor="middle" letterSpacing="0.5">
          NEC
        </text>

        {/* RISING HIGHER EVERYDAY Text */}
        <text x="50" y="77" fill="#E0F2FE" fontSize="4.5" fontWeight="800" fontFamily="Times New Roman, serif" textAnchor="middle" letterSpacing="0.8">
          RISING HIGHER
        </text>
        <text x="50" y="84" fill="#FFFFFF" fontSize="5" fontWeight="900" fontFamily="Times New Roman, serif" textAnchor="middle" letterSpacing="1">
          EVERYDAY
        </text>
      </svg>
    </div>
  );
};
