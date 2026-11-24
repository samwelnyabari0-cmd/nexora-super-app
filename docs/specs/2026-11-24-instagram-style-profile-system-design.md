# NEXORA Instagram-Style Profile System — Design Specification

**Date:** 2026-11-24  
**Status:** Approved by product owner; awaiting written-spec review  
**Scope:** Profile identity, profile navigation, and the shared own/public profile experience.

## 1. Problem and goals

NEXORA sometimes opens the signed-in user's profile when a visitor selects another account. The current profile entry points commonly depend on handles, while feed data already carries stable Supabase user IDs. The profile tab must continue to open the signed-in user's own profile, but every other profile entry point must resolve the exact account selected.

Goals:
- Use the Supabase auth user UUID as the canonical identity for profile navigation and profile data retrieval.
- Make own-profile and other-user profile navigation unambiguous.
- Provide a consistent Instagram-inspired layout for both own and public profiles while retaining NEXORA branding and features.
- Preserve backward compatibility for existing handle-based links.
- Enforce profile and content privacy on the server as well as in the UI.

Non-goals:
- Rebuilding unrelated feed, messaging, monetization, or creator-studio systems.
- Copying Instagram branding or proprietary assets.
- Changing account handles or migrating user identities.

## 2. Approaches considered

1. **Continue handle-only routing.** Smallest change, but handles remain the lookup key and the source of ambiguity. Not recommended.
2. **Use UUIDs as canonical identity and retain handle compatibility.** Creator links use stable IDs; legacy handle routes resolve to the same profile and may redirect to the canonical route. This aligns with existing post and profile data and is recommended.
3. **Replace the entire routing and account model.** Broad and high-risk, with unnecessary changes to unrelated systems. Not recommended.

## 3. Route and identity architecture

- Keep `/profile` as the authenticated user's own-profile entry point.
- Add a canonical ID-based public profile route (proposed shape: `/profile/id/$userId`).
- Resolve the route's UUID through a dedicated Supabase RPC, proposed as `get_public_profile_by_id(p_user_id uuid)`.
- Keep `/profile/$handle` as a compatibility route. It must resolve the handle to the matching account and then use the same public-profile rendering/data path. It must not fall back to the current user if the handle is missing, invalid, or unresolved.
- Treat UUIDs as identity only; handles remain display names and searchable identifiers.
- Validate route IDs before making requests. A missing or malformed ID produces an unavailable-profile state, not an own-profile redirect.

## 4. Backend privacy contract

The new profile-by-ID RPC must:
- Return only fields approved for public profile viewing.
- Return owner-only fields only when the authenticated caller is the profile owner, if such fields are needed by the existing UI.
- Respect existing discoverability and private-profile rules. A private/non-discoverable profile must not become publicly readable merely because its UUID is known.
- Apply the existing access rules for private posts and other restricted content independently of profile lookup.
- Avoid exposing private settings, private content, or other owner-only data to visitors.
- Be tested with anonymous, authenticated non-owner, and owner callers as applicable to the current app's auth model.

The implementation must inspect the current RPC definitions and RLS policies before changing them. It must not weaken existing policies to make the UI work.

## 5. Navigation contract

All links that represent another account must pass that account's actual UUID. Audit at least:
- Home/feed post authors and avatars
- Explore/search creator cards
- Reels and video creator links
- Comments and other user-generated-content author links
- Followers and following lists
- Any notification or messaging entry point that navigates to a profile

The signed-in user's Profile tab remains `/profile`. Owner-only links/actions must not be used for another user's profile. If a creator UUID is unavailable, do not link to `/profile` and do not substitute the signed-in user's ID; show a non-clickable identity or an explicit unavailable state.

## 6. Shared profile experience

Both own and public profiles use a consistent NEXORA-branded structure:
- Avatar/profile image, display name, handle, and bio
- Posts, followers, and following counts
- Content navigation for Posts, Reels, and Videos
- Responsive layout with no overlapping controls and usable scrolling

Owner view:
- Existing Edit Profile and account-owner controls remain available.
- Owner-only controls and settings are never rendered for another account.

Visitor view:
- Follow/Following and Message actions appear only when allowed by the account's privacy and relationship state.
- No edit or owner-management controls.
- Private/restricted content remains hidden according to existing policy.

Existing supported features should be preserved where practical; this work should not introduce unrelated redesigns.

## 7. Data flow and component boundaries

1. A user taps an account identity.
2. The originating component supplies the account UUID to the canonical profile route.
3. The route validates the UUID and requests the profile through the secure ID-based RPC.
4. The profile page determines owner status by comparing the authenticated user UUID with the returned profile UUID.
5. Profile content and relationship actions load through their existing access-controlled queries/hooks.
6. Legacy handle routes resolve the handle, then share the same profile data/rendering path.

Keep route parsing, profile retrieval, and shared profile presentation separated enough that each can be tested independently. Reuse existing components and hooks where they meet the contract.

## 8. Error handling

- Missing or malformed UUID: render an unavailable/invalid profile state.
- Unknown or inaccessible profile: render a not-found/unavailable state without leaking whether restricted data exists.
- Network/RPC failure: show a retryable error state; never silently render the current user's profile.
- Missing creator UUID in a card: disable profile navigation for that identity.
- Missing handle on an otherwise valid UUID: ID-based navigation still works.

## 9. Verification plan

Before release:
- Audit every profile-link construction site and update applicable entry points to use UUIDs.
- Verify the Profile tab opens the authenticated user's profile.
- Verify selecting a different user from feed, Explore, reels, videos, comments, search, followers, and following opens that exact account.
- Verify no missing/invalid identifier can open the signed-in user's profile by fallback.
- Verify owner and visitor controls differ correctly.
- Verify private/non-discoverable profiles, private posts, and owner-only fields remain protected.
- Verify legacy handle links resolve to the correct account.
- Run available automated tests, type checks, and production build; report any unavailable checks explicitly.
- Inspect the resulting Vercel deployment and confirm READY before claiming deployment success.

## 10. Rollout and compatibility

Ship the canonical ID route and secure lookup alongside the legacy handle route. Update in-app links to the ID route. Retain handle compatibility until existing shared links and entry points are confirmed to work. Do not remove or rename account handles as part of this change.

## 11. Acceptance criteria

- The Profile tab always opens the signed-in user's own profile.
- Every supported other-user profile entry point opens the exact selected account.
- No invalid or missing other-user identity falls back to the signed-in user's profile.
- Both own and visitor profiles share the approved NEXORA-branded layout with correct owner/visitor actions.
- Existing privacy restrictions are preserved and enforced server-side.
- Legacy handle-based profile URLs continue to resolve safely.
- Verification results and deployment status are reported accurately.
