import { NextResponse } from "next/server";
import { addRun, deleteRun, isRunner, listRuns } from "@/lib/runs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const runs = await listRuns();
  return NextResponse.json({ runs });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send a JSON body." }, { status: 400 });
  }

  const payload = body as Record<string, unknown>;
  const runner = payload.runner;
  const miles = typeof payload.miles === "number" ? payload.miles : Number(payload.miles);
  const date = typeof payload.date === "string" ? payload.date : "";
  const note = typeof payload.note === "string" ? payload.note : "";

  if (!isRunner(runner)) {
    return NextResponse.json({ error: "Runner must be Shane or Molly." }, { status: 400 });
  }
  if (!Number.isFinite(miles) || miles <= 0 || miles > 100) {
    return NextResponse.json({ error: "Miles must be between 0 and 100." }, { status: 400 });
  }
  if (!isValidDate(date)) {
    return NextResponse.json({ error: "Date must be a valid YYYY-MM-DD value." }, { status: 400 });
  }

  const run = await addRun({ runner, miles, date, note });
  return NextResponse.json({ run }, { status: 201 });
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing run id." }, { status: 400 });

  const deleted = await deleteRun(id);
  if (!deleted) return NextResponse.json({ error: "Run not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(timestamp);
}
