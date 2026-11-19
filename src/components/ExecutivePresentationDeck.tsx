import React, { useState } from 'react';
import { Tracker, ExecutiveDeckSlide, ExecutiveDeck, DashboardCardConfig } from '../types/tracker';
import { formatCurrencyPHP, parseNumericValue } from '../utils/excelUtils';
import {
  Presentation,
  Maximize2,
  Minimize2,
  Printer,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Check,
  Plus,
  Trash2,
  TrendingUp,
  AlertOctagon,
  ShieldAlert,
  Building,
  CheckCircle,
  Clock,
  Layers,
  Sliders,
  Settings2,
  Copy,
  Table,
  X,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Sparkles,
  FolderKanban,
  Globe,
} from 'lucide-react';

interface ExecutivePresentationDeckProps {
  activeTracker: Tracker;
  allTrackers: Tracker[];
  decks: ExecutiveDeck[];
  onUpdateDecks: (newDecks: ExecutiveDeck[]) => void;
  onUpdateTracker: (updatedTracker: Tracker) => void;
  onClose: () => void;
}

export const ExecutivePresentationDeck: React.FC<ExecutivePresentationDeckProps> = ({
  activeTracker,
  allTrackers,
  decks,
  onUpdateDecks,
  onUpdateTracker,
  onClose,
}) => {
  const [activeDeckId, setActiveDeckId] = useState<string>(() => decks[0]?.id || 'deck_portfolio_master');
  const [currentSlideIdx, setCurrentSlideIdx] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isEditingNarrative, setIsEditingNarrative] = useState(false);
  const [isMetricSetupOpen, setIsMetricSetupOpen] = useState(false);
  const [showDeckCreateModal, setShowDeckCreateModal] = useState(false);

  // Deck creation state
  const [newDeckTitle, setNewDeckTitle] = useState('');
  const [newDeckDescription, setNewDeckDescription] = useState('');
  const [newDeckScope, setNewDeckScope] = useState<'per_tracker' | 'total_portfolio'>('total_portfolio');
  const [newDeckTargetTrackerId, setNewDeckTargetTrackerId] = useState(activeTracker.id);

  // New metric card modal state
  const [showAddMetricModal, setShowAddMetricModal] = useState(false);
  const [newCardTitle, setNewCardTitle] = useState('');
  const [newCardMetricType, setNewCardMetricType] = useState<DashboardCardConfig['metricType']>('column_sum');
  const [newCardColumnId, setNewCardColumnId] = useState('');
  const [newCardColorTheme, setNewCardColorTheme] = useState<DashboardCardConfig['colorTheme']>('sky');
  const [newCardNote, setNewCardNote] = useState('');

  // Active Deck
  const activeDeck = decks.find((d) => d.id === activeDeckId) || decks[0] || {
    id: 'deck_default',
    title: 'Master Presentation Deck',
    description: 'Executive reporting deck',
    scope: 'total_portfolio',
    slides: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const slides = activeDeck.slides || [];
  const activeSlide: ExecutiveDeckSlide = slides[currentSlideIdx] || slides[0] || {
    id: 'slide_default',
    title: 'Executive Presentation Deck',
    subtitle: 'Management Report',
    executiveSummary: 'Executive overview connected to live tracker telemetry.',
    focusMilestone: 'Pre-Con & Civil Release',
    keyHighlights: ['All milestones tracked in real time.'],
    blockersAndRisks: ['No critical risks flagged.'],
    recommendedActions: ['Continue scheduled rollout pace.'],
    trackerId: activeDeck.scope === 'total_portfolio' ? 'all' : (activeDeck.targetTrackerId || activeTracker.id),
  };

  const isTotalPortfolio = activeDeck.scope === 'total_portfolio' || activeSlide.trackerId === 'all';
  const connectedTracker = allTrackers.find((t) => t.id === activeSlide.trackerId) || activeTracker;

  // Aggregate rows: if total_portfolio, combine all trackers! If per_tracker, use connected tracker rows
  const activeRows = isTotalPortfolio
    ? allTrackers.flatMap((t) => t.rows)
    : connectedTracker.rows;

  // Metric Calculation helper
  const calculateCardValue = (card: DashboardCardConfig): { value: string | number; subtext: string } => {
    switch (card.metricType) {
      case 'total_sites':
        return {
          value: `${activeRows.length} Sites`,
          subtext: `${activeRows.filter((r) => r.values.status === 'Completed').length} Completed (${
            activeRows.length > 0 ? Math.round((activeRows.filter((r) => r.values.status === 'Completed').length / activeRows.length) * 100) : 0
          }%)`,
        };
      case 'total_budget_amount': {
        const sum = activeRows.reduce((acc, r) => acc + parseNumericValue(r.values?.total_legal_budget), 0);
        return {
          value: formatCurrencyPHP(sum),
          subtext: isTotalPortfolio ? 'Total Nationwide Portfolio Budget' : 'Project statutory budget pool',
        };
      }
      case 'fees_disbursed': {
        const sum = activeRows.reduce((acc, r) => acc + parseNumericValue(r.values?.disbursed_legal_fees), 0);
        return {
          value: formatCurrencyPHP(sum),
          subtext: `Disbursed under approved vouchers`,
        };
      }
      case 'no_movement_14d': {
        const count = activeRows.filter((r) => r.slaData?.isNoMovement14Days).length;
        return {
          value: `${count} Sites`,
          subtext: count > 0 ? 'CRITICAL: Inactivity ≥ 14 days alert' : 'All sites moving within SLA window',
        };
      }
      case 'delayed_sites': {
        const delayed = activeRows.filter((r) => r.slaData?.slaHealth === 'delayed' || r.slaData?.slaHealth === 'critical').length;
        return {
          value: `${delayed} Sites`,
          subtext: `${Math.round(((activeRows.length - delayed) / Math.max(1, activeRows.length)) * 100)}% on-track rate`,
        };
      }
      case 'completed_milestones': {
        const completed = activeRows.filter((r) => r.values.status === 'Completed').length;
        return {
          value: `${completed} / ${activeRows.length}`,
          subtext: `${Math.round((completed / Math.max(1, activeRows.length)) * 100)}% complete`,
        };
      }
      case 'column_sum': {
        if (!card.columnId) return { value: '0', subtext: 'No column connected' };
        const sum = activeRows.reduce((acc, r) => {
          const v = r.values[card.columnId!];
          const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^0-9.-]+/g, '')) || 0;
          return acc + n;
        }, 0);
        return {
          value: card.columnId.includes('budget') || card.columnId.includes('fee') ? formatCurrencyPHP(sum) : sum.toLocaleString('en-PH'),
          subtext: `Combined total for ${card.title}`,
        };
      }
      case 'column_avg': {
        if (!card.columnId || activeRows.length === 0) return { value: '0', subtext: 'No column connected' };
        const sum = activeRows.reduce((acc, r) => {
          const v = r.values[card.columnId!];
          const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^0-9.-]+/g, '')) || 0;
          return acc + n;
        }, 0);
        const avg = Math.round((sum / activeRows.length) * 10) / 10;
        return {
          value: `${avg}%`,
          subtext: `Average for ${card.title}`,
        };
      }
      case 'status_count': {
        const count = activeRows.filter((r) => r.values.status === (card.targetStatus || 'Under Review')).length;
        return {
          value: `${count} Sites`,
          subtext: `Status: "${card.targetStatus || 'Under Review'}"`,
        };
      }
      default:
        return { value: '—', subtext: 'Report metric' };
    }
  };

  // Determine available metric cards
  const allAvailableCards: DashboardCardConfig[] = isTotalPortfolio
    ? [
        { id: 'card_tot_sites', title: 'Total Portfolio Sites', metricType: 'total_sites', colorTheme: 'sky' },
        { id: 'card_tot_budget', title: 'Total Legal Budget (₱)', metricType: 'total_budget_amount', colorTheme: 'emerald' },
        { id: 'card_tot_disbursed', title: 'Fees Disbursed (₱)', metricType: 'fees_disbursed', colorTheme: 'indigo' },
        { id: 'card_tot_inactivity', title: 'No Movement ≥ 14 Days', metricType: 'no_movement_14d', colorTheme: 'crimson' },
        { id: 'card_tot_delayed', title: 'SLA Milestone Delays', metricType: 'delayed_sites', colorTheme: 'amber' },
      ]
    : connectedTracker.dashboardCards || [];

  const displayedCards = allAvailableCards.filter((card) => {
    if (!activeSlide.selectedCardIds || activeSlide.selectedCardIds.length === 0) {
      return true;
    }
    return activeSlide.selectedCardIds.includes(card.id);
  });

  const updateActiveDeckSlides = (newSlides: ExecutiveDeckSlide[]) => {
    const updatedDeck: ExecutiveDeck = {
      ...activeDeck,
      slides: newSlides,
      updatedAt: new Date().toISOString(),
    };
    onUpdateDecks(decks.map((d) => (d.id === activeDeck.id ? updatedDeck : d)));
  };

  const handleUpdateSlideField = (field: keyof ExecutiveDeckSlide, val: any) => {
    const updated = slides.map((s, idx) => {
      if (idx === currentSlideIdx) {
        return { ...s, [field]: val };
      }
      return s;
    });
    updateActiveDeckSlides(updated);
  };

  const handleChangeScopeOrTracker = (newTrackerId: string) => {
    const isMaster = newTrackerId === 'all';
    const updatedSlides = slides.map((s, idx) => {
      if (idx === currentSlideIdx) {
        return {
          ...s,
          trackerId: newTrackerId,
        };
      }
      return s;
    });
    const updatedDeck: ExecutiveDeck = {
      ...activeDeck,
      scope: isMaster ? 'total_portfolio' : 'per_tracker',
      targetTrackerId: isMaster ? undefined : newTrackerId,
      slides: updatedSlides,
    };
    onUpdateDecks(decks.map((d) => (d.id === activeDeck.id ? updatedDeck : d)));
  };

  const handleCreateNewDeck = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeckTitle.trim()) return;

    const newDeckId = 'deck_' + Date.now().toString();
    const created: ExecutiveDeck = {
      id: newDeckId,
      title: newDeckTitle.trim(),
      description: newDeckDescription.trim() || 'Custom executive reporting deck',
      scope: newDeckScope,
      targetTrackerId: newDeckScope === 'per_tracker' ? newDeckTargetTrackerId : undefined,
      slides: [
        {
          id: 'slide_' + Date.now(),
          title: newDeckTitle.trim(),
          subtitle: newDeckScope === 'total_portfolio' ? 'Company-wide Rollup Executive Deck' : `${allTrackers.find(t => t.id === newDeckTargetTrackerId)?.name} Operational Deck`,
          executiveSummary: 'Executive narrative detailing milestone velocity, capital allocation in Philippine Peso (₱), and recovery actions.',
          focusMilestone: 'Rollout Execution Targets',
          keyHighlights: ['Baseline targets confirmed with project handlers.', 'SLA compliance maintained.'],
          blockersAndRisks: ['Monitor regional clearance lead times.'],
          recommendedActions: ['Proceed with scheduled rollout phases.'],
          trackerId: newDeckScope === 'total_portfolio' ? 'all' : newDeckTargetTrackerId,
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onUpdateDecks([...decks, created]);
    setActiveDeckId(newDeckId);
    setCurrentSlideIdx(0);
    setShowDeckCreateModal(false);
    setNewDeckTitle('');
    setNewDeckDescription('');
  };

  const handleDuplicateCurrentDeck = () => {
    const dupId = 'deck_' + Date.now().toString();
    const duplicated: ExecutiveDeck = {
      ...JSON.parse(JSON.stringify(activeDeck)),
      id: dupId,
      title: `${activeDeck.title} (Copy)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    onUpdateDecks([...decks, duplicated]);
    setActiveDeckId(dupId);
    setCurrentSlideIdx(0);
  };

  const [showDeleteDeckConfirm, setShowDeleteDeckConfirm] = useState(false);

  const confirmDeleteDeck = () => {
    if (decks.length <= 1) return;
    const remaining = decks.filter((d) => d.id !== activeDeck.id);
    onUpdateDecks(remaining);
    setActiveDeckId(remaining[0].id);
    setCurrentSlideIdx(0);
    setShowDeleteDeckConfirm(false);
  };

  const handleAddNewSlide = () => {
    const newSlide: ExecutiveDeckSlide = {
      id: 'slide_' + Date.now().toString(),
      title: `${activeDeck.title} — Slide ${slides.length + 1}`,
      subtitle: isTotalPortfolio ? 'Total Nationwide Portfolio Audit' : `${connectedTracker.name} Strategic Briefing`,
      executiveSummary: 'Management summary focusing on current critical targets, budget disbursement, and operational velocity.',
      focusMilestone: 'Civil & Permitting Execution',
      keyHighlights: ['Operations tracking on milestone baseline.', 'Zero statutory compliance violations.'],
      blockersAndRisks: ['Verify local LGU clearance turnaround.'],
      recommendedActions: ['Conduct weekly steering committee review.'],
      trackerId: isTotalPortfolio ? 'all' : connectedTracker.id,
    };

    const updated = [...slides, newSlide];
    updateActiveDeckSlides(updated);
    setCurrentSlideIdx(updated.length - 1);
  };

  const handleToggleCardSelection = (cardId: string) => {
    const currentSelected = activeSlide.selectedCardIds
      ? [...activeSlide.selectedCardIds]
      : allAvailableCards.map((c) => c.id);

    let updatedSelection: string[];
    if (currentSelected.includes(cardId)) {
      if (currentSelected.length <= 1) {
        alert('Please keep at least one metric card visible.');
        return;
      }
      updatedSelection = currentSelected.filter((id) => id !== cardId);
    } else {
      updatedSelection = [...currentSelected, cardId];
    }

    handleUpdateSlideField('selectedCardIds', updatedSelection);
  };

  const handleUpdateCardOverride = (cardId: string, overrides: { title?: string; customNote?: string }) => {
    const existing = activeSlide.cardOverrides || {};
    const updated = {
      ...existing,
      [cardId]: {
        ...(existing[cardId] || {}),
        ...overrides,
      },
    };
    handleUpdateSlideField('cardOverrides', updated);
  };

  const handleCreateNewMetricCardForTracker = () => {
    if (!newCardTitle.trim()) return;

    const createdCard: DashboardCardConfig = {
      id: 'card_' + Date.now().toString(),
      title: newCardTitle.trim(),
      metricType: newCardMetricType,
      columnId: newCardColumnId || connectedTracker.columns[0]?.id,
      colorTheme: newCardColorTheme,
      customNote: newCardNote.trim() || undefined,
      collapsed: false,
    };

    const updatedCards = [...(connectedTracker.dashboardCards || []), createdCard];
    const updatedTracker: Tracker = {
      ...connectedTracker,
      dashboardCards: updatedCards,
      updatedAt: new Date().toISOString(),
    };

    onUpdateTracker(updatedTracker);

    const currentSelected = activeSlide.selectedCardIds
      ? [...activeSlide.selectedCardIds, createdCard.id]
      : updatedCards.map((c) => c.id);
    handleUpdateSlideField('selectedCardIds', currentSelected);

    setShowAddMetricModal(false);
    setNewCardTitle('');
    setNewCardNote('');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      className={`fixed inset-0 z-50 bg-slate-950 text-slate-100 flex flex-col ${
        isFullscreen ? 'p-0' : 'p-3 md:p-6'
      }`}
    >
      {/* Top Deck Action Bar */}
      <div className="no-print px-6 py-3 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg">
            <Presentation className="w-5 h-5" />
          </div>

          {/* Active Deck Selector Dropdown */}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-semibold">Active Deck:</span>
              <select
                value={activeDeckId}
                onChange={(e) => {
                  setActiveDeckId(e.target.value);
                  setCurrentSlideIdx(0);
                }}
                className="bg-slate-950 border border-slate-700 text-white font-bold text-xs rounded px-2.5 py-1 focus:outline-hidden"
              >
                {decks.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.scope === 'total_portfolio' ? '🌐 ' : '📊 '} {d.title} ({d.slides.length} slides)
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setShowDeckCreateModal(true)}
                className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-bold flex items-center gap-1 transition-colors"
                title="Create a new presentation deck"
              >
                <Plus className="w-3 h-3" />
                New Deck
              </button>

              <button
                type="button"
                onClick={handleDuplicateCurrentDeck}
                className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded"
                title="Duplicate active deck"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>

              {decks.length > 1 && (
                <button
                  type="button"
                  onClick={() => setShowDeleteDeckConfirm(true)}
                  className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors"
                  title="Delete active deck"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
              <span>
                Scope:{' '}
                <strong className={isTotalPortfolio ? 'text-emerald-400' : 'text-sky-400'}>
                  {isTotalPortfolio ? 'Total Project / All Trackers Consolidated' : `Per Tracker: ${connectedTracker.name}`}
                </strong>
              </span>
              <span>·</span>
              <span>Slide {currentSlideIdx + 1} of {slides.length}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Scope / Tracker Toggle for this slide */}
          <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-md border border-slate-700 text-xs">
            {isTotalPortfolio ? <Globe className="w-3.5 h-3.5 text-emerald-400" /> : <Table className="w-3.5 h-3.5 text-sky-400" />}
            <span className="text-slate-400">Target:</span>
            <select
              value={isTotalPortfolio ? 'all' : connectedTracker.id}
              onChange={(e) => handleChangeScopeOrTracker(e.target.value)}
              className="bg-transparent text-white font-semibold focus:outline-hidden cursor-pointer"
            >
              <option value="all" className="bg-slate-900 text-emerald-300">
                🌐 Total Project (All Trackers Combined)
              </option>
              {allTrackers.map((t) => (
                <option key={t.id} value={t.id} className="bg-slate-900 text-white">
                  📊 Per Tracker: {t.name} ({t.rows.length} rows)
                </option>
              ))}
            </select>
          </div>

          {/* Metric Cards Setup Button */}
          <button
            type="button"
            onClick={() => setIsMetricSetupOpen(true)}
            className="px-3 py-1.5 bg-sky-950 hover:bg-sky-900 text-sky-200 border border-sky-700 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
            title="Setup which metric cards to display"
          >
            <Settings2 className="w-3.5 h-3.5 text-sky-400" />
            Setup Metric Cards ({displayedCards.length})
          </button>

          {/* Narrative Edit Toggle */}
          <button
            type="button"
            onClick={() => setIsEditingNarrative(!isEditingNarrative)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md border flex items-center gap-1.5 transition-colors ${
              isEditingNarrative ? 'bg-amber-950 text-amber-300 border-amber-700' : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
            }`}
          >
            {isEditingNarrative ? <Check className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
            {isEditingNarrative ? 'Save Text' : 'Edit Text'}
          </button>

          {/* Slide Add */}
          <button
            type="button"
            onClick={handleAddNewSlide}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 rounded-md transition-colors"
            title="Add Slide to this Deck"
          >
            <Plus className="w-4 h-4 text-emerald-400" />
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 border border-slate-700 rounded-md flex items-center gap-1.5 transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Report
          </button>

          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 border border-slate-700 rounded-md flex items-center gap-1.5 transition-colors"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            {isFullscreen ? 'Exit Fullscreen' : 'Present'}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-md text-xs font-semibold transition-colors"
          >
            Close Deck
          </button>
        </div>
      </div>

      {/* Main Slide Content Canvas */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 flex flex-col justify-between max-w-7xl mx-auto w-full">
        {/* Slide Header */}
        <div className="border-b border-slate-800 pb-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-2">
              <Layers className="w-4 h-4" />
              {activeDeck.title.toUpperCase()} · SLIDE {currentSlideIdx + 1} OF {slides.length}
            </span>
            <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>
                {isTotalPortfolio ? `Aggregating ${allTrackers.length} Trackers (${activeRows.length} Total Sites)` : `${connectedTracker.name} (${activeRows.length} Sites)`}
              </span>
            </div>
          </div>

          {isEditingNarrative ? (
            <div className="space-y-2 pt-1">
              <input
                type="text"
                value={activeSlide.title}
                onChange={(e) => handleUpdateSlideField('title', e.target.value)}
                className="w-full text-2xl font-bold bg-slate-900 border border-indigo-500 rounded px-3 py-1.5 text-white"
              />
              <input
                type="text"
                value={activeSlide.subtitle}
                onChange={(e) => handleUpdateSlideField('subtitle', e.target.value)}
                className="w-full text-sm text-slate-400 bg-slate-900 border border-slate-700 rounded px-3 py-1 text-slate-300"
              />
            </div>
          ) : (
            <div>
              <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                {activeSlide.title}
              </h2>
              <p className="text-sm text-slate-400 mt-1">{activeSlide.subtitle}</p>
            </div>
          )}
        </div>

        {/* Dynamic Metric Cards Connected to the Tracker or Total Portfolio */}
        <div className="my-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span className="font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-sky-400" />
              {isTotalPortfolio ? 'Total Project / Nationwide Portfolio Metrics' : `${connectedTracker.name} Metrics`} ({displayedCards.length} Cards Active)
            </span>
            <button
              type="button"
              onClick={() => setIsMetricSetupOpen(true)}
              className="text-sky-400 hover:text-sky-300 text-xs font-medium flex items-center gap-1"
            >
              <Settings2 className="w-3 h-3" />
              Customize & Setup Cards
            </button>
          </div>

          <div
            className={`grid gap-3.5 ${
              displayedCards.length === 1
                ? 'grid-cols-1'
                : displayedCards.length === 2
                ? 'grid-cols-1 sm:grid-cols-2'
                : displayedCards.length === 3
                ? 'grid-cols-1 sm:grid-cols-3'
                : displayedCards.length === 4
                ? 'grid-cols-2 lg:grid-cols-4'
                : 'grid-cols-2 lg:grid-cols-5'
            }`}
          >
            {displayedCards.map((card) => {
              const { value, subtext } = calculateCardValue(card);
              const override = activeSlide.cardOverrides?.[card.id];
              const displayTitle = override?.title || card.title;
              const displayNote = override?.customNote || card.customNote || subtext;
              const isDanger = card.metricType === 'no_movement_14d';

              return (
                <div
                  key={card.id}
                  className={`p-4 rounded-xl border transition-all ${
                    isDanger
                      ? 'bg-rose-950/30 border-rose-900/80 ring-1 ring-rose-500/20'
                      : card.colorTheme === 'emerald'
                      ? 'bg-emerald-950/20 border-emerald-900/60'
                      : card.colorTheme === 'amber'
                      ? 'bg-amber-950/20 border-amber-900/60'
                      : card.colorTheme === 'indigo'
                      ? 'bg-indigo-950/20 border-indigo-900/60'
                      : 'bg-slate-900/90 border-slate-800'
                  } flex flex-col justify-between shadow-xs`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 truncate">
                      {displayTitle}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-950/70 text-slate-400 border border-slate-800">
                      LIVE
                    </span>
                  </div>

                  <div
                    className={`text-2xl font-extrabold font-mono tabular-nums tracking-tight my-1 ${
                      isDanger
                        ? 'text-rose-400'
                        : card.colorTheme === 'emerald'
                        ? 'text-emerald-300'
                        : card.colorTheme === 'amber'
                        ? 'text-amber-300'
                        : 'text-white'
                    }`}
                  >
                    {value}
                  </div>

                  <div className="text-[11px] text-slate-400 truncate leading-snug mt-1">
                    {displayNote}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Narrative & Strategic Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 my-2">
          {/* Executive Summary Narrative */}
          <div className="md:col-span-5 p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              Executive Narrative & Operations Pulse
            </div>

            {isEditingNarrative ? (
              <textarea
                rows={5}
                value={activeSlide.executiveSummary}
                onChange={(e) => handleUpdateSlideField('executiveSummary', e.target.value)}
                className="w-full text-xs text-slate-200 bg-slate-950 border border-indigo-500 rounded p-2.5"
              />
            ) : (
              <p className="text-xs md:text-sm text-slate-300 leading-relaxed font-normal">
                {activeSlide.executiveSummary}
              </p>
            )}

            <div className="pt-3 border-t border-slate-800">
              <div className="text-[11px] text-slate-400 font-semibold mb-2">
                CRITICAL TRACKER WATCHLIST ({isTotalPortfolio ? 'Across All Trackers' : connectedTracker.name}):
              </div>
              <div className="space-y-1.5">
                {activeRows
                  .filter((r) => r.slaData?.isNoMovement14Days || r.slaData?.slaHealth === 'critical')
                  .slice(0, 3)
                  .map((site) => (
                    <div
                      key={site.id}
                      className="p-2 rounded bg-rose-950/40 border border-rose-900/60 text-xs flex items-center justify-between"
                    >
                      <div>
                        <span className="font-mono font-bold text-rose-300">{site.siteId}</span>
                        <span className="text-slate-300 ml-2">{site.siteDetails?.siteName || site.values?.site_name || site.siteId}</span>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-900 text-white font-bold">
                        {site.slaData?.isNoMovement14Days ? 'NO MOVEMENT' : 'DELAYED'}
                      </span>
                    </div>
                  ))}
                {activeRows.filter((r) => r.slaData?.isNoMovement14Days || r.slaData?.slaHealth === 'critical').length === 0 && (
                  <div className="text-[11px] text-emerald-400 py-1 flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5" />
                    All tracked sites are on target with no active delay warnings.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Highlights & Risks */}
          <div className="md:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4" />
                  Key Achievements & SLA Wins
                </span>
                {isEditingNarrative && (
                  <button
                    type="button"
                    onClick={() => {
                      const updated = [...(activeSlide.keyHighlights || []), 'New highlight added.'];
                      handleUpdateSlideField('keyHighlights', updated);
                    }}
                    className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Add
                  </button>
                )}
              </div>

              <div className="space-y-2 text-xs">
                {activeSlide.keyHighlights.map((hl, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-slate-300">
                    <span className="text-emerald-400 font-bold shrink-0 mt-0.5">●</span>
                    {isEditingNarrative ? (
                      <div className="flex-1 flex items-center gap-1">
                        <input
                          type="text"
                          value={hl}
                          onChange={(e) => {
                            const updated = [...activeSlide.keyHighlights];
                            updated[idx] = e.target.value;
                            handleUpdateSlideField('keyHighlights', updated);
                          }}
                          className="w-full px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs text-white"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const updated = activeSlide.keyHighlights.filter((_, i) => i !== idx);
                            handleUpdateSlideField('keyHighlights', updated);
                          }}
                          className="text-rose-400 p-1"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <span className="leading-snug">{hl}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                  <AlertOctagon className="w-4 h-4" />
                  Blockers, Delays & Action Items
                </span>
                {isEditingNarrative && (
                  <button
                    type="button"
                    onClick={() => {
                      const updated = [...(activeSlide.blockersAndRisks || []), 'New risk item.'];
                      handleUpdateSlideField('blockersAndRisks', updated);
                    }}
                    className="text-[11px] text-rose-400 hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Add
                  </button>
                )}
              </div>

              <div className="space-y-2 text-xs">
                {activeSlide.blockersAndRisks.map((risk, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-slate-300">
                    <span className="text-rose-400 font-bold shrink-0 mt-0.5">▲</span>
                    {isEditingNarrative ? (
                      <div className="flex-1 flex items-center gap-1">
                        <input
                          type="text"
                          value={risk}
                          onChange={(e) => {
                            const updated = [...activeSlide.blockersAndRisks];
                            updated[idx] = e.target.value;
                            handleUpdateSlideField('blockersAndRisks', updated);
                          }}
                          className="w-full px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs text-white"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const updated = activeSlide.blockersAndRisks.filter((_, i) => i !== idx);
                            handleUpdateSlideField('blockersAndRisks', updated);
                          }}
                          className="text-rose-400 p-1"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <span className="leading-snug">{risk}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Deck Navigation & Slide Indicators */}
        <div className="no-print pt-5 border-t border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {slides.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentSlideIdx(idx)}
                className={`w-3.5 h-3.5 rounded-full transition-all ${
                  idx === currentSlideIdx
                    ? 'bg-indigo-500 scale-125 ring-2 ring-indigo-400/40'
                    : 'bg-slate-700 hover:bg-slate-500'
                }`}
                title={`Jump to Slide ${idx + 1}`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentSlideIdx === 0}
              onClick={() => setCurrentSlideIdx((prev) => Math.max(0, prev - 1))}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded text-xs font-semibold flex items-center gap-1 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous Slide
            </button>
            <button
              type="button"
              disabled={currentSlideIdx === slides.length - 1}
              onClick={() => setCurrentSlideIdx((prev) => Math.min(slides.length - 1, prev + 1))}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 rounded text-xs font-bold flex items-center gap-1 transition-colors shadow-xs"
            >
              Next Slide
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* METRIC CARDS SETUP & CUSTOMIZATION MODAL */}
      {isMetricSetupOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-xl bg-slate-900 border border-slate-700 text-slate-100 shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Settings2 className="w-5 h-5 text-sky-400" />
                <div>
                  <h3 className="text-sm font-bold text-white tracking-wide">
                    Customize Metric Cards for this Report Slide
                  </h3>
                  <p className="text-xs text-slate-400">
                    Scope: <strong className="text-sky-300">{isTotalPortfolio ? 'Total Project Portfolio' : connectedTracker.name}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsMetricSetupOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs">
                <span className="text-slate-300 font-semibold">
                  Select which metric cards to feature in this executive slide:
                </span>
                {!isTotalPortfolio && (
                  <button
                    type="button"
                    onClick={() => setShowAddMetricModal(true)}
                    className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-bold flex items-center gap-1 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    + Create New Metric Card
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {allAvailableCards.map((card) => {
                  const isSelected = displayedCards.some((c) => c.id === card.id);
                  const override = activeSlide.cardOverrides?.[card.id];
                  const { value } = calculateCardValue(card);

                  return (
                    <div
                      key={card.id}
                      className={`p-3.5 rounded-xl border transition-all ${
                        isSelected
                          ? 'bg-slate-950/80 border-sky-500/60 ring-1 ring-sky-500/30'
                          : 'bg-slate-950/40 border-slate-800 opacity-60'
                      } space-y-2`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleToggleCardSelection(card.id)}
                            className={`p-1.5 rounded transition-colors ${
                              isSelected ? 'text-sky-400 bg-sky-950' : 'text-slate-500 hover:text-slate-300'
                            }`}
                            title={isSelected ? 'Hide from this slide' : 'Show on this slide'}
                          >
                            {isSelected ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                          </button>
                          <div>
                            <div className="font-bold text-xs text-white">{card.title}</div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              Type: {card.metricType} · Live Value: <strong className="text-emerald-300">{value}</strong>
                            </div>
                          </div>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            isSelected ? 'bg-sky-900 text-sky-200' : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {isSelected ? 'Visible' : 'Hidden'}
                        </span>
                      </div>

                      {isSelected && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 text-xs">
                          <div>
                            <label className="block text-[11px] text-slate-400 mb-0.5">
                              Report Title Override
                            </label>
                            <input
                              type="text"
                              value={override?.title || ''}
                              placeholder={card.title}
                              onChange={(e) => handleUpdateCardOverride(card.id, { title: e.target.value })}
                              className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-white text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] text-slate-400 mb-0.5">
                              Report Target Subtext Note
                            </label>
                            <input
                              type="text"
                              value={override?.customNote || ''}
                              placeholder={card.customNote || 'Standard telemetry'}
                              onChange={(e) => handleUpdateCardOverride(card.id, { customNote: e.target.value })}
                              className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-white text-xs"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="px-6 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setIsMetricSetupOpen(false)}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-bold text-xs"
              >
                Apply to Slide
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE NEW DECK MODAL */}
      {showDeckCreateModal && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-md rounded-xl bg-slate-900 border border-slate-700 p-5 space-y-4 text-slate-100 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                <Presentation className="w-4 h-4 text-indigo-400" />
                Create New Executive Presentation Deck
              </span>
              <button onClick={() => setShowDeckCreateModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateNewDeck} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Deck Title</label>
                <input
                  type="text"
                  required
                  value={newDeckTitle}
                  onChange={(e) => setNewDeckTitle(e.target.value)}
                  placeholder="e.g. Q2 Executive Review / Total Rollout Deck"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Presentation Scope</label>
                <select
                  value={newDeckScope}
                  onChange={(e) => setNewDeckScope(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-white"
                >
                  <option value="total_portfolio">🌐 Total Project (All Trackers Combined Rollup)</option>
                  <option value="per_tracker">📊 Per Tracker (Dedicated to One Project)</option>
                </select>
              </div>

              {newDeckScope === 'per_tracker' && (
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Target Project Tracker</label>
                  <select
                    value={newDeckTargetTrackerId}
                    onChange={(e) => setNewDeckTargetTrackerId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-white"
                  >
                    {allTrackers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.rows.length} rows)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Description / Subtitle</label>
                <input
                  type="text"
                  value={newDeckDescription}
                  onChange={(e) => setNewDeckDescription(e.target.value)}
                  placeholder="e.g. Steering Committee Quarterly Review"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowDeckCreateModal(false)}
                  className="px-3 py-1.5 text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-bold"
                >
                  Create Deck
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE NEW METRIC CARD MODAL */}
      {showAddMetricModal && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-md rounded-xl bg-slate-900 border border-slate-700 p-5 space-y-4 text-slate-100 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-sky-400" />
                Add Metric Card to {connectedTracker.name}
              </span>
              <button onClick={() => setShowAddMetricModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Metric Title</label>
                <input
                  type="text"
                  value={newCardTitle}
                  onChange={(e) => setNewCardTitle(e.target.value)}
                  placeholder="e.g. Legal Clearances, Civil Budget..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Calculation Method</label>
                <select
                  value={newCardMetricType}
                  onChange={(e) => setNewCardMetricType(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-white"
                >
                  <option value="total_sites">Total Sites Count</option>
                  <option value="total_budget_amount">Total Legal Budget (₱)</option>
                  <option value="fees_disbursed">Total Fees Disbursed (₱)</option>
                  <option value="delayed_sites">Milestone SLA Delays Count</option>
                  <option value="no_movement_14d">No Movement ≥ 14 Days (Alert Card)</option>
                  <option value="completed_milestones">Completed Sites Progress</option>
                  <option value="column_sum">Sum of Specific Column (₱ / Numeric)</option>
                  <option value="column_avg">Average of Specific Column (%)</option>
                </select>
              </div>

              {(newCardMetricType === 'column_sum' || newCardMetricType === 'column_avg') && (
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Target Column</label>
                  <select
                    value={newCardColumnId}
                    onChange={(e) => setNewCardColumnId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-white"
                  >
                    {connectedTracker.columns.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label} ({c.type})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Theme Color</label>
                <select
                  value={newCardColorTheme}
                  onChange={(e) => setNewCardColorTheme(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-white"
                >
                  <option value="sky">Sky Blue</option>
                  <option value="emerald">Emerald Green</option>
                  <option value="amber">Amber Gold</option>
                  <option value="crimson">Crimson Alert</option>
                  <option value="indigo">Indigo</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Report Note / Target Subtext</label>
                <input
                  type="text"
                  value={newCardNote}
                  onChange={(e) => setNewCardNote(e.target.value)}
                  placeholder="e.g. Verified by project controllers"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowAddMetricModal(false)}
                className="px-3 py-1.5 text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateNewMetricCardForTracker}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-bold"
              >
                Create & Add to Slide
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirm Delete Deck */}
      {showDeleteDeckConfirm && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setShowDeleteDeckConfirm(false)}
        >
          <div
            className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-5 text-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-full bg-rose-500/20 border border-rose-500/30 flex items-center justify-center shrink-0">
                <Trash2 className="w-4 h-4 text-rose-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Delete Presentation Deck</h3>
                <p className="text-xs text-slate-400">Are you sure you want to delete this deck?</p>
              </div>
            </div>
            <p className="text-xs text-slate-300 mb-4 bg-slate-950 p-2.5 rounded border border-slate-800 font-mono">
              "{activeDeck.title}"
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteDeckConfirm(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white rounded bg-slate-800 hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteDeck}
                className="px-3.5 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
