import dagre from "@dagrejs/dagre";
import { Position, type Edge, type Node } from "@xyflow/react";

import type { NodeTone } from "@/lib/progress";
import type { Graph, GraphNode } from "@/lib/runs";

export type Direction = "LR" | "TB";

export type StepNodeData = {
  node: GraphNode;
  /** Branch conditions that lead into this node, if any. */
  when: string;
  tone: NodeTone;
};
export type StepFlowNode = Node<StepNodeData, "step">;
export type EndFlowNode = Node<{ tone: NodeTone }, "end">;
export type FlowNode = StepFlowNode | EndFlowNode;

const SIZE = {
  LR: { width: 208, height: 100 },
  TB: { width: 176, height: 128 },
} as const;
const END_SIZE = 44;

/** Position the workflow graph with dagre, in React Flow's node shape. */
export function layoutGraph(graph: Graph, direction: Direction) {
  const g = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: direction,
    nodesep: direction === "LR" ? 28 : 20,
    ranksep: direction === "LR" ? 56 : 44,
  });

  const size = SIZE[direction];
  for (const n of graph.nodes) g.setNode(n.name, { ...size });
  g.setNode(graph.end, { width: END_SIZE, height: END_SIZE });
  for (const e of graph.edges) g.setEdge(e.from, e.to);
  dagre.layout(g);

  const sourcePosition = direction === "LR" ? Position.Right : Position.Bottom;
  const targetPosition = direction === "LR" ? Position.Left : Position.Top;
  // dagre anchors nodes at their center; React Flow at the top-left corner.
  const place = (id: string, width: number, height: number) => {
    const { x, y } = g.node(id);
    return { x: x - width / 2, y: y - height / 2 };
  };

  const nodes: FlowNode[] = graph.nodes.map((n) => ({
    id: n.name,
    type: "step",
    position: place(n.name, size.width, size.height),
    ...size,
    sourcePosition,
    targetPosition,
    data: {
      node: n,
      when: graph.edges
        .filter((e) => e.to === n.name && e.when)
        .map((e) => e.when)
        .join(" / "),
      tone: "idle",
    },
  }));
  nodes.push({
    id: graph.end,
    type: "end",
    position: place(graph.end, END_SIZE, END_SIZE),
    width: END_SIZE,
    height: END_SIZE,
    targetPosition,
    data: { tone: "idle" },
  });

  const edges: Edge[] = graph.edges.map((e) => ({
    id: `${e.from}->${e.to}`,
    source: e.from,
    target: e.to,
    ariaLabel: `${e.from} to ${e.to === graph.end ? "end" : e.to}${e.when ? `, if ${e.when}` : ""}`,
  }));

  const { width = 0, height = 0 } = g.graph();
  return { nodes, edges, width, height };
}
