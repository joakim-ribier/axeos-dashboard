// src/components/ui/MinerCard/components/InfoItemWithColor.tsx
import { SvgIconComponent } from "@mui/icons-material";
import { Theme, useTheme } from "@mui/material/styles";

import { InfoItem } from "./InfoItem";

/**
 * Wrapper that adds a colour parameter to InfoItem.
 * `colour` can be a key of the MUI palette (e.g. "error", "warning")
 * or any raw CSS colour string (hex, rgb, …).
 */
type PaletteKey = keyof Theme["palette"]; // "primary" | "error" | ...

interface Props {
  /** Icon to render */
  Icon: SvgIconComponent;
  /** Optional colour – palette key or raw CSS colour */
  colour?: PaletteKey | string;
  /** Children are the same as in InfoItem (label + value) */
  children: React.ReactNode;
}

/**
 * Resolve a colour safely:
 *   • If `colour` matches a palette key, try to use its `main` shade
 *     (when the entry is a PaletteColor).
 *   • Otherwise treat the value as a raw CSS colour.
 *
 * The function works around the fact that `Theme["palette"]` is not
 * indexable by a generic string – we temporarily cast to `any`.
 */
function resolveColour(colour: PaletteKey | string, theme: Theme): string {
  // Is the supplied value a known palette key ?
  if (Object.prototype.hasOwnProperty.call(theme.palette, colour)) {
    // Cast to any to allow dynamic indexing
    const entry = (theme.palette as any)[colour as string];

    // Most palette entries that are objects have a `main` field
    if (
      entry &&
      typeof entry === "object" &&
      "main" in entry &&
      typeof (entry as any).main === "string"
    ) {
      return (entry as any).main;
    }

    // Fallback: the entry itself might already be a colour string/number
    return String(entry);
  }

  // Not a palette key → treat as a raw CSS colour (hex, rgb, etc.)
  return colour as string;
}

/**
 * Component that forwards the resolved colour to InfoItem.
 */
export const InfoItemWithColor = ({
  Icon,
  colour = "primary",
  children,
}: Props) => {
  const theme = useTheme();
  const resolvedColour = resolveColour(colour, theme);

  return (
    <InfoItem Icon={Icon} iconColor={resolvedColour}>
      {children}
    </InfoItem>
  );
};
