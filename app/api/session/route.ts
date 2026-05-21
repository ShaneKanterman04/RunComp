import { NextResponse } from "next/server";
import { clearSessionCookie, getCurrentSession, setSessionCookie } from "@/lib/auth";
import { getGroupContext, login, storeErrorResponse } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ authenticated: false });
  return NextResponse.json({
    authenticated: true,
    group: session.group,
    member: session.member,
    members: session.members,
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
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
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Send a JSON body." }, { status: 400 });
    const storeError = storeErrorResponse(error);
    return NextResponse.json({ error: storeError.message }, { status: storeError.status });
  }
}

export async function DELETE() {
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
