import { NextResponse } from "next/server";
import { AuthError, requireSession, setSessionCookie } from "@/lib/auth";
import { createGroup, getGroupContext, storeErrorResponse, updateGroupGoal } from "@/lib/store";
import { isJsonObject } from "../route-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!isJsonObject(body)) return NextResponse.json({ error: "Send a JSON object." }, { status: 400 });
    const goalMiles = parseGoalMiles(body.goalMiles, 100);
    if (goalMiles === null) return NextResponse.json({ error: "Goal miles must be a number." }, { status: 400 });
    const { group, member } = await createGroup({
      groupName: typeof body.groupName === "string" ? body.groupName : "",
      ownerName: typeof body.ownerName === "string" ? body.ownerName : "",
      password: typeof body.password === "string" ? body.password : "",
      goalMiles,
    });
    await setSessionCookie({ groupId: group.id, memberId: member.id, role: member.role });
    const context = await getGroupContext(group.id, member.id);
    return NextResponse.json(
      {
        authenticated: true,
        group,
        member,
        members: context?.members || [member],
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Send a JSON body." }, { status: 400 });
    const storeError = storeErrorResponse(error);
    return NextResponse.json({ error: storeError.message }, { status: storeError.status });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireSession();
    if (session.member.role !== "owner") {
      return NextResponse.json({ error: "Only the group owner can update the race goal." }, { status: 403 });
    }
    const body = await request.json();
    if (!isJsonObject(body)) return NextResponse.json({ error: "Send a JSON object." }, { status: 400 });
    const goalMiles = parseGoalMiles(body.goalMiles);
    if (goalMiles === null) return NextResponse.json({ error: "Goal miles must be a number." }, { status: 400 });
    const group = await updateGroupGoal(session.group.id, session.member.id, goalMiles);
    return NextResponse.json({ group });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Send a JSON body." }, { status: 400 });
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    const storeError = storeErrorResponse(error);
    return NextResponse.json({ error: storeError.message }, { status: storeError.status });
  }
}

function parseGoalMiles(value: unknown, fallback?: number) {
  if ((value === undefined || value === null || value === "") && fallback !== undefined) return fallback;
  const goal = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(goal) ? goal : null;
}
