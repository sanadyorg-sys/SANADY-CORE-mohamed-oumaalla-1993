import "server-only";

function optional(value: string | undefined) {
  return value && value.trim() !== "" ? value : undefined;
}

export const serverEnv = {
  get serviceRoleKey() {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) throw new Error("[SANADY] Missing SUPABASE_SERVICE_ROLE_KEY (server only). See .env.example.");
    return key;
  },
  get resendApiKey() {
    return optional(process.env.RESEND_API_KEY);
  },
  get emailFrom() {
    return optional(process.env.EMAIL_FROM) ?? "SANADY <no-reply@example.org>";
  },
  get mux() {
    const keyId = optional(process.env.MUX_SIGNING_KEY_ID);
    const privateKey = optional(process.env.MUX_SIGNING_PRIVATE_KEY);
    return keyId && privateKey ? { keyId, privateKey } : undefined;
  },
  /** Bunny Stream: all four values are needed (upload with the API key, signed playback with the token key). */
  get bunny() {
    const libraryId = optional(process.env.BUNNY_STREAM_LIBRARY_ID)?.trim();
    const apiKey = optional(process.env.BUNNY_STREAM_API_KEY)?.trim();
    const cdnHostname = bunnyCdnHostname();
    const tokenKey = optional(process.env.BUNNY_STREAM_TOKEN_KEY)?.trim();
    return libraryId && apiKey && cdnHostname && tokenKey ? { libraryId, apiKey, cdnHostname, tokenKey } : undefined;
  },
};

/** The library's CDN host (e.g. vz-1234abcd-567.b-cdn.net), accepted with or without https:// and trailing slash. */
export function bunnyCdnHostname() {
  const host = optional(process.env.BUNNY_STREAM_CDN_HOSTNAME)?.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "").toLowerCase();
  return host && /^[a-z0-9.-]+$/.test(host) ? host : undefined;
}
