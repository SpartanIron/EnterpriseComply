import { useState, useRef } from "react";
import { useGetGraphNodes } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const NODE_COLORS: Record<string, { fill: string; stroke: string; text: string }> = {
  critical: { fill: "#fef2f2", stroke: "#ef4444", text: "#dc2626" },
  high:     { fill: "#fffbeb", stroke: "#f59e0b", text: "#d97706" },
  medium:   { fill: "#fefce8", stroke: "#eab308", text: "#ca8a04" },
  low:      { fill: "#eff6ff", stroke: "#3b82f6", text: "#2563eb" },
  none:     { fill: "#f0fdf4", stroke: "#22c55e", text: "#16a34a" },
};

const EDGE_COLORS: Record<string, string> = {
  depends_on:           "#94a3b8",
  exploits:             "#ef4444",
  controls:             "#22c55e",
  maps_to:              "#3b82f6",
  lateral_move:         "#f59e0b",
  privilege_escalation: "#f97316",
};

const LEGEND_NODES = [
  { label: "Critical", color: "#ef4444", fill: "#fef2f2" },
  { label: "High", color: "#f59e0b", fill: "#fffbeb" },
  { label: "Medium", color: "#eab308", fill: "#fefce8" },
  { label: "Low", color: "#3b82f6", fill: "#eff6ff" },
  { label: "Safe", color: "#22c55e", fill: "#f0fdf4" },
];

const LEGEND_EDGES = [
  { label: "Exploits", color: "#ef4444" },
  { label: "Lateral Move", color: "#f59e0b" },
  { label: "Priv. Escalation", color: "#f97316" },
  { label: "Controls", color: "#22c55e" },
  { label: "Depends On", color: "#94a3b8" },
];

function GraphCanvas({ nodes, edges }: { nodes: any[]; edges: any[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [dragging, setDragging] = useState(false);
  const [start, setStart] = useState({ x: 0, y: 0 });
  const [selected, setSelected] = useState<string | null>(null);

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  const isHighlighted = (nodeId: string) =>
    !selected || selected === nodeId ||
    edges.some((e) => (e.source === selected && e.target === nodeId) || (e.target === selected && e.source === nodeId));

  const isEdgeHighlighted = (e: any) => !selected || e.source === selected || e.target === selected;

  return (
    <svg
      ref={svgRef}
      className="w-full h-full cursor-grab active:cursor-grabbing"
      style={{ background: "hsl(var(--background))" }}
      onMouseDown={(ev) => {
        if ((ev.target as SVGElement).tagName === "svg" || (ev.target as SVGElement).getAttribute("data-bg")) {
          setDragging(true);
          setStart({ x: ev.clientX - transform.x, y: ev.clientY - transform.y });
        }
      }}
      onMouseMove={(ev) => { if (dragging) setTransform((t) => ({ ...t, x: ev.clientX - start.x, y: ev.clientY - start.y })); }}
      onMouseUp={() => setDragging(false)}
      onMouseLeave={() => setDragging(false)}
      onWheel={(ev) => {
        ev.preventDefault();
        setTransform((t) => ({ ...t, scale: Math.min(2.5, Math.max(0.3, t.scale * (ev.deltaY < 0 ? 1.1 : 0.9))) }));
      }}
    >
      <rect width="100%" height="100%" fill="transparent" data-bg="true" />
      <g transform={`translate(${transform.x},${transform.y}) scale(${transform.scale})`}>
        {/* Edges */}
        {edges.map((e) => {
          const src = nodeMap.get(e.source);
          const tgt = nodeMap.get(e.target);
          if (!src?.x || !tgt?.x) return null;
          const color = EDGE_COLORS[e.type] ?? "#94a3b8";
          const highlighted = isEdgeHighlighted(e);
          return (
            <line
              key={e.id}
              x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y}
              stroke={color}
              strokeWidth={highlighted ? 2 : 1}
              strokeOpacity={selected && !highlighted ? 0.15 : 0.7}
              strokeDasharray={e.type === "depends_on" ? "5,3" : undefined}
            />
          );
        })}
        {/* Nodes */}
        {nodes.map((n) => {
          if (!n.x) return null;
          const colors = NODE_COLORS[n.risk] ?? NODE_COLORS.none;
          const isSelected = selected === n.id;
          const hl = isHighlighted(n.id);
          return (
            <g
              key={n.id}
              transform={`translate(${n.x},${n.y})`}
              onClick={() => setSelected(selected === n.id ? null : n.id)}
              className="cursor-pointer"
              opacity={hl ? 1 : 0.25}
            >
              {n.type === "control" || n.type === "framework" ? (
                <circle r={20} fill={colors.fill} stroke={colors.stroke} strokeWidth={isSelected ? 2.5 : 1.5} />
              ) : n.type === "vulnerability" ? (
                <polygon points="0,-21 18,16 -18,16" fill={colors.fill} stroke={colors.stroke} strokeWidth={isSelected ? 2.5 : 1.5} />
              ) : (
                <rect x={-22} y={-13} width={44} height={26} rx={3} fill={colors.fill} stroke={colors.stroke} strokeWidth={isSelected ? 2.5 : 1.5} />
              )}
              <text textAnchor="middle" dy={34} fontSize={9} fill="hsl(var(--muted-foreground))" fontFamily="Inter, sans-serif" fontWeight={isSelected ? "700" : "500"}>
                {n.label.length > 14 ? n.label.slice(0, 12) + "…" : n.label}
              </text>
              <text textAnchor="middle" dy={2} fontSize={7.5} fill={colors.text} fontFamily="Inter, sans-serif" fontWeight="700">
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
    <div data-testid="graph-page" className="flex flex-col h-[calc(100vh-7rem)] bg-card border border-border rounded-lg shadow-xs overflow-hidden">
      {/* Legend */}
      <div className="border-b border-border px-5 py-3 flex flex-wrap items-center gap-5 bg-muted/30 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Node Risk</span>
          {LEGEND_NODES.map((l) => (
            <div key={l.label} className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
              <div className="w-3 h-3 rounded-sm border" style={{ background: l.fill, borderColor: l.color }} />
              {l.label}
            </div>
          ))}
        </div>
        <div className="w-px h-4 bg-border" />
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Edge Type</span>
          {LEGEND_EDGES.map((l) => (
            <div key={l.label} className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
              <div className="w-5 h-0.5 rounded-full" style={{ background: l.color }} />
              {l.label}
            </div>
          ))}
        </div>
        <div className="ml-auto text-[10px] font-medium text-muted-foreground">Drag to pan · Scroll to zoom · Click node to highlight paths</div>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative overflow-hidden" data-testid="graph-canvas">
        {graph.isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Skeleton className="w-[80%] h-[70%] rounded-lg" />
          </div>
        ) : (
          <GraphCanvas nodes={graph.data?.nodes ?? []} edges={graph.data?.edges ?? []} />
        )}

        {/* Stats overlay */}
        <div className="absolute top-4 right-4 bg-card border border-border rounded-lg p-4 shadow-sm">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Graph Stats</div>
          <div className="space-y-1.5">
            {[
              { label: "Total Nodes", value: graph.data?.nodes.length ?? 0, color: "text-foreground" },
              { label: "Total Edges", value: graph.data?.edges.length ?? 0, color: "text-foreground" },
              { label: "Critical Nodes", value: graph.data?.nodes.filter((n) => n.risk === "critical").length ?? 0, color: "text-red-600" },
              { label: "Exploit Edges", value: graph.data?.edges.filter((e) => e.type === "exploits").length ?? 0, color: "text-red-600" },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex justify-between gap-6 text-xs">
                <span className="text-muted-foreground font-medium">{label}</span>
                <span className={cn("font-mono font-bold", color)}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
