import { EVENT_META, type RunEvent } from "@/lib/runs";

function detail(e: RunEvent): string {
  const p = e.payload as Record<string, unknown>;
  if (e.type === "effect") {
    return `${p.label} -> ${JSON.stringify(p.result)}`;
  }
  if (e.type === "step_finished") return JSON.stringify(p.patch ?? {});
  if (e.type === "run_failed" || e.type === "step_failed") {
    return String(p.reason ?? p.error ?? "");
  }
  if (e.type === "approval_granted" || e.type === "approval_denied") {
    return `by ${p.by}`;
  }
  return "";
}

/** Render ordered journal events on a rail that exposes crash gaps. */
export function Timeline({ events }: { events: RunEvent[] }) {
  return (
    <ol className="relative">
      <span
        aria-hidden
        className="absolute top-2 bottom-2 left-[7px] w-px bg-border"
      />
      {events.map((e) => {
        const meta = EVENT_META[e.type];
        const text = detail(e);
        return (
          <li key={e.seq} className="relative flex gap-4 py-2 pl-6">
            <span
              aria-hidden
              className="absolute top-3.5 left-0 size-[15px] rounded-full border-2 border-background"
              style={{ backgroundColor: `var(--${meta.tone})` }}
            />
            <span className="tabular w-8 shrink-0 pt-0.5 text-xs text-muted-foreground">
              {e.seq}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-3">
                <span
                  className={
                    meta.loud
                      ? "font-medium"
                      : "font-medium text-muted-foreground"
                  }
                  style={
                    meta.loud ? { color: `var(--${meta.tone})` } : undefined
                  }
                >
                  {meta.label}
                </span>
                {e.node && (
                  <code className="font-mono text-sm text-muted-foreground">
                    {e.node}
                  </code>
                )}
              </div>
              {text && (
                <p className="mt-0.5 font-mono text-xs break-all text-muted-foreground">
                  {text}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
