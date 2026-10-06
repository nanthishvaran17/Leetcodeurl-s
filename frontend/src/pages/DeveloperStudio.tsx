import React, { useState, useEffect } from 'react';
import { FileCode, Save, RefreshCw, Folder, File, ChevronRight, ChevronDown, Terminal, AlertTriangle, X } from 'lucide-react';
import api from '../services/api';
import { useNotification } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';

import { createPortal } from 'react-dom';

export const DeveloperStudio: React.FC = () => {
  const [currentPath, setCurrentPath] = useState('');
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [editStartTime, setEditStartTime] = useState<number | null>(null);
  const [isBinary, setIsBinary] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set(['']));
  
  const { notify } = useNotification();
  const { user } = useAuth();

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

    return children.map((item, idx) => {
      const isExpanded = expandedDirs.has(item.path);
      const isSelected = selectedFile === item.path;

      return (
        <div key={item.path} className="w-full">
          <div 
            className={`flex items-center gap-2 py-1.5 px-2 rounded cursor-pointer text-sm select-none transition-colors ${
              isSelected ? 'bg-brand-500/20 text-brand-300' : 'hover:bg-slate-800 text-slate-300'
            }`}
            style={{ paddingLeft: `${depth * 1.5 + 0.5}rem` }}
            onClick={() => {
              if (item.is_dir) toggleDir(item.path);
              else loadFile(item.path);
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
    <div className="fixed inset-0 z-[999999] flex flex-col bg-slate-950 overflow-hidden text-slate-200">
      
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-slate-900 shrink-0">
        <div className="flex items-center gap-3">
          <Terminal className="w-5 h-5 text-brand-400" />
          <h2 className="text-lg font-bold text-white tracking-wide">Developer Studio</h2>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase tracking-widest">
            Live Production Edit
          </span>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              const link = document.createElement('a');
              link.href = '/api/dev-studio/audit-report';
              link.download = 'Developer_Studio_Audit_Report.json';
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              notify.info('Audit Report', 'Downloading the Developer Studio edit audit report...');
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 rounded font-bold text-xs transition-colors"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Audit Report
          </button>
          
          {selectedFile && (
            <button
              onClick={saveFile}
              disabled={saving || isBinary}
              className="flex items-center gap-2 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-sm transition-all disabled:opacity-50"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save File
            </button>
          )}
          <button 
            onClick={() => window.location.reload()} 
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
            title="Exit Developer Studio"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Area */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Sidebar (File Tree) */}
        <div className="w-64 flex flex-col bg-slate-900 border-r border-slate-700 overflow-hidden">
          <div className="p-3 border-b border-slate-800 flex justify-between items-center">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Project Files</span>
            <button onClick={() => fetchFiles('')} className="p-1 hover:bg-slate-800 rounded text-slate-400">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-slate-700">
            {renderTree('')}
          </div>
        </div>

        {/* Editor Area */}
        <div className="flex-1 flex flex-col bg-slate-950 overflow-hidden relative">
          {selectedFile ? (
            <>
              <div className="px-4 py-2 bg-slate-900/50 border-b border-slate-800 flex items-center gap-2">
                <FileCode className="w-4 h-4 text-brand-400" />
                <span className="text-sm font-mono text-slate-300">{selectedFile}</span>
              </div>
              <textarea
                value={fileContent}
                onChange={(e) => setFileContent(e.target.value)}
                readOnly={isBinary}
                className={`flex-1 w-full p-4 bg-transparent text-slate-200 font-mono text-sm leading-relaxed resize-none focus:outline-none scrollbar-thin scrollbar-thumb-slate-700 ${isBinary ? 'opacity-50 italic' : ''}`}
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
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
              <FileCode className="w-16 h-16 mb-4 opacity-20" />
              <p className="text-lg">Select a file from the explorer to edit</p>
              <p className="text-sm mt-2 opacity-70">Changes made here will be reflected live (HMR enabled)</p>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
