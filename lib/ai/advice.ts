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
- consider age, height, weight, training experience, training frequency and session duration when available;
- prefer realistic, sustainable goals over aggressive transformations;
- explain briefly why the recommended option fits the profile;
- if body recomposition is a reasonable option, describe it as an option rather than a certainty and explain that height/weight alone cannot establish body-fat level;
- suggest at most 2-3 suitable goal options and let the user choose;
- keep the response conversational and concise;
- do not prescribe a medical diet or diagnose anything;
- do not automatically save or select a goal.

For evidence framing, rely on established sports-nutrition and resistance-training evidence: resistance training supports muscle/strength development; adequate protein supports training adaptations; fat loss generally requires a sustained energy deficit, while slower loss can better preserve lean mass. Avoid invented study results, percentages, timelines, or guarantees.

Respond in ${language === "nl" ? "Dutch" : "English"}.`,
  });

  const text = response.text?.trim();
  if (!text) throw new Error("Gemini returned an empty goal-advice response");
  return text;
}
