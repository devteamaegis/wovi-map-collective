import { NextResponse } from "next/server";
import { edgeDetail } from "@/lib/repos/detail";
import { currentUser, authEnabled } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Edge detail exposes provenance, consents, and outreach history.
  if (authEnabled() && !(await currentUser())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const id = Number(searchParams.get("id"));
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  const detail = edgeDetail(id);
  if (!detail) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(detail);
}
