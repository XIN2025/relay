import raw from "@/data/runs.json";

export type EventType =
  | "run_started"
  | "step_started"
  | "step_finished"
  | "step_failed"
  | "effect"
  | "awaiting_approval"
  | "approval_granted"
  | "approval_denied"
  | "run_finished"
  | "run_failed";

export interface RunEvent {
  seq: number;
  type: EventType;
  node: string | null;
  payload: Record<string, unknown>;
  at: number;
}

export interface Run {
  runId: string;
  status: "running" | "awaiting_approval" | "finished" | "failed";
  completed: string[];
  nextNode: string;
  state: Record<string, unknown>;
  events: RunEvent[];
}

export interface GraphNode {
  name: string;
  description: string;
  requiresApproval: boolean;
}

export const data = raw as {
  graph: { start: string; nodes: GraphNode[] };
  runs: Run[];
};
export const runs = data.runs;
export const graph = data.graph;

export function runById(id: string): Run | undefined {
  return runs.find((r) => r.runId === id);
}

export const EVENT_META: Record<
  EventType,
  { label: string; tone: string; loud: boolean }
> = {
  run_started: { label: "run started", tone: "event-muted", loud: false },
  step_started: { label: "step started", tone: "event-muted", loud: false },
  step_finished: { label: "step finished", tone: "event-step", loud: false },
  step_failed: { label: "step failed", tone: "event-effect", loud: true },
  effect: { label: "effect", tone: "event-effect", loud: true },
  awaiting_approval: {
    label: "held for approval",
    tone: "event-approval",
    loud: true,
  },
  approval_granted: { label: "approved", tone: "event-approval", loud: false },
  approval_denied: { label: "denied", tone: "event-approval", loud: true },
  run_finished: { label: "run finished", tone: "event-done", loud: false },
  run_failed: { label: "run failed", tone: "event-effect", loud: true },
};

export function effectsOf(run: Run): RunEvent[] {
  return run.events.filter((e) => e.type === "effect");
}

/** Compare step starts with effects to expose safe re-execution. */
export function executionCounts(
  run: Run,
): { node: string; starts: number; effects: number }[] {
  const nodes = [
    ...new Set(run.events.map((e) => e.node).filter(Boolean)),
  ] as string[];
  return nodes.map((node) => ({
    node,
    starts: run.events.filter(
      (e) => e.node === node && e.type === "step_started",
    ).length,
    effects: run.events.filter((e) => e.node === node && e.type === "effect")
      .length,
  }));
}
