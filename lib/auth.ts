import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { cookies } from "next/headers";
import type { MemberRole } from "@/lib/store";
import { getGroupContext } from "@/lib/store";

export const SESSION_COOKIE = "runcomp_session";

export type SessionClaims = {
  groupId: string;
  memberId: string;
  role: MemberRole;
  exp: number;
};

export type InviteClaims = {
  groupId: string;
  memberId: string;
  role: MemberRole;
  exp: number;
};

const dataDir = process.env.DATA_DIR || path.join(process.cwd(), ".data");
const secretFile = path.join(dataDir, "session-secret");
const sessionTtlMs = 1000 * 60 * 60 * 24 * 30;
const inviteTtlMs = 1000 * 60 * 60 * 24 * 14;

export async function setSessionCookie(input: { groupId: string; memberId: string; role: MemberRole }) {
  const exp = Date.now() + sessionTtlMs;
  const token = await signSession({ ...input, exp });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.RUNCOMP_SECURE_COOKIES === "true",
    path: "/",
    maxAge: sessionTtlMs / 1000,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function createInviteToken(input: { groupId: string; memberId: string; role: MemberRole }) {
  const exp = Date.now() + inviteTtlMs;
  return signInvite({ ...input, exp });
}

export async function verifyInviteToken(token: string): Promise<InviteClaims | null> {
  return verifyInvite(token);
}

export async function getCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const claims = await verifySession(token);
  if (!claims) return null;
  const context = await getGroupContext(claims.groupId, claims.memberId);
  if (!context) return null;
  return {
    claims,
    ...context,
  };
}

export async function requireSession() {
  const session = await getCurrentSession();
  if (!session) {
    throw new AuthError("Sign in to your run group.", 401);
  }
  return session;
}

export class AuthError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function signSession(claims: SessionClaims) {
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const signature = createHmac("sha256", await getSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

async function signInvite(claims: InviteClaims) {
  const payload = Buffer.from(JSON.stringify({ ...claims, kind: "invite" })).toString("base64url");
  const signature = createHmac("sha256", await getSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

async function verifySession(token: string): Promise<SessionClaims | null> {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  if (!payload || !signature) return null;
  const expected = createHmac("sha256", await getSecret()).update(payload).digest("base64url");
  if (!signaturesMatch(signature, expected)) return null;

  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<SessionClaims>;
    if (
      typeof claims.groupId !== "string" ||
      typeof claims.memberId !== "string" ||
      (claims.role !== "owner" && claims.role !== "member") ||
      typeof claims.exp !== "number" ||
      claims.exp < Date.now()
    ) {
      return null;
    }
    return claims as SessionClaims;
  } catch {
    return null;
  }
}

async function verifyInvite(token: string): Promise<InviteClaims | null> {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  if (!payload || !signature) return null;
  const expected = createHmac("sha256", await getSecret()).update(payload).digest("base64url");
  if (!signaturesMatch(signature, expected)) return null;

  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<InviteClaims> & { kind?: string };
    if (
      claims.kind !== "invite" ||
      typeof claims.groupId !== "string" ||
      typeof claims.memberId !== "string" ||
      (claims.role !== "owner" && claims.role !== "member") ||
      typeof claims.exp !== "number" ||
      claims.exp < Date.now()
    ) {
      return null;
    }
    return claims as InviteClaims;
  } catch {
    return null;
  }
}

function signaturesMatch(actual: string, expected: string) {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

async function getSecret() {
  if (process.env.RUNCOMP_SECRET) return process.env.RUNCOMP_SECRET;
  try {
    return await fs.readFile(secretFile, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    await fs.mkdir(dataDir, { recursive: true });
    const secret = randomBytes(32).toString("hex");
    await fs.writeFile(secretFile, secret, { flag: "wx" }).catch(async (writeError) => {
      if ((writeError as NodeJS.ErrnoException).code === "EEXIST") return;
      throw writeError;
    });
    return fs.readFile(secretFile, "utf8");
  }
}
