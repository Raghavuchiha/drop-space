# DropSpace — Pair a second device

This feature adds **Sign in with a device code** to the public login screen and **Link device** to the signed-in workspace.

1. Open DropSpace on a device where you're signed in.
2. Press **Link device** and read the 10-character, 2-minute code.
3. On another device, press **Sign in with a device code** and enter the code.
4. Confirm the request on your first device. Only approve a request you initiated.
5. Device B redeems a unique one-time Supabase Auth magic-link token and obtains **its own session**.

## Deployment

The database schema is in `supabase/device_pairing.sql`. It has already been applied to the connected `drop-space` Supabase project. The `device-pair` Edge Function has also been deployed there. For a new Supabase project, apply that SQL and deploy `supabase/functions/device-pair/index.ts` with JWT verification disabled (the function itself verifies authentication for privileged actions).

Required Supabase Edge Function secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_ANON_KEY` (or `SUPABASE_PUBLISHABLE_KEY`). Never put the service role key in Vite environment variables or frontend code. The function restricts browser origins to the production domain and local development.

## Security model

- A temporary code is **not** by itself a login credential. The existing logged-in device must explicitly approve the request.
- Codes are random 10-character values, stored only as SHA-256 hashes, and expire after 2 minutes. Only one pending pairing per account is kept.
- The requesting browser generates a separate unpredictable `claimSecret`; only its hash is stored, and the token may be claimed once.
- Supabase Admin generates a fresh, one-time magic-link token; no existing session's refresh token is shared.
- An IP-based maximum of five attempts per two-minute window is enforced as defense in depth; for public scale add an edge/WAF rate limiter and monitor usage. The simple database counter is not a perfect concurrent/race-resistant limiter.
- Device pairing tables are RLS-enabled, and client roles have no grants or policies.
- **Known limitation:** this MVP does not implement a Manage Devices dashboard or independent revocation from inside DropSpace. Supabase Auth session management and provider policies remain authoritative.
- **Known limitation:** if the Auth magic-link generation fails after a claim is consumed, the user must pair again.
- Google OAuth is not added by this feature; existing email/password sign-in remains unchanged. Pairing should work with any Supabase-authenticated account with an email.

## Verification

After deployment, test with two separate browsers/devices:
- Incorrect code and expired code rejected.
- Device B cannot authenticate before owner approval.
- Deny prevents login.
- A successful approval signs in Device B without signing out A.
- A consumed claim cannot be reused.
- RLS still isolates files and items between distinct Supabase users.

Do not advertise this flow as fully production-audited until these tests pass. 
