import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";

// Match routes without running loaders or rendering: loaders may need a server or
// network the test run lacks, and jsdom never loads the stylesheets React waits on.
describe("App routing", () => {
  it("matches a page for / instead of falling back to not found", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const matches = router.matchRoutes("/");

    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });

  it.each([
    ["/messages?recipient=00000000-0000-0000-0000-000000000001", "/messages"],
    ["/profile/someone", "/profile/$handle"],
    ["/profile/id/00000000-0000-0000-0000-000000000001", "/profile/id/$userId"],
    ["/u/00000000-0000-0000-0000-000000000001", "/u/$userId"],
    ["/u/5e072a58-2a91-497f-9fec-31c1a0df1780?post=post-1", "/u/$userId"],
    ["/profile/id/829cf6ba-6877-41fa-9d7d-303fb437986a?handle=&post=post-1", "/profile/id/$userId"],
    ["/profile?handle=someone", "/profile"],
  ])("registers navigation path %s", (href, expectedRouteId) => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    // matchRoutes accepts a pathname; TanStack parses query strings separately.
    const pathname = href.split("?")[0];
    const matches = router.matchRoutes(pathname);

    expect(matches.at(-1)?.routeId).toBe(expectedRouteId);
  });
});
