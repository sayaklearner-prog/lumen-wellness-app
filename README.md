# Lumen Health OS

Lumen Health OS is a premium, personal wellness companion and bio-tracker. It unifies logging, biometric analytics, calendar planning, sleep targets, and screen time management with a state-of-the-art conversational AI Coach. 

---

## Architecture & Repositories

The project is divided into two primary parts:

### 1. Backend Service (FastAPI)
The backend manages data persistence, AI generation, and biometric computations.
* **Technology Stack**: FastAPI, SQLAlchemy, SQLite, Uvicorn, Pydantic, Anthropic API (for coach), OpenAI GPT-4o-mini (for vision scanning and health intelligence reports).
* **Key Features**:
  * **AI Fitness Hub**: Readiness score calculator (`/workouts/readiness`), challenges generator, and active workouts analysis.
  * **AI Coach Router**: Conversational AI Coach grounded in SQLite database metrics to prevent hallucinations.
  * **AI Health Report Generator**: Dynamic weekly and monthly biometrics summarizer.
  * **Multimodal Nutrition Scanner**: Recognizes meals from uploaded camera pictures, estimates macros, and lists vitamins.
  * **Settings Sync**: Automatically updates targets for sleep, steps, and calories.

### 2. Frontend Application (Vite + React)
A premium, Apple/WHOOP/Oura-grade client dashboard.
* **Technology Stack**: React, TypeScript, Vite, Tailwind CSS, Framer Motion, Recharts, Wouter, React Query (for syncing).
* **Key Features**:
  * **Redesigned Landing Page**: Premium marketing page featuring a floating glass navbar, parallax hero sections, animated counters, FAQ accordions, and integrated lifestyle photography.
  * **Onboarding Stepper**: Multi-step wizard collecting health modes (Standard, Diabetes, Weight Loss, etc.) and biometric targets.
  * **Today's Dashboard**: Overview of today's scores, active timers, logs, and timeline.
  * **Nutrition Log**: Grouped daily meal layout (Breakfast, Lunch, Dinner, Snacks) with camera scanner.
  * **Settings Controls**: Manage profiles, target baselines, and custom reminders/alarms.

---

## How to Run the App Locally

### 1. Running the Backend
1. Navigate to the `backend` directory:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt   # Or use pyproject.toml / pip install .
   ```
4. Set up your `.env` variables (e.g. `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `DATABASE_URL`).
5. Run the server:
   ```bash
   uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
   ```

### 2. Running the Frontend
1. Navigate to the root directory (ensure you have `pnpm` installed):
   ```bash
   npm install -g pnpm
   ```
2. Install the monorepo dependencies:
   ```bash
   pnpm install
   ```
3. Compile the shared packages in the `lib` directory:
   ```bash
   pnpm run typecheck:libs
   ```
4. Run the frontend application:
   ```bash
   npx pnpm --filter @workspace/wellness run dev
   ```
5. Open your browser and navigate to `http://localhost:3000`.

---

## GitHub Upload Instructions
When uploading to GitHub, ensure that:
* Your `.env` files are in `.gitignore` and **not** committed.
* Sub-folders like `node_modules` and Python `venv` folders are excluded.
* Use `Frontend 1.zip` (Vite workspace) and `Frontend 2.zip` (shared local package dependencies and configuration) to set up the frontend repository.
* Use `lumen-backend.zip` to set up the backend repository.
