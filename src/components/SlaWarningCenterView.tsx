import React, { useState, useMemo } from 'react';
import { Tracker, TrackerRow } from '../types/tracker';
import { formatCurrencyPHP, parseNumericValue, evaluateSlaStatus, getEffectiveTrackerSlaConfig, isTrackerSlaEnabled } from '../utils/excelUtils';
import {
  ShieldAlert,
  AlertTriangle,
  Clock,
  Calendar,
  CheckCircle,
  TrendingDown,
  ArrowRight,
  ExternalLink,
  Search,
  Filter,
  Target,
} from 'lucide-react';

interface SlaWarningCenterViewProps {
  tracker: Tracker;
  onOpenSlaModal: (row: TrackerRow) => void;
  onOpenChecklistModal: (row: TrackerRow) => void;
  onOpenSiteDataDrawer: (row: TrackerRow) => void;
  onOpenProjectSlaModal?: () => void;
}

export const SlaWarningCenterView: React.FC<SlaWarningCenterViewProps> = ({
  tracker,
  onOpenSlaModal,
  onOpenChecklistModal,
  onOpenSiteDataDrawer,
  onOpenProjectSlaModal,
}) => {
  const [filterPriority, setFilterPriority] = useState<'ALL' | 'CRITICAL' | 'HIGH' | 'MEDIUM'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const rows = useMemo(() => tracker?.rows || [], [tracker]);

  const { noMovement14dSites, delayedSites, approachingSites, onTrackSites, filteredRows } = useMemo(() => {
    const noMove = rows.filter((r) => r.slaData?.isNoMovement14Days);
    const delayed = rows.filter((r) => r.slaData?.slaHealth === 'delayed' || r.slaData?.slaHealth === 'critical');
    const approaching = rows.filter((r) => r.slaData?.slaHealth === 'approaching');
    const onTrack = rows.filter((r) => r.slaData?.slaHealth === 'on_track');

    const cleanQ = searchQuery.trim().toLowerCase();
    const filtered = rows.filter((r) => {
      const priority = r.slaData?.priority || 'NORMAL';
      if (filterPriority === 'CRITICAL' && priority !== 'CRITICAL') return false;
      if (filterPriority === 'HIGH' && priority !== 'HIGH') return false;
      if (filterPriority === 'MEDIUM' && priority !== 'MEDIUM') return false;

      if (cleanQ) {
        const inId = String(r.siteId || r.values?.site_id || '').toLowerCase().includes(cleanQ);
        const inName = String(r.siteDetails?.siteName || r.values?.site_name || '').toLowerCase().includes(cleanQ);
        const inPic = String(r.siteDetails?.picHandler || r.values?.pic_handler || '').toLowerCase().includes(cleanQ);
        const inStatus = String(r.values?.status || r.slaData?.currentStatus || '').toLowerCase().includes(cleanQ);
        if (!inId && !inName && !inPic && !inStatus) return false;
      }

      return true;
    });

    return {
      noMovement14dSites: noMove,
      delayedSites: delayed,
      approachingSites: approaching,
      onTrackSites: onTrack,
      filteredRows: filtered,
    };
  }, [rows, filterPriority, searchQuery]);

  const effSla = getEffectiveTrackerSlaConfig(tracker);
  const isSlaActive = isTrackerSlaEnabled(tracker);

  if (!isSlaActive) {
    return (
      <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center text-center max-w-xl mx-auto space-y-4 animate-in fade-in">
        <div className="w-16 h-16 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 shadow-xl">
          <Target className="w-8 h-8 text-slate-400" />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-center gap-2">
            <h2 className="text-lg font-bold text-white">SLA Tracking is Disabled</h2>
            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 font-mono font-bold">
              STANDARD SHEET
            </span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            "{tracker.name}" is operating as a standard project sheet without SAQ SLA countdowns or 14-day inactivity warnings.
          </p>
        </div>
        {onOpenProjectSlaModal && (
          <button
            type="button"
            onClick={onOpenProjectSlaModal}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-indigo-950 cursor-pointer"
          >
            <Target className="w-4 h-4 text-amber-400" />
            <span>Enable or Configure SLA for this Tracker</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
      {/* Top Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-rose-950/60 via-slate-900 to-amber-950/40 border border-rose-900/60 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-rose-600/20 text-rose-400 rounded-xl border border-rose-500/30">
            <ShieldAlert className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white tracking-wide">
                Centralized SAQ Priority & Early Warning Center
              </h1>
              <span className="text-[11px] px-2 py-0.5 rounded bg-rose-900 text-rose-200 font-bold uppercase tracking-wider">
                Automated Delays & Inactivity Engine
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1">
              Active Project Scope: <strong className="text-amber-300">{effSla.scopeName} ({effSla.targetDays} Days Target)</strong>. Monitored across sequential milestones and 14-day inactivity rules.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Project Target SLA Card */}
          <div className="px-3.5 py-2 rounded-xl bg-slate-950/70 border border-indigo-700/60 text-right">
            <div className="flex items-center justify-end gap-1.5 text-[10px] uppercase font-bold tracking-wider text-indigo-300">
              <Target className="w-3 h-3 text-amber-400" />
              <span>Project SLA Target</span>
            </div>
            <div className="flex items-center justify-end gap-2 mt-0.5">
              <span className="text-xl font-bold font-mono text-amber-300 tabular-nums">
                {effSla.targetDays} Days
              </span>
              {onOpenProjectSlaModal && (
                <button
                  type="button"
                  onClick={onOpenProjectSlaModal}
                  className="px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold transition-colors cursor-pointer"
                  title="Customize SLA target days and milestone roadmap for this project"
                >
                  Edit SLA
                </button>
              )}
            </div>
          </div>
          <div className="px-3.5 py-2 rounded-xl bg-slate-950/70 border border-slate-800 text-right">
            <div className="text-[10px] uppercase font-bold tracking-wider text-rose-400">14-Day Inactivity Alerts</div>
            <div className="text-xl font-bold font-mono text-rose-300 tabular-nums">
              {noMovement14dSites.length} Sites
            </div>
          </div>
          <div className="px-3.5 py-2 rounded-xl bg-slate-950/70 border border-slate-800 text-right">
            <div className="text-[10px] uppercase font-bold tracking-wider text-amber-400">Target SLA Delays</div>
            <div className="text-xl font-bold font-mono text-amber-300 tabular-nums">
              {delayedSites.length} Sites
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Priority Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-400">Priority Filter:</span>
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              type="button"
              onClick={() => setFilterPriority('ALL')}
              className={`px-3 py-1 rounded-md font-semibold transition-colors ${
                filterPriority === 'ALL'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All Sites ({rows.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterPriority('CRITICAL')}
              className={`px-3 py-1 rounded-md font-semibold transition-colors flex items-center gap-1.5 ${
                filterPriority === 'CRITICAL'
                  ? 'bg-rose-900 text-rose-100'
                  : 'text-slate-400 hover:text-rose-300'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
              Critical Attention ({rows.filter((r) => r.slaData.priority === 'CRITICAL').length})
            </button>
            <button
              type="button"
              onClick={() => setFilterPriority('HIGH')}
              className={`px-3 py-1 rounded-md font-semibold transition-colors flex items-center gap-1.5 ${
                filterPriority === 'HIGH'
                  ? 'bg-amber-900 text-amber-100'
                  : 'text-slate-400 hover:text-amber-300'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              High Priority ({rows.filter((r) => r.slaData.priority === 'HIGH').length})
            </button>
          </div>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search warning sites..."
            className="pl-8 pr-3 py-1.5 text-xs bg-slate-950 border border-slate-700 rounded-md text-white placeholder-slate-500 focus:outline-hidden focus:border-rose-500 w-56"
          />
        </div>
      </div>

      {/* Warning Cards List */}
      <div className="space-y-3.5">
        {filteredRows.length === 0 ? (
          <div className="p-12 text-center rounded-xl bg-slate-900/60 border border-slate-800 text-slate-500 text-xs">
            No sites matching the active priority filter.
          </div>
        ) : (
          filteredRows.map((row) => {
            const evalResult = evaluateSlaStatus(
              row.slaData?.triggerDate || '',
              row.slaData?.lastMovementDate || '',
              row.slaData?.milestones || [],
              row.values?.status || row.slaData?.currentStatus
            );
            const isNoMove = evalResult.isNoMovement14Days;
            const isCritical = evalResult.priority === 'CRITICAL';
            const isDelayed = evalResult.health === 'delayed';

            return (
              <div
                key={row.id}
                className={`p-4 rounded-xl border transition-all ${
                  isCritical
                    ? 'bg-rose-950/30 border-rose-900/80 ring-1 ring-rose-500/30'
                    : isDelayed
                    ? 'bg-amber-950/20 border-amber-900/60'
                    : 'bg-slate-900/80 border-slate-800'
                } flex flex-col md:flex-row md:items-center justify-between gap-4`}
              >
                {/* Left Site Info & Warning Status */}
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-slate-950 text-sky-400 border border-slate-800">
                      {row.siteId}
                    </span>
                    <h3 className="font-bold text-white text-sm">
                      {row.siteDetails?.siteName || row.values?.site_name || row.siteId}
                    </h3>
                    {row.siteDetails?.region && (
                      <span className="text-xs text-slate-400">· {row.siteDetails.region}</span>
                    )}

                    {/* Priority badge */}
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                        evalResult.priority === 'CRITICAL'
                          ? 'bg-rose-900 text-rose-200 border border-rose-700'
                          : evalResult.priority === 'HIGH'
                          ? 'bg-amber-900 text-amber-200 border border-amber-700'
                          : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      }`}
                    >
                      Priority: {evalResult.priority}
                    </span>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        evalResult.health === 'critical'
                          ? 'bg-rose-950 text-rose-300 border border-rose-800'
                          : evalResult.health === 'delayed'
                          ? 'bg-amber-950 text-amber-300 border border-amber-800'
                          : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      }`}
                    >
                      {evalResult.healthLabel}
                    </span>

                    {isNoMove && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-600 text-white uppercase tracking-wider animate-pulse">
                        ⚠️ NO MOVEMENT &ge; 14 DAYS
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                    <span>
                      Current Status: <strong className="text-slate-200">{row.values?.status || 'Active'}</strong>
                    </span>
                    <span>·</span>
                    <span>
                      SLA Trigger (Day 0):{' '}
                      <strong className="text-slate-200 font-mono">
                        {row.slaData?.triggerDate || 'N/A'}
                      </strong>
                    </span>
                    <span>·</span>
                    <span>
                      Elapsed:{' '}
                      <strong className="text-amber-400 font-mono">
                        {evalResult.daysElapsed}d
                      </strong>
                    </span>
                    <span>·</span>
                    <span>
                      Last Movement:{' '}
                      <strong className={`font-mono ${isNoMove ? 'text-rose-400 font-bold' : 'text-slate-200'}`}>
                        {row.slaData?.lastMovementDate || 'No movement recorded'}
                      </strong>
                    </span>
                    <span>·</span>
                    <span>
                      PIC Handler:{' '}
                      <strong className="text-amber-300">
                        {row.siteDetails?.picHandler || row.values?.pic_handler || 'Unassigned'}
                      </strong>
                    </span>
                  </div>

                  {/* Active SLA Stage Warnings */}
                  {Array.isArray(evalResult.stageWarningsList) && evalResult.stageWarningsList.length > 0 && (
                    <div className="p-2 rounded-lg bg-rose-950/60 border border-rose-800/80 space-y-0.5 mt-1">
                      {evalResult.stageWarningsList.map((warn, wIdx) => (
                        <div key={wIdx} className="text-[11px] font-mono text-rose-300 flex items-center gap-1.5">
                          <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />
                          <span>{warn}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {row.siteDetails?.notes && (
                    <p className="text-xs text-slate-300 italic pt-1 border-t border-slate-800/80">
                      "{row.siteDetails.notes}"
                    </p>
                  )}
                </div>

                {/* Right Action Buttons */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onOpenSlaModal(row)}
                    className="px-3 py-1.5 bg-sky-950 hover:bg-sky-900 border border-sky-800 text-sky-200 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
                  >
                    <Clock className="w-3.5 h-3.5 text-sky-400" />
                    Open SLA Tracker
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenChecklistModal(row)}
                    className="px-3 py-1.5 bg-amber-950 hover:bg-amber-900 border border-amber-800 text-amber-200 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
                  >
                    <span>Checklist & Fees</span>
                    <span className="font-mono text-emerald-400 font-bold ml-1">
                      {formatCurrencyPHP(
                        (row.legalChecklist || []).reduce((sum, i) => sum + (i.amount || 0), 0) ||
                        parseNumericValue(row.values?.total_legal_budget)
                      )}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenSiteDataDrawer(row)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-md text-xs font-medium flex items-center gap-1 transition-colors"
                  >
                    Full Dossier &rarr;
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
