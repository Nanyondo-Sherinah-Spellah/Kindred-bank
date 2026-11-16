import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";
import { ASSISTANT_PATHS, DEFAULT_ASSISTANT_PATH, isAssistantPath } from "@/lib/access";

// Match routes without running loaders or rendering: loaders may need a server or
// network the test run lacks, and jsdom never loads the stylesheets React waits on.
describe("App routing", () => {
  it("opens voice outside the authenticated layout", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    const matches = router.matchRoutes("/voice");
    expect(matches.at(-1)?.routeId).toBe("/voice");
    expect(matches.some((match) => match.routeId.includes("_authenticated"))).toBe(false);
  });
  it("matches a page for / instead of falling back to not found", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const matches = router.matchRoutes("/");

    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });
});

describe("Console access", () => {
  it("opens only the email, social and voice assistants", () => {
    expect([...ASSISTANT_PATHS].sort()).toEqual(["/email", "/social", "/staff-voice", "/whatsapp"]);
    for (const path of ASSISTANT_PATHS) expect(isAssistantPath(path)).toBe(true);
    expect(DEFAULT_ASSISTANT_PATH).toBe("/email");
  });

  it("blocks every other staff page, including nested paths", () => {
    for (const path of [
      "/",
      "/dashboard",
      "/knowledge",
      "/customers",
      "/history",
      "/escalations",
      "/integrations",
      "/settings",
      "/email/secret",
    ]) {
      expect(isAssistantPath(path)).toBe(false);
    }
  });
});
