import type { SourceIngestionProvider, IngestionInput, ProviderValidationResult } from '../types';
import { supabase } from '@/lib/supabase';

export class AudioIngestionProvider implements SourceIngestionProvider {
  async validate(input: IngestionInput): Promise<ProviderValidationResult> {
    if (input.type !== 'audio') {
      return { ok: false, error: 'Invalid source type for Audio provider' };
    }
    if (!input.file) {
      return { ok: false, error: 'No file provided' };
    }
    if (input.file.size > 10 * 1024 * 1024) {
      return { ok: false, error: 'Audio file size must be less than 10MB' };
    }
    
    const allowedExtensions = ['.mp3', '.wav', '.ogg', '.m4a', '.mpeg', '.mp4', '.aac'];
    const isAudioMime = input.file.type.startsWith('audio/') || input.file.type === 'video/mp4';
    const isAudioExt = allowedExtensions.some(ext => input.file!.name.toLowerCase().endsWith(ext));
    
    if (!isAudioMime && !isAudioExt) {
      return { ok: false, error: 'Unsupported audio format. Supported formats: MP3, WAV, OGG, M4A' };
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
      throw new Error(`Failed to upload Audio: ${error.message}`);
    }

    return {
      title: file.name.replace(/\.[^/.]+$/, ''), // strip extension
      storage_path: storagePath,
      metadata: {
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type || 'audio/mpeg',
      },
    };
  }
}
