import { generateGoalAdvice } from "@/lib/ai/advice";
import { extractOnboarding } from "@/lib/ai/extraction";
import { nextState } from "./state-machine";
import { ensureSession, loadProfile, resetProfile, saveProfile, setState } from "./repository";
import { isLanguageChange, parseLanguage, requestedLanguage } from "./language";
import type { OnboardingState, ProfileData } from "./types";

const prompts: Record<OnboardingState, { nl: string; en: string }> = {
  NOT_STARTED: { nl: "Welkom bij FitPilot! 🏋️ Ik help je een persoonlijk fitnessprofiel opbouwen. In welke taal wil je verder? (Nederlands/English)", en: "Welcome to FitPilot! 🏋️ I’ll help you build a personal fitness profile. Which language would you like to continue in? (Nederlands/English)" },
  LANGUAGE: { nl: "In welke taal wil je verder? 🇳🇱 Nederlands of 🇬🇧 English?", en: "Which language would you like to continue in? 🇳🇱 Nederlands or 🇬🇧 English?" },
  CONSENT: { nl: "Voordat we beginnen: je deelt persoonlijke fitnessgegevens. FitPilot gebruikt die alleen om je profiel en coaching te leveren. Ga je hiermee akkoord? (ja/nee)", en: "Before we start: you will share personal fitness data. FitPilot uses it only to provide your profile and coaching. Do you agree? (yes/no)" },
  BASIC_PROFILE: { nl: "Wat is je leeftijd? Je mag leeftijd, geslacht, lengte en gewicht ook in één bericht sturen.", en: "How old are you? You can also send your age, sex, height and weight in one message." },
  FITNESS_PROFILE: { nl: "Hoeveel ervaring heb je met trainen? Vertel ook gerust hoe regelmatig je de laatste tijd hebt getraind.", en: "How much training experience do you have? Feel free to tell me how regularly you’ve been training recently." },
  TRAINING_PROFILE: { nl: "Waar train je meestal: sportschool, thuis of beide? Je kunt ook meteen je trainingsdagen en duur noemen.", en: "Where do you usually train: gym, home or both? You can also include your training days and typical session duration." },
  GOALS: { nl: "Wat is je belangrijkste doel? Bijvoorbeeld spiermassa, vetverlies, kracht, algemene fitheid, conditie of recompositie.", en: "What is your main goal? For example: muscle gain, fat loss, strength, general fitness, endurance or body recomposition." },
  PREFERENCES: { nl: "Zijn er voorkeuren, oefeningen die je graag doet, oefeningen die je wilt vermijden of materiaalbeperkingen waarmee ik rekening moet houden? Je kunt ook gewoon 'geen' zeggen.", en: "Do you have any preferences, exercises you like, exercises you want to avoid, or equipment limitations I should consider? You can also just say 'none'." },
  REVIEW: { nl: "", en: "" },
  COMPLETED: { nl: "Je profiel is compleet. 🎉", en: "Your profile is complete. 🎉" },
  PAUSED: { nl: "Je onboarding staat gepauzeerd. Typ 'doorgaan' om verder te gaan.", en: "Your onboarding is paused. Type 'resume' to continue." },
};

function languageFor(profile: Record<string, unknown>): "nl" | "en" { return profile.language === "en" ? "en" : "nl"; }
function promptFor(state: OnboardingState, profile: Record<string, unknown>) { return prompts[state][languageFor(profile)]; }

function isProfileSummaryRequest(message: string) { return /\b(what do you know about me|what info do you have|wat weet je (nu )?al over mij|welke informatie heb je|mijn profiel|my profile)\b/i.test(message); }
function isGoalAdviceRequest(message: string) { return /\b(wat (kan|zou) je (mij )?(adviseren|aanraden)|wat raad je (mij )?aan|geen idee (wat|welk|welke)|ik weet (het )?niet (wat|welk|welke)|help me (choose|kiezen)|which goal|what goal|recommend.*goal|advice.*goal|doel.*advies|advies.*doel)\b/i.test(message); }
function isStop(message: string) { return /^\/(stop|pause)$|^(stop|pauze|pause)$/i.test(message.trim()); }
function isResume(message: string) { return /^\/(resume|continue)$|^(resume|doorgaan|continue|ga door)$/i.test(message.trim()); }

function missingPrompt(state: OnboardingState, profile: Record<string, unknown>): string {
  const en = languageFor(profile) === "en";
  if (state === "BASIC_PROFILE") {
    if (profile.age == null) return en ? "How old are you?" : "Hoe oud ben je?";
    if (profile.height_cm == null) return en ? "What is your height in cm?" : "Wat is je lengte in cm?";
    if (profile.weight_kg == null) return en ? "What is your weight in kg?" : "Wat is je gewicht in kg?";
    return "";
  }
  if (state === "FITNESS_PROFILE" && profile.experience_level == null) return en ? "How much training experience do you have?" : "Hoeveel ervaring heb je met trainen?";
  if (state === "TRAINING_PROFILE") {
    if (profile.training_location == null) return en ? "Where do you usually train: gym, home or both?" : "Waar train je meestal: sportschool, thuis of beide?";
    if (profile.days_per_week == null) return en ? "How many days per week do you usually train?" : "Hoeveel dagen per week train je meestal?";
    if (profile.session_duration_minutes == null) return en ? "How long is your typical workout, in minutes?" : "Hoe lang duurt je training meestal, in minuten?";
    return "";
  }
  if (state === "GOALS" && (!Array.isArray(profile.goals) || profile.goals.length === 0)) return prompts.GOALS[languageFor(profile)];
  if (state === "PREFERENCES") return prompts.PREFERENCES[languageFor(profile)];
  return promptFor(state, profile);
}

function summary(profile: Record<string, unknown>) {
  const en = languageFor(profile) === "en";
  const goals = Array.isArray(profile.goals) ? profile.goals.join(", ") : "-";
  return (en
    ? ["📋 Your FitPilot profile", `Age: ${profile.age ?? "-"}`, `Sex: ${profile.sex ?? "-"}`, `Height: ${profile.height_cm ?? "-"} cm`, `Weight: ${profile.weight_kg ?? "-"} kg`, `Experience: ${profile.experience_level ?? "-"}`, `Training location: ${profile.training_location ?? "-"}`, `Days per week: ${profile.days_per_week ?? "-"}`, `Session duration: ${profile.session_duration_minutes ?? "-"} min`, `Goals: ${goals}`, `Preferences/restrictions: ${profile.exercise_preferences ?? profile.exercise_restrictions ?? "-"}]
    : ["📋 Je FitPilot-profiel", `Leeftijd: ${profile.age ?? "-"}`, `Geslacht: ${profile.sex ?? "-"}`, `Lengte: ${profile.height_cm ?? "-"} cm`, `Gewicht: ${profile.weight_kg ?? "-"} kg`, `Ervaring: ${profile.experience_level ?? "-"}`, `Trainingslocatie: ${profile.training_location ?? "-"}`, `Dagen per week: ${profile.days_per_week ?? "-"}`, `Duur per training: ${profile.session_duration_minutes ?? "-"} min`, `Doelen: ${goals}`, `Voorkeuren/beperkingen: ${profile.exercise_preferences ?? profile.exercise_restrictions ?? "-"}`]
  ).join("\n");
}

function deterministicFields(message: string): Partial<ProfileData> {
  const value = message.toLowerCase().replace(/,/g, ".");
  const fields: Partial<ProfileData> = {};
  const age = value.match(/\b(?:age|leeftijd)\s*[:=]?\s*(\d{2})\b|\bi(?:'m| am| ben)\s+(\d{2})\b/);
  if (age) fields.age = Number(age[1] ?? age[2]);

  if (/\b(male|man|man(?:nel(?:ijk)?)?|m)\b/.test(value)) fields.sex = "male";
  else if (/\b(female|vrouw|vrouwel(?:ijk)?|woman|f)\b/.test(value)) fields.sex = "female";

  const cm = value.match(/\b(\d{2,3}(?:\.\d)?)\s*(?:cm|centimeter(?:s)?)\b/);
  if (cm) fields.height_cm = Number(cm[1]);
  else {
    const feet = value.match(/\b(?:height\s*)?(\d)\s*(?:ft|feet|foot|')\s*(\d{1,2})?\s*(?:in|inch(?:es)?|\")?\b/);
    if (feet) fields.height_cm = Math.round(((Number(feet[1]) * 12 + Number(feet[2] ?? 0)) * 2.54) * 10) / 10;
  }

  const kg = value.match(/\b(\d{2,3}(?:\.\d)?)\s*(?:kg|kilo(?:s)?|kilogram(?:s)?)\b/);
  if (kg) fields.weight_kg = Number(kg[1]);

  if (/\b(beginner|beginnen|beginner(?:s)?|novice|new to training|net begonnen)\b/.test(value)) fields.experience_level = "beginner";
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

export async function startOnboarding(userId: string) {
  const session = await ensureSession(userId);
  const profile = await loadProfile(userId);
  const state = session.current_state as OnboardingState;
  if (state === "PAUSED") {
    const resumeState = (session.paused_from_state as OnboardingState | null) ?? "BASIC_PROFILE";
    await setState(userId, resumeState);
    return missingPrompt(resumeState, await loadProfile(userId));
  }
  if (state !== "NOT_STARTED" && state !== "LANGUAGE" && state !== "COMPLETED") return missingPrompt(state, profile);
  if (state === "COMPLETED") return languageFor(profile) === "en" ? "Your profile is already complete. Type /restart if you want to start over." : "Je profiel is al compleet. Typ /restart als je opnieuw wilt beginnen.";
  await setState(userId, "LANGUAGE");
  return prompts.LANGUAGE[languageFor(profile)];
}

export async function processOnboardingMessage(userId: string, message: string): Promise<string> {
  const session = await ensureSession(userId);
  let state = session.current_state as OnboardingState;
  let profile = await loadProfile(userId);
  let currentLanguage = languageFor(profile);
  const trimmed = message.trim();

  if (/^\/restart$/i.test(trimmed)) {
    await resetProfile(userId);
    await setState(userId, "LANGUAGE");
    return prompts.LANGUAGE["nl"];
  }
  if (isStop(trimmed)) {
    if (state === "COMPLETED") return currentLanguage === "en" ? "Your profile is already complete." : "Je profiel is al compleet.";
    if (state !== "PAUSED") await setState(userId, "PAUSED", false, state);
    return currentLanguage === "en" ? "Paused. Type 'resume' when you want to continue." : "Gepauzeerd. Typ 'doorgaan' wanneer je verder wilt gaan.";
  }
  if (state === "PAUSED") {
    if (!isResume(trimmed)) return promptFor("PAUSED", profile);
    state = (session.paused_from_state as OnboardingState | null) ?? "BASIC_PROFILE";
    await setState(userId, state);
    profile = await loadProfile(userId);
    return missingPrompt(state, profile);
  }
  if (isResume(trimmed)) return missingPrompt(state, profile);

  if (state === "LANGUAGE") {
    const language = parseLanguage(trimmed);
    if (!language) return "Kies alsjeblieft Nederlands of English. 🇳🇱 / 🇬🇧";
    await saveProfile(userId, { language });
    await setState(userId, "CONSENT");
    return prompts.CONSENT[language];
  }

  if (isLanguageChange(trimmed)) {
    const parsed = parseLanguage(trimmed);
    if (parsed) {
      currentLanguage = parsed;
      await saveProfile(userId, { language: currentLanguage });
      profile = await loadProfile(userId);
      return missingPrompt(state, profile) || (currentLanguage === "en" ? "Got it. We’ll continue in English." : "Prima. We gaan verder in het Nederlands.");
    }
  }

  if (isProfileSummaryRequest(trimmed)) {
    const next = missingPrompt(state, profile);
    return summary(profile) + (state === "REVIEW"
      ? (currentLanguage === "en" ? "\n\nDoes this look correct? Reply 'yes' to confirm, or tell me what to change." : "\n\nKlopt dit? Antwoord 'ja' om te bevestigen, of vertel wat ik moet aanpassen.")
      : next ? `\n\n${next}` : "");
  }

  if (state === "CONSENT") {
    const consent = /^(ja|yes|y|akkoord|agree|i agree|ik ga akkoord)$/i.test(trimmed);
    if (!consent) return currentLanguage === "en"
      ? "No problem. Without consent I can’t save a personal fitness profile. Send 'yes' to continue, or tell me if you want to switch language."
      : "Geen probleem. Zonder akkoord kan ik geen persoonlijk fitnessprofiel opslaan. Stuur 'ja' om door te gaan, of zeg het als je van taal wilt wisselen.";
    await saveProfile(userId, { consent: true });
    await setState(userId, "BASIC_PROFILE");
    profile = await loadProfile(userId);
    return missingPrompt("BASIC_PROFILE", profile);
  }

  if (state === "GOALS" && isGoalAdviceRequest(trimmed)) return generateGoalAdvice(profile, currentLanguage);
  if (state === "COMPLETED") return currentLanguage === "en" ? "Your profile is already complete. Type /restart if you want to start over." : "Je profiel is al compleet. Typ /restart als je opnieuw wilt beginnen.";
  if (state === "REVIEW" && /^(ja|yes|y|klopt|correct)$/i.test(trimmed)) {
    await setState(userId, "COMPLETED", true);
    return currentLanguage === "en" ? "Profile confirmed! 🎉 Your FitPilot profile has been saved." : "Profiel bevestigd! 🎉 Je FitPilot-profiel is opgeslagen.";
  }

  let extraction;
  try {
    extraction = await extractOnboarding({ state, message, profile });
  } catch (error) {
    console.error("FitPilot extraction failed; using deterministic fallback", { error, userId, state });
    extraction = { intent: "answer" as const, fields: deterministicFields(message) };
  }

  const deterministic = deterministicFields(message);
  const fields = { ...deterministic, ...extraction.fields };
  if (extraction.intent === "language_change" || fields.language) {
    const language = requestedLanguage(String(fields.language ?? ""), currentLanguage);
    await saveProfile(userId, { language });
    profile = await loadProfile(userId);
    return missingPrompt(state, profile) || (language === "en" ? "Got it. We’ll continue in English." : "Prima. We gaan verder in het Nederlands.");
  }
  if (extraction.intent === "restart") {
    await resetProfile(userId);
    await setState(userId, "LANGUAGE");
    return prompts.LANGUAGE["nl"];
  }
  if (extraction.intent === "question") {
    const next = missingPrompt(state, profile);
    return `${currentLanguage === "en" ? "Good question. Here’s what I currently have:" : "Goede vraag. Dit is wat ik momenteel van je heb:"}\n\n${summary(profile)}${next ? `\n\n${next}` : ""}`;
  }
  if (Object.keys(fields).length === 0) {
    const next = missingPrompt(state, profile);
    return currentLanguage === "en" ? `I couldn't extract any new profile information.${next ? ` ${next}` : " Please tell me a little more."}` : `Ik kon nog geen nieuwe profielinformatie vinden.${next ? ` ${next}` : " Kun je iets meer vertellen?"}`;
  }

  const { language: _language, ...profileFields } = fields;
  await saveProfile(userId, profileFields as ProfileData);
  profile = await loadProfile(userId);
  const newState = nextState(state, profile);
  await setState(userId, newState);
  if (newState === "REVIEW") {
    return summary(profile) + (languageFor(profile) === "en"
      ? "\n\nDoes this look correct? Reply 'yes' to confirm, or tell me what to change."
      : "\n\nKlopt dit? Antwoord 'ja' om te bevestigen, of vertel wat ik moet aanpassen.");
  }
  return missingPrompt(newState, profile);
}
