import { NextResponse } from "next/server";
import { AuthError, requireSession } from "@/lib/auth";
import { addMember, storeErrorResponse } from "@/lib/store";

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
