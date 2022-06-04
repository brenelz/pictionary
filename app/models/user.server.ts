import { supabase } from "~/utils/supabase.server";

export type User = { id: string; email: string; score: number };

export async function createUser(email: string, password: string) {
  const { user } = await supabase.auth.signUp({
    email,
    password,
  });

  // get the user profile after created
  const profile = await getProfileByEmail(user?.email);

  return profile;
}

export async function getProfileById(id: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("email, id, score")
    .eq("id", id)
    .single();

  if (error) return null;
  if (data) return { id: data.id, email: data.email, score: data.score };
}

export async function getProfileByEmail(email?: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("email, id, score")
    .eq("email", email)
    .single();

  if (error) return null;
  if (data) return data;
}

export async function updateScore(email: string, score: number) {
  const { data, error } = await supabase
    .from("profiles")
    .update({ score })
    .eq("email", email)
    .single();

  if (error) return null;
  if (data) return data;
}

export async function getPlayers() {
  const { data, error } = await supabase
    .from<User>("profiles")
    .select("id, score, email")
    .order("score", { ascending: false });

  if (error) return null;
  if (data) return data;
}

export async function verifyLogin(email: string, password: string) {
  const { user, error } = await supabase.auth.signIn({
    email,
    password,
  });

  if (error) return undefined;
  const profile = await getProfileByEmail(user?.email);

  return profile;
}
