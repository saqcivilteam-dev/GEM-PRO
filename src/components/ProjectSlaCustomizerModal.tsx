import React, { useState, useEffect } from 'react';
import {
  Tracker,
  SlaScopeType,
  ProjectSlaConfig,
  SlaMilestoneTemplate,
  TrackerRow,
  ColumnDefinition,
} from '../types/tracker';
import {
  SLA_SCOPE_PRESETS,
  getEffectiveTrackerSlaConfig,
  isTrackerSlaEnabled,
  createMilestonesFromTemplate,
  addDaysToDateString,
  getLocalDateString,
  normalizeToStandardDate,
} from '../utils/excelUtils';
import {
  X,
  Target,
  Clock,
  Sparkles,
  Check,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  ShieldCheck,
  AlertCircle,
  FileCheck,
  Layers,
  ChevronRight,
  Sliders,
  CheckCircle2,
  XCircle,
  Search,
  Eye,
  EyeOff,
  HelpCircle,
  ListFilter,
} from 'lucide-react';

export interface ProjectSlaCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  tracker: Tracker;
  onSaveProjectSla: (updatedTracker: Tracker) => void;
  canEdit: boolean;
  allTrackers?: Tracker[];
  onSelectTracker?: (trackerId: string) => void;
  onUpdateTrackersList?: (trackers: Tracker[]) => void;
}

export const ProjectSlaCustomizerModal: React.FC<ProjectSlaCustomizerModalProps> = ({
  isOpen,
  onClose,
  tracker,
  onSaveProjectSla,
  canEdit,
  allTrackers = [tracker],
  onSelectTracker,
  onUpdateTrackersList,
}) => {
  if (!isOpen) return null;

  // Active tracker being configured in the modal
  const [activeTrkId, setActiveTrkId] = useState<string>(tracker.id);
  const activeTracker = allTrackers.find((t) => t.id === activeTrkId) || tracker;

  // Tab: 'current' (detailed SLA config for active tracker) or 'all_trackers' (overview & toggles where to put SLA)
  const [activeTab, setActiveTab] = useState<'current' | 'all_trackers'>('current');
  const [trackerSearch, setTrackerSearch] = useState('');

  const currentCfg = getEffectiveTrackerSlaConfig(activeTracker);

  // Master SLA Enablement toggle for current tracker
  const [isSlaEnabled, setIsSlaEnabled] = useState<boolean>(() => isTrackerSlaEnabled(activeTracker));
  const [syncColumnsOnToggle, setSyncColumnsOnToggle] = useState<boolean>(true);

  // SLA Scope & Milestones state
  const [selectedScope, setSelectedScope] = useState<SlaScopeType>(currentCfg.scopeType);
  const [scopeName, setScopeName] = useState(currentCfg.scopeName);
  const [targetDays, setTargetDays] = useState<number>(currentCfg.targetDays);
  const [description, setDescription] = useState(currentCfg.description || '');
  const [milestones, setMilestones] = useState<SlaMilestoneTemplate[]>(() =>
    JSON.parse(JSON.stringify(currentCfg.milestones || []))
  );

  const [applyToExistingSites, setApplyToExistingSites] = useState(true);
  const [savedFeedback, setSavedFeedback] = useState<string | null>(null);

  // When activeTrkId changes, sync state to that tracker
  useEffect(() => {
    const trk = allTrackers.find((t) => t.id === activeTrkId) || tracker;
    const cfg = getEffectiveTrackerSlaConfig(trk);
    setIsSlaEnabled(isTrackerSlaEnabled(trk));
    setSelectedScope(cfg.scopeType);
    setScopeName(cfg.scopeName);
    setTargetDays(cfg.targetDays);
    setDescription(cfg.description || '');
    setMilestones(JSON.parse(JSON.stringify(cfg.milestones || [])));
    setSavedFeedback(null);
  }, [activeTrkId]);

  // Switch preset
  const handleSelectPreset = (preset: ProjectSlaConfig) => {
    setSelectedScope(preset.scopeType);
    setScopeName(preset.scopeName);
    setTargetDays(preset.targetDays);
    setDescription(preset.description || '');
    setMilestones(JSON.parse(JSON.stringify(preset.milestones)));
  };

  const handleUpdateMilestone = (idx: number, updates: Partial<SlaMilestoneTemplate>) => {
    setMilestones((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...updates };
      // If last milestone target days changed, update overall target days
      if (idx === next.length - 1 && updates.targetDaysFromTrigger !== undefined) {
        setTargetDays(updates.targetDaysFromTrigger);
      }
      return next;
    });
  };

  const handleAddMilestone = () => {
    const lastDay = milestones.length > 0 ? milestones[milestones.length - 1].targetDaysFromTrigger : 0;
    const newDay = lastDay + 7;
    const newTpl: SlaMilestoneTemplate = {
      name: `New Milestone Stage ${milestones.length + 1}`,
      targetDaysFromTrigger: newDay,
      description: 'Custom milestone requirement',
    };
    const updated = [...milestones, newTpl];
    setMilestones(updated);
    setTargetDays(newDay);
    if (selectedScope !== 'custom') setSelectedScope('custom');
  };

  const handleRemoveMilestone = (idx: number) => {
    if (milestones.length <= 1) return;
    const updated = milestones.filter((_, i) => i !== idx);
    setMilestones(updated);
    if (updated.length > 0) {
      setTargetDays(updated[updated.length - 1].targetDaysFromTrigger);
    }
    if (selectedScope !== 'custom') setSelectedScope('custom');
  };

  const handleMoveUp = (idx: number) => {
    if (idx <= 0) return;
    setMilestones((prev) => {
      const next = [...prev];
      const temp = next[idx];
      next[idx] = next[idx - 1];
      next[idx - 1] = temp;
      return next;
    });
  };

  const handleMoveDown = (idx: number) => {
    if (idx >= milestones.length - 1) return;
    setMilestones((prev) => {
      const next = [...prev];
      const temp = next[idx];
      next[idx] = next[idx + 1];
      next[idx + 1] = temp;
      return next;
    });
  };

  // Quick 1-click toggle SLA for any tracker in the "all_trackers" matrix
  const handleQuickToggleTrackerSla = (targetTrk: Tracker, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canEdit) return;

    const currentStatus = isTrackerSlaEnabled(targetTrk);
    const nextStatus = !currentStatus;

    // Adjust columns if requested
    let updatedCols = [...(targetTrk.columns || [])];
    if (nextStatus) {
      // Unhide or add standard SLA columns
      const hasDaySla = updatedCols.some((c) => c.type === 'day_sla' || c.id === 'daily_sla');
      if (!hasDaySla) {
        updatedCols.splice(3, 0, {
          id: 'daily_sla',
          label: 'DAILY STATUS / SAQ SLA',
          type: 'day_sla',
          width: 190,
          visible: true,
        });
      } else {
        updatedCols = updatedCols.map((c) =>
          c.type === 'day_sla' || c.type === 'sla_trigger_date' || c.type === 'sla_health'
            ? { ...c, visible: true }
            : c
        );
      }
    } else {
      // Hide SLA columns
      updatedCols = updatedCols.map((c) =>
        c.type === 'day_sla' || c.type === 'sla_trigger_date' || c.type === 'sla_health'
          ? { ...c, visible: false }
          : c
      );
    }

    const updatedTrk: Tracker = {
      ...targetTrk,
      enableSla: nextStatus,
      slaConfig: {
        ...(targetTrk.slaConfig || getEffectiveTrackerSlaConfig(targetTrk)),
        enabled: nextStatus,
      },
      columns: updatedCols,
      updatedAt: new Date().toISOString(),
    };

    if (onUpdateTrackersList) {
      const updatedList = allTrackers.map((t) => (t.id === targetTrk.id ? updatedTrk : t));
      onUpdateTrackersList(updatedList);
    }
    if (targetTrk.id === tracker.id) {
      onSaveProjectSla(updatedTrk);
      setIsSlaEnabled(nextStatus);
    }
  };

  const handleSave = () => {
    if (!canEdit) return;

    // Sort milestones by target days
    const sortedMilestones = [...milestones].sort(
      (a, b) => a.targetDaysFromTrigger - b.targetDaysFromTrigger
    );
    const finalTargetDays =
      sortedMilestones.length > 0
        ? sortedMilestones[sortedMilestones.length - 1].targetDaysFromTrigger
        : targetDays;

    const newSlaConfig: ProjectSlaConfig = {
      enabled: isSlaEnabled,
      scopeType: selectedScope,
      scopeName: scopeName.trim() || `${finalTargetDays}-Day Target SLA`,
      targetDays: finalTargetDays,
      description: description.trim(),
      milestones: sortedMilestones,
    };

    let updatedRows = [...(activeTracker.rows || [])];

    if (isSlaEnabled && applyToExistingSites) {
      updatedRows = updatedRows.map((row) => {
        if (!row || row.siteId === 'SUMMARY' || row.values?.site_id === 'SUMMARY') return row;
        const trigger = normalizeToStandardDate(row.slaData?.triggerDate) || getLocalDateString();
        const calculatedTarget = addDaysToDateString(trigger, finalTargetDays);

        // Generate updated milestones preserving completed statuses
        const newSiteMilestones = createMilestonesFromTemplate(sortedMilestones, trigger, calculatedTarget);
        if (Array.isArray(row.slaData?.milestones)) {
          const oldStatusMap = new Map(row.slaData.milestones.map((m) => [m.name.toLowerCase().trim(), m.status]));
          newSiteMilestones.forEach((nm) => {
            const oldStatus = oldStatusMap.get(nm.name.toLowerCase().trim());
            if (oldStatus) nm.status = oldStatus;
          });
        }

        return {
          ...row,
          slaData: {
            ...row.slaData,
            targetDays: finalTargetDays,
            slaScopeName: newSlaConfig.scopeName,
            scopeType: selectedScope,
            milestones: newSiteMilestones,
          },
        };
      });
    }

    // Synchronize columns based on SLA enablement
    let updatedColumns = [...(activeTracker.columns || [])];
    if (syncColumnsOnToggle) {
      if (isSlaEnabled) {
        // Ensure day_sla column is present and visible
        const daySlaIndex = updatedColumns.findIndex((c) => c.type === 'day_sla' || c.id === 'daily_sla');
        if (daySlaIndex === -1) {
          updatedColumns.splice(3, 0, {
            id: 'daily_sla',
            label: 'DAILY STATUS / SAQ SLA',
            type: 'day_sla',
            width: 190,
            visible: true,
          });
        } else {
          updatedColumns[daySlaIndex] = { ...updatedColumns[daySlaIndex], visible: true };
        }

        // Unhide trigger date and health columns if present
        updatedColumns = updatedColumns.map((c) =>
          c.type === 'sla_trigger_date' || c.type === 'sla_health' ? { ...c, visible: true } : c
        );
      } else {
        // If SLA disabled, hide SLA columns so user has a clean spreadsheet
        updatedColumns = updatedColumns.map((c) =>
          c.type === 'day_sla' || c.type === 'sla_trigger_date' || c.type === 'sla_health'
            ? { ...c, visible: false }
            : c
        );
      }
    }

    const updatedTracker: Tracker = {
      ...activeTracker,
      enableSla: isSlaEnabled,
      slaConfig: newSlaConfig,
      columns: updatedColumns,
      rows: updatedRows,
      updatedAt: new Date().toISOString(),
    };

    onSaveProjectSla(updatedTracker);

    if (onUpdateTrackersList) {
      const updatedList = allTrackers.map((t) => (t.id === updatedTracker.id ? updatedTracker : t));
      onUpdateTrackersList(updatedList);
    }

    setSavedFeedback(
      isSlaEnabled
        ? `Applied ${newSlaConfig.scopeName} (${finalTargetDays}d SLA) to "${activeTracker.name}"!`
        : `SLA tracking disabled for "${activeTracker.name}". Grid updated!`
    );

    setTimeout(() => {
      setSavedFeedback(null);
      onClose();
    }, 1200);
  };

  const sampleTrigger = getLocalDateString();
  const sampleTarget = addDaysToDateString(sampleTrigger, targetDays);

  const filteredTrackers = allTrackers.filter((t) => {
    if (!trackerSearch.trim()) return true;
    const q = trackerSearch.toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      (t.description || '').toLowerCase().includes(q) ||
      (t.slaConfig?.scopeName || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150 text-slate-100">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">SLA Tracking & Milestone Configuration</h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-sky-400 font-bold">
                  {allTrackers.length} Trackers
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Choose which trackers require SAQ SLA milestone tracking and which operate as standard spreadsheets.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-5 py-2 bg-slate-950/70 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('current')}
              className={`px-3 py-1.5 rounded-md font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'current'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Current Tracker SLA</span>
              <span
                className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold ${
                  isSlaEnabled ? 'bg-amber-400 text-black' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {isSlaEnabled ? 'ACTIVE' : 'OFF'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('all_trackers')}
              className={`px-3 py-1.5 rounded-md font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'all_trackers'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <ListFilter className="w-3.5 h-3.5" />
              <span>Choose Where to Put SLA (All Trackers)</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded font-mono font-bold bg-slate-800 text-sky-300">
                {allTrackers.filter((t) => isTrackerSlaEnabled(t)).length}/{allTrackers.length} with SLA
              </span>
            </button>
          </div>

          {/* Quick tracker switcher */}
          {activeTab === 'current' && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400 hidden sm:inline">Configuring:</span>
              <select
                value={activeTrkId}
                onChange={(e) => {
                  setActiveTrkId(e.target.value);
                  if (onSelectTracker) onSelectTracker(e.target.value);
                }}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white font-semibold cursor-pointer max-w-[200px] truncate"
              >
                {allTrackers.map((t) => {
                  const enabled = isTrackerSlaEnabled(t);
                  return (
                    <option key={t.id} value={t.id} className="bg-slate-900 text-white">
                      {enabled ? '⚡ ' : '📋 '} {t.name}
                    </option>
                  );
                })}
              </select>
            </div>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {activeTab === 'all_trackers' ? (
            /* TAB 2: CHOOSE WHERE TO PUT SLA ACROSS ALL TRACKERS */
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-950/40 via-slate-900 to-amber-950/30 border border-indigo-800/50 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>Workspace SLA Assignment Matrix</span>
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Toggle SAQ SLA milestone tracking ON or OFF for each individual tracker with 1 click.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2.5 py-1 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono font-bold">
                    {allTrackers.filter((t) => isTrackerSlaEnabled(t)).length} SLA Enabled
                  </span>
                  <span className="px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                    {allTrackers.filter((t) => !isTrackerSlaEnabled(t)).length} Standard Sheets
                  </span>
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={trackerSearch}
                  onChange={(e) => setTrackerSearch(e.target.value)}
                  placeholder="Filter trackers by name, SLA preset, or folder..."
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              {/* Trackers Matrix Table */}
              <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-900/90 border-b border-slate-800 text-slate-400 font-semibold text-[11px]">
                      <th className="px-3 py-2.5 text-left">Tracker Name</th>
                      <th className="px-3 py-2.5 text-left w-48">SLA Status</th>
                      <th className="px-3 py-2.5 text-left w-56">Active Scope / Target</th>
                      <th className="px-3 py-2.5 text-center w-24">Rows</th>
                      <th className="px-3 py-2.5 text-right w-44">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {filteredTrackers.map((t) => {
                      const enabled = isTrackerSlaEnabled(t);
                      const cfg = getEffectiveTrackerSlaConfig(t);
                      const isCurrent = t.id === activeTrkId;

                      return (
                        <tr
                          key={t.id}
                          className={`hover:bg-slate-900/60 transition-colors ${
                            isCurrent ? 'bg-indigo-950/20' : ''
                          }`}
                        >
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white text-xs">{t.name}</span>
                              {isCurrent && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-900 text-indigo-300 font-mono">
                                  Current
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-500 block truncate max-w-sm">
                              {t.description || 'Custom tracker'}
                            </span>
                          </td>

                          <td className="px-3 py-2.5">
                            {enabled ? (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 font-semibold text-[11px]">
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                <span>SLA Enabled</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-900 text-slate-400 border border-slate-700 font-semibold text-[11px]">
                                <XCircle className="w-3 h-3 text-slate-500" />
                                <span>Standard (No SLA)</span>
                              </span>
                            )}
                          </td>

                          <td className="px-3 py-2.5">
                            {enabled ? (
                              <div className="text-slate-300">
                                <span className="font-medium text-amber-300 font-mono">{cfg.targetDays}d</span>
                                <span className="text-slate-400 ml-1 truncate">· {cfg.scopeName}</span>
                              </div>
                            ) : (
                              <span className="text-slate-500 italic">No milestone deadlines</span>
                            )}
                          </td>

                          <td className="px-3 py-2.5 text-center font-mono text-slate-400">
                            {t.rows?.length || 0}
                          </td>

                          <td className="px-3 py-2.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Quick 1-Click Toggle */}
                              <button
                                type="button"
                                onClick={(e) => handleQuickToggleTrackerSla(t, e)}
                                disabled={!canEdit}
                                className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all cursor-pointer ${
                                  enabled
                                    ? 'bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800/60'
                                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs'
                                }`}
                                title={enabled ? 'Turn OFF SLA for this tracker' : 'Turn ON SLA for this tracker'}
                              >
                                {enabled ? 'Disable SLA' : 'Enable SLA'}
                              </button>

                              {/* Configure in Editor */}
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveTrkId(t.id);
                                  setActiveTab('current');
                                  if (onSelectTracker) onSelectTracker(t.id);
                                }}
                                className="px-2.5 py-1 rounded text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                              >
                                Configure
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* TAB 1: CURRENT TRACKER SLA CONFIGURATION & TOGGLE */
            <div className="space-y-5">
              {/* Master SLA Switch Card */}
              <div
                className={`p-4 rounded-xl border transition-all ${
                  isSlaEnabled
                    ? 'bg-indigo-950/30 border-indigo-500/60 shadow-lg ring-1 ring-indigo-500/30'
                    : 'bg-slate-950 border-slate-800'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2.5 rounded-xl ${
                        isSlaEnabled ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-500'
                      }`}
                    >
                      <Target className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-white">
                          SAQ SLA Tracking for "{activeTracker.name}"
                        </h3>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider ${
                            isSlaEnabled
                              ? 'bg-amber-500 text-black'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          {isSlaEnabled ? 'SLA ACTIVE' : 'SLA DISABLED (STANDARD SHEET)'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        {isSlaEnabled
                          ? 'This tracker enforces SAQ SLA Day-by-Day logs, milestone countdowns, and 14-day delay alerts.'
                          : 'This tracker operates as a standard spreadsheet. Milestone timelines, day counters, and delay alerts are disabled.'}
                      </p>
                    </div>
                  </div>

                  {/* Toggle Button */}
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => setIsSlaEnabled(!isSlaEnabled)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-md ${
                        isSlaEnabled
                          ? 'bg-amber-500 hover:bg-amber-400 text-black'
                          : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                      }`}
                    >
                      {isSlaEnabled ? (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Turn SLA OFF</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          <span>Turn SLA ON</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Auto sync columns option */}
                <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={syncColumnsOnToggle}
                      onChange={(e) => setSyncColumnsOnToggle(e.target.checked)}
                      className="w-3.5 h-3.5 rounded text-indigo-500 bg-slate-900 border-slate-700"
                    />
                    <span>
                      {isSlaEnabled
                        ? 'Automatically display standard SLA columns (DAILY STATUS, SLA Trigger, SLA Health) in grid'
                        : 'Automatically hide SLA columns from spreadsheet grid when disabled'}
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setActiveTab('all_trackers')}
                    className="text-sky-400 hover:underline flex items-center gap-1 font-semibold"
                  >
                    <span>View all trackers SLA matrix</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* If SLA is disabled, display simple sheet notice */}
              {!isSlaEnabled ? (
                <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                    <FileCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Operating as Standard Spreadsheet</h4>
                    <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                      No SLA rules, countdowns, or delay alerts are applied to "{activeTracker.name}". You can use all Excel features, custom columns, formulas, and data drawers freely.
                    </p>
                  </div>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setIsSlaEnabled(true)}
                      className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Enable SAQ SLA on This Tracker</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* SLA Configuration Controls (Presets, Target Days, Milestones) */
                <>
                  {/* Preset Selector */}
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                      <span>Choose Official SLA Scope Preset</span>
                      <span className="text-[11px] font-normal text-slate-400">
                        Tailored to Telecom SAQ & Civil Operations
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                      {SLA_SCOPE_PRESETS.map((preset) => {
                        const isSelected = selectedScope === preset.scopeType;
                        return (
                          <div
                            key={preset.scopeType}
                            onClick={() => handleSelectPreset(preset)}
                            className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative ${
                              isSelected
                                ? 'bg-indigo-950/60 border-indigo-500 ring-2 ring-indigo-500/50 shadow-md'
                                : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span
                                className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                                  isSelected
                                    ? 'bg-amber-400 text-black'
                                    : 'bg-slate-800 text-slate-300'
                                }`}
                              >
                                {preset.targetDays} Days
                              </span>
                              {isSelected && <Check className="w-4 h-4 text-emerald-400" />}
                            </div>

                            <div className="font-bold text-xs text-white mt-1.5 leading-snug">
                              {preset.scopeName}
                            </div>

                            <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                              {preset.description}
                            </p>

                            <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500">
                              <span>{preset.milestones.length} Milestones</span>
                              {isSelected ? (
                                <span className="text-emerald-400 font-semibold flex items-center gap-0.5">
                                  <Sparkles className="w-3 h-3" />
                                  Active
                                </span>
                              ) : (
                                <span className="text-slate-500">Click to apply</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Scope Name & Total Target Days Configuration */}
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                    <div className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center justify-between">
                      <span>SLA Target Settings</span>
                      <span className="text-[11px] font-normal text-sky-400 font-mono">
                        Sample: {sampleTrigger} → {sampleTarget} ({targetDays} days)
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2 space-y-1">
                        <label className="text-[11px] font-medium text-slate-400">
                          SLA Scope Title / Endorsement Name:
                        </label>
                        <input
                          type="text"
                          value={scopeName}
                          onChange={(e) => {
                            setScopeName(e.target.value);
                            if (selectedScope !== 'custom') setSelectedScope('custom');
                          }}
                          placeholder="e.g. Securing Post-Con Only (21d SLA)"
                          className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-lg text-white focus:outline-hidden focus:border-indigo-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-slate-400">
                          Total SLA Target (Days):
                        </label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min={1}
                            max={365}
                            value={targetDays}
                            onChange={(e) => {
                              const v = Math.max(1, parseInt(e.target.value, 10) || 1);
                              setTargetDays(v);
                              if (selectedScope !== 'custom') setSelectedScope('custom');
                              if (milestones.length > 0) {
                                setMilestones((prev) => {
                                  const next = [...prev];
                                  next[next.length - 1].targetDaysFromTrigger = v;
                                  return next;
                                });
                              }
                            }}
                            className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-lg text-amber-400 font-bold font-mono focus:outline-hidden focus:border-indigo-500"
                          />
                          <span className="text-xs text-slate-400 font-bold">Days</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Milestone Stages Editor */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                        <FileCheck className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Milestone Stages & Day Offsets ({milestones.length} Stages)</span>
                      </div>

                      <button
                        type="button"
                        onClick={handleAddMilestone}
                        className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Stage</span>
                      </button>
                    </div>

                    <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-900/90 border-b border-slate-800 text-slate-400 font-semibold text-[11px]">
                            <th className="px-3 py-2 text-left w-12">#</th>
                            <th className="px-3 py-2 text-left">Stage Name & Requirement</th>
                            <th className="px-3 py-2 text-center w-36">Cumulative Day Target</th>
                            <th className="px-3 py-2 text-center w-28">Sample Date</th>
                            <th className="px-3 py-2 text-right w-24">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-850">
                          {milestones.map((ms, idx) => {
                            const prevCumulative = idx > 0 ? milestones[idx - 1].targetDaysFromTrigger : 0;
                            const stageDays = Math.max(1, ms.targetDaysFromTrigger - prevCumulative);
                            const calcDate = addDaysToDateString(sampleTrigger, ms.targetDaysFromTrigger);

                            return (
                              <tr key={idx} className="hover:bg-slate-900/50 transition-colors">
                                <td className="px-3 py-2 text-slate-500 font-mono font-bold text-[11px]">
                                  {idx + 1}
                                </td>
                                <td className="px-3 py-2">
                                  <input
                                    type="text"
                                    value={ms.name}
                                    onChange={(e) => handleUpdateMilestone(idx, { name: e.target.value })}
                                    className="w-full px-2 py-1 text-xs bg-slate-900 border border-slate-800 rounded text-slate-100 font-medium focus:outline-hidden focus:border-indigo-500"
                                    placeholder="Milestone stage title..."
                                  />
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    <span className="text-[10px] text-slate-500">Day</span>
                                    <input
                                      type="number"
                                      min={1}
                                      max={365}
                                      value={ms.targetDaysFromTrigger}
                                      onChange={(e) =>
                                        handleUpdateMilestone(idx, {
                                          targetDaysFromTrigger: Math.max(1, parseInt(e.target.value, 10) || 1),
                                        })
                                      }
                                      className="w-16 px-2 py-1 text-center text-xs font-mono font-bold bg-slate-900 border border-slate-800 rounded text-amber-400 focus:outline-hidden focus:border-indigo-500"
                                    />
                                    <span className="text-[10px] text-slate-500 font-mono">
                                      (+{stageDays}d)
                                    </span>
                                  </div>
                                </td>
                                <td className="px-3 py-2 text-center font-mono text-[11px] text-sky-400">
                                  {calcDate}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleMoveUp(idx)}
                                      disabled={idx === 0}
                                      className="p-1 text-slate-400 hover:text-white disabled:opacity-20 rounded hover:bg-slate-800"
                                      title="Move up"
                                    >
                                      <ArrowUp className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleMoveDown(idx)}
                                      disabled={idx === milestones.length - 1}
                                      className="p-1 text-slate-400 hover:text-white disabled:opacity-20 rounded hover:bg-slate-800"
                                      title="Move down"
                                    >
                                      <ArrowDown className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveMilestone(idx)}
                                      disabled={milestones.length <= 1}
                                      className="p-1 text-rose-400 hover:text-rose-300 disabled:opacity-20 rounded hover:bg-slate-800"
                                      title="Delete stage"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Batch Application Option */}
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={applyToExistingSites}
                        onChange={(e) => setApplyToExistingSites(e.target.checked)}
                        className="w-4 h-4 rounded text-indigo-500 focus:ring-indigo-500 bg-slate-900 border-slate-700"
                      />
                      <div className="text-xs">
                        <span className="font-bold text-white block">
                          Apply customized SLA to all {activeTracker.rows?.length || 0} existing sites in this project
                        </span>
                        <span className="text-[11px] text-slate-400 block mt-0.5">
                          Recalculates target completion dates and applies this {targetDays}-day SLA roadmap across current rows.
                        </span>
                      </div>
                    </label>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-400">
            {savedFeedback ? (
              <span className="text-emerald-400 font-bold flex items-center gap-1.5 animate-in fade-in">
                <Check className="w-4 h-4" />
                {savedFeedback}
              </span>
            ) : (
              <span>
                Configuring: <strong className="text-white">{activeTracker.name}</strong> ·{' '}
                <span className={isSlaEnabled ? 'text-amber-400 font-bold' : 'text-slate-400'}>
                  {isSlaEnabled ? `${targetDays}d SLA Active` : 'SLA Disabled (Standard Sheet)'}
                </span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!canEdit}
              className={`px-5 py-2 rounded-lg text-xs font-bold text-white transition-colors flex items-center gap-1.5 shadow-md ${
                isSlaEnabled
                  ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-950'
                  : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-950'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>Save & Apply Settings</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
