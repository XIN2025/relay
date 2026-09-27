from __future__ import annotations

import os
import random

from .graph import Graph, NodeContext, State

graph = Graph(START="classify")

# os._exit simulates a hard crash without unwinding or flushing.
CRASH_AT = os.environ.get("RELAY_CRASH_AT")


def _maybe_crash(node: str) -> None:
    if CRASH_AT == node:
        print(f"  [process killed inside {node!r}]", flush=True)
        os._exit(9)


@graph.node("classify", description="Ask the model what kind of ticket this is")
def classify(state: State, ctx: NodeContext) -> dict:
    def model_call() -> object:
        # Non-determinism proves replay uses the recorded result.
        return {
            "category": "refund_request",
            "confidence": round(random.uniform(0.80, 0.99), 4),
            "amount_usd": 240,
        }

    verdict = ctx.call("model:classify", model_call)
    _maybe_crash("classify")
    return {"category": verdict["category"], "confidence": verdict["confidence"],
            "amount_usd": verdict["amount_usd"]}


@graph.node("lookup_order", description="Fetch the order the ticket refers to")
def lookup_order(state: State, ctx: NodeContext) -> dict:
    order = ctx.call("db:lookup_order", lambda: {"order_id": "A-88213", "paid": True})
    _maybe_crash("lookup_order")
    return {"order": order}


@graph.node(
    "issue_refund",
    requires_approval=True,
    description="Irreversible. Held until a human approves.",
)
def issue_refund(state: State, ctx: NodeContext) -> dict:
    receipt = ctx.call(
        "payments:refund",
        lambda: {"receipt": f"rf_{random.randint(10**6, 10**7)}", "status": "settled"},
    )
    _maybe_crash("issue_refund")
    return {"refund": receipt}


@graph.node("notify", description="Tell the customer what happened")
def notify(state: State, ctx: NodeContext) -> dict:
    sent = ctx.call("email:send", lambda: {"to": "customer@example.com", "sent": True})
    _maybe_crash("notify")
    return {"notified": sent["sent"]}


@graph.node("decline", description="Close the ticket without refunding")
def decline(state: State, ctx: NodeContext) -> dict:
    _maybe_crash("decline")
    return {"outcome": "declined"}


graph.edge("classify", "lookup_order")


def after_lookup(state: State) -> str:
    if state.get("confidence", 0) < 0.85 or not state.get("order", {}).get("paid"):
        return "decline"
    return "issue_refund"


graph.branch(
    "lookup_order",
    after_lookup,
    {"issue_refund": "confident and paid", "decline": "low confidence or unpaid"},
)
graph.edge("issue_refund", "notify")
graph.edge("notify", Graph.END)
graph.edge("decline", Graph.END)
