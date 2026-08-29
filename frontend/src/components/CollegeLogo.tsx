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
        <text x="50" y="44" fill="#FFFFFF" fontSize="32" fontWeight="900" fontFamily="Times New Roman, serif" textAnchor="middle" letterSpacing="-1">
          25
        </text>

        {/* YEARS OF EXCELLENCE Banner text */}
        <text x="50" y="52" fill="#38BDF8" fontSize="4.2" fontWeight="bold" fontFamily="sans-serif" textAnchor="middle" letterSpacing="0.2">
          YEARS OF EXCELLENCE
        </text>

        {/* NEC Text */}
        <text x="50" y="65" fill="#FFFFFF" fontSize="12" fontWeight="900" fontFamily="Times New Roman, serif" textAnchor="middle" letterSpacing="0.5">
          NEC
        </text>

        {/* RISING HIGHER EVERYDAY Text */}
        <text x="50" y="75" fill="#E0F2FE" fontSize="4.5" fontWeight="800" fontFamily="Times New Roman, serif" textAnchor="middle" letterSpacing="0.8">
          RISING HIGHER
        </text>
        <text x="50" y="82" fill="#FFFFFF" fontSize="5" fontWeight="900" fontFamily="Times New Roman, serif" textAnchor="middle" letterSpacing="1">
          EVERYDAY
        </text>
      </svg>
    </div>
  );
};
