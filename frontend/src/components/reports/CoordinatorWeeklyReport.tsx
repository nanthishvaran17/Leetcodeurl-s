import React from 'react';

export interface ColumnDef {
  key: string;
  header: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  isSortable?: boolean;
}

export interface GenericReportProps {
  reportTitle: string; // e.g., "FACULTY CONSOLIDATED PERFORMANCE REPORT"
  sessionDate: string;
  department: string;  // e.g., "CSE(CS)"
  year: string;        // e.g., "III"
  totalRoster: number;
  generatedTime: string;
  columns: ColumnDef[];
  data: any[];
}

export const CoordinatorWeeklyReport: React.FC<GenericReportProps> = ({
  reportTitle = 'FACULTY CONSOLIDATED PERFORMANCE REPORT',
  sessionDate = '04.10.2026',
  department = 'CSE(CS)',
  year = 'III',
  totalRoster = 63,
  generatedTime = '05 Oct 2026, 07:39:56 PM IST',
  columns = [],
  data = [],
}) => {
  return (
    <>
      <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 6mm;
          }
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            background: white !important;
          }
          .no-print {
            display: none !important;
          }
          .page-break-avoid {
            page-break-inside: avoid;
            break-inside: avoid;
          }
        }
      `}</style>

      <div className="font-serif w-full max-w-full overflow-x-auto bg-white text-black print:p-0 print:overflow-visible" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
        
        {/* Print Bar */}
        <div className="no-print p-2 bg-slate-800 text-white flex justify-between items-center px-4 max-w-[1200px] mx-auto rounded-t-md text-xs font-sans">
          <span className="font-semibold">📄 Report View & Print Control</span>
          <button 
            onClick={() => window.print()}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-1 px-3 rounded shadow flex items-center gap-1 cursor-pointer"
          >
            🖨️ Print / Save PDF (A4 Landscape)
          </button>
        </div>

        <div className="min-w-[1200px] print:min-w-full border border-gray-400 mx-auto print:border-black page-break-avoid">
          
          {/* Header Section */}
          <div className="bg-[#1b2a4a] text-white relative">
            
            {/* Main Header Banner with Left and Right Logos */}
            <div className="flex items-center justify-between px-6 py-3 relative min-h-[64px]">
              
              {/* Left Logo: Nandha Engineering College */}
              <div className="bg-white p-1 rounded-sm shadow-sm shrink-0">
                <div className="w-[76px] h-[48px] flex flex-col items-center justify-center border border-black p-0.5">
                    <div className="text-[7px] leading-none text-center font-bold text-black uppercase tracking-tighter">Nandha Engineering College</div>
                    <div className="text-[5px] text-center mt-1 border-t border-black w-full pt-0.5 flex justify-between px-0.5 text-black font-bold">
                        <span>LEARN</span><span>SERVE</span><span>SUCCEED</span>
                    </div>
                </div>
              </div>

              {/* Center Title */}
              <div className="text-center flex-1 mx-4">
                <h1 className="text-2xl font-bold tracking-wide leading-tight">NANDHA ENGINEERING COLLEGE, ERODE – 638 052</h1>
              </div>

              {/* Right Logo: 25 NEC Rising Higher Everyday Emblem */}
              <div className="w-13 h-13 rounded-full border-2 border-white/80 flex flex-col items-center justify-center bg-[#162747] p-1 shrink-0 text-white shadow-sm">
                <span className="text-[12px] font-black leading-none tracking-tighter">25</span>
                <span className="text-[7px] font-bold tracking-widest leading-none">NEC</span>
                <span className="text-[4px] text-center uppercase tracking-tighter leading-none mt-0.5 opacity-80">RISING HIGHER<br/>EVERYDAY</span>
              </div>
            </div>

            {/* Subtitle Bar 1 */}
            <div className="text-center text-xs pb-1 border-b border-gray-400/30 italic">
              (AUTONOMOUS) • ESTD 2001 | Approved by AICTE, New Delhi & Affiliated to Anna University, Chennai
            </div>
            
            {/* Subtitle Bar 2: Department and Cohort Year */}
            <div className="text-center font-bold py-1 text-sm tracking-wider border-b border-gray-400/30 uppercase">
              DEPARTMENT OF {department} • COHORT: {year} YEAR
            </div>
            
            {/* Subtitle Bar 3: Light Blue Title Box */}
            <div className="bg-[#e6f0fa] text-[#1b2a4a] text-center font-bold py-1.5 text-base uppercase border-b border-gray-400">
              {reportTitle} ({year} YEAR)
            </div>
            
            {/* Meta Information Bar */}
            <div className="bg-[#e6f0fa] text-[#1b2a4a] text-center text-xs py-1 border-b border-gray-400 font-semibold flex justify-center gap-4">
              <span>Session Date: {sessionDate}</span> | 
              <span>Department: {department}</span> | 
              <span>Year: {year} YEAR</span> | 
              <span>Total Roster: {totalRoster} Students</span> | 
              <span>Generated: {generatedTime}</span>
            </div>
          </div>

          {/* Dynamic Table with Sticky Table Header */}
          <table className="w-full text-sm text-center border-collapse">
            <thead>
              <tr className="bg-[#1b2a4a] text-white text-xs whitespace-nowrap sticky top-0 z-10 print:static">
                {columns.map((col) => (
                  <th 
                    key={col.key} 
                    className={`border border-gray-400 p-2 font-semibold ${col.width || ''}`}
                    style={{ textAlign: col.align || 'center' }}
                  >
                    <div className={`flex flex-col gap-1 ${col.align === 'left' ? 'items-start' : col.align === 'right' ? 'items-end' : 'items-center'}`}>
                      <span dangerouslySetInnerHTML={{ __html: col.header.replace('\n', '<br/>') }} />
                      {col.isSortable !== false && (
                        <span className="bg-white text-black text-[8px] px-1 rounded inline-block mt-0.5 select-none">&#9660;</span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white text-[#333]">
              {data.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-b border-gray-400 hover:bg-gray-50 page-break-avoid h-[32px]">
                  {columns.map((col) => (
                    <td 
                      key={col.key} 
                      className={`border-r border-gray-400 p-2 text-black ${
                        col.key === 'regNo' ? 'font-sans text-[13px]' : 
                        col.key === 'name' ? 'text-[13px] uppercase' : ''
                      }`}
                      style={{ textAlign: col.align || 'center' }}
                    >
                      {row[col.key]}
                    </td>
                  ))}
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={columns.length || 1} className="p-4 text-center text-gray-500 font-sans italic">
                    No records found for this report.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

export default CoordinatorWeeklyReport;
