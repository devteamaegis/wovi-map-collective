import { NextResponse } from "next/server";
import { globalSearch } from "@/lib/repos/search";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || "";
  const results = globalSearch(q);
  return NextResponse.json(results);
}
