# Nexora Connected Games — Design

**Date:** 2026-11-25  
**Status:** Approved for specification review  
**Scope:** Design only; no application code, database changes, or deployment in this document.

## 1. Overview

Add a **Connected Games** area to Nexora Arena → Instant Play so users can discover selected third-party browser games. Preserve the existing Nexora Originals (Free Kick Challenge, Penalty Shootout, and Arena Trivia) as a separate section.

The catalogue is curated. Nexora must not scrape or bulk-import third-party portals, copy game files, or assume that a publicly playable game may be embedded. Each entry must be reviewed for publisher permission, embedding support, mobile usability, and any required attribution or advertising terms before publication.

## 2. Goals

- Let users discover selected third-party browser games from the Nexora Arena experience.
- Play games inside Nexora when the publisher explicitly supports embedding.
- Provide a clearly labelled external-play fallback when embedding is unavailable or disallowed.
- Make the catalogue usable on Android and small screens, with clear loading, error, back, and retry states.
- Keep third-party games distinct from Nexora Originals.
- Start with a small, manually curated catalogue and avoid unnecessary backend dependencies.

## 3. Non-goals for the first release

- Hosting, copying, modifying, or redistributing third-party game binaries.
- Automatically crawling game portals or importing their full catalogues.
- User-submitted game URLs or arbitrary iframe URLs.
- Payments, entry fees, wagering, betting, or paid unlocks.
- Shared leaderboards, verified score ingestion, achievements, or cross-provider accounts.
- A new Supabase schema or admin dashboard unless a later implementation decision demonstrates that one is necessary.

## 4. User experience and information architecture

Within the existing **Instant Play** mode:

1. Keep the existing Nexora Originals cards and challenge-to-squad experience intact.
2. Add a distinct **Connected Games** heading and short explanation.
3. Provide category filters: All, Football, Racing, Sports, Arcade, Puzzle, and Strategy. Categories with no approved games may be hidden or show an empty state.
4. Provide a lightweight search over approved game titles and descriptions.
5. Render each approved game as a responsive card with artwork, title, category, short description, and a play action.
6. Label the action clearly as **Play in Nexora** or **Play on website**. Do not imply in-app play when the provider does not permit it.
7. Include a useful empty state when no games match the search or selected category.

The player view should have a visible Back to games action, a game title, a loading state, a retry/error state, and a responsive player surface. On supported devices, allow full-screen playback only when the embedded content and browser support it. Returning from a game must restore the catalogue context, including the selected category and search query.

## 5. Architecture

### 5.1 Curated catalogue manifest

Start with a typed, local catalogue manifest in the application. Each entry should include:

- Stable Nexora game ID.
- Display title, description, category, and thumbnail/artwork URL.
- Provider name and canonical game page URL.
- Play mode: `embed` or `external`.
- Embed URL and exact approved embed origin when mode is `embed`.
- Permission/review status and any required attribution or provider notes.
- Optional mobile-support and orientation hints where confirmed.

Only reviewed and approved entries are eligible for display. Keep provider-specific details in the manifest rather than scattering URLs or origin checks through UI components. Do not store secrets or provider credentials in the client.

### 5.2 Catalogue UI

Build the Connected Games catalogue as a focused component under the existing Match Center route, following the current Panel, Button, responsive layout, and icon patterns. Keep filtering and search client-side for the initial curated catalogue. Do not alter football mode or the Cups mode.

### 5.3 Player boundary

Use a dedicated player component that accepts a validated catalogue entry, not an arbitrary URL supplied by a user or query string. For embed mode, render an iframe only after validating the URL protocol and exact origin against the entry's approved provider origin. Apply a least-privilege sandbox and allow list; grant only capabilities the specific provider requires. Set a descriptive iframe title and a restrictive referrer policy. Do not grant top navigation, popups, downloads, camera, microphone, or clipboard permissions by default. Full-screen permission may be granted only where needed and supported by provider terms.

For external mode, open the canonical provider URL through a user-initiated action in a new browsing context with safe opener/referrer handling. Clearly explain that the user is leaving Nexora. Never attempt to bypass a provider's frame-blocking headers or embed restrictions.

## 6. Initial provider strategy

Potential sources for evaluation include GameDistribution, itch.io HTML5 games, and CrazyGames. These are candidates, not pre-approved integrations. Before adding a specific game, verify the provider's current publisher/developer terms, the individual game's rights and embedding instructions, allowed domains, attribution, advertising requirements, and mobile behavior. A platform-level developer programme does not automatically grant rights to every game on that platform.

Do not ship sample or placeholder game URLs as playable catalogue entries. The first release can ship the catalogue and player framework with an empty/reviewed state until at least one specific game has passed review.

## 7. Safety, privacy, and performance

- Treat every third-party game as untrusted content isolated from Nexora's application origin.
- Use HTTPS only; reject non-HTTPS URLs, malformed URLs, unexpected ports, and unapproved origins.
- Keep embed origins in a strict allowlist. Do not use wildcard origins.
- Use iframe sandbox permissions minimally and document any provider-specific exception.
- Do not expose Nexora session tokens, Supabase credentials, or private application data to embedded games.
- Do not pass user identity or profile details to providers unless a separate, explicit product and privacy review approves it.
- Lazy-load game artwork and do not load the iframe until the user chooses to play.
- Avoid autoplay with sound; respect reduced-motion preferences and provide a clear exit path.
- Make provider-required ads and attribution transparent; do not hide or interfere with them.
- Provide a fallback message when a provider blocks embedding, the game fails to load, or the device/browser is incompatible. The fallback must respect the provider's terms.

## 8. Error and state handling

The UI should distinguish:
- Catalogue loading (if the source later becomes remote).
- No approved games available.
- No search/category matches.
- Game loading.
- Game load failure or blocked embedding.
- External site opening.
- Unsupported device/browser or orientation guidance where verified.

A failed embed must not silently redirect the user. Offer a clearly labelled external-play option only when that game is approved for external linking, otherwise offer Back to games.

## 9. Testing and acceptance criteria

### Catalogue
- Existing three Nexora Originals remain available and behave as before.
- Connected Games appears separately within Instant Play.
- Search and category filters work together and have a useful empty state.
- Only approved manifest entries are rendered.

### Security
- Reject non-HTTPS, malformed, and unapproved embed URLs.
- Confirm an entry cannot override the approved origin through query parameters or user input.
- Verify iframe sandbox and allow attributes are least-privilege.
- Verify embedded content cannot navigate the top-level Nexora page or access Nexora credentials.
- Verify external links use safe new-context handling.

### Responsive behavior
- Catalogue cards and player fit narrow Android screens without horizontal overflow.
- Back navigation restores catalogue filters and search.
- Loading and error states remain usable on small screens.
- Full-screen behavior is optional and degrades gracefully.

### Regression
- Football mode, Cups mode, match data, and the existing Instant Play games remain unaffected.
- Run the project's relevant lint, typecheck, unit tests, and production build before merging implementation.

## 10. Delivery sequence

1. Implement the typed curated catalogue and Connected Games catalogue UI.
2. Implement the isolated player with strict URL/origin validation and external fallback.
3. Add only individually reviewed game entries with confirmed rights and provider requirements.
4. Test security, responsive behavior, accessibility, and regression.
5. Open a pull request for review. Deploy only after explicit approval.

## 11. Open implementation detail

The initial catalogue should remain local and code-reviewed. If the catalogue later needs non-developer administration, evaluate a database-backed registry and an admin workflow as a separate scoped design, including authorization and audit requirements.
