import { useState, useRef, useEffect } from "react";
import { useGetGraphNodes } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const RISK_COLORS: Record<string, string> = {
  critical: "#ef4444",
  high: "#f59e0b",
  medium: "#eab308",
  low: "#60a5fa",
  none: "#6b7280",
};

const TYPE_SHAPES: Record<string, string> = {
  asset: "rect",
  identity: "diamond",
  vulnerability: "triangle",
  control: "circle",
  risk: "rect",
  framework: "circle",
};

const EDGE_COLORS: Record<string, string> = {
  depends_on: "#374151",
  exploits: "#ef4444",
  controls: "#22c55e",
  maps_to: "#60a5fa",
  lateral_move: "#f59e0b",
  privilege_escalation: "#f97316",
};

const LEGEND = [
  { label: "Critical", color: "#ef4444" },
  { label: "High", color: "#f59e0b" },
  { label: "Medium", color: "#eab308" },
  { label: "Low / Info", color: "#60a5fa" },
  { label: "Safe", color: "#6b7280" },
];

const EDGE_LEGEND = [
  { label: "Exploits", color: "#ef4444" },
  { label: "Lateral Move", color: "#f59e0b" },
  { label: "Priv Escalation", color: "#f97316" },
  { label: "Controls", color: "#22c55e" },
  { label: "Depends On", color: "#374151" },
];

function GraphCanvas({ nodes, edges }: { nodes: any[]; edges: any[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [dragging, setDragging] = useState(false);
  const [start, setStart] = useState({ x: 0, y: 0 });
  const [selected, setSelected] = useState<string | null>(null);

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as SVGElement).tagName === "svg" || (e.target as SVGElement).tagName === "rect" && (e.target as SVGElement).getAttribute("data-bg")) {
      setDragging(true);
      setStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
    }
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    setTransform((t) => ({ ...t, x: e.clientX - start.x, y: e.clientY - start.y }));
  };
  const handleMouseUp = () => setDragging(false);
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    setTransform((t) => ({ ...t, scale: Math.min(2.5, Math.max(0.3, t.scale * factor)) }));
  };

  return (
    <svg
      ref={svgRef}
      className="w-full h-full cursor-grab active:cursor-grabbing"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      <rect width="100%" height="100%" fill="transparent" data-bg="true" />
      <g transform={`translate(${transform.x},${transform.y}) scale(${transform.scale})`}>
        {/* Edges */}
        {edges.map((e) => {
          const src = nodeMap.get(e.source);
          const tgt = nodeMap.get(e.target);
          if (!src || !tgt || !src.x || !tgt.x) return null;
          const color = EDGE_COLORS[e.type] ?? "#374151";
          const isHighlight = selected === e.source || selected === e.target;
          return (
            <g key={e.id}>
              <line
                x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y}
                stroke={color}
                strokeWidth={isHighlight ? 2 : 1}
                strokeOpacity={selected && !isHighlight ? 0.2 : 0.7}
                strokeDasharray={e.type === "depends_on" ? "4,3" : undefined}
              />
              {/* Arrow */}
              <circle cx={tgt.x + (src.x - tgt.x) * 0.15} cy={tgt.y + (src.y - tgt.y) * 0.15} r={2} fill={color} opacity={isHighlight ? 0.9 : 0.5} />
            </g>
          );
        })}
        {/* Nodes */}
        {nodes.map((n) => {
          if (!n.x) return null;
          const color = RISK_COLORS[n.risk] ?? "#6b7280";
          const isSelected = selected === n.id;
          const isHighlighted = !selected || selected === n.id || edges.some((e) => (e.source === selected && e.target === n.id) || (e.target === selected && e.source === n.id));
          return (
            <g
              key={n.id}
              transform={`translate(${n.x},${n.y})`}
              onClick={() => setSelected(selected === n.id ? null : n.id)}
              className="cursor-pointer"
              opacity={isHighlighted ? 1 : 0.3}
            >
              {n.type === "control" || n.type === "framework" ? (
                <circle r={18} fill={color} fillOpacity={0.12} stroke={color} strokeWidth={isSelected ? 2.5 : 1.5} />
              ) : n.type === "vulnerability" ? (
                <polygon points="0,-18 16,14 -16,14" fill={color} fillOpacity={0.12} stroke={color} strokeWidth={isSelected ? 2.5 : 1.5} />
              ) : (
                <rect x={-20} y={-12} width={40} height={24} fill={color} fillOpacity={0.12} stroke={color} strokeWidth={isSelected ? 2.5 : 1.5} />
              )}
              <text
                textAnchor="middle"
                dy={32}
                fontSize={9}
                fill={color}
                fontFamily="JetBrains Mono"
                fontWeight={isSelected ? "700" : "500"}
              >
                {n.label.length > 14 ? n.label.slice(0, 12) + "…" : n.label}
              </text>
              <text
                textAnchor="middle"
                dy={-1}
                fontSize={8}
                fill="hsl(var(--background))"
                fontFamily="JetBrains Mono"
                fontWeight="700"
              >
                {n.type.slice(0, 3).toUpperCase()}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}

export default function Graph() {
  const graph = useGetGraphNodes();

  return (
    <div data-testid="graph-page" className="flex flex-col h-[calc(100vh-7rem)]">
      {/* Legend */}
      <div className="bg-background border-b border-border px-4 py-2 flex flex-wrap items-center gap-4 shrink-0">
        <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground mr-2">Risk</div>
        {LEGEND.map((l) => (
          <div key={l.label} className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground">
            <div className="w-2 h-2" style={{ background: l.color }} />
            {l.label}
          </div>
        ))}
        <div className="w-px h-4 bg-border mx-1" />
        <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground mr-2">Edges</div>
        {EDGE_LEGEND.map((l) => (
          <div key={l.label} className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground">
            <div className="w-4 h-px" style={{ background: l.color }} />
            {l.label}
          </div>
        ))}
        <div className="ml-auto text-[9px] font-mono text-muted-foreground">Drag to pan • Scroll to zoom • Click node to highlight paths</div>
      </div>

      {/* Graph canvas */}
      <div className="flex-1 bg-background relative overflow-hidden" data-testid="graph-canvas">
        {graph.isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Skeleton className="w-[80%] h-[70%]" />
          </div>
        ) : (
          <GraphCanvas nodes={graph.data?.nodes ?? []} edges={graph.data?.edges ?? []} />
        )}

        {/* Stats overlay */}
        <div className="absolute top-4 right-4 bg-card border border-border p-3 font-mono text-[9px] space-y-1">
          <div className="text-muted-foreground uppercase tracking-widest mb-2">Graph Stats</div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Nodes</span>
            <span className="text-foreground font-bold">{graph.data?.nodes.length ?? 0}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Edges</span>
            <span className="text-foreground font-bold">{graph.data?.edges.length ?? 0}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Critical Nodes</span>
            <span className="text-red-500 font-bold">{graph.data?.nodes.filter((n) => n.risk === "critical").length ?? 0}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Exploit Edges</span>
            <span className="text-red-500 font-bold">{graph.data?.edges.filter((e) => e.type === "exploits").length ?? 0}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
