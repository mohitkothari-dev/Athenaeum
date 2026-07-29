# Athenaeum 📚

> **Athenaeum** is an AI-powered learning companion that transforms prompts into complete, structured courses containing custom roadmaps, multi-modal lessons, interactive quizzes, 3D flashcards, and progress tracking.

---

## 📖 Vision & Purpose

Unlike generic chatbots that provide long, unstructured text walls, **Athenaeum** acts as a personalized educator. It solves the issue of information overload by taking parameters like:
* **Topic** (e.g., *Docker*)
* **Knowledge Level** (e.g., *Beginner*)
* **Goal** (e.g., *Deploy a Next.js App*)
* **Time Commitment** (e.g., *30 minutes/day*)

And converting them into a structured curriculum with manageable modules, interactive activities, and progress metrics. It answers the question **"What should I learn next?"** automatically.

---

## 🛠️ Tech Stack

Athenaeum is built on a modern, decoupled serverless architecture:

* **Frontend**: React 18 (TypeScript), Vite, Tailwind CSS, Lucide Icons.
* **Backend & Database**: Supabase (PostgreSQL with Row-Level Security, Database Migrations).
* **Serverless Functions**: Supabase Edge Functions (Deno Deploy runtime).
* **AI Engine**: Google Gemini API (`gemini-3.6-flash`).
* **Design & Typography**: Custom editorial themes utilizing *Newsreader* for reading and *Inter* for interface components.

---

## 🏗️ Technical Architecture

<img width="7135" height="3201" alt="Image" src="https://github.com/user-attachments/assets/7f0b5f89-6359-459b-8aa3-6fdfe9ea0828" />

---

## 🗃️ Database Schema

The database relies on Row-Level Security (RLS) policies to ensure that users only access and modify their own content. The relational schema is mapped below:

### 1. Core Models
| Table | Description | RLS Policy |
| :--- | :--- | :--- |
| [`courses`](/supabase/migrations/20260728073553_rebuild_schema_for_ai_course_generator.sql#L37-L52) | Stores course metadata (topic, difficulty, estimated duration, goals). | Authenticated Owner (`auth.uid() = user_id`) |
| [`modules`](/supabase/migrations/20260728073553_rebuild_schema_for_ai_course_generator.sql#L66-L73) | Divides courses into thematic phases/sections. | Authenticated via Course Owner |
| [`lessons`](/supabase/migrations/20260728073553_rebuild_schema_for_ai_course_generator.sql#L87-L104) | Contains core HTML course content, summaries, quizzes (JSON), and flashcards (JSON). | Authenticated via Course Owner |

### 2. Progress & Mastery Models
| Table | Description | RLS Policy |
| :--- | :--- | :--- |
| [`lesson_progress`](/supabase/migrations/20260728073553_rebuild_schema_for_ai_course_generator.sql#L118-L128) | Tracks state (`not_started`, `in_progress`, `completed`) for a lesson. | Authenticated Owner (`auth.uid() = user_id`) |
| [`quiz_results`](/supabase/migrations/20260728073553_rebuild_schema_for_ai_course_generator.sql#L142-L150) | Logs scores and attempts on lesson quizzes. | Authenticated Owner (`auth.uid() = user_id`) |
| [`flashcard_reviews`](/supabase/migrations/20260728073553_rebuild_schema_for_ai_course_generator.sql#L162-L174) | Monitors spaced-repetition metrics (mastery levels 0-3, review counts). | Authenticated Owner (`auth.uid() = user_id`) |

---

## ⚡ Core Features

1. **AI Curriculum Design**: Generates 2-3 modules containing 1-2 lessons per course (ideally 3-5 lessons total for digestible, structured achievements).
2. **Multi-Modal Learning View**: Every lesson allows switching between:
   * **Full Reading**: Rich structured HTML content with code formatting.
   * **Quick Summary**: Concise HTML overview for speed-running the topic.
   * **ELI10**: A simplified, intuitive explanation targeted at beginner levels ("Explain Like I'm 10").
   * **Practice**: Practical hands-on exercises and mini-projects.
3. **Interactive Quizzes**: Multiple-choice quizzes dynamically generated per lesson with detailed explanations for correct and incorrect answers.
4. **3D Flashcards**: Spaced-repetition study cards built with a flip animation for terms, definitions, and active recall.
5. **Dashboard & Analytics**: Complete visualization of user progress, average quiz performance, and general library state.

---

## 🎨 Visual System & Aesthetics

Athenaeum implements a high-quality editorial aesthetic prioritizing readability and long study sessions:

* **Backgrounds**: Soft, non-fatiguing warm neutrals (`#faf8f2` - Cream).
* **Typography**:
  * **Reading Content**: `Newsreader`/`Georgia` serif font for maximum eye comfort, customized spacing, and comfortable column width.
  * **UI Elements**: `Inter` sans-serif typeface for interfaces, settings, and tables.
* **Palette**: Tailored earthly colors representing different subjects:
  * 🏺 **Terracotta** (`#9c4a26`) - Default theme, warm primary accents.
  * 🌿 **Sage** - Calm green tones.
  * 🪙 **Gold** - Warm yellow accents.
  * 🧱 **Brick** - Deep clay red.
  * ✒️ **Ink** (`#221f1c`) - Editorial charcoal text color.
* **Micro-interactions**: 3D rotation animations for flashcards (`perspective`, `backface-hidden`), smooth fades, and gentle loading animations.

---

## 🚀 Setup & Installation

### Prerequisites
* [Node.js](https://nodejs.org) (v18+)
* [Supabase CLI](https://supabase.com/docs/guides/cli) (for database and edge function management)

### Local Configuration

1. **Clone and Install Dependencies**:
   ```bash
   npm install
   ```

2. **Environment Setup**:
   Create a `.env` file in the root directory:
   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

3. **Supabase Secrets Configuration**:
   To set up the AI service, you must bind your Gemini API Key to the Supabase Edge Function secrets:
   ```bash
   supabase login
   supabase link --project-ref your_supabase_project_ref
   supabase secrets set GEMINI_API_KEY=your_gemini_api_key
   ```

4. **Deploying Edge Functions**:
   Deploy the generator function to your Supabase project:
   ```bash
   supabase functions deploy generate-course
   ```

5. **Start Dev Server**:
   ```bash
   npm run dev
   ```

---

## 📬 API Integration Detail

The frontend communicates with the AI Edge Function by triggering an authenticated HTTP POST request to `/functions/v1/generate-course`.

```typescript
// Request Body Format
interface GenerationRequest {
  topic: string;
  knowledge_level: string;
  goal: string;
  time_commitment: string;
  difficulty: string;
}

// Edge Function Response
interface GenerationResponse {
  courseId: string;
}
```

The serverless function utilizes Deno's native fetch api to call Google's Gemini endpoint with strict response formatting configurations (`responseMimeType: "application/json"`) to ensure correct parsing and prevent format mismatches.
