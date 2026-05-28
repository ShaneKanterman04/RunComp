import { NextResponse } from "next/server";
import { AuthError, createInviteToken, requireSession } from "@/lib/auth";
import { storeErrorResponse } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    if (session.member.role !== "owner") {
      return NextResponse.json({ error: "Only the group owner can create login links." }, { status: 403 });
    }

    const body = await request.json();
    if (!isJsonObject(body)) return NextResponse.json({ error: "Send a JSON object." }, { status: 400 });
    const memberId = typeof body.memberId === "string" ? body.memberId : "";
    const member = session.members.find((row) => row.id === memberId);
    if (!member) return NextResponse.json({ error: "Runner not found in this group." }, { status: 404 });

    const token = await createInviteToken({
      groupId: session.group.id,
      memberId: member.id,
      role: member.role,
    });

    return NextResponse.json({ token, member });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Send a JSON body." }, { status: 400 });
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    const storeError = storeErrorResponse(error);
    return NextResponse.json({ error: storeError.message }, { status: storeError.status });
  }
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
