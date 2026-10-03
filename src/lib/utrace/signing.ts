/**
 * The shared token envelope used by every uTrace integration point in this
 * fixture: the route context header, the preview handoff token and the preview
 * session cookie.
 *
 * Envelope: `<version>.<base64url(payload)>.<base64url(HMAC-SHA256(payload))>`
 * where the signature covers the encoded payload bytes exactly as transmitted,
 * so verification never depends on re-serialising JSON.
 *
 * Signatures are compared by `crypto.subtle.verify`, which is constant time.
 */

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * Base64url helpers built on `atob`/`btoa` rather than `Buffer`, because
 * `src/proxy.ts` verifies the route context in the edge runtime.
 */
export function toBase64Url(value: string | ArrayBuffer | Uint8Array): string {
  const bytes =
    typeof value === "string"
      ? encoder.encode(value)
      : value instanceof Uint8Array
        ? value
        : new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

export function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const padded = `${value.replaceAll("-", "+").replaceAll("_", "/")}${"=".repeat(
    (4 - (value.length % 4)) % 4,
  )}`;
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

async function importKey(secret: string, usage: "sign" | "verify"): Promise<CryptoKey> {
  if (secret === "") {
    throw new Error("a signing secret is required");
  }
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    [usage],
  );
}

/** Produces `<version>.<payload>.<signature>` for a JSON claim set. */
export async function signToken(
  version: string,
  claims: Readonly<Record<string, unknown>>,
  secret: string,
): Promise<string> {
  const payload = toBase64Url(JSON.stringify(claims));
  const key = await importKey(secret, "sign");
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return `${version}.${payload}.${toBase64Url(signature)}`;
}

/**
 * Checks the envelope and the signature and returns the decoded payload as
 * unparsed JSON. Claim validation belongs to the caller's schema.
 */
export async function openToken(
  token: string,
  expectedVersion: string,
  secret: string,
): Promise<unknown> {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("token envelope must have exactly three segments");
  }
  const [version, payload, signature] = parts as [string, string, string];
  if (version !== expectedVersion) {
    throw new Error(`token version must be "${expectedVersion}", received "${version}"`);
  }
  if (payload === "" || signature === "") {
    throw new Error("token payload and signature must both be present");
  }
  const key = await importKey(secret, "verify");
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    fromBase64Url(signature),
    encoder.encode(payload),
  );
  if (!valid) {
    throw new Error("token signature does not match");
  }
  return JSON.parse(decoder.decode(fromBase64Url(payload)));
}
