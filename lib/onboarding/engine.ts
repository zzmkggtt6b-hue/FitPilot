import { extractOnboarding } from "@/lib/ai/extraction";
import { missingFields, nextState } from "./state-machine";
import { addMessage, ensureSession, getSession, loadProfile, saveProfile, setState } from "./repository";
import type { OnboardingState, ProfileData } from "./types";

const prompts: Record<OnboardingState, { nl: string; en: string }> = {
  NOT_STARTED: {
    nl: "Welkom bij FitPilot! 🏋️ Ik help je een persoonlijk fitnessprofiel opbouwen. In welke taal wil je verder? (Nederlands/English)",
    en: "Welcome to FitPilot! 🏋️ I’ll help you build a personal fitness profile. Which language would you like to continue in? (Nederlands/English)",
  },
  LANGUAGE: {
    nl: "In welke taal wil je verder? 🇳🇱 Nederlands of 🇬🇧 English?",
    en: "Which language would you like to continue in? 🇳🇱 Nederlands or 🇬🇧 English?",
  },
  CONSENT: {
    nl: "Voordat we beginnen: je deelt persoonlijke fitnessgegevens. FitPilot gebruikt die alleen om je profiel en coaching te leveren. Ga je hiermee akkoord? (ja/nee)",
    en: "Before we start: you will share personal fitness data. FitPilot uses it only to provide your profile and coaching. Do you agree? (yes/no)",
  },
  BASIC_PROFILE: {
    nl: "Vertel me je leeftijd, geslacht (optioneel), lengte en gewicht. Je mag dit gewoon in één zin vertellen.",
    en: "Tell me your age, sex (optional), height and weight. You can give it all in one sentence.",
  },
  FITNESS_PROFILE: {
    nl: "Hoeveel ervaring heb je met trainen? Vertel ook gerust hoe regelmatig je de laatste tijd hebt getraind.",
    en: "How much training experience do you have? Feel free to tell me how regularly you’ve been training recently.",
  },
  TRAINING_PROFILE: {
    nl: "Waar train je meestal (sportschool, thuis of beide), hoeveel dagen per week en hoe lang duurt een training meestal?",
    en: "Where do you usually train (gym, home or both), how many days per week, and how long is a typical workout?",
  },
  GOALS: {
    nl: "Wat is je belangrijkste doel? Bijvoorbeeld spiermassa, vetverlies, kracht, algemene fitheid, conditie of recompositie.",
    en: "What is your main goal? For example: muscle gain, fat loss, strength, general fitness, endurance or body recomposition.",
  },
  PREFERENCES: {
    nl: "Zijn er voorkeuren, oefeningen die je graag doet, oefeningen die je wilt vermijden of materiaalbeperkingen waarmee ik rekening moet houden?",
    en: "Do you have any preferences, exercises you like, exercises you want to avoid, or equipment limitations I should consider?",
  },
  REVIEW: { nl: "", en: "" },
  COMPLETED: {
    nl: "Je profiel is compleet. 🎉",
    en: "Your profile is complete. 🎉",
  },
};

function languageFor(profile: Record<string, unknown>): "nl" | "en" {
  return profile.language === "en" ? "en" : "nl";
}

function promptFor(state: OnboardingState, profile: Record<string, unknown>) {
  return prompts[state][languageFor(profile)];
}

function summary(profile: Record<string, unknown>) {
  const en = languageFor(profile) === "en";
  const goals = Array.isArray(profile.goals) ? profile.goals.join(", ") : "-";
  return en
    ? [
        "📋 Your FitPilot profile",
        `Age: ${profile.age ?? "-"}`,
        `Height: ${profile.height_cm ?? "-"} cm`,
        `Weight: ${profile.weight_kg ?? "-"} kg`,
        `Experience: ${profile.experience_level ?? "-"}`,
        `Training location: ${profile.training_location ?? "-"}`,
        `Days per week: ${profile.days_per_week ?? "-"}`,
        `Session duration: ${profile.session_duration_minutes ?? "-"} min`,
        `Goals: ${goals}`,
        `Preferences/restrictions: ${profile.exercise_preferences ?? profile.exercise_restrictions ?? "-"}`,
        "",
        "Does this look correct? Reply with 'yes' to confirm, or tell me what to change.",
      ].join("\n")
    : [
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
        "Klopt dit? Antwoord met 'ja' om je profiel te bevestigen, of vertel wat ik moet aanpassen.",
      ].join("\n");
}

export async function startOnboarding(userId: string) {
  await ensureSession(userId);
  await setState(userId, "LANGUAGE");
  return prompts.LANGUAGE.nl;
}

export async function processOnboardingMessage(userId: string, message: string): Promise<string> {
  const session = await ensureSession(userId);
  let state = session.current_state as OnboardingState;
  let profile = await loadProfile(userId);
  const currentLanguage = languageFor(profile);

  if (message.trim().toLowerCase() === "/restart") {
    await setState(userId, "LANGUAGE");
    return prompts.LANGUAGE[currentLanguage];
  }

  if (state === "LANGUAGE") {
    const lower = message.toLowerCase();
    const language = /\b(english|engels|en)\b/.test(lower) ? "en" : "nl";
    await saveProfile(userId, { language });
    profile = await loadProfile(userId);
    await setState(userId, "CONSENT");
    return prompts.CONSENT[language];
  }

  if (state === "CONSENT") {
    const consent = /^(ja|yes|y|akkoord|agree)$/i.test(message.trim());
    if (!consent) {
      return currentLanguage === "en"
        ? "No problem. Without consent I can’t save a personal fitness profile. Send 'yes' if you want to continue."
        : "Geen probleem. Zonder akkoord kan ik geen persoonlijk fitnessprofiel opslaan. Stuur 'ja' als je wilt doorgaan.";
    }
    await saveProfile(userId, { consent: true });
    await setState(userId, "BASIC_PROFILE");
    return promptFor("BASIC_PROFILE", profile);
  }

  if (state === "REVIEW") {
    if (/^(ja|yes|y|klopt|correct)$/i.test(message.trim())) {
      await setState(userId, "COMPLETED", true);
      return currentLanguage === "en"
        ? "Profile confirmed! 🎉 Your FitPilot profile has been saved. In MVP1 we stop here; your training coach comes in phase 2.\n\nType /restart if you want to start again."
        : "Profiel bevestigd! 🎉 Je FitPilot-profiel is opgeslagen. In MVP1 stoppen we hier; je trainingscoach komt in fase 2.\n\nTyp /restart als je opnieuw wilt beginnen.";
    }
  }

  const extraction = await extractOnboarding({ state, message, profile });

  // Handle an explicit language switch before question/answer processing.
  if (extraction.intent === "language_change" || extraction.fields.language) {
    const requestedLanguage = extraction.fields.language?.toLowerCase();
    const language = requestedLanguage?.includes("en") || requestedLanguage?.includes("english") || requestedLanguage?.includes("engels")
      ? "en"
      : requestedLanguage?.includes("nl") || requestedLanguage?.includes("dutch") || requestedLanguage?.includes("nederlands")
        ? "nl"
        : currentLanguage;

    await saveProfile(userId, { language });
    profile = await loadProfile(userId);
    return promptFor(state, profile);
  }

  if (extraction.intent === "restart") {
    await setState(userId, "LANGUAGE");
    return prompts.LANGUAGE[currentLanguage];
  }

  if (extraction.intent === "question") {
    const answer = currentLanguage === "en"
      ? "Good question. During onboarding I only collect the information needed to create your fitness profile. You can always correct something later."
      : "Goede vraag. Tijdens de onboarding verzamel ik alleen de informatie die nodig is om je fitnessprofiel te maken. Je kunt daarna altijd iets corrigeren.";
    return `${answer}\n\n${promptFor(state, profile)}`;
  }

  if (Object.keys(extraction.fields).length === 0) {
    return currentLanguage === "en"
      ? `I couldn't extract any new profile information from your message. ${promptFor(state, profile)}`
      : `Ik kon nog geen nieuwe profielinformatie uit je bericht halen. ${promptFor(state, profile)}`;
  }

  const { language: _language, ...profileFields } = extraction.fields;
  await saveProfile(userId, profileFields as ProfileData);
  profile = await loadProfile(userId);
  const newState = nextState(state, profile);
  await setState(userId, newState);

  if (newState === "REVIEW") return summary(profile);
  return promptFor(newState, profile);
}
