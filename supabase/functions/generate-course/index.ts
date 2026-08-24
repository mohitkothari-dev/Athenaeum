import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, x-client-info, apikey",
};

interface GenerationRequest {
  topic: string;
  knowledge_level: string;
  goal: string;
  time_commitment: string;
  difficulty: string;
  include_knowledge_page?: boolean;
}

interface LessonData {
  title: string;
  subtitle: string;
  learning_objectives: string[];
  content: string;
  quick_summary: string;
  eli10: string;
  key_takeaways: string[];
  practice: string;
  flashcards: { front: string; back: string }[];
  quiz: {
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  }[];
  duration_minutes: number;
}

interface ModuleData {
  title: string;
  description: string;
  lessons: LessonData[];
}

interface CourseData {
  title: string;
  description: string;
  estimated_duration: string;
  modules: ModuleData[];
}

interface KnowledgePageData {
  page_title: string;
  overview: string;
  what_you_will_learn: string[];
  key_concepts: string[];
  important_terms: { term: string; definition: string }[];
  important_commands: { command: string; description: string }[];
  examples: string[];
  common_mistakes: string[];
}

// ── Prompts ──────────────────────────────────────────────────────────────────

const COURSE_SYSTEM_PROMPT = `You are an expert curriculum designer. You always respond with valid JSON only — no markdown, no code fences, no commentary.

Write lesson content as clean HTML using only: <p>, <h3>, <ul>, <li>, <strong>, <em>. No <h1> or <h2>.
Keep content concise: 150-250 words for "content", 60-80 words for "quick_summary", 50-70 words for "eli10".
Generate 3-4 flashcards per lesson. Generate 2-3 quiz questions per lesson with 4 options each.`;

const PAGE_SYSTEM_PROMPT = `You are a knowledge-base author. You always respond with valid JSON only — no markdown, no code fences, no commentary.`;

// ── Prompt builders ───────────────────────────────────────────────────────────

function getTargetLessonCount(req: GenerationRequest): number {
  const base: Record<string, number> = {
    "15 min/day": 3,
    "30 min/day": 4,
    "1 hour/day": 5,
    "2+ hours/day": 6,
  };
  let n = base[req.time_commitment] ?? 4;
  if (req.difficulty === "Hard") n += 1;
  if (req.difficulty === "Easy") n = Math.max(2, n - 1);
  if (req.knowledge_level === "Beginner") n += 1;
  if (req.knowledge_level === "Advanced") n = Math.max(2, n - 1);
  return Math.min(6, Math.max(2, n));
}

function buildCoursePrompt(req: GenerationRequest): string {
  const target = getTargetLessonCount(req);
  // Keep module count low to reduce total output tokens
  const structure = target <= 4
    ? `2 modules, ${target} lessons total (2 lessons in first module, rest in second)`
    : `3 modules, ${target} lessons total (distribute evenly)`;

  return `Create a course:
Topic: ${req.topic}
Level: ${req.knowledge_level}
Goal: ${req.goal}
Time: ${req.time_commitment}
Difficulty: ${req.difficulty}
Structure: ${structure}

Respond ONLY with this JSON (no markdown, no code fences):
{
  "title": "Course title",
  "description": "1-2 sentence description",
  "estimated_duration": "e.g. '2 weeks at 30 min/day'",
  "modules": [
    {
      "title": "Module title",
      "description": "Module description",
      "lessons": [
        {
          "title": "Lesson title",
          "subtitle": "Short subtitle",
          "learning_objectives": ["obj1", "obj2"],
          "content": "<p>150-250 word HTML lesson...</p>",
          "quick_summary": "<p>60-80 word summary...</p>",
          "eli10": "<p>50-70 word simple explanation...</p>",
          "key_takeaways": ["takeaway1", "takeaway2"],
          "practice": "<p>Brief practice task...</p>",
          "flashcards": [{"front": "Q", "back": "A"}],
          "quiz": [{"question": "Q?", "options": ["A","B","C","D"], "correctIndex": 0, "explanation": "why"}],
          "duration_minutes": 10
        }
      ]
    }
  ]
}`;
}

function buildPagePrompt(course: CourseData, req: GenerationRequest): string {
  const outline = course.modules.map((m) =>
    `Module: ${m.title}\n` + m.lessons.map((l) => `  - ${l.title}`).join("\n")
  ).join("\n");

  return `Course: "${course.title}" about "${req.topic}" (${req.knowledge_level})

Outline:
${outline}

Write a concise knowledge-base reference. JSON only, no markdown:
{
  "page_title": "Short title",
  "overview": "2-3 sentence summary",
  "what_you_will_learn": ["item1","item2","item3"],
  "key_concepts": ["concept1","concept2","concept3"],
  "important_terms": [{"term": "t", "definition": "one sentence"}],
  "important_commands": [{"command": "cmd", "description": "what it does"}],
  "examples": ["example1","example2"],
  "common_mistakes": ["mistake1","mistake2"]
}
Rules: important_commands may be [] if no commands. 3-6 items per list. JSON only.`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractJson(text: string): unknown {
  let s = text.trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }
  try {
    return JSON.parse(s);
  } catch {
    const last = s.lastIndexOf("}");
    if (last !== -1) return JSON.parse(s.slice(0, last + 1));
    throw new Error("Invalid JSON");
  }
}

function buildPageMarkdown(data: KnowledgePageData): string {
  const lines: string[] = [];
  lines.push(`# ${data.page_title}`, "");
  lines.push("## Overview", data.overview, "");
  lines.push("## What You'll Learn", ...data.what_you_will_learn.map((i) => `- ${i}`), "");
  lines.push("## Key Concepts", ...data.key_concepts.map((c) => `- ${c}`), "");
  if (data.important_terms.length > 0) {
    lines.push("## Important Terms", ...data.important_terms.map(({ term, definition }) => `- **${term}** → ${definition}`), "");
  }
  if (data.important_commands.length > 0) {
    lines.push("## Important Commands", ...data.important_commands.map(({ command, description }) => `- \`${command}\` — ${description}`), "");
  }
  if (data.examples.length > 0) {
    lines.push("## Examples", ...data.examples.map((e) => `- ${e}`), "");
  }
  if (data.common_mistakes.length > 0) {
    lines.push("## Common Mistakes", ...data.common_mistakes.map((m) => `- ${m}`), "");
  }
  lines.push("## Questions", "", "## My Notes", "", "## Resources", "");
  return lines.join("\n");
}

function validateCourse(data: unknown): { ok: boolean; error?: string } {
  if (!data || typeof data !== "object") return { ok: false, error: "Not an object" };
  const c = data as CourseData;
  if (!c.title || !Array.isArray(c.modules) || c.modules.length === 0) {
    return { ok: false, error: "Missing title or modules" };
  }
  let count = 0;
  for (const m of c.modules) {
    if (!Array.isArray(m.lessons)) return { ok: false, error: "Module missing lessons array" };
    count += m.lessons.length;
    for (const l of m.lessons) {
      if (!l.title || !l.content) return { ok: false, error: `Lesson missing title/content: ${l.title}` };
    }
  }
  if (count < 2) return { ok: false, error: `Too few lessons: ${count}` };
  return { ok: true };
}

// ── Gemini call ───────────────────────────────────────────────────────────────

async function callGemini(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
): Promise<unknown> {
  // Use latest stable models: gemini-3.6-flash is the new primary, gemini-3.5-flash as fallback
  const models = ["gemini-3.6-flash", "gemini-3.5-flash"];

  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts: [{ text: userPrompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: Math.min(maxTokens, 8192),
            responseMimeType: "application/json",
          },
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        const msg = `Gemini ${res.status} (${model}, attempt ${attempt}): ${errText.slice(0, 600)}`;
        console.error(msg);
        console.error('Full Gemini error response:', { status: res.status, model, attempt, body: errText });
        // 404/400 model not found → try next model immediately
        if (res.status === 404 || (res.status === 400 && errText.toLowerCase().includes("not found"))) break;
        // 429/5xx → retry once with backoff, then try next model
        if (attempt === 0 && (res.status === 429 || res.status >= 500)) {
          await new Promise((r) => setTimeout(r, 2000));
          continue;
        }
        break;
      }

      const json = await res.json();
      const candidate = json?.candidates?.[0];
      const finishReason: string | undefined = candidate?.finishReason;

      if (finishReason === "MAX_TOKENS") {
        console.warn(`MAX_TOKENS on ${model}, attempt ${attempt}`);
        // Don't retry MAX_TOKENS — move to next model which might handle it differently
        break;
      }
      if (finishReason === "SAFETY" || finishReason === "RECITATION") {
        throw new Error(`Gemini blocked (${finishReason})`);
      }

      const text = candidate?.content?.parts?.find(
        (p: { text?: string }) => typeof p.text === "string",
      )?.text;

      if (!text) {
        if (attempt === 0) { await new Promise((r) => setTimeout(r, 1000)); continue; }
        break;
      }

      return extractJson(text);
    }
  }

  throw new Error("Gemini: all models/attempts exhausted");
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!geminiApiKey) {
      console.error('GEMINI_API_KEY is not set in Supabase secrets');
      return new Response(JSON.stringify({ error: "AI service not configured. Add GEMINI_API_KEY to Supabase secrets." }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log('GEMINI_API_KEY present:', geminiApiKey ? `yes (length: ${geminiApiKey.length})` : 'no');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Auth
    const jwt = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Invalid authentication" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const body: GenerationRequest = await req.json();
    const { topic, knowledge_level, goal, time_commitment, difficulty } = body;
    const includeKnowledgePage = body.include_knowledge_page !== false;

    if (!topic || !knowledge_level || !goal || !time_commitment || !difficulty) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Insert placeholder with status='generating' ────────────────────────
    const colors = ["terracotta", "sage", "gold", "brick", "ink"];
    const coverColor = colors[Math.floor(Math.random() * colors.length)];

    const { data: courseRow, error: courseError } = await supabase
      .from("courses")
      .insert({
        user_id: userId,
        title: "Generating…",
        description: "",
        topic,
        knowledge_level,
        goal,
        time_commitment,
        difficulty,
        cover_color: coverColor,
        estimated_duration: "",
        status: "generating",
      })
      .select("id")
      .single();

    if (courseError || !courseRow) {
      console.error("Failed to create course placeholder:", courseError);
      return new Response(JSON.stringify({ error: "Failed to create course record" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const courseId = (courseRow as { id: string }).id;

    // ── Generate course content (synchronous — runs within request) ────────
    // Trimmed prompts keep this well under 60s on gemini-2.5-flash.
    let course: CourseData | null = null;
    let genError = "";

    try {
      const data = await callGemini(
        geminiApiKey,
        COURSE_SYSTEM_PROMPT,
        buildCoursePrompt(body),
        6000,
      ) as CourseData;

      const validation = validateCourse(data);
      if (!validation.ok) throw new Error(`Validation: ${validation.error}`);
      course = data;
    } catch (err) {
      genError = err instanceof Error ? err.message : String(err);
      console.error("Course generation failed:", genError);
    }

    if (!course) {
      await supabase.from("courses").delete().eq("id", courseId);

      let userMsg = "Generation failed. Please try again.";
      const lower = genError.toLowerCase();
      if (lower.includes("429") || lower.includes("quota") || lower.includes("resource_exhausted")) {
        userMsg = "AI is busy right now. Please wait a moment and try again.";
      } else if (lower.includes("401") || lower.includes("api key") || lower.includes("permission_denied")) {
        userMsg = "AI service authentication failed. Check GEMINI_API_KEY in Supabase secrets.";
      } else if (lower.includes("blocked") || lower.includes("safety")) {
        userMsg = "Content was blocked by safety filters. Try rephrasing your topic.";
      } else if (lower.includes("max_tokens") || lower.includes("truncated")) {
        userMsg = "Topic too large. Try a more focused topic or choose '15 min/day'.";
      }

      return new Response(JSON.stringify({ error: userMsg, details: genError.slice(0, 400) }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Persist modules + lessons ─────────────────────────────────────────
    await supabase.from("courses").update({
      title: course.title,
      description: course.description,
      estimated_duration: course.estimated_duration,
    }).eq("id", courseId);

    for (let mIdx = 0; mIdx < course.modules.length; mIdx++) {
      const mod = course.modules[mIdx];
      const { data: moduleRow, error: modErr } = await supabase
        .from("modules")
        .insert({ course_id: courseId, title: mod.title, description: mod.description, position: mIdx })
        .select("id")
        .single();

      if (modErr || !moduleRow) { console.error("Module insert failed:", modErr); continue; }

      for (let lIdx = 0; lIdx < mod.lessons.length; lIdx++) {
        const lesson = mod.lessons[lIdx];
        await supabase.from("lessons").insert({
          course_id: courseId,
          module_id: (moduleRow as { id: string }).id,
          title: lesson.title,
          subtitle: lesson.subtitle || "",
          learning_objectives: JSON.stringify(lesson.learning_objectives || []),
          content: lesson.content || "",
          quick_summary: lesson.quick_summary || "",
          eli10: lesson.eli10 || "",
          key_takeaways: JSON.stringify(lesson.key_takeaways || []),
          practice: lesson.practice || "",
          flashcards: JSON.stringify(lesson.flashcards || []),
          quiz: JSON.stringify(lesson.quiz || []),
          position: lIdx,
          duration_minutes: lesson.duration_minutes || 10,
        });
      }
    }

    // ── Mark ready ───────────────────────────────────────────────────────
    await supabase.from("courses").update({ status: "ready" }).eq("id", courseId);

    // ── Knowledge page (background after response, best-effort) ──────────
    // CPU limit is tight, so we only attempt this if EdgeRuntime is available.
    // If it gets killed, the course is still fully usable — the page just
    // won't appear. CourseView polls for it gracefully.
    if (includeKnowledgePage) {
      const er = (globalThis as unknown as { EdgeRuntime?: { waitUntil: (p: Promise<unknown>) => void } }).EdgeRuntime;
      const bgWork = (async () => {
        try {
          const pageData = await callGemini(
            geminiApiKey,
            PAGE_SYSTEM_PROMPT,
            buildPagePrompt(course!, { topic, knowledge_level, goal, time_commitment, difficulty }),
            3000,
          ) as KnowledgePageData;

          await supabase.from("documents").insert({
            user_id: userId,
            title: pageData.page_title || course!.title,
            icon: "📖",
            content: buildPageMarkdown(pageData),
            course_id: courseId,
            parent_id: null,
            lesson_id: null,
            cover_image: null,
          });
          console.log("Knowledge page created for course", courseId);
        } catch (e) {
          console.error("Knowledge page generation failed (non-fatal):", e);
        }
      })();

      if (er) {
        er.waitUntil(bgWork);
      }
      // If no EdgeRuntime, we skip the page — course is already complete.
    }

    return new Response(JSON.stringify({ courseId }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "An unexpected error occurred" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
