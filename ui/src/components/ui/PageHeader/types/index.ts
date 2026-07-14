// src/components/ui/PageHeader/types/index.ts
import { SxProps, Theme } from "@mui/material";

export interface PageHeaderProps {
  /** Title displayed on the left side */
  title: string;
  /** Optional left‑hand icon (e.g. mining, dashboard, etc.) */
  icon?: React.ReactNode;
  /** Optional description displayed below the GradientBar */
  description?: React.ReactNode;
  /** Optional badge rendered inline to the right of the title */
  titleBadge?: React.ReactNode;
  /** Optional actions (buttons, menus…) displayed on the right side */
  actions?: React.ReactNode[];
  /** Force actions to be shown even on mobile (default: false) */
  forceShowActions?: boolean;
  /** Additional styling for the root container */
  sx?: SxProps<Theme>;
  /** Props forwarded to GradientBar (height, radius, colors) */
  gradientProps?: {
    height?: number;
    radius?: number;
    colors?: string[];
  };
}
