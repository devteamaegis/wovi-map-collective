import { NextResponse } from "next/server";
import { nodeDetail } from "@/lib/repos/detail";
import type { NodeType } from "@/lib/types";
import { currentUser, authEnabled } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Node detail exposes a person's private contact channels and relationships;
  // when auth is on it must not be readable without a valid session.
  if (authEnabled() && !(await currentUser())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
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
