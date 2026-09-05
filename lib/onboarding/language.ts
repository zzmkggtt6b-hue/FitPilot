export type AppLanguage = "nl" | "en";

const DUTCH = new Set(["nederlands", "dutch", "hollands", "nederlandse"]);
const ENGLISH = new Set(["english", "engels", "engelse"]);

const DUTCH_WORDS = new Set([
  "ik", "mijn", "ben", "heb", "heeft", "wat", "waar", "waarom", "hoe", "welke", "wil", "kan", "kun", "niet", "wel", "ja", "nee",
  "leeftijd", "jaar", "jaren", "geslacht", "man", "vrouw", "mannelijk", "vrouwelijk", "lengte", "gewicht", "train", "training", "sportschool",
  "thuis", "dagen", "week", "minuten", "doel", "spiermassa", "kracht", "conditie", "vetverlies", "afvallen", "voorkeur", "geen",
]);
const ENGLISH_WORDS = new Set([
  "i", "my", "am", "is", "are", "have", "has", "what", "where", "why", "how", "which", "want", "can", "could", "not", "yes", "no",
  "age", "years", "sex", "male", "female", "height", "weight", "train", "training", "gym", "home", "days", "week", "minutes", "goal",
  "muscle", "strength", "endurance", "fat", "loss", "lose", "preferences", "none",
]);

function scoreLanguage(value: string, words: Set<string>): number {
  return value
    .toLowerCase()
    .replace(/[^a-zà-ÿ' ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .reduce((score, word) => score + (words.has(word) ? 1 : 0), 0);
}

/**
 * Detects the user's supported language from natural messages, not only from
 * explicit language commands. We intentionally require lexical evidence so
 * numbers, units and profile values do not randomly switch the UI language.
 */
export function detectLanguage(message: string): AppLanguage | null {
  const value = message.trim().toLowerCase();
  if (!value) return null;
  const explicit = parseLanguage(value);
  if (explicit) return explicit;

  const nlScore = scoreLanguage(value, DUTCH_WORDS);
  const enScore = scoreLanguage(value, ENGLISH_WORDS);
  if (nlScore === 0 && enScore === 0) return null;
  if (nlScore > enScore) return "nl";
  if (enScore > nlScore) return "en";
  return null;
}

export function parseLanguage(message: string): AppLanguage | null {
  const value = message.trim().toLowerCase().replace(/[.!?,]+$/g, "").replace(/’/g, "'");
  if (!value) return null;
  if (DUTCH.has(value) || /\b(in het )?(nederlands|dutch|hollands)\b/.test(value)) return "nl";
  if (ENGLISH.has(value) || /\b(in )?(english|engels)\b/.test(value)) return "en";
  return null;
}

export function isLanguageChange(message: string): boolean {
  const value = message.trim().toLowerCase();
  if (!value) return false;
  if (parseLanguage(value) !== null) return true;
  const hasDutch = /\b(nederlands|dutch|hollands)\b/.test(value);
  const hasEnglish = /\b(english|engels)\b/.test(value);
  if (!hasDutch && !hasEnglish) return false;
  return /\b(speak|talk|praat|praten|taal|language|switch|wissel|change|continue|verder|want|wil|will|let'?s|laten|toch)\b/.test(value);
}

export function requestedLanguage(message: string, fallback: AppLanguage): AppLanguage {
  return parseLanguage(message) ?? fallback;
}
