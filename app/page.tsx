"use client";

import type { CSSProperties, FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";

type MemberRole = "owner" | "member";

type Member = {
  id: string;
  name: string;
  role: MemberRole;
  createdAt: string;
};

type Group = {
  id: string;
  name: string;
  code: string;
  createdAt: string;
};

type SessionData = {
  authenticated: true;
  group: Group;
  member: Member;
  members: Member[];
};

type RunEntry = {
  id: string;
  memberId: string;
  runner: string;
  miles: number;
  date: string;
  note: string;
  createdAt: string;
};

type RunnerStats = {
  total: number;
  week: number;
  month: number;
  runCount: number;
  average: number;
  longest: number;
  streak: number;
  lastRun?: string;
};

type AuthPayload = SessionData | { authenticated: false; error?: string };

const palette = ["#18845d", "#d94f76", "#3f6fb5", "#b27920", "#6f5bb5", "#1f8793", "#a94632", "#587443"];

export default function Home() {
  const [session, setSession] = useState<SessionData | null>(null);
  const [runs, setRuns] = useState<RunEntry[]>([]);
  const [form, setForm] = useState({ miles: "", date: todayInput(), note: "" });
  const [memberForm, setMemberForm] = useState({ name: "", password: "" });
  const [inviteUrl, setInviteUrl] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [saving, setSaving] = useState(false);
  const [memberSaving, setMemberSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    bootstrap();
  }, []);

  useEffect(() => {
    if (!session) {
      setInviteUrl("");
      return;
    }
    setInviteUrl(buildInviteUrl(session.group.code));
  }, [session]);

  const members = session?.members || [];
  const stats = useMemo(() => buildStats(runs, members), [runs, members]);
  const chartDays = useMemo(() => buildChartDays(runs, members), [runs, members]);
  const standings = useMemo(
    () => [...members].sort((a, b) => (stats[b.id]?.total || 0) - (stats[a.id]?.total || 0)),
    [members, stats],
  );
  const leader = standings[0] || null;
  const second = standings[1] || null;
  const gap = leader && second ? Math.abs((stats[leader.id]?.total || 0) - (stats[second.id]?.total || 0)) : 0;
  const maxTotal = Math.max(1, ...members.map((member) => stats[member.id]?.total || 0));

  async function bootstrap() {
    setCheckingSession(true);
    setMessage("");
    try {
      const response = await fetch("/api/session", { cache: "no-store" });
      const data = (await response.json()) as AuthPayload;
      if (response.ok && data.authenticated) {
        setSession(data);
        await loadRuns();
      } else {
        setSession(null);
        setRuns([]);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not reach RunComp.");
      setSession(null);
    } finally {
      setCheckingSession(false);
    }
  }

  async function acceptSession(data: SessionData) {
    setSession(data);
    await loadRuns();
  }

  async function loadRuns() {
    setLoadingRuns(true);
    setMessage("");
    try {
      const response = await fetch("/api/runs", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load runs.");
      setRuns(data.runs);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load runs.");
    } finally {
      setLoadingRuns(false);
    }
  }

  async function submitRun(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !session) return;
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          miles: Number(form.miles),
          date: form.date,
          note: form.note,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save run.");
      setRuns((current) => [data.run, ...current]);
      setForm((current) => ({ ...current, miles: "", note: "" }));
      setMessage(`${session.member.name} logged ${formatMiles(data.run.miles)}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save run.");
    } finally {
      setSaving(false);
    }
  }

  async function createMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (memberSaving || !session || session.member.role !== "owner") return;
    setMemberSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(memberForm),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not create member.");
      setSession((current) => (current ? { ...current, members: [...current.members, data.member] } : current));
      setMemberForm({ name: "", password: "" });
      setMessage(`${data.member.name} can now join ${session.group.name}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create member.");
    } finally {
      setMemberSaving(false);
    }
  }

  async function deleteRun(id: string) {
    setMessage("");
    const response = await fetch(`/api/runs?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error || "Could not delete run.");
      return;
    }
    setRuns((current) => current.filter((run) => run.id !== id));
  }

  async function logout() {
    await fetch("/api/session", { method: "DELETE" }).catch(() => undefined);
    setSession(null);
    setRuns([]);
    setMessage("");
  }

  async function copyInviteLink() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setMessage("Invite link copied. It fills the group code only.");
    } catch {
      setMessage(`Invite link: ${inviteUrl}`);
    }
  }

  if (checkingSession) {
    return (
      <main className="app authApp">
        <section className="panel authPanel">
          <Brand />
          <p className="empty">Checking your run group...</p>
        </section>
      </main>
    );
  }

  if (!session) {
    return <AuthScreen onAuthenticated={acceptSession} message={message} />;
  }

  return (
    <main className="app">
      <header className="topbar">
        <Brand eyebrow={session.group.name} />
        <div className="headToHead" aria-label="Current standings">
          {standings.map((member, index) => (
            <span key={member.id}>
              {index + 1}. {member.name} {formatMiles(stats[member.id]?.total || 0)}
            </span>
          ))}
        </div>
      </header>

      <section className="scoreGrid">
        <section className="panel showdown">
          <div>
            <p className="eyebrow">Current race</p>
            <h2>{leader && second ? `${leader.name} leads by ${formatMiles(gap)}` : "Group is ready"}</h2>
            <p className="muted">
              {leader && second
                ? `${second.name} needs ${formatMiles(gap + 0.01)} to take the lead.`
                : "Create member passwords, share the group code, then start logging miles."}
            </p>
          </div>
          <div className="totalBars">
            {members.map((member) => (
              <div className="totalRow" key={member.id}>
                <div className="totalLabel">
                  <span>{member.name}</span>
                  <strong>{formatMiles(stats[member.id]?.total || 0)}</strong>
                </div>
                <div className="meter">
                  <span
                    className="meterFill"
                    style={{ ...runnerStyle(member, members), width: `${Math.max(4, ((stats[member.id]?.total || 0) / maxTotal) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="panel logPanel">
          <div className="sectionHead">
            <div>
              <p className="eyebrow">Log miles</p>
              <h2>{session.member.name}'s run</h2>
            </div>
            <button className="ghostButton" type="button" onClick={loadRuns} disabled={loadingRuns}>
              Refresh
            </button>
          </div>
          <form className="runForm" onSubmit={submitRun}>
            <label>
              Miles
              <input
                inputMode="decimal"
                min="0.01"
                max="100"
                step="0.01"
                required
                type="number"
                value={form.miles}
                onChange={(event) => setForm({ ...form, miles: event.target.value })}
                placeholder="3.2"
              />
            </label>
            <label>
              Date
              <input required type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} />
            </label>
            <label className="wideField">
              Note
              <input value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="trail, treadmill, tempo..." />
            </label>
            <button className="primaryButton" disabled={saving || !form.miles}>
              {saving ? "Saving..." : "Log run"}
            </button>
          </form>
          {message && <p className="notice">{message}</p>}
        </section>
      </section>

      <section className="panel groupPanel">
        <div className="sectionHead">
          <div>
            <p className="eyebrow">Run group</p>
            <h2>{session.group.name}</h2>
            <p className="muted">Group code: <strong>{session.group.code}</strong></p>
          </div>
          <div className="groupActions">
            {session.member.role === "owner" && (
              <button className="ghostButton" type="button" onClick={copyInviteLink} disabled={!inviteUrl}>
                Copy invite
              </button>
            )}
            <button className="ghostButton" type="button" onClick={logout}>
              Log out
            </button>
          </div>
        </div>
        {session.member.role === "owner" && inviteUrl && (
          <div className="inviteBox">
            <div>
              <strong>Share link</strong>
              <span>{inviteUrl}</span>
            </div>
            <button className="ghostButton" type="button" onClick={copyInviteLink}>
              Copy
            </button>
          </div>
        )}
        <div className="memberGrid">
          <div className="memberList">
            {members.map((member) => (
              <div className="memberPill" key={member.id}>
                <span className="runnerBadge" style={runnerStyle(member, members)}>{member.name.slice(0, 1)}</span>
                <div>
                  <strong>{member.name}</strong>
                  <span>{member.role === "owner" ? "Group owner" : "Runner"}</span>
                </div>
              </div>
            ))}
          </div>
          {session.member.role === "owner" && (
            <form className="memberForm" onSubmit={createMember}>
              <label>
                New runner
                <input value={memberForm.name} onChange={(event) => setMemberForm({ ...memberForm, name: event.target.value })} placeholder="Mom" required />
              </label>
              <label>
                Password
                <input
                  type="password"
                  minLength={8}
                  value={memberForm.password}
                  onChange={(event) => setMemberForm({ ...memberForm, password: event.target.value })}
                  placeholder="At least 8 characters"
                  required
                />
              </label>
              <button className="primaryButton" disabled={memberSaving}>
                {memberSaving ? "Creating..." : "Create password"}
              </button>
            </form>
          )}
        </div>
      </section>

      <section className="runnerGrid">
        {members.map((member) => (
          <RunnerCard key={member.id} member={member} members={members} stats={stats[member.id] || emptyStats()} />
        ))}
      </section>

      <section className="panel chartPanel">
        <div className="sectionHead">
          <div>
            <p className="eyebrow">Last 14 days</p>
            <h2>Daily mileage</h2>
          </div>
          <div className="legend">
            {members.map((member) => (
              <span key={member.id}><i className="dot" style={runnerStyle(member, members)} />{member.name}</span>
            ))}
          </div>
        </div>
        <div className="chart" aria-label="Daily mileage chart">
          {chartDays.map((day) => (
            <div className="dayGroup" key={day.date}>
              <div className="bars">
                {members.map((member) => (
                  <span
                    className="bar"
                    key={member.id}
                    title={`${member.name} ${formatMiles(day.totals[member.id] || 0)}`}
                    style={{ ...runnerStyle(member, members), height: `${day.heights[member.id] || 2}%` }}
                  />
                ))}
              </div>
              <span className="dayLabel">{day.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="panel feedPanel">
        <div className="sectionHead">
          <div>
            <p className="eyebrow">Recent activity</p>
            <h2>Run log</h2>
          </div>
          <span className="muted">{runs.length} entries</span>
        </div>
        {loadingRuns ? (
          <p className="empty">Loading runs...</p>
        ) : runs.length === 0 ? (
          <p className="empty">No miles logged yet. Somebody start the scoreboard.</p>
        ) : (
          <div className="runList">
            {runs.map((run) => {
              const member = members.find((row) => row.id === run.memberId);
              return (
                <article className="runRow" key={run.id}>
                  <span className="runnerBadge" style={member ? runnerStyle(member, members) : undefined}>{run.runner.slice(0, 1)}</span>
                  <div className="runDetails">
                    <div>
                      <strong>{run.runner}</strong>
                      <span>{formatDate(run.date)}</span>
                    </div>
                    {run.note && <p>{run.note}</p>}
                  </div>
                  <strong className="runMiles">{formatMiles(run.miles)}</strong>
                  {(session.member.role === "owner" || session.member.id === run.memberId) && (
                    <button className="deleteButton" type="button" onClick={() => deleteRun(run.id)} aria-label={`Delete ${run.runner} run on ${run.date}`}>
                      Delete
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

function AuthScreen({ onAuthenticated, message }: { onAuthenticated: (data: SessionData) => void; message: string }) {
  const [mode, setMode] = useState<"login" | "create">("login");
  const [loginForm, setLoginForm] = useState({ groupCode: "", memberName: "", password: "" });
  const [createForm, setCreateForm] = useState({ groupName: "Shane vs Molly", ownerName: "Shane", password: "" });
  const [busy, setBusy] = useState(false);
  const [localMessage, setLocalMessage] = useState(message);

  useEffect(() => {
    const groupCode = inviteGroupCodeFromUrl();
    if (!groupCode) return;
    setMode("login");
    setLoginForm((current) => ({ ...current, groupCode }));
    setLocalMessage("Group code filled from invite link. Enter your name and password.");
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setLocalMessage("");

    try {
      const response = await fetch(mode === "login" ? "/api/session" : "/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "login" ? loginForm : createForm),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not sign in.");
      onAuthenticated(data);
    } catch (error) {
      setLocalMessage(error instanceof Error ? error.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="app authApp">
      <section className="panel authPanel">
        <Brand />
        <div className="modeTabs">
          <button className={mode === "login" ? "activeTab" : ""} type="button" onClick={() => setMode("login")}>
            Join group
          </button>
          <button className={mode === "create" ? "activeTab" : ""} type="button" onClick={() => setMode("create")}>
            Create group
          </button>
        </div>
        <form className="authForm" onSubmit={submit}>
          {mode === "login" ? (
            <>
              <label>
                Group code
                <input value={loginForm.groupCode} onChange={(event) => setLoginForm({ ...loginForm, groupCode: event.target.value })} placeholder="shane-vs-molly" required />
              </label>
              <label>
                Your name
                <input value={loginForm.memberName} onChange={(event) => setLoginForm({ ...loginForm, memberName: event.target.value })} placeholder="Shane" required />
              </label>
              <label>
                Password
                <input type="password" value={loginForm.password} onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })} required />
              </label>
              <button className="primaryButton" disabled={busy}>{busy ? "Joining..." : "Join group"}</button>
            </>
          ) : (
            <>
              <label>
                Group name
                <input value={createForm.groupName} onChange={(event) => setCreateForm({ ...createForm, groupName: event.target.value })} required />
              </label>
              <label>
                Your name
                <input value={createForm.ownerName} onChange={(event) => setCreateForm({ ...createForm, ownerName: event.target.value })} required />
              </label>
              <label>
                Owner password
                <input
                  type="password"
                  minLength={8}
                  value={createForm.password}
                  onChange={(event) => setCreateForm({ ...createForm, password: event.target.value })}
                  placeholder="At least 8 characters"
                  required
                />
              </label>
              <button className="primaryButton" disabled={busy}>{busy ? "Creating..." : "Create run group"}</button>
            </>
          )}
        </form>
        {localMessage && <p className="notice">{localMessage}</p>}
      </section>
    </main>
  );
}

function Brand({ eyebrow = "Homelab mileage rivalry" }: { eyebrow?: string }) {
  return (
    <div className="brand">
      <img src="/track-mark.svg" alt="" className="brandMark" />
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>RunComp</h1>
      </div>
    </div>
  );
}

function buildInviteUrl(groupCode: string) {
  if (typeof window === "undefined") return "";
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("group", groupCode);
  return url.toString();
}

function inviteGroupCodeFromUrl() {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search);
  return (params.get("group") || params.get("g") || "").trim();
}

function RunnerCard({ member, members, stats }: { member: Member; members: Member[]; stats: RunnerStats }) {
  return (
    <section className="panel runnerCard" style={{ borderTopColor: colorForMember(member, members) }}>
      <div className="sectionHead">
        <div>
          <p className="eyebrow">{member.name}</p>
          <h2>{formatMiles(stats.total)}</h2>
        </div>
        <div className="runnerBadge" style={runnerStyle(member, members)}>{member.name.slice(0, 1)}</div>
      </div>
      <div className="statRows">
        <StatRow label="This week" value={formatMiles(stats.week)} />
        <StatRow label="This month" value={formatMiles(stats.month)} />
        <StatRow label="Runs logged" value={String(stats.runCount)} />
        <StatRow label="Average run" value={formatMiles(stats.average)} />
        <StatRow label="Longest run" value={formatMiles(stats.longest)} />
        <StatRow label="Streak" value={`${stats.streak} day${stats.streak === 1 ? "" : "s"}`} />
      </div>
      <p className="lastRun">{stats.lastRun ? `Last run: ${formatDate(stats.lastRun)}` : "No runs logged yet"}</p>
    </section>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="statRow">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function buildStats(runs: RunEntry[], members: Member[]): Record<string, RunnerStats> {
  const now = new Date();
  const weekStart = startOfWeek(now);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  return members.reduce(
    (all, member) => {
      const runnerRuns = runs.filter((run) => run.memberId === member.id);
      const total = sumMiles(runnerRuns);
      all[member.id] = {
        total,
        week: sumMiles(runnerRuns.filter((run) => parseRunDate(run.date) >= weekStart)),
        month: sumMiles(runnerRuns.filter((run) => parseRunDate(run.date) >= monthStart)),
        runCount: runnerRuns.length,
        average: runnerRuns.length ? total / runnerRuns.length : 0,
        longest: Math.max(0, ...runnerRuns.map((run) => run.miles)),
        streak: currentStreak(runnerRuns),
        lastRun: sortRuns(runnerRuns)[0]?.date,
      };
      return all;
    },
    {} as Record<string, RunnerStats>,
  );
}

function buildChartDays(runs: RunEntry[], members: Member[]) {
  const days = Array.from({ length: 14 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (13 - index));
    return toDateKey(date);
  });
  const totals = days.map((date) => ({
    date,
    label: shortDate(date),
    totals: members.reduce(
      (all, member) => {
        all[member.id] = sumMiles(runs.filter((run) => run.memberId === member.id && run.date === date));
        return all;
      },
      {} as Record<string, number>,
    ),
  }));
  const max = Math.max(1, ...totals.flatMap((day) => members.map((member) => day.totals[member.id] || 0)));
  return totals.map((day) => ({
    ...day,
    heights: members.reduce(
      (all, member) => {
        const total = day.totals[member.id] || 0;
        all[member.id] = total ? Math.max(8, (total / max) * 100) : 2;
        return all;
      },
      {} as Record<string, number>,
    ),
  }));
}

function currentStreak(runs: RunEntry[]) {
  const runDays = new Set(runs.map((run) => run.date));
  const cursor = new Date();
  let streak = 0;

  if (!runDays.has(toDateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }

  while (runDays.has(toDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function runnerStyle(member: Member, members: Member[]) {
  return { "--runner-color": colorForMember(member, members) } as CSSProperties;
}

function colorForMember(member: Member, members: Member[]) {
  const index = members.findIndex((row) => row.id === member.id);
  return palette[Math.max(0, index) % palette.length];
}

function emptyStats(): RunnerStats {
  return {
    total: 0,
    week: 0,
    month: 0,
    runCount: 0,
    average: 0,
    longest: 0,
    streak: 0,
  };
}

function sortRuns(runs: RunEntry[]) {
  return [...runs].sort((a, b) => {
    const byDate = b.date.localeCompare(a.date);
    if (byDate !== 0) return byDate;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

function sumMiles(runs: RunEntry[]) {
  return runs.reduce((total, run) => total + run.miles, 0);
}

function startOfWeek(date: Date) {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = copy.getDay();
  const diff = day === 0 ? 6 : day - 1;
  copy.setDate(copy.getDate() - diff);
  return copy;
}

function parseRunDate(date: string) {
  return new Date(`${date}T00:00:00`);
}

function todayInput() {
  return toDateKey(new Date());
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatMiles(value: number) {
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value)} mi`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(parseRunDate(value));
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "numeric", day: "numeric" }).format(parseRunDate(value));
}
