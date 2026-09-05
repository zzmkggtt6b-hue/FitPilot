import { GoogleGenAI } from "@google/genai";
import { env } from "@/lib/config";
import { COACH_SYSTEM_PROMPT } from "./prompts/coach";

const client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
const model = env.GEMINI_MODEL === "gemini-2.5-flash" ? "gemini-3.6-flash" : env.GEMINI_MODEL;

export async function generateGoalAdvice(profile: Record<string, unknown>, language: "nl" | "en") {
  const response = await client.models.generateContent({
    model,
    contents: `${COACH_SYSTEM_PROMPT}\n\nSPECIAL TASK: The user is choosing a fitness goal and wants practical advice rather than having a goal automatically selected.\n\nRULES FOR THIS TASK:\n- Use only the available profile; never invent body-fat percentage, health status, maintenance calories or other missing facts.\n- Body-fat percentage is optional and its absence must never block useful goal advice.\n- Height and weight alone cannot establish body-fat level and must not be used to claim the user needs to lose fat.\n- Consider age, height, weight, training experience, frequency and session duration when available.\n- Suggest at most 2-3 suitable goal options and let the user choose.\n- If the profile is insufficient for useful advice, ask exactly one high-value follow-up question.\n- Do not automatically save or select a goal.\n- Keep the response conversational and concise.\n- Do not diagnose or prescribe a medical diet.\n\nEvidence framing: resistance training supports muscle and strength development; adequate protein supports training adaptations; fat loss generally requires a sustained energy deficit; slower, sustainable loss can help preserve lean mass. Body recomposition can occur in some resistance-training contexts, but it is not guaranteed or universally superior. Avoid invented study results, percentages, timelines or guarantees.\n\nUSER PROFILE:\n${JSON.stringify(profile)}\n\nRESPOND IN: ${language === "nl" ? "Dutch" : "English"}`,
  });

  const text = response.text?.trim();
  if (!text) throw new Error("Gemini returned an empty goal-advice response");
  return text;
}
