import Link from "next/link";
import { Stamp, Building2 } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/Page";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { urgencyBadge } from "@/components/reserve/badges";
import { ApprovalButtons } from "@/components/reserve/ApprovalButtons";
import { EmptyState } from "@/components/EmptyState";
import { approvalsQueue } from "@/lib/repos/reserve";
import { fmtMoney } from "@/lib/reserve/logic";

export const dynamic = "force-dynamic";
export const metadata = { title: "Approvals" };

export default function ApprovalsPage() {
  const queue = approvalsQueue();

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Reserve · Delegation of authority"
        title="Approvals — the control that stays human"
        description="The sign-off is a deliberate control (SOX §404, segregation of duties), not a defect. Reserve routes it with full context and collapses the waiting around it — the human still approves."
      />

      {queue.length === 0 ? (
        <EmptyState
          title="Nothing awaiting approval"
          description="Every routed requisition has been decided. New submissions land here with full context."
        />
      ) : (
        <div className="space-y-2.5">
          {queue.map((a) => (
            <Card key={a.id} className="px-4 py-4 sm:px-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Stamp size={15} className="text-ink-3" />
                    <Link
                      href={`/reserve/${a.spot_buy_id}`}
                      className="font-medium text-ink hover:underline"
                    >
                      {a.title}
                    </Link>
                  </div>
                  <p className="mt-1 text-[12px] text-ink-3">
                    <span className="mono">{a.ref}</span>
                    {" · "}
                    <span className="inline-flex items-center gap-1">
                      <Building2 size={12} /> {a.buyer_org_name || "—"}
                    </span>
                  </p>
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    <Badge tone={urgencyBadge(a.urgency).tone}>
                      {urgencyBadge(a.urgency).label}
                    </Badge>
                    <Badge tone="neutral">{a.role || "Approver"}</Badge>
                    {a.approver_name ? (
                      <span className="text-[12px] text-ink-3">
                        routed to {a.approver_name}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <div className="text-right">
                    <div className="serif text-xl tabular-nums text-ink">
                      {fmtMoney(a.amount)}
                    </div>
                    <div className="text-[11px] text-ink-3">
                      band {fmtMoney(a.threshold_min ?? 0)}
                      {a.threshold_max != null
                        ? `–${fmtMoney(a.threshold_max)}`
                        : "+"}
                    </div>
                  </div>
                  <ApprovalButtons
                    approvalId={a.id}
                    approverPersonId={a.approver_person_id}
                    compact
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
