import { Tracker, TrackerRow, DashboardCardConfig } from '../types/tracker';
import { formatCurrencyPHP, parseNumericValue } from './excelUtils';

export { parseNumericValue };

export interface CalculatedMetricResult {
  value: string | number;
  subtext: string;
  count: number;
  totalPoolCount: number;
  scopeLabel: string;
}

/**
 * Filter rows based on card configuration:
 * 1. Scope: 'current_project' vs 'all_projects' vs 'specific_project'
 * 2. Row Filter criteria: filterRowField and filterRowValue
 */
export function getFilteredRowsForMetric(
  card: DashboardCardConfig,
  currentTracker: Tracker,
  allTrackers: Tracker[]
): { rows: TrackerRow[]; scopeLabel: string; totalPoolCount: number } {
  const scope = card.filterScope || 'current_project';

  let poolRows: TrackerRow[] = [];
  let scopeLabel = currentTracker.name;

  if (scope === 'all_projects') {
    scopeLabel = `All Projects (${allTrackers.length} Trackers)`;
    for (const trk of allTrackers) {
      if (Array.isArray(trk.rows)) {
        poolRows.push(...trk.rows);
      }
    }
  } else if (scope === 'specific_project' && card.filterTrackerId) {
    const targetTrk = allTrackers.find((t) => t.id === card.filterTrackerId) || currentTracker;
    scopeLabel = targetTrk.name;
    poolRows = Array.isArray(targetTrk.rows) ? [...targetTrk.rows] : [];
  } else {
    // 'current_project'
    scopeLabel = currentTracker.name;
    poolRows = Array.isArray(currentTracker.rows) ? [...currentTracker.rows] : [];
  }

  // Filter out any accidental SUMMARY / total rows
  poolRows = poolRows.filter((r) => r && r.siteId !== 'SUMMARY' && r.values?.site_id !== 'SUMMARY');

  const totalPoolCount = poolRows.length;

  // Apply row filtering if specified
  if (card.filterRowField && card.filterRowValue && card.filterRowValue.trim() !== '') {
    const targetVal = card.filterRowValue.trim().toLowerCase();
    const isExact = card.filterCondition === 'equals';

    poolRows = poolRows.filter((r) => {
      let cellStr = '';
      switch (card.filterRowField) {
        case 'status':
          cellStr = String(r.values?.status || r.slaData?.currentStatus || '');
          break;
        case 'picHandler':
          cellStr = String(r.siteDetails?.picHandler || r.values?.pic_handler || '');
          break;
        case 'region':
          cellStr = String(r.siteDetails?.region || r.values?.region || '');
          break;
        case 'slaHealth':
          cellStr = String(r.slaData?.slaHealth || '');
          break;
        case 'priority':
          cellStr = String(r.slaData?.priority || '');
          break;
        case 'towerType':
          cellStr = String(r.siteDetails?.towerHeight || r.values?.tower_type || '');
          break;
        case 'custom_column':
          if (card.columnId) {
            cellStr = String(r.values?.[card.columnId] ?? '');
          }
          break;
        default:
          cellStr = String(r.values?.[card.filterRowField!] ?? '');
          break;
      }

      const lowerCell = cellStr.trim().toLowerCase();
      return isExact ? lowerCell === targetVal : lowerCell.includes(targetVal);
    });
  }

  return { rows: poolRows, scopeLabel, totalPoolCount };
}

/**
 * Calculates metric card value and subtext with support for filter scope and row filter
 */
export function calculateUnifiedMetric(
  card: DashboardCardConfig,
  currentTracker: Tracker,
  allTrackers: Tracker[] = [currentTracker]
): CalculatedMetricResult {
  const { rows, scopeLabel, totalPoolCount } = getFilteredRowsForMetric(card, currentTracker, allTrackers);
  const rowFilterText =
    card.filterRowField && card.filterRowValue
      ? ` [Row: ${card.filterRowField}=${card.filterRowValue}]`
      : '';

  switch (card.metricType) {
    case 'total_sites': {
      const completed = rows.filter((r) => r.values?.status === 'Completed').length;
      return {
        value: rows.length,
        subtext: `${completed} Completed · ${scopeLabel}${rowFilterText}`,
        count: rows.length,
        totalPoolCount,
        scopeLabel,
      };
    }
    case 'total_budget_amount': {
      const sum = rows.reduce((acc, r) => {
        const checklistSum =
          Array.isArray(r.legalChecklist) && r.legalChecklist.length > 0
            ? r.legalChecklist.reduce((s, i) => s + (i.amount || 0), 0)
            : parseNumericValue(r.values?.total_legal_budget);
        return acc + checklistSum;
      }, 0);
      return {
        value: formatCurrencyPHP(sum),
        subtext: `Total statutory budget · ${rows.length} sites (${scopeLabel})${rowFilterText}`,
        count: rows.length,
        totalPoolCount,
        scopeLabel,
      };
    }
    case 'fees_disbursed': {
      const sum = rows.reduce((acc, r) => {
        const disbursed =
          Array.isArray(r.legalChecklist) && r.legalChecklist.length > 0
            ? r.legalChecklist.filter((i) => i.status === 'Completed').reduce((s, i) => s + (i.amount || 0), 0)
            : parseNumericValue(r.values?.disbursed_legal_fees);
        return acc + disbursed;
      }, 0);
      return {
        value: formatCurrencyPHP(sum),
        subtext: `Vouchers disbursed with receipts · ${rows.length} sites (${scopeLabel})${rowFilterText}`,
        count: rows.length,
        totalPoolCount,
        scopeLabel,
      };
    }
    case 'no_movement_14d': {
      const count = rows.filter((r) => r.slaData?.isNoMovement14Days).length;
      return {
        value: `${count} Sites`,
        subtext:
          count > 0
            ? `CRITICAL Alert · Stalled ≥ 14d (${scopeLabel})${rowFilterText}`
            : `All sites active in past 14 days (${scopeLabel})`,
        count,
        totalPoolCount,
        scopeLabel,
      };
    }
    case 'delayed_sites': {
      const delayed = rows.filter(
        (r) => r.slaData?.slaHealth === 'delayed' || r.slaData?.slaHealth === 'critical'
      ).length;
      const onTrackPct = rows.length > 0 ? Math.round(((rows.length - delayed) / rows.length) * 100) : 100;
      return {
        value: `${delayed} Sites`,
        subtext: `${onTrackPct}% on track · ${scopeLabel}${rowFilterText}`,
        count: delayed,
        totalPoolCount,
        scopeLabel,
      };
    }
    case 'completed_milestones': {
      const completed = rows.filter((r) => r.values?.status === 'Completed').length;
      const pct = rows.length > 0 ? Math.round((completed / rows.length) * 100) : 0;
      return {
        value: `${completed} / ${rows.length}`,
        subtext: `${pct}% completed · ${scopeLabel}${rowFilterText}`,
        count: completed,
        totalPoolCount,
        scopeLabel,
      };
    }
    case 'column_sum': {
      if (!card.columnId) {
        return {
          value: '0',
          subtext: 'No column connected',
          count: 0,
          totalPoolCount,
          scopeLabel,
        };
      }
      const col = currentTracker.columns.find((c) => c.id === card.columnId);
      const sum = rows.reduce((acc, r) => acc + parseNumericValue(r.values?.[card.columnId!]), 0);
      return {
        value: col?.type === 'amount' ? formatCurrencyPHP(sum) : sum.toLocaleString('en-PH'),
        subtext: `Sum of "${col?.label || card.columnId}" · ${rows.length} rows (${scopeLabel})${rowFilterText}`,
        count: rows.length,
        totalPoolCount,
        scopeLabel,
      };
    }
    case 'column_avg': {
      if (!card.columnId || rows.length === 0) {
        return {
          value: '0',
          subtext: 'No column or zero rows',
          count: 0,
          totalPoolCount,
          scopeLabel,
        };
      }
      const col = currentTracker.columns.find((c) => c.id === card.columnId);
      const sum = rows.reduce((acc, r) => acc + parseNumericValue(r.values?.[card.columnId!]), 0);
      const avg = Math.round((sum / rows.length) * 10) / 10;
      return {
        value: col?.type === 'percent' ? `${avg}%` : avg.toLocaleString('en-PH'),
        subtext: `Avg of "${col?.label || card.columnId}" · ${rows.length} rows (${scopeLabel})${rowFilterText}`,
        count: rows.length,
        totalPoolCount,
        scopeLabel,
      };
    }
    case 'status_count': {
      const target = card.targetStatus || 'Under Review';
      const match = rows.filter((r) => r.values?.status === target).length;
      return {
        value: match,
        subtext: `Status "${target}" · ${scopeLabel}${rowFilterText}`,
        count: match,
        totalPoolCount,
        scopeLabel,
      };
    }
    default:
      return {
        value: '—',
        subtext: `Custom metric · ${scopeLabel}${rowFilterText}`,
        count: 0,
        totalPoolCount,
        scopeLabel,
      };
  }
}
