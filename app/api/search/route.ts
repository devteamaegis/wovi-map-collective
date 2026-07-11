import { NextResponse } from "next/server";
import { globalSearch } from "@/lib/repos/search";
import { currentUser, authEnabled } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Search returns orgs/people/needs directory data.
  if (authEnabled() && !(await currentUser())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || "";
  const results = globalSearch(q);
  return NextResponse.json(results);
}
