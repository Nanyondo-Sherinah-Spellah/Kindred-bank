import { createFileRoute } from "@tanstack/react-router";
import { AppHeader } from "@/components/app-header";
import { PublicVoiceChat } from "@/components/public-voice-chat";

export const Route = createFileRoute("/voice")({
  head: () => ({ meta: [
    { title: "Public Voice Support — Kindred Bank" },
    { name: "description", content: "Kindred Bank support in English, Pidgin, Hausa, Igbo and Yoruba, with AI voice auditions." },
    { property: "og:title", content: "Public Voice Support — Kindred Bank" },
    { property: "og:description", content: "Kindred Bank support in English, Pidgin, Hausa, Igbo and Yoruba, with AI voice auditions." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <><AppHeader /><main className="mx-auto w-full max-w-2xl space-y-5 px-3 py-6 sm:px-6"><h1 className="text-2xl font-semibold">Voice Assistant</h1><PublicVoiceChat /></main></>,
});