// src/components/ui/DeviceLink.tsx
import { useTranslation } from "react-i18next";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { Link } from "@mui/material";

/** A miner's IP, opening its own AxeOS interface. Clicking it never
 * reaches what it sits in -- a list row that opens something itself. */
export const DeviceLink = ({ ip }: { ip: string }) => {
  const { t } = useTranslation();
  return (
    <Link
      href={`http://${ip}`}
      target="_blank"
      rel="noopener noreferrer"
      title={t("miner.openDevice")}
      onClick={(e) => e.stopPropagation()}
      sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}
    >
      {ip}
      <OpenInNewIcon sx={{ fontSize: 13 }} />
    </Link>
  );
};
