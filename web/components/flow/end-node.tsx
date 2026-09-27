import { Handle, type NodeProps } from "@xyflow/react";

import type { EndFlowNode } from "@/lib/layout";
import { cn } from "@/lib/utils";

/** The terminal marker every route ends at. */
export function EndNode({ data, targetPosition }: NodeProps<EndFlowNode>) {
  const done = data.tone === "done";
  return (
    <div
      className={cn(
        "flex size-full items-center justify-center rounded-full border text-xs font-medium transition-colors duration-300",
        done
          ? "border-event-done bg-event-done text-white"
          : "border-border bg-background text-muted-foreground",
      )}
    >
      end
      {targetPosition && (
        <Handle type="target" position={targetPosition} className="invisible" />
      )}
    </div>
  );
}
