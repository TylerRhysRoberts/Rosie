import { createClient } from "@supabase/supabase-js";

export interface SupabaseSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: { id: string; email?: string };
}

type SupabaseEnv = Pick<Env, "SUPABASE_URL" | "SUPABASE_PUBLISHABLE_KEY">;

export class SupabaseAuthError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function authRequest(env: SupabaseEnv, grantType: "password" | "refresh_token", body: object): Promise<SupabaseSession> {
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=${grantType}`, {
    method: "POST",
    headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new SupabaseAuthError(`Supabase ${grantType} request failed (${res.status}): ${detail.slice(0, 200)}`, res.status);
  }
  return res.json();
}

/** Signs in with the same email and password used in the Rosie app. */
export function signInWithPassword(env: SupabaseEnv, email: string, password: string) {
  return authRequest(env, "password", { email, password });
}

/** Swaps a Supabase refresh token for a fresh session. Supabase rotates the refresh token each time. */
export function refreshSession(env: SupabaseEnv, refreshToken: string) {
  return authRequest(env, "refresh_token", { refresh_token: refreshToken });
}

/**
 * A Supabase client that acts as the signed-in user. Every query runs through
 * the same row-level security as the app, so this Worker can only ever see
 * Rosie's data for the account that authorised the connector.
 */
export function userClient(env: SupabaseEnv, accessToken: string) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type UserClient = ReturnType<typeof userClient>;
