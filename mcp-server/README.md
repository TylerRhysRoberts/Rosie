# Rosie MCP server

A remote [MCP](https://modelcontextprotocol.io) server that lets Claude read and write Rosie's health log. Add it to Claude as a custom connector, then say things like:

> Rosie has been good today though she did eat grass. She's had two 20 minute walks and eaten 90% of her dins.

Claude turns that into a `log_day` call (`health_score: 3`, `add_symptoms: ["Eating Grass"]`, two 20-minute walks, `dins_percent: 90`) and reads back what was saved.

It is a separate Cloudflare Worker from the app. It shares the app's Supabase database and nothing else.

## How it fits together

```
Claude ──(OAuth 2.1 + MCP over HTTPS)──► rosie-mcp Worker ──(as you, under RLS)──► Supabase (same DB as the app)
                                          │
                                          └─ OAUTH_KV: registered clients, grants, hashed tokens
```

- **`/mcp`**: the MCP endpoint. It only answers requests that carry a valid access token.
- **`/authorize`**: a small sign-in page. Claude opens it when you add the connector, and you sign in with your Rosie app email and password.
- **`/oauth/token`, `/oauth/register`, `/.well-known/*`**: the OAuth plumbing, all handled by [`@cloudflare/workers-oauth-provider`](https://github.com/cloudflare/workers-oauth-provider).

### Why it is built this way

- **OAuth rather than a secret URL.** Claude custom connectors support either OAuth or no auth at all. With no auth, anyone who found the URL could read Rosie's medical history. OAuth is the only real protection available.
- **It acts as you, not as an admin.** When you sign in, the Worker gets a Supabase session for *your* user. Every query runs under the same row-level security (RLS) as the app. The Worker never holds the service-role key, so a bug here cannot touch anyone else's rows.
- **Sessions are refreshed together.** Supabase access tokens last an hour. When Claude refreshes its token, `tokenExchangeCallback` refreshes the Supabase session at the same moment, so both tokens expire together. If Supabase rejects the refresh (the session was signed out or revoked), Claude is told to sign in again.
- **An allowlist on top.** Only the emails in the `ALLOWED_EMAILS` secret can connect. If the secret is not set, nobody can. The demo guest account is blocked from writing by RLS anyway.
- **Stateless MCP.** `createMcpHandler` builds a fresh server for each request, so no Durable Objects are needed.

## Tools

| Tool | What it does |
| --- | --- |
| `log_day` | Merges details into one day's log. Fields you don't mention are left alone. |
| `get_day` | Reads one day. |
| `get_logs` | Reads a date range (7 days by default) with averages for score, walking and dins, plus a flare-up count. |
| `get_logging_options` | Lists the exact symptom, stool, medication, dosage and location values the app uses. |
| `log_weight` / `get_weight_history` | Records weigh-ins and lists them. |
| `get_medication_stock` / `add_medication_stock` | Shows Medrone and Probiotic stock, and tops it up when a new supply arrives. |

`log_day` copies the app's save rules from `src/routes/app.tsx`:

- Walk completion is worked out from the walk's duration.
- Flare-up symptoms mirror the day's symptoms.
- Holiday mode fills in the standard values.
- Medrone and Probiotic tablets are deducted from stock, and only the *extra* tablets compared with what was saved before. Updating a day twice doesn't double-count.

**Not copied:** lifetime achievements. These are worked out in the browser when the app saves, so a day logged only through Claude won't unlock one until the app next saves.

The option lists and save rules live in `src/rosie.ts`, which copies `src/lib/daily-logs.ts`. If you add a symptom or medication to the app, add it there as well.

## Deploying

You need the Cloudflare account that hosts the app. Run these from `mcp-server/`:

```sh
npm install
npx wrangler login

# 1. Storage for OAuth grants. Paste the printed id into wrangler.jsonc (kv_namespaces[0].id).
npx wrangler kv namespace create OAUTH_KV

# 2. Who may connect (your Rosie login email). Several can be separated by commas.
npx wrangler secret put ALLOWED_EMAILS

# 3. Ship it.
npm run deploy
```

The deploy prints a URL like `https://rosie-mcp.<your-subdomain>.workers.dev`. If you add a custom domain later, set `PUBLIC_URL` in `wrangler.jsonc` to that origin.

### Adding it to Claude

1. In Claude, go to **Settings → Connectors → Add custom connector**.
2. Name it *Rosie*, and set the URL to `https://rosie-mcp.<your-subdomain>.workers.dev/mcp`. Leave the OAuth client fields empty, because Claude registers itself.
3. Click **Connect**. The Rosie sign-in page opens. Sign in with your app email and password.
4. In a chat, enable the connector and tell Claude about Rosie's day.

To disconnect, remove the connector in Claude. The grant also lapses after 90 days without use.

### If you sign in to the app with Google

This sign-in page uses email and password. An account created through "Continue with Google" may not have a password yet. There are two fixes:

- Add a "set a password" option to the app's profile page (`supabase.auth.updateUser({ password })` while signed in).
- Use "Forgot password", if the app gains one.

After that, the same account works in both places.

## Local development

```sh
cp .dev.vars.example .dev.vars   # set ALLOWED_EMAILS
npm run dev                      # http://localhost:8787/mcp
npx @modelcontextprotocol/inspector   # point it at http://localhost:8787/mcp
```

`npm run dev` talks to the real Supabase project. To work against something else, override `SUPABASE_URL` in `.dev.vars`.

```sh
npm test          # unit tests for the merge and save rules in src/rosie.ts
npm run typecheck
```

After changing `wrangler.jsonc`, run `npm run cf-typegen` to regenerate `worker-configuration.d.ts`.

## Files

- `src/index.ts`: wires the OAuth provider, the MCP handler and the Supabase token refresh together.
- `src/auth.ts`: the `/authorize` sign-in and consent page.
- `src/tools.ts`: the MCP tools.
- `src/rosie.ts`: Rosie's data model, option lists and save rules (pure functions, unit tested).
- `src/supabase.ts`: Supabase sign-in, refresh and the per-user client.
