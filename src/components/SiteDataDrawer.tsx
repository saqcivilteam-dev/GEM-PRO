import React, { useState } from 'react';
import { TrackerRow, SiteDocument, CustomEncodeField, SiteData2Record } from '../types/tracker';
import { getLocalDateString, formatCurrencyPHP, parseNumericValue } from '../utils/excelUtils';
import {
  X,
  MapPin,
  Building,
  User,
  Phone,
  Layers,
  FileText,
  Image as ImageIcon,
  Upload,
  Calendar,
  Shield,
  Save,
  Trash2,
  ExternalLink,
  Clock,
  Sparkles,
  CheckCircle2,
  FolderOpen,
  Plus,
  Radio,
  Zap,
  Cpu,
  Sliders,
  Check,
  Tag,
} from 'lucide-react';

interface SiteDataDrawerProps {
  row: TrackerRow;
  initialMode?: 'data1' | 'data2';
  isOpen: boolean;
  onClose: () => void;
  onSaveRow: (updatedRow: TrackerRow) => void;
  onOpenSla: () => void;
  onOpenChecklist: () => void;
}

export const SiteDataDrawer: React.FC<SiteDataDrawerProps> = ({
  row,
  initialMode = 'data1',
  isOpen,
  onClose,
  onSaveRow,
  onOpenSla,
  onOpenChecklist,
}) => {
  if (!isOpen) return null;

  // Mode switcher: DATA 1 vs DATA 2
  const [encodeMode, setEncodeMode] = useState<'data1' | 'data2'>(initialMode);

  // --- DATA 1 STATE ---
  const [activeTab1, setActiveTab1] = useState<'typewriter' | 'details' | 'documents'>('typewriter');
  const [details, setDetails] = useState(() => JSON.parse(JSON.stringify(row.siteDetails || {})));
  const [documents, setDocuments] = useState<SiteDocument[]>(() =>
    JSON.parse(JSON.stringify(row.documents || []))
  );
  const [typewriterNotes, setTypewriterNotes] = useState<string>(
    () => details.notes || row.values?.data_notes || ''
  );
  const [fontStyle1, setFontStyle1] = useState<'courier' | 'mono'>('courier');

  // --- DATA 2 STATE (Different Encode of Data) ---
  const [activeTab2, setActiveTab2] = useState<'typewriter2' | 'techSpecs' | 'customFields' | 'documents2'>(
    'typewriter2'
  );
  const initialData2: SiteData2Record = row.siteData2 || {};
  const [data2Notes, setData2Notes] = useState<string>(
    () => initialData2.notes || row.values?.data_2_notes || ''
  );
  const [fontStyle2, setFontStyle2] = useState<'courier' | 'mono'>('courier');
  const [data2Specs, setData2Specs] = useState(() => ({
    azimuthSector1: initialData2.technicalSpecs?.azimuthSector1 || 'Sector 1: 0° (2° mech / 4° elect tilt)',
    azimuthSector2: initialData2.technicalSpecs?.azimuthSector2 || 'Sector 2: 120° (2° mech / 4° elect tilt)',
    azimuthSector3: initialData2.technicalSpecs?.azimuthSector3 || 'Sector 3: 240° (2° mech / 4° elect tilt)',
    carrierFrequencyBands: initialData2.technicalSpecs?.carrierFrequencyBands || 'LTE 700/1800/2100MHz + 5G NR 3500MHz',
    fiberPortBackhaul: initialData2.technicalSpecs?.fiberPortBackhaul || '24-Core SMF to Hub Node-NCR-04 (Port #12)',
    powerGenset: initialData2.technicalSpecs?.powerGenset || 'Meralco 3-Phase 230V + 20kVA Silent Auto-Genset (500L Tank)',
    structuralPad: initialData2.technicalSpecs?.structuralPad || 'Mat Foundation 6.5m x 6.5m x 1.2m, 3500 PSI (Soil: 180 kPa)',
    subcontractor2: initialData2.technicalSpecs?.subcontractor2 || 'Apex Telecom Civil & RF (Engr. Marco Villanueva / 0917-889-1022)',
    inspectionQcStatus: initialData2.technicalSpecs?.inspectionQcStatus || 'Passed (Acceptance Cleared & Signed)',
  }));
  const [data2CustomFields, setData2CustomFields] = useState<CustomEncodeField[]>(() =>
    initialData2.customFields?.length
      ? JSON.parse(JSON.stringify(initialData2.customFields))
      : [
          { id: 'cf_1', key: 'Barangay Resolution Ref', value: 'BR-2026-0812-NCR' },
          { id: 'cf_2', key: 'Equipment Cabinet Model', value: 'Huawei APM30H Outdoor DC Cabinet' },
          { id: 'cf_3', key: 'Aviation Hazard Lamp ID', value: 'ICAO Medium-Intensity Red Solar Lamp #882' },
        ]
  );
  const [data2Documents, setData2Documents] = useState<SiteDocument[]>(() =>
    initialData2.documents?.length ? JSON.parse(JSON.stringify(initialData2.documents)) : []
  );

  // New custom field inputs
  const [newKey, setNewKey] = useState('');
  const [newVal, setNewVal] = useState('');

  // Handlers for Data 1
  const handleFieldChange = (field: keyof typeof details, value: any) => {
    setDetails({ ...details, [field]: value });
  };

  const handleCoordinateChange = (coord: 'lat' | 'lng', val: number) => {
    setDetails({
      ...details,
      coordinates: {
        ...(details.coordinates || { lat: 14.5995, lng: 120.9842 }),
        [coord]: val,
      },
    });
  };

  const handleUploadDocument1 = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.type.includes('pdf');
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const newDoc: SiteDocument = {
        id: 'doc_' + Date.now().toString(),
        name: file.name,
        type: isPdf ? 'pdf' : 'jpg',
        url: dataUrl,
        uploadedAt: getLocalDateString(),
        tag: isPdf ? 'Regulatory PDF' : 'Site Survey Photo',
        fileSize: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
      };
      setDocuments([newDoc, ...documents]);
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteDoc1 = (id: string) => {
    setDocuments(documents.filter((d) => d.id !== id));
  };

  const handleInsertTimestamp1 = () => {
    const nowStr = `[${getLocalDateString()} ${new Date().toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}] - `;
    setTypewriterNotes((prev) => (prev ? prev + '\n' + nowStr : nowStr));
  };

  // Handlers for Data 2
  const handleInsertTimestamp2 = () => {
    const nowStr = `[${getLocalDateString()} ${new Date().toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}] - `;
    setData2Notes((prev) => (prev ? prev + '\n' + nowStr : nowStr));
  };

  const handleInsertSnippet2 = (snippetType: 'rf' | 'civil' | 'fiber' | 'acceptance') => {
    let snippetText = '';
    const datePrefix = `[${getLocalDateString()}] - `;
    if (snippetType === 'rf') {
      snippetText = `${datePrefix}ENCODED RF & ANTENNA LAYOUT:\n- Sector 1: Azimuth 0°, Elec Tilt 4°, Feeder 7/8"\n- Sector 2: Azimuth 120°, Elec Tilt 4°, Feeder 7/8"\n- Sector 3: Azimuth 240°, Elec Tilt 4°, Feeder 7/8"\n- Antennas: Kathrein 6-Port Quad-Band Panel Antenna\n- TMA/RRU: Huawei RRU5502 4T4R mounted at 34m elevation`;
    } else if (snippetType === 'civil') {
      snippetText = `${datePrefix}ENCODED CIVIL FOUNDATION SPECIFICATION:\n- Structure: 36m 4-Legged Self-Supporting Greenfield Tower\n- Foundation: Reinforced Concrete Raft Slab 6.5m x 6.5m x 1.2m\n- Concrete Strength: 3,500 PSI at 28-day cure\n- Rebar: Grade 60 (20mm main bars, 12mm stirrups)\n- Soil Bearing Capacity: 180 kPa verified by Soil Test Drill Log #ST-01`;
    } else if (snippetType === 'fiber') {
      snippetText = `${datePrefix}ENCODED OPTICAL TRANSMISSION & BACKHAUL:\n- Route: Underground 24-core single mode optical fiber\n- Node Hub: Node-NCR-04 (Rack R02, Shelf 03)\n- Splice Enclosure: Dome Closure #FST-44 at base pole\n- Tested Loss: 0.22 dB/km across 1310nm/1550nm\n- Primary Link: 10 Gbps IP-RAN Interface`;
    } else if (snippetType === 'acceptance') {
      snippetText = `${datePrefix}ENCODED PHASE 2 FINAL ACCEPTANCE RECORD:\n- Lead Inspector: Engr. Marco Villanueva (PECE #11842)\n- Quality Check: 100% passed, Zero critical punchlist items\n- Electrical Grounding: Tower ground ring reading 3.8 Ohms (<= 5 Ohms pass)\n- Handover Certificate: Signed by Client & Consortium representative`;
    }

    setData2Notes((prev) => (prev ? prev + '\n\n' + snippetText : snippetText));
  };

  const handleAddCustomField = () => {
    if (!newKey.trim()) return;
    const item: CustomEncodeField = {
      id: 'cf_' + Date.now().toString(),
      key: newKey.trim(),
      value: newVal.trim() || 'N/A',
    };
    setData2CustomFields([...data2CustomFields, item]);
    setNewKey('');
    setNewVal('');
  };

  const handleDeleteCustomField = (id: string) => {
    setData2CustomFields(data2CustomFields.filter((f) => f.id !== id));
  };

  const handleUpdateCustomField = (id: string, key: string, value: string) => {
    setData2CustomFields(
      data2CustomFields.map((f) => (f.id === id ? { ...f, key, value } : f))
    );
  };

  const handleUploadDocument2 = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.type.includes('pdf');
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const newDoc: SiteDocument = {
        id: 'doc2_' + Date.now().toString(),
        name: file.name,
        type: isPdf ? 'pdf' : 'jpg',
        url: dataUrl,
        uploadedAt: getLocalDateString(),
        tag: isPdf ? 'Phase 2 Blueprint / As-Built' : 'Phase 2 Inspection Photo',
        fileSize: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
      };
      setData2Documents([newDoc, ...data2Documents]);
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteDoc2 = (id: string) => {
    setData2Documents(data2Documents.filter((d) => d.id !== id));
  };

  // Master Save Handler
  const handleSaveAll = () => {
    const updatedDetails = {
      ...details,
      notes: typewriterNotes,
    };

    const updatedSiteData2: SiteData2Record = {
      notes: data2Notes,
      category: 'Telecom & Technical Infrastructure',
      technicalSpecs: data2Specs,
      customFields: data2CustomFields,
      documents: data2Documents,
      updatedAt: new Date().toISOString(),
    };

    const cleanSiteId = details.siteId?.trim() || row.siteId;
    const updated: TrackerRow = {
      ...row,
      siteId: cleanSiteId,
      siteDetails: { ...updatedDetails, siteId: cleanSiteId },
      siteData2: updatedSiteData2,
      documents: documents,
      values: {
        ...row.values,
        site_id: cleanSiteId,
        data_button: 'DATA',
        data_notes: typewriterNotes,
        data_2_button: 'DATA 2',
        data_2_notes: data2Notes,
        site_name: details.siteName || row.values?.site_name,
        pic_handler: details.picHandler || row.values?.pic_handler,
        landlord_contact: details.landlordName
          ? `${details.landlordName} (${details.landlordContact || 'N/A'})`
          : row.values?.landlord_contact,
      },
      updatedAt: new Date().toISOString(),
    };

    onSaveRow(updated);
    onClose();
  };

  const completedChecklistCount = (row.legalChecklist || []).filter(
    (i) => i.status === 'Completed'
  ).length;
  const totalChecklistCount = (row.legalChecklist || []).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-3 md:p-6 overflow-y-auto animate-in fade-in duration-150">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl bg-slate-900 border border-slate-700 text-slate-100 shadow-2xl overflow-hidden">
        
        {/* Top Header Bar with Mode Switcher */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Top Left Site ID Badge */}
            <span className="px-3 py-1 rounded bg-blue-950 text-blue-400 border border-blue-600 font-mono font-bold text-xs tracking-wider shadow-inner">
              {details.siteId || row.siteId || 'WK07'}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-white tracking-wide flex items-center gap-2">
                  {encodeMode === 'data1' ? (
                    <>
                      <FileText className="w-5 h-5 text-indigo-400" />
                      <span>DATA</span>
                    </>
                  ) : (
                    <>
                      <Layers className="w-5 h-5 text-amber-400" />
                      <span>DATA 2</span>
                    </>
                  )}
                </h2>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${
                  encodeMode === 'data1'
                    ? 'bg-indigo-950 text-indigo-300 border-indigo-700'
                    : 'bg-amber-950 text-amber-300 border-amber-600'
                }`}>
                  {encodeMode === 'data1' ? 'Primary Dossier' : 'Different Encode'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 hidden sm:block">
                {encodeMode === 'data1'
                  ? 'Encode full site details & typewriter notes without consuming row height'
                  : 'Alternative data encoding for secondary technical specs, RF parameters, and custom attributes'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Dataset Switcher between DATA 1 and DATA 2 */}
            <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg">
              <button
                type="button"
                onClick={() => setEncodeMode('data1')}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                  encodeMode === 'data1'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>DATA 1</span>
              </button>
              <button
                type="button"
                onClick={() => setEncodeMode('data2')}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                  encodeMode === 'data2'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>DATA 2</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors ml-1"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          
          {/* Top 2 Interactive Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* 1. Day-by-Day SLA Tracker Card */}
            <button
              type="button"
              onClick={onOpenSla}
              className="p-3.5 rounded-xl bg-sky-950/40 hover:bg-sky-950/70 border border-sky-800/80 hover:border-sky-600 text-left transition-all flex items-center justify-between group shadow-sm cursor-pointer"
              title="Click to land on Day-by-Day SLA Tracker"
            >
              <div className="flex items-start gap-2.5">
                <Calendar className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-sky-300 group-hover:text-sky-200 flex items-center gap-1">
                    Day-by-Day SLA Tracker
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Status: <strong className="text-slate-200">{details.picHandler || row.values?.pic_handler || 'QUINTO, JHENG'}</strong> ({row.slaData?.slaHealth || 'on_track'})
                  </div>
                </div>
              </div>
              <span className="text-sky-400 font-bold text-sm group-hover:translate-x-1 transition-transform ml-2">
                &rarr;
              </span>
            </button>

            {/* 2. Legal Fees & Compliance Card */}
            <button
              type="button"
              onClick={onOpenChecklist}
              className="p-3.5 rounded-xl bg-emerald-950/40 hover:bg-emerald-950/70 border border-emerald-800/80 hover:border-emerald-600 text-left transition-all flex items-center justify-between group shadow-sm cursor-pointer"
              title="Click to land on Legal Fees & Compliance Checklist"
            >
              <div className="flex items-start gap-2.5">
                <Shield className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-emerald-300 group-hover:text-emerald-200 flex items-center gap-1">
                    Legal Fees & Compliance
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                    <strong className="text-emerald-400">{completedChecklistCount} / {totalChecklistCount}</strong> Done
                    <span className="text-slate-600">·</span>
                    <span className="font-mono font-semibold text-emerald-300">
                      {formatCurrencyPHP(
                        (row.legalChecklist || []).reduce((sum, i) => sum + (i.amount || 0), 0) ||
                        parseNumericValue(row.values?.total_legal_budget)
                      )}
                    </span>
                  </div>
                </div>
              </div>
              <span className="text-emerald-400 font-bold text-sm group-hover:translate-x-1 transition-transform ml-2">
                &rarr;
              </span>
            </button>
          </div>

          {/* ============================================================== */}
          {/* VIEW A: DATA 1 (PRIMARY DOSSIER) */}
          {/* ============================================================== */}
          {encodeMode === 'data1' && (
            <div className="space-y-4">
              {/* Section Navigation Tabs */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab1('typewriter')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ${
                      activeTab1 === 'typewriter'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white bg-slate-950/60 border border-slate-800'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Typewriter Data Encoder</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab1('details')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ${
                      activeTab1 === 'details'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white bg-slate-950/60 border border-slate-800'
                    }`}
                  >
                    <Building className="w-3.5 h-3.5" />
                    <span>Site Details & Specs</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab1('documents')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ${
                      activeTab1 === 'documents'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white bg-slate-950/60 border border-slate-800'
                    }`}
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>Documents & Photos ({documents.length})</span>
                  </button>
                </div>

                {activeTab1 === 'typewriter' && (
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={handleInsertTimestamp1}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-mono flex items-center gap-1 transition-colors"
                      title="Insert timestamp into notes"
                    >
                      <Clock className="w-3 h-3 text-sky-400" />
                      <span>+ Timestamp</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFontStyle1(fontStyle1 === 'courier' ? 'mono' : 'courier')}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-mono transition-colors"
                      title="Toggle typewriter font"
                    >
                      Font: {fontStyle1 === 'courier' ? 'Typewriter (Courier)' : 'JetBrains Mono'}
                    </button>
                  </div>
                )}
              </div>

              {/* TAB 1.1: TYPEWRITER ALL-DATA ENCODER */}
              {activeTab1 === 'typewriter' && (
                <div className="space-y-2">
                  <div className="relative rounded-xl border border-slate-700 bg-slate-950 shadow-inner overflow-hidden">
                    <div className="px-3.5 py-1.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="font-semibold text-slate-300">Typewriter Data Encoding Sheet (DATA 1)</span>
                        <span className="text-slate-600">|</span>
                        <span className="text-slate-400">All data encoded here without consuming spreadsheet row height</span>
                      </div>
                      <div className="font-mono text-[10px] text-slate-500">
                        {typewriterNotes.length} chars · {typewriterNotes.split(/\s+/).filter(Boolean).length} words
                      </div>
                    </div>

                    <textarea
                      rows={14}
                      value={typewriterNotes}
                      onChange={(e) => setTypewriterNotes(e.target.value)}
                      style={{
                        fontFamily:
                          fontStyle1 === 'courier'
                            ? "'Courier New', Courier, 'Lucida Console', Monaco, monospace"
                            : "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                      }}
                      placeholder="ill type all data here i want to used type writer form..."
                      className="w-full p-4 md:p-5 bg-slate-950 text-slate-100 text-sm leading-relaxed tracking-wider placeholder-slate-600 focus:outline-hidden resize-y min-h-[300px] selection:bg-indigo-600 selection:text-white"
                    />
                  </div>

                  <div className="text-[11px] text-slate-400 flex items-center justify-between px-1">
                    <span>💡 Tip: Click <strong>Save Site Details</strong> below to save all your encoded notes and site data back into the tracker row.</span>
                    <span className="font-mono text-emerald-400">No Row Height Expansion</span>
                  </div>
                </div>
              )}

              {/* TAB 1.2: STRUCTURED SITE DETAILS & SPECS */}
              {activeTab1 === 'details' && (
                <div className="space-y-4">
                  <div className="rounded-xl bg-slate-950/80 border border-slate-800 p-4 space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                      <Building className="w-4 h-4 text-sky-400" />
                      Site Identity & Structure
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                      <div>
                        <label className="block text-slate-400 mb-1 font-mono font-bold text-sky-400">Site ID</label>
                        <input
                          type="text"
                          value={details.siteId || row.siteId || ''}
                          onChange={(e) => handleFieldChange('siteId', e.target.value)}
                          placeholder="e.g. WK03"
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-sky-600/80 rounded text-sky-300 font-mono font-bold focus:outline-hidden focus:border-sky-400"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">Site Official Name</label>
                        <input
                          type="text"
                          value={details.siteName || ''}
                          onChange={(e) => handleFieldChange('siteName', e.target.value)}
                          placeholder="Candidate site name"
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">Tower Structure & Height</label>
                        <input
                          type="text"
                          value={details.towerHeight || ''}
                          onChange={(e) => handleFieldChange('towerHeight', e.target.value)}
                          placeholder="e.g. 36m Rooftop Monopole"
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block text-slate-400 mb-1">Region</label>
                        <input
                          type="text"
                          value={details.region || ''}
                          onChange={(e) => handleFieldChange('region', e.target.value)}
                          placeholder="e.g. NCR / Metro Manila"
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">Province / City</label>
                        <input
                          type="text"
                          value={details.province || ''}
                          onChange={(e) => handleFieldChange('province', e.target.value)}
                          placeholder="e.g. Pasig City"
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-white"
                        />
                      </div>
                    </div>

                    <div className="text-xs">
                      <label className="block text-slate-400 mb-1">Complete Physical Address</label>
                      <textarea
                        rows={2}
                        value={details.exactAddress || ''}
                        onChange={(e) => handleFieldChange('exactAddress', e.target.value)}
                        placeholder="Exact address of the tower candidate"
                        className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-white"
                      />
                    </div>
                  </div>

                  {/* GPS Coordinates */}
                  <div className="rounded-xl bg-slate-950/80 border border-slate-800 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-amber-400" />
                        Georeferenced GPS Coordinates
                      </h3>
                      {details.coordinates && (
                        <a
                          href={`https://maps.google.com/?q=${details.coordinates.lat},${details.coordinates.lng}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-sky-400 hover:underline flex items-center gap-1 font-semibold"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Google Maps Pin
                        </a>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block text-slate-400 mb-1">Latitude</label>
                        <input
                          type="number"
                          step="any"
                          value={details.coordinates?.lat || 14.5995}
                          onChange={(e) => handleCoordinateChange('lat', parseFloat(e.target.value))}
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">Longitude</label>
                        <input
                          type="number"
                          step="any"
                          value={details.coordinates?.lng || 120.9842}
                          onChange={(e) => handleCoordinateChange('lng', parseFloat(e.target.value))}
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-white font-mono"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 1.3: DOCUMENTS & PHOTOS */}
              {activeTab1 === 'documents' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-slate-950 border border-slate-800">
                    <div>
                      <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                        Site Regulatory Dossier & Photos
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Upload geotechnical permits, lessor contracts, or site survey photos
                      </p>
                    </div>
                    <label className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload File</span>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={handleUploadDocument1}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <div className="space-y-2">
                    {documents.length === 0 ? (
                      <div className="p-8 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
                        No documents uploaded for this site yet.
                      </div>
                    ) : (
                      documents.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs"
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-slate-900 text-sky-400 border border-slate-800">
                              {doc.type === 'pdf' ? (
                                <FileText className="w-4 h-4 text-rose-400" />
                              ) : (
                                <ImageIcon className="w-4 h-4 text-emerald-400" />
                              )}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-200">{doc.name}</div>
                              <div className="text-[11px] text-slate-400">
                                {doc.tag} · {doc.fileSize || 'Attachment'} · Uploaded: {doc.uploadedAt}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <a
                              href={doc.url}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2.5 py-1 text-xs text-sky-400 hover:text-white bg-slate-900 hover:bg-sky-950 rounded border border-slate-700 transition-colors"
                            >
                              View
                            </a>
                            <button
                              type="button"
                              onClick={() => handleDeleteDoc1(doc.id)}
                              className="p-1 text-rose-400 hover:text-rose-300 hover:bg-rose-950/60 rounded transition-colors"
                              title="Delete document"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* VIEW B: DATA 2 (DIFFERENT ENCODE OF DATA) */}
          {/* ============================================================== */}
          {encodeMode === 'data2' && (
            <div className="space-y-4">
              {/* DATA 2 Feature Banner */}
              <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-950/50 via-slate-900 to-amber-950/30 border border-amber-800/60 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-600/30">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-amber-300 flex items-center gap-2">
                      DATA 2 — Alternative Encoded Workspace
                      <span className="text-[10px] px-2 py-0.2 rounded bg-amber-900 text-amber-200 border border-amber-700 font-mono">
                        Secondary Technical Schema
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Record separate technical specifications, RF antenna azimuths, optical transmission, and custom key-value pairs.
                    </p>
                  </div>
                </div>
                <div className="text-right hidden sm:block">
                  <span className="text-[10px] font-mono text-amber-400">Zero Row Expansion</span>
                </div>
              </div>

              {/* DATA 2 Navigation Tabs */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setActiveTab2('typewriter2')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ${
                      activeTab2 === 'typewriter2'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white bg-slate-950/60 border border-slate-800'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Typewriter Encoder 2</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab2('techSpecs')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ${
                      activeTab2 === 'techSpecs'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white bg-slate-950/60 border border-slate-800'
                    }`}
                  >
                    <Radio className="w-3.5 h-3.5" />
                    <span>Technical & RF Specs</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab2('customFields')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ${
                      activeTab2 === 'customFields'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white bg-slate-950/60 border border-slate-800'
                    }`}
                  >
                    <Tag className="w-3.5 h-3.5" />
                    <span>Custom Encoded Fields ({data2CustomFields.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab2('documents2')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ${
                      activeTab2 === 'documents2'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white bg-slate-950/60 border border-slate-800'
                    }`}
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>Phase 2 Files ({data2Documents.length})</span>
                  </button>
                </div>

                {activeTab2 === 'typewriter2' && (
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={handleInsertTimestamp2}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 text-[11px] font-mono flex items-center gap-1 transition-colors"
                      title="Insert timestamp into Data 2 notes"
                    >
                      <Clock className="w-3 h-3 text-amber-400" />
                      <span>+ Timestamp</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFontStyle2(fontStyle2 === 'courier' ? 'mono' : 'courier')}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-mono transition-colors"
                      title="Toggle typewriter font"
                    >
                      Font: {fontStyle2 === 'courier' ? 'Courier' : 'Mono'}
                    </button>
                  </div>
                )}
              </div>

              {/* TAB 2.1: TYPEWRITER ENCODER 2 */}
              {activeTab2 === 'typewriter2' && (
                <div className="space-y-3">
                  {/* Quick Snippets Inserter */}
                  <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-lg bg-slate-950 border border-slate-800 text-xs">
                    <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1 mr-1">
                      <Sparkles className="w-3 h-3" /> Quick Snippet Insert:
                    </span>
                    <button
                      type="button"
                      onClick={() => handleInsertSnippet2('rf')}
                      className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-[11px] transition-colors"
                    >
                      + RF Azimuth Layout
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInsertSnippet2('civil')}
                      className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-[11px] transition-colors"
                    >
                      + Civil & Foundation Log
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInsertSnippet2('fiber')}
                      className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-[11px] transition-colors"
                    >
                      + Optical Transmission
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInsertSnippet2('acceptance')}
                      className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-[11px] transition-colors"
                    >
                      + Phase 2 Acceptance
                    </button>
                  </div>

                  <div className="relative rounded-xl border border-amber-800/60 bg-slate-950 shadow-inner overflow-hidden">
                    <div className="px-3.5 py-1.5 bg-slate-900/90 border-b border-amber-900/40 flex items-center justify-between text-[11px] text-slate-400">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                        <span className="font-semibold text-amber-200">DATA 2 Typewriter Encoding Sheet</span>
                        <span className="text-slate-600">|</span>
                        <span className="text-slate-400">Alternative data encoding format for site</span>
                      </div>
                      <div className="font-mono text-[10px] text-amber-400/80">
                        {data2Notes.length} chars · {data2Notes.split(/\s+/).filter(Boolean).length} words
                      </div>
                    </div>

                    <textarea
                      rows={13}
                      value={data2Notes}
                      onChange={(e) => setData2Notes(e.target.value)}
                      style={{
                        fontFamily:
                          fontStyle2 === 'courier'
                            ? "'Courier New', Courier, 'Lucida Console', Monaco, monospace"
                            : "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                      }}
                      placeholder="Type alternative encoded data here (e.g. secondary engineering parameters, subcon logs, equipment serial numbers, phase 2 records)..."
                      className="w-full p-4 md:p-5 bg-slate-950 text-slate-100 text-sm leading-relaxed tracking-wider placeholder-slate-600 focus:outline-hidden resize-y min-h-[300px] selection:bg-amber-600 selection:text-white"
                    />
                  </div>

                  <div className="text-[11px] text-slate-400 flex items-center justify-between px-1">
                    <span>💡 Tip: Click <strong>Save Site Details</strong> below to store this second encode into the row.</span>
                    <span className="font-mono text-amber-400">DATA 2 Encoded</span>
                  </div>
                </div>
              )}

              {/* TAB 2.2: TECHNICAL & RF SPECS */}
              {activeTab2 === 'techSpecs' && (
                <div className="space-y-4">
                  {/* RF & Antenna Specs */}
                  <div className="rounded-xl bg-slate-950/80 border border-slate-800 p-4 space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                      <Radio className="w-4 h-4 text-amber-400" />
                      Antenna Sectors & RF Azimuth Configuration
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                      <div>
                        <label className="block text-slate-400 mb-1">Sector 1 (Alpha)</label>
                        <input
                          type="text"
                          value={data2Specs.azimuthSector1}
                          onChange={(e) =>
                            setData2Specs({ ...data2Specs, azimuthSector1: e.target.value })
                          }
                          placeholder="e.g. 0° Azimuth (2° tilt)"
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">Sector 2 (Beta)</label>
                        <input
                          type="text"
                          value={data2Specs.azimuthSector2}
                          onChange={(e) =>
                            setData2Specs({ ...data2Specs, azimuthSector2: e.target.value })
                          }
                          placeholder="e.g. 120° Azimuth (2° tilt)"
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">Sector 3 (Gamma)</label>
                        <input
                          type="text"
                          value={data2Specs.azimuthSector3}
                          onChange={(e) =>
                            setData2Specs({ ...data2Specs, azimuthSector3: e.target.value })
                          }
                          placeholder="e.g. 240° Azimuth (2° tilt)"
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-white font-mono"
                        />
                      </div>
                    </div>

                    <div className="text-xs">
                      <label className="block text-slate-400 mb-1">Carrier Frequency Bands & Radio Spec</label>
                      <input
                        type="text"
                        value={data2Specs.carrierFrequencyBands}
                        onChange={(e) =>
                          setData2Specs({ ...data2Specs, carrierFrequencyBands: e.target.value })
                        }
                        placeholder="e.g. 700MHz, 1800MHz, 2100MHz, 3500MHz 5G NR"
                        className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-white"
                      />
                    </div>
                  </div>

                  {/* Transmission & Power Specs */}
                  <div className="rounded-xl bg-slate-950/80 border border-slate-800 p-4 space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-amber-400" />
                      Transmission Backhaul, Power & Civil Pad
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block text-slate-400 mb-1">Optical Fiber Backhaul & Port</label>
                        <input
                          type="text"
                          value={data2Specs.fiberPortBackhaul}
                          onChange={(e) =>
                            setData2Specs({ ...data2Specs, fiberPortBackhaul: e.target.value })
                          }
                          placeholder="e.g. 24-core SMF to Hub Node (Port #12)"
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">Power Supply & Generator System</label>
                        <input
                          type="text"
                          value={data2Specs.powerGenset}
                          onChange={(e) =>
                            setData2Specs({ ...data2Specs, powerGenset: e.target.value })
                          }
                          placeholder="e.g. Commercial 3-Phase + 20kVA Genset"
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block text-slate-400 mb-1">Civil Structural Pad & Foundation</label>
                        <input
                          type="text"
                          value={data2Specs.structuralPad}
                          onChange={(e) =>
                            setData2Specs({ ...data2Specs, structuralPad: e.target.value })
                          }
                          placeholder="e.g. Mat Foundation 6.5m x 6.5m (180 kPa)"
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">Phase 2 Subcontractor & Field Engineer</label>
                        <input
                          type="text"
                          value={data2Specs.subcontractor2}
                          onChange={(e) =>
                            setData2Specs({ ...data2Specs, subcontractor2: e.target.value })
                          }
                          placeholder="e.g. Apex Telecom Engr / 0917-889-1022"
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-white"
                        />
                      </div>
                    </div>

                    <div className="text-xs">
                      <label className="block text-slate-400 mb-1">Quality Assurance & QC Status</label>
                      <input
                        type="text"
                        value={data2Specs.inspectionQcStatus}
                        onChange={(e) =>
                          setData2Specs({ ...data2Specs, inspectionQcStatus: e.target.value })
                        }
                        placeholder="e.g. Passed (Acceptance Cleared & Signed)"
                        className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2.3: CUSTOM ENCODED KEY-VALUE FIELDS */}
              {activeTab2 === 'customFields' && (
                <div className="space-y-4">
                  {/* Add New Custom Field */}
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Plus className="w-4 h-4 text-amber-400" />
                        Add Custom Encoded Field
                      </h3>
                      <span className="text-[11px] text-slate-400">
                        Encode any unique site attribute or metric
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                      <div className="sm:col-span-5">
                        <input
                          type="text"
                          value={newKey}
                          onChange={(e) => setNewKey(e.target.value)}
                          placeholder="Attribute Label (e.g. Pin Number, Transformer SN...)"
                          className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded text-white placeholder-slate-500 focus:outline-hidden focus:border-amber-500"
                          onKeyDown={(e) => e.key === 'Enter' && handleAddCustomField()}
                        />
                      </div>
                      <div className="sm:col-span-5">
                        <input
                          type="text"
                          value={newVal}
                          onChange={(e) => setNewVal(e.target.value)}
                          placeholder="Value (e.g. PIN-99201, 75kVA-TX-08)"
                          className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded text-white placeholder-slate-500 focus:outline-hidden focus:border-amber-500"
                          onKeyDown={(e) => e.key === 'Enter' && handleAddCustomField()}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <button
                          type="button"
                          onClick={handleAddCustomField}
                          className="w-full py-2 px-3 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-bold shadow-xs flex items-center justify-center gap-1 transition-colors cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add Field
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* List of Custom Fields */}
                  <div className="space-y-2">
                    {data2CustomFields.length === 0 ? (
                      <div className="p-8 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
                        No custom fields encoded yet. Add one above.
                      </div>
                    ) : (
                      data2CustomFields.map((field) => (
                        <div
                          key={field.id}
                          className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs"
                        >
                          <div className="w-1/3">
                            <input
                              type="text"
                              value={field.key}
                              onChange={(e) =>
                                handleUpdateCustomField(field.id, e.target.value, field.value)
                              }
                              className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-amber-300 font-semibold focus:outline-hidden focus:border-amber-500"
                            />
                          </div>
                          <div className="flex-1">
                            <input
                              type="text"
                              value={field.value}
                              onChange={(e) =>
                                handleUpdateCustomField(field.id, field.key, e.target.value)
                              }
                              className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-white font-mono focus:outline-hidden focus:border-amber-500"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteCustomField(field.id)}
                            className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-950/60 rounded transition-colors"
                            title="Delete custom field"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2.4: PHASE 2 DOCUMENTS */}
              {activeTab2 === 'documents2' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-slate-950 border border-slate-800">
                    <div>
                      <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                        Phase 2 Technical Drawings & Documents
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Upload as-built drawings, RF drive tests, or secondary acceptance certificates
                      </p>
                    </div>
                    <label className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload Phase 2 File</span>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={handleUploadDocument2}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <div className="space-y-2">
                    {data2Documents.length === 0 ? (
                      <div className="p-8 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
                        No Phase 2 documents attached yet.
                      </div>
                    ) : (
                      data2Documents.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs"
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-slate-900 text-amber-400 border border-slate-800">
                              {doc.type === 'pdf' ? (
                                <FileText className="w-4 h-4 text-rose-400" />
                              ) : (
                                <ImageIcon className="w-4 h-4 text-emerald-400" />
                              )}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-200">{doc.name}</div>
                              <div className="text-[11px] text-slate-400">
                                {doc.tag} · {doc.fileSize || 'Attachment'} · Uploaded: {doc.uploadedAt}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <a
                              href={doc.url}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2.5 py-1 text-xs text-amber-400 hover:text-white bg-slate-900 hover:bg-amber-950 rounded border border-slate-700 transition-colors"
                            >
                              View
                            </a>
                            <button
                              type="button"
                              onClick={() => handleDeleteDoc2(doc.id)}
                              className="p-1 text-rose-400 hover:text-rose-300 hover:bg-rose-950/60 rounded transition-colors"
                              title="Delete document"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            Currently Editing: <strong className={encodeMode === 'data1' ? 'text-indigo-400' : 'text-amber-400'}>
              {encodeMode === 'data1' ? 'DATA 1 (Primary Dossier)' : 'DATA 2 (Different Encode)'}
            </strong>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            
            <button
              type="button"
              onClick={handleSaveAll}
              className={`px-5 py-2.5 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg transition-all active:scale-95 cursor-pointer ${
                encodeMode === 'data1'
                  ? 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30'
                  : 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/30'
              }`}
            >
              <Save className="w-4 h-4" />
              <span>Save Site Details</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
