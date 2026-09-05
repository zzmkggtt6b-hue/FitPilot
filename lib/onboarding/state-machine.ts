import type { OnboardingState } from "./types";

export function nextState(state: OnboardingState, profile: Record<string, unknown>): OnboardingState {
  if (state === "NOT_STARTED") return "LANGUAGE";
  if (state === "LANGUAGE") return "CONSENT";
  if (state === "CONSENT") return "BASIC_PROFILE";

  const hasBasic = profile.age != null && profile.height_cm != null && profile.weight_kg != null;
  if (state === "BASIC_PROFILE" && hasBasic) return "FITNESS_PROFILE";

  if (state === "FITNESS_PROFILE" && profile.experience_level != null) return "TRAINING_PROFILE";

  const hasTraining = profile.training_location != null && profile.days_per_week != null && profile.session_duration_minutes != null;
  if (state === "TRAINING_PROFILE" && hasTraining) return "GOALS";

  if (state === "GOALS" && Array.isArray(profile.goals) && profile.goals.length > 0) return "PREFERENCES";
  if (state === "PREFERENCES") return "REVIEW";
  return state;
}

export function missingFields(state: OnboardingState, profile: Record<string, unknown>): string[] {
  switch (state) {
    case "BASIC_PROFILE":
      return ["age", "height_cm", "weight_kg"].filter((key) => profile[key] == null);
    case "FITNESS_PROFILE":
      return profile.experience_level == null ? ["experience_level"] : [];
    case "TRAINING_PROFILE":
      return ["training_location", "days_per_week", "session_duration_minutes"].filter((key) => profile[key] == null);
    case "GOALS":
      return Array.isArray(profile.goals) && profile.goals.length ? [] : ["goals"];
    default:
      return [];
  }
}
