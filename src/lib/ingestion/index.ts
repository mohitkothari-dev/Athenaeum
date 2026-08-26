import type { Source, SourceType } from '@/types';
import type { IngestionInput, SourceIngestionProvider } from './types';
export type { IngestionInput, SourceIngestionProvider } from './types';
import { PdfIngestionProvider } from './providers/pdf';
import { YoutubeIngestionProvider } from './providers/youtube';
import { AudioIngestionProvider } from './providers/audio';
import { WebIngestionProvider } from './providers/web';
import { supabase } from '@/lib/supabase';

const providers: Record<SourceType, SourceIngestionProvider> = {
  pdf: new PdfIngestionProvider(),
  youtube: new YoutubeIngestionProvider(),
  audio: new AudioIngestionProvider(),
  web: new WebIngestionProvider(),
};

export async function checkDuplicateSource(
  input: IngestionInput,
  userId: string
): Promise<Source | null> {
  if (input.type === 'youtube' || input.type === 'web') {
    if (!input.url) return null;
    const { data, error } = await supabase
      .from('sources')
      .select('*')
      .eq('user_id', userId)
      .eq('original_url', input.url)
      .eq('status', 'ready')
      .maybeSingle();

    if (error) {
      console.warn('Failed to check duplicate URL source:', error);
      return null;
    }
    return data as Source | null;
  } else if (input.type === 'pdf' || input.type === 'audio') {
    if (!input.file) return null;
    const { data, error } = await supabase
      .from('sources')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'ready')
      .eq('metadata->>file_name', input.file.name)
      .eq('metadata->>file_size', input.file.size.toString())
      .maybeSingle();

    if (error) {
      console.warn('Failed to check duplicate file source:', error);
      return null;
    }
    return data as Source | null;
  }
  return null;
}

export class IngestionEngine {
  static getProvider(type: SourceType): SourceIngestionProvider {
    const provider = providers[type];
    if (!provider) {
      throw new Error(`Unsupported source type: ${type}`);
    }
    return provider;
  }

  static async validate(input: IngestionInput): Promise<{ ok: boolean; error?: string }> {
    try {
      const provider = this.getProvider(input.type);
      return await provider.validate(input);
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : 'Validation failed' };
    }
  }

  static async ingest(
    input: IngestionInput,
    userId: string,
    onStatusChange?: (status: string) => void
  ): Promise<Source> {
    // 1. Check for duplicates
    onStatusChange?.('Checking for duplicates...');
    const duplicate = await checkDuplicateSource(input, userId);
    if (duplicate) {
      onStatusChange?.('Found existing ready source!');
      return duplicate;
    }

    // 2. Validate
    const validation = await this.validate(input);
    if (!validation.ok) {
      throw new Error(validation.error || 'Validation failed');
    }

    const provider = this.getProvider(input.type);

    // 3. Create initial database row
    const isFile = input.type === 'pdf' || input.type === 'audio';
    const initialStatus = isFile ? 'uploading' : 'pending';
    onStatusChange?.(isFile ? 'Uploading file...' : 'Registering source...');

    const { data: sourceRow, error: insertError } = await supabase
      .from('sources')
      .insert({
        user_id: userId,
        type: input.type,
        title: isFile ? input.file!.name : input.url!,
        status: initialStatus,
        original_url: input.url || null,
        metadata: isFile
          ? { file_name: input.file!.name, file_size: input.file!.size }
          : {},
      })
      .select('*')
      .single();

    if (insertError || !sourceRow) {
      throw new Error(`Failed to initialize source: ${insertError?.message || 'DB error'}`);
    }

    let source = sourceRow as Source;

    try {
      // 4. Ingest (Uploads to storage, etc.)
      const ingestionResult = await provider.ingest(input, userId);

      // Update source status to pending (meaning it is uploaded and ready for extraction)
      onStatusChange?.('Extracting text and metadata...');
      const { data: updatedRow, error: updateError } = await supabase
        .from('sources')
        .update({
          title: ingestionResult.title,
          storage_path: ingestionResult.storage_path || null,
          metadata: {
            ...source.metadata,
            ...ingestionResult.metadata,
          },
          status: 'pending',
        })
        .eq('id', source.id)
        .select('*')
        .single();

      if (updateError || !updatedRow) {
        throw new Error(`Failed to update source details: ${updateError?.message}`);
      }

      source = updatedRow as Source;

      // 5. Trigger Deno Edge Function asynchronously
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      // Invoke the 'ingest-source' Edge Function — now returns 202 immediately
      // via EdgeRuntime.waitUntil and processes transcription in background,
      // avoiding gateway 504 on long YouTube/Gemini tasks. Realtime+polling
      // in HomePage.tsx will pick up the status change.
      supabase.functions.invoke('ingest-source', {
        body: { sourceId: source.id },
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }).then(({ error }) => {
        if (error) {
          // 504 is now unexpected (we return 202), but log anyway; polling will recover.
          // The "(index):1 ... message channel closed" error is a Chrome extension artifact — ignore.
          const msg = (error as { message?: string })?.message || String(error);
          if (msg.includes('504') || msg.includes('message channel closed')) {
            console.warn('Ingest invoke warning (non-fatal, polling will recover):', msg);
          } else {
            console.error('Asynchronous ingest-source invocation failed:', error);
          }
        }
      }).catch(err => {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('message channel closed')) return;
        console.error('Asynchronous ingest-source invocation failed:', err);
      });

      return source;
    } catch (err: unknown) {
      // Mark as error
      const errMsg = err instanceof Error ? err.message : String(err);
      await supabase
        .from('sources')
        .update({
          status: 'error',
          metadata: {
            ...source.metadata,
            error: errMsg,
          },
        })
        .eq('id', source.id);

      throw new Error(errMsg);
    }
  }
}
