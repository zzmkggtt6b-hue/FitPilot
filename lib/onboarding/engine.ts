import { extractOnboarding } from "@/lib/ai/extraction";
import { nextState } from "./state-machine";
import { addMessage, ensureSession, loadProfile, resetProfile, saveProfile, setState } from "./repository";
import type { OnboardingState, ProfileData } from "./types";

const prompts: Record<OnboardingState, { nl: string; en: string }> = {
  NOT_STARTED: { nl: "Welkom bij FitPilot! 🏋️ Ik help je een persoonlijk fitnessprofiel opbouwen. In welke taal wil je verder? (Nederlands/English)", en: "Welcome to FitPilot! 🏋️ I’ll help you build a personal fitness profile. Which language would you like to continue in? (Nederlands/English)" },
  LANGUAGE: { nl: "In welke taal wil je verder? 🇳🇱 Nederlands of 🇬🇧 English?", en: "Which language would you like to continue in? 🇳🇱 Nederlands or 🇬🇧 English?" },
  CONSENT: { nl: "Voordat we beginnen: je deelt persoonlijke fitnessgegevens. FitPilot gebruikt die alleen om je profiel en coaching te leveren. Ga je hiermee akkoord? (ja/nee)", en: "Before we start: you will share personal fitness data. FitPilot uses it only to provide your profile and coaching. Do you agree? (yes/no)" },
  BASIC_PROFILE: { nl: "Vertel me je leeftijd, geslacht (optioneel), lengte en gewicht. Je mag dit gewoon in één zin vertellen.", en: "Tell me your age, sex (optional), height and weight. You can give it all in one sentence." },
  FITNESS_PROFILE: { nl: "Hoeveel ervaring heb je met trainen? Vertel ook gerust hoe regelmatig je de laatste tijd hebt getraind.", en: "How much training experience do you have? Feel free to tell me how regularly you’ve been training recently." },
  TRAINING_PROFILE: { nl: "Waar train je meestal (sportschool, thuis of beide), hoeveel dagen per week en hoe lang duurt een training meestal?", en: "Where do you usually train (gym, home or both), how many days per week, and how long is a typical workout?" },
  GOALS: { nl: "Wat is je belangrijkste doel? Bijvoorbeeld spiermassa, vetverlies, kracht, algemene fitheid, conditie of recompositie.", en: "What is your main goal? For example: muscle gain, fat loss, strength, general fitness, endurance or body recomposition." },
  PREFERENCES: { nl: "Zijn er voorkeuren, oefeningen die je graag doet, oefeningen die je wilt vermijden of materiaalbeperkingen waarmee ik rekening moet houden?", en: "Do you have any preferences, exercises you like, exercises you want to avoid, or equipment limitations I should consider?" },
  REVIEW: { nl: "", en: "" },
  COMPLETED: { nl: "Je profiel is compleet. 🎉", en: "Your profile is complete. 🎉" },
  PAUSED: { nl: "Je onboarding staat gepauzeerd. Typ 'doorgaan' om verder te gaan.", en: "Your onboarding is paused. Type 'resume' to continue." },
};

function languageFor(profile: Record<string, unknown>): "nl" | "en" { return profile.language === "en" ? "en" : "nl"; }
function promptFor(state: OnboardingState, profile: Record<string, unknown>) { return prompts[state][languageFor(profile)]; }

function parseLanguage(message: string): "nl" | "en" | null {
  const value = message.trim().toLowerCase().replace(/[.!?]+$/g, "");
  if (["nederlands", "dutch", "nl", "nederland", "hollands"].includes(value)) return "nl";
  if (["english", "engels", "en", "engels talig", "engels-talig"].includes(value)) return "en";
  return null;
}
function requestedLanguage(message: string, fallback: "nl" | "en"): "nl" | "en" { return parseLanguage(message) ?? fallback; }
function isLanguageChange(message: string) {
  const target = /\b(english|engels|dutch|nederlands|nl|en)\b/i.test(message);
  const verb = /\b(speak|talk|praat|praten|taal|language|do|doen|switch|wissel|change|verder|want|wil|will|let'?s|laten|toch)\b/i.test(message);
  return target && (verb || message.trim().split(/\s+/).length <= 2);
}
function isProfileSummaryRequest(message: string) { return /\b(what do you know about me|what info do you have|wat weet je (nu )?al over mij|welke informatie heb je|mijn profiel|my profile)\b/i.test(message); }
function isStop(message: string) { return /^\/(stop|pause)$|^(stop|pauze|pause)$/i.test(message.trim()); }
function isResume(message: string) { return /^\/(resume|continue)$|^(resume|doorgaan|continue|ga door)$/i.test(message.trim()); }

function missingPrompt(state: OnboardingState, profile: Record<string, unknown>): string {
  const en = languageFor(profile) === "en";
  if (state === "BASIC_PROFILE") {
    const missing = [profile.age == null && "age", profile.height_cm == null && "height", profile.weight_kg == null && "weight"].filter(Boolean);
    if (missing.length === 0) return "";
    return en ? `I still need your ${missing.join(" and ")}.` : `Ik heb nog je ${missing.join(" en ")} nodig.`;
  }
  if (state === "FITNESS_PROFILE" && profile.experience_level == null) return en ? "How much training experience do you have?" : "Hoeveel ervaring heb je met trainen?";
  if (state === "TRAINING_PROFILE") {
    if (profile.training_location == null) return en ? "Where do you usually train: gym, home or both?" : "Waar train je meestal: sportschool, thuis of beide?";
    if (profile.days_per_week == null) return en ? "How many days per week do you usually train?" : "Hoeveel dagen per week train je meestal?";
    if (profile.session_duration_minutes == null) return en ? "How long is your typical workout, in minutes?" : "Hoe lang duurt je training meestal, in minuten?";
  }
  if (state === "GOALS" && (!Array.isArray(profile.goals) || profile.goals.length === 0)) return prompts.GOALS[languageFor(profile)];
  return promptFor(state, profile);
}
function summary(profile: Record<string, unknown>) {
  const en = languageFor(profile) === "en"; const goals = Array.isArray(profile.goals) ? profile.goals.join(", ") : "-";
  return (en ? ["📋 Your FitPilot profile", `Age: ${profile.age ?? "-"}`, `Sex: ${profile.sex ?? "-"}`, `Height: ${profile.height_cm ?? "-"} cm`, `Weight: ${profile.weight_kg ?? "-"} kg`, `Experience: ${profile.experience_level ?? "-"}`, `Training location: ${profile.training_location ?? "-"}`, `Days per week: ${profile.days_per_week ?? "-"}`, `Session duration: ${profile.session_duration_minutes ?? "-"} min`, `Goals: ${goals}`, `Preferences/restrictions: ${profile.exercise_preferences ?? profile.exercise_restrictions ?? "-"}`] : ["📋 Je FitPilot-profiel", `Leeftijd: ${profile.age ?? "-"}`, `Geslacht: ${profile.sex ?? "-"}`, `Lengte: ${profile.height_cm ?? "-"} cm`, `Gewicht: ${profile.weight_kg ?? "-"} kg`, `Ervaring: ${profile.experience_level ?? "-"}`, `Trainingslocatie: ${profile.training_location ?? "-"}`, `Dagen per week: ${profile.days_per_week ?? "-"}`, `Duur per training: ${profile.session_duration_minutes ?? "-"} min`, `Doelen: ${goals}`, `Voorkeuren/beperkingen: ${profile.exercise_preferences ?? profile.exercise_restrictions ?? "-"}`]).join("\n");
}

export async function startOnboarding(userId: string) {
  const session = await ensureSession(userId); const profile = await loadProfile(userId); const state = session.current_state as OnboardingState;
  if (state === "PAUSED") { const resumeState = (session.paused_from_state as OnboardingState | null) ?? "BASIC_PROFILE"; await setState(userId, resumeState); return missingPrompt(resumeState, await loadProfile(userId)); }
  if (state !== "NOT_STARTED" && state !== "LANGUAGE" && state !== "COMPLETED") return missingPrompt(state, profile);
  if (state === "COMPLETED") return languageFor(profile) === "en" ? "Your profile is already complete. Type /restart if you want to start over." : "Je profiel is al compleet. Typ /restart als je opnieuw wilt beginnen.";
  await setState(userId, "LANGUAGE"); return prompts.LANGUAGE[languageFor(profile)];
}

export async function processOnboardingMessage(userId: string, message: string): Promise<string> {
  const session = await ensureSession(userId); let state = session.current_state as OnboardingState; let profile = await loadProfile(userId); let currentLanguage = languageFor(profile); const trimmed = message.trim();
  if (/^\/restart$/i.test(trimmed)) { await resetProfile(userId); await setState(userId, "LANGUAGE"); return prompts.LANGUAGE["nl"]; }
  if (isStop(trimmed)) { if (state === "COMPLETED") return currentLanguage === "en" ? "Your profile is already complete." : "Je profiel is al compleet."; if (state !== "PAUSED") await setState(userId, "PAUSED", false, state); return currentLanguage === "en" ? "Paused. Type 'resume' when you want to continue." : "Gepauzeerd. Typ 'doorgaan' wanneer je verder wilt gaan."; }
  if (state === "PAUSED") { if (!isResume(trimmed)) return promptFor("PAUSED", profile); state = (session.paused_from_state as OnboardingState | null) ?? "BASIC_PROFILE"; await setState(userId, state); profile = await loadProfile(userId); return missingPrompt(state, profile); }
  if (isResume(trimmed)) return missingPrompt(state, profile);

  // LANGUAGE is a hard deterministic boundary. Do not let the generic language-change handler run first.
  if (state === "LANGUAGE") {
    const language = parseLanguage(trimmed);
    if (!language) return "Kies alsjeblieft Nederlands of English. 🇳🇱 / 🇬🇧";
    await saveProfile(userId, { language });
    await setState(userId, "CONSENT");
    return prompts.CONSENT[language];
  }

  // Language switching after LANGUAGE is handled before AI extraction.
  if (isLanguageChange(trimmed)) {
    const parsed = parseLanguage(trimmed);
    if (parsed) {
      currentLanguage = parsed;
      await saveProfile(userId, { language: currentLanguage });
      profile = await loadProfile(userId);
      return missingPrompt(state, profile) || (currentLanguage === "en" ? "Got it. We’ll continue in English." : "Prima. We gaan verder in het Nederlands.");
    }
  }

  if (isProfileSummaryRequest(trimmed)) return summary(profile) + (state === "REVIEW" ? (currentLanguage === "en" ? "\n\nDoes this look correct? Reply 'yes' to confirm, or tell me what to change." : "\n\nKlopt dit? Antwoord 'ja' om te bevestigen, of vertel wat ik moet aanpassen.") : (missingPrompt(state, profile) ? `\n\n${missingPrompt(state, profile)}` : ""));
  if (state === "CONSENT") { const consent = /^(ja|yes|y|akkoord|agree)$/i.test(trimmed); if (!consent) return currentLanguage === "en" ? "No problem. Without consent I can’t save a personal fitness profile. Send 'yes' to continue, or tell me if you want to switch language." : "Geen probleem. Zonder akkoord kan ik geen persoonlijk fitnessprofiel opslaan. Stuur 'ja' om door te gaan, of zeg het als je van taal wilt wisselen."; await saveProfile(userId, { consent: true }); await setState(userId, "BASIC_PROFILE"); return prompts.BASIC_PROFILE[currentLanguage]; }
  if (state === "COMPLETED") return currentLanguage === "en" ? "Your profile is already complete. Type /restart if you want to start over." : "Je profiel is al compleet. Typ /restart als je opnieuw wilt beginnen.";
  if (state === "REVIEW" && /^(ja|yes|y|klopt|correct)$/i.test(trimmed)) { await setState(userId, "COMPLETED", true); return currentLanguage === "en" ? "Profile confirmed! 🎉 Your FitPilot profile has been saved." : "Profiel bevestigd! 🎉 Je FitPilot-profiel is opgeslagen."; }
  const extraction = await extractOnboarding({ state, message, profile });
  if (extraction.intent === "language_change" || extraction.fields.language) { const language = requestedLanguage(extraction.fields.language ?? "", currentLanguage); await saveProfile(userId, { language }); profile = await loadProfile(userId); return missingPrompt(state, profile) || (language === "en" ? "Got it. We’ll continue in English." : "Prima. We gaan verder in het Nederlands."); }
  if (extraction.intent === "restart") { await resetProfile(userId); await setState(userId, "LANGUAGE"); return prompts.LANGUAGE["nl"]; }
  if (extraction.intent === "question") return `${currentLanguage === "en" ? "Good question. Here’s what I currently have:" : "Goede vraag. Dit is wat ik momenteel van je heb:"}\n\n${summary(profile)}${missingPrompt(state, profile) ? `\n\n${missingPrompt(state, profile)}` : ""}`;
  if (Object.keys(extraction.fields).length === 0) return currentLanguage === "en" ? `I couldn't extract any new profile information. ${missingPrompt(state, profile)}` : `Ik kon nog geen nieuwe profielinformatie vinden. ${missingPrompt(state, profile)}`;
  const { language: _language, ...profileFields } = extraction.fields; await saveProfile(userId, profileFields as ProfileData); profile = await loadProfile(userId); const newState = nextState(state, profile); await setState(userId, newState);
  if (newState === "REVIEW") return summary(profile) + (languageFor(profile) === "en" ? "\n\nDoes this look correct? Reply 'yes' to confirm, or tell me what to change." : "\n\nKlopt dit? Antwoord 'ja' om te bevestigen, of vertel wat ik moet aanpassen.");
  return missingPrompt(newState, profile);
}
