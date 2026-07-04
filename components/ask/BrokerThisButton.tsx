"use client";

import { useTransition } from "react";
import { Hand } from "lucide-react";
import { brokerThisAction, BrokerThisInput } from "@/app/actions";

export function BrokerThisButton({ input }: { input: BrokerThisInput }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      onClick={() => startTransition(() => void brokerThisAction(input))}
      disabled={pending}
      className="btn btn-primary btn-sm"
    >
      <Hand size={13} /> {pending ? "Creating…" : "Broker this"}
    </button>
  );
}
