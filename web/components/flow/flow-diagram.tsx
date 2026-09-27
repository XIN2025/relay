"use client";

import "@xyflow/react/dist/base.css";

import {
  MarkerType,
  ReactFlow,
  type Edge,
  type ReactFlowInstance,
} from "@xyflow/react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";

import { EndNode } from "@/components/flow/end-node";
import { StepNode } from "@/components/flow/step-node";
import { useMediaQuery } from "@/hooks/use-media-query";
import { layoutGraph, type Direction, type FlowNode } from "@/lib/layout";
import { edgeTaken, toneOf, type FlowProgress } from "@/lib/progress";
import type { Graph } from "@/lib/runs";

const nodeTypes = { step: StepNode, end: EndNode };
const FIT = { padding: 0.02 };

function Canvas({
  graph,
  progress,
  direction,
}: {
  graph: Graph;
  progress?: FlowProgress;
  direction: Direction;
}) {
  const layout = useMemo(
    () => layoutGraph(graph, direction),
    [graph, direction],
  );

  const nodes = useMemo(
    () =>
      layout.nodes.map((n): FlowNode => {
        const tone = toneOf(n.id, graph, progress);
        return n.type === "step"
          ? { ...n, data: { ...n.data, tone } }
          : { ...n, data: { tone } };
      }),
    [layout, graph, progress],
  );

  const edges = useMemo(
    () =>
      layout.edges.map((e): Edge => {
        const taken = edgeTaken(e.source, e.target, graph, progress);
        const color = taken ? "var(--foreground)" : "var(--event-muted)";
        return {
          ...e,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color,
            width: 16,
            height: 16,
          },
          style: {
            stroke: color,
            strokeOpacity: taken ? 1 : 0.45,
            strokeWidth: taken ? 1.75 : 1.25,
            strokeDasharray: progress && !taken ? "4 4" : undefined,
          },
        };
      }),
    [layout, graph, progress],
  );

  // fitView only runs on mount; refit whenever the box changes size.
  const box = useRef<HTMLDivElement>(null);
  const [flow, setFlow] = useState<ReactFlowInstance<FlowNode> | null>(null);
  useEffect(() => {
    if (!flow || !box.current) return;
    const observer = new ResizeObserver(() => flow.fitView(FIT));
    observer.observe(box.current);
    return () => observer.disconnect();
  }, [flow]);

  return (
    <div ref={box} className="size-full">
      <ReactFlow
        onInit={setFlow}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={FIT}
        nodesDraggable={false}
        nodesConnectable={false}
        nodesFocusable={false}
        edgesFocusable={false}
        elementsSelectable={false}
        panOnDrag={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        preventScrolling={false}
      />
    </div>
  );
}

/**
 * The workflow graph, laid out by dagre from the exported definition: left
 * to right on wide screens, top to bottom on phones. With `progress` it marks
 * the path a run has taken and where it stands now.
 */
export function FlowDiagram({
  graph,
  progress,
}: {
  graph: Graph;
  progress?: FlowProgress;
}) {
  const wide = useMediaQuery("(min-width: 768px)");
  // Both aspect ratios are known before hydration, so the box never jumps.
  const ratios = useMemo(() => {
    const lr = layoutGraph(graph, "LR");
    const tb = layoutGraph(graph, "TB");
    return {
      "--ratio-lr": `${lr.width} / ${lr.height}`,
      "--ratio-tb": `${tb.width} / ${tb.height}`,
    } as CSSProperties;
  }, [graph]);

  return (
    <div
      style={ratios}
      className="flow-diagram mx-auto aspect-(--ratio-tb) w-full max-w-md md:aspect-(--ratio-lr) md:max-w-none"
    >
      {wide !== null && (
        <Canvas
          key={wide ? "LR" : "TB"}
          graph={graph}
          progress={progress}
          direction={wide ? "LR" : "TB"}
        />
      )}
    </div>
  );
}
