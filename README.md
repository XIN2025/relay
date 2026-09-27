# relay — a durable agent execution engine

An agent graph whose runs survive process death, hold for human approval, and
replay deterministically from any point.

```bash
PYTHONPATH=src python -m relay start ticket-1      # runs, then holds at the gate
RELAY_CRASH_AT=issue_refund PYTHONPATH=src python -m relay approve ticket-1
PYTHONPATH=src python -m relay start ticket-1      # resumes
PYTHONPATH=src python -m relay show ticket-1
PYTHONPATH=src python -m relay replay ticket-1 --at 7

cd web && pnpm install && pnpm dev                 # the run inspector
```

Python 3.11+, standard library only. The classifier's confidence is random on
purpose, so about one ticket in four is declined and never reaches the gate;
`approve` then says so, and another run id will hold.

## The claim, and the proof

Kill the process **inside** the step that issues a refund, after the money has
moved. On resume:

```
 10  step_started    issue_refund
 11  effect          issue_refund   payments:refund -> {"receipt": "rf_1722770", ...}
       <- process killed here, exit 9, no unwinding
 12  step_started    issue_refund   <- the step runs again
 13  step_finished   issue_refund   {"refund": {"receipt": "rf_1722770", ...}}
```

**The step executed twice. `payments:refund` executed once.** Same receipt before
and after the crash. That gap between 11 and 13 is where a naive engine refunds
a customer twice.

- Steps are **at-least-once**. A crash before `step_finished` means the node runs
  again.
- Effects are **effectively-once**. Every call through `ctx.call` is recorded the
  instant it returns, keyed by `(node, call_index)`. A re-executed step reads the
  record instead of calling out.

## Why it works

**The engine holds no state between steps.** Before each node, state is
recomputed by folding the journal from the beginning. That is slower than a
variable, and it is why `start`, `resume` and `replay` are one code path rather
than three that drift apart:

| Operation | What it is |
|---|---|
| resume | fold every event, continue |
| replay | fold events up to `seq`, do not continue |
| approve | append an event, then resume |

A human-in-the-loop gate is the same idea. `requires_approval` halts the run and
**the process exits**; the pause lives in the journal, not in a stack frame. A
pause that only survives while the process lives is a blocking prompt, not a
checkpoint.

`synchronous=FULL` on SQLite is deliberate and costs a few ms per step. Under the
default, a hard kill can lose the last commits, which is precisely the case this
engine exists to survive.

## Layout

```
src/relay/
  journal.py    append-only event log; the only durable thing
  graph.py      nodes, routing, approval gates
  engine.py     fold + resume + replay + effect recording
  example.py    the refund agent used throughout
  cli.py        start / approve / deny / show / replay / export
web/            run inspector: the graph, a step-through of every run's journal
```

## What this is not

- **Not distributed.** Single process, one SQLite journal. No leases, no workers,
  no fencing tokens. Multi-process would need all three.
- **Not a scheduler.** Nothing retries on a timer or bounds a queue.
- **Not atomic at the effect boundary.** A crash between the call landing and its
  record being written still loses the effect. Closing that needs the effect to
  carry its own idempotency key, which is a property of the API being called and
  not something an engine can add from outside.
- **The model call is a stand-in.** `ctx.call` is where a hosted provider goes;
  the example returns a random payload so a run is reproducible offline. The
  durability machinery is unaffected either way, because recording is what makes
  replay work regardless of what is on the other end.

## Portability

Only `example.py` knows about refunds. The engine is domain-free, so the same
demo retargets to any agent workflow with an irreversible step by rewriting that
one file.
