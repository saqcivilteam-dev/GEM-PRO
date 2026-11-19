import React, { useState } from 'react';
import { Tracker, TrackerFolder, ColumnDefinition, SlaScopeType } from '../types/tracker';
import { SLA_SCOPE_PRESETS } from '../utils/excelUtils';
import {
  X,
  Plus,
  Table,
  Target,
  Sparkles,
  Layers,
  Folder,
  Check,
  Radio,
  FileSpreadsheet,
  Boxes,
  Building2,
  FileText,
  Clock,
} from 'lucide-react';

interface CreateTrackerModalProps {
  isOpen: boolean;
  onClose: () => void;
  folders: TrackerFolder[];
  defaultFolderId?: string;
  onCreateTracker: (newTracker: Tracker) => void;
  existingTrackersCount: number;
}

type TrackerTemplateType = 'telecom_saq' | 'civil_works' | 'asset_inventory' | 'blank_grid';

interface TemplateOption {
  id: TrackerTemplateType;
  title: string;
  description: string;
  icon: React.FC<{ className?: string }>;
  color: string;
  defaultSla: boolean;
  suggestedScope: SlaScopeType;
}

const TEMPLATES: TemplateOption[] = [
  {
    id: 'telecom_saq',
    title: 'Telecom SAQ & Tower Rollout',
    description: 'Day-by-Day SAQ SLA tracking (21d/156d), legal checklist, site dossiers, and delay warnings.',
    icon: Building2,
    color: 'indigo',
    defaultSla: true,
    suggestedScope: 'post_con_21d',
  },
  {
    id: 'civil_works',
    title: 'Civil Works & Construction',
    description: 'Structural milestones, contractor assignments, legal budget, and completion % (No SLA).',
    icon: Layers,
    color: 'emerald',
    defaultSla: false,
    suggestedScope: 'custom',
  },
  {
    id: 'asset_inventory',
    title: 'Hardware & Asset Inventory',
    description: 'Track equipment, serial numbers, stock, unit costs, and warehouse locations (No SLA).',
    icon: Boxes,
    color: 'amber',
    defaultSla: false,
    suggestedScope: 'custom',
  },
  {
    id: 'blank_grid',
    title: 'Clean Blank Spreadsheet',
    description: 'Minimal clean Excel grid with standard columns (ID, Name, Status, Date, Amount, Notes).',
    icon: FileSpreadsheet,
    color: 'sky',
    defaultSla: false,
    suggestedScope: 'custom',
  },
];

export const CreateTrackerModal: React.FC<CreateTrackerModalProps> = ({
  isOpen,
  onClose,
  folders,
  defaultFolderId,
  onCreateTracker,
  existingTrackersCount,
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState<TrackerTemplateType>('telecom_saq');
  const [trackerName, setTrackerName] = useState(`Project Tracker ${existingTrackersCount + 1}`);
  const [selectedFolderId, setSelectedFolderId] = useState<string>(
    defaultFolderId || folders[0]?.id || 'folder_civil'
  );
  const [enableSla, setEnableSla] = useState<boolean>(true);
  const [selectedSlaScope, setSelectedSlaScope] = useState<SlaScopeType>('post_con_21d');
  const [description, setDescription] = useState(
    'Customizable Excel-style tracker with multi-column spreadsheet management.'
  );

  if (!isOpen) return null;

  const handleSelectTemplate = (tpl: TemplateOption) => {
    setSelectedTemplate(tpl.id);
    setEnableSla(tpl.defaultSla);
    setSelectedSlaScope(tpl.suggestedScope);

    if (tpl.id === 'telecom_saq') {
      setDescription('Comprehensive SAQ tracker monitoring tower rollouts, SLA triggers, legal permits, and civil progress.');
    } else if (tpl.id === 'civil_works') {
      setDescription('Standard civil construction log tracking contractor deliverables, site works, and budgets without SLA.');
    } else if (tpl.id === 'asset_inventory') {
      setDescription('Asset and warehouse inventory tracking hardware items, serials, and locations without SLA.');
    } else {
      setDescription('Blank spreadsheet for custom column definitions and data entry.');
    }
  };

  const handleCreate = () => {
    const cleanName = trackerName.trim() || `Project Tracker ${existingTrackersCount + 1}`;
    const newId = 'tracker_' + Date.now().toString();

    let columns: ColumnDefinition[] = [];

    if (selectedTemplate === 'telecom_saq') {
      columns = [
        { id: 'site_id', label: 'Site ID', type: 'site_id', width: 140, visible: true, frozen: true },
        { id: 'site_name', label: 'Site Name & Location', type: 'text', width: 230, visible: true, frozen: true },
        { id: 'status', label: 'Current Status', type: 'status', width: 150, visible: true, summaryType: 'count' },
        ...(enableSla
          ? [
              { id: 'daily_sla', label: 'DAILY STATUS / SAQ SLA', type: 'day_sla' as const, width: 190, visible: true },
              { id: 'sla_trigger_date', label: 'SLA Trigger (Day 0)', type: 'sla_trigger_date' as const, width: 165, visible: true },
              { id: 'sla_health_col', label: 'SLA Health Alert', type: 'sla_health' as const, width: 170, visible: true },
            ]
          : []),
        { id: 'legal_checklist', label: 'Legal Fees & Checklist', type: 'legal_checklist', width: 190, visible: true },
        { id: 'data_button', label: 'Full Site Data', type: 'data_drawer', width: 120, visible: true },
        { id: 'data_2_button', label: 'DATA 2 (Different Encode)', type: 'data_drawer_2', width: 140, visible: true },
        { id: 'total_legal_budget', label: 'Legal Budget (₱)', type: 'amount', width: 160, visible: true, summaryType: 'sum' },
        { id: 'disbursed_legal_fees', label: 'Disbursed (₱)', type: 'amount', width: 150, visible: true, summaryType: 'sum' },
        { id: 'pic_handler', label: 'PIC / Project Handler', type: 'text', width: 160, visible: true },
        { id: 'target_on_air_date', label: 'Target Date', type: 'date', width: 130, visible: true },
        { id: 'completion_pct', label: 'Progress (%)', type: 'percent', width: 120, visible: true, summaryType: 'avg' },
        { id: 'reference_photo', label: 'Site Photo', type: 'image', width: 175, visible: true },
        { id: 'permit_doc_pdf', label: 'Documents (PDF)', type: 'pdf', width: 185, visible: true },
      ];
    } else if (selectedTemplate === 'civil_works') {
      columns = [
        { id: 'site_id', label: 'Site / Project ID', type: 'site_id', width: 140, visible: true, frozen: true },
        { id: 'site_name', label: 'Location & Scope', type: 'text', width: 240, visible: true, frozen: true },
        { id: 'status', label: 'Construction Status', type: 'status', width: 150, visible: true, summaryType: 'count' },
        ...(enableSla
          ? [
              { id: 'daily_sla', label: 'SLA Tracking', type: 'day_sla' as const, width: 180, visible: true },
              { id: 'sla_trigger_date', label: 'Start Date (Day 0)', type: 'sla_trigger_date' as const, width: 160, visible: true },
            ]
          : []),
        { id: 'contractor', label: 'Civil Contractor', type: 'text', width: 180, visible: true },
        { id: 'pic_handler', label: 'Project Engineer / PIC', type: 'text', width: 160, visible: true },
        { id: 'total_legal_budget', label: 'Budget Amount (₱)', type: 'amount', width: 160, visible: true, summaryType: 'sum' },
        { id: 'disbursed_legal_fees', label: 'Disbursed (₱)', type: 'amount', width: 150, visible: true, summaryType: 'sum' },
        { id: 'target_on_air_date', label: 'Target Completion', type: 'date', width: 140, visible: true },
        { id: 'completion_pct', label: 'Completion %', type: 'percent', width: 120, visible: true, summaryType: 'avg' },
        { id: 'data_button', label: 'Site Specs', type: 'data_drawer', width: 120, visible: true },
        { id: 'reference_photo', label: 'Progress Photo', type: 'image', width: 170, visible: true },
      ];
    } else if (selectedTemplate === 'asset_inventory') {
      columns = [
        { id: 'site_id', label: 'Asset Tag #', type: 'site_id', width: 140, visible: true, frozen: true },
        { id: 'site_name', label: 'Item Name & Model', type: 'text', width: 240, visible: true, frozen: true },
        { id: 'status', label: 'Stock Condition', type: 'status', width: 150, visible: true, summaryType: 'count' },
        { id: 'category', label: 'Category', type: 'dropdown', width: 150, visible: true, options: ['Antenna', 'RRU', 'Power / Genset', 'Fiber Cable', 'Battery Bank', 'Cabinet'] },
        { id: 'serial_no', label: 'Serial Number', type: 'text', width: 160, visible: true },
        { id: 'quantity', label: 'Quantity', type: 'number', width: 110, visible: true, summaryType: 'sum' },
        { id: 'total_legal_budget', label: 'Unit Cost (₱)', type: 'amount', width: 150, visible: true, summaryType: 'avg' },
        { id: 'disbursed_legal_fees', label: 'Total Value (₱)', type: 'amount', width: 160, visible: true, summaryType: 'sum' },
        { id: 'pic_handler', label: 'Assigned Custodian', type: 'text', width: 160, visible: true },
        { id: 'target_on_air_date', label: 'Acquisition Date', type: 'date', width: 140, visible: true },
        { id: 'reference_photo', label: 'Item Photo', type: 'image', width: 160, visible: true },
      ];
    } else {
      // Blank Grid
      columns = [
        { id: 'site_id', label: 'Item / Site ID', type: 'site_id', width: 140, visible: true, frozen: true },
        { id: 'site_name', label: 'Title / Description', type: 'text', width: 240, visible: true, frozen: true },
        { id: 'status', label: 'Status', type: 'status', width: 150, visible: true, summaryType: 'count' },
        ...(enableSla
          ? [
              { id: 'daily_sla', label: 'SLA Tracker', type: 'day_sla' as const, width: 180, visible: true },
              { id: 'sla_trigger_date', label: 'Trigger Date', type: 'sla_trigger_date' as const, width: 160, visible: true },
            ]
          : []),
        { id: 'target_on_air_date', label: 'Date', type: 'date', width: 130, visible: true },
        { id: 'total_legal_budget', label: 'Amount (₱)', type: 'amount', width: 150, visible: true, summaryType: 'sum' },
        { id: 'pic_handler', label: 'Assigned To', type: 'text', width: 160, visible: true },
        { id: 'remarks', label: 'Remarks / Notes', type: 'text', width: 220, visible: true },
      ];
    }

    const matchedScope = SLA_SCOPE_PRESETS.find((p) => p.scopeType === selectedSlaScope) || SLA_SCOPE_PRESETS[0];

    const newTracker: Tracker = {
      id: newId,
      name: cleanName,
      folderId: selectedFolderId,
      description: description.trim(),
      frozenColumns: 2,
      frozenRows: 0,
      enableSla: enableSla,
      slaConfig: enableSla
        ? {
            enabled: true,
            scopeType: matchedScope.scopeType,
            scopeName: matchedScope.scopeName,
            targetDays: matchedScope.targetDays,
            description: matchedScope.description,
            milestones: JSON.parse(JSON.stringify(matchedScope.milestones)),
          }
        : {
            enabled: false,
            scopeType: 'custom',
            scopeName: 'No SLA (Standard Spreadsheet)',
            targetDays: 0,
            milestones: [],
          },
      statusOptions: [
        { label: 'Site Hunting / Inbound', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.15)' },
        { label: 'Under Review', color: '#a855f7', bg: 'rgba(168, 85, 247, 0.15)' },
        { label: 'Pre-Con / Pending', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
        { label: 'Completed / Active', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' },
        { label: 'Delayed / Critical', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' },
      ],
      columns,
      dashboardCards: [
        { id: 'c1', title: 'Total Items', metricType: 'total_sites', colorTheme: 'sky' },
        { id: 'c2', title: 'Total Amount (₱)', metricType: 'total_budget_amount', colorTheme: 'emerald' },
        ...(enableSla
          ? [{ id: 'c3', title: 'Inactivity & Delays', metricType: 'no_movement_14d' as const, colorTheme: 'crimson' as const }]
          : []),
      ],
      rows: [],
      isLocked: false,
      requireAdminApprovalForEdits: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onCreateTracker(newTracker);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <Table className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Create New Project Tracker
              </h2>
              <p className="text-xs text-slate-400">
                Choose template, folder destination, and configure whether this tracker requires SLA tracking.
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

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* Tracker Name & Folder Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Tracker Name:</label>
              <input
                type="text"
                value={trackerName}
                onChange={(e) => setTrackerName(e.target.value)}
                placeholder="e.g. VISMIN 5G Rollout Matrix"
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white font-medium focus:outline-hidden focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Target Folder:</label>
              <select
                value={selectedFolderId}
                onChange={(e) => setSelectedFolderId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-hidden focus:border-indigo-500 cursor-pointer"
              >
                {folders.map((f) => (
                  <option key={f.id} value={f.id} className="bg-slate-900 text-white">
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Template Selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
              1. Choose Tracker Template:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {TEMPLATES.map((tpl) => {
                const Icon = tpl.icon;
                const isSelected = selectedTemplate === tpl.id;

                return (
                  <div
                    key={tpl.id}
                    onClick={() => handleSelectTemplate(tpl)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative ${
                      isSelected
                        ? 'bg-indigo-950/40 border-indigo-500 ring-2 ring-indigo-500/50 shadow-md'
                        : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div
                          className={`p-1.5 rounded-lg ${
                            isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="font-bold text-xs text-white">{tpl.title}</span>
                      </div>
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold uppercase ${
                          tpl.defaultSla
                            ? 'bg-indigo-900/80 text-indigo-300 border border-indigo-700/60'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {tpl.defaultSla ? 'SLA Preset' : 'Standard'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                      {tpl.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Prominent SLA Option Switch - Choose Where to Put SLA */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className={`w-4 h-4 ${enableSla ? 'text-amber-400' : 'text-slate-500'}`} />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  2. SAQ SLA Tracking Configuration:
                </span>
              </div>
              <span
                className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                  enableSla
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {enableSla ? 'SLA Enabled' : 'SLA Disabled (Standard Sheet)'}
              </span>
            </div>

            <label className="flex items-start gap-3 p-3 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={enableSla}
                onChange={(e) => setEnableSla(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded text-indigo-500 focus:ring-indigo-500 bg-slate-950 border-slate-700 cursor-pointer"
              />
              <div className="text-xs">
                <span className="font-bold text-slate-200 block">
                  Enable SAQ SLA Milestone & Day-by-Day Tracking on this tracker
                </span>
                <span className="text-[11px] text-slate-400 block mt-0.5 leading-relaxed">
                  {enableSla
                    ? 'This tracker will include SLA Trigger Date, Day-by-Day tracking logs, milestone countdowns, and 14-day inactivity delay alerts.'
                    : 'Unchecked: This tracker will operate as a clean standard spreadsheet without SLA columns, deadlines, or delay warnings.'}
                </span>
              </div>
            </label>

            {/* If SLA is enabled, allow picking initial SLA Scope preset */}
            {enableSla && (
              <div className="pt-2 border-t border-slate-800/80 space-y-2 animate-in fade-in">
                <label className="text-[11px] font-semibold text-slate-300 block">
                  Choose Initial SLA Scope Target:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {SLA_SCOPE_PRESETS.slice(0, 4).map((p) => (
                    <button
                      key={p.scopeType}
                      type="button"
                      onClick={() => setSelectedSlaScope(p.scopeType)}
                      className={`p-2 rounded-lg text-left text-xs border transition-all cursor-pointer ${
                        selectedSlaScope === p.scopeType
                          ? 'bg-indigo-950/80 border-indigo-500 text-white'
                          : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                      }`}
                    >
                      <div className="font-bold text-[11px] flex items-center justify-between">
                        <span>{p.scopeName}</span>
                        <span className="font-mono text-amber-400">{p.targetDays}d</span>
                      </div>
                      <div className="text-[10px] text-slate-500 truncate mt-0.5">
                        {p.milestones.length} milestones predefined
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-400">
            Mode: <strong className="text-slate-200">{enableSla ? 'SAQ SLA Enabled' : 'Standard Sheet (No SLA)'}</strong>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreate}
              className="px-5 py-2 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors flex items-center gap-1.5 shadow-md shadow-indigo-950"
            >
              <Plus className="w-4 h-4" />
              <span>Create Tracker</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
