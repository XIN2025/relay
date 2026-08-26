from __future__ import annotations

import json
import sqlite3
import time
from dataclasses import dataclass
from enum import StrEnum
from pathlib import Path
from typing import Iterator


class EventType(StrEnum):
    RUN_STARTED = "run_started"
    STEP_STARTED = "step_started"
    STEP_FINISHED = "step_finished"
    STEP_FAILED = "step_failed"
    # Recorded before step completion so resume can reuse the effect result.
    EFFECT = "effect"
    AWAITING_APPROVAL = "awaiting_approval"
    APPROVAL_GRANTED = "approval_granted"
    APPROVAL_DENIED = "approval_denied"
    RUN_FINISHED = "run_finished"
    RUN_FAILED = "run_failed"


@dataclass(frozen=True)
class Event:
    seq: int
    run_id: str
    type: EventType
    node: str | None
    payload: dict
    at: float


SCHEMA = """
CREATE TABLE IF NOT EXISTS events (
    seq     INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id  TEXT    NOT NULL,
    type    TEXT    NOT NULL,
    node    TEXT,
    payload TEXT    NOT NULL,
    at      REAL    NOT NULL
);
CREATE INDEX IF NOT EXISTS events_by_run ON events (run_id, seq);
"""


class Journal:
    """Append-only SQLite event log with crash-safe commits."""

    def __init__(self, path: Path | str) -> None:
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._db = sqlite3.connect(self.path, isolation_level=None)
        self._db.execute("PRAGMA journal_mode=WAL")
        # Flush each commit so a hard exit cannot erase the latest event.
        self._db.execute("PRAGMA synchronous=FULL")
        self._db.executescript(SCHEMA)

    def append(
        self,
        run_id: str,
        type: EventType,
        node: str | None = None,
        payload: dict | None = None,
    ) -> Event:
        cur = self._db.execute(
            "INSERT INTO events (run_id, type, node, payload, at) VALUES (?,?,?,?,?)",
            (run_id, str(type), node, json.dumps(payload or {}), time.time()),
        )
        return Event(
            seq=int(cur.lastrowid or 0),
            run_id=run_id,
            type=type,
            node=node,
            payload=payload or {},
            at=time.time(),
        )

    def events(self, run_id: str, upto_seq: int | None = None) -> list[Event]:
        """Every event for a run, oldest first. `upto_seq` bounds a replay."""
        sql = "SELECT seq, run_id, type, node, payload, at FROM events WHERE run_id = ?"
        args: list[object] = [run_id]
        if upto_seq is not None:
            sql += " AND seq <= ?"
            args.append(upto_seq)
        rows = self._db.execute(sql + " ORDER BY seq", args).fetchall()
        return [
            Event(seq=r[0], run_id=r[1], type=EventType(r[2]), node=r[3],
                  payload=json.loads(r[4]), at=r[5])
            for r in rows
        ]

    def runs(self) -> Iterator[str]:
        for (run_id,) in self._db.execute(
            "SELECT run_id FROM events GROUP BY run_id ORDER BY MIN(seq) DESC"
        ):
            yield run_id

    def close(self) -> None:
        self._db.close()
