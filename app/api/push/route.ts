import { NextResponse } from "next/server";
import { AuthError, requireSession } from "@/lib/auth";
import { getVapidPublicKey } from "@/lib/push";
import { removePushSubscription, savePushSubscription, storeErrorResponse } from "@/lib/store";
import { isJsonObject, isJsonParseError } from "../route-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ publicKey: await getVapidPublicKey() });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const body = await request.json();
    if (!isJsonObject(body)) return NextResponse.json({ error: "Send a JSON object." }, { status: 400 });
    const subscription = isJsonObject(body.subscription) ? body.subscription : undefined;
    if (!subscription) return NextResponse.json({ error: "Missing push subscription." }, { status: 400 });
    const endpoint = typeof subscription.endpoint === "string" ? subscription.endpoint.trim() : "";
    if (!endpoint) return NextResponse.json({ error: "Missing push subscription endpoint." }, { status: 400 });
    const keys = isJsonObject(subscription.keys) ? subscription.keys : {};
    await savePushSubscription(session.group.id, session.member.id, {
      endpoint,
      keys: {
        p256dh: typeof keys.p256dh === "string" ? keys.p256dh : "",
        auth: typeof keys.auth === "string" ? keys.auth : "",
      },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isJsonParseError(error)) return NextResponse.json({ error: "Send a JSON body." }, { status: 400 });
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireSession();
    const body = await request.json();
    if (!isJsonObject(body)) return NextResponse.json({ error: "Send a JSON object." }, { status: 400 });
    const endpoint = typeof body.endpoint === "string" ? body.endpoint.trim() : "";
    if (!endpoint) return NextResponse.json({ error: "Missing push subscription endpoint." }, { status: 400 });
    await removePushSubscription(session.group.id, endpoint, session.member.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isJsonParseError(error)) return NextResponse.json({ error: "Send a JSON body." }, { status: 400 });
    return errorResponse(error);
  }
}

function errorResponse(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  const storeError = storeErrorResponse(error);
  return NextResponse.json({ error: storeError.message }, { status: storeError.status });
}
