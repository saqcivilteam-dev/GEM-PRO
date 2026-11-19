import React, { useState } from 'react';
import { SlaHistoryRecord, SlaHistoryColumn } from '../types/tracker';
import {
  readExcelFile,
  normalizeToStandardDate,
  parseExcelClipboardText,
  getLocalDateString,
  formatDateDisplay,
} from '../utils/excelUtils';
import * as XLSX from 'xlsx';
import {
  X,
  Upload,
  ClipboardPaste,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertCircle,
  Table,
  Check,
  Calendar,
} from 'lucide-react';

interface ImportSlaHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  siteId: string;
  columns: SlaHistoryColumn[];
  onImportRecords: (newRecords: SlaHistoryRecord[], mode: 'append' | 'replace') => void;
}

export const ImportSlaHistoryModal: React.FC<ImportSlaHistoryModalProps> = ({
  isOpen,
  onClose,
  siteId,
  columns,
  onImportRecords,
}) => {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('upload');
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [pasteText, setPasteText] = useState('');
  const [previewRecords, setPreviewRecords] = useState<SlaHistoryRecord[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const visibleCols = columns.filter((c) => c.visible);

  // Helper to normalize and map headers
  const simplify = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  const mapRowToRecord = (rowValues: any[], headers: string[]): SlaHistoryRecord => {
    const record: Partial<SlaHistoryRecord> = {
      id: 'hist_imp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      customValues: {},
    };

    // Pre-match header indices
    const matchedIndices: Record<string, number> = {};
    visibleCols.forEach((col) => {
      const colLabel = simplify(col.label);
      const colId = simplify(col.id);

      const foundIdx = headers.findIndex((h) => {
        const hSimp = simplify(h);
        if (!hSimp) return false;
        if (hSimp === colLabel || hSimp === colId) return true;
        if (col.id === 'date' && (hSimp.includes('date') || hSimp.includes('day'))) return true;
        if (col.id === 'status' && (hSimp.includes('status') || hSimp.includes('milestone'))) return true;
        if (col.id === 'progressUpdate' && (hSimp.includes('progress') || hSimp.includes('update'))) return true;
        if (col.id === 'detailsRemarks' && (hSimp.includes('remark') || hSimp.includes('detail') || hSimp.includes('note'))) return true;
        if (col.id === 'trackingRule' && (hSimp.includes('rule') || hSimp.includes('sla') || hSimp.includes('target'))) return true;
        if (col.id === 'loggedBy' && (hSimp.includes('pic') || hSimp.includes('staff') || hSimp.includes('logged') || hSimp.includes('handler'))) return true;
        return false;
      });

      if (foundIdx !== -1) {
        matchedIndices[col.id] = foundIdx;
      }
    });

    // Populate standard and custom fields
    visibleCols.forEach((col, cIdx) => {
      const idx = matchedIndices[col.id] !== undefined ? matchedIndices[col.id] : cIdx;
      const rawVal = idx < rowValues.length ? rowValues[idx] : undefined;

      if (col.id === 'date') {
        record.date = normalizeToStandardDate(rawVal) || getLocalDateString();
      } else if (col.id === 'status') {
        record.status = String(rawVal || 'Site Hunting').trim();
      } else if (col.id === 'progressUpdate') {
        record.progressUpdate = String(rawVal || 'Progress update logged.').trim();
      } else if (col.id === 'detailsRemarks') {
        record.detailsRemarks = String(rawVal || '').trim();
      } else if (col.id === 'trackingRule') {
        record.trackingRule = String(rawVal || 'Day-to-Day Operation Update').trim();
      } else if (col.id === 'loggedBy') {
        record.loggedBy = String(rawVal || 'SAQCivil Team').trim();
      } else {
        // Custom column
        const cleanVal = col.type === 'date' ? normalizeToStandardDate(rawVal) : rawVal;
        record.customValues![col.id] = cleanVal;
        record[col.id] = cleanVal;
      }
    });

    if (!record.date) record.date = getLocalDateString();
    if (!record.status) record.status = 'Site Hunting';
    if (!record.progressUpdate) record.progressUpdate = 'Imported daily update';
    if (!record.detailsRemarks) record.detailsRemarks = '';
    if (!record.trackingRule) record.trackingRule = 'Day-to-Day Operation Update';
    if (!record.loggedBy) record.loggedBy = 'SAQCivil Team';

    return record as SlaHistoryRecord;
  };

  // Handle Excel/CSV file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMessage(null);

    try {
      const rawData = await readExcelFile(file);
      if (rawData.length < 2) {
        setErrorMessage('File appears empty or contains only a header row.');
        return;
      }

      const headers = rawData[0].map((h) => String(h || '').trim());
      const dataRows = rawData.slice(1).filter((r) => r.some((cell) => cell !== undefined && String(cell).trim() !== ''));

      if (dataRows.length === 0) {
        setErrorMessage('No valid data rows found in the uploaded spreadsheet.');
        return;
      }

      const parsed: SlaHistoryRecord[] = dataRows.map((row) => mapRowToRecord(row, headers));
      setPreviewRecords(parsed);
    } catch (err) {
      setErrorMessage('Failed to read file. Please ensure it is a valid .xlsx or .csv format.');
    }
  };

  // Handle Clipboard Paste
  const handleProcessPasteText = (text: string) => {
    if (!text.trim()) {
      setPreviewRecords([]);
      return;
    }
    setErrorMessage(null);

    try {
      const rows = parseExcelClipboardText(text);
      if (rows.length === 0) {
        setErrorMessage('Clipboard text is empty or could not be parsed.');
        return;
      }

      // Check if first row is header
      const firstRowIsHeader =
        rows.length > 1 &&
        rows[0].some(
          (cell) =>
            simplify(cell).includes('date') ||
            simplify(cell).includes('status') ||
            simplify(cell).includes('progress')
        );

      const headers = firstRowIsHeader
        ? rows[0].map((c) => String(c || '').trim())
        : visibleCols.map((c) => c.label);

      const dataRows = firstRowIsHeader ? rows.slice(1) : rows;
      const validRows = dataRows.filter((r) => r.some((cell) => cell !== undefined && String(cell).trim() !== ''));

      if (validRows.length === 0) {
        setErrorMessage('No valid data rows found in pasted text.');
        return;
      }

      const parsed = validRows.map((r) => mapRowToRecord(r, headers));
      setPreviewRecords(parsed);
    } catch (err) {
      setErrorMessage('Failed to parse clipboard text. Please ensure rows are tab-separated.');
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) {
        setErrorMessage('Clipboard is empty.');
        return;
      }
      setPasteText(text);
      handleProcessPasteText(text);
    } catch (err) {
      setErrorMessage('Please allow clipboard access or paste directly into the box below.');
    }
  };

  // Download Sample Template matching current visible columns
  const handleDownloadTemplate = () => {
    const headers = visibleCols.map((c) => c.label);
    const sampleRow1 = visibleCols.map((c) => {
      if (c.id === 'date' || c.type === 'date') return '2026-03-24';
      if (c.id === 'status' || c.type === 'status') return 'Site Hunting';
      if (c.id === 'progressUpdate' || c.type === 'textarea') return 'Meeting with lessor conducted. Initial lease draft prepared.';
      if (c.id === 'detailsRemarks') return 'Awaiting title deed verification and tax declaration copy.';
      if (c.id === 'trackingRule') return 'Day 0 Start Date';
      if (c.id === 'loggedBy' || c.type === 'staff') return 'JHENG QUINTO';
      if (c.type === 'number') return 25000;
      return 'Sample Data';
    });

    const sampleRow2 = visibleCols.map((c) => {
      if (c.id === 'date' || c.type === 'date') return '2026-03-25';
      if (c.id === 'status' || c.type === 'status') return 'Property Documents';
      if (c.id === 'progressUpdate' || c.type === 'textarea') return 'Civil survey completed by Apex Engineering team.';
      if (c.id === 'detailsRemarks') return 'No boundary disputes observed.';
      if (c.id === 'trackingRule') return 'Day 1 Progress';
      if (c.id === 'loggedBy' || c.type === 'staff') return 'JHENG QUINTO';
      if (c.type === 'number') return 0;
      return 'Sample Data 2';
    });

    const aoa = [
      [`DAY-BY-DAY PROGRESS & SLA IMPORT TEMPLATE — SITE ${siteId}`],
      [`All dates must be formatted in ISO YYYY-MM-DD (e.g. 2026-03-24)`],
      [],
      headers,
      sampleRow1,
      sampleRow2,
    ];

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'DayByDay_Template');
    XLSX.writeFile(wb, `SLA_Import_Template_${siteId}.xlsx`);
  };

  const handleConfirmImport = () => {
    if (previewRecords.length === 0) return;
    onImportRecords(previewRecords, importMode);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 backdrop-blur-xs p-3">
      <div className="relative w-full max-w-3xl flex flex-col rounded-xl bg-slate-900 border border-slate-700 text-slate-100 shadow-2xl max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-sky-950/80 border border-sky-800/80 text-sky-400">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">
                Import Day-by-Day SLA Progress Logs
              </h3>
              <p className="text-[11px] text-slate-400">
                Fast encoding: Upload Excel (.xlsx/.csv) or Paste directly from clipboard
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Top Control Bar: Mode, Tabs, Template */}
        <div className="px-5 py-2.5 bg-slate-950/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Tabs */}
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={`px-3 py-1 rounded-md font-semibold flex items-center gap-1.5 transition-colors ${
                activeTab === 'upload'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Upload Excel (.xlsx / .csv)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('paste')}
              className={`px-3 py-1 rounded-md font-semibold flex items-center gap-1.5 transition-colors ${
                activeTab === 'paste'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ClipboardPaste className="w-3.5 h-3.5" />
              Paste from Clipboard
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Import Mode: Append vs Replace */}
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-md px-2.5 py-1">
              <span className="text-[11px] text-slate-400">Mode:</span>
              <select
                value={importMode}
                onChange={(e) => setImportMode(e.target.value as any)}
                className="bg-transparent text-[11px] text-sky-300 font-bold focus:outline-hidden cursor-pointer"
              >
                <option value="append" className="bg-slate-900 text-white">Append to Timeline</option>
                <option value="replace" className="bg-slate-900 text-white">Replace Existing</option>
              </select>
            </div>

            {/* Template Download */}
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-md font-medium flex items-center gap-1.5 transition-colors text-[11px]"
              title="Download Excel template matching active columns"
            >
              <Download className="w-3.5 h-3.5 text-sky-400" />
              Download Template
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {errorMessage && (
            <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {activeTab === 'upload' ? (
            <div className="p-6 rounded-xl border-2 border-dashed border-slate-700 hover:border-indigo-500 bg-slate-950/40 text-center space-y-3 transition-colors">
              <div className="w-12 h-12 rounded-full bg-indigo-950/80 border border-indigo-700/80 flex items-center justify-center mx-auto text-indigo-400">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">
                  Drop your Excel or CSV file here
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Supports .xlsx, .xls, and .csv files. All dates will be standardized automatically to YYYY-MM-DD.
                </p>
              </div>

              <label className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-xs">
                <Upload className="w-4 h-4" />
                Select Excel File
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <label className="font-semibold text-slate-300">
                  Paste Tab-Separated Data from Excel (Ctrl+V)
                </label>
                <button
                  type="button"
                  onClick={handlePasteFromClipboard}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 rounded text-xs font-semibold flex items-center gap-1 transition-colors"
                >
                  <ClipboardPaste className="w-3.5 h-3.5" />
                  Paste from Clipboard
                </button>
              </div>

              <textarea
                rows={5}
                value={pasteText}
                onChange={(e) => {
                  setPasteText(e.target.value);
                  handleProcessPasteText(e.target.value);
                }}
                placeholder="Paste rows copied directly from Excel here..."
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-hidden focus:border-sky-400"
              />
            </div>
          )}

          {/* Preview Section */}
          {previewRecords.length > 0 && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Parsed Preview: {previewRecords.length} Day-by-Day Record(s) Ready to Import
                </span>
                <span className="text-[11px] text-slate-400">
                  Dates standardized to ISO YYYY-MM-DD
                </span>
              </div>

              <div className="max-h-56 overflow-auto rounded-lg border border-slate-800 bg-slate-950">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 border-b border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400 sticky top-0">
                    <tr>
                      <th className="py-2 px-2.5 w-8 text-center">#</th>
                      {visibleCols.map((col) => (
                        <th key={col.id} className="py-2 px-2.5 truncate">
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-[11px]">
                    {previewRecords.map((r, idx) => (
                      <tr key={r.id || idx} className="hover:bg-slate-900/50">
                        <td className="py-1.5 px-2.5 text-center text-slate-500 font-mono">
                          {idx + 1}
                        </td>
                        {visibleCols.map((col) => {
                          const val =
                            col.id === 'date'
                              ? r.date
                              : col.id === 'status'
                              ? r.status
                              : col.id === 'progressUpdate'
                              ? r.progressUpdate
                              : col.id === 'detailsRemarks'
                              ? r.detailsRemarks
                              : col.id === 'trackingRule'
                              ? r.trackingRule
                              : col.id === 'loggedBy'
                              ? r.loggedBy
                              : r.customValues?.[col.id] || r[col.id] || '';

                          return (
                            <td key={col.id} className="py-1.5 px-2.5 truncate max-w-[200px] text-slate-300">
                              {col.id === 'date' ? (
                                <span className="font-mono text-sky-400">{val}</span>
                              ) : col.id === 'status' ? (
                                <span className="px-1.5 py-0.2 rounded text-[10px] bg-sky-950 text-sky-300 border border-sky-800">
                                  {val}
                                </span>
                              ) : (
                                String(val || '')
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            {previewRecords.length > 0
              ? `${previewRecords.length} records ready to be encoded into Site ${siteId}`
              : 'Select a file or paste data above to preview'}
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={previewRecords.length === 0}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-md text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <Check className="w-3.5 h-3.5" />
              Confirm & Import ({previewRecords.length})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
