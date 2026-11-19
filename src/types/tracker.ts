/**
 * GEM PRO Generic Tracker System - Data Models & Types
 */

export type ColumnType =
  | 'text'
  | 'number'
  | 'amount' // Philippine Peso ₱
  | 'date'
  | 'percent'
  | 'status'
  | 'day_sla' // Clickable DAY-BY-DAY PROGRESS & SAQ SLA TRACKER
  | 'legal_checklist' // Clickable LEGAL FEES & COMPLIANCE CHECKLIST
  | 'image'
  | 'pdf'
  | 'checkbox'
  | 'dropdown'
  | 'hyperlink'
  | 'site_id'
  | 'data_drawer'
  | 'data_drawer_2' // Clickable DATA 2 for different encode of data
  | 'sla_trigger_date' // SLA Trigger Date (Day 0 Start Date)
  | 'sla_health'; // SLA Health Status / Alert badge

export interface ColumnDefinition {
  id: string;
  label: string;
  type: ColumnType;
  width: number;
  visible: boolean;
  options?: string[];
  summaryType?: 'sum' | 'avg' | 'count' | 'none';
  colorTheme?: string;
  frozen?: boolean;
  isCustom?: boolean;
  editable?: boolean;
}

export type SlaHealthStatus = 'on_track' | 'approaching' | 'delayed' | 'critical';

export type SlaScopeType =
  | 'post_con_21d'
  | 'full_turnkey_156d'
  | 'property_securing_21d'
  | 'pre_con_44d'
  | 'permits_30d'
  | 'custom';

export interface SlaMilestoneTemplate {
  name: string;
  targetDaysFromTrigger: number;
  description?: string;
}

export interface ProjectSlaConfig {
  enabled?: boolean; // Master toggle whether this tracker has SLA tracking enabled
  scopeType: SlaScopeType;
  scopeName: string;
  targetDays: number; // e.g. 21 for Post-Con Only, 156 for Turnkey, or custom
  description?: string;
  milestones: SlaMilestoneTemplate[];
}

export interface SlaMilestone {
  id: string;
  name: string;
  targetDaysFromTrigger: number;
  targetDate: string;
  completedDate?: string;
  status: 'Completed' | 'Pending' | 'Delayed' | 'In Progress';
}

export interface SlaHistoryColumn {
  id: string;
  label: string;
  type: 'date' | 'status' | 'text' | 'textarea' | 'number' | 'staff';
  width?: number;
  visible: boolean;
  isCustom?: boolean;
}

export interface SlaHistoryRecord {
  id: string;
  date: string;
  status: string;
  progressUpdate: string;
  detailsRemarks: string;
  trackingRule: string;
  loggedBy: string;
  photoUrl?: string;
  pdfUrl?: string;
  customValues?: Record<string, any>;
  [key: string]: any;
}

export interface SiteSlaData {
  triggerDate: string; // Day 0 counting trigger
  targetDays?: number; // Target SLA days (e.g. 21 for Post-Con, 156 for Turnkey, or custom)
  slaScopeName?: string; // e.g. "Securing Post-Con Only (21d SLA)"
  scopeType?: SlaScopeType;
  earliestLogDate?: string;
  currentStatus: string;
  slaHealth: SlaHealthStatus;
  lastMovementDate: string;
  isNoMovement14Days: boolean;
  delayDays: number;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'NORMAL';
  milestones: SlaMilestone[];
  history: SlaHistoryRecord[];
  historyColumns?: SlaHistoryColumn[]; // User-customized columns for Day-by-Day history table
}

export interface LegalChecklistItem {
  id: string;
  requirement: string;
  category: 'Legal' | 'Permit' | 'Social' | 'Clearance';
  status: 'Completed' | 'In Progress' | 'Pending' | 'Under Review';
  amount: number; // In Philippine Peso (₱)
  assignedStaff: string;
  submissionDate: string;
  completionDate?: string;
  sopRef: string;
  fileAttachment?: {
    name: string;
    type: 'jpg' | 'pdf';
    url: string;
    size?: string;
  };
}

export interface SiteDetailedRecord {
  siteId: string;
  siteName: string;
  region: string;
  province: string;
  exactAddress: string;
  landlordName: string;
  landlordContact: string;
  towerHeight: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  picHandler: string;
  contractor: string;
  notes: string;
  referencePhotoUrl?: string;
}

export interface SiteDocument {
  id: string;
  name: string;
  type: 'jpg' | 'pdf';
  url: string;
  uploadedAt: string;
  tag: string;
  fileSize?: string;
}

export interface CustomEncodeField {
  id: string;
  key: string;
  value: string;
}

export interface SiteData2Record {
  notes?: string;
  category?: string;
  technicalSpecs?: {
    azimuthSector1?: string;
    azimuthSector2?: string;
    azimuthSector3?: string;
    carrierFrequencyBands?: string;
    fiberPortBackhaul?: string;
    powerGenset?: string;
    structuralPad?: string;
    subcontractor2?: string;
    inspectionQcStatus?: string;
  };
  customFields?: CustomEncodeField[];
  documents?: SiteDocument[];
  updatedAt?: string;
}

export interface TrackerRow {
  id: string;
  siteId: string;
  values: Record<string, any>;
  slaData: SiteSlaData;
  legalChecklist: LegalChecklistItem[];
  siteDetails: SiteDetailedRecord;
  siteData2?: SiteData2Record;
  documents: SiteDocument[];
  updatedAt: string;
  createdAt: string;
}

export interface DashboardCardConfig {
  id: string;
  title: string;
  metricType:
    | 'total_sites'
    | 'total_budget_amount'
    | 'fees_disbursed'
    | 'delayed_sites'
    | 'no_movement_14d'
    | 'completed_milestones'
    | 'column_sum'
    | 'column_avg'
    | 'status_count';
  columnId?: string;
  targetStatus?: string;
  collapsed?: boolean;
  colorTheme?: 'emerald' | 'amber' | 'crimson' | 'sky' | 'indigo' | 'purple';
  customNote?: string;
  // Filter row per project or all projects:
  filterScope?: 'all_projects' | 'current_project' | 'specific_project';
  filterTrackerId?: string; // ID if specific_project
  filterRowField?: 'status' | 'picHandler' | 'region' | 'slaHealth' | 'priority' | 'towerType' | 'custom_column';
  filterRowValue?: string;
  filterCondition?: 'equals' | 'contains';
}

export interface TrackerAppearance {
  rowDensity?: 'compact' | 'normal' | 'comfortable';
  fontSize?: 'sm' | 'base' | 'lg';
  headerTheme?: 'slate' | 'navy' | 'emerald' | 'indigo' | 'amber';
  showGridlines?: boolean;
  zebraStripes?: boolean;
}

export interface Tracker {
  id: string;
  name: string;
  folderId: string;
  description: string;
  columns: ColumnDefinition[];
  rows: TrackerRow[];
  frozenColumns: number;
  frozenRows?: number;
  statusOptions: { label: string; color: string; bg: string }[];
  dashboardCards: DashboardCardConfig[];
  appearance?: TrackerAppearance;
  isLocked?: boolean; // Prevents accidental edits/overwrites
  requireAdminApprovalForEdits?: boolean; // If enabled, staff edits require admin review
  enableSla?: boolean; // Whether SLA tracking (SAQ SLA, milestones, delay warnings) is active for this tracker
  slaConfig?: ProjectSlaConfig; // Customized project-level SLA target & scope
  createdAt: string;
  updatedAt: string;
}

export interface TrackerFolder {
  id: string;
  name: string;
  icon?: string;
}

export type UserRole = 'creator' | 'admin' | 'staff' | 'guest';
export type UserStatus = 'approved' | 'pending' | 'rejected';

export interface UserAccount {
  id: string;
  name: string;
  username?: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  assignedProjects: string[]; // tracker IDs
  assignedFolders?: string[]; // folder IDs assigned by Admin/Creator
  avatar?: string;
  title?: string;
  joinedAt: string;
  password?: string;
  isCollaborator?: boolean;
}

export interface SiteVisitRecord {
  id: string;
  staffName: string;
  staffEmail: string;
  siteId: string;
  siteName: string;
  timestamp: string;
  type: 'clock_in' | 'clock_out';
  coordinates: {
    lat: number;
    lng: number;
  };
  accuracyMeters?: number;
  photoProofUrl?: string;
  notes: string;
}

export interface ChangeRequest {
  id: string;
  trackerId: string;
  trackerName: string;
  rowId: string;
  siteId: string;
  columnId: string;
  columnLabel: string;
  oldValue: any;
  newValue: any;
  requestedBy: string;
  requestedByEmail: string;
  requestedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  reason?: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface ExecutiveDeckSlide {
  id: string;
  title: string;
  subtitle: string;
  executiveSummary: string;
  focusMilestone: string;
  keyHighlights: string[];
  blockersAndRisks: string[];
  recommendedActions: string[];
  trackerId: string; // The tracker this slide is connected to (or 'all' for consolidated)
  selectedCardIds?: string[]; // IDs of specific metric cards selected from the tracker
  cardOverrides?: Record<string, { title?: string; customNote?: string; colorTheme?: 'emerald' | 'amber' | 'crimson' | 'sky' | 'indigo' | 'purple' }>;
}

export interface ExecutiveDeck {
  id: string;
  title: string;
  description: string;
  scope: 'per_tracker' | 'total_portfolio'; // Specific tracker vs Combined All-Tracker portfolio
  targetTrackerId?: string; // When scope is 'per_tracker'
  slides: ExecutiveDeckSlide[];
  createdAt: string;
  updatedAt: string;
}
