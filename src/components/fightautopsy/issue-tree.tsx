"use client";

// IssueTree — React Flow rendering of an Analysis.
//
// Spec §4.6:
//   - root node = fight topic
//   - six layer clusters color-coded (FACT gray, CAUSALITY slate, VALUE amber,
//     DEFINITION violet, INTERPRETATION rose, REQUEST green)
//   - claim nodes show person badge + quote snippet + ⚠️ absolute badge
//   - alignment edges: green AGREE, red CONTRADICT, dashed gray DISCONNECT
//
// React Flow must be a client component. Its CSS is imported here, not in the
// server layout, to avoid Next 16 RSC issues.

import "@xyflow/react/dist/style.css";
import { useCallback, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  type NodeProps,
  Handle,
  Position,
  BackgroundVariant,
} from "@xyflow/react";
import type { Analysis, Layer, Person } from "@/lib/fightautopsy/types";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

// Layer colors. Tailwind classes are applied via the className prop on the
// custom node component. Kept in one place so the legend and the nodes share.
export const LAYER_STYLES: Record<
  Layer,
  { bg: string; border: string; text: string; label: string; dot: string }
> = {
  FACT: {
    bg: "bg-slate-50",
    border: "border-slate-300",
    text: "text-slate-700",
    label: "Fact",
    dot: "bg-slate-400",
  },
  CAUSALITY: {
    bg: "bg-stone-50",
    border: "border-stone-300",
    text: "text-stone-700",
    label: "Causality",
    dot: "bg-stone-400",
  },
  VALUE: {
    bg: "bg-amber-50",
    border: "border-amber-300",
    text: "text-amber-800",
    label: "Value",
    dot: "bg-amber-400",
  },
  DEFINITION: {
    bg: "bg-violet-50",
    border: "border-violet-300",
    text: "text-violet-800",
    label: "Definition",
    dot: "bg-violet-400",
  },
  INTERPRETATION: {
    bg: "bg-rose-50",
    border: "border-rose-300",
    text: "text-rose-800",
    label: "Interpretation",
    dot: "bg-rose-400",
  },
  REQUEST: {
    bg: "bg-emerald-50",
    border: "border-emerald-300",
    text: "text-emerald-800",
    label: "Request",
    dot: "bg-emerald-400",
  },
};

const PERSON_BADGE: Record<Person, string> = {
  // Warm-on-warm pairing. A = warm orange (distinct from VALUE's amber — more
  // saturated, more red). B = teal (kept; teal is between blue and green and
  // not "blue" in the indigo/SaaS sense). No sky/indigo.
  A: "bg-orange-100 text-orange-800",
  B: "bg-teal-100 text-teal-800",
};

export { PERSON_BADGE };

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "…";
}

// Custom claim node.
type ClaimNodeData = {
  layer: Layer;
  person: Person;
  quote: string;
  hasAbsolutes: boolean;
  selected?: boolean;
  [key: string]: unknown;
};

function ClaimNode({ data, selected }: NodeProps) {
  const d = data as ClaimNodeData;
  const style = LAYER_STYLES[d.layer];
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2 sm:px-3.5 sm:py-2.5 max-w-[150px] sm:max-w-[260px] shadow-sm transition-shadow",
        style.bg,
        style.border,
        selected ? "ring-2 ring-foreground/40 shadow-md" : "hover:shadow-md",
      )}
    >
      <Handle type="target" position={Position.Top} className="!bg-muted-foreground/40 !w-1.5 !h-1.5 !border-0" />
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded", PERSON_BADGE[d.person])}>
          {d.person}
        </span>
        <span className={cn("text-[10px] font-medium uppercase tracking-[0.1em]", style.text)}>
          {style.label}
        </span>
        {d.hasAbsolutes && (
          <span
            className="text-[10px] font-semibold px-1 py-0.5 rounded bg-amber-200 text-amber-900"
            title="Contains an absolute (always/never) — see panel for a rewrite"
          >
            ⚠ absolute
          </span>
        )}
      </div>
      <p className={cn("text-xs leading-snug", style.text)}>
        &ldquo;{truncate(d.quote, 90)}&rdquo;
      </p>
      <Handle type="source" position={Position.Bottom} className="!bg-muted-foreground/40 !w-1.5 !h-1.5 !border-0" />
    </div>
  );
}

// Custom root node — the anchor of the tree. Visually heavier than the leaf
// claims: inverted (dark warm stone bg, light text), serif topic, slightly
// larger min-width, and a single terracotta dot as a warm mark.
type RootNodeData = { topic: string; [key: string]: unknown };
function RootNode({ data }: NodeProps) {
  const d = data as RootNodeData;
  return (
    <div className="rounded-xl border border-foreground/30 bg-foreground text-background px-5 py-4 shadow-md max-w-[340px] min-w-[200px]">
      <Handle type="source" position={Position.Bottom} className="!bg-background !w-2 !h-2 !border-2 !border-foreground" />
      <div className="flex items-center gap-1.5 mb-1.5">
        <span
          className="w-1.5 h-1.5 rounded-full bg-primary"
          aria-hidden
        />
        <p className="text-[10px] uppercase tracking-[0.18em] text-background/60 font-medium">
          The fight
        </p>
      </div>
      <p className="font-serif text-base leading-snug">{d.topic}</p>
    </div>
  );
}

// Custom layer-cluster node (a header for each layer group).
type LayerHeaderData = { layer: Layer; count: number; [key: string]: unknown };
function LayerHeaderNode({ data }: NodeProps) {
  const d = data as LayerHeaderData;
  const style = LAYER_STYLES[d.layer];
  return (
    <div
      className={cn(
        "rounded-md border border-dashed px-3 py-1.5 bg-background/85 shadow-sm",
        style.border,
      )}
    >
      <div className="flex items-center gap-2">
        <span className={cn("w-2 h-2 rounded-full", style.dot)} />
        <span className={cn("text-xs font-semibold uppercase tracking-[0.1em]", style.text)}>
          {style.label}
        </span>
        <span className="text-[10px] text-muted-foreground tabular-nums">{d.count}</span>
      </div>
    </div>
  );
}

const nodeTypes = {
  claim: ClaimNode,
  root: RootNode,
  layerHeader: LayerHeaderNode,
};

// Edge styles — stronger stroke widths and clearer colors so the alignment
// edges actually read as connective tissue (the VLM flagged them as nearly
// invisible). Warmer DISCONNECT (stone-500, not slate-400) — slate is the
// FACT layer color, so a warm stone tone keeps edges and layer backgrounds
// visually distinct.
const EDGE_STYLES: Record<string, { className: string; stroke: string; animated?: boolean }> = {
  AGREE: { className: "text-emerald-500", stroke: "#059669" },
  CONTRADICT: { className: "text-rose-500", stroke: "#e11d48", animated: true },
  DISCONNECT: { className: "text-muted-foreground", stroke: "#78716c" },
};

interface Props {
  analysis: Analysis;
  topic: string;
  selectedClaimId?: string;
  onSelectClaim?: (id: string) => void;
}

export function IssueTree({ analysis, topic, selectedClaimId, onSelectClaim }: Props) {
  const isMobile = useIsMobile();

  const { nodes, edges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    // Root
    nodes.push({
      id: "root",
      type: "root",
      position: isMobile ? { x: 50, y: 0 } : { x: 600, y: 0 },
      data: { topic },
      draggable: false,
    });

    // Group claims by layer
    const byLayer: Record<Layer, typeof analysis.claims> = {
      FACT: [],
      CAUSALITY: [],
      VALUE: [],
      DEFINITION: [],
      INTERPRETATION: [],
      REQUEST: [],
    };
    for (const c of analysis.claims) {
      byLayer[c.layer].push(c);
    }

    const layers: Layer[] = ["FACT", "CAUSALITY", "VALUE", "DEFINITION", "INTERPRETATION", "REQUEST"];

    if (isMobile) {
      // MOBILE LAYOUT: layers stacked vertically. Each layer is a row with
      // claims side by side (A left, B right). This gives readable node sizes
      // on a 375px screen instead of zooming out to fit 6 columns.
      const layerHeight = 80; // header + spacing per layer
      const claimWidth = 155; // two claims side by side in 375px
      const claimHeight = 100;
      const claimGap = 8;
      let y = 100; // start below root

      layers.forEach((layer) => {
        const claims = byLayer[layer];
        if (claims.length === 0) return;

        // Layer header
        nodes.push({
          id: `layer-${layer}`,
          type: "layerHeader",
          position: { x: 16, y },
          data: { layer, count: claims.length },
          draggable: false,
        });
        y += 44; // header height + gap

        // Claims in this layer — arranged in a row, wrapping if >2
        claims.forEach((c, i) => {
          const col = i % 2;
          const row = Math.floor(i / 2);
          const x = 16 + col * (claimWidth + claimGap);
          const claimY = y + row * (claimHeight + claimGap);
          nodes.push({
            id: `claim-${c.id}`,
            type: "claim",
            position: { x, y: claimY },
            data: {
              layer: c.layer,
              person: c.person,
              quote: c.quote,
              hasAbsolutes: !!c.absolutes && c.absolutes.length > 0,
            } as ClaimNodeData,
            selected: selectedClaimId === c.id,
            draggable: true,
          });
        });

        // Advance y past this layer's claims
        const rows = Math.ceil(claims.length / 2);
        y += rows * (claimHeight + claimGap) + 24; // gap before next layer
      });
    } else {
      // DESKTOP LAYOUT: six layer columns side by side. Root at top center.
      const colWidth = 280;
      const startX = 60;
      const headerY = 120;
      const claimStartY = 180;
      const claimSpacing = 110;

      layers.forEach((layer, colIdx) => {
        const claims = byLayer[layer];
        if (claims.length === 0) return;
        const x = startX + colIdx * colWidth;

        // Layer header
        nodes.push({
          id: `layer-${layer}`,
          type: "layerHeader",
          position: { x, y: headerY },
          data: { layer, count: claims.length },
          draggable: false,
        });

        // Claims in this layer
        claims.forEach((c, i) => {
          const id = `claim-${c.id}`;
          nodes.push({
            id,
            type: "claim",
            position: { x, y: claimStartY + i * claimSpacing },
            data: {
              layer: c.layer,
              person: c.person,
              quote: c.quote,
              hasAbsolutes: !!c.absolutes && c.absolutes.length > 0,
            } as ClaimNodeData,
            selected: selectedClaimId === c.id,
            draggable: true,
          });
        });
      });
    }

    // Alignment edges — between claim nodes. Stronger stroke width (2.5 vs
    // the previous 1.5) and a warm cream label background so labels read on
    // the warm paper base.
    for (const a of analysis.alignments) {
      const [id1, id2] = a.claims;
      const s = EDGE_STYLES[a.type];
      edges.push({
        id: `align-${id1}-${id2}-${a.type}`,
        source: `claim-${id1}`,
        target: `claim-${id2}`,
        label: a.type,
        labelStyle: { fontSize: 10, fontWeight: 600, fill: s.stroke },
        labelBgStyle: { fill: "#fbf8f3" },
        labelBgPadding: [4, 2],
        style: { stroke: s.stroke, strokeWidth: 2.5, strokeDasharray: a.type === "DISCONNECT" ? "6 4" : undefined },
        animated: s.animated,
        type: "smoothstep",
      });
    }

    return { nodes, edges };
  }, [analysis, topic, selectedClaimId, isMobile]);

  const onNodeClick = useCallback(
    (_: unknown, node: Node) => {
      if (node.id.startsWith("claim-") && onSelectClaim) {
        onSelectClaim(node.id.replace("claim-", ""));
      }
    },
    [onSelectClaim],
  );

  return (
    <div className="w-full h-[700px] sm:h-[500px] md:h-[640px] border border-border/70 rounded-xl bg-background/50 overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        fitView
        fitViewOptions={{ padding: isMobile ? 0.05 : 0.15, includeHiddenNodes: false }}
        minZoom={isMobile ? 0.4 : 0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={18} size={1.2} className="opacity-50" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}

export function LayerLegend() {
  const layers: Layer[] = ["FACT", "CAUSALITY", "VALUE", "DEFINITION", "INTERPRETATION", "REQUEST"];
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
      {layers.map((l) => {
        const s = LAYER_STYLES[l];
        return (
          <span key={l} className="inline-flex items-center gap-1.5">
            <span className={cn("w-2 h-2 rounded-full", s.dot)} />
            <span className="text-muted-foreground">{s.label}</span>
          </span>
        );
      })}
    </div>
  );
}
