import type { SourceIngestionProvider, IngestionInput, ProviderValidationResult } from '../types';

export function getYoutubeVideoId(url: string): string | null {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|[&]v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

export class YoutubeIngestionProvider implements SourceIngestionProvider {
  async validate(input: IngestionInput): Promise<ProviderValidationResult> {
    if (input.type !== 'youtube') {
      return { ok: false, error: 'Invalid source type for YouTube provider' };
    }
    if (!input.url) {
      return { ok: false, error: 'No URL provided' };
    }
    const videoId = getYoutubeVideoId(input.url);
    if (!videoId) {
      return { ok: false, error: 'Invalid YouTube URL. Please provide a link to a YouTube video.' };
    }
    return { ok: true };
  }

  async ingest(input: IngestionInput) {
    const videoId = getYoutubeVideoId(input.url!)!;
    return {
      title: `YouTube Video (${videoId})`,
      original_url: input.url,
      metadata: {
        youtube_video_id: videoId,
      },
    };
  }
}
