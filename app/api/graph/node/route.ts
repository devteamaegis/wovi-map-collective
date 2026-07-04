import { NextResponse } from "next/server";
import { nodeDetail } from "@/lib/repos/detail";
import type { NodeType } from "@/lib/types";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") as NodeType | null;
  const id = Number(searchParams.get("id"));
  if (!type || !id) {
    return NextResponse.json({ error: "type and id required" }, { status: 400 });
  }
  const detail = nodeDetail(type, id);
  if (!detail) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(detail);
}
