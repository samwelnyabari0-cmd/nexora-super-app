# NEXORA Creator Monetization Design

**Date:** 2026-11-16  
**Status:** Approved design; implementation planning in progress.

## Goals

Introduce creator monetization with eligibility checks, application-based approval, creator subscriptions, one-time tips, subscriber benefits, and administrative oversight. Preserve existing profile, wallet, and Paystack functionality.

## Eligibility

A creator may apply for subscription monetization after meeting all of these requirements:

- Creator account type.
- At least 1,000 genuine followers.
- Account age of at least 30 days.
- At least 10 original public posts.
- At least 3 posts published in the previous 30 days.
- Creator is at least 18 years old.
- Verified email address and phone number.
- Completed identity and payout verification.
- No active serious Community Guidelines violations.

Follower count is checked at application time. Once approved, an ordinary drop below 1,000 followers does not revoke monetization. Fraud, serious policy violations, or failed ongoing verification may lead to suspension.

## Application and approval

1. The application UI displays each eligibility requirement and the creator's current progress.
2. When eligible, the creator can submit an application.
3. The creator completes required identity and payout verification.
4. An administrator reviews the application and approves or rejects it.
5. Only approved creators can activate subscriptions.
6. Administrators can suspend monetization for documented policy, fraud, or verification reasons.

One-time tips use the basic account, identity, and payout requirements; the 1,000-follower subscription threshold does not apply to tips.

## Creator subscription configuration

- Each creator starts with one subscription tier.
- The creator chooses a tier name and monthly price in US dollars (USD), with a minimum of $2 per month and no fixed maximum initially.
- Creators can edit their tier details in Creator Settings.
- Public profiles show the creator tier badge and a subscription price/CTA directly below the bio.
- Price changes must be disclosed to affected subscribers before a new price is charged; the implementation must respect provider capabilities and applicable requirements.
- Multiple tiers are out of scope for the first release.

## Currency and creator earnings

- Creator subscription prices and charges are denominated in USD, with a minimum of $2 per month.
- Creator wallet balances and payouts are in KES for the first release.
- The verified USD payment is converted to KES using the actual, recorded exchange rate at payment time, after applicable fees.
- Each conversion stores the original USD amount, KES credited amount, FX rate, FX source/reference, and conversion timestamp. Never use a hardcoded or guessed exchange rate.

## Subscriber experience and benefits

- Subscribers receive a subscriber badge while their subscription is active.
- Creators can mark eligible posts/videos as subscribers-only.
- Access is granted only after server-side payment verification confirms an active subscription.
- Subscribers can cancel. Cancellation and end-of-period access must be reflected accurately.
- Failed renewals must not silently grant indefinite access; use a clearly communicated, bounded grace period if supported by the payment design.

## Tips and payment processing

- A separate Support Creator action accepts one-time tips.
- Tips are not subscriptions and do not create subscriber status.
- Use Paystack for USD checkout where the merchant account is enabled for international USD card payments. The minimum creator subscription price is $2 USD per month.
- Existing creator payment code currently initializes and verifies one-time transactions. Do not represent a one-time transaction as recurring billing.
- Implement genuine recurring billing only after confirming the available Paystack subscription/authorization/plan capabilities and required webhook behavior for the configured merchant account.
- Verify payment server-side before crediting creator wallets, activating subscriptions, or granting exclusive-content access.
- Make webhook and verification processing idempotent to prevent duplicate credits or entitlements.
- Never expose secret payment keys or sensitive payment details to clients.

## Profile and settings surfaces

- Creator Settings: eligibility progress, application status, subscription tier name and monthly price, and payout/verification status.
- Public creator profile: creator badge and subscription CTA directly below bio; separate Support Creator CTA.
- Subscriber-facing UI: active subscriber badge and access state.
- Admin surface: application review, approval/rejection, suspension, and audit trail.

## Data and authorization principles

- Treat server/database state as authoritative for eligibility, application status, creator approval, subscription status, payment verification, and entitlements.
- Do not trust client-supplied follower counts, payment success flags, tier prices, creator IDs, or subscriber status.
- Enforce row-level access and server-side authorization so users cannot approve themselves, alter another creator's tier, or grant themselves subscriber benefits.
- Preserve compatibility with existing wallet and creator-payment records; inspect the current schema and RPCs before proposing migrations.
- Store payment references and subscription lifecycle events needed for reconciliation and support, without storing raw card credentials.
- Creator subscription prices and subscriber charges are denominated in USD. Creator wallet balances and payouts remain in KES for the first release.
- After server-side payment verification, record the actual USD-to-KES exchange rate and conversion timestamp used, then credit the creator's KES wallet after applicable fees. Preserve the original USD amount and conversion details for reconciliation.
- Do not hardcode or invent an exchange rate. The payment/conversion implementation must use a rate supplied by the payment/settlement provider or a configured, auditable FX source; if no trustworthy rate is available, hold the funds as pending rather than crediting a guessed KES amount.

## Failure handling

- Handle checkout cancellation, failed verification, duplicate callbacks/webhooks, delayed webhooks, renewal failure, cancellation, and provider outages.
- Show clear pending/failed/active states.
- Do not grant benefits while payment status is unknown.
- Keep an auditable record of administrative decisions and payment lifecycle transitions.

## Scope boundaries

First release includes one tier per creator, application-based approval, subscriber badges, subscribers-only content access, one-time tips, recurring billing where provider support is confirmed, and basic admin review.

Out of scope for the first release: multiple creator tiers, complex perk bundles, gifting subscriptions, creator analytics dashboards, and non-Paystack payment providers.

## Acceptance criteria

- Ineligible creators cannot submit a valid monetization application.
- Eligible creators can apply and see application status.
- Only authorized administrators can approve, reject, or suspend applications.
- Approved creators can configure one valid monthly tier.
- Public profiles show the correct creator tier and price below the bio.
- Tips remain separate from subscriptions.
- Subscriber status and exclusive-content access are granted only after verified successful payment and remain synchronized with renewal/cancellation state.
- Duplicate payment notifications cannot double-credit wallets or duplicate entitlements.
- Falling below 1,000 followers after approval does not by itself revoke monetization.
- Existing profile, wallet, and payment flows continue to work.
