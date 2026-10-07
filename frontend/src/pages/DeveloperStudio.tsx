import React, { useState, useEffect } from 'react';
import { 
  FileCode, Save, RefreshCw, Folder, File, ChevronRight, ChevronDown, 
  Terminal, AlertTriangle, X, ArrowLeft
} from 'lucide-react';
import api from '../services/api';
import { useNotification } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { createPortal } from 'react-dom';

interface DeveloperStudioProps {
  onClose?: () => void;
}

export const DeveloperStudio: React.FC<DeveloperStudioProps> = ({ onClose }) => {
  const [currentPath, setCurrentPath] = useState('');
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [editStartTime, setEditStartTime] = useState<number | null>(null);
  const [isBinary, setIsBinary] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set(['']));
  const [showMobileSidebar, setShowMobileSidebar] = useState(true);
  
  const { notify } = useNotification();
  const { user } = useAuth();

  const handleExit = () => {
    if (onClose) {
      onClose();
    } else {
      try {
        if (window.history && window.history.replaceState) {
          window.history.replaceState(null, '', '#/dashboard');
        } else {
          window.location.hash = '#/dashboard';
        }
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      } catch (_e) {
        window.location.hash = '#/dashboard';
      }
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleExit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const isAdmin = ['admin', 'super admin', 'administrator', 'super_admin'].includes(user?.role?.toLowerCase() || '');

  useEffect(() => {
    if (isAdmin) {
      fetchFiles('');
    }
  }, [isAdmin]);

  const fetchFiles = async (dirPath: string) => {
    setLoading(true);
    try {
      const res = await api.get(`/dev-studio/tree?path=${encodeURIComponent(dirPath)}`);
      if (res.data) {
        setFiles(prev => {
          const others = prev.filter(p => !p.path.startsWith(dirPath + (dirPath ? '/' : '')));
          return [...others, ...res.data];
        });
      }
    } catch (err: any) {
      notify.error('Directory Error', err.response?.data?.detail || 'Failed to fetch directory');
    } finally {
      setLoading(false);
    }
  };

  const loadFile = async (filePath: string) => {
    setLoading(true);
    setSelectedFile(filePath);
    setIsBinary(false);
    try {
      const res = await api.get(`/dev-studio/file?path=${encodeURIComponent(filePath)}`);
      if (res.data) {
        setFileContent(res.data.content);
        setEditStartTime(Date.now());
      }
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      if (detail === 'Cannot read binary file') {
        setIsBinary(true);
        setFileContent('// This is a binary file (e.g. image, pdf, docx, etc.)\n// It cannot be viewed or edited in the Developer Studio.\n\n// We will now attempt to download this file automatically...');
        
        // Trigger automatic download
        const downloadUrl = `/api/dev-studio/download?path=${encodeURIComponent(filePath)}`;
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = filePath.split('/').pop() || 'download';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        notify.info('Downloading File', `Starting download for ${filePath.split('/').pop()}`);
      } else {
        notify.error('File Error', detail || 'Failed to read file');
        setFileContent('');
      }
    } finally {
      setLoading(false);
    }
  };

  const saveFile = async () => {
    if (!selectedFile) return;
    setSaving(true);
    try {
      const duration = editStartTime ? Math.round((Date.now() - editStartTime) / 1000) : 0;
      await api.post('/dev-studio/file', { 
        path: selectedFile, 
        content: fileContent,
        duration_seconds: duration
      });
      notify.success('Saved & Audited', `${selectedFile} saved successfully.`);
      setEditStartTime(Date.now()); // Reset timer after save
    } catch (err: any) {
      notify.error('Save Failed', err.response?.data?.detail || 'Failed to save file');
    } finally {
      setSaving(false);
    }
  };

  const toggleDir = (dirPath: string) => {
    const newExpanded = new Set(expandedDirs);
    if (newExpanded.has(dirPath)) {
      newExpanded.delete(dirPath);
    } else {
      newExpanded.add(dirPath);
      fetchFiles(dirPath);
    }
    setExpandedDirs(newExpanded);
  };

  if (!isAdmin) {
    return (
      <div className="p-8 text-center">
        <AlertTriangle className="mx-auto h-12 w-12 text-red-500 mb-4" />
        <h2 className="text-xl font-bold">Access Denied</h2>
        <p className="text-slate-500">Developer Studio is restricted to system administrators.</p>
      </div>
    );
  }

  // Recursive tree renderer
  const renderTree = (parentPath: string, depth = 0) => {
    const children = files.filter(f => {
      const parts = f.path.split('/');
      const parentParts = parentPath ? parentPath.split('/') : [];
      if (parts.length !== (parentPath ? parentParts.length + 1 : 1)) return false;
      if (parentPath === '') return true;
      return f.path.startsWith(parentPath + '/');
    });

    return children.map((item) => {
      const isExpanded = expandedDirs.has(item.path);
      const isSelected = selectedFile === item.path;

      return (
        <div key={item.path} className="w-full">
          <div 
            className={`flex items-center gap-2 py-1.5 px-2 rounded cursor-pointer text-xs sm:text-sm select-none transition-colors ${
              isSelected ? 'bg-brand-500/20 text-brand-300 font-bold' : 'hover:bg-slate-800 text-slate-300'
            }`}
            style={{ paddingLeft: `${depth * 1.25 + 0.5}rem` }}
            onClick={() => {
              if (item.is_dir) {
                toggleDir(item.path);
              } else {
                loadFile(item.path);
                setShowMobileSidebar(false); // Hide sidebar on mobile when a file is selected
              }
            }}
          >
            {item.is_dir ? (
              isExpanded ? <ChevronDown className="w-4 h-4 shrink-0 text-slate-400" /> : <ChevronRight className="w-4 h-4 shrink-0 text-slate-400" />
            ) : (
              <div className="w-4 h-4 shrink-0" />
            )}
            
            {item.is_dir ? (
              <Folder className="w-4 h-4 text-blue-400 shrink-0" />
            ) : (
              <File className="w-4 h-4 text-slate-400 shrink-0" />
            )}
            
            <span className="truncate flex-1">{item.name}</span>
          </div>
          
          {item.is_dir && isExpanded && renderTree(item.path, depth + 1)}
        </div>
      );
    });
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[999999] flex flex-col bg-slate-950 overflow-hidden text-slate-200 w-full h-full">
      
      {/* Header */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 border-b border-slate-800 bg-slate-900 shrink-0 gap-2 overflow-x-auto custom-scrollbar">
        {/* Left Section: Back Button + Terminal Icon + Title + Badge */}
        <div className="flex items-center gap-2 min-w-0 shrink-0">
          <button
            onClick={handleExit}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors shrink-0 cursor-pointer border border-slate-700 active:scale-95"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-4 h-4 text-brand-400 shrink-0" />
            <span className="hidden sm:inline">Back</span>
          </button>

          <div className="h-4 w-[1px] bg-slate-800 mx-0.5 shrink-0 hidden sm:block" />

          <Terminal className="w-4 h-4 sm:w-5 sm:h-5 text-brand-400 shrink-0 hidden sm:block" />
          
          <h2 className="text-xs sm:text-base font-bold text-white tracking-wide truncate max-w-[110px] xs:max-w-[150px] sm:max-w-none">
            Developer Studio
          </h2>
          
          <span className="px-1.5 sm:px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-extrabold bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase tracking-wider shrink-0">
            <span className="sm:hidden">LIVE</span>
            <span className="hidden sm:inline">LIVE PRODUCTION EDIT</span>
          </span>
        </div>

        {/* Right Section: Mobile Explorer Toggle + Audit Report + Save File + Exit */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {/* Mobile Explorer Toggle */}
          <button
            onClick={() => setShowMobileSidebar(!showMobileSidebar)}
            className={`md:hidden flex items-center gap-1 px-2 py-1.5 rounded-lg border text-xs font-bold transition-colors cursor-pointer ${
              showMobileSidebar
                ? 'bg-brand-500/20 text-brand-300 border-brand-500/40'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
            }`}
          >
            <Folder className="w-3.5 h-3.5 text-blue-400" />
            <span>{showMobileSidebar ? 'Editor' : 'Files'}</span>
          </button>

          <button
            onClick={async () => {
              try {
                notify.info('Audit Report', 'Preparing Developer Studio audit report...');
                const res = await api.get('/dev-studio/audit-report', { responseType: 'blob' });
                const blob = new Blob([res.data], { type: 'application/json' });
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', 'Developer_Studio_Audit_Report.json');
                document.body.appendChild(link);
                link.click();
                link.remove();
                window.URL.revokeObjectURL(url);
                notify.success('Downloaded', 'Developer Studio audit report downloaded successfully.');
              } catch (err) {
                // Fallback direct URL download
                const link = document.createElement('a');
                link.href = '/api/dev-studio/audit-report';
                link.download = 'Developer_Studio_Audit_Report.json';
                document.body.appendChild(link);
                link.click();
                link.remove();
              }
            }}
            className="flex items-center gap-1 px-2 sm:px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 rounded-lg font-bold text-xs transition-colors shrink-0 cursor-pointer"
            title="Download Audit Report"
          >
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">Audit Report</span>
            <span className="sm:hidden text-[10px]">Audit</span>
          </button>

          {selectedFile && (
            <button
              onClick={saveFile}
              disabled={saving || isBinary}
              className="flex items-center gap-1.5 px-2.5 sm:px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-xs sm:text-sm transition-all disabled:opacity-50 shrink-0 cursor-pointer"
            >
              {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>Save</span>
            </button>
          )}

          <button 
            onClick={handleExit} 
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer shrink-0"
            title="Exit Developer Studio"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </div>

      {/* Main Area */}
      <div className="flex flex-1 overflow-hidden relative w-full">
        
        {/* Sidebar (File Tree) */}
        <div className={`
          ${showMobileSidebar ? 'flex' : 'hidden'} md:flex
          w-full md:w-64 flex-col bg-slate-900 border-r border-slate-800 overflow-hidden
          absolute md:relative inset-0 md:inset-auto z-20 md:z-auto
        `}>
          <div className="p-3 border-b border-slate-800 flex justify-between items-center bg-slate-900">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Folder className="w-3.5 h-3.5 text-blue-400" />
              Project Files
            </span>
            <div className="flex items-center gap-2">
              <button onClick={() => fetchFiles('')} className="p-1 hover:bg-slate-800 rounded text-slate-400" title="Refresh files">
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button 
                onClick={() => setShowMobileSidebar(false)} 
                className="md:hidden p-1 hover:bg-slate-800 rounded text-slate-400"
                title="Hide files"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-slate-700">
            {renderTree('')}
          </div>
        </div>

        {/* Editor Area */}
        <div className={`
          ${!showMobileSidebar ? 'flex' : 'hidden'} md:flex
          flex-1 flex-col bg-slate-950 overflow-hidden relative w-full
        `}>
          {selectedFile ? (
            <>
              <div className="px-3 sm:px-4 py-2 bg-slate-900/50 border-b border-slate-800 flex items-center justify-between gap-2 overflow-x-auto">
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    onClick={() => setShowMobileSidebar(true)}
                    className="md:hidden flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-bold shrink-0 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 text-blue-400" />
                    <span>Files</span>
                  </button>
                  <FileCode className="w-4 h-4 text-brand-400 shrink-0" />
                  <span className="text-xs sm:text-sm font-mono text-slate-300 truncate">{selectedFile}</span>
                </div>
                <button
                  onClick={() => { setSelectedFile(null); setFileContent(''); }}
                  className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors ml-auto cursor-pointer"
                  title="Close file"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <textarea
                value={fileContent}
                onChange={(e) => setFileContent(e.target.value)}
                readOnly={isBinary}
                className={`flex-1 w-full p-3 sm:p-4 bg-transparent text-slate-200 font-mono text-xs sm:text-sm leading-relaxed resize-none focus:outline-none scrollbar-thin scrollbar-thumb-slate-700 ${isBinary ? 'opacity-50 italic' : ''}`}
                spellCheck="false"
                style={{ tabSize: 2 }}
                onKeyDown={(e) => {
                  if (isBinary) return;
                  if (e.key === 'Tab') {
                    e.preventDefault();
                    const start = e.currentTarget.selectionStart;
                    const end = e.currentTarget.selectionEnd;
                    const value = e.currentTarget.value;
                    setFileContent(value.substring(0, start) + '  ' + value.substring(end));
                    setTimeout(() => {
                      e.currentTarget.selectionStart = e.currentTarget.selectionEnd = start + 2;
                    }, 0);
                  }
                  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                    e.preventDefault();
                    saveFile();
                  }
                }}
              />
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-500">
              <FileCode className="w-12 h-12 sm:w-16 sm:h-16 mb-4 opacity-20" />
              <p className="text-sm sm:text-lg font-semibold text-slate-400">Select a file from the explorer to edit</p>
              <p className="text-xs sm:text-sm mt-2 opacity-70 max-w-sm">Changes made here will be reflected live in production (HMR enabled)</p>
              <button
                onClick={() => setShowMobileSidebar(true)}
                className="md:hidden mt-4 px-4 py-2 rounded-xl bg-brand-500/20 text-brand-300 border border-brand-500/30 text-xs font-bold flex items-center gap-2 cursor-pointer"
              >
                <Folder className="w-4 h-4 text-blue-400" />
                <span>Open File Explorer</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
