import type { PointPayload } from "react-realtime-drawing/dist/types";
import { supabase } from "~/utils/supabase.server";

export type Drawing = {
  id: number;
  path: PointPayload[];
};

export async function getDrawing(id: number) {
  const { data, error } = await supabase
    .from<Drawing>("drawings")
    .select("id, path")
    .eq("id", id)
    .single();

  if (error) {
    console.error(error);
    return null;
  }
  if (data) return data;
}
