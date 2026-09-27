import type { Graph, RunStatus } from "@/lib/runs";

/** Where a run stands, as the engine's fold reports it. */
export interface FlowProgress {
  completed: string[];
  nextNode: string;
  status: RunStatus;
}

export type NodeTone =
  "idle" | "done" | "current" | "held" | "failed" | "skipped";

export function toneOf(id: string, graph: Graph, p?: FlowProgress): NodeTone {
  if (!p) return "idle";
  if (id === graph.end) return p.status === "finished" ? "done" : "idle";
  if (p.completed.includes(id)) return "done";
  if (id === p.nextNode) {
    if (p.status === "awaiting_approval") return "held";
    if (p.status === "failed") return "failed";
    return "current";
  }
  return p.status === "finished" ? "skipped" : "idle";
}

/** An edge is taken once its source finished and the run moved to its target. */
export function edgeTaken(
  from: string,
  to: string,
  graph: Graph,
  p?: FlowProgress,
): boolean {
  if (!p || !p.completed.includes(from)) return false;
  return (
    p.completed.includes(to) ||
    to === p.nextNode ||
    (to === graph.end && p.status === "finished")
  );
}
