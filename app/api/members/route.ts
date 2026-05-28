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
    if (typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json({ error: "Runner name is required." }, { status: 400 });
    }
    if (typeof body.password !== "string") {
      return NextResponse.json({ error: "Runner password is required." }, { status: 400 });
    }
    const member = await addMember(session.group.id, session.member.id, {
      name: body.name,
      password: body.password,
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
    if (!memberId) return NextResponse.json({ error: "Missing runner id." }, { status: 400 });
    const hasName = typeof body.name === "string";
    const hasPassword = typeof body.password === "string";
    if (hasName === hasPassword) {
      return NextResponse.json({ error: "Send either a runner name or password." }, { status: 400 });
    }
    const member = hasPassword
      ? await resetMemberPassword(session.group.id, session.member.id, memberId, body.password as string)
      : await updateMemberName(session.group.id, session.member.id, memberId, body.name as string);
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
