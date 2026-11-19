import React, { useState } from 'react';
import { ColumnDefinition, ColumnType, TrackerAppearance } from '../types/tracker';
import {
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  Trash2,
  Plus,
  Sliders,
  X,
  Check,
  Palette,
  Columns,
  Layers,
  FileText,
  Calendar,
  Shield,
  DollarSign,
  Sparkles,
  Target,
} from 'lucide-react';

interface CustomizeColumnsModalProps {
  columns: ColumnDefinition[];
  appearance?: TrackerAppearance;
  frozenColumns?: number;
  frozenRows?: number;
  enableSla?: boolean;
  onOpenProjectSlaModal?: () => void;
  isOpen: boolean;
  onClose: () => void;
  onSaveColumns: (
    newColumns: ColumnDefinition[],
    newAppearance?: TrackerAppearance,
    newFrozenColumns?: number,
    newFrozenRows?: number,
    newEnableSla?: boolean
  ) => void;
}

const COLUMN_TYPE_OPTIONS: { value: ColumnType; label: string }[] = [
  { value: 'text', label: 'Text (General Info / Details / Remarks)' },
  { value: 'date', label: 'Date' },
  { value: 'status', label: 'Status Dropdown' },
  { value: 'image', label: '📸 Photo / Image (JPG, PNG, WebP) — Uploadable' },
  { value: 'pdf', label: '📄 PDF Document (.PDF File) — Uploadable' },
  { value: 'data_drawer', label: 'Data (🛡️ Per-Site / Primary Typewriter Dossier)' },
  { value: 'data_drawer_2', label: 'Data 2 (⚡ Per-Site / Different Encode & Tech Specs)' },
  { value: 'day_sla', label: 'Day-by-Day Update (🛡️ Per-Site SLA)' },
  { value: 'sla_trigger_date', label: 'SLA Trigger Date (Day 0 Start)' },
  { value: 'sla_health', label: 'SLA Health Status (Alert Badge)' },
  { value: 'amount', label: 'Amount (₱ Philippine Peso)' },
  { value: 'percent', label: 'Percent (%)' },
  { value: 'legal_checklist', label: 'Legal Checked List (🛡️ Per-Site)' },
  { value: 'number', label: 'Number' },
  { value: 'dropdown', label: 'Custom Dropdown' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'hyperlink', label: 'Hyperlink' },
];

export const CustomizeColumnsModal: React.FC<CustomizeColumnsModalProps> = ({
  columns,
  appearance,
  frozenColumns = 2,
  frozenRows = 0,
  enableSla = true,
  onOpenProjectSlaModal,
  isOpen,
  onClose,
  onSaveColumns,
}) => {
  const [activeTab, setActiveTab] = useState<'columns' | 'appearance'>('columns');
  const [slaEnabled, setSlaEnabled] = useState<boolean>(enableSla);

  // Columns state
  const [columnList, setColumnList] = useState<ColumnDefinition[]>(() =>
    JSON.parse(JSON.stringify(columns))
  );
  const [newColName, setNewColName] = useState('');
  const [newColType, setNewColType] = useState<ColumnType>('text');
  const [newColTheme, setNewColTheme] = useState('Slate');

  // Appearance state
  const [rowDensity, setRowDensity] = useState<'compact' | 'normal' | 'comfortable'>(
    appearance?.rowDensity || 'normal'
  );
  const [fontSize, setFontSize] = useState<'sm' | 'base' | 'lg'>(
    appearance?.fontSize || 'base'
  );
  const [headerTheme, setHeaderTheme] = useState<'slate' | 'navy' | 'emerald' | 'indigo' | 'amber'>(
    appearance?.headerTheme || 'slate'
  );
  const [showGridlines, setShowGridlines] = useState<boolean>(
    appearance?.showGridlines !== false
  );
  const [zebraStripes, setZebraStripes] = useState<boolean>(
    appearance?.zebraStripes ?? true
  );
  const [freezeCount, setFreezeCount] = useState<number>(frozenColumns);
  const [freezeRowsCount, setFreezeRowsCount] = useState<number>(frozenRows ?? 0);

  if (!isOpen) return null;

  const handleAddColumn = () => {
    if (!newColName.trim()) return;
    const newId = 'col_' + Date.now().toString();
    const created: ColumnDefinition = {
      id: newId,
      label: newColName.trim(),
      type: newColType,
      width:
        newColType === 'amount' ||
        newColType === 'day_sla' ||
        newColType === 'legal_checklist' ||
        newColType === 'data_drawer_2' ||
        newColType === 'image' ||
        newColType === 'pdf'
          ? 180
          : 150,
      visible: true,
      summaryType:
        newColType === 'amount'
          ? 'sum'
          : newColType === 'percent'
          ? 'avg'
          : 'none',
      colorTheme: newColTheme,
    };
    setColumnList([...columnList, created]);
    setNewColName('');
  };

  const handleQuickAddData2 = () => {
    // Check if a data_drawer_2 column already exists
    const existing = columnList.some((c) => c.type === 'data_drawer_2' || c.id === 'data_2_button');
    const newId = 'data_2_' + Date.now().toString();
    const created: ColumnDefinition = {
      id: existing ? newId : 'data_2_button',
      label: 'DATA 2 (Different Encode)',
      type: 'data_drawer_2',
      width: 140,
      visible: true,
      summaryType: 'none',
      colorTheme: 'Amber',
    };
    setColumnList([...columnList, created]);
  };

  const handleQuickAddDaySla = () => {
    const newId = 'day_sla_' + Date.now().toString();
    const created: ColumnDefinition = {
      id: newId,
      label: 'Day-by-Day SLA Updates',
      type: 'day_sla',
      width: 180,
      visible: true,
      summaryType: 'none',
      colorTheme: 'Sky',
    };
    setColumnList([...columnList, created]);
  };

  const handleQuickAddSlaTrigger = () => {
    const existing = columnList.some((c) => c.id === 'sla_trigger_date' || c.type === 'sla_trigger_date');
    const newId = existing ? 'sla_trigger_' + Date.now().toString() : 'sla_trigger_date';
    const created: ColumnDefinition = {
      id: newId,
      label: 'SLA Trigger (Day 0 Start)',
      type: 'sla_trigger_date',
      width: 175,
      visible: true,
      summaryType: 'none',
      colorTheme: 'Amber',
    };
    setColumnList([...columnList, created]);
  };

  const handleQuickAddLegalChecklist = () => {
    const newId = 'legal_' + Date.now().toString();
    const created: ColumnDefinition = {
      id: newId,
      label: 'Legal Fees Checklist',
      type: 'legal_checklist',
      width: 180,
      visible: true,
      summaryType: 'none',
      colorTheme: 'Emerald',
    };
    setColumnList([...columnList, created]);
  };

  const handleToggleVisibility = (index: number) => {
    const updated = [...columnList];
    updated[index].visible = !updated[index].visible;
    setColumnList(updated);
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const newIdx = direction === 'up' ? index - 1 : index + 1;
    if (newIdx < 0 || newIdx >= columnList.length) return;
    const updated = [...columnList];
    const [moved] = updated.splice(index, 1);
    updated.splice(newIdx, 0, moved);
    setColumnList(updated);
  };

  const handleDelete = (index: number) => {
    const target = columnList[index];
    if (target.id === 'site_id') {
      alert('Site ID column is required as the unique site reference and cannot be deleted.');
      return;
    }
    const updated = columnList.filter((_, i) => i !== index);
    setColumnList(updated);
  };

  const handleLabelChange = (index: number, newLabel: string) => {
    const updated = [...columnList];
    updated[index].label = newLabel;
    setColumnList(updated);
  };

  const handleTypeChange = (index: number, type: ColumnType) => {
    const updated = [...columnList];
    updated[index].type = type;
    if (type === 'amount') updated[index].summaryType = 'sum';
    if (type === 'percent') updated[index].summaryType = 'avg';
    setColumnList(updated);
  };

  const handleThemeChange = (index: number, colorTheme: string) => {
    const updated = [...columnList];
    updated[index].colorTheme = colorTheme;
    setColumnList(updated);
  };

  const handleSave = () => {
    const updatedAppearance: TrackerAppearance = {
      rowDensity,
      fontSize,
      headerTheme,
      showGridlines,
      zebraStripes,
    };
    onSaveColumns(columnList, updatedAppearance, freezeCount, freezeRowsCount, slaEnabled);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-3 md:p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-xl bg-slate-900 border border-slate-700 text-slate-100 shadow-2xl overflow-hidden">
        
        {/* Header matching Screenshot 1 & 2 with Tabs */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-start justify-between bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  Customize Columns & Appearance
                </h2>
                <span className="text-[11px] px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                  Interactive Studio
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Add Data 2 for different encode of data, configure columns, reorder, and customize grid styling & appearance.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs (Columns vs Appearance) */}
        <div className="px-6 pt-3 pb-0 border-b border-slate-800 bg-slate-950/40 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setActiveTab('columns')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'columns'
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Columns className="w-4 h-4 text-indigo-400" />
            <span>Columns & Data Types ({columnList.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('appearance')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'appearance'
                ? 'border-amber-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Palette className="w-4 h-4 text-amber-400" />
            <span>Grid Appearance & Density</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* TAB 1: COLUMNS MANAGER */}
          {activeTab === 'columns' && (
            <>
              {/* Quick Add Presets (Highlights Data 2) */}
              <div className="p-3.5 rounded-lg bg-gradient-to-r from-amber-950/30 via-slate-900 to-indigo-950/30 border border-amber-800/40">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>Quick Add Specialized Columns:</span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    Instant 1-click addition into current tracker
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {/* Quick Add DATA 2 button */}
                  <button
                    type="button"
                    onClick={handleQuickAddData2}
                    className="px-3 py-1.5 bg-amber-950/90 hover:bg-amber-900 border border-amber-600/90 text-amber-200 hover:text-white rounded-md text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all group cursor-pointer"
                  >
                    <Layers className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
                    <span>+ Add DATA 2 (Different Encode)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleQuickAddDaySla}
                    className="px-3 py-1.5 bg-sky-950/80 hover:bg-sky-900 border border-sky-700/80 text-sky-200 hover:text-white rounded-md text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
                  >
                    <Calendar className="w-3.5 h-3.5 text-sky-400" />
                    <span>+ Add Day-by-Day SLA</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleQuickAddSlaTrigger}
                    className="px-3 py-1.5 bg-amber-950/80 hover:bg-amber-900 border border-amber-600/80 text-amber-200 hover:text-white rounded-md text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
                  >
                    <Calendar className="w-3.5 h-3.5 text-amber-400" />
                    <span>+ Add SLA Trigger (Day 0)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleQuickAddLegalChecklist}
                    className="px-3 py-1.5 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700/80 text-emerald-200 hover:text-white rounded-md text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
                  >
                    <Shield className="w-3.5 h-3.5 text-emerald-400" />
                    <span>+ Add Legal Checklist</span>
                  </button>
                </div>
              </div>

              {/* Add Custom Column Section */}
              <div className="p-4 rounded-lg bg-slate-800/60 border border-slate-700/80">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <Plus className="w-4 h-4 text-sky-400" />
                    Add Column
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    Columns can be reordered, edited, or deleted anytime
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                  <div className="md:col-span-5">
                    <input
                      type="text"
                      value={newColName}
                      onChange={(e) => setNewColName(e.target.value)}
                      placeholder="Column Name (e.g. DATA 2, Site Survey, RF Azimuth...)"
                      className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-md text-white placeholder-slate-500 focus:outline-hidden focus:border-sky-500"
                      onKeyDown={(e) => e.key === 'Enter' && handleAddColumn()}
                    />
                  </div>
                  <div className="md:col-span-4">
                    <select
                      value={newColType}
                      onChange={(e) => setNewColType(e.target.value as ColumnType)}
                      className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-md text-white focus:outline-hidden focus:border-sky-500"
                    >
                      {COLUMN_TYPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <select
                      value={newColTheme}
                      onChange={(e) => setNewColTheme(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-md text-white focus:outline-hidden focus:border-sky-500"
                    >
                      <option value="Slate">Slate Theme</option>
                      <option value="Sky">Sky Blue</option>
                      <option value="Emerald">Emerald Green</option>
                      <option value="Amber">Amber Gold</option>
                      <option value="Crimson">Crimson Red</option>
                      <option value="Indigo">Indigo Purple</option>
                    </select>
                  </div>
                  <div className="md:col-span-1">
                    <button
                      type="button"
                      onClick={handleAddColumn}
                      className="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-xs font-semibold shadow-xs flex items-center justify-center gap-1 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add
                    </button>
                  </div>
                </div>
              </div>

              {/* Existing Columns List */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Existing Columns ({columnList.length})
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    Edit column names, types, themes, order, or delete as wanted
                  </span>
                </div>

                <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                  {columnList.map((col, idx) => {
                    const isData2 = col.type === 'data_drawer_2' || col.id === 'data_2_button';
                    return (
                      <div
                        key={col.id}
                        className={`flex items-center gap-2.5 p-2.5 rounded-lg border transition-all ${
                          isData2
                            ? 'bg-amber-950/20 border-amber-800/60 text-amber-100'
                            : col.visible
                            ? 'bg-slate-800/70 border-slate-700 text-slate-200'
                            : 'bg-slate-900/60 border-slate-800/80 text-slate-500'
                        }`}
                      >
                        {/* Visibility Eye */}
                        <button
                          type="button"
                          onClick={() => handleToggleVisibility(idx)}
                          title={col.visible ? 'Hide column' : 'Show column'}
                          className={`p-1.5 rounded transition-colors ${
                            col.visible
                              ? isData2
                                ? 'text-amber-400 hover:bg-amber-900/40'
                                : 'text-sky-400 hover:bg-slate-700'
                              : 'text-slate-500 hover:bg-slate-800'
                          }`}
                        >
                          {col.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>

                        {/* Column Label */}
                        <div className="flex-1 min-w-[140px]">
                          <input
                            type="text"
                            value={col.label}
                            onChange={(e) => handleLabelChange(idx, e.target.value)}
                            disabled={col.id === 'site_id'}
                            className="w-full px-2 py-1 text-xs bg-slate-950/70 border border-slate-700 rounded text-slate-100 font-medium focus:outline-hidden focus:border-indigo-500"
                          />
                        </div>

                        {/* Column Type */}
                        <div className="w-[185px]">
                          <select
                            value={col.type}
                            onChange={(e) => handleTypeChange(idx, e.target.value as ColumnType)}
                            disabled={col.id === 'site_id'}
                            className="w-full px-2 py-1 text-xs bg-slate-950 border border-slate-700 rounded text-slate-200 focus:outline-hidden focus:border-indigo-500"
                          >
                            {COLUMN_TYPE_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Theme badge dropdown */}
                        <div className="w-[105px]">
                          <select
                            value={col.colorTheme || 'Slate'}
                            onChange={(e) => handleThemeChange(idx, e.target.value)}
                            className="w-full px-1.5 py-1 text-[11px] bg-slate-950 border border-slate-700 rounded text-slate-300"
                          >
                            <option value="Slate">Slate</option>
                            <option value="Sky">Sky Blue</option>
                            <option value="Emerald">Emerald</option>
                            <option value="Amber">Amber</option>
                            <option value="Crimson">Crimson</option>
                            <option value="Indigo">Indigo</option>
                          </select>
                        </div>

                        {/* Summary Type */}
                        <div className="w-[90px]">
                          <select
                            value={col.summaryType || 'none'}
                            onChange={(e) => {
                              const updated = [...columnList];
                              updated[idx].summaryType = e.target.value as any;
                              setColumnList(updated);
                            }}
                            className="w-full px-1.5 py-1 text-[11px] bg-slate-950 border border-slate-700 rounded text-slate-300"
                          >
                            <option value="none">No Total</option>
                            <option value="sum">Sum (Σ)</option>
                            <option value="avg">Avg (μ)</option>
                            <option value="count">Count (N)</option>
                          </select>
                        </div>

                        {/* Order Up / Down */}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMove(idx, 'up')}
                            className="p-1 text-slate-400 hover:text-white disabled:opacity-30 rounded hover:bg-slate-700"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === columnList.length - 1}
                            onClick={() => handleMove(idx, 'down')}
                            className="p-1 text-slate-400 hover:text-white disabled:opacity-30 rounded hover:bg-slate-700"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Delete */}
                        <button
                          type="button"
                          disabled={col.id === 'site_id'}
                          onClick={() => handleDelete(idx)}
                          title={col.id === 'site_id' ? 'Site ID is protected' : 'Delete column'}
                          className="p-1 text-rose-400 hover:text-rose-300 disabled:opacity-20 rounded hover:bg-rose-950/40"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Tips note */}
              <div className="p-3 rounded-lg bg-sky-950/40 border border-sky-800/50 text-[11px] text-sky-300 flex items-center justify-between">
                <span>
                  💡 <strong>Tip:</strong> <strong>DATA 2</strong> columns allow recording a secondary, alternative encoding format (such as RF parameters, phase 2 engineering specs, custom attributes, or secondary typewriter logs) without consuming spreadsheet row height.
                </span>
              </div>
            </>
          )}

          {/* TAB 2: APPEARANCE & DISPLAY SETTINGS */}
          {activeTab === 'appearance' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* 1. Row Density */}
                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5">
                  <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider">
                    Row Density / Row Height
                  </label>
                  <p className="text-[11px] text-slate-400">
                    Control how compact or spacious rows appear in the grid
                  </p>
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    {[
                      { id: 'compact', label: 'Compact', desc: 'High density (28px)' },
                      { id: 'normal', label: 'Standard', desc: 'Balanced (36px)' },
                      { id: 'comfortable', label: 'Comfortable', desc: 'Spacious (44px)' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setRowDensity(opt.id as any)}
                        className={`p-2.5 text-center rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                          rowDensity === opt.id
                            ? 'bg-amber-950/60 border-amber-500 text-amber-200 shadow-sm'
                            : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
                        }`}
                      >
                        <div>{opt.label}</div>
                        <div className="text-[10px] text-slate-400 font-normal mt-0.5">{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Font Size */}
                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5">
                  <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider">
                    Grid Font Scale
                  </label>
                  <p className="text-[11px] text-slate-400">
                    Adjust text sizing across grid data cells and headers
                  </p>
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    {[
                      { id: 'sm', label: 'Small', desc: '11px Condensed' },
                      { id: 'base', label: 'Default', desc: '12px Standard' },
                      { id: 'lg', label: 'Large', desc: '13px High-Legibility' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setFontSize(opt.id as any)}
                        className={`p-2.5 text-center rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                          fontSize === opt.id
                            ? 'bg-amber-950/60 border-amber-500 text-amber-200 shadow-sm'
                            : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
                        }`}
                      >
                        <div>{opt.label}</div>
                        <div className="text-[10px] text-slate-400 font-normal mt-0.5">{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Grid Header Theme */}
                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5">
                  <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider">
                    Table Header Color Theme
                  </label>
                  <p className="text-[11px] text-slate-400">
                    Set the top column header banner theme
                  </p>
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    {[
                      { id: 'slate', label: 'Deep Slate', bg: 'bg-slate-800' },
                      { id: 'navy', label: 'Navy Blue', bg: 'bg-blue-900' },
                      { id: 'indigo', label: 'Indigo Night', bg: 'bg-indigo-900' },
                      { id: 'emerald', label: 'Emerald Forest', bg: 'bg-emerald-900' },
                      { id: 'amber', label: 'Amber Gold', bg: 'bg-amber-900' },
                    ].map((thm) => (
                      <button
                        key={thm.id}
                        type="button"
                        onClick={() => setHeaderTheme(thm.id as any)}
                        className={`p-2 text-center rounded-lg border text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 justify-center ${
                          headerTheme === thm.id
                            ? 'bg-slate-800 border-amber-500 text-white shadow-sm ring-1 ring-amber-500'
                            : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
                        }`}
                      >
                        <span className={`w-3 h-3 rounded-full ${thm.bg}`} />
                        <span>{thm.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 4. Freeze Panes (Columns & Rows) & Gridlines */}
                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider">
                      Freeze Panes (Sticky Columns & Rows)
                    </label>
                    <span className="text-[10px] text-sky-400 font-mono">
                      {freezeCount} Col(s) · {freezeRowsCount} Row(s)
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-400">
                    Frozen columns stay fixed on the left during horizontal scrolling. Frozen rows stay pinned beneath the table header during vertical scrolling.
                  </p>

                  <div className="space-y-3 pt-1">
                    {/* Pinned Columns */}
                    <div className="flex items-center justify-between text-xs">
                      <div>
                        <span className="text-slate-300 font-semibold block">Freeze Columns:</span>
                        <span className="text-[10px] text-slate-500">Left-side pinned columns</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {[0, 1, 2, 3, 4, 5].map((num) => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => setFreezeCount(num)}
                            className={`w-7 h-7 rounded text-xs font-bold border transition-all cursor-pointer ${
                              freezeCount === num
                                ? 'bg-sky-600 border-sky-400 text-white shadow-xs'
                                : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                            }`}
                            title={num === 0 ? 'No frozen columns' : `Freeze first ${num} column(s)`}
                          >
                            {num}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Pinned Rows */}
                    <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800/80">
                      <div>
                        <span className="text-slate-300 font-semibold block">Freeze Top Rows:</span>
                        <span className="text-[10px] text-slate-500">Pinned top records under header</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {[0, 1, 2, 3, 5].map((num) => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => setFreezeRowsCount(num)}
                            className={`w-7 h-7 rounded text-xs font-bold border transition-all cursor-pointer ${
                              freezeRowsCount === num
                                ? 'bg-indigo-600 border-indigo-400 text-white shadow-xs'
                                : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                            }`}
                            title={num === 0 ? 'No frozen rows (Header only)' : `Freeze first ${num} data row(s)`}
                          >
                            {num}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800">
                      <span className="text-slate-300">Show Table Gridlines:</span>
                      <button
                        type="button"
                        onClick={() => setShowGridlines(!showGridlines)}
                        className={`px-3 py-1 rounded text-xs font-bold border transition-colors cursor-pointer ${
                          showGridlines
                            ? 'bg-emerald-950 border-emerald-600 text-emerald-300'
                            : 'bg-slate-900 border-slate-700 text-slate-400'
                        }`}
                      >
                        {showGridlines ? 'Enabled' : 'Disabled'}
                      </button>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800">
                      <span className="text-slate-300">Zebra Row Shading:</span>
                      <button
                        type="button"
                        onClick={() => setZebraStripes(!zebraStripes)}
                        className={`px-3 py-1 rounded text-xs font-bold border transition-colors cursor-pointer ${
                          zebraStripes
                            ? 'bg-emerald-950 border-emerald-600 text-emerald-300'
                            : 'bg-slate-900 border-slate-700 text-slate-400'
                        }`}
                      >
                        {zebraStripes ? 'Enabled' : 'Disabled'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* 5. SAQ SLA Tracking for this Tracker */}
                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3 md:col-span-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Target className={`w-4 h-4 ${slaEnabled ? 'text-amber-400' : 'text-slate-500'}`} />
                      <label className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                        SAQ SLA Milestone Tracking
                      </label>
                    </div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                        slaEnabled
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {slaEnabled ? 'SLA Active' : 'SLA Disabled (Standard Sheet)'}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-400">
                    Choose whether this tracker operates with SAQ SLA Day-by-Day tracking and delay alerts, or as a clean standard spreadsheet.
                  </p>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        const next = !slaEnabled;
                        setSlaEnabled(next);
                        setColumnList((prev) =>
                          prev.map((c) =>
                            c.type === 'day_sla' || c.type === 'sla_trigger_date' || c.type === 'sla_health'
                              ? { ...c, visible: next }
                              : c
                          )
                        );
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                        slaEnabled
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                          : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                      }`}
                    >
                      <Target className="w-3.5 h-3.5" />
                      <span>{slaEnabled ? 'Disable SLA on This Tracker' : 'Enable SLA on This Tracker'}</span>
                    </button>

                    {onOpenProjectSlaModal && (
                      <button
                        type="button"
                        onClick={onOpenProjectSlaModal}
                        className="text-[11px] text-sky-400 hover:text-sky-300 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                      >
                        <span>Manage All Trackers SLA Matrix &rarr;</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Live Preview Box */}
              <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-bold text-slate-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    Live Visual Appearance Preview:
                  </span>
                  <span className="font-mono text-[11px] text-amber-400">
                    Density: {rowDensity} | Header: {headerTheme} | Scale: {fontSize}
                  </span>
                </div>

                <div className="overflow-x-auto rounded border border-slate-700/80 bg-slate-900">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className={
                        headerTheme === 'navy'
                          ? 'bg-blue-950 text-blue-100 border-b border-blue-800'
                          : headerTheme === 'indigo'
                          ? 'bg-indigo-950 text-indigo-100 border-b border-indigo-800'
                          : headerTheme === 'emerald'
                          ? 'bg-emerald-950 text-emerald-100 border-b border-emerald-800'
                          : headerTheme === 'amber'
                          ? 'bg-amber-950 text-amber-100 border-b border-amber-800'
                          : 'bg-slate-950 text-slate-200 border-b border-slate-800'
                      }>
                        <th className="px-3 py-2 text-[11px] font-bold">Site ID</th>
                        <th className="px-3 py-2 text-[11px] font-bold">Site Name</th>
                        <th className="px-3 py-2 text-[11px] font-bold">DATA</th>
                        <th className="px-3 py-2 text-[11px] font-bold">DATA 2</th>
                        <th className="px-3 py-2 text-[11px] font-bold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className={`${zebraStripes ? 'bg-slate-900' : 'bg-slate-900/60'} ${showGridlines ? 'border-b border-slate-800' : ''}`}>
                        <td className={`px-3 font-mono font-bold text-sky-400 ${
                          rowDensity === 'compact' ? 'py-1 text-[11px]' : rowDensity === 'comfortable' ? 'py-3 text-sm' : 'py-2 text-xs'
                        }`}>
                          NCR-001
                        </td>
                        <td className={`px-3 text-slate-300 ${
                          rowDensity === 'compact' ? 'py-1 text-[11px]' : rowDensity === 'comfortable' ? 'py-3 text-sm' : 'py-2 text-xs'
                        }`}>
                          Ortigas Tower 1
                        </td>
                        <td className="px-3 py-1">
                          <span className="px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-700 text-[10px] font-bold">
                            DATA &rarr;
                          </span>
                        </td>
                        <td className="px-3 py-1">
                          <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-600 text-[10px] font-bold">
                            DATA 2 &rarr;
                          </span>
                        </td>
                        <td className="px-3 py-1">
                          <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 text-[10px] font-bold">
                            Completed
                          </span>
                        </td>
                      </tr>
                      <tr className={`${zebraStripes ? 'bg-slate-950/40' : 'bg-slate-900/60'} ${showGridlines ? 'border-b border-slate-800' : ''}`}>
                        <td className={`px-3 font-mono font-bold text-sky-400 ${
                          rowDensity === 'compact' ? 'py-1 text-[11px]' : rowDensity === 'comfortable' ? 'py-3 text-sm' : 'py-2 text-xs'
                        }`}>
                          NCR-002
                        </td>
                        <td className={`px-3 text-slate-300 ${
                          rowDensity === 'compact' ? 'py-1 text-[11px]' : rowDensity === 'comfortable' ? 'py-3 text-sm' : 'py-2 text-xs'
                        }`}>
                          Pasig Greenfield
                        </td>
                        <td className="px-3 py-1">
                          <span className="px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-700 text-[10px] font-bold">
                            DATA &rarr;
                          </span>
                        </td>
                        <td className="px-3 py-1">
                          <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-600 text-[10px] font-bold">
                            DATA 2 &rarr;
                          </span>
                        </td>
                        <td className="px-3 py-1">
                          <span className="px-2 py-0.5 rounded-full bg-amber-950 text-amber-400 text-[10px] font-bold">
                            Pre-Con
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            {activeTab === 'columns'
              ? `${columnList.filter((c) => c.visible).length} visible columns of ${columnList.length} total`
              : `Density: ${rowDensity} · Header: ${headerTheme} · Frozen: ${freezeCount} col(s), ${freezeRowsCount} row(s)`}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm flex items-center gap-1.5 transition-colors"
            >
              <Check className="w-4 h-4" />
              Apply Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
