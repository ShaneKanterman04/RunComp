import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

type StoreModule = typeof import("../store");

async function loadStore() {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "runcomp-store-"));
  jest.resetModules();
  process.env.DATA_DIR = dataDir;
  const store = await import("../store");
  return { store, dataDir };
}

describe("file-backed store", () => {
  let dataDir: string | null = null;

  afterEach(async () => {
    if (dataDir) await fs.rm(dataDir, { recursive: true, force: true });
    delete process.env.DATA_DIR;
    jest.resetModules();
    dataDir = null;
  });

  it("creates a group, hashes credentials, and logs in by trail code", async () => {
    const loaded = await loadStore();
    const store: StoreModule = loaded.store;
    dataDir = loaded.dataDir;

    const { group, member } = await store.createGroup({
      groupName: "Shane vs Molly",
      ownerName: "Shane",
      password: "password123",
      goalMiles: 150,
    });
    const login = await store.login({ groupCode: group.code, memberName: " shane ", password: "password123" });
    const passwordOnlyLogin = await store.login({ groupCode: group.code, memberName: "", password: "password123" });
    const raw = JSON.parse(await fs.readFile(path.join(dataDir, "runcomp.json"), "utf8"));

    expect(group.code).toMatch(/^\d{3}$/);
    expect(group.goalMiles).toBe(150);
    expect(login.member.id).toBe(member.id);
    expect(passwordOnlyLogin.member.id).toBe(member.id);
    expect(raw.groups[0].members[0].passwordHash).not.toBe("password123");
    expect(raw.groups[0].members[0]).not.toHaveProperty("password");
  });

  it("returns sanitized public group and member data after login", async () => {
    const loaded = await loadStore();
    const store: StoreModule = loaded.store;
    dataDir = loaded.dataDir;

    const { group } = await store.createGroup({
      groupName: "Shane vs Molly",
      ownerName: "Shane",
      password: "password123",
    });

    const login = await store.login({ groupCode: group.code, memberName: "Shane", password: "password123" });
    const loginText = JSON.stringify(login);

    expect(login).toMatchObject({ group: { code: group.code }, member: { name: "Shane", role: "owner" } });
    expect(loginText).not.toContain("passwordHash");
    expect(loginText).not.toContain("salt");
    expect(loginText).not.toContain("password123");
  });

  it("returns sanitized group context with public member data", async () => {
    const loaded = await loadStore();
    const store: StoreModule = loaded.store;
    dataDir = loaded.dataDir;

    const { group, member: owner } = await store.createGroup({
      groupName: "Shane vs Molly",
      ownerName: "Shane",
      password: "password123",
    });
    const molly = await store.addMember(group.id, owner.id, { name: "Molly", password: "password456" });
    await store.addRun(group.id, molly.id, { miles: 3, date: "2026-05-22" });

    const context = await store.getGroupContext(group.id, owner.id);
    const contextText = JSON.stringify(context);

    expect(context).toMatchObject({
      group: { code: group.code, name: "Shane vs Molly" },
      member: { id: owner.id, name: "Shane", role: "owner", runCount: 0 },
      members: [
        { id: owner.id, name: "Shane", role: "owner", runCount: 0 },
        { id: molly.id, name: "Molly", role: "member", runCount: 1 },
      ],
    });
    expect(contextText).not.toContain("passwordHash");
    expect(contextText).not.toContain("salt");
    expect(contextText).not.toContain("password123");
    expect(contextText).not.toContain("password456");
  });

  it("keeps group codes unique and rejects duplicate member names", async () => {
    const loaded = await loadStore();
    const store: StoreModule = loaded.store;
    dataDir = loaded.dataDir;

    const first = await store.createGroup({ groupName: "Run Group", ownerName: "Shane", password: "password123" });
    const second = await store.createGroup({ groupName: "Run Group", ownerName: "Molly", password: "password456" });
    await store.addMember(first.group.id, first.member.id, { name: "Mom", password: "password789" });

    await expect(store.addMember(first.group.id, first.member.id, { name: " mom ", password: "password000" })).rejects.toMatchObject({
      status: 409,
    });
    expect(first.group.code).toMatch(/^\d{3}$/);
    expect(second.group.code).toMatch(/^\d{3}$/);
    expect(second.group.code).not.toBe(first.group.code);
  });

  it("lets owners edit runner names and reset passwords", async () => {
    const loaded = await loadStore();
    const store: StoreModule = loaded.store;
    dataDir = loaded.dataDir;

    const { group, member: owner } = await store.createGroup({ groupName: "Run Group", ownerName: "Shane", password: "password123" });
    const molly = await store.addMember(group.id, owner.id, { name: "Molly", password: "password456" });

    await expect(store.updateMemberName(group.id, owner.id, molly.id, "Molly K")).resolves.toMatchObject({ name: "Molly K" });
    await expect(store.login({ groupCode: group.code, memberName: "Molly K", password: "password456" })).resolves.toMatchObject({
      member: { id: molly.id },
    });
    await expect(store.resetMemberPassword(group.id, owner.id, molly.id, "newpassword")).resolves.toMatchObject({ id: molly.id });
    await expect(store.login({ groupCode: group.code, memberName: "Molly K", password: "password456" })).rejects.toMatchObject({ status: 401 });
    await expect(store.login({ groupCode: group.code, memberName: "Molly K", password: "newpassword" })).resolves.toMatchObject({
      member: { id: molly.id },
    });
  });

  it("rejects duplicate or missing runner management changes", async () => {
    const loaded = await loadStore();
    const store: StoreModule = loaded.store;
    dataDir = loaded.dataDir;

    const { group, member: owner } = await store.createGroup({ groupName: "Run Group", ownerName: "Shane", password: "password123" });
    const molly = await store.addMember(group.id, owner.id, { name: "Molly", password: "password456" });
    await store.addMember(group.id, owner.id, { name: "Dad", password: "password789" });

    await expect(store.addMember(group.id, molly.id, { name: "Mom", password: "password000" })).rejects.toMatchObject({ status: 403 });
    await expect(store.updateMemberName(group.id, molly.id, molly.id, "Molly K")).rejects.toMatchObject({ status: 403 });
    await expect(store.resetMemberPassword(group.id, molly.id, molly.id, "newpassword")).rejects.toMatchObject({ status: 403 });
    await expect(store.updateMemberName(group.id, owner.id, molly.id, " dad ")).rejects.toMatchObject({ status: 409 });
    await expect(store.updateMemberName(group.id, owner.id, "missing", "New Name")).rejects.toMatchObject({ status: 404 });
    await expect(store.resetMemberPassword(group.id, owner.id, "missing", "newpassword")).rejects.toMatchObject({ status: 404 });
    await expect(store.resetMemberPassword(group.id, owner.id, molly.id, "short")).rejects.toMatchObject({ status: 400 });
    await expect(store.login({ groupCode: group.code, memberName: "Molly", password: "password456" })).resolves.toMatchObject({
      member: { id: molly.id },
    });
  });

  it("removes only inactive non-owner runners", async () => {
    const loaded = await loadStore();
    const store: StoreModule = loaded.store;
    dataDir = loaded.dataDir;

    const { group, member: owner } = await store.createGroup({ groupName: "Run Group", ownerName: "Shane", password: "password123" });
    const active = await store.addMember(group.id, owner.id, { name: "Molly", password: "password456" });
    const inactive = await store.addMember(group.id, owner.id, { name: "Dad", password: "password789" });
    await store.addRun(group.id, active.id, { miles: 3, date: "2026-05-24" });
    await store.savePushSubscription(group.id, inactive.id, {
      endpoint: "https://push.example.test/subscription/inactive",
      keys: { p256dh: "inactive-key", auth: "inactive-auth" },
    });

    await expect(store.removeInactiveMember(group.id, owner.id, owner.id)).rejects.toMatchObject({ status: 400 });
    await expect(store.removeInactiveMember(group.id, active.id, owner.id)).rejects.toMatchObject({ status: 409 });
    await expect(store.removeInactiveMember(group.id, inactive.id, owner.id)).resolves.toBe(true);
    await expect(store.login({ groupCode: group.code, memberName: "Dad", password: "password789" })).rejects.toMatchObject({ status: 401 });
    await expect(store.listPushSubscriptions(group.id)).resolves.toEqual([]);
  });

  it("requires an owner actor when removing inactive runners", async () => {
    const loaded = await loadStore();
    const store: StoreModule = loaded.store;
    dataDir = loaded.dataDir;

    const { group, member: owner } = await store.createGroup({ groupName: "Run Group", ownerName: "Shane", password: "password123" });
    const molly = await store.addMember(group.id, owner.id, { name: "Molly", password: "password456" });
    const dad = await store.addMember(group.id, owner.id, { name: "Dad", password: "password789" });

    await expect(store.removeInactiveMember(group.id, dad.id, molly.id)).rejects.toMatchObject({ status: 403 });
    await expect(store.removeInactiveMember(group.id, dad.id, "missing-owner")).rejects.toMatchObject({ status: 403 });
    await expect(store.login({ groupCode: group.code, memberName: "Dad", password: "password789" })).resolves.toMatchObject({
      member: { id: dad.id },
    });
  });

  it("validates names, passwords, and goal limits before writing", async () => {
    const loaded = await loadStore();
    const store: StoreModule = loaded.store;
    dataDir = loaded.dataDir;

    await expect(store.createGroup({ groupName: " ", ownerName: "Shane", password: "password123" })).rejects.toMatchObject({ status: 400 });
    await expect(store.createGroup({ groupName: "Run Group", ownerName: "Shane", password: "short" })).rejects.toMatchObject({ status: 400 });
    await expect(store.createGroup({ groupName: "Run Group", ownerName: "Shane", password: "        " })).rejects.toMatchObject({ status: 400 });
    await expect(store.createGroup({ groupName: "Run Group", ownerName: "Shane", password: "password123", goalMiles: 0 })).rejects.toMatchObject({ status: 400 });
    await expect(store.createGroup({ groupName: "Run Group", ownerName: "Shane", password: "password123", goalMiles: 10001 })).rejects.toMatchObject({ status: 400 });
  });

  it("rejects password-only login when multiple runners share a password", async () => {
    const loaded = await loadStore();
    const store: StoreModule = loaded.store;
    dataDir = loaded.dataDir;

    const { group, member: owner } = await store.createGroup({ groupName: "Run Group", ownerName: "Shane", password: "sharedpass" });
    await store.addMember(group.id, owner.id, { name: "Molly", password: "sharedpass" });

    await expect(store.login({ groupCode: group.code, memberName: "", password: "sharedpass" })).rejects.toMatchObject({ status: 401 });
    await expect(store.login({ groupCode: group.code, memberName: "Molly", password: "sharedpass" })).resolves.toMatchObject({
      member: { name: "Molly" },
    });
  });

  it("updates a group's race goal", async () => {
    const loaded = await loadStore();
    const store: StoreModule = loaded.store;
    dataDir = loaded.dataDir;

    const { group, member: owner } = await store.createGroup({ groupName: "Run Group", ownerName: "Shane", password: "password123" });
    const molly = await store.addMember(group.id, owner.id, { name: "Molly", password: "password456" });
    const updated = await store.updateGroupGoal(group.id, owner.id, 250);
    const context = await store.getGroupContext(group.id, group.id);

    expect(updated.goalMiles).toBe(250);
    expect((await store.login({ groupCode: group.code, memberName: "Shane", password: "password123" })).group.goalMiles).toBe(250);
    expect(context).toBeNull();
    await expect(store.updateGroupGoal(group.id, molly.id, 300)).rejects.toMatchObject({ status: 403 });
  });

  it("sorts runs and enforces runner delete ownership", async () => {
    const loaded = await loadStore();
    const store: StoreModule = loaded.store;
    dataDir = loaded.dataDir;

    const { group, member: owner } = await store.createGroup({
      groupName: "Family Miles",
      ownerName: "Shane",
      password: "password123",
    });
    const molly = await store.addMember(group.id, owner.id, { name: "Molly", password: "password456" });
    const ownerRun = await store.addRun(group.id, owner.id, { miles: 3.257, durationSeconds: 1561.4, date: "2026-05-21", note: " tempo " });
    const mollyRun = await store.addRun(group.id, molly.id, { miles: 4, date: "2026-05-22", note: "trail" });
    const runs = await store.listRuns(group.id, owner.id);

    expect(ownerRun.miles).toBe(3.26);
    expect(ownerRun.durationSeconds).toBe(1561);
    expect(ownerRun.note).toBe("tempo");
    expect(ownerRun.reactions).toHaveLength(8);
    expect(runs.map((run) => run.id)).toEqual([mollyRun.id, ownerRun.id]);
    await expect(store.deleteRun(group.id, molly.id, ownerRun.id)).rejects.toMatchObject({ status: 403 });
    await expect(store.deleteRun(group.id, "missing", ownerRun.id)).rejects.toMatchObject({ status: 404 });
    await expect(store.deleteRun(group.id, owner.id, mollyRun.id)).resolves.toBe(true);
  });

  it("validates run miles, dates, and durations before writing", async () => {
    const loaded = await loadStore();
    const store: StoreModule = loaded.store;
    dataDir = loaded.dataDir;

    const { group, member } = await store.createGroup({
      groupName: "Family Miles",
      ownerName: "Shane",
      password: "password123",
    });

    await expect(store.addRun(group.id, member.id, { miles: 0, date: "2026-05-22" })).rejects.toMatchObject({ status: 400 });
    await expect(store.addRun(group.id, member.id, { miles: 3, date: "2026-02-31" })).rejects.toMatchObject({ status: 400 });
    await expect(store.addRun(group.id, member.id, { miles: 3, date: "2026-05-22", durationSeconds: 172801 })).rejects.toMatchObject({ status: 400 });
    await expect(store.listRuns(group.id, member.id)).resolves.toEqual([]);
  });

  it("toggles one reaction per member per run", async () => {
    const loaded = await loadStore();
    const store: StoreModule = loaded.store;
    dataDir = loaded.dataDir;

    const { group, member: owner } = await store.createGroup({
      groupName: "Family Miles",
      ownerName: "Shane",
      password: "password123",
    });
    const molly = await store.addMember(group.id, owner.id, { name: "Molly", password: "password456" });
    const run = await store.addRun(group.id, owner.id, { miles: 3, date: "2026-05-22" });

    let reacted = await store.toggleRunReaction(group.id, molly.id, run.id, "fire");
    expect(reacted.reactions.find((reaction) => reaction.type === "fire")).toMatchObject({ count: 1, reactedByMe: true });

    reacted = await store.toggleRunReaction(group.id, molly.id, run.id, "nice");
    expect(reacted.reactions.find((reaction) => reaction.type === "fire")).toMatchObject({ count: 0, reactedByMe: false });
    expect(reacted.reactions.find((reaction) => reaction.type === "nice")).toMatchObject({ count: 1, reactedByMe: true });

    reacted = await store.toggleRunReaction(group.id, molly.id, run.id, "nice");
    expect(reacted.reactions.find((reaction) => reaction.type === "nice")).toMatchObject({ count: 0, reactedByMe: false });
  });

  it("rejects unsupported reactions, missing actors, and missing runs", async () => {
    const loaded = await loadStore();
    const store: StoreModule = loaded.store;
    dataDir = loaded.dataDir;

    const { group, member } = await store.createGroup({
      groupName: "Family Miles",
      ownerName: "Shane",
      password: "password123",
    });
    const run = await store.addRun(group.id, member.id, { miles: 3, date: "2026-05-22" });

    await expect(store.toggleRunReaction(group.id, member.id, "missing", "fire")).rejects.toMatchObject({ status: 404 });
    await expect(store.toggleRunReaction(group.id, "missing", run.id, "fire")).rejects.toMatchObject({ status: 404 });
    await expect(store.toggleRunReaction(group.id, member.id, "missing", "sparkle" as never)).rejects.toMatchObject({ status: 400 });
  });

  it("upserts, lists, removes, and validates push subscriptions", async () => {
    const loaded = await loadStore();
    const store: StoreModule = loaded.store;
    dataDir = loaded.dataDir;

    const { group, member } = await store.createGroup({
      groupName: "Family Miles",
      ownerName: "Shane",
      password: "password123",
    });
    const endpoint = "https://push.example.test/subscription/1";

    await expect(
      store.savePushSubscription(group.id, member.id, { endpoint: "http://bad.example.test", keys: { p256dh: "key", auth: "auth" } }),
    ).rejects.toMatchObject({ status: 400 });
    await store.savePushSubscription(group.id, member.id, { endpoint, keys: { p256dh: "key-one", auth: "auth-one" } });
    await store.savePushSubscription(group.id, member.id, { endpoint, keys: { p256dh: "key-two", auth: "auth-two" } });

    expect(await store.listPushSubscriptions(group.id)).toMatchObject([{ endpoint, keys: { p256dh: "key-two", auth: "auth-two" } }]);
    await expect(store.removePushSubscription(group.id, endpoint, member.id)).resolves.toEqual({ removed: 1 });
    await expect(store.listPushSubscriptions(group.id)).resolves.toHaveLength(0);
  });

  it("rejects push subscription changes for missing groups or members", async () => {
    const loaded = await loadStore();
    const store: StoreModule = loaded.store;
    dataDir = loaded.dataDir;

    const { group } = await store.createGroup({
      groupName: "Family Miles",
      ownerName: "Shane",
      password: "password123",
    });
    const subscription = { endpoint: "https://push.example.test/subscription/1", keys: { p256dh: "key", auth: "auth" } };

    await expect(store.savePushSubscription("missing-group", "member-1", subscription)).rejects.toMatchObject({
      message: "Run group not found.",
      status: 404,
    });
    await expect(store.savePushSubscription(group.id, "missing-member", subscription)).rejects.toMatchObject({
      message: "Member not found.",
      status: 404,
    });
    await expect(store.listPushSubscriptions("missing-group")).rejects.toMatchObject({ status: 404 });
    await expect(store.removePushSubscription(group.id, "not-an-endpoint", "missing-member")).rejects.toMatchObject({ status: 400 });
  });

  it("does not let one member remove another member's push subscription", async () => {
    const loaded = await loadStore();
    const store: StoreModule = loaded.store;
    dataDir = loaded.dataDir;

    const { group, member: owner } = await store.createGroup({
      groupName: "Family Miles",
      ownerName: "Shane",
      password: "password123",
    });
    const molly = await store.addMember(group.id, owner.id, { name: "Molly", password: "password456" });
    const endpoint = "https://push.example.test/subscription/owner";

    await store.savePushSubscription(group.id, owner.id, { endpoint, keys: { p256dh: "key", auth: "auth" } });

    await expect(store.removePushSubscription(group.id, endpoint, molly.id)).resolves.toEqual({ removed: 0 });
    expect(await store.listPushSubscriptions(group.id)).toMatchObject([{ endpoint, memberId: owner.id }]);
  });

  it("claims challenge completions only once", async () => {
    const loaded = await loadStore();
    const store: StoreModule = loaded.store;
    dataDir = loaded.dataDir;

    const { group } = await store.createGroup({
      groupName: "Family Miles",
      ownerName: "Shane",
      password: "password123",
    });

    await expect(store.claimChallengeCompletions(group.id, ["2026-05-18:everyone-logs", "2026-05-18:weekly-mileage"])).resolves.toEqual([
      "2026-05-18:everyone-logs",
      "2026-05-18:weekly-mileage",
    ]);
    await expect(store.claimChallengeCompletions(group.id, ["2026-05-18:everyone-logs", "2026-05-18:beat-last-week"])).resolves.toEqual([
      "2026-05-18:beat-last-week",
    ]);
  });

  it("normalizes challenge completion claims before writing", async () => {
    const loaded = await loadStore();
    const store: StoreModule = loaded.store;
    dataDir = loaded.dataDir;

    const { group } = await store.createGroup({
      groupName: "Family Miles",
      ownerName: "Shane",
      password: "password123",
    });

    await expect(
      store.claimChallengeCompletions(group.id, [" 2026-05-18:weekly-mileage ", "", "2026-05-18:weekly-mileage"]),
    ).resolves.toEqual(["2026-05-18:weekly-mileage"]);
    await expect(store.claimChallengeCompletions(group.id, [" ", ""])).resolves.toEqual([]);
    await expect(store.claimChallengeCompletions("missing-group", ["2026-05-18:weekly-mileage"])).rejects.toMatchObject({
      message: "Run group not found.",
      status: 404,
    });
  });

  it("exports sanitized JSON backups and spreadsheet-friendly runs CSV", async () => {
    const loaded = await loadStore();
    const store: StoreModule = loaded.store;
    dataDir = loaded.dataDir;

    const { group, member: owner } = await store.createGroup({
      groupName: "Family Miles",
      ownerName: "Shane",
      password: "password123",
    });
    await store.addRun(group.id, owner.id, { miles: 3.1, durationSeconds: 1550, date: "2026-05-22", note: 'tempo, "fast"' });

    const backup = await store.exportGroupBackup(group.id);
    const backupText = JSON.stringify(backup);
    const csv = await store.exportRunsCsv(group.id);

    expect(backup).toMatchObject({ version: 1, group: { code: group.code }, members: [{ name: "Shane", runCount: 1 }] });
    expect(backupText).not.toContain("passwordHash");
    expect(backupText).not.toContain("salt");
    expect(csv).toContain("date,runner,miles,duration_seconds,pace_seconds_per_mile,note,created_at");
    expect(csv).toContain('2026-05-22,Shane,3.10,1550,500,"tempo, ""fast"""');
  });

  it("exports a spreadsheet header for groups with no runs", async () => {
    const loaded = await loadStore();
    const store: StoreModule = loaded.store;
    dataDir = loaded.dataDir;

    const { group } = await store.createGroup({
      groupName: "Family Miles",
      ownerName: "Shane",
      password: "password123",
    });

    await expect(store.exportRunsCsv(group.id)).resolves.toBe("date,runner,miles,duration_seconds,pace_seconds_per_mile,note,created_at\n");
  });

  it("keeps backups and CSV exports readable when a run references a missing runner", async () => {
    const loaded = await loadStore();
    const store: StoreModule = loaded.store;
    dataDir = loaded.dataDir;

    const { group, member: owner } = await store.createGroup({
      groupName: "Family Miles",
      ownerName: "Shane",
      password: "password123",
    });
    await store.addRun(group.id, owner.id, { miles: 3.1, durationSeconds: 1550, date: "2026-05-22", note: "tempo" });

    const dataFile = path.join(dataDir, "runcomp.json");
    const raw = JSON.parse(await fs.readFile(dataFile, "utf8"));
    raw.groups[0].members = [];
    await fs.writeFile(dataFile, `${JSON.stringify(raw, null, 2)}\n`, "utf8");

    const backup = await store.exportGroupBackup(group.id);
    const csv = await store.exportRunsCsv(group.id);

    expect(backup.runs).toEqual([expect.objectContaining({ runner: "Unknown", miles: 3.1 })]);
    expect(csv).toContain("2026-05-22,Unknown,3.10,1550,500,tempo");
  });

  it("excludes push subscription secrets from JSON backups", async () => {
    const loaded = await loadStore();
    const store: StoreModule = loaded.store;
    dataDir = loaded.dataDir;

    const { group, member: owner } = await store.createGroup({
      groupName: "Family Miles",
      ownerName: "Shane",
      password: "password123",
    });
    await store.savePushSubscription(group.id, owner.id, {
      endpoint: "https://push.example.test/subscription/private-endpoint",
      keys: { p256dh: "private-p256dh-key", auth: "private-auth-key" },
    });

    const backupText = JSON.stringify(await store.exportGroupBackup(group.id));

    expect(backupText).not.toContain("pushSubscriptions");
    expect(backupText).not.toContain("private-endpoint");
    expect(backupText).not.toContain("private-p256dh-key");
    expect(backupText).not.toContain("private-auth-key");
  });

  it("rejects exports for missing groups", async () => {
    const loaded = await loadStore();
    const store: StoreModule = loaded.store;
    dataDir = loaded.dataDir;

    await expect(store.exportGroupBackup("missing-group")).rejects.toMatchObject({
      message: "Run group not found.",
      status: 404,
    });
    await expect(store.exportRunsCsv("missing-group")).rejects.toMatchObject({
      message: "Run group not found.",
      status: 404,
    });
  });

  it("neutralizes spreadsheet formulas in CSV exports", async () => {
    const loaded = await loadStore();
    const store: StoreModule = loaded.store;
    dataDir = loaded.dataDir;

    const { group, member: owner } = await store.createGroup({
      groupName: "Family Miles",
      ownerName: "@Owner",
      password: "password123",
    });
    await store.addRun(group.id, owner.id, { miles: 3, date: "2026-05-22", note: "=HYPERLINK(\"https://example.test\")" });

    const csv = await store.exportRunsCsv(group.id);

    expect(csv).toContain("2026-05-22,'@Owner,3.00,,,\"'=HYPERLINK(\"\"https://example.test\"\")\"");
  });
});
