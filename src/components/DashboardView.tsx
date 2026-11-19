import React, { useState, useEffect } from 'react';
import { Tracker, DashboardCardConfig } from '../types/tracker';
import { calculateUnifiedMetric } from '../utils/metricCalculator';
import {
  LayoutDashboard,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Sliders,
  DollarSign,
  AlertTriangle,
  Clock,
  ShieldCheck,
  TrendingUp,
  X,
  Check,
  Filter,
  Layers,
  Globe,
  Folder,
  RefreshCw,
} from 'lucide-react';

interface DashboardViewProps {
  tracker: Tracker;
  allTrackers?: Tracker[];
  onUpdateCards: (newCards: DashboardCardConfig[]) => void;
  onOpenDeck: () => void;
  onNavigateToAllMetrics?: () => void;
  canEdit: boolean;
  onForceSyncPull?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  tracker,
  allTrackers = [tracker],
  onUpdateCards,
  onOpenDeck,
  onNavigateToAllMetrics,
  canEdit,
  onForceSyncPull,
}) => {
  const [cards, setCards] = useState<DashboardCardConfig[]>(() => tracker.dashboardCards || []);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('gt_dash_collapsed');
      if (saved !== null) return saved === 'true';
      return true; // Default to collapsed to lessen occupied space above Excel grid
    } catch {
      return true;
    }
  });

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('gt_dash_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  // Synchronize internal cards state immediately when tracker or tracker.dashboardCards changes
  useEffect(() => {
    setCards(tracker.dashboardCards || []);
  }, [tracker.id, tracker.dashboardCards]);
  const [showAddModal, setShowAddModal] = useState(false);

  // New card form state
  const [newTitle, setNewTitle] = useState('');
  const [newMetricType, setNewMetricType] = useState<DashboardCardConfig['metricType']>('column_sum');
  const [newColumnId, setNewColumnId] = useState<string>(tracker.columns[0]?.id || '');
  const [newColorTheme, setNewColorTheme] = useState<DashboardCardConfig['colorTheme']>('sky');
  const [newCustomNote, setNewCustomNote] = useState('');
  
  // Filter row per project & all projects options
  const [newFilterScope, setNewFilterScope] = useState<'current_project' | 'all_projects' | 'specific_project'>('current_project');
  const [newFilterTrackerId, setNewFilterTrackerId] = useState<string>(tracker.id);
  const [newFilterRowField, setNewFilterRowField] = useState<DashboardCardConfig['filterRowField']>('status');
  const [newFilterRowValue, setNewFilterRowValue] = useState('');
  const [newFilterCondition, setNewFilterCondition] = useState<'equals' | 'contains'>('contains');
  const [enableRowFilter, setEnableRowFilter] = useState(false);

  const handleToggleCollapse = (cardId: string) => {
    const updated = cards.map((c) => (c.id === cardId ? { ...c, collapsed: !c.collapsed } : c));
    setCards(updated);
    onUpdateCards(updated);
  };

  const handleDeleteCard = (cardId: string) => {
    const updated = cards.filter((c) => c.id !== cardId);
    setCards(updated);
    onUpdateCards(updated);
  };

  const handleAddCard = () => {
    if (!newTitle.trim()) {
      alert('Please enter a card title.');
      return;
    }

    const created: DashboardCardConfig = {
      id: 'card_' + Date.now().toString(),
      title: newTitle.trim(),
      metricType: newMetricType,
      columnId: newColumnId,
      colorTheme: newColorTheme,
      customNote: newCustomNote.trim() || undefined,
      collapsed: false,
      filterScope: newFilterScope,
      filterTrackerId: newFilterScope === 'specific_project' ? newFilterTrackerId : undefined,
      filterRowField: enableRowFilter && newFilterRowValue.trim() ? newFilterRowField : undefined,
      filterRowValue: enableRowFilter && newFilterRowValue.trim() ? newFilterRowValue.trim() : undefined,
      filterCondition: newFilterCondition,
    };

    const updated = [...cards, created];
    setCards(updated);
    onUpdateCards(updated);
    setShowAddModal(false);
    setNewTitle('');
    setNewCustomNote('');
    setNewFilterRowValue('');
    setEnableRowFilter(false);
  };

  if (isCollapsed) {
    return (
      <div className="flex items-center justify-between gap-3 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 mb-2">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={toggleCollapse}
            className="px-2 py-1 rounded bg-indigo-600/30 hover:bg-indigo-600 text-indigo-300 hover:text-white flex items-center gap-1.5 font-bold text-xs transition-colors cursor-pointer"
            title="Expand Executive Dashboard Cards"
          >
            <ChevronDown className="w-3.5 h-3.5" />
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Dashboard ({cards.length} Cards)</span>
          </button>
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
            <span className="text-slate-300 font-semibold">{tracker.name}</span>
            <span>·</span>
            <span className="font-mono text-emerald-400 font-bold">{tracker.rows.length} Total Sites</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onNavigateToAllMetrics && (
            <button
              type="button"
              onClick={onNavigateToAllMetrics}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              title="Open full page showing all summary metric cards"
            >
              <Globe className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden md:inline">All Metrics Hub</span>
            </button>
          )}
          <button
            type="button"
            onClick={onOpenDeck}
            className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
            title="Open Executive Presentation Deck"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Deck</span>
          </button>
          <button
            type="button"
            onClick={toggleCollapse}
            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium flex items-center gap-1 transition-colors"
            title="Expand full metric cards"
          >
            <ChevronDown className="w-3.5 h-3.5" />
            <span>Show Cards</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 mb-3">
      {/* Dashboard Toolbar Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-500/20 text-indigo-400 rounded-md">
            <LayoutDashboard className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-white tracking-wide">Live Executive Dashboard</span>
            <span className="text-slate-400 ml-2">· {tracker.name} ({cards.length} Metric Cards)</span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {onForceSyncPull && (
            <button
              type="button"
              onClick={onForceSyncPull}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-md font-semibold flex items-center gap-1.5 transition-colors shadow-xs text-xs"
              title="Sync all dashboard cards & metrics with Live Cloud Server"
            >
              <RefreshCw className="w-3.5 h-3.5 text-sky-400" />
              <span>Sync Cloud</span>
            </button>
          )}
          {onNavigateToAllMetrics && (
            <button
              type="button"
              onClick={onNavigateToAllMetrics}
              className="px-2.5 py-1 bg-emerald-950/60 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/60 rounded-md font-bold flex items-center gap-1.5 transition-colors shadow-xs"
              title="Open full page showing all summary metric cards for instant view of details"
            >
              <Globe className="w-3.5 h-3.5 text-emerald-400" />
              <span>All Metrics Hub</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenDeck}
            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md font-bold flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Deck</span>
          </button>

          {canEdit && (
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-md font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-sky-400" />
              <span>Add Card</span>
            </button>
          )}

          {/* Minimize Button to lessen space occupied */}
          <button
            type="button"
            onClick={toggleCollapse}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 rounded-md font-medium flex items-center gap-1 transition-colors"
            title="Collapse dashboard to lessen screen space occupied by metrics"
          >
            <ChevronUp className="w-3.5 h-3.5" />
            <span>Minimize</span>
          </button>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {cards.map((card) => {
          const { value, subtext } = calculateUnifiedMetric(card, tracker, allTrackers);
          const isDanger = card.metricType === 'no_movement_14d';
          const isAllProject = card.filterScope === 'all_projects';
          const hasRowFilter = Boolean(card.filterRowField && card.filterRowValue);

          return (
            <div
              key={card.id}
              className={`rounded-xl border transition-all ${
                isDanger
                  ? 'bg-rose-950/20 border-rose-900/60 ring-1 ring-rose-500/20'
                  : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
              } flex flex-col justify-between overflow-hidden shadow-xs`}
            >
              {/* Card Header with Scope & Filter Badges */}
              <div className="px-3 py-2 bg-slate-950/60 border-b border-slate-800/80 flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 truncate max-w-[130px]">
                    {card.title}
                  </span>
                  {isAllProject ? (
                    <span className="px-1 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[9px] font-black shrink-0" title="Calculated across All Projects">
                      ALL
                    </span>
                  ) : (
                    <span className="px-1 py-0.2 rounded bg-sky-500/20 text-sky-300 border border-sky-500/40 text-[9px] font-black shrink-0" title="Calculated per Project">
                      PRJ
                    </span>
                  )}
                  {hasRowFilter && (
                    <span className="px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-bold shrink-0" title={`Row filter: ${card.filterRowField}=${card.filterRowValue}`}>
                      <Filter className="w-2.5 h-2.5 inline" />
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggleCollapse(card.id)}
                    className="p-1 text-slate-500 hover:text-slate-300 rounded"
                    title={card.collapsed ? 'Expand card' : 'Collapse card'}
                  >
                    {card.collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                  </button>

                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => handleDeleteCard(card.id)}
                      className="p-1 text-slate-500 hover:text-rose-400 rounded"
                      title="Delete card"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Card Value / Body */}
              {!card.collapsed && (
                <div className="p-3.5 space-y-1">
                  <div
                    className={`text-xl font-extrabold font-mono tabular-nums tracking-tight ${
                      isDanger ? 'text-rose-400' : 'text-white'
                    }`}
                  >
                    {value}
                  </div>
                  <div className="text-[11px] text-slate-400 truncate leading-snug" title={card.customNote || subtext}>
                    {card.customNote || subtext}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Card Modal with Project Scope & Row Filter Configuration */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-lg rounded-xl bg-slate-900 border border-slate-700 p-5 space-y-4 text-slate-100 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-400" />
                Add Metric Card (Per Project or All Projects)
              </span>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Card Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Total Legal Budget, NCR Disbursed Fees, SLA Delays..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-white"
                />
              </div>

              {/* Project Scope Selection: All Projects vs Per Project */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Project Scope (Calculate Per Project or Across All Projects)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewFilterScope('current_project')}
                    className={`p-2 rounded border text-left transition-colors ${
                      newFilterScope === 'current_project'
                        ? 'bg-sky-950/80 border-sky-500 text-sky-200'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="font-bold flex items-center gap-1 text-[11px]">
                      <Folder className="w-3 h-3 text-sky-400" />
                      Current Project
                    </div>
                    <div className="text-[10px] text-slate-400 truncate mt-0.5">{tracker.name}</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewFilterScope('all_projects')}
                    className={`p-2 rounded border text-left transition-colors ${
                      newFilterScope === 'all_projects'
                        ? 'bg-purple-950/80 border-purple-500 text-purple-200'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="font-bold flex items-center gap-1 text-[11px]">
                      <Globe className="w-3 h-3 text-purple-400" />
                      All Projects
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Aggregates {allTrackers.length} sheets</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewFilterScope('specific_project')}
                    className={`p-2 rounded border text-left transition-colors ${
                      newFilterScope === 'specific_project'
                        ? 'bg-indigo-950/80 border-indigo-500 text-indigo-200'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="font-bold flex items-center gap-1 text-[11px]">
                      <Layers className="w-3 h-3 text-indigo-400" />
                      Specific Project
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Select sheet below</div>
                  </button>
                </div>

                {newFilterScope === 'specific_project' && (
                  <div className="mt-2">
                    <label className="block text-slate-400 text-[11px] mb-1">Target Project Sheet</label>
                    <select
                      value={newFilterTrackerId}
                      onChange={(e) => setNewFilterTrackerId(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-white"
                    >
                      {allTrackers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.rows?.length || 0} sites)
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Metric Calculation</label>
                <select
                  value={newMetricType}
                  onChange={(e) => setNewMetricType(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-white"
                >
                  <option value="total_sites">Total Active Sites Count</option>
                  <option value="total_budget_amount">Total Legal Budget (₱)</option>
                  <option value="fees_disbursed">Total Fees Disbursed (₱)</option>
                  <option value="delayed_sites">Milestone SLA Delays Count</option>
                  <option value="no_movement_14d">No Movement ≥ 14 Days (Alert Card)</option>
                  <option value="completed_milestones">Completed Sites Progress</option>
                  <option value="column_sum">Sum of Specific Column (₱ / Numeric)</option>
                  <option value="column_avg">Average of Specific Column (%)</option>
                  <option value="status_count">Count by Specific Status</option>
                </select>
              </div>

              {(newMetricType === 'column_sum' || newMetricType === 'column_avg') && (
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Connect to Column</label>
                  <select
                    value={newColumnId}
                    onChange={(e) => setNewColumnId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-white"
                  >
                    {tracker.columns.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label} ({c.type})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Row Filtering for Specific Row Criteria */}
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-slate-300 font-semibold flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enableRowFilter}
                      onChange={(e) => setEnableRowFilter(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-900 text-indigo-500 focus:ring-0"
                    />
                    <span>Filter Row Criteria (e.g., status, handler, region)</span>
                  </label>
                  <span className="text-[10px] text-slate-500">Optional</span>
                </div>

                {enableRowFilter && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <label className="block text-slate-400 text-[10px] mb-0.5">Filter Field</label>
                      <select
                        value={newFilterRowField}
                        onChange={(e) => setNewFilterRowField(e.target.value as any)}
                        className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-white text-xs"
                      >
                        <option value="status">Status (e.g. Completed, Pre-Con)</option>
                        <option value="picHandler">PIC Handler (Person in Charge)</option>
                        <option value="region">Region / Province</option>
                        <option value="slaHealth">SLA Health Status</option>
                        <option value="priority">Priority Rating</option>
                        <option value="towerType">Tower Type / Height</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-400 text-[10px] mb-0.5">Matching Value</label>
                      <input
                        type="text"
                        value={newFilterRowValue}
                        onChange={(e) => setNewFilterRowValue(e.target.value)}
                        placeholder="e.g. Under Review, NCR, Jheng..."
                        className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-white text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Custom Subtitle / Note</label>
                <input
                  type="text"
                  value={newCustomNote}
                  onChange={(e) => setNewCustomNote(e.target.value)}
                  placeholder="e.g. Verified by project controllers"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddCard}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-bold"
              >
                Create Metric Card
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
