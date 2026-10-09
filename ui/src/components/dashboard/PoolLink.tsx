import { useTranslation } from "react-i18next";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { Box, Link } from "@mui/material";

interface PoolLinkProps {
  host: string;
  href: string;
  iconSize: number;
  onClick?: (e: React.MouseEvent) => void;
}

/** A pool's host linking to its dashboard. Only the host gets cut short
 * when space runs out -- the icon is what says it's a link. */
export const PoolLink = ({ host, href, iconSize, onClick }: PoolLinkProps) => {
  const { t } = useTranslation();

  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={t("miner.openPool")}
      underline="hover"
      onClick={onClick}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.5,
        minWidth: 0,
      }}
    >
      <Box
        component="span"
        sx={{
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {host}
      </Box>
      <OpenInNewIcon sx={{ fontSize: iconSize, flexShrink: 0 }} />
    </Link>
  );
};
