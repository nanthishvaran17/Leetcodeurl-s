import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { QrCode } from 'lucide-react';

interface DynamicQRCodeProps {
  data: string;
  size?: number;
  className?: string;
  label?: string;
}

export const DynamicQRCode: React.FC<DynamicQRCodeProps> = ({
  data,
  size = 180,
  className = '',
  label
}) => {


  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div className="relative group bg-white p-3 rounded-2xl shadow-md border-2 border-slate-200 dark:border-navy-700 overflow-hidden">
        {data ? (
          <QRCodeSVG
            value={data}
            size={size}
            level="M"
            className="block select-none"
            bgColor="#ffffff"
            fgColor="#000000"
          />
        ) : (
          /* Offline fallback SVG QR Pattern */
          <div 
            style={{ width: size, height: size }}
            className="flex flex-col items-center justify-center bg-slate-50 text-slate-800 p-2 text-center"
          >
            <QrCode className="w-12 h-12 text-slate-700 mb-1" />
            <span className="text-[9px] font-mono font-bold break-all line-clamp-2">Invalid Data</span>
          </div>
        )}
      </div>

      {label && (
        <span className="text-[10px] font-bold text-slate-500 mt-2 text-center block">
          {label}
        </span>
      )}
    </div>
  );
};

export default DynamicQRCode;
