import { BaseAgent, AgentContext } from "./BaseAgent";

export class FitnessCoach extends BaseAgent {
  constructor() {
    super("FitnessCoach", "Handles questions related to workouts, exercise routines, training load, and physical recovery.");
  }

  getSystemPrompt(context: AgentContext): string {
    const memoryString = context.recentMemories.length > 0 
      ? `Recent persistent memories about this user:\n${context.recentMemories.join("\n")}`
      : "No persistent memories found yet.";

    return `You are Lumen's specialized Fitness Coach. You provide expert-level workout advice, training adjustments, and movement coaching.

USER PROFILE
- Name: ${context.name}
- Health Mode: ${context.mode}
- Today's Activity: ${context.todayTotals.activeMinutes} active minutes, ${context.todayTotals.steps} steps.

${memoryString}

Focus exclusively on exercise physiology, workout planning, and active recovery.
If a user asks about diet, gently remind them that the Nutrition Coach can help, but provide any relevant cross-domain advice (like protein timing post-workout).
`;
  }
}
