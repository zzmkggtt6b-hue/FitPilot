import { extractOnboarding } from "@/lib/ai/extraction";
import { parseLanguage, requestedLanguage } from "./language";
import type { ExtractionResult, OnboardingState, ProfileData } from "./types";

export type ProfileRoute = {
  extraction: ExtractionResult;
  fields: Partial<ProfileData>;
  language?: "nl" | "en";
};

function deterministicFields(message: string, state: OnboardingState, profile: Record<string, unknown>): Partial<ProfileData> {
  const value = message.toLowerCase().replace(/,/g, ".");
  const fields: Partial<ProfileData> = {};

  const age = value.match(/\b(?:age|leeftijd)\s*[:=]?\s*(\d{2})\b|\bi(?:'m| am| ben)\s+(\d{2})\b/);
  if (age) fields.age = Number(age[1] ?? age[2]);

  if (/\b(male|man|mannelijk|man)\b/.test(value)) fields.sex = "male";
  else if (/\b(female|vrouw|vrouwelijk|woman)\b/.test(value)) fields.sex = "female";

  const cm = value.match(/\b(\d{2,3}(?:\.\d)?)\s*(?:cm|centimeter(?:s)?)\b/);
  if (cm) fields.height_cm = Number(cm[1]);
  else {
    const feet = value.match(/(?:^|\s)(\d)\s*(?:ft|feet|foot|')\s*(\d{1,2})?\s*(?:in|inch(?:es)?|\")?(?=\s|$)/);
    if (feet) fields.height_cm = Math.round(((Number(feet[1]) * 12 + Number(feet[2] ?? 0)) * 2.54) * 10) / 10;
  }

  const kg = value.match(/\b(\d{2,3}(?:\.\d)?)\s*(?:kg|kilo(?:s)?|kilogram(?:s)?)\b/);
  if (kg) fields.weight_kg = Number(kg[1]);

  // Telegram users often answer a single requested number without its unit.
  // Interpret a bare number only when the current state makes its meaning unambiguous.
  const bareNumber = value.match(/^\s*(\d{1,3}(?:\.\d+)?)\s*$/)?.[1];
  if (bareNumber) {
    const number = Number(bareNumber);
    if (state === "BASIC_PROFILE") {
      if (profile.age == null && number >= 13 && number <= 100) fields.age = number;
      else if (profile.height_cm == null && number >= 100 && number <= 250) fields.height_cm = number;
      else if (profile.weight_kg == null && number >= 30 && number <= 300) fields.weight_kg = number;
    } else if (state === "TRAINING_PROFILE") {
      if (profile.days_per_week == null && Number.isInteger(number) && number >= 1 && number <= 7) fields.days_per_week = number;
      else if (profile.session_duration_minutes == null && Number.isInteger(number) && number >= 15 && number <= 300) fields.session_duration_minutes = number;
    }
  }

  if (/\b(beginner|beginners|beginnen|novice|new to training|net begonnen)\b/.test(value)) fields.experience_level = "beginner";
  else if (/\b(intermediate|gemiddeld|halfgevorderd|some experience)\b/.test(value)) fields.experience_level = "intermediate";
  else if (/\b(advanced|gevorderd|expert|experienced)\b/.test(value)) fields.experience_level = "advanced";

  const days = value.match(/\b(\d)\s*(?:days?|dagen?)\s*(?:per|a)\s*(?:week)?\b|\b(\d)\s*x\s*(?:per\s*)?week\b/);
  if (days) fields.days_per_week = Number(days[1] ?? days[2]);
  const duration = value.match(/\b(\d{2,3})\s*(?:min(?:ute)?s?|minuten?)\b/);
  if (duration) fields.session_duration_minutes = Number(duration[1]);

  if (/\b(gym|sportschool|fitnesscentrum)\b/.test(value)) fields.training_location = "gym";
  else if (/\b(home|thuis)\b/.test(value)) fields.training_location = "home";
  else if (/\b(both|beide|gym and home|thuis en sportschool)\b/.test(value)) fields.training_location = "both";

  const goals: ProfileData["goals"] = [];
  if (/\b(muscle|spier|spiermassa|hypertrophy)\b/.test(value)) goals.push("muscle_gain");
  if (/\b(fat loss|vetverlies|afvallen|lose weight)\b/.test(value)) goals.push("fat_loss");
  if (/\b(strength|kracht)\b/.test(value)) goals.push("strength");
  if (/\b(general fitness|algemene fitheid|fit worden)\b/.test(value)) goals.push("general_fitness");
  if (/\b(endurance|conditie|uithoudingsvermogen)\b/.test(value)) goals.push("endurance");
  if (/\b(recomposition|recompositie|body recomposition)\b/.test(value)) goals.push("body_recomposition");
  if (goals.length) fields.goals = [...new Set(goals)];

  return fields;
}

function hasEvidenceForField(field: keyof ProfileData, message: string, state: OnboardingState, profile: Record<string, unknown>): boolean {
  const value = message.toLowerCase();
  switch (field) {
    case "age": return /\b(age|leeftijd|i(?:'m| am| ben)\s+\d{2})\b/i.test(value);
    case "sex": return /\b(male|female|man|vrouw|mannelijk|vrouwelijk|woman)\b/i.test(value);
    case "height_cm": return /\b\d{2,3}(?:[.,]\d)?\s*(?:cm|centimeter(?:s)?)\b/i.test(value) || /(?:^|\s)\d\s*(?:ft|feet|foot|')\s*\d{0,2}/i.test(value) || (state === "BASIC_PROFILE" && profile.height_cm == null && /^\s*\d{3}(?:[.,]\d+)?\s*$/.test(value));
    case "weight_kg": return /\b\d{2,3}(?:[.,]\d+)?\s*(?:kg|kilo(?:s)?|kilogram(?:s)?)\b/i.test(value) || (state === "BASIC_PROFILE" && profile.weight_kg == null && /^\s*\d{2,3}(?:[.,]\d+)?\s*$/.test(value));
    case "days_per_week": return /\b\d\s*(?:days?|dagen?)\b|\b\d\s*x\s*(?:per\s*)?week\b/i.test(value) || (state === "TRAINING_PROFILE" && profile.days_per_week == null && /^\s*[1-7]\s*$/.test(value));
    case "session_duration_minutes": return /\b\d{2,3}\s*(?:min(?:ute)?s?|minuten?)\b/i.test(value) || (state === "TRAINING_PROFILE" && profile.session_duration_minutes == null && /^\s*\d{2,3}\s*$/.test(value));
    default: return true;
  }
}

function sanitizeExtractedFields(extracted: Partial<ProfileData>, message: string, state: OnboardingState, profile: Record<string, unknown>): Partial<ProfileData> {
  return Object.fromEntries(Object.entries(extracted).filter(([key]) => hasEvidenceForField(key as keyof ProfileData, message, state, profile))) as Partial<ProfileData>;
}

function mergeFields(deterministic: Partial<ProfileData>, extracted: Partial<ProfileData>): Partial<ProfileData> {
  // Deterministic parsing wins when both parsers found a value in the user's text.
  return { ...extracted, ...deterministic };
}

export async function routeProfileMessage(input: {
  state: OnboardingState;
  message: string;
  profile: Record<string, unknown>;
  currentLanguage: "nl" | "en";
}): Promise<ProfileRoute> {
  let extraction: ExtractionResult;
  try {
    extraction = await extractOnboarding({ state: input.state, message: input.message, profile: input.profile });
  } catch (error) {
    console.error("FitPilot extraction failed; using deterministic fallback", { error, state: input.state });
    extraction = { intent: "answer", fields: deterministicFields(input.message, input.state, input.profile) };
  }

  const sanitized = sanitizeExtractedFields(extraction.fields, input.message, input.state, input.profile);
  const deterministic = deterministicFields(input.message, input.state, input.profile);
  const fields = mergeFields(deterministic, sanitized);
  const languageField = typeof fields.language === "string" ? fields.language : "";
  const language = parseLanguage(input.message) ?? (extraction.intent === "language_change" || languageField ? requestedLanguage(languageField, input.currentLanguage) : undefined);

  return { extraction: { ...extraction, fields }, fields, language };
}
