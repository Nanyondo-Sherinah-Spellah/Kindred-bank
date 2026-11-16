import { useEffect, useState } from "react";
import { ArrowLeft, MessageCircle, Mic, X } from "lucide-react";
import { PublicVoiceChat } from "@/components/public-voice-chat";
import { Button } from "@/components/ui/button";

type Mode = "voice" | "chat";

/**
 * Floating assistant for the landing page. Visitors choose between a text
 * chatbot and the voice assistant; both use the same approved answers.
 */
export function VoiceFab() {
  const [open, setOpen] = useState(false);
  const [entered, setEntered] = useState(false);
  const [engaged, setEngaged] = useState(false);
  const [mode, setMode] = useState<Mode | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setEntered(true), 350);
    return () => window.clearTimeout(t);
  }, []);

  if (!entered) return null;

  if (open) {
    const title = mode === "chat" ? "Chat Assistant" : mode === "voice" ? "Voice Assistant" : "How would you like to talk?";
    return (
      <div
        role="dialog"
        aria-label={title}
        className={`fixed bottom-4 right-4 z-50 flex w-[calc(100vw-2rem)] flex-col transition-all duration-300 ${engaged ? "max-h-[calc(100svh-2rem)] max-w-2xl" : "max-h-[min(75svh,640px)] max-w-sm"} overflow-hidden rounded-2xl border border-border bg-card shadow-xl`}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-secondary px-4 py-3">
          <p className="flex min-w-0 items-center gap-2 font-display text-base font-semibold text-foreground">
            {mode && (
              <Button aria-label="Choose another way to talk" size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setMode(null); setEngaged(false); }}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            {mode === "chat" ? <MessageCircle className="h-4 w-4 text-primary" /> : <Mic className="h-4 w-4 text-primary" />}
            <span className="truncate">{title}</span>
          </p>
          <Button aria-label="Close assistant" size="icon" variant="ghost" className="h-8 w-8" onClick={() => setOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {mode ? (
            <PublicVoiceChat key={mode} mode={mode} onEngage={setEngaged} />
          ) : (
            <div className="grid gap-3">
              <ModeButton icon={<MessageCircle className="h-5 w-5" />} title="Chat with us" hint="Type your questions and read the answers." onClick={() => setMode("chat")} />
              <ModeButton icon={<Mic className="h-5 w-5" />} title="Voice assistant" hint="Speak your question and hear the answer." onClick={() => setMode("voice")} />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      aria-label="Open assistant"
      onClick={() => setOpen(true)}
      className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-primary-foreground shadow-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-safe:animate-in motion-safe:zoom-in-50 motion-safe:slide-in-from-bottom-4 motion-safe:duration-300"
    >
      <MessageCircle className="h-5 w-5" />
      <span className="text-sm font-semibold">Talk to us</span>
    </button>
  );
}

function ModeButton({ icon, title, hint, onClick }: { icon: React.ReactNode; title: string; hint: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-xl border border-border p-4 text-left transition-colors hover:border-primary hover:bg-secondary">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">{icon}</span>
      <span><span className="block font-semibold text-foreground">{title}</span><span className="block text-sm text-muted-foreground">{hint}</span></span>
    </button>
  );
}
