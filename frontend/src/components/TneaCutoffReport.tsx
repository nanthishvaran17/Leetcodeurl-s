import React from 'react';

export const TneaCutoffReport: React.FC = () => {
  const data = [
    { sNo: 1, band: '190-200', total: 0, attended: 0, notAttended: 0, participation: '0', totalSolved: 0, avgSolved: 0, fourByFour: 0 },
    { sNo: 2, band: '180-189', total: 0, attended: 0, notAttended: 0, participation: '0', totalSolved: 0, avgSolved: 0, fourByFour: 0 },
    { sNo: 3, band: '170-179', total: 0, attended: 0, notAttended: 0, participation: '0', totalSolved: 0, avgSolved: 0, fourByFour: 0 },
    { sNo: 4, band: '160-169', total: 2, attended: 2, notAttended: 0, participation: '100.00%', totalSolved: 459, avgSolved: 229.5, fourByFour: 2 },
    { sNo: 5, band: '150-159', total: 6, attended: 6, notAttended: 0, participation: '100.00%', totalSolved: 1122, avgSolved: 187, fourByFour: 6 },
    { sNo: 6, band: '140-149', total: 17, attended: 17, notAttended: 0, participation: '100.00%', totalSolved: 3924, avgSolved: 230.82, fourByFour: 17 },
    { sNo: 7, band: '130-139', total: 7, attended: 7, notAttended: 0, participation: '100.00%', totalSolved: 1134, avgSolved: 162, fourByFour: 6 },
    { sNo: 8, band: '120-129', total: 2, attended: 2, notAttended: 0, participation: '100.00%', totalSolved: 283, avgSolved: 141.5, fourByFour: 2 },
    { sNo: 9, band: '110-119', total: 7, attended: 7, notAttended: 0, participation: '100.00%', totalSolved: 908, avgSolved: 129.71, fourByFour: 6 },
    { sNo: 10, band: '100-109', total: 4, attended: 4, notAttended: 0, participation: '100.00%', totalSolved: 821, avgSolved: 205.25, fourByFour: 4 },
    { sNo: 11, band: '90-99', total: 3, attended: 2, notAttended: 1, participation: '66.67%', totalSolved: 317, avgSolved: 158.5, fourByFour: 2 },
    { sNo: 12, band: '80-89', total: 2, attended: 2, notAttended: 0, participation: '100.00%', totalSolved: 268, avgSolved: 134, fourByFour: 2 },
    { sNo: 13, band: '70-79', total: 0, attended: 0, notAttended: 0, participation: '0', totalSolved: 0, avgSolved: 0, fourByFour: 0 },
    { sNo: 14, band: 'Below 70', total: 0, attended: 0, notAttended: 0, participation: '0', totalSolved: 0, avgSolved: 0, fourByFour: 0 },
    { sNo: 15, band: 'Not Recorded', total: 14, attended: 13, notAttended: 1, participation: '92.86%', totalSolved: 2316, avgSolved: 178.15, fourByFour: 12 },
  ];

  return (
    <div style={{ fontFamily: '"Times New Roman", Times, serif', padding: '40px', backgroundColor: '#fff', color: '#000', minHeight: '100vh' }}>
      {/* OFFICIAL MASTER NAVY INSTITUTIONAL HEADER */}
      <div className="bg-[#1b2a4a] text-white border-2 border-slate-900 rounded-lg overflow-hidden font-serif mb-6" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
        {/* Top Navy Title Bar */}
        <div className="flex items-center justify-between px-6 py-3 relative border-b border-gray-400/30">
          {/* Left Logo Emblem */}
          <div className="bg-white p-1 rounded-sm shadow-xs shrink-0">
            <div className="w-[80px] h-[48px] flex flex-col items-center justify-center border border-black p-0.5">
              <div className="text-[7px] leading-none text-center font-bold text-black uppercase tracking-tighter">Nandha Engineering College</div>
              <div className="text-[5px] text-center mt-1 border-t border-black w-full pt-0.5 flex justify-between px-0.5 text-black font-bold">
                <span>LEARN</span><span>SERVE</span><span>SUCCEED</span>
              </div>
            </div>
          </div>
          
          {/* College Details */}
          <div className="text-center flex-1 mx-4">
            <h1 className="text-xl font-bold tracking-wide leading-tight uppercase">
              NANDHA ENGINEERING COLLEGE, ERODE – 638 052
            </h1>
            <p className="text-xs italic opacity-90 mt-0.5">
              (AUTONOMOUS) • ESTD 2001 | Approved by AICTE, New Delhi & Affiliated to Anna University, Chennai
            </p>
          </div>

          {/* Right 25 NEC Anniversary Emblem */}
          <div className="w-12 h-12 rounded-full border-2 border-white/80 flex flex-col items-center justify-center bg-[#162747] p-0.5 shrink-0 text-white shadow-xs">
            <span className="text-[11px] font-black leading-none tracking-tighter">25</span>
            <span className="text-[6.5px] font-bold tracking-widest leading-none">NEC</span>
            <span className="text-[3.5px] text-center uppercase tracking-tighter leading-none mt-0.5 opacity-90">RISING HIGHER<br/>EVERYDAY</span>
          </div>
        </div>
        
        {/* Subtitle Bar: Department & Cohort */}
        <div className="text-center font-bold py-1.5 text-sm tracking-wider border-b border-gray-400/30 uppercase bg-[#162747]">
          DEPARTMENT OF COMPUTER SCIENCE & ENGINEERING • COHORT: III YEAR
        </div>

        {/* Report Title Strip */}
        <div className="bg-[#e6f0fa] text-[#1b2a4a] text-center font-bold py-1.5 text-sm uppercase border-b border-gray-400">
          REPORT: 12TH TNEA CUTOFF SUMMARY (III YEAR)
        </div>
      </div>

      {/* Title */}
      <h2 style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '22px', marginBottom: '20px' }}>
        12TH TNEA CUTOFF
      </h2>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #1e3a5f' }}>
          <thead>
            <tr style={{ backgroundColor: '#1e3a5f', color: '#fff' }}>
              <th style={thStyle}>S.No</th>
              <th style={thStyle}>12th Cutoff Band</th>
              <th style={thStyle}>Total Students</th>
              <th style={thStyle}>Attended</th>
              <th style={thStyle}>Not Attended</th>
              <th style={thStyle}>Participation %</th>
              <th style={thStyle}>Total Solved</th>
              <th style={thStyle}>Avg Solved</th>
              <th style={thStyle}>4/4 Solvers</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, index) => (
              <tr key={index} style={{ backgroundColor: index % 2 === 0 ? '#fff' : '#f8f9fa' }}>
                <td style={tdStyle}>{row.sNo}</td>
                <td style={tdStyle}>{row.band}</td>
                <td style={tdStyle}>{row.total}</td>
                <td style={tdStyle}>{row.attended}</td>
                <td style={tdStyle}>{row.notAttended}</td>
                <td style={tdStyle}>{row.participation}</td>
                <td style={tdStyle}>{row.totalSolved}</td>
                <td style={tdStyle}>{row.avgSolved}</td>
                <td style={tdStyle}>{row.fourByFour}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const thStyle: React.CSSProperties = {
  border: '1px solid #1e3a5f',
  padding: '12px 8px',
  textAlign: 'center',
  fontWeight: 'bold',
  fontSize: '14px',
};

const tdStyle: React.CSSProperties = {
  border: '1px solid #ddd',
  padding: '10px 8px',
  textAlign: 'center',
  fontSize: '14px',
};

export default TneaCutoffReport;
