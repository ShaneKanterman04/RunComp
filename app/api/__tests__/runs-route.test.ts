/**
 * @jest-environment node
 */

import { DELETE, GET, PATCH, POST } from "../runs/route";
import { AuthError, requireSession } from "@/lib/auth";
import { notifyChallengeCompleted, notifyCloseToPass, notifyLeadChanged, notifyRunLogged } from "@/lib/push";
import { addRun, claimChallengeCompletions, deleteRun, getGroupContext, listRuns, toggleRunReaction } from "@/lib/store";
import { jsonRequest, malformedJsonRequest, readJson } from "./route-test-utils";

jest.mock("@/lib/auth", () => {
  class MockAuthError extends Error {
    status: number;

    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  }

  return {
    AuthError: MockAuthError,
    requireSession: jest.fn(),
  };
});

jest.mock("@/lib/push", () => ({
  notifyChallengeCompleted: jest.fn(),
  notifyCloseToPass: jest.fn(),
  notifyLeadChanged: jest.fn(),
  notifyRunLogged: jest.fn(),
}));

jest.mock("@/lib/store", () => ({
  addRun: jest.fn(),
  claimChallengeCompletions: jest.fn(),
  deleteRun: jest.fn(),
  getGroupContext: jest.fn(),
  listRuns: jest.fn(),
  storeErrorResponse: (error: unknown) => {
    if (error && typeof error === "object" && "status" in error && "message" in error) {
      return { status: Number((error as { status: number }).status), message: String((error as { message: string }).message) };
    }
    return { status: 500, message: "RunComp could not complete that request." };
  },
  toggleRunReaction: jest.fn(),
}));

const group = { id: "group-1", code: "123", name: "Family Miles", goalMiles: 100, createdAt: "2026-05-01T00:00:00Z" };
const member = { id: "member-1", name: "Molly", role: "member" as const, createdAt: "2026-05-01T00:00:00Z" };
const owner = { id: "owner-1", name: "Shane", role: "owner" as const, createdAt: "2026-05-01T00:00:00Z" };
const session = { group, member, members: [owner, member] };
const run = {
  id: "run-1",
  memberId: "member-1",
  runner: "Molly",
  miles: 3.25,
  durationSeconds: 1560,
  date: "2026-05-22",
  note: "tempo",
  reactions: [],
  createdAt: "2026-05-22T12:00:00Z",
};

describe("/api/runs", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(requireSession).mockResolvedValue(session as never);
    jest.mocked(notifyRunLogged).mockResolvedValue(undefined);
    jest.mocked(notifyLeadChanged).mockResolvedValue(undefined);
    jest.mocked(notifyCloseToPass).mockResolvedValue(undefined);
    jest.mocked(notifyChallengeCompleted).mockResolvedValue(undefined);
    jest.mocked(claimChallengeCompletions).mockResolvedValue([]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("lists runs for the signed-in viewer", async () => {
    jest.mocked(listRuns).mockResolvedValue([run]);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(listRuns).toHaveBeenCalledWith("group-1", "member-1");
    expect(await readJson(response)).toEqual({ runs: [run] });
  });

  it("requires a session before listing runs", async () => {
    jest.mocked(requireSession).mockRejectedValue(new AuthError("Sign in to your run group.", 401));

    const response = await GET();

    expect(response.status).toBe(401);
    expect(await readJson(response)).toEqual({ error: "Sign in to your run group." });
    expect(listRuns).not.toHaveBeenCalled();
  });

  it("returns store errors when listing runs fails", async () => {
    jest.mocked(listRuns).mockRejectedValue({ status: 404, message: "Run group not found." });

    const response = await GET();

    expect(response.status).toBe(404);
    expect(await readJson(response)).toEqual({ error: "Run group not found." });
  });

  it("validates run input before writing", async () => {
    const badBody = await POST(jsonRequest("/api/runs", null));
    const badJson = await POST(malformedJsonRequest("/api/runs"));
    const badMiles = await POST(jsonRequest("/api/runs", { miles: 0, date: "2026-05-22" }));
    const badDate = await POST(jsonRequest("/api/runs", { miles: 3, date: "2026-02-31" }));
    const badDuration = await POST(jsonRequest("/api/runs", { miles: 3, date: "2026-05-22", durationSeconds: 172801 }));
    const longNote = await POST(jsonRequest("/api/runs", { miles: 3, date: "2026-05-22", note: "x".repeat(181) }));

    expect(badBody.status).toBe(400);
    expect(await readJson(badBody)).toEqual({ error: "Send a JSON object." });
    expect(badJson.status).toBe(400);
    expect(await readJson(badJson)).toEqual({ error: "Send a JSON body." });
    expect(badMiles.status).toBe(400);
    expect(await readJson(badMiles)).toEqual({ error: "Miles must be between 0 and 100." });
    expect(badDate.status).toBe(400);
    expect(await readJson(badDate)).toEqual({ error: "Date must be a valid YYYY-MM-DD value." });
    expect(badDuration.status).toBe(400);
    expect(await readJson(badDuration)).toEqual({ error: "Run time must be between 1 second and 48 hours." });
    expect(longNote.status).toBe(400);
    expect(await readJson(longNote)).toEqual({ error: "Run notes must be 180 characters or fewer." });
    expect(addRun).not.toHaveBeenCalled();
  });

  it("logs runs for the signed-in member and starts notification work", async () => {
    jest.mocked(listRuns).mockResolvedValueOnce([]).mockResolvedValueOnce([run]);
    jest.mocked(addRun).mockResolvedValue(run);
    jest.mocked(getGroupContext).mockResolvedValue(null);

    const response = await POST(jsonRequest("/api/runs", { miles: "3.25", date: "2026-05-22", durationSeconds: "1560", note: "tempo" }));

    expect(response.status).toBe(201);
    expect(addRun).toHaveBeenCalledWith("group-1", "member-1", { miles: 3.25, date: "2026-05-22", note: "tempo", durationSeconds: 1560 });
    expect(notifyRunLogged).toHaveBeenCalledWith("group-1", run);
    expect(await readJson(response)).toEqual({ run });
  });

  it("returns store errors when logging runs fails", async () => {
    jest.mocked(listRuns).mockResolvedValueOnce([]);
    jest.mocked(addRun).mockRejectedValue({ status: 404, message: "Member not found." });

    const response = await POST(jsonRequest("/api/runs", { miles: "3.25", date: "2026-05-22" }));

    expect(response.status).toBe(404);
    expect(await readJson(response)).toEqual({ error: "Member not found." });
    expect(notifyRunLogged).not.toHaveBeenCalled();
  });

  it("sends lead-change notifications when the leader changes", async () => {
    jest
      .mocked(listRuns)
      .mockResolvedValueOnce([{ ...run, id: "before", memberId: "owner-1", runner: "Shane", miles: 2 }])
      .mockResolvedValueOnce([{ ...run, id: "before", memberId: "owner-1", runner: "Shane", miles: 2 }, run]);
    jest.mocked(addRun).mockResolvedValue(run);
    jest.mocked(getGroupContext).mockResolvedValue(null);

    await POST(jsonRequest("/api/runs", { miles: 3.25, date: "2026-05-22" }));

    expect(notifyLeadChanged).toHaveBeenCalledWith("group-1", "Molly", 3.25);
  });

  it("sends challenge notifications only for freshly claimed completions", async () => {
    jest.useFakeTimers({ now: new Date("2026-05-28T12:00:00Z") });
    const challengeRun = { ...run, miles: 5, date: "2026-05-27", createdAt: "2026-05-27T12:00:00Z" };
    jest.mocked(listRuns).mockResolvedValueOnce([]).mockResolvedValueOnce([challengeRun]);
    jest.mocked(addRun).mockResolvedValue(challengeRun);
    jest.mocked(getGroupContext).mockResolvedValue({
      group,
      member,
      members: [member],
    } as never);
    jest.mocked(claimChallengeCompletions).mockResolvedValue(["2026-05-25:weekly-mileage"]);

    const response = await POST(jsonRequest("/api/runs", { miles: 5, date: "2026-05-27" }));

    expect(response.status).toBe(201);
    expect(claimChallengeCompletions).toHaveBeenCalledWith(
      "group-1",
      expect.arrayContaining(["2026-05-25:weekly-mileage", "2026-05-25:everyone-logs"]),
    );
    expect(notifyChallengeCompleted).toHaveBeenCalledTimes(1);
    expect(notifyChallengeCompleted).toHaveBeenCalledWith("group-1", expect.objectContaining({ id: "2026-05-25:weekly-mileage" }));
  });

  it("toggles supported reactions and rejects malformed reaction requests", async () => {
    jest.mocked(toggleRunReaction).mockResolvedValue({ ...run, reactions: [{ type: "fire", count: 1, reactedByMe: true }] });

    const badBody = await PATCH(jsonRequest("/api/runs", null, "PATCH"));
    const badJson = await PATCH(malformedJsonRequest("/api/runs", "PATCH"));
    const missingId = await PATCH(jsonRequest("/api/runs", { reaction: "fire" }, "PATCH"));
    const badReaction = await PATCH(jsonRequest("/api/runs", { id: "run-1", reaction: "sparkle" }, "PATCH"));
    const response = await PATCH(jsonRequest("/api/runs", { id: "run-1", reaction: "fire" }, "PATCH"));

    expect(badBody.status).toBe(400);
    expect(await readJson(badBody)).toEqual({ error: "Send a JSON object." });
    expect(badJson.status).toBe(400);
    expect(await readJson(badJson)).toEqual({ error: "Send a JSON body." });
    expect(missingId.status).toBe(400);
    expect(await readJson(missingId)).toEqual({ error: "Missing run id." });
    expect(badReaction.status).toBe(400);
    expect(await readJson(badReaction)).toEqual({ error: "Reaction is not supported." });
    expect(response.status).toBe(200);
    expect(toggleRunReaction).toHaveBeenCalledWith("group-1", "member-1", "run-1", "fire");
  });

  it("returns store errors when reaction updates fail", async () => {
    jest.mocked(toggleRunReaction).mockRejectedValue({ status: 404, message: "Run not found." });

    const response = await PATCH(jsonRequest("/api/runs", { id: "run-1", reaction: "fire" }, "PATCH"));

    expect(response.status).toBe(404);
    expect(await readJson(response)).toEqual({ error: "Run not found." });
  });

  it("deletes runs using the signed-in member id", async () => {
    jest.mocked(deleteRun).mockResolvedValue(true);

    const response = await DELETE(new Request("http://localhost/api/runs?id=run-1", { method: "DELETE" }));

    expect(response.status).toBe(200);
    expect(deleteRun).toHaveBeenCalledWith("group-1", "member-1", "run-1");
    expect(await readJson(response)).toEqual({ ok: true });
  });

  it("returns store errors when run deletion fails", async () => {
    jest.mocked(deleteRun).mockRejectedValue({ status: 403, message: "You can only delete your own runs." });

    const response = await DELETE(new Request("http://localhost/api/runs?id=run-1", { method: "DELETE" }));

    expect(response.status).toBe(403);
    expect(await readJson(response)).toEqual({ error: "You can only delete your own runs." });
  });

  it("handles missing and unknown run deletes", async () => {
    jest.mocked(deleteRun).mockResolvedValue(false);

    const missing = await DELETE(new Request("http://localhost/api/runs", { method: "DELETE" }));
    const unknown = await DELETE(new Request("http://localhost/api/runs?id=missing", { method: "DELETE" }));

    expect(missing.status).toBe(400);
    expect(await readJson(missing)).toEqual({ error: "Missing run id." });
    expect(unknown.status).toBe(404);
    expect(await readJson(unknown)).toEqual({ error: "Run not found." });
  });
});
