import {
  buildBadges,
  buildChartDays,
  buildHeatmapWeeks,
  buildStats,
  buildStreakStrip,
  currentStreak,
  formatDuration,
  formatMiles,
  formatPace,
  heatLevel,
  raceProgress,
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
      "ten-mile-week",
      "ten-k-pr",
      "twenty-five",
      "fifty",
      "three-streak",
      "seven-streak",
    ]);
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
});
