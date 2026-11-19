import React, { useState } from 'react';
import { TrackerRow, SlaHistoryRecord, SlaMilestone, SlaHistoryColumn } from '../types/tracker';
import {
  evaluateSlaStatus,
  getLocalDateString,
  addDaysToDateString,
  normalizeToStandardDate,
  formatDateDisplay,
  formatCurrencyPHP,
  SLA_SCOPE_PRESETS,
  createMilestonesFromTemplate,
} from '../utils/excelUtils';
import { ProjectSlaConfig } from '../types/tracker';
import { CustomizeSlaColumnsModal, DEFAULT_SLA_HISTORY_COLUMNS } from './CustomizeSlaColumnsModal';
import { CustomizeSlaMilestonesModal } from './CustomizeSlaMilestonesModal';
import { ImportSlaHistoryModal } from './ImportSlaHistoryModal';
import * as XLSX from 'xlsx';
import {
  Calendar,
  AlertTriangle,
  Clock,
  Plus,
  Printer,
  FileSpreadsheet,
  X,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Search,
  Sliders,
  ShieldAlert,
  Upload,
  Edit2,
  Trash2,
  Undo2,
  Check,
  Sparkles,
  ArrowRight,
  Target,
} from 'lucide-react';

interface DayByDaySlaModalProps {
  row: TrackerRow;
  isOpen: boolean;
  onClose: () => void;
  onUpdateRowSla: (updatedRow: TrackerRow) => void;
  onOpenCustomizeColumns?: () => void;
}

export const DayByDaySlaModal: React.FC<DayByDaySlaModalProps> = ({
  row,
  isOpen,
  onClose,
  onUpdateRowSla,
  onOpenCustomizeColumns,
}) => {
  if (!isOpen) return null;

  const [slaData, setSlaData] = useState(() => JSON.parse(JSON.stringify(row.slaData)));
  const [showAddForm, setShowAddForm] = useState(false);
  const [showRoadmap, setShowRoadmap] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals for Column Customization, Milestones Customization, and Fast Import
  const [isCustomizeColumnsOpen, setIsCustomizeColumnsOpen] = useState(false);
  const [isCustomizeMilestonesOpen, setIsCustomizeMilestonesOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Inline editing state for individual history records
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Record<string, any>>({});

  // In-App Delete confirmation and Undo toast states (Bypasses iframe blocked window.confirm)
  const [recordToDelete, setRecordToDelete] = useState<SlaHistoryRecord | null>(null);
  const [deletedRecordToast, setDeletedRecordToast] = useState<{ record: SlaHistoryRecord; index: number } | null>(null);

  // Form states for new daily record
  const [newDate, setNewDate] = useState(() => getLocalDateString());
  const [newStatus, setNewStatus] = useState(row.values.status || 'Site Hunting');
  const [newProgressUpdate, setNewProgressUpdate] = useState('');
  const [newDetailsRemarks, setNewDetailsRemarks] = useState('');
  const [newTrackingRule, setNewTrackingRule] = useState('Day-to-Day Operation Update');
  const [newLoggedBy, setNewLoggedBy] = useState(row.values.pic_handler || 'SAQCivil Team');
  const [newCustomValues, setNewCustomValues] = useState<Record<string, any>>({});

  // Active History Columns
  const historyColumns: SlaHistoryColumn[] =
    Array.isArray(slaData.historyColumns) && slaData.historyColumns.length > 0
      ? slaData.historyColumns
      : DEFAULT_SLA_HISTORY_COLUMNS;

  const visibleHistoryCols = historyColumns.filter((c) => c.visible);

  // Evaluate SLA health dynamically
  const slaEvaluation = evaluateSlaStatus(
    slaData.triggerDate,
    slaData.lastMovementDate,
    slaData.milestones,
    slaData.currentStatus || row.values.status
  );

  const handleSetTodayTrigger = () => {
    const today = getLocalDateString();
    handleTriggerDateChange(today);
  };

  const handleTriggerDateChange = (val: string) => {
    const stdDate = normalizeToStandardDate(val) || getLocalDateString();
    const updatedMilestones = (slaData.milestones || []).map((ms: SlaMilestone) => ({
      ...ms,
      targetDate: addDaysToDateString(stdDate, ms.targetDaysFromTrigger),
    }));
    const updated = {
      ...slaData,
      triggerDate: stdDate,
      milestones: updatedMilestones,
    };
    setSlaData(updated);
    saveChanges(updated);
  };

  const handleSwitchScopePreset = (preset: ProjectSlaConfig) => {
    const stdDate = normalizeToStandardDate(slaData.triggerDate) || getLocalDateString();
    const updatedMilestones = createMilestonesFromTemplate(preset.milestones, stdDate);
    const updated = {
      ...slaData,
      targetDays: preset.targetDays,
      slaScopeName: preset.scopeName,
      scopeType: preset.scopeType,
      milestones: updatedMilestones,
    };
    setSlaData(updated);
    saveChanges(updated);
  };

  const handleAddRecord = () => {
    if (!newProgressUpdate.trim()) {
      alert('Please enter a description for the Day-by-Day progress update.');
      return;
    }

    const cleanDate = normalizeToStandardDate(newDate) || getLocalDateString();
    const newRecord: SlaHistoryRecord = {
      id: 'hist_' + Date.now().toString(),
      date: cleanDate,
      status: newStatus,
      progressUpdate: newProgressUpdate.trim(),
      detailsRemarks: newDetailsRemarks.trim() || 'Logged via Daily Update system.',
      trackingRule: newTrackingRule,
      loggedBy: newLoggedBy,
      customValues: { ...newCustomValues },
    };

    // Update last movement date to this record date
    const updatedHistory = [newRecord, ...slaData.history];
    const updatedSla = {
      ...slaData,
      currentStatus: newStatus,
      lastMovementDate: cleanDate,
      history: updatedHistory,
    };

    setSlaData(updatedSla);
    setShowAddForm(false);
    setNewProgressUpdate('');
    setNewDetailsRemarks('');
    setNewCustomValues({});

    saveChanges(updatedSla, newStatus);
  };

  const handleSaveCustomColumns = (newCols: SlaHistoryColumn[]) => {
    const updated = {
      ...slaData,
      historyColumns: newCols,
    };
    setSlaData(updated);
    saveChanges(updated);
  };

  const handleSaveMilestones = (newMilestones: SlaMilestone[]) => {
    const updated = {
      ...slaData,
      milestones: newMilestones,
    };
    setSlaData(updated);
    saveChanges(updated);
  };

  const handleDeleteSingleMilestone = (msId: string) => {
    const updated = (slaData.milestones || []).filter((m: SlaMilestone) => m.id !== msId);
    handleSaveMilestones(updated);
  };

  const handleAdvanceStep = (nextStepName: string) => {
    const today = getLocalDateString();
    const newRecord: SlaHistoryRecord = {
      id: 'hist_' + Date.now().toString(),
      date: today,
      status: nextStepName,
      progressUpdate: `Advanced status to "${nextStepName}" per SLA step transition requirement.`,
      detailsRemarks: `Status successfully updated to maintain compliance within target telecom schedule.`,
      trackingRule: 'SLA Step Transition',
      loggedBy: newLoggedBy || 'SAQCivil Team',
      customValues: {},
    };

    const updatedHistory = [newRecord, ...slaData.history];
    const updatedSla = {
      ...slaData,
      currentStatus: nextStepName,
      lastMovementDate: today,
      history: updatedHistory,
    };

    setSlaData(updatedSla);
    saveChanges(updatedSla, nextStepName);
  };

  const handleImportRecords = (newRecords: SlaHistoryRecord[], mode: 'append' | 'replace') => {
    const combinedHistory =
      mode === 'replace' ? [...newRecords] : [...newRecords, ...slaData.history];

    // Sort by date descending (newest on top)
    combinedHistory.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    const newestRecord = combinedHistory[0];
    const newestDate = newestRecord?.date || slaData.lastMovementDate;
    const newestStatus = newestRecord?.status || slaData.currentStatus;

    const updatedSla = {
      ...slaData,
      currentStatus: newestStatus,
      lastMovementDate: newestDate,
      history: combinedHistory,
    };

    setSlaData(updatedSla);
    saveChanges(updatedSla, newestStatus);
  };

  const confirmDeleteRecord = (recordId: string) => {
    const idx = slaData.history.findIndex((h: SlaHistoryRecord) => h.id === recordId);
    const target = idx >= 0 ? slaData.history[idx] : null;
    const updatedHistory = slaData.history.filter((h: SlaHistoryRecord) => h.id !== recordId);
    const newest = updatedHistory[0];
    const updatedSla = {
      ...slaData,
      lastMovementDate: newest ? newest.date : slaData.triggerDate,
      currentStatus: newest ? newest.status : slaData.currentStatus,
      history: updatedHistory,
    };
    setSlaData(updatedSla);
    setRecordToDelete(null);
    if (editingRecordId === recordId) setEditingRecordId(null);
    if (target) {
      setDeletedRecordToast({ record: target, index: Math.max(0, idx) });
    }
    saveChanges(updatedSla, newest ? newest.status : undefined);
  };

  const handleUndoDeleteRecord = () => {
    if (!deletedRecordToast) return;
    const { record, index } = deletedRecordToast;
    const restored = [...slaData.history];
    restored.splice(index, 0, record);
    restored.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const newest = restored[0];
    const updatedSla = {
      ...slaData,
      lastMovementDate: newest ? newest.date : slaData.triggerDate,
      currentStatus: newest ? newest.status : slaData.currentStatus,
      history: restored,
    };
    setSlaData(updatedSla);
    setDeletedRecordToast(null);
    saveChanges(updatedSla, newest ? newest.status : undefined);
  };

  const handleStartEdit = (record: SlaHistoryRecord) => {
    setEditingRecordId(record.id);
    setEditFormData({
      date: record.date,
      status: record.status,
      progressUpdate: record.progressUpdate,
      detailsRemarks: record.detailsRemarks,
      trackingRule: record.trackingRule,
      loggedBy: record.loggedBy,
      ...(record.customValues || {}),
    });
  };

  const handleSaveEdit = (recordId: string) => {
    const updatedHistory = slaData.history.map((h: SlaHistoryRecord) => {
      if (h.id !== recordId) return h;
      return {
        ...h,
        date: normalizeToStandardDate(editFormData.date) || h.date,
        status: editFormData.status || h.status,
        progressUpdate:
          editFormData.progressUpdate !== undefined
            ? editFormData.progressUpdate
            : h.progressUpdate,
        detailsRemarks:
          editFormData.detailsRemarks !== undefined
            ? editFormData.detailsRemarks
            : h.detailsRemarks,
        trackingRule:
          editFormData.trackingRule !== undefined
            ? editFormData.trackingRule
            : h.trackingRule,
        loggedBy:
          editFormData.loggedBy !== undefined ? editFormData.loggedBy : h.loggedBy,
        customValues: {
          ...(h.customValues || {}),
          ...editFormData,
        },
      };
    });

    const newest = updatedHistory[0];
    const updatedSla = {
      ...slaData,
      lastMovementDate: newest ? newest.date : slaData.lastMovementDate,
      currentStatus: newest ? newest.status : slaData.currentStatus,
      history: updatedHistory,
    };

    setSlaData(updatedSla);
    setEditingRecordId(null);
    saveChanges(updatedSla);
  };

  const saveChanges = (newSla: typeof slaData, overrideStatus?: string) => {
    const evaluated = evaluateSlaStatus(
      newSla.triggerDate,
      newSla.lastMovementDate,
      newSla.milestones,
      overrideStatus || newSla.currentStatus || row.values.status
    );

    const lastMilestone = newSla.milestones?.[newSla.milestones.length - 1];
    const updatedRow: TrackerRow = {
      ...row,
      values: {
        ...row.values,
        status: overrideStatus || newSla.currentStatus,
        sla_health_col: evaluated.healthLabel,
        target_on_air_date: lastMilestone?.targetDate || row.values.target_on_air_date,
      },
      slaData: {
        ...newSla,
        isNoMovement14Days: evaluated.isNoMovement14Days,
        delayDays: evaluated.delayDays,
        slaHealth: evaluated.health,
        priority: evaluated.priority,
      },
      updatedAt: new Date().toISOString(),
    };

    onUpdateRowSla(updatedRow);
  };

  const handleExportExcel = () => {
    const headers = ['#', ...visibleHistoryCols.map((c) => c.label)];
    const rows = slaData.history.map((h: SlaHistoryRecord, idx: number) => {
      const rowCells = visibleHistoryCols.map((col) => {
        if (col.id === 'date') return h.date;
        if (col.id === 'status') return h.status;
        if (col.id === 'progressUpdate') return h.progressUpdate;
        if (col.id === 'detailsRemarks') return h.detailsRemarks;
        if (col.id === 'trackingRule') return h.trackingRule;
        if (col.id === 'loggedBy') return h.loggedBy;
        return h.customValues?.[col.id] || h[col.id] || '';
      });
      return [idx + 1, ...rowCells];
    });

    const siteTitle = row.siteDetails?.siteName || row.values?.site_name || row.siteId;
    const titleRow = [`DAY-BY-DAY PROGRESS & SAQ SLA TRACKER — ${row.siteId} (${siteTitle})`];
    const metaRow = [
      `SLA Trigger (Day 0): ${slaData.triggerDate}`,
      `Status: ${slaData.currentStatus}`,
      `Health: ${slaEvaluation.healthLabel}`,
    ];

    const aoa = [titleRow, metaRow, [], headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'SLA_Log');
    XLSX.writeFile(wb, `SLA_Log_${row.siteId}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handlePrint = () => {
    window.print();
  };

  const filteredHistory = (slaData?.history || []).filter((h: SlaHistoryRecord) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const matchesStandard =
      String(h.date || '').toLowerCase().includes(q) ||
      String(h.status || '').toLowerCase().includes(q) ||
      String(h.progressUpdate || '').toLowerCase().includes(q) ||
      String(h.detailsRemarks || '').toLowerCase().includes(q) ||
      String(h.trackingRule || '').toLowerCase().includes(q) ||
      String(h.loggedBy || '').toLowerCase().includes(q);

    if (matchesStandard) return true;

    // Search custom columns too
    if (h.customValues && typeof h.customValues === 'object') {
      return Object.values(h.customValues).some((v) =>
        String(v || '').toLowerCase().includes(q)
      );
    }
    return false;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-2 md:p-6 overflow-y-auto">
      <div className="relative w-full max-w-6xl max-h-[96vh] flex flex-col rounded-xl bg-slate-900 border border-slate-700 text-slate-100 shadow-2xl overflow-hidden">
        {/* Top Header */}
        <div className="px-6 py-3.5 border-b border-slate-800 bg-slate-950 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-blue-950 text-blue-400 border border-blue-800/80">
              {row.siteId}
            </span>
            <div className="flex items-baseline gap-2">
              <h2 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
                DAY-BY-DAY PROGRESS & SAQ SLA TRACKER
              </h2>
              <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                Per-Site Clickable Log
              </span>
            </div>
          </div>

          {/* Top Actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportExcel}
              className="px-3 py-1.5 text-xs font-medium text-emerald-300 hover:text-emerald-200 bg-emerald-950/40 hover:bg-emerald-900/40 border border-emerald-800/60 rounded-md flex items-center gap-1.5 transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Excel Export
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700 rounded-md flex items-center gap-1.5 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              Print
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Site Identity Bar */}
        <div className="px-6 py-2.5 bg-slate-900/90 border-b border-slate-800 text-xs text-slate-300 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white">
              {row.siteDetails?.siteName || row.values?.site_name || row.siteId}
            </span>
            <span className="text-slate-500">·</span>
            <span>{row.siteDetails?.region || 'NCR / Metro Manila'}</span>
            <span className="text-slate-500">·</span>
            <span className="text-slate-400">Team: SAQCivil Team</span>
            <span className="text-slate-500">·</span>
            <span className="text-amber-400 font-medium">
              PIC: {row.values.pic_handler || 'JHENG QUINTO'}
            </span>
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            Last Movement: {slaData.lastMovementDate || 'None logged'}
          </div>
        </div>

        {/* SLA Counting Trigger (Day 0) bar */}
        <div className="px-6 py-3 bg-slate-950/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-amber-400">
              <Calendar className="w-4 h-4" />
              SLA COUNTING TRIGGER (DAY 0):
            </div>
            <input
              type="date"
              value={slaData.triggerDate}
              onChange={(e) => handleTriggerDateChange(e.target.value)}
              className="px-2.5 py-1 bg-slate-900 border border-slate-700 rounded text-xs font-mono font-bold text-white focus:outline-hidden focus:border-amber-400"
            />
            <button
              type="button"
              onClick={handleSetTodayTrigger}
              className="px-2.5 py-1 bg-amber-950/60 hover:bg-amber-900/60 text-amber-300 border border-amber-800/80 rounded text-xs font-semibold transition-colors"
            >
              Set to Today
            </button>
            <span className="text-[11px] text-slate-400">
              (All SLA milestone deadlines recalculate automatically from Day 0)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${
                slaEvaluation.health === 'critical'
                  ? 'bg-rose-950 text-rose-300 border-rose-700'
                  : slaEvaluation.health === 'delayed'
                  ? 'bg-amber-950 text-amber-300 border-amber-700'
                  : slaEvaluation.health === 'approaching'
                  ? 'bg-yellow-950 text-yellow-300 border-yellow-700'
                  : 'bg-emerald-950 text-emerald-300 border-emerald-700'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              {slaEvaluation.healthLabel}
            </span>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Active Step Status & Transition Warning Alert Banner */}
          {(slaEvaluation.overdueWarnings.length > 0 || slaEvaluation.oneWeekWarnings.length > 0) && (
            <div
              className={`p-4 rounded-xl border shadow-lg ${
                slaEvaluation.overdueWarnings.length > 0
                  ? 'bg-rose-950/40 border-rose-800 ring-1 ring-rose-500/40'
                  : 'bg-amber-950/40 border-amber-800 ring-1 ring-amber-500/40'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2.5 rounded-lg shrink-0 ${
                      slaEvaluation.overdueWarnings.length > 0
                        ? 'bg-rose-900/60 text-rose-300 border border-rose-700'
                        : 'bg-amber-900/60 text-amber-300 border border-amber-700'
                    }`}
                  >
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider flex flex-wrap items-center gap-2">
                      <span>
                        {slaEvaluation.overdueWarnings.length > 0
                          ? '🚨 SLA Milestone Status Overdue Warning'
                          : '⚠️ SLA 1-Week Approaching Warning'}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-slate-900 border border-slate-700 text-sky-300">
                        Current Step {slaEvaluation.currentStepNumber}: {slaEvaluation.currentStepName}
                      </span>
                    </h4>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      Status has not progressed to the next required step (
                      <strong className="text-white">{slaEvaluation.nextStepName}</strong>) within the
                      telecom SLA schedule.
                    </p>
                  </div>
                </div>

                {slaEvaluation.currentStepNumber < 6 && (
                  <button
                    type="button"
                    onClick={() => handleAdvanceStep(slaEvaluation.nextStepName)}
                    className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer hover:scale-102 active:scale-98"
                    title={`Advance status to ${slaEvaluation.nextStepName} and resolve this SLA warning`}
                  >
                    <span>Advance Status to "{slaEvaluation.nextStepName}"</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Warning List */}
              <div className="pt-2.5 space-y-1.5 text-xs font-mono">
                {slaEvaluation.overdueWarnings.map((warn, wIdx) => (
                  <div key={`ov_${wIdx}`} className="text-rose-300 flex items-start gap-2">
                    <span className="text-rose-400 font-bold shrink-0">🚨</span>
                    <span>{warn}</span>
                  </div>
                ))}
                {slaEvaluation.oneWeekWarnings.map((warn, wIdx) => (
                  <div key={`ow_${wIdx}`} className="text-amber-300 flex items-start gap-2">
                    <span className="text-amber-400 font-bold shrink-0">⚠️</span>
                    <span>{warn}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Milestone Target Roadmap Accordion & SLA Warning Rules */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 overflow-hidden shadow-lg">
            <div
              className="px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3"
            >
              <div
                onClick={() => setShowRoadmap(!showRoadmap)}
                className="flex items-center gap-2 text-xs font-bold text-slate-200 cursor-pointer hover:text-white transition-colors"
              >
                <Target className="w-4 h-4 text-amber-400" />
                <span className="uppercase">
                  {slaData.slaScopeName || `SAQ & CIVIL MILESTONE ROADMAP (${slaData.targetDays || 21}-DAY SLA TARGET)`}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  {slaData.targetDays || 21}d Target
                </span>
                {showRoadmap ? (
                  <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                )}
              </div>

              {/* Customization & Import Buttons for Milestones Area */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsCustomizeMilestonesOpen(true)}
                  className="px-2.5 py-1 text-xs font-bold bg-sky-950/80 hover:bg-sky-900 text-sky-200 border border-sky-800/80 rounded flex items-center gap-1.5 transition-colors shadow-xs"
                  title="Customize stages: edit milestone names, target days, or add custom stages"
                >
                  <Sliders className="w-3 h-3 text-sky-400" />
                  <span>Customize Milestones</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsCustomizeMilestonesOpen(true)}
                  className="px-2.5 py-1 text-xs font-bold bg-emerald-950/80 hover:bg-emerald-900 text-emerald-200 border border-emerald-800/80 rounded flex items-center gap-1.5 transition-colors shadow-xs"
                  title="Import milestone definitions via Excel spreadsheet or clipboard paste"
                >
                  <Upload className="w-3 h-3 text-emerald-400" />
                  <span>Import Roadmap</span>
                </button>
              </div>
            </div>

            {showRoadmap && (
              <div className="p-4 space-y-4">
                {/* Scope Presets Quick Switch Bar (e.g. 21d Post-Con Only) */}
                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-300 font-bold">
                    <Target className="w-3.5 h-3.5 text-amber-400" />
                    <span>Switch Target Scope:</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {SLA_SCOPE_PRESETS.map((preset) => {
                      const isActive =
                        slaData.scopeType === preset.scopeType ||
                        (slaData.targetDays === preset.targetDays && !slaData.scopeType && preset.scopeType === 'post_con_21d');
                      return (
                        <button
                          key={preset.scopeType}
                          type="button"
                          onClick={() => handleSwitchScopePreset(preset)}
                          className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                            isActive
                              ? 'bg-amber-500 text-black font-extrabold shadow-xs'
                              : 'bg-slate-950 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800'
                          }`}
                          title={`Switch site SLA target to: ${preset.scopeName} (${preset.targetDays} days)`}
                        >
                          {preset.scopeType === 'post_con_21d' && '⭐ '}
                          <span>{preset.scopeName.replace(/\(.*?\)/g, '').trim()}</span>
                          <span className={`text-[10px] font-mono ${isActive ? 'text-black font-black' : 'text-amber-400 font-bold'}`}>
                            ({preset.targetDays}d)
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Milestone Cards Grid */}
                <div className="grid grid-cols-2 md:grid-cols-6 gap-2.5 text-xs">
                  {(slaData.milestones || []).map((ms: SlaMilestone) => {
                    const isDone = ms.status === 'Completed';
                    const isInProgress = ms.status === 'In Progress';
                    const isDelayed = ms.status === 'Delayed';
                    return (
                      <div
                        key={ms.id}
                        onClick={() => {
                          // Quick cycle status
                          const nextStatus: SlaMilestone['status'] =
                            ms.status === 'Pending'
                              ? 'In Progress'
                              : ms.status === 'In Progress'
                              ? 'Completed'
                              : ms.status === 'Completed'
                              ? 'Pending'
                              : 'Pending';
                          const updated = (slaData.milestones || []).map((m: SlaMilestone) =>
                            m.id === ms.id
                              ? {
                                  ...m,
                                  status: nextStatus,
                                  completedDate:
                                    nextStatus === 'Completed' ? getLocalDateString() : undefined,
                                }
                              : m
                          );
                          handleSaveMilestones(updated);
                        }}
                        className={`p-3 rounded-lg border flex flex-col justify-between cursor-pointer transition-all hover:ring-1 hover:ring-sky-500/50 relative group/mscard ${
                          isDone
                            ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-300'
                            : isInProgress
                            ? 'bg-sky-950/40 border-sky-700 text-sky-200'
                            : isDelayed
                            ? 'bg-rose-950/30 border-rose-800/60 text-rose-300'
                            : 'bg-slate-900/60 border-slate-800 text-slate-400'
                        }`}
                        title="Click card to toggle milestone status, or click trash icon to delete"
                      >
                        <div>
                          <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                            <span className="truncate max-w-[85px]">{ms.name}</span>
                            <div className="flex items-center gap-1">
                              <span className="font-mono text-[10px] opacity-75">
                                +{ms.targetDaysFromTrigger}d
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteSingleMilestone(ms.id);
                                }}
                                className="p-0.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/80 rounded transition-colors opacity-0 group-hover/mscard:opacity-100"
                                title={`Delete ${ms.name} milestone`}
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                          <div className="font-mono text-xs font-bold text-white mb-2">
                            {ms.targetDate}
                          </div>
                        </div>
                        <span
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded text-center block ${
                            isDone
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : isInProgress
                              ? 'bg-sky-950 text-sky-300 border border-sky-800'
                              : isDelayed
                              ? 'bg-rose-950 text-rose-300 border border-rose-800'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {ms.status}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* SLA Warning Rules & Active Compliance Console */}
                <div className="p-3.5 rounded-lg bg-slate-900/90 border border-slate-800 space-y-2 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
                    <div className="flex items-center gap-2 font-bold text-slate-200">
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                      <span>TELECOM SLA WARNING RULES & REAL-TIME STEP STATUS</span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-400">
                      Days Elapsed: <span className="text-amber-400 font-bold">{slaEvaluation.daysElapsed}d</span> · Days Since Last Movement: <span className="text-sky-400 font-bold">{slaEvaluation.daysSinceMovement}d</span>
                    </div>
                  </div>

                  {/* 7 Specific Warning Rule Badges with Live States */}
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 text-[11px]">
                    {slaEvaluation.stageWarningRules.map((rule) => {
                      const isOverdue = rule.isOverdue;
                      const isOneWeek = rule.isOneWeekWarning;
                      const isComp = rule.isCompleted;

                      return (
                        <div
                          key={rule.key}
                          className={`p-2 rounded border flex flex-col justify-between transition-all ${
                            isOverdue
                              ? 'bg-rose-950/60 border-rose-700 text-rose-200 shadow-xs'
                              : isOneWeek
                              ? 'bg-amber-950/60 border-amber-700 text-amber-200 shadow-xs'
                              : isComp
                              ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-300'
                              : 'bg-slate-950 border-slate-800 text-slate-300'
                          }`}
                        >
                          <div>
                            <div className="text-[10px] font-semibold text-slate-400 truncate">
                              {rule.label}
                            </div>
                            <div className="font-mono text-white font-bold text-xs mt-0.5">
                              {rule.limitDays}d SLA
                            </div>
                            <div className="text-[9px] text-slate-500 truncate mt-0.5">
                              → Next: {rule.nextStepLabel}
                            </div>
                          </div>
                          <div className="mt-1.5 pt-1 border-t border-slate-800/60">
                            {isComp ? (
                              <span className="text-[10px] text-emerald-400 font-bold">✓ Advanced</span>
                            ) : isOverdue ? (
                              <span className="text-[10px] text-rose-400 font-bold">🚨 +{rule.delayDays}d Overdue</span>
                            ) : isOneWeek ? (
                              <span className="text-[10px] text-amber-300 font-bold">⚠️ 1-Wk Warn ({rule.daysRemaining}d)</span>
                            ) : (
                              <span className="text-[10px] text-slate-400">On Track ({rule.daysRemaining}d)</span>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* Rule 7: 14-Day Inactivity Warning */}
                    <div
                      className={`p-2 rounded border flex flex-col justify-between ${
                        slaEvaluation.isNoMovement14Days
                          ? 'bg-rose-950/60 border-rose-700 text-rose-200'
                          : slaEvaluation.daysSinceMovement >= 10
                          ? 'bg-amber-950/60 border-amber-700 text-amber-200'
                          : 'bg-slate-950 border-slate-800 text-slate-300'
                      }`}
                    >
                      <div>
                        <div className="text-[10px] font-semibold text-slate-400">7. Inactivity</div>
                        <div className="font-mono text-white font-bold text-xs mt-0.5">14d Limit</div>
                        <div className="text-[9px] text-slate-500 mt-0.5">No movement alert</div>
                      </div>
                      <div className="mt-1.5 pt-1 border-t border-slate-800/60">
                        {slaEvaluation.isNoMovement14Days ? (
                          <span className="text-[10px] text-rose-400 font-bold">🚨 Inactive {slaEvaluation.daysSinceMovement}d</span>
                        ) : (
                          <span className="text-[10px] text-slate-400">{slaEvaluation.daysSinceMovement}d since log</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Triggered Warnings Alert Box */}
                  {Array.isArray(slaEvaluation.stageWarningsList) &&
                    slaEvaluation.stageWarningsList.length > 0 && (
                      <div className="mt-2 p-2.5 rounded-lg bg-rose-950/50 border border-rose-800/80 space-y-1">
                        <div className="font-bold text-rose-300 flex items-center gap-1.5 text-xs">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Active SLA Warnings Triggered:</span>
                        </div>
                        {slaEvaluation.stageWarningsList.map((warn: string, wIdx: number) => (
                          <div key={wIdx} className="text-xs text-rose-200 font-mono pl-5">
                            • {warn}
                          </div>
                        ))}
                      </div>
                    )}
                </div>
              </div>
            )}
          </div>

          {/* Timeline and History Records Section */}
          <div className="space-y-3">
            {/* Toolbar for the Day-by-Day SLA Table (Matches Screenshot Area) */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-950/80 border border-slate-800">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-sky-400" />
                  Site Progress Timeline & History ({slaData.history.length} Records)
                </h3>
                <span className="text-[11px] text-slate-500 hidden md:inline">
                  · Single Source of Truth for SLA
                </span>
              </div>

              {/* Action Buttons: Search, Customize Columns, Import, Add */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search logs..."
                    className="pl-8 pr-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-md text-white placeholder-slate-500 focus:outline-hidden focus:border-sky-500 w-40 md:w-52"
                  />
                </div>

                {/* 1. CUSTOMIZE COLUMNS BUTTON (For user request) */}
                <button
                  type="button"
                  onClick={() => setIsCustomizeColumnsOpen(true)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-md text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                  title="Customize table columns: Add, rename, hide or reorder columns according to your needs"
                >
                  <Sliders className="w-3.5 h-3.5 text-sky-400" />
                  <span>Customize Columns</span>
                </button>

                {/* 2. FAST IMPORT BUTTON (Excel / Clipboard Paste) */}
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(true)}
                  className="px-3 py-1.5 bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-700/80 text-emerald-200 hover:text-white rounded-md text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                  title="Fast encoding: Import day-by-day logs via Excel (.xlsx/.csv) or Paste directly from clipboard"
                >
                  <Upload className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Import for Faster Encoding</span>
                </button>

                {/* 3. ADD DAILY RECORD ACCORDION BUTTON */}
                <button
                  type="button"
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Daily Record
                </button>
              </div>
            </div>

            {/* Add Daily Record Accordion Form */}
            {showAddForm && (
              <div className="p-4 rounded-xl bg-slate-800/90 border border-indigo-500/60 space-y-4 shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                  <span className="text-xs font-bold text-white flex items-center gap-2">
                    <Plus className="w-4 h-4 text-indigo-400" />
                    New Daily Progress & Milestone Log
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Date</label>
                    <input
                      type="date"
                      value={newDate}
                      onChange={(e) => setNewDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      Status (Dropdown)
                    </label>
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-white"
                    >
                      <option value="Site Hunting">Site Hunting</option>
                      <option value="Property Documents">Property Documents</option>
                      <option value="Under Review">Under Review</option>
                      <option value="Pre-Con">Pre-Con</option>
                      <option value="Post-Con">Post-Con</option>
                      <option value="FAC">FAC</option>
                      <option value="Billing">Billing</option>
                      <option value="Completed">Completed</option>
                      <option value="Delayed / Critical">Delayed / Critical</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      SLA Tracking Rule
                    </label>
                    <input
                      type="text"
                      value={newTrackingRule}
                      onChange={(e) => setNewTrackingRule(e.target.value)}
                      placeholder="e.g. Day 21 Target, Milestone Start"
                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Logged by PIC</label>
                    <input
                      type="text"
                      value={newLoggedBy}
                      onChange={(e) => setNewLoggedBy(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      Day-by-Day Progress / Updates
                    </label>
                    <textarea
                      rows={2}
                      value={newProgressUpdate}
                      onChange={(e) => setNewProgressUpdate(e.target.value)}
                      placeholder="Detailed update on site works, negotiation, civil surveys, or permits..."
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      Details / Remarks
                    </label>
                    <textarea
                      rows={2}
                      value={newDetailsRemarks}
                      onChange={(e) => setNewDetailsRemarks(e.target.value)}
                      placeholder="Legal clauses, sub-contractor actions, escrow status, etc."
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-white"
                    />
                  </div>
                </div>

                {/* Custom Columns Fields (Dynamically generated) */}
                {visibleHistoryCols.filter((c) => c.isCustom).length > 0 && (
                  <div className="pt-2 border-t border-slate-700 space-y-2">
                    <span className="text-[11px] font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      Custom Columns Values
                    </span>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                      {visibleHistoryCols
                        .filter((c) => c.isCustom)
                        .map((col) => (
                          <div key={col.id}>
                            <label className="block text-slate-300 font-semibold mb-1 truncate">
                              {col.label}
                            </label>
                            {col.type === 'textarea' ? (
                              <textarea
                                rows={2}
                                value={newCustomValues[col.id] || ''}
                                onChange={(e) =>
                                  setNewCustomValues({
                                    ...newCustomValues,
                                    [col.id]: e.target.value,
                                  })
                                }
                                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-white"
                              />
                            ) : (
                              <input
                                type={
                                  col.type === 'date'
                                    ? 'date'
                                    : col.type === 'number'
                                    ? 'number'
                                    : 'text'
                                }
                                value={newCustomValues[col.id] || ''}
                                onChange={(e) =>
                                  setNewCustomValues({
                                    ...newCustomValues,
                                    [col.id]: e.target.value,
                                  })
                                }
                                placeholder={`Enter ${col.label.toLowerCase()}...`}
                                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-white"
                              />
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-700">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAddRecord}
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-bold"
                  >
                    Save & Update Movement
                  </button>
                </div>
              </div>
            )}

            {/* History Table with FULLY CUSTOMIZABLE COLUMNS (Matches User Image) */}
            <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/60 shadow-inner">
              <table className="w-full text-left text-xs">
                {/* DYNAMIC HEADER ROW */}
                <thead className="bg-slate-900 border-b border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-300">
                  <tr>
                    <th className="py-2.5 px-3 w-10 text-center font-mono">#</th>
                    {visibleHistoryCols.map((col) => (
                      <th
                        key={col.id}
                        style={{ width: col.width }}
                        className="py-2.5 px-3 whitespace-nowrap"
                      >
                        <div className="flex items-center gap-1.5">
                          <span>{col.label}</span>
                          {col.isCustom && (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Custom Column" />
                          )}
                        </div>
                      </th>
                    ))}
                    <th className="py-2.5 px-3 w-20 text-center">Actions</th>
                  </tr>
                </thead>

                {/* TABLE BODY */}
                <tbody className="divide-y divide-slate-800/80 font-normal">
                  {filteredHistory.length === 0 ? (
                    <tr>
                      <td
                        colSpan={visibleHistoryCols.length + 2}
                        className="py-10 text-center text-slate-500"
                      >
                        <p className="font-semibold text-slate-400 mb-1">
                          No progress records found
                        </p>
                        <p className="text-xs">
                          Click <strong className="text-indigo-400">+ Add Daily Record</strong> or use{' '}
                          <strong className="text-emerald-400">Import for Faster Encoding</strong> to paste spreadsheet logs.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredHistory.map((h: SlaHistoryRecord, idx: number) => {
                      const isEditing = editingRecordId === h.id;

                      if (isEditing) {
                        return (
                          <tr key={h.id} className="bg-slate-900/90 border-y border-sky-600">
                            <td className="py-2 px-2 text-center text-slate-500 font-mono text-[11px]">
                              {idx + 1}
                            </td>
                            {visibleHistoryCols.map((col) => {
                              const currentVal =
                                editFormData[col.id] !== undefined
                                  ? editFormData[col.id]
                                  : col.id === 'date'
                                  ? h.date
                                  : col.id === 'status'
                                  ? h.status
                                  : col.id === 'progressUpdate'
                                  ? h.progressUpdate
                                  : col.id === 'detailsRemarks'
                                  ? h.detailsRemarks
                                  : col.id === 'trackingRule'
                                  ? h.trackingRule
                                  : col.id === 'loggedBy'
                                  ? h.loggedBy
                                  : h.customValues?.[col.id] || h[col.id] || '';

                              return (
                                <td key={col.id} className="py-2 px-2">
                                  {col.id === 'status' ? (
                                    <select
                                      value={currentVal}
                                      onChange={(e) =>
                                        setEditFormData({
                                          ...editFormData,
                                          [col.id]: e.target.value,
                                        })
                                      }
                                      className="w-full px-2 py-1 bg-slate-950 border border-sky-400 rounded text-xs text-white"
                                    >
                                      <option value="Site Hunting">Site Hunting</option>
                                      <option value="Property Documents">Property Documents</option>
                                      <option value="Under Review">Under Review</option>
                                      <option value="Pre-Con">Pre-Con</option>
                                      <option value="Post-Con">Post-Con</option>
                                      <option value="FAC">FAC</option>
                                      <option value="Billing">Billing</option>
                                      <option value="Completed">Completed</option>
                                      <option value="Delayed / Critical">Delayed / Critical</option>
                                    </select>
                                  ) : col.type === 'textarea' ? (
                                    <textarea
                                      rows={2}
                                      value={currentVal}
                                      onChange={(e) =>
                                        setEditFormData({
                                          ...editFormData,
                                          [col.id]: e.target.value,
                                        })
                                      }
                                      className="w-full px-2 py-1 bg-slate-950 border border-sky-400 rounded text-xs text-white"
                                    />
                                  ) : (
                                    <input
                                      type={
                                        col.type === 'date'
                                          ? 'date'
                                          : col.type === 'number'
                                          ? 'number'
                                          : 'text'
                                      }
                                      value={currentVal}
                                      onChange={(e) =>
                                        setEditFormData({
                                          ...editFormData,
                                          [col.id]: e.target.value,
                                        })
                                      }
                                      className="w-full px-2 py-1 bg-slate-950 border border-sky-400 rounded text-xs text-white font-mono"
                                    />
                                  )}
                                </td>
                              );
                            })}
                            <td className="py-2 px-2 text-center whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => handleSaveEdit(h.id)}
                                className="p-1 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950 rounded mr-1"
                                title="Save Edit"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingRecordId(null)}
                                className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded"
                                title="Cancel"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      }

                      return (
                        <tr
                          key={h.id}
                          className="hover:bg-slate-900/60 transition-colors group"
                        >
                          <td className="py-3 px-3 text-center text-slate-500 font-mono text-[11px]">
                            {idx + 1}
                          </td>

                          {/* DYNAMIC CELL RENDERING */}
                          {visibleHistoryCols.map((col) => {
                            if (col.id === 'date') {
                              return (
                                <td key={col.id} className="py-3 px-3 font-mono font-medium text-slate-300">
                                  <div className="flex items-center gap-1.5">
                                    <Calendar className="w-3 h-3 text-sky-400 shrink-0" />
                                    <span>{h.date}</span>
                                  </div>
                                </td>
                              );
                            }

                            if (col.id === 'status') {
                              const isCrit =
                                h.status.toLowerCase().includes('critical') ||
                                h.status.toLowerCase().includes('delayed');
                              const isDone = h.status === 'Completed';

                              return (
                                <td key={col.id} className="py-3 px-3">
                                  <span
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border ${
                                      isCrit
                                        ? 'bg-rose-950 text-rose-300 border-rose-800'
                                        : isDone
                                        ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                                        : 'bg-sky-950 text-sky-300 border-sky-800/80'
                                    }`}
                                  >
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full ${
                                        isCrit
                                          ? 'bg-rose-400'
                                          : isDone
                                          ? 'bg-emerald-400'
                                          : 'bg-sky-400'
                                      }`}
                                    />
                                    {h.status}
                                  </span>
                                </td>
                              );
                            }

                            if (col.id === 'progressUpdate') {
                              return (
                                <td key={col.id} className="py-3 px-4 text-slate-200">
                                  <p className="leading-relaxed">{h.progressUpdate}</p>
                                  <span className="text-[11px] text-slate-500 mt-0.5 block">
                                    Logged by:{' '}
                                    <strong className="text-slate-400">
                                      {h.loggedBy || 'SAQCivil Team'}
                                    </strong>
                                  </span>
                                </td>
                              );
                            }

                            if (col.id === 'detailsRemarks') {
                              return (
                                <td
                                  key={col.id}
                                  className="py-3 px-4 text-slate-400 text-[11px] leading-relaxed"
                                >
                                  {h.detailsRemarks || <span className="italic opacity-40">—</span>}
                                </td>
                              );
                            }

                            if (col.id === 'trackingRule') {
                              return (
                                <td key={col.id} className="py-3 px-3 font-mono text-[11px] text-slate-400">
                                  <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                                    {h.trackingRule || 'Standard'}
                                  </span>
                                </td>
                              );
                            }

                            if (col.id === 'loggedBy') {
                              return (
                                <td key={col.id} className="py-3 px-3 text-xs text-slate-300 font-medium">
                                  {h.loggedBy || 'SAQCivil Team'}
                                </td>
                              );
                            }

                            // Custom Column value
                            const customVal = h.customValues?.[col.id] || h[col.id] || '';
                            return (
                              <td key={col.id} className="py-3 px-3 text-xs text-slate-300">
                                {col.type === 'number' ? (
                                  <span className="font-mono text-emerald-400 font-semibold">
                                    {formatCurrencyPHP(customVal)}
                                  </span>
                                ) : col.type === 'date' ? (
                                  <span className="font-mono text-sky-400">
                                    {customVal || '—'}
                                  </span>
                                ) : (
                                  String(customVal || '—')
                                )}
                              </td>
                            );
                          })}

                          {/* Row Actions */}
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  handleStartEdit(h);
                                }}
                                className="p-1.5 text-slate-400 hover:text-sky-300 hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
                                title="Edit this record"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  confirmDeleteRecord(h.id);
                                }}
                                className="p-1.5 text-rose-400 hover:text-white hover:bg-rose-600 rounded-md transition-colors cursor-pointer shadow-xs active:scale-95"
                                title="Delete this record (Instant delete · 1-click Undo available)"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-3">
            <span>
              Total History Logs: <strong className="text-white">{slaData.history.length}</strong>
            </span>
            <span>·</span>
            <span>
              Active Columns:{' '}
              <strong className="text-sky-400">{visibleHistoryCols.length}</strong> of{' '}
              {historyColumns.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-md font-semibold transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* 1. CUSTOMIZE SLA MILESTONES & ROADMAP MODAL */}
      <CustomizeSlaMilestonesModal
        isOpen={isCustomizeMilestonesOpen}
        onClose={() => setIsCustomizeMilestonesOpen(false)}
        triggerDate={slaData.triggerDate}
        milestones={slaData.milestones || []}
        onSaveMilestones={handleSaveMilestones}
      />

      {/* 2. CUSTOMIZE SLA COLUMNS MODAL */}
      <CustomizeSlaColumnsModal
        isOpen={isCustomizeColumnsOpen}
        onClose={() => setIsCustomizeColumnsOpen(false)}
        columns={historyColumns}
        onSaveColumns={handleSaveCustomColumns}
      />

      {/* 3. IMPORT SLA HISTORY MODAL (EXCEL / CLIPBOARD FAST ENCODING) */}
      <ImportSlaHistoryModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        siteId={row.siteId}
        columns={historyColumns}
        onImportRecords={handleImportRecords}
      />

      {/* 4. IN-APP CONFIRMATION MODAL FOR DELETING RECORD (Guaranteed to work in iframe) */}
      {recordToDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-xl bg-slate-900 border border-rose-500/50 p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-rose-950 text-rose-400 border border-rose-800 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Delete Progress Record?</h3>
                <p className="text-xs text-slate-400">
                  This progress record will be permanently deleted from this site's timeline.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 text-xs space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-medium">Record Date:</span>
                <span className="font-mono font-bold text-white">{recordToDelete.date}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-medium">Status:</span>
                <span className="font-semibold text-sky-400">{recordToDelete.status}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-medium">Logged By:</span>
                <span className="text-slate-300">{recordToDelete.loggedBy || 'SAQCivil Team'}</span>
              </div>
              <div className="pt-2 border-t border-slate-800 text-slate-300 text-[11px] leading-relaxed line-clamp-2">
                "{recordToDelete.progressUpdate}"
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setRecordToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => confirmDeleteRecord(recordToDelete.id)}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition-colors flex items-center gap-1.5 shadow-md shadow-rose-950 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Yes, Delete Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. FLOATING UNDO TOAST NOTIFICATION */}
      {deletedRecordToast && (
        <div className="fixed bottom-4 right-4 z-60 flex items-center gap-3 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white shadow-2xl animate-in slide-in-from-bottom duration-200 ring-1 ring-rose-500/40">
          <Trash2 className="w-4 h-4 text-rose-400 shrink-0" />
          <span className="text-xs">
            Deleted record from <strong className="text-sky-400 font-mono">{deletedRecordToast.record.date}</strong>
          </span>
          <button
            type="button"
            onClick={handleUndoDeleteRecord}
            className="px-2.5 py-1 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-md transition-colors flex items-center gap-1 shadow-xs cursor-pointer"
          >
            <Undo2 className="w-3 h-3" />
            Undo
          </button>
          <button
            type="button"
            onClick={() => setDeletedRecordToast(null)}
            className="text-slate-400 hover:text-white p-0.5 cursor-pointer"
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
