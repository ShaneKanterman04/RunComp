import { NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/auth";
import { createGroup, getGroupContext, storeErrorResponse } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const { group, member } = await createGroup({
      groupName: typeof body.groupName === "string" ? body.groupName : "",
      ownerName: typeof body.ownerName === "string" ? body.ownerName : "",
      password: typeof body.password === "string" ? body.password : "",
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
