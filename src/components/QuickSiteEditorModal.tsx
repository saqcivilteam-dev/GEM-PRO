import React, { useState } from 'react';
import { TrackerRow } from '../types/tracker';
import {
  X,
  Save,
  Building2,
  Calendar,
  User,
  MapPin,
  Phone,
  FileText,
  Clock,
  Sparkles,
  Layers,
  ArrowRight,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { parseNumericValue } from '../utils/excelUtils';

interface QuickSiteEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  trackerId: string;
  trackerName: string;
  row: TrackerRow;
  onSave: (updatedRow: TrackerRow) => void;
  onOpenDataDrawer?: () => void;
  onOpenSla?: () => void;
  onOpenChecklist?: () => void;
}

export const QuickSiteEditorModal: React.FC<QuickSiteEditorModalProps> = ({
  isOpen,
  onClose,
  trackerId,
  trackerName,
  row,
  onSave,
  onOpenDataDrawer,
  onOpenSla,
  onOpenChecklist,
}) => {
  if (!isOpen) return null;

  // Initialize field state from row
  const [siteId, setSiteId] = useState(row.siteId || row.values?.site_id || '');
  const [siteName, setSiteName] = useState(
    row.siteDetails?.siteName || row.values?.site_name || ''
  );
  const [status, setStatus] = useState(
    row.values?.status || row.slaData?.currentStatus || 'Site Hunting'
  );
  const [slaHealth, setSlaHealth] = useState(
    row.slaData?.slaHealth || 'on_track'
  );
  const [picHandler, setPicHandler] = useState(
    row.siteDetails?.picHandler || row.values?.pic_handler || ''
  );
  const [region, setRegion] = useState(
    row.siteDetails?.region || row.values?.region || 'NCR / Luzon'
  );
  const [exactAddress, setExactAddress] = useState(
    row.siteDetails?.exactAddress || row.values?.exact_address || row.values?.address || ''
  );
  const [landlordName, setLandlordName] = useState(
    row.siteDetails?.landlordName || row.values?.landlord_name || ''
  );
  const [landlordContact, setLandlordContact] = useState(
    row.siteDetails?.landlordContact || row.values?.landlord_contact || ''
  );
  const [triggerDate, setTriggerDate] = useState(
    row.slaData?.triggerDate || row.values?.sla_trigger_date || ''
  );
  const [targetDate, setTargetDate] = useState(
    row.values?.target_on_air_date || (row.slaData?.milestones?.[row.slaData.milestones.length - 1]?.targetDate) || ''
  );
  const [totalBudget, setTotalBudget] = useState<string>(
    row.values?.total_legal_budget !== undefined ? String(row.values.total_legal_budget) : '0'
  );
  const [disbursedFees, setDisbursedFees] = useState<string>(
    row.values?.disbursed_legal_fees !== undefined ? String(row.values.disbursed_legal_fees) : '0'
  );
  const [notes, setNotes] = useState(
    row.siteDetails?.notes || row.values?.data_notes || ''
  );

  const [hasSaved, setHasSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    const cloned: TrackerRow = JSON.parse(JSON.stringify(row));
    if (!cloned.values) cloned.values = {};
    if (!cloned.siteDetails) cloned.siteDetails = {} as any;
    if (!cloned.slaData) {
      cloned.slaData = { currentStatus: status, slaHealth: slaHealth as any } as any;
    }

    // Update Site Identification
    cloned.siteId = siteId.trim();
    cloned.values.site_id = siteId.trim();

    cloned.siteDetails.siteName = siteName.trim();
    cloned.values.site_name = siteName.trim();

    // Update Workflow Status
    cloned.values.status = status;
    cloned.slaData.currentStatus = status;
    cloned.slaData.slaHealth = slaHealth as any;

    // Update Handlers & Regions
    cloned.siteDetails.picHandler = picHandler.trim();
    cloned.values.pic_handler = picHandler.trim();

    cloned.siteDetails.region = region.trim();
    cloned.values.region = region.trim();

    // Update Location
    cloned.siteDetails.exactAddress = exactAddress.trim();
    cloned.values.exact_address = exactAddress.trim();
    cloned.values.address = exactAddress.trim();

    cloned.siteDetails.landlordName = landlordName.trim();
    cloned.values.landlord_name = landlordName.trim();

    cloned.siteDetails.landlordContact = landlordContact.trim();
    cloned.values.landlord_contact = landlordContact.trim();

    // Update Dates
    cloned.slaData.triggerDate = triggerDate;
    cloned.values.sla_trigger_date = triggerDate;

    cloned.values.target_on_air_date = targetDate;
    if (cloned.slaData.milestones && cloned.slaData.milestones.length > 0) {
      cloned.slaData.milestones[cloned.slaData.milestones.length - 1].targetDate = targetDate;
    }

    // Update Financials
    const numBudget = parseNumericValue(totalBudget) || 0;
    const numDisbursed = parseNumericValue(disbursedFees) || 0;
    cloned.values.total_legal_budget = numBudget;
    cloned.values.disbursed_legal_fees = numDisbursed;

    // Update Notes
    cloned.siteDetails.notes = notes.trim();
    cloned.values.data_notes = notes.trim();

    onSave(cloned);
    setHasSaved(true);
    setTimeout(() => {
      onClose();
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-slate-100">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Edit Site Record</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-800">
                  {trackerName}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Update site attributes directly. Changes immediately sync to the project tracker.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* Row 1: Site ID & Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Site ID <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={siteId}
                onChange={(e) => setSiteId(e.target.value)}
                placeholder="e.g. NCR-MNL-001"
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sky-400 font-mono font-bold focus:outline-hidden focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Site Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                placeholder="e.g. Ermita Commercial Hub"
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-medium focus:outline-hidden focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Row 2: Status & SLA Health */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Current Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 font-semibold focus:outline-hidden focus:border-indigo-500"
              >
                <option value="Site Hunting">Site Hunting</option>
                <option value="Under Review">Under Review</option>
                <option value="Pre-Con">Pre-Con</option>
                <option value="Post-Con">Post-Con</option>
                <option value="Completed">Completed</option>
                <option value="Delayed">Delayed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                SLA Health
              </label>
              <select
                value={slaHealth}
                onChange={(e) => setSlaHealth(e.target.value as any)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 font-semibold focus:outline-hidden focus:border-indigo-500"
              >
                <option value="on_track">On Track (Green)</option>
                <option value="approaching">Approaching Warning (Yellow)</option>
                <option value="delayed">Delayed (Orange)</option>
                <option value="critical">Critical / Overdue (Red)</option>
              </select>
            </div>
          </div>

          {/* Row 3: PIC Handler & Region */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                PIC Handler / Engineer
              </label>
              <input
                type="text"
                value={picHandler}
                onChange={(e) => setPicHandler(e.target.value)}
                placeholder="e.g. Engr. Dela Cruz"
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white focus:outline-hidden focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Region / Cluster
              </label>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 focus:outline-hidden focus:border-indigo-500"
              >
                <option value="NCR / Luzon">NCR / Luzon</option>
                <option value="North Luzon">North Luzon</option>
                <option value="South Luzon">South Luzon</option>
                <option value="Visayas">Visayas</option>
                <option value="Mindanao">Mindanao</option>
              </select>
            </div>
          </div>

          {/* Row 4: Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                SLA Trigger Date
              </label>
              <input
                type="date"
                value={triggerDate}
                onChange={(e) => setTriggerDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono focus:outline-hidden focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Target On-Air Date
              </label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono focus:outline-hidden focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Row 5: Financials */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Total Legal Budget (₱ PHP)
              </label>
              <input
                type="number"
                step="any"
                value={totalBudget}
                onChange={(e) => setTotalBudget(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-emerald-400 font-mono font-bold focus:outline-hidden focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Disbursed Legal Fees (₱ PHP)
              </label>
              <input
                type="number"
                step="any"
                value={disbursedFees}
                onChange={(e) => setDisbursedFees(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-emerald-400 font-mono font-bold focus:outline-hidden focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Row 6: Exact Address & Landlord */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Exact Site Address
              </label>
              <input
                type="text"
                value={exactAddress}
                onChange={(e) => setExactAddress(e.target.value)}
                placeholder="Barangay, Municipality, Province"
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 focus:outline-hidden focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Landlord / Property Owner
              </label>
              <input
                type="text"
                value={landlordName}
                onChange={(e) => setLandlordName(e.target.value)}
                placeholder="Owner Name & Contact"
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 focus:outline-hidden focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Row 7: Field Notes */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              Field Notes / Civil Remarks
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add status notes, zoning issues, or contractor updates..."
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 resize-none focus:outline-hidden focus:border-indigo-500"
            />
          </div>

          {/* Additional Tool Links */}
          <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] text-slate-400">Deep Modals for this site:</span>
            <div className="flex items-center gap-2">
              {onOpenSla && (
                <button
                  type="button"
                  onClick={onOpenSla}
                  className="px-2.5 py-1 rounded bg-amber-950/80 hover:bg-amber-900 border border-amber-800 text-amber-300 text-[11px] font-semibold flex items-center gap-1 transition-colors"
                >
                  <Clock className="w-3 h-3" />
                  <span>Day-by-Day SLA</span>
                </button>
              )}
              {onOpenChecklist && (
                <button
                  type="button"
                  onClick={onOpenChecklist}
                  className="px-2.5 py-1 rounded bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-800 text-emerald-300 text-[11px] font-semibold flex items-center gap-1 transition-colors"
                >
                  <FileText className="w-3 h-3" />
                  <span>Legal Checklist</span>
                </button>
              )}
              {onOpenDataDrawer && (
                <button
                  type="button"
                  onClick={onOpenDataDrawer}
                  className="px-2.5 py-1 rounded bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-800 text-indigo-300 text-[11px] font-semibold flex items-center gap-1 transition-colors"
                >
                  <Building2 className="w-3 h-3" />
                  <span>Full Encoded Drawer</span>
                </button>
              )}
            </div>
          </div>

          {/* Footer Submit */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-emerald-900/30 cursor-pointer"
            >
              {hasSaved ? (
                <>
                  <Check className="w-4 h-4 text-emerald-200" />
                  <span>Saved!</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Site Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
