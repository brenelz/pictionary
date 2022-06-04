import type { PointPayload } from "react-realtime-drawing/dist/types";
import { supabase } from "~/utils/supabase.server";
import { getRandomWord } from "../utils/words.server";

export type GameState = {
  id: number;
  word: string;
  drawing: PointPayload[];
  players: string[];
  current_drawer: number;
};

export async function getGameState() {
  const { data, error } = await supabase
    .from<GameState>("game_state")
    .select("id, word, drawing, players, current_drawer")
    .eq("id", 1)
    .single();

  if (error) {
    console.error(error);
    return null;
  }
  if (data) return data;
}

export async function nextPlayer(players: string[], current_drawer: number) {
  const { data, error } = await supabase
    .from<GameState>("game_state")
    .update({
      current_drawer:
        current_drawer >= players.length - 1 ? 0 : current_drawer + 1,
      drawing: [],
      word: getRandomWord(),
    })
    .eq("id", 1)
    .single();

  if (error) {
    console.error(error);
    return null;
  }
  if (data) return data;
}

export async function addPlayer(email: string) {
  const { data } = await supabase
    .from<GameState>("game_state")
    .select("players[]")
    .single();

  if (data) {
    await supabase
      .from<GameState>("game_state")
      .update({
        players: Array.from(new Set([...data.players, email])),
      })
      .eq("id", 1)
      .single();
  }
}

export async function removePlayer(email: string) {
  const { data } = await supabase
    .from<GameState>("game_state")
    .select("players[]")
    .single();

  if (data) {
    await supabase
      .from<GameState>("game_state")
      .update({
        players: data.players.filter((player) => player !== email),
      })
      .eq("id", 1)
      .single();
  }
}
