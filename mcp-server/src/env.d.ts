import type { OAuthHelpers } from "@cloudflare/workers-oauth-provider";

declare global {
  interface Env {
    /** Injected by OAuthProvider into the default handler's env. */
    OAUTH_PROVIDER: OAuthHelpers;
    /** Secret: comma-separated emails allowed to connect. */
    ALLOWED_EMAILS?: string;
  }
}
