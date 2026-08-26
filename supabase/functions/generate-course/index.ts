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
  source_id?: string;
  is_practice_mode?: boolean;
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

function getTargetLessonCount(req: GenerationRequest, hasSource = false): number {
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
  // When grounding from a source, cap at 4 lessons — the content is already
  // defined so more lessons just inflates output tokens without adding value.
  const cap = hasSource ? 4 : 6;
  return Math.min(cap, Math.max(2, n));
}

function buildCoursePrompt(req: GenerationRequest, sourceTitle?: string, sourceText?: string): string {
  const hasSource = !!(sourceText && sourceTitle);
  const target = getTargetLessonCount(req, hasSource);
  // Keep module count low to reduce total output tokens
  const structure = target <= 4
    ? `2 modules, ${target} lessons total (2 lessons in first module, rest in second)`
    : `3 modules, ${target} lessons total (distribute evenly)`;

  let basePrompt = `Create a course:
Topic: ${req.topic}
Level: ${req.knowledge_level}
Goal: ${req.goal}
Time: ${req.time_commitment}
Difficulty: ${req.difficulty}
Structure: ${structure}`;

  if (req.is_practice_mode) {
    basePrompt += `\nPractice Mode: Focus heavily on practical application, flashcards, and quizzes. Maintain short, direct lesson reading content, and expand the variety and challenge of flashcard/quiz questions.`;
  }

  if (sourceText && sourceTitle) {
    basePrompt += `\n\nGROUNDING SOURCE MATERIAL:
Title: ${sourceTitle}
Content:
${sourceText}

CRITICAL REQUIREMENT: The course content, terminology, lessons, flashcards, and quiz questions MUST be strictly grounded in and derived from the provided source material above. Do not invent details not present or implied in the source.
OUTPUT SIZE CONSTRAINT: Generate exactly 2 flashcards and 1 quiz question per lesson (not more) to keep the response within token limits.`;
  }

  return basePrompt + `

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

function buildPagePrompt(course: CourseData, req: GenerationRequest, sourceTitle?: string, sourceText?: string): string {
  const outline = course.modules.map((m) =>
    `Module: ${m.title}\n` + m.lessons.map((l) => `  - ${l.title}`).join("\n")
  ).join("\n");

  let basePrompt = `Course: "${course.title}" about "${req.topic}" (${req.knowledge_level})

Outline:
${outline}`;

  if (sourceText && sourceTitle) {
    basePrompt += `\n\nGrounding Source: "${sourceTitle}"\nSource Snippet: ${sourceText.slice(0, 8000)}`;
  }

  return basePrompt + `

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

// ── AI Provider calls ───────────────────────────────────────────────────────

async function callMistral(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
): Promise<unknown> {
  const models = ["mistral-large-latest", "mistral-small-latest"];
  const url = `https://api.mistral.ai/v1/chat/completions`;

  for (const model of models) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: Math.min(maxTokens, 8192),
          response_format: { type: "json_object" },
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error(`Mistral ${res.status} (${model}):`, errText.slice(0, 400));
        if (res.status === 429) {
          const retryAfter = parseInt(res.headers.get("retry-after") || "30");
          console.warn(`Mistral 429 on ${model}, waiting ${Math.min(retryAfter, 30)}s then trying next model`);
          await new Promise((r) => setTimeout(r, Math.min(retryAfter, 30) * 1000));
        }
        continue;
      }

      const json = await res.json();
      const content = json?.choices?.[0]?.message?.content;
      if (!content) { console.warn(`Empty response from Mistral ${model}`); continue; }
      return extractJson(content);
    } catch (err) {
      console.error(`Mistral (${model}) failed:`, err);
    }
  }

  throw new Error(`Mistral: all models failed`);
}

// ── Gemini fallback (for backward compatibility) ─────────────────────────────────

async function callGemini(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
): Promise<unknown> {
  // Use latest stable models: gemini-3.6-flash is the new primary, gemini-3.5-flash as fallback
  const models = ["gemini-3.6-flash", "gemini-3.5-flash"];

  for (const model of models) {
    for (let attempt = 0; attempt < 4; attempt++) {
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
        // 429 (rate limit) — free tier RPM is low, back off 15s + jitter before retrying
        // 502/503/5xx (transient) — exponential backoff 1.5s → 3s → 8s + jitter
        if (res.status === 429 || res.status >= 500) {
          if (attempt < 3) {
            const backoff = res.status === 429
              ? 15000 + Math.random() * 5000
              : Math.min(8000, 1500 * Math.pow(2, attempt)) + Math.random() * 500;
            console.warn(`Retrying ${model} after ${res.status} (attempt ${attempt + 1}/4) in ${Math.round(backoff)}ms`);
            await new Promise((r) => setTimeout(r, backoff));
            continue;
          }
        }
        break;
      }

      const json = await res.json();
      const candidate = json?.candidates?.[0];
      const finishReason: string | undefined = candidate?.finishReason;

      if (finishReason === "MAX_TOKENS") {
        console.warn(`MAX_TOKENS on ${model}, attempt ${attempt} — output was truncated, trying next model`);
        break;
      }
      if (finishReason === "SAFETY" || finishReason === "RECITATION") {
        throw new Error(`Gemini blocked (${finishReason})`);
      }

      const text = candidate?.content?.parts?.find(
        (p: { text?: string }) => typeof p.text === "string",
      )?.text;

      if (!text) {
        if (attempt < 3) { await new Promise((r) => setTimeout(r, 800)); continue; }
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
    const mistralApiKey = Deno.env.get("MISTRAL_API_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!geminiApiKey) {
      console.error("GEMINI_API_KEY is not set in Supabase secrets");
      return new Response(JSON.stringify({ error: "AI service not configured. Add GEMINI_API_KEY to Supabase secrets." }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ── Auth ─────────────────────────────────────────────────────────────────
    const jwt = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Invalid authentication" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    // ── Parse + validate request body ────────────────────────────────────────
    const body: GenerationRequest = await req.json();
    const { topic, knowledge_level, goal, time_commitment, difficulty } = body;
    if (!topic || !knowledge_level || !goal || !time_commitment || !difficulty) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Insert placeholder row immediately (status='generating') ─────────────
    // We return this courseId to the client right away so it can navigate to
    // CourseView, which polls/subscribes for status transitions.
    const colors = ["terracotta", "sage", "gold", "brick", "ink"];
    const coverColor = colors[Math.floor(Math.random() * colors.length)];

    const { data: courseRow, error: courseError } = await supabase
      .from("courses")
      .insert({
        user_id: userId,
        title: "Generating\u2026",
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
    const includeKnowledgePage = body.include_knowledge_page !== false;

    // ── Background generation task ────────────────────────────────────────────
    // All AI calls, retries, and DB writes run here — outside the 60s gateway
    // window. The client receives courseId immediately and polls for 'ready'.
    const generationTask = (async () => {
      // Helper: mark course as failed and surface a clean error message
      const failCourse = async (rawError: string) => {
        console.error("Course generation failed — raw error:", rawError);
        const lower = rawError.toLowerCase();
        let userMsg = `Generation failed (${rawError.slice(0, 120)}). Please delete this course and try again.`;
        if (lower.includes("429") || lower.includes("quota") || lower.includes("resource_exhausted")) {
          userMsg = "AI is busy right now. Please delete this course and try again in a moment.";
        } else if (lower.includes("502") || lower.includes("503") || lower.includes("bad gateway")) {
          userMsg = "AI gateway was temporarily overloaded. Please delete this course and retry.";
        } else if (lower.includes("401") || lower.includes("api key") || lower.includes("permission_denied")) {
          userMsg = "AI service authentication failed. Check GEMINI_API_KEY in Supabase secrets.";
        } else if (lower.includes("blocked") || lower.includes("safety")) {
          userMsg = "Content was blocked by AI safety filters. Try rephrasing your topic.";
        } else if (lower.includes("max_tokens") || lower.includes("truncated")) {
          userMsg = "Topic too large for the AI to process. Try a more focused topic or choose '15 min/day'.";
        }
        await supabase.from("courses").update({
          status: "error",
          error_message: userMsg,
        }).eq("id", courseId);
      };

      try {
        // ── Fetch grounding source text ─────────────────────────────────────
        let sourceText = "";
        let sourceTitle = "";
        if (body.source_id) {
          const { data: src, error: srcErr } = await supabase
            .from("sources")
            .select("title, extracted_text")
            .eq("id", body.source_id)
            .single();
          if (!srcErr && src) {
            sourceText = src.extracted_text || "";
            sourceTitle = src.title || "Source Material";
          } else if (srcErr) {
            console.error("Failed to fetch grounding source:", srcErr);
          }
        }
        const truncatedSourceText = sourceText ? sourceText.slice(0, 6000) : "";

        // ── Generate course content ─────────────────────────────────────────
        const apiProviders = [
          ...(mistralApiKey ? [{ name: "Mistral", call: callMistral, key: mistralApiKey }] : []),
          { name: "Gemini", call: callGemini, key: geminiApiKey! },
        ];

        let course: CourseData | null = null;
        let lastError = "";

        for (const provider of apiProviders) {
          try {
            const data = await provider.call(
              provider.key,
              COURSE_SYSTEM_PROMPT,
              buildCoursePrompt(body, sourceTitle, truncatedSourceText),
              8000,
            ) as CourseData;

            const validation = validateCourse(data);
            if (!validation.ok) {
              lastError = `Validation: ${validation.error}`;
              console.error(`${provider.name} validation failed:`, validation.error);
              continue;
            }

            course = data;
            console.log(`Course generation succeeded with ${provider.name}`);
            break;
          } catch (err) {
            lastError = err instanceof Error ? err.message : String(err);
            console.error(`${provider.name} failed:`, lastError);
            if (lastError.includes("429") || lastError.includes("rate limit") || lastError.includes("quota")) {
              await new Promise((r) => setTimeout(r, 2000));
            }
          }
        }

        if (!course) {
          await failCourse(lastError || "All AI providers returned empty response");
          return;
        }

        // ── Persist modules + lessons ───────────────────────────────────────
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

        // ── Mark ready — Realtime triggers CourseView to reload ────────────
        await supabase.from("courses").update({ status: "ready" }).eq("id", courseId);

        if (body.source_id) {
          await supabase.from("sources").update({ course_id: courseId }).eq("id", body.source_id);
        }

        // ── Knowledge page (best-effort, separate from course completion) ───
        if (includeKnowledgePage) {
          try {
            const knowledgeProviders = [
              ...(mistralApiKey ? [{ name: "Mistral", call: callMistral, key: mistralApiKey }] : []),
              { name: "Gemini", call: callGemini, key: geminiApiKey! },
            ];

            let pageData: KnowledgePageData | null = null;
            for (const provider of knowledgeProviders) {
              try {
                pageData = await provider.call(
                  provider.key,
                  PAGE_SYSTEM_PROMPT,
                  buildPagePrompt(course, { topic, knowledge_level, goal, time_commitment, difficulty }, sourceTitle, truncatedSourceText),
                  3000,
                ) as KnowledgePageData;
                console.log(`Knowledge page succeeded with ${provider.name}`);
                break;
              } catch (err) {
                console.error(`${provider.name} failed for knowledge page:`, err);
              }
            }

            if (pageData) {
              const { data: docRow } = await supabase.from("documents").insert({
                user_id: userId,
                title: pageData.page_title || course.title,
                icon: "\uD83D\uDCD6",
                content: buildPageMarkdown(pageData),
                course_id: courseId,
                parent_id: null,
                lesson_id: null,
                cover_image: null,
              }).select("id").single();

              if (docRow && body.source_id) {
                await supabase.from("sources")
                  .update({ document_id: (docRow as { id: string }).id })
                  .eq("id", body.source_id);
              }
              console.log("Knowledge page created for course", courseId);
            }
          } catch (e) {
            console.error("Knowledge page generation failed (non-fatal):", e);
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        await failCourse(msg);
      }
    })();

    // ── Return courseId immediately — generation runs in background ──────────
    const edgeRuntime = (globalThis as unknown as { EdgeRuntime?: { waitUntil: (p: Promise<unknown>) => void } }).EdgeRuntime;
    if (edgeRuntime) {
      edgeRuntime.waitUntil(generationTask);
    } else {
      // Local dev: await inline so tests and local runs work correctly
      await generationTask;
    }

    return new Response(JSON.stringify({ courseId }), {
      status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "An unexpected error occurred" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
