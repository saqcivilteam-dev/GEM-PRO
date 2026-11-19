import React, { useState } from 'react';
import { SlaMilestone } from '../types/tracker';
import {
  addDaysToDateString,
  normalizeToStandardDate,
  getLocalDateString,
  readExcelFile,
  parseExcelClipboardText,
  SLA_SCOPE_PRESETS,
  createMilestonesFromTemplate,
} from '../utils/excelUtils';
import { ProjectSlaConfig } from '../types/tracker';
import {
  X,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Check,
  ShieldAlert,
  Calendar,
  Upload,
  ClipboardPaste,
  FileSpreadsheet,
  AlertCircle,
  Clock,
  Sparkles,
} from 'lucide-react';

export interface CustomizeSlaMilestonesModalProps {
  isOpen: boolean;
  onClose: () => void;
  triggerDate: string;
  milestones: SlaMilestone[];
  onSaveMilestones: (newMilestones: SlaMilestone[]) => void;
}

export const STANDARD_TELECOM_SLA_PRESETS: SlaMilestone[] = [
  {
    id: 'm1',
    name: 'Site Hunting (2d SLA)',
    targetDaysFromTrigger: 2,
    targetDate: '',
    status: 'Completed',
  },
  {
    id: 'm2',
    name: 'Securing Property Document (21d SLA)',
    targetDaysFromTrigger: 23, // 2 + 21
    targetDate: '',
    status: 'Completed',
  },
  {
    id: 'm3',
    name: 'Securing Pre-Con (44d SLA)',
    targetDaysFromTrigger: 67, // 23 + 44
    targetDate: '',
    status: 'In Progress',
  },
  {
    id: 'm4',
    name: 'Securing Post-Con (21d SLA)',
    targetDaysFromTrigger: 88, // 67 + 21
    targetDate: '',
    status: 'Pending',
  },
  {
    id: 'm5',
    name: 'FAC Submission (7d SLA / 98d Total)',
    targetDaysFromTrigger: 98, // 98 days from hunting
    targetDate: '',
    status: 'Pending',
  },
  {
    id: 'm6',
    name: 'Site Closed (156d Total SLA)',
    targetDaysFromTrigger: 156, // 156 days from hunting
    targetDate: '',
    status: 'Pending',
  },
];

export const CustomizeSlaMilestonesModal: React.FC<CustomizeSlaMilestonesModalProps> = ({
  isOpen,
  onClose,
  triggerDate,
  milestones,
  onSaveMilestones,
}) => {
  if (!isOpen) return null;

  const stdTrigger = normalizeToStandardDate(triggerDate) || getLocalDateString();

  const [activeTab, setActiveTab] = useState<'edit' | 'import'>('edit');
  const [items, setItems] = useState<SlaMilestone[]>(() => {
    if (Array.isArray(milestones) && milestones.length > 0) {
      return JSON.parse(JSON.stringify(milestones));
    }
    return STANDARD_TELECOM_SLA_PRESETS.map((m) => ({
      ...m,
      targetDate: addDaysToDateString(stdTrigger, m.targetDaysFromTrigger),
    }));
  });

  // Import Tab states
  const [pasteContent, setPasteContent] = useState('');
  const [importFeedback, setImportFeedback] = useState<string | null>(null);

  const handleUpdateItem = (id: string, updates: Partial<SlaMilestone>) => {
    setItems((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        const next = { ...m, ...updates };
        if (updates.targetDaysFromTrigger !== undefined) {
          next.targetDate = addDaysToDateString(stdTrigger, updates.targetDaysFromTrigger);
        }
        return next;
      })
    );
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    setItems((prev) => {
      const next = [...prev];
      const temp = next[index - 1];
      next[index - 1] = next[index];
      next[index] = temp;
      return next;
    });
  };

  const handleMoveDown = (index: number) => {
    if (index === items.length - 1) return;
    setItems((prev) => {
      const next = [...prev];
      const temp = next[index + 1];
      next[index + 1] = next[index];
      next[index] = temp;
      return next;
    });
  };

  const handleDeleteItem = (id: string) => {
    setItems((prev) => prev.filter((m) => m.id !== id));
  };

  const handleAddNewMilestone = () => {
    const lastDay = items.length > 0 ? items[items.length - 1].targetDaysFromTrigger + 14 : 30;
    const newId = 'ms_' + Date.now().toString(36);
    const newMilestone: SlaMilestone = {
      id: newId,
      name: `Custom Stage ${items.length + 1}`,
      targetDaysFromTrigger: lastDay,
      targetDate: addDaysToDateString(stdTrigger, lastDay),
      status: 'Pending',
    };
    setItems((prev) => [...prev, newMilestone]);
  };

  const handleApplyPreset = (preset: ProjectSlaConfig) => {
    const updated = createMilestonesFromTemplate(preset.milestones, stdTrigger);
    setItems(updated);
    setImportFeedback(`Applied preset: ${preset.scopeName} (${preset.targetDays} Days). Click "Save Milestone Configuration" to apply.`);
  };

  const handleResetToStandardSLA = () => {
    const standard = STANDARD_TELECOM_SLA_PRESETS.map((m) => ({
      ...m,
      targetDate: addDaysToDateString(stdTrigger, m.targetDaysFromTrigger),
    }));
    setItems(standard);
    setImportFeedback('Reset milestone stages to Standard Telecom SLA (2d Hunting, 21d Property Docs, 44d Pre-Con, 21d Post-Con, 7d FAC, 156d Site Closed). Click "Save Changes" to apply.');
  };

  const handleSave = () => {
    onSaveMilestones(items);
    onClose();
  };

  // Fast Import parsing
  const handleParseImportRows = (rows: any[][]) => {
    if (rows.length === 0) return;

    const dataRows = rows.length > 1 && isNaN(Number(rows[0][1])) ? rows.slice(1) : rows;
    const parsed: SlaMilestone[] = [];

    dataRows.forEach((r, idx) => {
      if (!r || r.length === 0) return;
      const name = String(r[0] || `Milestone ${idx + 1}`).trim();
      if (!name) return;

      // Check if second column is days or date
      let days = 0;
      let targetDate = '';
      const col2 = r[1];

      if (typeof col2 === 'number') {
        days = col2;
        targetDate = addDaysToDateString(stdTrigger, days);
      } else if (String(col2 || '').includes('-') || String(col2 || '').includes('/')) {
        targetDate = normalizeToStandardDate(col2) || '';
        // Calculate days difference
        if (targetDate) {
          const t1 = new Date(stdTrigger).getTime();
          const t2 = new Date(targetDate).getTime();
          days = Math.max(0, Math.round((t2 - t1) / (1000 * 60 * 60 * 24)));
        }
      } else {
        const parsedNum = parseInt(String(col2 || '').replace(/[^\d]/g, ''), 10);
        days = isNaN(parsedNum) ? (idx + 1) * 14 : parsedNum;
        targetDate = addDaysToDateString(stdTrigger, days);
      }

      const statusRaw = String(r[2] || 'Pending').toLowerCase();
      let status: SlaMilestone['status'] = 'Pending';
      if (statusRaw.includes('comp') || statusRaw.includes('done')) status = 'Completed';
      else if (statusRaw.includes('prog') || statusRaw.includes('ongoing')) status = 'In Progress';
      else if (statusRaw.includes('delay')) status = 'Delayed';

      const completedDate = normalizeToStandardDate(r[3]) || undefined;

      parsed.push({
        id: 'ms_imp_' + Date.now() + '_' + idx,
        name,
        targetDaysFromTrigger: days,
        targetDate: targetDate || addDaysToDateString(stdTrigger, days),
        status,
        completedDate,
      });
    });

    if (parsed.length > 0) {
      setItems(parsed);
      setImportFeedback(`Successfully loaded ${parsed.length} milestones! Click "Save Changes" to apply.`);
      setActiveTab('edit');
    } else {
      setImportFeedback('Could not parse milestone rows. Check table format.');
    }
  };

  const handlePasteImport = () => {
    if (!pasteContent.trim()) return;
    const grid = parseExcelClipboardText(pasteContent);
    handleParseImportRows(grid);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await readExcelFile(file);
      handleParseImportRows(data);
    } catch (err: any) {
      setImportFeedback(`Error reading file: ${err.message}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-3 md:p-6 overflow-y-auto">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-xl bg-slate-900 border border-slate-700 text-slate-100 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-sky-950 text-sky-400 border border-sky-800">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
                Customize SAQ Milestone Roadmap & SLA Warning Rules
              </h2>
              <p className="text-xs text-slate-400">
                Customize stages according to your project requirements or import for faster encoding. Day 0:{' '}
                <span className="font-mono text-amber-400 font-semibold">{stdTrigger}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* SLA Scope Presets Quick Selector */}
        <div className="px-6 py-2 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-1.5 text-slate-300">
            <span className="font-bold text-amber-300 mr-1 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              SLA Presets:
            </span>
            {SLA_SCOPE_PRESETS.map((preset) => {
              const isPostCon = preset.scopeType === 'post_con_21d';
              const isTurnkey = preset.scopeType === 'full_turnkey_156d';
              return (
                <button
                  key={preset.scopeType}
                  type="button"
                  onClick={() => handleApplyPreset(preset)}
                  className={`px-2 py-0.5 rounded text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1 ${
                    isPostCon
                      ? 'bg-amber-950/60 hover:bg-amber-900 border-amber-600/70 text-amber-200'
                      : isTurnkey
                      ? 'bg-emerald-950/40 hover:bg-emerald-900 border-emerald-700/60 text-emerald-200'
                      : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300'
                  }`}
                  title={`${preset.scopeName} (${preset.targetDays} Days): ${preset.description}`}
                >
                  {isPostCon && '⭐ '}
                  <span>{preset.scopeName}</span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleResetToStandardSLA}
            className="px-2 py-0.5 text-[11px] font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded flex items-center gap-1 transition-colors"
            title="Reset to 156d Standard Turnkey"
          >
            <RotateCcw className="w-3 h-3" />
            Reset 156d
          </button>
        </div>

        {/* Tabs: Edit Milestones vs Import For Faster Encoding */}
        <div className="px-6 pt-3 bg-slate-950 flex items-center gap-2 border-b border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('edit')}
            className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'edit'
                ? 'border-sky-500 text-white bg-slate-900/50 rounded-t-md'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-sky-400" />
            Milestone Stages Editor ({items.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('import')}
            className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'import'
                ? 'border-emerald-500 text-white bg-slate-900/50 rounded-t-md'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Upload className="w-3.5 h-3.5 text-emerald-400" />
            Import for Faster Encoding (Excel / Paste)
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {importFeedback && (
            <div className="p-3 rounded-lg bg-sky-950/70 border border-sky-700 text-xs text-sky-200 flex items-center justify-between">
              <span>{importFeedback}</span>
              <button
                type="button"
                onClick={() => setImportFeedback(null)}
                className="text-slate-400 hover:text-white ml-2"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {activeTab === 'edit' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>
                  Reorder, rename, adjust SLA days, or update status for each milestone stage.
                </span>
                <button
                  type="button"
                  onClick={handleAddNewMilestone}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-md flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Custom Stage
                </button>
              </div>

              {/* Table of Milestones */}
              <div className="rounded-lg border border-slate-800 bg-slate-950 overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-900 text-slate-400 font-bold border-b border-slate-800 uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-2.5 px-3 w-12 text-center">#</th>
                      <th className="py-2.5 px-3">Milestone / Stage Name</th>
                      <th className="py-2.5 px-3 w-28">Days from Day 0</th>
                      <th className="py-2.5 px-3 w-36">Target Date</th>
                      <th className="py-2.5 px-3 w-36">Status</th>
                      <th className="py-2.5 px-3 w-36">Completed Date</th>
                      <th className="py-2.5 px-3 w-24 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 font-mono text-slate-200">
                    {items.map((ms, index) => (
                      <tr key={ms.id} className="hover:bg-slate-900/60 transition-colors">
                        <td className="py-2 px-3 text-center text-slate-500 font-bold">
                          {index + 1}
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={ms.name}
                            onChange={(e) => handleUpdateItem(ms.id, { name: e.target.value })}
                            className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs font-sans text-white focus:outline-hidden focus:border-sky-500"
                            placeholder="Milestone Name"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-1">
                            <span className="text-slate-400 font-sans">+</span>
                            <input
                              type="number"
                              min="0"
                              value={ms.targetDaysFromTrigger}
                              onChange={(e) =>
                                handleUpdateItem(ms.id, {
                                  targetDaysFromTrigger: Math.max(0, parseInt(e.target.value, 10) || 0),
                                })
                              }
                              className="w-16 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-white text-right focus:outline-hidden focus:border-sky-500"
                            />
                            <span className="text-slate-400 font-sans">d</span>
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="date"
                            value={normalizeToStandardDate(ms.targetDate)}
                            onChange={(e) => handleUpdateItem(ms.id, { targetDate: e.target.value })}
                            className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-white focus:outline-hidden focus:border-sky-500"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <select
                            value={ms.status}
                            onChange={(e) =>
                              handleUpdateItem(ms.id, {
                                status: e.target.value as SlaMilestone['status'],
                                completedDate:
                                  e.target.value === 'Completed' && !ms.completedDate
                                    ? getLocalDateString()
                                    : ms.completedDate,
                              })
                            }
                            className={`w-full px-2 py-1 bg-slate-900 border rounded text-xs font-sans font-semibold focus:outline-hidden ${
                              ms.status === 'Completed'
                                ? 'text-emerald-300 border-emerald-800'
                                : ms.status === 'In Progress'
                                ? 'text-sky-300 border-sky-800'
                                : ms.status === 'Delayed'
                                ? 'text-rose-300 border-rose-800'
                                : 'text-slate-400 border-slate-700'
                            }`}
                          >
                            <option value="Completed">Completed</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Pending">Pending</option>
                            <option value="Delayed">Delayed</option>
                          </select>
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="date"
                            value={normalizeToStandardDate(ms.completedDate) || ''}
                            onChange={(e) => handleUpdateItem(ms.id, { completedDate: e.target.value })}
                            className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-white focus:outline-hidden focus:border-sky-500"
                          />
                        </td>
                        <td className="py-2 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleMoveUp(index)}
                              disabled={index === 0}
                              className="p-1 text-slate-400 hover:text-white disabled:opacity-30 rounded hover:bg-slate-800"
                              title="Move Up"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveDown(index)}
                              disabled={index === items.length - 1}
                              className="p-1 text-slate-400 hover:text-white disabled:opacity-30 rounded hover:bg-slate-800"
                              title="Move Down"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteItem(ms.id)}
                              className="p-1 text-rose-400 hover:text-rose-200 rounded hover:bg-rose-950"
                              title="Delete Milestone"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Fast Import Section */
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-white">
                  <Upload className="w-4 h-4 text-emerald-400" />
                  Fast Encoding Option 1: Upload Excel / CSV file
                </div>
                <p className="text-xs text-slate-400">
                  Import milestone definitions directly from a spreadsheet. Expected columns:
                  <code className="ml-1 text-sky-300 font-mono">
                    Milestone Name | Days or Target Date | Status | Completed Date
                  </code>
                </p>
                <label className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-950 hover:bg-emerald-900 border border-emerald-700 rounded-lg text-xs font-bold text-emerald-200 cursor-pointer transition-colors shadow-xs">
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Choose Spreadsheet (.xlsx, .csv)</span>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-white">
                  <ClipboardPaste className="w-4 h-4 text-sky-400" />
                  Fast Encoding Option 2: Paste from Clipboard (Excel / TSV / CSV)
                </div>
                <p className="text-xs text-slate-400">
                  Copy rows directly from Excel or Google Sheets and paste below. All dates will be standardized automatically!
                </p>
                <textarea
                  rows={6}
                  value={pasteContent}
                  onChange={(e) => setPasteContent(e.target.value)}
                  placeholder={`Example paste format:\nSite Hunting\t2\tCompleted\t2026-01-10\nSecuring Property Document\t23\tCompleted\t2026-01-28\nSecuring Pre-Con\t67\tIn Progress\t\nSecuring Post-Con\t88\tPending\t\nFAC Submission\t98\tPending\t\nSite Closed\t156\tPending\t`}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-white placeholder-slate-500 focus:outline-hidden focus:border-sky-500"
                />
                <button
                  type="button"
                  onClick={handlePasteImport}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold flex items-center gap-2 transition-colors shadow-xs"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Parse & Load Milestones
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            Total Milestones: <span className="font-bold text-white">{items.length}</span>
            {items.length > 0 && (
              <>
                {' '}· Final Target:{' '}
                <span className="font-mono text-emerald-400 font-bold">
                  {items[items.length - 1].targetDate} (+{items[items.length - 1].targetDaysFromTrigger}d)
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg flex items-center gap-1.5 transition-colors shadow-md"
            >
              <Check className="w-4 h-4" />
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
