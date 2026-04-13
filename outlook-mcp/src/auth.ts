import {
  ConfidentialClientApplication,
  PublicClientApplication,
  LogLevel,
  type AuthenticationResult,
  type Configuration,
  type ICachePlugin,
  type TokenCacheContext,
} from "@azure/msal-node";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { homedir } from "node:os";
import { join } from "node:path";

// Delegated scopes we need to have full read/write on mail + calendar.
// offline_access gets us a refresh token so we don't pester the user every run.
export const DELEGATED_SCOPES = [
  "offline_access",
  "User.Read",
  "Mail.ReadWrite",
  "Mail.Send",
  "MailboxSettings.ReadWrite",
  "Calendars.ReadWrite",
];

// For app-only (client_credentials) access we must use the /.default scope.
export const APP_ONLY_SCOPES = ["https://graph.microsoft.com/.default"];

export type AuthMode = "device" | "client_credentials";

export interface AuthConfig {
  clientId: string;
  tenantId: string;
  clientSecret?: string;
  mode: AuthMode;
  cachePath: string;
  userId?: string;
}

export function loadAuthConfig(): AuthConfig {
  const clientId = process.env.OUTLOOK_CLIENT_ID;
  if (!clientId) {
    throw new Error(
      "OUTLOOK_CLIENT_ID is required. Register an app in Microsoft Entra and set it in the environment.",
    );
  }
  const tenantId = process.env.OUTLOOK_TENANT_ID || "common";
  const mode = (process.env.AUTH_MODE || "device").toLowerCase() as AuthMode;
  if (mode !== "device" && mode !== "client_credentials") {
    throw new Error(`Unsupported AUTH_MODE: ${mode}. Use "device" or "client_credentials".`);
  }
  const clientSecret = process.env.OUTLOOK_CLIENT_SECRET;
  if (mode === "client_credentials" && !clientSecret) {
    throw new Error("OUTLOOK_CLIENT_SECRET is required when AUTH_MODE=client_credentials.");
  }
  const cachePath =
    process.env.TOKEN_CACHE_PATH || join(homedir(), ".outlook-mcp", "token-cache.json");
  const userId = process.env.OUTLOOK_USER_ID;
  return { clientId, tenantId, clientSecret, mode, cachePath, userId };
}

// Simple file-backed MSAL cache plugin. MSAL calls beforeCacheAccess before
// reading from the in-memory cache and afterCacheAccess after mutations, so we
// load and persist the serialized cache to disk around those hooks.
function createFileCachePlugin(path: string): ICachePlugin {
  return {
    async beforeCacheAccess(ctx: TokenCacheContext) {
      try {
        const contents = await readFile(path, "utf8");
        ctx.tokenCache.deserialize(contents);
      } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
      }
    },
    async afterCacheAccess(ctx: TokenCacheContext) {
      if (ctx.cacheHasChanged) {
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, ctx.tokenCache.serialize(), "utf8");
      }
    },
  };
}

function buildMsalConfig(cfg: AuthConfig): Configuration {
  return {
    auth: {
      clientId: cfg.clientId,
      authority: `https://login.microsoftonline.com/${cfg.tenantId}`,
      clientSecret: cfg.clientSecret,
    },
    cache: {
      cachePlugin: createFileCachePlugin(cfg.cachePath),
    },
    system: {
      loggerOptions: {
        // MCP servers speak JSON-RPC on stdout, so route MSAL logs to stderr.
        loggerCallback: (_level, message) => {
          process.stderr.write(`[msal] ${message}\n`);
        },
        piiLoggingEnabled: false,
        logLevel: LogLevel.Warning,
      },
    },
  };
}

/**
 * A token provider that caches an access token in-memory and refreshes it
 * transparently when it's close to expiring. We expose `getToken()` to the
 * Graph client; callers never need to think about MSAL directly.
 */
export class TokenProvider {
  private cached: { token: string; expiresOn: number } | null = null;
  private readonly refreshSkewMs = 60_000;

  private readonly publicApp?: PublicClientApplication;
  private readonly confidentialApp?: ConfidentialClientApplication;

  constructor(private readonly cfg: AuthConfig) {
    const msalConfig = buildMsalConfig(cfg);
    if (cfg.mode === "device") {
      this.publicApp = new PublicClientApplication(msalConfig);
    } else {
      this.confidentialApp = new ConfidentialClientApplication(msalConfig);
    }
  }

  async getToken(): Promise<string> {
    if (this.cached && this.cached.expiresOn - Date.now() > this.refreshSkewMs) {
      return this.cached.token;
    }
    const result =
      this.cfg.mode === "device"
        ? await this.acquireDelegated()
        : await this.acquireAppOnly();
    if (!result?.accessToken) {
      throw new Error("Failed to acquire access token from Microsoft Entra.");
    }
    this.cached = {
      token: result.accessToken,
      expiresOn: result.expiresOn ? result.expiresOn.getTime() : Date.now() + 55 * 60_000,
    };
    return result.accessToken;
  }

  private async acquireDelegated(): Promise<AuthenticationResult | null> {
    const app = this.publicApp!;
    // Try silent first — if we have a refresh token in the cache this just works.
    const accounts = await app.getTokenCache().getAllAccounts();
    if (accounts.length > 0) {
      try {
        return await app.acquireTokenSilent({
          account: accounts[0],
          scopes: DELEGATED_SCOPES,
        });
      } catch (err) {
        process.stderr.write(
          `[outlook-mcp] silent token acquisition failed, falling back to device code: ${String(err)}\n`,
        );
      }
    }
    // Fallback: device code. User will see a prompt on stderr.
    return app.acquireTokenByDeviceCode({
      scopes: DELEGATED_SCOPES,
      deviceCodeCallback: (response) => {
        process.stderr.write(`\n[outlook-mcp] ${response.message}\n\n`);
      },
    });
  }

  private async acquireAppOnly(): Promise<AuthenticationResult | null> {
    return this.confidentialApp!.acquireTokenByClientCredential({
      scopes: APP_ONLY_SCOPES,
    });
  }
}
