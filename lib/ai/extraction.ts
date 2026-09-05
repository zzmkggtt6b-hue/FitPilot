import OpenAI from "openai";
import { z } from "zod";
import { env } from "@/lib/config";
import type { OnboardingState, ExtractionResult } from "@/lib/onboarding/types";

const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

const extractionSchema = z.object({
  intent: z.enum(["answer", "question", "correction", "restart", "language_change", "general"]),
  fields: z.object({
    language: z.string().optional(), consent: z.boolean().optional(), age: z.number().int().min(13).max(100).optional(),
    sex: z.enum(["male", "female", "other", "prefer_not_to_say"]).optional(), height_cm: z.number().positive().max(300).optional(), weight_kg: z.number().positive().max(500).optional(),
    experience_level: z.enum(["beginner", "intermediate", "advanced"]).optional(), training_location: z.enum(["gym", "home", "both"]).optional(),
    days_per_week: z.number().int().min(1).max(7).optional(), session_duration_minutes: z.number().int().min(15).max(300).optional(),
    goals: z.array(z.enum(["muscle_gain", "fat_loss", "strength", "general_fitness", "endurance", "body_recomposition"])).optional(),
    preferred_days: z.array(z.string()).optional(), preferred_time: z.string().optional(), equipment: z.array(z.string()).optional(),
    exercise_preferences: z.string().optional(), exercise_restrictions: z.string().optional()
  }),
  reply_hint: z.string().optional()
});

const jsonSchema = {
  type: "object", additionalProperties: false,
  properties: {
    intent: { type: "string", enum: ["answer", "question", "correction", "restart", "language_change", "general"] },
    fields: {
      type: "object", additionalProperties: false,
      properties: {
        language: { type: "string" }, consent: { type: "boolean" }, age: { type: "integer" },
        sex: { type: "string", enum: ["male", "female", "other", "prefer_not_to_say"] }, height_cm: { type: "number" }, weight_kg: { type: "number" },
        experience_level: { type: "string", enum: ["beginner", "intermediate", "advanced"] }, training_location: { type: "string", enum: ["gym", "home", "both"] },
        days_per_week: { type: "integer" }, session_duration_minutes: { type: "integer" },
        goals: { type: "array", items: { type: "string", enum: ["muscle_gain", "fat_loss", "strength", "general_fitness", "endurance", "body_recomposition"] } },
        preferred_days: { type: "array", items: { type: "string" } }, preferred_time: { type: "string" }, equipment: { type: "array", items: { type: "string" } },
        exercise_preferences: { type: "string" }, exercise_restrictions: { type: "string" }
      }
    },
    reply_hint: { type: "string" }
  },
  required: ["intent", "fields"]
};

export async function extractOnboarding(input: { state: OnboardingState; message: string; profile: Record<string, unknown> }): Promise<ExtractionResult> {
  const response = await client.responses.create({
    model: env.OPENAI_MODEL,
    store: false,
    instructions: `You are FitPilot's onboarding extraction engine. Extract only information explicitly stated or safely implied by the user's message. Never invent values. Current state: ${input.state}. Existing profile: ${JSON.stringify(input.profile)}. Classify intent and return only fields supported by the schema.`,
    input: input.message,
    text: { format: { type: "json_schema", name: "fitpilot_onboarding", strict: false, schema: jsonSchema } }
  });
  return extractionSchema.parse(JSON.parse(response.output_text));
}
