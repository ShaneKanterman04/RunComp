import { exportHistoryKey, formatExportTimestamp, readExportHistory, recordExportRequest } from "../export-history";

describe("export history", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("stores export request timestamps per normalized group code", () => {
    const history = recordExportRequest(window.localStorage, " 123 ", "json", new Date("2026-05-28T12:34:00.000Z"));

    expect(history).toEqual({ json: "2026-05-28T12:34:00.000Z" });
    expect(readExportHistory(window.localStorage, "123")).toEqual({ json: "2026-05-28T12:34:00.000Z" });
    expect(window.localStorage.getItem(exportHistoryKey("123"))).toBe(JSON.stringify({ json: "2026-05-28T12:34:00.000Z" }));
  });

  it("uses a stable fallback key for blank legacy group codes", () => {
    const history = recordExportRequest(window.localStorage, "  ", "csv", new Date("2026-05-28T12:34:00.000Z"));

    expect(history).toEqual({ csv: "2026-05-28T12:34:00.000Z" });
    expect(exportHistoryKey("  ")).toBe("runcomp:export-history:group");
    expect(readExportHistory(window.localStorage, "")).toEqual({ csv: "2026-05-28T12:34:00.000Z" });
  });

  it("preserves the other export type when recording a new request", () => {
    recordExportRequest(window.localStorage, "123", "json", new Date("2026-05-28T12:34:00.000Z"));
    const history = recordExportRequest(window.localStorage, "123", "csv", new Date("2026-05-28T13:00:00.000Z"));

    expect(history).toEqual({
      json: "2026-05-28T12:34:00.000Z",
      csv: "2026-05-28T13:00:00.000Z",
    });
  });

  it("ignores corrupted or invalid stored history", () => {
    window.localStorage.setItem(exportHistoryKey("123"), "{nope");
    expect(readExportHistory(window.localStorage, "123")).toEqual({});

    window.localStorage.setItem(exportHistoryKey("123"), JSON.stringify({ json: "yesterday", csv: "2026-05-28T13:00:00.000Z", extra: "ignored" }));
    expect(readExportHistory(window.localStorage, "123")).toEqual({ csv: "2026-05-28T13:00:00.000Z" });
  });

  it("does not throw when export history cannot be stored", () => {
    const storage = {
      getItem: jest.fn(() => JSON.stringify({ csv: "2026-05-28T13:00:00.000Z" })),
      setItem: jest.fn(() => {
        throw new Error("storage is full");
      }),
    };

    expect(recordExportRequest(storage, "123", "json", new Date("2026-05-28T14:00:00.000Z"))).toEqual({ csv: "2026-05-28T13:00:00.000Z" });
    expect(storage.setItem).toHaveBeenCalledWith(
      exportHistoryKey("123"),
      JSON.stringify({ csv: "2026-05-28T13:00:00.000Z", json: "2026-05-28T14:00:00.000Z" }),
    );
  });

  it("formats timestamps without locale-dependent output", () => {
    expect(formatExportTimestamp("2026-05-28T12:34:00.000Z")).toMatch(/^2026-05-28 \d{2}:34$/);
    expect(formatExportTimestamp()).toBe("Never");
    expect(formatExportTimestamp("bad")).toBe("Never");
  });
});
