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

// ── Knowledge-page types ─────────────────────────────────────────────────────

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

const COURSE_SYSTEM_PROMPT = `You are an expert curriculum designer and educator. You create structured, engaging, and pedagogically sound courses. You always respond with valid JSON only — no markdown, no code fences, no commentary.

Your courses are:
- Well-structured with clear modules and lessons
- Digestible — each lesson can be completed in one sitting
- Interactive — every lesson includes flashcards and a quiz
- Practical — every lesson includes practice exercises
- Multi-modal — every lesson supports Read, Quick Summary, Explain Like I'm 10, Flashcards, Quiz, and Practice views

You write lesson content as clean HTML using <p>, <h2>, <h3>, <ul>, <li>, <strong>, <em>, <blockquote>, and <div class="callout"><div class="callout-title">Title</div>...</div> tags. Never use <h1>. Content should be rich and detailed (300-500 words for full content, 100-150 for quick summary, 80-120 for ELI10).

Flashcards should have concise fronts (a question or term) and clear backs (the answer or definition). Generate 4-6 flashcards per lesson.

Quizzes should have 3-4 questions per lesson, each with 4 options, one correct answer, and a brief explanation.`;

const PAGE_SYSTEM_PROMPT = `You are a knowledge-base author. Given a course outline, you write a concise structured reference document that serves as the student's long-term knowledge base. You always respond with valid JSON only — no markdown, no code fences, no commentary.`;

function buildCoursePrompt(req: GenerationRequest): string {
  return `Create a complete course with the following parameters:

Topic: ${req.topic}
Knowledge Level: ${req.knowledge_level}
Goal: ${req.goal}
Time Commitment: ${req.time_commitment}
Difficulty: ${req.difficulty}

Design 2-3 modules with 1-2 lessons each (aim for 3-5 lessons total — keep it focused and achievable).

Respond with ONLY a JSON object in this exact structure (no markdown, no code fences):

{
  "title": "Course title",
  "description": "1-2 sentence course description",
  "estimated_duration": "e.g. '2 weeks at 30 min/day'",
  "modules": [
    {
      "title": "Module title",
      "description": "Module description",
      "lessons": [
        {
          "title": "Lesson title",
          "subtitle": "A short subtitle",
          "learning_objectives": ["Objective 1", "Objective 2", "Objective 3"],
          "content": "<p>Full HTML explanation...</p>",
          "quick_summary": "<p>3-minute HTML overview...</p>",
          "eli10": "<p>Simplified HTML explanation for a 10-year-old...</p>",
          "key_takeaways": ["Takeaway 1", "Takeaway 2", "Takeaway 3"],
          "practice": "<p>HTML practice exercises or mini-project...</p>",
          "flashcards": [
            {"front": "Question or term", "back": "Answer or definition"}
          ],
          "quiz": [
            {
              "question": "Question text",
              "options": ["Option A", "Option B", "Option C", "Option D"],
              "correctIndex": 0,
              "explanation": "Why this answer is correct"
            }
          ],
          "duration_minutes": 10
        }
      ]
    }
  ]
}

Remember: respond with JSON only. No markdown. No code fences. No text before or after the JSON.`;
}

function buildPagePrompt(course: CourseData, req: GenerationRequest): string {
  // Summarise the course outline without sending full lesson HTML content
  // to keep token usage low.
  const outlineLines: string[] = [];
  for (const mod of course.modules) {
    outlineLines.push(`Module: ${mod.title} — ${mod.description}`);
    for (const lesson of mod.lessons) {
      const objectives = (lesson.learning_objectives || []).join("; ");
      const takeaways = (lesson.key_takeaways || []).join("; ");
      outlineLines.push(
        `  Lesson: ${lesson.title} | Objectives: ${objectives} | Takeaways: ${takeaways}`,
      );
    }
  }
  const outline = outlineLines.join("\n");

  return `A student just created a course called "${course.title}" about "${req.topic}".

Course description: ${course.description}
Knowledge level: ${req.knowledge_level}
Goal: ${req.goal}

Course outline:
${outline}

Generate a concise structured knowledge-base document they can use as a long-term reference. Focus on key concepts, important terms, and practical commands/examples — NOT a transcript of the lessons.

Respond with ONLY this JSON (no markdown, no code fences):

{
  "page_title": "Short topic title (e.g. 'Docker')",
  "overview": "2-3 sentence plain-text summary of the subject",
  "what_you_will_learn": ["Concept 1", "Concept 2", "Concept 3", "Concept 4"],
  "key_concepts": ["Concept A", "Concept B", "Concept C", "Concept D", "Concept E"],
  "important_terms": [
    { "term": "Term name", "definition": "One-sentence definition" }
  ],
  "important_commands": [
    { "command": "example command or syntax", "description": "What it does" }
  ],
  "examples": [
    "Short practical example or scenario (plain text, 1-2 sentences each)"
  ],
  "common_mistakes": [
    "Common misconception or pitfall (plain text, 1 sentence each)"
  ]
}

Rules:
- important_commands may be an empty array [] if the topic has no commands/code
- Aim for 4-8 items per list; keep definitions under 20 words
- JSON only. No markdown. No code fences. No text outside the JSON object.`;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function extractJson(text: string): unknown {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```(?:json)?\s*\n?/, "")
      .replace(/\n?```\s*$/, "");
  }
  return JSON.parse(cleaned);
}

/** Convert the structured KnowledgePageData into Markdown for storage in documents.content */
function buildPageMarkdown(data: KnowledgePageData): string {
  const lines: string[] = [];

  lines.push(`# ${data.page_title}`);
  lines.push("");

  lines.push("## Overview");
  lines.push(data.overview);
  lines.push("");

  lines.push("## What You'll Learn");
  for (const item of data.what_you_will_learn) {
    lines.push(`- ${item}`);
  }
  lines.push("");

  lines.push("## Key Concepts");
  for (const concept of data.key_concepts) {
    lines.push(`- ${concept}`);
  }
  lines.push("");

  if (data.important_terms.length > 0) {
    lines.push("## Important Terms");
    for (const { term, definition } of data.important_terms) {
      lines.push(`- **${term}** → ${definition}`);
    }
    lines.push("");
  }

  if (data.important_commands.length > 0) {
    lines.push("## Important Commands");
    for (const { command, description } of data.important_commands) {
      lines.push(`- \`${command}\` — ${description}`);
    }
    lines.push("");
  }

  if (data.examples.length > 0) {
    lines.push("## Examples");
    for (const ex of data.examples) {
      lines.push(`- ${ex}`);
    }
    lines.push("");
  }

  if (data.common_mistakes.length > 0) {
    lines.push("## Common Mistakes");
    for (const mistake of data.common_mistakes) {
      lines.push(`- ${mistake}`);
    }
    lines.push("");
  }

  lines.push("## Questions");
  lines.push("");

  lines.push("## My Notes");
  lines.push("");

  lines.push("## Resources");
  lines.push("");

  return lines.join("\n");
}

/** Call Gemini and return parsed JSON or throw */
async function callGemini(
  geminiApiKey: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 4096,
): Promise<unknown> {
  // gemini-1.5-flash is widely available; change to gemini-2.0-flash if your
  // API key / project has access to that model.
  const GEMINI_MODEL = "gemini-1.5-flash";
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiApiKey}`;

  const response = await fetch(geminiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: maxTokens,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("Gemini API error:", response.status, errText);
    throw new Error(`Gemini error ${response.status}`);
  }

  const geminiData = await response.json();
  const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned empty response");
  return extractJson(text);
}

// ── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({ error: "AI service not configured. Add GEMINI_API_KEY to edge function secrets." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ── Authenticate ────────────────────────────────────────────────────────
    const jwt = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const userId = userData.user.id;

    const body: GenerationRequest = await req.json();
    const { topic, knowledge_level, goal, time_commitment, difficulty } = body;

    if (!topic || !knowledge_level || !goal || !time_commitment || !difficulty) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Create placeholder course row ───────────────────────────────────────
    const colors = ["terracotta", "sage", "gold", "brick", "ink"];
    const coverColor = colors[Math.floor(Math.random() * colors.length)];

    const { data: courseRow, error: courseError } = await supabase
      .from("courses")
      .insert({
        user_id: userId,
        title: "Generating...",
        description: "",
        topic,
        knowledge_level,
        goal,
        time_commitment,
        difficulty,
        cover_color: coverColor,
        estimated_duration: "",
      })
      .select("*")
      .single();

    if (courseError || !courseRow) {
      return new Response(
        JSON.stringify({ error: "Failed to create course record" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const courseId = courseRow.id;

    // ── Generate course content ─────────────────────────────────────────────
    let course: CourseData;
    try {
      course = (await callGemini(
        geminiApiKey,
        COURSE_SYSTEM_PROMPT,
        buildCoursePrompt({ topic, knowledge_level, goal, time_commitment, difficulty }),
        65536,
      )) as CourseData;
    } catch (parseError) {
      console.error("Course generation error:", parseError);
      await supabase.from("courses").delete().eq("id", courseId);
      return new Response(
        JSON.stringify({ error: "Failed to generate course. Please try again." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Persist course + modules + lessons ──────────────────────────────────
    await supabase
      .from("courses")
      .update({
        title: course.title,
        description: course.description,
        estimated_duration: course.estimated_duration,
      })
      .eq("id", courseId);

    for (let mIdx = 0; mIdx < course.modules.length; mIdx++) {
      const mod = course.modules[mIdx];
      const { data: moduleRow, error: modError } = await supabase
        .from("modules")
        .insert({
          course_id: courseId,
          title: mod.title,
          description: mod.description,
          position: mIdx,
        })
        .select("*")
        .single();

      if (modError || !moduleRow) {
        console.error("Failed to insert module:", modError);
        continue;
      }

      for (let lIdx = 0; lIdx < mod.lessons.length; lIdx++) {
        const lesson = mod.lessons[lIdx];
        await supabase.from("lessons").insert({
          course_id: courseId,
          module_id: moduleRow.id,
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

    // ── Generate and persist knowledge page ─────────────────────────────────
    // This runs after the course is fully saved. A failure here must NOT
    // cause the whole request to fail — the course already exists and the
    // user should still land on it. We return pageId: null on failure.
    let pageId: string | null = null;

    try {
      const pageData = (await callGemini(
        geminiApiKey,
        PAGE_SYSTEM_PROMPT,
        buildPagePrompt(course, { topic, knowledge_level, goal, time_commitment, difficulty }),
        4096,
      )) as KnowledgePageData;

      const content = buildPageMarkdown(pageData);
      const pageTitle = pageData.page_title || course.title;

      const { data: pageRow, error: pageError } = await supabase
        .from("documents")
        .insert({
          user_id: userId,
          title: pageTitle,
          icon: "📖",
          content,
          course_id: courseId,
          parent_id: null,
          lesson_id: null,
          cover_image: null,
        })
        .select("id")
        .single();

      if (pageError) {
        console.error("Failed to insert knowledge page:", pageError);
      } else if (pageRow) {
        pageId = pageRow.id as string;
      }
    } catch (pageErr) {
      // Knowledge-page generation failed — log and continue gracefully.
      console.error("Knowledge page generation failed (non-fatal):", pageErr);
    }

    return new Response(
      JSON.stringify({ courseId, pageId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
