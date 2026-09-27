const STEPS = [
  {
    title: "Start",
    command: "python -m relay start ticket-9",
    effect:
      "Runs classify and lookup_order, reaches the gate, and the process exits.",
  },
  {
    title: "Approve, then die",
    command: "RELAY_CRASH_AT=issue_refund python -m relay approve ticket-9",
    effect:
      "Approves and enters issue_refund. The refund lands, then the process is killed before the step finishes.",
  },
  {
    title: "Resume",
    command: "python -m relay start ticket-9",
    effect:
      "A fresh process folds the journal, re-enters issue_refund, and reads the recorded refund instead of issuing a second one.",
  },
  {
    title: "Replay",
    command: "python -m relay replay ticket-9 --at 7",
    effect:
      "Rebuilds the run as it stood at any event, without running anything.",
  },
];

/** The four commands that reproduce the crash-and-resume proof locally. */
export function RunItYourself() {
  return (
    <ol className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {STEPS.map((s, i) => (
        <li
          key={s.title}
          className="flex flex-col rounded-xl border border-border p-4"
        >
          <span className="font-mono text-xs text-muted-foreground">
            {String(i + 1).padStart(2, "0")}
          </span>
          <h3 className="mt-1 font-medium">{s.title}</h3>
          <code className="mt-3 rounded-lg bg-muted px-3 py-2 font-mono text-xs break-all">
            {s.command}
          </code>
          <p className="mt-3 text-sm text-muted-foreground">{s.effect}</p>
        </li>
      ))}
    </ol>
  );
}
