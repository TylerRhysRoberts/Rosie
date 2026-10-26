import { AuthorizationError, CimdFetchError, type ConsentDescription } from "@cloudflare/workers-oauth-provider";
import { signInWithPassword } from "./supabase";

// The /authorize page: the one place a person signs in. Claude opens it in a
// browser tab when the connector is added (and again if the grant ever lapses).
//
// Flow:
//   GET  /authorize  -> validate Claude's OAuth request, show "Sign in to connect Rosie"
//   POST /authorize  -> check email is allowed, sign in to Supabase with it,
//                       then hand Claude an authorisation code. The Supabase
//                       refresh token is stored (encrypted) on the grant so later
//                       tool calls can act as this user.

export interface GrantProps {
  userId: string;
  email: string;
  /** Long-lived Supabase refresh token. Only lives on the grant, never in an access token. */
  sbRefreshToken?: string;
  /** Short-lived Supabase access token for the current MCP access token. */
  sbAccessToken?: string;
}

const escape = (value: string) => value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function allowedEmails(env: Env): string[] {
  return (env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

function page(details: ConsentDescription, handle: string, query: string, error?: string): string {
  const name = escape(details.clientName);
  return `<!doctype html>
<html lang="en-GB">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Connect Rosie</title>
<style>
  :root { --bg: #f6efe6; --card: #fffaf4; --ink: #3b2a2a; --muted: #7a6660; --pink: #d9779b; --pink-dark: #b85a7e; --line: #ead9cc; --error: #b3261e; }
  @media (prefers-color-scheme: dark) { :root { --bg: #201a19; --card: #2b2322; --ink: #f3e7e1; --muted: #bba8a1; --line: #43403f; --error: #ffb4ab; } }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 16px; background: var(--bg); color: var(--ink); font: 16px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { width: 100%; max-width: 380px; background: var(--card); border: 1px solid var(--line); border-radius: 20px; padding: 28px 24px; }
  h1 { font-size: 1.35rem; margin: 0 0 4px; }
  p { margin: 0 0 16px; color: var(--muted); font-size: .92rem; }
  label { display: block; font-size: .85rem; font-weight: 600; margin: 12px 0 4px; }
  input { width: 100%; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--line); background: var(--bg); color: var(--ink); font: inherit; }
  .actions { display: flex; gap: 8px; margin-top: 20px; }
  button { flex: 1; padding: 11px; border-radius: 999px; border: 0; font: inherit; font-weight: 600; cursor: pointer; }
  .allow { background: var(--pink); color: #fff; } .allow:hover { background: var(--pink-dark); }
  .deny { background: transparent; color: var(--muted); border: 1px solid var(--line); }
  .error { color: var(--error); font-weight: 600; }
  .warn { color: var(--error); }
  .fine { font-size: .8rem; margin-top: 16px; margin-bottom: 0; }
</style>
<main>
  <h1>🐶 Connect Rosie</h1>
  <p><strong>${name}</strong> wants to read and add to Rosie's health log. Access will be sent to <strong>${escape(details.redirectHost)}</strong>.${details.clientDomain ? "" : " (This app registered itself, so its name isn't verified.)"}</p>
  ${details.redirectIsLoopback ? '<p class="warn">This sends access to an app on your own computer. Only continue if you started this yourself.</p>' : ""}
  ${error ? `<p class="error">${escape(error)}</p>` : ""}
  <form method="post">
    <input type="hidden" name="handle" value="${escape(handle)}">
    <input type="hidden" name="q" value="${escape(query)}">
    <label for="email">Rosie app email</label>
    <input id="email" name="email" type="email" autocomplete="username" required>
    <label for="password">Password</label>
    <input id="password" name="password" type="password" autocomplete="current-password" required>
    <div class="actions">
      <button class="deny" name="decision" value="deny" formnovalidate>Cancel</button>
      <button class="allow" name="decision" value="approve">Sign in and allow</button>
    </div>
  </form>
  <p class="fine">You can disconnect at any time from Claude's connector settings.</p>
</main>
</html>`;
}

async function renderSignIn(request: Request, env: Env, error?: string): Promise<Response> {
  const oauth = env.OAUTH_PROVIDER;
  const authRequest = await oauth.parseAuthRequest(request);
  const details = await oauth.describeConsent(authRequest);
  const consent = await oauth.beginConsent(authRequest);
  const url = new URL(request.url);
  url.searchParams.delete("error");
  consent.headers.set("Content-Type", "text/html; charset=utf-8");
  consent.headers.set(
    "Content-Security-Policy",
    "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'",
  );
  return new Response(page(details, consent.handle, url.searchParams.toString(), error), {
    status: error ? 400 : 200,
    headers: consent.headers,
  });
}

async function handleSubmit(request: Request, env: Env): Promise<Response> {
  const oauth = env.OAUTH_PROVIDER;
  const form = await request.formData();
  const handle = String(form.get("handle") ?? "");
  // Rebuild the original GET so a failed sign-in can show the page again with a fresh handle.
  const retry = () => {
    const url = new URL("/authorize", request.url);
    url.search = new URLSearchParams(String(form.get("q") ?? "")).toString();
    return new Request(url, { headers: request.headers });
  };

  if (form.get("decision") !== "approve") {
    const denied = await oauth.denyConsent(request, handle);
    return new Response(null, { status: 302, headers: denied.headers });
  }

  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const genericError = "That email and password didn't work, or this account isn't allowed to connect.";

  // Fail closed: if ALLOWED_EMAILS is not configured, nobody can connect.
  if (!allowedEmails(env).includes(email)) return renderSignIn(retry(), env, genericError);

  let session;
  try {
    session = await signInWithPassword(env, email, password);
  } catch (err) {
    console.warn("Supabase sign-in failed", (err as Error).message);
    return renderSignIn(retry(), env, genericError);
  }

  const approved = await oauth.approveConsent(request, handle);
  const props: GrantProps = { userId: session.user.id, email, sbRefreshToken: session.refresh_token };
  const { redirectTo } = await oauth.completeAuthorization({
    request: approved.request,
    userId: session.user.id,
    metadata: { email },
    scope: approved.request.scope,
    props,
  });
  approved.headers.set("Location", redirectTo);
  return new Response(null, { status: 302, headers: approved.headers });
}

/** Everything outside /mcp that the OAuth provider doesn't handle itself. */
export const authHandler = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/") {
      return new Response("Rosie MCP server. Add <origin>/mcp to Claude as a custom connector.\n", {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
    if (url.pathname !== "/authorize") return new Response("Not found", { status: 404 });

    try {
      if (request.method === "GET") return await renderSignIn(request, env);
      if (request.method === "POST") return await handleSubmit(request, env);
      return new Response("Method not allowed", { status: 405 });
    } catch (error) {
      if (error instanceof AuthorizationError && error.redirectTo) {
        return Response.redirect(error.redirectTo, 302);
      }
      if (error instanceof AuthorizationError || error instanceof CimdFetchError) {
        const message =
          error instanceof AuthorizationError
            ? `${error.description ?? "This sign-in link is no longer valid."} Go back to Claude and try connecting again.`
            : "This app could not be verified.";
        return new Response(message, { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8" } });
      }
      throw error;
    }
  },
};
