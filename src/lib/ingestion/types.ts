import type { SourceType } from '@/types';

export interface ProviderValidationResult {
  ok: boolean;
  error?: string;
}

export interface IngestionInput {
  type: SourceType;
  file?: File;
  url?: string;
}

export interface SourceIngestionProvider {
  validate(input: IngestionInput): Promise<ProviderValidationResult>;
  ingest(input: IngestionInput, userId: string): Promise<{
    title: string;
    original_url?: string;
    storage_path?: string;
    metadata: Record<string, unknown>;
  }>;
}
