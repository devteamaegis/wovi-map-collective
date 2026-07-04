import { NextResponse } from "next/server";
import { getAttachment, readAttachmentBytes } from "@/lib/repos/attachments";
import { currentUser, authEnabled } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Authenticated download of a stored document (#9).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (authEnabled() && !(await currentUser())) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  const { id } = await params;
  const a = getAttachment(Number(id));
  if (!a) return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  const bytes = readAttachmentBytes(a);
  if (!bytes) return NextResponse.json({ ok: false, error: "File missing from store." }, { status: 410 });
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": a.mime || "application/octet-stream",
      "Content-Disposition": `inline; filename="${a.filename.replace(/"/g, "")}"`,
      "Content-Length": String(a.size),
    },
  });
}
