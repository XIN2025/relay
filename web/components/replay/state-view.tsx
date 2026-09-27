import { cn } from "@/lib/utils";

/** The folded run state, with the keys the current event changed marked. */
export function StateView({
  state,
  previous,
}: {
  state: Record<string, unknown>;
  previous: Record<string, unknown>;
}) {
  const entries = Object.entries(state);
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">Empty.</p>;
  }
  return (
    <dl className="space-y-1.5">
      {entries.map(([key, value]) => {
        const json = JSON.stringify(value);
        const changed = JSON.stringify(previous[key]) !== json;
        return (
          <div
            key={key}
            className={cn(
              "border-l-2 py-0.5 pl-3 transition-colors duration-300",
              changed ? "border-event-step" : "border-transparent",
            )}
          >
            <dt className="flex items-baseline gap-2 font-mono text-xs text-muted-foreground">
              {key}
              {changed && (
                <span className="font-sans text-[11px] font-medium text-event-step">
                  just changed
                </span>
              )}
            </dt>
            <dd className="font-mono text-sm break-all">{json}</dd>
          </div>
        );
      })}
    </dl>
  );
}
