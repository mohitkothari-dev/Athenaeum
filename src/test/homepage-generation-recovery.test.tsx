import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Shared mocks (prefixed with `mock` so vi.mock can hoist closures over them).
const mockIngest = vi.fn();
const mockOnGenerate = vi.fn();
const mockNavigateCourses = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'test-token' } },
        error: null,
      }),
    },
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    })),
    removeChannel: vi.fn(),
    from: vi.fn(),
  },
}));

vi.mock('@/lib/ingestion', () => ({
  IngestionEngine: {
    ingest: (...args: unknown[]) => mockIngest(...args),
    validate: vi.fn(),
  },
}));

vi.mock('@/lib/api', () => ({
  generateNotesOrStudyGuide: vi.fn(),
}));

import { HomePage } from '@/components/HomePage';

function makeProps(overrides: Record<string, unknown> = {}) {
  return {
    userId: 'mock-user-1',
    userEmail: 'test@example.com',
    dashboardProgress: [],
    dashboardLoading: false,
    dashboardHasLoaded: true,
    documents: [],
    docsLoading: false,
    canvases: [],
    canvasesLoading: false,
    onOpenCourse: vi.fn(),
    onNavigateCourses: mockNavigateCourses,
    onGenerateCourse: mockOnGenerate,
    generatingCourse: false,
    generationError: '',
    onOpenDocument: vi.fn(),
    onCreateDocument: vi.fn(),
    onOpenCanvas: vi.fn(),
    onCreateCanvas: vi.fn(),
    ...overrides,
  };
}

describe('HomePage source-based generation recovery', () => {
  it('surfaces a generation error and offers Try again / Cancel actions instead of an infinite spinner', async () => {
    mockIngest.mockResolvedValue({
      id: 'src-youtube-1',
      user_id: 'mock-user-1',
      type: 'youtube',
      title: 'Test YouTube Video',
      status: 'ready',
      extracted_text: 'some transcript',
    });
    mockOnGenerate.mockClear();

    const { rerender } = render(<HomePage {...makeProps()} />);

    // Attach a YouTube link (same as the reported repro).
    fireEvent.click(screen.getByTitle('Attach Web or YouTube Link'));
    fireEvent.change(screen.getByPlaceholderText('Paste YouTube or website article URL...'), {
      target: { value: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Attach' }));

    // Ingest the source.
    fireEvent.click(screen.getByRole('button', { name: 'Process and generate study resources' }));
    await waitFor(() => expect(screen.getByText('Source ready')).toBeInTheDocument());

    // Click "Generate course + knowledge".
    fireEvent.click(screen.getByRole('button', { name: 'Generate course from ingested source' }));
    expect(mockOnGenerate).toHaveBeenCalledTimes(1);
    expect(mockOnGenerate.mock.calls[0][6]).toBe('src-youtube-1');

    // Simulate the backend failing: App clears the in-flight flag and sets the error,
    // while HomePage is still in the 'generating' stage.
    rerender(
      <HomePage
        {...makeProps({
          generationError: 'AI is busy right now. Please wait a moment and try again.',
          generatingCourse: false,
        })}
      />
    );

    // The user must see the error instead of a frozen spinner…
    expect(screen.getByText("Generation didn't finish")).toBeInTheDocument();
    expect(
      screen.getByText('AI is busy right now. Please wait a moment and try again.')
    ).toBeInTheDocument();

    // …and be able to retry…
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(mockOnGenerate).toHaveBeenCalledTimes(2);
    expect(mockOnGenerate.mock.calls[1][6]).toBe('src-youtube-1');

    // …or go back to the editable source view.
    fireEvent.click(screen.getByRole('button', { name: /cancel and go back/i }));
    await waitFor(() => expect(screen.getByText('Source ready')).toBeInTheDocument());
  });

  it('shows the spinner (not the error state) while generation is in flight', async () => {
    mockIngest.mockResolvedValue({
      id: 'src-youtube-2',
      user_id: 'mock-user-1',
      type: 'youtube',
      title: 'Test YouTube Video 2',
      status: 'ready',
      extracted_text: 'some transcript',
    });
    mockOnGenerate.mockClear();

    const { rerender } = render(<HomePage {...makeProps()} />);

    fireEvent.click(screen.getByTitle('Attach Web or YouTube Link'));
    fireEvent.change(screen.getByPlaceholderText('Paste YouTube or website article URL...'), {
      target: { value: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Attach' }));
    fireEvent.click(screen.getByRole('button', { name: 'Process and generate study resources' }));
    await waitFor(() => expect(screen.getByText('Source ready')).toBeInTheDocument());

    // While `generatingCourse` is true, the full GenerationScreen should be shown,
    // not the failure state.
    rerender(
      <HomePage
        {...makeProps({
          generationError: '',
          generatingCourse: true,
        })}
      />
    );
    expect(screen.getByText('Generating your course')).toBeInTheDocument();
    expect(screen.queryByText("Generation didn't finish")).not.toBeInTheDocument();
  });
});