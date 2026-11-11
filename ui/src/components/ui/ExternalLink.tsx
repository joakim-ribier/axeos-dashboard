// src/components/ui/ExternalLink.tsx
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { Link, type LinkProps } from "@mui/material";

/** A link that opens in a new tab, its open-in-new icon after the text --
 * the way the app links out to hashboard, a board, a repository. */
export const ExternalLink = ({
  href,
  children,
  sx,
  ...props
}: Omit<LinkProps, "target" | "rel">) => (
  <Link
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    {...props}
    sx={[
      { display: "inline-flex", alignItems: "center", gap: 0.5 },
      ...(Array.isArray(sx) ? sx : [sx]),
    ]}
  >
    {children}
    <OpenInNewIcon sx={{ fontSize: 14 }} />
  </Link>
);
