import { Handle, type NodeProps } from "@xyflow/react";
import { UserCheck } from "lucide-react";

import type { StepFlowNode } from "@/lib/layout";
import type { NodeTone } from "@/lib/progress";
import { cn } from "@/lib/utils";

const TONE: Record<NodeTone, string> = {
  idle: "border-border bg-background",
  done: "border-event-step/40 bg-event-step/5",
  current: "border-brand bg-background ring-2 ring-brand/20",
  held: "border-event-approval bg-event-approval/5 ring-2 ring-event-approval/20",
  failed: "border-event-effect bg-event-effect/5 ring-2 ring-event-effect/20",
  skipped: "border-border bg-background opacity-40",
};

/** One workflow node: its route condition, name and what it does. */
export function StepNode({
  data,
  sourcePosition,
  targetPosition,
}: NodeProps<StepFlowNode>) {
  const { node, when, tone } = data;
  const gate = node.requiresApproval;
  return (
    <div
      className={cn(
        "flex size-full flex-col rounded-xl border px-3.5 py-3 transition-[border-color,background-color,opacity,box-shadow] duration-300",
        TONE[tone],
        tone === "idle" && gate && "border-event-approval",
      )}
    >
      <div className="min-h-4 text-[12px] leading-4 text-muted-foreground">
        {when && `if ${when}`}
      </div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="font-mono text-[15px] font-medium">{node.name}</span>
        {gate && (
          <UserCheck
            aria-label="human approval gate"
            className="size-4 shrink-0 text-event-approval"
          />
        )}
      </div>
      <p className="mt-1 text-[13px] leading-snug text-muted-foreground">
        {node.description}
      </p>
      {targetPosition && (
        <Handle type="target" position={targetPosition} className="invisible" />
      )}
      {sourcePosition && (
        <Handle type="source" position={sourcePosition} className="invisible" />
      )}
    </div>
  );
}
