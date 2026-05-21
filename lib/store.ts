import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

export type MemberRole = "owner" | "member";

export type Member = {
  id: string;
  name: string;
  nameKey: string;
  role: MemberRole;
  salt: string;
  passwordHash: string;
  createdAt: string;
};

export type PublicMember = {
  id: string;
  name: string;
  role: MemberRole;
  createdAt: string;
};

export type RunEntry = {
  id: string;
  memberId: string;
  miles: number;
  date: string;
  note: string;
  createdAt: string;
};

export type PublicRunEntry = RunEntry & {
  runner: string;
};

export type Group = {
  id: string;
  name: string;
  code: string;
  createdAt: string;
  members: Member[];
  runs: RunEntry[];
};

export type PublicGroup = {
  id: string;
  name: string;
  code: string;
  createdAt: string;
};

type Store = {
  version: 1;
  groups: Group[];
};

const dataDir = process.env.DATA_DIR || path.join(process.cwd(), ".data");
const dataFile = path.join(dataDir, "runcomp.json");
let storeQueue = Promise.resolve();

export async function createGroup(input: { groupName: string; ownerName: string; password: string }) {
  const groupName = cleanName(input.groupName, 64);
  const ownerName = cleanName(input.ownerName, 48);
  validatePassword(input.password);

  return withStoreLock(async () => {
    const store = await readStore();
    const code = uniqueGroupCode(store, groupName);
    const owner = await createMemberRecord({ name: ownerName, password: input.password, role: "owner" });
    const group: Group = {
      id: randomUUID(),
      name: groupName,
      code,
      createdAt: new Date().toISOString(),
      members: [owner],
      runs: [],
    };
    store.groups.push(group);
    await writeStore(store);
    return { group: publicGroup(group), member: publicMember(owner) };
  });
}

export async function addMember(groupId: string, input: { name: string; password: string }) {
  const name = cleanName(input.name, 48);
  validatePassword(input.password);

  return withStoreLock(async () => {
    const store = await readStore();
    const group = findGroup(store, groupId);
    if (!group) throw new StoreError("Run group not found.", 404);
    const nameKey = normalizeName(name);
    if (group.members.some((member) => member.nameKey === nameKey)) {
      throw new StoreError("That person already has a password in this group.", 409);
    }

    const member = await createMemberRecord({ name, password: input.password, role: "member" });
    group.members.push(member);
    await writeStore(store);
    return publicMember(member);
  });
}

export async function login(input: { groupCode: string; memberName: string; password: string }) {
  const groupCode = normalizeCode(input.groupCode);
  const memberName = normalizeName(input.memberName);
  if (!groupCode || !memberName || !input.password) {
    throw new StoreError("Enter your group, name, and password.", 400);
  }

  const store = await readStore();
  const group = store.groups.find((row) => row.code === groupCode || normalizeName(row.name) === groupCode);
  if (!group) throw new StoreError("Run group not found.", 401);
  const member = group.members.find((row) => row.nameKey === memberName);
  if (!member) throw new StoreError("Name or password is incorrect.", 401);
  const valid = await verifyPassword(input.password, member);
  if (!valid) throw new StoreError("Name or password is incorrect.", 401);
  return { group: publicGroup(group), member: publicMember(member) };
}

export async function getGroupContext(groupId: string, memberId: string) {
  const store = await readStore();
  const group = findGroup(store, groupId);
  const member = group?.members.find((row) => row.id === memberId);
  if (!group || !member) return null;
  return {
    group: publicGroup(group),
    member: publicMember(member),
    members: group.members.map(publicMember),
  };
}

export async function listRuns(groupId: string) {
  const store = await readStore();
  const group = findGroup(store, groupId);
  if (!group) throw new StoreError("Run group not found.", 404);
  return sortRuns(group.runs).map((run) => publicRun(group, run));
}

export async function addRun(groupId: string, memberId: string, input: { miles: number; date: string; note?: string }) {
  return withStoreLock(async () => {
    const store = await readStore();
    const group = findGroup(store, groupId);
    if (!group) throw new StoreError("Run group not found.", 404);
    if (!group.members.some((member) => member.id === memberId)) throw new StoreError("Member not found.", 404);

    const run: RunEntry = {
      id: randomUUID(),
      memberId,
      miles: roundMiles(input.miles),
      date: input.date,
      note: (input.note || "").trim().slice(0, 180),
      createdAt: new Date().toISOString(),
    };
    group.runs.push(run);
    await writeStore(store);
    return publicRun(group, run);
  });
}

export async function deleteRun(groupId: string, memberId: string, memberRole: MemberRole, runId: string) {
  return withStoreLock(async () => {
    const store = await readStore();
    const group = findGroup(store, groupId);
    if (!group) throw new StoreError("Run group not found.", 404);
    const run = group.runs.find((row) => row.id === runId);
    if (!run) return false;
    if (memberRole !== "owner" && run.memberId !== memberId) {
      throw new StoreError("Only the runner or group owner can delete this run.", 403);
    }

    group.runs = group.runs.filter((row) => row.id !== runId);
    await writeStore(store);
    return true;
  });
}

export function publicGroup(group: Group): PublicGroup {
  return {
    id: group.id,
    name: group.name,
    code: group.code,
    createdAt: group.createdAt,
  };
}

export function publicMember(member: Member): PublicMember {
  return {
    id: member.id,
    name: member.name,
    role: member.role,
    createdAt: member.createdAt,
  };
}

export function storeErrorResponse(error: unknown) {
  if (error instanceof StoreError) {
    return { message: error.message, status: error.status };
  }
  return { message: "RunComp could not complete that request.", status: 500 };
}

export class StoreError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function createMemberRecord(input: { name: string; password: string; role: MemberRole }): Promise<Member> {
  const salt = randomBytes(16).toString("hex");
  const passwordHash = await hashPassword(input.password, salt);
  return {
    id: randomUUID(),
    name: input.name,
    nameKey: normalizeName(input.name),
    role: input.role,
    salt,
    passwordHash,
    createdAt: new Date().toISOString(),
  };
}

async function verifyPassword(password: string, member: Member) {
  const candidate = Buffer.from(await hashPassword(password, member.salt), "hex");
  const expected = Buffer.from(member.passwordHash, "hex");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

async function hashPassword(password: string, salt: string) {
  const hash = (await scrypt(password, salt, 64)) as Buffer;
  return hash.toString("hex");
}

function validatePassword(password: string) {
  if (password.length < 8) throw new StoreError("Passwords need at least 8 characters.", 400);
}

function cleanName(value: string, maxLength: number) {
  const cleaned = value.trim().replace(/\s+/g, " ").slice(0, maxLength);
  if (!cleaned) throw new StoreError("Name is required.", 400);
  return cleaned;
}

function normalizeName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeCode(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9- ]/g, "").replace(/\s+/g, "-");
}

function uniqueGroupCode(store: Store, groupName: string) {
  const base = normalizeCode(groupName).replace(/^-+|-+$/g, "") || "run-group";
  let code = base;
  let suffix = 2;
  while (store.groups.some((group) => group.code === code)) {
    code = `${base}-${suffix}`;
    suffix += 1;
  }
  return code;
}

async function withStoreLock<T>(operation: () => Promise<T>) {
  const next = storeQueue.then(operation, operation);
  storeQueue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

async function readStore(): Promise<Store> {
  try {
    const raw = await fs.readFile(dataFile, "utf8");
    const parsed = JSON.parse(raw);
    if (!isStore(parsed)) return { version: 1, groups: [] };
    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { version: 1, groups: [] };
    throw error;
  }
}

async function writeStore(store: Store) {
  await fs.mkdir(dataDir, { recursive: true });
  const tempFile = `${dataFile}.${process.pid}.tmp`;
  await fs.writeFile(tempFile, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  await fs.rename(tempFile, dataFile);
}

function findGroup(store: Store, groupId: string) {
  return store.groups.find((group) => group.id === groupId);
}

function sortRuns(runs: RunEntry[]) {
  return [...runs].sort((a, b) => {
    const byDate = b.date.localeCompare(a.date);
    if (byDate !== 0) return byDate;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

function publicRun(group: Group, run: RunEntry): PublicRunEntry {
  return {
    ...run,
    runner: group.members.find((member) => member.id === run.memberId)?.name || "Unknown",
  };
}

function roundMiles(value: number) {
  return Math.round(value * 100) / 100;
}

function isStore(value: unknown): value is Store {
  if (!value || typeof value !== "object") return false;
  const store = value as Partial<Store>;
  return store.version === 1 && Array.isArray(store.groups) && store.groups.every(isGroup);
}

function isGroup(value: unknown): value is Group {
  if (!value || typeof value !== "object") return false;
  const group = value as Partial<Group>;
  return (
    typeof group.id === "string" &&
    typeof group.name === "string" &&
    typeof group.code === "string" &&
    typeof group.createdAt === "string" &&
    Array.isArray(group.members) &&
    group.members.every(isMember) &&
    Array.isArray(group.runs) &&
    group.runs.every(isRunEntry)
  );
}

function isMember(value: unknown): value is Member {
  if (!value || typeof value !== "object") return false;
  const member = value as Partial<Member>;
  return (
    typeof member.id === "string" &&
    typeof member.name === "string" &&
    typeof member.nameKey === "string" &&
    (member.role === "owner" || member.role === "member") &&
    typeof member.salt === "string" &&
    typeof member.passwordHash === "string" &&
    typeof member.createdAt === "string"
  );
}

function isRunEntry(value: unknown): value is RunEntry {
  if (!value || typeof value !== "object") return false;
  const run = value as Partial<RunEntry>;
  return (
    typeof run.id === "string" &&
    typeof run.memberId === "string" &&
    typeof run.miles === "number" &&
    Number.isFinite(run.miles) &&
    typeof run.date === "string" &&
    typeof run.note === "string" &&
    typeof run.createdAt === "string"
  );
}
