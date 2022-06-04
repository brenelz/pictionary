import { supabase } from "~/utils/supabase.server";

export type Message = {
  id: number;
  email: string;
  text: string;
  timestamp: string;
};

export async function getMessages() {
  const { data, error } = await supabase
    .from<Message>("messages")
    .select("id, email, text, timestamp")
    .order("timestamp", { ascending: false })
    .limit(15);

  if (error) {
    console.error(error);
    return null;
  }
  if (data) return data;
}

export async function createMessage(email: string, text: string) {
  const { data, error } = await supabase
    .from<Message>("messages")
    .insert([{ email, text }]);

  if (error) {
    console.error(error);
    return null;
  }
  if (data) return data;
}
