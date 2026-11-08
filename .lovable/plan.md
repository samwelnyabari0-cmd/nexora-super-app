# NEXORA wallet and infrastructure delivery

## What will change
- Make the Paystack test-wallet panel and confirmation results explicit; prevent test payments from appearing as spendable wallet balance.
- Create private permanent media storage with owner-only uploads and authorized-recipient reads.
- Add contact-gated direct messages with database access controls and real-time updates; preserve existing demo conversations.
- Link Firebase Cloud Messaging and inspect whether web-push registration values are available.
- Check Cloudflare Stream and TURN readiness; only enable billable streaming resources behind an explicit in-app confirmation and only if current access supports them.
- Run available checks, verify the live site, and publish only after checks pass.

## Technical details
- Add an additive migration for direct-message records, attachment paths, real-time publication, storage object policies, and unique Paystack reference tracking.
- Keep provider credentials server-side and do not invent configuration values. Clearly identify missing Firebase web/VAPID values or Cloudflare permissions as setup blockers.
- Do not change the wallet to live mode without verified live Paystack credentials and reconciliation support.
