import { describe, expect, test } from "vitest";

import {
  MAXIMUM_HANDOFF_LIFETIME_MS,
  PreviewHandoffError,
  signPreviewHandoffToken,
  verifyPreviewHandoffToken,
  type PreviewHandoffClaims,
} from "@/lib/utrace/preview-handoff";
import {
  PREVIEW_SESSION_COOKIE_NAME,
  createPreviewSessionCookie,
  readPreviewSessionCookie,
} from "@/lib/server/preview-session";

const SECRET = "preview-handoff-secret-under-test";
const HOST = "a1b2c3.preview.utrace.dev";
const NOW = new Date("2026-09-14T09:00:00Z");
const USER = {
  id: "0f1e2d3c-4b5a-4968-8778-695a4b3c2d1e",
  email: "maya@dudulemon.example.com",
};

function claims(overrides: Partial<PreviewHandoffClaims>): PreviewHandoffClaims {
  return {
    schema_version: "shopalytics-preview-handoff-v1",
    token_id: "7a6b5c4d-3e2f-4a1b-9c8d-7e6f5a4b3c2d",
    subject_email: USER.email,
    audience: HOST,
    issued_at: NOW.toISOString(),
    expires_at: new Date(NOW.getTime() + 60_000).toISOString(),
    ...overrides,
  };
}

async function reasonFor(token: string, host: string, now: Date): Promise<string> {
  try {
    await verifyPreviewHandoffToken(token, SECRET, host, now);
  } catch (error) {
    if (error instanceof PreviewHandoffError) return error.reason;
    throw error;
  }
  throw new Error("the token was accepted but should have been refused");
}

describe("the preview handoff token", () => {
  test("a current token for this host signs in the named user", async () => {
    const token = await signPreviewHandoffToken(claims({}), SECRET);

    const verified = await verifyPreviewHandoffToken(token, SECRET, HOST, NOW);

    expect(verified.subject_email).toBe(USER.email);
    expect(verified.token_id).toBe("7a6b5c4d-3e2f-4a1b-9c8d-7e6f5a4b3c2d");
  });

  test("the host comparison ignores case and a default port", async () => {
    const token = await signPreviewHandoffToken(claims({ audience: HOST.toUpperCase() }), SECRET);

    await expect(verifyPreviewHandoffToken(token, SECRET, HOST, NOW)).resolves.toBeTruthy();
  });

  test("a token signed with another secret is refused", async () => {
    const token = await signPreviewHandoffToken(claims({}), "a-different-secret");

    expect(await reasonFor(token, HOST, NOW)).toBe("signature");
  });

  test("a token replayed against another origin is refused", async () => {
    const token = await signPreviewHandoffToken(claims({}), SECRET);

    expect(await reasonFor(token, "attacker.example.com", NOW)).toBe("audience");
  });

  test("an expired token is refused", async () => {
    const token = await signPreviewHandoffToken(claims({}), SECRET);

    expect(await reasonFor(token, HOST, new Date(NOW.getTime() + 61_000))).toBe("expired");
  });

  test("a long-lived token is refused even before it expires", async () => {
    const token = await signPreviewHandoffToken(
      claims({
        expires_at: new Date(NOW.getTime() + MAXIMUM_HANDOFF_LIFETIME_MS + 1_000).toISOString(),
      }),
      SECRET,
    );

    expect(await reasonFor(token, HOST, NOW)).toBe("lifetime");
  });

  test("a token from the future is refused", async () => {
    const issuedAt = new Date(NOW.getTime() + 120_000);
    const token = await signPreviewHandoffToken(
      claims({
        issued_at: issuedAt.toISOString(),
        expires_at: new Date(issuedAt.getTime() + 60_000).toISOString(),
      }),
      SECRET,
    );

    expect(await reasonFor(token, HOST, NOW)).toBe("not_yet_valid");
  });

  test("a tampered payload is refused", async () => {
    const token = await signPreviewHandoffToken(claims({}), SECRET);
    const [version, payload, signature] = token.split(".");
    const forged = JSON.stringify({
      ...claims({ subject_email: "someone.else@dudulemon.example.com" }),
    });
    const tampered = `${version}.${Buffer.from(forged).toString("base64url")}.${signature}`;

    expect(payload).not.toBe("");
    expect(await reasonFor(tampered, HOST, NOW)).toBe("signature");
  });

  test("a malformed envelope is refused", async () => {
    expect(await reasonFor("not-a-token", HOST, NOW)).toBe("malformed");
    expect(await reasonFor("v2.abc.def", HOST, NOW)).toBe("malformed");
  });
});

describe("the preview session cookie", () => {
  test("round-trips the signed-in user", async () => {
    const cookie = await createPreviewSessionCookie(USER, SECRET, NOW, true);

    expect(cookie.name).toBe(PREVIEW_SESSION_COOKIE_NAME);
    expect(cookie.options).toMatchObject({ httpOnly: true, secure: true, sameSite: "lax" });

    const session = await readPreviewSessionCookie(cookie.value, SECRET, NOW);
    expect(session.user_id).toBe(USER.id);
    expect(session.email).toBe(USER.email);
  });

  test("an expired session is refused", async () => {
    const cookie = await createPreviewSessionCookie(USER, SECRET, NOW, true);
    const later = new Date(NOW.getTime() + 13 * 60 * 60 * 1000);

    await expect(readPreviewSessionCookie(cookie.value, SECRET, later)).rejects.toThrow(
      /preview session expired/u,
    );
  });

  test("a session signed with another secret is refused", async () => {
    const cookie = await createPreviewSessionCookie(USER, SECRET, NOW, true);

    await expect(readPreviewSessionCookie(cookie.value, "another-secret", NOW)).rejects.toThrow(
      /signature/u,
    );
  });
});
