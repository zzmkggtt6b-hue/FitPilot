import { isLanguageChange, parseLanguage } from "./language";
import { ensureSession, loadProfile, saveProfile, setState } from "./repository";
import { processOnboardingMessage } from "./engine";
import type { OnboardingState } from "./types";

export type ConversationIntent =
  | "COMMAND"
  | "LANGUAGE_CHANGE"
  | "QUESTION"
  | "CORRECTION"
  | "PAUSE"
  | "RESUME"
  | "ANSWER"
  | "GENERAL_CHAT";

export type RoutedConversation = {
  intent: ConversationIntent;
  message: string;
  state: OnboardingState;
};

function classify(message: string): ConversationIntent {
  const value = message.trim();
  if (/^\/(restart|start|stop|pause|resume|continue)$/i.test(value)) return "COMMAND";
  if (isLanguageChange(value)) return "LANGUAGE_CHANGE";
  if (/^(stop|pauze|pause)$/i.test(value)) return "PAUSE";
  if (/^(resume|doorgaan|continue|ga door)$/i.test(value)) return "RESUME";
  if (/\b(why|waarom|what|wat|how|hoe|when|wanneer|can you|kun je|could you|wil je)\b/i.test(value) && /\?/i.test(value)) return "QUESTION";
  if (/\b(actually|eigenlijk|correctie|correct|aanpassing|aanpassen|change|changed|verkeerd|niet|bedoel|bedoelde|instead|rather)\b/i.test(value)) return "CORRECTION";
  return "ANSWER";
}

function questionReply(state: OnboardingState, language: "nl" | "en"): string {
  if (language === "en") {
    if (state === "BASIC_PROFILE") return "I need your basic profile so I can tailor training and advice to you. I use your age, height, weight and sex to make recommendations more relevant and safer. You can give several details in one message.";
    if (state === "FITNESS_PROFILE") return "I ask about your training experience so I can set an appropriate difficulty and progression level.";
    if (state === "TRAINING_PROFILE") return "I ask about where, how often and how long you train so I can design something that fits your real schedule and equipment.";
    if (state === "GOALS") return "Your goal determines what we prioritize in your training and coaching, such as strength, muscle gain, fat loss or fitness.";
    return "I use the information you share to personalize your FitPilot profile and coaching.";
  }
  if (state === "BASIC_PROFILE") return "Ik vraag je basisgegevens zodat ik je training en advies op jou kan afstemmen. Leeftijd, lengte, gewicht en geslacht helpen om aanbevelingen relevanter en veiliger te maken. Je mag meerdere gegevens tegelijk sturen.";
  if (state === "FITNESS_PROFILE") return "Ik vraag naar je trainingservaring zodat ik het juiste niveau en een passende opbouw kan kiezen.";
  if (state === "TRAINING_PROFILE") return "Ik vraag waar, hoe vaak en hoe lang je traint zodat het plan past bij je echte schema en beschikbare materiaal.";
  if (state === "GOALS") return "Je doel bepaalt waar we in je training en coaching de nadruk op leggen, zoals kracht, spiermassa, vetverlies of algemene fitheid.";
  return "Ik gebruik de informatie die je deelt om je FitPilot-profiel en coaching persoonlijk te maken.";
}

export async function routeConversation(userId: string, message: string): Promise<string> {
  const session = await ensureSession(userId);
  const state = session.current_state as OnboardingState;
  const profile = await loadProfile(userId);
  const intent = classify(message);
  const language = profile.language === "en" ? "en" : "nl";

  // These are handled before state-specific extraction so they can never be swallowed by onboarding.
  if (intent === "LANGUAGE_CHANGE") {
    const nextLanguage = parseLanguage(message);
    if (nextLanguage) {
      await saveProfile(userId, { language: nextLanguage });
      return processOnboardingMessage(userId, message);
    }
  }

  if (intent === "QUESTION") return questionReply(state, language);

  // Corrections, answers and general conversational input still go through the
  // existing extraction/state engine. The router guarantees that questions and
  // cross-cutting commands are dealt with first.
  return processOnboardingMessage(userId, message);
}
