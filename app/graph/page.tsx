import { graphData } from "@/lib/repos/graph";
import { GraphView } from "@/components/GraphView";

export const dynamic = "force-dynamic";
export const metadata = { title: "Relationship graph" };

export default function GraphPage() {
  const data = graphData();
  return (
    <div className="h-[calc(100vh-3.5rem)] w-full [height:calc(100dvh-3.5rem)]">
      <h1 className="sr-only">Relationship graph</h1>
      <GraphView data={data} />
    </div>
  );
}
