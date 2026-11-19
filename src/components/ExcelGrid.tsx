import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Tracker,
  TrackerRow,
  ColumnDefinition,
  ColumnType,
  SiteSlaData,
  LegalChecklistItem,
  SlaMilestone,
} from '../types/tracker';
import {
  formatCurrencyPHP,
  parseNumericValue,
  copyToExcelClipboard,
  parseExcelClipboardText,
  exportTrackerToExcel,
  readExcelFile,
  readExcelWorkbook,
  ExcelWorkbookResult,
  getLocalDateString,
  formatDateDisplay,
  addDaysToDateString,
  normalizeToStandardDate,
  looksLikeDateString,
  evaluateSlaStatus,
  createStandardSlaMilestones,
  getEffectiveTrackerSlaConfig,
  createMilestonesFromTemplate,
} from '../utils/excelUtils';
import { optimizeAndCompressImage } from '../utils/imageOptimizer';
import { uploadFileToSupabase } from '../utils/supabaseClient';
import {
  Plus,
  Trash2,
  Sliders,
  Target,
  Edit2,
  FileSpreadsheet,
  Upload,
  Undo2,
  Search,
  Filter,
  ArrowUpDown,
  Lock,
  Unlock,
  Pin,
  Snowflake,
  Columns,
  Rows,
  Split,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ExternalLink,
  ShieldAlert,
  FileText,
  Layers,
  Image as ImageIcon,
  CheckSquare,
  Square,
  AlertTriangle,
  Copy,
  ClipboardPaste,
  Calendar,
  CalendarCheck,
  Sparkles,
  X,
  Save,
  Database,
  Check,
  RefreshCw,
  Download,
  Eye,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Camera,
  Cloud,
  Users,
} from 'lucide-react';

/**
 * Format file byte size into human readable string (e.g. 1.2 MB, 340 KB)
 */
export function formatFileSize(bytes: number): string {
  if (!bytes || isNaN(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Robustly parse file information from cell values (supports object payloads and data URLs)
 */
export function parseFileCell(
  val: any,
  defaultType: 'image' | 'pdf' = 'image'
): {
  url: string;
  name: string;
  size?: string;
  type: 'image' | 'pdf';
  uploadedAt?: string;
} | null {
  if (val === undefined || val === null || val === '') return null;
  if (typeof val === 'object' && val.url) {
    const isPdf =
      val.type === 'pdf' ||
      val.name?.toLowerCase().endsWith('.pdf') ||
      String(val.url).includes('application/pdf');
    return {
      url: val.url,
      name: val.name || (isPdf ? 'Document.pdf' : 'Photo.jpg'),
      size: val.size || '',
      type: isPdf ? 'pdf' : 'image',
      uploadedAt: val.uploadedAt,
    };
  }
  if (typeof val === 'string' && val.trim()) {
    const str = val.trim();
    if (
      str.toLowerCase() === 'no photo' ||
      str.toLowerCase() === 'no pdf' ||
      str.toLowerCase() === 'none'
    ) {
      return null;
    }
    const isPdf =
      str.toLowerCase().endsWith('.pdf') ||
      str.includes('application/pdf') ||
      defaultType === 'pdf';
    let cleanName = isPdf ? 'Document.pdf' : 'Photo.jpg';
    if (!str.startsWith('data:')) {
      const parts = str.split('/');
      const lastPart = parts[parts.length - 1];
      if (lastPart && lastPart.length < 50) cleanName = lastPart;
    }
    return {
      url: str,
      name: cleanName,
      size: '',
      type: isPdf ? 'pdf' : 'image',
    };
  }
  return null;
}

interface ExcelGridProps {
  tracker: Tracker;
  onUpdateTracker: (updatedTracker: Tracker) => void;
  onUpdateRow?: (row: TrackerRow) => void;
  onOpenSlaModal: (row: TrackerRow) => void;
  onOpenChecklistModal: (row: TrackerRow) => void;
  onOpenSiteDataDrawer: (row: TrackerRow, mode?: 'data1' | 'data2') => void;
  onOpenCustomizeColumns: () => void;
  onOpenLockApprovalModal?: () => void;
  pendingApprovalsCount?: number;
  canEdit: boolean;
  onSaveChanges?: () => void;
  hasUnsavedChanges?: boolean;
  unsavedCount?: number;
  isSaving?: boolean;
  lastSavedTime?: string | null;
  onOpenSupabaseModal?: () => void;
  isSupabaseConnected?: boolean;
  onOpenCloudflareModal?: () => void;
  isCloudflareConnected?: boolean;
  onOpenServerModal?: () => void;
  isServerConnected?: boolean;
  onOpenProjectSlaModal?: () => void;
}

export const ExcelGrid: React.FC<ExcelGridProps> = ({
  tracker,
  onUpdateTracker,
  onUpdateRow,
  onOpenSlaModal,
  onOpenChecklistModal,
  onOpenSiteDataDrawer,
  onOpenCustomizeColumns,
  onOpenLockApprovalModal,
  pendingApprovalsCount = 0,
  canEdit,
  onOpenProjectSlaModal,
  onSaveChanges,
  hasUnsavedChanges = false,
  unsavedCount = 0,
  isSaving = false,
  lastSavedTime = null,
  onOpenSupabaseModal,
  isSupabaseConnected = false,
  onOpenCloudflareModal,
  isCloudflareConnected = false,
  onOpenServerModal,
  isServerConnected = true,
}) => {
  // Undo history stack
  const [historyStack, setHistoryStack] = useState<TrackerRow[][]>([]);
  
  // Selection and editing state
  const [selectedCell, setSelectedCell] = useState<{ rowId: string; pIdx: number; colId: string } | null>(null);
  const [editingCell, setEditingCell] = useState<{ rowId: string; pIdx: number; colId: string } | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');

  // In-app Delete Confirmation state
  const [rowToDelete, setRowToDelete] = useState<TrackerRow | null>(null);
  // Floating Undo toast for row deletion
  const [deletedToastRow, setDeletedToastRow] = useState<TrackerRow | null>(null);

  // In-app Delete All Confirmation state
  const [isDeleteAllModalOpen, setIsDeleteAllModalOpen] = useState(false);
  const [deleteAllOption, setDeleteAllOption] = useState<'all' | 'filtered'>('all');
  const [deletedBatchToast, setDeletedBatchToast] = useState<{ count: number; rows: TrackerRow[] } | null>(null);

  useEffect(() => {
    if (!deletedToastRow) return;
    const timer = setTimeout(() => {
      setDeletedToastRow(null);
    }, 6000);
    return () => clearTimeout(timer);
  }, [deletedToastRow]);

  useEffect(() => {
    if (!deletedBatchToast) return;
    const timer = setTimeout(() => {
      setDeletedBatchToast(null);
    }, 8000);
    return () => clearTimeout(timer);
  }, [deletedBatchToast]);

  // Pagination state (Rows: 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, and 999999 for All)
  const [pageSize, setPageSize] = useState<number>(20);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Grid filters & sort
  const [sortConfig, setSortConfig] = useState<{ colId: string; direction: 'asc' | 'desc' } | null>(null);
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [showFilterBar, setShowFilterBar] = useState(false);
  const [showSummaryRow, setShowSummaryRow] = useState(true);
  const [summaryPosition, setSummaryPosition] = useState<'top' | 'bottom' | 'both'>('top');
  const [dateFormatPreference, setDateFormatPreference] = useState<'YYYY-MM-DD' | 'MMM DD, YYYY' | 'DD/MM/YYYY' | 'MM/DD/YYYY'>('YYYY-MM-DD');

  // Freeze Panes state
  const [isFreezeMenuOpen, setIsFreezeMenuOpen] = useState(false);
  const freezeMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (freezeMenuRef.current && !freezeMenuRef.current.contains(e.target as Node)) {
        setIsFreezeMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Column resizing
  const [resizingCol, setResizingCol] = useState<{ colId: string; startX: number; startWidth: number } | null>(null);

  // Quick search
  const [gridSearch, setGridSearch] = useState('');

  // Table container ref
  const tableRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File Upload & Preview Modal State
  const [filePickerTarget, setFilePickerTarget] = useState<{
    rowId: string;
    colId: string;
    type: 'image' | 'pdf';
  } | null>(null);
  const [dragOverCell, setDragOverCell] = useState<{ rowId: string; colId: string } | null>(null);
  const [uploadingCell, setUploadingCell] = useState<{ rowId: string; colId: string } | null>(null);
  const [previewModalFile, setPreviewModalFile] = useState<{
    rowId: string;
    colId: string;
    siteId: string;
    colLabel: string;
    name: string;
    url: string;
    type: 'image' | 'pdf';
    size?: string;
    uploadedAt?: string;
  } | null>(null);
  const [previewZoom, setPreviewZoom] = useState<number>(1);
  const [previewRotation, setPreviewRotation] = useState<number>(0);

  // Excel Import Configuration & Exact Row Matching State
  interface PendingExcelImport {
    fileName: string;
    rawData: any[][];
    totalFileRows: number;
    hasHeaderRow: boolean;
    headerRowIndex: number;
    detectedHeaderRowIndex: number;
    skipBlankRows: boolean;
    headers: string[];
    dataRows: any[][];
    blankRowCount: number;
    allColumns: ColumnDefinition[];
    colMapping: Record<number, ColumnDefinition>;
    siteIdColIdx?: string;
    siteNameColIdx?: string;
    workbookResult?: ExcelWorkbookResult;
    activeSheetName?: string;
  }
  const [pendingImport, setPendingImport] = useState<PendingExcelImport | null>(null);
  const [importMode, setImportMode] = useState<'replace' | 'append'>('replace');

  // In-sheet lock notice banner for accidental overwrite protection
  const [lockNotice, setLockNotice] = useState<string | null>(null);

  useEffect(() => {
    if (lockNotice) {
      const timer = setTimeout(() => setLockNotice(null), 4500);
      return () => clearTimeout(timer);
    }
  }, [lockNotice]);

  // Quick toggle lock protection for sheet data
  const handleToggleLock = useCallback(() => {
    if (!canEdit) return;
    const nextLocked = !tracker.isLocked;
    onUpdateTracker({
      ...tracker,
      isLocked: nextLocked,
      updatedAt: new Date().toISOString(),
    });
    setLockNotice(
      nextLocked
        ? '🔒 Sheet is now LOCKED: Protected against accidental overwrite. Cell edits and deletions are disabled.'
        : '🔓 Sheet is now UNLOCKED: Editing and modifications are enabled.'
    );
  }, [canEdit, tracker, onUpdateTracker]);

  // Reset to first page when filtering or changing page size
  useEffect(() => {
    setCurrentPage(1);
  }, [gridSearch, filterValues, pageSize]);

  // Push history before state change
  const pushHistory = useCallback(() => {
    setHistoryStack((prev) => [...prev.slice(-25), JSON.parse(JSON.stringify(tracker.rows))]);
  }, [tracker.rows]);

  const handleUndo = useCallback(() => {
    if (historyStack.length === 0) return;
    const previous = historyStack[historyStack.length - 1];
    setHistoryStack((prev) => prev.slice(0, -1));
    onUpdateTracker({
      ...tracker,
      rows: previous,
      updatedAt: new Date().toISOString(),
    });
  }, [historyStack, tracker, onUpdateTracker]);

  const handleSort = (colId: string) => {
    let nextDirection: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.colId === colId) {
      nextDirection = sortConfig.direction === 'asc' ? 'desc' : 'asc';
    }
    setSortConfig({ colId, direction: nextDirection });
  };

  // Filtered and Sorted rows
  const visibleCols = useMemo(
    () => tracker.columns.filter((c) => c.visible),
    [tracker.columns]
  );

  const processedRows = useMemo(() => {
    if (!Array.isArray(tracker.rows)) return [];
    const cleanSearch = gridSearch.trim().toLowerCase();

    let rows = tracker.rows.filter((row) => {
      if (!row) return false;
      if (row.siteId === 'SUMMARY' || row.values?.site_id === 'SUMMARY') return false;

      // Search filter across ID, name, PIC handler, address, and cell values
      if (cleanSearch) {
        const inSiteId = String(row.siteId || row.values?.site_id || '').toLowerCase().includes(cleanSearch);
        const inSiteName = String(row.siteDetails?.siteName || row.values?.site_name || '').toLowerCase().includes(cleanSearch);
        const inPic = String(row.siteDetails?.picHandler || row.values?.pic_handler || '').toLowerCase().includes(cleanSearch);
        const inAddress = String(row.siteDetails?.exactAddress || row.values?.exact_address || '').toLowerCase().includes(cleanSearch);
        const inValues =
          row.values && typeof row.values === 'object'
            ? Object.values(row.values).some(
                (v) => v !== null && v !== undefined && String(v).toLowerCase().includes(cleanSearch)
              )
            : false;

        if (!inSiteId && !inSiteName && !inPic && !inAddress && !inValues) {
          return false;
        }
      }

      // Column filter bar
      for (const [colId, filterText] of Object.entries(filterValues)) {
        if (!filterText.trim()) continue;
        const targetVal = colId === 'site_id' ? String(row.siteId || '') : String(row.values?.[colId] ?? '');
        if (!targetVal.toLowerCase().includes(filterText.toLowerCase())) {
          return false;
        }
      }

      return true;
    });

    if (sortConfig) {
      const { colId, direction } = sortConfig;
      const col = tracker.columns.find((c) => c.id === colId);
      rows = [...rows].sort((a, b) => {
        let valA = colId === 'site_id' ? a.siteId : a.values?.[colId];
        let valB = colId === 'site_id' ? b.siteId : b.values?.[colId];

        if (col?.type === 'amount' || col?.type === 'number' || col?.type === 'percent') {
          valA = parseNumericValue(valA);
          valB = parseNumericValue(valB);
          return direction === 'asc' ? valA - valB : valB - valA;
        }

        if (col?.type === 'date') {
          const timeA = valA ? new Date(valA).getTime() : 0;
          const timeB = valB ? new Date(valB).getTime() : 0;
          return direction === 'asc' ? timeA - timeB : timeB - timeA;
        }

        valA = String(valA || '').toLowerCase();
        valB = String(valB || '').toLowerCase();
        return direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      });
    }

    return rows;
  }, [tracker.rows, tracker.columns, gridSearch, filterValues, sortConfig]);

  // Pre-calculated Column Summaries (Sum, Avg, Count) - Computed in a single pass O(N)
  const columnSummaries = useMemo(() => {
    const numCols = visibleCols.length;
    const count = processedRows.length;
    const totals = new Float64Array(numCols);
    const validValueCounts = new Int32Array(numCols);

    // Single fast pass over all rows
    for (let i = 0; i < count; i++) {
      const r = processedRows[i];
      const vals = r.values;

      for (let j = 0; j < numCols; j++) {
        const col = visibleCols[j];
        const isAmountCol = col.type === 'amount' || (col.label && col.label.toLowerCase().includes('amount'));
        if (isAmountCol || col.summaryType === 'sum' || col.summaryType === 'avg') {
          const v = vals?.[col.id];
          if (v !== undefined && v !== null && v !== '') {
            const num = typeof v === 'number' ? (isNaN(v) ? 0 : v) : parseNumericValue(v);
            if (num) {
              totals[j] += num;
              validValueCounts[j]++;
            }
          }
        } else if (col.type === 'legal_checklist') {
          const list = Array.isArray(r.legalChecklist) ? r.legalChecklist : [];
          let budget = 0;
          for (let k = 0; k < list.length; k++) {
            budget += list[k].amount || 0;
          }
          if (budget <= 0 && vals?.total_legal_budget) {
            budget = parseNumericValue(vals.total_legal_budget);
          }
          if (budget <= 0 && vals?.[col.id]) {
            budget = parseNumericValue(vals[col.id]);
          }
          if (budget > 0) {
            totals[j] += budget;
            validValueCounts[j]++;
          }
        }
      }
    }

    const map: Record<string, string> = {};
    for (let j = 0; j < numCols; j++) {
      const col = visibleCols[j];
      const isAmountCol = col.type === 'amount' || (col.label && col.label.toLowerCase().includes('amount'));
      if (col.type === 'legal_checklist') {
        map[col.id] = formatCurrencyPHP(totals[j]);
      } else if (isAmountCol) {
        map[col.id] = formatCurrencyPHP(totals[j]);
      } else if (col.summaryType === 'sum') {
        map[col.id] = totals[j].toLocaleString('en-PH');
      } else if (col.summaryType === 'avg') {
        const cnt = validValueCounts[j] || count;
        const avg = cnt > 0 ? totals[j] / cnt : 0;
        map[col.id] = col.type === 'percent' ? `${Math.round(avg * 10) / 10}%` : (Math.round(avg * 10) / 10).toLocaleString('en-PH');
      } else if (col.summaryType === 'count') {
        map[col.id] = `${count.toLocaleString()} rows`;
      } else {
        map[col.id] = '';
      }
    }
    return map;
  }, [visibleCols, processedRows]);

  const calculateColumnSummary = (col: ColumnDefinition) => columnSummaries[col.id] || '';

  // Pagination calculation
  const totalRows = processedRows.length;
  const isAllPages = pageSize >= 999999;
  const totalPages = isAllPages ? 1 : Math.max(1, Math.ceil(totalRows / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = isAllPages ? 0 : (safeCurrentPage - 1) * pageSize;
  const endIndex = isAllPages ? totalRows : Math.min(startIndex + pageSize, totalRows);
  const pagedRows = useMemo(() => {
    return isAllPages ? processedRows : processedRows.slice(startIndex, endIndex);
  }, [isAllPages, processedRows, startIndex, endIndex]);

  // Keyboard navigation & shortcuts (Ctrl+Z, Ctrl+C, Ctrl+V, Arrows, Enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if user is typing inside an active text input or textarea
      const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const isInput = targetTag === 'input' || targetTag === 'textarea' || targetTag === 'select';

      // Undo shortcut (Ctrl+Z / Cmd+Z)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }

      // Copy shortcut (Ctrl+C)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && !isInput && selectedCell) {
        e.preventDefault();
        const row = tracker.rows.find((r) => r.id === selectedCell.rowId) || pagedRows[selectedCell.pIdx];
        if (row) {
          const val = selectedCell.colId === 'site_id' ? row.siteId : row.values[selectedCell.colId] ?? '';
          copyToExcelClipboard([[String(val)]]);
        }
        return;
      }

      // Paste shortcut (Ctrl+V)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v' && !isInput && selectedCell && canEdit) {
        navigator.clipboard.readText().then((text) => {
          if (!text) return;
          const matrix = parseExcelClipboardText(text);
          if (matrix.length === 0) return;

          pushHistory();
          const startColIdx = visibleCols.findIndex((c) => c.id === selectedCell.colId);
          if (startColIdx === -1) return;

          const startRowIdx = tracker.rows.findIndex((r) => r.id === selectedCell.rowId);
          if (startRowIdx === -1) return;

          const updatedRows = [...tracker.rows];

          matrix.forEach((pRow, rOffset) => {
            const targetRowIdx = startRowIdx + rOffset;
            if (targetRowIdx >= updatedRows.length) return;

            const targetRow = { ...updatedRows[targetRowIdx], values: { ...updatedRows[targetRowIdx].values } };
            pRow.forEach((cellVal, cOffset) => {
              const targetCol = visibleCols[startColIdx + cOffset];
              if (!targetCol) return;

              if (targetCol.type === 'site_id') {
                targetRow.siteId = cellVal.trim();
              } else if (targetCol.type === 'amount' || targetCol.type === 'number') {
                targetRow.values[targetCol.id] = parseNumericValue(cellVal);
              } else if (
                targetCol.type === 'date' ||
                targetCol.type === 'sla_trigger_date' ||
                targetCol.id === 'sla_trigger_date' ||
                targetCol.id === 'target_on_air_date' ||
                targetCol.id.toLowerCase().includes('date')
              ) {
                const stdDate = normalizeToStandardDate(cellVal);
                targetRow.values[targetCol.id] = stdDate;
                if ((targetCol.type === 'sla_trigger_date' || targetCol.id === 'sla_trigger_date') && targetRow.slaData) {
                  targetRow.slaData.triggerDate = stdDate;
                }
              } else {
                targetRow.values[targetCol.id] = cellVal.trim();
              }
            });
            updatedRows[targetRowIdx] = targetRow;
          });

          onUpdateTracker({
            ...tracker,
            rows: updatedRows,
            updatedAt: new Date().toISOString(),
          });
        });
        return;
      }

      if (isInput) return;

      // Cell Navigation with Arrows, Enter, Tab
      if (selectedCell) {
        const colIdx = visibleCols.findIndex((c) => c.id === selectedCell.colId);

        if (e.key === 'ArrowDown' || (e.key === 'Enter' && !editingCell)) {
          e.preventDefault();
          if (selectedCell.pIdx < pagedRows.length - 1) {
            const nextRow = pagedRows[selectedCell.pIdx + 1];
            setSelectedCell({ rowId: nextRow.id, pIdx: selectedCell.pIdx + 1, colId: selectedCell.colId });
          }
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (selectedCell.pIdx > 0) {
            const prevRow = pagedRows[selectedCell.pIdx - 1];
            setSelectedCell({ rowId: prevRow.id, pIdx: selectedCell.pIdx - 1, colId: selectedCell.colId });
          }
        } else if (e.key === 'ArrowRight' || e.key === 'Tab') {
          e.preventDefault();
          if (colIdx < visibleCols.length - 1) {
            setSelectedCell({ ...selectedCell, colId: visibleCols[colIdx + 1].id });
          }
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          if (colIdx > 0) {
            setSelectedCell({ ...selectedCell, colId: visibleCols[colIdx - 1].id });
          }
        } else if (e.key === 'Delete' || e.key === 'Backspace') {
          if (!editingCell && canEdit) {
            if (tracker.isLocked) {
              setLockNotice('🔒 Sheet is locked: Protected against accidental overwrite. Click Unlock in toolbar to edit.');
              return;
            }
            e.preventDefault();
            pushHistory();
            const updatedRows = tracker.rows.map((r) => {
              if (r.id !== selectedCell.rowId) return r;
              const target = { ...r, values: { ...r.values } };
              target.values[selectedCell.colId] = '';
              return target;
            });
            onUpdateTracker({ ...tracker, rows: updatedRows });
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCell, editingCell, tracker, canEdit, handleUndo, pushHistory, onUpdateTracker, pagedRows, visibleCols]);

  // Focus input when editing starts
  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell]);

  // Handle column resize drag
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizingCol) return;
      const deltaX = e.clientX - resizingCol.startX;
      const newWidth = Math.max(70, resizingCol.startWidth + deltaX);
      const updatedCols = tracker.columns.map((c) =>
        c.id === resizingCol.colId ? { ...c, width: newWidth } : c
      );
      onUpdateTracker({ ...tracker, columns: updatedCols });
    };

    const handleMouseUp = () => {
      setResizingCol(null);
    };

    if (resizingCol) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingCol, tracker, onUpdateTracker]);

  // File upload and storage handlers for image & PDF columns (with automatic image compression to prevent memory bloat)
  const handleUploadFileToCell = useCallback(
    async (rowId: string, colId: string, file: File, expectedType?: 'image' | 'pdf') => {
      if (!canEdit) return;
      if (tracker.isLocked) {
        setLockNotice('🔒 Sheet is locked: Protected against accidental overwrite. Click Unlock in toolbar to upload.');
        return;
      }

      setUploadingCell({ rowId, colId });

      try {
        // Automatic image compression & scaling: reduces multi-megabyte camera/phone photos by up to 98%
        const optimized = await optimizeAndCompressImage(file, file.name);

        const fileObj = {
          url: optimized.url,
          name: optimized.name,
          type: optimized.type,
          size: optimized.size,
          uploadedAt: optimized.uploadedAt,
          width: optimized.width,
          height: optimized.height,
        };

        pushHistory();

        const updatedRows = tracker.rows.map((r) => {
          if (r.id !== rowId) return r;
          const updatedR: TrackerRow = {
            ...r,
            values: {
              ...r.values,
              [colId]: fileObj,
            },
          };

          // If this is reference_photo or site_photo, also synchronize to siteDetails.referencePhotoUrl
          if (colId === 'reference_photo' || colId === 'site_photo') {
            updatedR.siteDetails = {
              ...(updatedR.siteDetails || { siteId: r.siteId, siteName: r.values?.site_name || 'Site' }),
              referencePhotoUrl: optimized.url,
            };
          }

          // Also synchronize into row documents collection
          const docEntry = {
            id: 'doc_' + Date.now().toString(),
            name: optimized.name,
            type: (optimized.type === 'pdf' ? 'pdf' : 'jpg') as 'pdf' | 'jpg',
            url: optimized.url,
            uploadedAt: getLocalDateString(),
            tag: colId,
            fileSize: optimized.size,
          };
          const existingDocs = Array.isArray(r.documents) ? r.documents : [];
          updatedR.documents = [docEntry, ...existingDocs.filter((d) => d.name !== optimized.name)];

          return updatedR;
        });

        onUpdateTracker({
          ...tracker,
          rows: updatedRows,
          updatedAt: new Date().toISOString(),
        });

        setUploadingCell(null);

        // Keep preview modal in sync if open
        setPreviewModalFile((curr) => {
          if (curr && curr.rowId === rowId && curr.colId === colId) {
            return {
              ...curr,
              url: optimized.url,
              name: optimized.name,
              type: optimized.type,
              size: optimized.size,
              uploadedAt: optimized.uploadedAt,
            };
          }
          return curr;
        });

        // Automatically push uploaded JPEG/JPG/PDF to Supabase Storage & Registry
        const targetRow = tracker.rows.find((r) => r.id === rowId);
        const siteLabel = String(targetRow?.values?.site_name || targetRow?.siteId || 'Site');
        void uploadFileToSupabase({
          file: optimized.type === 'pdf' ? file : undefined,
          dataUrl: optimized.url,
          fileName: optimized.name,
          fileSize: optimized.size,
          trackerId: tracker.id,
          trackerName: tracker.name,
          rowId,
          siteName: siteLabel,
          colId,
          source: `Grid Cell (${colId})`,
        });
      } catch (err) {
        setUploadingCell(null);
        alert('Error processing file attachment. Please try again.');
      }
    },
    [canEdit, tracker, onUpdateTracker, pushHistory]
  );

  const handleRemoveFileFromCell = useCallback(
    (rowId: string, colId: string) => {
      if (!canEdit) return;
      if (tracker.isLocked) {
        setLockNotice('🔒 Sheet is locked: Protected against accidental overwrite.');
        return;
      }
      pushHistory();

      const updatedRows = tracker.rows.map((r) => {
        if (r.id !== rowId) return r;
        const nextValues = { ...r.values };
        delete nextValues[colId];
        const nextR = { ...r, values: nextValues };
        if (colId === 'reference_photo' && nextR.siteDetails) {
          nextR.siteDetails = { ...nextR.siteDetails, referencePhotoUrl: undefined };
        }
        return nextR;
      });

      onUpdateTracker({
        ...tracker,
        rows: updatedRows,
        updatedAt: new Date().toISOString(),
      });

      if (previewModalFile && previewModalFile.rowId === rowId && previewModalFile.colId === colId) {
        setPreviewModalFile(null);
      }
    },
    [canEdit, tracker, onUpdateTracker, pushHistory, previewModalFile]
  );

  const triggerFileSelect = useCallback(
    (rowId: string, colId: string, type: 'image' | 'pdf') => {
      if (!canEdit) return;
      setFilePickerTarget({ rowId, colId, type });
      if (fileInputRef.current) {
        fileInputRef.current.accept =
          'image/*,application/pdf,.pdf,.jpg,.jpeg,.png,.webp,.gif,.bmp';
        fileInputRef.current.value = '';
        fileInputRef.current.click();
      }
    },
    [canEdit]
  );

  const handleDownloadFile = useCallback((url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || 'document';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  const openPreview = useCallback(
    (row: TrackerRow, col: ColumnDefinition, fileInfo: any) => {
      setPreviewZoom(1);
      setPreviewRotation(0);
      setPreviewModalFile({
        rowId: row.id,
        colId: col.id,
        siteId: row.siteId,
        colLabel: col.label,
        name: fileInfo.name,
        url: fileInfo.url,
        type: fileInfo.type,
        size: fileInfo.size,
        uploadedAt: fileInfo.uploadedAt,
      });
    },
    []
  );

  // Paste image / pdf directly from clipboard into selected cell
  useEffect(() => {
    const handlePasteClipboardFile = (e: ClipboardEvent) => {
      if (!selectedCell || !canEdit) return;
      if (tracker.isLocked) {
        setLockNotice('🔒 Sheet is locked: Protected against accidental overwrite.');
        return;
      }
      const targetCol = tracker.columns.find((c) => c.id === selectedCell.colId);
      if (!targetCol) return;
      if (targetCol.type === 'image' || targetCol.type === 'pdf') {
        const items = e.clipboardData?.items;
        if (items) {
          for (let i = 0; i < items.length; i++) {
            if (items[i].kind === 'file') {
              const file = items[i].getAsFile();
              if (file) {
                e.preventDefault();
                handleUploadFileToCell(selectedCell.rowId, selectedCell.colId, file, targetCol.type);
                return;
              }
            }
          }
        }
      }
    };
    window.addEventListener('paste', handlePasteClipboardFile);
    return () => window.removeEventListener('paste', handlePasteClipboardFile);
  }, [selectedCell, canEdit, tracker.columns, tracker.isLocked, handleUploadFileToCell]);

  const handleCellClick = (rowId: string, pIdx: number, colId: string) => {
    setSelectedCell({ rowId, pIdx, colId });
  };

  const handleCellDoubleClick = (rowId: string, pIdx: number, colId: string, currentVal: any, colType: ColumnType) => {
    if (!canEdit) return;
    if (tracker.isLocked) {
      setLockNotice('🔒 Sheet is locked: Protected against accidental overwrite. Click Unlock in toolbar to edit.');
      return;
    }
    if (
      colType === 'day_sla' ||
      colType === 'legal_checklist' ||
      colType === 'data_drawer' ||
      colType === 'data_drawer_2'
    ) {
      return; // Handled by button clicks
    }

    // Direct upload / preview for image and PDF columns (avoids opening text input)
    if (colType === 'image' || colType === 'pdf') {
      const fileInfo = parseFileCell(currentVal, colType);
      const targetRow = tracker.rows.find((r) => r.id === rowId) || pagedRows[pIdx];
      const targetCol = tracker.columns.find((c) => c.id === colId);
      if (fileInfo && targetRow && targetCol) {
        openPreview(targetRow, targetCol, fileInfo);
      } else {
        triggerFileSelect(rowId, colId, colType);
      }
      return;
    }

    setEditingCell({ rowId, pIdx, colId });
    if (colType === 'date' || colType === 'sla_trigger_date' || colId === 'sla_trigger_date' || colId === 'target_on_air_date') {
      setEditingValue(normalizeToStandardDate(currentVal));
    } else if (colType === 'amount' || colType === 'number') {
      const numVal = parseNumericValue(currentVal);
      setEditingValue(numVal ? String(numVal) : '');
    } else {
      setEditingValue(currentVal !== undefined && currentVal !== null ? String(currentVal) : '');
    }
  };

  const handleCommitEdit = () => {
    if (!editingCell) return;
    pushHistory();

    const { rowId, colId } = editingCell;
    const col = tracker.columns.find((c) => c.id === colId);
    const updatedRows = tracker.rows.map((row) => {
      if (row.id !== rowId) return row;
      const targetRow = { ...row, values: { ...row.values } };

      if (colId === 'site_id') {
        const cleanVal = editingValue.trim() || row.siteId;
        targetRow.siteId = cleanVal;
        targetRow.values.site_id = cleanVal;
        if (targetRow.siteDetails) {
          targetRow.siteDetails.siteId = cleanVal;
        }
      } else if (col?.type === 'amount' || col?.type === 'number') {
        targetRow.values[colId] = parseNumericValue(editingValue);
      } else if (col?.type === 'percent') {
        targetRow.values[colId] = Math.min(100, Math.max(0, parseNumericValue(editingValue)));
      } else if (col?.type === 'date' || col?.type === 'sla_trigger_date' || colId === 'sla_trigger_date' || colId === 'target_on_air_date') {
        const cleanDate = normalizeToStandardDate(editingValue.trim());
        targetRow.values[colId] = cleanDate;
        
        // If updating SLA Trigger Date (Day 0 Start), recompute SLA milestones baseline
        if (col?.type === 'sla_trigger_date' || colId === 'sla_trigger_date') {
          if (targetRow.slaData) {
            const updatedMilestones = (targetRow.slaData.milestones || []).map((ms) => ({
              ...ms,
              targetDate: addDaysToDateString(cleanDate, ms.targetDaysFromTrigger),
            }));
            targetRow.slaData = {
              ...targetRow.slaData,
              triggerDate: cleanDate,
              earliestLogDate: targetRow.slaData.earliestLogDate || cleanDate,
              milestones: updatedMilestones,
            };
          }
        }

        if (colId === 'target_on_air_date' && targetRow.slaData?.milestones?.length > 0) {
          const msCopy = [...targetRow.slaData.milestones];
          msCopy[msCopy.length - 1] = {
            ...msCopy[msCopy.length - 1],
            targetDate: cleanDate,
          };
          targetRow.slaData = { ...targetRow.slaData, milestones: msCopy };
        }
      } else {
        targetRow.values[colId] = editingValue;
      }
      return targetRow;
    });

    onUpdateTracker({
      ...tracker,
      rows: updatedRows,
      updatedAt: new Date().toISOString(),
    });

    if (onUpdateRow) {
      const editedTarget = updatedRows.find((r) => r.id === rowId);
      if (editedTarget) {
        onUpdateRow(editedTarget);
      }
    }

    setEditingCell(null);
  };

  const handleAddRow = () => {
    if (!canEdit) return;
    if (tracker.isLocked) {
      setLockNotice('🔒 Cannot add row: Sheet is locked to prevent accidental overwrite. Click Unlock in toolbar.');
      return;
    }
    pushHistory();

    const timestamp = Date.now().toString();
    const todayStr = getLocalDateString();
    const newSiteId = `SITE-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const effSla = getEffectiveTrackerSlaConfig(tracker);
    const targetOnAirDate = addDaysToDateString(todayStr, effSla.targetDays);

    const newRow: TrackerRow = {
      id: 'row_' + timestamp,
      siteId: newSiteId,
      values: {
        site_id: newSiteId,
        site_name: 'New Identified Candidate Site',
        status: 'Site Hunting',
        daily_sla: 'View SLA Tracker',
        sla_trigger_date: todayStr,
        legal_checklist: 'Open Legal Checklist',
        data_button: 'Open Data',
        data_2_button: 'DATA 2',
        sla_health_col: 'On Track (0d rem.)',
        total_legal_budget: 150000,
        disbursed_legal_fees: 0,
        pic_handler: 'SAQCivil Team',
        tower_type: 'Rooftop Monopole',
        target_on_air_date: targetOnAirDate,
        completion_pct: 0,
      },
      siteDetails: {
        siteId: newSiteId,
        siteName: 'New Identified Candidate Site',
        region: 'NCR / Metro Manila',
        province: 'Metro Manila',
        exactAddress: 'Metro Manila Site Location',
        landlordName: 'Pending Negotiation',
        landlordContact: '09XX-XXX-XXXX',
        towerHeight: '30m Monopole',
        coordinates: { lat: 14.5995, lng: 120.9842 },
        picHandler: 'SAQCivil Team',
        contractor: 'Apex Civil',
        notes: 'Initial SAQ dossier under technical evaluation.',
      },
      slaData: {
        triggerDate: todayStr,
        targetDays: effSla.targetDays,
        slaScopeName: effSla.scopeName,
        scopeType: effSla.scopeType,
        earliestLogDate: todayStr,
        currentStatus: 'Site Hunting',
        slaHealth: 'on_track',
        lastMovementDate: todayStr,
        isNoMovement14Days: false,
        delayDays: 0,
        priority: 'NORMAL',
        milestones: createMilestonesFromTemplate(effSla.milestones, todayStr, targetOnAirDate),
        history: [],
      },
      legalChecklist: [
        {
          id: 'chk_' + timestamp + '_1',
          requirement: 'Lessor Notarized Lease Agreement',
          category: 'Legal',
          status: 'In Progress',
          amount: 35000,
          assignedStaff: 'SAQCivil Team',
          submissionDate: todayStr,
          sopRef: 'SOP-LEG-02',
        },
        {
          id: 'chk_' + timestamp + '_2',
          requirement: 'Zoning Locational Clearance Certificate',
          category: 'Permit',
          status: 'Pending',
          amount: 25000,
          assignedStaff: 'SAQCivil Team',
          submissionDate: todayStr,
          sopRef: 'SOP-ZON-01',
        },
        {
          id: 'chk_' + timestamp + '_3',
          requirement: 'Barangay Council Resolution of No Objection',
          category: 'Social',
          status: 'Pending',
          amount: 15000,
          assignedStaff: 'SAQCivil Team',
          submissionDate: todayStr,
          sopRef: 'SOP-SOC-04',
        },
        {
          id: 'chk_' + timestamp + '_4',
          requirement: 'CAAP Height Clearance Permit Evaluation',
          category: 'Clearance',
          status: 'Pending',
          amount: 45000,
          assignedStaff: 'SAQCivil Team',
          submissionDate: todayStr,
          sopRef: 'SOP-CAAP-09',
        },
        {
          id: 'chk_' + timestamp + '_5',
          requirement: 'Building Permit Application & Blueprint Endorsement',
          category: 'Permit',
          status: 'Pending',
          amount: 30000,
          assignedStaff: 'SAQCivil Team',
          submissionDate: todayStr,
          sopRef: 'SOP-ENG-03',
        },
      ],
      documents: [],
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    onUpdateTracker({
      ...tracker,
      rows: [newRow, ...tracker.rows],
      updatedAt: new Date().toISOString(),
    });

    setCurrentPage(1);
    setSelectedCell({ rowId: newRow.id, pIdx: 0, colId: 'site_id' });
  };

  const handleDeleteRow = (targetRowOrId: string | TrackerRow) => {
    if (!canEdit) return;
    if (tracker.isLocked) {
      setLockNotice('🔒 Cannot delete row: Sheet is locked to prevent accidental overwrite. Click Unlock in toolbar.');
      return;
    }
    pushHistory();

    const targetRowId = typeof targetRowOrId === 'string' ? targetRowOrId : targetRowOrId.id;
    const targetSiteId = typeof targetRowOrId === 'object' && targetRowOrId ? targetRowOrId.siteId : undefined;

    const target = tracker.rows.find(
      (r) =>
        r === targetRowOrId ||
        String(r.id) === String(targetRowId) ||
        (targetSiteId && String(r.siteId) === String(targetSiteId))
    );

    const updated = tracker.rows.filter(
      (r) =>
        r !== targetRowOrId &&
        String(r.id) !== String(targetRowId) &&
        (!targetSiteId || String(r.siteId) !== String(targetSiteId))
    );

    onUpdateTracker({
      ...tracker,
      rows: updated,
      updatedAt: new Date().toISOString(),
    });

    setRowToDelete(null);

    if (selectedCell && (selectedCell.rowId === targetRowId || target?.id === selectedCell.rowId)) {
      setSelectedCell(null);
    }

    if (target) {
      setDeletedToastRow(target);
    }

    if ((currentPage - 1) * pageSize >= updated.length && currentPage > 1) {
      setCurrentPage((prev) => Math.max(1, prev - 1));
    }
  };

  const isFiltered = Boolean(gridSearch.trim() || Object.values(filterValues).some((v) => v.trim()));

  const handleDeleteAllRows = () => {
    if (!canEdit) return;
    if (tracker.isLocked) {
      setLockNotice('🔒 Cannot delete rows: Sheet is locked to prevent accidental overwrite. Click Unlock in toolbar.');
      setIsDeleteAllModalOpen(false);
      return;
    }

    if (!tracker.rows || tracker.rows.length === 0) {
      setIsDeleteAllModalOpen(false);
      return;
    }

    pushHistory();

    let rowsToDelete: TrackerRow[] = [];
    let remainingRows: TrackerRow[] = [];

    if (deleteAllOption === 'filtered' && isFiltered) {
      const processedIds = new Set(processedRows.map((r) => r.id));
      rowsToDelete = tracker.rows.filter((r) => processedIds.has(r.id));
      remainingRows = tracker.rows.filter((r) => !processedIds.has(r.id));
    } else {
      rowsToDelete = [...tracker.rows];
      remainingRows = [];
    }

    onUpdateTracker({
      ...tracker,
      rows: remainingRows,
      updatedAt: new Date().toISOString(),
    });

    setIsDeleteAllModalOpen(false);
    setSelectedCell(null);
    setEditingCell(null);
    setCurrentPage(1);

    if (rowsToDelete.length > 0) {
      setDeletedBatchToast({
        count: rowsToDelete.length,
        rows: rowsToDelete,
      });
    }
  };

  // Helper to parse spreadsheet rows and generate columns dynamically with 100% quantity accuracy
  const parseSpreadsheetData = (
    rawData: any[][],
    hasHeaderRow: boolean,
    skipBlankRows: boolean,
    existingCols: ColumnDefinition[],
    specifiedHeaderRowIdx?: number
  ) => {
    if (!rawData || rawData.length === 0) {
      return {
        headers: [],
        dataRows: [],
        allColumns: existingCols,
        colMapping: {} as Record<number, ColumnDefinition>,
        blankRowCount: 0,
        detectedHeaderRowIdx: 0,
        siteIdColIdx: undefined as string | undefined,
        siteNameColIdx: undefined as string | undefined,
      };
    }

    // Trim trailing completely empty rows from the end of the sheet to avoid phantom spreadsheet padding
    let workingRaw = [...rawData];
    while (
      workingRaw.length > 0 &&
      (!Array.isArray(workingRaw[workingRaw.length - 1]) ||
        workingRaw[workingRaw.length - 1].length === 0 ||
        !workingRaw[workingRaw.length - 1].some((c) => c !== undefined && c !== null && String(c).trim() !== ''))
    ) {
      workingRaw.pop();
    }

    if (workingRaw.length === 0) workingRaw = rawData;

    let blankCount = 0;
    let headers: string[] = [];
    let candidateDataRows: any[][] = [];
    let detectedHeaderRowIdx = 0;

    if (hasHeaderRow) {
      if (specifiedHeaderRowIdx !== undefined && specifiedHeaderRowIdx >= 0) {
        detectedHeaderRowIdx = Math.min(specifiedHeaderRowIdx, workingRaw.length - 1);
      } else {
        // Smart Header Scoring across the first 15 rows
        // Prevents picking title banners (Row 0: "COMPANY TRACKER 2026") as headers!
        const maxColsInPreview = Math.max(
          ...workingRaw.slice(0, 20).map((r) =>
            Array.isArray(r)
              ? r.filter((c) => c !== undefined && c !== null && String(c).trim() !== '').length
              : 0
          ),
          1
        );

        const headerKeywords = [
          'id', 'site', 'code', 'cal', 'name', 'status', 'stage', 'phase', 'region',
          'area', 'cluster', 'province', 'city', 'address', 'location', 'pic', 'handler',
          'staff', 'contractor', 'vendor', 'tower', 'height', 'type', 'date', 'trigger',
          'target', 'sla', 'amount', 'budget', 'fee', 'cost', 'price', 'paid', 'disburs',
          'liquidat', 'req', 'app', 'legal', 'checklist', 'remark', 'remarks', 'notes',
          'lat', 'lng', 'coord', 'scope', 'target', 'candidate', 'scope', 'turnover'
        ];

        let bestScore = -99999;
        let bestIdx = 0;

        for (let r = 0; r < Math.min(15, workingRaw.length); r++) {
          const row = workingRaw[r];
          if (!Array.isArray(row)) continue;
          const populated = row.filter((c) => c !== undefined && c !== null && String(c).trim() !== '');
          const popCount = populated.length;
          if (popCount === 0) continue;

          let score = 0;
          // Severe penalty for 1-cell rows when the table has multiple columns (title banners)
          if (popCount <= 1 && maxColsInPreview > 2) {
            score -= 500;
          } else {
            score += (popCount / maxColsInPreview) * 50;
          }

          let numCount = 0;
          let keywordMatches = 0;
          let stringCount = 0;

          for (const cell of populated) {
            if (typeof cell === 'number') {
              numCount++;
            } else {
              const str = String(cell).toLowerCase().trim();
              stringCount++;
              if (headerKeywords.some((k) => str.includes(k))) {
                keywordMatches++;
              }
            }
          }

          score += keywordMatches * 25;
          score += stringCount * 3;
          score -= numCount * 15;

          if (score > bestScore) {
            bestScore = score;
            bestIdx = r;
          }
        }

        detectedHeaderRowIdx = bestIdx;
      }

      headers = (workingRaw[detectedHeaderRowIdx] || []).map((h, i) => {
        const s = String(h ?? '').trim();
        return s || `Column ${i + 1}`;
      });
      candidateDataRows = workingRaw.slice(detectedHeaderRowIdx + 1);
    } else {
      // No header row: row 0 is already a data row!
      const maxCols = Math.max(...workingRaw.map((r) => (Array.isArray(r) ? r.length : 0)), 1);
      headers = Array.from({ length: maxCols }, (_, i) => {
        if (existingCols[i]?.label) return existingCols[i].label;
        return `Column ${i + 1}`;
      });
      candidateDataRows = workingRaw;
    }

    const finalDataRows: any[][] = [];
    for (let rIdx = 0; rIdx < candidateDataRows.length; rIdx++) {
      const r = candidateDataRows[rIdx];
      if (!Array.isArray(r) || r.length === 0) {
        blankCount++;
        if (!skipBlankRows) finalDataRows.push([]);
        continue;
      }
      const hasContent = r.some((c) => c !== undefined && c !== null && String(c).trim() !== '');
      if (!hasContent) {
        blankCount++;
        if (!skipBlankRows) finalDataRows.push(r);
        continue;
      }
      finalDataRows.push(r);
    }

    const simplifyHeader = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const colMapping: Record<number, ColumnDefinition> = {};
    const usedColIds = new Set<string>();
    const newColumnsToAdd: ColumnDefinition[] = [];

    headers.forEach((h, hIdx) => {
      if (!h) return;
      const hSimple = simplifyHeader(h);

      // 1. Exact match by label
      let matched = existingCols.find((c) => !usedColIds.has(c.id) && c.label.toLowerCase().trim() === h.toLowerCase().trim());

      // 2. Simplified label match
      if (!matched && hSimple) {
        matched = existingCols.find((c) => !usedColIds.has(c.id) && simplifyHeader(c.label) === hSimple);
      }

      // 3. Simplified ID match
      if (!matched && hSimple) {
        matched = existingCols.find((c) => !usedColIds.has(c.id) && simplifyHeader(c.id) === hSimple);
      }

      // 4. Standard Telecom & Generic Tracker Domain synonyms
      if (!matched && hSimple) {
        if (hSimple === 'siteid' || hSimple === 'sitecode' || hSimple === 'siteidcode' || hSimple === 'candidateid' || hSimple === 'candidatecode') {
          matched = existingCols.find((c) => !usedColIds.has(c.id) && (c.type === 'site_id' || c.id === 'site_id'));
        } else if (hSimple === 'sitename' || hSimple === 'candidatename' || hSimple === 'nameofsite' || hSimple === 'calno' || hSimple === 'cal') {
          matched = existingCols.find((c) => !usedColIds.has(c.id) && (c.id === 'site_name' || simplifyHeader(c.label).includes('sitename')));
        } else if (hSimple === 'status' || hSimple === 'sitestatus' || hSimple === 'stage' || hSimple === 'projectstatus') {
          matched = existingCols.find((c) => !usedColIds.has(c.id) && (c.type === 'status' || c.id === 'status'));
        } else if (hSimple === 'region' || hSimple === 'area' || hSimple === 'cluster') {
          matched = existingCols.find((c) => !usedColIds.has(c.id) && (c.id === 'region' || simplifyHeader(c.label) === 'region'));
        } else if (hSimple === 'province' || hSimple === 'city') {
          matched = existingCols.find((c) => !usedColIds.has(c.id) && (c.id === 'province' || simplifyHeader(c.label) === 'province'));
        } else if (hSimple.includes('address') || hSimple.includes('exactaddress') || hSimple.includes('sitelocation')) {
          matched = existingCols.find((c) => !usedColIds.has(c.id) && (c.id === 'exact_address' || simplifyHeader(c.label).includes('address')));
        } else if (hSimple.includes('pichandler') || hSimple === 'pic' || hSimple.includes('assignedstaff') || hSimple === 'handler' || hSimple === 'coordinator') {
          matched = existingCols.find((c) => !usedColIds.has(c.id) && (c.id === 'pic_handler' || simplifyHeader(c.label).includes('pichandler')));
        } else if (hSimple.includes('contractor') || hSimple.includes('vendor') || hSimple.includes('supplier')) {
          matched = existingCols.find((c) => !usedColIds.has(c.id) && (c.id === 'contractor' || simplifyHeader(c.label).includes('contractor')));
        } else if (hSimple.includes('towerheight') || hSimple === 'height' || hSimple.includes('structureheight')) {
          matched = existingCols.find((c) => !usedColIds.has(c.id) && (c.id === 'tower_height' || simplifyHeader(c.label).includes('towerheight')));
        } else if (hSimple.includes('towertype') || hSimple.includes('structuretype')) {
          matched = existingCols.find((c) => !usedColIds.has(c.id) && (c.id === 'tower_type' || simplifyHeader(c.label).includes('towertype')));
        } else if (hSimple.includes('triggerdate') || hSimple.includes('slatrigger') || hSimple === 'startdate' || hSimple === 'day0') {
          matched = existingCols.find((c) => !usedColIds.has(c.id) && (c.type === 'sla_trigger_date' || c.id === 'sla_trigger_date'));
        } else if (hSimple.includes('targetonair') || hSimple.includes('onairdate') || hSimple.includes('targetdate') || hSimple.includes('targetcompletion')) {
          matched = existingCols.find((c) => !usedColIds.has(c.id) && (c.id === 'target_on_air_date' || simplifyHeader(c.label).includes('targetonair')));
        } else if (hSimple.includes('disbursed') || hSimple.includes('approvedamount')) {
          matched = existingCols.find((c) => !usedColIds.has(c.id) && (c.id === 'disbursed_legal_fees' || simplifyHeader(c.label).includes('disbursed')));
        } else if (hSimple.includes('totallegalbudget') || hSimple.includes('legalbudget') || hSimple.includes('statutorybudget')) {
          matched = existingCols.find((c) => !usedColIds.has(c.id) && (c.id === 'total_legal_budget' || c.type === 'legal_checklist'));
        } else if (hSimple.includes('remark') || hSimple.includes('notes') || hSimple.includes('comment') || hSimple.includes('actionplan')) {
          matched = existingCols.find((c) => !usedColIds.has(c.id) && (c.id === 'remarks' || simplifyHeader(c.label).includes('remark')));
        }
      }

      if (matched) {
        if (hSimple.includes('date') && matched.type === 'amount') {
          matched = { ...matched, type: 'date', summaryType: 'none' };
        } else if ((hSimple.includes('amount') || hSimple.includes('price') || hSimple.includes('cost')) && matched.type !== 'amount') {
          matched = { ...matched, type: 'amount', summaryType: 'sum' };
        }
      }

      // Dynamic column creation: if not matched, create new column with exact label
      if (!matched) {
        let detectedType: ColumnType = 'text';
        let detectedSummary: 'sum' | 'avg' | 'count' | 'none' = 'none';

        const isDateHeader =
          hSimple.includes('date') ||
          hSimple.includes('deadline') ||
          hSimple.includes('schedule') ||
          hSimple.includes('turnover') ||
          hSimple.includes('acceptance') ||
          hSimple.includes('dateliquidated');

        const isAmountHeader =
          !isDateHeader &&
          (hSimple.includes('amount') ||
            hSimple.includes('fee') ||
            hSimple.includes('budget') ||
            hSimple.includes('cost') ||
            hSimple.includes('price') ||
            hSimple.includes('disbursed') ||
            hSimple.includes('paid') ||
            hSimple.includes('balance') ||
            hSimple.includes('expense') ||
            hSimple.includes('php') ||
            (hSimple.includes('liquidat') && !hSimple.includes('date')) ||
            hSimple === 'total');

        if (isDateHeader) {
          detectedType = 'date';
          detectedSummary = 'none';
        } else if (isAmountHeader) {
          detectedType = 'amount';
          detectedSummary = 'sum';
        } else if (hSimple.includes('pct') || hSimple.includes('percent') || hSimple.includes('rate') || hSimple.includes('%')) {
          detectedType = 'percent';
          detectedSummary = 'avg';
        } else {
          // Inspect sample data rows for numeric/amount content
          let numericCount = 0;
          let sampleTotal = 0;
          for (let sampleIdx = 0; sampleIdx < Math.min(finalDataRows.length, 25); sampleIdx++) {
            const cellVal = finalDataRows[sampleIdx]?.[hIdx];
            if (cellVal !== undefined && cellVal !== null && String(cellVal).trim() !== '') {
              sampleTotal++;
              const cleanStr = String(cellVal).trim().replace(/[₱$,\s]/g, '');
              if (!isNaN(Number(cleanStr)) && cleanStr !== '') {
                numericCount++;
              }
            }
          }
          if (sampleTotal >= 2 && numericCount / sampleTotal >= 0.7) {
            detectedType = 'amount';
            detectedSummary = 'sum';
          }
        }

        const newColId = 'col_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6) + '_' + hIdx;
        const createdCol: ColumnDefinition = {
          id: newColId,
          label: h,
          type: detectedType,
          width: Math.max(140, Math.min(280, h.length * 10 + 40)),
          visible: true,
          isCustom: true,
          summaryType: detectedSummary,
          editable: true,
        };
        matched = createdCol;
        newColumnsToAdd.push(createdCol);
      }

      if (matched) {
        colMapping[hIdx] = matched;
        usedColIds.add(matched.id);
      }
    });

    const updatedColumns = [...existingCols, ...newColumnsToAdd];

    // Accurate Site ID Column Detection: NEVER match row numbers (#, No.) as Site ID!
    let siteIdColIdx = Object.keys(colMapping).find((k) => colMapping[Number(k)].type === 'site_id');
    if (siteIdColIdx === undefined) {
      siteIdColIdx = Object.keys(colMapping).find((k) => {
        const col = colMapping[Number(k)];
        const s = simplifyHeader(col.label);
        return s.includes('siteid') || s.includes('sitecode') || s.includes('candidateid');
      });
    }
    if (siteIdColIdx === undefined) {
      siteIdColIdx = Object.keys(colMapping).find((k) => {
        const col = colMapping[Number(k)];
        const s = simplifyHeader(col.label);
        return s.includes('calno') || s.includes('sitename') || s === 'site';
      });
    }
    if (siteIdColIdx === undefined && headers.length > 0) {
      const firstHeaderSimple = simplifyHeader(headers[0]);
      const isSequenceHeader = ['no', 'num', 'number', 'item', 'itemno', 'row', 'rowno', 'index', ''].includes(firstHeaderSimple);
      if (!isSequenceHeader) {
        siteIdColIdx = '0';
      } else if (headers.length > 1) {
        siteIdColIdx = '1';
      } else {
        siteIdColIdx = '0';
      }
    }

    const siteNameColIdx = Object.keys(colMapping).find((k) => {
      const col = colMapping[Number(k)];
      const s = simplifyHeader(col.label);
      return col.id === 'site_name' || s.includes('sitename') || s.includes('calno') || s === 'name';
    });

    return {
      headers,
      dataRows: finalDataRows,
      allColumns: updatedColumns,
      colMapping,
      blankRowCount: blankCount,
      detectedHeaderRowIdx,
      siteIdColIdx,
      siteNameColIdx,
    };
  };

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      if (e.target) e.target.value = '';
      return;
    }

    if (!canEdit) {
      setLockNotice('🔒 Editing permission required to import Excel data. Please switch to an Administrator or Assigned Handler account.');
      if (e.target) e.target.value = '';
      return;
    }

    try {
      setLockNotice(`⏳ Reading spreadsheet "${file.name}"... Please wait.`);

      const workbookResult = await readExcelWorkbook(file);
      if (!workbookResult || workbookResult.sheetNames.length === 0 || workbookResult.rows.length === 0) {
        setLockNotice('⚠️ Spreadsheet appears completely empty.');
        if (e.target) e.target.value = '';
        return;
      }

      const rawData = workbookResult.rows;
      const hasHeaderRow = rawData.length > 1;
      const skipBlankRows = false;

      const parsed = parseSpreadsheetData(rawData, hasHeaderRow, skipBlankRows, tracker.columns);

      setPendingImport({
        fileName: file.name,
        rawData,
        totalFileRows: rawData.length,
        hasHeaderRow,
        headerRowIndex: parsed.detectedHeaderRowIdx,
        detectedHeaderRowIndex: parsed.detectedHeaderRowIdx,
        skipBlankRows,
        headers: parsed.headers,
        dataRows: parsed.dataRows,
        blankRowCount: parsed.blankRowCount,
        allColumns: parsed.allColumns,
        colMapping: parsed.colMapping,
        siteIdColIdx: parsed.siteIdColIdx,
        siteNameColIdx: parsed.siteNameColIdx,
        workbookResult,
        activeSheetName: workbookResult.activeSheetName,
      });
      setImportMode('replace'); // Default to Replace so tracker row count matches spreadsheet 1:1!
      setLockNotice(null);
    } catch (err) {
      console.error('Import error:', err);
      setLockNotice('❌ Failed to read Excel file. Please ensure it is a valid .xlsx, .xls, or .csv format.');
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  const handleSwitchImportSheet = (sheetName: string) => {
    if (!pendingImport || !pendingImport.workbookResult || !pendingImport.workbookResult.sheets[sheetName]) return;
    const newRaw = pendingImport.workbookResult.sheets[sheetName].rows;
    const parsed = parseSpreadsheetData(
      newRaw,
      pendingImport.hasHeaderRow,
      pendingImport.skipBlankRows,
      tracker.columns
    );
    setPendingImport({
      ...pendingImport,
      rawData: newRaw,
      totalFileRows: newRaw.length,
      activeSheetName: sheetName,
      headerRowIndex: parsed.detectedHeaderRowIdx,
      detectedHeaderRowIndex: parsed.detectedHeaderRowIdx,
      headers: parsed.headers,
      dataRows: parsed.dataRows,
      blankRowCount: parsed.blankRowCount,
      allColumns: parsed.allColumns,
      colMapping: parsed.colMapping,
      siteIdColIdx: parsed.siteIdColIdx,
      siteNameColIdx: parsed.siteNameColIdx,
    });
  };

  const handleChangeHeaderRowIndex = (newIdx: number) => {
    if (!pendingImport) return;
    const parsed = parseSpreadsheetData(
      pendingImport.rawData,
      true,
      pendingImport.skipBlankRows,
      tracker.columns,
      newIdx
    );
    setPendingImport({
      ...pendingImport,
      hasHeaderRow: true,
      headerRowIndex: newIdx,
      headers: parsed.headers,
      dataRows: parsed.dataRows,
      blankRowCount: parsed.blankRowCount,
      allColumns: parsed.allColumns,
      colMapping: parsed.colMapping,
      siteIdColIdx: parsed.siteIdColIdx,
      siteNameColIdx: parsed.siteNameColIdx,
    });
  };

  const handleToggleImportHeader = (hasHeader: boolean) => {
    if (!pendingImport) return;
    const parsed = parseSpreadsheetData(
      pendingImport.rawData,
      hasHeader,
      pendingImport.skipBlankRows,
      tracker.columns,
      hasHeader ? pendingImport.headerRowIndex : undefined
    );
    setPendingImport({
      ...pendingImport,
      hasHeaderRow: hasHeader,
      headers: parsed.headers,
      dataRows: parsed.dataRows,
      blankRowCount: parsed.blankRowCount,
      allColumns: parsed.allColumns,
      colMapping: parsed.colMapping,
      siteIdColIdx: parsed.siteIdColIdx,
      siteNameColIdx: parsed.siteNameColIdx,
    });
  };

  const handleToggleImportSkipBlank = (skipBlank: boolean) => {
    if (!pendingImport) return;
    const parsed = parseSpreadsheetData(
      pendingImport.rawData,
      pendingImport.hasHeaderRow,
      skipBlank,
      tracker.columns,
      pendingImport.hasHeaderRow ? pendingImport.headerRowIndex : undefined
    );
    setPendingImport({
      ...pendingImport,
      skipBlankRows: skipBlank,
      headers: parsed.headers,
      dataRows: parsed.dataRows,
      blankRowCount: parsed.blankRowCount,
      allColumns: parsed.allColumns,
      colMapping: parsed.colMapping,
      siteIdColIdx: parsed.siteIdColIdx,
      siteNameColIdx: parsed.siteNameColIdx,
    });
  };

  // Execute the import once confirmed by the user in the modal
  const handleExecuteImport = () => {
    if (!pendingImport) return;

    pushHistory();
    const { headers, dataRows, allColumns, colMapping, siteIdColIdx, siteNameColIdx } = pendingImport;
    const timestamp = Date.now();

    // Map EVERY SINGLE ROW in dataRows to a distinct TrackerRow 1:1
    // No collapsing, no overwriting rows with duplicate names
    const importedRows: TrackerRow[] = dataRows.map((r, idx) => {
      let rawSiteId = siteIdColIdx !== undefined && r[Number(siteIdColIdx)] !== undefined
        ? String(r[Number(siteIdColIdx)]).trim()
        : '';
      const rawSiteName = siteNameColIdx !== undefined && r[Number(siteNameColIdx)] !== undefined
        ? String(r[Number(siteNameColIdx)]).trim()
        : '';

      // If rawSiteId is pure number like "1", "2" and site name is descriptive, prioritize site name
      if (/^\d+$/.test(rawSiteId) && rawSiteName && !/^\d+$/.test(rawSiteName)) {
        rawSiteId = rawSiteName;
      }

      const effectiveSiteId = rawSiteId || rawSiteName || (r[0] !== undefined && String(r[0]).trim()) || `SITE-${String(idx + 1).padStart(3, '0')}`;

      const rowValues: Record<string, any> = {
        site_id: effectiveSiteId,
      };

      for (let cIdx = 0; cIdx < headers.length; cIdx++) {
        const col = colMapping[cIdx];
        if (!col || r[cIdx] === undefined || r[cIdx] === null) continue;
        const rawCell = r[cIdx];

        const isAmount =
          col.type === 'amount' ||
          col.type === 'number' ||
          col.summaryType === 'sum' ||
          col.summaryType === 'avg';

        const isDate =
          col.type === 'date' ||
          col.type === 'sla_trigger_date';

        if (isAmount) {
          const strVal = String(rawCell).trim();
          if (strVal === '' || strVal === '-' || strVal.toLowerCase() === 'n/a' || strVal.toLowerCase() === 'null') {
            rowValues[col.id] = '';
          } else {
            rowValues[col.id] = parseNumericValue(rawCell);
          }
        } else if (isDate) {
          const strVal = String(rawCell).trim();
          if (strVal === '' || strVal === '-' || strVal.toLowerCase() === 'n/a' || strVal.toLowerCase() === 'null') {
            rowValues[col.id] = '';
          } else {
            rowValues[col.id] = normalizeToStandardDate(rawCell);
          }
        } else if (col.type === 'legal_checklist') {
          const parsedAmt = parseNumericValue(rawCell);
          rowValues[col.id] = parsedAmt > 0 ? formatCurrencyPHP(parsedAmt) : (typeof rawCell === 'string' ? rawCell.trim() : rawCell);
        } else if (col.type === 'site_id') {
          rowValues[col.id] = effectiveSiteId;
        } else {
          rowValues[col.id] = typeof rawCell === 'string' ? rawCell.trim() : rawCell;
        }
      }

      if (!rowValues.site_id) rowValues.site_id = effectiveSiteId;
      if (!rowValues.site_name && rawSiteName) rowValues.site_name = rawSiteName;

      const effSla = getEffectiveTrackerSlaConfig(tracker);
      const rowId = 'imp_' + timestamp + '_' + idx;
      const cleanTriggerDate = normalizeToStandardDate(rowValues.sla_trigger_date) || getLocalDateString();
      const cleanTarget = normalizeToStandardDate(rowValues.target_on_air_date) || addDaysToDateString(cleanTriggerDate, effSla.targetDays);
      const milestones = createMilestonesFromTemplate(effSla.milestones, cleanTriggerDate, cleanTarget);
      const currentStatus = rowValues.status || 'Active';

      const evaluated = evaluateSlaStatus(
        cleanTriggerDate,
        cleanTriggerDate,
        milestones,
        currentStatus,
        effSla.targetDays
      );

      rowValues.sla_trigger_date = cleanTriggerDate;
      rowValues.sla_health_col = evaluated.healthLabel;

      return {
        id: rowId,
        siteId: effectiveSiteId,
        values: rowValues,
        siteDetails: {
          siteId: effectiveSiteId,
          siteName: rowValues.site_name || effectiveSiteId,
          region: rowValues.region || 'NCR / Metro Manila',
          province: rowValues.province || 'Metro Manila',
          exactAddress: rowValues.exact_address || '',
          landlordName: rowValues.landlord_name || 'Lessor / Owner',
          landlordContact: rowValues.landlord_contact || 'N/A',
          towerHeight: rowValues.tower_height || '',
          coordinates: { lat: 14.5995, lng: 120.9842 },
          picHandler: rowValues.pic_handler || 'SAQCivil Team',
          contractor: rowValues.contractor || '',
          notes: rowValues.remarks || 'Imported from spreadsheet.',
        },
        slaData: {
          triggerDate: cleanTriggerDate,
          targetDays: effSla.targetDays,
          slaScopeName: effSla.scopeName,
          scopeType: effSla.scopeType,
          earliestLogDate: cleanTriggerDate,
          currentStatus: currentStatus,
          slaHealth: evaluated.health,
          lastMovementDate: cleanTriggerDate,
          isNoMovement14Days: evaluated.isNoMovement14Days,
          delayDays: evaluated.delayDays,
          priority: evaluated.priority,
          milestones,
          history: [],
        },
        legalChecklist: [],
        documents: [],
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
    });

    let finalRows: TrackerRow[] = [];
    if (importMode === 'replace') {
      finalRows = importedRows;
    } else {
      const existing = tracker.rows.filter((r) => r && r.siteId !== 'SUMMARY' && r.values?.site_id !== 'SUMMARY');
      finalRows = [...existing, ...importedRows];
    }

    // Reset filters and search so user immediately sees all imported rows without filter hiding
    setGridSearch('');
    setFilterValues({});
    setCurrentPage(1);
    if (finalRows.length > 0 && finalRows.length <= 500) {
      setPageSize(finalRows.length);
    } else if (pageSize < 50) {
      setPageSize(50);
    }

    const updatedTracker: Tracker = {
      ...tracker,
      isLocked: false,
      columns: allColumns,
      rows: finalRows,
      updatedAt: new Date().toISOString(),
    };

    onUpdateTracker(updatedTracker);

    // Save directly to server backend
    fetch('/api/trackers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tracker: updatedTracker }),
    }).catch((err) => console.warn('Server auto-persist error:', err));

    setLockNotice(
      `✅ Excel Import Complete: Successfully imported all ${importedRows.length} rows (${finalRows.length} total rows now visible in grid) across ${allColumns.length} columns, matching your spreadsheet 1:1!`
    );
    setPendingImport(null);
  };

  const handleStandardizeAllDates = () => {
    if (!canEdit) return;
    if (tracker.isLocked) {
      setLockNotice('🔒 Cannot modify dates: Sheet is locked to prevent accidental overwrite.');
      return;
    }
    pushHistory();
    let standardizedCount = 0;

    const updatedRows = tracker.rows.map((row) => {
      const updatedValues = { ...row.values };

      tracker.columns.forEach((col) => {
        const val = updatedValues[col.id];
        const isDateCol =
          col.type === 'date' ||
          col.type === 'sla_trigger_date' ||
          col.id === 'sla_trigger_date' ||
          col.id === 'target_on_air_date' ||
          col.id.toLowerCase().includes('date') ||
          col.label.toLowerCase().includes('date');

        if (isDateCol && val !== undefined && val !== null && String(val).trim() !== '') {
          const standardized = normalizeToStandardDate(val);
          if (standardized && standardized !== val) {
            updatedValues[col.id] = standardized;
            standardizedCount++;
          }
        }
      });

      // Also ensure SLA trigger date and milestone dates are standardized
      let updatedSlaData = row.slaData;
      if (row.slaData) {
        const trig = normalizeToStandardDate(updatedValues.sla_trigger_date || row.slaData.triggerDate || getLocalDateString());
        const lastMove = normalizeToStandardDate(row.slaData.lastMovementDate || trig);
        const msList = (row.slaData.milestones || []).map((ms) => ({
          ...ms,
          targetDate: normalizeToStandardDate(ms.targetDate) || addDaysToDateString(trig, ms.targetDaysFromTrigger),
        }));

        const evaluated = evaluateSlaStatus(
          trig,
          lastMove,
          msList,
          updatedValues.status || row.values.status || row.slaData.currentStatus
        );
        updatedValues.sla_trigger_date = trig;
        updatedValues.sla_health_col = evaluated.healthLabel;
        if (updatedValues.target_on_air_date) {
          updatedValues.target_on_air_date = normalizeToStandardDate(updatedValues.target_on_air_date);
        }

        updatedSlaData = {
          ...row.slaData,
          triggerDate: trig,
          lastMovementDate: lastMove,
          milestones: msList,
          slaHealth: evaluated.health,
          delayDays: evaluated.delayDays,
          isNoMovement14Days: evaluated.isNoMovement14Days,
          priority: evaluated.priority,
        };
      }

      return {
        ...row,
        values: updatedValues,
        slaData: updatedSlaData,
      };
    });

    onUpdateTracker({
      ...tracker,
      rows: updatedRows,
      updatedAt: new Date().toISOString(),
    });

    alert(
      standardizedCount > 0
        ? `Successfully fixed and standardized ${standardizedCount} dates across ${tracker.rows.length} rows to standard ISO format (YYYY-MM-DD)!`
        : `All dates across ${tracker.rows.length} rows are already in standard format (YYYY-MM-DD)!`
    );
  };

  const frozenColsCount = Math.max(0, Math.min(tracker.frozenColumns !== undefined ? tracker.frozenColumns : 2, visibleCols.length));
  const frozenRowsCount = Math.max(0, Math.min(tracker.frozenRows !== undefined ? tracker.frozenRows : 0, pagedRows.length));

  // Cumulative left offsets for sticky columns (Row index # is 48px wide)
  const colLeftOffsets = useMemo(() => {
    const offsets: number[] = [];
    let currentLeft = 48;
    for (let i = 0; i < visibleCols.length; i++) {
      offsets.push(currentLeft);
      currentLeft += visibleCols[i].width;
    }
    return offsets;
  }, [visibleCols]);

  // Dynamic heights for sticky header and sticky rows
  const headerRowHeight = 36;
  const filterRowHeight = showFilterBar ? 33 : 0;
  const topSummaryHeight = showSummaryRow && (summaryPosition === 'top' || summaryPosition === 'both') ? 36 : 0;
  const topSummaryOffset = headerRowHeight + filterRowHeight;
  const headerTotalHeight = headerRowHeight + filterRowHeight + topSummaryHeight;
  const rowHeightPx = tracker.appearance?.rowDensity === 'compact' ? 32 : tracker.appearance?.rowDensity === 'comfortable' ? 44 : 36;

  // Freeze action handlers
  const handleSetFreeze = useCallback((cols: number, rows?: number) => {
    if (!canEdit) return;
    const newFrozenCols = Math.max(0, Math.min(cols, visibleCols.length));
    const newFrozenRows = rows !== undefined ? Math.max(0, Math.min(rows, 20)) : (tracker.frozenRows ?? 0);
    onUpdateTracker({
      ...tracker,
      frozenColumns: newFrozenCols,
      frozenRows: newFrozenRows,
      updatedAt: new Date().toISOString(),
    });
  }, [canEdit, visibleCols.length, tracker, onUpdateTracker]);

  const handleToggleColumnFreeze = useCallback((colIndex: number) => {
    if (!canEdit) return;
    const current = tracker.frozenColumns !== undefined ? tracker.frozenColumns : 2;
    const nextCols = current === colIndex + 1 ? colIndex : colIndex + 1;
    handleSetFreeze(nextCols, tracker.frozenRows ?? 0);
  }, [canEdit, tracker.frozenColumns, tracker.frozenRows, handleSetFreeze]);

  const handleToggleRowFreeze = useCallback((rowIndex: number) => {
    if (!canEdit) return;
    const current = tracker.frozenRows ?? 0;
    const nextRows = current === rowIndex + 1 ? rowIndex : rowIndex + 1;
    handleSetFreeze(tracker.frozenColumns !== undefined ? tracker.frozenColumns : 2, nextRows);
  }, [canEdit, tracker.frozenColumns, tracker.frozenRows, handleSetFreeze]);

  const handleFreezeUpToSelected = useCallback(() => {
    if (!selectedCell || !canEdit) return;
    const colIdx = visibleCols.findIndex((c) => c.id === selectedCell.colId);
    const rowIdx = selectedCell.pIdx;
    handleSetFreeze(colIdx !== -1 ? colIdx + 1 : 2, rowIdx >= 0 ? rowIdx + 1 : 0);
  }, [selectedCell, canEdit, visibleCols, handleSetFreeze]);

  const rowDensity = tracker.appearance?.rowDensity || 'normal';
  const gridFontSize = tracker.appearance?.fontSize || 'base';
  const headerTheme = tracker.appearance?.headerTheme || 'slate';
  const showGridlines = tracker.appearance?.showGridlines !== false;
  const zebraStripes = tracker.appearance?.zebraStripes ?? true;

  const rowPaddingClass =
    rowDensity === 'compact' ? 'py-1' : rowDensity === 'comfortable' ? 'py-2.5' : 'py-1.5';
  const fontSizeClass =
    gridFontSize === 'sm' ? 'text-[11px]' : gridFontSize === 'lg' ? 'text-sm' : 'text-xs';
  const headerThemeBgClass =
    headerTheme === 'navy'
      ? 'bg-blue-950 text-blue-100 border-blue-800'
      : headerTheme === 'indigo'
      ? 'bg-indigo-950 text-indigo-100 border-indigo-800'
      : headerTheme === 'emerald'
      ? 'bg-emerald-950 text-emerald-100 border-emerald-800'
      : headerTheme === 'amber'
      ? 'bg-amber-950 text-amber-100 border-amber-800'
      : 'bg-slate-950 text-slate-300 border-slate-800';

  return (
    <div className="flex-1 flex flex-col bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl text-slate-100">
      {/* Excel-Style Organized Ribbon Bar - Compact segmented button groups to lessen screen space */}
      <div className="px-3 py-1.5 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
        {/* Left Action Groups */}
        <div className="flex flex-wrap items-center gap-1.5">
          {canEdit && (
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-md p-0.5">
              {/* Prominent Save Changes Button */}
              {onSaveChanges && (
                <button
                  type="button"
                  onClick={onSaveChanges}
                  disabled={isSaving}
                  className={`px-2.5 py-1 rounded text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                    hasUnsavedChanges
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs'
                      : 'bg-slate-800 hover:bg-slate-750 text-slate-200'
                  }`}
                  title={`Save all edits & changes (Ctrl+S)${lastSavedTime ? ` · Last saved at ${lastSavedTime}` : ''}`}
                >
                  {isSaving ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-300" />
                  ) : hasUnsavedChanges ? (
                    <Save className="w-3.5 h-3.5 text-white" />
                  ) : (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  )}
                  <span>{isSaving ? 'Saving' : hasUnsavedChanges ? 'Save' : 'Saved'}</span>
                  {hasUnsavedChanges && unsavedCount > 0 && (
                    <span className="px-1 py-0.2 rounded-full bg-black/40 text-white text-[9px] font-mono font-bold">
                      {unsavedCount}
                    </span>
                  )}
                </button>
              )}

              {/* Add Row Button */}
              <button
                type="button"
                onClick={handleAddRow}
                className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-bold flex items-center gap-1 transition-colors"
                title="Add new row on top of the tracker"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Row</span>
              </button>

              {/* Undo Button */}
              <button
                type="button"
                onClick={handleUndo}
                disabled={historyStack.length === 0}
                className="px-2 py-1 hover:bg-slate-800 disabled:opacity-30 text-slate-400 hover:text-slate-200 rounded text-xs flex items-center gap-1 transition-colors"
                title="Undo last change (Ctrl+Z)"
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>

              {/* Selected Cell Delete */}
              {selectedCell && (
                <button
                  type="button"
                  onClick={() => {
                    const row = tracker.rows.find((r) => r.id === selectedCell.rowId) || pagedRows[selectedCell.pIdx];
                    if (row) handleDeleteRow(row);
                  }}
                  className="px-2 py-1 bg-rose-950/80 hover:bg-rose-900 text-rose-300 rounded text-xs font-semibold flex items-center gap-1 transition-colors"
                  title="Delete selected row (Instant delete · Undo available)"
                >
                  <Trash2 className="w-3 h-3 text-rose-400" />
                  <span>Del</span>
                </button>
              )}

              {/* Delete All Rows Toolbar Button */}
              {canEdit && tracker.rows.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setDeleteAllOption('all');
                    setIsDeleteAllModalOpen(true);
                  }}
                  className="px-2 py-1 bg-rose-950/60 hover:bg-rose-900 border border-rose-800/80 text-rose-300 hover:text-white rounded text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                  title={`Delete all rows (${tracker.rows.length} rows) · With safety confirmation and undo`}
                >
                  <Trash2 className="w-3 h-3 text-rose-400" />
                  <span>Delete All</span>
                  <span className="px-1 py-0.2 rounded bg-rose-900/80 text-[10px] font-mono text-rose-200">
                    {tracker.rows.length}
                  </span>
                </button>
              )}
            </div>
          )}

          {/* Excel Import & Export Group */}
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-md p-0.5">
            <button
              type="button"
              onClick={() => exportTrackerToExcel(tracker)}
              className="px-2.5 py-1 bg-emerald-950/50 hover:bg-emerald-900/50 text-emerald-300 rounded text-xs font-semibold flex items-center gap-1 transition-colors"
              title="Export true Excel .xlsx file"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>

            <label
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
              title="Import Excel spreadsheet (.xlsx, .xls, .csv)"
            >
              <Upload className="w-3.5 h-3.5 text-sky-400" />
              <span>Import</span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleExcelImport}
              />
            </label>
          </div>

          {/* View & Columns Customization Group */}
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-md p-0.5">
            {canEdit && (
              <button
                type="button"
                onClick={onOpenCustomizeColumns}
                className="px-2 py-1 hover:bg-slate-800 text-slate-300 rounded text-xs font-medium flex items-center gap-1 transition-colors"
                title="Customize columns, data types, order, and appearance"
              >
                <Sliders className="w-3.5 h-3.5 text-sky-400" />
                <span>Columns</span>
              </button>
            )}

            {/* Freeze Panes Toolbar Dropdown */}
            <div className="relative" ref={freezeMenuRef}>
              <button
                type="button"
                onClick={() => setIsFreezeMenuOpen(!isFreezeMenuOpen)}
                className={`px-2 py-1 rounded text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  frozenColsCount > 0 || frozenRowsCount > 0
                    ? 'bg-sky-950/80 text-sky-200 border border-sky-500/50 shadow-xs'
                    : 'hover:bg-slate-800 text-slate-400 hover:text-white'
                }`}
                title={`Freeze Panes: ${frozenColsCount} col(s), ${frozenRowsCount} row(s) frozen. Click to configure.`}
              >
                <Snowflake className={`w-3.5 h-3.5 ${frozenColsCount > 0 || frozenRowsCount > 0 ? 'text-sky-400' : 'text-slate-400'}`} />
                <span>Freeze</span>
                <span className="px-1.5 py-0.2 rounded bg-slate-900 border border-slate-700 font-mono text-[10px] text-sky-300">
                  {frozenColsCount}C · {frozenRowsCount}R
                </span>
                <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isFreezeMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Menu */}
              {isFreezeMenuOpen && (
                <div className="absolute left-0 top-full mt-1.5 w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-3 z-50 text-slate-200 space-y-3 animate-in fade-in duration-150">
                  {/* Dropdown Header */}
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <div className="flex items-center gap-1.5 font-bold text-xs text-white">
                      <Snowflake className="w-4 h-4 text-sky-400" />
                      <span>Freeze Panes Configuration</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsFreezeMenuOpen(false)}
                      className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Quick Presets */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                      Quick Presets
                    </span>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          handleSetFreeze(2, 1);
                          setIsFreezeMenuOpen(false);
                        }}
                        className={`p-2 rounded-lg border text-left text-xs transition-colors cursor-pointer ${
                          frozenColsCount === 2 && frozenRowsCount === 1
                            ? 'bg-sky-950 border-sky-500 text-white'
                            : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-800'
                        }`}
                      >
                        <div className="font-bold text-[11px] text-sky-300">Classic Panes</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">2 Cols + 1 Top Row</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          handleSetFreeze(1, 0);
                          setIsFreezeMenuOpen(false);
                        }}
                        className={`p-2 rounded-lg border text-left text-xs transition-colors cursor-pointer ${
                          frozenColsCount === 1 && frozenRowsCount === 0
                            ? 'bg-sky-950 border-sky-500 text-white'
                            : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-800'
                        }`}
                      >
                        <div className="font-bold text-[11px] text-amber-300">Site ID Only</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">1 Col + 0 Rows</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          handleSetFreeze(0, 1);
                          setIsFreezeMenuOpen(false);
                        }}
                        className={`p-2 rounded-lg border text-left text-xs transition-colors cursor-pointer ${
                          frozenColsCount === 0 && frozenRowsCount === 1
                            ? 'bg-sky-950 border-sky-500 text-white'
                            : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-800'
                        }`}
                      >
                        <div className="font-bold text-[11px] text-emerald-300">Top Row Only</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">0 Cols + 1 Row</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          handleSetFreeze(0, 0);
                          setIsFreezeMenuOpen(false);
                        }}
                        className={`p-2 rounded-lg border text-left text-xs transition-colors cursor-pointer ${
                          frozenColsCount === 0 && frozenRowsCount === 0
                            ? 'bg-rose-950/50 border-rose-500 text-rose-200'
                            : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:border-slate-700 hover:bg-slate-800'
                        }`}
                      >
                        <div className="font-bold text-[11px] text-rose-300">Unfreeze All</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">0 Cols + 0 Rows</div>
                      </button>
                    </div>
                  </div>

                  {/* Freeze Selected Option (if cell selected) */}
                  {selectedCell && (
                    <button
                      type="button"
                      onClick={() => {
                        handleFreezeUpToSelected();
                        setIsFreezeMenuOpen(false);
                      }}
                      className="w-full p-2 rounded-lg bg-indigo-950/80 hover:bg-indigo-900/90 border border-indigo-700/70 text-indigo-200 text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <Split className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span className="truncate">Freeze up to selected cell</span>
                      </div>
                      <span className="px-1.5 py-0.2 rounded bg-indigo-900 font-mono text-[10px] text-white">
                        Row #{selectedCell.pIdx + 1}
                      </span>
                    </button>
                  )}

                  {/* Freeze Columns Selector */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-800">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-300 flex items-center gap-1">
                        <Columns className="w-3 h-3 text-sky-400" />
                        <span>Freeze Columns:</span>
                      </span>
                      <span className="text-[11px] font-mono font-bold text-sky-400">
                        {frozenColsCount} {frozenColsCount === 1 ? 'col' : 'cols'}
                      </span>
                    </div>
                    <div className="grid grid-cols-6 gap-1">
                      {[0, 1, 2, 3, 4, 5].map((cnt) => (
                        <button
                          key={`fc_${cnt}`}
                          type="button"
                          onClick={() => handleSetFreeze(cnt, tracker.frozenRows ?? 0)}
                          className={`py-1 rounded text-xs font-bold border transition-all cursor-pointer ${
                            frozenColsCount === cnt
                              ? 'bg-sky-600 border-sky-400 text-white shadow-xs'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                          }`}
                        >
                          {cnt}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Freeze Rows Selector */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-800">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-300 flex items-center gap-1">
                        <Rows className="w-3 h-3 text-indigo-400" />
                        <span>Freeze Top Rows:</span>
                      </span>
                      <span className="text-[11px] font-mono font-bold text-indigo-400">
                        {frozenRowsCount} {frozenRowsCount === 1 ? 'row' : 'rows'}
                      </span>
                    </div>
                    <div className="grid grid-cols-5 gap-1">
                      {[0, 1, 2, 3, 5].map((cnt) => (
                        <button
                          key={`fr_${cnt}`}
                          type="button"
                          onClick={() => handleSetFreeze(tracker.frozenColumns !== undefined ? tracker.frozenColumns : 2, cnt)}
                          className={`py-1 rounded text-xs font-bold border transition-all cursor-pointer ${
                            frozenRowsCount === cnt
                              ? 'bg-indigo-600 border-indigo-400 text-white shadow-xs'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                          }`}
                        >
                          {cnt}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Help Note */}
                  <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                    <span>Blue divider line indicates the frozen pane boundary.</span>
                  </div>
                </div>
              )}
            </div>

            {onOpenProjectSlaModal && (
              (tracker.enableSla !== false && tracker.slaConfig?.enabled !== false) ? (
                <button
                  type="button"
                  onClick={onOpenProjectSlaModal}
                  className="px-2 py-1 rounded text-xs font-bold flex items-center gap-1 transition-colors bg-indigo-950/70 hover:bg-indigo-900 border border-indigo-700/60 text-indigo-200 hover:text-white cursor-pointer"
                  title={`Project SLA Target: ${getEffectiveTrackerSlaConfig(tracker).targetDays}d (${getEffectiveTrackerSlaConfig(tracker).scopeName}). Click to customize or choose SLA options.`}
                >
                  <Target className="w-3.5 h-3.5 text-amber-400" />
                  <span>SLA ({getEffectiveTrackerSlaConfig(tracker).targetDays}d)</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onOpenProjectSlaModal}
                  className="px-2 py-1 rounded text-xs font-medium flex items-center gap-1 transition-colors bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-400 hover:text-white cursor-pointer"
                  title="SLA tracking is not active on this tracker. Click to choose SLA options or enable it."
                >
                  <Target className="w-3.5 h-3.5 text-slate-500" />
                  <span>SLA: Off</span>
                  <span className="text-[10px] text-sky-400 font-bold ml-0.5 hover:underline">+ Setup</span>
                </button>
              )
            )}

            <button
              type="button"
              onClick={() => setShowFilterBar(!showFilterBar)}
              className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 transition-colors ${
                showFilterBar
                  ? 'bg-indigo-950 text-indigo-300 font-bold'
                  : 'hover:bg-slate-800 text-slate-400 hover:text-white'
              }`}
              title="Toggle column filters"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Filter</span>
            </button>

            {/* Summary toggle */}
            <button
              type="button"
              onClick={() => {
                if (!showSummaryRow) {
                  setShowSummaryRow(true);
                  setSummaryPosition('top');
                } else if (summaryPosition === 'top') {
                  setSummaryPosition('bottom');
                } else if (summaryPosition === 'bottom') {
                  setSummaryPosition('both');
                } else {
                  setShowSummaryRow(false);
                }
              }}
              className={`px-2 py-1 rounded text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                showSummaryRow ? 'bg-indigo-600/40 text-indigo-200 border border-indigo-500/40' : 'text-slate-400 hover:text-white'
              }`}
              title={`Summary row: ${showSummaryRow ? summaryPosition : 'Hidden'} (Click to cycle)`}
            >
              <span className="font-mono text-emerald-400 font-black">Σ</span>
              <span>{showSummaryRow ? summaryPosition.toUpperCase() : 'Σ'}</span>
            </button>
          </div>

          {/* Sync & Cloud Services Group */}
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-md p-0.5">
            {onOpenServerModal && (
              <button
                type="button"
                onClick={onOpenServerModal}
                className="px-2 py-1 rounded text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer text-emerald-300 hover:bg-emerald-950/60"
                title="Team Live Sync (Real-time collaboration with team)"
              >
                <Users className="w-3.5 h-3.5 text-emerald-400" />
                <span>Sync</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              </button>
            )}

            {onOpenSupabaseModal && (
              <button
                type="button"
                onClick={onOpenSupabaseModal}
                className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                  isSupabaseConnected ? 'text-emerald-300 bg-emerald-950/40' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Connect Supabase PostgreSQL"
              >
                <Database className="w-3.5 h-3.5" />
                <span>DB</span>
              </button>
            )}

            {onOpenCloudflareModal && (
              <button
                type="button"
                onClick={onOpenCloudflareModal}
                className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                  isCloudflareConnected ? 'text-orange-300 bg-orange-950/40' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Cloudflare Edge Sync"
              >
                <Cloud className="w-3.5 h-3.5" />
                <span>Edge</span>
              </button>
            )}
          </div>

          {/* Lock & Date Group */}
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-md p-0.5">
            <button
              type="button"
              onClick={handleToggleLock}
              className={`px-2 py-1 rounded text-xs font-bold flex items-center gap-1 transition-all ${
                tracker.isLocked
                  ? 'bg-amber-500 text-black'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title={tracker.isLocked ? 'Sheet is LOCKED. Click to UNLOCK.' : 'Click to LOCK sheet data.'}
            >
              {tracker.isLocked ? (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span>Locked</span>
                </>
              ) : (
                <>
                  <Unlock className="w-3.5 h-3.5" />
                  <span>Lock</span>
                </>
              )}
            </button>

            {onOpenLockApprovalModal && (
              <button
                type="button"
                onClick={onOpenLockApprovalModal}
                className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors relative"
                title="Protection Settings & Approval Queue"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                {pendingApprovalsCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-amber-500 text-black text-[9px] font-black flex items-center justify-center">
                    {pendingApprovalsCount}
                  </span>
                )}
              </button>
            )}

            {canEdit && (
              <button
                type="button"
                onClick={handleStandardizeAllDates}
                className="px-2 py-1 hover:bg-amber-950/40 text-amber-300 rounded text-xs font-medium flex items-center gap-1 transition-colors"
                title="Fix all dates to standard ISO YYYY-MM-DD"
              >
                <CalendarCheck className="w-3 h-3" />
                <span className="hidden xl:inline">Fix Dates</span>
              </button>
            )}

            {/* Date format selector */}
            <select
              value={dateFormatPreference}
              onChange={(e) => setDateFormatPreference(e.target.value as any)}
              className="bg-transparent text-[10px] text-sky-300 font-bold px-1 py-0.5 focus:outline-hidden cursor-pointer"
              title="Select display format for date cells"
            >
              <option value="YYYY-MM-DD" className="bg-slate-900 text-white">ISO (YYYY-MM-DD)</option>
              <option value="MMM DD, YYYY" className="bg-slate-900 text-white">Month (Oct 24, 2026)</option>
              <option value="MM/DD/YYYY" className="bg-slate-900 text-white">US (MM/DD/YYYY)</option>
              <option value="DD/MM/YYYY" className="bg-slate-900 text-white">UK/PH (DD/MM/YYYY)</option>
            </select>
          </div>
        </div>

        {/* Right Search Input & Top Page Controls */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={gridSearch}
              onChange={(e) => setGridSearch(e.target.value)}
              placeholder="Search..."
              className="pl-7 pr-2 py-1 text-xs bg-slate-900 border border-slate-800 rounded text-white placeholder-slate-500 focus:outline-hidden focus:border-sky-500 w-32 lg:w-44"
            />
          </div>

          {/* Rows selector */}
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="bg-slate-900 border border-slate-800 rounded px-1.5 py-1 text-xs text-slate-300 font-semibold focus:outline-hidden cursor-pointer"
            title="Rows per page"
          >
            <option value={10}>10 rows</option>
            <option value={20}>20 rows</option>
            <option value={50}>50 rows</option>
            <option value={100}>100 rows</option>
            <option value={999999}>All rows</option>
          </select>

          {/* Top Page Switcher */}
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded text-xs">
            <button
              type="button"
              disabled={safeCurrentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-0.5 text-slate-400 hover:text-white disabled:opacity-30 rounded hover:bg-slate-800 transition-colors"
              title="Prev page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] text-sky-400 font-mono font-bold whitespace-nowrap">
              {safeCurrentPage}/{totalPages}
            </span>
            <button
              type="button"
              disabled={safeCurrentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-0.5 text-slate-400 hover:text-white disabled:opacity-30 rounded hover:bg-slate-800 transition-colors"
              title="Next page"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] text-slate-500 font-mono hidden xl:inline">
              ({totalRows})
            </span>
          </div>
        </div>
      </div>

      {/* Prominent Sheet Protection Active Banner when Locked - Compact single-line to lessen occupied space */}
      {tracker.isLocked && (
        <div className="bg-amber-950/80 border-b border-amber-600/50 px-3 py-1 flex items-center justify-between text-xs text-amber-200 shrink-0">
          <div className="flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="font-bold text-amber-300">Sheet Locked:</span>
            <span className="text-amber-200/90 text-[11px] hidden sm:inline">
              Accidental overwrite protection is active. Cell edits and row deletions are disabled.
            </span>
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={handleToggleLock}
              className="px-2.5 py-0.5 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs rounded transition-colors shadow-xs"
            >
              Unlock Sheet
            </button>
          )}
        </div>
      )}

      {/* Lock or Action Notification Banner - Compact single-line */}
      {lockNotice && (
        <div className="bg-indigo-950/90 border-b border-indigo-700/80 px-3 py-1 text-xs text-indigo-100 flex items-center justify-between animate-in fade-in shrink-0">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="text-[11px]">{lockNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setLockNotice(null)}
            className="p-0.5 text-slate-400 hover:text-white rounded"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Excel Spreadsheet Table Viewport */}
      <div ref={tableRef} className="flex-1 overflow-auto relative">
        <table className="w-full border-collapse text-xs select-none">
          {/* Header Row */}
          <thead className={`sticky top-0 z-30 shadow-xs ${headerThemeBgClass}`}>
            <tr className={`border-b border-slate-800 font-semibold text-[11px] ${headerThemeBgClass}`}>
              {/* Row Number Header */}
              <th
                style={{ left: 0, width: 48, minWidth: 48, maxWidth: 48 }}
                className={`sticky top-0 left-0 z-50 w-12 px-2 py-2 text-center border-r border-slate-800 font-mono font-normal opacity-90 select-none ${headerThemeBgClass}`}
              >
                <div className="flex items-center justify-center gap-1">
                  <span>#</span>
                  {(frozenColsCount > 0 || frozenRowsCount > 0) && (
                    <span title={`${frozenColsCount} col(s), ${frozenRowsCount} row(s) frozen`}>
                      <Snowflake className="w-2.5 h-2.5 text-sky-400" />
                    </span>
                  )}
                </div>
              </th>

              {visibleCols.map((col, cIdx) => {
                const isFrozen = cIdx < frozenColsCount;
                const isLastFrozenCol = isFrozen && cIdx === frozenColsCount - 1;
                const isSorted = sortConfig?.colId === col.id;

                return (
                  <th
                    key={col.id}
                    style={{
                      width: col.width,
                      minWidth: col.width,
                      maxWidth: col.width,
                      left: isFrozen ? colLeftOffsets[cIdx] : undefined,
                    }}
                    className={`relative px-3 py-2 text-left font-semibold border-r border-slate-800 uppercase tracking-wider group ${
                      isFrozen
                        ? `sticky top-0 z-40 bg-slate-950 font-bold ${
                            isLastFrozenCol
                              ? 'border-r-2 border-indigo-500 shadow-[4px_0_12px_-2px_rgba(99,102,241,0.5)]'
                              : ''
                          }`
                        : 'bg-slate-950'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span
                        onClick={() => handleSort(col.id)}
                        className="truncate cursor-pointer hover:text-white flex items-center gap-1.5"
                        title="Click to sort"
                      >
                        {col.type === 'image' && (
                          <ImageIcon className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                        )}
                        {col.type === 'pdf' && (
                          <FileText className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        )}
                        <span>{col.label}</span>
                        {isSorted && (
                          <span className="text-sky-400 font-mono text-[10px]">
                            {sortConfig.direction === 'asc' ? '▲' : '▼'}
                          </span>
                        )}
                      </span>

                      <div className="flex items-center gap-1">
                        {/* Quick Pin / Freeze Toggle Button */}
                        {canEdit && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleColumnFreeze(cIdx);
                            }}
                            title={
                              isFrozen
                                ? `Column frozen (1..${cIdx + 1}). Click to unfreeze from here.`
                                : `Click to freeze columns up to ${col.label}`
                            }
                            className={`p-0.5 rounded transition-all cursor-pointer ${
                              isFrozen
                                ? 'text-sky-400 hover:text-white hover:bg-slate-800 opacity-100'
                                : 'opacity-0 group-hover:opacity-100 text-slate-500 hover:text-sky-300 hover:bg-slate-800'
                            }`}
                          >
                            <Pin className={`w-3 h-3 ${isFrozen ? 'fill-sky-400 rotate-45' : ''}`} />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleSort(col.id)}
                          className="p-0.5 text-slate-400 hover:text-sky-400 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Sort column"
                        >
                          <ArrowUpDown className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Column Resizer Handle */}
                    <div
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setResizingCol({
                          colId: col.id,
                          startX: e.clientX,
                          startWidth: col.width,
                        });
                      }}
                      className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-sky-500 z-30 transition-colors"
                    />
                  </th>
                );
              })}

              {/* Actions Header - With Delete All Option */}
              <th className="w-18 px-1.5 py-1.5 text-center bg-slate-950 border-r border-slate-800 text-[11px] text-slate-400 font-bold">
                <div className="flex items-center justify-center gap-1">
                  <span>Del</span>
                  {canEdit && tracker.rows.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteAllOption('all');
                        setIsDeleteAllModalOpen(true);
                      }}
                      className="px-1 py-0.5 rounded bg-rose-950 hover:bg-rose-600 border border-rose-700/80 text-rose-300 hover:text-white text-[9px] font-black transition-all flex items-center gap-0.5 shadow-xs cursor-pointer active:scale-95"
                      title={`Delete all ${tracker.rows.length} rows (Confirmation & Undo)`}
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                      <span>ALL</span>
                    </button>
                  )}
                </div>
              </th>
            </tr>

            {/* Quick Filter Row */}
            {showFilterBar && (
              <tr className="bg-slate-900 border-b border-slate-800">
                <th
                  style={{ left: 0, width: 48, minWidth: 48, maxWidth: 48 }}
                  className="sticky left-0 z-45 p-1 bg-slate-950 border-r border-slate-800 text-center font-normal text-[10px] text-slate-500"
                >
                  <Filter className="w-3 h-3 mx-auto" />
                </th>
                {visibleCols.map((col, cIdx) => {
                  const isFrozen = cIdx < frozenColsCount;
                  const isLastFrozenCol = isFrozen && cIdx === frozenColsCount - 1;

                  return (
                    <th
                      key={`filter_${col.id}`}
                      style={{
                        width: col.width,
                        minWidth: col.width,
                        maxWidth: col.width,
                        left: isFrozen ? colLeftOffsets[cIdx] : undefined,
                      }}
                      className={`p-1 border-r border-slate-800 font-normal ${
                        isFrozen
                          ? `sticky z-40 bg-slate-950 ${
                              isLastFrozenCol
                                ? 'border-r-2 border-indigo-500 shadow-[4px_0_12px_-2px_rgba(99,102,241,0.5)]'
                                : ''
                            }`
                          : 'bg-slate-900'
                      }`}
                    >
                      <input
                        type="text"
                        placeholder={`Filter ${col.label}...`}
                        value={filterValues[col.id] || ''}
                        onChange={(e) => setFilterValues({ ...filterValues, [col.id]: e.target.value })}
                        className="w-full px-2 py-0.5 text-[11px] bg-slate-950 border border-slate-800 rounded text-slate-200 placeholder-slate-600 focus:outline-hidden focus:border-sky-500"
                      />
                    </th>
                  );
                })}
                <th className="bg-slate-950 border-r border-slate-800" />
              </tr>
            )}

            {/* Sticky Summary & Totals Row on TOP of the Rows */}
            {showSummaryRow && (summaryPosition === 'top' || summaryPosition === 'both') && (
              <tr className="bg-slate-950 border-b-2 border-indigo-500 shadow-md">
                <th
                  style={{ left: 0, width: 48, minWidth: 48, maxWidth: 48 }}
                  className="sticky left-0 z-45 px-2 py-2 text-center text-indigo-400 font-mono text-[11px] bg-slate-950 border-r border-slate-800"
                  title="Summary / Totals row pinned on TOP of the rows"
                >
                  <span className="px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-700/70 font-mono text-[10px] whitespace-nowrap font-bold">
                    Σ TOP
                  </span>
                </th>
                {visibleCols.map((col, cIdx) => {
                  const isFrozen = cIdx < frozenColsCount;
                  const isLastFrozenCol = isFrozen && cIdx === frozenColsCount - 1;
                  const summaryText = calculateColumnSummary(col);

                  return (
                    <th
                      key={`top_sum_${col.id}`}
                      style={{
                        width: col.width,
                        minWidth: col.width,
                        maxWidth: col.width,
                        left: isFrozen ? colLeftOffsets[cIdx] : undefined,
                      }}
                      className={`px-3 py-2 text-left border-r border-slate-800 truncate font-mono text-emerald-400 tabular-nums ${
                        isFrozen
                          ? `sticky z-40 bg-slate-950 ${
                              isLastFrozenCol
                                ? 'border-r-2 border-indigo-500 shadow-[4px_0_12px_-2px_rgba(99,102,241,0.5)]'
                                : ''
                            }`
                          : 'bg-slate-950'
                      }`}
                    >
                      {summaryText ? (
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="text-[10px] text-slate-400 uppercase font-sans font-semibold">
                            {col.summaryType === 'sum' ? 'Total:' : col.summaryType === 'avg' ? 'Avg:' : 'Count:'}
                          </span>
                          <span className="text-emerald-400 font-bold">{summaryText}</span>
                        </div>
                      ) : (
                        <span className="text-slate-600 font-normal text-[10px]">—</span>
                      )}
                    </th>
                  );
                })}
                <th className="bg-slate-950 border-r border-slate-800 text-[10px] text-slate-400 text-center font-bold">
                  {canEdit && tracker.rows.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteAllOption('all');
                        setIsDeleteAllModalOpen(true);
                      }}
                      className="px-1 py-0.5 rounded text-[9px] font-semibold text-rose-400 hover:text-white hover:bg-rose-950 border border-transparent hover:border-rose-800 transition-colors flex items-center justify-center gap-0.5 mx-auto cursor-pointer"
                      title={`Clear / Delete all ${tracker.rows.length} tracker rows`}
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                      <span>Clr All</span>
                    </button>
                  ) : (
                    <span>Totals</span>
                  )}
                </th>
              </tr>
            )}
          </thead>

          {/* Grid Rows */}
          <tbody className="divide-y divide-slate-800/60 font-normal">
            {pagedRows.length === 0 ? (
              <tr>
                <td
                  colSpan={visibleCols.length + 2}
                  className="py-12 text-center text-slate-500 text-xs"
                >
                  No matching site records found. Click "+ Add Row" or import data from Excel.
                </td>
              </tr>
            ) : (
              pagedRows.map((row, pIdx) => {
                const isSlaActive = tracker.enableSla !== false && tracker.slaConfig?.enabled !== false;
                const isRowAlert = isSlaActive && row.slaData?.isNoMovement14Days;
                const isSelectedRow = selectedCell?.rowId === row.id;
                const isFrozenRow = pIdx < frozenRowsCount;
                const isLastFrozenRow = isFrozenRow && pIdx === frozenRowsCount - 1;
                const rowTopOffset = isFrozenRow ? (headerTotalHeight + pIdx * rowHeightPx) : undefined;

                return (
                  <tr
                    key={row.id}
                    className={`transition-colors ${
                      isRowAlert
                        ? 'bg-rose-950/20 hover:bg-rose-950/30'
                        : isSelectedRow
                        ? 'bg-slate-800/40 hover:bg-slate-800/60'
                        : pIdx % 2 === 0
                        ? 'bg-slate-900/60 hover:bg-slate-850'
                        : zebraStripes
                        ? 'bg-slate-900/30 hover:bg-slate-850'
                        : 'bg-slate-900/60 hover:bg-slate-850'
                    }`}
                  >
                    {/* Row Index Number with Hover Pin Button */}
                    <td
                      style={{
                        left: 0,
                        width: 48,
                        minWidth: 48,
                        maxWidth: 48,
                        top: isFrozenRow ? rowTopOffset : undefined,
                      }}
                      className={`sticky left-0 ${
                        isFrozenRow ? 'z-35 bg-slate-950' : 'z-10 bg-slate-950/95'
                      } px-2 ${rowPaddingClass} text-center font-mono ${fontSizeClass} text-slate-500 ${
                        showGridlines ? 'border-r border-slate-800/80' : ''
                      } ${
                        isLastFrozenRow
                          ? 'border-b-2 border-indigo-500 shadow-[0_4px_12px_-2px_rgba(99,102,241,0.5)]'
                          : ''
                      } select-none group/rowNum`}
                    >
                      <div className="flex items-center justify-between gap-0.5">
                        <span className="w-full text-center">{startIndex + pIdx + 1}</span>
                        {canEdit && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleRowFreeze(pIdx);
                            }}
                            title={
                              isFrozenRow
                                ? `Row ${pIdx + 1} is frozen. Click to unfreeze.`
                                : `Click to freeze top rows up to row ${pIdx + 1}`
                            }
                            className={`p-0.5 rounded transition-all cursor-pointer ${
                              isFrozenRow
                                ? 'text-indigo-400 hover:text-white opacity-100'
                                : 'opacity-0 group-hover/rowNum:opacity-100 text-slate-600 hover:text-indigo-300'
                            }`}
                          >
                            <Pin className={`w-2.5 h-2.5 ${isFrozenRow ? 'fill-indigo-400' : ''}`} />
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Column Cells */}
                    {visibleCols.map((col, cIdx) => {
                      const isFrozenCol = cIdx < frozenColsCount;
                      const isLastFrozenCol = isFrozenCol && cIdx === frozenColsCount - 1;
                      const isCellSelected = selectedCell?.rowId === row.id && selectedCell?.colId === col.id;
                      const isCellEditing = editingCell?.rowId === row.id && editingCell?.colId === col.id;
                      const cellValue = col.id === 'site_id' ? row.siteId : row.values[col.id];

                      const isSticky = isFrozenRow || isFrozenCol;
                      const cellZIndex =
                        isCellSelected
                          ? 'z-40'
                          : isFrozenRow && isFrozenCol
                          ? 'z-35'
                          : isFrozenRow
                          ? 'z-25'
                          : isFrozenCol
                          ? 'z-15'
                          : '';

                      const cellBg = isCellSelected
                        ? 'bg-sky-950/40 ring-2 ring-sky-500'
                        : isFrozenRow && isFrozenCol
                        ? isSelectedRow
                          ? 'bg-slate-900'
                          : pIdx % 2 === 0
                          ? 'bg-slate-950'
                          : 'bg-slate-900'
                        : isFrozenRow
                        ? isSelectedRow
                          ? 'bg-slate-900'
                          : pIdx % 2 === 0
                          ? 'bg-slate-950'
                          : 'bg-slate-900'
                        : isFrozenCol
                        ? isSelectedRow
                          ? 'bg-slate-900'
                          : pIdx % 2 === 0
                          ? 'bg-slate-950'
                          : 'bg-slate-900'
                        : '';

                      return (
                        <td
                          key={col.id}
                          onClick={() => handleCellClick(row.id, pIdx, col.id)}
                          onDoubleClick={() => handleCellDoubleClick(row.id, pIdx, col.id, cellValue, col.type)}
                          onDragOver={(e) => {
                            if (col.type === 'image' || col.type === 'pdf') {
                              e.preventDefault();
                              e.stopPropagation();
                              setDragOverCell({ rowId: row.id, colId: col.id });
                            }
                          }}
                          onDragLeave={(e) => {
                            if (col.type === 'image' || col.type === 'pdf') {
                              e.preventDefault();
                              setDragOverCell(null);
                            }
                          }}
                          onDrop={(e) => {
                            if (col.type === 'image' || col.type === 'pdf') {
                              e.preventDefault();
                              e.stopPropagation();
                              setDragOverCell(null);
                              const f = e.dataTransfer.files?.[0];
                              if (f) {
                                handleUploadFileToCell(row.id, col.id, f, col.type);
                              }
                            }
                          }}
                          style={{
                            width: col.width,
                            minWidth: col.width,
                            maxWidth: col.width,
                            left: isFrozenCol ? colLeftOffsets[cIdx] : undefined,
                            top: isFrozenRow ? rowTopOffset : undefined,
                          }}
                          className={`relative px-3 ${rowPaddingClass} ${
                            showGridlines ? 'border-r border-slate-800/70' : ''
                          } truncate ${fontSizeClass} ${
                            isSticky ? 'sticky' : ''
                          } ${cellZIndex} ${cellBg} ${
                            isLastFrozenCol
                              ? 'border-r-2 border-indigo-500 shadow-[4px_0_12px_-2px_rgba(99,102,241,0.4)]'
                              : ''
                          } ${
                            isLastFrozenRow
                              ? 'border-b-2 border-indigo-500 shadow-[0_4px_12px_-2px_rgba(99,102,241,0.4)]'
                              : ''
                          } ${
                            dragOverCell?.rowId === row.id && dragOverCell?.colId === col.id
                              ? 'ring-2 ring-emerald-400 bg-emerald-950/50'
                              : ''
                          }`}
                        >
                          {/* If inline editing */}
                          {isCellEditing ? (
                            <input
                              ref={inputRef}
                              type={
                                col.type === 'number' || col.type === 'percent'
                                    ? 'number'
                                    : col.type === 'date' || col.type === 'sla_trigger_date'
                                    ? 'date'
                                    : 'text'
                              }
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              onBlur={handleCommitEdit}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCommitEdit();
                                if (e.key === 'Escape') setEditingCell(null);
                              }}
                              className="w-full px-1.5 py-0.5 bg-slate-950 border border-sky-400 rounded text-xs text-white font-mono focus:outline-hidden"
                            />
                          ) : (
                            /* Render according to column type */
                            renderCellContent(
                              col,
                              cellValue,
                              row,
                              () => onOpenSlaModal(row),
                              () => onOpenChecklistModal(row),
                              (mode) => onOpenSiteDataDrawer(row, mode),
                              dateFormatPreference,
                              triggerFileSelect,
                              openPreview,
                              handleRemoveFileFromCell,
                              handleDownloadFile,
                              dragOverCell?.rowId === row.id && dragOverCell?.colId === col.id,
                              uploadingCell?.rowId === row.id && uploadingCell?.colId === col.id,
                              canEdit,
                              () => handleCellDoubleClick(row.id, pIdx, col.id, cellValue, col.type)
                            )
                          )}
                        </td>
                      );
                    })}

                    {/* Row Delete Action - Direct Deletion with Instant Undo Feedback */}
                    <td
                      style={{
                        top: isFrozenRow ? rowTopOffset : undefined,
                      }}
                      className={`px-2 py-1.5 text-center border-r border-slate-800/80 ${
                        isFrozenRow ? 'sticky z-25 bg-slate-950' : ''
                      } ${
                        isLastFrozenRow
                          ? 'border-b-2 border-indigo-500 shadow-[0_4px_12px_-2px_rgba(99,102,241,0.4)]'
                          : ''
                      }`}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteRow(row);
                        }}
                        className="p-1.5 rounded-md transition-all group/del flex items-center justify-center mx-auto text-rose-400 hover:text-white hover:bg-rose-600/90 cursor-pointer shadow-xs active:scale-95"
                        title={`Delete row ${row.siteId} (Instant Delete · Undo available)`}
                      >
                        <Trash2 className="w-3.5 h-3.5 group-hover/del:scale-110 text-rose-400 group-hover/del:text-white transition-transform" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>

          {/* Sticky Summary Row at Bottom (renders when position is bottom or both) */}
          {showSummaryRow && (summaryPosition === 'bottom' || summaryPosition === 'both') && (
            <tfoot className="sticky bottom-0 z-30 bg-slate-950 border-t-2 border-indigo-500 font-bold text-xs shadow-lg">
              <tr>
                <td
                  style={{ left: 0, width: 48, minWidth: 48, maxWidth: 48 }}
                  className="sticky left-0 z-40 px-2 py-2 text-center text-slate-400 font-mono text-[11px] bg-slate-950 border-r border-slate-800"
                  title="Summary Row (Bottom)"
                >
                  Σ BTM
                </td>
                {visibleCols.map((col, cIdx) => {
                  const isFrozen = cIdx < frozenColsCount;
                  const isLastFrozenCol = isFrozen && cIdx === frozenColsCount - 1;
                  const summaryText = calculateColumnSummary(col);

                  return (
                    <td
                      key={`sum_${col.id}`}
                      style={{
                        width: col.width,
                        minWidth: col.width,
                        maxWidth: col.width,
                        left: isFrozen ? colLeftOffsets[cIdx] : undefined,
                      }}
                      className={`px-3 py-2 border-r border-slate-800 truncate font-mono text-emerald-400 tabular-nums ${
                        isFrozen
                          ? `sticky z-40 bg-slate-950 ${
                              isLastFrozenCol ? 'border-r-2 border-indigo-500 shadow-[4px_0_12px_-2px_rgba(99,102,241,0.5)]' : ''
                            }`
                          : 'bg-slate-950'
                      }`}
                    >
                      {summaryText}
                    </td>
                  );
                })}
                <td className="bg-slate-950 border-r border-slate-800 text-center">
                  {canEdit && tracker.rows.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteAllOption('all');
                        setIsDeleteAllModalOpen(true);
                      }}
                      className="px-1 py-0.5 rounded text-[9px] font-semibold text-rose-400 hover:text-white hover:bg-rose-950 border border-transparent hover:border-rose-800 transition-colors inline-flex items-center gap-0.5 cursor-pointer"
                      title={`Clear / Delete all ${tracker.rows.length} tracker rows`}
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                      <span>Clr All</span>
                    </button>
                  )}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Pagination Bar with 10, 20, 30, 40, 50, 60, 70, 80, 90, 100 row selections */}
      <div className="px-4 py-2.5 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Left: Summary info & Rows per page selector */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Showing</span>
            <span className="font-bold text-white">
              {totalRows === 0 ? 0 : startIndex + 1}–{endIndex}
            </span>
            <span className="text-slate-400">of</span>
            <span className="font-bold text-sky-400">{totalRows}</span>
            <span className="text-slate-400">rows</span>
          </div>

          <div className="flex items-center gap-2.5 pl-3 border-l border-slate-800 flex-wrap">
            <span className="text-slate-400 font-semibold">Rows per page:</span>

            {/* Dropdown selector for 10, 20, 30, 40, 50, 60, 70, 80, 90, 100 */}
            <select
              value={pageSize >= 999999 ? 'all' : pageSize}
              onChange={(e) => {
                const val = e.target.value === 'all' ? 999999 : Number(e.target.value);
                setPageSize(val);
                setCurrentPage(1);
              }}
              className="px-2 py-0.5 rounded text-xs bg-slate-900 border border-slate-700 text-sky-300 font-bold focus:outline-hidden focus:border-sky-500 cursor-pointer"
              title="Select rows per page"
            >
              {[10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 250, 500, 1000, 5000, 10000].map((sz) => (
                <option key={sz} value={sz}>
                  {sz.toLocaleString()} rows
                </option>
              ))}
              <option value="all">All rows</option>
            </select>

            {/* Quick-click row buttons */}
            <div className="hidden lg:flex items-center gap-1">
              {[10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => {
                    setPageSize(sz);
                    setCurrentPage(1);
                  }}
                  className={`px-1.5 py-0.5 rounded text-[11px] font-bold transition-colors ${
                    pageSize === sz
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                  title={`Show ${sz} rows per page`}
                >
                  {sz}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setPageSize(999999);
                  setCurrentPage(1);
                }}
                className={`px-1.5 py-0.5 rounded text-[11px] font-bold transition-colors ${
                  pageSize >= 999999
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800'
                }`}
                title="Show all rows without pagination"
              >
                All
              </button>
            </div>
          </div>
        </div>

        {/* Right: Page Navigation Controls */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setCurrentPage(1)}
            disabled={safeCurrentPage <= 1}
            className="p-1 rounded bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-slate-900 text-slate-300 border border-slate-800 transition-colors"
            title="First page"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={safeCurrentPage <= 1}
            className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-slate-900 text-slate-300 border border-slate-800 transition-colors flex items-center gap-1"
            title="Previous page"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Prev</span>
          </button>

          <div className="flex items-center gap-1 px-1">
            {getPageNumbers(safeCurrentPage, totalPages).map((pNum, idx) =>
              pNum === '...' ? (
                <span key={`dots_${idx}`} className="px-1 text-slate-600 font-bold">...</span>
              ) : (
                <button
                  key={pNum}
                  type="button"
                  onClick={() => setCurrentPage(Number(pNum))}
                  className={`w-7 h-7 rounded text-xs font-bold transition-colors ${
                    safeCurrentPage === pNum
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
                  }`}
                >
                  {pNum}
                </button>
              )
            )}
          </div>

          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={safeCurrentPage >= totalPages}
            className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-slate-900 text-slate-300 border border-slate-800 transition-colors flex items-center gap-1"
            title="Next page"
          >
            <span>Next</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setCurrentPage(totalPages)}
            disabled={safeCurrentPage >= totalPages}
            className="p-1 rounded bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-slate-900 text-slate-300 border border-slate-800 transition-colors"
            title="Last page"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Grid Status / Info Bar at Bottom */}
      <div className="px-4 py-2 bg-slate-950 border-t border-slate-800 text-[11px] text-slate-400 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span>
            {selectedCell
              ? `Cell: Row ${startIndex + selectedCell.pIdx + 1}, Column: ${selectedCell.colId}`
              : 'Double-click any cell to edit · Tab/Arrows to navigate · Ctrl+C / Ctrl+V Excel support'}
          </span>
          <span className="text-slate-600">|</span>
          <span className="text-emerald-400 font-mono">Currency: Philippine Peso (₱)</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>Real-time Excel sync active</span>
        </div>
      </div>

      {/* In-App Delete Confirmation Modal (100% reliable, replaces blocked browser window.confirm) */}
      {rowToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-rose-950 text-rose-400 border border-rose-800 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Delete Site Record?</h3>
                <p className="text-xs text-slate-400">
                  This action will remove this site row from the tracker.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 text-xs space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-medium">Site ID:</span>
                <span className="font-mono font-bold text-sky-400 bg-sky-950/60 px-2 py-0.5 rounded border border-sky-800">
                  {rowToDelete.siteId}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-medium">Site Location:</span>
                <span className="font-semibold text-slate-200 truncate max-w-[220px]">
                  {rowToDelete.values.site_name || rowToDelete.siteDetails?.siteName || 'Site Record'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-medium">Current Status:</span>
                <span className="text-slate-300 font-medium">
                  {rowToDelete.values.status || 'Active'}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setRowToDelete(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteRow(rowToDelete.id)}
                className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 transition-colors flex items-center gap-1.5 shadow-md shadow-rose-950"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Yes, Delete Row
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-App Delete All Confirmation Modal with Undo Safety */}
      {isDeleteAllModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-slate-900 border border-rose-700/80 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-rose-950 text-rose-400 border border-rose-800 shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Delete All Tracker Rows?</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Tracker: <span className="font-semibold text-sky-400">{tracker.name}</span>
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-3">
              <div className="flex justify-between items-center pb-2 border-b border-slate-800/80">
                <span className="text-slate-400">Total Rows in Tracker:</span>
                <span className="font-mono font-bold text-rose-400 text-sm bg-rose-950/60 px-2 py-0.5 rounded border border-rose-900">
                  {tracker.rows.length.toLocaleString()} rows
                </span>
              </div>

              {isFiltered && (
                <div className="space-y-2 pt-1">
                  <span className="text-[11px] font-semibold text-slate-300">Choose what to delete:</span>
                  <label className="flex items-start gap-2.5 p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="deleteAllChoice"
                      checked={deleteAllOption === 'all'}
                      onChange={() => setDeleteAllOption('all')}
                      className="mt-0.5 text-rose-600 focus:ring-rose-500"
                    />
                    <div className="text-xs">
                      <span className="font-bold text-white block">
                        Delete ALL rows ({tracker.rows.length.toLocaleString()} rows)
                      </span>
                      <span className="text-slate-400 text-[11px] block mt-0.5">
                        Clears every single row from this entire tracker sheet.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="deleteAllChoice"
                      checked={deleteAllOption === 'filtered'}
                      onChange={() => setDeleteAllOption('filtered')}
                      className="mt-0.5 text-rose-600 focus:ring-rose-500"
                    />
                    <div className="text-xs">
                      <span className="font-bold text-amber-300 block">
                        Delete ONLY filtered rows ({processedRows.length.toLocaleString()} rows)
                      </span>
                      <span className="text-slate-400 text-[11px] block mt-0.5">
                        Leaves remaining {(tracker.rows.length - processedRows.length).toLocaleString()} unfiltered rows intact.
                      </span>
                    </div>
                  </label>
                </div>
              )}

              <div className="p-2.5 rounded-lg bg-indigo-950/40 border border-indigo-800/50 text-[11px] text-indigo-200 flex items-start gap-2">
                <Undo2 className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Safe &amp; Undoable:</strong> If deleted by accident, you can immediately restore all rows using the <strong>Undo</strong> button or <strong>Ctrl+Z</strong>.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsDeleteAllModalOpen(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAllRows}
                className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 transition-colors flex items-center gap-1.5 shadow-lg shadow-rose-950 cursor-pointer active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Yes, Delete {deleteAllOption === 'filtered' && isFiltered ? `${processedRows.length} Filtered` : `All ${tracker.rows.length}`} Rows
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification when all rows are deleted with 1-click Undo */}
      {deletedBatchToast && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-900 border border-rose-500 text-white shadow-2xl animate-in slide-in-from-bottom duration-200 ring-2 ring-rose-500/30">
          <Trash2 className="w-4 h-4 text-rose-400 shrink-0" />
          <div className="text-xs">
            <span className="font-bold text-rose-300">Deleted {deletedBatchToast.count} rows</span>
            <span className="text-slate-400 ml-1">from {tracker.name}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              handleUndo();
              setDeletedBatchToast(null);
            }}
            className="px-3 py-1 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-md transition-colors flex items-center gap-1 shadow-sm cursor-pointer ml-1"
          >
            <Undo2 className="w-3.5 h-3.5" />
            Undo / Restore All
          </button>
          <button
            type="button"
            onClick={() => setDeletedBatchToast(null)}
            className="text-slate-400 hover:text-white p-0.5 ml-1"
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Excel Spreadsheet Import Confirmation & Exact Row Quantity Match Modal */}
      {pendingImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-6 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-800 shrink-0">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Import Spreadsheet Data</h3>
                  <p className="text-xs text-slate-400">
                    File: <span className="font-mono text-sky-300 font-semibold">{pendingImport.fileName}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPendingImport(null)}
                className="text-slate-400 hover:text-white p-1 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Multi-Sheet Selection Tabs (if workbook has multiple sheets) */}
            {pendingImport.workbookResult && pendingImport.workbookResult.sheetNames.length > 1 && (
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="text-[11px] font-bold text-slate-300 flex items-center justify-between">
                  <span>Workbook Sheets ({pendingImport.workbookResult.sheetNames.length} tabs found):</span>
                  <span className="text-[10px] text-emerald-400">Selected: {pendingImport.activeSheetName}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {pendingImport.workbookResult.sheetNames.map((sheet) => {
                    const isCurrent = sheet === pendingImport.activeSheetName;
                    const sheetRows = pendingImport.workbookResult?.sheets[sheet]?.rowCount || 0;
                    return (
                      <button
                        key={sheet}
                        type="button"
                        onClick={() => handleSwitchImportSheet(sheet)}
                        className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                          isCurrent
                            ? 'bg-emerald-600 text-white font-bold shadow-xs'
                            : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
                        }`}
                      >
                        <span>{sheet}</span>
                        <span className={`text-[10px] font-mono px-1 py-0.2 rounded ${isCurrent ? 'bg-emerald-700 text-emerald-100' : 'bg-slate-800 text-slate-400'}`}>
                          {sheetRows} rows
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Metrics cards */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-center">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Sheet Total Rows</div>
                <div className="text-xl font-black text-slate-200 font-mono mt-0.5">
                  {pendingImport.totalFileRows.toLocaleString()}
                </div>
                <div className="text-[9px] text-slate-500 mt-0.5">Total rows in active tab</div>
              </div>

              <div className="bg-slate-950 border border-emerald-800/60 rounded-lg p-2.5 text-center ring-1 ring-emerald-500/30">
                <div className="text-[10px] text-emerald-400 uppercase font-semibold flex items-center justify-center gap-1">
                  <span>Data Rows to Import</span>
                  <Check className="w-3 h-3 text-emerald-400" />
                </div>
                <div className="text-xl font-black text-emerald-400 font-mono mt-0.5">
                  {pendingImport.dataRows.length.toLocaleString()}
                </div>
                <div className="text-[9px] text-emerald-400/80 font-bold mt-0.5">100% Quantity Preserved</div>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-center">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Columns Reflected</div>
                <div className="text-xl font-black text-sky-400 font-mono mt-0.5">
                  {pendingImport.headers.length}
                </div>
                <div className="text-[9px] text-slate-500 mt-0.5">All headers reflected</div>
              </div>
            </div>

            {/* Header Row Selection & Blank Row Controls */}
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2.5">
              <div className="text-xs font-bold text-slate-200 flex items-center justify-between">
                <span>Header Row &amp; Table Settings</span>
                <span className="text-[10px] font-mono text-sky-400">
                  {pendingImport.hasHeaderRow ? `Header Row ${pendingImport.headerRowIndex + 1} + ` : '0 Headers + '}
                  {pendingImport.dataRows.length} Data Rows
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-900 border border-slate-800 p-2 rounded flex flex-col gap-1.5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pendingImport.hasHeaderRow}
                      onChange={(e) => handleToggleImportHeader(e.target.checked)}
                      className="rounded text-emerald-500 focus:ring-emerald-500"
                    />
                    <div className="leading-tight">
                      <span className="font-semibold text-slate-200 block text-[11px]">Table Has Column Headers</span>
                      <span className="text-[10px] text-slate-400 block">
                        {pendingImport.hasHeaderRow ? `Using Row ${pendingImport.headerRowIndex + 1} as headers` : 'All rows are data'}
                      </span>
                    </div>
                  </label>

                  {pendingImport.hasHeaderRow && (
                    <div className="pt-1 border-t border-slate-800 flex items-center gap-2 text-[11px]">
                      <span className="text-slate-400 shrink-0">Header Row:</span>
                      <select
                        value={pendingImport.headerRowIndex}
                        onChange={(e) => handleChangeHeaderRowIndex(Number(e.target.value))}
                        className="bg-slate-950 border border-slate-700 text-slate-200 rounded px-2 py-0.5 text-[11px] focus:outline-none focus:border-emerald-500 w-full"
                      >
                        {Array.from({ length: Math.min(10, pendingImport.rawData.length) }, (_, i) => {
                          const previewCells = (pendingImport.rawData[i] || [])
                            .filter((c) => c !== undefined && c !== null && String(c).trim() !== '')
                            .slice(0, 3)
                            .map((c) => String(c).trim())
                            .join(', ');
                          const isDetected = i === pendingImport.detectedHeaderRowIndex;
                          return (
                            <option key={i} value={i}>
                              Row {i + 1}{isDetected ? ' (Detected)' : ''}: {previewCells || '(Empty)'}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  )}
                </div>

                <label className="flex items-center gap-2 cursor-pointer bg-slate-900 border border-slate-800 hover:border-slate-700 p-2 rounded">
                  <input
                    type="checkbox"
                    checked={pendingImport.skipBlankRows}
                    onChange={(e) => handleToggleImportSkipBlank(e.target.checked)}
                    className="rounded text-emerald-500 focus:ring-emerald-500"
                  />
                  <div className="leading-tight">
                    <span className="font-semibold text-slate-200 block text-[11px]">Skip Completely Empty Rows</span>
                    <span className="text-[10px] text-slate-400 block">
                      {pendingImport.blankRowCount > 0
                        ? `${pendingImport.blankRowCount} blank rows detected`
                        : 'No blank rows found'}
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* Import Mode Selection */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300">Choose Import Mode:</label>

              <div
                onClick={() => setImportMode('replace')}
                className={`p-3 rounded-lg border cursor-pointer transition-colors flex items-start gap-3 ${
                  importMode === 'replace'
                    ? 'bg-emerald-950/40 border-emerald-500 ring-1 ring-emerald-500'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="importMode"
                  checked={importMode === 'replace'}
                  onChange={() => setImportMode('replace')}
                  className="mt-0.5 text-emerald-500 focus:ring-emerald-500"
                />
                <div className="text-xs">
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <span>Replace All Rows (Exact {pendingImport.dataRows.length.toLocaleString()} Rows Match)</span>
                    <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">Recommended</span>
                  </div>
                  <p className="text-slate-400 text-[11px] mt-0.5">
                    Replaces current sheet data so your tracker has EXACTLY {pendingImport.dataRows.length.toLocaleString()} rows, matching your spreadsheet 1:1.
                  </p>
                </div>
              </div>

              <div
                onClick={() => setImportMode('append')}
                className={`p-3 rounded-lg border cursor-pointer transition-colors flex items-start gap-3 ${
                  importMode === 'append'
                    ? 'bg-sky-950/40 border-sky-500 ring-1 ring-sky-500'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="importMode"
                  checked={importMode === 'append'}
                  onChange={() => setImportMode('append')}
                  className="mt-0.5 text-sky-500 focus:ring-sky-500"
                />
                <div className="text-xs">
                  <div className="font-bold text-white">
                    Append to Existing Rows ({tracker.rows.length} existing + {pendingImport.dataRows.length.toLocaleString()} imported = {(tracker.rows.length + pendingImport.dataRows.length).toLocaleString()} rows)
                  </div>
                  <p className="text-slate-400 text-[11px] mt-0.5">
                    Appends all {pendingImport.dataRows.length.toLocaleString()} rows to the end of the sheet while keeping all existing rows intact.
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Preview Table (first 3 rows) */}
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-slate-400">Sample Data Preview (First 3 rows):</span>
              <div className="border border-slate-800 rounded-lg overflow-x-auto bg-slate-950 max-h-36">
                <table className="w-full text-[11px] border-collapse">
                  <thead>
                    <tr className="bg-slate-900 border-b border-slate-800 text-slate-300 font-semibold">
                      <th className="px-2.5 py-1.5 text-left border-r border-slate-800">#</th>
                      {pendingImport.headers.slice(0, 8).map((h, i) => (
                        <th key={i} className="px-2.5 py-1.5 text-left border-r border-slate-800 truncate max-w-[140px]">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pendingImport.dataRows.slice(0, 3).map((r, rIdx) => (
                      <tr key={rIdx} className="border-b border-slate-900 text-slate-300">
                        <td className="px-2.5 py-1 text-slate-500 border-r border-slate-800 font-mono text-[10px]">{rIdx + 1}</td>
                        {pendingImport.headers.slice(0, 8).map((_, cIdx) => (
                          <td key={cIdx} className="px-2.5 py-1 border-r border-slate-800 truncate max-w-[140px]">
                            {String(r[cIdx] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setPendingImport(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteImport}
                className="px-5 py-2 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors flex items-center gap-1.5 shadow-md shadow-emerald-950 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                Confirm & Import EXACTLY {pendingImport.dataRows.length.toLocaleString()} Rows
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification when a row is deleted with 1-click Undo */}
      {deletedToastRow && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white shadow-2xl animate-in slide-in-from-bottom duration-200 ring-1 ring-sky-500/40">
          <Trash2 className="w-4 h-4 text-rose-400 shrink-0" />
          <span className="text-xs">
            Deleted site record <strong className="text-sky-400 font-mono">{deletedToastRow.siteId}</strong>
          </span>
          <button
            type="button"
            onClick={() => {
              handleUndo();
              setDeletedToastRow(null);
            }}
            className="px-2.5 py-1 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-md transition-colors flex items-center gap-1 shadow-sm"
          >
            <Undo2 className="w-3 h-3" />
            Undo
          </button>
          <button
            type="button"
            onClick={() => setDeletedToastRow(null)}
            className="text-slate-400 hover:text-white p-0.5"
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Hidden File Input for Image & PDF column uploads */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && filePickerTarget) {
            handleUploadFileToCell(
              filePickerTarget.rowId,
              filePickerTarget.colId,
              file,
              filePickerTarget.type
            );
          }
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }}
      />

      {/* Interactive High-Res Photo & PDF Document Preview Modal */}
      {previewModalFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Top Bar */}
            <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 truncate">
                <div
                  className={`p-2 rounded-lg shrink-0 ${
                    previewModalFile.type === 'pdf'
                      ? 'bg-rose-950 text-rose-400 border border-rose-800'
                      : 'bg-sky-950 text-sky-400 border border-sky-800'
                  }`}
                >
                  {previewModalFile.type === 'pdf' ? (
                    <FileText className="w-5 h-5" />
                  ) : (
                    <ImageIcon className="w-5 h-5" />
                  )}
                </div>
                <div className="truncate text-left">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-sky-400 bg-sky-950/60 px-2 py-0.5 rounded border border-sky-800">
                      {previewModalFile.siteId}
                    </span>
                    <span className="text-xs text-slate-400 font-semibold truncate">
                      {previewModalFile.colLabel}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded border uppercase font-mono ${
                        previewModalFile.type === 'pdf'
                          ? 'bg-rose-950/80 text-rose-300 border-rose-700'
                          : 'bg-sky-950/80 text-sky-300 border-sky-700'
                      }`}
                    >
                      {previewModalFile.type.toUpperCase()}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-white truncate max-w-md mt-0.5">
                    {previewModalFile.name}
                  </h3>
                </div>
              </div>

              {/* Modal Header Actions */}
              <div className="flex items-center gap-2 shrink-0">
                {previewModalFile.type === 'image' && (
                  <div className="hidden sm:flex items-center gap-1 bg-slate-850 px-2 py-1 rounded-lg border border-slate-800 text-xs">
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewZoom((z) => Math.max(0.4, Math.round((z - 0.25) * 100) / 100))
                      }
                      className="p-1 hover:text-sky-400 text-slate-300 rounded hover:bg-slate-800"
                      title="Zoom Out"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <span className="font-mono text-[11px] px-1 text-slate-300 min-w-[42px] text-center">
                      {Math.round(previewZoom * 100)}%
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewZoom((z) => Math.min(3, Math.round((z + 0.25) * 100) / 100))
                      }
                      className="p-1 hover:text-sky-400 text-slate-300 rounded hover:bg-slate-800"
                      title="Zoom In"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewZoom(1);
                        setPreviewRotation(0);
                      }}
                      className="p-1 hover:text-sky-400 text-slate-400 hover:text-white text-[10px] ml-1"
                      title="Reset Zoom & Rotation"
                    >
                      Reset
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewRotation((r) => (r + 90) % 360)}
                      className="p-1 hover:text-sky-400 text-slate-300 rounded hover:bg-slate-800 ml-1"
                      title="Rotate 90° Clockwise"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Download Button */}
                <button
                  type="button"
                  onClick={() => handleDownloadFile(previewModalFile.url, previewModalFile.name)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors"
                  title="Download file to computer"
                >
                  <Download className="w-3.5 h-3.5 text-sky-400" />
                  <span className="hidden sm:inline">Download</span>
                </button>

                {/* Replace File Button */}
                {canEdit && (
                  <button
                    type="button"
                    onClick={() =>
                      triggerFileSelect(
                        previewModalFile.rowId,
                        previewModalFile.colId,
                        previewModalFile.type
                      )
                    }
                    className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                    title="Replace file with new photo or PDF"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Replace</span>
                  </button>
                )}

                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => {
                    setPreviewModalFile(null);
                    setPreviewZoom(1);
                    setPreviewRotation(0);
                  }}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors ml-1"
                  title="Close Preview"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Preview Body */}
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-950/90 relative min-h-[360px] max-h-[70vh]">
              {previewModalFile.type === 'image' ? (
                <div className="relative overflow-auto max-w-full max-h-full flex items-center justify-center p-2">
                  <img
                    src={previewModalFile.url}
                    alt={previewModalFile.name}
                    style={{
                      transform: `scale(${previewZoom}) rotate(${previewRotation}deg)`,
                      transition: 'transform 0.15s ease-out',
                    }}
                    className="max-h-[62vh] max-w-full rounded-lg shadow-2xl object-contain border border-slate-800 bg-slate-950"
                  />
                </div>
              ) : (
                <div className="w-full h-full flex flex-col items-center">
                  <iframe
                    src={previewModalFile.url}
                    title={previewModalFile.name}
                    className="w-full h-[62vh] rounded-lg border border-slate-700 bg-white"
                  />
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3 text-slate-400">
                {previewModalFile.size && (
                  <span className="font-mono text-slate-300">
                    File Size: <strong className="text-white">{previewModalFile.size}</strong>
                  </span>
                )}
                {previewModalFile.uploadedAt && (
                  <span>
                    Uploaded:{' '}
                    <strong className="text-slate-200">
                      {formatDateDisplay(previewModalFile.uploadedAt, dateFormatPreference)}
                    </strong>
                  </span>
                )}
                <span className="text-slate-600 hidden sm:inline">|</span>
                <span className="text-emerald-400 hidden sm:inline">
                  Stored in persistent tracker database
                </span>
              </div>

              <div className="flex items-center gap-2">
                {previewModalFile.type === 'pdf' && (
                  <button
                    type="button"
                    onClick={() => {
                      const w = window.open('');
                      if (w) {
                        w.document.write(
                          `<iframe src="${previewModalFile.url}" style="width:100%;height:100%;border:none;"></iframe>`
                        );
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors flex items-center gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-sky-400" />
                    <span>Open in New Tab</span>
                  </button>
                )}

                {canEdit && (
                  <button
                    type="button"
                    onClick={() =>
                      handleRemoveFileFromCell(previewModalFile.rowId, previewModalFile.colId)
                    }
                    className="px-3 py-1.5 rounded-lg bg-rose-950/70 hover:bg-rose-900 text-rose-300 hover:text-white border border-rose-800/80 transition-colors flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete File</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setPreviewModalFile(null);
                    setPreviewZoom(1);
                    setPreviewRotation(0);
                  }}
                  className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Render specialized cell types matching the screenshots and requirements
 */
function renderCellContent(
  col: ColumnDefinition,
  val: any,
  row: TrackerRow,
  onOpenSla: () => void,
  onOpenChecklist: () => void,
  onOpenDataDrawer: (mode?: 'data1' | 'data2') => void,
  dateFormatPreference: 'YYYY-MM-DD' | 'MMM DD, YYYY' | 'DD/MM/YYYY' | 'MM/DD/YYYY' = 'YYYY-MM-DD',
  onTriggerFileUpload?: (rowId: string, colId: string, type: 'image' | 'pdf') => void,
  onOpenPreview?: (row: TrackerRow, col: ColumnDefinition, fileInfo: any) => void,
  onRemoveFile?: (rowId: string, colId: string) => void,
  onDownloadFile?: (url: string, filename: string) => void,
  isDraggingOver?: boolean,
  isUploading?: boolean,
  canEdit: boolean = true,
  onStartEdit?: () => void
) {
  // 1. Site ID clickable & directly editable cell (as requested in user screenshot)
  if (col.type === 'site_id') {
    return (
      <div className="flex items-center justify-between gap-1 w-full group/siteid">
        <span
          onClick={(e) => {
            if (canEdit && onStartEdit) {
              e.stopPropagation();
              onStartEdit();
            }
          }}
          className="font-mono font-bold text-sky-400 hover:text-sky-300 truncate cursor-pointer hover:underline"
          title="Click or double-click to edit Site ID"
        >
          {row.siteId}
        </span>
        <div className="flex items-center gap-0.5 shrink-0">
          {canEdit && onStartEdit && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onStartEdit();
              }}
              className="p-1 rounded text-slate-500 hover:text-sky-300 hover:bg-slate-800 transition-colors opacity-0 group-hover/siteid:opacity-100 cursor-pointer"
              title="Edit Site ID"
            >
              <Edit2 className="w-3 h-3 text-sky-400" />
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenDataDrawer('data1');
            }}
            className="p-1 rounded text-slate-500 hover:text-sky-300 hover:bg-slate-800 transition-colors cursor-pointer"
            title="Open complete site dossier drawer"
          >
            <ExternalLink className="w-3 h-3 opacity-60 group-hover/siteid:opacity-100" />
          </button>
        </div>
      </div>
    );
  }

  // 2. Data 1 button clickable cell (Lands on DATA modal to view & encode all data without consuming big rows)
  if (col.type === 'data_drawer') {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpenDataDrawer('data1');
        }}
        className="w-full px-2.5 py-1 bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700/80 hover:border-indigo-500 text-indigo-300 hover:text-white rounded font-bold text-xs flex items-center justify-between transition-all shadow-xs group/databtn cursor-pointer"
        title="Open DATA: View & encode all site details in typewriter dossier without consuming row height"
      >
        <span className="truncate flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-indigo-400 group-hover/databtn:scale-110 transition-transform" />
          <span className="tracking-wide">DATA</span>
        </span>
        <span className="text-indigo-400 group-hover/databtn:text-indigo-200 font-bold ml-1 text-xs group-hover/databtn:translate-x-0.5 transition-transform">
          &rarr;
        </span>
      </button>
    );
  }

  // 2.5 Data 2 button clickable cell (Lands on DATA 2 modal for different encode of data)
  if (col.type === 'data_drawer_2') {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpenDataDrawer('data2');
        }}
        className="w-full px-2.5 py-1 bg-amber-950/80 hover:bg-amber-900 border border-amber-600/80 hover:border-amber-400 text-amber-300 hover:text-white rounded font-bold text-xs flex items-center justify-between transition-all shadow-xs group/data2btn cursor-pointer"
        title="Open DATA 2: Encode secondary technical dataset, specs, and different data formats"
      >
        <span className="truncate flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-amber-400 group-hover/data2btn:scale-110 transition-transform" />
          <span className="tracking-wide">DATA 2</span>
        </span>
        <span className="text-amber-400 group-hover/data2btn:text-amber-200 font-bold ml-1 text-xs group-hover/data2btn:translate-x-0.5 transition-transform">
          &rarr;
        </span>
      </button>
    );
  }

  // 3. Day-by-Day SLA Progress clickable cell (Screenshot 2 & 3: DAILY STATUS DAILY_REMARKS / Day-by-Day Update)
  if (col.type === 'day_sla') {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpenSla();
        }}
        className="w-full px-2.5 py-1 bg-sky-950/70 hover:bg-sky-900 border border-sky-700/70 text-sky-300 rounded font-semibold text-xs flex items-center justify-between transition-colors shadow-xs"
        title="Open Day-by-Day SLA Progress Tracker"
      >
        <span className="truncate">Daily Remarks</span>
        <span className="text-sky-400 font-bold ml-1">&rarr;</span>
      </button>
    );
  }

  // 4. Legal Fees & Compliance Checklist clickable cell - Displays the reflected amount & voucher count
  if (col.type === 'legal_checklist') {
    const list = Array.isArray(row.legalChecklist) ? row.legalChecklist : [];
    const checklistBudget = list.reduce((sum, item) => sum + (item.amount || 0), 0);
    const totalAmt =
      checklistBudget > 0
        ? checklistBudget
        : parseNumericValue(row.values?.total_legal_budget) || parseNumericValue(val);
    const completedCount = list.filter((i) => i.status === 'Completed').length;

    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpenChecklist();
        }}
        className="w-full px-2 py-1 bg-amber-950/70 hover:bg-amber-900 border border-amber-700/70 text-amber-200 rounded font-medium text-xs flex items-center justify-between transition-colors shadow-xs group cursor-pointer"
        title="Open Legal Fees & Compliance Checklist - Click to manage vouchers & amounts"
      >
        <span className="font-mono font-semibold text-emerald-300 tabular-nums truncate">
          {formatCurrencyPHP(totalAmt)}
        </span>
        <span className="text-[10px] text-amber-400 font-sans ml-1 flex items-center gap-0.5 shrink-0">
          {list.length > 0 ? `${completedCount}/${list.length}` : 'Vouchers'} &rarr;
        </span>
      </button>
    );
  }

  // 5. Amount (₱) in Philippine Peso
  if (col.type === 'amount') {
    if (val === undefined || val === null || String(val).trim() === '') {
      return <span className="text-slate-600 font-mono text-right block">-</span>;
    }
    const num = typeof val === 'number' ? (isNaN(val) ? 0 : val) : parseNumericValue(val);
    return (
      <span className="font-mono text-emerald-400 font-semibold tabular-nums text-right block">
        {formatCurrencyPHP(num)}
      </span>
    );
  }

  // 5.5 Number formatted with thousands commas
  if (col.type === 'number') {
    if (val === undefined || val === null || String(val).trim() === '') {
      return <span className="text-slate-600 font-mono text-right block">-</span>;
    }
    const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/,/g, ''));
    return (
      <span className="font-mono text-slate-200 font-medium tabular-nums text-right block">
        {!isNaN(num) ? num.toLocaleString('en-PH') : String(val)}
      </span>
    );
  }

  // 6. Percent (%)
  if (col.type === 'percent') {
    const pct = typeof val === 'number' ? val : parseFloat(String(val)) || 0;
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${
              pct >= 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-sky-500' : 'bg-amber-500'
            }`}
            style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
          />
        </div>
        <span className="font-mono text-[11px] text-slate-300 w-8 text-right tabular-nums">
          {pct}%
        </span>
      </div>
    );
  }

  // 7. Status dropdown / badge
  if (col.type === 'status') {
    const isDelayed = String(val).toLowerCase().includes('delayed') || String(val).toLowerCase().includes('critical');
    const isDone = String(val).toLowerCase().includes('completed');
    const isPreCon = String(val).toLowerCase().includes('pre-con');

    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-semibold border ${
          isDelayed
            ? 'bg-rose-950 text-rose-300 border-rose-800'
            : isDone
            ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
            : isPreCon
            ? 'bg-amber-950 text-amber-300 border-amber-800'
            : 'bg-sky-950 text-sky-300 border-sky-800'
        }`}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            isDelayed ? 'bg-rose-400' : isDone ? 'bg-emerald-400' : isPreCon ? 'bg-amber-400' : 'bg-sky-400'
          }`}
        />
        {val || 'Site Hunting'}
      </span>
    );
  }

  // 8 & 9. Image or PDF Uploadable Cell (Supports Direct In-Cell Upload, Drag & Drop, Preview, Replace, Download)
  if (col.type === 'image' || col.type === 'pdf') {
    const fileInfo = parseFileCell(val, col.type);

    if (isUploading) {
      return (
        <div
          className={`flex items-center gap-1.5 text-xs font-medium py-0.5 ${
            col.type === 'pdf' ? 'text-rose-400' : 'text-sky-400'
          }`}
        >
          <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
          <span className="truncate text-[11px]">
            Uploading {col.type === 'pdf' ? 'PDF document' : 'photo'}...
          </span>
        </div>
      );
    }

    if (!fileInfo) {
      const isPdfCol = col.type === 'pdf';
      return (
        <div
          onClick={(e) => {
            e.stopPropagation();
            if (onTriggerFileUpload && canEdit)
              onTriggerFileUpload(row.id, col.id, col.type as 'image' | 'pdf');
          }}
          className={`w-full flex items-center justify-between py-1 px-2 rounded-md border border-dashed transition-all group/upload cursor-pointer ${
            isDraggingOver
              ? isPdfCol
                ? 'border-rose-400 bg-rose-950/60 text-rose-200 ring-2 ring-rose-500/50'
                : 'border-emerald-400 bg-emerald-950/60 text-emerald-200 ring-2 ring-emerald-500/50'
              : isPdfCol
              ? 'border-slate-700/80 hover:border-rose-400 bg-slate-900/60 hover:bg-rose-950/40 text-slate-400 hover:text-rose-300'
              : 'border-slate-700/80 hover:border-sky-400 bg-slate-900/60 hover:bg-sky-950/40 text-slate-400 hover:text-sky-300'
          }`}
          title={`Click to select ${isPdfCol ? 'PDF or Photo' : 'Photo or PDF'} or drag & drop file directly into this cell`}
        >
          <span className="flex items-center gap-1.5 truncate text-[11px] font-medium">
            {isPdfCol ? (
              <FileText className="w-3.5 h-3.5 text-rose-400 group-hover/upload:scale-110 transition-transform shrink-0" />
            ) : (
              <ImageIcon className="w-3.5 h-3.5 text-sky-400 group-hover/upload:scale-110 transition-transform shrink-0" />
            )}
            <span className="truncate">
              {isDraggingOver
                ? isPdfCol
                  ? 'Drop PDF / Photo Here'
                  : 'Drop Photo / PDF Here'
                : isPdfCol
                ? 'Upload PDF / Photo'
                : 'Upload Photo'}
            </span>
          </span>
          <span
            className={`text-[10px] font-bold px-1.5 py-0.2 rounded transition-colors shrink-0 ${
              isPdfCol
                ? 'text-rose-300 group-hover/upload:text-white bg-slate-800 group-hover/upload:bg-rose-600'
                : 'text-sky-300 group-hover/upload:text-white bg-slate-800 group-hover/upload:bg-sky-600'
            }`}
          >
            + Add
          </span>
        </div>
      );
    }

    // Has file: dynamically render based on detected file type
    const isImageFile = fileInfo.type === 'image';

    return (
      <div
        className={`w-full flex items-center justify-between gap-1.5 py-0.5 ${
          isImageFile ? 'group/photo' : 'group/pdf'
        }`}
      >
        <div
          className="flex items-center gap-2 truncate cursor-pointer flex-1 min-w-0"
          onClick={(e) => {
            e.stopPropagation();
            if (onOpenPreview) onOpenPreview(row, col, fileInfo);
          }}
          title={`Click to preview & inspect: ${fileInfo.name}`}
        >
          {isImageFile ? (
            <img
              src={fileInfo.url}
              alt={fileInfo.name}
              className="w-7 h-6 rounded object-cover border border-slate-700 shadow-xs hover:ring-2 hover:ring-sky-400 transition-all shrink-0 bg-slate-950"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="p-1 rounded bg-rose-950/80 text-rose-400 border border-rose-800/80 shrink-0">
              <FileText className="w-3.5 h-3.5" />
            </div>
          )}
          <div className="truncate text-left leading-tight min-w-0">
            <span
              className={`text-[11px] font-medium truncate block ${
                isImageFile
                  ? 'text-slate-200 hover:text-sky-300'
                  : 'text-slate-200 hover:text-rose-300'
              }`}
            >
              {fileInfo.name}
            </span>
            {fileInfo.size && (
              <span className="text-[9px] text-slate-500 font-mono block">
                {fileInfo.size}
              </span>
            )}
          </div>
        </div>

        {/* Action icons on hover */}
        <div
          className={`flex items-center gap-0.5 opacity-0 ${
            isImageFile ? 'group-hover/photo:opacity-100' : 'group-hover/pdf:opacity-100'
          } transition-opacity shrink-0 bg-slate-900/95 rounded px-1 py-0.5 border border-slate-800`}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onOpenPreview) onOpenPreview(row, col, fileInfo);
            }}
            className={`p-1 text-slate-400 rounded hover:bg-slate-800 transition-colors ${
              isImageFile ? 'hover:text-sky-300' : 'hover:text-rose-300'
            }`}
            title={`Preview ${isImageFile ? 'Photo' : 'PDF'}`}
          >
            <Eye className="w-3 h-3" />
          </button>
          {canEdit && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onTriggerFileUpload && canEdit)
                  onTriggerFileUpload(row.id, col.id, col.type as 'image' | 'pdf');
              }}
              className="p-1 text-slate-400 hover:text-emerald-300 rounded hover:bg-slate-800 transition-colors"
              title="Replace / Upload New File"
            >
              <Upload className="w-3 h-3" />
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onDownloadFile) onDownloadFile(fileInfo.url, fileInfo.name);
            }}
            className="p-1 text-slate-400 hover:text-sky-300 rounded hover:bg-slate-800 transition-colors"
            title="Download File"
          >
            <Download className="w-3 h-3" />
          </button>
          {canEdit && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onRemoveFile) onRemoveFile(row.id, col.id);
              }}
              className="p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-800 transition-colors"
              title="Delete File"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // 10. Checkbox
  if (col.type === 'checkbox') {
    return (
      <div className="flex items-center justify-center">
        {val ? (
          <CheckSquare className="w-4 h-4 text-emerald-400" />
        ) : (
          <Square className="w-4 h-4 text-slate-600" />
        )}
      </div>
    );
  }

  // 11. Date column with uniform formatting and Calendar icon
  if (col.type === 'date') {
    if (!val) return <span className="text-slate-500 text-[11px] italic">No date</span>;
    const formatted = formatDateDisplay(val, dateFormatPreference);
    return (
      <div className="flex items-center gap-1.5 font-mono text-slate-200">
        <Calendar className="w-3.5 h-3.5 text-sky-400 shrink-0" />
        <span>{formatted}</span>
      </div>
    );
  }

  // 12. SLA Trigger Date (Day 0 Start Date)
  if (col.type === 'sla_trigger_date' || col.id === 'sla_trigger_date') {
    const triggerDateVal = val || row.slaData?.triggerDate;
    if (!triggerDateVal) return <span className="text-slate-500 text-[11px] italic">Not set</span>;
    const formatted = formatDateDisplay(triggerDateVal, dateFormatPreference);
    return (
      <div
        onClick={(e) => {
          e.stopPropagation();
          onOpenSla();
        }}
        className="flex items-center gap-1.5 font-mono text-amber-300 font-bold hover:text-amber-200 cursor-pointer group"
        title="SLA Trigger Date (Day 0 Start) · Click to view SLA Roadmap"
      >
        <Calendar className="w-3.5 h-3.5 text-amber-400 shrink-0 group-hover:scale-110 transition-transform" />
        <span>{formatted}</span>
        <span className="text-[10px] text-amber-400/80 px-1 py-0.2 rounded bg-amber-950/60 border border-amber-800/60 font-sans font-normal ml-0.5">
          Day 0
        </span>
      </div>
    );
  }

  // 13. SLA Health Alert Badge
  if (col.type === 'sla_health' || col.id === 'sla_health_col') {
    const health = row.slaData?.slaHealth || 'on_track';
    const textVal = String(val || (health === 'critical' ? 'CRITICAL (14d+)' : health === 'delayed' ? 'Delayed' : health === 'approaching' ? 'Warning' : 'On Track'));
    const isCritical = health === 'critical' || textVal.toLowerCase().includes('critical');
    const isDelayed = health === 'delayed' || textVal.toLowerCase().includes('delay');
    const isApproaching = health === 'approaching' || textVal.toLowerCase().includes('warning');

    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpenSla();
        }}
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold border transition-all cursor-pointer ${
          isCritical
            ? 'bg-rose-950/80 text-rose-300 border-rose-700 hover:bg-rose-900'
            : isDelayed
            ? 'bg-amber-950/80 text-amber-300 border-amber-700 hover:bg-amber-900'
            : isApproaching
            ? 'bg-yellow-950/80 text-yellow-300 border-yellow-700 hover:bg-yellow-900'
            : 'bg-emerald-950/80 text-emerald-300 border-emerald-700 hover:bg-emerald-900'
        }`}
        title="Click to inspect site SLA details & milestones"
      >
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            isCritical
              ? 'bg-rose-400 animate-ping'
              : isDelayed
              ? 'bg-amber-400'
              : isApproaching
              ? 'bg-yellow-400'
              : 'bg-emerald-400'
          }`}
        />
        <span className="truncate max-w-[130px]">{textVal}</span>
      </button>
    );
  }

  // Default string / number text
  return <span className="text-slate-200">{val !== undefined && val !== null ? String(val) : ''}</span>;
}

/**
 * Generate pagination button numbers with ellipses
 */
function getPageNumbers(currentPage: number, totalPages: number): (number | string)[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages: (number | string)[] = [1];
  if (currentPage > 3) {
    pages.push('...');
  }
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }
  if (currentPage < totalPages - 2) {
    pages.push('...');
  }
  pages.push(totalPages);
  return pages;
}
