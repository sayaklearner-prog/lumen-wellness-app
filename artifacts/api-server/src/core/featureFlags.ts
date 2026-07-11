export type FeatureFlag = "enable_v2_ai_agents" | "enable_pgvector_search" | "enable_predictive_recovery";

class FeatureFlagsManager {
  private flags = new Map<FeatureFlag, boolean>();

  constructor() {
    // Defaults for local dev. In production, these should come from env or remote config.
    this.flags.set("enable_v2_ai_agents", process.env.FF_V2_AI_AGENTS === "true");
    this.flags.set("enable_pgvector_search", process.env.FF_PGVECTOR_SEARCH === "true");
    this.flags.set("enable_predictive_recovery", process.env.FF_PREDICTIVE_RECOVERY === "true");
  }

  isEnabled(flag: FeatureFlag): boolean {
    return this.flags.get(flag) ?? false;
  }

  enable(flag: FeatureFlag) {
    this.flags.set(flag, true);
  }

  disable(flag: FeatureFlag) {
    this.flags.set(flag, false);
  }
}

export const featureFlags = new FeatureFlagsManager();
