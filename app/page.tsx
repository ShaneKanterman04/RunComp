"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Runner = "Shane" | "Molly";

type RunEntry = {
  id: string;
  runner: Runner;
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

const RUNNERS: Runner[] = ["Shane", "Molly"];

export default function Home() {
  const [runs, setRuns] = useState<RunEntry[]>([]);
  const [form, setForm] = useState({ runner: "Shane" as Runner, miles: "", date: todayInput(), note: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadRuns();
  }, []);

  const stats = useMemo(() => buildStats(runs), [runs]);
  const chartDays = useMemo(() => buildChartDays(runs), [runs]);
  const leader = stats.Shane.total === stats.Molly.total ? null : stats.Shane.total > stats.Molly.total ? "Shane" : "Molly";
  const trailing = leader === "Shane" ? "Molly" : leader === "Molly" ? "Shane" : null;
  const gap = Math.abs(stats.Shane.total - stats.Molly.total);
  const maxTotal = Math.max(stats.Shane.total, stats.Molly.total, 1);

  async function loadRuns() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/runs", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load runs.");
      setRuns(data.runs);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load runs.");
    } finally {
      setLoading(false);
    }
  }

  async function submitRun(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runner: form.runner,
          miles: Number(form.miles),
          date: form.date,
          note: form.note,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save run.");
      setRuns((current) => [data.run, ...current]);
      setForm((current) => ({ ...current, miles: "", note: "" }));
      setMessage(`${data.run.runner} logged ${formatMiles(data.run.miles)}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save run.");
    } finally {
      setSaving(false);
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

  return (
    <main className="app">
      <header className="topbar">
        <div className="brand">
          <img src="/track-mark.svg" alt="" className="brandMark" />
          <div>
            <p className="eyebrow">Homelab mileage rivalry</p>
            <h1>RunComp</h1>
          </div>
        </div>
        <div className="headToHead" aria-label="Current head to head score">
          <span>Shane {formatMiles(stats.Shane.total)}</span>
          <strong>vs</strong>
          <span>{formatMiles(stats.Molly.total)} Molly</span>
        </div>
      </header>

      <section className="scoreGrid">
        <section className="panel showdown">
          <div>
            <p className="eyebrow">Current race</p>
            <h2>{leader ? `${leader} leads by ${formatMiles(gap)}` : "Dead even"}</h2>
            <p className="muted">
              {leader && trailing
                ? `${trailing} needs ${formatMiles(gap + 0.01)} to take the lead.`
                : "One quick run from either side breaks the tie."}
            </p>
          </div>
          <div className="totalBars">
            {RUNNERS.map((runner) => (
              <div className="totalRow" key={runner}>
                <div className="totalLabel">
                  <span>{runner}</span>
                  <strong>{formatMiles(stats[runner].total)}</strong>
                </div>
                <div className="meter">
                  <span className={`meterFill ${runner.toLowerCase()}`} style={{ width: `${Math.max(4, (stats[runner].total / maxTotal) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="panel logPanel">
          <div className="sectionHead">
            <div>
              <p className="eyebrow">Log miles</p>
              <h2>Add a run</h2>
            </div>
            <button className="ghostButton" type="button" onClick={loadRuns} disabled={loading}>
              Refresh
            </button>
          </div>
          <form className="runForm" onSubmit={submitRun}>
            <label>
              Runner
              <select value={form.runner} onChange={(event) => setForm({ ...form, runner: event.target.value as Runner })}>
                {RUNNERS.map((runner) => (
                  <option key={runner} value={runner}>
                    {runner}
                  </option>
                ))}
              </select>
            </label>
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

      <section className="runnerGrid">
        {RUNNERS.map((runner) => (
          <RunnerCard key={runner} runner={runner} stats={stats[runner]} />
        ))}
      </section>

      <section className="panel chartPanel">
        <div className="sectionHead">
          <div>
            <p className="eyebrow">Last 14 days</p>
            <h2>Daily mileage</h2>
          </div>
          <div className="legend">
            <span><i className="dot shaneDot" />Shane</span>
            <span><i className="dot mollyDot" />Molly</span>
          </div>
        </div>
        <div className="chart" aria-label="Daily mileage chart">
          {chartDays.map((day) => (
            <div className="dayGroup" key={day.date}>
              <div className="bars">
                <span className="bar shane" title={`Shane ${formatMiles(day.Shane)}`} style={{ height: `${day.height.Shane}%` }} />
                <span className="bar molly" title={`Molly ${formatMiles(day.Molly)}`} style={{ height: `${day.height.Molly}%` }} />
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
        {loading ? (
          <p className="empty">Loading runs...</p>
        ) : runs.length === 0 ? (
          <p className="empty">No miles logged yet. Somebody start the scoreboard.</p>
        ) : (
          <div className="runList">
            {runs.map((run) => (
              <article className="runRow" key={run.id}>
                <div className={`runnerBadge ${run.runner.toLowerCase()}`}>{run.runner.slice(0, 1)}</div>
                <div className="runDetails">
                  <div>
                    <strong>{run.runner}</strong>
                    <span>{formatDate(run.date)}</span>
                  </div>
                  {run.note && <p>{run.note}</p>}
                </div>
                <strong className="runMiles">{formatMiles(run.miles)}</strong>
                <button className="deleteButton" type="button" onClick={() => deleteRun(run.id)} aria-label={`Delete ${run.runner} run on ${run.date}`}>
                  Delete
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function RunnerCard({ runner, stats }: { runner: Runner; stats: RunnerStats }) {
  return (
    <section className={`panel runnerCard ${runner.toLowerCase()}`}>
      <div className="sectionHead">
        <div>
          <p className="eyebrow">{runner}</p>
          <h2>{formatMiles(stats.total)}</h2>
        </div>
        <div className={`runnerBadge ${runner.toLowerCase()}`}>{runner.slice(0, 1)}</div>
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

function buildStats(runs: RunEntry[]): Record<Runner, RunnerStats> {
  const now = new Date();
  const weekStart = startOfWeek(now);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  return RUNNERS.reduce(
    (all, runner) => {
      const runnerRuns = runs.filter((run) => run.runner === runner);
      const total = sumMiles(runnerRuns);
      all[runner] = {
        total,
        week: sumMiles(runnerRuns.filter((run) => parseRunDate(run.date) >= weekStart)),
        month: sumMiles(runnerRuns.filter((run) => parseRunDate(run.date) >= monthStart)),
        runCount: runnerRuns.length,
        average: runnerRuns.length ? total / runnerRuns.length : 0,
        longest: Math.max(0, ...runnerRuns.map((run) => run.miles)),
        streak: currentStreak(runnerRuns),
        lastRun: runnerRuns[0]?.date,
      };
      return all;
    },
    {} as Record<Runner, RunnerStats>,
  );
}

function buildChartDays(runs: RunEntry[]) {
  const days = Array.from({ length: 14 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (13 - index));
    return toDateKey(date);
  });
  const totals = days.map((date) => ({
    date,
    label: shortDate(date),
    Shane: sumMiles(runs.filter((run) => run.runner === "Shane" && run.date === date)),
    Molly: sumMiles(runs.filter((run) => run.runner === "Molly" && run.date === date)),
  }));
  const max = Math.max(1, ...totals.flatMap((day) => [day.Shane, day.Molly]));
  return totals.map((day) => ({
    ...day,
    height: {
      Shane: day.Shane ? Math.max(8, (day.Shane / max) * 100) : 2,
      Molly: day.Molly ? Math.max(8, (day.Molly / max) * 100) : 2,
    },
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
