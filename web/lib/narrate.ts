import type { Run, RunEvent } from "@/lib/runs";

export interface Beat {
  /** Which OS process wrote this event, counting from 1. */
  process: number;
  /** True for a step entered again after its process died inside it. */
  reentry: boolean;
  text: string;
}

export interface Moment {
  label: string;
  index: number;
}

function payload(e: RunEvent) {
  return e.payload as Record<string, unknown>;
}

/**
 * Explain each journal event in plain words. A new process begins at the
 * first event, at every approval decision (the `approve` command appends it
 * and resumes), and wherever a step is entered again without having finished,
 * which is only possible if the previous process died inside it.
 */
export function narrate(run: Run): Beat[] {
  const open = new Set<string>();
  const reentered = new Set<string>();
  let process = 0;

  return run.events.map((e) => {
    const node = e.node ?? "";
    const p = payload(e);
    let reentry = false;
    if (
      e.type === "run_started" ||
      e.type === "approval_granted" ||
      e.type === "approval_denied"
    ) {
      process += 1;
    }
    if (e.type === "step_started") {
      if (open.has(node)) {
        reentry = true;
        reentered.add(node);
        process += 1;
      }
      open.add(node);
    }
    if (e.type === "step_finished") open.delete(node);

    const text = ((): string => {
      switch (e.type) {
        case "run_started":
          return "A new run is journaled with the ticket as its input.";
        case "step_started":
          return reentry
            ? `The last process was killed inside ${node} before it could finish. A fresh process folded the journal and entered ${node} again.`
            : `The engine enters ${node}.`;
        case "effect":
          return `${String(p.label)} returned. The result is journaled the instant it lands, before the step goes on.`;
        case "step_finished":
          return reentered.has(node)
            ? `${node} finished on its second attempt. Its call was answered from the journal, so nothing left the process twice.`
            : `${node} finished. Its output is folded into the run's state.`;
        case "awaiting_approval":
          return `${node} is irreversible, so the run halts for a human and the process exits. The pause lives in the journal.`;
        case "approval_granted":
          return `A human approved ${node}. The approve command appends this event and resumes the run in a new process.`;
        case "approval_denied":
          return `A human denied ${node}. The run fails closed without touching the outside world.`;
        case "step_failed":
          return `${node} raised an error.`;
        case "run_finished":
          return "Every node on the route has finished. The run is done.";
        case "run_failed":
          return "The run ended in failure.";
      }
    })();

    return { process, reentry, text };
  });
}

/** Jump points worth landing on directly. */
export function momentsOf(run: Run, gate: string | undefined): Moment[] {
  const beats = narrate(run);
  const find = (pred: (e: RunEvent, i: number) => boolean) =>
    run.events.findIndex(pred);
  const candidates: [string, number][] = [
    ["held for a human", find((e) => e.type === "awaiting_approval")],
    ["approved", find((e) => e.type === "approval_granted")],
    ["denied", find((e) => e.type === "approval_denied")],
    [`${gate} fires`, find((e) => e.type === "effect" && e.node === gate)],
    ["killed, re-entered", find((_, i) => beats[i].reentry)],
    ["finished", find((e) => e.type === "run_finished")],
  ];
  return candidates
    .filter(([, index]) => index >= 0)
    .map(([label, index]) => ({ label, index }))
    .sort((a, b) => a.index - b.index);
}

/** A short name for what happened in a run. */
export function storyOf(run: Run): string {
  const reentry = narrate(run).findIndex((b) => b.reentry);
  if (reentry >= 0) return `killed inside ${run.events[reentry].node}`;
  if (run.events.some((e) => e.type === "approval_denied")) return "denied";
  if (run.status === "finished") return "approved";
  return run.status.replace("_", " ");
}
