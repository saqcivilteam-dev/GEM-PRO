import React, { useState, useRef, useEffect } from 'react';
import { Tracker, TrackerFolder, UserRole } from '../types/tracker';
import {
  FolderPlus,
  Plus,
  Copy,
  Edit2,
  Trash2,
  Folder,
  FolderOpen,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Table,
  Check,
  X,
  Search,
  AlertTriangle,
  Info,
  GripVertical,
  ArrowUpDown,
  FolderInput,
  SlidersHorizontal,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

interface SidebarProps {
  trackers: Tracker[];
  folders: TrackerFolder[];
  activeTrackerId: string;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onSelectTracker: (trackerId: string) => void;
  onCreateTracker: (folderId?: string) => void;
  onDuplicateTracker: (trackerId: string) => void;
  onRenameTracker: (trackerId: string, newName: string) => void;
  onDeleteTracker: (trackerId: string) => void;
  onCreateFolder: (folderName: string) => void;
  onRenameFolder: (folderId: string, newName: string) => void;
  onDeleteFolder?: (folderId: string) => void;
  onMoveTrackerToFolder?: (trackerId: string, targetFolderId: string) => void;
  onReorderTrackers?: (newTrackers: Tracker[]) => void;
  onReorderFolders?: (newFolders: TrackerFolder[]) => void;
  onOpenGlobalSearch: () => void;
  canEdit: boolean;
  isAdmin?: boolean;
  currentUserRole?: UserRole;
  assignedProjects?: string[];
  onOpenDevOpsModal?: (tab?: 'pipeline' | 'github' | 'vercel' | 'cloudflare') => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  trackers,
  folders,
  activeTrackerId,
  isCollapsed,
  onToggleCollapse,
  onSelectTracker,
  onCreateTracker,
  onDuplicateTracker,
  onRenameTracker,
  onDeleteTracker,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveTrackerToFolder,
  onReorderTrackers,
  onReorderFolders,
  onOpenGlobalSearch,
  canEdit,
  isAdmin,
  currentUserRole = 'admin',
  assignedProjects = [],
  onOpenDevOpsModal,
}) => {
  // Tracker renaming state
  const [editingTrackerId, setEditingTrackerId] = useState<string | null>(null);
  const [editingTrackerName, setEditingTrackerName] = useState('');

  // Folder renaming state
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');

  // New folder input state
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);

  // In-App Deletion Modals (replaces window.confirm which is blocked in iframes)
  const [trackerToDelete, setTrackerToDelete] = useState<Tracker | null>(null);
  const [folderToDelete, setFolderToDelete] = useState<TrackerFolder | null>(null);
  const [cannotDeleteNotice, setCannotDeleteNotice] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Drag and drop state
  const [draggedTrackerId, setDraggedTrackerId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [dragOverTrackerId, setDragOverTrackerId] = useState<string | null>(null);
  const [trackerDropPos, setTrackerDropPos] = useState<'before' | 'after' | null>(null);

  const [draggedFolderId, setDraggedFolderId] = useState<string | null>(null);
  const [dragOverFolderTargetId, setDragOverFolderTargetId] = useState<string | null>(null);
  const [folderDropPos, setFolderDropPos] = useState<'before' | 'after' | null>(null);

  // Quick Move modal state
  const [movingTracker, setMovingTracker] = useState<Tracker | null>(null);
  const [showQuickNewFolder, setShowQuickNewFolder] = useState(false);
  const [quickNewFolderName, setQuickNewFolderName] = useState('');

  // Organize mode toggle & sort menu
  const [isOrganizeMode, setIsOrganizeMode] = useState(false);
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(event.target as Node)) {
        setIsSortMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Move tracker to a specified folder
  const handleExecuteMoveTracker = (trackerId: string, targetFolderId: string) => {
    if (onMoveTrackerToFolder) {
      onMoveTrackerToFolder(trackerId, targetFolderId);
    } else if (onReorderTrackers) {
      const updated = trackers.map((t) => (t.id === trackerId ? { ...t, folderId: targetFolderId, updatedAt: new Date().toISOString() } : t));
      onReorderTrackers(updated);
    }
    // Auto expand destination folder
    setExpandedFolders((prev) => ({ ...prev, [targetFolderId]: true }));
    const targetFolder = folders.find((f) => f.id === targetFolderId);
    const movedTracker = trackers.find((t) => t.id === trackerId);
    setToastMessage(`Moved "${movedTracker?.name || 'Tracker'}" to folder "${targetFolder?.name || 'Folder'}"`);
    setTimeout(() => setToastMessage(null), 3000);
    setMovingTracker(null);
    setShowQuickNewFolder(false);
    setQuickNewFolderName('');
  };

  // Create new folder and move tracker directly into it
  const handleCreateFolderAndMove = (trackerId: string) => {
    if (!quickNewFolderName.trim()) return;
    const newFId = 'folder_' + Date.now().toString();
    onCreateFolder(quickNewFolderName.trim());
    handleExecuteMoveTracker(trackerId, newFId);
  };

  // Reorder tracker relative to another tracker
  const handleReorderTrackerDrop = (sourceId: string, targetId: string, position: 'before' | 'after') => {
    if (sourceId === targetId) return;
    const sourceTracker = trackers.find((t) => t.id === sourceId);
    const targetTracker = trackers.find((t) => t.id === targetId);
    if (!sourceTracker || !targetTracker) return;

    const remaining = trackers.filter((t) => t.id !== sourceId);
    const targetIndex = remaining.findIndex((t) => t.id === targetId);
    if (targetIndex === -1) return;

    // Adopt target folder if moved into a different folder
    const updatedSource: Tracker = {
      ...sourceTracker,
      folderId: targetTracker.folderId,
      updatedAt: new Date().toISOString(),
    };

    const insertIndex = position === 'before' ? targetIndex : targetIndex + 1;
    remaining.splice(insertIndex, 0, updatedSource);

    if (onReorderTrackers) {
      onReorderTrackers(remaining);
    }
    setExpandedFolders((prev) => ({ ...prev, [targetTracker.folderId]: true }));
    setToastMessage(`Moved "${updatedSource.name}"`);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Reorder folder drop
  const handleReorderFolderDrop = (sourceId: string, targetId: string, position: 'before' | 'after') => {
    if (sourceId === targetId) return;
    const remaining = folders.filter((f) => f.id !== sourceId);
    const targetIndex = remaining.findIndex((f) => f.id === targetId);
    if (targetIndex === -1) return;

    const sourceFolder = folders.find((f) => f.id === sourceId);
    if (!sourceFolder) return;

    const insertIndex = position === 'before' ? targetIndex : targetIndex + 1;
    remaining.splice(insertIndex, 0, sourceFolder);

    if (onReorderFolders) {
      onReorderFolders(remaining);
    }
    setToastMessage(`Moved folder "${sourceFolder.name}"`);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Move tracker slot up/down within folder
  const handleMoveTrackerSlot = (tracker: Tracker, direction: 'up' | 'down', e: React.MouseEvent) => {
    e.stopPropagation();
    const folderTrackers = trackers.filter((t) => t.folderId === tracker.folderId);
    const currentIndex = folderTrackers.findIndex((t) => t.id === tracker.id);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= folderTrackers.length) return;

    const targetTracker = folderTrackers[targetIndex];
    handleReorderTrackerDrop(tracker.id, targetTracker.id, direction === 'up' ? 'before' : 'after');
  };

  // Move folder slot up/down
  const handleMoveFolderSlot = (folder: TrackerFolder, direction: 'up' | 'down', e: React.MouseEvent) => {
    e.stopPropagation();
    const currentIndex = folders.findIndex((f) => f.id === folder.id);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= folders.length) return;

    const newFolders = [...folders];
    const [removed] = newFolders.splice(currentIndex, 1);
    newFolders.splice(targetIndex, 0, removed);

    if (onReorderFolders) {
      onReorderFolders(newFolders);
    }
    setToastMessage(`Moved folder "${folder.name}" ${direction}`);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Sort trackers within a folder
  const handleSortFolderTrackers = (folderId: string, sortType: 'name_asc' | 'name_desc' | 'rows_desc') => {
    const folderTrackers = trackers.filter((t) => t.folderId === folderId);

    const sorted = [...folderTrackers].sort((a, b) => {
      if (sortType === 'name_asc') return a.name.localeCompare(b.name, undefined, { numeric: true });
      if (sortType === 'name_desc') return b.name.localeCompare(a.name, undefined, { numeric: true });
      if (sortType === 'rows_desc') return (b.rows?.length || 0) - (a.rows?.length || 0);
      return 0;
    });

    const newTrackers: Tracker[] = [];
    let inserted = false;
    for (const t of trackers) {
      if (t.folderId === folderId) {
        if (!inserted) {
          newTrackers.push(...sorted);
          inserted = true;
        }
      } else {
        newTrackers.push(t);
      }
    }

    if (onReorderTrackers) {
      onReorderTrackers(newTrackers);
    }
    const folder = folders.find((f) => f.id === folderId);
    setToastMessage(`Sorted trackers in "${folder?.name || 'Folder'}"`);
    setTimeout(() => setToastMessage(null), 2500);
    setIsSortMenuOpen(false);
  };

  // Sort all folders
  const handleSortAllFolders = (direction: 'asc' | 'desc') => {
    const sortedFolders = [...folders].sort((a, b) => {
      return direction === 'asc'
        ? a.name.localeCompare(b.name, undefined, { numeric: true })
        : b.name.localeCompare(a.name, undefined, { numeric: true });
    });
    if (onReorderFolders) {
      onReorderFolders(sortedFolders);
    }
    setToastMessage(`Sorted folders ${direction === 'asc' ? 'A-Z' : 'Z-A'}`);
    setTimeout(() => setToastMessage(null), 2500);
    setIsSortMenuOpen(false);
  };

  // Permissions calculation
  const isUserAdmin = isAdmin ?? (currentUserRole === 'admin' || currentUserRole === 'creator');
  const isUserGuest = currentUserRole === 'guest';

  // Can manage this specific tracker
  const canManageTracker = (t: Tracker) => {
    if (isUserAdmin) return true;
    if (isUserGuest) return false;
    if (currentUserRole === 'staff') {
      return assignedProjects ? assignedProjects.includes(t.id) : canEdit;
    }
    return canEdit;
  };

  const canCreate = isUserAdmin || (currentUserRole === 'staff' && canEdit);

  // Folder collapse states
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    folder_civil: true,
    folder_legal: true,
    folder_sla: true,
  });

  // Start folder rename
  const handleStartRenameFolder = (folder: TrackerFolder, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingFolderId(folder.id);
    setEditingFolderName(folder.name);
  };

  // Confirm folder rename
  const handleConfirmRenameFolder = (folderId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (editingFolderName.trim()) {
      onRenameFolder(folderId, editingFolderName.trim());
    }
    setEditingFolderId(null);
  };

  // Cancel folder rename
  const handleCancelRenameFolder = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingFolderId(null);
  };

  // Start tracker rename
  const handleStartRenameTracker = (tracker: Tracker, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingTrackerId(tracker.id);
    setEditingTrackerName(tracker.name);
  };

  // Confirm tracker rename
  const handleConfirmRenameTracker = (trackerId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (editingTrackerName.trim()) {
      onRenameTracker(trackerId, editingTrackerName.trim());
    }
    setEditingTrackerId(null);
  };

  // Cancel tracker rename
  const handleCancelRenameTracker = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingTrackerId(null);
  };

  // Add new folder
  const handleAddFolder = () => {
    if (!newFolderName.trim()) return;
    onCreateFolder(newFolderName.trim());
    setNewFolderName('');
    setShowNewFolderInput(false);
  };

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [folderId]: !prev[folderId],
    }));
  };

  // Tracker deletion request handler
  const handleInitiateDeleteTracker = (tracker: Tracker, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canManageTracker(tracker)) {
      setCannotDeleteNotice(
        `Permission Restricted: Only Administrator or assigned Project Handler can delete "${tracker.name}".`
      );
      return;
    }
    if (trackers.length <= 1) {
      setCannotDeleteNotice(
        `Cannot delete "${tracker.name}". At least one project tracker must remain in the directory.`
      );
      return;
    }
    setTrackerToDelete(tracker);
  };

  // Tracker deletion confirmed
  const handleConfirmDeleteTracker = () => {
    if (!trackerToDelete) return;
    const name = trackerToDelete.name;
    onDeleteTracker(trackerToDelete.id);
    setTrackerToDelete(null);
    setToastMessage(`Deleted tracker "${name}".`);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Folder deletion request handler
  const handleInitiateDeleteFolder = (folder: TrackerFolder, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canCreate) {
      setCannotDeleteNotice(
        `Permission Restricted: Only Administrators can delete folders.`
      );
      return;
    }
    if (folders.length <= 1) {
      setCannotDeleteNotice(
        `Cannot delete "${folder.name}". At least one folder must remain in the directory.`
      );
      return;
    }
    setFolderToDelete(folder);
  };

  // Folder deletion confirmed
  const handleConfirmDeleteFolder = () => {
    if (!folderToDelete || !onDeleteFolder) return;
    const name = folderToDelete.name;
    onDeleteFolder(folderToDelete.id);
    setFolderToDelete(null);
    setToastMessage(`Deleted folder "${name}". Trackers were preserved.`);
    setTimeout(() => setToastMessage(null), 3500);
  };

  if (isCollapsed) {
    return (
      <aside className="w-14 bg-slate-950 border-r border-slate-800 flex flex-col items-center py-3.5 space-y-4 shrink-0 transition-all duration-200">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          title="Expand sidebar"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onOpenGlobalSearch}
          className="p-2 text-slate-400 hover:text-sky-400 rounded-lg hover:bg-slate-800 transition-colors"
          title="Search trackers"
        >
          <Search className="w-4 h-4" />
        </button>

        {canCreate && (
          <button
            type="button"
            onClick={() => onCreateTracker()}
            className="p-2 text-indigo-400 hover:text-white rounded-lg hover:bg-indigo-600/40 transition-colors"
            title="Create new tracker"
          >
            <Plus className="w-4 h-4" />
          </button>
        )}

        <div className="w-6 h-px bg-slate-800" />

        {/* Tracker Quick Icons */}
        <div className="flex-1 overflow-y-auto space-y-2 w-full flex flex-col items-center">
          {trackers.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelectTracker(t.id)}
              className={`p-2 rounded-lg text-xs transition-colors ${
                t.id === activeTrackerId
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
              title={t.name}
            >
              <Table className="w-4 h-4" />
            </button>
          ))}
        </div>

      </aside>
    );
  }

  return (
    <>
      <aside className="w-72 bg-slate-950 border-r border-slate-800 flex flex-col shrink-0 text-slate-200 transition-all duration-200 select-none">
        {/* Sidebar Header */}
        <div className="p-3.5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Table className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-white">
              Trackers Directory
            </span>
          </div>
          <button
            type="button"
            onClick={onToggleCollapse}
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
            title="Collapse sidebar"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Global Search Shortcut & Action Buttons */}
        <div className="p-3 border-b border-slate-800/80 space-y-2">
          <button
            type="button"
            onClick={onOpenGlobalSearch}
            className="w-full px-3 py-1.5 bg-slate-900 hover:bg-slate-800/90 border border-slate-800 rounded-lg text-xs text-slate-400 flex items-center justify-between transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5" />
              Search trackers...
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
              Ctrl+F
            </span>
          </button>

          {canCreate && (
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => onCreateTracker()}
                className="py-1.5 px-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-xs font-semibold flex items-center justify-center gap-1 transition-colors shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                New Tracker
              </button>
              <button
                type="button"
                onClick={() => setShowNewFolderInput(!showNewFolderInput)}
                className="py-1.5 px-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 rounded-md text-xs font-medium flex items-center justify-center gap-1 transition-colors"
              >
                <FolderPlus className="w-3.5 h-3.5 text-sky-400" />
                New Folder
              </button>
            </div>
          )}

          {/* Move & Organize Control Toolbar */}
          {canCreate && (
            <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
              <button
                type="button"
                onClick={() => setIsOrganizeMode(!isOrganizeMode)}
                className={`px-2 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  isOrganizeMode
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs ring-1 ring-amber-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
                }`}
                title={isOrganizeMode ? 'Done organizing' : 'Organize and move trackers/folders with quick arrows and drag'}
              >
                <SlidersHorizontal className="w-3 h-3 text-amber-400" />
                <span>{isOrganizeMode ? 'Done Organizing' : 'Organize & Move'}</span>
              </button>

              <div className="relative" ref={sortMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsSortMenuOpen(!isSortMenuOpen)}
                  className="px-2 py-1 rounded-md text-[11px] text-slate-300 hover:text-white hover:bg-slate-900 transition-colors flex items-center gap-1 cursor-pointer border border-slate-800"
                  title="Sort folders and trackers"
                >
                  <ArrowUpDown className="w-3 h-3 text-sky-400" />
                  <span>Sort</span>
                  <ChevronDown className={`w-2.5 h-2.5 text-slate-400 transition-transform ${isSortMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {isSortMenuOpen && (
                  <div className="absolute right-0 top-full mt-1.5 w-44 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl py-1.5 z-50 text-[11px] text-slate-200 animate-in fade-in duration-100">
                    <div className="px-2.5 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                      Sort Folders
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSortAllFolders('asc')}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-800 flex items-center gap-2 cursor-pointer text-slate-200 hover:text-white"
                    >
                      <ArrowUp className="w-3 h-3 text-sky-400" />
                      <span>Folders A → Z</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSortAllFolders('desc')}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-800 flex items-center gap-2 cursor-pointer text-slate-200 hover:text-white"
                    >
                      <ArrowDown className="w-3 h-3 text-sky-400" />
                      <span>Folders Z → A</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {showNewFolderInput && (
            <div className="flex items-center gap-1 pt-1">
              <input
                type="text"
                autoFocus
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Folder Name..."
                className="flex-1 px-2 py-1 text-xs bg-slate-900 border border-slate-700 rounded text-white focus:outline-hidden focus:border-indigo-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddFolder();
                  if (e.key === 'Escape') setShowNewFolderInput(false);
                }}
              />
              <button
                type="button"
                onClick={handleAddFolder}
                className="p-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded transition-colors"
                title="Save Folder"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setShowNewFolderInput(false)}
                className="p-1 text-slate-400 hover:text-white rounded"
                title="Cancel"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Active Drag Hint */}
          {draggedTrackerId && (
            <div className="p-2 bg-indigo-950/60 border border-indigo-700/60 rounded-lg text-[11px] text-indigo-200 flex items-center gap-1.5 animate-pulse">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span>Drop onto any folder or between trackers to organize</span>
            </div>
          )}
        </div>

        {/* Folders and Trackers Tree */}
        <div className="flex-1 overflow-y-auto p-2 space-y-3">
          {folders.map((folder, folderIdx) => {
            const folderTrackers = trackers.filter((t) => t.folderId === folder.id);
            const isExpanded = expandedFolders[folder.id] ?? true;
            const isRenamingFolder = editingFolderId === folder.id;
            const isFolderDropTarget = dragOverFolderId === folder.id;
            const isFolderReorderTarget = dragOverFolderTargetId === folder.id;

            return (
              <div key={folder.id} className="space-y-1">
                {/* Folder Reorder Drop Indicator - Above */}
                {isFolderReorderTarget && folderDropPos === 'before' && (
                  <div className="h-0.5 bg-amber-400 rounded-full shadow-[0_0_8px_rgba(251,191,36,0.9)] my-1 relative flex items-center">
                    <span className="w-2 h-2 rounded-full bg-amber-400 -ml-1 ring-2 ring-amber-300" />
                  </div>
                )}

                {/* Folder Header Row with Drag & Drop & Move Controls */}
                <div
                  draggable={canCreate && !isRenamingFolder && !draggedTrackerId}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/folder', folder.id);
                    e.dataTransfer.effectAllowed = 'move';
                    setDraggedFolderId(folder.id);
                  }}
                  onDragEnd={() => {
                    setDraggedFolderId(null);
                    setDragOverFolderTargetId(null);
                    setFolderDropPos(null);
                  }}
                  onDragOver={(e) => {
                    if (draggedTrackerId) {
                      e.preventDefault();
                      e.stopPropagation();
                      e.dataTransfer.dropEffect = 'move';
                      setDragOverFolderId(folder.id);
                    } else if (draggedFolderId && draggedFolderId !== folder.id) {
                      e.preventDefault();
                      e.stopPropagation();
                      e.dataTransfer.dropEffect = 'move';
                      setDragOverFolderTargetId(folder.id);
                      const rect = e.currentTarget.getBoundingClientRect();
                      const isAbove = (e.clientY - rect.top) < (rect.height / 2);
                      setFolderDropPos(isAbove ? 'before' : 'after');
                    }
                  }}
                  onDragLeave={() => {
                    if (dragOverFolderId === folder.id) setDragOverFolderId(null);
                    if (dragOverFolderTargetId === folder.id) setDragOverFolderTargetId(null);
                  }}
                  onDrop={(e) => {
                    if (draggedTrackerId) {
                      e.preventDefault();
                      e.stopPropagation();
                      handleExecuteMoveTracker(draggedTrackerId, folder.id);
                      setDraggedTrackerId(null);
                      setDragOverFolderId(null);
                    } else if (draggedFolderId && draggedFolderId !== folder.id) {
                      e.preventDefault();
                      e.stopPropagation();
                      handleReorderFolderDrop(draggedFolderId, folder.id, folderDropPos || 'after');
                      setDraggedFolderId(null);
                      setDragOverFolderTargetId(null);
                      setFolderDropPos(null);
                    }
                  }}
                  className={`group flex items-center justify-between px-2 py-1.5 text-xs rounded-md font-semibold transition-all ${
                    isFolderDropTarget
                      ? 'bg-emerald-950/80 border-2 border-emerald-400 text-emerald-200 ring-2 ring-emerald-400/40 shadow-lg scale-[1.01]'
                      : 'text-slate-300 hover:text-white hover:bg-slate-900/70 border border-transparent'
                  }`}
                >
                  {isRenamingFolder ? (
                    /* Inline Folder Rename Input */
                    <div className="flex items-center gap-1 w-full" onClick={(e) => e.stopPropagation()}>
                      <FolderOpen className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <input
                        type="text"
                        autoFocus
                        value={editingFolderName}
                        onChange={(e) => setEditingFolderName(e.target.value)}
                        className="flex-1 px-1.5 py-0.5 text-xs bg-slate-900 border border-indigo-500 rounded text-white focus:outline-hidden"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleConfirmRenameFolder(folder.id);
                          if (e.key === 'Escape') handleCancelRenameFolder();
                        }}
                      />
                      <button
                        type="button"
                        onClick={(e) => handleConfirmRenameFolder(folder.id, e)}
                        className="p-1 text-emerald-400 hover:text-emerald-300 hover:bg-slate-800 rounded"
                        title="Save folder name"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleCancelRenameFolder(e)}
                        className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded"
                        title="Cancel"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Folder Title Click to Toggle & Drag Handle */}
                      <div
                        onClick={() => toggleFolder(folder.id)}
                        onDoubleClick={() => canCreate && handleStartRenameFolder(folder)}
                        className="flex items-center gap-1.5 truncate flex-1 cursor-pointer select-none"
                        title="Click to toggle, double-click to rename, drag to reorder folders"
                      >
                        {canCreate && (
                          <GripVertical
                            className={`w-3.5 h-3.5 text-slate-500 hover:text-amber-400 cursor-grab active:cursor-grabbing shrink-0 transition-opacity ${
                              isOrganizeMode ? 'opacity-80' : 'opacity-0 group-hover:opacity-60'
                            }`}
                          />
                        )}
                        {isExpanded ? (
                          <FolderOpen className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        ) : (
                          <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        )}
                        <span className="truncate">{folder.name}</span>
                        <span className="text-[10px] text-slate-500 font-mono">({folderTrackers.length})</span>
                        {isFolderDropTarget && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded bg-emerald-500 text-slate-950 text-[10px] font-black uppercase tracking-wider animate-bounce">
                            Drop to Move
                          </span>
                        )}
                      </div>

                      {/* Folder Action Buttons */}
                      <div className="flex items-center gap-0.5 shrink-0 ml-1">
                        {canCreate && (
                          <>
                            {/* Organize Mode: Move Folder Up / Down */}
                            {isOrganizeMode && (
                              <div className="flex items-center bg-slate-950 border border-slate-800 rounded p-0.5 mr-1">
                                <button
                                  type="button"
                                  disabled={folderIdx === 0}
                                  onClick={(e) => handleMoveFolderSlot(folder, 'up', e)}
                                  className={`p-0.5 rounded ${folderIdx === 0 ? 'text-slate-700 cursor-not-allowed' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                                  title="Move folder up"
                                >
                                  <ChevronUp className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  disabled={folderIdx === folders.length - 1}
                                  onClick={(e) => handleMoveFolderSlot(folder, 'down', e)}
                                  className={`p-0.5 rounded ${folderIdx === folders.length - 1 ? 'text-slate-700 cursor-not-allowed' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                                  title="Move folder down"
                                >
                                  <ChevronDown className="w-3 h-3" />
                                </button>
                              </div>
                            )}

                            {/* Sort Folder Trackers button */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSortFolderTrackers(folder.id, 'name_asc');
                              }}
                              className="p-1 text-slate-500 hover:text-sky-300 hover:bg-slate-800 rounded transition-colors"
                              title="Sort this folder A → Z"
                            >
                              <ArrowUpDown className="w-3 h-3" />
                            </button>

                            <button
                              type="button"
                              onClick={(e) => handleStartRenameFolder(folder, e)}
                              className="p-1 text-slate-500 hover:text-sky-300 hover:bg-slate-800 rounded transition-colors"
                              title="Rename folder"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onCreateTracker(folder.id);
                              }}
                              title="Add tracker to this folder"
                              className="p-1 text-slate-500 hover:text-white hover:bg-slate-800 rounded transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                            {folders.length > 1 && onDeleteFolder && (
                              <button
                                type="button"
                                onClick={(e) => handleInitiateDeleteFolder(folder, e)}
                                className="p-1 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded opacity-60 group-hover:opacity-100 transition-opacity"
                                title="Delete folder"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Folder Reorder Drop Indicator - Below */}
                {isFolderReorderTarget && folderDropPos === 'after' && (
                  <div className="h-0.5 bg-amber-400 rounded-full shadow-[0_0_8px_rgba(251,191,36,0.9)] my-1 relative flex items-center">
                    <span className="w-2 h-2 rounded-full bg-amber-400 -ml-1 ring-2 ring-amber-300" />
                  </div>
                )}

                {/* Trackers inside this Folder */}
                {isExpanded && (
                  <div className="pl-2 space-y-0.5 border-l-2 border-slate-800/80 ml-2.5 my-0.5">
                    {folderTrackers.length === 0 && (
                      <div className="px-2 py-1.5 text-[11px] text-slate-500 italic">
                        Empty folder (drag trackers here or click +)
                      </div>
                    )}

                    {folderTrackers.map((tracker, trackerIdx) => {
                      const isActive = tracker.id === activeTrackerId;
                      const isRenaming = editingTrackerId === tracker.id;
                      const hasTrackerAccess = canManageTracker(tracker);
                      const isBeingDragged = draggedTrackerId === tracker.id;
                      const isDropTarget = dragOverTrackerId === tracker.id;

                      return (
                        <div key={tracker.id} className="relative">
                          {/* Drop Indicator - Above Tracker */}
                          {isDropTarget && trackerDropPos === 'before' && (
                            <div className="h-0.5 bg-sky-400 rounded-full shadow-[0_0_8px_rgba(56,189,248,0.95)] my-0.5 relative flex items-center z-20">
                              <span className="w-2 h-2 rounded-full bg-sky-400 -ml-1 ring-2 ring-sky-300 animate-ping" />
                            </div>
                          )}

                          {/* Tracker Item Row */}
                          <div
                            draggable={canCreate && !isRenaming}
                            onDragStart={(e) => {
                              e.stopPropagation();
                              e.dataTransfer.setData('text/plain', tracker.id);
                              e.dataTransfer.effectAllowed = 'move';
                              setDraggedTrackerId(tracker.id);
                            }}
                            onDragEnd={() => {
                              setDraggedTrackerId(null);
                              setDragOverTrackerId(null);
                              setTrackerDropPos(null);
                              setDragOverFolderId(null);
                            }}
                            onDragOver={(e) => {
                              if (!draggedTrackerId || draggedTrackerId === tracker.id) return;
                              e.preventDefault();
                              e.stopPropagation();
                              e.dataTransfer.dropEffect = 'move';
                              const rect = e.currentTarget.getBoundingClientRect();
                              const isAbove = (e.clientY - rect.top) < (rect.height / 2);
                              setDragOverTrackerId(tracker.id);
                              setTrackerDropPos(isAbove ? 'before' : 'after');
                            }}
                            onDrop={(e) => {
                              if (!draggedTrackerId || draggedTrackerId === tracker.id) return;
                              e.preventDefault();
                              e.stopPropagation();
                              handleReorderTrackerDrop(draggedTrackerId, tracker.id, trackerDropPos || 'after');
                              setDraggedTrackerId(null);
                              setDragOverTrackerId(null);
                              setTrackerDropPos(null);
                            }}
                            className={`group flex items-center justify-between px-2 py-1.5 rounded-md text-xs transition-all ${
                              isActive
                                ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                                : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                            } ${isBeingDragged ? 'opacity-40 scale-95 border-dashed border border-indigo-400' : ''}`}
                          >
                            {isRenaming ? (
                              /* Inline Tracker Rename Input */
                              <div className="flex items-center gap-1 w-full" onClick={(e) => e.stopPropagation()}>
                                <Table className="w-3.5 h-3.5 shrink-0 opacity-80" />
                                <input
                                  type="text"
                                  autoFocus
                                  value={editingTrackerName}
                                  onChange={(e) => setEditingTrackerName(e.target.value)}
                                  className="flex-1 px-1.5 py-0.5 text-xs bg-slate-900 border border-indigo-400 rounded text-white focus:outline-hidden"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleConfirmRenameTracker(tracker.id);
                                    if (e.key === 'Escape') handleCancelRenameTracker();
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={(e) => handleConfirmRenameTracker(tracker.id, e)}
                                  className="p-1 text-emerald-300 hover:bg-slate-800 rounded"
                                  title="Save tracker name"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => handleCancelRenameTracker(e)}
                                  className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded"
                                  title="Cancel"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <>
                                {/* Drag Handle + Tracker Select / Double-Click to Rename */}
                                <div
                                  onClick={() => onSelectTracker(tracker.id)}
                                  onDoubleClick={() => hasTrackerAccess && handleStartRenameTracker(tracker)}
                                  className="flex items-center gap-1.5 truncate flex-1 cursor-pointer select-none"
                                  title="Click to open tracker, double-click to rename, drag to reorder or move folder"
                                >
                                  {canCreate && (
                                    <GripVertical
                                      className={`w-3.5 h-3.5 text-slate-500 hover:text-indigo-300 cursor-grab active:cursor-grabbing shrink-0 transition-opacity -ml-0.5 ${
                                        isOrganizeMode ? 'opacity-80' : 'opacity-0 group-hover:opacity-70'
                                      }`}
                                    />
                                  )}
                                  <Table className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                                  <span className="truncate">{tracker.name}</span>
                                  <span className={`text-[10px] font-mono ${isActive ? 'text-indigo-200' : 'text-slate-400'}`}>
                                    ({tracker.rows.length})
                                  </span>
                                </div>

                                {/* Quick Actions (Move, Organize arrows, Duplicate, Rename, Delete) */}
                                {hasTrackerAccess && (
                                  <div
                                    className={`flex items-center gap-1 shrink-0 ml-1 transition-opacity ${
                                      isActive ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'
                                    }`}
                                  >
                                    {/* Organize Mode: Move Tracker Up / Down */}
                                    {isOrganizeMode && (
                                      <div className="flex items-center bg-black/30 rounded p-0.5">
                                        <button
                                          type="button"
                                          disabled={trackerIdx === 0}
                                          onClick={(e) => handleMoveTrackerSlot(tracker, 'up', e)}
                                          className={`p-0.5 rounded ${trackerIdx === 0 ? 'text-slate-600 cursor-not-allowed' : 'text-slate-300 hover:text-white'}`}
                                          title="Move tracker up"
                                        >
                                          <ChevronUp className="w-3 h-3" />
                                        </button>
                                        <button
                                          type="button"
                                          disabled={trackerIdx === folderTrackers.length - 1}
                                          onClick={(e) => handleMoveTrackerSlot(tracker, 'down', e)}
                                          className={`p-0.5 rounded ${trackerIdx === folderTrackers.length - 1 ? 'text-slate-600 cursor-not-allowed' : 'text-slate-300 hover:text-white'}`}
                                          title="Move tracker down"
                                        >
                                          <ChevronDown className="w-3 h-3" />
                                        </button>
                                      </div>
                                    )}

                                    {/* Move to Another Folder Button */}
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setMovingTracker(tracker);
                                      }}
                                      className={`p-1 rounded hover:bg-black/30 transition-colors ${
                                        isActive ? 'text-indigo-200 hover:text-white' : 'text-slate-400 hover:text-sky-300'
                                      }`}
                                      title={`Move "${tracker.name}" to another folder`}
                                      aria-label={`Move tracker ${tracker.name}`}
                                    >
                                      <FolderInput className="w-3 h-3" />
                                    </button>

                                    <button
                                      type="button"
                                      onClick={(e) => handleStartRenameTracker(tracker, e)}
                                      className={`p-1 rounded hover:bg-black/30 transition-colors ${
                                        isActive ? 'text-white' : 'text-slate-400 hover:text-white'
                                      }`}
                                      title="Rename tracker"
                                    >
                                      <Edit2 className="w-3 h-3" />
                                    </button>

                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onDuplicateTracker(tracker.id);
                                      }}
                                      className={`p-1 rounded hover:bg-black/30 transition-colors ${
                                        isActive ? 'text-white' : 'text-slate-400 hover:text-white'
                                      }`}
                                      title="Duplicate tracker"
                                    >
                                      <Copy className="w-3 h-3" />
                                    </button>

                                    {/* Delete Tracker Icon with In-App Confirmation */}
                                    <button
                                      type="button"
                                      onClick={(e) => handleInitiateDeleteTracker(tracker, e)}
                                      className={`p-1 rounded transition-colors ${
                                        isActive
                                          ? 'text-rose-200 hover:text-white hover:bg-rose-700/60'
                                          : 'text-rose-400 hover:text-rose-200 hover:bg-rose-900/50'
                                      }`}
                                      title={`Delete tracker "${tracker.name}"`}
                                      aria-label={`Delete tracker ${tracker.name}`}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
                              </>
                            )}
                          </div>

                          {/* Drop Indicator - Below Tracker */}
                          {isDropTarget && trackerDropPos === 'after' && (
                            <div className="h-0.5 bg-sky-400 rounded-full shadow-[0_0_8px_rgba(56,189,248,0.95)] my-0.5 relative flex items-center z-20">
                              <span className="w-2 h-2 rounded-full bg-sky-400 -ml-1 ring-2 ring-sky-300 animate-ping" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Sidebar Footer */}
        <div className="p-2.5 border-t border-slate-800 bg-slate-950 text-[11px] text-slate-400 space-y-2">
          <div className="flex items-center justify-between text-[10px] px-0.5">
            <span>{trackers.length} Active Trackers</span>
            <span className="font-mono text-emerald-400">PHP (₱) Default</span>
          </div>
        </div>
      </aside>

      {/* IN-APP MODAL: Delete Tracker Confirmation */}
      {trackerToDelete && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setTrackerToDelete(null)}
        >
          <div
            className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-5 text-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3.5 mb-4">
              <div className="w-10 h-10 rounded-full bg-rose-500/20 border border-rose-500/30 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  Delete Project Tracker
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Are you sure you want to delete this tracker from the directory?
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-lg mb-4 space-y-1.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Tracker Name:</span>
                <span className="font-semibold text-white">{trackerToDelete.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Site Records / Rows:</span>
                <span className="font-mono text-amber-300 font-bold">{trackerToDelete.rows.length} rows</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Folder:</span>
                <span className="text-slate-300">
                  {folders.find((f) => f.id === trackerToDelete.folderId)?.name || 'General'}
                </span>
              </div>
            </div>

            <div className="p-2.5 bg-rose-950/30 border border-rose-800/40 rounded-lg mb-4 text-xs text-rose-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>
                All site data, milestone schedules, SLA logs, and checklists in this tracker will be removed.
              </span>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setTrackerToDelete(null)}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteTracker}
                className="px-4 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition-colors flex items-center gap-1.5 shadow-md shadow-rose-950/50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IN-APP MODAL: Delete Folder Confirmation */}
      {folderToDelete && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setFolderToDelete(null)}
        >
          <div
            className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-5 text-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3.5 mb-4">
              <div className="w-10 h-10 rounded-full bg-rose-500/20 border border-rose-500/30 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-white">
                  Delete Folder
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Delete folder "{folderToDelete.name}"?
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300 mb-4 bg-slate-950 p-3 rounded-lg border border-slate-800">
              Trackers currently in this folder will not be lost; they will be moved to the primary folder.
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setFolderToDelete(null)}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteFolder}
                className="px-4 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Folder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IN-APP MODAL: Cannot Delete Notice (1 tracker left or permission restriction) */}
      {cannotDeleteNotice && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setCannotDeleteNotice(null)}
        >
          <div
            className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-5 text-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3.5 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-white">Action Not Allowed</h3>
                <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                  {cannotDeleteNotice}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end pt-2">
              <button
                type="button"
                onClick={() => setCannotDeleteNotice(null)}
                className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors shadow-xs"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IN-APP MODAL: Move Tracker to Folder */}
      {movingTracker && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => {
            setMovingTracker(null);
            setShowQuickNewFolder(false);
            setQuickNewFolderName('');
          }}
        >
          <div
            className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-5 text-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
                  <FolderInput className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Move Tracker</h3>
                  <p className="text-xs text-slate-400 truncate max-w-[280px]">
                    Select destination folder for <span className="text-indigo-300 font-semibold">"{movingTracker.name}"</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMovingTracker(null);
                  setShowQuickNewFolder(false);
                  setQuickNewFolderName('');
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1 my-3 scrollbar-thin">
              {folders.map((folder) => {
                const isCurrent = movingTracker.folderId === folder.id;
                const count = trackers.filter((t) => t.folderId === folder.id).length;
                return (
                  <button
                    key={folder.id}
                    type="button"
                    disabled={isCurrent}
                    onClick={() => handleExecuteMoveTracker(movingTracker.id, folder.id)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs transition-all ${
                      isCurrent
                        ? 'bg-slate-800/50 text-slate-500 border border-dashed border-slate-700/60 cursor-not-allowed'
                        : 'bg-slate-800/80 hover:bg-indigo-600/20 text-slate-200 hover:text-white border border-slate-700 hover:border-indigo-500/50 cursor-pointer shadow-xs'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Folder className={`w-4 h-4 shrink-0 ${isCurrent ? 'text-slate-500' : 'text-amber-400'}`} />
                      <span className="font-semibold truncate">{folder.name}</span>
                      {isCurrent && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-400 font-normal">
                          Current
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-slate-400">
                        {count} {count === 1 ? 'tracker' : 'trackers'}
                      </span>
                      {!isCurrent && <ArrowRight className="w-3.5 h-3.5 text-indigo-400" />}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Quick Create New Folder & Move */}
            <div className="pt-2 border-t border-slate-800 mt-3">
              {!showQuickNewFolder ? (
                <button
                  type="button"
                  onClick={() => setShowQuickNewFolder(true)}
                  className="w-full py-2 px-3 text-xs font-semibold text-indigo-400 hover:text-indigo-300 hover:bg-indigo-950/40 border border-dashed border-indigo-700/50 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Create New Folder & Move Here
                </button>
              ) : (
                <div className="space-y-2 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-300 block">New Folder Name</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      autoFocus
                      placeholder="e.g., ARCHIVES, PROJECT 2026"
                      value={quickNewFolderName}
                      onChange={(e) => setQuickNewFolderName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCreateFolderAndMove(movingTracker.id);
                        if (e.key === 'Escape') setShowQuickNewFolder(false);
                      }}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      disabled={!quickNewFolderName.trim()}
                      onClick={() => handleCreateFolderAndMove(movingTracker.id)}
                      className="px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg transition-colors shrink-0"
                    >
                      Create & Move
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowQuickNewFolder(false);
                        setQuickNewFolderName('');
                      }}
                      className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 text-xs"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end pt-3 mt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setMovingTracker(null);
                  setShowQuickNewFolder(false);
                  setQuickNewFolderName('');
                }}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Notification Toast */}
      {toastMessage && (
        <div className="fixed bottom-5 left-5 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl border border-slate-700 shadow-xl text-xs flex items-center gap-2 animate-in slide-in-from-bottom-2 duration-200">
          <Info className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </>
  );
};
