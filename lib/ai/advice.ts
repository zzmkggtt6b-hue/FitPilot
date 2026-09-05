import { GoogleGenAI } from "@google/genai";
import { env } from "@/lib/config";

const client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
const model = env.GEMINI_MODEL === "gemini-2.5-flash" ? "gemini-3.6-flash" : env.GEMINI_MODEL;

export async function generateGoalAdvice(profile: Record<string, unknown>, language: "nl" | "en") {
  const response = await client.models.generateContent({
    model,
    contents: `You are FitPilot's evidence-informed fitness coach. The user is choosing a fitness goal and asks for advice rather than giving a goal.

Existing profile:
${JSON.stringify(profile)}

Give practical, conservative goal advice based only on the available profile. The advice must:
- distinguish evidence-supported guidance from assumptions;
- never claim to know body-fat percentage, health status, maintenance calories, or other unprovided facts;
- never calculate, guess, or invent a body-fat percentage from age, sex, height, weight, BMI, or appearance;
- treat body-fat percentage as optional information: its absence must never block useful goal advice;
- consider age, height, weight, training experience, training frequency and session duration when available;
- prefer realistic, sustainable goals over aggressive transformations;
- if the available profile makes body recomposition a reasonable option, it is fine to put recomposition first, but describe it as an option rather than a diagnosis or certainty;
- explain that height and weight alone cannot establish body-fat level, so do not tell the user that they 'need to lose fat' unless they explicitly say they want that outcome;
- distinguish the user's desired outcome (for example muscle, strength, waist/fat loss, fitness, or scale weight) from what the available measurements can actually establish;
- suggest at most 2-3 suitable goal options and let the user choose;
- if the profile is not enough to make a useful recommendation, ask exactly one high-value follow-up question instead of asking for body-fat percentage by default;
- keep the response conversational and concise;
- do not prescribe a medical diet or diagnose anything;
- do not automatically save or select a goal.

Evidence framing: resistance training supports muscle and strength development; adequate protein supports training adaptations; fat loss generally requires a sustained energy deficit; slower, sustainable loss can help preserve lean mass. Body recomposition can occur in some resistance-training contexts, but it is not guaranteed and should not be presented as universally superior. Avoid invented study results, percentages, timelines, or guarantees.

Respond in ${language === "nl" ? "Dutch" : "English"}.`,
  });

  const text = response.text?.trim();
  if (!text) throw new Error("Gemini returned an empty goal-advice response");
  return text;
}
