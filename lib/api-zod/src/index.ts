export * from './generated/api';

// ── Backward-compat + missing aliases ──────────────────────────────────────
// Route files import names that no longer exist after API regeneration.
// Re-export / define them here so builds stay green without touching routes.
import * as zod from 'zod';

// Profile (renamed: Profile → MyProfile)
export {
  GetMyProfileResponse   as GetProfileResponse,
  UpdateMyProfileBody    as UpdateProfileBody,
  UpdateMyProfileResponse as UpdateProfileResponse,
} from './generated/api';

// Premium toggle (not in generated spec — define inline)
export const TogglePremiumBody = zod.object({ premium: zod.boolean() });
export const TogglePremiumResponse = zod.unknown();

// Onboarding complete (not generated — define inline)
export const CompleteOnboardingBody = zod.object({
  name: zod.string().optional(),
  mode: zod.string().optional(),
  dailyCalorieTarget: zod.number().optional(),
  dailyProteinTarget: zod.number().optional(),
  dailyStepsTarget: zod.number().optional(),
  dailySleepTargetHours: zod.number().optional(),
  dailyScreenTimeLimitMinutes: zod.number().optional(),
});

// Dashboard — badge (not generated)
export const GetBadgesResponse = zod.unknown();

// Anthropic conversation alias
export { CreateConversationBody as CreateAnthropicConversationBody } from './generated/api';

// Connections — Apple Health import (not generated — define inline)
export const ImportAppleHealthDataBody = zod.object({
  fileBase64: zod.string().optional(),
  zipBase64: zod.string().optional(),
  provider: zod.string().optional(),
  filename: zod.string().optional(),
});

// Focus sessions (not generated — define inline)
export const CreateFocusSessionBody = zod.object({
  category: zod.string(),
  durationSeconds: zod.number(),
  startedAt: zod.string(),
  endedAt: zod.string(),
  date: zod.string().optional(),
});

// Scores (not generated — define inline)
export const GetWeeklyScoresQueryParams = zod.object({
  weekStart: zod.string().optional(),
});
export const GetWeeklyScoresResponse = zod.unknown();
export const GetMonthlyScoresQueryParams = zod.object({
  month: zod.string().optional(),
});
export const GetMonthlyScoresResponse = zod.unknown();

// Planner (not generated — define inline)
export const GetWeeklyPlanQueryParams = zod.object({
  weekStart: zod.string().optional(),
});
export const GetWeeklyPlanResponse = zod.unknown();
export const GetMonthlyPlanQueryParams = zod.object({
  month: zod.string().optional(),
});
export const GetMonthlyPlanResponse = zod.unknown();

// Sensors (not generated — define inline)
export const IngestSensorActivityBody = zod.object({
  steps: zod.number(),
  durationSeconds: zod.number(),
  intensity: zod.string(),
  sampleCount: zod.number().optional(),
});
export const IngestSensorActivityResponse = zod.unknown();

// Vision / food photo (not generated — define inline)
export const AnalyzeFoodPhotoBody = zod.object({
  imageBase64: zod.string(),
  hint: zod.string().optional(),
});

// Meals — missing names + alias for RecognizeFood
export {
  RecognizeFoodBody    as RecognizeMealFromImageBody,
  RecognizeFoodResponse as RecognizeMealFromImageResponse,
  UpdateMealsParams    as UpdateMealParams,
  UpdateMealsBody      as UpdateMealBody,
  UpdateMealsResponse  as UpdateMealResponse,
  DeleteMealsParams    as DeleteMealParams,
} from './generated/api';
export const ListMealsQueryParams = zod.object({ date: zod.string().optional() });

// Glucose — use inline schema matching route field names (valueMgDl, context)
// (generated CreateGlucoseBody uses readingMgdl/contextType which differ)
export const CreateGlucoseReadingBody = zod.object({
  valueMgDl: zod.number(),
  context: zod.string().default('random'),
  notes: zod.string().nullable().optional(),
});
export { DeleteGlucoseParams as DeleteGlucoseReadingParams } from './generated/api';

// Screentime alias (casing mismatch: Screentime vs ScreenTime)
export {
  ListScreentimeResponse  as ListScreenTimeResponse,
  CreateScreentimeBody    as CreateScreenTimeBody,
} from './generated/api';

// Reminders alias
export {
  UpdateReminderParams   as UpdateReminderParams,
  DeleteReminderParams   as DeleteReminderParams,
} from './generated/api';

// Workouts — missing ListWorkoutsQueryParams + alias for DeleteWorkoutParams
export const ListWorkoutsQueryParams = zod.object({ date: zod.string().optional() });
export {
  DeleteWorkoutsParams as DeleteWorkoutParams,
} from './generated/api';

// AI route schemas (not generated — define inline for ai.ts route)
export const GetAiRecommendationsResponse = zod.array(zod.any());
export const GetAiInsightsResponse = zod.array(zod.any());
export const AskAiCoachBody = zod.object({ message: zod.string() });
export const AskAiCoachResponse = zod.object({ reply: zod.string() });
