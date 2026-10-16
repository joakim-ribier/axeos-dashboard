// src/components/ui/ActionButton.tsx
import { Button, type ButtonProps, CircularProgress } from "@mui/material";

interface ActionButtonProps extends Omit<
  ButtonProps,
  "variant" | "size" | "startIcon"
> {
  icon: React.ReactNode;
  /** Swaps the icon for a spinner and blocks the button while true. */
  loading?: boolean;
}

/**
 * The one look of every action button (Save, Add, Search...): filled, with
 * a leading icon, and exactly as tall as a small text field so it lines up
 * with the inputs it sits next to. One component so a new button can't
 * drift from it.
 */
export const ActionButton = ({
  icon,
  loading = false,
  disabled,
  sx,
  ...props
}: ActionButtonProps) => (
  <Button
    {...props}
    variant="contained"
    size="small"
    disabled={disabled || loading}
    startIcon={loading ? <CircularProgress size={16} color="inherit" /> : icon}
    sx={[{ flexShrink: 0, height: 40 }, ...(Array.isArray(sx) ? sx : [sx])]}
  />
);
