import React, { useState } from 'react';
import { SlaHistoryColumn } from '../types/tracker';
import {
  X,
  Plus,
  Eye,
  EyeOff,
  Trash2,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Check,
  Sliders,
  Sparkles,
} from 'lucide-react';

export const DEFAULT_SLA_HISTORY_COLUMNS: SlaHistoryColumn[] = [
  { id: 'date', label: 'DATE', type: 'date', width: 120, visible: true },
  { id: 'status', label: 'STATUS (DROPDOWN)', type: 'status', width: 170, visible: true },
  { id: 'progressUpdate', label: 'DAY-BY-DAY PROGRESS / UPDATES', type: 'textarea', width: 300, visible: true },
  { id: 'detailsRemarks', label: 'DETAILS / REMARKS', type: 'textarea', width: 260, visible: true },
  { id: 'trackingRule', label: 'SLA TRACKING RULE', type: 'text', width: 180, visible: true },
  { id: 'loggedBy', label: 'LOGGED BY', type: 'staff', width: 140, visible: true },
];

interface CustomizeSlaColumnsModalProps {
  isOpen: boolean;
  onClose: () => void;
  columns: SlaHistoryColumn[];
  onSaveColumns: (newColumns: SlaHistoryColumn[]) => void;
}

export const CustomizeSlaColumnsModal: React.FC<CustomizeSlaColumnsModalProps> = ({
  isOpen,
  onClose,
  columns,
  onSaveColumns,
}) => {
  if (!isOpen) return null;

  const [cols, setCols] = useState<SlaHistoryColumn[]>(() => {
    if (Array.isArray(columns) && columns.length > 0) {
      return JSON.parse(JSON.stringify(columns));
    }
    return JSON.parse(JSON.stringify(DEFAULT_SLA_HISTORY_COLUMNS));
  });

  const [newLabel, setNewLabel] = useState('');
  const [newType, setNewType] = useState<SlaHistoryColumn['type']>('text');

  const handleToggleVisible = (id: string) => {
    setCols((prev) =>
      prev.map((c) => (c.id === id ? { ...c, visible: !c.visible } : c))
    );
  };

  const handleLabelChange = (id: string, label: string) => {
    setCols((prev) =>
      prev.map((c) => (c.id === id ? { ...c, label } : c))
    );
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    setCols((prev) => {
      const next = [...prev];
      const temp = next[index - 1];
      next[index - 1] = next[index];
      next[index] = temp;
      return next;
    });
  };

  const handleMoveDown = (index: number) => {
    if (index === cols.length - 1) return;
    setCols((prev) => {
      const next = [...prev];
      const temp = next[index + 1];
      next[index + 1] = next[index];
      next[index] = temp;
      return next;
    });
  };

  const handleDeleteColumn = (id: string) => {
    setCols((prev) => prev.filter((c) => c.id !== id));
  };

  const handleAddColumn = () => {
    if (!newLabel.trim()) return;
    const colId = 'col_' + Date.now().toString(36);
    const created: SlaHistoryColumn = {
      id: colId,
      label: newLabel.trim().toUpperCase(),
      type: newType,
      width: newType === 'textarea' ? 260 : 160,
      visible: true,
      isCustom: true,
    };
    setCols((prev) => [...prev, created]);
    setNewLabel('');
  };

  const handleQuickAdd = (label: string, type: SlaHistoryColumn['type']) => {
    const colId = 'col_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 5);
    const created: SlaHistoryColumn = {
      id: colId,
      label: label.toUpperCase(),
      type,
      width: type === 'textarea' ? 260 : 160,
      visible: true,
      isCustom: true,
    };
    setCols((prev) => [...prev, created]);
  };

  const handleResetDefaults = () => {
    if (confirm('Reset columns to standard default SLA Tracker columns?')) {
      setCols(JSON.parse(JSON.stringify(DEFAULT_SLA_HISTORY_COLUMNS)));
    }
  };

  const handleSave = () => {
    onSaveColumns(cols);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 backdrop-blur-xs p-3">
      <div className="relative w-full max-w-2xl flex flex-col rounded-xl bg-slate-900 border border-slate-700 text-slate-100 shadow-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-4 h-4 text-sky-400" />
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">
                Customize Day-by-Day SLA Columns
              </h3>
              <p className="text-[11px] text-slate-400">
                Rename headers, reorder, show/hide, or add custom columns for faster encoding
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Column List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
              Active Table Columns ({cols.length})
            </span>

            <div className="divide-y divide-slate-800 border border-slate-800 rounded-lg bg-slate-950/70 overflow-hidden">
              {cols.map((col, idx) => (
                <div
                  key={col.id}
                  className={`p-2.5 flex items-center justify-between gap-3 transition-colors ${
                    !col.visible ? 'opacity-40 bg-slate-900/40' : 'hover:bg-slate-900/60'
                  }`}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-[11px] font-mono text-slate-500 w-5 text-center">
                      {idx + 1}
                    </span>

                    <input
                      type="text"
                      value={col.label}
                      onChange={(e) => handleLabelChange(col.id, e.target.value)}
                      className="px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs font-semibold text-white focus:outline-hidden focus:border-sky-400 flex-1 min-w-0 uppercase"
                      placeholder="Column Header Name"
                    />

                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-800 text-sky-300 border border-slate-700 shrink-0">
                      {col.type}
                    </span>

                    {col.isCustom && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-950 text-amber-300 border border-amber-800 shrink-0">
                        Custom
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleVisible(col.id)}
                      className={`p-1 rounded text-xs transition-colors ${
                        col.visible
                          ? 'text-emerald-400 hover:bg-emerald-950'
                          : 'text-slate-500 hover:bg-slate-800'
                      }`}
                      title={col.visible ? 'Visible (Click to Hide)' : 'Hidden (Click to Show)'}
                    >
                      {col.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleMoveUp(idx)}
                      disabled={idx === 0}
                      className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-20 transition-colors"
                      title="Move Up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleMoveDown(idx)}
                      disabled={idx === cols.length - 1}
                      className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-20 transition-colors"
                      title="Move Down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>

                    {col.isCustom && (
                      <button
                        type="button"
                        onClick={() => handleDeleteColumn(col.id)}
                        className="p-1 rounded text-rose-400 hover:text-rose-200 hover:bg-rose-950 transition-colors"
                        title="Delete Column"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Add Presets */}
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Quick Add Presets for SLA Tracking
            </span>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => handleQuickAdd('Contractor', 'text')}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-[11px] font-medium transition-colors"
              >
                + Contractor
              </button>
              <button
                type="button"
                onClick={() => handleQuickAdd('Delay Reason', 'text')}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-[11px] font-medium transition-colors"
              >
                + Delay Reason
              </button>
              <button
                type="button"
                onClick={() => handleQuickAdd('Escrow / Fee (PHP)', 'number')}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-[11px] font-medium transition-colors"
              >
                + Fee (₱)
              </button>
              <button
                type="button"
                onClick={() => handleQuickAdd('Milestone Target', 'text')}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-[11px] font-medium transition-colors"
              >
                + Milestone Target
              </button>
              <button
                type="button"
                onClick={() => handleQuickAdd('Document Reference #', 'text')}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-[11px] font-medium transition-colors"
              >
                + Doc Ref #
              </button>
              <button
                type="button"
                onClick={() => handleQuickAdd('Site Coordinates Verified', 'text')}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-[11px] font-medium transition-colors"
              >
                + Coordinates Verified
              </button>
            </div>
          </div>

          {/* Add Custom Column Section */}
          <div className="p-3.5 rounded-lg bg-slate-800/80 border border-slate-700 space-y-3">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-indigo-400" />
              Add Custom Column
            </span>

            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="e.g. SUB-CON PIC, REMARKS 2, DELAY CODE"
                className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-sky-400 flex-1 min-w-[180px]"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddColumn();
                }}
              />

              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as any)}
                className="px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs text-slate-200 font-medium focus:outline-hidden"
              >
                <option value="text">Single Line Text</option>
                <option value="textarea">Multi-line Notes / Remarks</option>
                <option value="date">Date (YYYY-MM-DD)</option>
                <option value="status">Status Dropdown</option>
                <option value="number">Number / Amount</option>
                <option value="staff">Staff / Handler</option>
              </select>

              <button
                type="button"
                onClick={handleAddColumn}
                disabled={!newLabel.trim()}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded text-xs font-bold transition-colors shrink-0"
              >
                + Add Column
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-3 py-1.5 text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset to Standard Defaults
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <Check className="w-3.5 h-3.5" />
              Save & Apply Columns
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
