import type { PointPayload } from "react-realtime-drawing/dist/types";
import { supabase } from "~/utils/supabase.server";
import { getRandomWord } from "../utils/words";

export type GameState = {
  id: number;
  word: string;
  drawing: PointPayload[];
  players: string[];
  current_drawer: number;
};

export async function getGameState(id: number) {
  const { data, error } = await supabase
    .from<GameState>("game_state")
    .select("id, word, drawing, players, current_drawer")
    .eq("id", id)
    .single();

  if (error) {
    console.error(error);
    return null;
  }
  if (data) return data;
}

export async function nextPlayer(
  id: number,
  players: string[],
  current_drawer: number
) {
  const { data, error } = await supabase
    .from<GameState>("game_state")
    .update({
      current_drawer:
        current_drawer >= players.length - 1 ? 0 : current_drawer + 1,
      drawing: [],
      word: getRandomWord(),
    })
    .eq("id", id)
    .single();

  if (error) {
    console.error(error);
    return null;
  }
  if (data) return data;
}

export async function addPlayer(id: number, email: string) {
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
      .eq("id", id)
      .single();
  }
}

export async function removePlayer(id: number, email: string) {
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
      .eq("id", id)
      .single();
  }
}
