"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Paperclip, Upload, Trash2, FileText } from "lucide-react";
import { Eyebrow } from "@/components/Eyebrow";
import { Card } from "@/components/Card";
import { uploadAttachmentAction, deleteAttachmentAction } from "@/app/reserve/actions";

const KINDS = [
  { value: "mill_cert", label: "Mill certificate" },
  { value: "commercial_invoice", label: "Commercial invoice" },
  { value: "quote", label: "Quote document" },
  { value: "packing_list", label: "Packing list" },
  { value: "other", label: "Other" },
] as const;

const KIND_LABEL: Record<string, string> = Object.fromEntries(KINDS.map((k) => [k.value, k.label]));

export function AttachmentsPanel({ spotBuyId, attachments }: { spotBuyId: number; attachments: any[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<string>("mill_cert");
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = (file: File) =>
    start(async () => {
      setError(null);
      const fd = new FormData();
      fd.set("file", file);
      fd.set("spot_buy_id", String(spotBuyId));
      fd.set("kind", kind);
      const res = await uploadAttachmentAction(fd);
      if (res && !res.ok) setError(res.error ?? "Upload failed.");
      else router.refresh();
      if (fileRef.current) fileRef.current.value = "";
    });

  return (
    <Card className="mt-3 px-4 py-3">
      <div className="flex items-center gap-2">
        <Paperclip size={14} className="text-ink-3" />
        <Eyebrow>Documents ({attachments.length})</Eyebrow>
      </div>
      {attachments.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {attachments.map((a) => (
            <li key={a.id} className="flex items-center gap-2 rounded-lg border border-rule px-2.5 py-1.5">
              <FileText size={13} className="shrink-0 text-ink-3" />
              <a href={`/api/attachments/${a.id}`} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-[12px] text-ink hover:underline">
                {a.filename}
              </a>
              <span className="shrink-0 text-[10px] text-ink-3">{KIND_LABEL[a.kind] ?? a.kind}</span>
              <button
                onClick={() => start(async () => { await deleteAttachmentAction(a.id); router.refresh(); })}
                disabled={pending}
                className="shrink-0 text-ink-3 hover:text-danger"
                aria-label="Delete"
              >
                <Trash2 size={13} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[12px] text-ink-3">Mill certs, commercial invoices, and quote PDFs live here.</p>
      )}
      <div className="mt-2.5 flex items-center gap-2">
        <select value={kind} onChange={(e) => setKind(e.target.value)} className="field py-1 text-[12px]">
          {KINDS.map((k) => (
            <option key={k.value} value={k.value}>{k.label}</option>
          ))}
        </select>
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }}
        />
        <button onClick={() => fileRef.current?.click()} disabled={pending} className="btn btn-sm">
          <Upload size={13} /> {pending ? "Uploading…" : "Upload"}
        </button>
      </div>
      {error ? <p className="mt-2 text-[12px] text-danger">{error}</p> : null}
    </Card>
  );
}
