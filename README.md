# Nexora patch

1. Copy everything in this folder over your repo: `cp -r nexora-patch/. /path/to/nexora-repo/`
2. In the repo root run: `python3 apply_patches.py` then `bun install`.
3. Add `<PushToggle />` (src/components/nexora/PushToggle.tsx) to your Settings page.
4. Commit and push to GitHub. Vercel redeploys.
5. Add the secrets below in Vercel (Settings -> Environment Variables), then redeploy.
6. After the new code is live, run the LAST block at the bottom of the SQL migration (locks the wallet table).

Already done for you: storage policies, `push_subscriptions` and `live_streams` tables, wallet functions (database), `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` on Vercel.

## Secrets to add yourself
- `SUPABASE_SERVICE_ROLE_KEY` (Paystack top-ups are recorded with it)
- `LOVABLE_API_KEY` and `UDC_PAYSTACK_2_API_KEY` (Paystack connector; copy from Lovable)
- `VITE_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (mailto address) — generate with `npx web-push generate-vapid-keys`
- `TURN_URLS`, `TURN_USERNAME`, `TURN_CREDENTIAL`
- `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_STREAM_API_TOKEN`

## Private KYC uploads with Cloudflare R2
KYC documents are uploaded directly from the browser to a **private R2 bucket** using five-minute, content-type-bound signed PUT URLs created by authenticated server functions. Supabase remains responsible for authentication, database records, and all other app data. R2 credentials are only used on the server and must never be exposed as `VITE_*` variables.

Add these environment variables to Vercel (Production, Preview, and Development as appropriate):
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`

Create an R2 API token scoped to the KYC bucket with object read/write permissions only. Keep the bucket private; do not attach a public custom domain. Configure the bucket's CORS policy to allow `PUT` from your deployed Nexora origins (including your Vercel preview origin if needed), allow the `Content-Type` request header, and expose `ETag` if you use it in the client. Then redeploy. Existing Supabase KYC objects are not migrated automatically; new KYC submissions use R2 object keys in the existing Supabase verification record.

The repository's lockfile should be refreshed with `npm install` (or `bun install`) after dependency changes before deploying.
