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

interface SaveToPageRequest {
  action: "save_to_page";
  documentId: string;       // knowledge page id
  selectedText: string;     // user-selected content from lesson
  sectionHint: string;      // "My Notes" | "Key Concepts" | "Examples" | etc.
  sourceLabel: string;      // e.g. "Docker Fundamentals → Module 3 → Docker Networking"
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

    const body: SaveToPageRequest = await req.json();

    if (body.action !== "save_to_page") {
      return new Response(JSON.stringify({ error: "Unknown action" }), {
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
