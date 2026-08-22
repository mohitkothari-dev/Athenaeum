import { useState, useRef, useEffect } from 'react';
import {
  BookOpen, Plus, LogOut, X, ChevronRight, ChevronDown,
  MoreHorizontal, Trash2, FilePlus, Loader2, Pencil, Home, GraduationCap,
} from 'lucide-react';
import type { Course, AppDocument } from '@/types';
import type { CanvasDocument } from '@/types/canvas';
import CanvasSidebarSection from './CanvasSidebarSection';
import { COURSE_COLOR_DOTS } from '@/lib/courseColors';

// ---------- Types ----------

interface SidebarProps {
  /** Whether sidebar is visible on mobile */
  sidebarOpen: boolean;
  onCloseSidebar: () => void;

  // Navigation
  onNavigateHome: () => void;
  onNavigateDashboard: () => void;
  onNavigateCourse: (courseId: string) => void;
  onNavigateDocument: (documentId: string) => void;
  onNavigateCanvas: (canvasId: string) => void;

  // Active state
  activeView: string;
  activeCourseId?: string;
  activeDocumentId?: string;
  activeCanvasId?: string;

  // Data
  courses: Course[];
  coursesLoading: boolean;
  documents: AppDocument[];
  docsLoading: boolean;
  canvases: CanvasDocument[];
  canvasesLoading: boolean;

  // Document CRUD
  onCreateDocument: (title: string, parentId?: string | null) => Promise<void>;
  onDeleteDocument: (id: string) => Promise<void>;
  onRenameDocument: (id: string, title: string) => Promise<void>;

  // Canvas CRUD
  onCreateCanvas: () => Promise<void>;
  onDeleteCanvas: (canvasId: string) => Promise<void>;
  onRenameCanvas: (canvasId: string, title: string) => Promise<void>;

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

  for (const doc of docs) {
    map.set(doc.id, { doc, children: [] });
  }

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

// ---------- Shared nav-item style ----------

function navItemClass(active: boolean) {
  return `w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-400 focus-visible:ring-offset-1 ${
    active
      ? 'bg-cream-200 text-ink-700'
      : 'text-warmgray-500 hover:bg-cream-200/60 hover:text-ink-600'
  }`;
}

function sectionHeading(label: string) {
  return (
    <p className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest text-warmgray-300 select-none">
      {label}
    </p>
  );
}

// ---------- Main Component ----------

export function Sidebar({
  sidebarOpen,
  onCloseSidebar,
  onNavigateHome,
  onNavigateDashboard,
  onNavigateCourse,
  onNavigateDocument,
  onNavigateCanvas,
  activeView,
  activeCourseId,
  activeDocumentId,
  activeCanvasId,
  courses,
  coursesLoading,
  documents,
  docsLoading,
  canvases,
  canvasesLoading,
  onCreateDocument,
  onDeleteDocument,
  onRenameDocument,
  onCreateCanvas,
  onDeleteCanvas,
  onRenameCanvas,
  userEmail,
  onSignOut,
}: SidebarProps) {
  const [learnExpanded, setLearnExpanded] = useState(true);
  const [knowledgeExpanded, setKnowledgeExpanded] = useState(true);
  const [expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set());
  const [creatingPage, setCreatingPage] = useState(false);

  const docTree = buildDocTree(documents);

  const toggleDocExpanded = (docId: string) => {
    setExpandedDocs(prev => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId);
      else next.add(docId);
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
    setExpandedDocs(prev => new Set(prev).add(parentId));
    await onCreateDocument('Untitled', parentId);
  };

  return (
    <aside
      className={`fixed lg:sticky top-0 left-0 h-screen w-64 bg-cream-100 border-r border-cream-200 z-40 flex flex-col transition-transform duration-300 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}
    >
      {/* Logo */}
      <div className="px-5 pt-6 pb-4 flex items-center justify-between">
        <button
          onClick={onNavigateHome}
          className="flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-400 rounded-lg"
          aria-label="Go to home"
        >
          <div className="w-8 h-8 rounded-lg bg-terracotta-500 flex items-center justify-center shadow-soft flex-shrink-0">
            <BookOpen className="w-4 h-4 text-cream-50" strokeWidth={1.5} />
          </div>
          <span className="font-serif text-xl text-ink-700 tracking-tight">Athenaeum</span>
        </button>
        <button
          onClick={onCloseSidebar}
          aria-label="Close sidebar"
          className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg hover:bg-cream-200 text-ink-500 transition-colors"
        >
          <X className="w-5 h-5" strokeWidth={1.5} />
        </button>
      </div>

      {/* Scrollable nav */}
      <nav className="flex-1 px-3 py-1 overflow-y-auto scrollbar-thin" aria-label="Main navigation">

        {/* ── LEARN section ── */}
        <div className="mb-1">
          <button
            onClick={() => setLearnExpanded(!learnExpanded)}
            aria-expanded={learnExpanded}
            className="w-full flex items-center justify-between px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest text-warmgray-300 hover:text-warmgray-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-400"
          >
            <span>Learn</span>
            {learnExpanded
              ? <ChevronDown className="w-3 h-3" strokeWidth={2.5} />
              : <ChevronRight className="w-3 h-3" strokeWidth={2.5} />}
          </button>

          {learnExpanded && (
            <div className="mt-0.5 space-y-0.5">
              {/* Home */}
              <button
                onClick={onNavigateHome}
                className={navItemClass(activeView === 'home')}
                aria-current={activeView === 'home' ? 'page' : undefined}
              >
                <Home className="w-[15px] h-[15px]" strokeWidth={1.5} />
                Home
              </button>

              {/* Courses */}
              <button
                onClick={onNavigateDashboard}
                className={navItemClass(activeView === 'dashboard')}
                aria-current={activeView === 'dashboard' ? 'page' : undefined}
              >
                <GraduationCap className="w-[15px] h-[15px]" strokeWidth={1.5} />
                Courses
              </button>

              {/* Course list (indented) */}
              {coursesLoading ? (
                <div className="flex items-center gap-2 pl-8 pr-3 py-1.5 text-xs text-warmgray-400">
                  <Loader2 className="w-3 h-3 animate-spin" strokeWidth={1.5} />
                  Loading...
                </div>
              ) : (
                courses.map((course) => {
                  const isActive =
                    activeCourseId === course.id &&
                    (activeView === 'course' || activeView === 'lesson');
                  return (
                    <button
                      key={course.id}
                      onClick={() => onNavigateCourse(course.id)}
                      title={course.title}
                      className={`w-full flex items-center gap-2 pl-8 pr-3 py-1.5 rounded-lg text-[12px] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-400 focus-visible:ring-offset-1 ${
                        isActive
                          ? 'bg-cream-200 text-ink-700 font-medium'
                          : 'text-warmgray-500 hover:bg-cream-200/60 hover:text-ink-600'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${COURSE_COLOR_DOTS[course.cover_color] || COURSE_COLOR_DOTS.terracotta}`}
                        aria-hidden="true"
                      />
                      <span className="truncate">{course.title}</span>
                    </button>
                  );
                })
              )}

            </div>
          )}
        </div>

        {/* Divider */}
        <div className="h-px bg-cream-200 my-2" aria-hidden="true" />

        {/* ── KNOWLEDGE section ── */}
        <div>
          <button
            onClick={() => setKnowledgeExpanded(!knowledgeExpanded)}
            aria-expanded={knowledgeExpanded}
            className="w-full flex items-center justify-between px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest text-warmgray-300 hover:text-warmgray-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-400"
          >
            <span>Knowledge</span>
            {knowledgeExpanded
              ? <ChevronDown className="w-3 h-3" strokeWidth={2.5} />
              : <ChevronRight className="w-3 h-3" strokeWidth={2.5} />}
          </button>

          {knowledgeExpanded && (
            <div className="mt-0.5 space-y-1">
              {/* My Pages subsection */}
              <div>
                <div className="flex items-center justify-between px-2 py-1">
                  {sectionHeading('My Pages')}
                  <button
                    onClick={handleCreateRootPage}
                    disabled={creatingPage}
                    title="New page"
                    aria-label="Create new page"
                    className="w-5 h-5 rounded flex items-center justify-center text-warmgray-400 hover:text-ink-600 hover:bg-cream-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-400"
                  >
                    {creatingPage
                      ? <Loader2 className="w-3 h-3 animate-spin" strokeWidth={1.5} />
                      : <Plus className="w-3 h-3" strokeWidth={2} />}
                  </button>
                </div>

                <div className="space-y-0.5">
                  {docsLoading ? (
                    <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-warmgray-400">
                      <Loader2 className="w-3 h-3 animate-spin" strokeWidth={1.5} />
                      Loading pages...
                    </div>
                  ) : docTree.length === 0 ? (
                    <div className="px-3 py-2 text-center">
                      <p className="text-xs text-warmgray-400 mb-1.5">No pages yet</p>
                      <button
                        onClick={handleCreateRootPage}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cream-200/60 text-xs font-medium text-warmgray-500 hover:bg-cream-200 hover:text-ink-600 transition-colors"
                      >
                        <Plus className="w-3 h-3" strokeWidth={2} />
                        New page
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
              </div>

              {/* My Canvases subsection — CanvasSidebarSection owns its own header */}
              <CanvasSidebarSection
                canvases={canvases}
                canvasesLoading={canvasesLoading}
                activeCanvasId={activeCanvasId}
                onNavigateCanvas={onNavigateCanvas}
                onCreateCanvas={onCreateCanvas}
                onDeleteCanvas={onDeleteCanvas}
                onRenameCanvas={onRenameCanvas}
              />
            </div>
          )}
        </div>
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-cream-200">
        <div className="px-3 py-1.5 mb-1">
          <p className="text-xs text-warmgray-400 truncate">{userEmail}</p>
        </div>
        <button
          onClick={onSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-warmgray-500 hover:bg-brick-50 hover:text-brick-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brick-400"
        >
          <LogOut className="w-[16px] h-[16px]" strokeWidth={1.5} />
          Sign out
        </button>
      </div>
    </aside>
  );
}

// ---------- DocumentTreeItem ----------

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
    if (e.key === 'Enter') void handleRenameSubmit();
    else if (e.key === 'Escape') {
      setRenameValue(doc.title);
      setIsRenaming(false);
    }
  };

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
          onClick={(e) => { e.stopPropagation(); onToggleExpand(doc.id); }}
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
          className={`w-5 h-5 flex items-center justify-center flex-shrink-0 rounded transition-colors ${
            hasChildren ? 'hover:bg-cream-300/50 text-warmgray-400' : 'text-transparent pointer-events-none'
          }`}
        >
          {hasChildren && (
            isExpanded
              ? <ChevronDown className="w-3 h-3" strokeWidth={2} />
              : <ChevronRight className="w-3 h-3" strokeWidth={2} />
          )}
        </button>

        {/* Icon + Title */}
        <button
          onClick={() => onNavigate(doc.id)}
          onDoubleClick={(e) => { e.preventDefault(); setIsRenaming(true); }}
          className="flex-1 flex items-center gap-1.5 py-1.5 pr-1 min-w-0 text-left focus-visible:outline-none"
          aria-current={isActive ? 'page' : undefined}
        >
          <span className="text-sm flex-shrink-0" aria-hidden="true">{doc.icon || '📝'}</span>
          {isRenaming ? (
            <input
              ref={inputRef}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={() => void handleRenameSubmit()}
              onKeyDown={handleRenameKeyDown}
              onClick={(e) => e.stopPropagation()}
              aria-label="Rename page"
              className="flex-1 text-[13px] bg-cream-50 border border-cream-300 rounded px-1.5 py-0.5 text-ink-700 focus:outline-none focus:border-terracotta-300 min-w-0"
            />
          ) : (
            <span className={`text-[13px] truncate ${isActive ? 'font-medium' : ''}`}>
              {doc.title || 'Untitled'}
            </span>
          )}
        </button>

        {/* Hover actions */}
        {!isRenaming && (
          <div className="flex items-center gap-0.5 pr-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); void onCreateSubPage(doc.id); }}
              title="Add sub-page"
              aria-label="Add sub-page"
              className="w-5 h-5 rounded flex items-center justify-center text-warmgray-400 hover:text-ink-600 hover:bg-cream-300/50 transition-colors"
            >
              <FilePlus className="w-3 h-3" strokeWidth={2} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
              title="More options"
              aria-label="More options"
              aria-haspopup="true"
              aria-expanded={showMenu}
              className="w-5 h-5 rounded flex items-center justify-center text-warmgray-400 hover:text-ink-600 hover:bg-cream-300/50 transition-colors"
            >
              <MoreHorizontal className="w-3 h-3" strokeWidth={2} />
            </button>
          </div>
        )}

        {/* Dropdown */}
        {showMenu && (
          <div
            ref={menuRef}
            role="menu"
            className="absolute right-0 top-full mt-1 w-36 bg-cream-50 border border-cream-200 rounded-xl shadow-lifted z-50 py-1 animate-fade-in-soft"
          >
            <button
              role="menuitem"
              onClick={() => { setShowMenu(false); setIsRenaming(true); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-warmgray-600 hover:bg-cream-100 hover:text-ink-600 transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" strokeWidth={1.5} />
              Rename
            </button>
            <button
              role="menuitem"
              onClick={() => {
                setShowMenu(false);
                if (confirm('Delete this page? This cannot be undone.')) {
                  void onDelete(doc.id);
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

      {/* Children */}
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
