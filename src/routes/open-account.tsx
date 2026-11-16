import { createFileRoute } from "@tanstack/react-router";
import { AppHeader } from "@/components/app-header";
import { AccountOpeningForm } from "@/components/account-opening-form";
export const Route = createFileRoute("/open-account")({
  validateSearch: (s: Record<string, unknown>) => ({
    channel:
      s["channel"] === "email"
        ? ("email" as const)
        : s["channel"] === "voice"
          ? ("voice" as const)
          : ("chat" as const),
  }),
  head: () => ({
    meta: [
      { title: "Open an Account — Kindred Bank" },
      {
        name: "description",
        content: "Self-service fictional bank account opening with email verification.",
      },
      { property: "og:title", content: "Open an Account — Kindred Bank" },
      {
        property: "og:description",
        content: "Apply for fictional Kindred Bank accounts securely.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => {
    const { channel } = Route.useSearch();
    return (
      <>
        <AppHeader />
        <main className="mx-auto max-w-3xl px-5 py-8">
          <AccountOpeningForm channel={channel} />
        </main>
      </>
    );
  },
});
