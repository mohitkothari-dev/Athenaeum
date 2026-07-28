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

const SYSTEM_PROMPT = `You are an expert curriculum designer and educator. You create structured, engaging, and pedagogically sound courses. You always respond with valid JSON only — no markdown, no code fences, no commentary.

Your courses are:
- Well-structured with clear modules and lessons
- Digestible — each lesson can be completed in one sitting
- Interactive — every lesson includes flashcards and a quiz
- Practical — every lesson includes practice exercises
- Multi-modal — every lesson supports Read, Quick Summary, Explain Like I'm 10, Flashcards, Quiz, and Practice views

You write lesson content as clean HTML using <p>, <h2>, <h3>, <ul>, <li>, <strong>, <em>, <blockquote>, and <div class="callout"><div class="callout-title">Title</div>...</div> tags. Never use <h1>. Content should be rich and detailed (300-500 words for full content, 100-150 for quick summary, 80-120 for ELI10).

Flashcards should have concise fronts (a question or term) and clear backs (the answer or definition). Generate 4-6 flashcards per lesson.

Quizzes should have 3-4 questions per lesson, each with 4 options, one correct answer, and a brief explanation.`;

function buildUserPrompt(req: GenerationRequest): string {
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

function extractJson(text: string): unknown {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }
  return JSON.parse(cleaned);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!geminiApiKey) {
      return new Response(JSON.stringify({ error: "AI service not configured. Add GEMINI_API_KEY to edge function secrets." }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const jwt = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Invalid authentication" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const body: GenerationRequest = await req.json();
    const { topic, knowledge_level, goal, time_commitment, difficulty } = body;

    if (!topic || !knowledge_level || !goal || !time_commitment || !difficulty) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const colors = ["terracotta", "sage", "gold", "brick", "ink"];
    const coverColor = colors[Math.floor(Math.random() * colors.length)];

    const { data: courseData, error: courseError } = await supabase
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

    if (courseError || !courseData) {
      return new Response(JSON.stringify({ error: "Failed to create course record" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const courseId = courseData.id;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${geminiApiKey}`;

    const geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: SYSTEM_PROMPT }],
        },
        contents: [
          {
            parts: [{ text: buildUserPrompt({ topic, knowledge_level, goal, time_commitment, difficulty }) }],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 65536,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      console.error("Gemini API error:", geminiResponse.status, errText);
      await supabase.from("courses").delete().eq("id", courseId);
      return new Response(JSON.stringify({ error: "AI generation failed. Please try again." }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const geminiData = await geminiResponse.json();
    const generatedText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedText) {
      await supabase.from("courses").delete().eq("id", courseId);
      return new Response(JSON.stringify({ error: "AI returned empty response" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let course: CourseData;
    try {
      course = extractJson(generatedText) as CourseData;
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      await supabase.from("courses").delete().eq("id", courseId);
      return new Response(JSON.stringify({ error: "Failed to parse AI response" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    return new Response(JSON.stringify({ courseId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "An unexpected error occurred" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
