/**
 * @jest-environment node
 */

import { DELETE, GET, POST } from "../session/route";
import { clearSessionCookie, getCurrentSession, setSessionCookie, verifyInviteToken } from "@/lib/auth";
import { getGroupContext, login } from "@/lib/store";
import { jsonRequest, malformedJsonRequest, readJson } from "./route-test-utils";

jest.mock("@/lib/auth", () => ({
  clearSessionCookie: jest.fn(),
  getCurrentSession: jest.fn(),
  setSessionCookie: jest.fn(),
  verifyInviteToken: jest.fn(),
}));

jest.mock("@/lib/store", () => ({
  getGroupContext: jest.fn(),
  login: jest.fn(),
  storeErrorResponse: (error: unknown) => {
    if (error && typeof error === "object" && "status" in error && "message" in error) {
      return { status: Number((error as { status: number }).status), message: String((error as { message: string }).message) };
    }
    return { status: 500, message: "RunComp could not complete that request." };
  },
}));

const group = { id: "group-1", code: "123", name: "Family Miles", goalMiles: 100, createdAt: "2026-05-01T00:00:00Z" };
const owner = { id: "owner-1", name: "Shane", role: "owner" as const, createdAt: "2026-05-01T00:00:00Z" };
const member = { id: "member-1", name: "Molly", role: "member" as const, createdAt: "2026-05-01T00:00:00Z" };
const context = { group, member, members: [owner, member] };

describe("/api/session", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns unauthenticated when there is no current session", async () => {
    jest.mocked(getCurrentSession).mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await readJson(response)).toEqual({ authenticated: false });
  });

  it("returns the current session context without claims", async () => {
    jest.mocked(getCurrentSession).mockResolvedValue({ claims: { groupId: "group-1", memberId: "member-1", role: "member", exp: 999 }, ...context } as never);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await readJson(response)).toEqual({ authenticated: true, group, member, members: [owner, member] });
  });

  it("returns structured errors when current session loading fails", async () => {
    jest.mocked(getCurrentSession).mockRejectedValue({ status: 500, message: "RunComp could not load sessions." });

    const response = await GET();

    expect(response.status).toBe(500);
    expect(await readJson(response)).toEqual({ error: "RunComp could not load sessions." });
  });

  it("logs in with group code, member name, and password", async () => {
    jest.mocked(login).mockResolvedValue({ group, member });
    jest.mocked(getGroupContext).mockResolvedValue(context as never);

    const response = await POST(jsonRequest("/api/session", { groupCode: "123", memberName: "Molly", password: "password123" }));

    expect(response.status).toBe(200);
    expect(login).toHaveBeenCalledWith({ groupCode: "123", memberName: "Molly", password: "password123" });
    expect(setSessionCookie).toHaveBeenCalledWith({ groupId: "group-1", memberId: "member-1", role: "member" });
    expect(await readJson(response)).toEqual({ authenticated: true, group, member, members: [owner, member] });
  });

  it("ignores blank invite tokens and falls back to password login", async () => {
    jest.mocked(login).mockResolvedValue({ group, member });
    jest.mocked(getGroupContext).mockResolvedValue(context as never);

    const response = await POST(jsonRequest("/api/session", { inviteToken: "  ", groupCode: "123", memberName: "Molly", password: "password123" }));

    expect(response.status).toBe(200);
    expect(verifyInviteToken).not.toHaveBeenCalled();
    expect(login).toHaveBeenCalledWith({ groupCode: "123", memberName: "Molly", password: "password123" });
    expect(setSessionCookie).toHaveBeenCalledWith({ groupId: "group-1", memberId: "member-1", role: "member" });
  });

  it("falls back to the logged-in member when context is missing after password login", async () => {
    jest.mocked(login).mockResolvedValue({ group, member });
    jest.mocked(getGroupContext).mockResolvedValue(null);

    const response = await POST(jsonRequest("/api/session", { groupCode: "123", memberName: "Molly", password: "password123" }));

    expect(response.status).toBe(200);
    expect(await readJson(response)).toEqual({ authenticated: true, group, member, members: [member] });
  });

  it("rejects non-object login requests before auth work", async () => {
    const response = await POST(jsonRequest("/api/session", null));

    expect(response.status).toBe(400);
    expect(await readJson(response)).toEqual({ error: "Send a JSON object." });
    expect(login).not.toHaveBeenCalled();
    expect(verifyInviteToken).not.toHaveBeenCalled();
    expect(setSessionCookie).not.toHaveBeenCalled();
  });

  it("rejects malformed login JSON before auth work", async () => {
    const response = await POST(malformedJsonRequest("/api/session"));

    expect(response.status).toBe(400);
    expect(await readJson(response)).toEqual({ error: "Send a JSON body." });
    expect(login).not.toHaveBeenCalled();
    expect(verifyInviteToken).not.toHaveBeenCalled();
    expect(setSessionCookie).not.toHaveBeenCalled();
  });

  it("redeems valid invite tokens and sets the invited member session", async () => {
    jest.mocked(verifyInviteToken).mockResolvedValue({ groupId: "group-1", memberId: "member-1", role: "member", exp: 999 });
    jest.mocked(getGroupContext).mockResolvedValue(context as never);

    const response = await POST(jsonRequest("/api/session", { inviteToken: "signed-token" }));

    expect(response.status).toBe(200);
    expect(login).not.toHaveBeenCalled();
    expect(setSessionCookie).toHaveBeenCalledWith({ groupId: "group-1", memberId: "member-1", role: "member" });
    expect(await readJson(response)).toEqual({ authenticated: true, group, member, members: [owner, member] });
  });

  it("rejects invalid or stale invite tokens", async () => {
    jest.mocked(verifyInviteToken).mockResolvedValue(null);

    const response = await POST(jsonRequest("/api/session", { inviteToken: "bad-token" }));

    expect(response.status).toBe(401);
    expect(await readJson(response)).toEqual({ error: "Invite link is expired or invalid." });
    expect(setSessionCookie).not.toHaveBeenCalled();
  });

  it("rejects invite tokens for removed members", async () => {
    jest.mocked(verifyInviteToken).mockResolvedValue({ groupId: "group-1", memberId: "removed", role: "member", exp: 999 });
    jest.mocked(getGroupContext).mockResolvedValue(null);

    const response = await POST(jsonRequest("/api/session", { inviteToken: "stale-token" }));

    expect(response.status).toBe(404);
    expect(await readJson(response)).toEqual({ error: "Invite member no longer exists." });
    expect(setSessionCookie).not.toHaveBeenCalled();
  });

  it("returns login validation errors", async () => {
    jest.mocked(login).mockRejectedValue({ status: 401, message: "Name or password is incorrect." });

    const response = await POST(jsonRequest("/api/session", { groupCode: "123", memberName: "Molly", password: "wrong" }));

    expect(response.status).toBe(401);
    expect(await readJson(response)).toEqual({ error: "Name or password is incorrect." });
    expect(setSessionCookie).not.toHaveBeenCalled();
  });

  it("clears the session cookie on logout", async () => {
    const response = await DELETE();

    expect(response.status).toBe(200);
    expect(clearSessionCookie).toHaveBeenCalled();
    expect(await readJson(response)).toEqual({ ok: true });
  });
});
