import { Form, useLoaderData, useFetcher } from "@remix-run/react";
import { useUser } from "~/utils";
import type { LoaderFunction, ActionFunction } from "@remix-run/node";
import { redirect, json } from "@remix-run/node";
import { getUser, getUserId, logout } from "~/session.server";
import { createMessage, getMessages } from "~/models/messages.server";
import type { Message } from "~/models/messages.server";
import { useEffect, useRef, useState, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import { getScores, updateScore } from "~/models/user.server";
import { useRealtimeDrawer, useRealtimeViewer } from "react-realtime-drawing";
import { nextPlayer } from "~/models/game_state.server";
import type { onChangeMethod } from "react-realtime-drawing/dist/types";
import { getGameState } from "~/models/game_state.server";
import type { GameState } from "~/models/game_state.server";

export const currentGame = 1;

export type LoaderData = {
  messages: Message[];
  gameState: GameState;
  scores: {
    id: number;
    email: string;
    score: number;
  }[];
  env: {
    supabaseUrl: string;
    supabaseAnonKey: string;
  };
};

export const loader: LoaderFunction = async ({ request }) => {
  const userId = await getUserId(request);
  const user = await getUser(request);
  if (!userId || !user) return redirect("/");

  const messages = await getMessages();
  const gameState = await getGameState(currentGame);
  const scores = await getScores();

  if (gameState && gameState?.current_drawer > gameState?.players.length - 1) {
    await nextPlayer(
      currentGame,
      gameState?.players,
      gameState?.current_drawer
    );
  }

  return json({
    messages,
    user,
    gameState,
    scores,
    env: {
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
    },
  });
};

export const action: ActionFunction = async ({ request }) => {
  const form = await request.formData();
  let text = form.get("text");
  const intent = form.get("intent");
  if (intent === "leave") {
    return logout(request);
  }

  const gameState = await getGameState(currentGame);

  if (intent === "skip" && gameState) {
    await nextPlayer(currentGame, gameState.players, gameState.current_drawer);
    return null;
  }

  const user = await getUser(request);

  if (typeof text !== "string" || text.length === 0) {
    return null;
  }

  const hasWon = text === gameState?.word;

  if (hasWon) {
    await updateScore(user?.email, user?.score + 1);
    await nextPlayer(currentGame, gameState.players, gameState.current_drawer);
    await createMessage(user?.email, "✅ " + text);
  } else {
    await createMessage(user?.email, "❌ " + text);
  }

  return null;
};

export default function Index() {
  const data = useLoaderData() as LoaderData;
  const user = data.user;
  const fetcher = useFetcher();
  const [messages, setMessages] = useState(data.messages);
  const [gameState, setGameState] = useState(data.gameState);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const supabase = createClient(data.env.supabaseUrl, data.env.supabaseAnonKey);

  const [viewerRef, onChange, { reset: resetViewer }] = useRealtimeViewer();
  const drawer = gameState.players[gameState.current_drawer];
  const isDrawer = drawer === user?.email;
  const isWaiting = gameState.players.length < 2;

  const onDrawingChange: onChangeMethod = async (payload) => {
    await supabase
      .from("game_state")
      .update({ drawing: payload })
      .eq("id", currentGame)
      .single();
  };

  const [drawerRef, { reset: resetDrawer }] = useRealtimeDrawer({
    strokeWidth: 4,
    color: "#000",
    onChange: onDrawingChange,
  });

  const handleReset = useCallback(() => {
    resetDrawer();
    resetViewer();
  }, [resetDrawer, resetViewer]);

  useEffect(() => {
    const messagesSubscription = supabase
      .from("messages")
      .on("INSERT", (payload) => {
        setMessages((messages) => [payload.new, ...messages]);
      })
      .subscribe();

    const gameStateSubscription = supabase
      .from("game_state")
      .on("UPDATE", (payload) => {
        onChange(payload.new.drawing);
        setGameState(payload.new);
        if (payload.new.drawing.length === 0) {
          handleReset();
        }
      })
      .subscribe();

    return () => {
      supabase.removeSubscription(messagesSubscription);
      supabase.removeSubscription(gameStateSubscription);
    };
  }, [onChange]);

  useEffect(() => {
    setMessages(data.messages);
    setGameState(data.gameState);

    if (!fetcher.submission) {
      formRef.current?.reset();
      inputRef.current?.focus();
    }
  }, [formRef, fetcher.submission, data.messages, data.gameState]);

  return (
    <main className="relative min-h-screen w-full bg-white sm:flex sm:items-center sm:justify-center">
      <div className="relative w-full sm:pb-16 sm:pt-8">
        <div className="mx-auto max-w-7xl sm:px-6 lg:px-8">
          <div className={`relative sm:overflow-hidden sm:rounded-2xl`}>
            <div className="lg:pb-18 relative px-4 pb-8 sm:px-6  sm:pb-14 lg:px-8">
              <h1 className="pt-4 pb-6 text-center text-3xl font-extrabold tracking-tight sm:pt-0 sm:text-4xl lg:text-4xl">
                <span className="block uppercase text-rose-500 drop-shadow-md">
                  Pictionary{" "}
                </span>
              </h1>

              {!isWaiting && isDrawer ? (
                <p className="text-center">
                  Draw the word: <strong>{gameState.word}</strong>
                </p>
              ) : (
                <p>&nbsp;</p>
              )}

              <Form method="post">
                <p className="my-4 flex justify-center gap-2">
                  {isWaiting && (
                    <span className="text-lg text-slate-500">
                      Waiting for players...
                    </span>
                  )}

                  <button
                    type="submit"
                    name="intent"
                    value="leave"
                    className="rounded bg-rose-600 py-2 px-4 text-xs text-blue-100 hover:bg-rose-500 active:bg-rose-600"
                  >
                    Leave
                  </button>

                  {!isWaiting && (
                    <button
                      className="rounded bg-slate-600 py-2 px-4 text-xs text-blue-100 hover:bg-slate-500 active:bg-slate-600 disabled:bg-slate-400"
                      type="submit"
                      name="intent"
                      value="skip"
                    >
                      Skip
                    </button>
                  )}
                </p>
              </Form>

              <div
                className={`mh-96 flex flex-wrap ${
                  isWaiting ? " pointer-events-none opacity-30" : ""
                }`}
              >
                <div className="mh-96 w-full border-2 md:w-2/3">
                  <canvas
                    className={!isDrawer ? "hidden" : ""}
                    ref={drawerRef}
                  />
                  <canvas
                    className={isDrawer ? "hidden" : ""}
                    ref={viewerRef}
                  />
                </div>
                <div className="w-full border-2 p-2 px-4 text-xs md:w-1/3">
                  <div className="flex h-80 flex-col-reverse overflow-scroll">
                    {messages.length > 0 &&
                      messages.map((message) => (
                        <p key={message.id} className="mb-1">
                          <strong
                            className={
                              user?.email !== message.email
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
                    className="mt-2 flex flex-wrap gap-2"
                    ref={formRef}
                  >
                    <input
                      disabled={!!fetcher.submission || isDrawer || isWaiting}
                      className="flex-1 border-2 p-2"
                      type="text"
                      name="text"
                      ref={inputRef}
                    />
                    <button
                      disabled={!!fetcher.submission || isDrawer || isWaiting}
                      type="submit"
                      className="rounded bg-slate-600 py-2 px-4 text-blue-100 hover:bg-slate-500 active:bg-slate-600 disabled:bg-slate-400"
                    >
                      Guess!
                    </button>
                  </fetcher.Form>
                </div>
              </div>

              {user && (
                <>
                  <div className="mt-4 text-center">
                    <h3 className="underline">Leaderboard</h3>
                    {data.scores.length > 0 &&
                      data.scores.map((score) => (
                        <p key={score.id} className="mb-1">
                          <strong>{score.email}</strong>: {score.score}
                        </p>
                      ))}
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
