import { Tracker, TrackerFolder, UserAccount, SiteVisitRecord, TrackerRow, ColumnDefinition, ColumnType } from '../types/tracker';

export interface StandaloneBackupData {
  trackers: Tracker[];
  folders?: TrackerFolder[];
  users?: UserAccount[];
  visits?: SiteVisitRecord[];
  exportedAt?: string;
  sourceName?: string;
}

/**
 * Generate a 100% self-contained, standalone single-file HTML offline viewer
 * that can be double-clicked on any computer/phone without internet or servers.
 *
 * Implements ALL Tracker properties, column types, cell editing, DATA 1 & DATA 2 dossiers,
 * Day-by-Day SLA progress roadmap with milestones, Legal Fees checklist with vouchers in PHP (₱),
 * Del & Delete All with undo, column sorting, search filtering, Excel/JSON export,
 * PLUS complete sheet management (+ New Sheet, Rename, Delete Sheet, + Add Column)
 * and direct spreadsheet import (Replace / Append) onto specific trackers.
 */
export function generateStandaloneViewerHtml(backupData: StandaloneBackupData): string {
  const serializedData = JSON.stringify(backupData).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
  const exportTimestamp = new Date().toLocaleString('en-PH');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GEM PRO — Standalone Local Backup Tracker</title>
  <script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>
  <style>
    :root {
      --bg: #020617;
      --card-bg: #0f172a;
      --border: #1e293b;
      --border-light: #334155;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --primary: #38bdf8;
      --accent: #10b981;
      --danger: #f43f5e;
      --warning: #f59e0b;
      --indigo: #6366f1;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
      user-select: none;
    }
    /* Header */
    header {
      background: #090d16;
      border-bottom: 1px solid var(--border);
      padding: 8px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-shrink: 0;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .brand-badge {
      background: linear-gradient(135deg, #0284c7, #4f46e5);
      color: white;
      font-weight: 900;
      font-size: 10px;
      padding: 3px 8px;
      border-radius: 5px;
      letter-spacing: 0.5px;
    }
    .brand-title {
      font-size: 14px;
      font-weight: 800;
      color: white;
      line-height: 1.2;
    }
    .brand-subtitle {
      font-size: 11px;
      color: var(--text-muted);
    }
    .header-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    button, .btn {
      background: #1e293b;
      color: #e2e8f0;
      border: 1px solid #334155;
      padding: 5px 11px;
      border-radius: 6px;
      font-size: 11.5px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      transition: all 0.15s ease;
      white-space: nowrap;
    }
    button:hover, .btn:hover {
      background: #334155;
      color: white;
      border-color: #475569;
    }
    button.primary, .btn.primary {
      background: #0284c7;
      border-color: #38bdf8;
      color: white;
    }
    button.primary:hover, .btn.primary:hover {
      background: #0369a1;
    }
    button.success, .btn.success {
      background: #065f46;
      border-color: #10b981;
      color: #ecfdf5;
    }
    button.success:hover, .btn.success:hover {
      background: #047857;
    }
    button.danger, .btn.danger {
      background: #881337;
      border-color: #f43f5e;
      color: #ffe4e6;
    }
    button.danger:hover, .btn.danger:hover {
      background: #be123c;
    }
    .file-input-wrapper input[type="file"] {
      display: none;
    }

    /* Banner */
    .banner {
      background: #0c182c;
      border-bottom: 1px solid #1e3a5f;
      padding: 5px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 11px;
      color: #7dd3fc;
      flex-shrink: 0;
    }
    .banner-status {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .pulse-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #10b981;
      box-shadow: 0 0 8px #10b981;
    }

    /* Sheet Tabs Bar */
    .tabs-bar {
      background: #090d16;
      border-bottom: 1px solid var(--border);
      padding: 6px 16px 0 16px;
      display: flex;
      align-items: center;
      gap: 4px;
      overflow-x: auto;
      flex-shrink: 0;
    }
    .tab-btn {
      background: transparent;
      border: 1px solid transparent;
      border-bottom: none;
      border-radius: 6px 6px 0 0;
      color: var(--text-muted);
      padding: 6px 14px;
      font-size: 11.5px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .tab-btn:hover {
      background: #0f172a;
      color: white;
    }
    .tab-btn.active {
      background: #0f172a;
      color: #38bdf8;
      border-color: var(--border);
      border-bottom: 2px solid #38bdf8;
    }
    .tab-add-btn {
      background: #1e293b;
      border: 1px dashed #334155;
      color: #94a3b8;
      padding: 4px 10px;
      border-radius: 5px;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      margin-left: 6px;
      margin-bottom: 2px;
      white-space: nowrap;
    }
    .tab-add-btn:hover {
      background: #334155;
      color: #38bdf8;
      border-color: #38bdf8;
    }

    /* Grid Controls Toolbar */
    .controls-bar {
      background: #0f172a;
      border-bottom: 1px solid var(--border);
      padding: 6px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-shrink: 0;
      flex-wrap: wrap;
    }
    .search-box {
      position: relative;
      flex: 1;
      max-width: 320px;
      min-width: 180px;
    }
    .search-box input {
      width: 100%;
      background: #020617;
      border: 1px solid var(--border);
      color: white;
      padding: 5px 10px 5px 28px;
      border-radius: 6px;
      font-size: 11.5px;
      outline: none;
    }
    .search-box input:focus {
      border-color: #38bdf8;
    }
    .search-icon {
      position: absolute;
      left: 8px;
      top: 50%;
      transform: translateY(-50%);
      color: #64748b;
      font-size: 12px;
      pointer-events: none;
    }
    .toolbar-tools {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }

    /* Grid Container */
    .grid-container {
      flex: 1;
      overflow: auto;
      position: relative;
      background: #020617;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11.5px;
      white-space: nowrap;
      user-select: text;
    }
    thead th {
      position: sticky;
      top: 0;
      background: #090d16;
      border-right: 1px solid var(--border);
      border-bottom: 1px solid var(--border);
      padding: 7px 10px;
      text-align: left;
      font-weight: 700;
      color: #cbd5e1;
      font-size: 10.5px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      z-index: 20;
    }
    thead th.sortable {
      cursor: pointer;
    }
    thead th.sortable:hover {
      color: #38bdf8;
      background: #0f172a;
    }
    thead th.row-num, thead th.del-col {
      width: 46px;
      min-width: 46px;
      text-align: center;
      color: #64748b;
      background: #070a12;
      position: sticky;
      left: 0;
      z-index: 25;
    }
    thead th.del-col {
      width: 68px;
      min-width: 68px;
      left: auto;
      right: 0;
      position: sticky;
      z-index: 22;
      background: #090d16;
    }
    /* Summary / Totals Header Row (Pinned below columns) */
    tr.summary-row th {
      top: 31px;
      background: #0a0e1a;
      border-bottom: 2px solid #6366f1;
      color: #34d399;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 11px;
      font-weight: 700;
      padding: 5px 10px;
      z-index: 18;
    }
    tr.summary-row th.row-num {
      left: 0;
      z-index: 24;
      background: #070a12;
      color: #818cf8;
    }
    tr.summary-row th.del-col {
      right: 0;
      z-index: 21;
      background: #0a0e1a;
      text-align: center;
    }

    tbody tr {
      border-bottom: 1px solid #141f33;
    }
    tbody tr:hover {
      background: #0f1c34;
    }
    tbody td {
      border-right: 1px solid #141f33;
      padding: 6px 10px;
      color: #e2e8f0;
      max-width: 260px;
      overflow: hidden;
      text-overflow: ellipsis;
      vertical-align: middle;
    }
    tbody td.row-num {
      text-align: center;
      color: #64748b;
      background: #070a12;
      position: sticky;
      left: 0;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 10px;
      z-index: 10;
    }
    tbody td.del-col {
      text-align: center;
      background: #090d16;
      position: sticky;
      right: 0;
      z-index: 9;
      padding: 4px;
    }

    /* Badges & Pills */
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 7px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 700;
      border: 1px solid transparent;
      cursor: pointer;
    }
    .badge-success { background: #064e3b; color: #6ee7b7; border-color: #047857; }
    .badge-warning { background: #451a03; color: #fcd34d; border-color: #78350f; }
    .badge-danger { background: #4c0519; color: #fda4af; border-color: #9f1239; }
    .badge-info { background: #082f49; color: #7dd3fc; border-color: #0369a1; }
    .badge-day0 {
      background: #451a03;
      color: #f59e0b;
      border: 1px solid #b45309;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: ui-monospace, monospace;
      font-size: 10px;
      font-weight: 700;
      cursor: pointer;
    }
    .badge-day0:hover {
      background: #78350f;
      color: #fef3c7;
    }

    /* Custom Button Cells */
    .btn-cell-data {
      background: #1e1b4b;
      border: 1px solid #4338ca;
      color: #a5b4fc;
      font-weight: 800;
      font-size: 10.5px;
      padding: 3px 8px;
      border-radius: 5px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 4px;
      width: 100%;
    }
    .btn-cell-data:hover {
      background: #312e81;
      color: white;
      border-color: #6366f1;
    }
    .btn-cell-data2 {
      background: #451a03;
      border: 1px solid #b45309;
      color: #fcd34d;
      font-weight: 800;
      font-size: 10.5px;
      padding: 3px 8px;
      border-radius: 5px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 4px;
      width: 100%;
    }
    .btn-cell-data2:hover {
      background: #78350f;
      color: white;
      border-color: #f59e0b;
    }
    .btn-cell-sla {
      background: #082f49;
      border: 1px solid #0369a1;
      color: #7dd3fc;
      font-weight: 700;
      font-size: 10.5px;
      padding: 3px 8px;
      border-radius: 5px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 4px;
      width: 100%;
    }
    .btn-cell-sla:hover {
      background: #0c4a6e;
      color: white;
    }
    .btn-cell-legal {
      background: #451a03;
      border: 1px solid #92400e;
      color: #fde68a;
      font-weight: 700;
      font-size: 10.5px;
      padding: 3px 8px;
      border-radius: 5px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 4px;
      width: 100%;
    }
    .btn-cell-legal:hover {
      background: #78350f;
      color: white;
    }
    .btn-del-row {
      background: transparent;
      border: none;
      color: #f43f5e;
      padding: 3px 6px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .btn-del-row:hover {
      background: #4c0519;
      color: #fda4af;
    }
    .btn-del-all {
      background: #4c0519;
      border: 1px solid #be123c;
      color: #fda4af;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 9.5px;
      font-weight: 800;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 3px;
    }
    .btn-del-all:hover {
      background: #e11d48;
      color: white;
    }

    /* Modal / Drawer Overlays */
    .drawer-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(2px);
      z-index: 100;
      display: none;
      align-items: center;
      justify-content: center;
    }
    .drawer-overlay.open {
      display: flex;
    }
    .drawer-panel {
      background: #090d16;
      border: 1px solid var(--border-light);
      border-radius: 12px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.8);
      width: 620px;
      max-width: 94vw;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      animation: modalFadeIn 0.15s ease-out;
    }
    .drawer-panel.large {
      width: 860px;
    }
    @keyframes modalFadeIn {
      from { opacity: 0; transform: scale(0.97); }
      to { opacity: 1; transform: scale(1); }
    }
    .drawer-header {
      padding: 12px 18px;
      background: #0f172a;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
    }
    .drawer-title-wrap {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .drawer-subtitle {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #38bdf8;
    }
    .drawer-title {
      font-size: 15px;
      font-weight: 800;
      color: white;
    }
    .drawer-close {
      background: transparent;
      border: none;
      color: var(--text-muted);
      font-size: 20px;
      cursor: pointer;
      padding: 4px 8px;
    }
    .drawer-close:hover {
      color: white;
    }
    .drawer-content {
      padding: 16px 18px;
      overflow-y: auto;
      flex: 1;
    }
    .drawer-footer {
      padding: 10px 18px;
      background: #0f172a;
      border-top: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 8px;
      flex-shrink: 0;
    }

    /* Form Fields */
    .form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .form-group {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-bottom: 8px;
    }
    .form-label {
      font-size: 10.5px;
      font-weight: 700;
      text-transform: uppercase;
      color: #94a3b8;
    }
    .form-input, .form-textarea, .form-select {
      background: #020617;
      border: 1px solid var(--border-light);
      border-radius: 6px;
      padding: 7px 10px;
      font-size: 12px;
      color: white;
      outline: none;
      width: 100%;
      font-family: inherit;
    }
    .form-input:focus, .form-textarea:focus, .form-select:focus {
      border-color: #38bdf8;
    }
    .form-textarea {
      min-height: 60px;
      resize: vertical;
    }

    /* Stats Footer */
    .stats-footer {
      background: #090d16;
      border-top: 1px solid var(--border);
      padding: 6px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 11px;
      color: var(--text-muted);
      flex-shrink: 0;
    }

    /* Undo Toast */
    .toast-undo {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #0f172a;
      border: 1px solid #f43f5e;
      padding: 10px 16px;
      border-radius: 8px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.8);
      display: none;
      align-items: center;
      gap: 12px;
      z-index: 200;
      font-size: 12px;
      color: white;
      animation: modalFadeIn 0.2s ease-out;
    }
    .toast-undo.show {
      display: flex;
    }

    /* Drag Drop Full Overlay */
    #dropZoneFull {
      position: fixed;
      inset: 0;
      background: rgba(2, 6, 23, 0.92);
      border: 3px dashed #38bdf8;
      z-index: 300;
      display: none;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      gap: 12px;
      color: white;
    }
  </style>
</head>
<body>
  <!-- Header -->
  <header>
    <div class="brand">
      <span class="brand-badge">STANDALONE OFFLINE</span>
      <div>
        <div class="brand-title">GEM PRO — Standalone Local Backup Tracker</div>
        <div class="brand-subtitle" id="backupInfo">100% Fully Functional Offline System · All Amenities &amp; CRUD Completed</div>
      </div>
    </div>
    <div class="header-actions">
      <label class="file-input-wrapper">
        <span class="btn">📂 Load Backup (.json)</span>
        <input type="file" id="backupFileInput" accept=".json">
      </label>
      <button type="button" class="btn" id="btnExportCsv">📊 Export Excel (.csv)</button>
      <button type="button" class="primary" id="btnExportJson">💾 Save Copy (.json)</button>
    </div>
  </header>

  <!-- Banner -->
  <div class="banner">
    <div class="banner-status">
      <span class="pulse-dot"></span>
      <span id="bannerText">Standalone Local Mode Active · All Properties, Add/Delete/Update &amp; Spreadsheet Import Enabled</span>
    </div>
    <span id="loadedTimeText" style="font-family: monospace;">Loaded: ${exportTimestamp}</span>
  </div>

  <!-- Tracker Tabs -->
  <div class="tabs-bar" id="trackerTabs"></div>

  <!-- Grid Controls Toolbar -->
  <div class="controls-bar">
    <div class="search-box">
      <span class="search-icon">🔍</span>
      <input type="text" id="searchInput" placeholder="Search site ID, name, region, handler, status...">
    </div>
    <div class="toolbar-tools">
      <span id="rowCountBadge" style="font-size: 11px; color: #94a3b8; font-weight: 600;">Showing 0 rows</span>
      
      <!-- Tracker Management Options -->
      <button type="button" class="btn" id="btnRenameTracker" title="Rename active sheet">✏️ Rename Sheet</button>
      <button type="button" class="btn" id="btnDeleteTracker" style="color: #fda4af;" title="Delete active sheet">🗑️ Delete Sheet</button>

      <!-- Import spreadsheet directly into specific tracker -->
      <label class="file-input-wrapper">
        <span class="btn" style="border-color: #0284c7; color: #7dd3fc;" title="Import Excel (.xlsx, .xls) or CSV spreadsheet into this specific tracker">📥 Import Spreadsheet (Excel / CSV)</span>
        <input type="file" id="importSpreadsheetInput" accept=".xlsx,.xls,.csv,.tsv,.txt">
      </label>

      <!-- Add column on specific tracker -->
      <button type="button" class="btn" id="btnAddColumn" title="Add custom column to this tracker">+ Add Column</button>

      <!-- Add site row on specific tracker -->
      <button type="button" class="success" id="btnAddRow">+ Add Site Row</button>
    </div>
  </div>

  <!-- Table Grid -->
  <div class="grid-container" id="gridContainer">
    <table id="dataTable">
      <thead id="tableHead"></thead>
      <tbody id="tableBody"></tbody>
    </table>
  </div>

  <!-- Bottom Stats Footer -->
  <div class="stats-footer">
    <span id="footerSummary">Active Tracker: Rollout</span>
    <span>Currency: Philippine Peso (₱) · Double-click any cell to edit · Drag & drop .json anywhere to load</span>
  </div>

  <!-- Full Drop Zone -->
  <div id="dropZoneFull">
    <div style="font-size: 32px;">📂</div>
    <h2 style="font-size: 20px; font-weight: 800;">Drop GEM PRO Backup (.json) Here</h2>
    <p style="font-size: 13px; color: #94a3b8;">Instantly load and parse backup data into standalone viewer</p>
  </div>

  <!-- Undo Toast -->
  <div class="toast-undo" id="undoToast">
    <span id="undoToastText">Deleted row</span>
    <button type="button" class="primary" id="btnUndoAction" style="padding: 3px 8px; font-size: 11px;">↺ Undo</button>
    <button type="button" class="drawer-close" id="btnCloseUndoToast" style="font-size: 14px; padding: 0 4px;">&times;</button>
  </div>

  <!-- SPREADSHEET IMPORT MODAL (Replace vs Append on Specific Tracker) -->
  <div class="drawer-overlay" id="modalImportSpreadsheet">
    <div class="drawer-panel" style="width: 540px;">
      <div class="drawer-header" style="background: #022c22; border-bottom: 1px solid #065f46;">
        <div class="drawer-title-wrap">
          <span class="drawer-subtitle" style="color: #6ee7b7;">SPREADSHEET IMPORT TO SPECIFIC TRACKER</span>
          <div class="drawer-title" id="import_targetSheetTitle">Import to Sheet</div>
        </div>
        <button class="drawer-close" onclick="closeModal('modalImportSpreadsheet')">&times;</button>
      </div>
      <div class="drawer-content">
        <div style="background: #020617; border: 1px solid #1e293b; border-radius: 8px; padding: 12px; margin-bottom: 14px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 11.5px;">
            <span style="color: #94a3b8;">File to import:</span>
            <strong id="import_fileName" style="color: white; font-family: monospace;">data.csv</strong>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 11.5px;">
            <span style="color: #94a3b8;">Rows detected:</span>
            <strong id="import_rowCount" style="color: #34d399; font-family: monospace;">0 rows</strong>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 11.5px;">
            <span style="color: #94a3b8;">Columns detected:</span>
            <strong id="import_colCount" style="color: #38bdf8; font-family: monospace;">0 headers</strong>
          </div>
        </div>

        <div style="margin-bottom: 14px;">
          <label style="font-size: 11px; font-weight: 700; color: #cbd5e1; text-transform: uppercase; margin-bottom: 8px; display: block;">
            Choose Import Mode for this Tracker:
          </label>
          <div style="background: #020617; border: 1px solid #334155; border-radius: 8px; padding: 12px; font-size: 12px;">
            <label style="display: flex; align-items: flex-start; gap: 8px; cursor: pointer; margin-bottom: 10px;">
              <input type="radio" name="importModeChoice" value="replace" checked id="importRadioReplace" style="margin-top: 3px;">
              <div>
                <strong style="color: white;">Replace All Rows (100% Exact Quantity Match)</strong>
                <p style="font-size: 11px; color: #94a3b8; margin-top: 2px;">Clears current sheet data and replaces with exactly the imported rows.</p>
              </div>
            </label>
            <label style="display: flex; align-items: flex-start; gap: 8px; cursor: pointer;">
              <input type="radio" name="importModeChoice" value="append" id="importRadioAppend" style="margin-top: 3px;">
              <div>
                <strong style="color: #38bdf8;">Append to Existing Rows</strong>
                <p style="font-size: 11px; color: #94a3b8; margin-top: 2px;">Adds all imported rows to the end of the sheet, keeping existing rows intact.</p>
              </div>
            </label>
          </div>
        </div>

        <div style="background: #082f49; border: 1px solid #0284c7; border-radius: 6px; padding: 8px 12px; font-size: 11px; color: #bae6fd;">
          💡 Any column headers in your file that do not exist yet will be automatically added to this tracker!
        </div>
      </div>
      <div class="drawer-footer">
        <button type="button" class="btn" onclick="closeModal('modalImportSpreadsheet')">Cancel</button>
        <button type="button" class="success" id="btnExecuteSpreadsheetImport">📥 Confirm &amp; Import</button>
      </div>
    </div>
  </div>

  <!-- ADD COLUMN MODAL (Add custom column to specific tracker) -->
  <div class="drawer-overlay" id="modalAddColumn">
    <div class="drawer-panel" style="width: 440px;">
      <div class="drawer-header">
        <div class="drawer-title-wrap">
          <span class="drawer-subtitle">CUSTOMIZE TRACKER</span>
          <div class="drawer-title">Add Column to Sheet</div>
        </div>
        <button class="drawer-close" onclick="closeModal('modalAddColumn')">&times;</button>
      </div>
      <div class="drawer-content">
        <div class="form-group">
          <label class="form-label">Column Header Label</label>
          <input type="text" class="form-input" id="newColLabel" placeholder="e.g. Civil Works Status, Inspection Date, Contractor Cost">
        </div>
        <div class="form-group">
          <label class="form-label">Data Type</label>
          <select class="form-select" id="newColType">
            <option value="text">Text (General)</option>
            <option value="amount">Amount in Philippine Peso (₱)</option>
            <option value="percent">Percentage (%)</option>
            <option value="date">Date (YYYY-MM-DD)</option>
            <option value="status">Status Badge</option>
            <option value="checkbox">Checkbox (Yes / No)</option>
            <option value="number">Numeric (Standard)</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Column Width (px)</label>
          <input type="number" class="form-input" id="newColWidth" value="150" min="70" max="400">
        </div>
      </div>
      <div class="drawer-footer">
        <button type="button" class="btn" onclick="closeModal('modalAddColumn')">Cancel</button>
        <button type="button" class="primary" id="btnConfirmAddColumn">+ Add Column</button>
      </div>
    </div>
  </div>

  <!-- DATA 1: Site Record Dossier Modal -->
  <div class="drawer-overlay" id="modalData1">
    <div class="drawer-panel large">
      <div class="drawer-header">
        <div class="drawer-title-wrap">
          <span class="drawer-subtitle">DATA 1 · TYPEWRITER SITE DOSSIER</span>
          <div class="drawer-title" id="d1_siteIdTitle">SITE-0000</div>
        </div>
        <button class="drawer-close" onclick="closeModal('modalData1')">&times;</button>
      </div>
      <div class="drawer-content">
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Site ID</label>
            <input type="text" class="form-input" id="d1_siteId">
          </div>
          <div class="form-group">
            <label class="form-label">Site Name</label>
            <input type="text" class="form-input" id="d1_siteName">
          </div>
          <div class="form-group">
            <label class="form-label">Region</label>
            <input type="text" class="form-input" id="d1_region">
          </div>
          <div class="form-group">
            <label class="form-label">Province</label>
            <input type="text" class="form-input" id="d1_province">
          </div>
          <div class="form-group" style="grid-column: span 2;">
            <label class="form-label">Exact Address / Location</label>
            <input type="text" class="form-input" id="d1_exactAddress">
          </div>
          <div class="form-group">
            <label class="form-label">Landlord Name</label>
            <input type="text" class="form-input" id="d1_landlordName">
          </div>
          <div class="form-group">
            <label class="form-label">Landlord Contact</label>
            <input type="text" class="form-input" id="d1_landlordContact">
          </div>
          <div class="form-group">
            <label class="form-label">Tower Height (m)</label>
            <input type="text" class="form-input" id="d1_towerHeight">
          </div>
          <div class="form-group">
            <label class="form-label">PIC Handler</label>
            <input type="text" class="form-input" id="d1_picHandler">
          </div>
          <div class="form-group">
            <label class="form-label">Contractor</label>
            <input type="text" class="form-input" id="d1_contractor">
          </div>
          <div class="form-group">
            <label class="form-label">GPS Latitude</label>
            <input type="number" step="any" class="form-input" id="d1_lat">
          </div>
          <div class="form-group">
            <label class="form-label">GPS Longitude</label>
            <input type="number" step="any" class="form-input" id="d1_lng">
          </div>
          <div class="form-group" style="grid-column: span 2;">
            <label class="form-label">Notes &amp; Technical Remarks</label>
            <textarea class="form-textarea" id="d1_notes"></textarea>
          </div>
        </div>
      </div>
      <div class="drawer-footer">
        <button type="button" class="btn" onclick="closeModal('modalData1')">Cancel</button>
        <button type="button" class="primary" id="btnSaveData1">💾 Save Dossier</button>
      </div>
    </div>
  </div>

  <!-- DATA 2: Secondary Technical Specs Modal -->
  <div class="drawer-overlay" id="modalData2">
    <div class="drawer-panel large">
      <div class="drawer-header">
        <div class="drawer-title-wrap">
          <span class="drawer-subtitle" style="color: #f59e0b;">DATA 2 · SECONDARY TECHNICAL DATASET</span>
          <div class="drawer-title" id="d2_siteIdTitle">SITE-0000</div>
        </div>
        <button class="drawer-close" onclick="closeModal('modalData2')">&times;</button>
      </div>
      <div class="drawer-content">
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Category</label>
            <input type="text" class="form-input" id="d2_category" placeholder="Macro, Rooftop, IBS...">
          </div>
          <div class="form-group">
            <label class="form-label">Inspection QC Status</label>
            <select class="form-select" id="d2_qcStatus">
              <option value="Passed">Passed</option>
              <option value="Pending">Pending</option>
              <option value="Under Inspection">Under Inspection</option>
              <option value="Rectification Needed">Rectification Needed</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Azimuth Sector 1 (°)</label>
            <input type="text" class="form-input" id="d2_az1" placeholder="e.g. 0° North">
          </div>
          <div class="form-group">
            <label class="form-label">Azimuth Sector 2 (°)</label>
            <input type="text" class="form-input" id="d2_az2" placeholder="e.g. 120°">
          </div>
          <div class="form-group">
            <label class="form-label">Azimuth Sector 3 (°)</label>
            <input type="text" class="form-input" id="d2_az3" placeholder="e.g. 240°">
          </div>
          <div class="form-group">
            <label class="form-label">Carrier Frequency Bands</label>
            <input type="text" class="form-input" id="d2_freq" placeholder="e.g. 700 / 1800 / 2100 / 2600 / 3500 MHz">
          </div>
          <div class="form-group">
            <label class="form-label">Fiber Port Backhaul</label>
            <input type="text" class="form-input" id="d2_fiber" placeholder="e.g. 10G SFP+ Dark Fiber">
          </div>
          <div class="form-group">
            <label class="form-label">Power Genset Backup</label>
            <input type="text" class="form-input" id="d2_genset" placeholder="e.g. 25kVA Standby Genset">
          </div>
          <div class="form-group">
            <label class="form-label">Structural Foundation Pad</label>
            <input type="text" class="form-input" id="d2_pad" placeholder="e.g. 4.5m x 4.5m Reinforced Concrete">
          </div>
          <div class="form-group">
            <label class="form-label">Secondary Subcontractor</label>
            <input type="text" class="form-input" id="d2_subcon" placeholder="e.g. FiberWorks Philippines">
          </div>
          <div class="form-group" style="grid-column: span 2;">
            <label class="form-label">Secondary Specs &amp; Remarks</label>
            <textarea class="form-textarea" id="d2_notes"></textarea>
          </div>
        </div>
      </div>
      <div class="drawer-footer">
        <button type="button" class="btn" onclick="closeModal('modalData2')">Cancel</button>
        <button type="button" class="primary" id="btnSaveData2">💾 Save DATA 2</button>
      </div>
    </div>
  </div>

  <!-- Day-by-Day SLA Progress Modal -->
  <div class="drawer-overlay" id="modalSla">
    <div class="drawer-panel large">
      <div class="drawer-header">
        <div class="drawer-title-wrap">
          <span class="drawer-subtitle" style="color: #38bdf8;">DAY-BY-DAY SLA PROGRESS TRACKER</span>
          <div class="drawer-title" id="sla_siteIdTitle">SITE-0000 · SLA Target Roadmap</div>
        </div>
        <button class="drawer-close" onclick="closeModal('modalSla')">&times;</button>
      </div>
      <div class="drawer-content">
        <!-- SLA Parameters Banner -->
        <div style="background: #020617; border: 1px solid #1e293b; border-radius: 8px; padding: 12px; margin-bottom: 14px;">
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">SLA Trigger Date (Day 0 Start)</label>
              <input type="date" class="form-input" id="sla_triggerDate">
            </div>
            <div class="form-group">
              <label class="form-label">Target Duration (Days)</label>
              <input type="number" class="form-input" id="sla_targetDays" value="120">
            </div>
            <div class="form-group">
              <label class="form-label">Scope Name</label>
              <input type="text" class="form-input" id="sla_scopeName" value="Full Turnkey Build">
            </div>
            <div class="form-group">
              <label class="form-label">SLA Health Status</label>
              <select class="form-select" id="sla_healthStatus">
                <option value="on_track">ON TRACK</option>
                <option value="approaching">WARNING / APPROACHING</option>
                <option value="delayed">DELAYED</option>
                <option value="critical">CRITICAL (14d+ NO MOVEMENT)</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Milestones Roadmap Table -->
        <div style="margin-bottom: 16px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
            <div style="font-size: 11px; font-weight: 800; color: #cbd5e1; text-transform: uppercase;">
              🎯 Milestones &amp; Target Roadmap
            </div>
            <button type="button" class="btn" onclick="addMilestoneRow()" style="font-size: 10.5px; padding: 3px 8px;">+ Add Milestone</button>
          </div>
          <div style="border: 1px solid #1e293b; border-radius: 6px; overflow: hidden; background: #020617;">
            <table style="width: 100%;">
              <thead>
                <tr style="background: #090d16; font-size: 10px;">
                  <th style="padding: 6px 10px;">Milestone Name</th>
                  <th style="padding: 6px 10px; width: 80px;">Target Days</th>
                  <th style="padding: 6px 10px; width: 110px;">Target Date</th>
                  <th style="padding: 6px 10px; width: 120px;">Status</th>
                </tr>
              </thead>
              <tbody id="sla_milestonesTbody"></tbody>
            </table>
          </div>
        </div>

        <!-- Daily Activity Logs -->
        <div>
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
            <div style="font-size: 11px; font-weight: 800; color: #cbd5e1; text-transform: uppercase;">
              📝 Daily Remarks &amp; Activity Log
            </div>
            <button type="button" class="btn" onclick="addDailyLogRow()" style="font-size: 10.5px; padding: 3px 8px;">+ Add Daily Log</button>
          </div>
          <div style="border: 1px solid #1e293b; border-radius: 6px; overflow: hidden; background: #020617;">
            <table style="width: 100%;">
              <thead>
                <tr style="background: #090d16; font-size: 10px;">
                  <th style="padding: 6px 10px; width: 100px;">Date</th>
                  <th style="padding: 6px 10px; width: 100px;">Status</th>
                  <th style="padding: 6px 10px;">Daily Remarks / Progress</th>
                  <th style="padding: 6px 10px; width: 110px;">Logged By</th>
                </tr>
              </thead>
              <tbody id="sla_historyTbody"></tbody>
            </table>
          </div>
        </div>
      </div>
      <div class="drawer-footer">
        <button type="button" class="btn" onclick="closeModal('modalSla')">Cancel</button>
        <button type="button" class="primary" id="btnSaveSla">💾 Save SLA Roadmap</button>
      </div>
    </div>
  </div>

  <!-- Legal Fees Checklist Modal -->
  <div class="drawer-overlay" id="modalLegal">
    <div class="drawer-panel large">
      <div class="drawer-header">
        <div class="drawer-title-wrap">
          <span class="drawer-subtitle" style="color: #f59e0b;">LEGAL FEES &amp; COMPLIANCE CHECKLIST</span>
          <div class="drawer-title" id="legal_siteIdTitle">SITE-0000 · Vouchers &amp; Clearances</div>
        </div>
        <button class="drawer-close" onclick="closeModal('modalLegal')">&times;</button>
      </div>
      <div class="drawer-content">
        <!-- Summary Stats Card -->
        <div style="background: #020617; border: 1px solid #1e293b; border-radius: 8px; padding: 12px; margin-bottom: 14px; display: flex; align-items: center; justify-content: space-between;">
          <div>
            <div style="font-size: 10.5px; color: #94a3b8; font-weight: 700;">TOTAL LEGAL &amp; PERMITS BUDGET</div>
            <div id="legal_totalBudget" style="font-size: 20px; font-weight: 900; color: #34d399; font-family: monospace;">₱0.00</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 10.5px; color: #94a3b8; font-weight: 700;">COMPLETED VOUCHERS</div>
            <div id="legal_completedRatio" style="font-size: 14px; font-weight: 800; color: white;">0 / 0 Completed</div>
          </div>
        </div>

        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
          <div style="font-size: 11px; font-weight: 800; color: #cbd5e1; text-transform: uppercase;">
            📜 Compliance Vouchers &amp; Official Receipts
          </div>
          <button type="button" class="btn" onclick="addLegalItemRow()" style="font-size: 10.5px; padding: 3px 8px;">+ Add Legal Voucher</button>
        </div>

        <div style="border: 1px solid #1e293b; border-radius: 6px; overflow: hidden; background: #020617;">
          <table style="width: 100%;">
            <thead>
              <tr style="background: #090d16; font-size: 10px;">
                <th style="padding: 6px 10px;">Requirement</th>
                <th style="padding: 6px 10px; width: 90px;">Category</th>
                <th style="padding: 6px 10px; width: 110px;">Amount (₱)</th>
                <th style="padding: 6px 10px; width: 110px;">Status</th>
                <th style="padding: 6px 10px; width: 100px;">Assigned Staff</th>
                <th style="padding: 6px 10px; width: 40px; text-align: center;">Del</th>
              </tr>
            </thead>
            <tbody id="legal_itemsTbody"></tbody>
          </table>
        </div>
      </div>
      <div class="drawer-footer">
        <button type="button" class="btn" onclick="closeModal('modalLegal')">Cancel</button>
        <button type="button" class="primary" id="btnSaveLegal">💾 Save Checklist</button>
      </div>
    </div>
  </div>

  <!-- Delete All Confirmation Modal -->
  <div class="drawer-overlay" id="modalDeleteAll">
    <div class="drawer-panel" style="width: 440px;">
      <div class="drawer-header" style="background: #4c0519; border-bottom: 1px solid #9f1239;">
        <div class="drawer-title-wrap">
          <span class="drawer-subtitle" style="color: #fda4af;">CRITICAL ACTION</span>
          <div class="drawer-title" style="color: white;">Delete All Tracker Rows?</div>
        </div>
        <button class="drawer-close" onclick="closeModal('modalDeleteAll')">&times;</button>
      </div>
      <div class="drawer-content">
        <p style="font-size: 12px; color: #cbd5e1; margin-bottom: 14px;">
          You are about to delete all rows from the active sheet. If you proceed, all rows will be removed from memory.
        </p>
        <div style="background: #020617; border: 1px solid #334155; border-radius: 8px; padding: 12px; font-size: 12px; margin-bottom: 14px;">
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; margin-bottom: 8px;">
            <input type="radio" name="delAllOption" value="all" checked id="delRadioAll">
            <span><strong>Delete ALL rows</strong> (<span id="delAllCountText">0</span> rows)</span>
          </label>
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
            <input type="radio" name="delAllOption" value="filtered" id="delRadioFiltered">
            <span><strong>Delete ONLY filtered rows</strong> (<span id="delFilteredCountText">0</span> rows)</span>
          </label>
        </div>
        <div style="background: #1e1b4b; border: 1px solid #4338ca; border-radius: 6px; padding: 8px 12px; font-size: 11px; color: #c7d2fe;">
          💡 <strong>Safe &amp; Undoable:</strong> An instant Undo option will be available immediately after deleting.
        </div>
      </div>
      <div class="drawer-footer">
        <button type="button" class="btn" onclick="closeModal('modalDeleteAll')">Cancel</button>
        <button type="button" class="danger" id="btnConfirmDeleteAll">🗑️ Yes, Delete Rows</button>
      </div>
    </div>
  </div>

  <!-- Photo / PDF Viewer Modal -->
  <div class="drawer-overlay" id="modalPreview">
    <div class="drawer-panel large" style="height: 85vh;">
      <div class="drawer-header">
        <div class="drawer-title-wrap">
          <span class="drawer-subtitle">DOCUMENT PREVIEW</span>
          <div class="drawer-title" id="preview_title">Document.jpg</div>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <button type="button" class="btn" id="btnPreviewDownload">⬇ Download</button>
          <button class="drawer-close" onclick="closeModal('modalPreview')">&times;</button>
        </div>
      </div>
      <div class="drawer-content" style="display: flex; align-items: center; justify-content: center; padding: 0; background: #020617;" id="preview_container">
        <!-- Content inserted dynamically -->
      </div>
    </div>
  </div>

  <script>
    // Embedded backup data
    let currentBackup = ${serializedData};
    let activeTrackerIdx = 0;
    let searchQuery = '';
    let sortColumnId = null;
    let sortDirection = 'asc';

    // Undo buffer for row deletions
    let undoDeletedRows = null;
    let undoTrackerIdx = 0;

    // Currently edited row index in open modal
    let activeModalRowIdx = null;

    // Pending spreadsheet import state
    let pendingSpreadsheet = null;

    function init() {
      renderTabs();
      renderTable();
      setupEvents();
    }

    function getActiveTracker() {
      if (!currentBackup.trackers || currentBackup.trackers.length === 0) return null;
      return currentBackup.trackers[activeTrackerIdx] || currentBackup.trackers[0];
    }

    function renderTabs() {
      const tabsContainer = document.getElementById('trackerTabs');
      tabsContainer.innerHTML = '';
      if (!currentBackup.trackers || currentBackup.trackers.length === 0) {
        tabsContainer.innerHTML = '<span style="color:#ef4444;font-size:12px;padding:6px;">No trackers found in backup file.</span>';
        return;
      }

      currentBackup.trackers.forEach((tracker, idx) => {
        const btn = document.createElement('button');
        btn.className = 'tab-btn' + (idx === activeTrackerIdx ? ' active' : '');
        btn.innerHTML = '📋 ' + (tracker.name || 'Tracker ' + (idx + 1)) + ' (' + (tracker.rows ? tracker.rows.length : 0) + ')';
        btn.onclick = () => {
          activeTrackerIdx = idx;
          renderTabs();
          renderTable();
        };
        tabsContainer.appendChild(btn);
      });

      // + New Sheet button
      const addBtn = document.createElement('button');
      addBtn.className = 'tab-add-btn';
      addBtn.innerHTML = '+ New Sheet';
      addBtn.title = 'Add new tracker sheet';
      addBtn.onclick = handleAddNewSheet;
      tabsContainer.appendChild(addBtn);
    }

    // Sheet Management: Add new sheet
    function handleAddNewSheet() {
      const sheetName = prompt('Enter name for the new tracker sheet:', 'New Project Tracker');
      if (!sheetName || !sheetName.trim()) return;

      const newId = 'tracker_' + Date.now();
      const standardCols = [
        { id: 'site_id', label: 'Site ID', type: 'site_id', width: 140, visible: true },
        { id: 'site_name', label: 'Site Name', type: 'text', width: 180, visible: true },
        { id: 'data_button', label: 'DATA 1', type: 'data_drawer', width: 100, visible: true },
        { id: 'data_2_button', label: 'DATA 2', type: 'data_drawer_2', width: 100, visible: true },
        { id: 'day_sla', label: 'Day-by-Day SLA', type: 'day_sla', width: 140, visible: true },
        { id: 'sla_trigger_date', label: 'SLA Trigger', type: 'sla_trigger_date', width: 130, visible: true },
        { id: 'sla_health_col', label: 'SLA Health', type: 'sla_health', width: 130, visible: true },
        { id: 'legal_fees', label: 'Legal Fees Checklist', type: 'legal_checklist', width: 160, visible: true },
        { id: 'status', label: 'Status', type: 'status', width: 120, visible: true }
      ];

      const newTracker = {
        id: newId,
        name: sheetName.trim(),
        columns: standardCols,
        rows: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      if (!currentBackup.trackers) currentBackup.trackers = [];
      currentBackup.trackers.push(newTracker);
      activeTrackerIdx = currentBackup.trackers.length - 1;
      renderTabs();
      renderTable();
    }

    // Sheet Management: Rename active sheet
    document.getElementById('btnRenameTracker').onclick = function() {
      const tracker = getActiveTracker();
      if (!tracker) return;
      const newName = prompt('Rename tracker sheet "' + tracker.name + '":', tracker.name);
      if (!newName || !newName.trim() || newName === tracker.name) return;

      tracker.name = newName.trim();
      renderTabs();
      renderTable();
    };

    // Sheet Management: Delete active sheet
    document.getElementById('btnDeleteTracker').onclick = function() {
      const tracker = getActiveTracker();
      if (!tracker) return;
      if (currentBackup.trackers.length <= 1) {
        alert('Cannot delete the only remaining tracker sheet in this workbook.');
        return;
      }
      if (!confirm('Are you sure you want to delete tracker sheet "' + tracker.name + '" and all its ' + (tracker.rows ? tracker.rows.length : 0) + ' sites?')) {
        return;
      }

      currentBackup.trackers.splice(activeTrackerIdx, 1);
      if (activeTrackerIdx >= currentBackup.trackers.length) {
        activeTrackerIdx = currentBackup.trackers.length - 1;
      }
      renderTabs();
      renderTable();
    };

    // Column Management: Add Column
    document.getElementById('btnAddColumn').onclick = function() {
      const tracker = getActiveTracker();
      if (!tracker) return;
      document.getElementById('newColLabel').value = '';
      document.getElementById('newColWidth').value = '150';
      openModal('modalAddColumn');
    };

    document.getElementById('btnConfirmAddColumn').onclick = function() {
      const tracker = getActiveTracker();
      if (!tracker) return;
      const label = document.getElementById('newColLabel').value.trim();
      if (!label) {
        alert('Please enter a column header label.');
        return;
      }
      const type = document.getElementById('newColType').value;
      const width = Number(document.getElementById('newColWidth').value) || 150;
      const colId = 'col_' + Date.now();

      if (!tracker.columns) tracker.columns = [];
      tracker.columns.push({
        id: colId,
        label: label,
        type: type,
        width: width,
        visible: true,
        isCustom: true,
        editable: true
      });

      closeModal('modalAddColumn');
      renderTable();
    };

    function getVisibleColumns(tracker) {
      if (!tracker) return [];
      let cols = (tracker.columns || []).filter(c => c.visible !== false);
      if (cols.length === 0) {
        // Fallback default columns
        cols = [
          { id: 'site_id', label: 'Site ID', type: 'site_id', width: 140 },
          { id: 'site_name', label: 'Site Name', type: 'text', width: 180 },
          { id: 'data_button', label: 'DATA 1', type: 'data_drawer', width: 100 },
          { id: 'data_2_button', label: 'DATA 2', type: 'data_drawer_2', width: 100 },
          { id: 'day_sla', label: 'Day-by-Day SLA', type: 'day_sla', width: 140 },
          { id: 'sla_trigger_date', label: 'SLA Trigger', type: 'sla_trigger_date', width: 130 },
          { id: 'sla_health_col', label: 'SLA Health', type: 'sla_health', width: 130 },
          { id: 'legal_fees', label: 'Legal Fees Checklist', type: 'legal_checklist', width: 160 },
          { id: 'status', label: 'Status', type: 'status', width: 120 }
        ];
      }
      return cols;
    }

    function calculateColumnSummary(col, rows) {
      if (!rows || rows.length === 0) return '';
      const isAmount = col.type === 'amount' || col.summaryType === 'sum' || (col.label && col.label.toLowerCase().includes('amount')) || (col.label && col.label.toLowerCase().includes('budget')) || (col.label && col.label.toLowerCase().includes('cost'));
      const isPercent = col.type === 'percent' || (col.label && col.label.toLowerCase().includes('%'));

      if (isAmount) {
        const sum = rows.reduce((acc, r) => {
          const val = r.values ? r.values[col.id] : 0;
          const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^0-9.-]+/g, '')) || 0;
          return acc + num;
        }, 0);
        return '₱' + sum.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }

      if (isPercent) {
        const sum = rows.reduce((acc, r) => {
          const val = r.values ? r.values[col.id] : 0;
          const num = typeof val === 'number' ? val : parseFloat(String(val)) || 0;
          return acc + num;
        }, 0);
        return (sum / rows.length).toFixed(1) + '%';
      }

      if (col.type === 'legal_checklist' || (col.label && col.label.toLowerCase().includes('legal'))) {
        const sum = rows.reduce((acc, r) => {
          const list = Array.isArray(r.legalChecklist) ? r.legalChecklist : [];
          const rowSum = list.reduce((s, item) => s + (item.amount || 0), 0);
          return acc + rowSum;
        }, 0);
        return '₱' + sum.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }

      if (col.type === 'number' && col.summaryType === 'sum') {
        const sum = rows.reduce((acc, r) => {
          const val = r.values ? r.values[col.id] : 0;
          const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^0-9.-]+/g, '')) || 0;
          return acc + num;
        }, 0);
        return sum.toLocaleString('en-PH');
      }

      if (col.summaryType === 'count') {
        return rows.length + ' rows';
      }

      return '';
    }

    function renderTable() {
      const tracker = getActiveTracker();
      const thead = document.getElementById('tableHead');
      const tbody = document.getElementById('tableBody');
      const rowBadge = document.getElementById('rowCountBadge');
      const footerSummary = document.getElementById('footerSummary');

      if (!tracker) {
        thead.innerHTML = '';
        tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:40px;color:#94a3b8;">No tracker data available.</td></tr>';
        return;
      }

      footerSummary.innerText = 'Active Sheet: ' + (tracker.name || 'Tracker') + ' · Total ' + (tracker.rows ? tracker.rows.length : 0) + ' sites';

      const cols = getVisibleColumns(tracker);

      // Filter rows
      let rows = (tracker.rows || []).slice();
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        rows = rows.filter(r => {
          if ((r.siteId || '').toLowerCase().includes(q)) return true;
          if (r.siteDetails) {
            const sd = r.siteDetails;
            if ((sd.siteName || '').toLowerCase().includes(q)) return true;
            if ((sd.region || '').toLowerCase().includes(q)) return true;
            if ((sd.province || '').toLowerCase().includes(q)) return true;
            if ((sd.exactAddress || '').toLowerCase().includes(q)) return true;
            if ((sd.picHandler || '').toLowerCase().includes(q)) return true;
          }
          if (r.values) {
            return Object.values(r.values).some(v => String(v || '').toLowerCase().includes(q));
          }
          return false;
        });
      }

      // Sort rows if column selected
      if (sortColumnId) {
        rows.sort((a, b) => {
          let valA = sortColumnId === 'site_id' ? (a.siteId || '') : (a.values ? a.values[sortColumnId] : '');
          let valB = sortColumnId === 'site_id' ? (b.siteId || '') : (b.values ? b.values[sortColumnId] : '');
          if (typeof valA === 'number' && typeof valB === 'number') {
            return sortDirection === 'asc' ? valA - valB : valB - valA;
          }
          return sortDirection === 'asc'
            ? String(valA || '').localeCompare(String(valB || ''))
            : String(valB || '').localeCompare(String(valA || ''));
        });
      }

      rowBadge.innerText = 'Showing ' + rows.length + ' of ' + (tracker.rows ? tracker.rows.length : 0) + ' rows';

      // 1. Build Header Row
      let headHtml = '<tr><th class="row-num">#</th>';
      cols.forEach(col => {
        const isSorted = sortColumnId === col.id;
        const sortIcon = isSorted ? (sortDirection === 'asc' ? ' ▲' : ' ▼') : ' ⇅';
        headHtml += '<th class="sortable" onclick="handleSort(\'' + col.id + '\')" title="Click to sort">'
          + (col.label || col.id) + '<span style="color:#64748b;font-size:10px;">' + sortIcon + '</span></th>';
      });
      // Del column with ALL button
      headHtml += '<th class="del-col">';
      headHtml += '<div style="display:flex;align-items:center;justify-content:center;gap:4px;">';
      headHtml += '<span>Del</span>';
      if (tracker.rows && tracker.rows.length > 0) {
        headHtml += '<button type="button" class="btn-del-all" onclick="openDeleteAllModal()" title="Delete all rows in this sheet">ALL</button>';
      }
      headHtml += '</div></th></tr>';

      // 2. Build Summary / Totals Header Row
      let sumHtml = '<tr class="summary-row"><th class="row-num" title="Summary Row">Σ TOP</th>';
      cols.forEach(col => {
        const sumText = calculateColumnSummary(col, rows);
        sumHtml += '<th title="' + (col.label || col.id) + ' Summary">' + (sumText || '—') + '</th>';
      });
      sumHtml += '<th class="del-col" style="font-size:10px;color:#94a3b8;font-weight:bold;text-align:center;">Totals</th></tr>';

      thead.innerHTML = headHtml + sumHtml;

      // 3. Build Body Rows
      if (rows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="' + (cols.length + 2) + '" style="text-align:center;padding:40px;color:#94a3b8;">No matching sites found.</td></tr>';
        return;
      }

      let bodyHtml = '';
      rows.forEach((row, rIdx) => {
        const originalIdx = (tracker.rows || []).indexOf(row);
        bodyHtml += '<tr data-row-idx="' + originalIdx + '">';
        bodyHtml += '<td class="row-num">' + (rIdx + 1) + '</td>';

        cols.forEach(col => {
          bodyHtml += '<td>' + renderCellHtml(col, row, originalIdx) + '</td>';
        });

        // Del action cell
        bodyHtml += '<td class="del-col">';
        bodyHtml += '<button type="button" class="btn-del-row" onclick="deleteSingleRow(' + originalIdx + ')" title="Delete site ' + (row.siteId || '') + '">🗑️</button>';
        bodyHtml += '</td>';

        bodyHtml += '</tr>';
      });

      tbody.innerHTML = bodyHtml;
    }

    function renderCellHtml(col, row, rowIdx) {
      const val = row.values ? row.values[col.id] : undefined;

      // 1. Site ID
      if (col.type === 'site_id' || col.id === 'site_id') {
        const idVal = row.siteId || (row.values ? row.values.site_id : '') || 'SITE-' + (rowIdx + 1);
        return '<div style="display:flex;align-items:center;justify-content:space-between;gap:6px;">'
          + '<span onclick="openData1Drawer(' + rowIdx + ')" style="font-family:monospace;font-weight:bold;color:#38bdf8;cursor:pointer;" title="Click to view dossier">'
          + idVal + '</span>'
          + '<button type="button" onclick="openData1Drawer(' + rowIdx + ')" style="padding:2px 5px;font-size:10px;background:#1e293b;border:1px solid #334155;color:#94a3b8;border-radius:4px;cursor:pointer;">Dossier</button>'
          + '</div>';
      }

      // 2. DATA 1 Drawer Button
      if (col.type === 'data_drawer') {
        return '<button type="button" class="btn-cell-data" onclick="openData1Drawer(' + rowIdx + ')">'
          + '<span>📄 DATA</span><span style="font-size:10px;">&rarr;</span></button>';
      }

      // 3. DATA 2 Drawer Button
      if (col.type === 'data_drawer_2') {
        return '<button type="button" class="btn-cell-data2" onclick="openData2Drawer(' + rowIdx + ')">'
          + '<span>📊 DATA 2</span><span style="font-size:10px;">&rarr;</span></button>';
      }

      // 4. Day-by-Day SLA Progress
      if (col.type === 'day_sla') {
        return '<button type="button" class="btn-cell-sla" onclick="openSlaModal(' + rowIdx + ')">'
          + '<span>Daily Remarks</span><span style="font-size:10px;">&rarr;</span></button>';
      }

      // 5. SLA Trigger Date (Day 0)
      if (col.type === 'sla_trigger_date' || col.id === 'sla_trigger_date') {
        const tDate = (row.slaData && row.slaData.triggerDate) || (row.values ? row.values[col.id] || row.values.sla_trigger_date : '') || '';
        return '<div style="display:flex;align-items:center;gap:6px;cursor:pointer;" onclick="openSlaModal(' + rowIdx + ')">'
          + (tDate ? '<span style="font-family:monospace;color:#f59e0b;font-weight:600;">' + tDate + '</span>' : '<span style="color:#64748b;font-size:11px;font-style:italic;">Not set</span>')
          + '<span class="badge-day0">Day 0</span>'
          + '</div>';
      }

      // 6. SLA Health Status Badge
      if (col.type === 'sla_health' || col.id === 'sla_health_col') {
        const h = (row.slaData && row.slaData.slaHealth) || 'on_track';
        const badgeClass = h === 'critical' ? 'badge-danger' : h === 'delayed' ? 'badge-warning' : h === 'approaching' ? 'badge-warning' : 'badge-success';
        const label = h === 'critical' ? 'CRITICAL (14d+)' : h === 'delayed' ? 'DELAYED' : h === 'approaching' ? 'WARNING' : 'ON TRACK';
        return '<span class="badge ' + badgeClass + '" onclick="openSlaModal(' + rowIdx + ')">'
          + '<span style="width:5px;height:5px;border-radius:50%;background:currentColor;display:inline-block;"></span>'
          + label + '</span>';
      }

      // 7. Legal Fees Checklist
      if (col.type === 'legal_checklist' || (col.label && col.label.toLowerCase().includes('legal'))) {
        const list = Array.isArray(row.legalChecklist) ? row.legalChecklist : [];
        const sum = list.reduce((acc, item) => acc + (item.amount || 0), 0);
        const comp = list.filter(item => item.status === 'Completed').length;
        const amtStr = '₱' + sum.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return '<button type="button" class="btn-cell-legal" onclick="openLegalModal(' + rowIdx + ')">'
          + '<span style="font-family:monospace;color:#34d399;font-weight:bold;">' + amtStr + '</span>'
          + '<span style="font-size:9.5px;color:#fcd34d;">' + comp + '/' + list.length + ' Vouchers &rarr;</span>'
          + '</button>';
      }

      // 8. Amount (₱)
      if (col.type === 'amount' || (col.label && col.label.toLowerCase().includes('amount') && col.type !== 'date')) {
        if (val === undefined || val === null || val === '' || val === '-') {
          return '<span ondblclick="editCellInline(' + rowIdx + ', \'' + col.id + '\', \'number\')" style="color:#64748b;font-size:11px;font-style:italic;display:block;text-align:right;">-</span>';
        }
        const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^0-9.-]+/g, '')) || 0;
        return '<span ondblclick="editCellInline(' + rowIdx + ', \'' + col.id + '\', \'number\')" style="font-family:monospace;color:#34d399;font-weight:700;display:block;text-align:right;">₱'
          + num.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '</span>';
      }

      // 8b. Number
      if (col.type === 'number') {
        if (val === undefined || val === null || val === '') {
          return '<span ondblclick="editCellInline(' + rowIdx + ', \'' + col.id + '\', \'number\')" style="color:#64748b;font-size:11px;font-style:italic;display:block;text-align:right;">-</span>';
        }
        const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^0-9.-]+/g, '')) || 0;
        return '<span ondblclick="editCellInline(' + rowIdx + ', \'' + col.id + '\', \'number\')" style="font-family:monospace;color:#cbd5e1;font-weight:600;display:block;text-align:right;">'
          + num.toLocaleString('en-PH') + '</span>';
      }

      // 9. Percent (%)
      if (col.type === 'percent') {
        const num = typeof val === 'number' ? val : parseFloat(String(val)) || 0;
        const color = num >= 100 ? '#10b981' : num >= 50 ? '#38bdf8' : '#f59e0b';
        return '<div ondblclick="editCellInline(' + rowIdx + ', \'' + col.id + '\', \'number\')" style="display:flex;align-items:center;gap:6px;">'
          + '<div style="flex:1;height:6px;background:#1e293b;border-radius:3px;overflow:hidden;">'
          + '<div style="width:' + Math.min(100, Math.max(0, num)) + '%;height:100%;background:' + color + ';"></div>'
          + '</div>'
          + '<span style="font-family:monospace;font-size:11px;color:#cbd5e1;width:34px;text-align:right;">' + num + '%</span>'
          + '</div>';
      }

      // 10. Status badge
      if (col.type === 'status') {
        const s = String(val || 'Active');
        const sLow = s.toLowerCase();
        const badgeClass = (sLow.includes('done') || sLow.includes('completed')) ? 'badge-success'
          : (sLow.includes('delay') || sLow.includes('crit')) ? 'badge-danger'
          : sLow.includes('pre') ? 'badge-warning' : 'badge-info';
        return '<span ondblclick="editCellInline(' + rowIdx + ', \'' + col.id + '\', \'text\')" class="badge ' + badgeClass + '">' + s + '</span>';
      }

      // 11. Image / Photo preview
      if (col.type === 'image') {
        if (!val || val === 'No Photo' || val === 'none') {
          return '<span style="color:#64748b;font-size:11px;font-style:italic;">No photo</span>';
        }
        const imgUrl = typeof val === 'object' ? val.url : String(val);
        const imgName = typeof val === 'object' ? val.name : 'Photo.jpg';
        return '<div style="display:flex;align-items:center;gap:6px;cursor:pointer;" onclick="openPreviewModal(\'' + imgUrl.replace(/'/g, "\\'") + '\', \'' + imgName.replace(/'/g, "\\'") + '\', \'image\')">'
          + '<img src="' + imgUrl + '" style="width:26px;height:24px;border-radius:4px;object-cover;border:1px solid #334155;background:#0f172a;" alt="Photo">'
          + '<span style="color:#38bdf8;font-size:11px;text-decoration:underline;truncate;">' + imgName + '</span>'
          + '</div>';
      }

      // 12. PDF Document
      if (col.type === 'pdf') {
        if (!val || val === 'none') {
          return '<span style="color:#64748b;font-size:11px;font-style:italic;">No PDF</span>';
        }
        const pdfUrl = typeof val === 'object' ? val.url : String(val);
        const pdfName = typeof val === 'object' ? val.name : 'Document.pdf';
        return '<div style="display:flex;align-items:center;gap:6px;cursor:pointer;" onclick="openPreviewModal(\'' + pdfUrl.replace(/'/g, "\\'") + '\', \'' + pdfName.replace(/'/g, "\\'") + '\', \'pdf\')">'
          + '<span style="font-size:14px;">📄</span>'
          + '<span style="color:#f43f5e;font-size:11px;text-decoration:underline;">' + pdfName + '</span>'
          + '</div>';
      }

      // 13. Checkbox
      if (col.type === 'checkbox') {
        const checked = Boolean(val);
        return '<input type="checkbox" ' + (checked ? 'checked' : '') + ' onchange="toggleCheckboxCell(' + rowIdx + ', \'' + col.id + '\', this.checked)" style="cursor:pointer;">';
      }

      // Default Text / Date / Number with inline double-click editing
      const displayStr = val !== undefined && val !== null ? String(val) : '';
      return '<span ondblclick="editCellInline(' + rowIdx + ', \'' + col.id + '\', \'' + (col.type || 'text') + '\')" style="cursor:text;display:block;min-height:16px;">'
        + (displayStr ? escapeHtml(displayStr) : '<span style="color:#475569;">—</span>') + '</span>';
    }

    function escapeHtml(str) {
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    // Sort Handler
    window.handleSort = function(colId) {
      if (sortColumnId === colId) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        sortColumnId = colId;
        sortDirection = 'asc';
      }
      renderTable();
    };

    // Inline cell editing
    window.editCellInline = function(rowIdx, colId, type) {
      const tracker = getActiveTracker();
      if (!tracker || !tracker.rows || !tracker.rows[rowIdx]) return;
      const row = tracker.rows[rowIdx];
      const currentVal = row.values ? row.values[colId] : '';
      const promptVal = prompt('Edit value for "' + colId + '":', currentVal !== undefined ? currentVal : '');
      if (promptVal === null) return;

      if (!row.values) row.values = {};
      if (type === 'number' || type === 'amount' || type === 'percent') {
        const num = parseFloat(promptVal);
        row.values[colId] = isNaN(num) ? promptVal : num;
      } else {
        row.values[colId] = promptVal;
      }
      renderTable();
    };

    window.toggleCheckboxCell = function(rowIdx, colId, checked) {
      const tracker = getActiveTracker();
      if (!tracker || !tracker.rows || !tracker.rows[rowIdx]) return;
      if (!tracker.rows[rowIdx].values) tracker.rows[rowIdx].values = {};
      tracker.rows[rowIdx].values[colId] = checked;
    };

    // Modal Control
    window.openModal = function(modalId) {
      const el = document.getElementById(modalId);
      if (el) el.classList.add('open');
    };

    window.closeModal = function(modalId) {
      const el = document.getElementById(modalId);
      if (el) el.classList.remove('open');
      activeModalRowIdx = null;
    };

    // RFC 4180 CSV / TSV Parser in pure JavaScript
    function parseCsvText(text) {
      const lines = [];
      let row = [];
      let inQuotes = false;
      let currentVal = '';

      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];

        if (char === '"') {
          if (inQuotes && nextChar === '"') {
            currentVal += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if ((char === ',' || char === '\t') && !inQuotes) {
          row.push(currentVal.trim());
          currentVal = '';
        } else if ((char === '\r' || char === '\n') && !inQuotes) {
          if (char === '\r' && nextChar === '\n') {
            i++;
          }
          row.push(currentVal.trim());
          if (row.some(c => c !== '')) {
            lines.push(row);
          }
          row = [];
          currentVal = '';
        } else {
          currentVal += char;
        }
      }
      if (currentVal || row.length > 0) {
        row.push(currentVal.trim());
        if (row.some(c => c !== '')) {
          lines.push(row);
        }
      }
      return lines;
    }

    // Handle Spreadsheet File Selection (XLSX, XLS, CSV, TSV)
    document.getElementById('importSpreadsheetInput').onchange = function(e) {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      const tracker = getActiveTracker();
      if (!tracker) {
        alert('Please select or create a tracker sheet first.');
        return;
      }

      const processExtractedRows = function(rows) {
        if (!rows || rows.length < 1) {
          alert('Spreadsheet appears empty.');
          return;
        }

        // Smart Header Detection: Skip single-cell banner rows (e.g. Row 0: "PROJECT ROLLOUT 2026")
        let headerIdx = 0;
        let maxCols = 0;
        for (let i = 0; i < Math.min(10, rows.length); i++) {
          const r = rows[i] || [];
          const pop = r.filter(c => c !== undefined && c !== null && String(c).trim() !== '').length;
          if (pop > maxCols) {
            maxCols = pop;
            headerIdx = i;
          }
        }

        const rawHeaders = rows[headerIdx] || [];
        const headers = rawHeaders.map((h, i) => {
          const s = String(h || '').trim();
          return s || ('Column ' + (i + 1));
        });
        const dataRows = rows.slice(headerIdx + 1).filter(r => r && r.some(c => c !== undefined && c !== null && String(c).trim() !== ''));

        if (dataRows.length === 0) {
          alert('No data rows found below detected header row ' + (headerIdx + 1) + '.');
          return;
        }

        pendingSpreadsheet = {
          fileName: file.name,
          headers: headers,
          dataRows: dataRows,
          targetTracker: tracker
        };

        document.getElementById('import_targetSheetTitle').innerText = 'Import to Sheet: "' + tracker.name + '"';
        document.getElementById('import_fileName').innerText = file.name;
        document.getElementById('import_rowCount').innerText = dataRows.length.toLocaleString() + ' data rows';
        document.getElementById('import_colCount').innerText = headers.length + ' headers (' + headers.slice(0, 4).join(', ') + '...)';

        openModal('modalImportSpreadsheet');
      };

      const isExcel = /\.xlsx?$/i.test(file.name);
      if (isExcel && window.XLSX) {
        const reader = new FileReader();
        reader.onload = function(evt) {
          try {
            const data = new Uint8Array(evt.target.result);
            const wb = window.XLSX.read(data, { type: 'array', cellDates: true });
            let bestSheet = wb.SheetNames[0];
            let maxRows = 0;
            wb.SheetNames.forEach(sn => {
              const ws = wb.Sheets[sn];
              const r = window.XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
              if (r.length > maxRows) {
                maxRows = r.length;
                bestSheet = sn;
              }
            });
            const ws = wb.Sheets[bestSheet];
            const rows = window.XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
            processExtractedRows(rows);
          } catch (err) {
            alert('Error parsing Excel workbook: ' + err.message);
          }
        };
        reader.readAsArrayBuffer(file);
      } else {
        const reader = new FileReader();
        reader.onload = function(evt) {
          try {
            const rawText = evt.target.result;
            const rows = parseCsvText(rawText);
            processExtractedRows(rows);
          } catch (err) {
            alert('Error reading CSV spreadsheet: ' + err.message);
          }
        };
        reader.readAsText(file);
      }
      e.target.value = '';
    };

    // Execute Spreadsheet Import onto Specific Tracker
    document.getElementById('btnExecuteSpreadsheetImport').onclick = function() {
      if (!pendingSpreadsheet) return;
      const tracker = pendingSpreadsheet.targetTracker;
      const { headers, dataRows } = pendingSpreadsheet;
      const isReplace = document.getElementById('importRadioReplace').checked;

      // 1. Ensure columns exist for all headers
      if (!tracker.columns) tracker.columns = [];
      const colMap = [];

      headers.forEach((h, hIdx) => {
        const cleanH = String(h || '').trim();
        if (!cleanH) return;

        // Find existing match
        let matched = tracker.columns.find(c =>
          c.label.toLowerCase() === cleanH.toLowerCase() ||
          c.id.toLowerCase() === cleanH.toLowerCase()
        );

        if (!matched) {
          // Detect type
          const hLow = cleanH.toLowerCase();
          let colType = 'text';
          if (hLow === 'siteid' || hLow === 'site_id' || hLow.includes('site code') || hLow.includes('candidate id')) colType = 'site_id';
          else if (hLow.includes('date') || hLow.includes('deadline')) colType = 'date';
          else if (hLow.includes('amount') || hLow.includes('cost') || hLow.includes('budget') || hLow.includes('fee') || hLow.includes('disbursed') || hLow.includes('liquidated')) colType = 'amount';
          else if (hLow.includes('%') || hLow.includes('percent')) colType = 'percent';
          else if (hLow === 'status' || hLow.includes('stage')) colType = 'status';

          const newCol = {
            id: 'col_' + Date.now() + '_' + hIdx,
            label: cleanH,
            type: colType,
            width: Math.max(130, Math.min(cleanH.length * 9 + 40, 260)),
            visible: true,
            isCustom: true,
            editable: true
          };
          tracker.columns.push(newCol);
          matched = newCol;
        }

        colMap[hIdx] = matched;
      });

      // 2. Map data rows
      const now = new Date().toISOString().split('T')[0];
      const newRows = dataRows.map((dr, rIdx) => {
        const rowValues = {};
        let siteIdVal = '';
        let siteNameVal = '';

        headers.forEach((_, cIdx) => {
          const col = colMap[cIdx];
          if (!col) return;
          const rawCell = dr[cIdx] !== undefined ? dr[cIdx] : '';

          if (col.type === 'site_id') {
            siteIdVal = String(rawCell).trim();
          } else if (col.id === 'site_name' || col.label.toLowerCase().includes('site name')) {
            siteNameVal = String(rawCell).trim();
            rowValues[col.id] = rawCell;
          } else if (col.type === 'amount' || col.type === 'number') {
            const str = String(rawCell).trim();
            if (str === '') {
              rowValues[col.id] = '';
            } else {
              const num = parseFloat(str.replace(/[^0-9.-]+/g, ''));
              rowValues[col.id] = isNaN(num) ? rawCell : num;
            }
          } else if (col.type === 'percent') {
            const num = parseFloat(String(rawCell).replace(/[^0-9.-]+/g, ''));
            rowValues[col.id] = isNaN(num) ? rawCell : num;
          } else {
            rowValues[col.id] = rawCell;
          }
        });

        // Ensure row numbers (1, 2, 3...) are not mistaken for site ID if a site name exists
        if (/^\d+$/.test(siteIdVal) && siteNameVal && !/^\d+$/.test(siteNameVal)) {
          siteIdVal = siteNameVal;
        }
        if (!siteIdVal) {
          siteIdVal = siteNameVal || (dr[0] && !/^\d+$/.test(String(dr[0])) ? String(dr[0]) : '') || 'SITE-' + String(rIdx + 1).padStart(3, '0');
        }
        rowValues.site_id = siteIdVal;

        return {
          id: 'imp_' + Date.now() + '_' + rIdx,
          siteId: siteIdVal,
          values: rowValues,
          siteDetails: {
            siteId: siteIdVal,
            siteName: rowValues.site_name || String(dr[1] || 'Site Location'),
            region: rowValues.region || 'NCR',
            province: rowValues.province || 'Metro Manila',
            exactAddress: rowValues.exact_address || '',
            landlordName: '',
            landlordContact: '',
            towerHeight: '30',
            coordinates: { lat: 14.5995, lng: 120.9842 },
            picHandler: rowValues.pic_handler || 'PIC Assigned Handler',
            contractor: rowValues.contractor || 'Contractor',
            notes: ''
          },
          slaData: {
            triggerDate: now,
            targetDays: 120,
            slaScopeName: 'Full Build',
            slaHealth: 'on_track',
            milestones: [
              { id: 'ms1', name: 'TSSR Acceptance', targetDaysFromTrigger: 15, targetDate: now, status: 'Completed' },
              { id: 'ms2', name: 'Lease Agreement Signed', targetDaysFromTrigger: 45, targetDate: now, status: 'In Progress' }
            ],
            history: []
          },
          legalChecklist: [
            { id: 'leg1', requirement: 'Barangay Resolution', category: 'Legal', amount: 15000, status: 'Completed', assignedStaff: 'Legal PIC', submissionDate: now, sopRef: 'SOP-01' }
          ],
          documents: [],
          createdAt: now,
          updatedAt: now
        };
      });

      if (isReplace) {
        tracker.rows = newRows;
      } else {
        if (!tracker.rows) tracker.rows = [];
        tracker.rows = tracker.rows.concat(newRows);
      }

      closeModal('modalImportSpreadsheet');
      pendingSpreadsheet = null;
      renderTabs();
      renderTable();
      showUndoToast('Imported ' + newRows.length + ' rows into "' + tracker.name + '" (' + (isReplace ? 'Replaced' : 'Appended') + ')');
    };

    // DATA 1 Drawer
    window.openData1Drawer = function(rowIdx) {
      const tracker = getActiveTracker();
      if (!tracker || !tracker.rows || !tracker.rows[rowIdx]) return;
      activeModalRowIdx = rowIdx;
      const row = tracker.rows[rowIdx];
      const sd = row.siteDetails || {};

      document.getElementById('d1_siteIdTitle').innerText = row.siteId || 'Site Record #' + (rowIdx + 1);
      document.getElementById('d1_siteId').value = row.siteId || '';
      document.getElementById('d1_siteName').value = sd.siteName || (row.values ? row.values.site_name : '') || '';
      document.getElementById('d1_region').value = sd.region || (row.values ? row.values.region : '') || '';
      document.getElementById('d1_province').value = sd.province || (row.values ? row.values.province : '') || '';
      document.getElementById('d1_exactAddress').value = sd.exactAddress || '';
      document.getElementById('d1_landlordName').value = sd.landlordName || '';
      document.getElementById('d1_landlordContact').value = sd.landlordContact || '';
      document.getElementById('d1_towerHeight').value = sd.towerHeight || '';
      document.getElementById('d1_picHandler').value = sd.picHandler || (row.values ? row.values.pic_handler : '') || '';
      document.getElementById('d1_contractor').value = sd.contractor || (row.values ? row.values.contractor : '') || '';
      document.getElementById('d1_lat').value = (sd.coordinates && sd.coordinates.lat) || '';
      document.getElementById('d1_lng').value = (sd.coordinates && sd.coordinates.lng) || '';
      document.getElementById('d1_notes').value = sd.notes || '';

      openModal('modalData1');
    };

    document.getElementById('btnSaveData1').onclick = function() {
      const tracker = getActiveTracker();
      if (activeModalRowIdx === null || !tracker || !tracker.rows || !tracker.rows[activeModalRowIdx]) return;
      const row = tracker.rows[activeModalRowIdx];

      const newSiteId = document.getElementById('d1_siteId').value.trim();
      if (newSiteId) row.siteId = newSiteId;

      row.siteDetails = {
        siteId: row.siteId,
        siteName: document.getElementById('d1_siteName').value.trim(),
        region: document.getElementById('d1_region').value.trim(),
        province: document.getElementById('d1_province').value.trim(),
        exactAddress: document.getElementById('d1_exactAddress').value.trim(),
        landlordName: document.getElementById('d1_landlordName').value.trim(),
        landlordContact: document.getElementById('d1_landlordContact').value.trim(),
        towerHeight: document.getElementById('d1_towerHeight').value.trim(),
        picHandler: document.getElementById('d1_picHandler').value.trim(),
        contractor: document.getElementById('d1_contractor').value.trim(),
        coordinates: {
          lat: parseFloat(document.getElementById('d1_lat').value) || 0,
          lng: parseFloat(document.getElementById('d1_lng').value) || 0
        },
        notes: document.getElementById('d1_notes').value.trim()
      };

      if (!row.values) row.values = {};
      row.values.site_id = row.siteId;
      row.values.site_name = row.siteDetails.siteName;
      row.values.region = row.siteDetails.region;
      row.values.province = row.siteDetails.province;
      row.values.pic_handler = row.siteDetails.picHandler;
      row.values.contractor = row.siteDetails.contractor;

      closeModal('modalData1');
      renderTable();
    };

    // DATA 2 Drawer
    window.openData2Drawer = function(rowIdx) {
      const tracker = getActiveTracker();
      if (!tracker || !tracker.rows || !tracker.rows[rowIdx]) return;
      activeModalRowIdx = rowIdx;
      const row = tracker.rows[rowIdx];
      const d2 = row.siteData2 || {};
      const specs = d2.technicalSpecs || {};

      document.getElementById('d2_siteIdTitle').innerText = (row.siteId || 'SITE') + ' · Secondary Technical Specs';
      document.getElementById('d2_category').value = d2.category || '';
      document.getElementById('d2_qcStatus').value = specs.inspectionQcStatus || 'Passed';
      document.getElementById('d2_az1').value = specs.azimuthSector1 || '';
      document.getElementById('d2_az2').value = specs.azimuthSector2 || '';
      document.getElementById('d2_az3').value = specs.azimuthSector3 || '';
      document.getElementById('d2_freq').value = specs.carrierFrequencyBands || '';
      document.getElementById('d2_fiber').value = specs.fiberPortBackhaul || '';
      document.getElementById('d2_genset').value = specs.powerGenset || '';
      document.getElementById('d2_pad').value = specs.structuralPad || '';
      document.getElementById('d2_subcon').value = specs.subcontractor2 || '';
      document.getElementById('d2_notes').value = d2.notes || '';

      openModal('modalData2');
    };

    document.getElementById('btnSaveData2').onclick = function() {
      const tracker = getActiveTracker();
      if (activeModalRowIdx === null || !tracker || !tracker.rows || !tracker.rows[activeModalRowIdx]) return;
      const row = tracker.rows[activeModalRowIdx];

      row.siteData2 = {
        category: document.getElementById('d2_category').value.trim(),
        notes: document.getElementById('d2_notes').value.trim(),
        technicalSpecs: {
          azimuthSector1: document.getElementById('d2_az1').value.trim(),
          azimuthSector2: document.getElementById('d2_az2').value.trim(),
          azimuthSector3: document.getElementById('d2_az3').value.trim(),
          carrierFrequencyBands: document.getElementById('d2_freq').value.trim(),
          fiberPortBackhaul: document.getElementById('d2_fiber').value.trim(),
          powerGenset: document.getElementById('d2_genset').value.trim(),
          structuralPad: document.getElementById('d2_pad').value.trim(),
          subcontractor2: document.getElementById('d2_subcon').value.trim(),
          inspectionQcStatus: document.getElementById('d2_qcStatus').value
        },
        updatedAt: new Date().toISOString()
      };

      closeModal('modalData2');
      renderTable();
    };

    // SLA Modal
    window.openSlaModal = function(rowIdx) {
      const tracker = getActiveTracker();
      if (!tracker || !tracker.rows || !tracker.rows[rowIdx]) return;
      activeModalRowIdx = rowIdx;
      const row = tracker.rows[rowIdx];
      const sla = row.slaData || { triggerDate: '', targetDays: 120, slaScopeName: 'Full Build', slaHealth: 'on_track', milestones: [], history: [] };

      document.getElementById('sla_siteIdTitle').innerText = (row.siteId || 'Site') + ' · SLA Roadmap & Daily Remarks';
      document.getElementById('sla_triggerDate').value = sla.triggerDate || (row.values ? row.values.sla_trigger_date : '') || '';
      document.getElementById('sla_targetDays').value = sla.targetDays || 120;
      document.getElementById('sla_scopeName').value = sla.slaScopeName || 'Full Turnkey Build';
      document.getElementById('sla_healthStatus').value = sla.slaHealth || 'on_track';

      renderSlaMilestones(sla.milestones || []);
      renderSlaHistory(sla.history || []);

      openModal('modalSla');
    };

    function renderSlaMilestones(milestones) {
      const tbody = document.getElementById('sla_milestonesTbody');
      tbody.innerHTML = '';
      if (!milestones || milestones.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:12px;color:#64748b;">No milestones configured. Click "+ Add Milestone" above.</td></tr>';
        return;
      }
      milestones.forEach((m, idx) => {
        let tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #141f33';
        tr.innerHTML = '<td style="padding:4px 8px;"><input type="text" class="form-input" value="' + escapeHtml(m.name || '') + '" onchange="updateMilestone(' + idx + ', \'name\', this.value)" style="padding:4px 6px;font-size:11px;"></td>'
          + '<td style="padding:4px 8px;"><input type="number" class="form-input" value="' + (m.targetDaysFromTrigger || 0) + '" onchange="updateMilestone(' + idx + ', \'targetDaysFromTrigger\', Number(this.value))" style="padding:4px 6px;font-size:11px;"></td>'
          + '<td style="padding:4px 8px;"><input type="date" class="form-input" value="' + (m.targetDate || '') + '" onchange="updateMilestone(' + idx + ', \'targetDate\', this.value)" style="padding:4px 6px;font-size:11px;"></td>'
          + '<td style="padding:4px 8px;"><select class="form-select" onchange="updateMilestone(' + idx + ', \'status\', this.value)" style="padding:4px 6px;font-size:11px;">'
          + '<option value="Completed"' + (m.status === 'Completed' ? ' selected' : '') + '>Completed</option>'
          + '<option value="In Progress"' + (m.status === 'In Progress' ? ' selected' : '') + '>In Progress</option>'
          + '<option value="Pending"' + (m.status === 'Pending' ? ' selected' : '') + '>Pending</option>'
          + '<option value="Delayed"' + (m.status === 'Delayed' ? ' selected' : '') + '>Delayed</option>'
          + '</select></td>';
        tbody.appendChild(tr);
      });
    }

    window.updateMilestone = function(idx, key, val) {
      const tracker = getActiveTracker();
      if (activeModalRowIdx === null || !tracker || !tracker.rows[activeModalRowIdx]) return;
      const sla = tracker.rows[activeModalRowIdx].slaData;
      if (sla && sla.milestones && sla.milestones[idx]) {
        sla.milestones[idx][key] = val;
      }
    };

    window.addMilestoneRow = function() {
      const tracker = getActiveTracker();
      if (activeModalRowIdx === null || !tracker || !tracker.rows[activeModalRowIdx]) return;
      const row = tracker.rows[activeModalRowIdx];
      if (!row.slaData) row.slaData = { milestones: [], history: [] };
      if (!row.slaData.milestones) row.slaData.milestones = [];
      row.slaData.milestones.push({
        id: 'ms_' + Date.now(),
        name: 'New Milestone',
        targetDaysFromTrigger: 30,
        targetDate: new Date().toISOString().split('T')[0],
        status: 'Pending'
      });
      renderSlaMilestones(row.slaData.milestones);
    };

    function renderSlaHistory(history) {
      const tbody = document.getElementById('sla_historyTbody');
      tbody.innerHTML = '';
      if (!history || history.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:12px;color:#64748b;">No daily history entries. Click "+ Add Daily Log" above.</td></tr>';
        return;
      }
      history.forEach((h, idx) => {
        let tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #141f33';
        tr.innerHTML = '<td style="padding:4px 8px;"><input type="date" class="form-input" value="' + (h.date || '') + '" onchange="updateHistory(' + idx + ', \'date\', this.value)" style="padding:4px 6px;font-size:11px;"></td>'
          + '<td style="padding:4px 8px;"><input type="text" class="form-input" value="' + escapeHtml(h.status || '') + '" onchange="updateHistory(' + idx + ', \'status\', this.value)" style="padding:4px 6px;font-size:11px;"></td>'
          + '<td style="padding:4px 8px;"><input type="text" class="form-input" value="' + escapeHtml(h.detailsRemarks || h.progressUpdate || '') + '" onchange="updateHistory(' + idx + ', \'detailsRemarks\', this.value)" style="padding:4px 6px;font-size:11px;"></td>'
          + '<td style="padding:4px 8px;"><input type="text" class="form-input" value="' + escapeHtml(h.loggedBy || '') + '" onchange="updateHistory(' + idx + ', \'loggedBy\', this.value)" style="padding:4px 6px;font-size:11px;"></td>';
        tbody.appendChild(tr);
      });
    }

    window.updateHistory = function(idx, key, val) {
      const tracker = getActiveTracker();
      if (activeModalRowIdx === null || !tracker || !tracker.rows[activeModalRowIdx]) return;
      const sla = tracker.rows[activeModalRowIdx].slaData;
      if (sla && sla.history && sla.history[idx]) {
        sla.history[idx][key] = val;
      }
    };

    window.addDailyLogRow = function() {
      const tracker = getActiveTracker();
      if (activeModalRowIdx === null || !tracker || !tracker.rows[activeModalRowIdx]) return;
      const row = tracker.rows[activeModalRowIdx];
      if (!row.slaData) row.slaData = { milestones: [], history: [] };
      if (!row.slaData.history) row.slaData.history = [];
      row.slaData.history.unshift({
        id: 'hist_' + Date.now(),
        date: new Date().toISOString().split('T')[0],
        status: 'In Progress',
        detailsRemarks: 'Site progress update logged offline',
        loggedBy: 'SAQ Assigned Handler'
      });
      renderSlaHistory(row.slaData.history);
    };

    document.getElementById('btnSaveSla').onclick = function() {
      const tracker = getActiveTracker();
      if (activeModalRowIdx === null || !tracker || !tracker.rows || !tracker.rows[activeModalRowIdx]) return;
      const row = tracker.rows[activeModalRowIdx];
      if (!row.slaData) row.slaData = {};

      const triggerDate = document.getElementById('sla_triggerDate').value;
      const targetDays = Number(document.getElementById('sla_targetDays').value) || 120;
      const scopeName = document.getElementById('sla_scopeName').value.trim();
      const health = document.getElementById('sla_healthStatus').value;

      row.slaData.triggerDate = triggerDate;
      row.slaData.targetDays = targetDays;
      row.slaData.slaScopeName = scopeName;
      row.slaData.slaHealth = health;

      if (!row.values) row.values = {};
      row.values.sla_trigger_date = triggerDate;

      closeModal('modalSla');
      renderTable();
    };

    // Legal Checklist Modal
    window.openLegalModal = function(rowIdx) {
      const tracker = getActiveTracker();
      if (!tracker || !tracker.rows || !tracker.rows[rowIdx]) return;
      activeModalRowIdx = rowIdx;
      const row = tracker.rows[rowIdx];
      const list = Array.isArray(row.legalChecklist) ? row.legalChecklist : [];

      document.getElementById('legal_siteIdTitle').innerText = (row.siteId || 'Site') + ' · Legal Fees & Compliance Checklist';
      renderLegalChecklistItems(list);

      openModal('modalLegal');
    };

    function renderLegalChecklistItems(items) {
      const tbody = document.getElementById('legal_itemsTbody');
      tbody.innerHTML = '';

      let total = 0;
      let compCount = 0;

      if (!items || items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:12px;color:#64748b;">No legal vouchers found. Click "+ Add Legal Voucher" above.</td></tr>';
        document.getElementById('legal_totalBudget').innerText = '₱0.00';
        document.getElementById('legal_completedRatio').innerText = '0 / 0 Completed';
        return;
      }

      items.forEach((item, idx) => {
        const amt = Number(item.amount) || 0;
        total += amt;
        if (item.status === 'Completed') compCount++;

        let tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #141f33';
        tr.innerHTML = '<td style="padding:4px 8px;"><input type="text" class="form-input" value="' + escapeHtml(item.requirement || '') + '" onchange="updateLegalItem(' + idx + ', \'requirement\', this.value)" style="padding:4px 6px;font-size:11px;"></td>'
          + '<td style="padding:4px 8px;"><select class="form-select" onchange="updateLegalItem(' + idx + ', \'category\', this.value)" style="padding:4px 6px;font-size:11px;">'
          + '<option value="Legal"' + (item.category === 'Legal' ? ' selected' : '') + '>Legal</option>'
          + '<option value="Permit"' + (item.category === 'Permit' ? ' selected' : '') + '>Permit</option>'
          + '<option value="Social"' + (item.category === 'Social' ? ' selected' : '') + '>Social</option>'
          + '<option value="Clearance"' + (item.category === 'Clearance' ? ' selected' : '') + '>Clearance</option>'
          + '</select></td>'
          + '<td style="padding:4px 8px;"><input type="number" class="form-input" value="' + amt + '" onchange="updateLegalItem(' + idx + ', \'amount\', Number(this.value))" style="padding:4px 6px;font-size:11px;font-family:monospace;color:#34d399;"></td>'
          + '<td style="padding:4px 8px;"><select class="form-select" onchange="updateLegalItem(' + idx + ', \'status\', this.value)" style="padding:4px 6px;font-size:11px;">'
          + '<option value="Completed"' + (item.status === 'Completed' ? ' selected' : '') + '>Completed</option>'
          + '<option value="In Progress"' + (item.status === 'In Progress' ? ' selected' : '') + '>In Progress</option>'
          + '<option value="Pending"' + (item.status === 'Pending' ? ' selected' : '') + '>Pending</option>'
          + '<option value="Under Review"' + (item.status === 'Under Review' ? ' selected' : '') + '>Under Review</option>'
          + '</select></td>'
          + '<td style="padding:4px 8px;"><input type="text" class="form-input" value="' + escapeHtml(item.assignedStaff || '') + '" onchange="updateLegalItem(' + idx + ', \'assignedStaff\', this.value)" style="padding:4px 6px;font-size:11px;"></td>'
          + '<td style="padding:4px 8px;text-align:center;"><button type="button" class="btn-del-row" onclick="removeLegalItem(' + idx + ')" title="Delete voucher">🗑️</button></td>';
        tbody.appendChild(tr);
      });

      document.getElementById('legal_totalBudget').innerText = '₱' + total.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      document.getElementById('legal_completedRatio').innerText = compCount + ' / ' + items.length + ' Completed';
    }

    window.updateLegalItem = function(idx, key, val) {
      const tracker = getActiveTracker();
      if (activeModalRowIdx === null || !tracker || !tracker.rows[activeModalRowIdx]) return;
      const list = tracker.rows[activeModalRowIdx].legalChecklist;
      if (list && list[idx]) {
        list[idx][key] = val;
        renderLegalChecklistItems(list);
      }
    };

    window.removeLegalItem = function(idx) {
      const tracker = getActiveTracker();
      if (activeModalRowIdx === null || !tracker || !tracker.rows[activeModalRowIdx]) return;
      const list = tracker.rows[activeModalRowIdx].legalChecklist;
      if (list) {
        list.splice(idx, 1);
        renderLegalChecklistItems(list);
      }
    };

    window.addLegalItemRow = function() {
      const tracker = getActiveTracker();
      if (activeModalRowIdx === null || !tracker || !tracker.rows[activeModalRowIdx]) return;
      const row = tracker.rows[activeModalRowIdx];
      if (!Array.isArray(row.legalChecklist)) row.legalChecklist = [];
      row.legalChecklist.push({
        id: 'leg_' + Date.now(),
        requirement: 'Barangay Resolution / Clearance',
        category: 'Legal',
        amount: 15000,
        status: 'Pending',
        assignedStaff: 'Legal Officer',
        submissionDate: new Date().toISOString().split('T')[0],
        sopRef: 'SOP-LEG-01'
      });
      renderLegalChecklistItems(row.legalChecklist);
    };

    document.getElementById('btnSaveLegal').onclick = function() {
      const tracker = getActiveTracker();
      if (activeModalRowIdx === null || !tracker || !tracker.rows[activeModalRowIdx]) return;
      closeModal('modalLegal');
      renderTable();
    };

    // Document Preview Modal
    window.openPreviewModal = function(url, title, type) {
      document.getElementById('preview_title').innerText = title || 'Document';
      const container = document.getElementById('preview_container');
      if (type === 'pdf') {
        container.innerHTML = '<iframe src="' + url + '" style="width:100%;height:100%;border:none;background:white;"></iframe>';
      } else {
        container.innerHTML = '<img src="' + url + '" style="max-width:100%;max-height:100%;object-fit:contain;padding:16px;" alt="' + escapeHtml(title) + '">';
      }
      document.getElementById('btnPreviewDownload').onclick = function() {
        const a = document.createElement('a');
        a.href = url;
        a.download = title || 'file';
        a.click();
      };
      openModal('modalPreview');
    };

    // Row CRUD: Add Row
    document.getElementById('btnAddRow').onclick = function() {
      const tracker = getActiveTracker();
      if (!tracker) return;
      if (!tracker.rows) tracker.rows = [];
      const newIdNum = tracker.rows.length + 1;
      const newSiteId = 'SITE-' + String(newIdNum).padStart(4, '0');
      const now = new Date().toISOString().split('T')[0];

      const newRow = {
        id: 'row_' + Date.now(),
        siteId: newSiteId,
        values: {
          site_id: newSiteId,
          site_name: 'New Site Location ' + newIdNum,
          region: 'NCR',
          province: 'Metro Manila',
          status: 'Site Hunting',
          sla_trigger_date: now
        },
        siteDetails: {
          siteId: newSiteId,
          siteName: 'New Site Location ' + newIdNum,
          region: 'NCR',
          province: 'Metro Manila',
          exactAddress: 'Barangay Center, City',
          landlordName: '',
          landlordContact: '',
          towerHeight: '30',
          coordinates: { lat: 14.5995, lng: 120.9842 },
          picHandler: 'Assigned Handler',
          contractor: 'Turnkey Contractor',
          notes: ''
        },
        slaData: {
          triggerDate: now,
          targetDays: 120,
          slaScopeName: 'Full Build',
          slaHealth: 'on_track',
          milestones: [
            { id: 'ms1', name: 'TSSR Acceptance', targetDaysFromTrigger: 15, targetDate: now, status: 'Completed' },
            { id: 'ms2', name: 'Lease Agreement Signed', targetDaysFromTrigger: 45, targetDate: now, status: 'In Progress' },
            { id: 'ms3', name: 'Building Permit Issuance', targetDaysFromTrigger: 90, targetDate: now, status: 'Pending' }
          ],
          history: []
        },
        legalChecklist: [
          { id: 'leg1', requirement: 'Barangay Resolution', category: 'Legal', amount: 15000, status: 'Completed', assignedStaff: 'Legal PIC', submissionDate: now, sopRef: 'SOP-01' },
          { id: 'leg2', requirement: 'Building Permit Clearance', category: 'Permit', amount: 35000, status: 'Pending', assignedStaff: 'Permit PIC', submissionDate: now, sopRef: 'SOP-02' }
        ],
        documents: [],
        createdAt: now,
        updatedAt: now
      };

      tracker.rows.push(newRow);
      renderTable();
      renderTabs();
    };

    // Single Row Delete
    window.deleteSingleRow = function(rowIdx) {
      const tracker = getActiveTracker();
      if (!tracker || !tracker.rows || !tracker.rows[rowIdx]) return;
      const row = tracker.rows[rowIdx];
      if (!confirm('Delete site record "' + (row.siteId || '') + '"?')) return;

      undoDeletedRows = [row];
      undoTrackerIdx = activeTrackerIdx;

      tracker.rows.splice(rowIdx, 1);
      renderTable();
      renderTabs();
      showUndoToast('Deleted site record: ' + (row.siteId || ''));
    };

    // Delete All Modal
    window.openDeleteAllModal = function() {
      const tracker = getActiveTracker();
      if (!tracker || !tracker.rows) return;
      const totalCount = tracker.rows.length;
      document.getElementById('delAllCountText').innerText = totalCount;

      let filteredCount = totalCount;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        filteredCount = tracker.rows.filter(r => (r.siteId || '').toLowerCase().includes(q)).length;
      }
      document.getElementById('delFilteredCountText').innerText = filteredCount;

      openModal('modalDeleteAll');
    };

    document.getElementById('btnConfirmDeleteAll').onclick = function() {
      const tracker = getActiveTracker();
      if (!tracker || !tracker.rows) return;
      const choice = document.getElementById('delRadioFiltered').checked ? 'filtered' : 'all';

      if (choice === 'all') {
        undoDeletedRows = tracker.rows.slice();
        undoTrackerIdx = activeTrackerIdx;
        const count = tracker.rows.length;
        tracker.rows = [];
        closeModal('modalDeleteAll');
        renderTable();
        renderTabs();
        showUndoToast('Deleted all ' + count + ' rows from sheet.');
      } else {
        const q = searchQuery.toLowerCase().trim();
        const deleted = [];
        const kept = [];
        tracker.rows.forEach(r => {
          if ((r.siteId || '').toLowerCase().includes(q)) {
            deleted.push(r);
          } else {
            kept.push(r);
          }
        });
        undoDeletedRows = deleted;
        undoTrackerIdx = activeTrackerIdx;
        tracker.rows = kept;
        closeModal('modalDeleteAll');
        renderTable();
        renderTabs();
        showUndoToast('Deleted ' + deleted.length + ' filtered rows.');
      }
    };

    function showUndoToast(msg) {
      const toast = document.getElementById('undoToast');
      document.getElementById('undoToastText').innerText = msg;
      toast.classList.add('show');
      setTimeout(() => {
        toast.classList.remove('show');
      }, 10000);
    }

    document.getElementById('btnUndoAction').onclick = function() {
      if (!undoDeletedRows || undoDeletedRows.length === 0) return;
      const tracker = currentBackup.trackers && currentBackup.trackers[undoTrackerIdx];
      if (tracker) {
        if (!tracker.rows) tracker.rows = [];
        tracker.rows = tracker.rows.concat(undoDeletedRows);
        renderTable();
        renderTabs();
      }
      undoDeletedRows = null;
      document.getElementById('undoToast').classList.remove('show');
    };

    document.getElementById('btnCloseUndoToast').onclick = function() {
      document.getElementById('undoToast').classList.remove('show');
    };

    // Export to Excel (.csv)
    document.getElementById('btnExportCsv').onclick = function() {
      const tracker = getActiveTracker();
      if (!tracker) return;
      const cols = getVisibleColumns(tracker);
      const rows = tracker.rows || [];

      let csv = cols.map(c => '"' + (c.label || c.id).replace(/"/g, '""') + '"').join(',') + '\\r\\n';

      rows.forEach(r => {
        const line = cols.map(c => {
          let v = c.type === 'site_id' ? (r.siteId || '') : (r.values ? r.values[c.id] : '');
          if (v === undefined || v === null) v = '';
          if (typeof v === 'object') v = JSON.stringify(v);
          return '"' + String(v).replace(/"/g, '""') + '"';
        }).join(',');
        csv += line + '\\r\\n';
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = (tracker.name || 'Tracker').replace(/[^a-zA-Z0-9_-]/g, '_') + '_Export.csv';
      a.click();
      URL.revokeObjectURL(url);
    };

    // Save JSON Copy
    document.getElementById('btnExportJson').onclick = function() {
      const str = JSON.stringify(currentBackup, null, 2);
      const blob = new Blob([str], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'GEM_PRO_Updated_Backup_' + new Date().toISOString().replace(/[:.]/g, '-') + '.json';
      a.click();
      URL.revokeObjectURL(url);
    };

    // Load External Backup JSON
    function loadBackupFile(file) {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const parsed = JSON.parse(evt.target.result);
          if (parsed.data && Array.isArray(parsed.data.trackers)) {
            currentBackup = parsed.data;
          } else if (Array.isArray(parsed.trackers)) {
            currentBackup = parsed;
          } else if (Array.isArray(parsed)) {
            currentBackup = { trackers: parsed };
          }
          activeTrackerIdx = 0;
          document.getElementById('bannerText').innerText = '✓ Loaded external backup: "' + file.name + '"';
          document.getElementById('loadedTimeText').innerText = 'Loaded: ' + new Date().toLocaleTimeString();
          renderTabs();
          renderTable();
        } catch (err) {
          alert('Failed to parse backup JSON file. Please ensure it is a valid GEM PRO backup export.');
        }
      };
      reader.readAsText(file);
    }

    function setupEvents() {
      document.getElementById('searchInput').oninput = (e) => {
        searchQuery = e.target.value;
        renderTable();
      };

      document.getElementById('backupFileInput').onchange = (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) loadBackupFile(file);
      };

      // Drag and drop entire window
      const dropZone = document.getElementById('dropZoneFull');
      window.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.display = 'flex';
      });
      dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropZone.style.display = 'none';
      });
      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.display = 'none';
        const file = e.dataTransfer.files && e.dataTransfer.files[0];
        if (file) loadBackupFile(file);
      });
    }

    window.onload = init;
  </script>
</body>
</html>`;
}

/**
 * Trigger immediate download of the standalone single-file HTML viewer.
 */
export function downloadStandaloneViewerHtml(backupData: StandaloneBackupData, customFileName?: string) {
  const htmlContent = generateStandaloneViewerHtml(backupData);
  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  a.href = url;
  a.download = customFileName || `GEM_PRO_Standalone_Local_Viewer_${timestamp}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
