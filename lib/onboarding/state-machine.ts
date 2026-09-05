import type { OnboardingState } from "./types";

// The state machine decides only which onboarding step comes next.
// It does NOT decide what the user is allowed to say; the router extracts
// profile facts first, then this function checks what is still missing.
export function nextState(state: OnboardingState, profile: Record<string, unknown>): OnboardingState {
  if (state === "NOT_STARTED") return "LANGUAGE";
  if (state === "LANGUAGE") return "CONSENT";
  if (state === "CONSENT") return "BASIC_PROFILE";
  if (state === "PAUSED" || state === "COMPLETED") return state;

  // BASIC_PROFILE is complete only when all four core body/profile fields exist.
  const hasBasic = profile.age != null && profile.sex != null && profile.height_cm != null && profile.weight_kg != null;
  if (state === "BASIC_PROFILE" && hasBasic) return "FITNESS_PROFILE";

  // Training experience is collected after the basic profile.
  if (state === "FITNESS_PROFILE" && profile.experience_level != null) return "TRAINING_PROFILE";

  // The training step requires all three scheduling/location values.
  const hasTraining = profile.training_location != null && profile.days_per_week != null && profile.session_duration_minutes != null;
  if (state === "TRAINING_PROFILE" && hasTraining) return "GOALS";

  // At least one goal is required before preferences/review.
  if (state === "GOALS" && Array.isArray(profile.goals) && profile.goals.length > 0) return "PREFERENCES";
  if (state === "PREFERENCES") return "REVIEW";

  // If the current step is not complete, stay on that step and ask for the
  // first missing value instead of skipping information.
  return state;
}

// Returns the database fields that are still missing for the current step.
// This is useful for prompts and debugging because it makes the onboarding
// decision explicit instead of hiding it inside the AI.
export function missingFields(state: OnboardingState, profile: Record<string, unknown>): string[] {
  switch (state) {
    case "BASIC_PROFILE":
      return ["age", "sex", "height_cm", "weight_kg"].filter((key) => profile[key] == null);
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
