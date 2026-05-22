import { NextResponse } from "next/server";
import { AuthError, requireSession } from "@/lib/auth";
import { notifyLeadChanged, notifyRunLogged } from "@/lib/push";
import { addRun, deleteRun, listRuns, storeErrorResponse, toggleRunReaction, type ReactionType } from "@/lib/store";

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
    const payload = body as Record<string, unknown>;
    const miles = typeof payload.miles === "number" ? payload.miles : Number(payload.miles);
    const durationSeconds =
      typeof payload.durationSeconds === "number"
        ? payload.durationSeconds
        : typeof payload.durationSeconds === "string" && payload.durationSeconds.trim()
          ? Number(payload.durationSeconds)
          : undefined;
    const date = typeof payload.date === "string" ? payload.date : "";
    const note = typeof payload.note === "string" ? payload.note : "";

    if (!Number.isFinite(miles) || miles <= 0 || miles > 100) {
      return NextResponse.json({ error: "Miles must be between 0 and 100." }, { status: 400 });
    }
    if (!isValidDate(date)) {
      return NextResponse.json({ error: "Date must be a valid YYYY-MM-DD value." }, { status: 400 });
    }
    if (durationSeconds !== undefined && (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > 172800)) {
      return NextResponse.json({ error: "Run time must be between 1 second and 48 hours." }, { status: 400 });
    }

    const beforeRuns = await listRuns(session.group.id, session.member.id);
    const beforeLeader = leaderForRuns(beforeRuns);
    const run = await addRun(session.group.id, session.member.id, { miles, date, note, durationSeconds });
    notifyRunLogged(session.group.id, run).catch((error) => console.warn("Could not send run notification", error));
    const afterLeader = leaderForRuns(await listRuns(session.group.id, session.member.id));
    if (afterLeader && beforeLeader && afterLeader.memberId !== beforeLeader.memberId) {
      notifyLeadChanged(session.group.id, afterLeader.runner, afterLeader.total).catch((error) => console.warn("Could not send lead notification", error));
    }
    return NextResponse.json({ run }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Send a JSON body." }, { status: 400 });
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireSession();
    const body = (await request.json()) as Record<string, unknown>;
    const id = typeof body.id === "string" ? body.id : "";
    const reaction = typeof body.reaction === "string" ? body.reaction : "";
    if (!id) return NextResponse.json({ error: "Missing run id." }, { status: 400 });
    if (!isReactionType(reaction)) return NextResponse.json({ error: "Reaction is not supported." }, { status: 400 });
    const run = await toggleRunReaction(session.group.id, session.member.id, id, reaction);
    return NextResponse.json({ run });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Send a JSON body." }, { status: 400 });
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
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing run id." }, { status: 400 });

    const deleted = await deleteRun(session.group.id, session.member.id, session.member.role, id);
    if (!deleted) return NextResponse.json({ error: "Run not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(timestamp);
}

function errorResponse(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  const storeError = storeErrorResponse(error);
  return NextResponse.json({ error: storeError.message }, { status: storeError.status });
}
