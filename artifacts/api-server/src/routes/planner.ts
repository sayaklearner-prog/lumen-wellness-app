import { Router, type IRouter } from "express";
import {
  GetWeeklyPlanQueryParams,
  GetWeeklyPlanResponse,
  GetMonthlyPlanQueryParams,
  GetMonthlyPlanResponse,
} from "@workspace/api-zod";
import { getOrCreateProfile } from "../lib/store";
import { startOfWeek, buildWeeklyPlan, buildMonthlyPlan } from "../lib/wellness";

const router: IRouter = Router();

router.get("/planner/weekly", async (req, res): Promise<void> => {
  const parsed = GetWeeklyPlanQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const profile = await getOrCreateProfile();
  const weekStart = parsed.data.weekStart
    ? new Date(parsed.data.weekStart)
    : startOfWeek(new Date());
  res.json(GetWeeklyPlanResponse.parse(buildWeeklyPlan(profile, weekStart)));
});

router.get("/planner/monthly", async (req, res): Promise<void> => {
  const parsed = GetMonthlyPlanQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const profile = await getOrCreateProfile();
  const now = new Date();
  const monthStr =
    parsed.data.month ??
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [yearStr, monthIdxStr] = monthStr.split("-");
  const monthDate = new Date(Number(yearStr), Number(monthIdxStr) - 1, 1);
  res.json(GetMonthlyPlanResponse.parse(buildMonthlyPlan(profile, monthDate)));
});

export default router;
