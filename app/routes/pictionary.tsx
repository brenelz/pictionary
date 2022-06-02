import { Form, useLoaderData, useFetcher } from "@remix-run/react";
import { useOptionalUser } from "~/utils";
import type { LoaderFunction, ActionFunction } from "@remix-run/node";
import { redirect, json } from "@remix-run/node";
import { getUser, getUserId } from "~/session.server";
import { createMessage, getMessages } from "~/models/messages.server";
import type { Message } from "~/models/messages.server";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { updateScore } from "~/models/user.server";
import { useRealtimeDrawer, useRealtimeViewer } from "react-realtime-drawing";
import type { Drawing } from "~/models/drawing.server";
import { getDrawing } from "~/models/drawing.server";
import type { onChangeMethod } from "react-realtime-drawing/dist/types";

const gameState = {
  id: 1,
  word: "test",
  players: ["brenelz@gmail.com", "brenleydueck@gmail.com"],
  currentDrawer: 0,
};

export type LoaderData = {
  messages: Message[];
  drawing: Drawing;
  env: {
    supabaseUrl: string;
    supabaseAnonKey: string;
  };
};

export const loader: LoaderFunction = async ({ request }) => {
  const userId = await getUserId(request);
  if (!userId) return redirect("/");

  const messages = await getMessages();
  const drawing = await getDrawing(gameState.id);

  return json({
    messages,
    drawing,
    env: {
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
    },
  });
};

export const action: ActionFunction = async ({ request }) => {
  const form = await request.formData();
  let text = form.get("text");
  const user = await getUser(request);

  if (typeof text !== "string" || text.length === 0) {
    return null;
  }

  const hasWon = text === gameState.word;
  if (hasWon) {
    text = "✅ " + text;
    await updateScore(user?.email, user?.score + 1);
  } else {
    text = "❌ " + text;
  }

  await createMessage(user?.email, text);

  return null;
};

export default function Index() {
  const user = useOptionalUser();
  const data = useLoaderData() as LoaderData;
  const fetcher = useFetcher();
  const [messages, setMessages] = useState(data.messages);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const supabase = createClient(data.env.supabaseUrl, data.env.supabaseAnonKey);

  const [viewerRef, onChange] = useRealtimeViewer();
  const drawer = gameState.players[gameState.currentDrawer];
  const isDrawer = drawer === user.email;
  const onDrawingChange: onChangeMethod = async (payload) => {
    await supabase
      .from("drawings")
      .update({ path: payload })
      .eq("id", gameState.id)
      .single();
  };

  const [drawerRef] = useRealtimeDrawer({
    strokeWidth: 4,
    color: "#000",
    onChange: onDrawingChange,
  });

  useEffect(() => {
    const drawingsSubscription = supabase
      .from("drawings")
      .on("UPDATE", (payload) => {
        onChange(payload.new.path);
      })
      .subscribe();

    return () => {
      supabase.removeSubscription(drawingsSubscription);
    };
  }, [supabase, data.drawing.path, onChange]);

  useEffect(() => {
    const messagesSubscription = supabase
      .from("messages")
      .on("INSERT", (payload) => {
        setMessages([payload.new, ...messages]);
      })
      .subscribe();

    return () => {
      supabase.removeSubscription(messagesSubscription);
    };
  }, [supabase, messages]);

  useEffect(() => {
    setMessages(data.messages);
  }, [data.messages]);

  useEffect(() => {
    if (!fetcher.submission) {
      formRef.current?.reset();
      inputRef.current?.focus();
    }
  }, [formRef, fetcher.submission]);

  return (
    <main className="relative min-h-screen w-full bg-white sm:flex sm:items-center sm:justify-center">
      <div className="relative w-full sm:pb-16 sm:pt-8">
        <div className="mx-auto max-w-7xl sm:px-6 lg:px-8">
          <div className="relative sm:overflow-hidden sm:rounded-2xl">
            <div className="lg:pb-18 relative px-4 pb-8 sm:px-6  sm:pb-14 lg:px-8">
              <h1 className="pb-6 text-center text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-4xl">
                <span className="block uppercase text-rose-500 drop-shadow-md">
                  Pictionary
                </span>
              </h1>

              {isDrawer && (
                <p className="my-4">
                  Draw the word: <strong>{gameState.word}</strong>
                </p>
              )}

              <div className="flex h-96 gap-10">
                <div className="w-2/3 border-2">
                  <canvas ref={isDrawer ? drawerRef : viewerRef} />
                </div>
                <div className="w-1/3 border-2 p-2 px-4 text-xs">
                  <div className="flex h-80 flex-col-reverse overflow-scroll">
                    {messages.length > 0 &&
                      messages.map((message) => (
                        <p key={message.id} className="mb-1">
                          <strong
                            className={
                              user.email !== message.email
                                ? "text-slate-600"
                                : ""
                            }
                          >
                            {message.email}
                          </strong>
                          : {message.text}
                        </p>
                      ))}
                  </div>
                  <fetcher.Form
                    method="post"
                    className="mt-2 flex"
                    ref={formRef}
                  >
                    <input
                      disabled={!!fetcher.submission || isDrawer}
                      className="flex-1 border-2 p-2"
                      type="text"
                      name="text"
                      ref={inputRef}
                    />
                    <button
                      disabled={!!fetcher.submission || isDrawer}
                      type="submit"
                      className="ml-2 rounded bg-rose-600 py-2 px-4 text-blue-100 hover:bg-rose-500 active:bg-rose-600 disabled:bg-rose-400"
                    >
                      {fetcher.submission ? "Sending..." : "Send"}
                    </button>
                  </fetcher.Form>
                </div>
              </div>

              {user && (
                <>
                  <p className="mt-4 text-center">
                    Your Score: <strong>{user.score} </strong>
                  </p>

                  <div className="mx-auto mt-10 max-w-sm sm:flex sm:max-w-none sm:justify-center">
                    <Form action="/logout" method="post">
                      <button
                        type="submit"
                        className="rounded bg-rose-600 py-2 px-4 text-blue-100 hover:bg-rose-500 active:bg-rose-600"
                      >
                        Logout
                      </button>
                    </Form>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
