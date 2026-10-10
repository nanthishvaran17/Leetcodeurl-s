import React from 'react';

export interface ExecutiveReportProps {
  contestTitle?: string;
  dateStr?: string;
  academicYear?: string;
  scopeStr?: string;
  windowStr?: string;
  generatedStr?: string;
  versionStr?: string;
  templateRev?: string;
  totalRoster?: number;
  contestAttended?: number;
  attendanceRate?: string;
  totalSolves?: number;
  avgSolvesAttended?: number | string;
  avgScore?: string;
  perfectSolvers?: number;
  partialSolvers?: number;
  tableData?: Array<{
    rank: number;
    regNo: string;
    name: string;
    dept: string;
    year: string;
    handle: string;
    solved: number;
    signal: string;
    signalColor?: string;
  }>;
}

export const ExecutiveIntelligenceReport: React.FC<ExecutiveReportProps> = ({
  contestTitle = 'Weekly Contest 523',
  dateStr = '06-10-2026',
  academicYear = '2026–2027',
  scopeStr = '66 Authorized Students',
  windowStr = '08:00 AM — 09:30 AM IST',
  generatedStr = '06-10-2026 07:51 PM',
  versionStr = 'v1.0',
  templateRev = '3',
  totalRoster = 66,
  contestAttended = 52,
  attendanceRate = '78.79%',
  totalSolves = 135,
  avgSolvesAttended = 2.6,
  avgScore = '—',
  perfectSolvers = 5,
  partialSolvers = 41,
  tableData = [
    { rank: 1, regNo: '732224CC016', name: 'INIYA K', dept: 'CSE(CS)', year: 'III YEAR', handle: 'Iniya3126', solved: 4, signal: 'HIGH PERFORMANCE', signalColor: 'text-[#008040]' },
    { rank: 2, regNo: '732224CC031', name: 'NANTHISH S', dept: 'CSE(CS)', year: 'III YEAR', handle: 'nanthishvaran_07', solved: 4, signal: 'HIGH PERFORMANCE', signalColor: 'text-[#008040]' },
    { rank: 3, regNo: '732224CC032', name: 'NISHANTH J S', dept: 'CSE(CS)', year: 'III YEAR', handle: 'Nishanthjs', solved: 4, signal: 'HIGH PERFORMANCE', signalColor: 'text-[#008040]' },
    { rank: 4, regNo: '732224CC038', name: 'RADHISRI N', dept: 'CSE(CS)', year: 'III YEAR', handle: 'Radhisri28', solved: 4, signal: 'HIGH PERFORMANCE', signalColor: 'text-[#008040]' },
    { rank: 5, regNo: '732224CC039', name: 'RAJESH R', dept: 'CSE(CS)', year: 'III YEAR', handle: 'Rajesh1328', solved: 4, signal: 'HIGH PERFORMANCE', signalColor: 'text-[#008040]' },
    { rank: 6, regNo: '732224CC044', name: 'SAKTHI S', dept: 'CSE(CS)', year: 'III YEAR', handle: 'sakthi0407', solved: 3, signal: 'STRONG', signalColor: 'text-[#0055a4]' },
    { rank: 7, regNo: '732224CC025', name: 'MAGUDAPATHI S', dept: 'CSE(CS)', year: 'III YEAR', handle: 'Magudapathi26', solved: 3, signal: 'STRONG', signalColor: 'text-[#0055a4]' },
    { rank: 8, regNo: '732224CC021', name: 'KIRUTHIKAA P T', dept: 'CSE(CS)', year: 'III YEAR', handle: 'KIRUTHIKAA_05', solved: 3, signal: 'STRONG', signalColor: 'text-[#0055a4]' },
    { rank: 9, regNo: '732224CC047', name: 'SHARMILA P', dept: 'CSE(CS)', year: 'III YEAR', handle: 'Sharmila__27', solved: 3, signal: 'STRONG', signalColor: 'text-[#0055a4]' },
    { rank: 10, regNo: '732224CC035', name: 'POOMITHA KS', dept: 'CSE(CS)', year: 'III YEAR', handle: 'Poomitha_23', solved: 3, signal: 'STRONG', signalColor: 'text-[#0055a4]' },
  ]
}) => {

  const DropdownIcon = () => (
    <span className="bg-white text-black text-[8px] px-1 rounded-sm inline-block ml-1 shadow-sm leading-tight select-none">&#9660;</span>
  );

  const GreenTriangle = () => (
    <div className="absolute top-0 left-0 w-0 h-0 border-t-[8px] border-r-[8px] border-t-[#008040] border-r-transparent"></div>
  );

  return (
    <>
      {/* Global CSS for exact color printing and clean A4 page breaking */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm;
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
          .excel-grid-bg {
            background-image: none !important;
          }
        }
      `}</style>

      <div 
        className="excel-grid-bg w-full max-w-full overflow-x-auto bg-white text-black print:overflow-visible print:p-0" 
        style={{ 
          fontFamily: '"Times New Roman", Times, serif',
          backgroundImage: 'linear-gradient(to right, #f0f0f0 1px, transparent 1px), linear-gradient(to bottom, #f0f0f0 1px, transparent 1px)',
          backgroundSize: '100px 30px'
        }}
      >
        {/* Printable Control Bar */}
        <div className="no-print p-2 bg-slate-800 text-white flex justify-between items-center px-4 max-w-[1200px] mx-auto rounded-t-md text-xs font-sans">
          <span className="font-semibold">📄 Report Preview & Print Mode</span>
          <button 
            onClick={() => window.print()}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-1 px-3 rounded shadow transition-all flex items-center gap-1 cursor-pointer"
          >
            🖨️ Print / Save as PDF (A4)
          </button>
        </div>

        <div className="min-w-[1200px] print:min-w-full bg-white border border-gray-400 shadow-sm mx-auto mb-4 print:border-black page-break-avoid">
          
          {/* Header Section - Sticky for Web Scroll */}
          <div className="bg-[#1b2a4a] text-white py-3 border-b-2 border-black sticky top-0 z-20 print:static">
            <div className="flex items-center relative justify-center">
              {/* Logo Left */}
              <div className="absolute left-6 top-0 bg-white p-1 rounded-sm shadow-sm print:left-2">
                <div className="w-[72px] h-[48px] flex flex-col items-center justify-center border border-black p-0.5">
                    <div className="text-[7px] leading-[1.1] text-center font-bold text-black uppercase tracking-tighter">Nandha Engineering College</div>
                    <div className="text-[5px] text-center mt-1 border-t border-black w-full pt-0.5 flex justify-between px-1 text-black font-bold">
                        <span>LEARN</span><span>SERVE</span><span>SUCCEED</span>
                    </div>
                </div>
              </div>
              
              <div className="text-center">
                <h1 className="text-xl font-bold tracking-wide">NANDHA ENGINEERING COLLEGE</h1>
                <h2 className="text-[15px] font-bold mt-1 tracking-wider uppercase">WEEKLY LEETCODE INTELLIGENCE REPORT</h2>
                <h3 className="text-[13px] mt-1 italic tracking-wide text-gray-200">
                  01 PRINCIPAL EXECUTIVE — {contestTitle}
                </h3>
              </div>
            </div>
          </div>

          {/* Info Grid (Excel-like summary rows) */}
          <div className="w-full border-b border-black page-break-avoid">
            {/* Row 1 */}
            <div className="flex w-full text-xs font-bold bg-[#fcfcfc] print:bg-white">
              <div className="w-1/4 border-r border-b border-black p-1.5 text-center flex items-center justify-center">Contest: {contestTitle}</div>
              <div className="w-1/4 border-r border-b border-black p-1.5 text-center flex items-center justify-center">Date: {dateStr}</div>
              <div className="w-1/4 border-r border-b border-black p-1.5 text-center flex items-center justify-center">Academic Year: {academicYear}</div>
              <div className="w-1/4 border-b border-black p-1.5 text-center flex items-center justify-center">Scope: {scopeStr}</div>
            </div>
            {/* Row 2 */}
            <div className="flex w-full text-xs font-bold bg-[#fcfcfc] print:bg-white">
              <div className="w-1/4 border-r border-b border-black p-1.5 text-center flex items-center justify-center">Window: {windowStr}</div>
              <div className="w-1/4 border-r border-b border-black p-1.5 text-center flex items-center justify-center">Generated: {generatedStr}</div>
              <div className="w-1/4 border-r border-b border-black p-1.5 text-center flex items-center justify-center">Version: {versionStr}</div>
              <div className="w-1/4 border-b border-black p-1.5 text-center flex items-center justify-center">Template Rev: {templateRev}</div>
            </div>
            
            {/* Spacing Row */}
            <div className="w-full h-3 border-b border-black bg-white"></div>

            {/* Row 3 - Metrics Header */}
            <div className="flex w-full text-[11px] font-bold uppercase tracking-wider bg-[#f8f9fa] print:bg-white">
              <div className="w-1/4 border-r border-b border-black p-2 text-center relative">
                <GreenTriangle />
                TOTAL ROSTER STUDENTS
              </div>
              <div className="w-1/4 border-r border-b border-black p-2 text-center relative">
                <GreenTriangle />
                CONTEST ATTENDED
              </div>
              <div className="w-1/4 border-r border-b border-black p-2 text-center relative">
                <GreenTriangle />
                ATTENDANCE RATE
              </div>
              <div className="w-1/4 border-b border-black p-2 text-center relative">
                <GreenTriangle />
                TOTAL SOLVES
              </div>
            </div>
            
            {/* Row 4 - Metrics Values */}
            <div className="flex w-full text-xl font-bold bg-white">
              <div className="w-1/4 border-r border-b border-black p-3 text-center">{totalRoster}</div>
              <div className="w-1/4 border-r border-b border-black p-3 text-center">{contestAttended}</div>
              <div className="w-1/4 border-r border-b border-black p-3 text-center">{attendanceRate}</div>
              <div className="w-1/4 border-b border-black p-3 text-center">{totalSolves}</div>
            </div>

            {/* Row 5 - Metrics Header 2 */}
            <div className="flex w-full text-[11px] font-bold uppercase tracking-wider bg-[#f8f9fa] print:bg-white">
              <div className="w-1/4 border-r border-b border-black p-2 text-center relative">
                AVERAGE SOLVES (ATTENDED)
              </div>
              <div className="w-1/4 border-r border-b border-black p-2 text-center relative">
                AVERAGE SCORE
              </div>
              <div className="w-1/4 border-r border-b border-black p-2 text-center relative">
                <GreenTriangle />
                4/4 PERFECT SOLVERS
              </div>
              <div className="w-1/4 border-b border-black p-2 text-center relative">
                <GreenTriangle />
                3/4 & 2/4 SOLVERS
              </div>
            </div>

            {/* Row 6 - Metrics Values 2 */}
            <div className="flex w-full text-xl font-bold bg-white">
              <div className="w-1/4 border-r border-b border-black p-3 text-center">{avgSolvesAttended}</div>
              <div className="w-1/4 border-r border-b border-black p-3 text-center text-gray-500">{avgScore}</div>
              <div className="w-1/4 border-r border-b border-black p-3 text-center">{perfectSolvers}</div>
              <div className="w-1/4 border-b border-black p-3 text-center">{partialSolvers}</div>
            </div>
          </div>

          {/* Empty Excel Rows Spacing */}
          <div className="w-full h-6 bg-transparent border-b border-gray-300"></div>

          {/* Main Table */}
          <table className="w-full text-[13px] border-collapse border border-black bg-white">
            <thead>
              <tr className="bg-[#1b2a4a] text-white text-xs font-bold text-center border-b-2 border-black sticky top-[72px] z-10 print:static">
                <th className="border-r border-black p-2 w-[60px]">
                  Rank <DropdownIcon />
                </th>
                <th className="border-r border-black p-2 w-[120px]">
                  Register No
                </th>
                <th className="border-r border-black p-2 text-left pl-4">
                  Student Name <DropdownIcon />
                </th>
                <th className="border-r border-black p-2 w-[120px]">
                  Department <DropdownIcon />
                </th>
                <th className="border-r border-black p-2 w-[90px]">
                  Year
                </th>
                <th className="border-r border-black p-2 w-[160px]">
                  LeetCode Handle <DropdownIcon />
                </th>
                <th className="border-r border-black p-2 w-[90px]">
                  Solved <DropdownIcon />
                </th>
                <th className="p-2 w-[160px]">
                  Mentor Signal <DropdownIcon />
                </th>
              </tr>
            </thead>
            <tbody>
              {tableData.map((row, i) => (
                <tr key={i} className="border-b border-gray-400 text-center hover:bg-gray-50 h-[30px] page-break-avoid">
                  <td className="border-r border-gray-400">{row.rank}</td>
                  <td className="border-r border-gray-400 font-sans">{row.regNo}</td>
                  <td className="border-r border-gray-400 text-left pl-4 uppercase">{row.name}</td>
                  <td className="border-r border-gray-400">{row.dept}</td>
                  <td className="border-r border-gray-400">{row.year}</td>
                  <td className="border-r border-gray-400 text-left pl-4 font-sans">{row.handle}</td>
                  <td className="border-r border-gray-400 font-bold">{row.solved}</td>
                  <td className={`font-bold ${row.signalColor || 'text-black'}`}>{row.signal}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Footer */}
          <div className="p-2 mt-2 text-[10px] text-gray-500 italic flex justify-between items-center border-t border-gray-300">
            <span>v1.0 | Template Rev 3 | Official Nandha LeetCode Intelligence System</span>
            <span>Page 1 of 1</span>
          </div>
          
        </div>
      </div>
    </>
  );
};

export default ExecutiveIntelligenceReport;
