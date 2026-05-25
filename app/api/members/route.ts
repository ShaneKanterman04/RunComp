import { NextResponse } from "next/server";
import { AuthError, requireSession } from "@/lib/auth";
import { addMember, getGroupContext, removeInactiveMember, resetMemberPassword, storeErrorResponse, updateMemberName } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    if (session.member.role !== "owner") {
      return NextResponse.json({ error: "Only the group owner can create member passwords." }, { status: 403 });
    }
    const body = (await request.json()) as Record<string, unknown>;
    const member = await addMember(session.group.id, {
      name: typeof body.name === "string" ? body.name : "",
      password: typeof body.password === "string" ? body.password : "",
    });
    return NextResponse.json({ member }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Send a JSON body." }, { status: 400 });
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    const storeError = storeErrorResponse(error);
    return NextResponse.json({ error: storeError.message }, { status: storeError.status });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireSession();
    if (session.member.role !== "owner") {
      return NextResponse.json({ error: "Only the group owner can manage runners." }, { status: 403 });
    }
    const body = (await request.json()) as Record<string, unknown>;
    const memberId = typeof body.memberId === "string" ? body.memberId : "";
    const member =
      typeof body.password === "string"
        ? await resetMemberPassword(session.group.id, memberId, body.password)
        : await updateMemberName(session.group.id, memberId, typeof body.name === "string" ? body.name : "");
    const context = await getGroupContext(session.group.id, session.member.id);
    return NextResponse.json({ member, members: context?.members || [] });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Send a JSON body." }, { status: 400 });
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    const storeError = storeErrorResponse(error);
    return NextResponse.json({ error: storeError.message }, { status: storeError.status });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireSession();
    if (session.member.role !== "owner") {
      return NextResponse.json({ error: "Only the group owner can remove runners." }, { status: 403 });
    }
    const { searchParams } = new URL(request.url);
    const removed = await removeInactiveMember(session.group.id, searchParams.get("id") || "", session.member.id);
    if (!removed) return NextResponse.json({ error: "Runner not found." }, { status: 404 });
    const context = await getGroupContext(session.group.id, session.member.id);
    return NextResponse.json({ members: context?.members || [] });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    const storeError = storeErrorResponse(error);
    return NextResponse.json({ error: storeError.message }, { status: storeError.status });
  }
}
