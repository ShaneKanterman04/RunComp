"use client";

import type { CSSProperties, FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState, useCallback } from "react";
import { Confetti } from "./components/Confetti";
import { ToastContainer, type ToastMessage } from "./components/Toast";
import { AnimatedMiles } from "./components/AnimatedCounter";
import {
  buildChartDays,
  buildBadges,
  buildHeatmapWeeks,
  buildStats,
  buildStreakStrip,
  emptyStats,
  formatDate,
  formatDuration,
  formatMiles,
  formatPace,
  raceProgress,
  todayInput,
  type AchievementBadge,
  type RunnerStats,
} from "@/lib/run-metrics";

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
  goalMiles: number;
  createdAt: string;
};

type SessionData = {
  authenticated: true;
  group: Group;
  member: Member;
  members: Member[];
};

type RecentGroup = {
  code: string;
  name: string;
  memberName: string;
  usedAt: string;
};

type RunEntry = {
  id: string;
  memberId: string;
  runner: string;
  miles: number;
  durationSeconds?: number;
  date: string;
  note: string;
  reactions: RunReaction[];
  createdAt: string;
};

type ReactionType = "fire" | "nice" | "brutal" | "sus";

type RunReaction = {
  type: ReactionType;
  count: number;
  reactedByMe: boolean;
};

type AuthPayload = SessionData | { authenticated: false; error?: string };

const palette = ["#18845d", "#d94f76", "#3f6fb5", "#b27920", "#6f5bb5", "#1f8793", "#a94632", "#587443"];
const recentGroupsKey = "runcomp:recent-groups";
const pwaInstallSeenKey = "runcomp:pwa-install-seen";

export default function Home() {
  const [session, setSession] = useState<SessionData | null>(null);
  const [runs, setRuns] = useState<RunEntry[]>([]);
  const [form, setForm] = useState({ miles: "", duration: "", date: todayInput(), note: "" });
  const [memberForm, setMemberForm] = useState({ name: "", password: "" });
  const [goalForm, setGoalForm] = useState("100");
  const [inviteUrl, setInviteUrl] = useState("");
  const [memberInviteUrls, setMemberInviteUrls] = useState<Record<string, string>>({});
  const [checkingSession, setCheckingSession] = useState(true);
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [saving, setSaving] = useState(false);
  const [memberSaving, setMemberSaving] = useState(false);
  const [goalSaving, setGoalSaving] = useState(false);
  const [inviteSavingId, setInviteSavingId] = useState("");
  const [message, setMessage] = useState("");
  const [showConfetti, setShowConfetti] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [copySuccess, setCopySuccess] = useState(false);
  const [memberCopySuccess, setMemberCopySuccess] = useState<Record<string, boolean>>({});

  useEffect(() => {
    bootstrap();
  }, []);

  useEffect(() => {
    if (!session) {
      setInviteUrl("");
      setMemberInviteUrls({});
      return;
    }
    setInviteUrl(buildInviteUrl(session.group.code));
    setGoalForm(String(session.group.goalMiles || 100));
    rememberRecentGroup(session);
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
  const goalMiles = session?.group.goalMiles || 100;
  const leaderProgress = leader ? raceProgress(stats[leader.id]?.total || 0, goalMiles) : raceProgress(0, goalMiles);
  const weekStandings = useMemo(
    () => [...members].sort((a, b) => (stats[b.id]?.week || 0) - (stats[a.id]?.week || 0)),
    [members, stats],
  );
  const weekLeader = weekStandings[0] || null;
  const weekSecond = weekStandings[1] || null;
  const weekGap = weekLeader && weekSecond ? Math.abs((stats[weekLeader.id]?.week || 0) - (stats[weekSecond.id]?.week || 0)) : 0;
  const paceStandings = useMemo(
    () => members.filter((member) => stats[member.id]?.averagePace).sort((a, b) => (stats[a.id].averagePace || Infinity) - (stats[b.id].averagePace || Infinity)),
    [members, stats],
  );
  const paceLeader = paceStandings[0] || null;
  const maxTotal = Math.max(1, ...members.map((member) => stats[member.id]?.total || 0));
  const maxWeek = Math.max(1, ...members.map((member) => stats[member.id]?.week || 0));
  const isOwner = session?.member.role === "owner";
  const hasRuns = runs.length > 0;
  const hasMultipleMembers = members.length > 1;
  const raceEmptyCopy = isOwner
    ? "Create runner passwords, share invite links, then log the first run."
    : "You are signed in. Log your first run to start the group scoreboard.";
  const feedEmptyCopy = isOwner
    ? hasMultipleMembers
      ? "No miles logged yet. Share login links or add the first run yourself."
      : "No miles logged yet. Add another runner or log your first run."
    : "No miles logged yet. Log your first run and your group will see it here.";

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

  const addToast = useCallback((text: string, type: ToastMessage["type"] = "success") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((current) => [...current, { id, text, type }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  function checkMilestones(newRun: RunEntry, previousStats: Record<string, RunnerStats>) {
    const memberStats = previousStats[newRun.memberId];
    if (!memberStats) return;

    const oldTotal = memberStats.total;
    const newTotal = oldTotal + newRun.miles;
    const milestones = [10, 25, 50, 100, 250, 500, 1000];
    const oldStreak = memberStats.streak;
    const newStreak = oldStreak + 1;
    const streakMilestones = [3, 7, 14, 30, 100];

    for (const m of milestones) {
      if (oldTotal < m && newTotal >= m) {
        addToast(`${newRun.runner} hit ${m} total miles!`, "milestone");
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 2000);
        return;
      }
    }

    for (const s of streakMilestones) {
      if (oldStreak < s && newStreak >= s) {
        addToast(`${newRun.runner} is on a ${s}-day streak!`, "confetti");
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 2000);
        return;
      }
    }

    // Always show confetti for any run
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 2000);
  }

  async function submitRun(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !session) return;
    const durationSeconds = parseDurationInput(form.duration);
    if (form.duration.trim() && !durationSeconds) {
      setMessage("Enter time as minutes, mm:ss, or h:mm:ss.");
      return;
    }
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          miles: Number(form.miles),
          durationSeconds,
          date: form.date,
          note: form.note,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save run.");
      checkMilestones(data.run, stats);
      setRuns((current) => [data.run, ...current]);
      setForm((current) => ({ ...current, miles: "", duration: "", note: "" }));
      setMessage(
        `${session.member.name} logged ${formatMiles(data.run.miles)}${data.run.durationSeconds ? ` at ${formatPace(data.run.durationSeconds / data.run.miles)}` : ""}.`,
      );
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

  async function updateGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (goalSaving || !session || session.member.role !== "owner") return;
    setGoalSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/groups", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goalMiles: Number(goalForm) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update race goal.");
      setSession((current) => (current ? { ...current, group: data.group } : current));
      setMessage(`Race goal updated to ${formatMiles(data.group.goalMiles)}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update race goal.");
    } finally {
      setGoalSaving(false);
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

  async function toggleReaction(runId: string, reaction: ReactionType) {
    setMessage("");
    try {
      const response = await fetch("/api/runs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: runId, reaction }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not react to run.");
      setRuns((current) => current.map((run) => (run.id === runId ? data.run : run)));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not react to run.");
    }
  }

  async function logout(nextMessage = "") {
    await fetch("/api/session", { method: "DELETE" }).catch(() => undefined);
    setSession(null);
    setRuns([]);
    setMessage(nextMessage);
  }

  async function copyInviteLink() {
    if (!inviteUrl) return;
    try {
      await copyText(inviteUrl);
      setCopySuccess(true);
      addToast("Invite link copied to clipboard!", "success");
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      setMessage(`Invite link: ${inviteUrl}`);
    }
  }

  async function createMemberInvite(member: Member) {
    if (!session || session.member.role !== "owner" || inviteSavingId) return;
    const existingUrl = memberInviteUrls[member.id];
    if (existingUrl) {
      try {
        await copyText(existingUrl);
        setMemberCopySuccess((prev) => ({ ...prev, [member.id]: true }));
        addToast(`${member.name}'s login link copied!`, "success");
        setTimeout(() => setMemberCopySuccess((prev) => ({ ...prev, [member.id]: false })), 2000);
      } catch {
        setMessage(`Clipboard blocked. ${member.name}'s login link: ${existingUrl}`);
      }
      return;
    }

    setInviteSavingId(member.id);
    setMessage("");

    try {
      const response = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: member.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not create login link.");
      const url = buildMemberInviteUrl(data.token);
      setMemberInviteUrls((current) => ({ ...current, [member.id]: url }));
      try {
        await copyText(url);
        setMemberCopySuccess((prev) => ({ ...prev, [member.id]: true }));
        addToast(`${member.name}'s login link copied!`, "success");
        setTimeout(() => setMemberCopySuccess((prev) => ({ ...prev, [member.id]: false })), 2000);
      } catch {
        setMessage(`Clipboard blocked. ${member.name}'s login link: ${url}`);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create login link.");
    } finally {
      setInviteSavingId("");
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
    <>
      {showConfetti && <Confetti />}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <main className="app">
        <header className="topbar">
          <Brand eyebrow={session.group.name} />
          <div className="topbarMeta">
            <div className="signedInBadge" aria-label={`Signed in as ${session.member.name}`}>
              <span className="runnerBadge smallBadge" style={runnerStyle(session.member, members)}>{session.member.name.slice(0, 1)}</span>
              <span>
                <strong>{session.member.name}</strong>
                <small>{session.member.role === "owner" ? "Group owner" : "Runner"}</small>
              </span>
            </div>
            <div className="headToHead" aria-label="Current standings">
              {standings.map((member, index) => (
                <span className="standItem" key={member.id}>
                  {index + 1}. {member.name} {formatMiles(stats[member.id]?.total || 0)}
                  {member.id === session.member.id && <YouBadge />}
                  {stats[member.id]?.averagePace && <em>{formatPace(stats[member.id]?.averagePace)}</em>}
                </span>
              ))}
            </div>
          </div>
        </header>

        <section className="scoreGrid">
          <section className="panel showdown">
            <div>
              <p className="eyebrow">Current race</p>
              <h2>{leader && second ? `${leader.name} leads by ${formatMiles(gap)}` : "Group is ready"}</h2>
              <p className="muted">
                {hasRuns && leader
                  ? `${formatMiles(leaderProgress.remaining)} left in the first-to-${formatMiles(goalMiles)} race.`
                  : raceEmptyCopy}
              </p>
            </div>
            <div className="totalBars">
              {members.map((member) => (
                <div className={`totalRow ${member.id === session.member.id ? "currentRunnerRow" : ""}`} key={member.id}>
                  <div className="totalLabel">
                    <span>{member.name}{member.id === session.member.id && <YouBadge />}</span>
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

          <section className="panel weeklyPanel">
            <div>
              <p className="eyebrow">Weekly battle</p>
              <h2>{weekLeader && weekSecond ? `${weekLeader.name} up ${formatMiles(weekGap)}` : "Fresh week"}</h2>
              <p className="muted">
                {paceLeader
                  ? `${paceLeader.name} has the fastest average pace at ${formatPace(stats[paceLeader.id]?.averagePace)}.`
                  : "Add times to compare average pace."}
              </p>
            </div>
            <div className="totalBars compactBars">
              {members.map((member) => (
                <div className={`totalRow ${member.id === session.member.id ? "currentRunnerRow" : ""}`} key={member.id}>
                  <div className="totalLabel">
                    <span>{member.name}{member.id === session.member.id && <YouBadge />}</span>
                    <strong>{formatMiles(stats[member.id]?.week || 0)}</strong>
                  </div>
                  <div className="meter">
                    <span
                      className="meterFill"
                      style={{ ...runnerStyle(member, members), width: `${Math.max(4, ((stats[member.id]?.week || 0) / maxWeek) * 100)}%` }}
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
                Time
                <input
                  inputMode="numeric"
                  type="text"
                  value={form.duration}
                  onChange={(event) => setForm({ ...form, duration: event.target.value })}
                  placeholder="25:30"
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
              <p className="muted">Trail code: <strong>{session.group.code}</strong> · Goal: <strong>{formatMiles(goalMiles)}</strong></p>
            </div>
            <div className="groupActions">
              {session.member.role === "owner" && (
                <button className={`ghostButton ${copySuccess ? "copySuccess" : ""}`} type="button" onClick={copyInviteLink} disabled={!inviteUrl}>
                  {copySuccess ? "Copied!" : "Copy invite"}
                </button>
              )}
              <button className="ghostButton" type="button" onClick={() => logout("Pick a saved group or enter another trail code.")}>
                Switch group
              </button>
              <button className="ghostButton" type="button" onClick={() => logout()}>
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
              <button className={`ghostButton ${copySuccess ? "copySuccess" : ""}`} type="button" onClick={copyInviteLink}>
                {copySuccess ? "Copied!" : "Copy"}
              </button>
            </div>
          )}
          <div className="memberGrid">
            <div className="memberList">
              {members.map((member) => (
                <div className={`memberPill ${member.id === session.member.id ? "currentMemberPill" : ""}`} key={member.id}>
                  <div className="memberIdentity">
                    <span className="runnerBadge" style={runnerStyle(member, members)}>{member.name.slice(0, 1)}</span>
                    <div>
                      <strong>{member.name}{member.id === session.member.id && <YouBadge />}</strong>
                      <span>{member.role === "owner" ? "Group owner" : "Runner"}</span>
                    </div>
                  </div>
                  {session.member.role === "owner" && (
                    <button
                      className={`miniButton ${memberCopySuccess[member.id] ? "copySuccess" : ""}`}
                      type="button"
                      onClick={() => createMemberInvite(member)}
                      disabled={Boolean(inviteSavingId)}
                    >
                      {inviteSavingId === member.id
                        ? "Creating..."
                        : memberCopySuccess[member.id]
                          ? "Copied!"
                          : memberInviteUrls[member.id]
                            ? "Copy login"
                            : "Login link"}
                    </button>
                  )}
                </div>
              ))}
            </div>
            {session.member.role === "owner" && (
              <div className="ownerTools">
                <form className="goalForm" onSubmit={updateGoal}>
                  <label>
                    Race goal
                    <input
                      inputMode="decimal"
                      min="1"
                      max="10000"
                      step="1"
                      type="number"
                      value={goalForm}
                      onChange={(event) => setGoalForm(event.target.value)}
                      required
                    />
                  </label>
                  <button className="primaryButton" disabled={goalSaving || Number(goalForm) === goalMiles}>
                    {goalSaving ? "Saving..." : "Update goal"}
                  </button>
                </form>
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
              </div>
            )}
          </div>
        </section>

        <section className="runnerGrid">
          {members.map((member) => (
            <RunnerCard
              key={member.id}
              member={member}
              members={members}
              runs={runs}
              stats={stats[member.id] || emptyStats()}
              goalMiles={goalMiles}
              isCurrentUser={member.id === session.member.id}
            />
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
            <p className="empty">{feedEmptyCopy}</p>
          ) : (
            <div className="runList">
              {runs.map((run, index) => {
                const member = members.find((row) => row.id === run.memberId);
                const isMyRun = run.memberId === session.member.id;
                return (
                  <article className={`runRow ${isMyRun ? "currentRunRow" : ""}`} key={run.id} style={{ animationDelay: `${index * 0.05}s` }}>
                    <span className="runnerBadge runBadge" style={member ? runnerStyle(member, members) : undefined}>{run.runner.slice(0, 1)}</span>
                    <div className="runDetails">
                      <div>
                        <strong>{run.runner}{isMyRun && <YouBadge />}</strong>
                        <span>{formatDate(run.date)}</span>
                      </div>
                      {run.note && <p>{run.note}</p>}
                      {run.durationSeconds && (
                        <p className="runMeta">
                          {formatDuration(run.durationSeconds)} · {formatPace(run.durationSeconds / run.miles)}
                        </p>
                      )}
                    </div>
                    <strong className="runMiles">{formatMiles(run.miles)}</strong>
                    <ReactionBar reactions={run.reactions || emptyReactions()} onReact={(reaction) => toggleReaction(run.id, reaction)} />
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
    </>
  );
}

function AuthScreen({ onAuthenticated, message }: { onAuthenticated: (data: SessionData) => void; message: string }) {
  const [mode, setMode] = useState<"login" | "create">("login");
  const [loginForm, setLoginForm] = useState({ groupCode: "", memberName: "", password: "" });
  const [createForm, setCreateForm] = useState({ groupName: "Shane vs Molly", ownerName: "Shane", password: "", goalMiles: "100" });
  const [recentGroups, setRecentGroups] = useState<RecentGroup[]>([]);
  const [welcomeSession, setWelcomeSession] = useState<SessionData | null>(null);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [busy, setBusy] = useState(false);
  const [localMessage, setLocalMessage] = useState(message);

  useEffect(() => {
    setRecentGroups(readRecentGroups());

    const inviteToken = inviteTokenFromUrl();
    if (inviteToken) {
      redeemInvite(inviteToken);
      return;
    }

    const groupCode = inviteGroupCodeFromUrl();
    if (!groupCode) return;
    setMode("login");
    setLoginForm((current) => ({ ...current, groupCode }));
    setLocalMessage("Trail code filled from invite link. Enter your runner password.");
  }, []);

  useEffect(() => {
    if (message) setLocalMessage(message);
  }, [message]);

  useEffect(() => {
    if (!welcomeSession || showInstallGuide) return;
    const timeout = window.setTimeout(() => onAuthenticated(welcomeSession), 1300);
    return () => window.clearTimeout(timeout);
  }, [onAuthenticated, showInstallGuide, welcomeSession]);

  function useRecentGroup(group: RecentGroup) {
    setMode("login");
    setLoginForm((current) => ({ ...current, groupCode: group.code, memberName: group.memberName }));
    setLocalMessage(`Ready to join ${group.name}. Enter ${group.memberName ? `${group.memberName}'s ` : "your "}password.`);
  }

  async function redeemInvite(inviteToken: string) {
    setBusy(true);
    setLocalMessage("Opening login link...");

    try {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteToken }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not use login link.");
      setShowInstallGuide(shouldShowIosInstallGuide());
      setWelcomeSession(data);
    } catch (error) {
      setLocalMessage(error instanceof Error ? error.message : "Could not use login link.");
    } finally {
      setBusy(false);
    }
  }

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

  function continueFromWelcome(markInstallSeen: boolean) {
    if (!welcomeSession) return;
    if (markInstallSeen) rememberPwaInstallSeen();
    onAuthenticated(welcomeSession);
  }

  if (welcomeSession) {
    return (
      <main className="app authApp">
        <section className="panel authPanel welcomePanel">
          <Brand eyebrow={welcomeSession.group.name} />
          <div className="welcomeIdentity">
            <span className="runnerBadge welcomeBadge" style={runnerStyle(welcomeSession.member, welcomeSession.members)}>
              {welcomeSession.member.name.slice(0, 1)}
            </span>
            <div>
              <p className="eyebrow">Signed in</p>
              <h2>Welcome, {welcomeSession.member.name}</h2>
              <p className="muted">{welcomeSession.member.role === "owner" ? "Group owner" : "Runner"} in {welcomeSession.group.name}</p>
            </div>
          </div>
          {showInstallGuide ? (
            <div className="installGuide" aria-label="Add RunComp to your iPhone Home Screen">
              <div>
                <p className="eyebrow">Save RunComp</p>
                <h3>Add it to your Home Screen</h3>
                <p className="muted">RunComp will open like an app next time, already signed in as {welcomeSession.member.name}.</p>
              </div>
              <ol className="installSteps">
                <li><span>1</span><strong>Tap Share</strong></li>
                <li><span>2</span><strong>Add to Home Screen</strong></li>
                <li><span>3</span><strong>Tap Add</strong></li>
              </ol>
              <div className="welcomeActions">
                <button className="primaryButton" type="button" onClick={() => continueFromWelcome(true)}>
                  I added it
                </button>
                <button className="ghostButton" type="button" onClick={() => continueFromWelcome(true)}>
                  Continue in browser
                </button>
              </div>
            </div>
          ) : (
            <div className="welcomeProgress" aria-hidden="true"><span /></div>
          )}
        </section>
      </main>
    );
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
              {recentGroups.length > 0 && (
                <div className="recentGroups" aria-label="Recent run groups">
                  <div className="recentGroupsHead">
                    <strong>Recent groups</strong>
                    <span>Saved on this device</span>
                  </div>
                  <div className="recentGroupList">
                    {recentGroups.map((group) => (
                      <button className="recentGroupButton" type="button" key={`${group.code}-${group.memberName}`} onClick={() => useRecentGroup(group)}>
                        <span>
                          <strong>{group.name}</strong>
                          <small>{group.memberName || "Runner"} · {group.code}</small>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <label>
                Trail code
                <input
                  inputMode="numeric"
                  maxLength={3}
                  value={loginForm.groupCode}
                  onChange={(event) => setLoginForm({ ...loginForm, groupCode: event.target.value.replace(/\D/g, "").slice(0, 3) })}
                  placeholder="482"
                  required
                />
              </label>
              <label>
                Runner name
                <input
                  value={loginForm.memberName}
                  onChange={(event) => setLoginForm({ ...loginForm, memberName: event.target.value })}
                  placeholder="Optional if your password is unique"
                />
              </label>
              <label>
                Runner password
                <input type="password" value={loginForm.password} onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })} required />
              </label>
              <button className="primaryButton" disabled={busy}>{busy ? "Joining..." : "Join trail"}</button>
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
                Race goal
                <input
                  inputMode="decimal"
                  min="1"
                  max="10000"
                  step="1"
                  type="number"
                  value={createForm.goalMiles}
                  onChange={(event) => setCreateForm({ ...createForm, goalMiles: event.target.value })}
                  required
                />
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

function buildMemberInviteUrl(token: string) {
  if (typeof window === "undefined") return "";
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("invite", token);
  return url.toString();
}

function inviteGroupCodeFromUrl() {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search);
  return (params.get("group") || params.get("g") || "").trim();
}

function inviteTokenFromUrl() {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search);
  return (params.get("invite") || params.get("i") || "").trim();
}

function shouldShowIosInstallGuide() {
  if (typeof window === "undefined") return false;
  if (window.localStorage.getItem(pwaInstallSeenKey) === "true") return false;
  if (isStandaloneApp()) return false;
  return isIosDevice();
}

function rememberPwaInstallSeen() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(pwaInstallSeenKey, "true");
  } catch {
    // Install guidance is a convenience only.
  }
}

function isIosDevice() {
  if (typeof navigator === "undefined") return false;
  const platform = navigator.platform || "";
  const userAgent = navigator.userAgent || "";
  return /iPad|iPhone|iPod/.test(userAgent) || (platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandaloneApp() {
  if (typeof window === "undefined") return false;
  const standaloneNavigator = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || standaloneNavigator.standalone === true;
}

function readRecentGroups(): RecentGroup[] {
  if (typeof window === "undefined") return [];

  try {
    const parsed = JSON.parse(window.localStorage.getItem(recentGroupsKey) || "[]");
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(isRecentGroup)
      .sort((a, b) => Date.parse(b.usedAt) - Date.parse(a.usedAt))
      .slice(0, 6);
  } catch {
    return [];
  }
}

function rememberRecentGroup(session: SessionData) {
  if (typeof window === "undefined") return;

  try {
    const nextGroup: RecentGroup = {
      code: session.group.code,
      name: session.group.name,
      memberName: session.member.name,
      usedAt: new Date().toISOString(),
    };
    const groups = [nextGroup, ...readRecentGroups().filter((group) => group.code !== nextGroup.code || group.memberName !== nextGroup.memberName)].slice(0, 6);
    window.localStorage.setItem(recentGroupsKey, JSON.stringify(groups));
  } catch {
    // Recent groups are a convenience only.
  }
}

function isRecentGroup(value: unknown): value is RecentGroup {
  if (!value || typeof value !== "object") return false;
  const group = value as Partial<RecentGroup>;
  return (
    typeof group.code === "string" &&
    /^\d{3}$/.test(group.code) &&
    typeof group.name === "string" &&
    group.name.trim().length > 0 &&
    typeof group.memberName === "string" &&
    typeof group.usedAt === "string" &&
    Number.isFinite(Date.parse(group.usedAt))
  );
}

async function copyText(value: string) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const input = document.createElement("textarea");
  input.value = value;
  input.setAttribute("readonly", "true");
  input.style.position = "fixed";
  input.style.left = "-9999px";
  input.style.top = "0";
  document.body.appendChild(input);
  input.focus();
  input.select();

  try {
    if (!document.execCommand("copy")) {
      throw new Error("Copy command failed.");
    }
  } finally {
    document.body.removeChild(input);
  }
}

function parseDurationInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const minutes = Number(trimmed);
    return Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes * 60) : undefined;
  }

  const parts = trimmed.split(":");
  if (parts.length < 2 || parts.length > 3 || parts.some((part) => !/^\d+$/.test(part))) return undefined;

  const numbers = parts.map(Number);
  const [hours, minutes, seconds] = numbers.length === 3 ? numbers : [0, numbers[0], numbers[1]];
  if (minutes >= 60 || seconds >= 60) return undefined;
  const total = hours * 3600 + minutes * 60 + seconds;
  return total > 0 ? total : undefined;
}

function RunnerCard({
  member,
  members,
  runs,
  stats,
  goalMiles,
  isCurrentUser,
}: {
  member: Member;
  members: Member[];
  runs: RunEntry[];
  stats: RunnerStats;
  goalMiles: number;
  isCurrentUser: boolean;
}) {
  const badges = buildBadges(stats);
  const progress = raceProgress(stats.total, goalMiles);
  const strip = buildStreakStrip(runs, member.id);
  const heatmap = buildHeatmapWeeks(runs, member.id);
  return (
    <section className={`panel runnerCard ${isCurrentUser ? "currentRunnerCard" : ""}`} style={{ borderTopColor: colorForMember(member, members) }}>
      <div className="sectionHead">
        <div>
          <p className="eyebrow">{member.name}{isCurrentUser && <YouBadge />}</p>
          <h2><AnimatedMiles value={stats.total} /></h2>
          <p className="muted">{formatMiles(progress.remaining)} to goal</p>
        </div>
        <div className="runnerBadge" style={runnerStyle(member, members)}>{member.name.slice(0, 1)}</div>
      </div>
      <div className="goalMeter" aria-label={`${member.name} race progress`}>
        <span style={{ ...runnerStyle(member, members), width: `${Math.max(3, progress.percent)}%` }} />
      </div>
      <div className="statRows">
        <StatRow label="This week" value={formatMiles(stats.week)} />
        <StatRow label="This month" value={formatMiles(stats.month)} />
        <StatRow label="Runs logged" value={String(stats.runCount)} />
        <StatRow label="Average run" value={formatMiles(stats.average)} />
        <StatRow label="Longest run" value={formatMiles(stats.longest)} />
        <StatRow label="Average pace" value={formatPace(stats.averagePace)} />
        <StatRow label="Best pace" value={formatPace(stats.bestPace)} />
        <StatRow label="Timed runs" value={stats.timedRunCount ? `${stats.timedRunCount} · ${formatMiles(stats.timedMiles)}` : "-"} />
        <StatRow
          label="Streak"
          value={stats.streak >= 3 ? (
            <span className="streakFire">{stats.streak} day{stats.streak === 1 ? "" : "s"}</span>
          ) : `${stats.streak} day${stats.streak === 1 ? "" : "s"}`}
        />
      </div>
      <div className="streakStrip" aria-label={`${member.name} last 7 days`}>
        {strip.map((day) => (
          <span className={day.ran ? "ran" : ""} title={day.date} key={day.date}>{day.label}</span>
        ))}
      </div>
      <div className="miniHeatmap" aria-label={`${member.name} six week heatmap`}>
        {heatmap.map((day) => (
          <span className={`heatCell heat-${day.level}`} title={`${day.date}: ${formatMiles(day.miles)}`} key={day.date} />
        ))}
      </div>
      <BadgeStrip badges={badges} />
      <p className="lastRun">{stats.lastRun ? `Last run: ${formatDate(stats.lastRun)}` : "No runs logged yet"}</p>
    </section>
  );
}

const reactionLabels: Record<ReactionType, string> = {
  fire: "Fire",
  nice: "Nice",
  brutal: "Brutal",
  sus: "Sus",
};

const reactionIcons: Record<ReactionType, string> = {
  fire: "Fire",
  nice: "Nice",
  brutal: "Hard",
  sus: "Sus",
};

function ReactionBar({ reactions, onReact }: { reactions: RunReaction[]; onReact: (reaction: ReactionType) => void }) {
  return (
    <div className="reactionBar" aria-label="Run reactions">
      {reactions.map((reaction) => (
        <button
          className={reaction.reactedByMe ? "reacted" : ""}
          type="button"
          key={reaction.type}
          onClick={() => onReact(reaction.type)}
          title={reactionLabels[reaction.type]}
        >
          <span>{reactionIcons[reaction.type]}</span>
          {reaction.count > 0 && <strong>{reaction.count}</strong>}
        </button>
      ))}
    </div>
  );
}

function emptyReactions(): RunReaction[] {
  return (["fire", "nice", "brutal", "sus"] as ReactionType[]).map((type) => ({
    type,
    count: 0,
    reactedByMe: false,
  }));
}

function BadgeStrip({ badges }: { badges: AchievementBadge[] }) {
  if (badges.length === 0) return <div className="badgeStrip muted">No badges yet</div>;
  return (
    <div className="badgeStrip" aria-label="Runner badges">
      {badges.map((badge) => (
        <span className={`achievement achievement--${badge.tone}`} key={badge.id}>{badge.label}</span>
      ))}
    </div>
  );
}

function YouBadge() {
  return <span className="youBadge">You</span>;
}

function StatRow({ label, value }: { label: string; value: string | ReactNode }) {
  return (
    <div className="statRow">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function runnerStyle(member: Member, members: Member[]) {
  return { "--runner-color": colorForMember(member, members) } as CSSProperties;
}

function colorForMember(member: Member, members: Member[]) {
  const index = members.findIndex((row) => row.id === member.id);
  return palette[Math.max(0, index) % palette.length];
}
