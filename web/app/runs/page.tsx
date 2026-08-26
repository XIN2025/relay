import type { Metadata } from "next";
import Link from "next/link";

import { executionCounts, runs } from "@/lib/runs";

export const metadata: Metadata = { title: "Runs" };

const STATUS_TONE: Record<string, string> = {
  finished: "event-done",
  failed: "event-effect",
  awaiting_approval: "event-approval",
  running: "event-step",
};

export default function RunsPage() {
  return (
    <div className="mx-auto max-w-6xl px-5 sm:px-8">
      <header className="py-20">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Runs
        </h1>
        <p className="text-balance mt-5 max-w-xl text-xl text-muted-foreground">
          Every one is a real journal, exported from the engine.
        </p>
      </header>

      <div className="divide-y divide-border border-t border-border">
        {runs.map((run) => {
          const reran = executionCounts(run).filter((c) => c.starts > 1);
          return (
            <Link
              key={run.runId}
              href={`/runs/${run.runId}`}
              className="group grid gap-3 py-6 sm:grid-cols-[10rem_minmax(0,1fr)_auto] sm:gap-8"
            >
              <div>
                <code className="font-mono font-medium group-hover:underline">
                  {run.runId}
                </code>
                <div
                  className="mt-1 text-sm font-medium"
                  style={{ color: `var(--${STATUS_TONE[run.status]})` }}
                >
                  {run.status.replace("_", " ")}
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                <div className="font-mono break-all">
                  {run.completed.join(" -> ") || "no steps completed"}
                </div>
                {reran.length > 0 && (
                  <div className="mt-1">
                    re-executed after a crash:{" "}
                    <span className="text-foreground">
                      {reran.map((r) => r.node).join(", ")}
                    </span>
                  </div>
                )}
              </div>
              <div className="tabular text-sm text-muted-foreground sm:text-right">
                {run.events.length} events
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
