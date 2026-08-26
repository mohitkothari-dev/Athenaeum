import type { SourceIngestionProvider, IngestionInput, ProviderValidationResult } from '../types';
import { supabase } from '@/lib/supabase';

export class PdfIngestionProvider implements SourceIngestionProvider {
  async validate(input: IngestionInput): Promise<ProviderValidationResult> {
    if (input.type !== 'pdf') {
      return { ok: false, error: 'Invalid source type for PDF provider' };
    }
    if (!input.file) {
      return { ok: false, error: 'No file provided' };
    }
    if (input.file.size > 10 * 1024 * 1024) {
      return { ok: false, error: 'PDF file size must be less than 10MB' };
    }
    // Relaxed MIME type validation to handle system variations, check extension too
    const isPdfMime = input.file.type === 'application/pdf';
    const isPdfExt = input.file.name.toLowerCase().endsWith('.pdf');
    if (!isPdfMime && !isPdfExt) {
      return { ok: false, error: 'File must be a PDF document' };
    }
    return { ok: true };
  }

  async ingest(input: IngestionInput, userId: string) {
    const file = input.file!;
    const fileId = crypto.randomUUID();
    // Strip non-ASCII characters from filename to ensure clean storage paths
    // eslint-disable-next-line no-control-regex
    const cleanFileName = file.name.replace(/[^\x00-\x7F]/gu, '');
    const storagePath = `${userId}/${fileId}-${cleanFileName}`;

    const { error } = await supabase.storage
      .from('sources')
      .upload(storagePath, file);

    if (error) {
      throw new Error(`Failed to upload PDF: ${error.message}`);
    }

    return {
      title: file.name.replace(/\.pdf$/i, ''),
      storage_path: storagePath,
      metadata: {
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type || 'application/pdf',
      },
    };
  }
}
