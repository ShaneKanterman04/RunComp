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
  runCount?: number;
};

export type RunEntry = {
  id: string;
  memberId: string;
  miles: number;
  durationSeconds?: number;
  date: string;
  note: string;
  reactions?: Record<string, ReactionType>;
  createdAt: string;
};

export type PublicRunEntry = Omit<RunEntry, "reactions"> & {
  runner: string;
  reactions: PublicReaction[];
};

export type ReactionType = "fire" | "nice" | "brutal" | "sus" | "respect" | "catching" | "monster" | "suspicious";

export type PublicReaction = {
  type: ReactionType;
  count: number;
  reactedByMe: boolean;
};

export type PushSubscriptionRecord = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  memberId: string;
  createdAt: string;
  updatedAt: string;
};

export type ChallengeCompletionRecord = {
  id: string;
  completedAt: string;
};

export type Group = {
  id: string;
  name: string;
  code: string;
  goalMiles?: number;
  createdAt: string;
  members: Member[];
  runs: RunEntry[];
  pushSubscriptions?: PushSubscriptionRecord[];
  challengeCompletions?: ChallengeCompletionRecord[];
};

export type PublicGroup = {
  id: string;
  name: string;
  code: string;
  goalMiles: number;
  createdAt: string;
};

type Store = {
  version: 1;
  groups: Group[];
};

const dataDir = process.env.DATA_DIR || path.join(process.cwd(), ".data");
const dataFile = path.join(dataDir, "runcomp.json");
let storeQueue = Promise.resolve();

export async function createGroup(input: { groupName: string; ownerName: string; password: string; goalMiles?: number }) {
  const groupName = cleanName(input.groupName, 64);
  const ownerName = cleanName(input.ownerName, 48);
  validatePassword(input.password);
  const goalMiles = cleanGoalMiles(input.goalMiles);

  return withStoreLock(async () => {
    const store = await readStore();
    const code = uniqueTrailCode(store);
    const owner = await createMemberRecord({ name: ownerName, password: input.password, role: "owner" });
    const group: Group = {
      id: randomUUID(),
      name: groupName,
      code,
      goalMiles,
      createdAt: new Date().toISOString(),
      members: [owner],
      runs: [],
    };
    store.groups.push(group);
    await writeStore(store);
    return { group: publicGroup(group), member: publicMember(owner) };
  });
}

export async function addMember(groupId: string, ownerMemberId: string, input: { name: string; password: string }) {
  const name = cleanName(input.name, 48);
  validatePassword(input.password);

  return withStoreLock(async () => {
    const store = await readStore();
    const group = findGroup(store, groupId);
    if (!group) throw new StoreError("Run group not found.", 404);
    requireGroupOwner(group, ownerMemberId);
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

export async function updateMemberName(groupId: string, ownerMemberId: string, memberId: string, name: string) {
  const nextName = cleanName(name, 48);

  return withStoreLock(async () => {
    const store = await readStore();
    const group = findGroup(store, groupId);
    if (!group) throw new StoreError("Run group not found.", 404);
    requireGroupOwner(group, ownerMemberId);
    const member = group.members.find((row) => row.id === memberId);
    if (!member) throw new StoreError("Runner not found.", 404);
    const nameKey = normalizeName(nextName);
    if (group.members.some((row) => row.id !== memberId && row.nameKey === nameKey)) {
      throw new StoreError("That runner name is already used in this group.", 409);
    }
    member.name = nextName;
    member.nameKey = nameKey;
    await writeStore(store);
    return publicMember(member, group);
  });
}

export async function resetMemberPassword(groupId: string, ownerMemberId: string, memberId: string, password: string) {
  validatePassword(password);

  return withStoreLock(async () => {
    const store = await readStore();
    const group = findGroup(store, groupId);
    if (!group) throw new StoreError("Run group not found.", 404);
    requireGroupOwner(group, ownerMemberId);
    const member = group.members.find((row) => row.id === memberId);
    if (!member) throw new StoreError("Runner not found.", 404);
    const updated = await createMemberRecord({ name: member.name, password, role: member.role });
    member.salt = updated.salt;
    member.passwordHash = updated.passwordHash;
    await writeStore(store);
    return publicMember(member, group);
  });
}

export async function removeInactiveMember(groupId: string, memberId: string, ownerMemberId: string) {
  return withStoreLock(async () => {
    const store = await readStore();
    const group = findGroup(store, groupId);
    if (!group) throw new StoreError("Run group not found.", 404);
    const owner = group.members.find((row) => row.id === ownerMemberId);
    if (!owner || owner.role !== "owner") throw new StoreError("Only the group owner can remove runners.", 403);
    const member = group.members.find((row) => row.id === memberId);
    if (!member) return false;
    if (member.id === ownerMemberId) throw new StoreError("You cannot remove yourself.", 400);
    if (member.role === "owner") throw new StoreError("The group owner cannot be removed.", 400);
    if (group.runs.some((run) => run.memberId === memberId)) {
      throw new StoreError("Only inactive runners with no logged runs can be removed.", 409);
    }
    group.members = group.members.filter((row) => row.id !== memberId);
    group.pushSubscriptions = (group.pushSubscriptions || []).filter((subscription) => subscription.memberId !== memberId);
    for (const run of group.runs) {
      if (run.reactions) delete run.reactions[memberId];
    }
    await writeStore(store);
    return true;
  });
}

export async function updateGroupGoal(groupId: string, goalMiles: number) {
  const nextGoal = cleanGoalMiles(goalMiles);

  return withStoreLock(async () => {
    const store = await readStore();
    const group = findGroup(store, groupId);
    if (!group) throw new StoreError("Run group not found.", 404);
    group.goalMiles = nextGoal;
    await writeStore(store);
    return publicGroup(group);
  });
}

export async function login(input: { groupCode: string; memberName: string; password: string }) {
  const groupCode = normalizeCode(input.groupCode);
  const memberName = normalizeName(input.memberName);
  if (!groupCode || !input.password) {
    throw new StoreError("Enter your trail code and password.", 400);
  }

  const store = await readStore();
  const group = store.groups.find((row) => row.code === groupCode || normalizeName(row.name) === groupCode);
  if (!group) throw new StoreError("Run group not found.", 401);

  if (memberName) {
    const member = group.members.find((row) => row.nameKey === memberName);
    if (!member) throw new StoreError("Name or password is incorrect.", 401);
    const valid = await verifyPassword(input.password, member);
    if (!valid) throw new StoreError("Name or password is incorrect.", 401);
    return { group: publicGroup(group), member: publicMember(member) };
  }

  const matches = [];
  for (const member of group.members) {
    if (await verifyPassword(input.password, member)) matches.push(member);
  }
  if (matches.length !== 1) throw new StoreError("Password is incorrect or shared by more than one runner.", 401);
  const [member] = matches;
  return { group: publicGroup(group), member: publicMember(member) };
}

export async function getGroupContext(groupId: string, memberId: string) {
  const store = await readStore();
  const group = findGroup(store, groupId);
  const member = group?.members.find((row) => row.id === memberId);
  if (!group || !member) return null;
  return {
    group: publicGroup(group),
    member: publicMember(member, group),
    members: group.members.map((row) => publicMember(row, group)),
  };
}

export async function listRuns(groupId: string, viewerMemberId?: string) {
  const store = await readStore();
  const group = findGroup(store, groupId);
  if (!group) throw new StoreError("Run group not found.", 404);
  return sortRuns(group.runs).map((run) => publicRun(group, run, viewerMemberId));
}

export async function addRun(groupId: string, memberId: string, input: { miles: number; date: string; note?: string; durationSeconds?: number }) {
  const miles = cleanRunMiles(input.miles);
  const date = cleanRunDate(input.date);
  const durationSeconds = input.durationSeconds === undefined ? undefined : roundDurationSeconds(input.durationSeconds);
  if (durationSeconds !== undefined && (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > 172800)) {
    throw new StoreError("Run time must be between 1 second and 48 hours.", 400);
  }

  return withStoreLock(async () => {
    const store = await readStore();
    const group = findGroup(store, groupId);
    if (!group) throw new StoreError("Run group not found.", 404);
    if (!group.members.some((member) => member.id === memberId)) throw new StoreError("Member not found.", 404);

    const run: RunEntry = {
      id: randomUUID(),
      memberId,
      miles,
      ...(durationSeconds ? { durationSeconds } : {}),
      date,
      note: (input.note || "").trim().slice(0, 180),
      createdAt: new Date().toISOString(),
    };
    group.runs.push(run);
    await writeStore(store);
    return publicRun(group, run, memberId);
  });
}

export async function toggleRunReaction(groupId: string, memberId: string, runId: string, type: ReactionType) {
  validateReactionType(type);

  return withStoreLock(async () => {
    const store = await readStore();
    const group = findGroup(store, groupId);
    if (!group) throw new StoreError("Run group not found.", 404);
    const run = group.runs.find((row) => row.id === runId);
    if (!run) throw new StoreError("Run not found.", 404);
    run.reactions ||= {};
    if (run.reactions[memberId] === type) {
      delete run.reactions[memberId];
    } else {
      run.reactions[memberId] = type;
    }
    await writeStore(store);
    return publicRun(group, run, memberId);
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

export async function savePushSubscription(groupId: string, memberId: string, input: { endpoint: string; keys: { p256dh: string; auth: string } }) {
  const endpoint = cleanEndpoint(input.endpoint);
  const p256dh = cleanPushKey(input.keys?.p256dh);
  const auth = cleanPushKey(input.keys?.auth);

  return withStoreLock(async () => {
    const store = await readStore();
    const group = findGroup(store, groupId);
    if (!group) throw new StoreError("Run group not found.", 404);
    if (!group.members.some((member) => member.id === memberId)) throw new StoreError("Member not found.", 404);
    const now = new Date().toISOString();
    group.pushSubscriptions ||= [];
    const existing = group.pushSubscriptions.find((subscription) => subscription.endpoint === endpoint);
    if (existing) {
      existing.memberId = memberId;
      existing.keys = { p256dh, auth };
      existing.updatedAt = now;
    } else {
      group.pushSubscriptions.push({
        endpoint,
        keys: { p256dh, auth },
        memberId,
        createdAt: now,
        updatedAt: now,
      });
    }
    await writeStore(store);
    return { ok: true };
  });
}

export async function listPushSubscriptions(groupId: string) {
  const store = await readStore();
  const group = findGroup(store, groupId);
  if (!group) throw new StoreError("Run group not found.", 404);
  return [...(group.pushSubscriptions || [])];
}

export async function removePushSubscription(groupId: string, endpoint: string, memberId: string) {
  const clean = cleanEndpoint(endpoint);

  return withStoreLock(async () => {
    const store = await readStore();
    const group = findGroup(store, groupId);
    if (!group) throw new StoreError("Run group not found.", 404);
    const before = group.pushSubscriptions?.length || 0;
    group.pushSubscriptions = (group.pushSubscriptions || []).filter((subscription) => subscription.endpoint !== clean || subscription.memberId !== memberId);
    await writeStore(store);
    return { removed: before - group.pushSubscriptions.length };
  });
}

export async function claimChallengeCompletions(groupId: string, challengeIds: string[]) {
  const ids = [...new Set(challengeIds.map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) return [];

  return withStoreLock(async () => {
    const store = await readStore();
    const group = findGroup(store, groupId);
    if (!group) throw new StoreError("Run group not found.", 404);
    group.challengeCompletions ||= [];
    const claimed = new Set(group.challengeCompletions.map((entry) => entry.id));
    const now = new Date().toISOString();
    const fresh = ids.filter((id) => !claimed.has(id));
    for (const id of fresh) {
      group.challengeCompletions.push({ id, completedAt: now });
    }
    if (fresh.length > 0) await writeStore(store);
    return fresh;
  });
}

export async function exportGroupBackup(groupId: string) {
  const store = await readStore();
  const group = findGroup(store, groupId);
  if (!group) throw new StoreError("Run group not found.", 404);
  return {
    exportedAt: new Date().toISOString(),
    version: 1,
    group: publicGroup(group),
    members: group.members.map((member) => publicMember(member, group)),
    runs: sortRuns(group.runs).map((run) => publicRun(group, run)),
    challengeCompletions: [...(group.challengeCompletions || [])],
  };
}

export async function exportRunsCsv(groupId: string) {
  const store = await readStore();
  const group = findGroup(store, groupId);
  if (!group) throw new StoreError("Run group not found.", 404);
  const rows = [
    ["date", "runner", "miles", "duration_seconds", "pace_seconds_per_mile", "note", "created_at"],
    ...sortRuns(group.runs).map((run) => [
      run.date,
      group.members.find((member) => member.id === run.memberId)?.name || "Unknown",
      run.miles.toFixed(2),
      run.durationSeconds ? String(run.durationSeconds) : "",
      run.durationSeconds ? String(Math.round(run.durationSeconds / run.miles)) : "",
      run.note,
      run.createdAt,
    ]),
  ];
  return `${rows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}

export function publicGroup(group: Group): PublicGroup {
  return {
    id: group.id,
    name: group.name,
    code: group.code,
    goalMiles: group.goalMiles || 100,
    createdAt: group.createdAt,
  };
}

export function publicMember(member: Member, group?: Group): PublicMember {
  return {
    id: member.id,
    name: member.name,
    role: member.role,
    createdAt: member.createdAt,
    ...(group ? { runCount: group.runs.filter((run) => run.memberId === member.id).length } : {}),
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

function cleanEndpoint(value: string) {
  const endpoint = String(value || "").trim();
  if (!endpoint || endpoint.length > 2048 || !/^https:\/\//.test(endpoint)) {
    throw new StoreError("Push subscription endpoint is invalid.", 400);
  }
  return endpoint;
}

function cleanPushKey(value: string) {
  const key = String(value || "").trim();
  if (!key || key.length > 512) {
    throw new StoreError("Push subscription key is invalid.", 400);
  }
  return key;
}

function cleanGoalMiles(value: number | undefined) {
  const goal = Number(value ?? 100);
  if (!Number.isFinite(goal) || goal < 1 || goal > 10000) {
    throw new StoreError("Goal miles must be between 1 and 10000.", 400);
  }
  return Math.round(goal * 100) / 100;
}

function cleanRunMiles(value: number) {
  const miles = Number(value);
  if (!Number.isFinite(miles) || miles <= 0 || miles > 100) {
    throw new StoreError("Miles must be between 0 and 100.", 400);
  }
  return roundMiles(miles);
}

function cleanRunDate(value: string) {
  const date = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new StoreError("Date must be a valid YYYY-MM-DD value.", 400);
  }
  const timestamp = Date.parse(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== date) {
    throw new StoreError("Date must be a valid YYYY-MM-DD value.", 400);
  }
  return date;
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

function uniqueTrailCode(store: Store) {
  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const code = String(Math.floor(Math.random() * 1000)).padStart(3, "0");
    if (!store.groups.some((group) => group.code === code)) return code;
  }
  throw new StoreError("No trail codes are available. Try again.", 409);
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

function requireGroupOwner(group: Group, ownerMemberId: string) {
  const owner = group.members.find((row) => row.id === ownerMemberId);
  if (!owner || owner.role !== "owner") throw new StoreError("Only the group owner can manage runners.", 403);
}

function sortRuns(runs: RunEntry[]) {
  return [...runs].sort((a, b) => {
    const byDate = b.date.localeCompare(a.date);
    if (byDate !== 0) return byDate;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

function publicRun(group: Group, run: RunEntry, viewerMemberId?: string): PublicRunEntry {
  return {
    ...run,
    reactions: publicReactions(run, viewerMemberId),
    runner: group.members.find((member) => member.id === run.memberId)?.name || "Unknown",
  };
}

function csvCell(value: string) {
  const safeValue = /^[\s]*[=+\-@]/.test(value) ? `'${value}` : value;
  if (!/[",\n\r]/.test(safeValue)) return safeValue;
  return `"${safeValue.replace(/"/g, '""')}"`;
}

function roundMiles(value: number) {
  return Math.round(value * 100) / 100;
}

function roundDurationSeconds(value: number) {
  return Math.round(value);
}

function publicReactions(run: RunEntry, viewerMemberId?: string): PublicReaction[] {
  const reactions = run.reactions || {};
  return reactionTypes.map((type) => ({
    type,
    count: Object.values(reactions).filter((reaction) => reaction === type).length,
    reactedByMe: viewerMemberId ? reactions[viewerMemberId] === type : false,
  }));
}

const reactionTypes = ["fire", "nice", "brutal", "sus", "respect", "catching", "monster", "suspicious"] as const;

function validateReactionType(value: string): asserts value is ReactionType {
  if (!reactionTypes.includes(value as ReactionType)) {
    throw new StoreError("Reaction is not supported.", 400);
  }
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
    (typeof group.goalMiles === "undefined" || (typeof group.goalMiles === "number" && Number.isFinite(group.goalMiles))) &&
    typeof group.createdAt === "string" &&
    Array.isArray(group.members) &&
    group.members.every(isMember) &&
    Array.isArray(group.runs) &&
    group.runs.every(isRunEntry) &&
    (typeof group.pushSubscriptions === "undefined" || (Array.isArray(group.pushSubscriptions) && group.pushSubscriptions.every(isPushSubscription))) &&
    (typeof group.challengeCompletions === "undefined" || (Array.isArray(group.challengeCompletions) && group.challengeCompletions.every(isChallengeCompletion)))
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
    (typeof run.durationSeconds === "undefined" || (typeof run.durationSeconds === "number" && Number.isFinite(run.durationSeconds) && run.durationSeconds > 0)) &&
    typeof run.date === "string" &&
    typeof run.note === "string" &&
    (typeof run.reactions === "undefined" ||
      (typeof run.reactions === "object" &&
        run.reactions !== null &&
        Object.entries(run.reactions).every(([memberId, reaction]) => typeof memberId === "string" && reactionTypes.includes(reaction as ReactionType)))) &&
    typeof run.createdAt === "string"
  );
}

function isPushSubscription(value: unknown): value is PushSubscriptionRecord {
  if (!value || typeof value !== "object") return false;
  const subscription = value as Partial<PushSubscriptionRecord>;
  return (
    typeof subscription.endpoint === "string" &&
    typeof subscription.memberId === "string" &&
    typeof subscription.createdAt === "string" &&
    typeof subscription.updatedAt === "string" &&
    typeof subscription.keys === "object" &&
    subscription.keys !== null &&
    typeof subscription.keys.p256dh === "string" &&
    typeof subscription.keys.auth === "string"
  );
}

function isChallengeCompletion(value: unknown): value is ChallengeCompletionRecord {
  if (!value || typeof value !== "object") return false;
  const completion = value as Partial<ChallengeCompletionRecord>;
  return typeof completion.id === "string" && typeof completion.completedAt === "string";
}
