import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

export const RUNNERS = ["Shane", "Molly"] as const;

export type Runner = (typeof RUNNERS)[number];

export type RunEntry = {
  id: string;
  runner: Runner;
  miles: number;
  date: string;
  note: string;
  createdAt: string;
};

export type NewRunEntry = {
  runner: Runner;
  miles: number;
  date: string;
  note?: string;
};

const dataDir = process.env.DATA_DIR || path.join(process.cwd(), ".data");
const dataFile = path.join(dataDir, "runs.json");
let storeQueue = Promise.resolve();

export async function listRuns() {
  const runs = await readRuns();
  return sortRuns(runs);
}

export async function addRun(input: NewRunEntry) {
  return withStoreLock(async () => {
    const runs = await readRuns();
    const run: RunEntry = {
      id: randomUUID(),
      runner: input.runner,
      miles: roundMiles(input.miles),
      date: input.date,
      note: (input.note || "").trim().slice(0, 180),
      createdAt: new Date().toISOString(),
    };
    runs.push(run);
    await writeRuns(runs);
    return run;
  });
}

export async function deleteRun(id: string) {
  return withStoreLock(async () => {
    const runs = await readRuns();
    const next = runs.filter((run) => run.id !== id);
    if (next.length === runs.length) return false;
    await writeRuns(next);
    return true;
  });
}

export function isRunner(value: unknown): value is Runner {
  return typeof value === "string" && RUNNERS.includes(value as Runner);
}

async function withStoreLock<T>(operation: () => Promise<T>) {
  const next = storeQueue.then(operation, operation);
  storeQueue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

async function readRuns(): Promise<RunEntry[]> {
  try {
    const raw = await fs.readFile(dataFile, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRunEntry);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function writeRuns(runs: RunEntry[]) {
  await fs.mkdir(dataDir, { recursive: true });
  const tempFile = `${dataFile}.${process.pid}.tmp`;
  await fs.writeFile(tempFile, `${JSON.stringify(sortRuns(runs), null, 2)}\n`, "utf8");
  await fs.rename(tempFile, dataFile);
}

function sortRuns(runs: RunEntry[]) {
  return [...runs].sort((a, b) => {
    const byDate = b.date.localeCompare(a.date);
    if (byDate !== 0) return byDate;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

function roundMiles(value: number) {
  return Math.round(value * 100) / 100;
}

function isRunEntry(value: unknown): value is RunEntry {
  if (!value || typeof value !== "object") return false;
  const run = value as Partial<RunEntry>;
  return (
    typeof run.id === "string" &&
    isRunner(run.runner) &&
    typeof run.miles === "number" &&
    Number.isFinite(run.miles) &&
    typeof run.date === "string" &&
    typeof run.note === "string" &&
    typeof run.createdAt === "string"
  );
}
