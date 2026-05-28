import { NextResponse } from "next/server";
import { AuthError, requireSession } from "@/lib/auth";
import { buildComebackTargets, buildFamilyChallenges } from "@/lib/run-metrics";
import { notifyChallengeCompleted, notifyCloseToPass, notifyLeadChanged, notifyRunLogged } from "@/lib/push";
import { addRun, claimChallengeCompletions, deleteRun, getGroupContext, listRuns, storeErrorResponse, toggleRunReaction, type ReactionType } from "@/lib/store";
import { isJsonObject, isJsonParseError } from "../route-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await requireSession();
    const runs = await listRuns(session.group.id, session.member.id);
    return NextResponse.json({ runs });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const body = await request.json();
    if (!isJsonObject(body)) return NextResponse.json({ error: "Send a JSON object." }, { status: 400 });
    const payload = body;
    const miles = typeof payload.miles === "number" ? payload.miles : Number(payload.miles);
    const durationSeconds =
      typeof payload.durationSeconds === "number"
        ? payload.durationSeconds
        : typeof payload.durationSeconds === "string" && payload.durationSeconds.trim()
          ? Number(payload.durationSeconds)
          : undefined;
    const date = typeof payload.date === "string" ? payload.date.trim() : "";
    const note = typeof payload.note === "string" ? payload.note.trim() : "";

    if (!Number.isFinite(miles) || miles <= 0 || miles > 100) {
      return NextResponse.json({ error: "Miles must be greater than 0 and no more than 100." }, { status: 400 });
    }
    if (!isValidDate(date)) {
      return NextResponse.json({ error: "Date must be a valid YYYY-MM-DD value." }, { status: 400 });
    }
    if (durationSeconds !== undefined && (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > 172800)) {
      return NextResponse.json({ error: "Run time must be between 1 second and 48 hours." }, { status: 400 });
    }
    if (note.length > 180) {
      return NextResponse.json({ error: "Run notes must be 180 characters or fewer." }, { status: 400 });
    }

    const beforeRuns = await listRuns(session.group.id, session.member.id);
    const beforeLeader = leaderForRuns(beforeRuns);
    const run = await addRun(session.group.id, session.member.id, { miles, date, note, durationSeconds });
    notifyRunLogged(session.group.id, run).catch((error) => console.warn("Could not send run notification", error));
    const afterRuns = await listRuns(session.group.id, session.member.id);
    const afterLeader = leaderForRuns(afterRuns);
    if (afterLeader && beforeLeader && afterLeader.memberId !== beforeLeader.memberId) {
      notifyLeadChanged(session.group.id, afterLeader.runner, afterLeader.total).catch((error) => console.warn("Could not send lead notification", error));
    }
    const context = await getGroupContext(session.group.id, session.member.id);
    if (context) {
      const beforeCloseTarget = buildComebackTargets(beforeRuns, context.members).find((target) => target.memberId === session.member.id);
      const afterCloseTarget = buildComebackTargets(afterRuns, context.members).find((target) => target.memberId === session.member.id);
      if (
        afterCloseTarget &&
        !afterCloseTarget.isLeader &&
        afterCloseTarget.targetName &&
        afterCloseTarget.milesToPass &&
        afterCloseTarget.milesToPass <= 1 &&
        (!beforeCloseTarget || beforeCloseTarget.isLeader || !beforeCloseTarget.milesToPass || beforeCloseTarget.milesToPass > 1)
      ) {
        notifyCloseToPass(session.group.id, afterCloseTarget.name, afterCloseTarget.targetName, afterCloseTarget.milesToPass).catch((error) =>
          console.warn("Could not send close-call notification", error),
        );
      }
      const completedChallenges = buildFamilyChallenges(afterRuns, context.members, new Date(), context.group.goalMiles).filter((challenge) => challenge.complete);
      const freshIds = await claimChallengeCompletions(session.group.id, completedChallenges.map((challenge) => challenge.id));
      const fresh = new Set(freshIds);
      for (const challenge of completedChallenges.filter((item) => fresh.has(item.id))) {
        notifyChallengeCompleted(session.group.id, challenge).catch((error) => console.warn("Could not send challenge notification", error));
      }
    }
    return NextResponse.json({ run }, { status: 201 });
  } catch (error) {
    if (isJsonParseError(error)) return NextResponse.json({ error: "Send a JSON body." }, { status: 400 });
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireSession();
    const body = await request.json();
    if (!isJsonObject(body)) return NextResponse.json({ error: "Send a JSON object." }, { status: 400 });
    const id = typeof body.id === "string" ? body.id.trim() : "";
    const reaction = typeof body.reaction === "string" ? body.reaction : "";
    if (!id) return NextResponse.json({ error: "Missing run id." }, { status: 400 });
    if (!isReactionType(reaction)) return NextResponse.json({ error: "Reaction is not supported." }, { status: 400 });
    const run = await toggleRunReaction(session.group.id, session.member.id, id, reaction);
    return NextResponse.json({ run });
  } catch (error) {
    if (isJsonParseError(error)) return NextResponse.json({ error: "Send a JSON body." }, { status: 400 });
    return errorResponse(error);
  }
}

function leaderForRuns(runs: Array<{ memberId: string; runner: string; miles: number }>) {
  const totals = new Map<string, { memberId: string; runner: string; total: number }>();
  for (const run of runs) {
    const row = totals.get(run.memberId) || { memberId: run.memberId, runner: run.runner, total: 0 };
    row.total += run.miles;
    totals.set(run.memberId, row);
  }
  return [...totals.values()].sort((a, b) => b.total - a.total)[0] || null;
}

function isReactionType(value: string): value is ReactionType {
  return value === "fire" || value === "nice" || value === "brutal" || value === "sus" || value === "respect" || value === "catching" || value === "monster" || value === "suspicious";
}

export async function DELETE(request: Request) {
  try {
    const session = await requireSession();
    const id = new URL(request.url).searchParams.get("id")?.trim();
    if (!id) return NextResponse.json({ error: "Missing run id." }, { status: 400 });

    const deleted = await deleteRun(session.group.id, session.member.id, id);
    if (!deleted) return NextResponse.json({ error: "Run not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

function errorResponse(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  const storeError = storeErrorResponse(error);
  return NextResponse.json({ error: storeError.message }, { status: storeError.status });
}
