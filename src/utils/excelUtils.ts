import * as XLSX from 'xlsx';
import {
  Tracker,
  TrackerRow,
  LegalChecklistItem,
  SlaMilestone,
  SlaHealthStatus,
  ProjectSlaConfig,
  SlaScopeType,
  SlaMilestoneTemplate,
} from '../types/tracker';

/**
 * Format number as Philippine Peso currency
 */
export function formatCurrencyPHP(val: number | string | undefined | null): string {
  if (val === undefined || val === null || val === '') return '₱0.00';
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^0-9.-]+/g, ''));
  if (isNaN(num)) return '₱0.00';
  return '₱' + num.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Parse currency or clean numeric string into float
 * Accurately parses:
 * - Direct numbers (e.g. 8029, 8435.41)
 * - Formatted currency: "₱1,120,975.53", "PHP 50,000.00", "8,029.00"
 * - Accounting negatives: "(1,500.00)" or "-1,500.00"
 * - Clean decimals
 * - Recovers legacy Excel date serial numbers in amounts (1900-1999)
 */
export function parseNumericValue(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (val === undefined || val === null || val === '') return 0;
  const str = String(val).trim();
  if (!str) return 0;

  // If this is a modern date string (year >= 2000), it is a date, not an amount!
  const modernDateMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (modernDateMatch) {
    const yr = parseInt(modernDateMatch[1], 10);
    if (yr >= 2000) {
      return 0;
    }
    // If year is 1900-1999 (e.g. 1921-12-23), it's an Excel serial date representation of an amount!
    const mon = parseInt(modernDateMatch[2], 10);
    const day = parseInt(modernDateMatch[3], 10);
    const epoch = Date.UTC(1899, 11, 30);
    const target = Date.UTC(yr, mon - 1, day);
    const diff = Math.round((target - epoch) / 86400000);
    if (diff > 0 && diff < 1000000) return diff;
    return 0;
  }

  // Accounting negative notation: (1,234.56) or -$1,234.56
  const isNegative = /^\s*\(.*\)\s*$/.test(str) || /^\s*-/.test(str);
  
  // Extract number, supporting currency symbols like ₱, $, PHP, commas
  // E.g. "₱80,700 (1/7 Done)" -> "80700"
  const cleanMatch = str.match(/[-+]?[0-9,]+(\.[0-9]+)?/);
  if (!cleanMatch) return 0;
  const cleaned = cleanMatch[0].replace(/,/g, '');
  if (!cleaned) return 0;

  const parsed = parseFloat(cleaned);
  if (isNaN(parsed)) return 0;
  return isNegative ? -Math.abs(parsed) : parsed;
}

/**
 * Copy 2D array or cell selection to tab-separated clipboard (Excel compatible)
 */
export async function copyToExcelClipboard(data: string[][]): Promise<boolean> {
  try {
    const tsv = data.map(row => row.join('\t')).join('\n');
    await navigator.clipboard.writeText(tsv);
    return true;
  } catch (err) {
    console.warn('Failed to copy to clipboard:', err);
    return false;
  }
}

/**
 * Parse clipboard text pasted from Excel (TSV or CSV format)
 */
export function parseExcelClipboardText(text: string): string[][] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rows = normalized.split('\n');
  if (rows.length > 0 && rows[rows.length - 1] === '') {
    rows.pop(); // remove trailing newline
  }
  return rows.map(r => r.split('\t'));
}

/**
 * Export Tracker as real .xlsx Excel file
 */
export function exportTrackerToExcel(tracker: Tracker) {
  const visibleCols = tracker.columns.filter((c) => c.visible);
  
  // Headers
  const headerRow = visibleCols.map((c) => c.label);
  
  // Data rows (exclude any existing accidental SUMMARY row)
  const validRows = (tracker.rows || []).filter(
    (r) => r && r.siteId !== 'SUMMARY' && r.values?.site_id !== 'SUMMARY'
  );

  const numCols = visibleCols.length;
  const colSums = new Float64Array(numCols);
  const colCounts = new Int32Array(numCols);

  const dataRows: any[][] = new Array(validRows.length);

  for (let rIdx = 0; rIdx < validRows.length; rIdx++) {
    const row = validRows[rIdx];
    const vals = row.values || {};
    const rowData = new Array(numCols);

    for (let cIdx = 0; cIdx < numCols; cIdx++) {
      const col = visibleCols[cIdx];
      let cellVal: any = '';

      if (col.type === 'site_id') {
        cellVal = row.siteId || vals.site_id || '';
      } else if (col.type === 'amount' || col.type === 'number') {
        const raw = vals[col.id];
        if (raw !== undefined && raw !== null && raw !== '') {
          cellVal = typeof raw === 'number' ? raw : parseNumericValue(raw);
          if (typeof cellVal === 'number' && !isNaN(cellVal)) {
            colSums[cIdx] += cellVal;
            colCounts[cIdx]++;
          }
        }
      } else if (col.type === 'sla_trigger_date') {
        cellVal = vals.sla_trigger_date || row.slaData?.triggerDate || '';
      } else if (col.type === 'sla_health') {
        cellVal = vals.sla_health_col || row.slaData?.slaHealth || 'on_track';
      } else if (col.type === 'day_sla') {
        cellVal = `${row.slaData?.currentStatus || 'Active'} (${row.slaData?.slaHealth || 'on_track'})`;
      } else if (col.type === 'legal_checklist') {
        const list = Array.isArray(row.legalChecklist) ? row.legalChecklist : [];
        let budget = 0;
        for (let k = 0; k < list.length; k++) {
          budget += list[k].amount || 0;
        }
        if (budget <= 0 && vals.total_legal_budget) {
          budget = parseNumericValue(vals.total_legal_budget);
        }
        if (budget <= 0 && vals[col.id]) {
          budget = parseNumericValue(vals[col.id]);
        }
        cellVal = budget > 0 ? budget : '';
        if (budget > 0) {
          colSums[cIdx] += budget;
          colCounts[cIdx]++;
        }
      } else if (col.type === 'image' || col.type === 'pdf') {
        const raw = vals[col.id];
        if (!raw) {
          cellVal = '';
        } else if (typeof raw === 'object' && raw.name) {
          cellVal = `${raw.name} (${raw.type?.toUpperCase() || 'FILE'}${raw.size ? ` · ${raw.size}` : ''})`;
        } else if (typeof raw === 'string') {
          cellVal = raw.startsWith('data:') ? 'Attached File' : raw;
        } else {
          cellVal = String(raw);
        }
      } else {
        const raw = vals[col.id];
        if (typeof raw === 'object' && raw !== null && raw.name) {
          cellVal = raw.name;
        } else {
          cellVal = raw ?? '';
        }
        if (col.summaryType === 'sum' || col.summaryType === 'avg') {
          const num = typeof cellVal === 'number' ? cellVal : parseNumericValue(cellVal);
          if (num) {
            colSums[cIdx] += num;
            colCounts[cIdx]++;
          }
        }
      }

      rowData[cIdx] = cellVal;
    }

    dataRows[rIdx] = rowData;
  }

  // Summary Row computed directly from single-pass totals
  const summaryRow = new Array(numCols);
  for (let cIdx = 0; cIdx < numCols; cIdx++) {
    const col = visibleCols[cIdx];
    if (cIdx === 0) {
      summaryRow[cIdx] = 'SUMMARY';
    } else if (col.summaryType === 'sum') {
      summaryRow[cIdx] = colSums[cIdx];
    } else if (col.summaryType === 'avg') {
      const cnt = colCounts[cIdx] || validRows.length;
      summaryRow[cIdx] = cnt > 0 ? Math.round((colSums[cIdx] / cnt) * 10) / 10 : 0;
    } else if (col.summaryType === 'count') {
      summaryRow[cIdx] = validRows.length;
    } else {
      summaryRow[cIdx] = '';
    }
  }

  const fullGrid = [headerRow, ...dataRows, summaryRow];
  const worksheet = XLSX.utils.aoa_to_sheet(fullGrid);

  // Set column widths
  worksheet['!cols'] = visibleCols.map((c) => ({ wch: Math.max(14, Math.floor(c.width / 8)) }));

  const workbook = XLSX.utils.book_new();
  const safeSheetName = tracker.name.replace(/[:\\/?*[\]]/g, '_').substring(0, 31) || 'Tracker';
  XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName);

  const fileName = `${tracker.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}

/**
 * Export Legal Fees & Compliance Checklist to Excel
 */
export function exportChecklistToExcel(checklist: LegalChecklistItem[], siteId: string) {
  const headers = ['Requirement', 'Category', 'Status', 'Amount (PHP)', 'Assigned Staff', 'Submission Date', 'Completion Date', 'SOP Ref'];
  const rows = checklist.map(item => [
    item.requirement,
    item.category,
    item.status,
    item.amount,
    item.assignedStaff,
    item.submissionDate,
    item.completionDate || '',
    item.sopRef,
  ]);

  const totalAmount = checklist.reduce((sum, item) => sum + item.amount, 0);
  const completedAmount = checklist.filter(i => i.status === 'Completed').reduce((sum, item) => sum + item.amount, 0);

  const summary = [
    ['Total Requirements:', checklist.length, 'Total Budget (PHP):', totalAmount],
    ['Completed Requirements:', checklist.filter(i => i.status === 'Completed').length, 'Disbursed (PHP):', completedAmount],
  ];

  const fullSheet = [
    [`LEGAL FEES & COMPLIANCE CHECKLIST — SITE ${siteId}`],
    [],
    headers,
    ...rows,
    [],
    ...summary,
  ];

  const ws = XLSX.utils.aoa_to_sheet(fullSheet);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Legal_Checklist');
  XLSX.writeFile(wb, `Legal_Checklist_${siteId}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * Parse Legal Fees & Compliance Checklist from imported Excel rows
 */
export function parseChecklistFromExcel(rows: any[][]): LegalChecklistItem[] {
  if (!Array.isArray(rows) || rows.length === 0) return [];

  // Find header row or use sequential columns
  let headerIndex = -1;
  let colMap = {
    requirement: 0,
    category: 1,
    status: 2,
    amount: 3,
    assignedStaff: 4,
    submissionDate: 5,
    completionDate: 6,
    sopRef: 7,
  };

  for (let r = 0; r < Math.min(6, rows.length); r++) {
    const row = rows[r];
    if (!Array.isArray(row)) continue;
    const lowerCells = row.map((c) => String(c || '').toLowerCase().trim());
    if (lowerCells.some((c) => c.includes('requirement') || c.includes('item') || c.includes('compliance'))) {
      headerIndex = r;
      lowerCells.forEach((c, idx) => {
        if (c.includes('requirement') || c.includes('item') || c.includes('description')) colMap.requirement = idx;
        else if (c.includes('category') || c.includes('type')) colMap.category = idx;
        else if (c.includes('status')) colMap.status = idx;
        else if (c.includes('amount') || c.includes('budget') || c.includes('fee') || c.includes('cost') || c.includes('php') || c.includes('₱')) colMap.amount = idx;
        else if (c.includes('staff') || c.includes('pic') || c.includes('assign') || c.includes('handler')) colMap.assignedStaff = idx;
        else if (c.includes('submission') || c.includes('submit') || c.includes('filed')) colMap.submissionDate = idx;
        else if (c.includes('completion') || c.includes('complete') || c.includes('approved')) colMap.completionDate = idx;
        else if (c.includes('sop') || c.includes('ref')) colMap.sopRef = idx;
      });
      break;
    }
  }

  const startRow = headerIndex >= 0 ? headerIndex + 1 : 0;
  const items: LegalChecklistItem[] = [];
  const validCategories: ('Legal' | 'Permit' | 'Social' | 'Clearance')[] = ['Legal', 'Permit', 'Social', 'Clearance'];
  const validStatuses: ('Completed' | 'In Progress' | 'Pending' | 'Under Review')[] = ['Completed', 'In Progress', 'Pending', 'Under Review'];

  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i];
    if (!Array.isArray(row) || row.length === 0) continue;
    const reqText = String(row[colMap.requirement] || '').trim();
    if (!reqText || reqText.toLowerCase().includes('total') || reqText.toLowerCase().includes('summary') || reqText.toLowerCase() === 'requirement') {
      continue;
    }

    const rawCat = String(row[colMap.category] || '').trim();
    const matchedCat = validCategories.find((c) => c.toLowerCase() === rawCat.toLowerCase()) || 'Legal';

    const rawStatus = String(row[colMap.status] || '').trim();
    const matchedStatus = validStatuses.find((s) => s.toLowerCase() === rawStatus.toLowerCase()) || (rawStatus.toLowerCase().includes('done') || rawStatus.toLowerCase().includes('comp') ? 'Completed' : 'Pending');

    const rawAmt = row[colMap.amount];
    const parsedAmt = parseNumericValue(rawAmt) || 0;

    const rawStaff = String(row[colMap.assignedStaff] || '').trim() || 'Atty. R. Santos';
    const rawSubDate = normalizeToStandardDate(row[colMap.submissionDate]) || getLocalDateString();
    const rawCompDate = normalizeToStandardDate(row[colMap.completionDate]) || undefined;
    const rawSop = String(row[colMap.sopRef] || '').trim() || 'SOP-LEG-01';

    items.push({
      id: 'chk_imp_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6),
      requirement: reqText,
      category: matchedCat,
      status: matchedStatus,
      amount: parsedAmt,
      assignedStaff: rawStaff,
      submissionDate: rawSubDate,
      completionDate: rawCompDate,
      sopRef: rawSop,
    });
  }

  return items;
}

/**
 * Check if a string or value looks like a date representation.
 * STRICT: Pure numbers and currency strings are NEVER dates!
 */
export function looksLikeDateString(val: any): boolean {
  if (val === undefined || val === null || val === '') return false;
  if (val instanceof Date) return true;
  // Numbers are NEVER dates unless explicitly tagged with date format in Excel cell
  if (typeof val === 'number') return false;
  const str = String(val).trim();
  if (!str) return false;

  // Pure digits, commas, decimals (e.g. "50000", "8435.41", "1,500.00", "₱80,700") are NOT dates!
  if (/^[₱$€¥A-Za-z\s]*[0-9,]+(\.[0-9]+)?$/.test(str) && !/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(str)) {
    return false;
  }

  // Must have standard date delimiter with 2 or 3 components
  if (/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/.test(str)) return true;
  if (/^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}/.test(str)) return true;
  if (/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(str)) return true;
  return false;
}

/**
 * Standardize ANY date representation into uniform ISO YYYY-MM-DD format
 * Accurately parses:
 * - Excel numeric serial numbers (e.g. 45424, 45293, 44927)
 * - Numeric string serials ("45424")
 * - JavaScript Date objects (without UTC/local timezone day-shift errors)
 * - US/PH MM/DD/YYYY and MM-DD-YYYY
 * - International DD/MM/YYYY
 * - Standard ISO YYYY-MM-DD and timestamp strings (2024-10-15T00:00:00Z)
 * - Text months: "24-Oct-2024", "Oct 24, 2024", "October 24, 2024", "24-Nov-24"
 */
export function normalizeToStandardDate(val: any): string {
  if (val === undefined || val === null || val === '') return '';
  const str = String(val).trim();
  if (
    !str ||
    str === '-' ||
    str.toLowerCase() === 'n/a' ||
    str.toLowerCase() === 'none' ||
    str.toLowerCase() === 'null' ||
    str.toLowerCase() === 'undefined'
  ) {
    return '';
  }

  // 1. If JavaScript Date instance
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '';
    // SheetJS / ISO UTC midnight protection (avoids UTC-8 or UTC-7 previous-day rollback)
    if (val.getUTCHours() === 0 && val.getUTCMinutes() === 0) {
      const y = val.getUTCFullYear();
      const m = String(val.getUTCMonth() + 1).padStart(2, '0');
      const d = String(val.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // 2. If Excel serial number (number or numeric string between 35000 and 65000, i.e. 1995 to 2077)
  // e.g. 45424 = 2024-05-12, 45293 = 2024-01-02. Amounts (e.g. 8029, 2000, 10000) are NOT dates!
  const numericVal = typeof val === 'number' ? val : parseFloat(str);
  if (!isNaN(numericVal) && /^\d{5}(\.\d+)?$/.test(str) && numericVal >= 35000 && numericVal <= 65000) {
    // Excel 1900 date system formula:
    // Lotus 1-2-3 leap year bug adjustment for serial > 60:
    const adjusted = numericVal > 60 ? numericVal - 1 : numericVal;
    // Epoch: 1899-12-31 UTC
    const epochMs = Date.UTC(1899, 11, 31);
    const dateMs = epochMs + Math.round((adjusted - 1) * 86400000);
    const d = new Date(dateMs);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  // 3. If already ISO YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (ymdMatch) {
    const y = ymdMatch[1];
    const m = ymdMatch[2].padStart(2, '0');
    const d = ymdMatch[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // 4. ISO timestamp string with T (e.g. "2024-10-15T00:00:00.000Z")
  if (str.includes('T')) {
    const datePart = str.split('T')[0];
    const subMatch = datePart.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (subMatch) {
      return `${subMatch[1]}-${subMatch[2].padStart(2, '0')}-${subMatch[3].padStart(2, '0')}`;
    }
  }

  // 5. Named Month text (e.g. "24-Oct-2024", "Oct 24, 2024", "October 24, 2024", "24-Nov-24")
  const MONTH_MAP: Record<string, string> = {
    jan: '01', january: '01',
    feb: '02', february: '02',
    mar: '03', march: '03',
    apr: '04', april: '04',
    may: '05',
    jun: '06', june: '06',
    jul: '07', july: '07',
    aug: '08', august: '08',
    sep: '09', sept: '09', september: '09',
    oct: '10', october: '10',
    nov: '11', november: '11',
    dec: '12', december: '12',
  };

  // Pattern A: DD-Mon-YYYY or DD Mon YYYY (e.g. 24-Nov-2024, 24 Nov 2024, 24-Nov-24)
  const dMonYMatch = str.match(/^(\d{1,2})[-/ ]+([a-zA-Z]{3,9})[-/ ,]+(\d{2,4})$/);
  if (dMonYMatch) {
    const d = dMonYMatch[1].padStart(2, '0');
    const monKey = dMonYMatch[2].toLowerCase();
    const m = MONTH_MAP[monKey] || MONTH_MAP[monKey.slice(0, 3)];
    let y = parseInt(dMonYMatch[3], 10);
    if (y < 100) y += y > 50 ? 1900 : 2000;
    if (m) return `${y}-${m}-${d}`;
  }

  // Pattern B: Mon DD, YYYY or Month DD YYYY (e.g. Nov 24, 2024 or November 24, 2024)
  const monDYMatch = str.match(/^([a-zA-Z]{3,9})[-/ ]+(\d{1,2})[-/ ,]+(\d{2,4})$/);
  if (monDYMatch) {
    const monKey = monDYMatch[1].toLowerCase();
    const m = MONTH_MAP[monKey] || MONTH_MAP[monKey.slice(0, 3)];
    const d = monDYMatch[2].padStart(2, '0');
    let y = parseInt(monDYMatch[3], 10);
    if (y < 100) y += y > 50 ? 1900 : 2000;
    if (m) return `${y}-${m}-${d}`;
  }

  // 6. Delimited numeric date (e.g. 10/24/2024, 24/10/2024, 10-24-2024, 10/24/24)
  const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (dmyMatch) {
    const p1 = parseInt(dmyMatch[1], 10);
    const p2 = parseInt(dmyMatch[2], 10);
    let y = parseInt(dmyMatch[3], 10);
    if (y < 100) y += y > 50 ? 1900 : 2000;

    let m = p1;
    let d = p2;
    // If first part is > 12, it is definitely Day (DD/MM/YYYY)
    if (p1 > 12 && p2 <= 12) {
      d = p1;
      m = p2;
    }
    // Else default to MM/DD/YYYY standard
    const mStr = String(m).padStart(2, '0');
    const dStr = String(d).padStart(2, '0');
    return `${y}-${mStr}-${dStr}`;
  }

  // 7. General JS Date parse fallback
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    if (y >= 1970 && y <= 2100) {
      if (parsed.getUTCHours() === 0 && parsed.getUTCMinutes() === 0) {
        return `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, '0')}-${String(parsed.getUTCDate()).padStart(2, '0')}`;
      }
      return `${y}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
    }
  }

  return str;
}

/**
 * Format date for clean, uniform display
 * Standardizes to ISO YYYY-MM-DD or user chosen format
 */
export function formatDateDisplay(
  val: any,
  displayFormat: 'YYYY-MM-DD' | 'MMM DD, YYYY' | 'DD/MM/YYYY' | 'MM/DD/YYYY' = 'YYYY-MM-DD'
): string {
  if (!val) return '';
  const std = normalizeToStandardDate(val);
  if (!std || !/^\d{4}-\d{2}-\d{2}$/.test(std)) return String(val || '');

  if (displayFormat === 'YYYY-MM-DD') {
    return std;
  }

  const parts = std.split('-');
  const y = parts[0];
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);

  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  if (displayFormat === 'MMM DD, YYYY') {
    return `${MONTH_NAMES[m - 1]} ${String(d).padStart(2, '0')}, ${y}`;
  }
  if (displayFormat === 'DD/MM/YYYY') {
    return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
  }
  if (displayFormat === 'MM/DD/YYYY') {
    return `${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}/${y}`;
  }

  return std;
}

export interface ExcelParsedSheet {
  name: string;
  rowCount: number;
  colCount: number;
  rows: any[][];
}

export interface ExcelWorkbookResult {
  sheetNames: string[];
  activeSheetName: string;
  sheets: Record<string, ExcelParsedSheet>;
  rows: any[][];
}

/**
 * Clean 2D raw rows from SheetJS:
 * - Dates normalized without timezone shift
 * - Numbers preserved as numbers
 * - Strings trimmed
 * - Nulls/undefined converted to ''
 */
export function cleanRawSpreadsheetRows(rawRows: any[][]): any[][] {
  if (!Array.isArray(rawRows) || rawRows.length === 0) return [];
  const cleaned: any[][] = new Array(rawRows.length);
  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!Array.isArray(row)) {
      cleaned[i] = [];
      continue;
    }
    const rowLen = row.length;
    const newRow = new Array(rowLen);
    for (let j = 0; j < rowLen; j++) {
      const cell = row[j];
      if (cell === null || cell === undefined) {
        newRow[j] = '';
      } else if (cell instanceof Date) {
        newRow[j] = normalizeToStandardDate(cell);
      } else if (typeof cell === 'number') {
        newRow[j] = isNaN(cell) ? '' : cell;
      } else if (typeof cell === 'string') {
        newRow[j] = cell.trim();
      } else {
        newRow[j] = cell;
      }
    }
    cleaned[i] = newRow;
  }
  return cleaned;
}

/**
 * Import complete Excel / CSV workbook with multi-sheet inspection:
 * Automatically identifies the best data sheet (most populated rows/columns),
 * while preserving all other sheets for user switching in the UI.
 */
export async function readExcelWorkbook(file: File): Promise<ExcelWorkbookResult> {
  const buffer = await file.arrayBuffer();
  // cellDates: true parses real date cells into JS Date objects
  const workbook = XLSX.read(buffer, {
    type: 'array',
    cellDates: true,
    raw: true,
    dateNF: 'yyyy-mm-dd',
  });

  const sheetNames = workbook.SheetNames || [];
  if (sheetNames.length === 0) {
    return {
      sheetNames: [],
      activeSheetName: '',
      sheets: {},
      rows: [],
    };
  }

  const sheets: Record<string, ExcelParsedSheet> = {};
  let bestSheetName = sheetNames[0];
  let maxScore = -1;

  for (const name of sheetNames) {
    const ws = workbook.Sheets[name];
    if (!ws) continue;

    const rawRows: any[][] = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      defval: '',
      raw: true,
      blankrows: true,
    });

    const cleaned = cleanRawSpreadsheetRows(rawRows);
    const populatedRowCount = cleaned.filter((r) =>
      r && r.some((c) => c !== undefined && c !== null && String(c).trim() !== '')
    ).length;

    const maxCols = cleaned.reduce((acc, r) => Math.max(acc, r?.length || 0), 0);

    sheets[name] = {
      name,
      rowCount: cleaned.length,
      colCount: maxCols,
      rows: cleaned,
    };

    // Score sheet to choose primary data sheet:
    // populated rows * populated columns; penalize sheets with names like "Readme", "Instructions", "Cover", "Template"
    const lowerName = name.toLowerCase();
    let penalty = 1;
    if (lowerName.includes('readme') || lowerName.includes('instruction') || lowerName.includes('cover') || lowerName.includes('notes')) {
      penalty = 0.1;
    }
    const score = populatedRowCount * maxCols * penalty;
    if (score > maxScore && populatedRowCount > 0) {
      maxScore = score;
      bestSheetName = name;
    }
  }

  const activeSheet = sheets[bestSheetName] || sheets[sheetNames[0]];

  return {
    sheetNames,
    activeSheetName: activeSheet ? activeSheet.name : sheetNames[0],
    sheets,
    rows: activeSheet ? activeSheet.rows : [],
  };
}

/**
 * Import Excel / CSV file into Tracker rows with cell format & date awareness
 * Automatically selects the primary data sheet across multi-sheet workbooks.
 */
export async function readExcelFile(file: File, sheetNameOrIndex?: string | number): Promise<any[][]> {
  const result = await readExcelWorkbook(file);
  if (typeof sheetNameOrIndex === 'string' && result.sheets[sheetNameOrIndex]) {
    return result.sheets[sheetNameOrIndex].rows;
  }
  if (typeof sheetNameOrIndex === 'number' && result.sheetNames[sheetNameOrIndex] && result.sheets[result.sheetNames[sheetNameOrIndex]]) {
    return result.sheets[result.sheetNames[sheetNameOrIndex]].rows;
  }
  return result.rows;
}

/**
 * Official Telecom SAQ & Civil SLA Stage Rules:
 * 1. 2 Days: Site Hunting
 * 2. 21 Days: Securing Property Document (Cumulative 23d from Day 0)
 * 3. 44 Days: Securing Pre-Con (Cumulative 67d from Day 0)
 * 4. 21 Days: Securing Post-Con (Cumulative 88d from Day 0)
 * 5. 7 Days: FAC Submission (Cumulative 95d from Day 0)
 * 6. 98 Days: Total SLA from Site Hunting to FAC Submission & Acceptance
 * 7. 156 Days: Total SLA from Site Hunting to Site Closed
 */
export interface TelecomSlaStageRule {
  id: string;
  name: string;
  stageDays: number;
  cumulativeDays: number;
  description: string;
}

export const TELECOM_SLA_STAGE_RULES: TelecomSlaStageRule[] = [
  { id: 'm1', name: 'Site Hunting', stageDays: 2, cumulativeDays: 2, description: '2 Days SLA for Site Hunting' },
  { id: 'm2', name: 'Securing Property Document', stageDays: 21, cumulativeDays: 23, description: '21 Days SLA for Securing Property Document' },
  { id: 'm3', name: 'Securing Pre-Con', stageDays: 44, cumulativeDays: 67, description: '44 Days SLA for Securing Pre-Con' },
  { id: 'm4', name: 'Securing Post-Con', stageDays: 21, cumulativeDays: 88, description: '21 Days SLA for Securing Post-Con' },
  { id: 'm5', name: 'FAC Submission', stageDays: 7, cumulativeDays: 95, description: '7 Days SLA for FAC Submission' },
  { id: 'm6', name: 'FAC Acceptance / Approval', stageDays: 3, cumulativeDays: 98, description: '98 Days Total from Site Hunting to FAC Submission & Approval' },
  { id: 'm7', name: 'Site Closed', stageDays: 58, cumulativeDays: 156, description: '156 Days Total from Site Hunting for Site Closed' },
];

/**
 * Pre-defined SLA Project Scopes tailored to Telecom & Rollout requirements
 * Specifically accounts for scopes like "Securing Post-Con Only" (21 Days)
 */
export const SLA_SCOPE_PRESETS: ProjectSlaConfig[] = [
  {
    scopeType: 'post_con_21d',
    scopeName: 'Securing Post-Con Only (21d SLA)',
    targetDays: 21,
    description: 'Specialized endorsement for securing post-construction clearance, joint technical inspection, and certificate of acceptance within 21 days.',
    milestones: [
      { name: 'Post-Con Endorsement Kickoff & Audit', targetDaysFromTrigger: 3, description: 'Kickoff meeting, drawing review, and compliance checklist.' },
      { name: 'Barangay & LGU Post-Con Inspection', targetDaysFromTrigger: 10, description: 'Local government and barangay site validation inspection.' },
      { name: 'Joint Technical Audit & Rectification', targetDaysFromTrigger: 17, description: 'Joint audit with operator and punchlist completion.' },
      { name: 'Certificate of Final Acceptance (Signed)', targetDaysFromTrigger: 21, description: 'Final post-con securing sign-off and site handover.' },
    ],
  },
  {
    scopeType: 'property_securing_21d',
    scopeName: 'Securing Property Document (21d SLA)',
    targetDays: 21,
    description: 'Fast-track site acquisition focused on property documents, title investigation, and notarized contract of lease.',
    milestones: [
      { name: 'Lessor Offer Letter & Initial Term Sheet', targetDaysFromTrigger: 5, description: 'Lessor negotiation and signing of offer sheet.' },
      { name: 'Title Search & Certified True Copy', targetDaysFromTrigger: 12, description: 'Registry of Deeds title verification & tax declaration.' },
      { name: 'Contract of Lease Drafting & Review', targetDaysFromTrigger: 17, description: 'Legal team and lessor contract terms agreement.' },
      { name: 'Notarized Contract of Lease Secured', targetDaysFromTrigger: 21, description: 'Signed and notarized contract of lease package.' },
    ],
  },
  {
    scopeType: 'permits_30d',
    scopeName: 'LGU Permits & Clearances (30d SLA)',
    targetDays: 30,
    description: 'Statutory government clearances, CAAP/ATO height clearance, and building permit processing.',
    milestones: [
      { name: 'Barangay Resolution & Locational Clearance', targetDaysFromTrigger: 7, description: 'Barangay resolution of no objection & zoning endorsement.' },
      { name: 'CAAP Height Clearance / ATO Filing', targetDaysFromTrigger: 15, description: 'Civil Aviation Authority height clearance certification.' },
      { name: 'Building Permit Plan Assessment', targetDaysFromTrigger: 25, description: 'City/municipal engineering assessment & receipt of fees.' },
      { name: 'Approved Building Permit Released', targetDaysFromTrigger: 30, description: 'Official building permit, FSEC, and electrical permit.' },
    ],
  },
  {
    scopeType: 'pre_con_44d',
    scopeName: 'Securing Pre-Con & Civil Works (44d SLA)',
    targetDays: 44,
    description: 'Pre-construction phase including geotechnical soil test, structural design, safety, and contractor mobilization.',
    milestones: [
      { name: 'Soil Investigation & Geotechnical Test', targetDaysFromTrigger: 10, description: 'Borehole testing and soil bearing capacity certification.' },
      { name: 'Structural Analysis & Tower Design', targetDaysFromTrigger: 24, description: 'PECE/Civil engineer stamped structural design package.' },
      { name: 'Construction Safety (CSHP) & Clearances', targetDaysFromTrigger: 34, description: 'DOLE CSHP approval and neighbor notices.' },
      { name: 'Pre-Con Notice to Proceed (NTP)', targetDaysFromTrigger: 44, description: 'Civil contractor mobilization and ground-breaking NTP.' },
    ],
  },
  {
    scopeType: 'full_turnkey_156d',
    scopeName: 'Full Turnkey Tower Rollout (156d SLA)',
    targetDays: 156,
    description: 'Standard end-to-end tower construction and rollout from hunting to on-air integration.',
    milestones: [
      { name: 'Site Hunting (2d)', targetDaysFromTrigger: 2, description: '2 Day initial site candidate nomination.' },
      { name: 'Securing Property Document (21d / Day 23)', targetDaysFromTrigger: 23, description: 'Title search, lease agreement, and owner consent.' },
      { name: 'Securing Pre-Con (44d / Day 67)', targetDaysFromTrigger: 67, description: 'Geotechnical, structural design, and building permit.' },
      { name: 'Securing Post-Con (21d / Day 88)', targetDaysFromTrigger: 88, description: 'Tower erection, equipment install, and civil audit.' },
      { name: 'FAC Submission (10d / Day 98)', targetDaysFromTrigger: 98, description: 'Final acceptance certificate documentation.' },
      { name: 'Site Closed / On-Air (156d Total)', targetDaysFromTrigger: 156, description: 'Integration, commissioning, and commercial on-air.' },
    ],
  },
];

/**
 * Check if SLA tracking is enabled for a specific tracker.
 * Returns false if explicitly disabled; defaults to true for backwards compatibility.
 */
export function isTrackerSlaEnabled(tracker?: Tracker): boolean {
  if (!tracker) return false;
  if (tracker.enableSla !== undefined) return tracker.enableSla;
  if (tracker.slaConfig?.enabled !== undefined) return tracker.slaConfig.enabled;
  return true;
}

export function getEffectiveTrackerSlaConfig(tracker?: Tracker): ProjectSlaConfig {
  if (tracker?.slaConfig) return tracker.slaConfig;
  const name = String(tracker?.name || '').toLowerCase();
  if (name.includes('post con') || name.includes('postcon') || name.includes('post-con')) {
    return SLA_SCOPE_PRESETS[0]; // post_con_21d
  }
  if (name.includes('legal') || name.includes('permit')) {
    return SLA_SCOPE_PRESETS[2]; // permits_30d
  }
  return SLA_SCOPE_PRESETS[4]; // full_turnkey_156d
}

export function createMilestonesFromTemplate(
  milestonesTemplate: SlaMilestoneTemplate[],
  triggerDate: string,
  targetDate?: string
): SlaMilestone[] {
  const stdTrigger = normalizeToStandardDate(triggerDate) || getLocalDateString();
  return milestonesTemplate.map((tpl, idx) => {
    const isLast = idx === milestonesTemplate.length - 1;
    const finalDate =
      isLast && targetDate
        ? normalizeToStandardDate(targetDate)
        : addDaysToDateString(stdTrigger, tpl.targetDaysFromTrigger);
    return {
      id: 'm_' + (idx + 1),
      name: tpl.name,
      targetDaysFromTrigger: tpl.targetDaysFromTrigger,
      targetDate: finalDate || addDaysToDateString(stdTrigger, tpl.targetDaysFromTrigger),
      status: idx === 0 ? 'In Progress' : 'Pending',
    };
  });
}

export function createCustomSlaMilestones(
  triggerDate: string,
  scopeType: SlaScopeType = 'post_con_21d',
  customTargetDays?: number,
  customMilestones?: SlaMilestoneTemplate[],
  targetDate?: string
): SlaMilestone[] {
  const stdTrigger = normalizeToStandardDate(triggerDate) || getLocalDateString();
  if (customMilestones && customMilestones.length > 0) {
    return createMilestonesFromTemplate(customMilestones, stdTrigger, targetDate);
  }
  const preset = SLA_SCOPE_PRESETS.find((p) => p.scopeType === scopeType) || SLA_SCOPE_PRESETS[0];
  return createMilestonesFromTemplate(preset.milestones, stdTrigger, targetDate);
}

/**
 * Creates standard SLA milestones according to exact Telecom SLA requirements:
 * 2d Site Hunting, 21d Securing Property Document (Day 23), 44d Securing Pre-Con (Day 67),
 * 21d Securing Post-Con (Day 88), 7d FAC Submission / 98d Total (Day 98), 156d Site Closed (Day 156)
 */
export function createStandardSlaMilestones(
  triggerDate: string,
  targetOnAirDate?: string
): SlaMilestone[] {
  const stdTrigger = normalizeToStandardDate(triggerDate) || getLocalDateString();
  const finalDate = targetOnAirDate
    ? normalizeToStandardDate(targetOnAirDate)
    : addDaysToDateString(stdTrigger, 156);

  return [
    {
      id: 'm1',
      name: 'Site Hunting (2d)',
      targetDaysFromTrigger: 2,
      targetDate: addDaysToDateString(stdTrigger, 2),
      status: 'Completed',
      completedDate: stdTrigger,
    },
    {
      id: 'm2',
      name: 'Securing Property Document (21d)',
      targetDaysFromTrigger: 23,
      targetDate: addDaysToDateString(stdTrigger, 23),
      status: 'Completed',
      completedDate: addDaysToDateString(stdTrigger, 20),
    },
    {
      id: 'm3',
      name: 'Securing Pre-Con (44d)',
      targetDaysFromTrigger: 67,
      targetDate: addDaysToDateString(stdTrigger, 67),
      status: 'In Progress',
    },
    {
      id: 'm4',
      name: 'Securing Post-Con (21d)',
      targetDaysFromTrigger: 88,
      targetDate: addDaysToDateString(stdTrigger, 88),
      status: 'Pending',
    },
    {
      id: 'm5',
      name: 'FAC Submission (7d / 98d Total)',
      targetDaysFromTrigger: 98,
      targetDate: addDaysToDateString(stdTrigger, 98),
      status: 'Pending',
    },
    {
      id: 'm6',
      name: 'Site Closed (156d Total)',
      targetDaysFromTrigger: 156,
      targetDate: finalDate,
      status: 'Pending',
    },
  ];
}

/**
 * SLA Health calculation and Warning detection based on Telecom SLA rules
 * (2d Hunting, 21d Prop Docs, 44d Pre-Con, 21d Post-Con, 7d FAC, 98d FAC Total, 156d Site Closed, 14d Inactivity)
 */
export type SlaStepStatusState = 'COMPLETED' | 'OVERDUE' | '1_WEEK_WARNING' | 'ON_TRACK';

export interface SlaStageWarningRule {
  key: string;
  stepNumber: number;
  label: string;
  nextStepLabel: string;
  limitDays: number;
  cumulativeDay: number;
  oneWeekWarningDay: number;
  statusState: SlaStepStatusState;
  isOverdue: boolean;
  isOneWeekWarning: boolean;
  isCompleted: boolean;
  delayDays: number;
  daysRemaining: number;
  message: string;
  description: string;
}

/**
 * Determine the 1-based sequential step index of a site status
 * Step 1: Site Hunting
 * Step 2: Securing Property Document
 * Step 3: Securing Pre-Con
 * Step 4: Securing Post-Con
 * Step 5: FAC Submission
 * Step 6: Site Closed
 */
export function getSlaStepIndex(status?: string, milestones?: SlaMilestone[]): number {
  const s = String(status || '').toLowerCase().trim();
  if (s.includes('closed') || s.includes('completed') || s.includes('on air') || s.includes('on-air')) return 6;
  if (s.includes('fac') || s.includes('billing') || s.includes('acceptance') || s.includes('final acceptance')) return 5;
  if (s.includes('post-con') || s.includes('postcon') || s.includes('post con') || s.includes('post construction') || s.includes('post-construction')) return 4;
  if (s.includes('pre-con') || s.includes('precon') || s.includes('pre con') || s.includes('pre construction') || s.includes('pre-construction')) return 3;
  if (s.includes('property') || s.includes('document') || s.includes('review') || s.includes('pro doc') || s.includes('securing property') || s.includes('prop doc')) return 2;
  if (s.includes('hunting') || s.includes('acquisition') || s.includes('saq') || s.includes('site hunting')) return 1;

  // Fallback: check milestones if available to deduce active progress step
  if (Array.isArray(milestones) && milestones.length > 0) {
    const activeMs = milestones.find((m) => m.status === 'In Progress') || milestones.find((m) => m.status === 'Pending');
    if (activeMs) {
      return getSlaStepIndex(activeMs.name);
    }
  }

  return 1;
}

export function getSlaStepName(stepIndex: number): string {
  switch (stepIndex) {
    case 1:
      return 'Site Hunting';
    case 2:
      return 'Securing Property Document';
    case 3:
      return 'Securing Pre-Con';
    case 4:
      return 'Securing Post-Con';
    case 5:
      return 'FAC Submission';
    case 6:
      return 'Site Closed';
    default:
      return 'Site Hunting';
  }
}

/**
 * SLA Health calculation and Status-Based Transition Warning Detection:
 * Monitors steps 1, 2, 3, 4, 5, 6:
 * - If status has not changed to next step by the deadline -> triggers SLA OVERDUE warning.
 * - Triggers 1-WEEK WARNING (7 days before deadline) on every step if status has not advanced yet.
 * - Triggers 14-DAY INACTIVITY warning if no progress updates logged.
 */
export function evaluateSlaStatus(
  triggerDate: string,
  lastMovementDate: string,
  milestones: SlaMilestone[],
  currentStatus?: string,
  customTargetDays?: number
): {
  isNoMovement14Days: boolean;
  delayDays: number;
  health: SlaHealthStatus;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'NORMAL';
  healthLabel: string;
  stageWarning?: string;
  stageWarningsList: string[];
  overdueWarnings: string[];
  oneWeekWarnings: string[];
  stageWarningRules: SlaStageWarningRule[];
  activeOverdueCount: number;
  activeOneWeekCount: number;
  currentStepNumber: number;
  currentStepName: string;
  nextStepName: string;
  daysElapsed: number;
  daysSinceMovement: number;
  totalTargetDays: number;
  daysRemaining: number;
} {
  const today = new Date();
  const trigDate = new Date(triggerDate || getLocalDateString());
  const lastMove = new Date(lastMovementDate || triggerDate || getLocalDateString());

  const daysElapsed = Math.max(
    0,
    Math.floor((today.getTime() - trigDate.getTime()) / (1000 * 60 * 60 * 24))
  );
  const daysSinceMovement = Math.max(
    0,
    Math.floor((today.getTime() - lastMove.getTime()) / (1000 * 60 * 60 * 24))
  );

  const isNoMovement14Days = daysSinceMovement >= 14;

  const stageWarningRules: SlaStageWarningRule[] = [];
  const overdueWarnings: string[] = [];
  const oneWeekWarnings: string[] = [];

  // Determine if this tracker or site has customized milestones (e.g. 21-Day Post-Con Endorsement, 30-Day Permits, etc.)
  const hasCustomMilestones =
    Array.isArray(milestones) &&
    milestones.length > 0 &&
    (milestones.length !== 6 || milestones[milestones.length - 1]?.targetDaysFromTrigger !== 156);

  const totalTargetDays =
    customTargetDays ||
    (Array.isArray(milestones) && milestones.length > 0
      ? milestones[milestones.length - 1]?.targetDaysFromTrigger || 21
      : 156);

  const totalDaysRemaining = Math.max(0, totalTargetDays - daysElapsed);

  let currentStep = getSlaStepIndex(currentStatus, milestones);
  let currentStepName = getSlaStepName(currentStep);
  let nextStepName = currentStep < 6 ? getSlaStepName(currentStep + 1) : 'Fully Closed';

  if (hasCustomMilestones) {
    let activeStepIdx = 1;
    let foundActive = false;

    milestones.forEach((ms, idx) => {
      const stepNumber = idx + 1;
      const cumulativeDay = ms.targetDaysFromTrigger;
      const prevCumulative = idx > 0 ? milestones[idx - 1].targetDaysFromTrigger : 0;
      const limitDays = Math.max(1, cumulativeDay - prevCumulative);
      const warningThreshold = cumulativeDay <= 7 ? 2 : cumulativeDay <= 21 ? 3 : 7;
      const oneWeekWarningDay = Math.max(1, cumulativeDay - warningThreshold);
      const isCompleted = ms.status === 'Completed';

      if (!isCompleted && !foundActive) {
        activeStepIdx = stepNumber;
        foundActive = true;
      }

      let statusState: SlaStepStatusState = 'ON_TRACK';
      let isOverdue = false;
      let isOneWeekWarning = false;
      let delayDays = 0;
      let daysRemaining = Math.max(0, cumulativeDay - daysElapsed);
      let message = '';

      if (isCompleted) {
        statusState = 'COMPLETED';
        message = `✓ Completed: ${ms.name}`;
      } else {
        if (daysElapsed > cumulativeDay) {
          statusState = 'OVERDUE';
          isOverdue = true;
          delayDays = daysElapsed - cumulativeDay;
          message = `🚨 Step ${stepNumber} Overdue: ${ms.name} exceeded (+${delayDays}d > ${cumulativeDay}d target)!`;
          overdueWarnings.push(message);
        } else if (daysElapsed >= oneWeekWarningDay) {
          statusState = '1_WEEK_WARNING';
          isOneWeekWarning = true;
          message = `⚠️ Warning: ${ms.name} target in ${daysRemaining} day(s)!`;
          oneWeekWarnings.push(message);
        } else {
          statusState = 'ON_TRACK';
          message = `On Track: ${daysRemaining} day(s) remaining for ${ms.name}.`;
        }
      }

      stageWarningRules.push({
        key: ms.id || `step_${stepNumber}`,
        stepNumber,
        label: `Step ${stepNumber}: ${ms.name} (${limitDays}d)`,
        nextStepLabel: milestones[idx + 1]?.name || 'Final Completion',
        limitDays,
        cumulativeDay,
        oneWeekWarningDay,
        statusState,
        isOverdue,
        isOneWeekWarning,
        isCompleted,
        delayDays,
        daysRemaining,
        message,
        description: `${limitDays} Days stage / Day ${cumulativeDay} target`,
      });
    });

    if (daysElapsed > totalTargetDays) {
      const overDays = daysElapsed - totalTargetDays;
      overdueWarnings.unshift(
        `🚨 Target SLA Overdue: ${totalTargetDays}-day target exceeded (+${overDays}d overdue)!`
      );
    } else if (daysElapsed >= totalTargetDays - (totalTargetDays <= 21 ? 3 : 7)) {
      oneWeekWarnings.unshift(
        `⚠️ Target SLA Approaching: ${totalDaysRemaining} day(s) remaining of ${totalTargetDays}d target!`
      );
    }

    currentStep = activeStepIdx;
    currentStepName = stageWarningRules[activeStepIdx - 1]?.label || `Step ${activeStepIdx}`;
    nextStepName = stageWarningRules[activeStepIdx]?.label || 'Final Completion';
  } else {

  // STEP 1: Site Hunting (2d SLA) -> Target: Advance to Securing Property Document
  {
    const stepNumber = 1;
    const limitDays = 2;
    const cumulativeDay = 2;
    const oneWeekWarningDay = 1; // 1 day before
    const isCompleted = currentStep > 1;
    let statusState: SlaStepStatusState = 'ON_TRACK';
    let isOverdue = false;
    let isOneWeekWarning = false;
    let delayDays = 0;
    let daysRemaining = Math.max(0, cumulativeDay - daysElapsed);
    let message = '';

    if (isCompleted) {
      statusState = 'COMPLETED';
      message = '✓ Successfully transitioned to Securing Property Document';
    } else {
      if (daysElapsed > cumulativeDay) {
        statusState = 'OVERDUE';
        isOverdue = true;
        delayDays = daysElapsed - cumulativeDay;
        message = `🚨 Step 1 Overdue: Site Hunting exceeded (+${delayDays}d > 2d limit)! Status has NOT changed to Securing Property Document.`;
        overdueWarnings.push(message);
      } else if (daysElapsed >= oneWeekWarningDay) {
        statusState = '1_WEEK_WARNING';
        isOneWeekWarning = true;
        message = `⚠️ Warning: Site Hunting deadline in ${daysRemaining} day(s)! Status must change to Securing Property Document.`;
        oneWeekWarnings.push(message);
      } else {
        statusState = 'ON_TRACK';
        message = `On Track: ${daysRemaining} day(s) remaining for Site Hunting.`;
      }
    }

    stageWarningRules.push({
      key: 'hunting',
      stepNumber,
      label: 'Step 1: Site Hunting (2d)',
      nextStepLabel: 'Securing Property Document',
      limitDays,
      cumulativeDay,
      oneWeekWarningDay,
      statusState,
      isOverdue,
      isOneWeekWarning,
      isCompleted,
      delayDays,
      daysRemaining,
      message,
      description: '2 Day Site Hunting limit',
    });
  }

  // STEP 2: Securing Property Document (21d SLA / Cumulative Day 23) -> Target: Advance to Pre-Con
  {
    const stepNumber = 2;
    const limitDays = 21;
    const cumulativeDay = 23;
    const oneWeekWarningDay = 16; // 7 days before Day 23
    const isCompleted = currentStep > 2;
    let statusState: SlaStepStatusState = 'ON_TRACK';
    let isOverdue = false;
    let isOneWeekWarning = false;
    let delayDays = 0;
    let daysRemaining = Math.max(0, cumulativeDay - daysElapsed);
    let message = '';

    if (isCompleted) {
      statusState = 'COMPLETED';
      message = '✓ Successfully transitioned to Pre-Con';
    } else {
      if (daysElapsed > cumulativeDay) {
        statusState = 'OVERDUE';
        isOverdue = true;
        delayDays = daysElapsed - cumulativeDay;
        message = `🚨 Step 2 Overdue: Securing Property Document exceeded (+${delayDays}d > 21d limit / Day 23)! Status has NOT changed to Pre-Con.`;
        overdueWarnings.push(message);
      } else if (daysElapsed >= oneWeekWarningDay) {
        statusState = '1_WEEK_WARNING';
        isOneWeekWarning = true;
        message = `⚠️ 1-Week Warning: Securing Property Document deadline in ${daysRemaining} day(s)! Status must change to Pre-Con.`;
        oneWeekWarnings.push(message);
      } else {
        statusState = 'ON_TRACK';
        message = `On Track: ${daysRemaining} day(s) remaining until Day 23 Pre-Con transition.`;
      }
    }

    stageWarningRules.push({
      key: 'property_doc',
      stepNumber,
      label: 'Step 2: Securing Property Document (21d)',
      nextStepLabel: 'Pre-Con',
      limitDays,
      cumulativeDay,
      oneWeekWarningDay,
      statusState,
      isOverdue,
      isOneWeekWarning,
      isCompleted,
      delayDays,
      daysRemaining,
      message,
      description: '21 Days Securing Property Document (Cumulative Day 23)',
    });
  }

  // STEP 3: Securing Pre-Con (44d SLA / Cumulative Day 67) -> Target: Advance to Post-Con
  {
    const stepNumber = 3;
    const limitDays = 44;
    const cumulativeDay = 67;
    const oneWeekWarningDay = 60; // 7 days before Day 67
    const isCompleted = currentStep > 3;
    let statusState: SlaStepStatusState = 'ON_TRACK';
    let isOverdue = false;
    let isOneWeekWarning = false;
    let delayDays = 0;
    let daysRemaining = Math.max(0, cumulativeDay - daysElapsed);
    let message = '';

    if (isCompleted) {
      statusState = 'COMPLETED';
      message = '✓ Successfully transitioned to Post-Con';
    } else {
      if (daysElapsed > cumulativeDay) {
        statusState = 'OVERDUE';
        isOverdue = true;
        delayDays = daysElapsed - cumulativeDay;
        message = `🚨 Step 3 Overdue: Securing Pre-Con exceeded (+${delayDays}d > 44d limit / Day 67)! Status has NOT changed to Post-Con.`;
        overdueWarnings.push(message);
      } else if (daysElapsed >= oneWeekWarningDay) {
        statusState = '1_WEEK_WARNING';
        isOneWeekWarning = true;
        message = `⚠️ 1-Week Warning: Securing Pre-Con deadline in ${daysRemaining} day(s)! Status must change to Post-Con.`;
        oneWeekWarnings.push(message);
      } else {
        statusState = 'ON_TRACK';
        message = `On Track: ${daysRemaining} day(s) remaining until Day 67 Post-Con transition.`;
      }
    }

    stageWarningRules.push({
      key: 'pre_con',
      stepNumber,
      label: 'Step 3: Securing Pre-Con (44d)',
      nextStepLabel: 'Post-Con',
      limitDays,
      cumulativeDay,
      oneWeekWarningDay,
      statusState,
      isOverdue,
      isOneWeekWarning,
      isCompleted,
      delayDays,
      daysRemaining,
      message,
      description: '44 Days Securing Pre-Con (Cumulative Day 67)',
    });
  }

  // STEP 4: Securing Post-Con (21d SLA / Cumulative Day 88) -> Target: Advance to FAC Submission
  {
    const stepNumber = 4;
    const limitDays = 21;
    const cumulativeDay = 88;
    const oneWeekWarningDay = 81; // 7 days before Day 88
    const isCompleted = currentStep > 4;
    let statusState: SlaStepStatusState = 'ON_TRACK';
    let isOverdue = false;
    let isOneWeekWarning = false;
    let delayDays = 0;
    let daysRemaining = Math.max(0, cumulativeDay - daysElapsed);
    let message = '';

    if (isCompleted) {
      statusState = 'COMPLETED';
      message = '✓ Successfully transitioned to FAC Submission';
    } else {
      if (daysElapsed > cumulativeDay) {
        statusState = 'OVERDUE';
        isOverdue = true;
        delayDays = daysElapsed - cumulativeDay;
        message = `🚨 Step 4 Overdue: Securing Post-Con exceeded (+${delayDays}d > 21d limit / Day 88)! Status has NOT changed to FAC Submission.`;
        overdueWarnings.push(message);
      } else if (daysElapsed >= oneWeekWarningDay) {
        statusState = '1_WEEK_WARNING';
        isOneWeekWarning = true;
        message = `⚠️ 1-Week Warning: Securing Post-Con deadline in ${daysRemaining} day(s)! Status must change to FAC Submission.`;
        oneWeekWarnings.push(message);
      } else {
        statusState = 'ON_TRACK';
        message = `On Track: ${daysRemaining} day(s) remaining until Day 88 FAC Submission.`;
      }
    }

    stageWarningRules.push({
      key: 'post_con',
      stepNumber,
      label: 'Step 4: Securing Post-Con (21d)',
      nextStepLabel: 'FAC Submission',
      limitDays,
      cumulativeDay,
      oneWeekWarningDay,
      statusState,
      isOverdue,
      isOneWeekWarning,
      isCompleted,
      delayDays,
      daysRemaining,
      message,
      description: '21 Days Securing Post-Con (Cumulative Day 88)',
    });
  }

  // STEP 5: FAC Submission (7d SLA / 98d Total Target) -> Target: Advance to Site Closed
  {
    const stepNumber = 5;
    const limitDays = 7;
    const cumulativeDay = 98;
    const oneWeekWarningDay = 91; // 7 days before Day 98
    const isCompleted = currentStep >= 6;
    let statusState: SlaStepStatusState = 'ON_TRACK';
    let isOverdue = false;
    let isOneWeekWarning = false;
    let delayDays = 0;
    let daysRemaining = Math.max(0, cumulativeDay - daysElapsed);
    let message = '';

    if (isCompleted) {
      statusState = 'COMPLETED';
      message = '✓ Successfully transitioned to Site Closed';
    } else {
      if (daysElapsed > cumulativeDay) {
        statusState = 'OVERDUE';
        isOverdue = true;
        delayDays = daysElapsed - cumulativeDay;
        message = `🚨 Step 5 Overdue: FAC Submission exceeded (+${delayDays}d > 7d stage limit / 98d total from Site Hunting)! Status has NOT changed to Site Closed.`;
        overdueWarnings.push(message);
      } else if (daysElapsed >= oneWeekWarningDay) {
        statusState = '1_WEEK_WARNING';
        isOneWeekWarning = true;
        message = `⚠️ 1-Week Warning: FAC Submission deadline in ${daysRemaining} day(s)! Status must change to Site Closed.`;
        oneWeekWarnings.push(message);
      } else {
        statusState = 'ON_TRACK';
        message = `On Track: ${daysRemaining} day(s) remaining until Day 98 FAC Approval.`;
      }
    }

    stageWarningRules.push({
      key: 'fac',
      stepNumber,
      label: 'Step 5: FAC Submission (7d / 98d Total)',
      nextStepLabel: 'Site Closed',
      limitDays,
      cumulativeDay,
      oneWeekWarningDay,
      statusState,
      isOverdue,
      isOneWeekWarning,
      isCompleted,
      delayDays,
      daysRemaining,
      message,
      description: '7 Day FAC stage / 98 Days from Site Hunting',
    });
  }

  // STEP 6: Site Closed (156d Total SLA Target from Site Hunting)
  {
    const stepNumber = 6;
    const limitDays = 58;
    const cumulativeDay = 156;
    const oneWeekWarningDay = 149; // 7 days before Day 156
    const isCompleted = currentStep >= 6;
    let statusState: SlaStepStatusState = 'ON_TRACK';
    let isOverdue = false;
    let isOneWeekWarning = false;
    let delayDays = 0;
    let daysRemaining = Math.max(0, cumulativeDay - daysElapsed);
    let message = '';

    if (isCompleted) {
      statusState = 'COMPLETED';
      message = '✓ Site Closed successfully within SLA';
    } else {
      if (daysElapsed > cumulativeDay) {
        statusState = 'OVERDUE';
        isOverdue = true;
        delayDays = daysElapsed - cumulativeDay;
        message = `🚨 Final SLA Overdue: Site Closed exceeded (+${delayDays}d > 156d total limit from Site Hunting)!`;
        overdueWarnings.push(message);
      } else if (daysElapsed >= oneWeekWarningDay) {
        statusState = '1_WEEK_WARNING';
        isOneWeekWarning = true;
        message = `⚠️ 1-Week Warning: Site Closed final deadline in ${daysRemaining} day(s)!`;
        oneWeekWarnings.push(message);
      } else {
        statusState = 'ON_TRACK';
        message = `On Track: ${daysRemaining} day(s) remaining for 156d total rollout.`;
      }
    }

    stageWarningRules.push({
      key: 'site_closed',
      stepNumber,
      label: 'Step 6: Site Closed (156d Total)',
      nextStepLabel: 'Final Rollout Complete',
      limitDays,
      cumulativeDay,
      oneWeekWarningDay,
      statusState,
      isOverdue,
      isOneWeekWarning,
      isCompleted,
      delayDays,
      daysRemaining,
      message,
      description: '156 Days from Site Hunting for Site Closed',
    });
  }
  }

  // Inactivity Rule (14 Days)
  if (isNoMovement14Days) {
    overdueWarnings.push(
      `🚨 14-Day Inactivity SLA Warning: No progress updates recorded for ${daysSinceMovement} days!`
    );
  } else if (daysSinceMovement >= 10) {
    oneWeekWarnings.push(
      `⚠️ Inactivity Approaching: ${daysSinceMovement} days without progress logs (14-day limit)`
    );
  }

  // Combine full warnings list (overdue prioritized first, then 1-week warnings)
  const stageWarningsList = [...overdueWarnings, ...oneWeekWarnings];

  // Calculate maximum milestone delay
  let maxMilestoneDelay = stageWarningRules.reduce(
    (max, r) => Math.max(max, r.delayDays),
    0
  );

  for (const ms of milestones || []) {
    if (ms.status === 'Delayed') {
      maxMilestoneDelay = Math.max(maxMilestoneDelay, 15);
    }
    if (ms.status === 'In Progress' && ms.targetDate) {
      const targetTime = new Date(ms.targetDate).getTime();
      if (today.getTime() > targetTime) {
        const d = Math.floor((today.getTime() - targetTime) / (1000 * 60 * 60 * 24));
        if (d > maxMilestoneDelay) maxMilestoneDelay = d;
      }
    }
  }

  // Compute overall Health and Priority
  let health: SlaHealthStatus = 'on_track';
  let priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'NORMAL' = 'NORMAL';
  const remDays = Math.max(0, totalTargetDays - daysElapsed);
  let healthLabel = `On Track (${remDays}d rem.)`;

  const activeOverdueRule = stageWarningRules.find((r) => r.isOverdue);
  const activeOneWeekRule = stageWarningRules.find((r) => r.isOneWeekWarning);

  if (overdueWarnings.length > 0 || isNoMovement14Days || maxMilestoneDelay > 0) {
    health = 'critical';
    priority = 'CRITICAL';
    if (isNoMovement14Days) {
      healthLabel = `CRITICAL: Inactive (${daysSinceMovement}d)`;
    } else if (activeOverdueRule) {
      const shortName = activeOverdueRule.label.replace(/^Step \d+: /, '').split(' ')[0];
      healthLabel = `🚨 Overdue: ${shortName} (+${activeOverdueRule.delayDays}d)`;
    } else {
      healthLabel = `Delayed (+${maxMilestoneDelay}d)`;
    }
  } else if (oneWeekWarnings.length > 0) {
    health = 'approaching';
    priority = 'HIGH';
    if (activeOneWeekRule) {
      const shortName = activeOneWeekRule.label.replace(/^Step \d+: /, '').split(' ')[0];
      healthLabel = `⚠️ Warning: ${shortName} (${activeOneWeekRule.daysRemaining}d)`;
    } else if (daysSinceMovement >= 10) {
      healthLabel = `Warning: ${daysSinceMovement}d Inactive`;
    } else {
      healthLabel = `Approaching (${remDays}d rem.)`;
    }
  } else if (daysSinceMovement >= 10 || daysElapsed >= totalTargetDays - (totalTargetDays <= 21 ? 3 : 7)) {
    health = 'approaching';
    priority = 'MEDIUM';
    healthLabel =
      daysSinceMovement >= 10
        ? `Warning: ${daysSinceMovement}d Inactive`
        : `Approaching (${remDays}d left of ${totalTargetDays}d)`;
  }

  return {
    isNoMovement14Days,
    delayDays: maxMilestoneDelay,
    health,
    priority,
    healthLabel,
    stageWarning: stageWarningsList[0],
    stageWarningsList,
    overdueWarnings,
    oneWeekWarnings,
    stageWarningRules,
    activeOverdueCount: overdueWarnings.length,
    activeOneWeekCount: oneWeekWarnings.length,
    currentStepNumber: currentStep,
    currentStepName,
    nextStepName,
    daysElapsed,
    daysSinceMovement,
    totalTargetDays,
    daysRemaining: remDays,
  };
}



/**
 * Format local date as YYYY-MM-DD avoiding UTC day offset issues (UTC+8 timezone accuracy)
 */
export function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Add days to YYYY-MM-DD string safely in local time
 */
export function addDaysToDateString(dateStr: string, days: number): string {
  if (!dateStr) return getLocalDateString();
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      const date = new Date(y, m, d);
      date.setDate(date.getDate() + days);
      return getLocalDateString(date);
    }
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      parsed.setDate(parsed.getDate() + days);
      return getLocalDateString(parsed);
    }
  } catch (e) {}
  return dateStr;
}

