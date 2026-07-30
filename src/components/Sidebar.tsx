import { useState, useRef, useEffect, useCallback } from 'react';
import {
  BookOpen, Plus, LogOut, X, ChevronRight, ChevronDown,
  FileText, MoreHorizontal, Trash2, FilePlus, Loader2, Pencil,
} from 'lucide-react';
import type { Course, AppDocument } from '@/types';

// ---------- Types ----------

interface SidebarProps {
  /** Whether sidebar is visible on mobile */
  sidebarOpen: boolean;
  onCloseSidebar: () => void;

  // Navigation
  onNavigateDashboard: () => void;
  onNavigateGenerate: () => void;
  onNavigateCourse: (courseId: string) => void;
  onNavigateDocument: (documentId: string) => void;

  // Active state
  activeView: string;
  activeCourseId?: string;
  activeDocumentId?: string;

  // Data
  courses: Course[];
  coursesLoading: boolean;
  documents: AppDocument[];
  docsLoading: boolean;

  // Document CRUD
  onCreateDocument: (title: string, parentId?: string | null) => Promise<void>;
  onDeleteDocument: (id: string) => Promise<void>;
  onRenameDocument: (id: string, title: string) => Promise<void>;

  // Auth
  userEmail: string;
  onSignOut: () => void;
}

// ---------- Helpers ----------

/** Build a tree structure from flat document list using parent_id */
interface DocTreeNode {
  doc: AppDocument;
  children: DocTreeNode[];
}

function buildDocTree(docs: AppDocument[]): DocTreeNode[] {
  const map = new Map<string, DocTreeNode>();
  const roots: DocTreeNode[] = [];

  // Create nodes
  for (const doc of docs) {
    map.set(doc.id, { doc, children: [] });
  }

  // Link parents
  for (const doc of docs) {
    const node = map.get(doc.id)!;
    if (doc.parent_id && map.has(doc.parent_id)) {
      map.get(doc.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

// ---------- Main Component ----------

export function Sidebar({
  sidebarOpen,
  onCloseSidebar,
  onNavigateDashboard,
  onNavigateGenerate,
  onNavigateCourse,
  onNavigateDocument,
  activeView,
  activeCourseId,
  activeDocumentId,
  courses,
  coursesLoading,
  documents,
  docsLoading,
  onCreateDocument,
  onDeleteDocument,
  onRenameDocument,
  userEmail,
  onSignOut,
}: SidebarProps) {
  const [libraryExpanded, setLibraryExpanded] = useState(true);
  const [pagesExpanded, setPagesExpanded] = useState(true);
  const [expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set());
  const [creatingPage, setCreatingPage] = useState(false);

  const isLibraryActive = activeView === 'dashboard' || activeView === 'course' || activeView === 'lesson' || activeView === 'progress';
  const docTree = buildDocTree(documents);

  const toggleDocExpanded = (docId: string) => {
    setExpandedDocs(prev => {
      const next = new Set(prev);
      if (next.has(docId)) {
        next.delete(docId);
      } else {
        next.add(docId);
      }
      return next;
    });
  };

  const handleCreateRootPage = async () => {
    setCreatingPage(true);
    try {
      await onCreateDocument('Untitled');
    } finally {
      setCreatingPage(false);
    }
  };

  const handleCreateSubPage = async (parentId: string) => {
    // Expand the parent so user sees the new child
    setExpandedDocs(prev => new Set(prev).add(parentId));
    await onCreateDocument('Untitled', parentId);
  };

  return (
    <aside
      className={`fixed lg:sticky top-0 left-0 h-screen w-72 bg-cream-100 border-r border-cream-200 z-40 flex flex-col transition-transform duration-300 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}
    >
      {/* Logo */}
      <div className="px-6 pt-7 pb-4 flex items-center justify-between">
        <button onClick={onNavigateDashboard} className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-terracotta-500 flex items-center justify-center shadow-soft">
            <BookOpen className="w-5 h-5 text-cream-50" strokeWidth={1.5} />
          </div>
          <span className="font-serif text-xl text-ink-700 tracking-tight">Athenaeum</span>
        </button>
        <button
          onClick={onCloseSidebar}
          className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg hover:bg-cream-200 text-ink-500"
        >
          <X className="w-5 h-5" strokeWidth={1.5} />
        </button>
      </div>

      {/* Scrollable nav */}
      <nav className="flex-1 px-3 py-1 overflow-y-auto scrollbar-thin space-y-1">

        {/* ── Library Section ── */}
        <div>
          <button
            onClick={() => setLibraryExpanded(!libraryExpanded)}
            className="w-full flex items-center justify-between px-2 py-1.5 rounded-md text-[11px] font-semibold uppercase tracking-wider text-warmgray-400 hover:text-warmgray-600 transition-colors"
          >
            <span>Library</span>
            {libraryExpanded ? (
              <ChevronDown className="w-3.5 h-3.5" strokeWidth={2} />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" strokeWidth={2} />
            )}
          </button>

          {libraryExpanded && (
            <div className="mt-0.5 space-y-0.5">
              {/* All Courses link */}
              <button
                onClick={onNavigateDashboard}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeView === 'dashboard'
                    ? 'bg-cream-200 text-ink-700'
                    : 'text-warmgray-500 hover:bg-cream-200/60 hover:text-ink-600'
                }`}
              >
                <BookOpen className="w-[16px] h-[16px]" strokeWidth={1.5} />
                All Courses
              </button>

              {/* Course list */}
              {coursesLoading ? (
                <div className="flex items-center gap-2 px-3 py-2 text-xs text-warmgray-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />
                  Loading...
                </div>
              ) : (
                courses.map((course) => {
                  const isActive = activeCourseId === course.id && (activeView === 'course' || activeView === 'lesson');
                  const colorDot: Record<string, string> = {
                    terracotta: 'bg-terracotta-400',
                    sage: 'bg-sage-400',
                    gold: 'bg-gold-400',
                    brick: 'bg-brick-400',
                    ink: 'bg-ink-500',
                  };
                  return (
                    <button
                      key={course.id}
                      onClick={() => onNavigateCourse(course.id)}
                      className={`w-full flex items-center gap-2.5 pl-6 pr-3 py-1.5 rounded-lg text-[13px] transition-all group ${
                        isActive
                          ? 'bg-cream-200 text-ink-700 font-medium'
                          : 'text-warmgray-500 hover:bg-cream-200/60 hover:text-ink-600'
                      }`}
                      title={course.title}
                    >
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${colorDot[course.cover_color] || 'bg-terracotta-400'}`} />
                      <span className="truncate">{course.title}</span>
                    </button>
                  );
                })
              )}

              {/* New Course */}
              <button
                onClick={onNavigateGenerate}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeView === 'generate'
                    ? 'bg-cream-200 text-ink-700'
                    : 'text-warmgray-500 hover:bg-cream-200/60 hover:text-ink-600'
                }`}
              >
                <Plus className="w-[16px] h-[16px]" strokeWidth={1.5} />
                New Course
              </button>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="h-px bg-cream-200 my-2" />

        {/* ── My Pages Section ── */}
        <div>
          <div className="flex items-center justify-between px-2 py-1.5">
            <button
              onClick={() => setPagesExpanded(!pagesExpanded)}
              className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-warmgray-400 hover:text-warmgray-600 transition-colors"
            >
              {pagesExpanded ? (
                <ChevronDown className="w-3.5 h-3.5" strokeWidth={2} />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" strokeWidth={2} />
              )}
              <span>My Pages</span>
            </button>
            <button
              onClick={handleCreateRootPage}
              disabled={creatingPage}
              className="w-6 h-6 rounded-md flex items-center justify-center text-warmgray-400 hover:text-ink-600 hover:bg-cream-200 transition-colors"
              title="New page"
            >
              {creatingPage ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />
              ) : (
                <Plus className="w-3.5 h-3.5" strokeWidth={2} />
              )}
            </button>
          </div>

          {pagesExpanded && (
            <div className="mt-0.5 space-y-0.5">
              {docsLoading ? (
                <div className="flex items-center gap-2 px-3 py-2 text-xs text-warmgray-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />
                  Loading pages...
                </div>
              ) : docTree.length === 0 ? (
                <div className="px-3 py-3 text-center">
                  <p className="text-xs text-warmgray-400 mb-2">No pages yet</p>
                  <button
                    onClick={handleCreateRootPage}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cream-200/60 text-xs font-medium text-warmgray-500 hover:bg-cream-200 hover:text-ink-600 transition-colors"
                  >
                    <Plus className="w-3 h-3" strokeWidth={2} />
                    Create your first page
                  </button>
                </div>
              ) : (
                docTree.map((node) => (
                  <DocumentTreeItem
                    key={node.doc.id}
                    node={node}
                    depth={0}
                    activeDocumentId={activeDocumentId}
                    expandedDocs={expandedDocs}
                    onToggleExpand={toggleDocExpanded}
                    onNavigate={onNavigateDocument}
                    onDelete={onDeleteDocument}
                    onRename={onRenameDocument}
                    onCreateSubPage={handleCreateSubPage}
                  />
                ))
              )}
            </div>
          )}
        </div>
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-cream-200">
        <div className="px-3 py-2 mb-1">
          <p className="text-xs text-warmgray-400 truncate">{userEmail}</p>
        </div>
        <button
          onClick={onSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-warmgray-500 hover:bg-brick-50 hover:text-brick-500 transition-colors"
        >
          <LogOut className="w-[18px] h-[18px]" strokeWidth={1.5} />
          Sign out
        </button>
      </div>
    </aside>
  );
}

// ---------- Document Tree Item ----------

interface DocumentTreeItemProps {
  node: DocTreeNode;
  depth: number;
  activeDocumentId?: string;
  expandedDocs: Set<string>;
  onToggleExpand: (id: string) => void;
  onNavigate: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
  onRename: (id: string, title: string) => Promise<void>;
  onCreateSubPage: (parentId: string) => Promise<void>;
}

function DocumentTreeItem({
  node,
  depth,
  activeDocumentId,
  expandedDocs,
  onToggleExpand,
  onNavigate,
  onDelete,
  onRename,
  onCreateSubPage,
}: DocumentTreeItemProps) {
  const { doc, children } = node;
  const isActive = activeDocumentId === doc.id;
  const isExpanded = expandedDocs.has(doc.id);
  const hasChildren = children.length > 0;

  const [showMenu, setShowMenu] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(doc.title);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!showMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showMenu]);

  // Focus input when renaming starts
  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  const handleRenameSubmit = async () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== doc.title) {
      await onRename(doc.id, trimmed);
    } else {
      setRenameValue(doc.title);
    }
    setIsRenaming(false);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRenameSubmit();
    } else if (e.key === 'Escape') {
      setRenameValue(doc.title);
      setIsRenaming(false);
    }
  };

  // Indent based on depth (max 4 levels visually)
  const paddingLeft = 12 + Math.min(depth, 4) * 16;

  return (
    <div>
      <div
        className={`group flex items-center rounded-lg transition-all relative ${
          isActive
            ? 'bg-cream-200 text-ink-700'
            : 'text-warmgray-500 hover:bg-cream-200/60 hover:text-ink-600'
        }`}
        style={{ paddingLeft: `${paddingLeft}px` }}
      >
        {/* Expand/collapse toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand(doc.id);
          }}
          className={`w-5 h-5 flex items-center justify-center flex-shrink-0 rounded transition-colors ${
            hasChildren ? 'hover:bg-cream-300/50 text-warmgray-400' : 'text-transparent'
          }`}
        >
          {hasChildren && (
            isExpanded ? (
              <ChevronDown className="w-3 h-3" strokeWidth={2} />
            ) : (
              <ChevronRight className="w-3 h-3" strokeWidth={2} />
            )
          )}
        </button>

        {/* Icon + Title */}
        <button
          onClick={() => onNavigate(doc.id)}
          onDoubleClick={(e) => {
            e.preventDefault();
            setIsRenaming(true);
          }}
          className="flex-1 flex items-center gap-1.5 py-1.5 pr-1 min-w-0 text-left"
        >
          <span className="text-sm flex-shrink-0">{doc.icon || '📝'}</span>
          {isRenaming ? (
            <input
              ref={inputRef}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={handleRenameSubmit}
              onKeyDown={handleRenameKeyDown}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 text-[13px] bg-cream-50 border border-cream-300 rounded px-1.5 py-0.5 text-ink-700 focus:outline-none focus:border-terracotta-300 min-w-0"
            />
          ) : (
            <span className={`text-[13px] truncate ${isActive ? 'font-medium' : ''}`}>
              {doc.title || 'Untitled'}
            </span>
          )}
        </button>

        {/* Context menu trigger — visible on hover */}
        {!isRenaming && (
          <div className="flex items-center gap-0.5 pr-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCreateSubPage(doc.id);
              }}
              className="w-5 h-5 rounded flex items-center justify-center text-warmgray-400 hover:text-ink-600 hover:bg-cream-300/50 transition-colors"
              title="Add sub-page"
            >
              <FilePlus className="w-3 h-3" strokeWidth={2} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="w-5 h-5 rounded flex items-center justify-center text-warmgray-400 hover:text-ink-600 hover:bg-cream-300/50 transition-colors"
              title="More options"
            >
              <MoreHorizontal className="w-3 h-3" strokeWidth={2} />
            </button>
          </div>
        )}

        {/* Dropdown menu */}
        {showMenu && (
          <div
            ref={menuRef}
            className="absolute right-0 top-full mt-1 w-40 bg-cream-50 border border-cream-200 rounded-xl shadow-lifted z-50 py-1 animate-fade-in-soft"
          >
            <button
              onClick={() => {
                setShowMenu(false);
                setIsRenaming(true);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-warmgray-600 hover:bg-cream-100 hover:text-ink-600 transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" strokeWidth={1.5} />
              Rename
            </button>
            <button
              onClick={() => {
                setShowMenu(false);
                if (confirm('Delete this page? This cannot be undone.')) {
                  onDelete(doc.id);
                }
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-brick-500 hover:bg-brick-50 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
              Delete
            </button>
          </div>
        )}
      </div>

      {/* Children (nested pages) */}
      {isExpanded && hasChildren && (
        <div className="space-y-0.5">
          {children.map((child) => (
            <DocumentTreeItem
              key={child.doc.id}
              node={child}
              depth={depth + 1}
              activeDocumentId={activeDocumentId}
              expandedDocs={expandedDocs}
              onToggleExpand={onToggleExpand}
              onNavigate={onNavigate}
              onDelete={onDelete}
              onRename={onRename}
              onCreateSubPage={onCreateSubPage}
            />
          ))}
        </div>
      )}
    </div>
  );
}
