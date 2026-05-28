import { NextResponse } from "next/server";
import { clearSessionCookie, getCurrentSession, setSessionCookie, verifyInviteToken } from "@/lib/auth";
import { getGroupContext, login, storeErrorResponse } from "@/lib/store";
import { isJsonObject, isJsonParseError } from "../route-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getCurrentSession();
    if (!session) return NextResponse.json({ authenticated: false });
    return NextResponse.json({
      authenticated: true,
      group: session.group,
      member: session.member,
      members: session.members,
    });
  } catch (error) {
    const storeError = storeErrorResponse(error);
    return NextResponse.json({ error: storeError.message }, { status: storeError.status });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!isJsonObject(body)) return NextResponse.json({ error: "Send a JSON object." }, { status: 400 });
    const inviteToken = typeof body.inviteToken === "string" ? body.inviteToken.trim() : "";
    if (inviteToken) {
      const invite = await verifyInviteToken(inviteToken);
      if (!invite) return NextResponse.json({ error: "Invite link is expired or invalid." }, { status: 401 });
      const context = await getGroupContext(invite.groupId, invite.memberId);
      if (!context) return NextResponse.json({ error: "Invite member no longer exists." }, { status: 404 });
      await setSessionCookie({ groupId: context.group.id, memberId: context.member.id, role: context.member.role });
      return NextResponse.json({
        authenticated: true,
        group: context.group,
        member: context.member,
        members: context.members,
      });
    }
    if (typeof body.groupCode !== "string" || !body.groupCode.trim()) {
      return NextResponse.json({ error: "Trail code is required." }, { status: 400 });
    }
    if (typeof body.password !== "string" || !body.password.trim()) {
      return NextResponse.json({ error: "Runner password is required." }, { status: 400 });
    }

    const { group, member } = await login({
      groupCode: typeof body.groupCode === "string" ? body.groupCode : "",
      memberName: typeof body.memberName === "string" ? body.memberName : "",
      password: typeof body.password === "string" ? body.password : "",
    });
    await setSessionCookie({ groupId: group.id, memberId: member.id, role: member.role });
    const context = await getGroupContext(group.id, member.id);
    return NextResponse.json({
      authenticated: true,
      group,
      member,
      members: context?.members || [member],
    });
  } catch (error) {
    if (isJsonParseError(error)) return NextResponse.json({ error: "Send a JSON body." }, { status: 400 });
    const storeError = storeErrorResponse(error);
    return NextResponse.json({ error: storeError.message }, { status: storeError.status });
  }
}

export async function DELETE() {
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
