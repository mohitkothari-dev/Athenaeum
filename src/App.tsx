import { useState, useEffect, useCallback } from 'react';
import { Menu, BookOpen } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { AuthPage } from '@/components/AuthPage';
import { LandingPage } from '@/components/LandingPage';
import { HomePage } from '@/components/HomePage';
import { Dashboard } from '@/components/Dashboard';
import { CourseView } from '@/components/CourseView';
import { LessonView } from '@/components/LessonView';
import { ProgressView } from '@/components/ProgressView';
import { DocumentEditor } from '@/components/DocumentEditor';
import { Sidebar } from '@/components/Sidebar';
import { CanvasView } from '@/components/CanvasView';
import type { AppDocument, Course, CourseWithProgress } from '@/types';
import type { CanvasDocument } from '@/types/canvas';
import { supabase } from '@/lib/supabase';
import {
  fetchDocuments,
  createDocument,
  updateDocument,
  deleteDocument,
  fetchCourses,
  fetchCourseProgress,
  deleteCourse,
  loadCanvases,
  createCanvas,
  updateCanvas,
  deleteCanvas,
  generateCourse,
  type GenerationParams,
} from '@/lib/api';

type View =
  | { name: 'home' }
  | { name: 'dashboard' }
  | { name: 'course'; courseId: string }
  | { name: 'lesson'; courseId: string; lessonId: string }
  | { name: 'progress' }
  | { name: 'document'; documentId: string }
  | { name: 'canvas'; canvasId: string };

function App() {
  const { user, loading, signInWithEmail, signUpWithEmail, signInWithGoogle, signOut } = useAuth();
  const userId = user?.id;
  const [view, setView] = useState<View>({ name: 'home' });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showAuth, setShowAuth] = useState(false);

  const [documents, setDocuments] = useState<AppDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [canvases, setCanvases] = useState<CanvasDocument[]>([]);
  const [canvasesLoading, setCanvasesLoading] = useState(false);

  // Filter out courses still being generated so they don't appear in the
  // sidebar or library with a placeholder "Generating…" title.
  const readyCourses = courses.filter((c) => c.status !== 'generating');

  const [dashboardProgress, setDashboardProgress] = useState<CourseWithProgress[]>([]);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardHasLoaded, setDashboardHasLoaded] = useState(false);

  // Home page generation state (drives the inline generator on HomePage)
  const [homeGenerating, setHomeGenerating] = useState(false);
  const [homeGenerationError, setHomeGenerationError] = useState('');

  // Load documents, courses, and canvases
  useEffect(() => {
    if (userId) {
      setDocsLoading(true);
      setCoursesLoading(true);
      setCanvasesLoading(true);
      
      fetchDocuments()
        .then(setDocuments)
        .catch(err => console.error('Failed to load documents:', err))
        .finally(() => setDocsLoading(false));
      
      fetchCourses()
        .then(setCourses)
        .catch(err => console.error('Failed to load courses:', err))
        .finally(() => setCoursesLoading(false));

      loadCanvases()
        .then(setCanvases)
        .catch(err => console.error('Failed to load canvases:', err))
        .finally(() => setCanvasesLoading(false));
    } else {
      setDocuments([]);
      setCourses([]);
      setCanvases([]);
      setDashboardProgress([]);
      setDashboardHasLoaded(false);
    }
  }, [userId]);

  // Fallback polling for documents in case realtime fails
  // This ensures knowledge pages appear even if realtime subscription has issues
  useEffect(() => {
    if (!userId) return;
    
    const intervalId = setInterval(async () => {
      try {
        const docs = await fetchDocuments();
        setDocuments((prev) => {
          // Only update if there are new documents
          if (docs.length !== prev.length) {
            console.log('[Polling] Documents count changed:', prev.length, '→', docs.length);
            return docs;
          }
          // Check if any document has been updated
          const hasUpdates = docs.some((doc) => {
            const existing = prev.find((p) => p.id === doc.id);
            return existing && (
              existing.title !== doc.title ||
              existing.content !== doc.content ||
              existing.updated_at !== doc.updated_at
            );
          });
          if (hasUpdates) {
            console.log('[Polling] Documents have updates, refreshing');
            return docs;
          }
          return prev;
        });
      } catch (err) {
        console.error('[Polling] Failed to fetch documents:', err);
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(intervalId);
  }, [userId]);

  // Realtime sync for knowledge pages
  useEffect(() => {
    if (!userId) return;
    
    // Set up realtime subscription for documents table
    const channel = supabase
      .channel(`documents:user_id=eq.${userId}`, {
        config: {
          broadcast: { self: false },
          presence: { key: '' },
        },
      })
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'documents', 
          filter: `user_id=eq.${userId}` 
        },
        (payload) => {
          console.log('[Realtime] Document INSERT received:', payload.new);
          const inserted = payload.new as AppDocument;
          setDocuments((prev) => {
            // Avoid duplicates
            if (prev.some((d) => d.id === inserted.id)) {
              console.log('[Realtime] Document already exists, skipping:', inserted.id);
              return prev;
            }
            console.log('[Realtime] Adding new document to state:', inserted.id, inserted.title);
            // Add to the end to maintain creation order
            return [...prev, inserted];
          });
        },
      )
      .on(
        'postgres_changes',
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'documents', 
          filter: `user_id=eq.${userId}` 
        },
        (payload) => {
          console.log('[Realtime] Document UPDATE received:', payload.new);
          const updated = payload.new as AppDocument;
          setDocuments((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
        },
      )
      .on(
        'postgres_changes',
        { 
          event: 'DELETE', 
          schema: 'public', 
          table: 'documents', 
          filter: `user_id=eq.${userId}` 
        },
        (payload) => {
          console.log('[Realtime] Document DELETE received:', payload.old);
          const deleted = payload.old as { id: string };
          setDocuments((prev) => prev.filter((d) => d.id !== deleted.id));
        },
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] Documents subscription active');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[Realtime] Documents subscription error:', err);
        } else if (status === 'TIMED_OUT') {
          console.warn('[Realtime] Documents subscription timed out');
        } else {
          console.log('[Realtime] Documents subscription status:', status);
        }
      });

    return () => {
      console.log('[Realtime] Cleaning up documents subscription');
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  // Realtime sync for courses — picks up status transitions from the background
  // generation task (generating → ready | error) without any polling.
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`courses-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'courses', filter: `user_id=eq.${userId}` },
        (payload) => {
          const inserted = payload.new as Course;
          setCourses((prev) => (prev.some((c) => c.id === inserted.id) ? prev : [inserted, ...prev]));
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'courses', filter: `user_id=eq.${userId}` },
        (payload) => {
          const updated = payload.new as Course;
          setCourses((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const loadDashboardProgress = useCallback(async (courseList: Course[]) => {
    setDashboardLoading(true);
    try {
      const enriched: CourseWithProgress[] = await Promise.all(
        courseList.map(async (course) => {
          const { totalLessons, completedLessons, percent } = await fetchCourseProgress(course.id);
          return { course, totalLessons, completedLessons, percent };
        }),
      );
      setDashboardProgress(enriched);
    } catch (err) {
      console.error('Failed to load dashboard progress:', err);
    } finally {
      setDashboardHasLoaded(true);
      setDashboardLoading(false);
    }
  }, []);

  const handleCreateDocument = async (title: string, parentId: string | null = null, courseId: string | null = null, lessonId: string | null = null, content: string = '') => {
    try {
      const doc = await createDocument(title, parentId, courseId, lessonId, content);
      setDocuments(prev => [...prev, doc]);
      navigate({ name: 'document', documentId: doc.id });
    } catch (err) {
      console.error('Failed to create document:', err);
    }
  };

  const handleCreateDocumentSimple = async (title: string, parentId: string | null = null) => {
    return handleCreateDocument(title, parentId, null, null, '');
  };

  const handleUpdateDocument = async (id: string, updates: Partial<AppDocument>) => {
    try {
      const updated = await updateDocument(id, updates);
      setDocuments(prev => prev.map(d => d.id === id ? updated : d));
    } catch (err) {
      console.error('Failed to update document:', err);
    }
  };

  const handleDeleteDocument = async (id: string) => {
    try {
      await deleteDocument(id);
      setDocuments(prev => prev.filter(d => d.id !== id));
      navigate({ name: 'home' });
    } catch (err) {
      console.error('Failed to delete document:', err);
    }
  };

  const handleRenameDocument = async (id: string, title: string) => {
    try {
      const updated = await updateDocument(id, { title });
      setDocuments(prev => prev.map(d => d.id === id ? updated : d));
    } catch (err) {
      console.error('Failed to rename document:', err);
    }
  };

  const handleDeleteCourse = async (courseId: string) => {
    try {
      await deleteCourse(courseId);
      setCourses(prev => prev.filter(c => c.id !== courseId));
    } catch (err) {
      console.error('Failed to delete course:', err);
    }
  };

  const handleCreateCanvas = async () => {
    try {
      const canvas = await createCanvas('Untitled Canvas');
      setCanvases(prev => [canvas, ...prev]);
      navigate({ name: 'canvas', canvasId: canvas.id });
    } catch (err) {
      console.error('Failed to create canvas:', err);
    }
  };

  const handleDeleteCanvas = async (id: string) => {
    try {
      await deleteCanvas(id);
      setCanvases(prev => prev.filter(c => c.id !== id));
      if (view.name === 'canvas' && view.canvasId === id) {
        navigate({ name: 'dashboard' });
      }
    } catch (err) {
      console.error('Failed to delete canvas:', err);
    }
  };

  const handleRenameCanvas = async (id: string, title: string) => {
    try {
      const updated = await updateCanvas(id, { title });
      setCanvases(prev => prev.map(c => c.id === id ? updated : c));
    } catch (err) {
      console.error('Failed to rename canvas:', err);
    }
  };

  const handleCanvasUpdated = (updated: CanvasDocument) => {
    setCanvases(prev => prev.map(canvas => canvas.id === updated.id ? updated : canvas));
  };

  const navigate = useCallback((v: View) => {
    setView(v);
    setSidebarOpen(false);
    window.scrollTo({ top: 0 });
  }, []);

  const handleHomeGenerate = useCallback(async (
    topic: string,
    goal: string,
    knowledgeLevel: string,
    timeCommitment: string,
    difficulty: string,
    includeKnowledgePage: boolean
  ) => {
    setHomeGenerationError('');
    setHomeGenerating(true);
    const params: GenerationParams = {
      topic,
      knowledge_level: knowledgeLevel,
      goal: goal || 'Gain a solid understanding of the topic',
      time_commitment: timeCommitment,
      difficulty,
      include_knowledge_page: includeKnowledgePage,
    };
    const result = await generateCourse(params);
    setHomeGenerating(false);
    if ('error' in result) {
      setHomeGenerationError(result.error);
    } else {
      // Course + all modules/lessons are fully persisted when we get here.
      // Refresh courses list so the sidebar and library update immediately
      // without waiting for the Realtime event (which may lag or miss).
      const updatedCourses = await fetchCourses().catch(() => null);
      if (updatedCourses) {
        setCourses(updatedCourses);
        void loadDashboardProgress(updatedCourses);
      }
      navigate({ name: 'course', courseId: result.courseId });
    }
  }, [navigate, loadDashboardProgress]);

  useEffect(() => {
    if (userId && (view.name === 'dashboard' || view.name === 'home') && !coursesLoading && !dashboardHasLoaded) {
      void loadDashboardProgress(readyCourses);
    }
  }, [userId, view.name, coursesLoading, dashboardHasLoaded, loadDashboardProgress, readyCourses]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream-100">
        <div className="text-center">
          <BookOpen className="w-10 h-10 text-warmgray-300 animate-gentle-pulse mx-auto mb-3" strokeWidth={1} />
          <p className="text-sm text-warmgray-400 font-serif">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    if (showAuth) {
      return (
        <AuthPage
          onSignIn={signInWithEmail}
          onSignUp={signUpWithEmail}
          onGoogleSignIn={signInWithGoogle}
          onBack={() => setShowAuth(false)}
        />
      );
    }
    return <LandingPage onGetStarted={() => setShowAuth(true)} />;
  }

  const renderContent = () => {
    switch (view.name) {
      case 'home':
        return (
          <HomePage
            userEmail={user.email || ''}
            dashboardProgress={dashboardProgress}
            dashboardLoading={dashboardLoading}
            dashboardHasLoaded={dashboardHasLoaded}
            documents={documents}
            docsLoading={docsLoading}
            canvases={canvases}
            canvasesLoading={canvasesLoading}
            onOpenCourse={(courseId) => navigate({ name: 'course', courseId })}
            onNavigateCourses={() => navigate({ name: 'dashboard' })}
            onGenerateCourse={handleHomeGenerate}
            generatingCourse={homeGenerating}
            generationError={homeGenerationError}
            onOpenDocument={(documentId) => navigate({ name: 'document', documentId })}
            onCreateDocument={async (title) => { await handleCreateDocumentSimple(title); }}
            onOpenCanvas={(canvasId) => navigate({ name: 'canvas', canvasId })}
            onCreateCanvas={handleCreateCanvas}
          />
        );

      case 'dashboard':
        return (
          <Dashboard
            onOpenCourse={(courseId) => navigate({ name: 'course', courseId })}
            onGenerate={() => navigate({ name: 'home' })}
            onProgress={() => navigate({ name: 'progress' })}
            onDeleteCourse={handleDeleteCourse}
            courses={readyCourses}
            coursesLoading={coursesLoading}
            dashboardProgress={dashboardProgress}
            dashboardLoading={dashboardLoading}
            dashboardHasLoaded={dashboardHasLoaded}
          />
        );

      case 'course':
        return (
          <CourseView
            courseId={view.courseId}
            onOpenLesson={(courseId, lessonId) => navigate({ name: 'lesson', courseId, lessonId })}
            onOpenPage={(documentId) => navigate({ name: 'document', documentId })}
            onBack={() => navigate({ name: 'dashboard' })}
          />
        );

      case 'lesson':
        return (
          <LessonView
            courseId={view.courseId}
            lessonId={view.lessonId}
            onBack={() => navigate({ name: 'course', courseId: view.courseId })}
            onOpenLesson={(courseId, lessonId) => navigate({ name: 'lesson', courseId, lessonId })}
            onOpenPage={(documentId) => navigate({ name: 'document', documentId })}
            onPageUpdated={(doc) => {
              // Keep the in-memory documents list in sync after a save-to-page
              setDocuments((prev) =>
                prev.some((d) => d.id === doc.id)
                  ? prev.map((d) => (d.id === doc.id ? doc : d))
                  : [...prev, doc],
              );
            }}
          />
        );

      case 'progress':
        return (
          <ProgressView
            userId={user.id}
            courses={readyCourses}
            onBack={() => navigate({ name: 'dashboard' })}
            onOpenCourse={(courseId) => navigate({ name: 'course', courseId })}
          />
        );

      case 'document': {
        const currentDoc = documents.find(d => d.id === view.documentId);
        if (!currentDoc) {
          return (
            <div className="text-center py-20">
              <p className="font-serif text-xl text-ink-600">Document not found.</p>
              <button 
                onClick={() => navigate({ name: 'home' })} 
                className="mt-4 text-sm text-terracotta-600 font-medium"
              >
                Back to home
              </button>
            </div>
          );
        }
        // Resolve linked course title for the "Continue Learning" banner
        const linkedCourse = currentDoc.course_id
          ? courses.find(c => c.id === currentDoc.course_id)
          : undefined;
        return (
          <DocumentEditor
            document={currentDoc}
            onSave={(updates) => handleUpdateDocument(currentDoc.id, updates)}
            onDelete={() => handleDeleteDocument(currentDoc.id)}
            onBack={() => navigate({ name: 'home' })}
            allDocuments={documents}
            linkedCourseTitle={linkedCourse?.title}
            onOpenCourse={
              currentDoc.course_id
                ? (courseId) => navigate({ name: 'course', courseId })
                : undefined
            }
          />
        );
      }

      case 'canvas':
        return (
          <CanvasView
            canvasId={view.canvasId}
            onBack={() => navigate({ name: 'dashboard' })}
            onCanvasUpdated={handleCanvasUpdated}
          />
        );
    }
  };

  return (
    <div className="flex min-h-screen bg-cream-100">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-ink-900/30 z-30 lg:hidden animate-fade-in-soft" onClick={() => setSidebarOpen(false)} />
      )}

      <Sidebar
        sidebarOpen={sidebarOpen}
        onCloseSidebar={() => setSidebarOpen(false)}
        onNavigateHome={() => navigate({ name: 'home' })}
        onNavigateDashboard={() => navigate({ name: 'dashboard' })}
        onNavigateCourse={(courseId) => navigate({ name: 'course', courseId })}
        onNavigateDocument={(documentId) => navigate({ name: 'document', documentId })}
        onNavigateCanvas={(canvasId) => navigate({ name: 'canvas', canvasId })}
        activeView={view.name}
        activeCourseId={view.name === 'course' || view.name === 'lesson' ? view.courseId : undefined}
        activeDocumentId={view.name === 'document' ? view.documentId : undefined}
        activeCanvasId={view.name === 'canvas' ? view.canvasId : undefined}
        courses={readyCourses}
        coursesLoading={coursesLoading}
        documents={documents}
        docsLoading={docsLoading}
        canvases={canvases}
        canvasesLoading={canvasesLoading}
        onCreateDocument={handleCreateDocumentSimple}
        onDeleteDocument={handleDeleteDocument}
        onRenameDocument={handleRenameDocument}
        onCreateCanvas={handleCreateCanvas}
        onDeleteCanvas={handleDeleteCanvas}
        onRenameCanvas={handleRenameCanvas}
        userEmail={user.email || ''}
        onSignOut={signOut}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="lg:hidden sticky top-0 z-20 bg-cream-100/95 backdrop-blur-sm border-b border-cream-200 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-ink-600 hover:bg-cream-200 transition-colors"
          >
            <Menu className="w-5 h-5" strokeWidth={1.5} />
          </button>
          <span className="font-serif text-lg text-ink-700">Athenaeum</span>
        </header>

        <main className={`flex-1 min-h-0 ${view.name === 'canvas' ? 'p-0' : 'px-5 md:px-10 lg:px-14 py-8 md:py-12'}`}>{renderContent()}</main>

        {view.name !== 'canvas' && <footer className="px-5 md:px-10 lg:px-14 py-6 border-t border-cream-200">
          <p className="text-xs text-warmgray-300 text-center font-serif italic">
            Athenaeum · Your AI learning companion
          </p>
        </footer>}
      </div>
    </div>
  );
}

export default App;
