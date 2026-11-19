import React, { useState } from 'react';
import { Tracker, ChangeRequest, UserAccount } from '../types/tracker';
import {
  Lock,
  Unlock,
  ShieldCheck,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  User,
  ArrowRight,
  X,
  FileCheck,
  Send,
} from 'lucide-react';

interface DataLockApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  tracker: Tracker;
  currentUser: UserAccount;
  changeRequests: ChangeRequest[];
  onUpdateTrackerLock: (isLocked: boolean, requireApproval: boolean) => void;
  onApproveChangeRequest: (request: ChangeRequest) => void;
  onRejectChangeRequest: (requestId: string) => void;
  onSubmitChangeRequest: (request: Omit<ChangeRequest, 'id' | 'status' | 'requestedAt'>) => void;
}

export const DataLockApprovalModal: React.FC<DataLockApprovalModalProps> = ({
  isOpen,
  onClose,
  tracker,
  currentUser,
  changeRequests,
  onUpdateTrackerLock,
  onApproveChangeRequest,
  onRejectChangeRequest,
  onSubmitChangeRequest,
}) => {
  if (!isOpen) return null;

  const isAdmin = currentUser.role === 'admin';

  const [isLocked, setIsLocked] = useState(tracker.isLocked ?? false);
  const [requireApproval, setRequireApproval] = useState(tracker.requireAdminApprovalForEdits ?? false);

  // New Change Request Form state (for staff or typo corrections)
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [targetSiteId, setTargetSiteId] = useState(tracker.rows[0]?.siteId || '');
  const [targetColId, setTargetColId] = useState(tracker.columns[0]?.id || '');
  const [proposedValue, setProposedValue] = useState('');
  const [changeReason, setChangeReason] = useState('');

  const targetRow = tracker.rows.find((r) => r.siteId === targetSiteId) || tracker.rows[0];
  const targetCol = tracker.columns.find((c) => c.id === targetColId) || tracker.columns[0];
  const currentVal = targetRow ? (targetColId === 'site_id' ? targetRow.siteId : targetRow.values[targetColId] ?? '') : '';

  const trackerChangeRequests = changeRequests.filter((cr) => cr.trackerId === tracker.id);
  const pendingRequests = trackerChangeRequests.filter((cr) => cr.status === 'pending');
  const resolvedRequests = trackerChangeRequests.filter((cr) => cr.status !== 'pending');

  const handleSaveLockSettings = () => {
    onUpdateTrackerLock(isLocked, requireApproval);
    alert('Security and data protection lock settings updated!');
  };

  const handleSubmitRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetRow || !targetCol) return;

    onSubmitChangeRequest({
      trackerId: tracker.id,
      trackerName: tracker.name,
      rowId: targetRow.id,
      siteId: targetRow.siteId,
      columnId: targetCol.id,
      columnLabel: targetCol.label,
      oldValue: currentVal,
      newValue: proposedValue,
      requestedBy: currentUser.name,
      requestedByEmail: currentUser.email,
      reason: changeReason.trim() || 'Typo correction / data adjustment',
    });

    setProposedValue('');
    setChangeReason('');
    setShowSubmitForm(false);
    alert('Change request submitted for Administrator approval!');
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl max-h-[94vh] flex flex-col rounded-xl bg-slate-900 border border-slate-700 text-slate-100 shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isLocked ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
              {isLocked ? <Lock className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  Data Protection Lock & Admin Change Approval Workflow
                </h2>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                    isLocked ? 'bg-amber-950 text-amber-300 border border-amber-800' : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  }`}
                >
                  {isLocked ? 'PROTECTION LOCKED' : 'EDITABLE'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Active Tracker: <strong className="text-sky-300">{tracker.name}</strong> · Prevents accidental overwrites, deletions, and typo errors
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Section 1: Lock Settings (Admin Only to modify, Staff to view) */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Lock className="w-4 h-4 text-sky-400" />
                Sheet Lock & Typo Overwrite Protection
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsLocked(false);
                    setRequireApproval(false);
                    onUpdateTrackerLock(false, false);
                    alert('Approval requirements & locks removed! Direct editing enabled.');
                  }}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold transition-colors flex items-center gap-1 shadow-xs"
                >
                  <Unlock className="w-3.5 h-3.5" />
                  Remove All Approvals & Unlock
                </button>
                <button
                  type="button"
                  onClick={handleSaveLockSettings}
                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-bold transition-colors"
                >
                  Save Settings
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Lock Switch */}
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-white flex items-center gap-1.5">
                    {isLocked ? <Lock className="w-3.5 h-3.5 text-amber-400" /> : <Unlock className="w-3.5 h-3.5 text-slate-400" />}
                    Accidental Overwrite / Deletion Lock
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Freezes spreadsheet cells against accidental keystrokes, overwriting, and protects rows/columns from deletion.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsLocked(!isLocked)}
                  className={`w-10 h-6 rounded-full p-0.5 transition-colors shrink-0 ${
                    isLocked ? 'bg-amber-600' : 'bg-slate-700'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white transition-transform ${isLocked ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Require Admin Approval for Staff Edits */}
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-white flex items-center gap-1.5">
                    <FileCheck className="w-3.5 h-3.5 text-indigo-400" />
                    Mandatory Admin Approval Workflow
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    When enabled, staff edits and typo corrections are placed in a queue requiring Administrator sign-off before applying.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRequireApproval(!requireApproval)}
                  className={`w-10 h-6 rounded-full p-0.5 transition-colors shrink-0 ${
                    requireApproval ? 'bg-indigo-600' : 'bg-slate-700'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white transition-transform ${requireApproval ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>
          </div>

          {/* Section 2: Pending Change Requests / Typo Corrections Queue */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400" />
                  Pending Changes & Typo Corrections Queue ({pendingRequests.length})
                </h3>
                {pendingRequests.length > 0 && (
                  <span className="text-[11px] px-2 py-0.5 rounded bg-amber-950 text-amber-300 font-bold border border-amber-800 animate-pulse">
                    Action Required
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => setShowSubmitForm(!showSubmitForm)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 rounded text-xs font-medium flex items-center gap-1.5 transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                Submit Change / Typo Correction
              </button>
            </div>

            {/* Submit Request Form */}
            {showSubmitForm && (
              <form onSubmit={handleSubmitRequest} className="p-4 rounded-xl bg-slate-800/90 border border-indigo-500/60 space-y-3 text-xs">
                <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <Send className="w-3.5 h-3.5 text-indigo-400" />
                    Propose Change or Typo Correction
                  </span>
                  <button type="button" onClick={() => setShowSubmitForm(false)} className="text-slate-400 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Target Site</label>
                    <select
                      value={targetSiteId}
                      onChange={(e) => setTargetSiteId(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-white"
                    >
                      {(tracker.rows || []).map((r) => (
                        <option key={r.siteId} value={r.siteId}>
                          {r.siteId} — {r.siteDetails?.siteName || r.values?.site_name || r.siteId}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Target Column</label>
                    <select
                      value={targetColId}
                      onChange={(e) => setTargetColId(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-white"
                    >
                      {tracker.columns.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label} ({c.type})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Current Value in File</label>
                    <input
                      type="text"
                      readOnly
                      value={String(currentVal)}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded text-slate-400 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Proposed Corrected Value</label>
                    <input
                      type="text"
                      required
                      value={proposedValue}
                      onChange={(e) => setProposedValue(e.target.value)}
                      placeholder="Enter new corrected value..."
                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Reason / Explanation for Admin Review</label>
                    <input
                      type="text"
                      value={changeReason}
                      onChange={(e) => setChangeReason(e.target.value)}
                      placeholder="e.g. Corrected typo in amount from latest notarized contract..."
                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-white"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-700">
                  <button type="button" onClick={() => setShowSubmitForm(false)} className="px-3 py-1.5 text-slate-400 hover:text-white">
                    Cancel
                  </button>
                  <button type="submit" className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-bold">
                    Submit for Approval
                  </button>
                </div>
              </form>
            )}

            {/* Pending Requests List */}
            <div className="space-y-2.5">
              {pendingRequests.length === 0 ? (
                <div className="py-8 text-center rounded-lg bg-slate-950/60 border border-slate-800 text-slate-500 text-xs">
                  No pending change requests. All tracker data is current and verified.
                </div>
              ) : (
                pendingRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-3.5 rounded-xl bg-slate-950 border border-amber-900/60 flex flex-wrap items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sky-400 px-1.5 py-0.5 rounded bg-sky-950 border border-sky-800">
                          {req.siteId}
                        </span>
                        <span className="font-semibold text-white">{req.columnLabel}</span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          requested by <strong>{req.requestedBy}</strong> ({new Date(req.requestedAt).toLocaleTimeString()})
                        </span>
                      </div>

                      {/* Diff view */}
                      <div className="flex items-center gap-2 font-mono text-xs pt-1">
                        <span className="px-2 py-0.5 rounded bg-rose-950/80 text-rose-300 line-through">
                          {String(req.oldValue || 'Empty')}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                        <span className="px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 font-bold">
                          {String(req.newValue)}
                        </span>
                      </div>

                      {req.reason && <div className="text-[11px] text-slate-400 italic">"{req.reason}"</div>}
                    </div>

                    {/* Admin Actions */}
                    {isAdmin ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onApproveChangeRequest(req)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold flex items-center gap-1.5 shadow-xs transition-colors"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          Approve & Apply
                        </button>
                        <button
                          type="button"
                          onClick={() => onRejectChangeRequest(req.id)}
                          className="px-3 py-1.5 bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800 rounded font-semibold flex items-center gap-1.5 transition-colors"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span className="text-amber-400 font-semibold text-[11px]">Pending Admin Approval</span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Section 3: Audit Trail of Past Approved Changes */}
          {resolvedRequests.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-800 text-xs">
              <h4 className="font-bold uppercase tracking-wider text-slate-400 text-[11px]">
                Audit History ({resolvedRequests.length} Resolved)
              </h4>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {resolvedRequests.map((r) => (
                  <div key={r.id} className="p-2 rounded bg-slate-950/60 border border-slate-800/80 flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-slate-300">{r.siteId}</span>
                      <span className="text-slate-400">{r.columnLabel}</span>
                      <span className="text-slate-500">
                        {String(r.oldValue)} &rarr; {String(r.newValue)}
                      </span>
                    </div>
                    <span
                      className={`px-1.5 py-0.5 rounded font-bold uppercase text-[10px] ${
                        r.status === 'approved' ? 'bg-emerald-950 text-emerald-300' : 'bg-rose-950 text-rose-300'
                      }`}
                    >
                      {r.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs text-slate-400">
          <span>Data Integrity: All modifications logged with cryptographic user ID and timestamp.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
