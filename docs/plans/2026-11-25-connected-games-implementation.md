# Nexora Connected Games Implementation Plan

> **For agentic workers:** Use the host's available task-by-task implementation workflow. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a curated third-party browser-game catalogue and safe launch experience to Nexora Arena → Instant Play without changing existing Nexora Originals.

**Architecture:** Keep a typed, code-reviewed local manifest and pure URL/origin validation separate from the UI. Add a Connected Games component alongside the three existing Arena mini-games; only validated catalogue entries may reach an iframe, while external-only entries use an explicit safe outbound link. The initial catalogue remains empty until individual games have confirmed permissions and embed requirements.

**Tech Stack:** React 19, TypeScript, TanStack Router, Tailwind CSS, Vitest, GitHub Actions, Vite.

## Global Constraints

- Preserve Free Kick Challenge, Penalty Shootout, Arena Trivia, Football mode, Cups mode, and existing match data behavior.
- Do not scrape/import entire portals, copy game binaries, or assume a playable game may be embedded.
- Do not ship placeholder URLs as playable entries.
- Only show individually reviewed entries with publisher permission, confirmed embedding or linking rights, mobile behavior, attribution, and advertising terms.
- HTTPS only; reject malformed URLs, unexpected ports, and unapproved embed origins.
- No arbitrary user-provided iframe URLs, URL query overrides, credential exposure, or bypassing frame restrictions.
- Iframes must be lazy-loaded after an explicit play action and use least-privilege sandbox/allow attributes.
- External play must be clearly labelled and opened through a user action with safe opener/referrer handling.
- No payments, wagering, betting, or paid unlocks.
- No Supabase schema or admin dashboard in the first release.
- Do not merge or deploy without explicit approval.

---

### Task 1: Typed catalogue and URL policy

**Files:**
- Create: `src/features/arena/connected-games.ts`
- Test: `src/features/arena/connected-games.test.ts`

**Interfaces:**
- Produces `ConnectedGame`, `ConnectedGameCategory`, `ConnectedGameMode`, `connectedGames`, and `isApprovedEmbedUrl(game, candidate)`.
- Consumes no network or application state; catalogue entries are immutable local data.

- [ ] **Step 1: Add focused failing tests**

Test that HTTPS URLs with the exact approved origin and default/443 port are accepted; HTTP, malformed URLs, credentials, unexpected ports, and mismatched origins are rejected. Test that external-mode games are not treated as embeddable. Test that the initial manifest contains no placeholder playable URLs and only approved entries are exposed.

- [ ] **Step 2: Verify the relevant failure**

Run: `bun run test -- src/features/arena/connected-games.test.ts`  
Expected: the test runner reports missing module/exports before implementation; correct any test setup/import issue so the failure specifically demonstrates the absent policy module.

- [ ] **Step 3: Implement the minimum behavior**

Create the catalogue types and an initially empty immutable approved-game manifest. Implement URL parsing and exact-origin validation. Reject credentials, non-HTTPS protocols, non-default ports, and origins that do not match the catalogue entry's configured embed origin. Do not derive an embed origin from an untrusted candidate URL.

- [ ] **Step 4: Verify the focused pass**

Run: `bun run test -- src/features/arena/connected-games.test.ts`  
Expected: all URL policy and manifest tests pass.

- [ ] **Step 5: Run the affected integration check**

Run: `bun run lint`  
Expected: no lint errors in the new module and test.

- [ ] **Step 6: Commit the passing deliverable**

```bash
git add src/features/arena/connected-games.ts src/features/arena/connected-games.test.ts
git commit -m "feat: add curated connected games registry"
```

### Task 2: Connected Games catalogue and player UI

**Files:**
- Create: `src/features/arena/ConnectedGames.tsx`
- Modify: `src/routes/match-center.tsx`
- Test: `src/features/arena/ConnectedGames.test.tsx`

**Interfaces:**
- Component: `ConnectedGames()` renders the third-party catalogue and selected-game player.
- Consumes: `connectedGames`, `ConnectedGame`, and `isApprovedEmbedUrl` from `src/features/arena/connected-games.ts`.
- Produces: category/search filtering, explicit Play in Nexora or Play on website actions, isolated player, back-to-catalogue behavior, loading and error/fallback states.

- [ ] **Step 1: Add focused failing tests**

Test that the Connected Games heading and curated empty state appear when the manifest is empty; category and title search filters are applied together; choosing an approved embed entry loads its iframe only after user action and uses a descriptive title, restrictive referrer policy, and least-privilege sandbox; external entries use a safe new-context link; Back to games restores category/search state; unapproved URLs never create an iframe.

- [ ] **Step 2: Verify the relevant failure**

Run: `bun run test -- src/features/arena/ConnectedGames.test.tsx`  
Expected: the test fails because the component does not yet exist, not due to test setup or imports.

- [ ] **Step 3: Implement the minimum behavior**

Build responsive catalogue cards, combined category/search filters, empty/no-match states, a selected-game player view, lazy iframe creation after explicit click, validated HTTPS exact-origin embed URLs, a restrictive sandbox and referrer policy, an explicit external-link path with `target="_blank"` and `rel="noopener noreferrer"`, and a back action preserving catalogue filters. Render Connected Games as a separate section below the three existing Nexora Originals within the gaming branch of `src/routes/match-center.tsx`.

- [ ] **Step 4: Verify the focused pass**

Run: `bun run test -- src/features/arena/ConnectedGames.test.tsx`  
Expected: all catalogue and player behavior tests pass.

- [ ] **Step 5: Run the affected integration check**

Run: `bun run test -- src/features/arena src/routes/match-center`  
Expected: all focused Arena tests pass and existing mini-game behavior remains unchanged.

- [ ] **Step 6: Commit the passing deliverable**

```bash
git add src/features/arena/ConnectedGames.tsx src/features/arena/ConnectedGames.test.tsx src/routes/match-center.tsx
git commit -m "feat: add connected games to Nexora Arena"
```

### Task 3: Regression and review handoff

**Files:**
- Modify only if required by verification: files from Tasks 1–2.

**Interfaces:**
- Consumes the completed catalogue and player UI.
- Produces a reviewable implementation branch and pull request; no production deployment.

- [ ] **Step 1: Run full tests**

Run: `bun run test`  
Expected: all Vitest tests pass.

- [ ] **Step 2: Run lint and production build**

Run: `bun run lint`  
Expected: ESLint exits 0 with no errors.

Run: `bun run build`  
Expected: Vite/Nitro production build exits 0.

- [ ] **Step 3: Inspect the final diff**

Confirm only intended Arena catalogue, player, tests, and route integration files changed; verify existing Originals and Football/Cups branches are intact.

- [ ] **Step 4: Open a pull request**

Open a PR from the feature branch to `main`, summarize security boundaries and the empty initial approved-game manifest, and wait for CI/review. Do not merge or deploy until separately authorized.

## Unresolved implementation seam

The first release intentionally ships no third-party playable entries until individual games are reviewed and approved. Selecting specific initial games and confirming their provider-specific permission, embed origins, attribution, and ad requirements is a separate curation decision.
