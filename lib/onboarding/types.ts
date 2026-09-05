export const ONBOARDING_STATES = [
  "NOT_STARTED",
  "LANGUAGE",
  "CONSENT",
  "BASIC_PROFILE",
  "FITNESS_PROFILE",
  "TRAINING_PROFILE",
  "GOALS",
  "PREFERENCES",
  "REVIEW",
  "COMPLETED",
] as const;

export type OnboardingState = (typeof ONBOARDING_STATES)[number];

export type Goal =
  | "muscle_gain"
  | "fat_loss"
  | "strength"
  | "general_fitness"
  | "endurance"
  | "body_recomposition";

export type TrainingLocation = "gym" | "home" | "both";
export type ExperienceLevel = "beginner" | "intermediate" | "advanced";

export type ProfileData = {
  language?: string;
  consent?: boolean;
  age?: number;
  sex?: "male" | "female" | "other" | "prefer_not_to_say";
  height_cm?: number;
  weight_kg?: number;
  experience_level?: ExperienceLevel;
  training_location?: TrainingLocation;
  days_per_week?: number;
  session_duration_minutes?: number;
  goals?: Goal[];
  preferred_days?: string[];
  preferred_time?: string;
  equipment?: string[];
  exercise_preferences?: string;
  exercise_restrictions?: string;
};

export type ExtractionResult = {
  intent: "answer" | "question" | "correction" | "restart" | "language_change" | "general";
  fields: Partial<ProfileData>;
  reply_hint?: string;
};
