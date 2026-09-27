from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable, Protocol

State = dict


class NodeFn(Protocol):
    def __call__(self, state: State, ctx: "NodeContext") -> dict: ...


@dataclass
class NodeContext:
    """Expose the recorded side-effect interface available to nodes."""

    run_id: str
    node: str
    call: Callable[..., object]


@dataclass
class Node:
    name: str
    fn: NodeFn
    requires_approval: bool = False
    description: str = ""


@dataclass
class Graph:
    """Store workflow nodes and state-dependent routes."""

    START: str
    nodes: dict[str, Node] = field(default_factory=dict)
    routes: dict[str, Callable[[State], str]] = field(default_factory=dict)
    # Every node a route may lead to, with the condition that picks it.
    targets: dict[str, dict[str, str]] = field(default_factory=dict)

    END = "__end__"

    def node(
        self, name: str, *, requires_approval: bool = False, description: str = ""
    ) -> Callable[[NodeFn], NodeFn]:
        def register(fn: NodeFn) -> NodeFn:
            self.nodes[name] = Node(
                name=name,
                fn=fn,
                requires_approval=requires_approval,
                description=description or (fn.__doc__ or "").strip().split("\n")[0],
            )
            return fn

        return register

    def edge(self, frm: str, to: str) -> None:
        self.routes[frm] = lambda _state, _to=to: _to
        self.targets[frm] = {to: ""}

    def branch(
        self, frm: str, chooser: Callable[[State], str], targets: dict[str, str]
    ) -> None:
        """Route on state. `targets` maps each possible next node to its condition."""

        def route(state: State) -> str:
            to = chooser(state)
            if to not in targets:
                raise ValueError(f"branch from {frm!r} chose undeclared {to!r}")
            return to

        self.routes[frm] = route
        self.targets[frm] = dict(targets)

    def edges(self) -> list[tuple[str, str, str]]:
        return [
            (frm, to, when)
            for frm, tos in self.targets.items()
            for to, when in tos.items()
        ]

    def next_after(self, node: str, state: State) -> str:
        route = self.routes.get(node)
        return route(state) if route else self.END

    def validate(self) -> list[str]:
        """Return structural problems that can be detected before execution."""
        problems = []
        if self.START not in self.nodes:
            problems.append(f"START node {self.START!r} is not defined")
        for name in self.nodes:
            if name not in self.routes:
                problems.append(f"node {name!r} has no outgoing route")
        for frm, to, _ in self.edges():
            if frm not in self.nodes:
                problems.append(f"route from undefined node {frm!r}")
            if to != self.END and to not in self.nodes:
                problems.append(f"edge {frm!r} -> {to!r} points nowhere")
        return problems
