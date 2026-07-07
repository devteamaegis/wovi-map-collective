"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Crosshair, Plus, Maximize2, SlidersHorizontal, X } from "lucide-react";
import type { GraphData, GraphNode, GraphLink } from "@/lib/repos/graph";
import { Drawer } from "./Drawer";
import { ConfidenceBar } from "./ConfidenceBar";
import {
  Badge,
  consentBadge,
  edgeKindBadge,
  orgKindBadge,
  consentRecordBadge,
  outcomeBadge,
} from "./Badge";
import { AddEdgeForm, NodeOption } from "./AddEdgeForm";
import type { NodeDetail, EdgeDetail } from "@/lib/repos/detail";
import { NODE_COLOR, LINK_RGB, linkConsentDash } from "@/lib/graph-style";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
});

function radiusFor(n: GraphNode): number {
  const base = n.type === "org" ? 4 : 2.6;
  return base + Math.sqrt(n.degree) * (n.type === "org" ? 1.7 : 1.0);
}

interface Filters {
  kinds: Set<string>;
  tag: string;
  region: string;
  minConfidence: number;
  consent: string;
}

const ALL_KINDS = ["buyer", "supplier", "broker", "facility", "person"];

export function GraphView({ data }: { data: GraphData }) {
  const router = useRouter();
  const fgRef = useRef<any>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });

  const [filters, setFilters] = useState<Filters>({
    kinds: new Set(ALL_KINDS),
    tag: "all",
    region: "all",
    minConfidence: 0,
    consent: "all",
  });
  const [focusQuery, setFocusQuery] = useState("");
  // Honor prefers-reduced-motion for the canvas particle animation (the CSS
  // media block can't reach react-force-graph's rAF loop).
  const reduceMotion = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    []
  );

  const [selNode, setSelNode] = useState<{ type: string; id: number } | null>(
    null
  );
  const [selEdge, setSelEdge] = useState<number | null>(null);
  const [nodeDetail, setNodeDetail] = useState<NodeDetail | null>(null);
  const [edgeDetail, setEdgeDetail] = useState<EdgeDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showAddEdge, setShowAddEdge] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false); // mobile filter sheet

  // Measure container.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // Let the onboarding tour open the mobile filter sheet so it can spotlight it.
  useEffect(() => {
    const open = () => setFiltersOpen(true);
    window.addEventListener("wovi:open-graph-filters", open);
    return () => window.removeEventListener("wovi:open-graph-filters", open);
  }, []);

  // Build master node/link objects ONCE so positions persist across filtering.
  const master = useMemo(() => {
    // Force-graph identifies nodes by `id`, and links reference node keys, so
    // `id` must equal the key. Keep the numeric DB id under `nid` for API calls.
    const nodeObjs = data.nodes.map((n) => ({ ...n, nid: n.id, id: n.key }));
    const linkObjs = data.links.map((l) => ({ ...l }));
    return { nodeObjs, linkObjs };
  }, [data]);

  const regions = useMemo(() => {
    const s = new Set<string>();
    data.nodes.forEach((n) => n.region && s.add(n.region));
    return Array.from(s).sort();
  }, [data]);

  const tags = useMemo(() => {
    const s = new Set<string>();
    data.nodes.forEach((n) => {
      n.materials.forEach((m) => s.add(m));
      n.capabilities.forEach((c) => s.add(c));
    });
    return Array.from(s).sort();
  }, [data]);

  const passNode = useCallback(
    (n: any): boolean => {
      if (!filters.kinds.has(n.nodeKind)) return false;
      if (filters.region !== "all" && n.region !== filters.region) return false;
      if (filters.tag !== "all") {
        const hay = [...n.materials, ...n.capabilities].map((s: string) =>
          s.toLowerCase()
        );
        if (n.type === "org" && !hay.some((h: string) => h === filters.tag.toLowerCase()))
          return false;
        if (n.type === "person") return false; // tag filter focuses on orgs
      }
      return true;
    },
    [filters]
  );

  const passLink = useCallback(
    (l: any): boolean => {
      if (l.confidence < filters.minConfidence) return false;
      if (filters.consent !== "all" && l.consent_status !== filters.consent)
        return false;
      return true;
    },
    [filters]
  );

  const graph = useMemo(() => {
    const vNodes = master.nodeObjs.filter(passNode);
    const vk = new Set(vNodes.map((n) => n.id));
    const vLinks = master.linkObjs.filter((l) => {
      const s = typeof l.source === "object" ? (l.source as any).id : l.source;
      const t = typeof l.target === "object" ? (l.target as any).id : l.target;
      return passLink(l) && vk.has(s) && vk.has(t);
    });
    return { nodes: vNodes, links: vLinks };
  }, [master, passNode, passLink]);

  const highlightId = useMemo(() => {
    if (!focusQuery.trim()) return null;
    const q = focusQuery.toLowerCase();
    const hit = graph.nodes.find((n: any) => n.label.toLowerCase().includes(q));
    return hit ? hit.id : null;
  }, [focusQuery, graph]);

  const doFocus = useCallback(() => {
    if (!highlightId || !fgRef.current) return;
    const node: any = graph.nodes.find((n: any) => n.id === highlightId);
    if (node && node.x != null) {
      fgRef.current.centerAt(node.x, node.y, 600);
      fgRef.current.zoom(4, 600);
    }
  }, [highlightId, graph]);

  // Guards against out-of-order responses: a slow request for node A must not
  // overwrite the panel after the user has already clicked node B.
  const detailReq = useRef(0);

  const fetchNode = useCallback(async (type: string, id: number) => {
    const my = ++detailReq.current;
    setLoadingDetail(true);
    setShowAddEdge(false);
    const res = await fetch(`/api/graph/node?type=${type}&id=${id}`);
    const d = res.ok ? await res.json() : null;
    if (my !== detailReq.current) return;
    setNodeDetail(d);
    setLoadingDetail(false);
  }, []);

  const fetchEdge = useCallback(async (id: number) => {
    const my = ++detailReq.current;
    setLoadingDetail(true);
    const res = await fetch(`/api/graph/edge?id=${id}`);
    const d = res.ok ? await res.json() : null;
    if (my !== detailReq.current) return;
    setEdgeDetail(d);
    setLoadingDetail(false);
  }, []);

  const onNodeClick = useCallback(
    (node: any) => {
      setSelEdge(null);
      setEdgeDetail(null);
      setSelNode({ type: node.type, id: node.nid });
      fetchNode(node.type, node.nid);
    },
    [fetchNode]
  );

  const onLinkClick = useCallback(
    (link: any) => {
      setSelNode(null);
      setNodeDetail(null);
      setSelEdge(link.id);
      fetchEdge(link.id);
    },
    [fetchEdge]
  );

  const nodeOptions: NodeOption[] = useMemo(
    () =>
      data.nodes.map((n) => ({
        key: n.key,
        type: n.type,
        id: n.id,
        label: n.label,
      })),
    [data]
  );

  const toggleKind = (k: string) => {
    setFilters((f) => {
      const kinds = new Set(f.kinds);
      if (kinds.has(k)) kinds.delete(k);
      else kinds.add(k);
      return { ...f, kinds };
    });
  };

  const closeDrawers = () => {
    setSelNode(null);
    setSelEdge(null);
    setNodeDetail(null);
    setEdgeDetail(null);
  };

  return (
    <div className="relative flex h-full w-full flex-col lg:flex-row">
      {/* Filter panel — left rail on desktop, bottom sheet on mobile */}
      <div
        data-tour="graph-filters"
        className={`fixed inset-x-0 bottom-0 z-30 max-h-[68vh] w-full overflow-y-auto rounded-t-2xl border-t border-white/10 bg-navy-2 px-4 py-5 text-white shadow-panel transition-transform duration-200 lg:static lg:z-auto lg:max-h-none lg:w-64 lg:shrink-0 lg:translate-y-0 lg:rounded-none lg:border-r lg:border-t-0 lg:shadow-none ${
          filtersOpen ? "translate-y-0" : "translate-y-full lg:translate-y-0"
        }`}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20 lg:hidden" />
        <div className="mb-3 flex items-center justify-between lg:mb-0">
          <span className="eyebrow eyebrow--light">Filters</span>
          <button
            onClick={() => setFiltersOpen(false)}
            className="rounded-md p-1 text-white/55 hover:bg-white/5 hover:text-white lg:hidden"
            aria-label="Close filters"
          >
            <X size={16} />
          </button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-5 lg:block lg:space-y-5">
          <div className="col-span-2">
            <p className="mb-2 text-[12px] font-medium text-white/70">Node kind</p>
            <div className="flex flex-wrap gap-1.5">
              {ALL_KINDS.map((k) => (
                <button
                  key={k}
                  onClick={() => toggleKind(k)}
                  aria-pressed={filters.kinds.has(k)}
                  className={`rounded-md border px-2 py-1 text-[11px] capitalize transition-colors ${
                    filters.kinds.has(k)
                      ? "border-transparent text-navy"
                      : "border-white/15 text-white/60"
                  }`}
                  style={
                    filters.kinds.has(k)
                      ? { background: NODE_COLOR[k] }
                      : undefined
                  }
                >
                  {k}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="gf-tag" className="mb-1.5 block text-[12px] font-medium text-white/70">
              Material / capability
            </label>
            <select
              id="gf-tag"
              value={filters.tag}
              onChange={(e) =>
                setFilters((f) => ({ ...f, tag: e.target.value }))
              }
              className="w-full rounded-md border border-white/15 bg-white/5 px-2 py-1.5 text-[13px] text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6e93b6]"
            >
              <option value="all" className="text-ink">
                All tags
              </option>
              {tags.map((t) => (
                <option key={t} value={t} className="text-ink">
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="gf-region" className="mb-1.5 block text-[12px] font-medium text-white/70">
              Country / region
            </label>
            <select
              id="gf-region"
              value={filters.region}
              onChange={(e) =>
                setFilters((f) => ({ ...f, region: e.target.value }))
              }
              className="w-full rounded-md border border-white/15 bg-white/5 px-2 py-1.5 text-[13px] text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6e93b6]"
            >
              <option value="all" className="text-ink">
                All regions
              </option>
              {regions.map((r) => (
                <option key={r} value={r} className="text-ink">
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="gf-consent" className="mb-1.5 block text-[12px] font-medium text-white/70">
              Consent status
            </label>
            <select
              id="gf-consent"
              value={filters.consent}
              onChange={(e) =>
                setFilters((f) => ({ ...f, consent: e.target.value }))
              }
              className="w-full rounded-md border border-white/15 bg-white/5 px-2 py-1.5 text-[13px] text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6e93b6]"
            >
              <option value="all" className="text-ink">
                Any consent
              </option>
              <option value="double_opt_in" className="text-ink">
                Double opt-in
              </option>
              <option value="one_sided" className="text-ink">
                One-sided
              </option>
              <option value="none" className="text-ink">
                No consent
              </option>
            </select>
          </div>

          <div className="col-span-2">
            <label htmlFor="gf-minconf" className="mb-1.5 block text-[12px] font-medium text-white/70">
              Min confidence: {filters.minConfidence}
            </label>
            <input
              id="gf-minconf"
              type="range"
              min={0}
              max={100}
              value={filters.minConfidence}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  minConfidence: Number(e.target.value),
                }))
              }
              className="w-full accent-[#6e93b6]"
            />
          </div>

          <div className="col-span-2">
            <label htmlFor="gf-focus" className="mb-1.5 block text-[12px] font-medium text-white/70">
              Search to focus
            </label>
            <div className="flex gap-1.5">
              <input
                value={focusQuery}
                onChange={(e) => setFocusQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && doFocus()}
                placeholder="Node name…"
                id="gf-focus"
                className="w-full rounded-md border border-white/15 bg-white/5 px-2 py-1.5 text-[13px] text-white placeholder:text-white/45 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6e93b6]"
              />
              <button
                onClick={doFocus}
                disabled={!highlightId}
                className="btn btn-sm shrink-0 border-white/15 bg-white/5 text-white disabled:opacity-40"
                title="Focus"
              >
                <Crosshair size={14} />
              </button>
            </div>
          </div>

          <div className="col-span-2 flex gap-2 pt-1">
            <button
              onClick={() => fgRef.current?.zoomToFit(500, 60)}
              className="btn btn-sm flex-1 border-white/15 bg-white/5 text-white"
            >
              <Maximize2 size={13} /> Fit
            </button>
            <button
              onClick={() =>
                setFilters({
                  kinds: new Set(ALL_KINDS),
                  tag: "all",
                  region: "all",
                  minConfidence: 0,
                  consent: "all",
                })
              }
              className="btn btn-sm flex-1 border-white/15 bg-white/5 text-white"
            >
              Reset
            </button>
          </div>

          <p className="col-span-2 text-[11px] text-white/60">
            {graph.nodes.length} nodes · {graph.links.length} edges shown
          </p>
        </div>
      </div>

      {/* Mobile filters trigger + scrim */}
      <button
        onClick={() => setFiltersOpen((v) => !v)}
        className="btn btn-sm absolute left-3 top-3 z-20 border-white/15 bg-[#0e131a]/85 text-white backdrop-blur lg:hidden"
      >
        <SlidersHorizontal size={14} /> Filters
        <span className="text-white/50">
          {graph.nodes.length}·{graph.links.length}
        </span>
      </button>
      {filtersOpen ? (
        <div
          onClick={() => setFiltersOpen(false)}
          className="fixed inset-0 z-20 bg-[#12171f]/50 lg:hidden"
          aria-hidden
        />
      ) : null}

      {/* Canvas */}
      <div
        ref={wrapRef}
        data-tour="graph-canvas"
        role="img"
        aria-label={`Relationship graph — ${graph.nodes.length} nodes and ${graph.links.length} edges. A keyboard-navigable list of the same nodes and edges follows.`}
        className="relative min-w-0 flex-1 touch-none bg-navy"
      >
        {/* Non-visual, keyboard-reachable equivalent of the canvas: the same
            nodes and edges as buttons that open the detail panel. This is the
            only path to the relationship data for keyboard / screen-reader
            users (the <canvas> exposes nothing to the AT tree). */}
        <ul className="sr-only">
          <li>
            {graph.nodes.length} nodes and {graph.links.length} edges. Activate a
            node or edge to open its details.
          </li>
          {graph.nodes.map((n: any) => (
            <li key={`n-${n.id}`}>
              <button type="button" onClick={() => onNodeClick(n)}>
                {n.label} — {n.nodeKind}, {n.degree} connection{n.degree === 1 ? "" : "s"}. Open details.
              </button>
            </li>
          ))}
          {graph.links.map((l: any) => {
            const sId = typeof l.source === "object" ? l.source.id : l.source;
            const tId = typeof l.target === "object" ? l.target.id : l.target;
            const sLabel = graph.nodes.find((n: any) => n.id === sId)?.label ?? sId;
            const tLabel = graph.nodes.find((n: any) => n.id === tId)?.label ?? tId;
            return (
              <li key={`e-${l.id}`}>
                <button type="button" onClick={() => onLinkClick(l)}>
                  {sLabel} {edgeKindBadge(l.kind).label} {tLabel}: confidence {l.confidence},{" "}
                  {consentBadge(l.consent_status).label}. Open details.
                </button>
              </li>
            );
          })}
        </ul>
        <ForceGraph2D
          ref={fgRef}
          width={size.w}
          height={size.h}
          graphData={graph}
          backgroundColor="#12171f"
          cooldownTicks={120}
          onEngineStop={() => fgRef.current?.zoomToFit(400, 60)}
          nodeRelSize={1}
          nodeVal={(n: any) => radiusFor(n) * radiusFor(n) * 0.18}
          nodeLabel={(n: any) => `${n.label}${n.sublabel ? " — " + n.sublabel : ""}`}
          onNodeClick={onNodeClick}
          onLinkClick={onLinkClick}
          linkColor={(l: any) => {
            const rgb = LINK_RGB[l.kind] || [150, 168, 188];
            const a =
              l.consent_status === "double_opt_in"
                ? 0.95
                : l.consent_status === "one_sided"
                  ? 0.7
                  : 0.4;
            return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
          }}
          linkWidth={(l: any) => 0.4 + (l.confidence / 100) * 2.4}
          linkLineDash={(l: any) => linkConsentDash(l.consent_status)}
          linkDirectionalParticles={(l: any) =>
            reduceMotion ? 0 : l.kind === "brokered_intro" || l.kind === "supplies" ? 2 : 0
          }
          linkDirectionalParticleWidth={1.7}
          linkDirectionalParticleColor={() => "rgba(220,232,247,0.9)"}
          nodeCanvasObject={(node: any, ctx, globalScale) => {
            const r = radiusFor(node);
            const color = NODE_COLOR[node.nodeKind] || "#9fb0c0";
            const highlight = node.id === highlightId;
            ctx.beginPath();
            ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
            ctx.fillStyle = color;
            ctx.fill();
            if (highlight) {
              ctx.lineWidth = 2 / globalScale;
              ctx.strokeStyle = "#ffffff";
              ctx.stroke();
            } else if (node.type === "org") {
              ctx.lineWidth = 0.6 / globalScale;
              ctx.strokeStyle = "rgba(255,255,255,0.25)";
              ctx.stroke();
            }
            // Labels: orgs always, people when zoomed in (or highlighted).
            if (node.type === "org" || globalScale > 1.6 || highlight) {
              const fontSize = Math.max(3, (node.type === "org" ? 4.2 : 3.4));
              ctx.font = `${fontSize}px ui-sans-serif, system-ui`;
              ctx.textAlign = "center";
              ctx.textBaseline = "top";
              ctx.fillStyle = highlight
                ? "#ffffff"
                : node.type === "org"
                  ? "rgba(233,238,242,0.92)"
                  : "rgba(200,212,224,0.7)";
              ctx.fillText(node.label, node.x, node.y + r + 1.2);
            }
          }}
          nodePointerAreaPaint={(node: any, color, ctx) => {
            const r = radiusFor(node);
            ctx.beginPath();
            ctx.arc(node.x, node.y, r + 2, 0, 2 * Math.PI);
            ctx.fillStyle = color;
            ctx.fill();
          }}
        />

        {/* Legend — kept (compact) on mobile too, since node color = kind and
            line style = consent are otherwise an unexplained encoding there. */}
        <div className="pointer-events-none absolute bottom-3 left-3 max-w-[88vw] rounded-lg border border-white/10 bg-[#0e131a]/90 px-3 py-2.5 text-[10px] text-white/70 backdrop-blur sm:bottom-4 sm:left-4 sm:px-3.5 sm:py-3 sm:text-[11px]">
          <div className="mb-1.5 flex flex-wrap gap-x-3 gap-y-1">
            {Object.entries(NODE_COLOR).map(([k, c]) => (
              <span key={k} className="inline-flex items-center gap-1 capitalize">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ background: c }}
                />
                {k}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-white/55">
            <span>━ double opt-in</span>
            <span>╌ one-sided</span>
            <span>┄ no consent</span>
            <span>→ particles = supply / intro</span>
          </div>
        </div>
      </div>

      {/* Node drawer */}
      <Drawer
        open={selNode != null}
        onClose={closeDrawers}
        eyebrow={
          nodeDetail
            ? nodeDetail.nodeKind === "person"
              ? "Person"
              : "Organization"
            : "Node"
        }
        title={nodeDetail?.label ?? "…"}
      >
        {loadingDetail && !nodeDetail ? (
          <p className="text-sm text-ink-3">Loading…</p>
        ) : nodeDetail ? (
          <div className="space-y-5">
            <div className="flex items-center gap-2">
              {nodeDetail.nodeKind !== "person" ? (
                <Badge tone={orgKindBadge(nodeDetail.nodeKind).tone}>
                  {orgKindBadge(nodeDetail.nodeKind).label}
                </Badge>
              ) : (
                <Badge tone="neutral">Person</Badge>
              )}
              {nodeDetail.sublabel ? (
                <span className="text-[12px] text-ink-3">
                  {nodeDetail.sublabel}
                </span>
              ) : null}
            </div>

            <dl className="rounded-lg border border-rule">
              {nodeDetail.profile.map((p) => (
                <div
                  key={p.label}
                  className="flex justify-between gap-4 border-b border-rule px-3 py-2 text-sm last:border-0"
                >
                  <dt className="text-[12px] uppercase tracking-wide text-ink-3">
                    {p.label}
                  </dt>
                  <dd className="text-right text-ink-2">{p.value}</dd>
                </div>
              ))}
            </dl>

            {nodeDetail.notes ? (
              <p className="rounded-lg bg-paper-2 px-3 py-2 text-[13px] text-ink-2">
                {nodeDetail.notes}
              </p>
            ) : null}

            {nodeDetail.people.length > 0 ? (
              <div>
                <span className="eyebrow">People</span>
                <ul className="mt-2 space-y-1">
                  {nodeDetail.people.map((pp) => (
                    <li key={pp.id}>
                      <Link
                        href={`/directory/person/${pp.id}`}
                        className="link-accent text-sm"
                      >
                        {pp.name}
                      </Link>
                      {pp.title ? (
                        <span className="text-[12px] text-ink-3"> · {pp.title}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div>
              <span className="eyebrow">Edges ({nodeDetail.edges.length})</span>
              <ul className="mt-2 space-y-2">
                {nodeDetail.edges.map((e) => (
                  <li
                    key={e.id}
                    className="rounded-lg border border-rule px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-ink">{e.otherLabel}</span>
                      <Badge tone={edgeKindBadge(e.kind).tone}>
                        {edgeKindBadge(e.kind).label}
                      </Badge>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <ConfidenceBar value={e.confidence} width="w-24" />
                      <Badge tone={consentBadge(e.consent_status).tone}>
                        {consentBadge(e.consent_status).label}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {nodeDetail.needs.length > 0 ? (
              <div>
                <span className="eyebrow">Needs</span>
                <ul className="mt-2 space-y-1">
                  {nodeDetail.needs.map((n) => (
                    <li key={n.id} className="text-sm">
                      <Link href={`/needs/${n.id}`} className="link-accent">
                        {n.title}
                      </Link>{" "}
                      <span className="text-[11px] text-ink-3">· {n.status}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {nodeDetail.paths.length > 0 ? (
              <div>
                <span className="eyebrow">Paths touching this node</span>
                <ul className="mt-2 space-y-1">
                  {nodeDetail.paths.map((p) => (
                    <li key={p.id} className="text-sm text-ink-2">
                      {p.need_title || "Path"}{" "}
                      <span className="text-[11px] text-ink-3">
                        · {p.status} · {p.confidence} conf
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2 border-t border-rule pt-4">
              <Link
                href={`/ask?fromType=${nodeDetail.type}&fromId=${nodeDetail.id}`}
                className="btn btn-sm"
              >
                <Crosshair size={13} /> Find paths from here
              </Link>
              <Link
                href={
                  nodeDetail.type === "org"
                    ? `/directory/org/${nodeDetail.id}`
                    : `/directory/person/${nodeDetail.id}`
                }
                className="btn btn-sm"
              >
                Open in directory
              </Link>
              <button
                onClick={() => setShowAddEdge((s) => !s)}
                className="btn btn-sm"
              >
                <Plus size={13} /> Add edge
              </button>
            </div>

            {showAddEdge ? (
              <div className="rounded-lg border border-rule bg-paper-2 p-3">
                <AddEdgeForm
                  sourceType={nodeDetail.type}
                  sourceId={nodeDetail.id}
                  options={nodeOptions}
                  onDone={() => {
                    setShowAddEdge(false);
                    fetchNode(nodeDetail.type, nodeDetail.id);
                    router.refresh();
                  }}
                />
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-ink-3">Node not found.</p>
        )}
      </Drawer>

      {/* Edge drawer */}
      <Drawer
        open={selEdge != null}
        onClose={closeDrawers}
        eyebrow="Edge"
        title={
          edgeDetail
            ? `${edgeDetail.sourceLabel} ↔ ${edgeDetail.targetLabel}`
            : "…"
        }
      >
        {loadingDetail && !edgeDetail ? (
          <p className="text-sm text-ink-3">Loading…</p>
        ) : edgeDetail ? (
          <EdgeDetailPanel d={edgeDetail} />
        ) : (
          <p className="text-sm text-ink-3">Edge not found.</p>
        )}
      </Drawer>
    </div>
  );
}

export function EdgeDetailPanel({ d }: { d: EdgeDetail }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={edgeKindBadge(d.kind).tone}>
          {edgeKindBadge(d.kind).label}
        </Badge>
        <Badge tone={consentBadge(d.consent_status).tone}>
          {consentBadge(d.consent_status).label}
        </Badge>
      </div>

      <div>
        <div className="mb-1.5 flex items-end justify-between">
          <span className="eyebrow">Confidence</span>
          <span className="serif text-2xl tabular-nums">{d.confidence}</span>
        </div>
        <ConfidenceBar value={d.confidence} showValue={false} />
        <div className="mt-3 rounded-lg border border-rule">
          {d.breakdown.map((b) => (
            <div
              key={b.label}
              className="flex items-center justify-between gap-3 border-b border-rule px-3 py-1.5 text-[13px] last:border-0"
            >
              <span className="text-ink-2">
                {b.label}
                <span className="ml-1.5 text-[11px] text-ink-3">{b.detail}</span>
              </span>
              <span
                className={`mono tabular-nums ${
                  b.value < 0 ? "text-[#9b3f37]" : "text-ink"
                }`}
              >
                {b.value > 0 ? "+" : ""}
                {b.value}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-ink-3">
          {d.signals.positives} positive · {d.signals.refusals} refusal signals
        </p>
      </div>

      {d.provenance || d.evidence_note ? (
        <div>
          <span className="eyebrow">Provenance</span>
          <p className="mt-2 text-[13px] text-ink-2">{d.provenance}</p>
          {d.evidence_note ? (
            <p className="mt-1 text-[12px] text-ink-3">{d.evidence_note}</p>
          ) : null}
        </div>
      ) : null}

      {d.outreach.length > 0 ? (
        <div>
          <span className="eyebrow">Outreach history</span>
          <ul className="mt-2 space-y-2">
            {d.outreach.map((o) => (
              <li key={o.id} className="rounded-lg border border-rule px-3 py-2">
                <div className="flex items-center justify-between text-[12px] text-ink-3">
                  <span className="capitalize">
                    {o.channel} · {o.direction === "out" ? "outbound" : "inbound"}
                    {o.person_name ? ` · ${o.person_name}` : ""}
                  </span>
                  {o.outcome ? (
                    <span className="capitalize">{o.outcome.replace("_", " ")}</span>
                  ) : null}
                </div>
                <p className="mt-1 text-[13px] text-ink-2">{o.summary}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {d.consents.length > 0 ? (
        <div>
          <span className="eyebrow">Consent history</span>
          <ul className="mt-2 space-y-1.5">
            {d.consents.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-2 text-[13px]"
              >
                <span className="text-ink-2">
                  {c.person_name} <span className="text-ink-3">({c.side})</span>
                </span>
                <Badge tone={consentRecordBadge(c.status).tone}>
                  {consentRecordBadge(c.status).label}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {d.outcomes.length > 0 ? (
        <div>
          <span className="eyebrow">Outcomes</span>
          <ul className="mt-2 space-y-1.5">
            {d.outcomes.map((o) => (
              <li
                key={o.id}
                className="flex items-center justify-between gap-2 text-[13px]"
              >
                <span className="text-ink-2">{o.note}</span>
                <Badge tone={outcomeBadge(o.result).tone}>
                  {outcomeBadge(o.result).label}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
