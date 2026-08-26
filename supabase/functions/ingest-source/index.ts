import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { encodeBase64 } from "jsr:@std/encoding/base64";

// ── PDF text extraction (zero-dependency, no cold-start cost) ─────────────────
//
// Implements a minimal PDF content-stream parser sufficient for text-layer PDFs
// (the vast majority of real documents — research papers, textbooks, slides, etc.)
//
// Algorithm:
//   1. Locate all content streams in the PDF byte array (between "stream\r\n"
//      and "endstream" markers).
//   2. Decompress FlateDecode (zlib/deflate) streams using Deno's built-in
//      DecompressionStream. Non-compressed streams are used as-is.
//   3. Scan decompressed bytes for PDF text operators: Tj, TJ, ', "
//      (BT/ET block delimiters are used to detect text sections but not
//      strictly required for extraction).
//   4. Decode string literals: hex strings <hex> and literal strings (text).
//   5. Clean and return. Return null if < 50 chars → signals caller to use
//      Gemini multimodal OCR fallback (scanned / image-only PDF).
//
// Limitations (acceptable for this use case):
//   - Does not handle LZW, JBIG2, or other exotic compression filters.
//   - Does not reconstruct reading order for multi-column layouts.
//   - Does not decode non-Latin character maps (CIDFonts / ToUnicode CMaps).
//     Gemini OCR fallback handles those PDFs correctly.

async function decompressDeflate(data: Uint8Array): Promise<Uint8Array> {
  // Write in chunks to avoid "failed to write whole buffer" on large streams
  const CHUNK_SIZE = 16 * 1024; // 16 KB chunks

  async function runStream(format: "deflate" | "deflate-raw"): Promise<Uint8Array> {
    const ds = new DecompressionStream(format);
    const writer = ds.writable.getWriter();
    const reader = ds.readable.getReader();

    // Write chunks, then close — do NOT await writer.write() inside the read
    // loop or the stream deadlocks when the internal buffer fills.
    const writePromise = (async () => {
      for (let offset = 0; offset < data.length; offset += CHUNK_SIZE) {
        await writer.write(data.slice(offset, offset + CHUNK_SIZE));
      }
      await writer.close();
    })();

    const chunks: Uint8Array[] = [];
    const readPromise = (async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
    })();

    await Promise.all([writePromise, readPromise]);

    const total = chunks.reduce((n, c) => n + c.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) { out.set(c, offset); offset += c.length; }
    return out;
  }

  try {
    return await runStream("deflate");
  } catch {
    // deflate-raw fallback — PDF streams sometimes omit the zlib header
    try {
      return await runStream("deflate-raw");
    } catch {
      return new Uint8Array(0);
    }
  }
}

function decodePdfHexString(hex: string): string {
  // <hex> → string, padding to even length
  const h = hex.replace(/\s/g, "").padEnd(hex.replace(/\s/g, "").length + hex.replace(/\s/g, "").length % 2, "0");
  let result = "";
  for (let i = 0; i < h.length; i += 2) {
    const code = parseInt(h.slice(i, i + 2), 16);
    if (code > 31) result += String.fromCharCode(code);
  }
  return result;
}

function decodePdfLiteralString(raw: string): string {
  // Decode standard PDF escape sequences in literal strings
  return raw
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\n")
    .replace(/\\t/g, " ")
    .replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
    .replace(/\\(.)/g, "$1");
}

function extractTextFromContentStream(stream: string): string {
  const chunks: string[] = [];
  let i = 0;

  while (i < stream.length) {
    // Tj: (text) Tj — single string
    // '  : (text) '  — move to next line and show string
    // "  : w c (text) " — set word/char spacing, show string
    // TJ: [(text) spacing (text) ...] TJ — array of strings + spacing

    // Match literal string + operator
    const litMatch = stream.slice(i).match(/^\(([^)\\]*(?:\\.[^)\\]*)*)\)\s*(Tj|'|")/);
    if (litMatch) {
      const decoded = decodePdfLiteralString(litMatch[1]);
      if (decoded.trim()) chunks.push(decoded);
      i += litMatch[0].length;
      continue;
    }

    // Match hex string + operator
    const hexMatch = stream.slice(i).match(/^<([0-9a-fA-F\s]*)>\s*(Tj|'|")/);
    if (hexMatch) {
      const decoded = decodePdfHexString(hexMatch[1]);
      if (decoded.trim()) chunks.push(decoded);
      i += hexMatch[0].length;
      continue;
    }

    // Match TJ array: [(str/hex spacing) ...] TJ
    const tjMatch = stream.slice(i).match(/^\[([^\]]*)\]\s*TJ/);
    if (tjMatch) {
      const inner = tjMatch[1];
      let j = 0;
      const parts: string[] = [];
      while (j < inner.length) {
        const lm = inner.slice(j).match(/^\(([^)\\]*(?:\\.[^)\\]*)*)\)/);
        if (lm) { parts.push(decodePdfLiteralString(lm[1])); j += lm[0].length; continue; }
        const hm = inner.slice(j).match(/^<([0-9a-fA-F\s]*)>/);
        if (hm) { parts.push(decodePdfHexString(hm[1])); j += hm[0].length; continue; }
        // Number (kerning offset) — large negative means word space
        const nm = inner.slice(j).match(/^-?\d+(\.\d+)?/);
        if (nm) {
          const offset = parseFloat(nm[0]);
          // PDF convention: negative offset > ~100 units typically means a word gap
          if (offset < -100) parts.push(" ");
          j += nm[0].length;
          continue;
        }
        j++;
      }
      const text = parts.join("").trim();
      if (text) chunks.push(text);
      i += tjMatch[0].length;
      continue;
    }

    i++;
  }

  return chunks.join(" ");
}

/**
 * Extract text from a PDF using a zero-dependency content-stream parser.
 * Works entirely on the raw Uint8Array — never re-encodes binary bytes
 * through TextEncoder (which would corrupt non-ASCII byte values).
 *
 * Returns null when the PDF has no text layer (scanned/image-only),
 * signalling the caller to fall back to Gemini multimodal OCR.
 */
async function extractPdfTextWithLibrary(fileBytes: Uint8Array): Promise<string | null> {
  try {
    // latin1 is a 1:1 byte-to-codepoint mapping — the only safe way to treat
    // raw PDF bytes as a string for regex scanning without corrupting values.
    const latin1 = new TextDecoder("latin1");
    const raw = latin1.decode(fileBytes);

    const allText: string[] = [];

    // Scan for stream...endstream blocks using byte positions so we can
    // slice the *original* fileBytes for decompression (not a re-encoded copy).
    const streamStart = new TextEncoder().encode("stream");
    const endstream  = new TextEncoder().encode("endstream");

    let pos = 0;
    while (pos < fileBytes.length) {
      // Find "stream" keyword
      const sIdx = raw.indexOf("stream", pos);
      if (sIdx === -1) break;

      // The spec says "stream" must be followed by \r\n or \n
      let dataStart = sIdx + 6; // skip "stream"
      if (fileBytes[dataStart] === 0x0d && fileBytes[dataStart + 1] === 0x0a) {
        dataStart += 2; // \r\n
      } else if (fileBytes[dataStart] === 0x0a) {
        dataStart += 1; // \n
      } else {
        // Not a real stream keyword (e.g. inside a string) — skip ahead
        pos = sIdx + 6;
        continue;
      }

      // Find matching "endstream"
      const eIdx = raw.indexOf("endstream", dataStart);
      if (eIdx === -1) break;

      // The stream byte slice — directly from the original binary buffer
      const streamBytes = fileBytes.slice(dataStart, eIdx);

      // Look back up to 600 bytes in raw for the stream dictionary to check filter
      const dictSlice = raw.slice(Math.max(0, sIdx - 600), sIdx);
      const isFlateDecode = /\/FlateDecode|\/Fl\b/.test(dictSlice);

      let content: string;
      if (isFlateDecode) {
        const decompressed = await decompressDeflate(streamBytes);
        // Decompressed content is PDF operators — safe to decode as latin1
        content = latin1.decode(decompressed);
      } else {
        content = latin1.decode(streamBytes);
      }

      // Only process streams that contain PDF text-showing operators
      if (/\bTj\b|\bTJ\b/.test(content)) {
        const text = extractTextFromContentStream(content);
        if (text.trim()) allText.push(text);
      }

      pos = eIdx + 9; // skip past "endstream"
    }

    // Suppress unused-variable warnings for the encoded keyword arrays
    void streamStart; void endstream;

    if (allText.length === 0) return null;

    const joined = allText.join("\n")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    // If text is mostly non-printable it's a CIDFont-encoded PDF — fall back to Gemini OCR
    const printableRatio = (joined.match(/[\x20-\x7E]/g) || []).length / Math.max(1, joined.length);
    if (joined.length < 50 || printableRatio < 0.6) return null;

    return joined;
  } catch (err) {
    console.warn("PDF content-stream extraction error (will fall back to Gemini):", err);
    return null;
  }
}

// ── Gemini Files API ──────────────────────────────────────────────────────────

/**
 * Upload a binary file to the Gemini Files API using multipart upload.
 * Use this instead of inline base64 for any file — it avoids 502s from
 * oversized request bodies and is the recommended path for audio and PDF.
 *
 * Returns { uri, name } where:
 *   uri  — the file_uri to use in a generateContent file_data part
 *   name — the resource name (e.g. "files/abc123") needed to delete the file
 */
async function uploadToGeminiFiles(
  apiKey: string,
  fileBytes: Uint8Array,
  mimeType: string,
  displayName: string,
): Promise<{ uri: string; name: string }> {
  const uploadUrl = `https://generativelanguage.googleapis.com/upload/v1beta/files?uploadType=multipart&key=${apiKey}`;

  // Build multipart body: JSON metadata part + binary file part
  const boundary = `----GeminiUpload${Date.now()}`;
  const metadataPart = JSON.stringify({ file: { display_name: displayName } });

  // Encode the multipart body manually — Deno has no FormData binary support
  const encoder = new TextEncoder();
  const metaBytes = encoder.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadataPart}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
  );
  const closingBytes = encoder.encode(`\r\n--${boundary}--`);

  const body = new Uint8Array(metaBytes.length + fileBytes.length + closingBytes.length);
  body.set(metaBytes, 0);
  body.set(fileBytes, metaBytes.length);
  body.set(closingBytes, metaBytes.length + fileBytes.length);

  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Type": `multipart/related; boundary=${boundary}`,
      "Content-Length": String(body.length),
    },
    body,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini Files API upload failed (${res.status}): ${errText.slice(0, 400)}`);
  }

  const json = await res.json();
  const uri: string = json?.file?.uri;
  const name: string = json?.file?.name;
  if (!uri || !name) {
    throw new Error(`Gemini Files API returned unexpected shape: ${JSON.stringify(json).slice(0, 200)}`);
  }

  // Poll until the file state is ACTIVE (Gemini processes uploads asynchronously)
  const fileReady = await waitForGeminiFileActive(apiKey, name);
  if (!fileReady) {
    throw new Error(`Gemini file ${name} did not become ACTIVE within 30s — processing timeout`);
  }

  console.log(`Gemini file uploaded: ${name} (${uri})`);
  return { uri, name };
}

/**
 * Poll the Gemini Files API until the file state is ACTIVE.
 * Gemini processes uploaded files asynchronously; generation will fail if
 * the file is still in PROCESSING state when the request is made.
 * Returns true if ACTIVE, false if timed out.
 */
async function waitForGeminiFileActive(
  apiKey: string,
  fileName: string,
  timeoutMs = 30000,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  const pollUrl = `https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${apiKey}`;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1000));
    try {
      const res = await fetch(pollUrl);
      if (!res.ok) {
        console.warn(`Gemini file poll returned ${res.status}, retrying...`);
        continue;
      }
      const json = await res.json();
      const state: string = json?.file?.state ?? json?.state ?? "";
      if (state === "ACTIVE") return true;
      if (state === "FAILED") {
        throw new Error(`Gemini file processing FAILED: ${JSON.stringify(json).slice(0, 200)}`);
      }
      // state === "PROCESSING" → continue polling
    } catch (e) {
      console.warn("Gemini file poll error:", e);
    }
  }
  return false;
}

/**
 * Delete a previously uploaded Gemini file (best-effort cleanup).
 * Files auto-expire after 48 hours but deleting immediately keeps usage low.
 */
async function deleteGeminiFile(apiKey: string, fileName: string): Promise<void> {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${apiKey}`;
    const res = await fetch(url, { method: "DELETE" });
    if (!res.ok) {
      const text = await res.text();
      console.warn(`Gemini file delete warning (${res.status}): ${text.slice(0, 200)}`);
    } else {
      console.log(`Gemini file deleted: ${fileName}`);
    }
  } catch (e) {
    console.warn(`Gemini file delete failed (non-fatal):`, e);
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, x-client-info, apikey",
};

// ── HTML Cleaning & Parsing Helpers ──────────────────────────────────────────

function cleanHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function getYoutubeVideoId(url: string): string | null {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|[&]v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

async function isRateLimitedError(msg: string, status?: number): Promise<boolean> {
  if (status === 429 || status === 403) return true;
  const lower = msg.toLowerCase();
  return lower.includes("too many requests") || lower.includes("429") || lower.includes("rate limit") || lower.includes("quota exceeded");
}

async function tryGeminiFallback(
  videoId: string,
  title: string,
  geminiApiKey?: string,
  originalErrorMsg?: string
): Promise<{ title: string; text: string }> {
  if (!geminiApiKey) {
    throw new Error(originalErrorMsg || "YouTube fetch failed and Gemini fallback is not configured (GEMINI_API_KEY missing).");
  }
  console.log(`Falling back to Gemini video transcription for ${videoId} ("${title}") — reason: ${originalErrorMsg}`);
  try {
    const geminiText = await transcribeYoutubeViaGemini(geminiApiKey, videoId, title);
    if (!geminiText || geminiText.trim().length < 20) {
      throw new Error("Gemini returned empty transcription");
    }
    return { title, text: geminiText.trim() };
  } catch (geminiErr) {
    const gMsg = geminiErr instanceof Error ? geminiErr.message : String(geminiErr);
    // If original error was rate-limit, surface that we tried Gemini too
    if (originalErrorMsg && await isRateLimitedError(originalErrorMsg)) {
      throw new Error(`YouTube is rate-limiting requests (429 Too Many Requests) and AI video transcription failed: ${gMsg}. Please retry in a minute or try a different video.`);
    }
    throw new Error(`Transcripts/captions are disabled and AI video transcription failed: ${gMsg}. The video may be private, age-restricted, or too long.`);
  }
}

async function getYoutubeTranscript(
  videoId: string,
  geminiApiKey?: string
): Promise<{ title: string; text: string }> {
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  let html: string | null = null;
  let title = `YouTube Video (${videoId})`;

  // 1. Try to fetch YouTube watch page (fails with 429 on Supabase shared IPs)
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9"
      }
    });
    if (!res.ok) {
      const errMsg = `Failed to fetch YouTube page: ${res.status} ${res.statusText}`;
      // Rate-limited → bypass scraping entirely, go straight to Gemini (file_data) which doesn't need HTML
      if (await isRateLimitedError(errMsg, res.status)) {
        return await tryGeminiFallback(videoId, title, geminiApiKey, errMsg);
      }
      throw new Error(errMsg);
    }
    html = await res.text();
    // Extract video title
    const titleMatch = html.match(/<title>(.*?)<\/title>/) ||
                       html.match(/<meta\s+name="title"\s+content="(.*?)"/) ||
                       html.match(/<meta\s+property="og:title"\s+content="(.*?)"/);
    if (titleMatch) {
      title = decodeHtmlEntities(titleMatch[1].replace(" - YouTube", ""));
    }
  } catch (fetchErr) {
    const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
    if (await isRateLimitedError(msg)) {
      return await tryGeminiFallback(videoId, title, geminiApiKey, msg);
    }
    // Network error that is not rate-limit → if we have no HTML, fallback to Gemini is still better than hard fail
    // (Gemini file_data fetches video server-side without scraping)
    if (!html && geminiApiKey) {
      console.warn(`YouTube page fetch failed ("${msg}"), trying Gemini fallback...`);
      try {
        return await tryGeminiFallback(videoId, title, geminiApiKey, msg);
      } catch {
        throw fetchErr; // preserve original if Gemini also fails with generic message
      }
    }
    throw fetchErr;
  }

  // 2. Try captions first (cheapest, fastest, most accurate for speech)
  // html is guaranteed non-null here
  try {
    const match = html!.match(/"captionTracks":\s*(\[.*?\])/);
    if (!match) throw new Error("CAPTIONS_DISABLED");

    const tracks = JSON.parse(match[1]);
    if (!tracks || tracks.length === 0) throw new Error("CAPTIONS_EMPTY");

    // Prefer English, otherwise select the first available caption track
    interface CaptionTrack { languageCode: string; baseUrl: string; }
    const track = (tracks as CaptionTrack[]).find((t) => t.languageCode === "en" || t.languageCode === "en-US") || (tracks[0] as CaptionTrack);
    const baseUrl = track.baseUrl;

    const xmlRes = await fetch(baseUrl);
    if (!xmlRes.ok) throw new Error("Failed to fetch YouTube captions XML.");
    const xml = await xmlRes.text();

    // Extract text nodes
    const textRegex = /<text[^>]*>(.*?)<\/text>/g;
    let textMatch;
    const snippets = [];
    while ((textMatch = textRegex.exec(xml)) !== null) {
      snippets.push(decodeHtmlEntities(textMatch[1]));
    }

    if (snippets.length === 0) throw new Error("CAPTIONS_NO_TEXT");

    return { title, text: snippets.join(" ") };
  } catch (captionErr) {
    const msg = captionErr instanceof Error ? captionErr.message : String(captionErr);
    const lower = msg.toLowerCase();
    const isCaptionIssue = msg === "CAPTIONS_DISABLED" || msg === "CAPTIONS_EMPTY" || msg === "CAPTIONS_NO_TEXT" || lower.includes("captions") || lower.includes("transcript");

    if (!isCaptionIssue) {
      // Could be XML fetch 429 as well → fallback to Gemini
      if (await isRateLimitedError(msg)) {
        return await tryGeminiFallback(videoId, title, geminiApiKey, msg);
      }
      throw captionErr; // genuine parse error — bubble up
    }

    // Fallback: no captions → Gemini multimodal video understanding via YouTube file_data
    return await tryGeminiFallback(videoId, title, geminiApiKey, msg);
  }
}

// ── Gemini Multimodal Caller ───────────────────────────────────────────────

type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } }
  | { file_data: { file_uri: string } };

/**
 * Call Gemini with multimodal content. Supports three delivery modes:
 *   1. geminiFileUri — pre-uploaded via Files API (preferred for PDF/audio)
 *   2. youtubeUrl   — YouTube video URL passed as file_data (Gemini fetches it)
 *   3. fileBase64   — inline base64 (only for small text/web content)
 *
 * Retry policy:
 *   - 429 (rate limit): 15s base backoff + 0–5s jitter (free tier RPM is very low)
 *   - 502/503/5xx (transient): exponential backoff 1.5s → 3s → 8s + jitter
 *   - Per model: 3 attempts, then fall through to next model
 */
async function callGeminiMultimodal(
  apiKey: string,
  prompt: string,
  fileBase64?: string,
  mimeType?: string,
  youtubeUrl?: string,
  geminiFileUri?: string,
): Promise<string> {
  const models = ["gemini-3.6-flash", "gemini-3.5-flash"];
  let lastErr = "";

  for (const model of models) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const parts: GeminiPart[] = [];
      if (geminiFileUri) {
        // Files API upload — best path for PDF/audio (no inline size limit)
        parts.push({ file_data: { file_uri: geminiFileUri } });
      } else if (youtubeUrl) {
        // YouTube URLs are passed as file_data — Gemini fetches video directly
        parts.push({ file_data: { file_uri: youtubeUrl } });
      } else if (fileBase64 && mimeType) {
        // Inline base64 — only used for small web/text content
        parts.push({ inlineData: { mimeType, data: fileBase64 } });
      }
      parts.push({ text: prompt });

      // Token-optimized config for YouTube: low media resolution saves ~66% vision tokens
      const generationConfig: Record<string, unknown> = { temperature: 0.2 };
      if (youtubeUrl) {
        generationConfig.media_resolution = "MEDIA_RESOLUTION_LOW";
      }

      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts }], generationConfig }),
        });

        if (!res.ok) {
          const text = await res.text();
          const status = res.status;
          if (attempt < 2) {
            // 429: free tier RPM is very low — back off 15s + jitter
            const backoff = status === 429
              ? 15000 + Math.random() * 5000
              : Math.min(8000, 1500 * Math.pow(2, attempt)) + Math.random() * 500;
            console.warn(`Gemini ${status} on ${model} attempt ${attempt + 1}/3, retrying in ${Math.round(backoff)}ms: ${text.slice(0, 300)}`);
            await new Promise((r) => setTimeout(r, backoff));
            continue;
          }
          throw new Error(`Gemini status ${status}: ${text}`);
        }

        const json = await res.json();
        const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error("Empty response from Gemini candidate");
        return text;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        const is429 = msg.includes("429") || msg.toLowerCase().includes("rate limit") || msg.toLowerCase().includes("quota");
        const isTransient = is429 || msg.includes("502") || msg.includes("503") || msg.toLowerCase().includes("gateway");
        if (isTransient && attempt < 2) {
          const backoff = is429
            ? 15000 + Math.random() * 5000
            : Math.min(8000, 1500 * Math.pow(2, attempt)) + Math.random() * 500;
          console.warn(`Transient error on ${model} attempt ${attempt + 1}/3, retrying in ${Math.round(backoff)}ms:`, e);
          await new Promise((r) => setTimeout(r, backoff));
          lastErr = msg;
          continue;
        }
        console.warn(`Failed with ${model} (attempt ${attempt + 1}):`, e);
        lastErr = msg;
        break;
      }
    }
  }

  throw new Error(`Gemini Multimodal processing failed: ${lastErr}`);
}

async function transcribeYoutubeViaGemini(
  apiKey: string,
  videoId: string,
  titleHint: string
): Promise<string> {
  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
  // Best token/quality prompt: verbatim speech first (primary learning signal),
  // then concise visual annotations only when they add info not in speech.
  // This keeps output tokens tight vs full frame-by-frame description.
  const prompt = `You are a lecture transcription engine for video: "${titleHint}" (${youtubeUrl}).

Task: Transcribe the spoken content of this YouTube video verbatim and completely.
- Preserve all spoken words, technical terms, numbers, and code mentioned verbally.
- Structure into logical paragraphs with headings inferred from topic shifts.
- If the video shows slides, diagrams, code, or on-screen text that is NOT spoken, add a brief annotation on its own line as [Visual: <concise description>] — do NOT hallucinate, only include what is visibly present and pedagogically relevant.
- Do not add summaries, translations, opinions, or external knowledge.
- Output ONLY the transcription (+ visual annotations where needed), no preamble.`;

  return await callGeminiMultimodal(apiKey, prompt, undefined, undefined, youtubeUrl);
}

// ── Main Server ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: "Server configuration missing" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!geminiApiKey) {
      return new Response(JSON.stringify({ error: "GEMINI_API_KEY secret is not set" }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate Auth JWT
    const jwt = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Invalid credentials" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    // Parse Body
    const { sourceId } = await req.json();
    if (!sourceId) {
      return new Response(JSON.stringify({ error: "Missing sourceId" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load source details
    const { data: source, error: sourceErr } = await supabase
      .from("sources")
      .select("*")
      .eq("id", sourceId)
      .single();

    if (sourceErr || !source) {
      return new Response(JSON.stringify({ error: "Source not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (source.user_id !== userId) {
      return new Response(JSON.stringify({ error: "Access denied" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark as extracting immediately so polling UI sees progress, then do
    // heavy work (Gemini video transcription, PDF parsing) in background via
    // EdgeRuntime.waitUntil to avoid gateway 504 (60s timeout).
    await supabase.from("sources").update({ status: "extracting" }).eq("id", sourceId);

    const extractionTask = (async () => {
      try {
        let extractedText = "";
        let finalTitle = source.title as string;

        if (source.type === "youtube") {
          const videoId = getYoutubeVideoId(source.original_url);
          if (!videoId) throw new Error("Could not parse YouTube video ID.");
          const { title, text } = await getYoutubeTranscript(videoId, geminiApiKey);
          extractedText = text;
          finalTitle = title;
        } else if (source.type === "web") {
          const res = await fetch(source.original_url, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            }
          });
          if (!res.ok) throw new Error(`Failed to fetch URL: ${res.statusText}`);
          const rawHtml = await res.text();
          const cleanHtmlContent = cleanHtml(rawHtml);

          // Call Gemini to parse and clean primary HTML content
          const prompt = "You are a webpage content extractor. Extract only the primary article/content text from the following HTML. Convert it to clean, readable Markdown format, retaining headings and lists where appropriate. Remove all navigation links, footers, advertisements, sidebars, and HTML/style/script tags. Return ONLY the clean extracted article content. Do not include any greeting or explanation.";
          extractedText = await callGeminiMultimodal(geminiApiKey, prompt, encodeBase64(cleanHtmlContent), "text/plain");

          // Extract title if possible
          const titleMatch = rawHtml.match(/<title>(.*?)<\/title>/);
          if (titleMatch) {
            finalTitle = decodeHtmlEntities(titleMatch[1]).trim();
          }
        } else if (source.type === "pdf") {
          // Download file from Storage
          const { data: fileData, error: fileErr } = await supabase.storage
            .from("sources")
            .download(source.storage_path);
          if (fileErr || !fileData) throw new Error(`Failed to download PDF from storage: ${fileErr?.message}`);

          const arrayBuffer = await fileData.arrayBuffer();
          const fileBytes = new Uint8Array(arrayBuffer);

          // Primary path: library extraction — zero API cost, instant, no rate limits.
          // Works for any PDF with a text layer (the vast majority of real documents).
          const libraryText = await extractPdfTextWithLibrary(fileBytes);

          if (libraryText) {
            console.log(`PDF extracted via library (${libraryText.length} chars)`);
            extractedText = libraryText;
          } else {
            // Fallback: scanned / image-only PDF — use Gemini multimodal OCR.
            console.log("PDF has no text layer — falling back to Gemini OCR via Files API");
            const { uri: geminiFileUri, name: geminiFileName } = await uploadToGeminiFiles(
              geminiApiKey,
              fileBytes,
              "application/pdf",
              source.title || "document.pdf",
            );
            try {
              const prompt = "This is a scanned PDF document. Please perform OCR and extract all the primary textual learning content. Organize the content in a structured, readable Markdown format, maintaining heading hierarchies, list structures, and code blocks. Ignore headers, footers, and page numbers. Output only the extracted Markdown content.";
              extractedText = await callGeminiMultimodal(geminiApiKey, prompt, undefined, undefined, undefined, geminiFileUri);
            } finally {
              await deleteGeminiFile(geminiApiKey, geminiFileName);
            }
          }
        } else if (source.type === "audio") {
          const { data: fileData, error: fileErr } = await supabase.storage
            .from("sources")
            .download(source.storage_path);
          if (fileErr || !fileData) throw new Error(`Failed to download audio from storage: ${fileErr?.message}`);

          const arrayBuffer = await fileData.arrayBuffer();
          const fileBytes = new Uint8Array(arrayBuffer);
          const mimeType = source.metadata?.mime_type || "audio/mpeg";

          // Upload to Gemini Files API — avoids inline base64 502s for audio
          const { uri: geminiFileUri, name: geminiFileName } = await uploadToGeminiFiles(
            geminiApiKey,
            fileBytes,
            mimeType,
            source.title || "audio",
          );

          try {
            const prompt = "Please transcribe this audio recording completely and accurately. Structure it into logical paragraphs. Do not add summaries, translations, or commentary. Output only the transcription text.";
            extractedText = await callGeminiMultimodal(geminiApiKey, prompt, undefined, undefined, undefined, geminiFileUri);
          } finally {
            // Always clean up the Gemini file — extracted text is saved to DB below
            await deleteGeminiFile(geminiApiKey, geminiFileName);
          }
        }

        // Complete extraction and mark as ready
        try {
          await supabase
            .from("sources")
            .update({
              status: "ready",
              title: finalTitle,
              extracted_text: extractedText,
              updated_at: new Date().toISOString(),
            })
            .eq("id", sourceId);
          console.log(`Source ${sourceId} marked ready (${extractedText.length} chars extracted)`);
        } catch (dbErr) {
          console.error("CRITICAL: failed to write ready status to DB:", dbErr);
          throw dbErr; // re-throw so the outer catch marks it as error
        }
      } catch (err: unknown) {
        console.error("Extraction error:", err);
        const errMsg = err instanceof Error ? err.message : "Unknown error during text extraction";
        // Wrap in its own try/catch — a DB failure here must never leave
        // the source stuck at 'extracting' with no user-visible feedback.
        try {
          await supabase
            .from("sources")
            .update({
              status: "error",
              metadata: {
                ...(typeof source.metadata === "object" && source.metadata !== null ? source.metadata : {}),
                error: errMsg,
              },
              updated_at: new Date().toISOString(),
            })
            .eq("id", sourceId);
        } catch (dbErr) {
          console.error("CRITICAL: failed to write error status to DB — source may be stuck at 'extracting':", dbErr);
        }
      }
    })();

    const edgeRuntime = (globalThis as unknown as { EdgeRuntime?: { waitUntil: (p: Promise<unknown>) => void } }).EdgeRuntime;
    if (edgeRuntime) {
      edgeRuntime.waitUntil(extractionTask);
      return new Response(JSON.stringify({ success: true, background: true }), {
        status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Fallback: no EdgeRuntime (local dev) — await inline
    await extractionTask;
    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: unknown) {
    console.error("Unexpected handler error:", err);
    const errMsg = err instanceof Error ? err.message : "Unexpected error occurred";
    return new Response(JSON.stringify({ error: errMsg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
