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
  reactions?: { count: number }[];
  createdAt: string;
};

export type FeedEvent = {
  id: string;
  type: "milestone" | "lead-change" | "streak" | "achievement" | "challenge" | "weekly-recap";
  title: string;
  body: string;
  date: string;
  createdAt: string;
  memberId?: string;
  runId?: string;
  tone: "gold" | "green" | "rose" | "blue";
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

export type CardRarity = "base" | "rare" | "epic" | "legend";

export type WeeklyRecap = {
  weekLabel: string;
  totalMiles: number;
  runCount: number;
  activeRunnerCount: number;
  headline: string;
  topRunner?: {
    name: string;
    miles: number;
  };
  biggestRun?: {
    runner: string;
    miles: number;
    note: string;
  };
  mostConsistent?: {
    name: string;
    runCount: number;
  };
  fastestPace?: {
    name: string;
    secondsPerMile: number;
  };
  crowdFavorite?: {
    runner: string;
    reactionCount: number;
    note: string;
  };
  mostImproved?: {
    name: string;
    deltaMiles: number;
  };
  bestStreak?: {
    name: string;
    days: number;
  };
};

export type FamilyChallenge = {
  id: string;
  type: "weekly-mileage" | "weekend-participation" | "beat-last-week" | "everyone-logs" | "most-consistent";
  title: string;
  body: string;
  label: string;
  value: number;
  target: number;
  progress: number;
  complete: boolean;
  weekKey: string;
  tone: FeedEvent["tone"];
  completedAt?: string;
  winner?: string;
};

export type ComebackTarget = {
  memberId: string;
  name: string;
  total: number;
  rank: number;
  targetName?: string;
  milesToPass?: number;
  leaderGap: number;
  isLeader: boolean;
};

export type HeadToHeadComparison = {
  opponentId: string;
  opponentName: string;
  runnerTotal: number;
  opponentTotal: number;
  runnerRunCount: number;
  opponentRunCount: number;
  gap: number;
  status: "ahead" | "behind" | "tied";
  milesToPass?: number;
};

export type RecentMileageTrend = {
  recentMiles: number;
  previousMiles: number;
  deltaMiles: number;
  direction: "up" | "down" | "flat";
};

export function buildBadges(stats: RunnerStats, runs: MetricRunEntry[] = [], memberId?: string, now = new Date()): AchievementBadge[] {
  const badges: AchievementBadge[] = [];
  const runnerRuns = memberId ? runs.filter((run) => run.memberId === memberId) : runs;
  const notes = runnerRuns.map((run) => run.note?.toLowerCase() || "");
  if (stats.runCount > 0) badges.push({ id: "first-run", label: "First run", tone: "green" });
  if (stats.longest >= 3.1) badges.push({ id: "five-k", label: "5K logged", tone: "green" });
  if (stats.week >= 10) badges.push({ id: "ten-mile-week", label: "10 mi week", tone: "blue" });
  if (stats.longest >= 6.2) badges.push({ id: "ten-k-pr", label: "10K run", tone: "rose" });
  if (stats.longest >= 7) badges.push({ id: "main-character", label: "Main character run", tone: "gold" });
  if (stats.total >= 25) badges.push({ id: "twenty-five", label: "25 total", tone: "gold" });
  if (stats.total >= 50) badges.push({ id: "fifty", label: "50 total", tone: "gold" });
  if (stats.runCount >= 5) badges.push({ id: "consistent", label: "Keeps showing up", tone: "blue" });
  if (runnerRuns.filter((run) => parseRunDate(run.date) >= startOfWeek(now)).length >= 3) badges.push({ id: "three-run-week", label: "3-run week", tone: "blue" });
  if (stats.streak >= 3) badges.push({ id: "three-streak", label: "3-day streak", tone: "rose" });
  if (stats.streak >= 7) badges.push({ id: "seven-streak", label: "7-day streak", tone: "rose" });
  if (stats.bestPace && stats.bestPace <= 8 * 60) badges.push({ id: "suspiciously-fast", label: "Suspiciously fast", tone: "rose" });
  if (runnerRuns.some((run) => isWeekend(run.date))) badges.push({ id: "weekend-warrior", label: "Weekend warrior", tone: "blue" });
  if (notes.some((note) => /trail|park|grass|outside|route|bridge/.test(note))) badges.push({ id: "touched-grass", label: "Touched grass", tone: "green" });
  if (notes.some((note) => /treadmill|indoor/.test(note))) badges.push({ id: "hamster-wheel", label: "Hamster wheel", tone: "rose" });
  if (notes.some((note) => /morning|sunrise|early/.test(note))) badges.push({ id: "early-bird", label: "Early bird", tone: "gold" });
  if (hasComebackGap(runnerRuns)) badges.push({ id: "we-are-back", label: "We're so back", tone: "green" });
  if (hasNewLongestRun(runnerRuns)) badges.push({ id: "new-longest", label: "Longest PR", tone: "gold" });
  return badges;
}

export function runnerTitle(stats: RunnerStats, runs: MetricRunEntry[] = [], memberId?: string) {
  const runnerRuns = memberId ? runs.filter((run) => run.memberId === memberId) : runs;
  const notes = runnerRuns.map((run) => run.note?.toLowerCase() || "").join(" ");
  if (stats.bestPace && stats.bestPace <= 8 * 60) return "Pace Menace";
  if (stats.streak >= 7) return "Streak Captain";
  if (stats.week >= 10) return "Weekly Closer";
  if (/treadmill|indoor/.test(notes)) return "Indoor Specialist";
  if (/trail|park|outside|bridge/.test(notes)) return "Route Scout";
  if (runnerRuns.some((run) => run.date && [0, 6].includes(new Date(`${run.date}T00:00:00`).getDay()))) return "Weekend Regular";
  if (stats.runCount >= 5) return "Consistency Merchant";
  return "Mileage Rookie";
}

export function runnerCardRarity(stats: RunnerStats, badges: AchievementBadge[]): CardRarity {
  if (stats.total >= 100 || badges.length >= 10) return "legend";
  if (stats.total >= 50 || badges.length >= 7) return "epic";
  if (stats.total >= 25 || badges.length >= 4) return "rare";
  return "base";
}

export function buildWeeklyRecap(runs: MetricRunEntry[], members: MetricMember[], now = new Date()): WeeklyRecap {
  const weekStart = startOfWeek(now);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const weekRuns = runs.filter((run) => {
    const date = parseRunDate(run.date);
    return date >= weekStart && date <= weekEnd;
  });
  const memberName = new Map(members.map((member) => [member.id, member.name]));
  const totals = new Map<string, number>();
  const counts = new Map<string, number>();

  for (const run of weekRuns) {
    totals.set(run.memberId, (totals.get(run.memberId) || 0) + run.miles);
    counts.set(run.memberId, (counts.get(run.memberId) || 0) + 1);
  }

  const topRunnerEntry = [...totals.entries()].sort((a, b) => b[1] - a[1])[0];
  const mostConsistentEntry = [...counts.entries()].sort((a, b) => b[1] - a[1] || (totals.get(b[0]) || 0) - (totals.get(a[0]) || 0))[0];
  const biggestRun = [...weekRuns].sort((a, b) => b.miles - a.miles)[0];
  const fastestRun = weekRuns.filter(hasRunTime).sort((a, b) => a.durationSeconds / a.miles - b.durationSeconds / b.miles)[0];
  const crowdFavorite = [...weekRuns]
    .map((run) => ({ run, reactionCount: reactionCount(run) }))
    .filter((row) => row.reactionCount > 0)
    .sort((a, b) => b.reactionCount - a.reactionCount || b.run.miles - a.run.miles)[0];
  const previousWeekStart = new Date(weekStart);
  previousWeekStart.setDate(weekStart.getDate() - 7);
  const previousWeekRuns = runs.filter((run) => {
    const date = parseRunDate(run.date);
    return date >= previousWeekStart && date < weekStart;
  });
  const previousTotals = totalsByMember(previousWeekRuns);
  const mostImprovedEntry = [...totals.entries()]
    .map(([memberId, miles]) => ({ memberId, deltaMiles: miles - (previousTotals.get(memberId) || 0) }))
    .filter((row) => row.deltaMiles > 0)
    .sort((a, b) => b.deltaMiles - a.deltaMiles)[0];
  const stats = buildStats(runs, members, now);
  const bestStreakEntry = members
    .map((member) => ({ member, days: stats[member.id]?.streak || 0 }))
    .filter((row) => row.days > 0)
    .sort((a, b) => b.days - a.days || (stats[b.member.id]?.total || 0) - (stats[a.member.id]?.total || 0))[0];
  const headline = buildRecapHeadline({
    totalMiles: sumMiles(weekRuns),
    runCount: weekRuns.length,
    topRunner: topRunnerEntry ? memberName.get(topRunnerEntry[0]) || "Unknown" : undefined,
    biggestRun: biggestRun ? memberName.get(biggestRun.memberId) || biggestRun.runner || "Unknown" : undefined,
    mostImproved: mostImprovedEntry ? memberName.get(mostImprovedEntry.memberId) || "Unknown" : undefined,
  });

  return {
    weekLabel: `${shortDate(toDateKey(weekStart))}-${shortDate(toDateKey(weekEnd))}`,
    totalMiles: sumMiles(weekRuns),
    runCount: weekRuns.length,
    activeRunnerCount: new Set(weekRuns.map((run) => run.memberId)).size,
    headline,
    ...(topRunnerEntry
      ? { topRunner: { name: memberName.get(topRunnerEntry[0]) || "Unknown", miles: topRunnerEntry[1] } }
      : {}),
    ...(biggestRun
      ? { biggestRun: { runner: memberName.get(biggestRun.memberId) || biggestRun.runner || "Unknown", miles: biggestRun.miles, note: biggestRun.note || "" } }
      : {}),
    ...(mostConsistentEntry
      ? { mostConsistent: { name: memberName.get(mostConsistentEntry[0]) || "Unknown", runCount: mostConsistentEntry[1] } }
      : {}),
    ...(fastestRun
      ? { fastestPace: { name: memberName.get(fastestRun.memberId) || fastestRun.runner || "Unknown", secondsPerMile: fastestRun.durationSeconds / fastestRun.miles } }
      : {}),
    ...(crowdFavorite
      ? {
          crowdFavorite: {
            runner: memberName.get(crowdFavorite.run.memberId) || crowdFavorite.run.runner || "Unknown",
            reactionCount: crowdFavorite.reactionCount,
            note: crowdFavorite.run.note || "",
          },
        }
      : {}),
    ...(mostImprovedEntry
      ? { mostImproved: { name: memberName.get(mostImprovedEntry.memberId) || "Unknown", deltaMiles: mostImprovedEntry.deltaMiles } }
      : {}),
    ...(bestStreakEntry ? { bestStreak: { name: bestStreakEntry.member.name, days: bestStreakEntry.days } } : {}),
  };
}

export function buildFamilyChallenges(runs: MetricRunEntry[], members: MetricMember[], now = new Date(), goalMiles = 100): FamilyChallenge[] {
  const weekStart = startOfWeek(now);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const week = toDateKey(weekStart);
  const previousWeekStart = new Date(weekStart);
  previousWeekStart.setDate(weekStart.getDate() - 7);
  const memberName = new Map(members.map((member) => [member.id, member.name]));
  const weekRuns = runs.filter((run) => {
    const date = parseRunDate(run.date);
    return date >= weekStart && date <= weekEnd;
  });
  const previousWeekRuns = runs.filter((run) => {
    const date = parseRunDate(run.date);
    return date >= previousWeekStart && date < weekStart;
  });
  const totalMiles = sumMiles(weekRuns);
  const previousMiles = sumMiles(previousWeekRuns);
  const weeklyTarget = Math.max(5, Math.min(goalMiles, previousMiles > 0 ? Math.ceil(previousMiles + 1) : members.length * 5 || 5));
  const activeMembers = new Set(weekRuns.map((run) => run.memberId));
  const weekendMembers = new Set(weekRuns.filter((run) => isWeekend(run.date)).map((run) => run.memberId));
  const counts = countRunsByMember(weekRuns);
  const mostConsistent = [...counts.entries()]
    .map(([memberId, runCount]) => ({ memberId, runCount, miles: sumMiles(weekRuns.filter((run) => run.memberId === memberId)) }))
    .sort((a, b) => b.runCount - a.runCount || b.miles - a.miles || (memberName.get(a.memberId) || "").localeCompare(memberName.get(b.memberId) || ""))[0];
  const consistentTarget = Math.max(3, Math.min(5, Math.ceil(weekRuns.length / Math.max(1, members.length)) + 1));

  return [
    challenge({
      id: `${week}:weekly-mileage`,
      type: "weekly-mileage",
      title: "Weekly family mileage",
      body: `${formatMiles(totalMiles)} of ${formatMiles(weeklyTarget)} logged this week.`,
      label: "Family miles",
      value: totalMiles,
      target: weeklyTarget,
      complete: totalMiles >= weeklyTarget,
      weekKey: week,
      tone: "gold",
      completedAt: firstCompletionRun(weekRuns, weeklyTarget, (run) => run.miles)?.createdAt,
    }),
    challenge({
      id: `${week}:weekend-participation`,
      type: "weekend-participation",
      title: "Weekend participation",
      body: `${weekendMembers.size} of ${members.length || 1} runner${members.length === 1 ? "" : "s"} logged weekend miles.`,
      label: "Weekend runners",
      value: weekendMembers.size,
      target: Math.max(1, members.length),
      complete: members.length > 0 && weekendMembers.size >= members.length,
      weekKey: week,
      tone: "blue",
      completedAt: completionRunForMemberCount(weekRuns.filter((run) => isWeekend(run.date)), Math.max(1, members.length))?.createdAt,
    }),
    challenge({
      id: `${week}:beat-last-week`,
      type: "beat-last-week",
      title: "Beat last week",
      body: previousMiles > 0 ? `${formatMiles(totalMiles)} this week against ${formatMiles(previousMiles)} last week.` : "Log a baseline this week to unlock this matchup.",
      label: "Last week",
      value: totalMiles,
      target: previousMiles || 1,
      complete: previousMiles > 0 && totalMiles > previousMiles,
      weekKey: week,
      tone: "green",
      completedAt: previousMiles > 0 ? firstCompletionRun(weekRuns, previousMiles + 0.01, (run) => run.miles)?.createdAt : undefined,
    }),
    challenge({
      id: `${week}:everyone-logs`,
      type: "everyone-logs",
      title: "Everyone logs",
      body: `${activeMembers.size} of ${members.length || 1} runner${members.length === 1 ? "" : "s"} have miles on the board.`,
      label: "Active runners",
      value: activeMembers.size,
      target: Math.max(1, members.length),
      complete: members.length > 0 && activeMembers.size >= members.length,
      weekKey: week,
      tone: "rose",
      completedAt: completionRunForMemberCount(weekRuns, Math.max(1, members.length))?.createdAt,
    }),
    challenge({
      id: `${week}:most-consistent`,
      type: "most-consistent",
      title: "Most consistent runner",
      body: mostConsistent ? `${memberName.get(mostConsistent.memberId) || "Runner"} has ${mostConsistent.runCount} run${mostConsistent.runCount === 1 ? "" : "s"} this week.` : "First runner to stack multiple days takes the early lead.",
      label: "Runs by leader",
      value: mostConsistent?.runCount || 0,
      target: consistentTarget,
      complete: Boolean(mostConsistent && mostConsistent.runCount >= consistentTarget),
      weekKey: week,
      tone: "blue",
      completedAt: mostConsistent ? nthRunForMember(weekRuns, mostConsistent.memberId, consistentTarget)?.createdAt : undefined,
      winner: mostConsistent ? memberName.get(mostConsistent.memberId) || "Runner" : undefined,
    }),
  ];
}

export function buildComebackTargets(runs: MetricRunEntry[], members: MetricMember[]): ComebackTarget[] {
  const totals = new Map(members.map((member) => [member.id, sumMiles(runs.filter((run) => run.memberId === member.id))]));
  const standings = [...members].sort((a, b) => (totals.get(b.id) || 0) - (totals.get(a.id) || 0));
  const leaderTotal = totals.get(standings[0]?.id || "") || 0;
  return standings.map((member, index) => {
    const total = totals.get(member.id) || 0;
    const target = standings[index - 1];
    const targetTotal = target ? totals.get(target.id) || 0 : undefined;
    const milesToPass = target && typeof targetTotal === "number" ? Math.max(0.01, targetTotal - total + 0.01) : undefined;
    return {
      memberId: member.id,
      name: member.name,
      total,
      rank: index + 1,
      ...(target ? { targetName: target.name, milesToPass } : {}),
      leaderGap: Math.max(0, leaderTotal - total),
      isLeader: index === 0,
    };
  });
}

export function buildHeadToHeadComparisons(runs: MetricRunEntry[], members: MetricMember[], memberId: string): HeadToHeadComparison[] {
  if (!members.some((member) => member.id === memberId)) return [];
  const runnerRuns = runs.filter((run) => run.memberId === memberId);
  const runnerTotal = sumMiles(runnerRuns);

  return members
    .filter((opponent) => opponent.id !== memberId)
    .map((opponent) => {
      const opponentRuns = runs.filter((run) => run.memberId === opponent.id);
      const opponentTotal = sumMiles(opponentRuns);
      const rawGap = runnerTotal - opponentTotal;
      const gap = Math.round(Math.abs(rawGap) * 100) / 100;
      return {
        opponentId: opponent.id,
        opponentName: opponent.name,
        runnerTotal,
        opponentTotal,
        runnerRunCount: runnerRuns.length,
        opponentRunCount: opponentRuns.length,
        gap,
        status: rawGap > 0 ? "ahead" : rawGap < 0 ? "behind" : "tied",
        ...(rawGap < 0 ? { milesToPass: Math.round((Math.abs(rawGap) + 0.01) * 100) / 100 } : {}),
      } satisfies HeadToHeadComparison;
    })
    .sort((a, b) => a.gap - b.gap || a.opponentName.localeCompare(b.opponentName));
}

export function buildFeedEvents(runs: MetricRunEntry[], members: MetricMember[], goalMiles = 100, now = new Date()): FeedEvent[] {
  const sorted = sortRuns(runs).reverse();
  const memberName = new Map(members.map((member) => [member.id, member.name]));
  const totals = new Map<string, number>();
  const streakDates = new Map<string, Set<string>>();
  const weeklyMembers = new Map<string, Set<string>>();
  const familyWeekEmitted = new Set<string>();
  const events: FeedEvent[] = [];
  let leaderId = "";

  for (const run of sorted) {
    const name = memberName.get(run.memberId) || run.runner || "Runner";
    const previousTotal = totals.get(run.memberId) || 0;
    const nextTotal = previousTotal + run.miles;
    totals.set(run.memberId, nextTotal);

    for (const milestone of [5, 10, 25, 50, 100, 250, 500, 1000]) {
      if (previousTotal < milestone && nextTotal >= milestone) {
        events.push({
          id: `milestone-${run.id}-${milestone}`,
          type: "milestone",
          title: `${name} hit ${milestone} total miles`,
          body: `${formatMiles(run.miles)} pushed ${name} over the mark.`,
          date: run.date,
          createdAt: run.createdAt,
          memberId: run.memberId,
          runId: run.id,
          tone: "gold",
        });
      }
    }

    const achievement = achievementForRun(run, previousTotal);
    if (achievement) {
      events.push({
        id: `achievement-${run.id}-${achievement.id}`,
        type: "achievement",
        title: `${name} unlocked ${achievement.label}`,
        body: achievement.body,
        date: run.date,
        createdAt: run.createdAt,
        memberId: run.memberId,
        runId: run.id,
        tone: achievement.tone,
      });
    }

    const week = weekKey(run.date);
    const weekSet = weeklyMembers.get(week) || new Set<string>();
    weekSet.add(run.memberId);
    weeklyMembers.set(week, weekSet);
    if (members.length > 1 && weekSet.size === members.length && !familyWeekEmitted.has(week)) {
      familyWeekEmitted.add(week);
      events.push({
        id: `achievement-family-week-${run.id}`,
        type: "achievement",
        title: "Family goal week unlocked",
        body: "Every runner has miles on the board this week.",
        date: run.date,
        createdAt: run.createdAt,
        memberId: run.memberId,
        runId: run.id,
        tone: "blue",
      });
    }

    const currentLeader = [...totals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
    if (currentLeader && currentLeader !== leaderId && leaderId) {
      events.push({
        id: `lead-${run.id}`,
        type: "lead-change",
        title: `${name} took the lead`,
        body: `${formatMiles(nextTotal)} total in the first-to-${formatMiles(goalMiles)} race.`,
        date: run.date,
        createdAt: run.createdAt,
        memberId: run.memberId,
        runId: run.id,
        tone: "green",
      });
    }
    leaderId = currentLeader || leaderId;

    const days = streakDates.get(run.memberId) || new Set<string>();
    days.add(run.date);
    streakDates.set(run.memberId, days);
    const streak = currentStreak([...days].map((date) => ({ ...run, id: `${run.id}-${date}`, date })), parseRunDate(run.date));
    if ([3, 7, 14, 30].includes(streak)) {
      events.push({
        id: `streak-${run.id}-${streak}`,
        type: "streak",
        title: `${name} is on a ${streak}-day streak`,
        body: "The consistency card is getting stronger.",
        date: run.date,
        createdAt: run.createdAt,
        memberId: run.memberId,
        runId: run.id,
        tone: "rose",
      });
    }
  }

  for (const item of buildFamilyChallenges(runs, members, now, goalMiles).filter((challenge) => challenge.complete && challenge.completedAt)) {
    events.push({
      id: `challenge-${item.id}`,
      type: "challenge",
      title: `${item.title} complete`,
      body: item.winner ? `${item.winner} sealed it. ${item.body}` : item.body,
      date: item.completedAt ? toDateKey(new Date(item.completedAt)) : toDateKey(now),
      createdAt: item.completedAt || new Date().toISOString(),
      tone: item.tone,
    });
  }

  const recap = buildWeeklyRecap(runs, members, now);
  if (recap.runCount > 0) {
    events.push({
      id: `weekly-recap-${weekKey(toDateKey(now))}`,
      type: "weekly-recap",
      title: "Weekly recap posted",
      body: recap.headline,
      date: toDateKey(now),
      createdAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 0).toISOString(),
      tone: "gold",
    });
  }

  return sortRuns(events).slice(0, 20);
}

function challenge(input: Omit<FamilyChallenge, "progress">): FamilyChallenge {
  return {
    ...input,
    progress: Math.min(100, (input.value / Math.max(1, input.target)) * 100),
  };
}

function countRunsByMember(runs: MetricRunEntry[]) {
  const counts = new Map<string, number>();
  for (const run of runs) counts.set(run.memberId, (counts.get(run.memberId) || 0) + 1);
  return counts;
}

function firstCompletionRun(runs: MetricRunEntry[], target: number, valueForRun: (run: MetricRunEntry) => number) {
  let total = 0;
  for (const run of sortRuns(runs).reverse()) {
    total += valueForRun(run);
    if (total >= target) return run;
  }
  return undefined;
}

function completionRunForMemberCount(runs: MetricRunEntry[], target: number) {
  const seen = new Set<string>();
  for (const run of sortRuns(runs).reverse()) {
    seen.add(run.memberId);
    if (seen.size >= target) return run;
  }
  return undefined;
}

function nthRunForMember(runs: MetricRunEntry[], memberId: string, target: number) {
  return sortRuns(runs).reverse().filter((run) => run.memberId === memberId)[target - 1];
}

function achievementForRun(run: MetricRunEntry, previousTotal: number): { id: string; label: string; body: string; tone: FeedEvent["tone"] } | null {
  const note = run.note?.toLowerCase() || "";
  if (run.miles >= 6.2) return { id: "ten-k", label: "10K Run", body: `${formatMiles(run.miles)} in one go.`, tone: "rose" };
  if (run.miles >= 3.1 && previousTotal < 3.1) return { id: "first-5k", label: "First 5K", body: "That is a real-deal benchmark run.", tone: "green" };
  if (isWeekend(run.date)) return { id: "weekend", label: "Weekend Run", body: "Weekend miles count double emotionally.", tone: "blue" };
  if (/treadmill|indoor/.test(note)) return { id: "treadmill", label: "Treadmill Duty", body: "No weather excuses needed.", tone: "rose" };
  if (/morning|sunrise|early/.test(note)) return { id: "early", label: "Early Start", body: "Logged before the day got loud.", tone: "gold" };
  return null;
}

export function raceProgress(total: number, goalMiles: number) {
  const safeGoal = Number.isFinite(goalMiles) ? Math.max(1, goalMiles) : 1;
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
  const windowDays = Math.max(1, Math.floor(days));
  const runDays = new Set(runs.filter((run) => run.memberId === memberId).map((run) => run.date));
  return Array.from({ length: windowDays }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    date.setDate(date.getDate() - (windowDays - 1 - index));
    const key = toDateKey(date);
    return {
      date: key,
      label: new Intl.DateTimeFormat("en-US", { weekday: "narrow" }).format(date),
      ran: runDays.has(key),
    };
  });
}

export function buildRecentMileageTrend(runs: MetricRunEntry[], memberId: string, now = new Date(), days = 7): RecentMileageTrend {
  const windowDays = Math.max(1, Math.floor(days));
  const currentEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const currentStart = new Date(currentEnd);
  currentStart.setDate(currentEnd.getDate() - (windowDays - 1));
  const previousEnd = new Date(currentStart);
  previousEnd.setDate(currentStart.getDate() - 1);
  const previousStart = new Date(previousEnd);
  previousStart.setDate(previousEnd.getDate() - (windowDays - 1));
  const recentMiles = sumMilesForRange(runs, memberId, currentStart, currentEnd);
  const previousMiles = sumMilesForRange(runs, memberId, previousStart, previousEnd);
  const deltaMiles = Math.round((recentMiles - previousMiles) * 100) / 100;
  return {
    recentMiles,
    previousMiles,
    deltaMiles,
    direction: deltaMiles > 0 ? "up" : deltaMiles < 0 ? "down" : "flat",
  };
}

export function buildHeatmapWeeks(runs: MetricRunEntry[], memberId: string, now = new Date(), weeks = 6) {
  const totals = new Map<string, number>();
  for (const run of runs.filter((row) => row.memberId === memberId)) {
    totals.set(run.date, (totals.get(run.date) || 0) + run.miles);
  }
  const days = Math.max(1, Math.floor(weeks)) * 7;
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

function sumMilesForRange(runs: MetricRunEntry[], memberId: string, start: Date, end: Date) {
  const total = runs
    .filter((run) => run.memberId === memberId)
    .filter((run) => {
      const date = parseRunDate(run.date);
      return date >= start && date <= end;
    })
    .reduce((sum, run) => sum + run.miles, 0);
  return Math.round(total * 100) / 100;
}

function totalsByMember(runs: MetricRunEntry[]) {
  const totals = new Map<string, number>();
  for (const run of runs) {
    totals.set(run.memberId, (totals.get(run.memberId) || 0) + run.miles);
  }
  return totals;
}

function buildRecapHeadline(input: { totalMiles: number; runCount: number; topRunner?: string; biggestRun?: string; mostImproved?: string }) {
  if (input.runCount === 0) return "The starting line is quiet this week.";
  if (input.totalMiles >= 25 && input.topRunner) return `${input.topRunner} powers a ${formatMiles(input.totalMiles)} family week.`;
  if (input.mostImproved) return `${input.mostImproved} made the biggest jump this week.`;
  if (input.biggestRun) return `${input.biggestRun} delivered the week's statement run.`;
  return `${input.runCount} family run${input.runCount === 1 ? "" : "s"} kept the race moving.`;
}

function hasRunTime(run: MetricRunEntry): run is MetricRunEntry & { durationSeconds: number } {
  return typeof run.durationSeconds === "number" && Number.isFinite(run.durationSeconds) && run.durationSeconds > 0 && run.miles > 0;
}

function reactionCount(run: MetricRunEntry) {
  return (run.reactions || []).reduce((sum, reaction) => sum + reaction.count, 0);
}

function isWeekend(date: string) {
  const day = parseRunDate(date).getDay();
  return day === 0 || day === 6;
}

function hasComebackGap(runs: MetricRunEntry[]) {
  const sorted = sortRuns(runs).reverse();
  return sorted.some((run, index) => {
    const previous = sorted[index - 1];
    if (!previous) return false;
    const days = (parseRunDate(run.date).getTime() - parseRunDate(previous.date).getTime()) / 86_400_000;
    return days >= 7;
  });
}

function hasNewLongestRun(runs: MetricRunEntry[]) {
  const sorted = sortRuns(runs).reverse();
  let best = 0;
  return sorted.some((run, index) => {
    const isPr = index > 0 && run.miles > best;
    best = Math.max(best, run.miles);
    return isPr;
  });
}

function weekKey(date: string) {
  const parsed = parseRunDate(date);
  const week = startOfWeek(parsed);
  return toDateKey(week);
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
