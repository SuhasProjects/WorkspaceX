import { NextResponse } from "next/server";
import type { ApiResponse } from "@/types/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  const body: ApiResponse<{ status: "ok"; service: "workspacezero" }> = {
    data: { status: "ok", service: "workspacezero" },
  };
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}
