import { extractOnboarding } from "@/lib/ai/extraction";
import { missingFields, nextState } from "./state-machine";
import { addMessage, ensureSession, getSession, loadProfile, saveProfile, setState } from "./repository";
import type { OnboardingState, ProfileData } from "./types";

const prompts: Record<OnboardingState, string> = {
  NOT_STARTED: "Welkom bij FitPilot! 🏋️ Ik help je een persoonlijk fitnessprofiel opbouwen. In welke taal wil je verder? (Nederlands/English)",
  LANGUAGE: "In welke taal wil je verder? 🇳🇱 Nederlands of 🇬🇧 English?",
  CONSENT: "Voordat we beginnen: je deelt persoonlijke fitnessgegevens. FitPilot gebruikt die alleen om je profiel en coaching te leveren. Ga je hiermee akkoord? (ja/nee)",
  BASIC_PROFILE: "Vertel me je leeftijd, geslacht (optioneel), lengte en gewicht. Je mag dit gewoon in één zin vertellen.",
  FITNESS_PROFILE: "Hoeveel ervaring heb je met trainen? Vertel ook gerust hoe regelmatig je de laatste tijd hebt getraind.",
  TRAINING_PROFILE: "Waar train je meestal (sportschool, thuis of beide), hoeveel dagen per week en hoe lang duurt een training meestal?",
  GOALS: "Wat is je belangrijkste doel? Bijvoorbeeld spiermassa, vetverlies, kracht, algemene fitheid, conditie of recompositie.",
  PREFERENCES: "Zijn er voorkeuren, oefeningen die je graag doet, oefeningen die je wilt vermijden of materiaalbeperkingen waarmee ik rekening moet houden?",
  REVIEW: "",
  COMPLETED: "Je profiel is compleet. 🎉",
};

function summary(profile: Record<string, unknown>) {
  const goals = Array.isArray(profile.goals) ? profile.goals.join(", ") : "-";
  return [
    "📋 Je FitPilot-profiel",
    `Leeftijd: ${profile.age ?? "-"}`,
    `Lengte: ${profile.height_cm ?? "-"} cm`,
    `Gewicht: ${profile.weight_kg ?? "-"} kg`,
    `Ervaring: ${profile.experience_level ?? "-"}`,
    `Trainingslocatie: ${profile.training_location ?? "-"}`,
    `Dagen per week: ${profile.days_per_week ?? "-"}`,
    `Duur per training: ${profile.session_duration_minutes ?? "-"} min`,
    `Doelen: ${goals}`,
    `Voorkeuren/beperkingen: ${profile.exercise_preferences ?? profile.exercise_restrictions ?? "-"}`,
    "",
    "Klopt dit? Antwoord met 'ja' om je profiel te bevestigen, of vertel wat ik moet aanpassen."
  ].join("\n");
}

export async function startOnboarding(userId: string) {
  await ensureSession(userId);
  await setState(userId, "LANGUAGE");
  return prompts.LANGUAGE;
}

export async function processOnboardingMessage(userId: string, message: string): Promise<string> {
  const session = await ensureSession(userId);
  let state = session.current_state as OnboardingState;
  let profile = await loadProfile(userId);

  if (message.trim().toLowerCase() === "/restart") {
    await setState(userId, "LANGUAGE");
    return prompts.LANGUAGE;
  }

  if (state === "LANGUAGE") {
    const lower = message.toLowerCase();
    const language = lower.includes("english") || lower === "en" ? "en" : "nl";
    await saveProfile(userId, { language });
    await setState(userId, "CONSENT");
    return language === "en" ? "Before we start: you will share personal fitness data. FitPilot uses it only to provide your profile and coaching. Do you agree? (yes/no)" : prompts.CONSENT;
  }

  if (state === "CONSENT") {
    const consent = /^(ja|yes|y|akkoord|agree)$/i.test(message.trim());
    if (!consent) return "Geen probleem. Zonder akkoord kan ik geen persoonlijk fitnessprofiel opslaan. Stuur 'ja' als je wilt doorgaan.";
    await saveProfile(userId, { consent: true });
    await setState(userId, "BASIC_PROFILE");
    return prompts.BASIC_PROFILE;
  }

  if (state === "REVIEW") {
    if (/^(ja|yes|y|klopt|correct)$/i.test(message.trim())) {
      await setState(userId, "COMPLETED", true);
      return "Profiel bevestigd! 🎉 Je FitPilot-profiel is opgeslagen. In MVP1 stoppen we hier; je trainingscoach komt in fase 2.\n\nTyp /restart als je opnieuw wilt beginnen.";
    }
  }

  const extraction = await extractOnboarding({ state, message, profile });
  if (extraction.intent === "restart") {
    await setState(userId, "LANGUAGE");
    return prompts.LANGUAGE;
  }

  if (extraction.intent === "question") {
    return "Goede vraag. Tijdens de onboarding verzamel ik alleen de informatie die nodig is om je fitnessprofiel te maken. Je kunt daarna altijd iets corrigeren.\n\n" + (prompts[state] || "Vertel me wat je wilt toevoegen.");
  }

  if (Object.keys(extraction.fields).length === 0) {
    return "Ik kon nog geen nieuwe profielinformatie uit je bericht halen. " + (prompts[state] || "Vertel me wat je wilt toevoegen.");
  }

  await saveProfile(userId, extraction.fields as ProfileData);
  profile = await loadProfile(userId);
  const newState = nextState(state, profile);
  await setState(userId, newState);

  if (newState === "REVIEW") return summary(profile);
  return prompts[newState];
}
