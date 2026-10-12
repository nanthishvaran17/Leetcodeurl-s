import fs from 'fs';
import path from 'path';

const targetFile = path.join('.', 'src', 'pages', 'HODCommandCenter.tsx');
let content = fs.readFileSync(targetFile, 'utf8');

// 1. Update main container padding for mobile bottom bar
content = content.replace(
  'pb-16 font-sans text-slate-900 dark:text-slate-100 antialiased',
  'pb-24 md:pb-16 font-sans text-slate-900 dark:text-slate-100 antialiased'
);

// 2. Update StaffAllocationModal to mobile-responsive-modal with drag handle
const modalOld = '<div className="modal-container-responsive bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 w-full max-w-4xl">';
const modalNew = '<div className="modal-container-responsive mobile-responsive-modal bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 w-full max-w-4xl max-h-[92vh] sm:max-h-[90vh]">\n        {/* Mobile Swipe Drag Handle */}\n        <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-navy-700 mx-auto sm:hidden shrink-0 mt-3 mb-1" />';

if (content.includes(modalOld)) {
  content = content.replace(modalOld, modalNew);
  console.log('Successfully updated StaffAllocationModal');
} else {
  console.log('modalOld not found');
}

fs.writeFileSync(targetFile, content, 'utf8');
console.log('Done script execution');
