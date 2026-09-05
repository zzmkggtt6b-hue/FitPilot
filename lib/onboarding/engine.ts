import { generateGoalAdvice } from "@/lib/ai/advice";
import { nextState } from "./state-machine";
import { ensureSession, loadProfile, resetProfile, saveProfile, setState } from "./repository";
import { isLanguageChange, parseLanguage } from "./language";
import { routeProfileMessage } from "./router";
import type { OnboardingState } from "./types";

const prompts: Record<OnboardingState, { nl: string; en: string }> = {
  NOT_STARTED: { nl: "Welkom bij FitPilot! 🏋️ Ik help je een persoonlijk fitnessprofiel opbouwen. In welke taal wil je verder? (Nederlands/English)", en: "Welcome to FitPilot! 🏋️ I’ll help you build a personal fitness profile. Which language would you like to continue in? (Nederlands/English)" },
  LANGUAGE: { nl: "In welke taal wil je verder? 🇳🇱 Nederlands of 🇬🇧 English?", en: "Which language would you like to continue in? 🇳🇱 Nederlands or 🇬🇧 English?" },
  CONSENT: { nl: "Voordat we beginnen: je deelt persoonlijke fitnessgegevens. FitPilot gebruikt die alleen om je profiel en coaching te leveren. Ga je hiermee akkoord? (ja/nee)", en: "Before we start: you will share personal fitness data. FitPilot uses it only to provide your profile and coaching. Do you agree? (yes/no)" },
  BASIC_PROFILE: { nl: "Wat is je leeftijd?", en: "How old are you?" },
  FITNESS_PROFILE: { nl: "Hoeveel ervaring heb je met trainen?", en: "How much training experience do you have?" },
  TRAINING_PROFILE: { nl: "Waar train je meestal: sportschool, thuis of beide?", en: "Where do you usually train: gym, home or both?" },
  GOALS: { nl: "Wat is je belangrijkste doel? Bijvoorbeeld spiermassa, vetverlies, kracht, algemene fitheid, conditie of recompositie.", en: "What is your main goal? For example: muscle gain, fat loss, strength, general fitness, endurance or body recomposition." },
  PREFERENCES: { nl: "Zijn er voorkeuren, oefeningen die je graag doet, oefeningen die je wilt vermijden of materiaalbeperkingen waarmee ik rekening moet houden? Je kunt ook gewoon 'geen' zeggen.", en: "Do you have preferences, exercises you like, exercises you want to avoid, or equipment limitations I should consider? You can also say 'none'." },
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
function isExplanationRequest(message: string) { return /\b(waarom|waarvoor|why|what.*for|do i need|moet ik|moet dit|heb je dit nodig|is dit nodig|waar is dit voor)\b/i.test(message); }

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
    ? ["📋 Your FitPilot profile", `Age: ${profile.age ?? "-"}`, `Sex: ${profile.sex ?? "-"}`, `Height: ${profile.height_cm ?? "-"} cm`, `Weight: ${profile.weight_kg ?? "-"} kg`, `Experience: ${profile.experience_level ?? "-"}`, `Training location: ${profile.training_location ?? "-"}`, `Days per week: ${profile.days_per_week ?? "-"}`, `Session duration: ${profile.session_duration_minutes ?? "-"} min`, `Goals: ${goals}`, `Preferences/restrictions: ${profile.exercise_preferences ?? profile.exercise_restrictions ?? "-"}`]
    : ["📋 Je FitPilot-profiel", `Leeftijd: ${profile.age ?? "-"}`, `Geslacht: ${profile.sex ?? "-"}`, `Lengte: ${profile.height_cm ?? "-"} cm`, `Gewicht: ${profile.weight_kg ?? "-"} kg`, `Ervaring: ${profile.experience_level ?? "-"}`, `Trainingslocatie: ${profile.training_location ?? "-"}`, `Dagen per week: ${profile.days_per_week ?? "-"}`, `Duur per training: ${profile.session_duration_minutes ?? "-"} min`, `Doelen: ${goals}`, `Voorkeuren/beperkingen: ${profile.exercise_preferences ?? profile.exercise_restrictions ?? "-"}`]
  ).join("\n");
}

type StrictField = keyof Record<string, unknown>;

function currentStrictField(state: OnboardingState, profile: Record<string, unknown>): StrictField | null {
  if (state === "BASIC_PROFILE") {
    if (profile.age == null) return "age";
    if (profile.height_cm == null) return "height_cm";
    if (profile.weight_kg == null) return "weight_kg";
  }
  if (state === "FITNESS_PROFILE" && profile.experience_level == null) return "experience_level";
  if (state === "TRAINING_PROFILE") {
    if (profile.training_location == null) return "training_location";
    if (profile.days_per_week == null) return "days_per_week";
    if (profile.session_duration_minutes == null) return "session_duration_minutes";
  }
  if (state === "GOALS" && (!Array.isArray(profile.goals) || profile.goals.length === 0)) return "goals";
  if (state === "PREFERENCES") return "preferences";
  return null;
}

function allowedStrictFields(field: StrictField | null): string[] {
  if (!field) return [];
  if (field === "preferences") return ["preferred_days", "preferred_time", "equipment", "exercise_preferences", "exercise_restrictions"];
  return [String(field)];
}

function strictExplanation(profile: Record<string, unknown>, prompt: string): string {
  return languageFor(profile) === "en"
    ? `${prompt}\n\nAt this step I only need this information for the onboarding flow, so I can build your fitness profile correctly. Other profile information can be provided when I ask for it.`
    : `${prompt}\n\nBij deze stap heb ik alleen deze informatie nodig voor de onboarding, zodat ik je fitnessprofiel correct kan opbouwen. Andere profielinformatie kun je geven wanneer ik daar om vraag.`;
}

function strictRejection(profile: Record<string, unknown>, prompt: string): string {
  return languageFor(profile) === "en"
    ? `${prompt}\n\nWe’ll collect the other information later, when I ask for it. This keeps the onboarding clear and prevents unrelated information from being saved at the wrong step.`
    : `${prompt}\n\nDe andere informatie verzamelen we later, wanneer ik erom vraag. Zo blijft de onboarding duidelijk en voorkom ik dat andere informatie op het verkeerde moment wordt opgeslagen.`;
}

export async function startOnboarding(userId: string) {
  const session = await ensureSession(userId); const profile = await loadProfile(userId); const state = session.current_state as OnboardingState;
  if (state === "PAUSED") { const resumeState = (session.paused_from_state as OnboardingState | null) ?? "BASIC_PROFILE"; await setState(userId, resumeState); return missingPrompt(resumeState, await loadProfile(userId)); }
  if (state !== "NOT_STARTED" && state !== "LANGUAGE" && state !== "COMPLETED") return missingPrompt(state, profile);
  if (state === "COMPLETED") return languageFor(profile) === "en" ? "Your profile is already complete. Type /restart if you want to start over." : "Je profiel is al compleet. Typ /restart als je opnieuw wilt beginnen.";
  await setState(userId, "LANGUAGE"); return prompts.LANGUAGE[languageFor(profile)];
}

export async function processOnboardingMessage(userId: string, message: string): Promise<string> {
  const session = await ensureSession(userId);
  let state = session.current_state as OnboardingState;
  let profile = await loadProfile(userId);
  let currentLanguage = languageFor(profile);
  const trimmed = message.trim();

  if (/^\/restart$/i.test(trimmed)) { await resetProfile(userId); await setState(userId, "LANGUAGE"); return prompts.LANGUAGE.nl; }
  if (isStop(trimmed)) {
    if (state === "COMPLETED") return currentLanguage === "en" ? "Your profile is already complete." : "Je profiel is al compleet.";
    if (state !== "PAUSED") await setState(userId, "PAUSED", false, state);
    return currentLanguage === "en" ? "Paused. Type 'resume' when you want to continue." : "Gepauzeerd. Typ 'doorgaan' wanneer je verder wilt gaan.";
  }
  if (state === "PAUSED") {
    if (!isResume(trimmed)) return promptFor("PAUSED", profile);
    state = (session.paused_from_state as OnboardingState | null) ?? "BASIC_PROFILE";
    await setState(userId, state); profile = await loadProfile(userId); currentLanguage = languageFor(profile);
    return missingPrompt(state, profile);
  }
  if (isResume(trimmed)) return missingPrompt(state, profile);

  const directLanguage = parseLanguage(trimmed);
  if (directLanguage && state !== "LANGUAGE") {
    await saveProfile(userId, { language: directLanguage });
    profile = await loadProfile(userId);
    currentLanguage = directLanguage;
    if (state === "CONSENT") return prompts.CONSENT[directLanguage];
    return missingPrompt(state, profile) || (directLanguage === "en" ? "Got it. We’ll continue in English." : "Prima. We gaan verder in het Nederlands.");
  }

  if (state === "LANGUAGE") {
    if (!directLanguage) return "Kies alsjeblieft Nederlands of English. 🇳🇱 / 🇬🇧";
    await saveProfile(userId, { language: directLanguage }); await setState(userId, "CONSENT");
    return prompts.CONSENT[directLanguage];
  }
  if (isLanguageChange(trimmed)) {
    const parsed = parseLanguage(trimmed);
    if (parsed) { await saveProfile(userId, { language: parsed }); profile = await loadProfile(userId); currentLanguage = parsed; return missingPrompt(state, profile) || (parsed === "en" ? "Got it. We’ll continue in English." : "Prima. We gaan verder in het Nederlands."); }
  }

  if (state === "CONSENT") {
    const consent = /^(ja|yes|y|akkoord|agree|i agree|ik ga akkoord)$/i.test(trimmed);
    if (!consent) return currentLanguage === "en" ? "No problem. Without consent I can’t save a personal fitness profile. Send 'yes' to continue, or tell me if you want to switch language." : "Geen probleem. Zonder akkoord kan ik geen persoonlijk fitnessprofiel opslaan. Stuur 'ja' om door te gaan, of zeg het als je van taal wilt wisselen.";
    await saveProfile(userId, { consent: true }); await setState(userId, "BASIC_PROFILE"); profile = await loadProfile(userId); currentLanguage = languageFor(profile); return missingPrompt("BASIC_PROFILE", profile);
  }

  // Strict one-field gate: at every onboarding step, only the information currently requested
  // may be accepted. Language changes and stop/pause commands remain global exceptions.
  const strictField = currentStrictField(state, profile);
  if (strictField) {
    const prompt = missingPrompt(state, profile);
    if (isExplanationRequest(trimmed)) return strictExplanation(profile, prompt);

    const routed = await routeProfileMessage({ state, message, profile, currentLanguage });
    const routedFields = Object.fromEntries(Object.entries(routed.fields).filter(([key]) => key !== "language"));
    const allowed = allowedStrictFields(strictField);
    const keys = Object.keys(routedFields);
    const hasOnlyRequestedData = keys.length > 0 && keys.every((key) => allowed.includes(key));

    if (!hasOnlyRequestedData) return strictRejection(profile, prompt);

    await saveProfile(userId, routedFields);
    profile = await loadProfile(userId);
    const newState = nextState(state, profile);
    if (newState !== state) await setState(userId, newState);
    if (newState === "REVIEW") return summary(profile) + (languageFor(profile) === "en" ? "\n\nDoes this look correct? Reply 'yes' to confirm, or tell me what to change." : "\n\nKlopt dit? Antwoord 'ja' om te bevestigen, of vertel wat ik moet aanpassen.");
    return missingPrompt(newState, profile);
  }

  const routed = await routeProfileMessage({ state, message, profile, currentLanguage });
  const fields = { ...routed.fields };
  const { language: _language, ...profileFields } = fields;
  if (Object.keys(profileFields).length > 0) {
    await saveProfile(userId, profileFields);
    profile = await loadProfile(userId);
  }
  if (routed.language) {
    await saveProfile(userId, { language: routed.language });
    profile = await loadProfile(userId);
    currentLanguage = routed.language;
  }
  if (routed.extraction.intent === "restart") { await resetProfile(userId); await setState(userId, "LANGUAGE"); return prompts.LANGUAGE.nl; }

  if (isProfileSummaryRequest(trimmed) || routed.extraction.intent === "question") {
    const next = missingPrompt(state, profile);
    return `${currentLanguage === "en" ? "Good question. Here’s what I currently have:" : "Goede vraag. Dit is wat ik momenteel van je heb:"}\n\n${summary(profile)}${next ? `\n\n${next}` : ""}`;
  }
  if (state === "GOALS" && isGoalAdviceRequest(trimmed)) return generateGoalAdvice(profile, currentLanguage);
  if (state === "COMPLETED") return currentLanguage === "en" ? "Your profile is already complete. Type /restart if you want to start over." : "Je profiel is al compleet. Typ /restart als je opnieuw wilt beginnen.";
  if (state === "REVIEW" && /^(ja|yes|y|klopt|correct)$/i.test(trimmed)) { await setState(userId, "COMPLETED", true); return currentLanguage === "en" ? "Profile confirmed! 🎉 Your FitPilot profile has been saved." : "Profiel bevestigd! 🎉 Je FitPilot-profiel is opgeslagen."; }
  if (Object.keys(fields).length === 0) {
    const next = missingPrompt(state, profile);
    return currentLanguage === "en" ? `I couldn't extract any new profile information.${next ? ` ${next}` : " Please tell me a little more."}` : `Ik kon nog geen nieuwe profielinformatie vinden.${next ? ` ${next}` : " Kun je iets meer vertellen?"}`;
  }
  const newState = nextState(state, profile);
  if (newState !== state) await setState(userId, newState);
  if (newState === "REVIEW") return summary(profile) + (languageFor(profile) === "en" ? "\n\nDoes this look correct? Reply 'yes' to confirm, or tell me what to change." : "\n\nKlopt dit? Antwoord 'ja' om te bevestigen, of vertel wat ik moet aanpassen.");
  return missingPrompt(newState, profile);
}
