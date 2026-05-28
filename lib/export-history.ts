export type ExportType = "json" | "csv";

export type ExportHistory = Partial<Record<ExportType, string>>;

const prefix = "runcomp:export-history:";
const exportTypes: ExportType[] = ["json", "csv"];

export function exportHistoryKey(groupCode: string) {
  return `${prefix}${groupCode.trim().toLowerCase() || "group"}`;
}

export function readExportHistory(storage: Pick<Storage, "getItem">, groupCode: string): ExportHistory {
  try {
    const raw = storage.getItem(exportHistoryKey(groupCode));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<Record<ExportType, unknown>>;
    return exportTypes.reduce<ExportHistory>((history, type) => {
      if (typeof parsed[type] === "string" && isValidIsoDate(parsed[type])) {
        history[type] = parsed[type];
      }
      return history;
    }, {});
  } catch {
    return {};
  }
}

export function recordExportRequest(storage: Pick<Storage, "getItem" | "setItem">, groupCode: string, type: ExportType, now = new Date()) {
  const history = readExportHistory(storage, groupCode);
  const next = { ...history, [type]: now.toISOString() };
  try {
    storage.setItem(exportHistoryKey(groupCode), JSON.stringify(next));
  } catch {
    return history;
  }
  return next;
}

export function formatExportTimestamp(value?: string) {
  if (!value || !isValidIsoDate(value)) return "Never";
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function isValidIsoDate(value: string) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}
