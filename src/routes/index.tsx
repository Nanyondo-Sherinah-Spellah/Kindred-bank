import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Facebook, Instagram, Twitter } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { WhatsAppIcon } from "@/components/whatsapp-icon";
import { VoiceFab } from "@/components/voice-fab";
import officerCustomer from "@/assets/landing_officer_customer.jpg";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: LandingPage,
  head: () => ({
    meta: [
      { title: "Kindred Bank — AI Customer Service for a Microfinance Bank" },
      {
        name: "description",
        content:
          "Kindred Bank customer support by email, social media, WhatsApp and voice — The Bank That Knows You.",
      },
      { property: "og:title", content: "Kindred Bank — AI Customer Service for a Microfinance Bank" },
      {
        property: "og:description",
        content:
          "Kindred Bank customer support by email, social media, WhatsApp and voice — The Bank That Knows You.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const socials = [
  { to: "/social", label: "Facebook", icon: Facebook },
  { to: "/social", label: "Instagram", icon: Instagram },
  { to: "/social", label: "X (formerly Twitter)", icon: Twitter },
  { to: "/whatsapp", label: "WhatsApp", icon: WhatsAppIcon },
] as const;

function LandingPage() {
  const [useMobileMail, setUseMobileMail] = useState(false);

  useEffect(() => {
    setUseMobileMail(/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
  }, []);

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <AppHeader />

      <main className="relative flex flex-1">
        <img
          src={officerCustomer}
          alt="A smiling Kindred Bank officer assisting a smiling customer across a branch desk"
          width={1920}
          height={1088}
          className="absolute inset-x-0 top-0 h-[52svh] w-full object-cover object-[66%_26%] lg:inset-0 lg:h-full lg:object-center"
        />
        {/* Maroon scrim keeps the text readable over the photo */}
        <div aria-hidden className="absolute inset-0 hidden bg-gradient-to-r from-primary via-primary/85 to-primary/10 lg:block" />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-primary via-primary/95 to-transparent lg:hidden" />

        <section className="relative mx-auto flex w-full min-w-0 max-w-7xl flex-col justify-start px-5 pb-4 pt-2 sm:px-10 lg:pt-4">
          <div className="min-w-0 max-w-xl space-y-3 text-primary-foreground">
            <h1 className="font-display text-4xl font-bold leading-[1.05] sm:text-5xl lg:text-7xl">The Bank That Knows You</h1>
            <div className="max-w-lg space-y-2 text-sm leading-relaxed text-primary-foreground/90 lg:text-base">
              <p>Wherever you are, Kindred Bank is one message away.</p>
              <p>Talk to our</p>
              <ul className="list-disc space-y-1 pl-5 marker:text-primary-foreground/60">
                <li>
                  <strong className="font-semibold text-primary-foreground">Voice Agent</strong>,
                </li>
                <li>
                  Chat with our <strong className="font-semibold text-primary-foreground">Chatbot</strong>, or
                </li>
                <li>
                  Send an <strong className="font-semibold text-primary-foreground">Email</strong> to{" "}
                  <a
                    href={useMobileMail
                      ? "mailto:maxwelladdo85@gmail.com"
                      : "https://mail.google.com/mail/?view=cm&fs=1&to=maxwelladdo85%40gmail.com"}
                    target={useMobileMail ? undefined : "_blank"}
                    rel={useMobileMail ? undefined : "noopener noreferrer"}
                    className="wrap-anywhere font-semibold text-primary-foreground underline decoration-primary-foreground/50 underline-offset-4 hover:decoration-primary-foreground"
                  >
                    maxwelladdo85@gmail.com
                  </a>{" "}
                  and get an immediate reply — day or night.
                </li>
              </ul>
              <p>
                You can also message us on Facebook, Instagram, X and WhatsApp using the links below. Every
                answer comes from approved bank information, your personal matters stay private, and a real
                person is ready the moment you need one.
              </p>
            </div>
            <div className="space-y-1.5 pt-1">
              <Button asChild variant="secondary"><Link to="/open-account" search={{ channel: "chat" }}>Open an account</Link></Button>
              <p className="text-sm font-semibold text-primary-foreground">Message us on social media</p>
              <div className="flex flex-wrap items-center gap-2">
                {socials.map(({ to, label, icon: Icon }) => (
                  <Link
                    key={label}
                    to={to}
                    aria-label={label}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-primary-foreground/40 bg-primary-foreground/10 text-primary-foreground backdrop-blur transition-colors hover:bg-primary-foreground hover:text-primary"
                  >
                    <Icon className="h-4 w-4" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>
        <VoiceFab />
      </main>
    </div>
  );
}
