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
* **AI Engine**: Google Gemini API (`gemini-3.1-pro-preview`).
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

**New to the project?** → See the [Quick Start Guide](QUICKSTART.md) for step-by-step instructions.

### Prerequisites
* [Node.js](https://nodejs.org) (v18+)
* [Supabase CLI](https://supabase.com/docs/guides/cli) (for database and edge function management)

### Local Configuration

1. **Clone and Install Dependencies**:
   ```bash
   npm install
   ```

2. **Frontend Environment Setup**:
   Create a `.env` file in the root directory for your frontend:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   VITE_GEMINI_API_KEY=your_gemini_api_key
   ```
   > ⚠️ Note: `VITE_` prefixed variables are for the frontend only and are publicly accessible in your built application.

3. **Configure Supabase Edge Function Secrets**:
   Edge functions run on Supabase servers and require separate configuration:
   ```bash
   # Login to Supabase
   supabase login
   
   # Link your project
   supabase link --project-ref your_project_ref
   
   # Set the Gemini API key (required for course generation)
   supabase secrets set GEMINI_API_KEY=your_gemini_api_key
   
   # Verify secrets were set
   supabase secrets list
   ```
   
   > 📚 For detailed edge function setup, see [`supabase/functions/README.md`](supabase/functions/README.md)

4. **Deploy Edge Functions**:
   ```bash
   supabase functions deploy generate-course
   ```

5. **Start Dev Server**:
   ```bash
   npm run dev
   ```

### Getting API Keys

- **Supabase Keys**: Dashboard > Settings > API
  - Use the **anon/public** key for `VITE_SUPABASE_ANON_KEY`
  - The **service_role** key is auto-injected into edge functions
- **Gemini API Key**: Get from [Google AI Studio](https://aistudio.google.com/app/apikey)

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

---

## 🐛 Troubleshooting

Having issues with setup or deployment? See the [Troubleshooting Guide](TROUBLESHOOTING.md) for common problems and solutions.

Quick checks:
```bash
# Verify frontend environment setup
npm run verify-setup

# Check Supabase secrets
supabase secrets list

# View edge function logs
supabase functions serve generate-course --debug
```

For detailed edge function configuration, see [`supabase/functions/README.md`](supabase/functions/README.md).

---

## 🔒 Security

Athenaeum follows Supabase's recommended security architecture. See the [Security Guide](SECURITY.md) for details on:

- Why `VITE_SUPABASE_ANON_KEY` is safe to expose
- How Row Level Security (RLS) protects your data
- Proper secrets management
- Security best practices

**Quick Security Note:**  
The `VITE_SUPABASE_ANON_KEY` in your frontend is **designed** to be public. It's protected by Row Level Security (RLS) policies in your database, ensuring users can only access their own data.

---

## 📁 Project Structure

```
athenaeum/
├── src/
│   ├── components/        # React components
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Utilities & API clients
│   └── types/            # TypeScript definitions
├── supabase/
│   ├── functions/        # Edge Functions (Deno)
│   │   ├── generate-course/
│   │   └── README.md     # Edge function setup guide
│   └── migrations/       # Database schema
├── scripts/
│   └── verify-setup.js   # Configuration checker
├── .env.example          # Environment template
└── TROUBLESHOOTING.md    # Common issues & solutions
```
