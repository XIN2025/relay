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

    def branch(self, frm: str, chooser: Callable[[State], str]) -> None:
        self.routes[frm] = chooser

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
        for frm, route in self.routes.items():
            if frm not in self.nodes:
                problems.append(f"route from undefined node {frm!r}")
            # Only static edges can be checked without executing user code.
            if getattr(route, "__name__", "") == "<lambda>":
                target = route({})
                if target != self.END and target not in self.nodes:
                    problems.append(f"edge {frm!r} -> {target!r} points nowhere")
        return problems
