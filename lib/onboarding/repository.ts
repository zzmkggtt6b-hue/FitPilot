import { supabaseAdmin } from "@/lib/supabase/admin";
import type { OnboardingState, ProfileData } from "./types";

export async function getOrCreateUser(telegramUserId: number, username?: string) {
  const { data, error } = await supabaseAdmin.from("users").upsert(
    { telegram_user_id: telegramUserId, username, updated_at: new Date().toISOString() },
    { onConflict: "telegram_user_id" }
  ).select("*").single();
  if (error) throw error;
  return data;
}

export async function getSession(userId: string) {
  const { data, error } = await supabaseAdmin.from("onboarding_sessions").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function ensureSession(userId: string) {
  const existing = await getSession(userId);
  if (existing) return existing;
  const { data, error } = await supabaseAdmin.from("onboarding_sessions").insert({ user_id: userId }).select("*").single();
  if (error) throw error;
  return data;
}

export async function loadProfile(userId: string): Promise<Record<string, unknown>> {
  const [user, profile, training, prefs, goals] = await Promise.all([
    supabaseAdmin.from("users").select("language,consent_at").eq("id", userId).single(),
    supabaseAdmin.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabaseAdmin.from("training_profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabaseAdmin.from("user_preferences").select("*").eq("user_id", userId).maybeSingle(),
    supabaseAdmin.from("fitness_goals").select("goal,priority").eq("user_id", userId).order("priority")
  ]);
  if (user.error || profile.error || training.error || prefs.error || goals.error) throw user.error ?? profile.error ?? training.error ?? prefs.error ?? goals.error;
  return { ...(user.data ?? {}), ...(profile.data ?? {}), ...(training.data ?? {}), ...(prefs.data ?? {}), goals: (goals.data ?? []).map((g) => g.goal) };
}

export async function saveProfile(userId: string, data: ProfileData) {
  const now = new Date().toISOString();
  const userValues: Record<string, unknown> = { updated_at: now };
  if (data.language !== undefined) userValues.language = data.language;
  if (data.consent === true) userValues.consent_at = now;
  const profileValues: Record<string, unknown> = { user_id: userId, updated_at: now };
  for (const key of ["age", "sex", "height_cm", "weight_kg"] as const) if (data[key] !== undefined) profileValues[key] = data[key];
  const trainingValues: Record<string, unknown> = { user_id: userId, updated_at: now };
  for (const key of ["experience_level", "training_location", "days_per_week", "session_duration_minutes", "equipment"] as const) if (data[key] !== undefined) trainingValues[key] = data[key];
  const prefsValues: Record<string, unknown> = { user_id: userId, updated_at: now };
  for (const key of ["preferred_days", "preferred_time", "exercise_preferences", "exercise_restrictions"] as const) if (data[key] !== undefined) prefsValues[key] = data[key];

  const results = await Promise.all([
    supabaseAdmin.from("users").update(userValues).eq("id", userId),
    supabaseAdmin.from("profiles").upsert(profileValues, { onConflict: "user_id" }),
    supabaseAdmin.from("training_profiles").upsert(trainingValues, { onConflict: "user_id" }),
    supabaseAdmin.from("user_preferences").upsert(prefsValues, { onConflict: "user_id" })
  ]);
  const firstError = results.find((r) => r.error)?.error;
  if (firstError) throw firstError;
  if (data.goals) {
    const { error } = await supabaseAdmin.from("fitness_goals").delete().eq("user_id", userId);
    if (error) throw error;
    if (data.goals.length) {
      const { error: insertError } = await supabaseAdmin.from("fitness_goals").insert(data.goals.map((goal, index) => ({ user_id: userId, goal, priority: index + 1 })));
      if (insertError) throw insertError;
    }
  }
}

export async function setState(userId: string, state: OnboardingState, completed = false) {
  const { error } = await supabaseAdmin.from("onboarding_sessions").update({ current_state: state, completed, completed_at: completed ? new Date().toISOString() : null }).eq("user_id", userId);
  if (error) throw error;
}

export async function addMessage(userId: string, role: "user" | "assistant", content: string) {
  const { error } = await supabaseAdmin.from("conversation_messages").insert({ user_id: userId, role, content });
  if (error) throw error;
}
