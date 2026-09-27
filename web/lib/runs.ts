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

export type RunStatus = "running" | "awaiting_approval" | "finished" | "failed";

/** The engine's fold of a run's journal through one event. */
export interface ReplayFrame {
  seq: number;
  status: RunStatus;
  nextNode: string;
  completed: string[];
  state: Record<string, unknown>;
}

export interface Run {
  runId: string;
  status: RunStatus;
  completed: string[];
  nextNode: string;
  state: Record<string, unknown>;
  events: RunEvent[];
  replay: ReplayFrame[];
}

export interface GraphNode {
  name: string;
  description: string;
  requiresApproval: boolean;
}

export interface GraphEdge {
  from: string;
  to: string;
  /** The branch condition; empty for an unconditional edge. */
  when: string;
}

export interface Graph {
  start: string;
  end: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export const data = raw as { graph: Graph; runs: Run[] };
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
