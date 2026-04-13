import "isomorphic-fetch";
import { Client, type AuthenticationProvider } from "@microsoft/microsoft-graph-client";
import type { AuthConfig, TokenProvider } from "./auth.js";

class TokenProviderAuth implements AuthenticationProvider {
  constructor(private readonly provider: TokenProvider) {}
  async getAccessToken(): Promise<string> {
    return this.provider.getToken();
  }
}

export function createGraphClient(provider: TokenProvider): Client {
  return Client.initWithMiddleware({
    authProvider: new TokenProviderAuth(provider),
    defaultVersion: "v1.0",
  });
}

/**
 * Build the Graph path prefix for the current user. In delegated (device) mode
 * we always talk to /me, while in app-only mode we need /users/{id}.
 */
export function userScope(cfg: AuthConfig): string {
  if (cfg.mode === "device") return "/me";
  if (!cfg.userId) {
    throw new Error(
      "OUTLOOK_USER_ID is required when AUTH_MODE=client_credentials so we know which mailbox to use.",
    );
  }
  return `/users/${encodeURIComponent(cfg.userId)}`;
}
