"use client";

import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { FlowDiagram } from "@/components/flow/flow-diagram";
import { StateView } from "@/components/replay/state-view";
import { Timeline } from "@/components/timeline";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { momentsOf, narrate, storyOf } from "@/lib/narrate";
import { EVENT_META, type Graph, type Run } from "@/lib/runs";

const STEP_MS = 1100;

/**
 * Walk a run's journal one event at a time. Every position shows the
 * engine's own fold through that event, which is what `relay replay --at`
 * computes, so the page never re-implements the engine.
 */
export function JournalScrubber({
  graph,
  runs,
}: {
  graph: Graph;
  runs: Run[];
}) {
  const [runId, setRunId] = useState(runs[0].runId);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  const run = runs.find((r) => r.runId === runId) ?? runs[0];
  const last = run.events.length - 1;
  const atEnd = index >= last;
  const isPlaying = playing && !atEnd;

  const beats = useMemo(() => narrate(run), [run]);
  const gate = graph.nodes.find((n) => n.requiresApproval)?.name;
  const moments = useMemo(() => momentsOf(run, gate), [run, gate]);

  useEffect(() => {
    if (!isPlaying) return;
    const id = setTimeout(() => setIndex((i) => i + 1), STEP_MS);
    return () => clearTimeout(id);
  }, [isPlaying, index]);

  const selectRun = (id: string) => {
    setRunId(id);
    setIndex(0);
    setPlaying(false);
  };
  const go = (i: number) => {
    setIndex(Math.min(Math.max(i, 0), last));
    setPlaying(false);
  };
  const togglePlay = () => {
    if (isPlaying) return setPlaying(false);
    if (atEnd) setIndex(0);
    setPlaying(true);
  };

  const event = run.events[index];
  const frame = run.replay[index];
  const beat = beats[index];
  const meta = EVENT_META[event.type];
  const recent = run.events.slice(Math.max(0, index - 5), index + 1);

  return (
    <div className="space-y-6 rounded-xl border border-border p-3 sm:p-6">
      <Tabs value={runId} onValueChange={(v) => selectRun(String(v))}>
        <TabsList className="h-auto w-full flex-wrap sm:w-fit">
          {runs.map((r) => (
            <TabsTrigger key={r.runId} value={r.runId} className="gap-2">
              <span className="font-mono">{r.runId}</span>
              <span className="hidden text-muted-foreground sm:inline">
                {storyOf(r)}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <FlowDiagram graph={graph} progress={frame} />

      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          onClick={() => go(index - 1)}
          disabled={index === 0}
          aria-label="Previous event"
        >
          <ChevronLeft />
        </Button>
        <Button
          size="icon"
          onClick={togglePlay}
          aria-label={isPlaying ? "Pause" : "Play the journal"}
        >
          {isPlaying ? <Pause /> : <Play />}
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => go(index + 1)}
          disabled={atEnd}
          aria-label="Next event"
        >
          <ChevronRight />
        </Button>
        <Slider
          className="mx-2 flex-1"
          min={0}
          max={last}
          value={[index]}
          onValueChange={(v) => go(Array.isArray(v) ? v[0] : v)}
          aria-label="Journal position"
        />
        <span className="tabular shrink-0 font-mono text-xs text-muted-foreground">
          seq {event.seq}/{run.events[last].seq}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {moments.map((m) => (
          <Button
            key={m.label}
            variant={m.index === index ? "secondary" : "outline"}
            size="xs"
            onClick={() => go(m.index)}
          >
            {m.label}
          </Button>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.25fr_1fr]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span
              className="font-medium"
              style={{ color: `var(--${meta.tone})` }}
            >
              {meta.label}
            </span>
            {event.node && (
              <code className="font-mono text-sm">{event.node}</code>
            )}
            <span className="ml-auto rounded-full bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
              process {beat.process}
            </span>
          </div>
          <p aria-live="polite" className="mt-2 min-h-12 text-muted-foreground">
            {beat.text}
          </p>
          <div className="mt-4">
            <Timeline events={recent} activeSeq={event.seq} />
          </div>
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-medium">
            State, rebuilt from the journal
          </h3>
          <p className="mt-1 mb-4 text-sm text-muted-foreground">
            Nothing here is held in memory between steps.
          </p>
          <StateView
            state={frame.state}
            previous={run.replay[index - 1]?.state ?? {}}
          />
        </div>
      </div>
    </div>
  );
}
