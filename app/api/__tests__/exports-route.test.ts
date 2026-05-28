/**
 * @jest-environment node
 */

import { GET } from "../exports/route";
import { AuthError, requireSession } from "@/lib/auth";
import { exportGroupBackup, exportRunsCsv } from "@/lib/store";
import { readJson } from "./route-test-utils";

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

jest.mock("@/lib/store", () => ({
  exportGroupBackup: jest.fn(),
  exportRunsCsv: jest.fn(),
  storeErrorResponse: (error: unknown) => {
    if (error && typeof error === "object" && "status" in error && "message" in error) {
      return { status: Number((error as { status: number }).status), message: String((error as { message: string }).message) };
    }
    return { status: 500, message: "RunComp could not complete that request." };
  },
}));

const ownerSession = {
  group: { id: "group-1", code: "123", name: "Family Miles", goalMiles: 100, createdAt: "2026-05-01T00:00:00Z" },
  member: { id: "owner-1", name: "Shane", role: "owner", createdAt: "2026-05-01T00:00:00Z" },
};

const memberSession = {
  ...ownerSession,
  member: { id: "member-1", name: "Molly", role: "member", createdAt: "2026-05-01T00:00:00Z" },
};

describe("/api/exports", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("requires a signed-in session", async () => {
    jest.mocked(requireSession).mockRejectedValue(new AuthError("Sign in to your run group.", 401));

    const response = await GET(new Request("http://localhost/api/exports"));

    expect(response.status).toBe(401);
    expect(await readJson(response)).toEqual({ error: "Sign in to your run group." });
    expect(exportGroupBackup).not.toHaveBeenCalled();
    expect(exportRunsCsv).not.toHaveBeenCalled();
  });

  it("allows any signed-in member to download the runs CSV", async () => {
    jest.mocked(requireSession).mockResolvedValue(memberSession as never);
    jest.mocked(exportRunsCsv).mockResolvedValue("date,runner,miles\n2026-05-22,Molly,3.00\n");

    const response = await GET(new Request("http://localhost/api/exports?type=csv"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("Content-Disposition")).toMatch(/^attachment; filename="runcomp-123-runs-\d{4}-\d{2}-\d{2}\.csv"$/);
    expect(await response.text()).toContain("2026-05-22,Molly,3.00");
    expect(exportRunsCsv).toHaveBeenCalledWith("group-1");
    expect(exportGroupBackup).not.toHaveBeenCalled();
  });

  it("returns structured store errors when CSV export generation fails", async () => {
    jest.mocked(requireSession).mockResolvedValue(memberSession as never);
    jest.mocked(exportRunsCsv).mockRejectedValue({ status: 404, message: "Group not found." });

    const response = await GET(new Request("http://localhost/api/exports?type=csv"));

    expect(response.status).toBe(404);
    expect(await readJson(response)).toEqual({ error: "Group not found." });
    expect(exportRunsCsv).toHaveBeenCalledWith("group-1");
    expect(exportGroupBackup).not.toHaveBeenCalled();
  });

  it("rejects unsupported export types", async () => {
    jest.mocked(requireSession).mockResolvedValue(ownerSession as never);

    const response = await GET(new Request("http://localhost/api/exports?type=zip"));

    expect(response.status).toBe(400);
    expect(await readJson(response)).toEqual({ error: "Export type must be json or csv." });
    expect(exportRunsCsv).not.toHaveBeenCalled();
    expect(exportGroupBackup).not.toHaveBeenCalled();
  });

  it("blocks non-owner full JSON backups server-side", async () => {
    jest.mocked(requireSession).mockResolvedValue(memberSession as never);

    const response = await GET(new Request("http://localhost/api/exports"));

    expect(response.status).toBe(403);
    expect(await readJson(response)).toEqual({ error: "Only the group owner can download a full backup." });
    expect(exportGroupBackup).not.toHaveBeenCalled();
  });

  it("lets owners download JSON backups with an attachment filename", async () => {
    jest.mocked(requireSession).mockResolvedValue(ownerSession as never);
    jest.mocked(exportGroupBackup).mockResolvedValue({
      exportedAt: "2026-05-28T12:00:00.000Z",
      version: 1,
      group: ownerSession.group,
      members: [],
      runs: [],
      challengeCompletions: [],
    });

    const response = await GET(new Request("http://localhost/api/exports?type=json"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Disposition")).toMatch(/^attachment; filename="runcomp-123-backup-\d{4}-\d{2}-\d{2}\.json"$/);
    expect(await readJson(response)).toMatchObject({ version: 1, group: { code: "123" } });
    expect(exportGroupBackup).toHaveBeenCalledWith("group-1");
  });

  it("returns structured store errors when JSON backup generation fails", async () => {
    jest.mocked(requireSession).mockResolvedValue(ownerSession as never);
    jest.mocked(exportGroupBackup).mockRejectedValue({ status: 404, message: "Group not found." });

    const response = await GET(new Request("http://localhost/api/exports?type=json"));

    expect(response.status).toBe(404);
    expect(await readJson(response)).toEqual({ error: "Group not found." });
    expect(exportGroupBackup).toHaveBeenCalledWith("group-1");
    expect(exportRunsCsv).not.toHaveBeenCalled();
  });
});
