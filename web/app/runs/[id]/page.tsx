import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FlowDiagram } from "@/components/flow/flow-diagram";
import { Timeline } from "@/components/timeline";
import { effectsOf, executionCounts, graph, runById, runs } from "@/lib/runs";

export function generateStaticParams() {
  return runs.map((r) => ({ id: r.runId }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  return { title: (await params).id };
}

export default async function RunPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const run = runById((await params).id);
  if (!run) notFound();

  const counts = executionCounts(run);
  const effects = effectsOf(run);

  return (
    <div className="mx-auto max-w-6xl px-5 sm:px-8">
      <header className="py-16">
        <code className="font-mono text-sm text-muted-foreground">
          {run.runId}
        </code>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight">
          {run.status.replace("_", " ")}
        </h1>
        <p className="mt-4 font-mono text-sm break-all text-muted-foreground">
          {run.completed.join(" -> ") || "no steps completed"}
        </p>
      </header>

      <section className="border-t border-border py-12">
        <h2 className="text-2xl font-semibold tracking-tight">
          The route it took
        </h2>
        <div className="mt-6 rounded-xl border border-border p-3 sm:p-6">
          <FlowDiagram
            graph={graph}
            progress={{
              completed: run.completed,
              nextNode: run.nextNode,
              status: run.status,
            }}
          />
        </div>
      </section>

      <section className="border-t border-border py-12">
        <h2 className="text-2xl font-semibold tracking-tight">
          Executions against effects
        </h2>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          A step entered more than once with its effect count still at one is a
          step that re-ran without repeating itself.
        </p>
        <div className="mt-6 overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[32rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary text-left">
                <th className="px-4 py-2.5 font-medium">Node</th>
                <th className="px-4 py-2.5 font-medium">Times entered</th>
                <th className="px-4 py-2.5 font-medium">Effects fired</th>
              </tr>
            </thead>
            <tbody>
              {counts.map((c) => (
                <tr
                  key={c.node}
                  className="border-b border-border last:border-0"
                >
                  <td className="px-4 py-2.5 font-mono text-xs">{c.node}</td>
                  <td className="tabular px-4 py-2.5">
                    <span className={c.starts > 1 ? "font-semibold" : ""}>
                      {c.starts}
                    </span>
                    {c.starts > 1 && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        crashed and resumed
                      </span>
                    )}
                  </td>
                  <td className="tabular px-4 py-2.5">{c.effects}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {effects.length > 0 && (
        <section className="border-t border-border py-12">
          <h2 className="text-2xl font-semibold tracking-tight">
            What actually left the process
          </h2>
          <ul className="mt-6 space-y-3">
            {effects.map((e) => (
              <li
                key={e.seq}
                className="flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-lg border border-border px-4 py-3"
              >
                <code className="font-mono text-sm font-medium text-[var(--event-effect)]">
                  {String((e.payload as { label?: string }).label)}
                </code>
                <code className="font-mono text-xs break-all text-muted-foreground">
                  {JSON.stringify((e.payload as { result?: unknown }).result)}
                </code>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="border-t border-border py-12">
        <h2 className="text-2xl font-semibold tracking-tight">The journal</h2>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Current state is a fold over these rows. Folding a prefix of them is a
          replay, which is why resuming and replaying are the same code.
        </p>
        <div className="mt-8 rounded-xl border border-border p-5">
          <Timeline events={run.events} />
        </div>
      </section>

      <section className="border-t border-border py-12">
        <h2 className="text-2xl font-semibold tracking-tight">Final state</h2>
        <pre className="mt-6 overflow-x-auto rounded-xl border border-border p-5 font-mono text-sm leading-7">
          {JSON.stringify(run.state, null, 2)}
        </pre>
      </section>
    </div>
  );
}
