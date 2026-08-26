import type { SourceIngestionProvider, IngestionInput, ProviderValidationResult } from '../types';

export class WebIngestionProvider implements SourceIngestionProvider {
  async validate(input: IngestionInput): Promise<ProviderValidationResult> {
    if (input.type !== 'web') {
      return { ok: false, error: 'Invalid source type for Web URL provider' };
    }
    if (!input.url) {
      return { ok: false, error: 'No URL provided' };
    }
    try {
      const parsed = new URL(input.url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return { ok: false, error: 'URL must use HTTP or HTTPS protocol' };
      }
    } catch {
      return { ok: false, error: 'Invalid Web URL format' };
    }
    return { ok: true };
  }

  async ingest(input: IngestionInput) {
    let host = 'Web Page';
    try {
      host = new URL(input.url!).hostname;
    } catch {
      // ignore
    }

    return {
      title: `${host} Article`,
      original_url: input.url,
      metadata: {
        domain: host,
      },
    };
  }
}
