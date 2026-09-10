"use client";

// IssueTree — React Flow rendering of an Analysis.
//
// Refactored per Narrative Design Brief:
//   - Uniform warm paper claim nodes (layer cluster colors deleted entirely)
//   - Plain English layer labels ("What happened", "Why it happened", etc.)
//   - Real partner names ("Alex", "Jordan") instead of "A" / "B"
//   - 3 Edge meanings: Sage Green (AGREE), Muted Rose (CONTRADICT), Soft Gray (DISCONNECT)

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
import { PLAIN_ENGLISH_LAYERS, getPersonName } from "@/lib/fightautopsy/types";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export const LAYER_STYLES: Record<
  Layer,
  { bg: string; border: string; text: string; label: string; dot: string }
> = {
  FACT: {
    bg: "bg-card",
    border: "border-border/80",
    text: "text-foreground/90",
    label: PLAIN_ENGLISH_LAYERS.FACT,
    dot: "bg-muted-foreground/60",
  },
  CAUSALITY: {
    bg: "bg-card",
    border: "border-border/80",
    text: "text-foreground/90",
    label: PLAIN_ENGLISH_LAYERS.CAUSALITY,
    dot: "bg-muted-foreground/60",
  },
  VALUE: {
    bg: "bg-card",
    border: "border-border/80",
    text: "text-foreground/90",
    label: PLAIN_ENGLISH_LAYERS.VALUE,
    dot: "bg-muted-foreground/60",
  },
  DEFINITION: {
    bg: "bg-card",
    border: "border-border/80",
    text: "text-foreground/90",
    label: PLAIN_ENGLISH_LAYERS.DEFINITION,
    dot: "bg-muted-foreground/60",
  },
  INTERPRETATION: {
    bg: "bg-card",
    border: "border-border/80",
    text: "text-foreground/90",
    label: PLAIN_ENGLISH_LAYERS.INTERPRETATION,
    dot: "bg-muted-foreground/60",
  },
  REQUEST: {
    bg: "bg-card",
    border: "border-border/80",
    text: "text-foreground/90",
    label: PLAIN_ENGLISH_LAYERS.REQUEST,
    dot: "bg-muted-foreground/60",
  },
};

const PERSON_BADGE: Record<Person, string> = {
  A: "bg-primary/15 text-primary border border-primary/20",
  B: "bg-muted text-muted-foreground border border-border",
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
  personName: string;
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
        "rounded-xl border px-3.5 py-3 max-w-[160px] sm:max-w-[260px] shadow-sm transition-all bg-card border-border/80 text-foreground",
        selected ? "ring-2 ring-primary shadow-md" : "hover:border-border hover:shadow-md",
      )}
    >
      <Handle type="target" position={Position.Top} className="!bg-muted-foreground/40 !w-1.5 !h-1.5 !border-0" />
      <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
        <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded", PERSON_BADGE[d.person])}>
          {d.personName}
        </span>
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-[0.08em]">
          {style.label}
        </span>
        {d.hasAbsolutes && (
          <span
            className="text-[10px] font-semibold px-1 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300"
            title="Contains absolute words (always/never)"
          >
            ⚠ absolute
          </span>
        )}
      </div>
      <p className="text-xs leading-snug font-serif italic text-foreground/90">
        &ldquo;{truncate(d.quote, 90)}&rdquo;
      </p>
      <Handle type="source" position={Position.Bottom} className="!bg-muted-foreground/40 !w-1.5 !h-1.5 !border-0" />
    </div>
  );
}

// Custom root node — anchor of the tree.
type RootNodeData = { topic: string; [key: string]: unknown };
function RootNode({ data }: NodeProps) {
  const d = data as RootNodeData;
  return (
    <div className="rounded-xl border border-primary/30 bg-card text-foreground px-5 py-4 shadow-sm max-w-[340px] min-w-[200px]">
      <Handle type="source" position={Position.Bottom} className="!bg-primary !w-2 !h-2 !border-2 !border-background" />
      <div className="flex items-center gap-1.5 mb-1.5">
        <span
          className="w-2 h-2 rounded-full bg-primary"
          aria-hidden
        />
        <p className="text-[10px] uppercase tracking-[0.18em] text-primary font-semibold">
          Surface Fight Topic
        </p>
      </div>
      <p className="font-serif text-base leading-snug">{d.topic}</p>
    </div>
  );
}

// Custom layer-cluster node header.
type LayerHeaderData = { layer: Layer; count: number; [key: string]: unknown };
function LayerHeaderNode({ data }: NodeProps) {
  const d = data as LayerHeaderData;
  const style = LAYER_STYLES[d.layer];
  return (
    <div className="rounded-lg border border-border/60 px-3 py-1.5 bg-muted/40 shadow-none">
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60" />
        <span className="text-xs font-medium text-foreground uppercase tracking-[0.08em]">
          {style.label}
        </span>
        <span className="text-[10px] text-muted-foreground tabular-nums">({d.count})</span>
      </div>
    </div>
  );
}

const nodeTypes = {
  claim: ClaimNode,
  root: RootNode,
  layerHeader: LayerHeaderNode,
};

// Edge styles — 3 clear meanings:
// Sage Green (#52795a) for AGREE
// Muted Rose (#b56c67) for CONTRADICT
// Soft Warm Gray (#78716c) for DISCONNECT
const EDGE_STYLES: Record<string, { label: string; stroke: string; animated?: boolean }> = {
  AGREE: { label: "Agrees", stroke: "#52795a" },
  CONTRADICT: { label: "Differs", stroke: "#b56c67", animated: true },
  DISCONNECT: { label: "Unlinked", stroke: "#78716c" },
};

interface Props {
  analysis: Analysis;
  topic: string;
  selectedClaimId?: string;
  onSelectClaim?: (id: string) => void;
  names?: { A?: string; B?: string };
}

export function IssueTree({ analysis, topic, selectedClaimId, onSelectClaim, names }: Props) {
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
      const claimWidth = 155;
      const claimHeight = 100;
      const claimGap = 8;
      let y = 100;

      layers.forEach((layer) => {
        const claims = byLayer[layer];
        if (claims.length === 0) return;

        nodes.push({
          id: `layer-${layer}`,
          type: "layerHeader",
          position: { x: 16, y },
          data: { layer, count: claims.length },
          draggable: false,
        });
        y += 44;

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
              personName: getPersonName(c.person, names),
              quote: c.quote,
              hasAbsolutes: !!c.absolutes && c.absolutes.length > 0,
            } as ClaimNodeData,
            selected: selectedClaimId === c.id,
            draggable: true,
          });
        });

        const rows = Math.ceil(claims.length / 2);
        y += rows * (claimHeight + claimGap) + 24;
      });
    } else {
      const colWidth = 280;
      const startX = 60;
      const headerY = 120;
      const claimStartY = 180;
      const claimSpacing = 110;

      layers.forEach((layer, colIdx) => {
        const claims = byLayer[layer];
        if (claims.length === 0) return;
        const x = startX + colIdx * colWidth;

        nodes.push({
          id: `layer-${layer}`,
          type: "layerHeader",
          position: { x, y: headerY },
          data: { layer, count: claims.length },
          draggable: false,
        });

        claims.forEach((c, i) => {
          const id = `claim-${c.id}`;
          nodes.push({
            id,
            type: "claim",
            position: { x, y: claimStartY + i * claimSpacing },
            data: {
              layer: c.layer,
              person: c.person,
              personName: getPersonName(c.person, names),
              quote: c.quote,
              hasAbsolutes: !!c.absolutes && c.absolutes.length > 0,
            } as ClaimNodeData,
            selected: selectedClaimId === c.id,
            draggable: true,
          });
        });
      });
    }

    for (const a of analysis.alignments) {
      const [id1, id2] = a.claims;
      const s = EDGE_STYLES[a.type] || EDGE_STYLES.DISCONNECT;
      edges.push({
        id: `align-${id1}-${id2}-${a.type}`,
        source: `claim-${id1}`,
        target: `claim-${id2}`,
        label: s.label,
        labelStyle: { fontSize: 10, fontWeight: 600, fill: s.stroke },
        labelBgStyle: { fill: "#faf8f5" },
        labelBgPadding: [4, 2],
        style: { stroke: s.stroke, strokeWidth: 2.5, strokeDasharray: a.type === "DISCONNECT" ? "6 4" : undefined },
        animated: s.animated,
        type: "smoothstep",
      });
    }

    return { nodes, edges };
  }, [analysis, topic, selectedClaimId, isMobile, names]);

  const onNodeClick = useCallback(
    (_: unknown, node: Node) => {
      if (node.id.startsWith("claim-") && onSelectClaim) {
        onSelectClaim(node.id.replace("claim-", ""));
      }
    },
    [onSelectClaim],
  );

  return (
    <div className="w-full h-[600px] sm:h-[500px] md:h-[600px] border border-border/80 rounded-2xl bg-card overflow-hidden">
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
        <Background variant={BackgroundVariant.Dots} gap={18} size={1.2} className="opacity-40" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}

export function LayerLegend() {
  const layers: Layer[] = ["FACT", "CAUSALITY", "VALUE", "DEFINITION", "INTERPRETATION", "REQUEST"];
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
      {layers.map((l) => (
        <span key={l} className="inline-flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60" />
          <span className="text-muted-foreground font-medium">{PLAIN_ENGLISH_LAYERS[l]}</span>
        </span>
      ))}
    </div>
  );
}
