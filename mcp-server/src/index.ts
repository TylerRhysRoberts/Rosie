import { OAuthError, OAuthProvider } from "@cloudflare/workers-oauth-provider";
import { createMcpHandler } from "agents/mcp/server";
import { authHandler, type GrantProps } from "./auth";
import { SupabaseAuthError, refreshSession } from "./supabase";
import { createServer } from "./tools";

// One Worker plays two roles:
//   - OAuth authorisation server: Claude registers itself, sends Tyler to /authorize,
//     then swaps codes and refresh tokens at /oauth/token. workers-oauth-provider does
//     the protocol work and stores grants in the OAUTH_KV namespace.
//   - MCP server at /mcp: only reachable with a valid access token. Each request gets a
//     fresh McpServer (stateless), and tools act as the Supabase user stored on the grant.

const mcpHandler = createMcpHandler(createServer);

let provider: OAuthProvider<Env> | undefined;

function getProvider(env: Env, origin: string) {
  provider ??= new OAuthProvider<Env>({
    apiRoute: "/mcp",
    apiHandler: { fetch: (request: Request, env: Env, ctx: ExecutionContext) => mcpHandler(request, env, ctx) },
    defaultHandler: authHandler,
    authorizeEndpoint: "/authorize",
    tokenEndpoint: "/oauth/token",
    clientRegistrationEndpoint: "/oauth/register",
    clientIdMetadataDocumentEnabled: true,
    // The MCP endpoint's public URL. Defaults to whatever URL the Worker is first reached on.
    resourceMetadata: { resource: `${(env.PUBLIC_URL || origin).replace(/\/$/, "")}/mcp` },
    // Sign in again after 90 days without using the connector.
    refreshTokenIdleTTL: 90 * 24 * 60 * 60,

    // Runs whenever Claude exchanges a code or refreshes its token. Each time, we also
    // refresh the Supabase session so the new MCP access token carries a Supabase token
    // that is valid for (almost) exactly as long as the MCP one.
    async tokenExchangeCallback({ grantType, props, env }) {
      if (grantType !== "authorization_code" && grantType !== "refresh_token") return;
      const grant = props as GrantProps;
      if (!grant.sbRefreshToken) throw new OAuthError("invalid_grant", { description: "Sign in to Rosie again." });
      let session;
      try {
        session = await refreshSession(env, grant.sbRefreshToken);
      } catch (err) {
        console.warn("Supabase refresh failed", (err as Error).message);
        // A rejected refresh token means the session is over: Claude must sign in again.
        // Anything else (Supabase down, network blip) is temporary, so keep the grant.
        if (err instanceof SupabaseAuthError && err.status >= 400 && err.status < 500) {
          throw new OAuthError("invalid_grant", { description: "Your Rosie session has ended. Reconnect to sign in again." });
        }
        throw new OAuthError("temporarily_unavailable", { description: "Rosie's database is unavailable. Try again shortly.", statusCode: 503 });
      }
      return {
        // The access token only needs the short-lived Supabase token.
        accessTokenProps: { userId: grant.userId, email: grant.email, sbAccessToken: session.access_token },
        // The grant keeps the rotated refresh token for next time.
        newProps: { userId: grant.userId, email: grant.email, sbRefreshToken: session.refresh_token },
        accessTokenTTL: Math.max(60, session.expires_in - 60),
      };
    },
  });
  return provider;
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return getProvider(env, new URL(request.url).origin).fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
