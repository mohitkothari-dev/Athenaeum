import { useState, useEffect, useCallback } from 'react';
import { Menu, BookOpen, Plus, LogOut, X, Home } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { AuthPage } from '@/components/AuthPage';
import { LandingPage } from '@/components/LandingPage';
import { Dashboard } from '@/components/Dashboard';
import { CourseGenerator } from '@/components/CourseGenerator';
import { CourseView } from '@/components/CourseView';
import { LessonView } from '@/components/LessonView';
import { ProgressView } from '@/components/ProgressView';

type View =
  | { name: 'dashboard' }
  | { name: 'generate' }
  | { name: 'course'; courseId: string }
  | { name: 'lesson'; courseId: string; lessonId: string }
  | { name: 'progress' };

function App() {
  const { user, loading, signInWithEmail, signUpWithEmail, signInWithGoogle, signOut } = useAuth();
  const [view, setView] = useState<View>({ name: 'dashboard' });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const navigate = useCallback((v: View) => {
    setView(v);
    setSidebarOpen(false);
    window.scrollTo({ top: 0 });
  }, []);

  useEffect(() => {
    if (user && view.name === 'dashboard') {
      setRefreshKey((k) => k + 1);
    }
  }, [user, view.name]);

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
    return <AuthPage onSignIn={signInWithEmail} onSignUp={signUpWithEmail} onGoogleSignIn={signInWithGoogle} />;
  }

  const renderContent = () => {
    switch (view.name) {
      case 'dashboard':
        return (
          <Dashboard
            userId={user.id}
            onOpenCourse={(courseId) => navigate({ name: 'course', courseId })}
            onGenerate={() => navigate({ name: 'generate' })}
            onProgress={() => navigate({ name: 'progress' })}
            refreshKey={refreshKey}
          />
        );

      case 'generate':
        return (
          <CourseGenerator
            onGenerated={(courseId) => navigate({ name: 'course', courseId })}
            onCancel={() => navigate({ name: 'dashboard' })}
          />
        );

      case 'course':
        return (
          <CourseView
            courseId={view.courseId}
            onOpenLesson={(courseId, lessonId) => navigate({ name: 'lesson', courseId, lessonId })}
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
          />
        );

      case 'progress':
        return (
          <ProgressView
            userId={user.id}
            onBack={() => navigate({ name: 'dashboard' })}
            onOpenCourse={(courseId) => navigate({ name: 'course', courseId })}
          />
        );
    }
  };

  const navItems: { label: string; icon: typeof Home; view: View }[] = [
    { label: 'Library', icon: Home, view: { name: 'dashboard' } },
    { label: 'New Course', icon: Plus, view: { name: 'generate' } },
  ];

  const isNavActive = (item: (typeof navItems)[number]) => {
    if (item.view.name === 'dashboard') {
      return view.name === 'dashboard' || view.name === 'course' || view.name === 'lesson';
    }
    return view.name === item.view.name;
  };

  return (
    <div className="flex min-h-screen bg-cream-100">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-ink-900/30 z-30 lg:hidden animate-fade-in-soft" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={`fixed lg:sticky top-0 left-0 h-screen w-72 bg-cream-100 border-r border-cream-200 z-40 flex flex-col transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="px-6 pt-7 pb-6 flex items-center justify-between">
          <button onClick={() => navigate({ name: 'dashboard' })} className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-terracotta-500 flex items-center justify-center shadow-soft">
              <BookOpen className="w-5 h-5 text-cream-50" strokeWidth={1.5} />
            </div>
            <span className="font-serif text-xl text-ink-700 tracking-tight">Athenaeum</span>
          </button>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg hover:bg-cream-200 text-ink-500"
          >
            <X className="w-5 h-5" strokeWidth={1.5} />
          </button>
        </div>

        <nav className="flex-1 px-3 py-2 space-y-0.5">
          {navItems.map((item) => {
            const active = isNavActive(item);
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                onClick={() => navigate(item.view)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  active ? 'bg-cream-200 text-ink-700' : 'text-warmgray-500 hover:bg-cream-200/60 hover:text-ink-600'
                }`}
              >
                <Icon className="w-[18px] h-[18px]" strokeWidth={1.5} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="px-3 py-3 border-t border-cream-200">
          <div className="px-3 py-2 mb-1">
            <p className="text-xs text-warmgray-400 truncate">{user.email}</p>
          </div>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-warmgray-500 hover:bg-brick-50 hover:text-brick-500 transition-colors"
          >
            <LogOut className="w-[18px] h-[18px]" strokeWidth={1.5} />
            Sign out
          </button>
        </div>
      </aside>

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

        <main className="flex-1 px-5 md:px-10 lg:px-14 py-8 md:py-12">{renderContent()}</main>

        <footer className="px-5 md:px-10 lg:px-14 py-6 border-t border-cream-200">
          <p className="text-xs text-warmgray-300 text-center font-serif italic">
            Athenaeum · Your AI learning companion
          </p>
        </footer>
      </div>
    </div>
  );
}

export default App;
