import React, { useState, useRef } from 'react';
import { TrackerRow, LegalChecklistItem } from '../types/tracker';
import {
  formatCurrencyPHP,
  parseNumericValue,
  exportChecklistToExcel,
  parseChecklistFromExcel,
  readExcelFile,
  copyToExcelClipboard,
  parseExcelClipboardText,
  normalizeToStandardDate,
  getLocalDateString,
} from '../utils/excelUtils';
import {
  ShieldCheck,
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  FileUp,
  Plus,
  X,
  ExternalLink,
  Upload,
  Trash2,
  CheckCircle,
  Clock,
  AlertCircle,
  Copy,
  ClipboardPaste,
} from 'lucide-react';

interface LegalFeesChecklistModalProps {
  row: TrackerRow;
  isOpen: boolean;
  onClose: () => void;
  onUpdateRowChecklist: (updatedRow: TrackerRow) => void;
}

export const LegalFeesChecklistModal: React.FC<LegalFeesChecklistModalProps> = ({
  row,
  isOpen,
  onClose,
  onUpdateRowChecklist,
}) => {
  if (!isOpen) return null;

  const [checklist, setChecklist] = useState<LegalChecklistItem[]>(() =>
    JSON.parse(JSON.stringify(row.legalChecklist || []))
  );

  React.useEffect(() => {
    setChecklist(JSON.parse(JSON.stringify(row.legalChecklist || [])));
  }, [row.id, row.updatedAt]);

  const [activeCategory, setActiveCategory] = useState<'ALL' | 'Legal' | 'Permit' | 'Social' | 'Clearance'>('ALL');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [previewDocumentUrl, setPreviewDocumentUrl] = useState<string | null>(null);

  // Excel File Import State
  const excelInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingExcelImport, setPendingExcelImport] = useState<{
    fileName: string;
    items: LegalChecklistItem[];
    mode: 'append' | 'replace';
  } | null>(null);

  // New item form - DEFAULT LEGAL FEES MUST BE 0.00
  const [newReq, setNewReq] = useState('');
  const [newCat, setNewCat] = useState<'Legal' | 'Permit' | 'Social' | 'Clearance'>('Legal');
  const [newStatus, setNewStatus] = useState<'Completed' | 'In Progress' | 'Pending' | 'Under Review'>('Pending');
  const [newAmount, setNewAmount] = useState<number>(0);
  const [newStaff, setNewStaff] = useState(row.values.pic_handler || 'Gaela Alonzo');
  const [newSop, setNewSop] = useState('SOP-LEG-01');

  // KPI Calculations
  const totalCount = checklist.length;
  const completedItems = checklist.filter((i) => i.status === 'Completed');
  const completedCount = completedItems.length;
  const inProgressCount = checklist.filter((i) => i.status === 'In Progress' || i.status === 'Under Review').length;
  const totalBudget = checklist.reduce((sum, i) => sum + (i.amount || 0), 0);
  const disbursedFees = completedItems.reduce((sum, i) => sum + (i.amount || 0), 0);
  const completionPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const saveUpdatedChecklist = (newItems: LegalChecklistItem[]) => {
    setChecklist(newItems);
    const newTotalBudget = newItems.reduce((sum, i) => sum + (i.amount || 0), 0);
    const newDisbursed = newItems.filter((i) => i.status === 'Completed').reduce((sum, i) => sum + (i.amount || 0), 0);

    const updatedRow: TrackerRow = {
      ...row,
      legalChecklist: newItems,
      values: {
        ...row.values,
        total_legal_budget: newTotalBudget,
        disbursed_legal_fees: newDisbursed,
        col_1791563118637: newTotalBudget,
        col_1791562589543: formatCurrencyPHP(newTotalBudget),
      },
      updatedAt: new Date().toISOString(),
    };
    onUpdateRowChecklist(updatedRow);
  };

  const handleStatusChange = (id: string, nextStatus: LegalChecklistItem['status']) => {
    const updated = checklist.map((item) => {
      if (item.id === id) {
        return {
          ...item,
          status: nextStatus,
          completionDate: nextStatus === 'Completed' ? new Date().toISOString().slice(0, 10) : item.completionDate,
        };
      }
      return item;
    });
    saveUpdatedChecklist(updated);
  };

  const handleAmountChange = (id: string, amount: number) => {
    const updated = checklist.map((item) => (item.id === id ? { ...item, amount } : item));
    saveUpdatedChecklist(updated);
  };

  const handleDeleteItem = (id: string) => {
    const updated = checklist.filter((item) => item.id !== id);
    saveUpdatedChecklist(updated);
  };

  const handleAddNewItem = () => {
    if (!newReq.trim()) {
      alert('Please enter requirement title.');
      return;
    }
    const created: LegalChecklistItem = {
      id: 'chk_' + Date.now().toString(),
      requirement: newReq.trim(),
      category: newCat,
      status: newStatus,
      amount: newAmount,
      assignedStaff: newStaff,
      submissionDate: new Date().toISOString().slice(0, 10),
      completionDate: newStatus === 'Completed' ? new Date().toISOString().slice(0, 10) : undefined,
      sopRef: newSop,
    };
    const updated = [...checklist, created];
    saveUpdatedChecklist(updated);
    setNewReq('');
    setShowAddForm(false);
  };

  const handleFileUpload = (itemId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.type.includes('pdf');
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const updated = checklist.map((item) => {
        if (item.id === itemId) {
          return {
            ...item,
            fileAttachment: {
              name: file.name,
              type: (isPdf ? 'pdf' : 'jpg') as 'pdf' | 'jpg',
              url: dataUrl,
              size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
            },
          };
        }
        return item;
      });
      saveUpdatedChecklist(updated);
    };
    reader.readAsDataURL(file);
  };

  const handleExcelFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const rawRows = await readExcelFile(file);
      const parsedItems = parseChecklistFromExcel(rawRows);
      if (parsedItems.length === 0) {
        alert('No valid checklist items could be identified in the file. Please ensure columns include requirement names.');
        if (e.target) e.target.value = '';
        return;
      }
      setPendingExcelImport({
        fileName: file.name,
        items: parsedItems,
        mode: 'append',
      });
    } catch (err: any) {
      console.error('Error importing Excel checklist:', err);
      alert('Failed to read Excel file: ' + (err?.message || 'Invalid format'));
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  const handleConfirmExcelImport = () => {
    if (!pendingExcelImport) return;
    const { items, mode } = pendingExcelImport;
    const nextChecklist = mode === 'replace' ? items : [...checklist, ...items];
    saveUpdatedChecklist(nextChecklist);
    const count = items.length;
    setPendingExcelImport(null);
    alert(`Successfully ${mode === 'replace' ? 'replaced with' : 'appended'} ${count} checklist items!`);
  };

  const handleCopyChecklistToClipboard = async () => {
    const data = [
      ['Requirement', 'Category', 'Status', 'Amount (PHP)', 'Staff', 'Submission', 'Completion', 'SOP'],
      ...checklist.map((i) => [
        i.requirement,
        i.category,
        i.status,
        String(i.amount !== undefined ? i.amount : 0),
        i.assignedStaff,
        i.submissionDate,
        i.completionDate || '',
        i.sopRef,
      ]),
    ];
    const success = await copyToExcelClipboard(data);
    if (success) {
      alert('Checklist copied to clipboard! You can paste directly into Excel.');
    }
  };

  const handlePasteChecklistFromExcel = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const rows = parseExcelClipboardText(text);
      if (rows.length === 0) return;

      const newItems: LegalChecklistItem[] = [];
      for (const r of rows) {
        if (!r[0] || r[0].toLowerCase().includes('requirement')) continue; // skip header
        newItems.push({
          id: 'pasted_' + Date.now() + Math.random().toString(36).substring(2, 6),
          requirement: r[0],
          category: (r[1] as any) || 'Legal',
          status: (r[2] as any) || 'Pending',
          amount: parseNumericValue(r[3]) || 0, // DEFAULT MUST BE 0.00
          assignedStaff: r[4] || 'Atty. R. Santos',
          submissionDate: normalizeToStandardDate(r[5]) || getLocalDateString(),
          completionDate: r[6] ? normalizeToStandardDate(r[6]) : undefined,
          sopRef: r[7] || 'SOP-LEG-01',
        });
      }

      if (newItems.length > 0) {
        saveUpdatedChecklist([...checklist, ...newItems]);
        alert(`Successfully imported ${newItems.length} checklist items from clipboard!`);
      }
    } catch (err) {
      alert('Please allow clipboard access to paste from Excel.');
    }
  };

  const filteredChecklist = checklist.filter((item) => {
    if (activeCategory === 'ALL') return true;
    return item.category === activeCategory;
  });

  const sitePhotoUrl =
    row.siteDetails?.referencePhotoUrl ||
    'https://images.unsplash.com/photo-1541888946425-d0fbb186c5f7?auto=format&fit=crop&w=1200&q=80';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-2 md:p-6 overflow-y-auto">
      <div className="relative w-full max-w-6xl max-h-[96vh] flex flex-col rounded-xl bg-slate-900 border border-slate-700 text-slate-100 shadow-2xl overflow-hidden">
        {/* Header Bar matching Screenshot 1 */}
        <div className="px-6 py-3.5 border-b border-slate-800 bg-slate-950 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-blue-950 text-blue-400 border border-blue-800/80">
              {row.id}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  LEGAL FEES & COMPLIANCE CHECKLIST
                </h2>
                <span className="text-xs px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-800">
                  Per-Site Clickable Checklist
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {row.siteDetails?.siteName || row.values?.site_name || row.siteId} · {row.siteDetails?.region || 'NCR / Metro Manila'} · PIC:{' '}
                <strong className="text-slate-200">{row.siteDetails?.picHandler || row.values?.pic_handler || 'Gaela Alonzo'}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyChecklistToClipboard}
              className="px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md flex items-center gap-1.5 transition-colors"
              title="Copy checklist table to clipboard for Excel"
            >
              <Copy className="w-3.5 h-3.5" />
              Copy
            </button>
            <button
              type="button"
              onClick={handlePasteChecklistFromExcel}
              className="px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md flex items-center gap-1.5 transition-colors"
              title="Paste items copied from Excel"
            >
              <ClipboardPaste className="w-3.5 h-3.5" />
              Paste
            </button>
            <button
              type="button"
              onClick={() => exportChecklistToExcel(checklist, row.siteId)}
              className="px-3 py-1.5 text-xs font-medium text-emerald-300 hover:text-emerald-200 bg-emerald-950/40 hover:bg-emerald-900/40 border border-emerald-800/60 rounded-md flex items-center gap-1.5 transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Excel Template
            </button>
            {/* Accept Import from Excel (.xlsx, .xls, .csv) */}
            <input
              type="file"
              ref={excelInputRef}
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleExcelFileSelect}
            />
            <button
              type="button"
              onClick={() => excelInputRef.current?.click()}
              className="px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:text-white bg-emerald-900/60 hover:bg-emerald-800/80 border border-emerald-600/60 rounded-md flex items-center gap-1.5 transition-colors shadow-xs"
              title="Import legal fees & compliance checklist from Excel file (.xlsx, .xls, .csv)"
            >
              <FileUp className="w-3.5 h-3.5 text-emerald-400" />
              Import Excel
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-md flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Requirement
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

        {/* Site Reference Photo Banner matching Screenshot 1 */}
        <div className="px-6 py-2.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <div
              onClick={() => setShowPhotoModal(true)}
              className="w-10 h-7 rounded border border-slate-700 overflow-hidden cursor-pointer hover:opacity-80 transition-opacity bg-slate-950"
            >
              <img
                src={sitePhotoUrl}
                alt="Site Preview"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <div className="text-slate-200 font-medium flex items-center gap-2">
                <span>Site Reference Photo: {row.id}</span>
                <span className="text-slate-500">·</span>
                <span className="text-sky-400">Stage: {row.values.status || 'Site Hunting'}</span>
              </div>
              <div className="text-[11px] text-slate-400">
                Official telecommunication antenna tower & ground coordinates photo reference. Click thumbnail to enlarge.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowPhotoModal(true)}
            className="text-xs text-sky-400 hover:text-sky-300 font-medium flex items-center gap-1"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            View Full Site Photo
          </button>
        </div>

        {/* KPI Counter Cards matching Screenshot 1 */}
        <div className="px-6 py-4 bg-slate-950/60 border-b border-slate-800 grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
            <div className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Total Requirements</div>
            <div className="text-xl font-bold font-mono text-white mt-1">{totalCount}</div>
          </div>

          <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-900/60">
            <div className="text-[11px] uppercase tracking-wider text-emerald-400 font-medium">Completed</div>
            <div className="text-xl font-bold font-mono text-emerald-300 mt-1">
              {completedCount} <span className="text-xs text-emerald-400/80 font-normal">({completionPct}%)</span>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-amber-950/30 border border-amber-900/60">
            <div className="text-[11px] uppercase tracking-wider text-amber-400 font-medium">In Progress / Submitted</div>
            <div className="text-xl font-bold font-mono text-amber-300 mt-1">{inProgressCount}</div>
          </div>

          <div className="p-3 rounded-lg bg-blue-950/30 border border-blue-900/60">
            <div className="text-[11px] uppercase tracking-wider text-blue-400 font-medium">Total Legal Budget</div>
            <div className="text-xl font-bold font-mono text-blue-300 mt-1 tabular-nums">
              {formatCurrencyPHP(totalBudget)}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-teal-950/30 border border-teal-900/60">
            <div className="text-[11px] uppercase tracking-wider text-teal-400 font-medium">Completed Fees Disbursed</div>
            <div className="text-xl font-bold font-mono text-teal-300 mt-1 tabular-nums">
              {formatCurrencyPHP(disbursedFees)}
            </div>
          </div>
        </div>

        {/* Filter Tabs matching Screenshot 1 */}
        <div className="px-6 py-3 border-b border-slate-800 bg-slate-900 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-lg border border-slate-800">
            {(['ALL', 'Legal', 'Permit', 'Social', 'Clearance'] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                  activeCategory === cat
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="text-xs text-slate-400 flex items-center gap-2">
            <span className="flex items-center gap-1 text-sky-400">
              <ImageIcon className="w-3.5 h-3.5" />
              {row.documents?.length || 2} reference pictures attached
            </span>
            <span>·</span>
            <span>Showing {filteredChecklist.length} requirements</span>
          </div>
        </div>

        {/* Add Requirement Form */}
        {showAddForm && (
          <div className="m-6 p-4 rounded-xl bg-slate-800 border border-indigo-500/50 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-700 pb-2">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-indigo-400" />
                Add New Statutory / Legal Requirement
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
              <div className="md:col-span-2">
                <label className="block text-slate-300 font-semibold mb-1">Requirement Name</label>
                <input
                  type="text"
                  value={newReq}
                  onChange={(e) => setNewReq(e.target.value)}
                  placeholder="e.g. Zoning Locational Clearance Certificate"
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-white"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Category</label>
                <select
                  value={newCat}
                  onChange={(e) => setNewCat(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-white"
                >
                  <option value="Legal">Legal</option>
                  <option value="Permit">Permit</option>
                  <option value="Social">Social</option>
                  <option value="Clearance">Clearance</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Budget Amount (₱)</label>
                <input
                  type="number"
                  value={newAmount}
                  onChange={(e) => setNewAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Initial Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-white"
                >
                  <option value="Pending">Pending</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Under Review">Under Review</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Assigned Staff / Counsel</label>
                <input
                  type="text"
                  value={newStaff}
                  onChange={(e) => setNewStaff(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-white"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">SOP Reference Code</label>
                <input
                  type="text"
                  value={newSop}
                  onChange={(e) => setNewSop(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-white"
                />
              </div>
            </div>

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
                onClick={handleAddNewItem}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-bold"
              >
                Save Requirement
              </button>
            </div>
          </div>
        )}

        {/* Checklist Table Body matching Screenshot 1 */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/60">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 border-b border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="py-2.5 px-3 w-10 text-center">✓</th>
                  <th className="py-2.5 px-4 min-w-[240px]">REQUIREMENT</th>
                  <th className="py-2.5 px-3 w-28">CATEGORY</th>
                  <th className="py-2.5 px-3 w-36">STATUS</th>
                  <th className="py-2.5 px-3 w-32 text-right">AMOUNT (₱)</th>
                  <th className="py-2.5 px-3 w-36">ASSIGNED STAFF</th>
                  <th className="py-2.5 px-3 w-28">SUBMISSION</th>
                  <th className="py-2.5 px-3 w-28">COMPLETION</th>
                  <th className="py-2.5 px-3 w-28">SOP REF</th>
                  <th className="py-2.5 px-3 w-24 text-center">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredChecklist.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-500">
                      No requirements in this category. Click "+ Add Requirement" or import from Excel.
                    </td>
                  </tr>
                ) : (
                  filteredChecklist.map((item) => {
                    const isDone = item.status === 'Completed';
                    const isInProgress = item.status === 'In Progress';
                    const isReview = item.status === 'Under Review';

                    return (
                      <tr key={item.id} className="hover:bg-slate-900/50 transition-colors">
                        {/* Checkbox */}
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleStatusChange(item.id, isDone ? 'Pending' : 'Completed')}
                            className={`p-1 rounded transition-colors ${
                              isDone ? 'text-emerald-400' : 'text-slate-600 hover:text-slate-400'
                            }`}
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        </td>

                        {/* Requirement description */}
                        <td className="py-3 px-4 text-slate-200">
                          <div className="font-medium">{item.requirement}</div>
                          {item.fileAttachment && (
                            <div className="flex items-center gap-2 mt-1">
                              <button
                                type="button"
                                onClick={() => setPreviewDocumentUrl(item.fileAttachment?.url || '')}
                                className="inline-flex items-center gap-1 text-[11px] text-sky-400 hover:underline"
                              >
                                {item.fileAttachment.type === 'pdf' ? (
                                  <FileText className="w-3 h-3" />
                                ) : (
                                  <ImageIcon className="w-3 h-3" />
                                )}
                                {item.fileAttachment.name} ({item.fileAttachment.size || 'Attachment'})
                              </button>
                            </div>
                          )}
                        </td>

                        {/* Category badge */}
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase ${
                              item.category === 'Legal'
                                ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                : item.category === 'Permit'
                                ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                : item.category === 'Social'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                : 'bg-purple-950 text-purple-300 border border-purple-800'
                            }`}
                          >
                            {item.category}
                          </span>
                        </td>

                        {/* Status dropdown */}
                        <td className="py-3 px-3">
                          <select
                            value={item.status}
                            onChange={(e) => handleStatusChange(item.id, e.target.value as any)}
                            className={`px-2 py-1 rounded text-xs font-semibold border focus:outline-hidden ${
                              isDone
                                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700'
                                : isInProgress
                                ? 'bg-amber-950/80 text-amber-300 border-amber-700'
                                : isReview
                                ? 'bg-sky-950/80 text-sky-300 border-sky-700'
                                : 'bg-slate-900 text-slate-400 border-slate-700'
                            }`}
                          >
                            <option value="Completed">Completed</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Under Review">Under Review</option>
                            <option value="Pending">Pending</option>
                          </select>
                        </td>

                        {/* Amount */}
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-slate-500 font-mono text-xs">₱</span>
                            <input
                              type="text"
                              defaultValue={item.amount !== undefined ? Number(item.amount).toLocaleString('en-PH') : '0'}
                              key={`amt_${item.id}_${item.amount}`}
                              onBlur={(e) => {
                                const parsed = parseNumericValue(e.target.value);
                                handleAmountChange(item.id, parsed);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  const parsed = parseNumericValue((e.target as HTMLInputElement).value);
                                  handleAmountChange(item.id, parsed);
                                  (e.target as HTMLInputElement).blur();
                                }
                              }}
                              className="w-24 px-1.5 py-0.5 bg-slate-950 border border-slate-700/80 hover:border-emerald-500 focus:border-emerald-400 rounded text-right font-mono font-semibold text-xs text-emerald-300 tabular-nums focus:outline-hidden"
                              title="Click or press Enter to update amount"
                            />
                          </div>
                        </td>

                        {/* Assigned Staff */}
                        <td className="py-3 px-3 text-slate-300 font-medium">{item.assignedStaff}</td>

                        {/* Dates */}
                        <td className="py-3 px-3 font-mono text-slate-400 text-[11px]">{item.submissionDate}</td>
                        <td className="py-3 px-3 font-mono text-slate-300 text-[11px]">
                          {item.completionDate || '—'}
                        </td>

                        {/* SOP Ref */}
                        <td className="py-3 px-3 font-mono text-[11px] text-slate-400">{item.sopRef}</td>

                        {/* Actions */}
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <label className="p-1 text-slate-400 hover:text-sky-300 cursor-pointer rounded hover:bg-slate-800">
                              <Upload className="w-3.5 h-3.5" />
                              <input
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png"
                                className="hidden"
                                onChange={(e) => handleFileUpload(item.id, e)}
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => handleDeleteItem(item.id)}
                              className="p-1 text-rose-400 hover:text-rose-300 rounded hover:bg-rose-950/40"
                              title="Delete requirement"
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

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Per-Site Legal Checklist Active: Attached reference pictures, milestone compliance, and amounts persist directly to site row.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded font-semibold transition-colors"
          >
            Close Checklist
          </button>
        </div>
      </div>

      {/* Full Photo Modal */}
      {showPhotoModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/95 p-4">
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
            <button
              onClick={() => setShowPhotoModal(false)}
              className="absolute top-2 right-2 p-2 bg-black/70 text-white rounded-full hover:bg-black"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={sitePhotoUrl}
              alt="Site Full Resolution"
              className="max-h-[80vh] w-auto rounded-lg object-contain border border-slate-700"
              referrerPolicy="no-referrer"
            />
            <div className="text-center text-xs text-slate-300 mt-2">
              {row.siteDetails?.siteName || row.siteId} — {row.siteDetails?.towerHeight || 'Tower'} · Coordinates: {row.siteDetails?.coordinates?.lat ?? 14.5995}, {row.siteDetails?.coordinates?.lng ?? 120.9842}
            </div>
          </div>
        </div>
      )}

      {/* PDF / Document preview modal */}
      {previewDocumentUrl && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/95 p-4">
          <div className="relative w-full max-w-4xl h-[85vh] bg-slate-900 border border-slate-700 rounded-xl flex flex-col overflow-hidden">
            <div className="p-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-sky-400" />
                Document Attachment Preview
              </span>
              <button
                onClick={() => setPreviewDocumentUrl(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 bg-slate-950 p-4 flex items-center justify-center">
              <img
                src={previewDocumentUrl}
                alt="Document attachment"
                className="max-h-full max-w-full object-contain rounded"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
