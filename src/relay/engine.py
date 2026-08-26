from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Callable

from .graph import Graph, NodeContext, State
from .journal import Event, EventType, Journal


class Halt(Exception):
    """Stop the process mid-step during crash demonstrations."""


@dataclass
class RunState:
    state: State
    next_node: str
    status: str
    completed: list[str]


def fold(graph: Graph, events: list[Event]) -> RunState:
    """Rebuild run state entirely from journal events."""
    state: State = {}
    completed: list[str] = []
    next_node = graph.START
    status = "running"

    for ev in events:
        if ev.type is EventType.RUN_STARTED:
            state = dict(ev.payload.get("input", {}))
            next_node = graph.START
        elif ev.type is EventType.STEP_FINISHED and ev.node:
            state.update(ev.payload.get("patch", {}))
            completed.append(ev.node)
            next_node = graph.next_after(ev.node, state)
        elif ev.type is EventType.AWAITING_APPROVAL and ev.node:
            next_node, status = ev.node, "awaiting_approval"
        elif ev.type is EventType.APPROVAL_GRANTED and ev.node:
            next_node, status = ev.node, "running"
        elif ev.type is EventType.APPROVAL_DENIED and ev.node:
            status = "failed"
        elif ev.type is EventType.RUN_FINISHED:
            status, next_node = "finished", Graph.END
        elif ev.type is EventType.RUN_FAILED:
            status = "failed"

    return RunState(state=state, next_node=next_node, status=status, completed=completed)


class Engine:
    def __init__(self, graph: Graph, journal: Journal) -> None:
        problems = graph.validate()
        if problems:
            raise ValueError("invalid graph: " + "; ".join(problems))
        self.graph = graph
        self.journal = journal

    def _context(self, run_id: str, node: str, replay_upto: int | None) -> NodeContext:
        """Create a context that deduplicates effects by node and call index."""
        prior = {
            (e.node, e.payload.get("index")): e.payload.get("result")
            for e in self.journal.events(run_id, upto_seq=replay_upto)
            if e.type is EventType.EFFECT
        }
        seen = {"n": 0}

        def call(label: str, fn: Callable[[], object]) -> object:
            index = seen["n"]
            seen["n"] += 1
            key = (node, index)
            if key in prior:
                return prior[key]
            result = fn()
            self.journal.append(
                run_id, EventType.EFFECT, node,
                {"index": index, "label": label, "result": result},
            )
            return result

        return NodeContext(run_id=run_id, node=node, call=call)

    def start(self, run_id: str, payload: State) -> RunState:
        if not self.journal.events(run_id):
            self.journal.append(run_id, EventType.RUN_STARTED, None, {"input": payload})
        return self.resume(run_id)

    def resume(self, run_id: str, *, step_limit: int | None = None) -> RunState:
        """Drive the run forward until it finishes, pauses, or fails."""
        steps = 0
        while True:
            rs = fold(self.graph, self.journal.events(run_id))

            if rs.status in ("finished", "failed"):
                return rs
            if rs.next_node == Graph.END:
                self.journal.append(run_id, EventType.RUN_FINISHED, None,
                                    {"state": rs.state})
                return fold(self.graph, self.journal.events(run_id))
            if step_limit is not None and steps >= step_limit:
                return rs

            node = self.graph.nodes[rs.next_node]

            # Approval state lives in the journal, so the process can exit while waiting.
            if node.requires_approval and rs.status != "running_approved":
                already = [
                    e for e in self.journal.events(run_id)
                    if e.node == node.name
                    and e.type in (EventType.APPROVAL_GRANTED, EventType.APPROVAL_DENIED)
                ]
                if not already:
                    if rs.status != "awaiting_approval":
                        self.journal.append(run_id, EventType.AWAITING_APPROVAL,
                                            node.name, {"state": rs.state})
                    return fold(self.graph, self.journal.events(run_id))
                if already[-1].type is EventType.APPROVAL_DENIED:
                    self.journal.append(run_id, EventType.RUN_FAILED, node.name,
                                        {"reason": "approval denied"})
                    return fold(self.graph, self.journal.events(run_id))

            self.journal.append(run_id, EventType.STEP_STARTED, node.name, {})
            ctx = self._context(run_id, node.name, replay_upto=None)
            try:
                patch = node.fn(rs.state, ctx) or {}
            except Halt:
                raise
            except Exception as exc:
                self.journal.append(run_id, EventType.STEP_FAILED, node.name,
                                    {"error": f"{type(exc).__name__}: {exc}"})
                self.journal.append(run_id, EventType.RUN_FAILED, node.name,
                                    {"reason": str(exc)})
                return fold(self.graph, self.journal.events(run_id))

            self.journal.append(run_id, EventType.STEP_FINISHED, node.name,
                                {"patch": patch})
            steps += 1

    def approve(self, run_id: str, *, granted: bool, by: str = "operator") -> RunState:
        rs = fold(self.graph, self.journal.events(run_id))
        if rs.status != "awaiting_approval":
            raise ValueError(f"run {run_id} is not awaiting approval (status {rs.status})")
        self.journal.append(
            run_id,
            EventType.APPROVAL_GRANTED if granted else EventType.APPROVAL_DENIED,
            rs.next_node,
            {"by": by, "at": time.time()},
        )
        return self.resume(run_id)

    def replay(self, run_id: str, upto_seq: int) -> RunState:
        """Rebuild state through a journal sequence without running side effects."""
        return fold(self.graph, self.journal.events(run_id, upto_seq=upto_seq))
