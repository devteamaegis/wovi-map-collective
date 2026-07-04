"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { GraphData, GraphNode } from "@/lib/repos/graph";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
});

const NODE_COLOR: Record<string, string> = {
  buyer: "#6e93b6",
  supplier: "#74b08f",
  broker: "#b297cf",
  facility: "#c9b487",
  person: "#9fb0c0",
};

function radiusFor(n: GraphNode): number {
  const base = n.type === "org" ? 3.4 : 2.2;
  return base + Math.sqrt(n.degree) * (n.type === "org" ? 1.3 : 0.8);
}

// Read-only mini graph for the dashboard; clicking anywhere opens /graph.
export function GraphSnapshot({ data }: { data: GraphData }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<any>(null);
  const [size, setSize] = useState({ w: 600, h: 320 });

  const graph = {
    nodes: data.nodes.map((n) => ({ ...n, id: n.key })),
    links: data.links.map((l) => ({ ...l })),
  };

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() =>
      setSize({ w: el.clientWidth, h: el.clientHeight })
    );
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={wrapRef}
      className="relative h-[320px] w-full overflow-hidden rounded-xl bg-navy"
    >
      <ForceGraph2D
        ref={fgRef}
        width={size.w}
        height={size.h}
        graphData={graph}
        backgroundColor="#12171f"
        cooldownTicks={80}
        onEngineStop={() => fgRef.current?.zoomToFit(300, 30)}
        enableNodeDrag={false}
        nodeRelSize={1}
        nodeVal={(n: any) => radiusFor(n) * radiusFor(n) * 0.18}
        nodeColor={(n: any) => NODE_COLOR[n.nodeKind] || "#9fb0c0"}
        linkColor={(l: any) =>
          l.consent_status === "double_opt_in"
            ? "rgba(143,176,208,0.85)"
            : l.consent_status === "one_sided"
              ? "rgba(150,168,188,0.55)"
              : "rgba(150,168,188,0.28)"
        }
        linkWidth={(l: any) => 0.3 + (l.confidence / 100) * 1.6}
        linkDirectionalParticles={(l: any) =>
          l.kind === "brokered_intro" || l.kind === "supplies" ? 2 : 0
        }
        linkDirectionalParticleWidth={1.4}
        linkDirectionalParticleColor={() => "rgba(220,232,247,0.9)"}
      />
      {/* Click-through overlay → full graph */}
      <Link
        href="/graph"
        className="absolute inset-0 z-10 flex items-end justify-end p-4"
      >
        <span className="btn btn-sm border-white/15 bg-white/10 text-white backdrop-blur">
          Open relationship graph <ArrowUpRight size={14} />
        </span>
      </Link>
    </div>
  );
}
