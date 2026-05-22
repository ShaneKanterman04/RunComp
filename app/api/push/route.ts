import { NextResponse } from "next/server";
import { AuthError, requireSession } from "@/lib/auth";
import { getVapidPublicKey } from "@/lib/push";
import { removePushSubscription, savePushSubscription, storeErrorResponse } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ publicKey: await getVapidPublicKey() });
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const body = (await request.json()) as Record<string, unknown>;
    const subscription = body.subscription as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } | undefined;
    await savePushSubscription(session.group.id, session.member.id, {
      endpoint: typeof subscription?.endpoint === "string" ? subscription.endpoint : "",
      keys: {
        p256dh: typeof subscription?.keys?.p256dh === "string" ? subscription.keys.p256dh : "",
        auth: typeof subscription?.keys?.auth === "string" ? subscription.keys.auth : "",
      },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Send a JSON body." }, { status: 400 });
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireSession();
    const body = (await request.json()) as Record<string, unknown>;
    const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
    await removePushSubscription(session.group.id, endpoint);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Send a JSON body." }, { status: 400 });
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
