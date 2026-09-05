export type AppLanguage = "nl" | "en";

const DUTCH = new Set(["nederlands", "dutch", "hollands", "nederlandse"]);
const ENGLISH = new Set(["english", "engels", "engelse"]);

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
