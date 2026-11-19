import React, { useState, useRef } from 'react';
import { Tracker, TrackerFolder, UserAccount, SiteVisitRecord } from '../types/tracker';
import {
  HardDrive,
  Upload,
  Download,
  FileCode,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  X,
  FileSpreadsheet,
  Layers,
  Sparkles,
  Zap,
  RefreshCw,
  FolderOpen,
  ArrowRight,
  ExternalLink,
  Laptop,
} from 'lucide-react';
import { downloadStandaloneViewerHtml } from '../utils/standaloneViewerGenerator';

interface ParsedBackupInfo {
  fileName: string;
  fileSize: string;
  exportedAt?: string;
  version?: string;
  trackers: Tracker[];
  folders: TrackerFolder[];
  users: UserAccount[];
  visits: SiteVisitRecord[];
  totalRows: number;
}

interface LocalVersionModalProps {
  isOpen: boolean;
  onClose: () => void;
  trackers: Tracker[];
  folders: TrackerFolder[];
  users: UserAccount[];
  visits: SiteVisitRecord[];
  isLocalMode: boolean;
  onActivateLocalMode: (data: {
    trackers: Tracker[];
    folders: TrackerFolder[];
    users: UserAccount[];
    visits: SiteVisitRecord[];
    backupName: string;
  }) => void;
  onExitLocalMode?: () => void;
  onRestoreToCloud?: (data: {
    trackers: Tracker[];
    folders: TrackerFolder[];
    users: UserAccount[];
    visits: SiteVisitRecord[];
  }) => void;
}

export const LocalVersionModal: React.FC<LocalVersionModalProps> = ({
  isOpen,
  onClose,
  trackers,
  folders,
  users,
  visits,
  isLocalMode,
  onActivateLocalMode,
  onExitLocalMode,
  onRestoreToCloud,
}) => {
  if (!isOpen) return null;

  const [dragOver, setDragOver] = useState(false);
  const [parsedBackup, setParsedBackup] = useState<ParsedBackupInfo | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'open_file' | 'current_data' | 'standalone_html'>('open_file');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalCurrentRows = trackers.reduce((sum, t) => sum + (t.rows ? t.rows.length : 0), 0);

  const processFile = (file: File) => {
    setParseError(null);
    setIsProcessing(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text);

        let extractedTrackers: Tracker[] | null = null;
        let extractedFolders: TrackerFolder[] = folders;
        let extractedUsers: UserAccount[] = users;
        let extractedVisits: SiteVisitRecord[] = visits;
        let exportedAt: string | undefined = parsed?.exportedAt;
        let version: string | undefined = parsed?.version;

        if (parsed?.data && Array.isArray(parsed.data.trackers)) {
          extractedTrackers = parsed.data.trackers;
          if (Array.isArray(parsed.data.folders)) extractedFolders = parsed.data.folders;
          if (Array.isArray(parsed.data.users)) extractedUsers = parsed.data.users;
          if (Array.isArray(parsed.data.visits)) extractedVisits = parsed.data.visits;
        } else if (Array.isArray(parsed?.trackers)) {
          extractedTrackers = parsed.trackers;
          if (Array.isArray(parsed.folders)) extractedFolders = parsed.folders;
          if (Array.isArray(parsed.users)) extractedUsers = parsed.users;
          if (Array.isArray(parsed.visits)) extractedVisits = parsed.visits;
        } else if (Array.isArray(parsed)) {
          extractedTrackers = parsed;
        }

        if (!extractedTrackers || extractedTrackers.length === 0) {
          setParseError('The file does not contain a valid tracker dataset or tracker sheets.');
          setIsProcessing(false);
          return;
        }

        const sizeStr = (file.size / 1024).toFixed(1) + ' KB';
        const totalRows = extractedTrackers.reduce((acc, t) => acc + (t.rows ? t.rows.length : 0), 0);

        setParsedBackup({
          fileName: file.name,
          fileSize: sizeStr,
          exportedAt,
          version,
          trackers: extractedTrackers,
          folders: extractedFolders,
          users: extractedUsers,
          visits: extractedVisits,
          totalRows,
        });
        setIsProcessing(false);
      } catch (err: any) {
        console.error('Local backup parse error:', err);
        setParseError('Invalid JSON file format. Please upload a valid GEM PRO backup .json file.');
        setIsProcessing(false);
      }
    };
    reader.onerror = () => {
      setParseError('Failed to read file from disk.');
      setIsProcessing(false);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleLaunchLocalViewer = () => {
    if (!parsedBackup) return;
    onActivateLocalMode({
      trackers: parsedBackup.trackers,
      folders: parsedBackup.folders,
      users: parsedBackup.users,
      visits: parsedBackup.visits,
      backupName: parsedBackup.fileName,
    });
    onClose();
  };

  const handleLaunchCurrentInLocal = () => {
    onActivateLocalMode({
      trackers,
      folders,
      users,
      visits,
      backupName: 'Current Local Snapshot (' + new Date().toLocaleDateString() + ')',
    });
    onClose();
  };

  const handleDownloadStandaloneHtml = (customTrackers?: Tracker[]) => {
    const targetTrackers = customTrackers || (parsedBackup ? parsedBackup.trackers : trackers);
    const targetFolders = parsedBackup ? parsedBackup.folders : folders;
    const targetUsers = parsedBackup ? parsedBackup.users : users;
    const targetVisits = parsedBackup ? parsedBackup.visits : visits;

    downloadStandaloneViewerHtml({
      trackers: targetTrackers,
      folders: targetFolders,
      users: targetUsers,
      visits: targetVisits,
      sourceName: parsedBackup ? parsedBackup.fileName : 'GEM PRO Offline Backup',
    });
  };

  const handleDownloadJsonBackup = (customTrackers?: Tracker[], customName?: string) => {
    const targetTrackers = customTrackers || (parsedBackup ? parsedBackup.trackers : trackers);
    const targetFolders = parsedBackup ? parsedBackup.folders : folders;
    const targetUsers = parsedBackup ? parsedBackup.users : users;
    const targetVisits = parsedBackup ? parsedBackup.visits : visits;

    const payload = {
      version: '1.4.0',
      exportedAt: new Date().toISOString(),
      generator: 'GEM PRO Generic Tracker System (Local Offline Edition)',
      data: {
        trackers: targetTrackers,
        folders: targetFolders,
        users: targetUsers,
        visits: targetVisits,
      },
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    a.href = url;
    a.download = customName || `GEM_PRO_Offline_Backup_${timestamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-slate-200">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-sky-950 to-indigo-950 text-sky-400 border border-sky-800 shrink-0">
              <Laptop className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Local Version &amp; Offline Backup Viewer</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-sky-950 text-sky-300 border border-sky-700">
                  OFFLINE
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                View, inspect, and edit your trackers completely locally using any backup file.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Mode Status Indicator */}
        <div className={`px-6 py-2.5 text-xs flex items-center justify-between border-b ${
          isLocalMode
            ? 'bg-amber-950/70 border-amber-800/80 text-amber-200'
            : 'bg-slate-950 border-slate-800 text-slate-300'
        }`}>
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${isLocalMode ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
            <span>
              Current Active Mode:{' '}
              <strong className={isLocalMode ? 'text-amber-300' : 'text-emerald-400'}>
                {isLocalMode ? '⚡ Local Offline Version' : '☁️ Cloud Sync Active'}
              </strong>
            </span>
          </div>
          {isLocalMode && onExitLocalMode && (
            <button
              type="button"
              onClick={() => {
                onExitLocalMode();
                onClose();
              }}
              className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-white transition-colors cursor-pointer"
            >
              Exit to Cloud Mode &rarr;
            </button>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center border-b border-slate-800 bg-slate-950 px-6 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('open_file')}
            className={`py-2.5 px-3 border-b-2 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'open_file'
                ? 'border-sky-500 text-sky-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Open Backup File (.json)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('current_data')}
            className={`py-2.5 px-3 border-b-2 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'current_data'
                ? 'border-sky-500 text-sky-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>Current In-App Data ({totalCurrentRows} rows)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('standalone_html')}
            className={`py-2.5 px-3 border-b-2 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'standalone_html'
                ? 'border-sky-500 text-sky-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>Standalone HTML Viewer</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* TAB 1: Open Backup File */}
          {activeTab === 'open_file' && (
            <div className="space-y-4">
              {/* Drag and Drop Box */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                  dragOver
                    ? 'border-sky-400 bg-sky-950/40'
                    : 'border-slate-700 bg-slate-950/60 hover:border-slate-600 hover:bg-slate-950'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".json"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <div className="flex flex-col items-center justify-center gap-2">
                  <div className="p-3 rounded-full bg-slate-800 text-sky-400">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div className="font-bold text-white text-sm">
                    Drag and drop your backup file here, or click to browse
                  </div>
                  <p className="text-xs text-slate-400 max-w-sm">
                    Supports GEM PRO backup JSON exports, Google Drive backup snapshots, and exported tracker archives.
                  </p>
                </div>
              </div>

              {parseError && (
                <div className="p-3 rounded-lg bg-rose-950/80 border border-rose-800 text-xs text-rose-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{parseError}</span>
                </div>
              )}

              {/* Parsed File Preview Card */}
              {parsedBackup && (
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-800">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-white text-xs">{parsedBackup.fileName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          Size: {parsedBackup.fileSize} {parsedBackup.exportedAt ? `· Exported: ${new Date(parsedBackup.exportedAt).toLocaleDateString()}` : ''}
                        </div>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-[10px] font-bold font-mono">
                      VALID BACKUP
                    </span>
                  </div>

                  {/* Summary Metric Counters */}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                      <div className="text-[10px] text-slate-400 uppercase">Sheets</div>
                      <div className="text-base font-bold text-sky-400 font-mono mt-0.5">
                        {parsedBackup.trackers.length}
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                      <div className="text-[10px] text-slate-400 uppercase">Total Sites</div>
                      <div className="text-base font-bold text-emerald-400 font-mono mt-0.5">
                        {parsedBackup.totalRows.toLocaleString()}
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                      <div className="text-[10px] text-slate-400 uppercase">Site Visits</div>
                      <div className="text-base font-bold text-amber-400 font-mono mt-0.5">
                        {parsedBackup.visits ? parsedBackup.visits.length : 0}
                      </div>
                    </div>
                  </div>

                  {/* Tracker Sheets Listing */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Included Tracker Sheets:
                    </span>
                    <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                      {parsedBackup.trackers.map((t, idx) => (
                        <div
                          key={t.id || idx}
                          className="flex items-center justify-between p-1.5 rounded bg-slate-900/80 border border-slate-800/80 text-xs"
                        >
                          <span className="font-semibold text-slate-200 truncate max-w-[280px]">
                            📋 {t.name}
                          </span>
                          <span className="text-[10px] font-mono font-bold text-sky-400">
                            {t.rows ? t.rows.length : 0} rows
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions for Loaded Backup */}
                  <div className="pt-2 flex flex-wrap items-center justify-end gap-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => handleDownloadStandaloneHtml(parsedBackup.trackers)}
                      className="px-3 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
                      title="Download as a single-file offline HTML viewer"
                    >
                      <FileCode className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Download HTML Viewer</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleLaunchLocalViewer}
                      className="px-4 py-2 rounded-lg text-xs font-bold bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white transition-all flex items-center gap-1.5 shadow-md shadow-sky-950 cursor-pointer"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>Open in Local Offline Mode</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Current In-App Data */}
          {activeTab === 'current_data' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-sky-400" />
                    <span className="font-bold text-white text-xs">Current Active Sheet Workspace</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">
                    {trackers.length} sheets · {totalCurrentRows} total rows
                  </span>
                </div>

                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {trackers.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="w-2 h-2 rounded-full bg-sky-400 shrink-0" />
                        <span className="font-semibold text-slate-200 truncate">{t.name}</span>
                      </div>
                      <span className="text-xs font-mono font-bold text-sky-400 bg-sky-950 px-2 py-0.5 rounded border border-sky-800">
                        {t.rows ? t.rows.length : 0} rows
                      </span>
                    </div>
                  ))}
                </div>

                <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => handleDownloadJsonBackup(trackers)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Download Backup (.json)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleLaunchCurrentInLocal}
                    className="px-4 py-2 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-500 text-black transition-colors flex items-center gap-1.5 shadow-md shadow-amber-950 cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>Switch to Local Offline Mode</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Standalone Portable HTML Viewer */}
          {activeTab === 'standalone_html' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-950/60 to-slate-950 border border-indigo-800/80 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-indigo-950 text-indigo-400 border border-indigo-700 shrink-0">
                    <FileCode className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Single-File Portable HTML Viewer</h4>
                    <p className="text-xs text-indigo-200/80 mt-0.5">
                      Double-click and open anywhere. 100% self-contained, no installation or internet needed.
                    </p>
                  </div>
                </div>

                <div className="space-y-2 text-xs text-slate-300 p-3.5 rounded-lg bg-slate-950/80 border border-slate-800">
                  <div className="font-bold text-sky-400 text-xs mb-1">
                    ALL PROPERTIES &amp; FUNCTIONS 100% COMPLETED IN STANDALONE:
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                    <div className="flex items-start gap-1.5">
                      <span className="text-emerald-400 font-bold shrink-0">✓</span>
                      <span><strong>DATA 1 Dossier Drawer:</strong> Site ID, Name, Region, Exact Address, Landlord, Handler, Coordinates &amp; Notes.</span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <span className="text-emerald-400 font-bold shrink-0">✓</span>
                      <span><strong>DATA 2 Tech Dataset:</strong> Azimuth sectors, carrier frequencies, fiber backhaul, genset, and QC status.</span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <span className="text-emerald-400 font-bold shrink-0">✓</span>
                      <span><strong>Day-by-Day SLA Tracker:</strong> Day 0 trigger date, health badges, milestones roadmap &amp; daily remarks log.</span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <span className="text-emerald-400 font-bold shrink-0">✓</span>
                      <span><strong>Legal Fees Checklist:</strong> Vouchers in ₱ (PHP), categories, statuses, total calculation &amp; item CRUD.</span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <span className="text-emerald-400 font-bold shrink-0">✓</span>
                      <span><strong>Delete Actions &amp; Undo:</strong> Individual Del trash can, Delete ALL/Filtered rows with instant Undo toast.</span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <span className="text-emerald-400 font-bold shrink-0">✓</span>
                      <span><strong>Inline Cell Editing:</strong> Double-click any cell to edit numbers, dates, status, or text in real-time.</span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <span className="text-emerald-400 font-bold shrink-0">✓</span>
                      <span><strong>Summary / Totals Row:</strong> Pinned Σ TOP row with totals in ₱, averages in %, and row counts.</span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <span className="text-emerald-400 font-bold shrink-0">✓</span>
                      <span><strong>Spreadsheet &amp; JSON Export:</strong> Export to Excel (.csv) and Save Backup (.json) directly offline.</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleDownloadStandaloneHtml()}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-all flex items-center gap-2 shadow-lg shadow-indigo-950 cursor-pointer active:scale-95"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Standalone HTML File (.html)</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Local mode never overwrites your cloud database without your explicit confirmation.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
