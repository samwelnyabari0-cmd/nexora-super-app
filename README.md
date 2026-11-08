# Nexora patch

1. Copy everything in this folder over your repo:  cp -r nexora-patch/. /path/to/nexora-repo/
2. In the repo root run:  python3 apply_patches.py   then   bun install
3. Add <PushToggle /> (src/components/nexora/PushToggle.tsx) to your Settings page.
4. Commit and push to GitHub. Vercel redeploys.
5. Add the secrets below in Vercel (Settings -> Environment Variables), then redeploy.
6. After the new code is live, run the LAST block at the bottom of the SQL migration (locks the wallet table).

Already done for you: storage policies, push_subscriptions and live_streams tables, wallet_balance()/send_money() functions (database); SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY on Vercel.

## Secrets to add yourself
- SUPABASE_SERVICE_ROLE_KEY  (Paystack top-ups are recorded with it)
- LOVABLE_API_KEY and UDC_PAYSTACK_2_API_KEY  (Paystack connector; copy from Lovable)
- VITE_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:you@example.com)  -- generate with: npx web-push generate-vapid-keys
- TURN_URLS, TURN_USERNAME, TURN_CREDENTIAL
- CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_STREAM_API_TOKEN
