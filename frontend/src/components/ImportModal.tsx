import React, { useState } from 'react';
import { X, UploadCloud, CheckCircle2, AlertTriangle, FileSpreadsheet, Loader2 } from 'lucide-react';
import api from '../services/api';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<any>(null);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      
      // Auto trigger preview check
      setLoading(true);
      const formData = new FormData();
      formData.append('file', selected);

      try {
        const res = await api.post('/students/import-preview', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        setPreview(res.data);
      } catch (err: any) {
        alert(err.response?.data?.detail || "Error validating file");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleCommit = async () => {
    if (!preview || !preview.valid_rows || preview.valid_rows.length === 0) return;
    setLoading(true);
    try {
      await api.post('/students/import-commit', preview.valid_rows);
      alert(`Successfully imported ${preview.valid_rows.length} students!`);
      onSuccess();
      onClose();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Import failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-3xl glass-card rounded-3xl p-6 border border-gray-200 dark:border-gray-800 space-y-6 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-4 border-gray-200 dark:border-gray-800">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-brand-600 text-white">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-gray-900 dark:text-white">Import Students from Excel</h3>
              <p className="text-xs text-gray-500">Upload .xlsx file containing student LeetCode profiles</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dropzone */}
        {!preview && (
          <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-2xl p-8 text-center hover:border-brand-500 transition-colors">
            <UploadCloud className="w-12 h-12 text-brand-500 mx-auto mb-3" />
            <p className="font-semibold text-sm text-gray-800 dark:text-gray-200">Click to upload or drag & drop Excel file</p>
            <p className="text-xs text-gray-500 mt-1">Columns: REG NO, NAME, DEPT, YEAR, SECTION, EMAIL, LEETCODE PROFILE LINK</p>
            <input
              type="file"
              accept=".xlsx, .xls"
              onChange={handleFileChange}
              className="mt-4 block w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100 cursor-pointer mx-auto max-w-xs"
            />
          </div>
        )}

        {loading && (
          <div className="py-8 text-center space-y-2">
            <Loader2 className="w-8 h-8 text-brand-600 animate-spin mx-auto" />
            <p className="text-xs text-gray-500">Validating Excel records & checking profile links...</p>
          </div>
        )}

        {/* Preview Results */}
        {preview && !loading && (
          <div className="space-y-4">
            
            <div className="grid grid-cols-3 gap-3">
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800">
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Valid Records</p>
                <h4 className="text-2xl font-black text-emerald-800 dark:text-emerald-200 mt-1">{preview.valid_count}</h4>
              </div>
              <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800">
                <p className="text-xs font-semibold text-rose-700 dark:text-rose-300">Invalid / Duplicates</p>
                <h4 className="text-2xl font-black text-rose-800 dark:text-rose-200 mt-1">{preview.invalid_count}</h4>
              </div>
              <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800">
                <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">Total Rows</p>
                <h4 className="text-2xl font-black text-blue-800 dark:text-blue-200 mt-1">{preview.total_rows}</h4>
              </div>
            </div>

            {/* Invalid rows table */}
            {preview.invalid_rows && preview.invalid_rows.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-bold text-xs text-rose-600 dark:text-rose-400">Validation Errors Breakdown:</h4>
                <div className="max-h-40 overflow-y-auto border rounded-xl divide-y text-xs border-rose-200 dark:border-rose-900/60">
                  {preview.invalid_rows.map((inv: any, i: int) => (
                    <div key={i} className="p-2.5 flex items-center justify-between text-rose-800 dark:text-rose-300 bg-rose-50/50 dark:bg-rose-950/30">
                      <span>Row {inv.row}: <b>{inv.reg_no || 'No Reg'}</b> ({inv.name || 'No Name'})</span>
                      <span className="font-semibold">{inv.errors}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-800">
              <button
                onClick={() => { setPreview(null); setFile(null); }}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                Reset & Change File
              </button>
              <button
                onClick={handleCommit}
                disabled={preview.valid_count === 0}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-emerald-600/30"
              >
                Confirm Import ({preview.valid_count} Students)
              </button>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};
