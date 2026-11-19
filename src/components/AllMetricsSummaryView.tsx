import React, { useState, useMemo } from 'react';
import { Tracker, DashboardCardConfig, TrackerRow } from '../types/tracker';
import { calculateUnifiedMetric, getFilteredRowsForMetric } from '../utils/metricCalculator';
import { formatCurrencyPHP, parseNumericValue } from '../utils/excelUtils';
import {
  BarChart3,
  Layers,
  Globe,
  Folder,
  Filter,
  Search,
  Plus,
  Trash2,
  Sliders,
  DollarSign,
  AlertTriangle,
  Clock,
  CheckCircle,
  TrendingUp,
  X,
  FileSpreadsheet,
  ArrowRight,
  ExternalLink,
  Table,
} from 'lucide-react';

interface AllMetricsSummaryViewProps {
  trackers: Tracker[];
  activeTrackerId: string;
  onSelectTracker: (trackerId: string) => void;
  onOpenTrackerView: (trackerId?: string) => void;
  onOpenSlaModal: (row: TrackerRow) => void;
  onOpenChecklistModal: (row: TrackerRow) => void;
  onOpenSiteDataDrawer: (row: TrackerRow) => void;
  canEdit: boolean;
  onUpdateTrackerCards: (trackerId: string, cards: DashboardCardConfig[]) => void;
}

export const AllMetricsSummaryView: React.FC<AllMetricsSummaryViewProps> = ({
  trackers,
  activeTrackerId,
  onSelectTracker,
  onOpenTrackerView,
  onOpenSlaModal,
  onOpenChecklistModal,
  onOpenSiteDataDrawer,
  canEdit,
  onUpdateTrackerCards,
}) => {
  // Navigation filter state
  const [selectedFilterProject, setSelectedFilterProject] = useState<string>('all'); // 'all' or trackerId
  const [searchQuery, setSearchQuery] = useState('');
  const [metricCategory, setMetricCategory] = useState<'ALL' | 'FINANCIAL' | 'SLA_HEALTH' | 'PROGRESS' | 'CUSTOM'>('ALL');
  const [selectedDetailedCard, setSelectedDetailedCard] = useState<{
    card: DashboardCardConfig;
    tracker: Tracker;
  } | null>(null);

  // Global cross-project aggregations
  const globalSummary = useMemo(() => {
    let totalSites = 0;
    let completedSites = 0;
    let totalLegalBudget = 0;
    let totalDisbursedFees = 0;
    let totalNoMovement14d = 0;
    let totalDelayedSites = 0;
    let totalApproachingSites = 0;

    for (const t of trackers) {
      if (!Array.isArray(t.rows)) continue;
      for (const r of t.rows) {
        totalSites += 1;
        if (r.values?.status === 'Completed') completedSites += 1;
        totalLegalBudget += parseNumericValue(r.values?.total_legal_budget);
        totalDisbursedFees += parseNumericValue(r.values?.disbursed_legal_fees);
        if (r.slaData?.isNoMovement14Days) totalNoMovement14d += 1;
        if (r.slaData?.slaHealth === 'delayed' || r.slaData?.slaHealth === 'critical') totalDelayedSites += 1;
        if (r.slaData?.slaHealth === 'approaching') totalApproachingSites += 1;
      }
    }

    const disbursementPct = totalLegalBudget > 0 ? Math.round((totalDisbursedFees / totalLegalBudget) * 100) : 0;
    const completionPct = totalSites > 0 ? Math.round((completedSites / totalSites) * 100) : 0;

    return {
      totalSites,
      completedSites,
      completionPct,
      totalLegalBudget,
      totalDisbursedFees,
      disbursementPct,
      totalNoMovement14d,
      totalDelayedSites,
      totalApproachingSites,
      projectCount: trackers.length,
    };
  }, [trackers]);

  // Extract all metric cards across all trackers
  const allCardsWithProject = useMemo(() => {
    const list: {
      card: DashboardCardConfig;
      tracker: Tracker;
      result: ReturnType<typeof calculateUnifiedMetric>;
    }[] = [];

    for (const t of trackers) {
      const cards = t.dashboardCards || [];
      for (const c of cards) {
        const result = calculateUnifiedMetric(c, t, trackers);
        list.push({
          card: c,
          tracker: t,
          result,
        });
      }
    }

    return list;
  }, [trackers]);

  // Filter cards by project dropdown, category, and search text
  const filteredCards = useMemo(() => {
    return allCardsWithProject.filter((item) => {
      // 1. Project Filter
      if (selectedFilterProject !== 'all' && item.tracker.id !== selectedFilterProject) {
        return false;
      }

      // 2. Category Filter
      if (metricCategory === 'FINANCIAL') {
        if (item.card.metricType !== 'total_budget_amount' && item.card.metricType !== 'fees_disbursed') {
          return false;
        }
      } else if (metricCategory === 'SLA_HEALTH') {
        if (item.card.metricType !== 'no_movement_14d' && item.card.metricType !== 'delayed_sites') {
          return false;
        }
      } else if (metricCategory === 'PROGRESS') {
        if (item.card.metricType !== 'total_sites' && item.card.metricType !== 'completed_milestones' && item.card.metricType !== 'status_count') {
          return false;
        }
      } else if (metricCategory === 'CUSTOM') {
        if (item.card.metricType !== 'column_sum' && item.card.metricType !== 'column_avg') {
          return false;
        }
      }

      // 3. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inTitle = item.card.title.toLowerCase().includes(q);
        const inVal = String(item.result.value).toLowerCase().includes(q);
        const inSub = item.result.subtext.toLowerCase().includes(q);
        const inPrj = item.tracker.name.toLowerCase().includes(q);
        if (!inTitle && !inVal && !inSub && !inPrj) return false;
      }

      return true;
    });
  }, [allCardsWithProject, selectedFilterProject, metricCategory, searchQuery]);

  // Compute drilldown rows for selected card modal
  const detailedDrilldown = useMemo(() => {
    if (!selectedDetailedCard) return null;
    const { card, tracker } = selectedDetailedCard;
    const { rows, scopeLabel, totalPoolCount } = getFilteredRowsForMetric(card, tracker, trackers);
    return {
      card,
      tracker,
      rows,
      scopeLabel,
      totalPoolCount,
    };
  }, [selectedDetailedCard, trackers]);

  return (
    <div className="flex-1 flex flex-col overflow-y-auto space-y-6 text-slate-100 pr-1">
      {/* Top Header Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg border border-emerald-500/40">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
                <span>All Projects Metric Summary Hub</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-extrabold uppercase">
                  Instant View of Details
                </span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Unified live metrics center · Filter row metrics per project or consolidate across all project sheets instantaneously.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onOpenTrackerView(activeTrackerId)}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-xs transition-colors"
          >
            <Table className="w-4 h-4" />
            <span>Return to Excel Tracker</span>
          </button>
        </div>
      </div>

      {/* Cross-Project Master KPI Summary Cards */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-purple-400" />
            <span>Master Enterprise Overview (All {globalSummary.projectCount} Projects Aggregated)</span>
          </h2>
          <span className="text-[11px] text-slate-500 font-mono">
            {globalSummary.totalSites} Total Rollout Sites Monitored
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Card 1: Total Sites & Progress */}
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-colors shadow-xs">
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Sites</div>
            <div className="text-xl font-black font-mono text-white mt-1">{globalSummary.totalSites}</div>
            <div className="text-[11px] text-emerald-400 mt-1 font-semibold">
              {globalSummary.completedSites} completed ({globalSummary.completionPct}%)
            </div>
          </div>

          {/* Card 2: Legal Budget Allocation */}
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-colors shadow-xs">
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Budget</div>
            <div className="text-xl font-black font-mono text-sky-300 mt-1">
              {formatCurrencyPHP(globalSummary.totalLegalBudget)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Across all project sheets</div>
          </div>

          {/* Card 3: Legal Fees Disbursed */}
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-colors shadow-xs">
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Fees Disbursed</div>
            <div className="text-xl font-black font-mono text-emerald-400 mt-1">
              {formatCurrencyPHP(globalSummary.totalDisbursedFees)}
            </div>
            <div className="text-[11px] text-emerald-300/80 mt-1">
              {globalSummary.disbursementPct}% statutory payout
            </div>
          </div>

          {/* Card 4: Stalled 14 Days Alert */}
          <div
            className={`p-3.5 rounded-xl border transition-colors shadow-xs ${
              globalSummary.totalNoMovement14d > 0
                ? 'bg-rose-950/30 border-rose-800/80 ring-1 ring-rose-500/20'
                : 'bg-slate-900/90 border-slate-800'
            }`}
          >
            <div className="text-[10px] uppercase font-bold text-rose-300 tracking-wider flex items-center justify-between">
              <span>No Move ≥ 14d</span>
              {globalSummary.totalNoMovement14d > 0 && <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />}
            </div>
            <div className="text-xl font-black font-mono text-rose-400 mt-1">
              {globalSummary.totalNoMovement14d} Sites
            </div>
            <div className="text-[11px] text-rose-300/80 mt-1 font-semibold">Immediate SAQ escalation</div>
          </div>

          {/* Card 5: Milestone SLA Delays */}
          <div
            className={`p-3.5 rounded-xl border transition-colors shadow-xs ${
              globalSummary.totalDelayedSites > 0
                ? 'bg-amber-950/30 border-amber-800/80'
                : 'bg-slate-900/90 border-slate-800'
            }`}
          >
            <div className="text-[10px] uppercase font-bold text-amber-300 tracking-wider">SLA Delays</div>
            <div className="text-xl font-black font-mono text-amber-400 mt-1">
              {globalSummary.totalDelayedSites} Sites
            </div>
            <div className="text-[11px] text-amber-300/80 mt-1 font-semibold">Exceeding milestone days</div>
          </div>

          {/* Card 6: Approaching Deadline */}
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-colors shadow-xs">
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Approaching</div>
            <div className="text-xl font-black font-mono text-indigo-300 mt-1">
              {globalSummary.totalApproachingSites} Sites
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Due within 7 days</div>
          </div>
        </div>
      </div>

      {/* Filter Ribbon: Filter Row per Project and All Projects + Categories */}
      <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Project Scope Filter Dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5">
            <Filter className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span className="text-slate-400 font-semibold">Project Scope:</span>
            <select
              value={selectedFilterProject}
              onChange={(e) => setSelectedFilterProject(e.target.value)}
              className="bg-transparent text-white font-bold focus:outline-hidden cursor-pointer"
            >
              <option value="all" className="bg-slate-900 text-white">
                All Projects Consolidate ({trackers.length} Sheets)
              </option>
              {trackers.map((t) => (
                <option key={t.id} value={t.id} className="bg-slate-900 text-white">
                  Per Project: {t.name} ({t.rows?.length || 0} sites)
                </option>
              ))}
            </select>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
            {(['ALL', 'FINANCIAL', 'SLA_HEALTH', 'PROGRESS', 'CUSTOM'] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setMetricCategory(cat)}
                className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors ${
                  metricCategory === cat
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {cat === 'ALL'
                  ? 'All Cards'
                  : cat === 'FINANCIAL'
                  ? 'Financial (₱)'
                  : cat === 'SLA_HEALTH'
                  ? 'SLA Health'
                  : cat === 'PROGRESS'
                  ? 'Milestones'
                  : 'Column Summary'}
              </button>
            ))}
          </div>
        </div>

        {/* Search Metric Filter */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search metric card title or value..."
            className="pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-hidden focus:border-sky-500 w-56 text-xs"
          />
        </div>
      </div>

      {/* Grid of All Summary Metric Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <span>Summary Metric Cards ({filteredCards.length} Cards Reflected)</span>
            <span className="text-[10px] text-slate-500 lowercase">
              · click any card to inspect row details & underlying sites
            </span>
          </div>

          <div className="text-xs text-sky-400 font-mono">
            {selectedFilterProject === 'all'
              ? 'Showing cards across all project sheets'
              : `Filtered for "${trackers.find((t) => t.id === selectedFilterProject)?.name}"`}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredCards.map(({ card, tracker, result }, idx) => {
            const isDanger = card.metricType === 'no_movement_14d';
            const isAllProject = card.filterScope === 'all_projects';
            const hasRowFilter = Boolean(card.filterRowField && card.filterRowValue);

            return (
              <div
                key={`${tracker.id}_${card.id}_${idx}`}
                onClick={() => setSelectedDetailedCard({ card, tracker })}
                className={`group rounded-xl border p-4 transition-all cursor-pointer relative overflow-hidden shadow-xs hover:shadow-lg ${
                  isDanger
                    ? 'bg-rose-950/20 border-rose-900/70 hover:border-rose-600 hover:bg-rose-950/30'
                    : 'bg-slate-900/90 border-slate-800 hover:border-indigo-500/80 hover:bg-slate-850'
                }`}
              >
                {/* Project Tag */}
                <div className="flex items-center justify-between gap-1.5 mb-2">
                  <span className="px-2 py-0.5 rounded bg-slate-950 text-slate-300 border border-slate-800 text-[10px] font-bold truncate max-w-[170px] flex items-center gap-1">
                    <Folder className="w-3 h-3 text-amber-400 shrink-0" />
                    <span className="truncate">{tracker.name}</span>
                  </span>

                  <div className="flex items-center gap-1">
                    {isAllProject ? (
                      <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[9px] font-black">
                        ALL PRJ
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/40 text-[9px] font-black">
                        PER PRJ
                      </span>
                    )}

                    {hasRowFilter && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-bold">
                        FILTER
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Title */}
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 group-hover:text-white transition-colors truncate">
                  {card.title}
                </h3>

                {/* Metric Main Value */}
                <div
                  className={`text-2xl font-black font-mono tabular-nums tracking-tight my-2 ${
                    isDanger ? 'text-rose-400' : 'text-white'
                  }`}
                >
                  {result.value}
                </div>

                {/* Detailed Calculation Subtext */}
                <p className="text-[11px] text-slate-400 line-clamp-2 leading-tight">
                  {card.customNote || result.subtext}
                </p>

                {/* Bottom inspect action banner */}
                <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400 group-hover:text-sky-300 transition-colors">
                  <span className="font-mono">{result.count} Matching Sites</span>
                  <span className="flex items-center gap-1 font-semibold">
                    Inspect Details &rarr;
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Drilldown Modal: Instant View of Details for Selected Metric Card */}
      {detailedDrilldown && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-4xl rounded-2xl bg-slate-900 border border-slate-700 p-6 space-y-4 text-slate-100 shadow-2xl max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/40 text-[10px] font-black uppercase">
                    Metric Card Instant View
                  </span>
                  <span className="text-xs text-slate-400">· Source: {detailedDrilldown.tracker.name}</span>
                </div>
                <h2 className="text-base font-extrabold text-white mt-1">
                  {detailedDrilldown.card.title}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Calculation Scope: <strong className="text-sky-300">{detailedDrilldown.scopeLabel}</strong> · Showing{' '}
                  <strong className="text-white">{detailedDrilldown.rows.length}</strong> matching sites from pool of{' '}
                  {detailedDrilldown.totalPoolCount}.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedDetailedCard(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Metric Summary Strip */}
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div>
                <span className="text-slate-400">Metric Value:</span>
                <span className="font-mono font-bold text-white text-sm ml-2">
                  {calculateUnifiedMetric(detailedDrilldown.card, detailedDrilldown.tracker, trackers).value}
                </span>
              </div>

              {detailedDrilldown.card.filterRowField && (
                <div className="text-[11px] bg-amber-950/60 border border-amber-800 text-amber-300 px-2.5 py-1 rounded-md font-semibold">
                  Row Filter: {detailedDrilldown.card.filterRowField} = "{detailedDrilldown.card.filterRowValue}"
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  onSelectTracker(detailedDrilldown.tracker.id);
                  onOpenTrackerView(detailedDrilldown.tracker.id);
                  setSelectedDetailedCard(null);
                }}
                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <Table className="w-3.5 h-3.5" />
                <span>Open in Full Excel Sheet</span>
              </button>
            </div>

            {/* Table of Rows Represented in this Metric Card */}
            <div className="flex-1 overflow-auto border border-slate-800 rounded-xl">
              <table className="w-full border-collapse text-xs text-left">
                <thead className="sticky top-0 bg-slate-950 z-10 border-b border-slate-800 text-slate-300 text-[11px] font-bold">
                  <tr>
                    <th className="px-3 py-2.5 border-r border-slate-800">#</th>
                    <th className="px-3 py-2.5 border-r border-slate-800">Site ID</th>
                    <th className="px-3 py-2.5 border-r border-slate-800">Site Name / Location</th>
                    <th className="px-3 py-2.5 border-r border-slate-800">Status</th>
                    <th className="px-3 py-2.5 border-r border-slate-800">Legal Budget (₱)</th>
                    <th className="px-3 py-2.5 border-r border-slate-800">Fees Disbursed (₱)</th>
                    <th className="px-3 py-2.5 border-r border-slate-800">PIC Handler</th>
                    <th className="px-3 py-2.5 border-r border-slate-800">SLA Health</th>
                    <th className="px-3 py-2.5 text-center">Quick Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 bg-slate-900/60 font-mono">
                  {detailedDrilldown.rows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-500">
                        No rows matching the configured filter criteria for this metric card.
                      </td>
                    </tr>
                  ) : (
                    detailedDrilldown.rows.map((row, idx) => {
                      const isRowAlert = row.slaData?.isNoMovement14Days || row.slaData?.slaHealth === 'critical';
                      return (
                        <tr
                          key={row.id}
                          className={`hover:bg-slate-800/60 transition-colors ${
                            isRowAlert ? 'bg-rose-950/20' : ''
                          }`}
                        >
                          <td className="px-3 py-2 text-slate-500 border-r border-slate-800 text-center font-sans">
                            {idx + 1}
                          </td>
                          <td className="px-3 py-2 font-bold text-sky-400 border-r border-slate-800">
                            {row.siteId}
                          </td>
                          <td className="px-3 py-2 text-white border-r border-slate-800 font-sans truncate max-w-[200px]">
                            {row.siteDetails?.siteName || row.values?.site_name || row.siteId}
                          </td>
                          <td className="px-3 py-2 border-r border-slate-800 font-sans">
                            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-200 border border-slate-700 text-[10px] font-bold">
                              {row.values?.status || row.slaData?.currentStatus || 'Under Review'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-slate-200 border-r border-slate-800 text-right">
                            {formatCurrencyPHP(row.values?.total_legal_budget || 0)}
                          </td>
                          <td className="px-3 py-2 text-emerald-400 border-r border-slate-800 text-right">
                            {formatCurrencyPHP(row.values?.disbursed_legal_fees || 0)}
                          </td>
                          <td className="px-3 py-2 text-slate-300 border-r border-slate-800 font-sans">
                            {row.siteDetails?.picHandler || row.values?.pic_handler || 'N/A'}
                          </td>
                          <td className="px-3 py-2 border-r border-slate-800 font-sans">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                row.slaData?.slaHealth === 'critical'
                                  ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                  : row.slaData?.slaHealth === 'delayed'
                                  ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                  : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              }`}
                            >
                              {row.slaData?.slaHealth || 'on_track'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center font-sans">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  onOpenSlaModal(row);
                                  setSelectedDetailedCard(null);
                                }}
                                className="px-2 py-0.5 rounded bg-sky-950 text-sky-300 hover:bg-sky-900 border border-sky-800 text-[10px] font-bold"
                              >
                                SLA
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  onOpenSiteDataDrawer(row);
                                  setSelectedDetailedCard(null);
                                }}
                                className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700 text-[10px] font-bold"
                              >
                                Data
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

            {/* Modal Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-xs">
              <span className="text-slate-400">
                Clicking SLA or Data opens the dossier modal directly for that site.
              </span>
              <button
                type="button"
                onClick={() => setSelectedDetailedCard(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
