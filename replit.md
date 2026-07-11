# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Artifacts

### Lumen — AI Wellness (`artifacts/wellness`)
A modern AI-powered wellness web app tracking fitness, sleep, nutrition, and screen time.

**Stack:** React 18 + Vite, wouter, TanStack Query, Tailwind v4, shadcn/ui, lucide-react, recharts, framer-motion, react-hook-form, zod. Talks to API server via the auto-generated `@workspace/api-client-react` hooks (do not call `setBaseUrl`; the dev server proxies `/api/*`).

**Pages:** Today (dashboard with diabetes glucose tile when applicable), AI Coach (real Anthropic SSE streaming, conversation history, voice input/output, photo attach), Nutrition (real photo food recognition via Claude vision + manual log), Activity (real DeviceMotion accelerometer/gyroscope tracking), Sleep, Screen Time / Focus Time (real Page Visibility tracking by route), Planner, Badges, Connections (Apple Health zip import, Google Fit/Fitbit/Oura/Garmin/Whoop mock OAuth sync), Glucose (diabetes mode only — readings, TIR%, 14-day chart), Onboarding wizard (name, mode, targets, permissions), Settings (profile, diabetes targets, permissions, reminders), Upgrade.

**Design rule:** No emojis anywhere — use lucide icons only.

**Onboarding gate:** `App.tsx` redirects any user with `profile.onboardingComplete === false` to `/onboarding` until completion.

**Streaming AI:** Coach uses raw `fetch` against `${BASE_URL}api/anthropic/conversations/:id/messages` to consume SSE; the generated mutation hook `useSendAnthropicMessage` is intentionally bypassed for the live token stream. Invalidate `getListAnthropicMessagesQueryKey(id)` after `data.done`.

**New custom hooks:** `useDeviceMotion`, `useAppFocusTracker`, `useSpeech` (in `artifacts/wellness/src/hooks/`).

### API Server (`artifacts/api-server`)
Express 5 + Drizzle ORM + Postgres. Auto-seeds 14 days of demo data for a single profile on startup. All wellness logic (deterministic scoring, condition-aware recommendations, weekly/monthly plans, food recognition catalog, system-prompt builder) lives in `src/lib/wellness.ts`. Routes under `src/routes/` cover profile, dashboard, scores, meals, workouts, sleep, screen-time, ai (legacy), reminders, sensors, planner, badges/streaks, premium toggle, **anthropic** (conversations + SSE messages, model `claude-sonnet-4-6`, image input via `imageBase64`), **vision** (Claude vision food analysis), **connections** (list/connect/disconnect/sync, Apple Health export.zip ingest via adm-zip + fast-xml-parser), **focus** (in-app focus sessions), **glucose** (readings + TIR summary), **onboarding** (complete).

Anthropic SDK access via `@workspace/integrations-anthropic-ai` (auto-set env: `AI_INTEGRATIONS_ANTHROPIC_BASE_URL`, `AI_INTEGRATIONS_ANTHROPIC_API_KEY`). Use `anthropic.messages.stream()` for SSE. Image `media_type` MUST narrow to `"image/jpeg" | "image/png" | "image/gif" | "image/webp"` — Anthropic SDK rejects raw `string`. Body parser raised to 150mb for Apple Health zips.

**Schema:** profiles (now includes glucoseTargetLow/High, dailyCarbLimit, onboardingComplete, voiceEnabled, motionPermissionGranted, notificationsEnabled), meals, workouts, sleep, screen_time, reminders, sensor_activity, **conversations**, **messages**, **app_focus_sessions**, **health_connections**, **glucose_readings** (`lib/db/src/schema/wellness.ts` + `conversations.ts` + `messages.ts`).

**Health modes:** standard, diabetes, hypertension, heart_health, pregnancy, weight_loss, muscle_gain.

**Connection providers:** apple_health, google_fit, fitbit, garmin, oura, whoop, manual.

### Canvas / Mockup Sandbox (`artifacts/mockup-sandbox`)
Vite component preview server for design exploration.

## Workflow Notes
- After schema changes, rebuild project references: `pnpm --filter @workspace/db exec tsc -b` and `pnpm --filter @workspace/api-zod exec tsc -b`.
- Mutation invalidation pattern: `useQueryClient` + `getListXxxQueryKey()` + `getGetTodayDashboardQueryKey()`.
- Free tier limits AI chat to 3 messages until `useTogglePremium` flips premium on.
