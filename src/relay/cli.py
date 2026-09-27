"""Run, inspect, replay, and export relay workflows."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .engine import Engine, fold
from .example import graph
from .journal import EventType, Journal

DB = Path("data/relay.sqlite")

STATUS_MARK = {
    "finished": "done",
    "failed": "failed",
    "awaiting_approval": "HELD",
    "running": "running",
}


def _engine() -> Engine:
    return Engine(graph, Journal(DB))


def _print_status(engine: Engine, run_id: str) -> None:
    rs = fold(engine.graph, engine.journal.events(run_id))
    print(f"\n  run {run_id}  [{STATUS_MARK.get(rs.status, rs.status)}]")
    print(f"  completed: {' -> '.join(rs.completed) or '(none)'}")
    if rs.status == "awaiting_approval":
        node = engine.graph.nodes[rs.next_node]
        print(f"  HELD at {rs.next_node!r}: {node.description}")
        print(f"  release with:  relay approve {run_id}")
    print(f"  state: {json.dumps(rs.state, default=str)[:300]}")


def cmd_start(args: argparse.Namespace) -> int:
    engine = _engine()
    engine.start(args.run_id, {"ticket": args.ticket})
    _print_status(engine, args.run_id)
    return 0


def cmd_approve(args: argparse.Namespace) -> int:
    engine = _engine()
    engine.approve(args.run_id, granted=not args.deny)
    _print_status(engine, args.run_id)
    return 0


def cmd_show(args: argparse.Namespace) -> int:
    engine = _engine()
    events = engine.journal.events(args.run_id)
    if not events:
        print(f"no such run: {args.run_id}")
        return 1
    print(f"\n  {'seq':>4}  {'event':<20} {'node':<14} detail")
    for e in events:
        detail = ""
        if e.type is EventType.EFFECT:
            detail = f"{e.payload.get('label')} -> {json.dumps(e.payload.get('result'), default=str)}"
        elif e.type is EventType.STEP_FINISHED:
            detail = json.dumps(e.payload.get("patch", {}), default=str)
        elif e.payload:
            detail = json.dumps(e.payload, default=str)
        print(f"  {e.seq:>4}  {str(e.type):<20} {(e.node or ''):<14} {detail[:90]}")
    _print_status(engine, args.run_id)
    return 0


def cmd_replay(args: argparse.Namespace) -> int:
    engine = _engine()
    rs = engine.replay(args.run_id, upto_seq=args.at)
    print(f"\n  state of {args.run_id} as of event {args.at}  [{rs.status}]")
    print(f"  completed: {' -> '.join(rs.completed) or '(none)'}")
    print(f"  next: {rs.next_node}")
    print(f"  state: {json.dumps(rs.state, indent=2, default=str)}")
    return 0


def cmd_export(args: argparse.Namespace) -> int:
    """Export all journals for the web view."""
    engine = _engine()
    runs = []
    for run_id in engine.journal.runs():
        events = engine.journal.events(run_id)
        rs = fold(engine.graph, events)
        runs.append({
            "runId": run_id,
            "status": rs.status,
            "completed": rs.completed,
            "nextNode": rs.next_node,
            "state": rs.state,
            "events": [
                {"seq": e.seq, "type": str(e.type), "node": e.node,
                 "payload": e.payload, "at": e.at}
                for e in events
            ],
            # The engine's own fold after every event: `relay replay --at seq`.
            "replay": [
                {"seq": e.seq, "status": r.status, "nextNode": r.next_node,
                 "completed": r.completed, "state": r.state}
                for i, e in enumerate(events)
                for r in [fold(engine.graph, events[: i + 1])]
            ],
        })
    payload = {
        "graph": {
            "start": engine.graph.START,
            "nodes": [
                {"name": n.name, "description": n.description,
                 "requiresApproval": n.requires_approval}
                for n in engine.graph.nodes.values()
            ],
            "end": engine.graph.END,
            "edges": [
                {"from": frm, "to": to, "when": when}
                for frm, to, when in engine.graph.edges()
            ],
        },
        "runs": runs,
    }
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, indent=2, default=str), encoding="utf-8")
    print(f"{len(runs)} runs -> {out}")
    return 0


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="relay", description=__doc__)
    sub = p.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("start"); s.add_argument("run_id")
    s.add_argument("--ticket", default="I was charged twice, please refund")
    s.set_defaults(fn=cmd_start)

    a = sub.add_parser("approve"); a.add_argument("run_id")
    a.set_defaults(fn=cmd_approve, deny=False)

    d = sub.add_parser("deny"); d.add_argument("run_id")
    d.set_defaults(fn=cmd_approve, deny=True)

    sh = sub.add_parser("show"); sh.add_argument("run_id"); sh.set_defaults(fn=cmd_show)

    r = sub.add_parser("replay"); r.add_argument("run_id")
    r.add_argument("--at", type=int, required=True); r.set_defaults(fn=cmd_replay)

    e = sub.add_parser("export")
    e.add_argument("--out", default="web/data/runs.json"); e.set_defaults(fn=cmd_export)

    args = p.parse_args(argv)
    try:
        return int(args.fn(args))
    except ValueError as err:
        # Engine refusals (e.g. approving a run that never reached the gate)
        # are user errors, not crashes.
        print(f"  relay: {err}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
