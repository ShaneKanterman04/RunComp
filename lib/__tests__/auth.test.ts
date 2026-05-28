/**
 * @jest-environment node
 */

import { createHmac } from "node:crypto";

type AuthModule = typeof import("../auth");

async function loadAuth(secret = "test-secret") {
  jest.resetModules();
  process.env.RUNCOMP_SECRET = secret;
  return import("../auth");
}

function signPayload(payload: Record<string, unknown>, secret = "test-secret") {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

describe("auth invite tokens", () => {
  let auth: AuthModule;

  beforeEach(async () => {
    auth = await loadAuth();
  });

  afterEach(() => {
    delete process.env.RUNCOMP_SECRET;
    jest.resetModules();
  });

  it("creates verifiable invite tokens with scoped claims", async () => {
    const token = await auth.createInviteToken({ groupId: "group-1", memberId: "member-1", role: "member" });
    const claims = await auth.verifyInviteToken(token);

    expect(claims).toMatchObject({ groupId: "group-1", memberId: "member-1", role: "member" });
    expect(claims?.exp).toBeGreaterThan(Date.now());
  });

  it("rejects tampered invite tokens", async () => {
    const token = await auth.createInviteToken({ groupId: "group-1", memberId: "member-1", role: "member" });
    const [payload, signature] = token.split(".");
    const tamperedPayload = Buffer.from(
      JSON.stringify({ groupId: "group-1", memberId: "owner-1", role: "owner", exp: Date.now() + 100000, kind: "invite" }),
    ).toString("base64url");

    await expect(auth.verifyInviteToken(`${tamperedPayload}.${signature}`)).resolves.toBeNull();
    await expect(auth.verifyInviteToken(`${payload}.bad-signature`)).resolves.toBeNull();
  });

  it("rejects expired, malformed, and wrong-kind invite tokens", async () => {
    const expired = signPayload({ groupId: "group-1", memberId: "member-1", role: "member", exp: Date.now() - 1, kind: "invite" });
    const wrongKind = signPayload({ groupId: "group-1", memberId: "member-1", role: "member", exp: Date.now() + 100000, kind: "session" });
    const badRole = signPayload({ groupId: "group-1", memberId: "member-1", role: "admin", exp: Date.now() + 100000, kind: "invite" });

    await expect(auth.verifyInviteToken(expired)).resolves.toBeNull();
    await expect(auth.verifyInviteToken(wrongKind)).resolves.toBeNull();
    await expect(auth.verifyInviteToken(badRole)).resolves.toBeNull();
    await expect(auth.verifyInviteToken("not-a-token")).resolves.toBeNull();
  });
});

describe("auth sessions", () => {
  afterEach(() => {
    delete process.env.RUNCOMP_SECRET;
    jest.resetModules();
    jest.dontMock("next/headers");
    jest.dontMock("@/lib/store");
  });

  it("hydrates current sessions from store context instead of trusting cookie roles", async () => {
    jest.resetModules();
    process.env.RUNCOMP_SECRET = "test-secret";
    let cookieValue = "";
    const cookieStore = {
      get: jest.fn(() => (cookieValue ? { value: cookieValue } : undefined)),
      set: jest.fn((_name: string, value: string) => {
        cookieValue = value;
      }),
      delete: jest.fn(() => {
        cookieValue = "";
      }),
    };
    const getGroupContext = jest.fn().mockResolvedValue({
      group: { id: "group-1", code: "123", name: "Family Miles", goalMiles: 100, createdAt: "2026-05-01T00:00:00Z" },
      member: { id: "member-1", name: "Molly", role: "member", createdAt: "2026-05-01T00:00:00Z" },
      members: [{ id: "member-1", name: "Molly", role: "member", createdAt: "2026-05-01T00:00:00Z" }],
    });
    jest.doMock("next/headers", () => ({ cookies: jest.fn(async () => cookieStore) }));
    jest.doMock("@/lib/store", () => ({ getGroupContext }));
    const auth = await import("../auth");

    await auth.setSessionCookie({ groupId: "group-1", memberId: "member-1", role: "owner" });
    const session = await auth.getCurrentSession();

    expect(cookieStore.set).toHaveBeenCalledWith(
      auth.SESSION_COOKIE,
      expect.any(String),
      expect.objectContaining({ httpOnly: true, sameSite: "lax" }),
    );
    expect(getGroupContext).toHaveBeenCalledWith("group-1", "member-1");
    expect(session?.claims.role).toBe("owner");
    expect(session?.member.role).toBe("member");
  });
});
