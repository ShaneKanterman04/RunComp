"use client";

import type { CSSProperties, FormEvent } from "react";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Confetti } from "./components/Confetti";
import { ToastContainer, type ToastMessage } from "./components/Toast";
import { AnimatedMiles } from "./components/AnimatedCounter";
import packageInfo from "@/package.json";
import { formatExportTimestamp, readExportHistory, recordExportRequest, type ExportHistory } from "@/lib/export-history";
import {
  buildChartDays,
  buildBadges,
  buildComebackTargets,
  buildFamilyChallenges,
  buildFeedEvents,
  buildHeadToHeadComparisons,
  buildHeatmapWeeks,
  buildRecentMileageTrend,
  buildStats,
  buildStreakStrip,
  buildWeeklyRecap,
  emptyStats,
  formatDate,
  formatDuration,
  formatMiles,
  formatPace,
  raceProgress,
  runnerCardRarity,
  runnerTitle,
  todayInput,
  type AchievementBadge,
  type CardRarity,
  type ComebackTarget,
  type FamilyChallenge,
  type FeedEvent,
  type RecentMileageTrend,
  type RunnerStats,
  type WeeklyRecap,
} from "@/lib/run-metrics";

type MemberRole = "owner" | "member";

type Member = {
  id: string;
  name: string;
  role: MemberRole;
  createdAt: string;
  runCount?: number;
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

type ReactionType = "fire" | "nice" | "brutal" | "sus" | "respect" | "catching" | "monster" | "suspicious";

type RunReaction = {
  type: ReactionType;
  count: number;
  reactedByMe: boolean;
};

type AuthPayload = SessionData | { authenticated: false; error?: string };
type PushStatus = "checking" | "unsupported" | "off" | "subscribed" | "denied" | "busy";
type MobileTab = "home" | "log" | "feed" | "group";
type CalledShot = {
  miles: number;
  setAt: string;
};

const palette = ["#18845d", "#d94f76", "#3f6fb5", "#b27920", "#6f5bb5", "#1f8793", "#a94632", "#587443"];
const recentGroupsKey = "runcomp:recent-groups";
const pwaInstallSeenKey = "runcomp:pwa-install-seen";
const calledShotKey = "runcomp:called-shot";
const streakFreezePrefix = "runcomp:streak-freeze:";
const appVersion = packageInfo.version;
const runPollMs = 8000;
const quickMileOptions = [
  { label: "1 mi", value: "1" },
  { label: "2 mi", value: "2" },
  { label: "5K", value: "3.1" },
  { label: "4 mi", value: "4" },
  { label: "5 mi", value: "5" },
  { label: "10K", value: "6.2" },
];
const runNoteOptions = ["easy", "tempo", "trail", "treadmill", "long run", "walk break"];
const mobileTabs: Array<{ id: MobileTab; label: string }> = [
  { id: "home", label: "Home" },
  { id: "log", label: "Log" },
  { id: "feed", label: "Feed" },
  { id: "group", label: "Group" },
];

export default function Home() {
  const [session, setSession] = useState<SessionData | null>(null);
  const [runs, setRuns] = useState<RunEntry[]>([]);
  const [form, setForm] = useState({ miles: "", duration: "", date: todayInput(), note: "" });
  const [memberForm, setMemberForm] = useState({ name: "", password: "" });
  const [memberEdits, setMemberEdits] = useState<Record<string, { name: string; password: string }>>({});
  const [goalForm, setGoalForm] = useState("100");
  const [inviteUrl, setInviteUrl] = useState("");
  const [memberInviteUrls, setMemberInviteUrls] = useState<Record<string, string>>({});
  const [checkingSession, setCheckingSession] = useState(true);
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [saving, setSaving] = useState(false);
  const [memberSaving, setMemberSaving] = useState(false);
  const [goalSaving, setGoalSaving] = useState(false);
  const [inviteSavingId, setInviteSavingId] = useState("");
  const [memberActionId, setMemberActionId] = useState("");
  const [message, setMessage] = useState("");
  const [showConfetti, setShowConfetti] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [copySuccess, setCopySuccess] = useState(false);
  const [memberCopySuccess, setMemberCopySuccess] = useState<Record<string, boolean>>({});
  const [pushStatus, setPushStatus] = useState<PushStatus>("checking");
  const [mobileTab, setMobileTab] = useState<MobileTab>("home");
  const [calledShot, setCalledShot] = useState<CalledShot | null>(null);
  const [streakFreezeUsed, setStreakFreezeUsed] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [profileMemberId, setProfileMemberId] = useState("");
  const [recapOpen, setRecapOpen] = useState(false);
  const [exportHistory, setExportHistory] = useState<ExportHistory>({});
  const pollingRunsRef = useRef(false);

  useEffect(() => {
    bootstrap();
    setCalledShot(readCalledShot());
    setStreakFreezeUsed(readStreakFreezeUsed());
  }, []);

  useEffect(() => {
    if (!session) {
      setInviteUrl("");
      setMemberInviteUrls({});
      setMemberEdits({});
      setPushStatus("checking");
      setExportHistory({});
      return;
    }
    setInviteUrl(buildInviteUrl(session.group.code));
    setGoalForm(String(session.group.goalMiles || 100));
    setMemberEdits(Object.fromEntries(session.members.map((member) => [member.id, { name: member.name, password: "" }])));
    setExportHistory(readExportHistory(window.localStorage, session.group.code));
    rememberRecentGroup(session);
    refreshPushStatus();
  }, [session]);

  useEffect(() => {
    if (!session) return;
    const refresh = () => {
      void refreshPushStatus();
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [session]);

  useEffect(() => {
    if (!session) return;

    const pollRuns = async () => {
      if (document.visibilityState !== "visible" || pollingRunsRef.current) return;
      pollingRunsRef.current = true;
      try {
        await loadRuns({ silent: true });
      } finally {
        pollingRunsRef.current = false;
      }
    };

    const pollWhenVisible = () => {
      if (document.visibilityState === "visible") void pollRuns();
    };

    const interval = window.setInterval(() => void pollRuns(), runPollMs);
    document.addEventListener("visibilitychange", pollWhenVisible);
    window.addEventListener("focus", pollWhenVisible);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", pollWhenVisible);
      window.removeEventListener("focus", pollWhenVisible);
    };
  }, [session]);

  const members = session?.members || [];
  const goalMiles = session?.group.goalMiles || 100;
  const metricsNow = useMemo(() => lastUpdatedAt || new Date(), [lastUpdatedAt, runs, members]);
  const stats = useMemo(() => buildStats(runs, members, metricsNow), [runs, members, metricsNow]);
  const chartDays = useMemo(() => buildChartDays(runs, members, metricsNow), [runs, members, metricsNow]);
  const weeklyRecap = useMemo(() => buildWeeklyRecap(runs, members, metricsNow), [runs, members, metricsNow]);
  const challenges = useMemo(() => buildFamilyChallenges(runs, members, metricsNow, goalMiles), [runs, members, metricsNow, goalMiles]);
  const comebackTargets = useMemo(() => buildComebackTargets(runs, members), [runs, members]);
  const feedEvents = useMemo(() => buildFeedEvents(runs, members, goalMiles, metricsNow), [runs, members, goalMiles, metricsNow]);
  const profileMember = members.find((member) => member.id === profileMemberId) || null;
  const standings = useMemo(
    () => [...members].sort((a, b) => (stats[b.id]?.total || 0) - (stats[a.id]?.total || 0)),
    [members, stats],
  );
  const leader = standings[0] || null;
  const second = standings[1] || null;
  const gap = leader && second ? Math.abs((stats[leader.id]?.total || 0) - (stats[second.id]?.total || 0)) : 0;
  const leaderProgress = leader ? raceProgress(stats[leader.id]?.total || 0, goalMiles) : raceProgress(0, goalMiles);
  const myStats = session ? stats[session.member.id] || emptyStats() : emptyStats();
  const myProgress = raceProgress(myStats.total, goalMiles);
  const myOverallRank = session ? standings.findIndex((member) => member.id === session.member.id) + 1 : 0;
  const weekStandings = useMemo(
    () => [...members].sort((a, b) => (stats[b.id]?.week || 0) - (stats[a.id]?.week || 0)),
    [members, stats],
  );
  const weekLeader = weekStandings[0] || null;
  const weekSecond = weekStandings[1] || null;
  const weekGap = weekLeader && weekSecond ? Math.abs((stats[weekLeader.id]?.week || 0) - (stats[weekSecond.id]?.week || 0)) : 0;
  const myWeekRank = session ? weekStandings.findIndex((member) => member.id === session.member.id) + 1 : 0;
  const paceStandings = useMemo(
    () => members.filter((member) => stats[member.id]?.averagePace).sort((a, b) => (stats[a.id].averagePace || Infinity) - (stats[b.id].averagePace || Infinity)),
    [members, stats],
  );
  const paceLeader = paceStandings[0] || null;
  const maxWeek = Math.max(1, ...members.map((member) => stats[member.id]?.week || 0));
  const chartTotals = chartDays.map((day) => chartDayTotal(day, members));
  const chartMaxTotal = Math.max(1, ...chartTotals);
  const chartTotalMiles = chartTotals.reduce((sum, total) => sum + total, 0);
  const bestChartDayIndex = chartTotals.indexOf(chartMaxTotal);
  const bestChartDay = chartMaxTotal > 0 && bestChartDayIndex >= 0 ? chartDays[bestChartDayIndex] : null;
  const todayKey = todayInput();
  const isOwner = session?.member.role === "owner";
  const hasRuns = runs.length > 0;
  const hasMultipleMembers = members.length > 1;
  const latestRun = runs[0] || null;
  const myComeback = session ? comebackTargets.find((target) => target.memberId === session.member.id) : undefined;
  const latestOwnRun = session ? runs.find((run) => run.memberId === session.member.id) : null;
  const rivalry = weekLeader && weekSecond ? { leader: weekLeader, chaser: weekSecond, gap: weekGap } : null;
  const groupNeedsFirstRun = !hasRuns;
  const previewDurationSeconds = parseDurationInput(form.duration);
  const previewMiles = Number(form.miles);
  const previewPace = Number.isFinite(previewMiles) && previewMiles > 0 && previewDurationSeconds ? formatPace(previewDurationSeconds / previewMiles) : "";
  const raceEmptyCopy = isOwner
    ? "Create runner passwords, share invite links, then log the first run."
    : "You are signed in. Log your first run to start the group scoreboard.";
  const feedEmptyCopy = isOwner
    ? hasMultipleMembers
      ? "No miles logged yet. Share login links or add the first run yourself."
      : "No miles logged yet. Add another runner or log your first run."
    : "No miles logged yet. Log your first run and your group will see it here.";
  const notificationSettings = notificationSettingsCopy(pushStatus);
  const installSettings = installSettingsCopy();

  function switchMobileTab(tab: MobileTab) {
    setMobileTab(tab);
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate?.(8);
    }
  }

  function applyQuickMiles(miles: string) {
    setForm((current) => ({ ...current, miles }));
  }

  function repeatLastRun() {
    if (!latestOwnRun) return;
    setForm({
      miles: String(latestOwnRun.miles),
      duration: latestOwnRun.durationSeconds ? formatDurationForInput(latestOwnRun.durationSeconds) : "",
      date: todayInput(),
      note: latestOwnRun.note,
    });
  }

  function toggleNoteChip(note: string) {
    setForm((current) => {
      const notes = current.note
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      const exists = notes.includes(note);
      return { ...current, note: exists ? notes.filter((item) => item !== note).join(", ") : [...notes, note].join(", ") };
    });
  }

  function callShot() {
    const miles = Number(form.miles);
    if (!Number.isFinite(miles) || miles <= 0) {
      setMessage("Pick miles first, then call your shot.");
      return;
    }
    const shot = { miles, setAt: new Date().toISOString() };
    setCalledShot(shot);
    saveCalledShot(shot);
    addToast(`Called shot: ${formatMiles(miles)}`, "success");
  }

  function useStreakFreeze() {
    saveStreakFreezeUsed();
    setStreakFreezeUsed(true);
    addToast("Streak freeze saved for this month.", "success");
  }

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

  async function loadRuns(options: { silent?: boolean } = {}) {
    const silent = options.silent === true;
    if (!silent) {
      setLoadingRuns(true);
      setMessage("");
    }
    try {
      const response = await fetch("/api/runs", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load runs.");
      setRuns((current) => (sameRunList(current, data.runs) ? current : data.runs));
      setLastUpdatedAt(new Date());
    } catch (error) {
      if (silent) {
        console.warn("Could not refresh runs", error);
      } else {
        setMessage(error instanceof Error ? error.message : "Could not load runs.");
      }
    } finally {
      if (!silent) setLoadingRuns(false);
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
      if (calledShot && data.run.memberId === session.member.id && data.run.miles >= calledShot.miles) {
        addToast(`Called shot hit: ${formatMiles(calledShot.miles)}`, "confetti");
        setCalledShot(null);
        saveCalledShot(null);
      }
      setRuns((current) => [data.run, ...current]);
      setLastUpdatedAt(new Date());
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

  async function saveMemberName(member: Member) {
    if (!session || session.member.role !== "owner" || memberActionId) return;
    const name = memberEdits[member.id]?.name || member.name;
    setMemberActionId(member.id);
    setMessage("");
    try {
      const response = await fetch("/api/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: member.id, name }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update runner.");
      setSession((current) => (current ? { ...current, members: data.members } : current));
      setMessage(`${data.member.name} updated.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update runner.");
    } finally {
      setMemberActionId("");
    }
  }

  async function resetRunnerPassword(member: Member) {
    if (!session || session.member.role !== "owner" || memberActionId) return;
    const password = memberEdits[member.id]?.password || "";
    setMemberActionId(member.id);
    setMessage("");
    try {
      const response = await fetch("/api/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: member.id, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not reset password.");
      setSession((current) => (current ? { ...current, members: data.members } : current));
      setMemberEdits((current) => ({ ...current, [member.id]: { name: data.member.name, password: "" } }));
      setMessage(`${data.member.name}'s password was reset.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not reset password.");
    } finally {
      setMemberActionId("");
    }
  }

  async function removeRunner(member: Member) {
    if (!session || session.member.role !== "owner" || memberActionId) return;
    setMemberActionId(member.id);
    setMessage("");
    try {
      const response = await fetch(`/api/members?id=${encodeURIComponent(member.id)}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not remove runner.");
      setSession((current) => (current ? { ...current, members: data.members } : current));
      setMemberEdits((current) => {
        const next = { ...current };
        delete next[member.id];
        return next;
      });
      setMessage(`${member.name} was removed.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not remove runner.");
    } finally {
      setMemberActionId("");
    }
  }

  function downloadExport(type: "json" | "csv") {
    if (session) {
      setExportHistory(recordExportRequest(window.localStorage, session.group.code, type));
    }
    window.location.assign(`/api/exports?type=${type}`);
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

  async function refreshPushStatus() {
    if (!supportsPushNotifications()) {
      setPushStatus("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setPushStatus("denied");
      return;
    }

    const registration = await navigator.serviceWorker.getRegistration("/sw.js").catch(() => null);
    const subscription = await registration?.pushManager.getSubscription().catch(() => null);
    setPushStatus(subscription ? "subscribed" : "off");
  }

  async function togglePushNotifications() {
    if (pushStatus === "busy") return;
    if (!supportsPushNotifications()) {
      setPushStatus("unsupported");
      setMessage("Push alerts need an installed web app or a browser with notification support.");
      return;
    }

    setPushStatus("busy");
    setMessage("");
    let disablingExistingSubscription = false;

    try {
      if (Notification.permission !== "granted") {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setPushStatus(permission === "denied" ? "denied" : "off");
          setMessage("Notifications were not enabled. You can turn them on later from this button.");
          return;
        }
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      const existing = await registration.pushManager.getSubscription();

      if (existing) {
        disablingExistingSubscription = true;
        const response = await fetch("/api/push", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: existing.endpoint }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Could not disable notifications.");
        const unsubscribed = await existing.unsubscribe();
        if (!unsubscribed) throw new Error("Could not disable notifications on this device.");
        setPushStatus("off");
        addToast("Family alerts turned off.", "success");
        return;
      }

      const keyResponse = await fetch("/api/push", { cache: "no-store" });
      const keyData = (await keyResponse.json()) as { publicKey?: string; error?: string };
      if (!keyResponse.ok || !keyData.publicKey) throw new Error(keyData.error || "Could not set up notifications.");
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyData.publicKey),
      });
      const response = await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not save notification subscription.");
      setPushStatus("subscribed");
      addToast("Family run alerts are on.", "success");
    } catch (error) {
      setPushStatus(disablingExistingSubscription ? "subscribed" : "off");
      setMessage(error instanceof Error ? error.message : "Could not enable notifications.");
    }
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
        <AppFooter />
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
      {profileMember && (
        <RunnerProfileModal
          member={profileMember}
          members={members}
          runs={runs}
          stats={stats[profileMember.id] || emptyStats()}
          goalMiles={goalMiles}
          now={metricsNow}
          onClose={() => setProfileMemberId("")}
        />
      )}
      {recapOpen && <WeeklyRecapModal recap={weeklyRecap} challenges={challenges} events={feedEvents} onClose={() => setRecapOpen(false)} />}
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
          <div className={`mobilePane mobilePane--home ${mobileTab === "home" ? "isActive" : ""}`}>
            <section className="panel mobileHeroPanel">
              <div>
                <p className="eyebrow">{session.group.name}</p>
                <h2>Welcome back, {session.member.name}</h2>
                <p className="muted">
                  {hasRuns
                    ? `${formatMiles(myProgress.remaining)} left in your first-to-${formatMiles(goalMiles)} race.`
                    : "Log the first run and the family feed starts here."}
                </p>
              </div>
              <div className="homeProgress">
                <span style={{ width: `${Math.max(3, myProgress.percent)}%` }} />
              </div>
              <div className="homeStatsGrid">
                <HomeStat label="Your total" value={formatMiles(myStats.total)} />
                <HomeStat label="This week" value={formatMiles(myStats.week)} />
                <HomeStat label="Race rank" value={myOverallRank ? `#${myOverallRank}` : "-"} />
                <HomeStat label="Week rank" value={myWeekRank ? `#${myWeekRank}` : "-"} />
              </div>
              <div className="homeActions">
                <button className="primaryButton mobileHeroAction" type="button" onClick={() => switchMobileTab("log")}>
                  Log run
                </button>
                <button className="ghostButton mobileHeroAction" type="button" onClick={() => switchMobileTab("feed")}>
                  View feed
                </button>
              </div>
            </section>

            {groupNeedsFirstRun ? (
              <FirstRunEmptyState
                groupName={session.group.name}
                memberName={session.member.name}
                memberCount={members.length}
                isOwner={isOwner}
                onLog={() => switchMobileTab("log")}
                onGroup={() => switchMobileTab("group")}
              />
            ) : (
              <section className="panel homeRecentPanel">
                <div>
                  <p className="eyebrow">Latest run</p>
                  <h2>{latestRun ? `${latestRun.runner} · ${formatMiles(latestRun.miles)}` : "No runs yet"}</h2>
                  <p className="muted">
                    {latestRun
                      ? `${formatDate(latestRun.date)}${latestRun.durationSeconds ? ` · ${formatPace(latestRun.durationSeconds / latestRun.miles)}` : ""}`
                      : "Be the first one on the board."}
                  </p>
                </div>
                {latestRun?.note && <p className="homeRunNote">{latestRun.note}</p>}
              </section>
            )}

            {!groupNeedsFirstRun && <ChallengeProgressCard challenges={challenges} />}

            {lastUpdatedAt && (
              <p className="syncStatus" aria-live="polite">
                Updated {relativeSyncTime(lastUpdatedAt)}
              </p>
            )}

            {!groupNeedsFirstRun && myComeback && (
              <section className="panel comebackPanel">
                <p className="eyebrow">Comeback meter</p>
                <h2>{comebackTitle(myComeback)}</h2>
                <p className="muted">{comebackBody(myComeback)}</p>
              </section>
            )}

            {!groupNeedsFirstRun && <section className="panel freezePanel">
              <p className="eyebrow">Streak freeze</p>
              <h2>{streakFreezeUsed ? "Freeze used this month" : "Monthly freeze ready"}</h2>
              <p className="muted">
                {streakFreezeUsed
                  ? "Your family mercy rule is marked for this month."
                  : "Use this when life gets in the way and you want one missed day forgiven."}
              </p>
              <button className="ghostButton" type="button" onClick={useStreakFreeze} disabled={streakFreezeUsed}>
                {streakFreezeUsed ? "Already used" : "Use freeze"}
              </button>
            </section>}

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
                      style={{ ...runnerStyle(member, members), width: `${raceProgress(stats[member.id]?.total || 0, goalMiles).percent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            </section>

            {!groupNeedsFirstRun && <section className="panel weeklyPanel">
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
            </section>}

            {!groupNeedsFirstRun && rivalry && (
              <section className="panel rivalryPanel">
                <p className="eyebrow">Rivalry of the week</p>
                <h2>{rivalry.leader.name} vs {rivalry.chaser.name}</h2>
                <p className="muted">
                  {rivalry.chaser.name} needs {formatMiles(rivalry.gap + 0.01)} this week to flip the matchup.
                </p>
              </section>
            )}
          </div>

          <div className={`mobilePane mobilePane--log ${mobileTab === "log" ? "isActive" : ""}`}>
            <section className="panel logPanel">
            <div className="sectionHead">
              <div>
                <p className="eyebrow">Log miles</p>
                <h2>{session.member.name}'s run</h2>
              </div>
              <button className="ghostButton" type="button" onClick={() => void loadRuns()} disabled={loadingRuns}>
                Refresh
              </button>
            </div>
            <form className="runForm" onSubmit={submitRun}>
              <label className="milesField">
                <span className="fieldLabel">Miles</span>
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
              <div className="quickChips wideField" aria-label="Quick mile choices">
                {quickMileOptions.map((option) => (
                  <button className={form.miles === option.value ? "selectedChip" : ""} type="button" key={option.value} onClick={() => applyQuickMiles(option.value)}>
                    {option.label}
                  </button>
                ))}
                {latestOwnRun && (
                  <button type="button" onClick={repeatLastRun}>
                    Repeat last
                  </button>
                )}
              </div>
              <label>
                <span className="fieldLabel">Time</span>
                <input
                  inputMode="numeric"
                  type="text"
                  value={form.duration}
                  onChange={(event) => setForm({ ...form, duration: event.target.value })}
                  placeholder="25:30"
                />
              </label>
              <label>
                <span className="fieldLabel">Date</span>
                <input required type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} />
              </label>
              <label className="wideField">
                <span className="fieldLabel">Note</span>
                <input value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="trail, treadmill, tempo..." />
              </label>
              <div className="quickChips wideField" aria-label="Quick note choices">
                {runNoteOptions.map((note) => (
                  <button className={noteIsSelected(form.note, note) ? "selectedChip" : ""} type="button" key={note} onClick={() => toggleNoteChip(note)}>
                    {note}
                  </button>
                ))}
              </div>
              {(previewPace || form.duration.trim()) && (
                <div className={`pacePreview wideField ${form.duration.trim() && !previewPace ? "pacePreviewError" : ""}`}>
                  <span>{previewPace ? "Pace preview" : "Time format"}</span>
                  <strong>{previewPace || "Use minutes, mm:ss, or h:mm:ss"}</strong>
                </div>
              )}
              {calledShot && (
                <div className="calledShotBanner wideField">
                  <span>Called shot</span>
                  <strong>{formatMiles(calledShot.miles)}</strong>
                  <button type="button" onClick={() => { setCalledShot(null); saveCalledShot(null); }}>
                    Clear
                  </button>
                </div>
              )}
              <button className="ghostButton wideField" type="button" onClick={callShot} disabled={!form.miles}>
                Call this run
              </button>
              <button className="primaryButton" disabled={saving || !form.miles}>
                {saving ? "Saving..." : "Log run"}
              </button>
            </form>
            {message && <p className="notice">{message}</p>}
            </section>
          </div>
        </section>

        <div className={`mobilePane mobilePane--home ${mobileTab === "home" ? "isActive" : ""}`}>
          {pushStatus !== "subscribed" && (
            <NotificationPrompt status={pushStatus} groupName={session.group.name} onToggle={togglePushNotifications} />
          )}

          <WeeklyRecapPanel recap={weeklyRecap} challenges={challenges} events={feedEvents} onOpenFull={() => setRecapOpen(true)} />
        </div>

        <div className={`mobilePane mobilePane--group ${mobileTab === "group" ? "isActive" : ""}`}>
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
              {pushStatus !== "unsupported" && (
                <button
                  className={`ghostButton alertButton ${pushStatus === "subscribed" ? "alertButtonOn" : ""}`}
                  type="button"
                  onClick={togglePushNotifications}
                  disabled={pushStatus === "busy" || pushStatus === "checking" || pushStatus === "denied"}
                >
                  {pushButtonLabel(pushStatus)}
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
          <div className="settingsStatusBlock notificationSettingsBlock">
            <div>
              <p className="eyebrow">Notifications</p>
              <strong>{notificationSettings.title}</strong>
              <span>{notificationSettings.body}</span>
            </div>
            {pushStatus !== "unsupported" && (
              <button
                className={`ghostButton alertButton ${pushStatus === "subscribed" ? "alertButtonOn" : ""}`}
                type="button"
                onClick={togglePushNotifications}
                disabled={pushStatus === "busy" || pushStatus === "checking" || pushStatus === "denied"}
              >
                {pushButtonLabel(pushStatus)}
              </button>
            )}
          </div>
          <div className="settingsStatusBlock installSettingsBlock">
            <div>
              <p className="eyebrow">Install status</p>
              <strong>{installSettings.title}</strong>
              <span>{installSettings.body}</span>
            </div>
          </div>
          <div className="settingsStatusBlock appSettingsBlock">
            <div>
              <p className="eyebrow">App</p>
              <strong>RunComp v{appVersion}</strong>
              <span>{session.member.name} · {session.member.role === "owner" ? "Group owner" : "Runner"} in {session.group.name}</span>
            </div>
          </div>
          <div className="settingsBlock exportSettingsBlock">
            <div>
              <p className="eyebrow">Data export</p>
              <h3>Save a copy</h3>
              <p className="muted">{isOwner ? "Owners can save a recovery backup. Everyone can download spreadsheet runs." : "Download spreadsheet-friendly runs for your group."}</p>
              <p className="exportSafetyNote">Exports leave out passwords and push keys.</p>
            </div>
            <div className="groupActions">
              {isOwner && <button className="ghostButton" type="button" onClick={() => downloadExport("json")}>JSON backup</button>}
              <button className="ghostButton" type="button" onClick={() => downloadExport("csv")}>CSV runs</button>
            </div>
          </div>
          <div className={`exportStatusGrid ${isOwner ? "" : "exportStatusGrid--single"}`} aria-label="Export history">
            {isOwner && (
              <div>
                <span>Last backup request</span>
                <strong>{formatExportTimestamp(exportHistory.json)}</strong>
              </div>
            )}
            <div>
              <span>Last CSV request</span>
              <strong>{formatExportTimestamp(exportHistory.csv)}</strong>
            </div>
          </div>
          <div className="memberGrid">
            <div className="memberList">
              {members.map((member) => (
                <div className={`memberPill ${member.id === session.member.id ? "currentMemberPill" : ""}`} key={member.id}>
                  <div className="memberIdentity">
                    <span className="runnerBadge" style={runnerStyle(member, members)}>{member.name.slice(0, 1)}</span>
                    <div>
                      <strong>{member.name}{member.id === session.member.id && <YouBadge />}</strong>
                      <span>{member.role === "owner" ? "Group owner" : "Runner"}</span>
                      {session.member.role === "owner" && (
                        <span className="memberInviteStatus">
                          {memberCopySuccess[member.id] ? "Login link copied" : memberInviteUrls[member.id] ? "Login link ready" : "No login link yet"}
                        </span>
                      )}
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
                <div className="settingsBlock">
                  <div>
                    <p className="eyebrow">Settings</p>
                    <h3>Owner controls</h3>
                    <p className="muted">Version {appVersion} · notifications {pushStatus === "subscribed" ? "on" : pushStatus}</p>
                  </div>
                </div>
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
                <div className="runnerManager">
                  {members.map((member) => {
                    const edit = memberEdits[member.id] || { name: member.name, password: "" };
                    const busy = memberActionId === member.id;
                    return (
                      <div className="runnerManagerRow" key={member.id}>
                        <div>
                          <strong>{member.name}</strong>
                          <span>{member.role === "owner" ? "Owner" : `${member.runCount || 0} run${member.runCount === 1 ? "" : "s"}`}</span>
                          {member.role !== "owner" && (
                            <span className="runnerRemovalHint">{member.runCount ? "Keep history: cannot remove" : "No runs: can remove"}</span>
                          )}
                        </div>
                        <input
                          value={edit.name}
                          onChange={(event) => setMemberEdits((current) => ({ ...current, [member.id]: { ...edit, name: event.target.value } }))}
                          aria-label={`${member.name} display name`}
                        />
                        <button className="miniButton" type="button" onClick={() => saveMemberName(member)} disabled={busy || edit.name === member.name}>
                          Save name
                        </button>
                        <input
                          type="password"
                          minLength={8}
                          value={edit.password}
                          onChange={(event) => setMemberEdits((current) => ({ ...current, [member.id]: { ...edit, password: event.target.value } }))}
                          placeholder="New password"
                          aria-label={`${member.name} new password`}
                        />
                        <button className="miniButton" type="button" onClick={() => resetRunnerPassword(member)} disabled={busy || edit.password.length < 8}>
                          Reset
                        </button>
                        {member.role !== "owner" && (
                          <button className="miniButton dangerMiniButton" type="button" onClick={() => removeRunner(member)} disabled={busy || Boolean(member.runCount)}>
                            Remove
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          </section>
        </div>

        <div className={`mobilePane mobilePane--group ${mobileTab === "group" ? "isActive" : ""}`}>
          <section className="runnerGrid">
          <div className="lineupHeader">
            <div>
              <p className="eyebrow">Runner cards</p>
              <h2>Family lineup</h2>
            </div>
            <span>{members.length} runner{members.length === 1 ? "" : "s"} · sorted by total miles</span>
          </div>
          {standings.map((member, index) => (
            <RunnerCard
              key={member.id}
              member={member}
              members={members}
              runs={runs}
              stats={stats[member.id] || emptyStats()}
              goalMiles={goalMiles}
              isCurrentUser={member.id === session.member.id}
              raceRank={index + 1}
              weekRank={weekStandings.findIndex((row) => row.id === member.id) + 1}
              comeback={comebackTargets.find((target) => target.memberId === member.id)}
              now={metricsNow}
              onOpenProfile={() => setProfileMemberId(member.id)}
            />
          ))}
          </section>
        </div>

        <div className={`mobilePane mobilePane--feed ${mobileTab === "feed" ? "isActive" : ""}`}>
          <section className="panel chartPanel">
          <div className="sectionHead">
            <div>
              <p className="eyebrow">Last 14 days</p>
              <h2>Daily mileage</h2>
              <p className="muted">
                {chartTotalMiles > 0
                  ? `${formatMiles(chartTotalMiles)} logged across the last two weeks.`
                  : "Log runs and this chart will light up."}
              </p>
            </div>
            <div className="legend">
              {members.map((member) => (
                <span key={member.id}><i className="dot" style={runnerStyle(member, members)} />{member.name}</span>
              ))}
            </div>
          </div>
          <div className="chartStats" aria-label="Chart summary">
            <div>
              <span>Total</span>
              <strong>{formatMiles(chartTotalMiles)}</strong>
            </div>
            <div>
              <span>Best day</span>
              <strong>{bestChartDay ? `${bestChartDay.label} · ${formatMiles(chartMaxTotal)}` : "-"}</strong>
            </div>
            <div>
              <span>Active days</span>
              <strong>{chartTotals.filter((total) => total > 0).length}/14</strong>
            </div>
          </div>
          <div className="activityChart" aria-label="Stacked daily mileage chart">
            {chartDays.map((day) => {
              const total = chartDayTotal(day, members);
              const height = total > 0 ? Math.max(10, (total / chartMaxTotal) * 100) : 2;
              return (
                <div className={`activityDay ${total > 0 ? "hasMiles" : ""} ${day.date === todayKey ? "isToday" : ""}`} key={day.date}>
                  <div className="activityColumn">
                    {total > 0 && <span className="dayTotal">{formatMiles(total)}</span>}
                    <div className="stackedBar" style={{ height: `${height}%` }} title={`${day.label}: ${formatMiles(total)}`}>
                      {members.map((member) => {
                        const miles = day.totals[member.id] || 0;
                        if (miles <= 0) return null;
                        return (
                          <span
                            className="stackSegment"
                            key={member.id}
                            style={{ ...runnerStyle(member, members), flexGrow: miles }}
                            title={`${member.name}: ${formatMiles(miles)}`}
                          />
                        );
                      })}
                    </div>
                  </div>
                  <span className="dayLabel">{day.label}</span>
                </div>
              );
            })}
          </div>
          </section>

          <section className="panel feedPanel">
          <div className="sectionHead">
            <div>
              <p className="eyebrow">Recent activity</p>
              <h2>Run log</h2>
            </div>
            <span className="muted">{runs.length} entries</span>
            {lastUpdatedAt && <span className="muted syncInline">Updated {relativeSyncTime(lastUpdatedAt)}</span>}
          </div>
          {loadingRuns ? (
            <p className="empty">Loading runs...</p>
          ) : runs.length === 0 ? (
            <div className="feedEmptyState">
              <strong>Nothing in the family feed yet</strong>
              <p>{feedEmptyCopy}</p>
              <button className="primaryButton" type="button" onClick={() => switchMobileTab("log")}>
                Log first run
              </button>
            </div>
          ) : (
            <div className="feedStack">
              {feedEvents.length > 0 && <FeedEventList events={feedEvents} />}
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
            </div>
          )}
          </section>
        </div>
        <MobileTabBar activeTab={mobileTab} onChange={switchMobileTab} />
        <AppFooter />
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
        <AppFooter />
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
      <AppFooter />
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

function AppFooter() {
  return (
    <footer className="appFooter">
      <span>RunComp v{appVersion}</span>
    </footer>
  );
}

function MobileTabBar({ activeTab, onChange }: { activeTab: MobileTab; onChange: (tab: MobileTab) => void }) {
  return (
    <nav className="mobileTabBar" aria-label="RunComp sections">
      {mobileTabs.map((tab) => (
        <button className={activeTab === tab.id ? "activeMobileTab" : ""} type="button" key={tab.id} onClick={() => onChange(tab.id)}>
          <MobileTabIcon tab={tab.id} />
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}

function MobileTabIcon({ tab }: { tab: MobileTab }) {
  if (tab === "log") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 5v14M5 12h14" />
      </svg>
    );
  }

  if (tab === "feed") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 7h12M6 12h12M6 17h7" />
      </svg>
    );
  }

  if (tab === "group") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM4 19c.5-3 2-5 4-5s3.5 2 4 5M12 19c.5-3 2-5 4-5s3.5 2 4 5" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 12 12 5l8 7M6 11v8h12v-8" />
    </svg>
  );
}

function HomeStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="homeStat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function FirstRunEmptyState({
  groupName,
  memberName,
  memberCount,
  isOwner,
  onLog,
  onGroup,
}: {
  groupName: string;
  memberName: string;
  memberCount: number;
  isOwner: boolean;
  onLog: () => void;
  onGroup: () => void;
}) {
  return (
    <section className="panel firstRunPanel">
      <div className="firstRunBadge" aria-hidden="true">0.0</div>
      <div className="firstRunCopy">
        <p className="eyebrow">New group</p>
        <h2>{groupName} is at the starting line</h2>
        <p className="muted">
          {memberName}, log the first run to unlock the feed, weekly recap, runner cards, reactions, and race standings.
        </p>
      </div>
      <div className="firstRunSteps" aria-label="Start checklist">
        <span className="isReady">Group created</span>
        <span className={memberCount > 1 ? "isReady" : ""}>{memberCount > 1 ? `${memberCount} runners added` : "Add family runners"}</span>
        <span>First run waiting</span>
      </div>
      <div className="firstRunActions">
        <button className="primaryButton" type="button" onClick={onLog}>
          Log first run
        </button>
        {isOwner && (
          <button className="ghostButton" type="button" onClick={onGroup}>
            Invite runners
          </button>
        )}
      </div>
    </section>
  );
}

function NotificationPrompt({ status, groupName, onToggle }: { status: PushStatus; groupName: string; onToggle: () => void }) {
  const copy = notificationPromptCopy(status, groupName);
  const canToggle = status === "off";
  const isWorking = status === "busy" || status === "checking";

  return (
    <section className={`panel notificationPanel notificationPanel--${status}`}>
      <div className="notificationIcon" aria-hidden="true">
        {status === "denied" ? "!" : status === "unsupported" ? "i" : "On"}
      </div>
      <div className="notificationCopy">
        <p className="eyebrow">{copy.eyebrow}</p>
        <h2>{copy.title}</h2>
        <p className="muted">{copy.body}</p>
        {copy.steps && (
          <ol className="notificationSteps">
            {copy.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        )}
      </div>
      <div className="notificationActions">
        <span className={`notificationStatus notificationStatus--${status}`}>{copy.status}</span>
        <button className="primaryButton notificationButton" type="button" onClick={onToggle} disabled={!canToggle || isWorking}>
          {copy.action}
        </button>
      </div>
    </section>
  );
}

function notificationPromptCopy(status: PushStatus, groupName: string) {
  if (status === "checking") {
    return {
      eyebrow: "Run alerts",
      title: "Checking this device",
      body: "RunComp is checking whether this device can receive group run notifications.",
      status: "Checking",
      action: "Checking...",
    };
  }

  if (status === "busy") {
    return {
      eyebrow: "Run alerts",
      title: "Turning alerts on",
      body: "Approve the browser prompt to get notified when your group logs runs.",
      status: "Working",
      action: "Turning on...",
    };
  }

  if (status === "denied") {
    return {
      eyebrow: "Run alerts",
      title: "Notifications are blocked",
      body: "RunComp cannot ask again from here. Allow notifications for this site in device or browser settings, then return to this screen.",
      status: "Blocked",
      action: "Blocked in settings",
    };
  }

  if (status === "unsupported") {
    const onIosBrowser = isIosDevice() && !isStandaloneApp();
    return {
      eyebrow: "Run alerts",
      title: onIosBrowser ? "Open RunComp from your Home Screen" : "Notifications are not available here",
      body: onIosBrowser
        ? "iPhone push alerts work from the installed Home Screen app. Add RunComp there, open that icon, then enable alerts."
        : "This browser or device does not expose web push notifications to RunComp.",
      status: onIosBrowser ? "Home Screen needed" : "Unavailable",
      action: onIosBrowser ? "Needs Home Screen app" : "Unavailable",
      steps: onIosBrowser ? ["Tap Share in Safari.", "Choose Add to Home Screen.", "Open RunComp from the new icon."] : undefined,
    };
  }

  return {
    eyebrow: "Run alerts",
    title: "Turn on group notifications",
    body: `Get a notification on this device when anyone in ${groupName} logs a run.`,
    status: "Off",
    action: "Turn on notifications",
  };
}

function notificationSettingsCopy(status: PushStatus) {
  switch (status) {
    case "checking":
      return {
        title: "Checking this device",
        body: "RunComp is checking this browser's alert subscription.",
      };
    case "busy":
      return {
        title: "Updating alerts",
        body: "RunComp is updating this device's push subscription.",
      };
    case "subscribed":
      return {
        title: "Alerts are on",
        body: "This device is subscribed to run, lead-change, close-call, and challenge alerts.",
      };
    case "denied":
      return {
        title: "Alerts are blocked",
        body: "Allow notifications in browser or device settings, then return to RunComp.",
      };
    case "unsupported":
      return {
        title: "Alerts are unavailable",
        body: isIosDevice() && !isStandaloneApp() ? "Install RunComp to the Home Screen, then open that icon to enable iPhone alerts." : "This browser or device does not support RunComp push alerts.",
      };
    default:
      return {
        title: "Alerts are off",
        body: "Turn on alerts on this device to hear about family runs and race changes.",
      };
  }
}

function installSettingsCopy() {
  if (isStandaloneApp()) {
    return {
      title: "Opening like an app",
      body: "RunComp is running from an installed app window on this device.",
    };
  }

  if (isIosDevice()) {
    return {
      title: "Browser mode",
      body: "Add RunComp to the Home Screen for app-style launch and iPhone push alerts.",
    };
  }

  return {
    title: "Browser mode",
    body: "RunComp can be installed from this browser's app or install menu when supported.",
  };
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

function readCalledShot(): CalledShot | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(calledShotKey) || "null") as Partial<CalledShot> | null;
    if (!parsed || typeof parsed.miles !== "number" || !Number.isFinite(parsed.miles) || parsed.miles <= 0 || typeof parsed.setAt !== "string") {
      return null;
    }
    return { miles: parsed.miles, setAt: parsed.setAt };
  } catch {
    return null;
  }
}

function saveCalledShot(shot: CalledShot | null) {
  if (typeof window === "undefined") return;
  try {
    if (!shot) {
      window.localStorage.removeItem(calledShotKey);
      return;
    }
    window.localStorage.setItem(calledShotKey, JSON.stringify(shot));
  } catch {
    // Called shots are local convenience state only.
  }
}

function readStreakFreezeUsed() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(streakFreezeKey()) === "true";
  } catch {
    return false;
  }
}

function saveStreakFreezeUsed() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(streakFreezeKey(), "true");
  } catch {
    // Streak freeze is local fun state only.
  }
}

function streakFreezeKey() {
  const now = new Date();
  return `${streakFreezePrefix}${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function relativeSyncTime(value: Date) {
  const seconds = Math.max(0, Math.floor((Date.now() - value.getTime()) / 1000));
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ago`;
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

function supportsPushNotifications() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

function pushButtonLabel(status: PushStatus) {
  switch (status) {
    case "checking":
      return "Checking alerts...";
    case "busy":
      return "Updating alerts...";
    case "subscribed":
      return "Alerts on";
    case "denied":
      return "Alerts blocked";
    case "unsupported":
      return "Alerts unavailable";
    case "off":
      return "Turn on alerts";
    default:
      return "Turn on alerts";
  }
}

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) {
    output[index] = raw.charCodeAt(index);
  }
  return output;
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

function formatDurationForInput(seconds: number) {
  const rounded = Math.max(1, Math.round(seconds));
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const remainingSeconds = rounded % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function noteIsSelected(value: string, note: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .includes(note);
}

function RunnerCard({
  member,
  members,
  runs,
  stats,
  goalMiles,
  isCurrentUser,
  raceRank,
  weekRank,
  comeback,
  now,
  onOpenProfile,
}: {
  member: Member;
  members: Member[];
  runs: RunEntry[];
  stats: RunnerStats;
  goalMiles: number;
  isCurrentUser: boolean;
  raceRank: number;
  weekRank: number;
  comeback?: ComebackTarget;
  now: Date;
  onOpenProfile: () => void;
}) {
  const badges = buildBadges(stats, runs, member.id, now);
  const progress = raceProgress(stats.total, goalMiles);
  const strip = buildStreakStrip(runs, member.id, now);
  const heatmap = buildHeatmapWeeks(runs, member.id);
  const cardColor = colorForMember(member, members);
  const nickname = runnerTitle(stats, runs, member.id);
  const rarity = runnerCardRarity(stats, badges);
  const runnerRuns = runs.filter((run) => run.memberId === member.id);
  const biggestWeek = biggestWeeklyTotal(runnerRuns);
  return (
    <section className={`panel runnerCard runnerCard--${rarity} ${isCurrentUser ? "currentRunnerCard" : ""}`} style={{ "--runner-color": cardColor } as CSSProperties}>
      <div className="playerCardTop">
        <span>RC-{String(raceRank).padStart(2, "0")}</span>
        <span>{rarityLabel(rarity)}</span>
      </div>
      <div className="playerCardHero">
        <div className="playerPortrait" aria-hidden="true">
          <span>{initialsForName(member.name)}</span>
          <strong>#{raceRank}</strong>
        </div>
        <div className="playerIdentity">
          <p className="eyebrow">Race rank #{raceRank}{isCurrentUser && <YouBadge />}</p>
          <h2>{member.name}</h2>
          <div className="playerTags">
            <span>{nickname}</span>
            <span>Week #{weekRank || "-"}</span>
            <span>{stats.streak} day streak</span>
          </div>
        </div>
      </div>
      <div className="cardTotalBlock">
        <span>Total miles</span>
        <strong><AnimatedMiles value={stats.total} /></strong>
        <small>{formatMiles(progress.remaining)} to goal</small>
      </div>
      <div className="goalMeter" aria-label={`${member.name} race progress`}>
        <span style={{ width: `${Math.max(3, progress.percent)}%` }} />
      </div>
      <div className="cardStatGrid">
        <CardStat label="Week" value={formatMiles(stats.week)} />
        <CardStat label="Month" value={formatMiles(stats.month)} />
        <CardStat label="Runs" value={String(stats.runCount)} />
        <CardStat label="Avg" value={formatMiles(stats.average)} />
        <CardStat label="Long" value={formatMiles(stats.longest)} />
        <CardStat label="Pace" value={formatPace(stats.averagePace)} />
      </div>
      <div className="cardFinePrint">
        <span>Best pace: <strong>{formatPace(stats.bestPace)}</strong></span>
        <span>Timed: <strong>{stats.timedRunCount ? `${stats.timedRunCount} · ${formatMiles(stats.timedMiles)}` : "-"}</strong></span>
      </div>
      {comeback && (
        <div className="cardComeback">
          <span>Comeback</span>
          <strong>{comebackTitle(comeback)}</strong>
          <small>{comebackBody(comeback)}</small>
        </div>
      )}
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
      <button className="ghostButton profileButton" type="button" onClick={onOpenProfile}>
        View profile
      </button>
      <details className="cardBack">
        <summary>Card back</summary>
        <div className="cardBackGrid">
          <CardStat label="Longest" value={formatMiles(stats.longest)} />
          <CardStat label="Best pace" value={formatPace(stats.bestPace)} />
          <CardStat label="Big week" value={formatMiles(biggestWeek)} />
          <CardStat label="Collection" value={rarityLabel(rarity)} />
        </div>
        <p>{member.name}'s title is {nickname}. {badges.length ? `${badges.length} achievement${badges.length === 1 ? "" : "s"} unlocked.` : "First achievement is still waiting."}</p>
      </details>
      <p className="lastRun">{stats.lastRun ? `Last run: ${formatDate(stats.lastRun)}` : "No runs logged yet"}</p>
    </section>
  );
}

function ChallengeProgressCard({ challenges }: { challenges: FamilyChallenge[] }) {
  const completeCount = challenges.filter((challenge) => challenge.complete).length;
  const featured = challenges.find((challenge) => !challenge.complete) || challenges[0];
  if (!featured) return null;

  return (
    <section className="panel challengePanel">
      <div className="sectionHead">
        <div>
          <p className="eyebrow">Family challenges</p>
          <h2>{completeCount}/{challenges.length} complete this week</h2>
          <p className="muted">{featured.complete ? "Everything active is checked off. Keep stacking miles." : featured.body}</p>
        </div>
        <span className={`challengeStatus ${featured.complete ? "isComplete" : ""}`}>{featured.complete ? "Complete" : "Active"}</span>
      </div>
      <div className="challengeList">
        {challenges.map((challenge) => (
          <article className={`challengeItem challengeItem--${challenge.tone} ${challenge.complete ? "isComplete" : ""}`} key={challenge.id}>
            <div>
              <strong>{challenge.title}</strong>
              <span>{challenge.winner ? `${challenge.winner} leads` : challenge.label}</span>
            </div>
            <div className="challengeMeter" aria-label={`${challenge.title} progress`}>
              <span style={{ width: `${Math.max(4, challenge.progress)}%` }} />
            </div>
            <small>
              {challenge.type === "weekly-mileage" || challenge.type === "beat-last-week"
                ? `${formatMiles(challenge.value)} / ${formatMiles(challenge.target)}`
                : `${challenge.value} / ${challenge.target}`}
            </small>
          </article>
        ))}
      </div>
    </section>
  );
}

function rarityLabel(rarity: CardRarity) {
  if (rarity === "legend") return "Legend card";
  if (rarity === "epic") return "Epic card";
  if (rarity === "rare") return "Rare card";
  return "Base card";
}

function biggestWeeklyTotal(runs: RunEntry[]) {
  const totals = new Map<string, number>();
  for (const run of runs) {
    const week = weekKey(run.date);
    totals.set(week, (totals.get(week) || 0) + run.miles);
  }
  return Math.max(0, ...totals.values());
}

function weekKey(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  const day = parsed.getDay();
  const diff = day === 0 ? 6 : day - 1;
  parsed.setDate(parsed.getDate() - diff);
  return parsed.toISOString().slice(0, 10);
}

function CardStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="cardStat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function WeeklyRecapPanel({
  recap,
  challenges,
  events,
  onOpenFull,
}: {
  recap: WeeklyRecap;
  challenges: FamilyChallenge[];
  events: FeedEvent[];
  onOpenFull: () => void;
}) {
  const hasRuns = recap.runCount > 0;
  const completedChallenges = challenges.filter((challenge) => challenge.complete);
  const recapEvents = events.filter((event) => event.type === "challenge" || event.type === "lead-change" || event.type === "achievement").slice(0, 4);
  return (
    <section className="panel recapPanel recapScreen">
      <div className="sectionHead">
        <div>
          <p className="eyebrow">Weekly recap</p>
          <h2>{hasRuns ? `${formatMiles(recap.totalMiles)} as a family` : "Fresh week"}</h2>
          <p className="muted">
            {hasRuns
              ? recap.headline
              : `No runs logged yet for ${recap.weekLabel}.`}
          </p>
          {hasRuns && (
            <p className="recapMeta">
              {recap.runCount} run{recap.runCount === 1 ? "" : "s"} from {recap.activeRunnerCount} runner{recap.activeRunnerCount === 1 ? "" : "s"} · {recap.weekLabel}
            </p>
          )}
        </div>
        <div className="recapActions">
          {recap.topRunner && <span className="recapRibbon">{recap.topRunner.name} owns the week</span>}
          <button className="ghostButton" type="button" onClick={onOpenFull}>
            Open recap
          </button>
        </div>
      </div>
      {hasRuns ? (
        <div className="recapGrid">
          <RecapCard label="Top runner" value={recap.topRunner ? `${recap.topRunner.name} · ${formatMiles(recap.topRunner.miles)}` : "-"} detail="Most miles this week" />
          <RecapCard
            label="Biggest run"
            value={recap.biggestRun ? `${recap.biggestRun.runner} · ${formatMiles(recap.biggestRun.miles)}` : "-"}
            detail={recap.biggestRun?.note || "Single-run high score"}
          />
          <RecapCard
            label="Most consistent"
            value={recap.mostConsistent ? `${recap.mostConsistent.name} · ${recap.mostConsistent.runCount}` : "-"}
            detail={`run${recap.mostConsistent?.runCount === 1 ? "" : "s"} logged`}
          />
          <RecapCard
            label="Crowd favorite"
            value={recap.crowdFavorite ? `${recap.crowdFavorite.runner} · ${recap.crowdFavorite.reactionCount}` : "-"}
            detail={recap.crowdFavorite?.note || "No reactions yet"}
          />
          {recap.fastestPace && <RecapCard label="Fastest pace" value={`${recap.fastestPace.name} · ${formatPace(recap.fastestPace.secondsPerMile)}`} detail="Timed runs only" />}
          {recap.mostImproved && <RecapCard label="Most improved" value={`${recap.mostImproved.name} · +${formatMiles(recap.mostImproved.deltaMiles)}`} detail="Compared with last week" />}
          {recap.bestStreak && <RecapCard label="Best streak" value={`${recap.bestStreak.name} · ${recap.bestStreak.days}`} detail="Current streak leader" />}
          <RecapCard label="Challenges" value={`${completedChallenges.length}/${challenges.length}`} detail={completedChallenges[0]?.title || "No challenge winners yet"} />
        </div>
      ) : (
        <div className="recapEmpty">
          <strong>Weekly recap unlocks after the first run</strong>
          <p>Once somebody logs miles, this turns into the family highlight reel for {recap.weekLabel}.</p>
        </div>
      )}
      {hasRuns && recapEvents.length > 0 && (
        <div className="recapMoments">
          <p className="eyebrow">Recap moments</p>
          <FeedEventList events={recapEvents} limit={4} />
        </div>
      )}
    </section>
  );
}

function WeeklyRecapModal({
  recap,
  challenges,
  events,
  onClose,
}: {
  recap: WeeklyRecap;
  challenges: FamilyChallenge[];
  events: FeedEvent[];
  onClose: () => void;
}) {
  const completedChallenges = challenges.filter((challenge) => challenge.complete);
  const moments = events.filter((event) => event.type !== "weekly-recap").slice(0, 8);

  return (
    <div className="modalLayer" role="dialog" aria-modal="true" aria-labelledby="weekly-recap-title">
      <section className="weeklyRecapModal">
        <div className="sectionHead">
          <div>
            <p className="eyebrow">Weekly recap</p>
            <h2 id="weekly-recap-title">{recap.runCount > 0 ? recap.headline : "Fresh week"}</h2>
            <p className="muted">{recap.weekLabel} · {recap.runCount} run{recap.runCount === 1 ? "" : "s"} · {formatMiles(recap.totalMiles)}</p>
          </div>
          <button className="ghostButton" type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="recapGrid">
          <RecapCard label="Family total" value={formatMiles(recap.totalMiles)} detail={`${recap.activeRunnerCount} active runner${recap.activeRunnerCount === 1 ? "" : "s"}`} />
          <RecapCard label="Top runner" value={recap.topRunner ? `${recap.topRunner.name} · ${formatMiles(recap.topRunner.miles)}` : "-"} detail="Most miles this week" />
          <RecapCard label="Biggest run" value={recap.biggestRun ? `${recap.biggestRun.runner} · ${formatMiles(recap.biggestRun.miles)}` : "-"} detail={recap.biggestRun?.note || "Single-run high score"} />
          <RecapCard label="Challenges" value={`${completedChallenges.length}/${challenges.length}`} detail={completedChallenges.map((challenge) => challenge.title).join(", ") || "No challenge winners yet"} />
          {recap.mostImproved && <RecapCard label="Most improved" value={`${recap.mostImproved.name} · +${formatMiles(recap.mostImproved.deltaMiles)}`} detail="Compared with last week" />}
          {recap.bestStreak && <RecapCard label="Best streak" value={`${recap.bestStreak.name} · ${recap.bestStreak.days}`} detail="Current streak leader" />}
          {recap.crowdFavorite && <RecapCard label="Crowd favorite" value={`${recap.crowdFavorite.runner} · ${recap.crowdFavorite.reactionCount}`} detail={recap.crowdFavorite.note || "Most reactions"} />}
        </div>
        {moments.length > 0 && (
          <div className="recapMoments">
            <p className="eyebrow">Feed-style moments</p>
            <FeedEventList events={moments} limit={8} />
          </div>
        )}
      </section>
    </div>
  );
}

function RecapCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="recapCard">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function FeedEventList({ events, limit = 6 }: { events: FeedEvent[]; limit?: number }) {
  return (
    <div className="eventList" aria-label="Family feed events">
      {events.slice(0, limit).map((event) => (
        <article className={`eventRow eventRow--${event.tone}`} key={event.id}>
          <span className="eventIcon" aria-hidden="true">{eventIcon(event.type)}</span>
          <div>
            <strong>{event.title}</strong>
            <p>{event.body}</p>
          </div>
          <time>{formatDate(event.date)}</time>
        </article>
      ))}
    </div>
  );
}

function eventIcon(type: FeedEvent["type"]) {
  if (type === "lead-change") return "↑";
  if (type === "streak") return "🔥";
  if (type === "achievement") return "★";
  if (type === "challenge") return "✓";
  if (type === "weekly-recap") return "↺";
  return "🏁";
}

function RunnerProfileModal({
  member,
  members,
  runs,
  stats,
  goalMiles,
  now,
  onClose,
}: {
  member: Member;
  members: Member[];
  runs: RunEntry[];
  stats: RunnerStats;
  goalMiles: number;
  now: Date;
  onClose: () => void;
}) {
  const memberRuns = runs.filter((run) => run.memberId === member.id);
  const badges = buildBadges(stats, runs, member.id, now);
  const progress = raceProgress(stats.total, goalMiles);
  const biggestWeek = biggestWeeklyTotal(memberRuns);
  const recent = buildStreakStrip(runs, member.id, now, 14);
  const recentMileageTrend = buildRecentMileageTrend(runs, member.id, now);
  const recentActiveDays = recent.filter((day) => day.ran).length;
  const headToHead = buildHeadToHeadComparisons(runs, members, member.id).slice(0, 3);
  const hasProfileRuns = memberRuns.length > 0;
  const title = runnerTitle(stats, runs, member.id);
  const rarity = runnerCardRarity(stats, badges);

  return (
    <div className="modalLayer" role="dialog" aria-modal="true" aria-labelledby="runner-profile-title">
      <section className={`runnerProfileModal runnerProfileModal--${rarity}`} style={runnerStyle(member, members)}>
        <div className="sectionHead">
          <div>
            <p className="eyebrow">Runner profile</p>
            <h2 id="runner-profile-title">{member.name}</h2>
            <div className="profileIdentityLine">
              <span>{title}</span>
              <span>{rarityLabel(rarity)}</span>
            </div>
            <p className="muted">{formatMiles(progress.remaining)} left in the race.</p>
          </div>
          <button className="ghostButton" type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="profileSummary">
          <strong>{hasProfileRuns ? `${memberRuns.length} logged run${memberRuns.length === 1 ? "" : "s"}` : "No runs logged yet"}</strong>
          <span>
            {hasProfileRuns
              ? `${recentActiveDays}/14 recent days active · ${formatMiles(stats.average)} average run`
              : "The first run will unlock records, trends, badges, and recap moments."}
          </span>
        </div>
        <div className="profileRecordGrid">
          <CardStat label="Longest run" value={formatMiles(stats.longest)} />
          <CardStat label="Fastest pace" value={formatPace(stats.bestPace)} />
          <CardStat label="Biggest week" value={formatMiles(biggestWeek)} />
          <CardStat label="Best streak" value={`${stats.streak} day${stats.streak === 1 ? "" : "s"}`} />
        </div>
        <div>
          <p className="eyebrow">Recent trend</p>
          <p className="profileTrendSummary">{recentTrendCopy(recentMileageTrend)}</p>
          <div className="profileTrend">
            {recent.map((day) => (
              <span className={day.ran ? "ran" : ""} title={day.date} key={day.date}>{day.label}</span>
            ))}
          </div>
        </div>
        {members.length > 1 && (
          <div>
            <p className="eyebrow">Head to head</p>
            {headToHead.length > 0 ? (
              <div className="profileMatchups">
                {headToHead.map((comparison) => (
                  <div className={`profileMatchup profileMatchup--${comparison.status}`} key={comparison.opponentId}>
                    <strong>{comparison.opponentName}</strong>
                    <span>{headToHeadCopy(comparison.status, comparison.gap, comparison.milesToPass)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="profileEmptyState">Add another runner to compare totals.</p>
            )}
          </div>
        )}
        <div>
          <p className="eyebrow">Achievement shelf</p>
          {badges.length > 0 ? <BadgeStrip badges={badges} /> : <p className="profileEmptyState">No achievements yet. Log a run to start the shelf.</p>}
        </div>
      </section>
    </div>
  );
}

function headToHeadCopy(status: "ahead" | "behind" | "tied", gap: number, milesToPass?: number) {
  if (status === "ahead") return `${formatMiles(gap)} ahead`;
  if (status === "behind") return `${formatMiles(milesToPass || gap)} to pass`;
  return "Tied on miles";
}

function recentTrendCopy(trend: RecentMileageTrend) {
  if (trend.recentMiles === 0 && trend.previousMiles === 0) return "No mileage in the last two weeks yet.";
  if (trend.direction === "up") return `${formatMiles(trend.recentMiles)} in 7 days, up ${formatMiles(Math.abs(trend.deltaMiles))}.`;
  if (trend.direction === "down") return `${formatMiles(trend.recentMiles)} in 7 days, down ${formatMiles(Math.abs(trend.deltaMiles))}.`;
  return `${formatMiles(trend.recentMiles)} in 7 days, matching the prior week.`;
}

function comebackTitle(comeback: ComebackTarget) {
  if (comeback.isLeader) return "Holding first place";
  return `${formatMiles(comeback.milesToPass || 0.01)} to pass ${comeback.targetName}`;
}

function comebackBody(comeback: ComebackTarget) {
  if (comeback.isLeader) return comeback.leaderGap > 0 ? "Protect the lead and make everyone chase." : "Set the pace for the family.";
  return `${comeback.name} is ${formatMiles(comeback.leaderGap)} behind the leader.`;
}

const reactionLabels: Record<ReactionType, string> = {
  fire: "Fire",
  nice: "Nice",
  brutal: "Brutal",
  sus: "Sus",
  respect: "Respect",
  catching: "Catching up",
  monster: "Monster run",
  suspicious: "Suspicious pace",
};

const reactionIcons: Record<ReactionType, string> = {
  fire: "🔥",
  nice: "👏",
  brutal: "💀",
  sus: "👀",
  respect: "🫡",
  catching: "🏃",
  monster: "💪",
  suspicious: "🕵️",
};

function ReactionBar({ reactions, onReact }: { reactions: RunReaction[]; onReact: (reaction: ReactionType) => void }) {
  return (
    <div className="reactionBar" aria-label="Run reactions">
      {reactions.map((reaction) => {
        const label = reactionLabels[reaction.type];
        return (
          <button
            className={reaction.reactedByMe ? "reacted" : ""}
            type="button"
            key={reaction.type}
            onClick={() => onReact(reaction.type)}
            title={label}
            aria-label={`${label} reaction${reaction.count > 0 ? `, ${reaction.count}` : ""}`}
            aria-pressed={reaction.reactedByMe}
          >
            <span className="reactionEmoji" aria-hidden="true">{reactionIcons[reaction.type]}</span>
            {reaction.count > 0 && <strong>{reaction.count}</strong>}
          </button>
        );
      })}
    </div>
  );
}

function emptyReactions(): RunReaction[] {
  return (["fire", "nice", "brutal", "sus", "respect", "catching", "monster", "suspicious"] as ReactionType[]).map((type) => ({
    type,
    count: 0,
    reactedByMe: false,
  }));
}

function sameRunList(current: RunEntry[], next: RunEntry[]) {
  if (current.length !== next.length) return false;
  return current.every((run, index) => sameRun(run, next[index]));
}

function sameRun(current: RunEntry, next: RunEntry) {
  return (
    current.id === next.id &&
    current.memberId === next.memberId &&
    current.runner === next.runner &&
    current.miles === next.miles &&
    current.durationSeconds === next.durationSeconds &&
    current.date === next.date &&
    current.note === next.note &&
    current.createdAt === next.createdAt &&
    sameReactions(current.reactions || emptyReactions(), next.reactions || emptyReactions())
  );
}

function sameReactions(current: RunReaction[], next: RunReaction[]) {
  if (current.length !== next.length) return false;
  return current.every((reaction, index) => {
    const nextReaction = next[index];
    return reaction.type === nextReaction.type && reaction.count === nextReaction.count && reaction.reactedByMe === nextReaction.reactedByMe;
  });
}

function chartDayTotal(day: { totals: Record<string, number> }, members: Member[]) {
  return members.reduce((sum, member) => sum + (day.totals[member.id] || 0), 0);
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

function runnerStyle(member: Member, members: Member[]) {
  return { "--runner-color": colorForMember(member, members) } as CSSProperties;
}

function initialsForName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join("");
}

function colorForMember(member: Member, members: Member[]) {
  const index = members.findIndex((row) => row.id === member.id);
  return palette[Math.max(0, index) % palette.length];
}
