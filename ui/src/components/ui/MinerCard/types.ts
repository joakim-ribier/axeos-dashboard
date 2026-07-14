// src/components/ui/MinerCard/types.ts
export type MinerActionType = "restart" | "switchPool";

export interface ActionConfig {
  type: MinerActionType;
  title: string;
  description: string;
  confirmText: string;
  actionLabel: string;
  actionColor: "warning" | "error" | "info";
}
