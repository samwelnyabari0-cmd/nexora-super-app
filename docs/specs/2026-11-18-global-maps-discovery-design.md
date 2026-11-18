# Nexora Maps — Global Discovery Design

**Date:** 2026-11-18  
**Status:** Approved for implementation planning  
**Scope:** Maps search and discovery experience

## 1. Goals

Remove the current Nairobi-only bias from Maps while retaining Kenya as the initial map view. Users should be able to discover places globally, search within a specified location, and understand where each result is located.

## 2. Product behaviour

### Initial map view
- Open the map centred on Kenya.
- Do not automatically run a Nairobi places search.
- Display the map without implying that Nairobi is the only supported search area.

### Global discovery
- A category-only query such as `restaurants`, `hotels`, or `hospitals` should search across multiple geographic regions and countries.
- Global discovery should draw from multiple geographic search areas, not one Nairobi-centred nearby search.
- Results should be geographically diverse where the provider's data permits.
- Each result should show its name, category, country, address (when available), and coordinates.

### Location-specific discovery
- Queries that include a place, such as `restaurants in Mombasa`, `hotels in Dubai`, or `cafes in London`, should be scoped to that requested location.
- The map should centre on the requested area or selected result.
- Do not silently replace an unrecognised or unavailable requested location with Nairobi.

### Location permission
- Current-location discovery is optional and must only use device location after the user grants permission.
- Denied or unavailable location access must not prevent manual global or location-specific search.

## 3. Search and result requirements

- Distinguish category-only searches from searches that specify a geographic location.
- For global category searches, query multiple regions and combine results.
- Deduplicate results using stable provider identifiers where available, with a sensible fallback based on name and coordinates.
- Avoid allowing one region to dominate the visible result set when diverse results are available.
- Preserve provider attribution and any applicable usage or display requirements.
- Handle provider limits, partial responses, empty results, and network errors with clear user-facing states.
- Never fabricate place names, addresses, ratings, or coordinates.

## 4. Map presentation

- Initial viewport: Kenya.
- Location-specific search: requested area.
- Selected result: selected place.
- Global search: use a useful world-scale or multi-region presentation; do not imply that a single local viewport contains every global result.
- Markers must use the coordinates returned by the place provider.
- Keep list results and map markers in sync.

## 5. Technical direction

- Retain the existing Geoapify and OpenStreetMap-based approach where compatible with current provider terms and architecture.
- Review and update the existing Maps search implementation, including `maps.functions.ts` and `maps.tsx` where those are the active source files.
- Remove hardcoded Nairobi search fallbacks. Kenya remains the initial map viewport, not the implicit search scope.
- Confirm the actual provider API capabilities, query limits, rate limits, attribution requirements, and API-key configuration before choosing the global multi-region query strategy.
- Do not expose provider secrets in client-side code.
- Keep the change focused on Maps discovery; do not alter unrelated feed, profile, messaging, or payment functionality.

## 6. Acceptance criteria

1. Opening Maps centres the map on Kenya without automatically returning only Nairobi places.
2. A category-only query such as `restaurants` can return results from multiple countries and continents when provider data is available.
3. A location-specific query such as `restaurants in Mombasa` returns results scoped to Mombasa.
4. A query for another country or city does not fall back to Nairobi.
5. Selecting a result focuses the map on that result and displays the matching marker.
6. Results are deduplicated and their location metadata is accurate.
7. Location permission is optional; manual searches work without it.
8. Empty, partial, rate-limited, and failed searches show clear states rather than misleading Nairobi results.
9. Existing Maps functionality outside the changed discovery flow continues to work.

## 7. Out of scope

- Turn-by-turn navigation or route optimisation.
- Guaranteed exhaustive coverage of every place worldwide.
- Changes to unrelated Nexora features.
- Any claim that global results are exhaustive; coverage depends on provider data, limits, and availability.

## 8. Implementation planning notes

Before coding, inspect the current Maps components, server functions, provider configuration, and existing tests. Confirm the actual search provider and current fallback logic rather than assuming filenames or APIs. Then prepare a small implementation plan covering global multi-region search, location parsing, result merging/deduplication, map viewport behaviour, error handling, and tests.
