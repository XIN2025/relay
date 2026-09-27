import Link from "next/link";

import { JournalScrubber } from "@/components/replay/journal-scrubber";
import { RunItYourself } from "@/components/run-it-yourself";
import { Timeline } from "@/components/timeline";
import { executionCounts, graph, runById, runs } from "@/lib/runs";

export default function HomePage() {
  const crashed = runById("ticket-1") ?? runs[0];
  const counts = executionCounts(crashed);
  const reran = counts.find((c) => c.starts > 1);
  const window = crashed.events.filter((e) => e.seq >= 9 && e.seq <= 13);

  return (
    <div className="mx-auto max-w-6xl px-5 sm:px-8">
      <section className="py-20 sm:py-28">
        <p className="font-mono text-sm text-muted-foreground">
          durable agent execution
        </p>
        <h1 className="text-balance mt-5 max-w-3xl text-5xl font-semibold tracking-tight sm:text-6xl">
          The step ran twice. The refund did not.
        </h1>
        <p className="text-balance mt-6 max-w-xl text-xl text-muted-foreground">
          Kill the process mid-run and the agent resumes on the right step,
          without repeating what it already did to the outside world.
        </p>
      </section>

      <section className="border-t border-border py-14">
        <dl className="grid grid-cols-2 gap-10 lg:grid-cols-4">
          <div className="space-y-1">
            <div className="tabular text-4xl font-semibold tracking-tight sm:text-5xl">
              {reran ? reran.starts : 1}
            </div>
            <div className="text-sm font-medium">
              executions of {reran?.node ?? "the step"}
            </div>
            <div className="text-sm text-muted-foreground">
              the process was killed inside it
            </div>
          </div>
          <div className="space-y-1">
            <div className="tabular text-4xl font-semibold tracking-tight text-[var(--event-effect)] sm:text-5xl">
              {reran ? reran.effects : 1}
            </div>
            <div className="text-sm font-medium">times the refund fired</div>
            <div className="text-sm text-muted-foreground">
              same receipt before and after
            </div>
          </div>
          <div className="space-y-1">
            <div className="tabular text-4xl font-semibold tracking-tight sm:text-5xl">
              0
            </div>
            <div className="text-sm font-medium">state held in memory</div>
            <div className="text-sm text-muted-foreground">
              a run is a fold over its journal
            </div>
          </div>
          <div className="space-y-1">
            <div className="tabular text-4xl font-semibold tracking-tight sm:text-5xl">
              {graph.nodes.length}
            </div>
            <div className="text-sm font-medium">nodes in the graph</div>
            <div className="text-sm text-muted-foreground">
              one of them holds for a human
            </div>
          </div>
        </dl>
      </section>

      <section className="border-t border-border py-14">
        <h2 className="text-2xl font-semibold tracking-tight">
          The five events that matter
        </h2>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Real journal rows from{" "}
          <code className="font-mono">{crashed.runId}</code>. The refund settles
          at 11. There is no <em>step finished</em> after it, because the
          process died in the gap. On resume the step runs again and the effect
          does not.
        </p>
        <div className="mt-8 max-w-3xl rounded-xl border border-border p-5">
          <Timeline events={window} />
        </div>
        <p className="mt-6 max-w-2xl text-muted-foreground">
          Effects are recorded the instant they return, keyed by node and call
          index. A re-executed step reads the recorded result instead of calling
          out again. Steps are at-least-once; effects are effectively-once.
        </p>
      </section>

      <section className="border-t border-border py-14">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h2 className="text-2xl font-semibold tracking-tight">
            Walk through a run
          </h2>
          <Link
            href="/runs"
            className="text-sm font-medium text-brand hover:underline"
          >
            All {runs.length} runs
          </Link>
        </div>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          A support agent: classify the ticket, look up the order, then refund
          or decline. Press play, or drag through the journal, and watch the
          engine rebuild the run from its events alone.
        </p>
        <div className="mt-8">
          <JournalScrubber
            graph={graph}
            runs={[crashed, ...runs.filter((r) => r !== crashed)]}
          />
        </div>
      </section>

      <section className="border-t border-border py-14">
        <h2 className="text-2xl font-semibold tracking-tight">
          Run it yourself
        </h2>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Python 3.11 or newer, standard library only. From the repository root
          with <code className="font-mono">PYTHONPATH=src</code>. The
          classifier&apos;s confidence is random on purpose, so about one ticket
          in four is declined and never reaches the gate; start another id if
          yours is.
        </p>
        <RunItYourself />
      </section>

      <section className="border-t border-border py-14">
        <h2 className="text-2xl font-semibold tracking-tight">Not claimed</h2>
        <ul className="mt-6 grid gap-x-10 gap-y-4 text-muted-foreground sm:grid-cols-3">
          <li>
            <span className="block font-medium text-foreground">
              Distributed execution
            </span>
            Single process, one SQLite journal. No leases, no workers.
          </li>
          <li>
            <span className="block font-medium text-foreground">
              A production scheduler
            </span>
            Nothing here retries on a timer or bounds a queue.
          </li>
          <li>
            <span className="block font-medium text-foreground">
              Effect atomicity
            </span>
            A crash between the call landing and its record is still a lost
            effect. Narrowing that window needs the effect itself to be
            idempotent.
          </li>
        </ul>
      </section>
    </div>
  );
}
