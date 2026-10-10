import React, { useState } from 'react';
import { CoordinatorWeeklyReport, ColumnDef } from './CoordinatorWeeklyReport';
import { triggerBrowserAnchorDownload, sanitizeFilename } from '../../services/download/downloadUtils';

export interface ReportConfig {
  id: string;
  category: 'A. CONTEST REPORTS' | 'B. PERFORMANCE REPORTS' | 'C. CONSOLIDATED REPORTS' | 'D. EXECUTIVE REPORTS';
  title: string;
  columns: ColumnDef[];
  sampleData: any[];
}

// -------------------------------------------------------------
// DEFAULT DATA PROFILES
// -------------------------------------------------------------
const defaultPerformanceData = [
  { sno: 1, regNo: '732224CC031', name: 'NANTHISH S', dept: 'CSE(CS)', year: 'III', acc: 'H', cutoff: '141.0', easy: 399, medium: 372, hard: 124, totalSolved: 895, attended: 12, rank: '65,461', rating: '1,820' },
  { sno: 2, regNo: '732224CC016', name: 'INIYA K', dept: 'CSE(CS)', year: 'III', acc: 'D', cutoff: '148.0', easy: 160, medium: 157, hard: 53, totalSolved: 370, attended: 2, rank: '867,847', rating: '1,274' },
  { sno: 3, regNo: '732224CC032', name: 'NISHANTH J S', dept: 'CSE(CS)', year: 'III', acc: 'D', cutoff: '107.0', easy: 102, medium: 192, hard: 61, totalSolved: 355, attended: 3, rank: '394,712', rating: '1,540' },
  { sno: 4, regNo: '732224CC038', name: 'RADHISRI N', dept: 'CSE(CS)', year: 'III', acc: 'H', cutoff: '156.5', easy: 108, medium: 186, hard: 58, totalSolved: 352, attended: 5, rank: '400,131', rating: '1,610' },
  { sno: 5, regNo: '732224CCL04', name: 'SRIDHAR S', dept: 'CSE(CS)', year: 'III', acc: 'D', cutoff: '150.0', easy: 100, medium: 169, hard: 47, totalSolved: 316, attended: 7, rank: '126,138', rating: '1,695' },
  { sno: 6, regNo: '732224CC039', name: 'RAJESH R', dept: 'CSE(CS)', year: 'III', acc: 'H', cutoff: '143.5', easy: 100, medium: 162, hard: 49, totalSolved: 311, attended: 4, rank: '484,820', rating: '1,490' },
  { sno: 7, regNo: '732224CC058', name: 'YAZHINI SHREE A', dept: 'CSE(CS)', year: 'III', acc: 'D', cutoff: '158.0', easy: 109, medium: 154, hard: 45, totalSolved: 308, attended: 6, rank: '162,817', rating: '1,649' },
  { sno: 8, regNo: '732224CC005', name: 'DHANUSHYA G K', dept: 'CSE(CS)', year: 'III', acc: 'D', cutoff: '145.0', easy: 106, medium: 145, hard: 36, totalSolved: 287, attended: 5, rank: '332,936', rating: '1,526' },
  { sno: 9, regNo: '732224CC046', name: 'SHANMUGA PRIYA J', dept: 'CSE(CS)', year: 'III', acc: 'D', cutoff: '161.0', easy: 98, medium: 142, hard: 34, totalSolved: 274, attended: 3, rank: '580,180', rating: '1,430' },
  { sno: 10, regNo: '732224CC034', name: 'NIVETHYTHA JR R', dept: 'CSE(CS)', year: 'III', acc: 'D', cutoff: '130.0', easy: 86, medium: 136, hard: 44, totalSolved: 266, attended: 5, rank: '814,846', rating: '1,355' }
];

const consolidatedColumns: ColumnDef[] = [
  { key: 'sno', header: 'S.No', width: 'w-12' },
  { key: 'regNo', header: 'Register No', isSortable: true, width: 'min-w-[100px]' },
  { key: 'name', header: 'Student Name', align: 'left', width: 'w-[200px]' },
  { key: 'dept', header: 'Department', isSortable: true },
  { key: 'year', header: 'Year', isSortable: true },
  { key: 'acc', header: 'Accommo\ndation', isSortable: true, width: 'max-w-[70px]' },
  { key: 'cutoff', header: '12th\nCutoff', isSortable: true, width: 'max-w-[60px]' },
  { key: 'easy', header: 'Easy', isSortable: true },
  { key: 'medium', header: 'Medium', isSortable: true },
  { key: 'hard', header: 'Hard', isSortable: true },
  { key: 'totalSolved', header: 'Total Solved', isSortable: true },
  { key: 'attended', header: 'Contests\nAttended', isSortable: true },
  { key: 'rank', header: 'Global Rank', isSortable: true },
  { key: 'rating', header: 'Contest\nRating', isSortable: true },
];

const contestScoreColumns: ColumnDef[] = [
  { key: 'sno', header: 'S.No', width: 'w-12' },
  { key: 'regNo', header: 'Register No', isSortable: true, width: 'min-w-[100px]' },
  { key: 'name', header: 'Student Name', align: 'left', width: 'w-[200px]' },
  { key: 'dept', header: 'Department', isSortable: true },
  { key: 'year', header: 'Year', isSortable: true },
  { key: 'easy', header: 'Easy', isSortable: true },
  { key: 'medium', header: 'Medium', isSortable: true },
  { key: 'hard', header: 'Hard', isSortable: true },
  { key: 'totalSolved', header: 'Total Solved', isSortable: true },
  { key: 'rank', header: 'Contest Rank', isSortable: true },
  { key: 'rating', header: 'Contest Rating', isSortable: true },
];

const attendanceColumns: ColumnDef[] = [
  { key: 'sno', header: 'S.No', width: 'w-12' },
  { key: 'regNo', header: 'Register No', isSortable: true, width: 'min-w-[100px]' },
  { key: 'name', header: 'Student Name', align: 'left', width: 'w-[200px]' },
  { key: 'dept', header: 'Department', isSortable: true },
  { key: 'year', header: 'Year', isSortable: true },
  { key: 'attended', header: 'Contests Attended', isSortable: true },
  { key: 'totalSolved', header: 'Total Problems Solved', isSortable: true },
  { key: 'rank', header: 'Global Rank', isSortable: true },
  { key: 'rating', header: 'Current Rating', isSortable: true },
];

// -------------------------------------------------------------
// COMPLETE 17 REPORT DEFINITIONS USING THE ONE EXACT FORMAT
// -------------------------------------------------------------
export const REPORT_SUITE: ReportConfig[] = [
  // A. CONTEST REPORTS
  { id: 'rpt_1', category: 'A. CONTEST REPORTS', title: 'FRIDAY CONTEST RESULT', columns: contestScoreColumns, sampleData: defaultPerformanceData },
  { id: 'rpt_2', category: 'A. CONTEST REPORTS', title: 'SUNDAY LIVE CONTEST', columns: contestScoreColumns, sampleData: defaultPerformanceData },
  { id: 'rpt_3', category: 'A. CONTEST REPORTS', title: 'WEEKLY CONTEST INTELLIGENCE', columns: consolidatedColumns, sampleData: defaultPerformanceData },
  { id: 'rpt_4', category: 'A. CONTEST REPORTS', title: 'CONTEST ATTENDANCE & PARTICIPATION', columns: attendanceColumns, sampleData: defaultPerformanceData },
  { id: 'rpt_5', category: 'A. CONTEST REPORTS', title: 'CONTEST PERFORMANCE & RANKING', columns: consolidatedColumns, sampleData: defaultPerformanceData },
  { id: 'rpt_6', category: 'A. CONTEST REPORTS', title: 'WEEK-ON-WEEK INTELLIGENCE', columns: consolidatedColumns, sampleData: defaultPerformanceData },
  { id: 'rpt_7', category: 'A. CONTEST REPORTS', title: 'HISTORICAL CONTEST INTELLIGENCE', columns: consolidatedColumns, sampleData: defaultPerformanceData },

  // B. PERFORMANCE REPORTS
  { id: 'rpt_8', category: 'B. PERFORMANCE REPORTS', title: 'WEEKLY STUDENT PERFORMANCE', columns: consolidatedColumns, sampleData: defaultPerformanceData },
  { id: 'rpt_9', category: 'B. PERFORMANCE REPORTS', title: 'FIVE-WEEK PERFORMANCE TREND', columns: consolidatedColumns, sampleData: defaultPerformanceData },
  { id: 'rpt_10', category: 'B. PERFORMANCE REPORTS', title: 'PROBLEM DIFFICULTY INTELLIGENCE', columns: consolidatedColumns, sampleData: defaultPerformanceData },

  // C. CONSOLIDATED REPORTS
  { id: 'rpt_11', category: 'C. CONSOLIDATED REPORTS', title: 'FACULTY CONSOLIDATED PERFORMANCE REPORT', columns: consolidatedColumns, sampleData: defaultPerformanceData },
  { id: 'rpt_12', category: 'C. CONSOLIDATED REPORTS', title: 'FACULTY COORDINATOR CONSOLIDATED', columns: consolidatedColumns, sampleData: defaultPerformanceData },
  { id: 'rpt_13', category: 'C. CONSOLIDATED REPORTS', title: 'HOD DEPARTMENT INTELLIGENCE', columns: consolidatedColumns, sampleData: defaultPerformanceData },
  { id: 'rpt_14', category: 'C. CONSOLIDATED REPORTS', title: 'COORDINATOR WEEKLY PERFORMANCE REPORT', columns: consolidatedColumns, sampleData: defaultPerformanceData },

  // D. EXECUTIVE REPORTS
  { id: 'rpt_15', category: 'D. EXECUTIVE REPORTS', title: 'PRINCIPAL EXECUTIVE INTELLIGENCE', columns: consolidatedColumns, sampleData: defaultPerformanceData },
  { id: 'rpt_16', category: 'D. EXECUTIVE REPORTS', title: 'MANAGEMENT EXECUTIVE SUMMARY', columns: consolidatedColumns, sampleData: defaultPerformanceData },
  { id: 'rpt_17', category: 'D. EXECUTIVE REPORTS', title: '12TH TNEA CUTOFF INTELLIGENCE', columns: consolidatedColumns, sampleData: defaultPerformanceData }
];

export const All17ReportsManager: React.FC = () => {
  const [selectedId, setSelectedId] = useState<string>('rpt_14'); // Default: Coordinator Weekly Performance
  const [department, setDepartment] = useState<string>('CSE(CS)');
  const [year, setYear] = useState<string>('III');
  const [sessionDate, setSessionDate] = useState<string>('05-Oct-2026');

  const activeReport = REPORT_SUITE.find(r => r.id === selectedId) || REPORT_SUITE[13];

  // Export to CSV helper
  const exportToCSV = () => {
    const headers = activeReport.columns.map(c => `"${c.header.replace(/\n/g, ' ')}"`).join(',');
    const rows = activeReport.sampleData.map(row => 
      activeReport.columns.map(col => `"${String(row[col.key] ?? '').replace(/"/g, '""')}"`).join(',')
    );
    const csvContent = [headers, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const blobUrl = URL.createObjectURL(blob);
    const filename = `${sanitizeFilename(activeReport.title)}_${department}_YEAR_${year}.csv`;
    triggerBrowserAnchorDownload(blobUrl, filename, 'text/csv');
  };

  // Export to Excel helper (.xls HTML format readable by MS Excel)
  const exportToExcel = () => {
    const headersHtml = activeReport.columns.map(c => 
      `<th style="background-color:#1b2a4a;color:white;border:1px solid #999;padding:6px;">${c.header.replace(/\n/g, '<br/>')}</th>`
    ).join('');

    const rowsHtml = activeReport.sampleData.map(row => 
      `<tr>${activeReport.columns.map(col => 
        `<td style="border:1px solid #ccc;padding:6px;text-align:${col.align || 'center'};">${row[col.key] ?? ''}</td>`
      ).join('')}</tr>`
    ).join('');

    const excelTemplate = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8" />
        <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
        <x:Name>${activeReport.title.slice(0, 31)}</x:Name>
        <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
        </x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
      </head>
      <body style="font-family: 'Times New Roman', serif;">
        <h2 style="color:#1b2a4a;text-align:center;">NANDHA ENGINEERING COLLEGE, ERODE – 638 052</h2>
        <h3 style="text-align:center;">DEPARTMENT OF ${department} • COHORT: ${year} YEAR</h3>
        <h4 style="background-color:#e6f0fa;color:#1b2a4a;text-align:center;padding:8px;">${activeReport.title} (${year} YEAR)</h4>
        <p style="text-align:center;"><b>Session Date:</b> ${sessionDate} | <b>Total Roster:</b> ${activeReport.sampleData.length} Students</p>
        <table style="border-collapse:collapse;width:100%;">
          <thead><tr>${headersHtml}</tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([excelTemplate], { type: 'application/vnd.ms-excel' });
    const blobUrl = URL.createObjectURL(blob);
    const filename = `${sanitizeFilename(activeReport.title)}_${department}_YEAR_${year}.xls`;
    triggerBrowserAnchorDownload(blobUrl, filename, 'application/vnd.ms-excel');
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4 font-sans text-slate-800">
      
      {/* Selector & Export Bar (Hidden on print) */}
      <div className="no-print max-w-[1200px] mx-auto bg-white rounded-xl shadow-md p-4 mb-6 border border-slate-200">
        
        {/* Title & Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
              🏆 Official College 17-Report Generator
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Select any report. Every single sheet uses the exact <b>Nandha College Master Template</b> with Dual Logos & Format!
            </p>
          </div>

          {/* Export Action Buttons */}
          <div className="flex items-center gap-2">
            <button 
              onClick={exportToExcel}
              className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-2 px-3.5 rounded-lg text-xs shadow flex items-center gap-1.5 transition-all cursor-pointer"
            >
              📊 Export to Excel (.xls)
            </button>
            <button 
              onClick={exportToCSV}
              className="bg-blue-700 hover:bg-blue-800 text-white font-bold py-2 px-3.5 rounded-lg text-xs shadow flex items-center gap-1.5 transition-all cursor-pointer"
            >
              📄 Export CSV
            </button>
            <button 
              onClick={() => window.print()}
              className="bg-slate-900 hover:bg-black text-white font-bold py-2 px-3.5 rounded-lg text-xs shadow flex items-center gap-1.5 transition-all cursor-pointer"
            >
              🖨️ Print / Save PDF (A4)
            </button>
          </div>
        </div>

        {/* Filter Inputs & Report Selector Dropdown */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-4 text-xs font-bold">
          <div>
            <label className="text-slate-600 block mb-1">Select Report (1 of 17):</label>
            <select 
              value={selectedId} 
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full border-2 border-blue-600 rounded-lg p-2 bg-blue-50/60 text-blue-950 font-bold text-xs cursor-pointer shadow-xs"
            >
              {['A. CONTEST REPORTS', 'B. PERFORMANCE REPORTS', 'C. CONSOLIDATED REPORTS', 'D. EXECUTIVE REPORTS'].map((cat) => (
                <optgroup key={cat} label={cat}>
                  {REPORT_SUITE.filter(r => r.category === cat).map(r => (
                    <option key={r.id} value={r.id}>
                      {r.title}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div>
            <label className="text-slate-600 block mb-1">Department Name:</label>
            <input 
              type="text" 
              value={department} 
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-900 font-semibold"
            />
          </div>

          <div>
            <label className="text-slate-600 block mb-1">Cohort Year:</label>
            <select 
              value={year} 
              onChange={(e) => setYear(e.target.value)}
              className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-900 font-semibold"
            >
              <option value="I">I YEAR</option>
              <option value="II">II YEAR</option>
              <option value="III">III YEAR</option>
              <option value="IV">IV YEAR</option>
            </select>
          </div>

          <div>
            <label className="text-slate-600 block mb-1">Session Date:</label>
            <input 
              type="text" 
              value={sessionDate} 
              onChange={(e) => setSessionDate(e.target.value)}
              className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-900 font-semibold"
            />
          </div>
        </div>
      </div>

      {/* Render Active Report using the EXACT ONE MASTER DESIGN TEMPLATE */}
      <div className="max-w-[1200px] mx-auto shadow-xl rounded-md overflow-hidden bg-white">
        <CoordinatorWeeklyReport 
          reportTitle={activeReport.title}
          sessionDate={sessionDate}
          department={department}
          year={year}
          totalRoster={activeReport.sampleData.length}
          generatedTime={`${sessionDate}, 07:40:52 PM IST`}
          columns={activeReport.columns}
          data={activeReport.sampleData}
        />
      </div>
    </div>
  );
};

export default All17ReportsManager;
