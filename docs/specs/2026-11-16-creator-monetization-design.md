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
- The creator chooses a tier name and monthly price displayed in US dollars (USD), with a minimum of $2 per month and no fixed maximum initially.
- For the first release, subscribers are charged in Kenyan shillings (KES), not USD. The USD tier price is converted to a KES checkout amount using a trustworthy, auditable exchange-rate source when checkout is initialized.
- The exact USD price, FX rate, FX source/reference, rate timestamp, and resulting KES amount must be stored with the pending payment and used unchanged during payment verification.
- Creators can edit their tier details in Creator Settings.
- Public profiles show the creator tier badge and a subscription price/CTA directly below the bio. The displayed price remains in USD; checkout clearly shows the KES amount before payment.
- Price changes must be disclosed to affected subscribers before a new price is charged; the implementation must respect provider capabilities and applicable requirements.
- Multiple tiers are out of scope for the first release.

## Currency and creator earnings

- Creator subscription tier prices are displayed and configured in USD, with a minimum of $2 per month.
- Subscriber checkout charges are in KES for the first release.
- Creator wallet balances are in KES.
- The KES checkout amount is calculated from the USD tier price using a trustworthy, auditable FX rate at checkout initialization. The rate and calculated amount are persisted with the pending transaction; verification must compare against that exact stored amount and must not fetch a new rate.
- Store the original USD amount, charged KES amount, FX rate, FX source/reference, rate timestamp, and conversion details for reconciliation.
- Creator earnings are credited to the KES wallet only after verified payment and applicable fees.
- Never use a hardcoded or guessed exchange rate. If no trustworthy rate is available, do not initialize checkout or credit a guessed amount.
- Payout method and availability must be confirmed against the creator's completed payout verification and supported provider capabilities. Do not promise bank or M-Pesa payouts until the selected payout route is verified and implemented.

## Subscriber experience and benefits

- Subscribers receive a subscriber badge while their subscription is active.
- Creators can mark eligible posts/videos as subscribers-only.
- Access is granted only after server-side payment verification confirms an active subscription.
- Subscribers can cancel. Cancellation and end-of-period access must be reflected accurately.
- Failed renewals must not silently grant indefinite access; use a clearly communicated, bounded grace period if supported by the payment design.

## Tips and payment processing

- A separate Support Creator action accepts one-time tips in KES.
- Tips are not subscriptions and do not create subscriber status.
- Use Paystack for KES checkout, subject to confirmation that the configured merchant account supports the selected checkout and billing capabilities.
- Paystack documents recurring subscriptions as card-based in Kenya; direct debit support is documented for Nigeria. Automatic monthly renewal can therefore be offered only for eligible reusable card authorizations. M-Pesa and other non-recurring methods must use manual renewal.
- The existing creator payment code currently initializes and verifies one-time transactions. Do not represent a one-time transaction as recurring billing.
- Implement card recurring billing only after confirming the configured merchant account, reusable authorization, subscription plan setup, and webhook lifecycle. If a payment method cannot be renewed automatically, clearly label it as manual renewal.
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
- Existing Nexora Pro and Studio subscriptions and their KES payment flow must remain unchanged.
- Store the USD creator tier price and the KES checkout quote together, including the exact FX rate, source/reference, and timestamp used to calculate the amount.
- The pending checkout record is authoritative for payment verification: verify the provider's actual KES charge against the stored expected KES amount, then credit the KES wallet after applicable fees.
- Do not fetch a fresh FX rate during verification or silently change an amount after checkout begins.
- Do not hardcode or invent an exchange rate. If no trustworthy rate is available, hold the transaction pending or fail checkout rather than crediting a guessed KES amount.
- Payout routes must be verified before being offered to creators; do not assume a bank account or M-Pesa payout is available.

## Failure handling

- Handle checkout cancellation, failed verification, duplicate callbacks/webhooks, delayed webhooks, renewal failure, cancellation, and provider outages.
- Show clear pending/failed/active states.
- Do not grant benefits while payment status is unknown.
- Keep an auditable record of administrative decisions and payment lifecycle transitions.

## Scope boundaries

First release includes one tier per creator, application-based approval, subscriber badges, subscribers-only content access, one-time tips, KES checkout, and basic admin review. Automatic renewal is limited to eligible reusable card authorizations; M-Pesa and other non-recurring methods use clearly disclosed manual renewal.

Out of scope for the first release: multiple creator tiers, complex perk bundles, gifting subscriptions, creator analytics dashboards, and non-Paystack payment providers.

## Acceptance criteria

- Ineligible creators cannot submit a valid monetization application.
- Eligible creators can apply and see application status.
- Only authorized administrators can approve, reject, or suspend applications.
- Approved creators can configure one valid monthly tier.
- Public profiles show the correct creator tier and USD price below the bio.
- Checkout clearly displays the KES amount before payment.
- The stored FX quote and expected KES amount are used for verification; the rate is not recalculated after checkout starts.
- Tips remain separate from subscriptions and are charged in KES.
- Subscriber status and exclusive-content access are granted only after verified successful payment and remain synchronized with renewal/cancellation state.
- Automatic renewal is available only for eligible reusable card authorizations; M-Pesa and other non-recurring methods are clearly disclosed as manual renewal.
- Duplicate payment notifications cannot double-credit wallets or duplicate entitlements.
- Falling below 1,000 followers after approval does not by itself revoke monetization.
- Existing Nexora Pro, Studio, profile, wallet, and payment flows continue to work.
