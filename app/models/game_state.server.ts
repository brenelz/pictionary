import { supabase } from "~/utils/supabase.server";

export type GameState = {
  word: string;
};

export async function getGameState() {
  const { data, error } = await supabase
    .from<GameState>("game_state")
    .select("id, word")
    .single();

  if (error) {
    console.error(error);
    return null;
  }
  if (data) return data;
}
