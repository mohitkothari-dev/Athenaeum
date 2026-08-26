/**
 * generate-notes edge function
 *
 * Handles one action:
 *  "save_to_page" — takes user-selected lesson text and appends it to the
 *                   linked knowledge page under the appropriate section.
 *
 * In doing so the function:
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

interface GenerateNotesRequest {
  action: "save_to_page" | "generate_notes_from_source" | "generate_study_guide_from_source";
  documentId?: string;       // knowledge page id
  selectedText?: string;     // user-selected content from lesson
  sectionHint?: string;      // "My Notes" | "Key Concepts" | "Examples" | etc.
  sourceLabel?: string;      // e.g. "Docker Fundamentals → Module 3 → Docker Networking"
  sourceId?: string;         // grounding source id
}

async function callGemini(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const models = ["gemini-3.6-flash", "gemini-3.5-flash"];
  let lastErr = "";

  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts: [{ text: userPrompt }] }]
        })
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Gemini status ${res.status}: ${text}`);
      }

      const json = await res.json();
      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error("Empty response");
      }
      return text;
    } catch (e: unknown) {
      console.warn(`Failed with ${model}:`, e);
      lastErr = e instanceof Error ? e.message : String(e);
    }
  }

  throw new Error(`Gemini failed: ${lastErr}`);
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

    if (!supabaseUrl || !supabaseServiceKey) {
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

    const body: GenerateNotesRequest = await req.json();

    if (body.action === "generate_notes_from_source" || body.action === "generate_study_guide_from_source") {
      if (!body.sourceId) {
        return new Response(JSON.stringify({ error: "Missing sourceId" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
      if (!geminiApiKey) {
        return new Response(JSON.stringify({ error: "Gemini API key not configured" }), {
          status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch the source
      const { data: source, error: sourceErr } = await supabase
        .from("sources")
        .select("title, extracted_text")
        .eq("id", body.sourceId)
        .single();

      if (sourceErr || !source) {
        return new Response(JSON.stringify({ error: "Source not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const sourceTitle = source.title || "Source material";
      const sourceText = source.extracted_text || "No text extracted.";
      const truncatedSourceText = sourceText.slice(0, 60000);

      let systemPrompt = "";
      let docTitle = "";
      let icon = "📝";

      if (body.action === "generate_notes_from_source") {
        systemPrompt = "You are an expert research assistant. Generate clear, structured, and comprehensive notes based on the provided source text. Organize with markdown headings, lists, and bold text. Do not add any greeting or meta-commentary, just return the markdown notes.";
        docTitle = `${sourceTitle} (Notes)`;
        icon = "📝";
      } else {
        systemPrompt = "You are an expert tutor. Create a detailed, structured Study Guide based on the provided source text. The study guide must include: 1. Overview & Objectives, 2. Key Terms & Definitions (Glossary), 3. Main Concepts explained clearly, 4. 5-10 Practice/Review Questions with brief explanations. Format in clean, readable Markdown. Do not add any greeting or meta-commentary, just return the markdown study guide.";
        docTitle = `${sourceTitle} (Study Guide)`;
        icon = "📚";
      }

      const userPrompt = `Source Title: ${sourceTitle}\n\nSource Content:\n${truncatedSourceText}`;

      // Call Gemini
      const markdownContent = await callGemini(geminiApiKey, systemPrompt, userPrompt);

      // Create Document
      const { data: doc, error: docErr } = await supabase
        .from("documents")
        .insert({
          user_id: userId,
          title: docTitle,
          icon,
          content: markdownContent,
          parent_id: null,
          course_id: null,
          lesson_id: null,
          cover_image: null,
        })
        .select("*")
        .single();

      if (docErr || !doc) {
        console.error("Failed to create document:", docErr);
        return new Response(JSON.stringify({ error: "Failed to create document" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Link source to the new document
      await supabase
        .from("sources")
        .update({ document_id: doc.id })
        .eq("id", body.sourceId);

      return new Response(JSON.stringify({ document: doc }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.action !== "save_to_page") {
      return new Response(JSON.stringify({ error: "Unknown action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!body.documentId) {
      return new Response(JSON.stringify({ error: "Missing documentId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    // ── Append selected text to the requested section ─────────────────────────
    const { selectedText, sectionHint, sourceLabel } = body;

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

    const updatedContent = appendUnderSection(currentContent, sectionHint, block);

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
