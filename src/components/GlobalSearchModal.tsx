import React, { useState, useMemo, useDeferredValue, useEffect, useRef } from 'react';
import { Tracker, TrackerRow } from '../types/tracker';
import {
  formatCurrencyPHP,
  parseNumericValue,
  normalizeToStandardDate,
  formatDateDisplay,
  getLocalDateString,
} from '../utils/excelUtils';
import * as XLSX from 'xlsx';
import {
  Search,
  ArrowRight,
  X,
  Building2,
  MapPin,
  User,
  Zap,
  FileText,
  Copy,
  Check,
  FolderOpen,
  Filter,
  CheckSquare,
  Square,
  FileSpreadsheet,
  Layers,
  Table as TableIcon,
  LayoutGrid,
  Clock,
  ShieldAlert,
  ArrowUpDown,
  Download,
  Calendar,
  ExternalLink,
} from 'lucide-react';

export interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  trackers: Tracker[];
  currentTrackerId: string;
  onSelectResult: (trackerId: string, rowId: string, openDataDrawer?: boolean) => void;
  onOpenSlaModal?: (row: TrackerRow) => void;
  onOpenChecklistModal?: (row: TrackerRow) => void;
  onOpenDataDrawer?: (row: TrackerRow, mode?: 'data1' | 'data2') => void;
  onUpdateRow?: (trackerId: string, updatedRow: TrackerRow) => void;
}

type SearchCategory = 'all' | 'site_id' | 'site_name' | 'pic' | 'address' | 'status' | 'notes';
type ViewMode = 'table' | 'cards';

interface SearchResultRow {
  tracker: Tracker;
  trackerId: string;
  trackerName: string;
  row: TrackerRow;
  rowId: string;
  siteId: string;
  siteName: string;
  status: string;
  picHandler: string;
  location: string;
  region: string;
  slaHealth: string;
  triggerDate: string;
  targetDate: string;
  budgetAmount: number;
  disbursedAmount: number;
  matchedField?: string;
  matchedSnippet?: string;
  notes?: string;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  trackers = [],
  currentTrackerId,
  onSelectResult,
  onOpenSlaModal,
  onOpenChecklistModal,
  onOpenDataDrawer,
}) => {
  if (!isOpen) return null;

  // Search input query
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);

  // Tracker checking system: choose 1, 2, 3, or all trackers via checkboxes
  const [selectedTrackerIds, setSelectedTrackerIds] = useState<string[]>(() => {
    // Default to all trackers so user immediately sees all data, with checking system ready to filter
    if (trackers.length > 0) {
      return trackers.map((t) => t.id);
    }
    return [currentTrackerId];
  });

  // Filters & Category
  const [category, setCategory] = useState<SearchCategory>('all');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [slaFilter, setSlaFilter] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Sorting
  const [sortField, setSortField] = useState<keyof SearchResultRow>('siteId');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  // Pagination
  const [pageSize, setPageSize] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Quick Tracker Selection Handlers
  const handleSelectAllTrackers = () => {
    setSelectedTrackerIds(trackers.map((t) => t.id));
    setCurrentPage(1);
  };

  const handleSelectCurrentTrackerOnly = () => {
    setSelectedTrackerIds([currentTrackerId]);
    setCurrentPage(1);
  };

  const handleClearAllTrackers = () => {
    setSelectedTrackerIds([]);
    setCurrentPage(1);
  };

  const toggleTracker = (trackerId: string) => {
    setSelectedTrackerIds((prev) => {
      if (prev.includes(trackerId)) {
        return prev.filter((id) => id !== trackerId);
      } else {
        return [...prev, trackerId];
      }
    });
    setCurrentPage(1);
  };

  // Extract all rows from selected trackers and filter them
  const { results, executionTimeMs, totalCount, totalBudget, delayedCount } = useMemo(() => {
    const startTime = performance.now();
    const cleanQ = (deferredQuery || '').trim().toLowerCase();

    // Filter trackers matching the checking system
    const activeTrackers = trackers.filter((t) => selectedTrackerIds.includes(t.id));

    const matchedList: SearchResultRow[] = [];
    let budgetSum = 0;
    let delayedSum = 0;

    for (const trk of activeTrackers) {
      if (!trk || !Array.isArray(trk.rows)) continue;

      for (const row of trk.rows) {
        if (!row || row.siteId === 'SUMMARY' || row.values?.site_id === 'SUMMARY') continue;

        try {
          const siteId = String(row.siteId || row.values?.site_id || '').trim();
          const siteName = String(
            row.siteDetails?.siteName || row.values?.site_name || siteId || 'Site Record'
          ).trim();
          const exactAddress = String(
            row.siteDetails?.exactAddress || row.values?.exact_address || row.values?.address || ''
          ).trim();
          const picHandler = String(
            row.siteDetails?.picHandler || row.values?.pic_handler || ''
          ).trim();
          const landlordName = String(
            row.siteDetails?.landlordName || row.values?.landlord_name || ''
          ).trim();
          const region = String(
            row.siteDetails?.region || row.values?.region || 'NCR / Luzon'
          ).trim();
          const notes = String(
            row.siteDetails?.notes || row.values?.data_notes || ''
          ).trim();
          const status = String(
            row.values?.status || row.slaData?.currentStatus || 'Active'
          ).trim();
          const slaHealth = String(row.slaData?.slaHealth || 'on_track');
          const triggerDate = String(
            row.slaData?.triggerDate || row.values?.sla_trigger_date || ''
          );
          const targetDate = String(
            row.values?.target_on_air_date || (row.slaData?.milestones?.[row.slaData.milestones.length - 1]?.targetDate) || ''
          );
          const rawBudget = row.values?.total_legal_budget;
          const budgetAmount = parseNumericValue(rawBudget) || 0;
          const rawDisbursed = row.values?.disbursed_legal_fees;
          const disbursedAmount = parseNumericValue(rawDisbursed) || 0;

          if (slaHealth === 'delayed' || slaHealth === 'critical' || row.slaData?.isNoMovement14Days) {
            delayedSum++;
          }
          budgetSum += budgetAmount;

          // Status & SLA quick dropdown filters
          if (statusFilter !== 'ALL' && status.toLowerCase() !== statusFilter.toLowerCase()) {
            continue;
          }
          if (slaFilter !== 'ALL' && slaHealth.toLowerCase() !== slaFilter.toLowerCase()) {
            continue;
          }

          let matched = false;
          let fieldName = '';
          let snippet = '';

          // If query is empty, we show ALL data rows from checked trackers!
          if (!cleanQ) {
            matched = true;
          } else {
            // Check specific category or all fields
            if (category === 'all' || category === 'site_id') {
              if (siteId.toLowerCase().includes(cleanQ)) {
                matched = true;
                fieldName = 'Site ID';
                snippet = siteId;
              }
            }

            if (!matched && (category === 'all' || category === 'site_name')) {
              if (siteName.toLowerCase().includes(cleanQ)) {
                matched = true;
                fieldName = 'Site Name';
                snippet = siteName;
              }
            }

            if (!matched && (category === 'all' || category === 'pic')) {
              if (picHandler.toLowerCase().includes(cleanQ)) {
                matched = true;
                fieldName = 'PIC Handler';
                snippet = picHandler;
              }
            }

            if (!matched && (category === 'all' || category === 'address')) {
              if (exactAddress.toLowerCase().includes(cleanQ)) {
                matched = true;
                fieldName = 'Address';
                snippet = exactAddress;
              } else if (landlordName.toLowerCase().includes(cleanQ)) {
                matched = true;
                fieldName = 'Landlord';
                snippet = landlordName;
              } else if (region.toLowerCase().includes(cleanQ)) {
                matched = true;
                fieldName = 'Region';
                snippet = region;
              }
            }

            if (!matched && (category === 'all' || category === 'status')) {
              if (status.toLowerCase().includes(cleanQ)) {
                matched = true;
                fieldName = 'Status';
                snippet = status;
              }
            }

            if (!matched && (category === 'all' || category === 'notes')) {
              if (notes && notes.toLowerCase().includes(cleanQ)) {
                matched = true;
                fieldName = 'Notes';
                snippet = notes.length > 60 ? notes.slice(0, 60) + '...' : notes;
              }
            }

            // Fallback: check custom column values
            if (!matched && category === 'all' && row.values && typeof row.values === 'object') {
              for (const [colKey, rawVal] of Object.entries(row.values)) {
                if (rawVal !== null && rawVal !== undefined) {
                  const strVal = String(rawVal);
                  if (strVal.toLowerCase().includes(cleanQ)) {
                    matched = true;
                    fieldName = colKey.replace(/_/g, ' ');
                    snippet = strVal;
                    break;
                  }
                }
              }
            }
          }

          if (matched) {
            matchedList.push({
              tracker: trk,
              trackerId: trk.id,
              trackerName: trk.name,
              row,
              rowId: row.id,
              siteId: siteId || 'SITE-RECORD',
              siteName: siteName || 'Unnamed Site',
              status: status || 'Active',
              picHandler: picHandler || 'Unassigned',
              location: exactAddress || region || 'Philippines',
              region,
              slaHealth,
              triggerDate,
              targetDate,
              budgetAmount,
              disbursedAmount,
              matchedField: fieldName,
              matchedSnippet: snippet,
              notes,
            });
          }
        } catch (e) {
          console.warn('Error reading row for global search:', e);
        }
      }
    }

    // Sort results
    matchedList.sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });

    const elapsed = Math.round((performance.now() - startTime) * 10) / 10;

    return {
      results: matchedList,
      executionTimeMs: elapsed,
      totalCount: matchedList.length,
      totalBudget: budgetSum,
      delayedCount: delayedSum,
    };
  }, [deferredQuery, selectedTrackerIds, trackers, category, statusFilter, slaFilter, sortField, sortAsc]);

  // Handle Sort Toggle
  const handleSort = (field: keyof SearchResultRow) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
    setCurrentPage(1);
  };

  // Paginated Results
  const totalPages = Math.max(1, Math.ceil(results.length / pageSize));
  const paginatedResults = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return results.slice(start, start + pageSize);
  }, [results, currentPage, pageSize]);

  // Export Results to Excel
  const handleExportToExcel = () => {
    if (results.length === 0) return;

    const headers = [
      '#',
      'Tracker Project',
      'Site ID',
      'Site Name',
      'Status',
      'SLA Health',
      'SLA Trigger Date',
      'Target On-Air Date',
      'PIC Handler',
      'Region',
      'Address',
      'Legal Budget (PHP)',
      'Disbursed (PHP)',
      'Notes',
    ];

    const dataRows = results.map((r, idx) => [
      idx + 1,
      r.trackerName,
      r.siteId,
      r.siteName,
      r.status,
      r.slaHealth,
      r.triggerDate,
      r.targetDate,
      r.picHandler,
      r.region,
      r.location,
      r.budgetAmount,
      r.disbursedAmount,
      r.notes || '',
    ]);

    const titleRow = [`SAQ GLOBAL SEARCH EXPORT — ${results.length} SITES ACROSS ${selectedTrackerIds.length} TRACKERS`];
    const metaRow = [
      `Exported: ${new Date().toLocaleString()}`,
      `Query: "${query}"`,
      `Trackers: ${selectedTrackerIds.map((id) => trackers.find((t) => t.id === id)?.name).join(', ')}`,
    ];

    const aoa = [titleRow, metaRow, [], headers, ...dataRows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Search_Data');
    XLSX.writeFile(wb, `Search_Export_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown' && viewMode === 'cards') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < paginatedResults.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp' && viewMode === 'cards') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter' && viewMode === 'cards') {
      if (paginatedResults.length > 0 && paginatedResults[selectedIndex]) {
        const item = paginatedResults[selectedIndex];
        onSelectResult(item.trackerId, item.rowId);
        onClose();
      }
    }
  };

  const handleCopySiteId = (e: React.MouseEvent, siteId: string) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(siteId);
    setCopiedId(siteId);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const highlightMatch = (text: string, term: string) => {
    if (!term || !text) return text;
    const cleanTerm = term.trim();
    if (cleanTerm.length < 2) return text;
    const parts = text.split(new RegExp(`(${cleanTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === cleanTerm.toLowerCase() ? (
            <mark key={i} className="bg-amber-400/30 text-amber-200 px-0.5 rounded font-bold">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-6 md:pt-10 bg-black/85 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-150"
      onKeyDown={handleKeyDown}
    >
      <div className="relative w-full max-w-6xl xl:max-w-7xl max-h-[92vh] flex flex-col rounded-2xl bg-slate-900 border border-slate-700 text-slate-100 shadow-2xl overflow-hidden">
        {/* Top Header / Search Input */}
        <div className="p-3.5 md:p-4 border-b border-slate-800 bg-slate-950 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 flex-1 min-w-[280px]">
            <div className="p-2.5 rounded-xl bg-indigo-950 text-indigo-400 border border-indigo-800/80 shrink-0">
              <Search className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search across chosen trackers (Site ID, Name, PIC, Landlord, Address, Notes)..."
                className="w-full bg-transparent text-sm md:text-base text-white placeholder-slate-500 focus:outline-hidden font-medium"
              />
            </div>

            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setCurrentPage(1);
                }}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 text-xs font-semibold flex items-center gap-1 transition-colors"
                title="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Right Action Icons & View Mode */}
          <div className="flex items-center gap-2">
            {/* View Mode Toggle: Table (Spreadsheet) vs Cards */}
            <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  viewMode === 'table'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Spreadsheet Table View (See all data columns)"
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Table View</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  viewMode === 'cards'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Cards Match View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Cards View</span>
              </button>
            </div>

            {/* Export to Excel Button */}
            <button
              type="button"
              onClick={handleExportToExcel}
              disabled={results.length === 0}
              className="px-3 py-1.5 text-xs font-bold text-emerald-300 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700/80 rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-40 cursor-pointer shadow-xs"
              title="Export all visible data to Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden md:inline">Export Excel</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors ml-1"
              title="Close modal (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* TRACKER CHECKING SYSTEM: Choose 1, 2, 3 or All Trackers */}
        <div className="px-4 py-3 bg-slate-950/90 border-b border-slate-800 flex flex-col gap-2 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-300 font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-amber-400" />
                <span>Tracker Selection System:</span>
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-950 text-indigo-300 border border-indigo-800">
                {selectedTrackerIds.length} of {trackers.length} Trackers Checked
              </span>
            </div>

            {/* Quick Selection Presets */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleSelectAllTrackers}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                  selectedTrackerIds.length === trackers.length
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                }`}
                title="Select and see data across all trackers"
              >
                All Trackers ({trackers.length})
              </button>
              <button
                type="button"
                onClick={handleSelectCurrentTrackerOnly}
                className="px-2.5 py-1 rounded text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                title="Search within current active tracker only"
              >
                Only Active Tracker
              </button>
              <button
                type="button"
                onClick={handleClearAllTrackers}
                className="px-2 py-1 rounded text-xs font-semibold bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                Clear All
              </button>
            </div>
          </div>

          {/* Checkboxes per tracker: Users can check 1, 2, 3, or more trackers */}
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            {trackers.map((trk) => {
              const isChecked = selectedTrackerIds.includes(trk.id);
              const isCurrent = trk.id === currentTrackerId;
              const count = trk.rows?.length || 0;

              return (
                <label
                  key={trk.id}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs cursor-pointer select-none transition-all ${
                    isChecked
                      ? 'bg-indigo-950/80 border-indigo-500 text-white shadow-xs ring-1 ring-indigo-500/50'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700 hover:bg-slate-850'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleTracker(trk.id)}
                    className="w-4 h-4 rounded text-indigo-500 focus:ring-indigo-500 bg-slate-950 border-slate-700"
                  />
                  <FolderOpen className={`w-3.5 h-3.5 ${isChecked ? 'text-amber-400' : 'text-slate-500'}`} />
                  <span className="font-semibold">{trk.name}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${
                      isChecked ? 'bg-indigo-900 text-indigo-200' : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    {count} sites
                  </span>
                  {isCurrent && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase font-black">
                      Current
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        </div>

        {/* Telemetry Strip & Secondary Filters */}
        <div className="px-4 py-2 bg-slate-950/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          {/* Left: Summary Metrics */}
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
            <div className="flex items-center gap-1 font-semibold text-slate-200">
              <span>Showing:</span>
              <span className="text-white font-bold font-mono">{totalCount} Sites</span>
              <span>across {selectedTrackerIds.length} Trackers</span>
            </div>
            <span>·</span>
            <div>
              Total Legal Budget: <span className="text-emerald-400 font-bold font-mono">{formatCurrencyPHP(totalBudget)}</span>
            </div>
            {delayedCount > 0 && (
              <>
                <span>·</span>
                <div className="text-rose-400 font-bold flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3" />
                  <span>{delayedCount} Delayed / Warning</span>
                </div>
              </>
            )}
            {query && (
              <span className="flex items-center gap-1 text-emerald-400 font-mono">
                <Zap className="w-3 h-3 text-amber-400 animate-pulse" />
                {executionTimeMs}ms
              </span>
            )}
          </div>

          {/* Right: Category and Status Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Field Category */}
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value as SearchCategory);
                setCurrentPage(1);
              }}
              className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-300 text-[11px] focus:outline-hidden focus:border-indigo-500"
            >
              <option value="all">All Fields</option>
              <option value="site_id">Site ID</option>
              <option value="site_name">Site Name</option>
              <option value="pic">PIC Handler</option>
              <option value="address">Address & Landlord</option>
              <option value="status">Status</option>
              <option value="notes">Field Notes</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-300 text-[11px] focus:outline-hidden focus:border-indigo-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="Site Hunting">Site Hunting</option>
              <option value="Under Review">Under Review</option>
              <option value="Pre-Con">Pre-Con</option>
              <option value="Post-Con">Post-Con</option>
              <option value="Completed">Completed</option>
              <option value="Delayed">Delayed</option>
            </select>

            {/* SLA Health Filter */}
            <select
              value={slaFilter}
              onChange={(e) => {
                setSlaFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-300 text-[11px] focus:outline-hidden focus:border-indigo-500"
            >
              <option value="ALL">All SLA Health</option>
              <option value="on_track">On Track</option>
              <option value="approaching">Approaching</option>
              <option value="delayed">Delayed</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </div>

        {/* Content Body: Table View or Cards View */}
        <div ref={listRef} className="flex-1 overflow-y-auto p-3 md:p-4">
          {selectedTrackerIds.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="inline-flex p-3 rounded-full bg-slate-800/80 text-amber-400 border border-slate-700/60">
                <Layers className="w-6 h-6" />
              </div>
              <p className="text-base font-bold text-white">No Trackers Selected</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Check at least one tracker checkbox above to view and search site data.
              </p>
              <button
                type="button"
                onClick={handleSelectAllTrackers}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors cursor-pointer shadow-md"
              >
                Select All Trackers
              </button>
            </div>
          ) : results.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <div className="inline-flex p-3 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                <Search className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-slate-300">
                No matching records found
              </p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Try clearing your search query or selecting additional trackers in the checking system.
              </p>
            </div>
          ) : viewMode === 'table' ? (
            /* SPREADSHEET TABLE VIEW: SEE ALL DATA */
            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950 shadow-inner">
              <div className="overflow-x-auto max-h-[60vh]">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-slate-900/95 sticky top-0 z-10 border-b border-slate-800 text-[11px] text-slate-400 font-semibold uppercase tracking-wider backdrop-blur-md">
                    <tr>
                      <th className="px-3 py-2.5 w-10 text-center">#</th>
                      <th
                        className="px-3 py-2.5 cursor-pointer hover:text-white"
                        onClick={() => handleSort('trackerName')}
                      >
                        <div className="flex items-center gap-1">
                          <span>Tracker</span>
                          <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </th>
                      <th
                        className="px-3 py-2.5 cursor-pointer hover:text-white"
                        onClick={() => handleSort('siteId')}
                      >
                        <div className="flex items-center gap-1">
                          <span>Site ID</span>
                          <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </th>
                      <th
                        className="px-3 py-2.5 cursor-pointer hover:text-white min-w-[180px]"
                        onClick={() => handleSort('siteName')}
                      >
                        <div className="flex items-center gap-1">
                          <span>Site Name & Candidate</span>
                          <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </th>
                      <th
                        className="px-3 py-2.5 cursor-pointer hover:text-white"
                        onClick={() => handleSort('status')}
                      >
                        <div className="flex items-center gap-1">
                          <span>Status</span>
                          <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </th>
                      <th
                        className="px-3 py-2.5 cursor-pointer hover:text-white"
                        onClick={() => handleSort('slaHealth')}
                      >
                        <div className="flex items-center gap-1">
                          <span>SLA Health</span>
                          <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </th>
                      <th className="px-3 py-2.5">SLA Trigger</th>
                      <th className="px-3 py-2.5">Target Date</th>
                      <th
                        className="px-3 py-2.5 cursor-pointer hover:text-white"
                        onClick={() => handleSort('picHandler')}
                      >
                        <div className="flex items-center gap-1">
                          <span>PIC Handler</span>
                          <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </th>
                      <th className="px-3 py-2.5">Region</th>
                      <th
                        className="px-3 py-2.5 text-right cursor-pointer hover:text-white"
                        onClick={() => handleSort('budgetAmount')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>Budget (₱)</span>
                          <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </th>
                      <th className="px-3 py-2.5 text-center min-w-[140px]">Quick Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {paginatedResults.map((item, idx) => {
                      const rowNum = (currentPage - 1) * pageSize + idx + 1;
                      const isDelayed =
                        item.slaHealth === 'delayed' ||
                        item.slaHealth === 'critical' ||
                        item.row.slaData?.isNoMovement14Days;

                      return (
                        <tr
                          key={`${item.trackerId}-${item.rowId}-${idx}`}
                          className="hover:bg-slate-900/60 transition-colors group"
                        >
                          <td className="px-3 py-2 text-center text-slate-500 font-mono text-[11px]">
                            {rowNum}
                          </td>
                          <td className="px-3 py-2">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-900 border border-slate-800 text-slate-300">
                              <FolderOpen className="w-3 h-3 text-indigo-400" />
                              <span className="truncate max-w-[110px]">{item.trackerName}</span>
                            </span>
                          </td>
                          <td className="px-3 py-2 font-mono font-bold text-sky-400">
                            <button
                              type="button"
                              onClick={(e) => handleCopySiteId(e, item.siteId)}
                              className="hover:underline flex items-center gap-1"
                              title="Click to copy Site ID"
                            >
                              <span>{highlightMatch(item.siteId, deferredQuery)}</span>
                              {copiedId === item.siteId ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-2.5 h-2.5 text-slate-500 opacity-0 group-hover:opacity-100" />
                              )}
                            </button>
                          </td>
                          <td className="px-3 py-2">
                            <div className="font-semibold text-white truncate max-w-[200px]" title={item.siteName}>
                              {highlightMatch(item.siteName, deferredQuery)}
                            </div>
                            {item.matchedField && item.matchedField !== 'Site ID' && item.matchedField !== 'Site Name' && (
                              <div className="text-[10px] text-amber-300 truncate max-w-[200px]">
                                Match in {item.matchedField}: "{item.matchedSnippet}"
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-900 border border-slate-800 text-slate-300 whitespace-nowrap">
                              {item.status}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase whitespace-nowrap ${
                                item.slaHealth === 'critical'
                                  ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                  : item.slaHealth === 'delayed'
                                  ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                  : item.slaHealth === 'approaching'
                                  ? 'bg-yellow-950 text-yellow-300 border border-yellow-800'
                                  : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              }`}
                            >
                              {item.slaHealth.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                            {item.triggerDate || '—'}
                          </td>
                          <td className="px-3 py-2 font-mono text-[11px] text-sky-400 whitespace-nowrap">
                            {item.targetDate || '—'}
                          </td>
                          <td className="px-3 py-2 text-slate-300 truncate max-w-[120px]" title={item.picHandler}>
                            {item.picHandler || 'Unassigned'}
                          </td>
                          <td className="px-3 py-2 text-slate-400 text-[11px] truncate max-w-[110px]" title={item.region}>
                            {item.region}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-semibold text-emerald-400 whitespace-nowrap">
                            {item.budgetAmount > 0 ? formatCurrencyPHP(item.budgetAmount) : '—'}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {/* Open in Tracker */}
                              <button
                                type="button"
                                onClick={() => {
                                  onSelectResult(item.trackerId, item.rowId);
                                  onClose();
                                }}
                                className="px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold flex items-center gap-0.5 transition-colors cursor-pointer"
                                title="Open this site in its project tracker"
                              >
                                <span>Open</span>
                                <ArrowRight className="w-2.5 h-2.5" />
                              </button>

                              {/* SLA Modal Trigger */}
                              {onOpenSlaModal && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onOpenSlaModal(item.row);
                                  }}
                                  className="p-1 rounded bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-800/80 transition-colors"
                                  title="View Day-by-Day SLA Tracker"
                                >
                                  <Clock className="w-3 h-3" />
                                </button>
                              )}

                              {/* Legal Fees Checklist Modal Trigger */}
                              {onOpenChecklistModal && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onOpenChecklistModal(item.row);
                                  }}
                                  className="p-1 rounded bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-800/80 transition-colors"
                                  title="View Legal Fees & Compliance Checklist"
                                >
                                  <FileText className="w-3 h-3" />
                                </button>
                              )}

                              {/* Site Data Drawer Trigger */}
                              {onOpenDataDrawer && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onOpenDataDrawer(item.row, 'data1');
                                  }}
                                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                                  title="View Full Encoded Site Data Drawer"
                                >
                                  <Building2 className="w-3 h-3" />
                                </button>
                              )}
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
            /* CARDS MATCH VIEW */
            <div className="space-y-2.5 max-h-[60vh] overflow-y-auto">
              {paginatedResults.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <div
                    key={`${item.trackerId}-${item.rowId}-${idx}`}
                    onClick={() => {
                      onSelectResult(item.trackerId, item.rowId);
                      onClose();
                    }}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 group ${
                      isSelected
                        ? 'bg-slate-800 border-indigo-500 shadow-md ring-1 ring-indigo-500/50'
                        : 'bg-slate-950/80 hover:bg-slate-800/70 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {/* Left Column Info */}
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Site ID badge with copy action */}
                        <button
                          type="button"
                          onClick={(e) => handleCopySiteId(e, item.siteId)}
                          className="font-mono text-xs font-bold text-sky-400 px-2 py-0.5 rounded bg-sky-950/80 border border-sky-800/80 hover:bg-sky-900 transition-colors flex items-center gap-1 cursor-pointer"
                          title="Click to copy Site ID"
                        >
                          <span>{highlightMatch(item.siteId, deferredQuery)}</span>
                          {copiedId === item.siteId ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3 text-sky-400/70" />
                          )}
                        </button>

                        {/* Site Name */}
                        <span className="font-semibold text-white text-xs md:text-sm truncate">
                          {highlightMatch(item.siteName, deferredQuery)}
                        </span>

                        {/* Tracker Name */}
                        <span className="text-[11px] text-slate-300 flex items-center gap-1 bg-slate-900 px-2 py-0.5 rounded border border-slate-800 font-medium">
                          <FolderOpen className="w-3 h-3 text-indigo-400" />
                          {item.trackerName}
                        </span>
                      </div>

                      {/* Matched Details */}
                      <div className="text-xs text-slate-300 flex flex-wrap items-center gap-x-3 gap-y-1">
                        {item.matchedField && (
                          <div className="flex items-center gap-1 text-slate-400">
                            <span className="text-[11px] font-medium text-slate-400">Match:</span>
                            <span className="font-semibold text-amber-300">
                              {item.matchedField}:
                            </span>
                            <span className="text-slate-200">
                              "{highlightMatch(item.matchedSnippet || '', deferredQuery)}"
                            </span>
                          </div>
                        )}

                        {item.picHandler && (
                          <div className="flex items-center gap-1 text-[11px] text-slate-400">
                            <User className="w-3 h-3 text-slate-500" />
                            <span>{item.picHandler}</span>
                          </div>
                        )}

                        {item.location && (
                          <div className="flex items-center gap-1 text-[11px] text-slate-400 truncate max-w-xs">
                            <MapPin className="w-3 h-3 text-slate-500" />
                            <span className="truncate">{item.location}</span>
                          </div>
                        )}

                        {item.budgetAmount > 0 && (
                          <div className="text-[11px] text-emerald-400 font-mono font-bold">
                            Budget: {formatCurrencyPHP(item.budgetAmount)}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right Actions */}
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-300">
                        {item.status}
                      </span>

                      {/* Direct SLA button */}
                      {onOpenSlaModal && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenSlaModal(item.row);
                          }}
                          className="px-2 py-1 rounded bg-amber-950/80 hover:bg-amber-900 text-amber-300 text-xs font-semibold border border-amber-800 flex items-center gap-1 transition-colors cursor-pointer"
                          title="Open Day-by-Day SLA"
                        >
                          <Clock className="w-3 h-3" />
                          <span className="hidden sm:inline">SLA</span>
                        </button>
                      )}

                      {/* Open Data Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectResult(item.trackerId, item.rowId, true);
                          onClose();
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 text-xs font-semibold border border-indigo-800 flex items-center gap-1 transition-colors cursor-pointer"
                        title="Open Full Site Data"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Data</span>
                      </button>

                      {/* Jump Arrow */}
                      <div className="p-1.5 rounded-lg text-slate-400 group-hover:text-white group-hover:bg-indigo-600 transition-colors">
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer: Pagination & Keyboard shortcuts */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400 shrink-0">
          {/* Left: Total matching sites */}
          <div className="flex items-center gap-2">
            <span>
              Showing {paginatedResults.length} of {results.length} matching sites
            </span>
            <span>·</span>
            <div className="flex items-center gap-1">
              <span>Per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-white text-xs"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={500}>500</option>
              </select>
            </div>
          </div>

          {/* Center: Pagination buttons */}
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-white disabled:opacity-30"
              >
                Prev
              </button>
              <span className="px-2 text-slate-300 font-mono text-[11px]">
                Page {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-white disabled:opacity-30"
              >
                Next
              </button>
            </div>
          )}

          {/* Right: Close shortcut */}
          <div className="flex items-center gap-2 text-slate-500 text-[11px]">
            <span>Press <kbd className="px-1 py-0.5 rounded bg-slate-850 border border-slate-700 text-slate-300 font-mono text-[10px]">Esc</kbd> to close</span>
          </div>
        </div>
      </div>
    </div>
  );
};
