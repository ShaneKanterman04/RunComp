import { NextResponse } from "next/server";
import { AuthError, requireSession } from "@/lib/auth";
import { exportGroupBackup, exportRunsCsv, storeErrorResponse } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const { searchParams } = new URL(request.url);
    const requestedType = (searchParams.get("type") || "").trim().toLowerCase();
    const type = requestedType || "json";
    if (type !== "json" && type !== "csv") {
      return NextResponse.json({ error: "Export type must be json or csv." }, { status: 400 });
    }
    const stamp = new Date().toISOString().slice(0, 10);
    const filenameCode = filenameSafeSegment(session.group.code);
    if (type === "csv") {
      const csv = await exportRunsCsv(session.group.id);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="runcomp-${filenameCode}-runs-${stamp}.csv"`,
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    if (session.member.role !== "owner") {
      return NextResponse.json({ error: "Only the group owner can download a full backup." }, { status: 403 });
    }
    const backup = await exportGroupBackup(session.group.id);
    return NextResponse.json(backup, {
      headers: {
        "Content-Disposition": `attachment; filename="runcomp-${filenameCode}-backup-${stamp}.json"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    const storeError = storeErrorResponse(error);
    return NextResponse.json({ error: storeError.message }, { status: storeError.status });
  }
}

function filenameSafeSegment(value: string) {
  const segment = value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  return segment || "group";
}
