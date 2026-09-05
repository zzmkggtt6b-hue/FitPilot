import { extractOnboarding } from "@/lib/ai/extraction";
import { requestedLanguage } from "./language";
import type { ExtractionResult, OnboardingState, ProfileData } from "./types";

export type ProfileRoute = {
  extraction: ExtractionResult;
  fields: Partial<ProfileData>;
  language?: "nl" | "en";
};

function deterministicFields(message: string): Partial<ProfileData> {
  const value = message.toLowerCase().replace(/,/g, ".");
  const fields: Partial<ProfileData> = {};
  const age = value.match(/\b(?:age|leeftijd)\s*[:=]?\s*(\d{2})\b|\bi(?:'m| am| ben)\s+(\d{2})\b/);
  if (age) fields.age = Number(age[1] ?? age[2]);
  if (/\b(male|man|mannelijk)\b/.test(value)) fields.sex = "male";
  else if (/\b(female|vrouw|vrouwelijk|woman)\b/.test(value)) fields.sex = "female";
  const cm = value.match(/\b(\d{2,3}(?:\.\d)?)\s*(?:cm|centimeter(?:s)?)\b/);
  if (cm) fields.height_cm = Number(cm[1]);
  else {
    const feet = value.match(/\b(?:height\s*)?(\d)\s*(?:ft|feet|foot|')\s*(\d{1,2})?\s*(?:in|inch(?:es)?|\")?\b/);
    if (feet) fields.height_cm = Math.round(((Number(feet[1]) * 12 + Number(feet[2] ?? 0)) * 2.54) * 10) / 10;
  }
  const kg = value.match(/\b(\d{2,3}(?:\.\d)?)\s*(?:kg|kilo(?:s)?|kilogram(?:s)?)\b/);
  if (kg) fields.weight_kg = Number(kg[1]);
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

function mergeFields(deterministic: Partial<ProfileData>, extracted: Partial<ProfileData>): Partial<ProfileData> {
  return { ...deterministic, ...extracted };
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
    extraction = { intent: "answer", fields: deterministicFields(input.message) };
  }

  const fields = mergeFields(deterministicFields(input.message), extraction.fields);
  const languageField = typeof fields.language === "string" ? fields.language : "";
  const language = extraction.intent === "language_change" || languageField
    ? requestedLanguage(languageField, input.currentLanguage)
    : undefined;

  return { extraction, fields, language };
}
