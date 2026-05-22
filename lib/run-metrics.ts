export type MetricMember = {
  id: string;
  name: string;
};

export type MetricRunEntry = {
  id: string;
  memberId: string;
  runner?: string;
  miles: number;
  durationSeconds?: number;
  date: string;
  note?: string;
  createdAt: string;
};

export type RunnerStats = {
  total: number;
  week: number;
  month: number;
  runCount: number;
  average: number;
  longest: number;
  timedRunCount: number;
  timedMiles: number;
  totalSeconds: number;
  averagePace: number | null;
  bestPace: number | null;
  streak: number;
  lastRun?: string;
};

export type AchievementBadge = {
  id: string;
  label: string;
  tone: "gold" | "green" | "rose" | "blue";
};

export function buildBadges(stats: RunnerStats): AchievementBadge[] {
  const badges: AchievementBadge[] = [];
  if (stats.runCount > 0) badges.push({ id: "first-run", label: "First run", tone: "green" });
  if (stats.week >= 10) badges.push({ id: "ten-mile-week", label: "10 mi week", tone: "blue" });
  if (stats.longest >= 6.2) badges.push({ id: "ten-k-pr", label: "10K run", tone: "rose" });
  if (stats.total >= 25) badges.push({ id: "twenty-five", label: "25 total", tone: "gold" });
  if (stats.total >= 50) badges.push({ id: "fifty", label: "50 total", tone: "gold" });
  if (stats.streak >= 3) badges.push({ id: "three-streak", label: "3-day streak", tone: "rose" });
  if (stats.streak >= 7) badges.push({ id: "seven-streak", label: "7-day streak", tone: "rose" });
  return badges;
}

export function raceProgress(total: number, goalMiles: number) {
  const safeGoal = Math.max(1, goalMiles);
  return {
    percent: Math.min(100, (total / safeGoal) * 100),
    remaining: Math.max(0, safeGoal - total),
    complete: total >= safeGoal,
  };
}

export function buildStats(
  runs: MetricRunEntry[],
  members: MetricMember[],
  now = new Date(),
): Record<string, RunnerStats> {
  const weekStart = startOfWeek(now);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  return members.reduce(
    (all, member) => {
      const runnerRuns = runs.filter((run) => run.memberId === member.id);
      const timedRuns = runnerRuns.filter(hasRunTime);
      const total = sumMiles(runnerRuns);
      const timedMiles = sumMiles(timedRuns);
      const totalSeconds = timedRuns.reduce((sum, run) => sum + run.durationSeconds, 0);
      all[member.id] = {
        total,
        week: sumMiles(runnerRuns.filter((run) => parseRunDate(run.date) >= weekStart)),
        month: sumMiles(runnerRuns.filter((run) => parseRunDate(run.date) >= monthStart)),
        runCount: runnerRuns.length,
        average: runnerRuns.length ? total / runnerRuns.length : 0,
        longest: Math.max(0, ...runnerRuns.map((run) => run.miles)),
        timedRunCount: timedRuns.length,
        timedMiles,
        totalSeconds,
        averagePace: timedMiles > 0 ? totalSeconds / timedMiles : null,
        bestPace: timedRuns.length ? Math.min(...timedRuns.map((run) => run.durationSeconds / run.miles)) : null,
        streak: currentStreak(runnerRuns, now),
        lastRun: sortRuns(runnerRuns)[0]?.date,
      };
      return all;
    },
    {} as Record<string, RunnerStats>,
  );
}

export function buildChartDays(runs: MetricRunEntry[], members: MetricMember[], now = new Date()) {
  const days = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
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

export function buildStreakStrip(runs: MetricRunEntry[], memberId: string, now = new Date(), days = 7) {
  const runDays = new Set(runs.filter((run) => run.memberId === memberId).map((run) => run.date));
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    date.setDate(date.getDate() - (days - 1 - index));
    const key = toDateKey(date);
    return {
      date: key,
      label: new Intl.DateTimeFormat("en-US", { weekday: "narrow" }).format(date),
      ran: runDays.has(key),
    };
  });
}

export function buildHeatmapWeeks(runs: MetricRunEntry[], memberId: string, now = new Date(), weeks = 6) {
  const totals = new Map<string, number>();
  for (const run of runs.filter((row) => row.memberId === memberId)) {
    totals.set(run.date, (totals.get(run.date) || 0) + run.miles);
  }
  const days = weeks * 7;
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    date.setDate(date.getDate() - (days - 1 - index));
    const key = toDateKey(date);
    const miles = totals.get(key) || 0;
    return {
      date: key,
      miles,
      level: heatLevel(miles),
    };
  });
}

export function heatLevel(miles: number) {
  if (miles <= 0) return 0;
  if (miles < 2) return 1;
  if (miles < 4) return 2;
  if (miles < 7) return 3;
  return 4;
}

export function currentStreak(runs: MetricRunEntry[], now = new Date()) {
  const runDays = new Set(runs.map((run) => run.date));
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
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

export function emptyStats(): RunnerStats {
  return {
    total: 0,
    week: 0,
    month: 0,
    runCount: 0,
    average: 0,
    longest: 0,
    timedRunCount: 0,
    timedMiles: 0,
    totalSeconds: 0,
    averagePace: null,
    bestPace: null,
    streak: 0,
  };
}

export function sortRuns<T extends { date: string; createdAt: string }>(runs: T[]) {
  return [...runs].sort((a, b) => {
    const byDate = b.date.localeCompare(a.date);
    if (byDate !== 0) return byDate;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

export function sumMiles(runs: Pick<MetricRunEntry, "miles">[]) {
  return runs.reduce((total, run) => total + run.miles, 0);
}

function hasRunTime(run: MetricRunEntry): run is MetricRunEntry & { durationSeconds: number } {
  return typeof run.durationSeconds === "number" && Number.isFinite(run.durationSeconds) && run.durationSeconds > 0 && run.miles > 0;
}

export function startOfWeek(date: Date) {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = copy.getDay();
  const diff = day === 0 ? 6 : day - 1;
  copy.setDate(copy.getDate() - diff);
  return copy;
}

export function parseRunDate(date: string) {
  return new Date(`${date}T00:00:00`);
}

export function todayInput() {
  return toDateKey(new Date());
}

export function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatMiles(value: number) {
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value)} mi`;
}

export function formatDuration(seconds: number) {
  const rounded = Math.round(seconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const secs = rounded % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

export function formatPace(secondsPerMile: number | null | undefined) {
  if (!secondsPerMile || !Number.isFinite(secondsPerMile)) return "-";
  return `${formatDuration(secondsPerMile)} /mi`;
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(parseRunDate(value));
}

export function shortDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "numeric", day: "numeric" }).format(parseRunDate(value));
}
