/**
 * generate-notes edge function
 *
 * Handles two actions:
 *  1. "save_to_page"  — takes user-selected lesson text and appends it to the
 *                       linked knowledge page under the appropriate section.
 *  2. "generate_section" — AI-generates a named section (e.g. "Key Concepts",
 *                          "Examples") from lesson metadata and appends it to
 *                          the knowledge page. Never overwrites existing content.
 *
 * In both cases the function:
 *  - Validates the JWT
 *  - Verifies the document belongs to the authenticated user
 *  - Appends content (never replaces) so user edits are always preserved
 *  - Returns the full updated document content
 */

import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, x-client-info, apikey",
};

const GEMINI_MODEL = "gemini-1.5-flash";

interface SaveToPageRequest {
  action: "save_to_page";
  documentId: string;       // knowledge page id
  selectedText: string;     // user-selected content from lesson
  sectionHint: string;      // "My Notes" | "Key Concepts" | "Examples" | etc.
  sourceLabel: string;      // e.g. "Docker Fundamentals → Module 3 → Docker Networking"
}

interface GenerateSectionRequest {
  action: "generate_section";
  documentId: string;       // knowledge page id
  sectionName: string;      // which section to generate
  lessonTitle: string;
  lessonSubtitle: string;
  keyTakeaways: string[];
  learningObjectives: string[];
  courseTitle: string;
}

type RequestBody = SaveToPageRequest | GenerateSectionRequest;

async function callGemini(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: 0.5,
        maxOutputTokens: 1024,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Gemini error:", res.status, err);
    throw new Error(`Gemini error ${res.status}`);
  }

  const data = await res.json();
  const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!text) throw new Error("Gemini returned empty response");
  return text.trim();
}

/**
 * Append `newBlock` under a Markdown section heading inside `content`.
 * If the heading doesn't exist, the block is appended at the end.
 * Never removes or alters lines that already exist.
 */
function appendUnderSection(
  content: string,
  sectionHeading: string,
  newBlock: string,
): string {
  const lines = content.split("\n");
  const headingLine = `## ${sectionHeading}`;

  // Find the section
  const idx = lines.findIndex((l) => l.trim() === headingLine);

  if (idx === -1) {
    // Section not found — append at end with the heading
    const tail = content.trimEnd();
    return `${tail}\n\n${headingLine}\n${newBlock}\n`;
  }

  // Find the next ## heading (or EOF) to know where the section ends
  let insertAt = lines.length;
  for (let i = idx + 1; i < lines.length; i++) {
    if (lines[i].startsWith("## ")) {
      insertAt = i;
      break;
    }
  }

  // Insert before the next heading (or at EOF)
  const newLines = [
    ...lines.slice(0, insertAt),
    newBlock,
    "",
    ...lines.slice(insertAt),
  ];
  return newLines.join("\n");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");

    if (!supabaseUrl || !supabaseServiceKey || !geminiApiKey) {
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate JWT
    const jwt = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Invalid authentication" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const body: RequestBody = await req.json();

    // Fetch current document (RLS bypassed — we verify ownership manually)
    const { data: docRow, error: docError } = await supabase
      .from("documents")
      .select("id, user_id, content, title")
      .eq("id", body.documentId)
      .maybeSingle();

    if (docError || !docRow) {
      return new Response(JSON.stringify({ error: "Document not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ownership check — service role bypasses RLS so we do it manually
    if ((docRow as Record<string, unknown>).user_id !== userId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const currentContent: string = ((docRow as Record<string, unknown>).content as string) || "";
    let updatedContent = currentContent;

    if (body.action === "save_to_page") {
      // ── Save selected text to a section ──────────────────────────────────
      const { selectedText, sectionHint, sourceLabel } = body as SaveToPageRequest;

      if (!selectedText.trim()) {
        return new Response(JSON.stringify({ error: "No text selected" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Format the block with source attribution
      const timestamp = new Date().toLocaleDateString("en-US", {
        month: "short", day: "numeric", year: "numeric",
      });
      const block =
        `> ${selectedText.trim()}\n` +
        `> *Source: ${sourceLabel} · ${timestamp}*`;

      updatedContent = appendUnderSection(currentContent, sectionHint, block);

    } else if (body.action === "generate_section") {
      // ── AI-generate a section and append it ──────────────────────────────
      const {
        sectionName,
        lessonTitle,
        lessonSubtitle,
        keyTakeaways,
        learningObjectives,
        courseTitle,
      } = body as GenerateSectionRequest;

      const systemPrompt =
        "You are a concise knowledge-base author. Write plain Markdown bullet points only — " +
        "no introduction, no conclusion, no headings. Each bullet on its own line starting with '- '.";

      const userPrompt =
        `Course: ${courseTitle}\n` +
        `Lesson: ${lessonTitle} — ${lessonSubtitle}\n` +
        `Learning objectives: ${learningObjectives.join("; ")}\n` +
        `Key takeaways: ${keyTakeaways.join("; ")}\n\n` +
        `Generate 4-6 concise Markdown bullet points for the "${sectionName}" section ` +
        `of the student's personal knowledge page. Be specific and actionable. ` +
        `Do not repeat the learning objectives verbatim. Plain Markdown only.`;

      const generated = await callGemini(geminiApiKey, systemPrompt, userPrompt);

      // Strip any accidental heading lines the model might have added
      const cleanedLines = generated
        .split("\n")
        .filter((l) => !l.startsWith("#"))
        .join("\n")
        .trim();

      // Add attribution comment
      const block =
        `<!-- AI-generated from: ${lessonTitle} -->\n` +
        cleanedLines;

      updatedContent = appendUnderSection(currentContent, sectionName, block);
    } else {
      return new Response(JSON.stringify({ error: "Unknown action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Persist updated content
    const { data: updatedDoc, error: updateError } = await supabase
      .from("documents")
      .update({
        content: updatedContent,
        updated_at: new Date().toISOString(),
      })
      .eq("id", body.documentId)
      .select("*")
      .single();

    if (updateError) {
      console.error("Failed to update document:", updateError);
      return new Response(JSON.stringify({ error: "Failed to save to page" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ document: updatedDoc }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "An unexpected error occurred" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
