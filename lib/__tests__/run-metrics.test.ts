import {
  buildBadges,
  buildChartDays,
  buildComebackTargets,
  buildFamilyChallenges,
  buildFeedEvents,
  buildHeadToHeadComparisons,
  buildHeatmapWeeks,
  buildRecentMileageTrend,
  buildStats,
  buildStreakStrip,
  buildWeeklyRecap,
  currentStreak,
  formatDuration,
  formatMiles,
  formatPace,
  heatLevel,
  raceProgress,
  runnerCardRarity,
  runnerTitle,
  sortRuns,
  toDateKey,
} from "../run-metrics";

const members = [
  { id: "shane", name: "Shane" },
  { id: "molly", name: "Molly" },
];

const now = new Date("2026-05-22T12:00:00Z");

describe("run metrics", () => {
  it("builds totals, averages, longest runs, and recent periods per runner", () => {
    const stats = buildStats(
      [
        { id: "1", memberId: "shane", miles: 3.25, durationSeconds: 1560, date: "2026-05-22", createdAt: "2026-05-22T12:00:00Z" },
        { id: "2", memberId: "shane", miles: 5, durationSeconds: 2400, date: "2026-05-20", createdAt: "2026-05-20T12:00:00Z" },
        { id: "3", memberId: "shane", miles: 2, date: "2026-04-30", createdAt: "2026-04-30T12:00:00Z" },
        { id: "4", memberId: "molly", miles: 4, date: "2026-05-01", createdAt: "2026-05-01T12:00:00Z" },
      ],
      members,
      now,
    );

    expect(stats.shane.total).toBe(10.25);
    expect(stats.shane.week).toBe(8.25);
    expect(stats.shane.month).toBe(8.25);
    expect(stats.shane.average).toBeCloseTo(3.416);
    expect(stats.shane.longest).toBe(5);
    expect(stats.shane.timedRunCount).toBe(2);
    expect(stats.shane.timedMiles).toBe(8.25);
    expect(stats.shane.totalSeconds).toBe(3960);
    expect(stats.shane.averagePace).toBe(480);
    expect(stats.shane.bestPace).toBe(480);
    expect(stats.shane.runCount).toBe(3);
    expect(stats.shane.lastRun).toBe("2026-05-22");
    expect(stats.molly.total).toBe(4);
  });

  it("returns stable empty stats, recaps, comeback targets, and feed events for a new group", () => {
    const stats = buildStats([], members, now);
    const recap = buildWeeklyRecap([], members, now);
    const targets = buildComebackTargets([], members);

    expect(stats.shane).toMatchObject({ total: 0, week: 0, month: 0, runCount: 0, average: 0, averagePace: null, bestPace: null, streak: 0 });
    expect(recap).toMatchObject({
      weekLabel: "5/18-5/24",
      totalMiles: 0,
      runCount: 0,
      activeRunnerCount: 0,
      headline: "The starting line is quiet this week.",
    });
    expect(targets).toEqual([
      { memberId: "shane", name: "Shane", total: 0, rank: 1, leaderGap: 0, isLeader: true },
      { memberId: "molly", name: "Molly", total: 0, rank: 2, targetName: "Shane", milesToPass: 0.01, leaderGap: 0, isLeader: false },
    ]);
    expect(buildFeedEvents([], members)).toEqual([]);
  });

  it("counts a streak through today or yesterday only", () => {
    expect(
      currentStreak(
        [
          { id: "1", memberId: "shane", miles: 3, date: "2026-05-22", createdAt: "2026-05-22T12:00:00Z" },
          { id: "2", memberId: "shane", miles: 3, date: "2026-05-21", createdAt: "2026-05-21T12:00:00Z" },
          { id: "3", memberId: "shane", miles: 3, date: "2026-05-20", createdAt: "2026-05-20T12:00:00Z" },
          { id: "4", memberId: "shane", miles: 3, date: "2026-05-18", createdAt: "2026-05-18T12:00:00Z" },
        ],
        now,
      ),
    ).toBe(3);

    expect(
      currentStreak(
        [{ id: "1", memberId: "shane", miles: 3, date: "2026-05-20", createdAt: "2026-05-20T12:00:00Z" }],
        now,
      ),
    ).toBe(0);
  });

  it("builds 14 chart days with scaled heights per member", () => {
    const chart = buildChartDays(
      [
        { id: "1", memberId: "shane", miles: 10, date: "2026-05-22", createdAt: "2026-05-22T12:00:00Z" },
        { id: "2", memberId: "molly", miles: 5, date: "2026-05-22", createdAt: "2026-05-22T12:05:00Z" },
      ],
      members,
      now,
    );

    expect(chart).toHaveLength(14);
    expect(chart.at(-1)?.date).toBe("2026-05-22");
    expect(chart.at(-1)?.totals.shane).toBe(10);
    expect(chart.at(-1)?.heights.shane).toBe(100);
    expect(chart.at(-1)?.heights.molly).toBe(50);
  });

  it("compares recent mileage against the previous window", () => {
    expect(
      buildRecentMileageTrend(
        [
          { id: "1", memberId: "shane", miles: 3, date: "2026-05-22", createdAt: "2026-05-22T12:00:00Z" },
          { id: "2", memberId: "shane", miles: 2, date: "2026-05-20", createdAt: "2026-05-20T12:00:00Z" },
          { id: "3", memberId: "shane", miles: 1, date: "2026-05-14", createdAt: "2026-05-14T12:00:00Z" },
          { id: "4", memberId: "molly", miles: 10, date: "2026-05-22", createdAt: "2026-05-22T12:00:00Z" },
        ],
        "shane",
        now,
      ),
    ).toEqual({ recentMiles: 5, previousMiles: 1, deltaMiles: 4, direction: "up" });
    expect(
      buildRecentMileageTrend(
        [
          { id: "1", memberId: "shane", miles: 1, date: "2026-05-22", createdAt: "2026-05-22T12:00:00Z" },
          { id: "2", memberId: "shane", miles: 4, date: "2026-05-14", createdAt: "2026-05-14T12:00:00Z" },
        ],
        "shane",
        now,
      ).direction,
    ).toBe("down");
    expect(buildRecentMileageTrend([], "shane", now)).toEqual({ recentMiles: 0, previousMiles: 0, deltaMiles: 0, direction: "flat" });
  });

  it("uses at least a one-day recent mileage window", () => {
    expect(
      buildRecentMileageTrend(
        [
          { id: "today", memberId: "shane", miles: 2, date: "2026-05-22", createdAt: "2026-05-22T12:00:00Z" },
          { id: "yesterday", memberId: "shane", miles: 5, date: "2026-05-21", createdAt: "2026-05-21T12:00:00Z" },
        ],
        "shane",
        now,
        0,
      ),
    ).toEqual({ recentMiles: 2, previousMiles: 5, deltaMiles: -3, direction: "down" });
  });

  it("sorts newest run date first and then newest created time", () => {
    const sorted = sortRuns([
      { id: "older", date: "2026-05-21", createdAt: "2026-05-21T10:00:00Z" },
      { id: "latest-create", date: "2026-05-22", createdAt: "2026-05-22T11:00:00Z" },
      { id: "earlier-create", date: "2026-05-22", createdAt: "2026-05-22T09:00:00Z" },
    ]);

    expect(sorted.map((run) => run.id)).toEqual(["latest-create", "earlier-create", "older"]);
  });

  it("formats miles and local date keys consistently", () => {
    expect(formatMiles(3.257)).toBe("3.26 mi");
    expect(formatDuration(480)).toBe("8:00");
    expect(formatDuration(3670)).toBe("1:01:10");
    expect(formatPace(480)).toBe("8:00 /mi");
    expect(formatPace(null)).toBe("-");
    expect(toDateKey(new Date(2026, 4, 2))).toBe("2026-05-02");
  });

  it("derives race progress and badges", () => {
    expect(raceProgress(24, 100)).toEqual({ percent: 24, remaining: 76, complete: false });
    expect(raceProgress(125, 100)).toEqual({ percent: 100, remaining: 0, complete: true });
    expect(raceProgress(0, Number.NaN)).toEqual({ percent: 0, remaining: 1, complete: false });

    const badges = buildBadges({
      total: 55,
      week: 12,
      month: 55,
      runCount: 8,
      average: 6.875,
      longest: 7,
      timedRunCount: 0,
      timedMiles: 0,
      totalSeconds: 0,
      averagePace: null,
      bestPace: null,
      streak: 7,
      lastRun: "2026-05-22",
    });

    expect(badges.map((badge) => badge.id)).toEqual([
      "first-run",
      "five-k",
      "ten-mile-week",
      "ten-k-pr",
      "main-character",
      "twenty-five",
      "fifty",
      "consistent",
      "three-streak",
      "seven-streak",
    ]);
  });

  it("adds note, pace, weekend, and comeback achievements", () => {
    const badges = buildBadges(
      {
        total: 12,
        week: 5,
        month: 12,
        runCount: 3,
        average: 4,
        longest: 5,
        timedRunCount: 1,
        timedMiles: 3,
        totalSeconds: 1380,
        averagePace: 460,
        bestPace: 460,
        streak: 1,
        lastRun: "2026-05-22",
      },
      [
        { id: "1", memberId: "shane", miles: 3, durationSeconds: 1380, date: "2026-05-09", note: "treadmill", createdAt: "2026-05-09T12:00:00Z" },
        { id: "2", memberId: "shane", miles: 4, date: "2026-05-17", note: "morning trail", createdAt: "2026-05-17T12:00:00Z" },
        { id: "3", memberId: "shane", miles: 5, date: "2026-05-22", note: "bridge route", createdAt: "2026-05-22T12:00:00Z" },
      ],
      "shane",
    );

    expect(badges.map((badge) => badge.id)).toEqual([
      "first-run",
      "five-k",
      "suspiciously-fast",
      "weekend-warrior",
      "touched-grass",
      "hamster-wheel",
      "early-bird",
      "we-are-back",
      "new-longest",
    ]);
  });

  it("uses the provided date when awarding weekly run badges", () => {
    const stats = {
      total: 9,
      week: 9,
      month: 9,
      runCount: 3,
      average: 3,
      longest: 3,
      timedRunCount: 0,
      timedMiles: 0,
      totalSeconds: 0,
      averagePace: null,
      bestPace: null,
      streak: 1,
      lastRun: "2026-05-20",
    };
    const weeklyRuns = [
      { id: "1", memberId: "shane", miles: 3, date: "2026-05-18", createdAt: "2026-05-18T12:00:00Z" },
      { id: "2", memberId: "shane", miles: 3, date: "2026-05-19", createdAt: "2026-05-19T12:00:00Z" },
      { id: "3", memberId: "shane", miles: 3, date: "2026-05-20", createdAt: "2026-05-20T12:00:00Z" },
    ];

    expect(buildBadges(stats, weeklyRuns, "shane", new Date("2026-05-22T12:00:00Z")).map((badge) => badge.id)).toContain("three-run-week");
    expect(buildBadges(stats, weeklyRuns, "shane", new Date("2026-05-29T12:00:00Z")).map((badge) => badge.id)).not.toContain("three-run-week");
  });

  it("derives runner profile titles and card rarity", () => {
    const baseStats = {
      total: 12,
      week: 4,
      month: 12,
      runCount: 3,
      average: 4,
      longest: 5,
      timedRunCount: 0,
      timedMiles: 0,
      totalSeconds: 0,
      averagePace: null,
      bestPace: null,
      streak: 1,
      lastRun: "2026-05-22",
    };

    expect(runnerTitle({ ...baseStats, bestPace: 460 }, [], "shane")).toBe("Pace Menace");
    expect(runnerTitle({ ...baseStats, streak: 7 }, [], "shane")).toBe("Streak Captain");
    expect(runnerTitle({ ...baseStats, week: 10 }, [], "shane")).toBe("Weekly Closer");
    expect(runnerTitle(baseStats, [{ id: "1", memberId: "shane", miles: 3, date: "2026-05-22", note: "morning trail", createdAt: "2026-05-22T12:00:00Z" }], "shane")).toBe("Route Scout");
    expect(runnerTitle(baseStats, [{ id: "1", memberId: "shane", miles: 3, date: "2026-05-23", createdAt: "2026-05-23T12:00:00Z" }], "shane")).toBe("Weekend Regular");
    expect(runnerTitle({ ...baseStats, runCount: 5 }, [], "shane")).toBe("Consistency Merchant");
    expect(runnerTitle({ ...baseStats, runCount: 0 }, [], "shane")).toBe("Mileage Rookie");

    expect(runnerCardRarity({ ...baseStats, total: 10 }, [])).toBe("base");
    expect(runnerCardRarity({ ...baseStats, total: 26 }, [])).toBe("rare");
    expect(runnerCardRarity({ ...baseStats, total: 51 }, [])).toBe("epic");
    expect(runnerCardRarity({ ...baseStats, total: 101 }, [])).toBe("legend");
    expect(runnerCardRarity(baseStats, Array.from({ length: 10 }, (_, index) => ({ id: `badge-${index}`, label: "Badge", tone: "gold" })))).toBe("legend");
  });

  it("builds a weekly family recap", () => {
    const recap = buildWeeklyRecap(
      [
        { id: "1", memberId: "shane", miles: 3, durationSeconds: 1500, date: "2026-05-19", note: "tempo", reactions: [{ count: 1 }], createdAt: "2026-05-19T12:00:00Z" },
        { id: "2", memberId: "molly", miles: 6, durationSeconds: 2700, date: "2026-05-20", note: "closing the gap", reactions: [{ count: 3 }], createdAt: "2026-05-20T12:00:00Z" },
        { id: "3", memberId: "shane", miles: 4, date: "2026-05-21", note: "steady", reactions: [], createdAt: "2026-05-21T12:00:00Z" },
        { id: "4", memberId: "molly", miles: 9, date: "2026-05-10", note: "last week", createdAt: "2026-05-10T12:00:00Z" },
      ],
      members,
      now,
    );

    expect(recap.weekLabel).toBe("5/18-5/24");
    expect(recap.totalMiles).toBe(13);
    expect(recap.runCount).toBe(3);
    expect(recap.activeRunnerCount).toBe(2);
    expect(recap.headline).toBe("Shane made the biggest jump this week.");
    expect(recap.topRunner).toEqual({ name: "Shane", miles: 7 });
    expect(recap.biggestRun).toEqual({ runner: "Molly", miles: 6, note: "closing the gap" });
    expect(recap.mostConsistent).toEqual({ name: "Shane", runCount: 2 });
    expect(recap.fastestPace).toEqual({ name: "Molly", secondsPerMile: 450 });
    expect(recap.crowdFavorite).toEqual({ runner: "Molly", reactionCount: 3, note: "closing the gap" });
    expect(recap.mostImproved).toEqual({ name: "Shane", deltaMiles: 7 });
    expect(recap.bestStreak).toEqual({ name: "Shane", days: 1 });
  });

  it("keeps weekly recap inside Monday-Sunday boundaries", () => {
    const recap = buildWeeklyRecap(
      [
        { id: "before", memberId: "shane", miles: 99, date: "2026-05-17", createdAt: "2026-05-17T12:00:00Z" },
        { id: "start", memberId: "shane", miles: 3, date: "2026-05-18", createdAt: "2026-05-18T12:00:00Z" },
        { id: "end", memberId: "molly", miles: 4, date: "2026-05-24", createdAt: "2026-05-24T12:00:00Z" },
        { id: "after", memberId: "molly", miles: 99, date: "2026-05-25", createdAt: "2026-05-25T12:00:00Z" },
      ],
      members,
      now,
    );

    expect(recap.weekLabel).toBe("5/18-5/24");
    expect(recap.totalMiles).toBe(7);
    expect(recap.runCount).toBe(2);
    expect(recap.biggestRun).toEqual({ runner: "Molly", miles: 4, note: "" });
  });

  it("builds comeback targets", () => {
    const targets = buildComebackTargets(
      [
        { id: "1", memberId: "shane", miles: 10, date: "2026-05-22", createdAt: "2026-05-22T12:00:00Z" },
        { id: "2", memberId: "molly", miles: 7.5, date: "2026-05-22", createdAt: "2026-05-22T12:00:00Z" },
      ],
      members,
    );

    expect(targets[0]).toMatchObject({ memberId: "shane", rank: 1, isLeader: true, leaderGap: 0 });
    expect(targets[1]).toMatchObject({ memberId: "molly", rank: 2, targetName: "Shane", milesToPass: 2.51, leaderGap: 2.5 });
  });

  it("orders comeback targets deterministically when totals are tied", () => {
    const targets = buildComebackTargets(
      [
        { id: "1", memberId: "molly", miles: 5, date: "2026-05-22", createdAt: "2026-05-22T12:00:00Z" },
        { id: "2", memberId: "shane", miles: 5, date: "2026-05-22", createdAt: "2026-05-22T12:00:00Z" },
      ],
      members,
    );

    expect(targets.map((target) => target.memberId)).toEqual(["shane", "molly"]);
    expect(targets[1]).toMatchObject({ targetName: "Shane", milesToPass: 0.01, leaderGap: 0 });
  });

  it("builds head-to-head profile comparisons by closest gap", () => {
    const comparisons = buildHeadToHeadComparisons(
      [
        { id: "1", memberId: "shane", miles: 10, date: "2026-05-22", createdAt: "2026-05-22T12:00:00Z" },
        { id: "2", memberId: "molly", miles: 7.5, date: "2026-05-22", createdAt: "2026-05-22T12:00:00Z" },
        { id: "3", memberId: "dad", miles: 10, date: "2026-05-22", createdAt: "2026-05-22T12:00:00Z" },
      ],
      [...members, { id: "dad", name: "Dad" }],
      "molly",
    );

    expect(comparisons).toEqual([
      {
        opponentId: "dad",
        opponentName: "Dad",
        runnerTotal: 7.5,
        opponentTotal: 10,
        runnerRunCount: 1,
        opponentRunCount: 1,
        gap: 2.5,
        status: "behind",
        milesToPass: 2.51,
      },
      {
        opponentId: "shane",
        opponentName: "Shane",
        runnerTotal: 7.5,
        opponentTotal: 10,
        runnerRunCount: 1,
        opponentRunCount: 1,
        gap: 2.5,
        status: "behind",
        milesToPass: 2.51,
      },
    ]);
    expect(buildHeadToHeadComparisons([], members, "missing")).toEqual([]);
  });

  it("builds feed events for milestones, lead changes, and achievements", () => {
    const events = buildFeedEvents(
      [
        { id: "1", memberId: "shane", miles: 4, date: "2026-05-20", createdAt: "2026-05-20T12:00:00Z" },
        { id: "2", memberId: "molly", miles: 6, date: "2026-05-21", createdAt: "2026-05-21T12:00:00Z" },
        { id: "3", memberId: "shane", miles: 3, date: "2026-05-22", createdAt: "2026-05-22T12:00:00Z" },
      ],
      members,
      100,
    );

    expect(events.some((event) => event.type === "milestone" && event.title === "Molly hit 5 total miles")).toBe(true);
    expect(events.some((event) => event.type === "lead-change" && event.title === "Molly took the lead")).toBe(true);
    expect(events.some((event) => event.type === "achievement" && event.title === "Molly unlocked First 5K")).toBe(true);
    expect(events.some((event) => event.type === "achievement" && event.title === "Family goal week unlocked")).toBe(true);
  });

  it("builds weekly family challenges from current and previous week runs", () => {
    const challenges = buildFamilyChallenges(
      [
        { id: "old-1", memberId: "shane", miles: 3, date: "2026-05-12", createdAt: "2026-05-12T12:00:00Z" },
        { id: "old-2", memberId: "molly", miles: 4, date: "2026-05-13", createdAt: "2026-05-13T12:00:00Z" },
        { id: "1", memberId: "shane", miles: 3, date: "2026-05-18", createdAt: "2026-05-18T12:00:00Z" },
        { id: "2", memberId: "molly", miles: 4.5, date: "2026-05-20", createdAt: "2026-05-20T12:00:00Z" },
        { id: "3", memberId: "shane", miles: 1, date: "2026-05-23", createdAt: "2026-05-23T12:00:00Z" },
        { id: "4", memberId: "molly", miles: 1, date: "2026-05-24", createdAt: "2026-05-24T12:00:00Z" },
      ],
      members,
      now,
      100,
    );

    expect(challenges).toHaveLength(5);
    expect(challenges.find((challenge) => challenge.type === "weekly-mileage")).toMatchObject({
      id: "2026-05-18:weekly-mileage",
      value: 9.5,
      target: 8,
      complete: true,
      completedAt: "2026-05-23T12:00:00Z",
    });
    expect(challenges.find((challenge) => challenge.type === "beat-last-week")).toMatchObject({
      value: 9.5,
      target: 7,
      complete: true,
      completedAt: "2026-05-20T12:00:00Z",
    });
    expect(challenges.find((challenge) => challenge.type === "everyone-logs")).toMatchObject({
      value: 2,
      target: 2,
      complete: true,
      completedAt: "2026-05-20T12:00:00Z",
    });
    expect(challenges.find((challenge) => challenge.type === "weekend-participation")).toMatchObject({
      value: 2,
      target: 2,
      complete: true,
      completedAt: "2026-05-24T12:00:00Z",
    });
  });

  it("marks most-consistent challenges complete on the target run", () => {
    const challenges = buildFamilyChallenges(
      [
        { id: "1", memberId: "shane", miles: 2, date: "2026-05-18", createdAt: "2026-05-18T12:00:00Z" },
        { id: "2", memberId: "shane", miles: 2, date: "2026-05-19", createdAt: "2026-05-19T12:00:00Z" },
        { id: "3", memberId: "shane", miles: 2, date: "2026-05-20", createdAt: "2026-05-20T12:00:00Z" },
        { id: "4", memberId: "molly", miles: 2, date: "2026-05-21", createdAt: "2026-05-21T12:00:00Z" },
      ],
      members,
      now,
    );

    expect(challenges.find((challenge) => challenge.type === "most-consistent")).toMatchObject({
      value: 3,
      target: 3,
      complete: true,
      winner: "Shane",
      completedAt: "2026-05-20T12:00:00Z",
    });
  });

  it("adds completed challenge and weekly recap moments to the feed", () => {
    const events = buildFeedEvents(
      [
        { id: "old-1", memberId: "shane", miles: 3, date: "2026-05-12", createdAt: "2026-05-12T12:00:00Z" },
        { id: "old-2", memberId: "molly", miles: 3, date: "2026-05-13", createdAt: "2026-05-13T12:00:00Z" },
        { id: "1", memberId: "shane", miles: 4, date: "2026-05-18", createdAt: "2026-05-18T12:00:00Z" },
        { id: "2", memberId: "molly", miles: 4, date: "2026-05-19", createdAt: "2026-05-19T12:00:00Z" },
      ],
      members,
      100,
      now,
    );

    expect(events.some((event) => event.type === "challenge" && event.title === "Weekly family mileage complete")).toBe(true);
    expect(events.some((event) => event.type === "challenge" && event.title === "Beat last week complete")).toBe(true);
    expect(events.some((event) => event.type === "weekly-recap" && event.title === "Weekly recap posted")).toBe(true);
  });

  it("emits family-week achievement only once per week", () => {
    const events = buildFeedEvents(
      [
        { id: "1", memberId: "shane", miles: 2, date: "2026-05-19", createdAt: "2026-05-19T12:00:00Z" },
        { id: "2", memberId: "molly", miles: 2, date: "2026-05-20", createdAt: "2026-05-20T12:00:00Z" },
        { id: "3", memberId: "shane", miles: 2, date: "2026-05-21", createdAt: "2026-05-21T12:00:00Z" },
        { id: "4", memberId: "molly", miles: 2, date: "2026-05-22", createdAt: "2026-05-22T12:00:00Z" },
      ],
      members,
    );

    expect(events.filter((event) => event.title === "Family goal week unlocked")).toHaveLength(1);
  });

  it("builds streak strips and heatmaps", () => {
    const runs = [
      { id: "1", memberId: "shane", miles: 1, date: "2026-05-18", createdAt: "2026-05-18T12:00:00Z" },
      { id: "2", memberId: "shane", miles: 3, date: "2026-05-21", createdAt: "2026-05-21T12:00:00Z" },
      { id: "3", memberId: "shane", miles: 8, date: "2026-05-22", createdAt: "2026-05-22T12:00:00Z" },
    ];

    const strip = buildStreakStrip(runs, "shane", now);
    const heatmap = buildHeatmapWeeks(runs, "shane", now, 1);

    expect(strip).toHaveLength(7);
    expect(strip.map((day) => day.ran)).toEqual([false, false, true, false, false, true, true]);
    expect(heatmap.at(-1)).toMatchObject({ date: "2026-05-22", miles: 8, level: 4 });
    expect(heatLevel(0)).toBe(0);
    expect(heatLevel(1.5)).toBe(1);
    expect(heatLevel(3)).toBe(2);
    expect(heatLevel(5)).toBe(3);
    expect(heatLevel(9)).toBe(4);
  });

  it("uses minimum streak and heatmap windows", () => {
    const runs = [{ id: "1", memberId: "shane", miles: 2, date: "2026-05-22", createdAt: "2026-05-22T12:00:00Z" }];

    expect(buildStreakStrip(runs, "shane", now, 0)).toEqual([{ date: "2026-05-22", label: "F", ran: true }]);
    expect(buildHeatmapWeeks(runs, "shane", now, 0)).toHaveLength(7);
  });
});
