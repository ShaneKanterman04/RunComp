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
