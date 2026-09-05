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
  const [profile, training, prefs, goals] = await Promise.all([
    supabaseAdmin.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabaseAdmin.from("training_profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabaseAdmin.from("user_preferences").select("*").eq("user_id", userId).maybeSingle(),
    supabaseAdmin.from("fitness_goals").select("goal,priority").eq("user_id", userId).order("priority")
  ]);
  if (profile.error || training.error || prefs.error || goals.error) throw profile.error ?? training.error ?? prefs.error ?? goals.error;
  return { ...(profile.data ?? {}), ...(training.data ?? {}), ...(prefs.data ?? {}), goals: (goals.data ?? []).map((g) => g.goal) };
}

export async function saveProfile(userId: string, data: ProfileData) {
  const { language, ...rest } = data;
  const userUpdate = language ? supabaseAdmin.from("users").update({ language, updated_at: new Date().toISOString() }).eq("id", userId) : Promise.resolve({ error: null });
  const profileUpdate = supabaseAdmin.from("profiles").upsert({ user_id: userId, age: rest.age, sex: rest.sex, height_cm: rest.height_cm, weight_kg: rest.weight_kg, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  const trainingUpdate = supabaseAdmin.from("training_profiles").upsert({ user_id: userId, experience_level: rest.experience_level, training_location: rest.training_location, days_per_week: rest.days_per_week, session_duration_minutes: rest.session_duration_minutes, equipment: rest.equipment ?? [], updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  const prefsUpdate = supabaseAdmin.from("user_preferences").upsert({ user_id: userId, preferred_days: rest.preferred_days ?? [], preferred_time: rest.preferred_time, exercise_preferences: rest.exercise_preferences, exercise_restrictions: rest.exercise_restrictions, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  const results = await Promise.all([userUpdate, profileUpdate, trainingUpdate, prefsUpdate]);
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
